<script setup>
import { computed, ref, toRaw, watch } from 'vue'
import { settings } from './state.js'

const ttsOn = computed(() => !!settings.vault.value?.features?.tts)

async function toggleTts () {
  const features = { ...(settings.vault.value?.features || {}), tts: !ttsOn.value }
  await settings.saveVault({ features })
}

const narrate = ref({ rules: [] })
const original = ref(null)
const saved = ref(false)

const dirty = computed(() => JSON.stringify(narrate.value) !== JSON.stringify(original.value))

watch(() => settings.vault.value?.narrate, (n) => {
  const seed = n && Array.isArray(n.rules) ? n : { rules: [] }
  narrate.value = JSON.parse(JSON.stringify(seed))
  original.value = JSON.parse(JSON.stringify(seed))
}, { immediate: true })

async function save () {
  const raw = JSON.parse(JSON.stringify(toRaw(narrate.value)))
  for (const r of raw.rules) {
    r.priority = Number(r.priority) || 0
    r.force = !!r.force
  }
  await settings.saveVault({ narrate: raw })
  saved.value = true
  setTimeout(() => (saved.value = false), 1500)
}

function cancel () {
  narrate.value = JSON.parse(JSON.stringify(original.value))
}

function addRule () {
  narrate.value.rules.push({
    tag: '', attribute: '', value: '',
    voice: 'ava', language: 'en',
    collection: '', album: '', artist: '',
    priority: 0, force: false,
  })
}

function removeRule (i) { narrate.value.rules.splice(i, 1) }

const flushBusy = ref(false)
const flushResult = ref(null)
async function flushChunks () {
  flushBusy.value = true
  flushResult.value = null
  try {
    flushResult.value = await window.api.tts.flushChunks()
  } catch (err) {
    flushResult.value = { error: err.message }
  } finally {
    flushBusy.value = false
  }
}

const rerunBusy = ref(false)
const rerunResult = ref(null)
async function rerunJobs () {
  rerunBusy.value = true
  rerunResult.value = null
  try {
    rerunResult.value = await window.api.tts.rerunJobs()
  } catch (err) {
    rerunResult.value = { error: err.message }
  } finally {
    rerunBusy.value = false
  }
}
</script>

