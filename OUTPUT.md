# Output formats per tool

Definitive reference for what each MCP tool returns. Fixtures throughout: docs `Project Alpha` /
`Beta Notes`; dataset `people` / `tasks`. `get`/`long_read` share one per-mode renderer
(`tools/_helpers.js`); dataset rows/schemas render through `tools/_db_helpers.js`.

Delimiters scale with collision risk. A **doc body is freeform markdown**, so it carries strong
markers: `=== [[name]] ===` (identity), `---`-fenced frontmatter, `=== links ===` (trailing).
**Dataset output is structured** (`=== collection ===`, a one-line field sig, `ID …` rows, and — on
`db_query` — a stats line), so each shape is self-evident and needs only the `=== collection ===`
marker; the rest separates by blank lines. `---` and `=== label ===` are reserved — they never appear
in a body or a value (freeform text renders single-line).

---

## get

Identity lives on the `=== [[name]] ===` line — `name` is not an attribute and a synthetic `# Name`
heading would read as body, so neither appears. Frontmatter is `---`-fenced, then the body, then a
trailing `=== links ===` block (the `===` family avoids colliding with `---` thematic breaks in the
body). Computed fields (`wordCount`) and storage internals are hidden. Frontmatter keeps the
configured order — `frontmatterHead` (project/tags) → custom attrs → `frontmatterTail`
(created/modified/summary) — summary always last. The links block is omitted entirely when a doc has
no backlinks/missing/empty links.

```
=== [[Project Alpha]] ===
---
project: alpha
tags:
  - planning
  - active
created: 2026-01-10
modified: 2026-05-28
summary: Roadmap and goals for the Alpha launch.
---

Goals for Q2. See [[Beta Notes]] and [[Missing Doc]].

=== links ===
backlinks: [[Weekly Sync]], [[Beta Notes]]
missing:   [[Missing Doc]]
empty:     [[Stub Page]]
```

### get — focus

`===` line + body only — no frontmatter, no links.

```
=== [[Project Alpha]] ===

Goals for Q2. See [[Beta Notes]] and [[Missing Doc]].
```

### get — estimate

`===` line + frontmatter + word count, no body — enough to decide whether to read it in full.

```
=== [[Project Alpha]] ===
---
project: alpha
tags:
  - planning
  - active
created: 2026-01-10
modified: 2026-05-28
summary: Roadmap and goals for the Alpha launch.
---
142 words
```

### get — not found

```
Entry "Projct Alpha" not found.

Similar entries:
- [[Project Alpha]] (planning - 91%)
- [[Beta Notes]] (active - 63%)

Use exact name from suggestions.
```

---

## long_read — read

`get` repeated, one block per doc, no top header. Two `===` markers structure it: `=== [[name]] ===`
starts each doc (the separator) and `=== links ===` opens its links — they alternate and neither
occurs in a body, so docs never bleed together. Any unresolved names trail as a single
`Not found (N): …` line.

```
=== [[Project Alpha]] ===
---
project: alpha
tags:
  - planning
  - active
created: 2026-01-10
modified: 2026-05-28
summary: Roadmap and goals for the Alpha launch.
---

Goals for Q2. See [[Beta Notes]] and [[Missing Doc]].

=== links ===
backlinks: [[Weekly Sync]], [[Beta Notes]]
missing:   [[Missing Doc]]
empty:     [[Stub Page]]

=== [[Beta Notes]] ===
---
project: alpha
tags:
  - active
created: 2026-02-03
modified: 2026-05-20
summary: Beta feedback log.
---

Notes from the beta cohort.

=== links ===
backlinks: [[Project Alpha]]
```

### long_read — estimate

`get` estimate repeated, with a plain total line on top.

```
352 words across 2 docs

=== [[Project Alpha]] ===
---
project: alpha
tags:
  - planning
  - active
created: 2026-01-10
modified: 2026-05-28
summary: Roadmap and goals for the Alpha launch.
---
142 words

=== [[Beta Notes]] ===
---
project: alpha
tags:
  - active
created: 2026-02-03
modified: 2026-05-20
summary: Beta feedback log.
---
210 words
```

### long_read — focus

`get` focus repeated.

```
=== [[Project Alpha]] ===

Goals for Q2. See [[Beta Notes]] and [[Missing Doc]].

=== [[Beta Notes]] ===

Notes from the beta cohort.
```

