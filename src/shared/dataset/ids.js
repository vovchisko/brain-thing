/**
 * Id encoding (Storage B). Every collection has a mandatory, explicit prefix;
 * the stored id IS the decorated token — `${prefix}-${counter}` — used verbatim
 * in the DB, tool I/O, UI and doc mentions. No bare ids exist.
 *
 * The "-" separator is constant and automatic (the prefix never carries it).
 * The counter is the trailing run of digits, so decode is unambiguous even when
 * the prefix itself contains digits or dashes — `/^(.+)-(\d+)$/` is greedy on
 * the prefix and anchors on the last "-<digits>".
 *
 * The bare counter stays the monotonic uniqueness backbone (in <name>.stats.json);
 * the prefix only decorates it. Changing a prefix preserves the counter, so the
 * old→new id mapping is bijective (see Schemas.setIdgen cascade).
 */

const SEP = '-'

// Prefix: no whitespace; first char is not a digit (digits allowed after).
const PREFIX_RE = /^[^\s\d]\S*$/
const ID_RE = /^(.+)-(\d+)$/

function isValidPrefix (prefix) {
  return typeof prefix === 'string' && PREFIX_RE.test(prefix)
}

function encode (prefix, counter) {
  return `${ prefix }${ SEP }${ counter }`
}

/** Split a stored id into { prefix, counter } — null if it isn't a prefixed id. */
function decode (id) {
  const m = typeof id === 'string' ? id.match(ID_RE) : null
  return m ? { prefix: m[1], counter: Number(m[2]) } : null
}

export const ids = { SEP, PREFIX_RE, isValidPrefix, encode, decode }
