# Brain Thing

A local knowledge base that connects your markdown notes to AI assistants via [MCP](https://modelcontextprotocol.io/).

You write in Obsidian (or any markdown editor). Brain Thing indexes your vault, builds semantic embeddings, and gives Claude direct access to search, read, create, and organise your entries — without uploading anything to the cloud.

Edit a note in Obsidian — Claude sees it in seconds. Create an entry through Claude — it appears in Obsidian immediately. Same `.md` files, no sync layer.

> 🖐️ Hold on!
>
> This tool emerged as something I used for myself, and wasn't tested on Mac or Win 11, so in case of any issues, don't be shy - report it https://github.com/vovchisko/brain-thing/issues
> And indeed make a backup of your Obsidian Vault, if you use it.

## Features

🔍 **Semantic search** — "find my notes about sourdough fermentation" works even if you never used those exact words. Brain Thing runs a local embedding model and matches by meaning.

📊 **Structured queries** — search by dates, numbers, tags, and custom fields with operators. One tool call, not a manual scan of your vault.

🏷️ **Tag hierarchy** — tags like `work/task` and `cooking/bread/sourdough` support prefix matching. Search `work` and get everything under it.

📁 **Projects** — group entries with a simple `project` field. Every tool supports project filtering. Say "create a note for Novel" and the AI sets the field automatically.

🔗 **Backlinks** — when Claude reads an entry, it sees which other entries reference it. Relationship graph without reading the whole vault.

📂 **Auto-organise** — map projects and tags to folders. The AI creates an entry → Brain Thing puts the file where it belongs. Obsidian sees the same folder structure.

🩺 **Diagnostics** — broken links, missing summaries, health checks — all as a tool call.

## Install

1. Download the latest release from [GitHub Releases](https://github.com/vovchisko/brain-thing/releases)
2. Run the installer (Windows will show an "Unknown Publisher" warning — no code signing yet)
3. On first launch, point Brain Thing to your vault folder
4. It downloads the embedding model (~1 GB) and indexes everything

### Connect to Claude

Brain Thing auto-registers its MCP server in Claude Desktop and Claude Code on startup. Toggle in **Settings → General → MCP**, then restart Claude.

Once connected, the AI starts with a single `look_around` call that loads the full toolset and shows your vault overview.

## For Obsidian Users

Brain Thing is Obsidian-compatible by data format — standard markdown with YAML frontmatter and `[[wikilinks]]`.

### What Brain Thing adds

Brain Thing manages a few core fields in every entry:

| Field | Required | What it does |
|---|---|---|
| `created` | yes | Set once on creation, never overwritten |
| `modified` | yes | Updated on every write |
| `tags` | yes | Hierarchical tags with prefix matching |
| `summary` | auto | One-liner used for indexing; the AI usually sets it automatically |
| `project` | no | Groups entries for filtering and organization |

Your existing notes work as-is — Brain Thing reads whatever frontmatter is already there and won't rename or remove your fields.

You can also define custom fields (string, number, date, list) in **Settings → Fields** so the AI can follow your Obsidian habits. It sees them, can set them on create/update, and structured search uses type-aware operators.

### Where files go

By default, new files are created in your vault root. To auto-sort them into folders:

**Settings → Organise** lets you map projects to folders (`Novel` → `Novel/`, `Work` → `Work/Notes/`) and add rules per project — for example, entries tagged `novel/chapter` go to `Chapters/`, entries with `status: done` go to `Archive/`. There's also a fallback for entries without a project.

This is purely file management. The AI works with entry names, not file paths.

### Settings & sync

Brain Thing stores vault-specific settings (fields, ignore rules, organize config, features, guideline) inside your vault at `.brain-thing/settings.json`. The vector cache also lives in `.brain-thing/vector-cache`.

This means if you sync your vault across machines (Syncthing, Dropbox, etc.), your settings and embedding cache travel with it — same config everywhere, no re-indexing.

Machine-specific settings (server port, window position, embedding model) stay in the app's local data folder.

### How it syncs

Brain Thing watches your vault folder for changes. Both directions are live:

- Create/Edit in Obsidian → AI sees the update right away
- Create/Edit through Claude → file appears in Obsidian immediately
- Rename updates all `[[wikilinks]]` across the vault, same as Obsidian does
- Settings changed on another machine → detected and applied automatically

No import/export, no conflict resolution needed. You can have both open side by side.

### Why not just give Claude filesystem access?

Claude can read files, but a folder of markdown is just text. It would need dozens of reads and custom prompting to approximate what Brain Thing does in one tool call. Backlinks, tags, projects, and structured search aren't possible with a filesystem adapter.

### Why not an Obsidian plugin?

Brain Thing runs as a standalone desktop app with its own HTTP server. The embedding model (~1 GB) runs in a separate process — in a plugin, this would freeze the editor. Claude needs a stdio process to connect to, which a plugin can't provide.

## Under the Hood

### MCP Tools (16)

**Read & Search**

| Tool | Purpose |
|---|---|
| `look_around` | Vault overview: projects, tags, entry counts, guidelines |
| `what_is` | Semantic search; high-confidence match returns full entry |
| `grep` | Literal text search across titles, content, summaries |
| `search` | Structured queries with operators ($eq, $gt, $lt, $any, $all) |
| `get` | Full entry by name, with backlinks and broken link warnings |
| `tags_list` | Browse tag hierarchy, drill into prefixes |
| `fields` | Discover available fields and their types |
| `diagnostic` | Broken links, missing summaries, health checks |

**Write & Organize**

| Tool | Purpose |
|---|---|
| `create` | New entry with content, tags, project, and custom fields |
| `update` | Change frontmatter fields |
| `replace` | Find/replace in content (single or batch, atomic) |
| `insert` | Add text at start/end or before/after a marker |
| `delete` | Remove entry and file |
| `rename` | Rename entry; updates all wikilinks across the vault |
| `project_config` | List, create, update, remove project configs |

**Experimental:**

`narrate` — text-to-speech chunking. Under development; requires a custom XTTS v2 setup. Soon I will find a more friendly way to set it up or at least share my setup when it is somewhat stable.

### Data Format

Standard Obsidian-compatible markdown with YAML frontmatter:

```markdown
---
project: MyProject
tags:
  - work/task
  - urgent
status: active
priority: 3
due: 2026-05-01
summary: Implement the new auth flow
created: 2026-03-15
modified: 2026-04-01
---

Task details here. Supports [[wikilinks]] to other entries.
```

## Development

```bash
npm i
npm run dev
npm test
```

### Build for yourself

```bash
npm run build:win
npm run build:mac
```
