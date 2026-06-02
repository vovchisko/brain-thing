import { ATTRIBUTE_TYPE } from '../../shared/attribute-types.js'

export class AttributeType {
  type = ATTRIBUTE_TYPE.STRING
  desc = null

  parse (raw) { return raw }

  serialize (typed) { return typed }

  match (entryValue, op, searchValue) {
    if (op && op !== '$eq') return false
    const a = String(entryValue).toLowerCase()
    const b = String(searchValue).toLowerCase()
    return a === b
  }

  describe (desc) {
    const copy = Object.create(Object.getPrototypeOf(this))
    Object.assign(copy, this)
    copy.desc = desc
    return copy
  }
}

class AttributeTypeDate extends AttributeType {
  type = ATTRIBUTE_TYPE.DATE

  parse (raw) {
    if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw
    const d = new Date(raw)
    return isNaN(d.getTime()) ? raw : d
  }

  match (entryValue, op, searchValue) {
    const a = this._toTime(entryValue)
    const b = this._toTime(searchValue)
    if (a === null || b === null) return false
    switch (op) {
      case '$gt':
        return a > b
      case '$gte':
        return a >= b
      case '$lt':
        return a < b
      case '$lte':
        return a <= b
      case '$eq':
      default:
        return a === b
    }
  }

  _toTime (v) {
    if (v instanceof Date) return v.getTime()
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.getTime()
  }
}

class AttributeTypeNumber extends AttributeType {
  type = ATTRIBUTE_TYPE.NUMBER

  parse (raw) {
    const n = Number(raw)
    return isNaN(n) ? raw : n
  }

  match (entryValue, op, searchValue) {
    const a = Number(entryValue)
    const b = Number(searchValue)
    if (isNaN(a) || isNaN(b)) return false
    switch (op) {
      case '$gt':
        return a > b
      case '$gte':
        return a >= b
      case '$lt':
        return a < b
      case '$lte':
        return a <= b
      case '$eq':
      default:
        return a === b
    }
  }
}

class AttributeTypeEnum extends AttributeType {
  type = ATTRIBUTE_TYPE.ENUM
  values

  constructor (values, desc) {
    super()
    this.values = values
    this.desc = desc
  }
}

class AttributeTypeList extends AttributeType {
  type = ATTRIBUTE_TYPE.LIST

  parse (raw) {
    if (Array.isArray(raw)) return raw
    return raw != null ? [ raw ] : []
  }

  match (entryValue, op, searchValue) {
    if (!Array.isArray(entryValue)) return false
    const search = Array.isArray(searchValue) ? searchValue : [ searchValue ]
    switch (op) {
      case '$all':
        return search.every(s => entryValue.includes(s))
      case '$any':
      default:
        return search.some(s => entryValue.includes(s))
    }
  }
}

export const ATTRIBUTE = Object.freeze({
  STRING: new AttributeType(),
  DATE: new AttributeTypeDate(),
  NUMBER: new AttributeTypeNumber(),
  LIST: new AttributeTypeList(),
  ENUM: (values, desc) => new AttributeTypeEnum(values, desc),
})
