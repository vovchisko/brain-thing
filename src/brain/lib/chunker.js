/**
 * Dialogue-aware text chunking for TTS.
 * Ported from D:\lab\tts-home-v2\chunker.py
 */

import crypto from 'crypto'

const MAX_CHUNK_CHARS = 200

const ELLIPSIS = '\u2026'
const DOUBLE_QUESTION = '\u2047'
const DOUBLE_EXCLAIM = '\u203C'
const QUESTION_EXCLAIM = '\u2048'
const EXCLAIM_QUESTION = '\u2049'
const TRIPLE_EXCLAIM = '\u2762'

const ATTR_VERBS = [
  'said', 'asked', 'replied', 'whispered', 'shouted', 'continued', 'explained',
  'murmured', 'added', 'exclaimed', 'began', 'answered', 'muttered', 'called',
  'cried', 'demanded', 'insisted', 'suggested', 'agreed', 'interrupted', 'snapped',
  'sighed', 'laughed', 'groaned', 'hissed', 'growled', 'screamed', 'noted',
  'observed', 'remarked', 'stated', 'declared', 'announced', 'admitted', 'confessed',
  'warned', 'promised', 'threatened', 'pleaded', 'begged', 'ordered', 'commanded',
]

const ATTR_PAT = new RegExp(`^(\\w+\\s+)?(${ ATTR_VERBS.join('|') })\\b`, 'i')
const MD_SKIP = /^([-*_]{3,}|#{1,6}\s+.*)$/

function pre (text) {
  text = text.replace(/\.\.\./g, ELLIPSIS).replace(/\. \. \./g, ELLIPSIS)
  text = text.replace(/\?!/g, QUESTION_EXCLAIM).replace(/!\?/g, EXCLAIM_QUESTION)
  text = text.replace(/\?\?/g, DOUBLE_QUESTION)
  text = text.replace(/!!!/g, TRIPLE_EXCLAIM).replace(/!!/g, DOUBLE_EXCLAIM)
  text = text.replace(/\*\*(.+?)\*\*/g, '$1')
  text = text.replace(/\*(.+?)\*/g, '$1')
  return text
}

function post (text) {
  return text
      .replace(new RegExp(ELLIPSIS, 'g'), '...')
      .replace(new RegExp(DOUBLE_QUESTION, 'g'), '??')
      .replace(new RegExp(DOUBLE_EXCLAIM, 'g'), '!!')
      .replace(new RegExp(QUESTION_EXCLAIM, 'g'), '?!')
      .replace(new RegExp(EXCLAIM_QUESTION, 'g'), '!?')
      .replace(new RegExp(TRIPLE_EXCLAIM, 'g'), '!!!')
}

function splitSentences (text) {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

function findReplicas (text) {
  const replicas = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '\u201c') {
      const start = i
      i++
      while (i < text.length && text[i] !== '\u201d') i++
      if (i < text.length) i++
      replicas.push([ start, i, text.slice(start, i) ])
    } else {
      i++
    }
  }
  return replicas
}

function splitLongReplica (replica, maxChars) {
  const inner = (replica.startsWith('\u201c') && replica.endsWith('\u201d'))
      ? replica.slice(1, -1)
      : replica

  const raw = inner.split(/([.!?]+)\s+/)
  const parts = []
  let idx = 0
  while (idx < raw.length) {
    if (idx + 1 < raw.length && /^[.!?]+$/.test(raw[idx + 1])) {
      parts.push(raw[idx] + raw[idx + 1])
      idx += 2
    } else {
      if (raw[idx].trim()) parts.push(raw[idx])
      idx++
    }
  }
  if (!parts.length) return [ replica ]

  const chunks = []
  let current = '\u201c'
  for (let j = 0; j < parts.length; j++) {
    const part = parts[j].trim()
    const isLast = j === parts.length - 1
    const test = part + (isLast ? '\u201d' : '')
    if (current.length + test.length + 1 <= maxChars) {
      current = current + (current !== '\u201c' ? ' ' : '') + part
      if (isLast) current += '\u201d'
    } else {
      if (current !== '\u201c') chunks.push(current)
      current = '\u201c' + part
      if (isLast) current += '\u201d'
    }
  }
  if (current && current !== '\u201c') chunks.push(current)
  return chunks.length ? chunks : [ replica ]
}