<template>
  <div class="nar">
    <div class="nar_tts">
      <div>
        <div class="nar_tts_name">TTS Narration</div>
        <div class="g-hint">Watch entries and send matching ones to a local TTS server.</div>
      </div>
      <button class="g-btn nar_tts_toggle" :class="{ _on: ttsOn }" @click="toggleTts">
        {{ ttsOn ? 'ON' : 'OFF' }}
      </button>
    </div>

    <label class="g-label">Narrate rules</label>
    <div class="g-hint nar_intro">
      First match wins. An entry is narrated if at least one rule's match condition (tag prefix and/or attribute=value) is true.
      Voice is required.
    </div>

    <div class="nar_block">
      <div class="nar_block_head">
        <span class="nar_block_title">Rules</span>
        <button class="g-btn" @click="addRule">Add rule</button>
      </div>

      <div v-for="(rule, i) in narrate.rules" :key="i" class="nar_rule">
        <div class="nar_rule_head">
          <span class="nar_rule_idx">#{{ i + 1 }}</span>
          <button class="nar_x" @click="removeRule(i)">&times;</button>
        </div>

        <div class="nar_grid">
          <label class="nar_field">
            <span class="nar_lbl">tag</span>
            <input v-model="rule.tag" class="g-input" placeholder="story" spellcheck="false" />
          </label>
          <label class="nar_field">
            <span class="nar_lbl">attribute</span>
            <input v-model="rule.attribute" class="g-input" placeholder="project" spellcheck="false" />
          </label>
          <label class="nar_field">
            <span class="nar_lbl">value</span>
            <input v-model="rule.value" class="g-input" placeholder="BT" spellcheck="false" />
          </label>
          <label class="nar_field">
            <span class="nar_lbl">voice *</span>
            <input v-model="rule.voice" class="g-input" :class="{ _err: !rule.voice }" placeholder="ava" spellcheck="false" />
          </label>
          <label class="nar_field">
            <span class="nar_lbl">language</span>
            <input v-model="rule.language" class="g-input" placeholder="en" spellcheck="false" />
          </label>
          <label class="nar_field">
            <span class="nar_lbl">collection</span>
            <input v-model="rule.collection" class="g-input" placeholder="TTK" spellcheck="false" />
          </label>
          <label class="nar_field">
            <span class="nar_lbl">album</span>
            <input v-model="rule.album" class="g-input" placeholder="(falls back to collection)" spellcheck="false" />
          </label>
          <label class="nar_field">
            <span class="nar_lbl">artist</span>
            <input v-model="rule.artist" class="g-input" placeholder="Narrator" spellcheck="false" />
          </label>
          <label class="nar_field">
            <span class="nar_lbl">priority</span>
            <input v-model.number="rule.priority" type="number" class="g-input" placeholder="0" />
          </label>
          <label class="nar_field nar_field_check">
            <input v-model="rule.force" type="checkbox" />
            <span class="nar_lbl">force (bypass chunk warnings)</span>
          </label>
        </div>
      </div>

      <div v-if="!narrate.rules.length" class="g-hint nar_empty">No rules. Click "Add rule" to start.</div>
    </div>

    <div class="nar_block">
      <div class="nar_block_head">
        <span class="nar_block_title">Maintenance</span>
      </div>
      <div class="nar_maint">
        <div class="nar_maint_row">
          <div>
            <div class="nar_maint_name">Re-run all jobs</div>
            <div class="g-hint">Re-trigger every entry that matches a rule. Use after deleting WAVs externally — cached chunks re-stitch fast, no re-synthesis.</div>
          </div>
          <button class="g-btn" :disabled="rerunBusy" @click="rerunJobs">
            {{ rerunBusy ? 'Running…' : 'Re-run' }}
          </button>
        </div>
        <div v-if="rerunResult" class="nar_maint_result">
          <span v-if="rerunResult.error" class="nar_maint_err">{{ rerunResult.error }}</span>
          <span v-else>
            Re-triggered {{ rerunResult.triggered }} job(s)<template v-if="rerunResult.skipped">, skipped {{ rerunResult.skipped }} (chunk warnings)</template><template v-if="rerunResult.failed?.length">, {{ rerunResult.failed.length }} failed</template>.
          </span>
        </div>
      </div>

      <div class="nar_maint">
        <div class="nar_maint_row">
          <div>
            <div class="nar_maint_name">Flush orphan chunks</div>
            <div class="g-hint">Delete cached chunk WAVs that no active job references on the TTS server. Saves disk space.</div>
          </div>
          <button class="g-btn" :disabled="flushBusy" @click="flushChunks">
            {{ flushBusy ? 'Flushing…' : 'Flush' }}
          </button>
        </div>
        <div v-if="flushResult" class="nar_maint_result">
          <span v-if="flushResult.error" class="nar_maint_err">{{ flushResult.error }}</span>
          <span v-else>Flushed {{ flushResult.deletedChunks }} chunk(s).</span>
        </div>
      </div>
    </div>

    <div class="nar_footer">
      <div>
        <div v-if="saved" class="g-saved">Saved</div>
        <div class="g-hint">Changes apply live — no restart needed.</div>
      </div>
      <div class="nar_footer_btns">
        <button class="g-btn" :disabled="!dirty" @click="cancel">Cancel</button>
        <button class="g-btn _primary" :disabled="!dirty" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nar {
  &_intro {
    margin-bottom: var(--gap-md);
  }

  &_tts {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-md);
    padding-bottom: var(--gap-md);
    margin-bottom: var(--gap-md);
    border-bottom: 1px solid var(--bg-btn);

    &_name {
      font-size: var(--font-ui);
      color: var(--text);
      margin-bottom: var(--gap-xs);
    }

    &_toggle {
      padding: 4px 14px;
      font-size: var(--font-label);
      font-weight: 600;
      min-width: 48px;
      flex-shrink: 0;

      &._on {
        background: var(--positive);
        color: var(--text);
        &:hover { background: var(--positive-hover); }
      }
    }
  }

  &_block {
    margin-bottom: var(--gap-md);

    &_head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--gap-sm);
    }

    &_title {
      font-size: var(--font-label);
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }

  &_rule {
    background: var(--bg);
    border: 1px solid var(--bg-btn);
    border-radius: var(--radius-md);
    padding: var(--gap-sm) var(--gap-md);
    margin-bottom: var(--gap-sm);

    &_head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--gap-sm);
    }

    &_idx {
      font-size: var(--font-label);
      color: var(--text-dim);
    }
  }

  &_grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--gap-sm);
  }

  &_field {
    display: flex;
    flex-direction: column;
    gap: 2px;

    &_check {
      flex-direction: row;
      align-items: center;
      gap: var(--gap-xs);
    }
  }

  &_lbl {
    font-size: var(--font-label);
    color: var(--text-dim);
  }

  &_x {
    all: unset;
    cursor: pointer;
    color: var(--text-dim);
    font-size: var(--font-heading);
    width: 20px;
    text-align: center;
    flex-shrink: 0;
    &:hover { color: var(--negative); }
  }

  &_empty {
    padding: var(--gap-sm) 0;
  }

  &_footer {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg);
    padding: var(--gap-sm) 0;
    border-top: 1px solid var(--bg-btn);
    margin-top: auto;

    &_btns {
      display: flex;
      gap: var(--gap-sm);
    }
  }

  & .g-input._err {
    border-color: var(--negative);
  }

  &_maint {
    background: var(--bg);
    border: 1px solid var(--bg-btn);
    border-radius: var(--radius-md);
    padding: var(--gap-sm) var(--gap-md);
    margin-bottom: var(--gap-sm);

    &_row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap-md);
    }

    &_name {
      font-size: var(--font-ui);
      color: var(--text);
      margin-bottom: var(--gap-xs);
    }

    &_result {
      margin-top: var(--gap-sm);
      font-size: var(--font-label);
      color: var(--text-dim);
    }

    &_err {
      color: var(--negative);
    }
  }
}
</style>