---

## search

Attribute-filter results. Each hit shows `project · tags`, the summary (or a 200-char content preview
when there's no summary), and word count.

```
Found 2 entries:

- [[Project Alpha]]
  project: alpha · tags: planning, active
  Roadmap and goals for the Alpha launch.
  words: 142

- [[Beta Notes]]
  project: alpha · tags: active
  Beta feedback log.
  words: 210

Use `get` to read full content.
```

---

## what_is

Semantic search. Same hit shape as `search`, plus a relevance score per hit; results are the top
matches by meaning.

```
Top 2 for "alpha launch":

- [[Project Alpha]] (92%)
  project: alpha · tags: planning, active
  Roadmap and goals for the Alpha launch.
  words: 142

- [[Beta Notes]] (74%)
  tags: active
  Beta feedback log.
  words: 210

Use `get` with an entry name to read full content.
```

---

## look_around

```
# brain-thing

<guideline document content, verbatim>

Total: 47 entries

## alpha (12 entries)
Roadmap and goals for the Alpha launch.
Details: [[alpha]]

## beta (8 entries)
Details: [[beta]]

(no project): 5 entries

## Tags
- active - 20
- planning - 7
- meeting - 3

## Configured attributes
status (string), priority (number), due (date)
```

---

## db_query

`=== collection ===`, the one-line field sig (enum bare), the rows, then a stats line.

```
=== tasks ===
title:string, status:enum, assignee:reference(people), watchers:subset(people[]), due:date

TASK-1  title="Ship v2"  status="done"  assignee=PER-1  watchers=[PER-2, PER-3]  due=2026-06-01
TASK-2  title="Write docs"  status="todo"  assignee=null  watchers=[]  due=null
TASK-3  title="Review"  status="doing"  assignee=PER-2  watchers=[PER-1]  due=2026-06-10

15 rows · showing 3 · 12 more (use offset/limit to page)
```

## db_get

Single row — same header + sig, no stats line.

```
=== tasks ===
title:string, status:enum, assignee:reference(people), watchers:subset(people[]), due:date

TASK-1  title="Ship v2"  status="done"  assignee=PER-1  watchers=[PER-2, PER-3]  due=2026-06-01
```

## db_schema

```
=== people — team members ===
ids: PER-<n>
display: name
- name: string
- role: enum(lead, eng, design)

=== tasks ===
ids: TASK-<n>
- title: string
- status: enum(todo, doing, done)
- assignee: reference(people)
- watchers: subset(people[])
- due: date
```

## db_schema(name) / db_schema_edit

A single collection, with any `Note:` lines from the edit appended.

```
=== tasks ===
ids: TASK-<n>
- title: string
- status: enum(todo, doing, done)
- assignee: reference(people)
- watchers: subset(people[])
- due: date
Note: field "due": format "select" is not valid for type "date" — set to "datepicker".
```

---

## Value & signature rules

**Field signature** (`fieldSig`, shared by schema lines and the row sig): `reference(coll)`,
`subset(coll[])`, `enum(a, b, c)` in `db_schema` but bare `enum` in the row sig (options live in the
schema), bare `string`/`number`/`boolean`/`date`/`array`. Decorative `format` never reaches the MCP
surface.

**Row values** are JSON-native and faithful to the *stored* type, so the model copies them straight
back into a write:

- strings quoted — `title="Ship v2"`;
- an enum follows its stored type — a string option is quoted (`status="done"`), a numeric option is
  bare;
- numbers, booleans, dates and ids stay bare — `priority=9`, `active=true`, `due=2026-06-01`,
  `assignee=PER-1`;
- array items keep their own types — `labels=["x", "y"]`;
- absent value → `null`; empty list → `[]`.

No `#` on ids and no `—` glyph anywhere in MCP output — the model would copy both into its writes.
Ids carry no human label (labels confuse models; the field→collection map lives in the sig). The `#`,
the `—`, and labels all stay in the UI.

**Delimiters**: docs (freeform body) use `=== [[name]] ===` + `---`-fenced frontmatter +
`=== links ===`; datasets (structured) use only `=== collection ===` and let the field sig, rows and
stats line self-separate by blank lines. `---` and `=== label ===` never appear inside a body or a
value.