function build (pieces, maxChars, warnings) {
  const chunks = []
  let current = ''
  for (const raw of pieces) {
    const piece = raw.trim()
    if (!piece) continue
    if (piece.length > maxChars) {
      if (current) {
        chunks.push(post(current.trim()))
        current = ''
      }
      warnings.push(`Chunk exceeds ${ maxChars } chars (${ piece.length }): ${ piece.slice(0, 50) }...`)
      chunks.push(post(piece))
      continue
    }
    if (current.length + piece.length + 1 <= maxChars) {
      current = (current + ' ' + piece).trim()
    } else {
      if (current) chunks.push(post(current.trim()))
      current = piece
    }
  }
  if (current) chunks.push(post(current.trim()))
  return chunks
}

function chunkLong (line, maxChars, warnings) {
  const text = pre(line)
  const replicas = findReplicas(text)

  if (!replicas.length) {
    return build(splitSentences(text), maxChars, warnings)
  }

  const segments = []
  let pos = 0
  for (const [ start, end, content ] of replicas) {
    if (pos < start) {
      const n = text.slice(pos, start)
      if (n.trim()) segments.push([ 'n', n ])
    }
    segments.push([ 'r', content ])
    pos = end
  }
  if (pos < text.length) {
    const n = text.slice(pos)
    if (n.trim()) segments.push([ 'n', n ])
  }

  const processed = []
  let i = 0
  while (i < segments.length) {
    const [ kind, seg ] = segments[i]
    if (kind === 'r') {
      let prefix = '', suffix = ''
      if (processed.length && /[,:\-]\s*$/.test(processed[processed.length - 1])) {
        prefix = processed.pop() + ' '
      }
      if (i + 1 < segments.length && segments[i + 1][0] === 'n') {
        const nxt = segments[i + 1][1].trim()
        if (nxt && (nxt[0] === nxt[0].toLowerCase() && nxt[0] !== nxt[0].toUpperCase() || ATTR_PAT.test(nxt))) {
          const m = nxt.match(/[.!?]/)
          const attrEnd = m ? m.index + 1 : nxt.length
          suffix = ' ' + nxt.slice(0, attrEnd)
          const rest = nxt.slice(attrEnd).trim()
          if (rest) {
            segments[i + 1] = [ 'n', rest ]
          } else {
            i++
          }
        }
      }
      const full = prefix + seg + suffix
      if (full.length <= maxChars) {
        processed.push(full.trim())
      } else {
        const parts = splitLongReplica(seg, maxChars - suffix.length)
        if (prefix && parts.length) parts[0] = prefix + parts[0]
        if (suffix && parts.length) parts[parts.length - 1] = parts[parts.length - 1] + suffix
        processed.push(...parts.map(p => p.trim()))
      }
    } else {
      processed.push(...splitSentences(seg))
    }
    i++
  }

  return build(processed, maxChars, warnings)
}

function cleanLine (line) {
  if (MD_SKIP.test(line)) return null
  line = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // [text](url) → text
  line = line.replace(/!\[[^\]]*\]\([^)]+\)/g, '')        // ![alt](img) → remove
  line = line.replace(/`([^`]+)`/g, '$1')                  // `code` → code
  line = line.replace(/^\s*>\s?/, '')                       // > blockquote → strip
  line = line.replace(/^\s*[-*+]\s+/, '')                   // - list → strip marker
  line = line.replace(/^\s*\d+\.\s+/, '')                   // 1. ordered → strip
  return line.trim() || null
}

// --- Hasher (from hasher.py) ---

/** Strip quotes that cause XTTS hallucination. Used for hashing and TTS input. */
function cleanForTts (text) {
  return text.replace(/["\u201c\u201d]/g, '').trim()
}

function chunkHash (text, voice = 'ava', language = 'en') {
  return crypto.createHash('sha256').update(`${ cleanForTts(text) }|${ voice }|${ language }`).digest('hex')
}

function jobChecksum (hashes) {
  return crypto.createHash('sha256').update(hashes.join('|')).digest('hex').slice(0, 16)
}

// --- Public API ---

/**
 * Split text into TTS-ready chunks.
 * @param {string} text - Raw markdown text
 * @param {number} [maxChars=200]
 * @returns {{ chunks: string[], warnings: string[] }}
 */
export function chunkText (text, maxChars = MAX_CHUNK_CHARS) {
  const warnings = []
  const chunks = []
  for (const raw of text.split('\n')) {
    const line = cleanLine(raw.trim())
    if (!line) continue
    if (line.length <= maxChars) {
      chunks.push(line)
    } else {
      chunks.push(...chunkLong(line, maxChars, warnings))
    }
  }
  return { chunks, warnings }
}

export { cleanForTts, chunkHash, jobChecksum, MAX_CHUNK_CHARS }
