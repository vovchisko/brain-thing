import { TYPES, FORMATS, FORMATS_BY_TYPE } from '@shared/dictionary.js'

// Field-definition vocabulary, shared by the schema detail table (read) and the
// field modal (edit). Pure — no store, no reactivity. The type→formats map is
// the shared one (single source of truth with the engine).

const TYPE_LIST = [ TYPES.STRING, TYPES.NUMBER, TYPES.BOOLEAN, TYPES.DATE, TYPES.ARRAY, TYPES.ENUM, TYPES.REFERENCE, TYPES.SUBSET ]

const DEFAULTS_BY_TYPE = {
  [TYPES.STRING]:    '',
  [TYPES.NUMBER]:    0,
  [TYPES.BOOLEAN]:   false,
  [TYPES.DATE]:      null,
  [TYPES.ARRAY]:     [],
  [TYPES.ENUM]:      '',
  [TYPES.REFERENCE]: null,
  [TYPES.SUBSET]:    [],
}

// Format-free types (array, reference, subset) return [] — the field editor hides the format select for them.
function formatsFor (type) { return FORMATS_BY_TYPE[type] || [] }

function needsRef (prop) { return prop.type === TYPES.REFERENCE || prop.type === TYPES.SUBSET }

function canEditDef (prop) {
  if (needsRef(prop)) return false
  if (prop.type === TYPES.DATE || prop.type === TYPES.ARRAY) return false
  return true
}

function optionsToText (opts) {
  return Array.isArray(opts) ? opts.map(o => (typeof o === 'string' ? o : o.value)).join(',') : ''
}

function optionsToArray (text) {
  return text.split(',').map(s => s.trim()).filter(Boolean)
}

function optionsList (prop) {
  const opts = prop.rules?.options
  return Array.isArray(opts) ? opts.map(o => (typeof o === 'string' ? o : o.value)) : []
}

function blankField () {
  return { key: '', type: TYPES.STRING, format: FORMATS.TEXT, def: '' }
}

// -- read-only display for the schema detail table ---------------------------

function describeRules (prop) {
  const parts = []
  if (needsRef(prop)) parts.push(prop.rules?.referenceTo ? `→ ${ prop.rules.referenceTo }` : '(no target)')
  else if (prop.type === TYPES.ENUM) parts.push(optionsList(prop).join(', ') || '(no options)')
  else if (prop.type === TYPES.DATE && prop.rules?.precision) parts.push(prop.rules.precision)
  if (prop.rules?.required) parts.push('required')
  return parts.join(' · ') || '—'
}

function describeDefault (prop) {
  const d = prop.def
  if (d === null || d === undefined || d === '') return '—'
  if (Array.isArray(d)) return d.length ? `[${ d.join(', ') }]` : '—'
  return String(d)
}

export const fielddef = {
  TYPE_LIST,
  FORMATS_BY_TYPE,
  DEFAULTS_BY_TYPE,
  formatsFor,
  needsRef,
  canEditDef,
  optionsToText,
  optionsToArray,
  optionsList,
  blankField,
  describeRules,
  describeDefault,
}
