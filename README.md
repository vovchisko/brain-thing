# Brain Thing

Personal knowledge base with an MCP interface. Your Obsidian-compatible markdown vault, exposed to AI assistants over [MCP](https://modelcontextprotocol.io/) — local embeddings, live two-way sync, nothing uploaded. Electron app wrapping a self-contained Node server.

> Back up your vault before pointing the app at it. Pre-builds are Windows-only and unsigned ("Unknown Publisher"); Mac/Linux build from source. Bugs → https://github.com/vovchisko/brain-thing/issues

## Tools

23 MCP tools. All enabled tools are exposed from the start (toggle any in **Settings → Tools**); `look_around` is just the recommended first call for a vault overview.

### Documents

| Tool | What it does |
|---|---|
| `look_around` | Knowledge-base overview: projects, tags, counts, guideline. |
| `what_is` | Semantic search — ranks entries by meaning, not keywords. |
| `grep` | Literal text search across titles, content, and summaries. |
| `search` | Filter entries by attribute value (`$eq`/`$gt`/`$lt`/`$any`/`$all`). |
| `get` | Read one entry (full / body-only / size estimate) with backlinks. |
| `long_read` | Read or size-estimate several entries in one call. |
| `tags_list` | List tags, or drill into subtags under a prefix. |
| `attributes` | List the attributes in use across entries. |
| `diagnostic` | Report entries with issues — broken links, missing summaries. |
| `create` | Create a new entry. |
| `edit` | Atomic body ops (replace/remove/insert/rewrite) and/or attribute updates. |
| `delete` | Delete an entry (incoming `[[wikilinks]]` go broken). |
| `rename` | Rename an entry; updates every `[[wikilink]]` across the vault. |
| `project_config` | List/create/update/remove projects; creating one adds its home entry. |

### Database (structured collections)

| Tool | What it does |
|---|---|
| `db_schema` | Read collection structures and field types. |
| `db_schema_edit` | One DDL op — create/alter/drop a collection or field. |
| `db_query` | Query rows with filters, sort, and pagination. |
| `db_get` | Read one row by id. |
| `db_create` | Insert a row. |
| `db_create_many` | Insert several rows, all-or-nothing. |
| `db_update` | Patch fields of a row by id. |
| `db_delete` | Delete a row by id. |
| `db_delete_many` | Delete several rows by id, all-or-nothing. |

## Data format

Obsidian-compatible markdown with YAML frontmatter and `[[wikilinks]]`:

```markdown
---
project: MyProject
tags:
  - work/task
status: active
due: 2026-05-01
summary: Implement the new auth flow
created: 2026-03-15
modified: 2026-04-01
---

Task details. Supports [[wikilinks]] to other entries.
```

Managed fields: `created` (set once), `modified` (every write), `tags` (hierarchical, prefix-matched), `summary` (auto), `project` (optional grouping). Custom fields (string/number/date/list) are defined in **Settings → Fields**. Vault settings and the vector cache live in `.brain-thing/` inside the vault, so they travel with a synced vault.

## Develop & run

```bash
npm i
npm run dev
npm test
npm run build:win   # or build:mac / build:linux
```

Brain Thing auto-registers its MCP server in Claude Desktop and Claude Code on startup — toggle in **Settings → General → MCP**, then restart Claude.