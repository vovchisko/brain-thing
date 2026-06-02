/**
 * Date parsing/formatting — pure, shared by brain (coerce + tool output) and the
 * renderer. One rule: STORE in UTC (ISO string), do I/O in LOCAL.
 *
 * Parsing leans on the platform `new Date()` — input is low-volume and the model
 * sends ordinary date strings. The ONE thing `new Date` gets inconsistent is a
 * bare `YYYY-MM-DD`, which the spec parses as UTC while it parses zoneless
 * datetimes and human strings as local. So we force date-only to local midnight;
 * everything else goes straight through. Explicit-zone input is honored; a number
 * is epoch ms; `now`/`now()`/`today` resolve at parse time. Anything `new Date`
 * can't read throws a clear error.
 *
 * Output renders the stored UTC instant back in LOCAL time at the prop's
 * precision (`day` → `YYYY-MM-DD`, `minute` → `… HH:MM`, `second` → `… HH:MM:SS`).
 *
 * Single-user desktop app → the machine's local zone IS the user's zone, which is
 * why zoneless input is read as local: a bare timestamp means the user's wall clock.
 *
 * Stored as an ISO string (not a Date): that value is also the IPC payload to the
 * Vue UI, where JSON-native strings are simplest; formatting reconstructs a Date
 * on demand, so Date-in-memory would buy nothing.
 */
import { ERR, ErrorGeneric } from './dictionary.js'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const PRECISIONS = [ 'day', 'minute', 'second' ]
// Precision is DISPLAY-ONLY: it controls how `format` renders, never what `parse`
// stores. Storage is always the full instant. Default `day` — calendar dates are
// the common case in a KB; timestamp fields opt into `minute`/`second`.
const DEFAULT_PRECISION = 'day'

const pad = (n) => String(n).padStart(2, '0')
const localMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

function bad (value) {
  return new ErrorGeneric(ERR.BAD_REQUEST,
      `Cannot read ${ JSON.stringify(value) } as a date. Use YYYY-MM-DD, YYYY-MM-DD HH:MM[:SS], ` +
      `an ISO timestamp with zone, epoch ms, or "now"/"today".`)
}

/** Parse any accepted input to a UTC ISO string (or throw). Stores the full instant; precision is display-only. */
function parse (value) {
  if (value === null || value === undefined) return null

  let date
  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'number') {
    date = new Date(value)
  } else if (typeof value === 'string') {
    const s = value.trim()
    const low = s.toLowerCase()
    if (low === 'now' || low === 'now()') date = new Date()
    else if (low === 'today') date = localMidnight(new Date())
    else if (DATE_ONLY.test(s)) date = new Date(`${ s }T00:00`) // force local midnight, not UTC
    else date = new Date(s)                                     // zoneless → local; explicit zone honored
  } else {
    throw bad(value)
  }

  if (Number.isNaN(date.getTime())) throw bad(value)
  return date.toISOString()
}

/** Render a stored UTC ISO string back to a LOCAL string at the given precision. */
function format (isoUtc, precision = DEFAULT_PRECISION) {
  if (isoUtc === null || isoUtc === undefined) return null
  const d = new Date(isoUtc)
  if (Number.isNaN(d.getTime())) return String(isoUtc)
  const day = `${ d.getFullYear() }-${ pad(d.getMonth() + 1) }-${ pad(d.getDate()) }`
  if (precision === 'day') return day
  const hm = `${ pad(d.getHours()) }:${ pad(d.getMinutes()) }`
  if (precision === 'second') return `${ day } ${ hm }:${ pad(d.getSeconds()) }`
  return `${ day } ${ hm }`
}

export const dates = Object.freeze({ parse, format, PRECISIONS, DEFAULT_PRECISION })
