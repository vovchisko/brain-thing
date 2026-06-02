/**
 * Pure schema/data helpers — filter matching and display-label resolution.
 *
 * No I/O, no classes, no side effects. Safe to import from anywhere — brain,
 * renderer, tests. Re-used by both the dataset module (server side) and the
 * renderer screens.
 */

function buildPredicates (list) {
  return list.map(({ key, op, value }) => {
    switch (op) {
      case 'eq':
        return e => e[key] === value
      case 'in':
        return e => Array.isArray(value) && value.includes(e[key])
      case 'lt':
        return e => e[key] != null && e[key] < value
      case 'gt':
        return e => e[key] != null && e[key] > value
      case 'contains': {
        const v = String(value).toLowerCase()
        return e => e[key] != null && String(e[key]).toLowerCase().includes(v)
      }
      case 'starts': {
        const v = String(value).toLowerCase()
        return e => e[key] != null && String(e[key]).toLowerCase().startsWith(v)
      }
      case 'has':
        return e => Array.isArray(e[key]) && e[key].includes(value)
      case 'hasAny':
        return e => Array.isArray(e[key]) && Array.isArray(value) && value.some(v => e[key].includes(v))
      default:
        return () => false
    }
  })
}

function matchesFilters (entity, list) {
  if (!list || list.length === 0) return true
  const preds = buildPredicates(list)
  for (let i = 0; i < preds.length; i++) if (!preds[i](entity)) return false
  return true
}

function displayPropKey (schema) {
  if (!schema) return 'id'
  if (schema.displayProp) return schema.displayProp
  const stringProp = schema.props?.find(p => p.type === 'string')
  return stringProp?.key || 'id'
}

function displayLabel (entity, schema) {
  if (!entity) return ''
  const key = displayPropKey(schema)
  const value = entity[key]
  return value != null && value !== '' ? String(value) : entity.id
}

export const filters = Object.freeze({
  buildPredicates,
  matchesFilters,
  displayPropKey,
  displayLabel,
})
