import assert from 'node:assert/strict'

/** Strict Local Query field contract from Master 1742 / Runtime 8c14b5eb8.
 * Field selectors are JSON Pointers. Query metadata and section headings are not.
 * Verified against official SDK 0.1.0-c2647c1a232dd AGENTS.md and query.js.
 * This intentionally rejects the old permissive test-host shorthand.
 * Schema/type semantics are tested separately against the actual current SDK. */
export function assertPointer(pointer, at) {
  assert.equal(typeof pointer, 'string', `invalid-query at ${at}: expects a JSON Pointer`)
  assert(pointer.startsWith('/') && !/~(?:[^01]|$)/.test(pointer), `invalid-query at ${at}: expects a JSON Pointer`)
}
export function assertQueryPointers(query) {
  const where = (value, at) => {
    for (const [name, operand] of Object.entries(value ?? {})) {
      if (name === '$and' || name === '$or') { assert(Array.isArray(operand)); operand.forEach((item, index) => where(item, `${at}.${name}[${index}]`)) }
      else assertPointer(name, `${at}.${name}`)
    }
  }
  const key = (value, at, metadata) => {
    if (typeof value === 'string') assert(metadata.includes(value), `Invalid metadata key at ${at}`)
    else assertPointer(value?.field, `${at}.field`)
  }
  where(query.where, 'where')
  if (query.select !== 'all' && query.select?.fields !== undefined && query.select.fields !== 'all') query.select.fields.forEach((field, index) => assertPointer(field, `select.fields[${index}]`))
  query.orderBy?.forEach((entry, index) => key(entry.by, `orderBy[${index}].by`, query.groupBy ? ['room', 'type', 'count'] : ['room', 'path', 'type']))
  query.groupBy?.forEach((entry, index) => key(entry, `groupBy[${index}]`, ['room', 'type']))
  for (const direction of ['hop', 'backlinks']) if (query[direction]) {
    if (query[direction].field !== undefined) assertPointer(query[direction].field, `${direction}.field`)
    where(query[direction].where, `${direction}.where`)
  }
}
export function pointerValue(fields, pointer) {
  return pointer.slice(1).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~')).reduce((value, part) => value?.[part], fields)
}
/** Project with original frontmatter keys, as current Runtime documents.
 * Crucially, /title becomes fields.title, never fields['/title']. */
export function projectQueryResult(query, result) {
  assertQueryPointers(query)
  if (query.select === 'all') return result
  const select = query.select ?? {}
  const choose = (fields, pointers) => {
    if (pointers === 'all') return fields
    const mask = { whole: false, children: new Map() }
    for (const pointer of pointers ?? []) {
      let node = mask
      for (const segment of pointer.slice(1).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
        if (!node.children.has(segment)) node.children.set(segment, { whole: false, children: new Map() })
        node = node.children.get(segment)
      }
      node.whole = true
    }
    const pick = (value, node) => {
      if (node.whole) return value
      if (value === null || typeof value !== 'object') return undefined
      const next = Array.isArray(value) ? [] : {}
      for (const [key, item] of Object.entries(value)) {
        const child = node.children.get(key)
        if (!child) continue
        const chosen = pick(item, child)
        if (chosen !== undefined) Object.defineProperty(next, key, { value: chosen, enumerable: true, configurable: true, writable: true })
      }
      return next
    }
    return pick(fields ?? {}, mask) ?? {}
  }
  return { documents: result.documents.map(document => ({
    room: document.room, path: document.path, ...(document.type ? { type: document.type } : {}),
    ...(select.fields !== undefined ? { fields: choose(document.fields, select.fields) } : {}),
    ...(select.sections !== undefined ? { sections: select.sections === 'all' ? document.sections : Object.fromEntries(select.sections.filter(name => Object.hasOwn(document.sections ?? {}, name)).map(name => [name, document.sections[name]])) } : {}),
    ...(select.markdown ? { markdown: document.markdown } : {}),
    ...(select.preamble ? { preamble: document.preamble } : {}),
    ...(select.change ? { change: document.change } : {}),
  })) }
}
export function strictQueryObservation(query, observation) {
  assertQueryPointers(query)
  return { current: () => projectQueryResult(query, observation.current()), subscribe: listener => observation.subscribe(value => listener(projectQueryResult(query, value))), close: () => observation.close() }
}
