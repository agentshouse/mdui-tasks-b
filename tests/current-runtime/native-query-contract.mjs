import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = process.env.MD_QUERY_CONTRACT_ROOT ?? fileURLToPath(new URL('.', import.meta.url))
const load = (packageName, file) => import(pathToFileURL(path.join(root, 'node_modules', '@agentshouse', packageName, 'dist', file)))
const { verify, parse } = await load('mdmodel', 'index.js')
const { planOf } = await load('mdruntime', 'query.js')
const { createReadSide } = await load('mdruntime', 'read-side.js')
const { rowsOf } = await load('mdruntime', 'rows.js')

export { planOf }
export const runtimeVersion = '0.1.0-c8ca66ac9e99d'
export const modelVersion = '0.1.0-c6e675bb19980'
for (const [name, expected] of [['mdruntime', runtimeVersion], ['mdmodel', modelVersion]]) {
  const metadata = JSON.parse(readFileSync(path.join(root, 'node_modules', '@agentshouse', name, 'package.json'), 'utf8'))
  assert.equal(metadata.version, expected, `This regression requires pinned official ${name} ${expected}`)
}

export function factsFromSchema(schema, locator = 'r_pointer_contract') {
  const verified = verify(schema)
  assert.equal(verified.verdict, 'accept', JSON.stringify(verified))
  return {
    listed: true,
    rooms: [{ locator, available: true, types: Object.values(verified.model.types) }],
  }
}

export function factsFromSchemaFile(filename, locator) {
  return factsFromSchema(readFileSync(filename, 'utf8'), locator)
}

/** Native validator, with fully available model facts (no untyped fallback). */
export function assertNativeQuery(query, facts) {
  return planOf(query, facts)
}

/** Evaluate official Runtime query/read-side against in-memory Markdown only. */
export async function nativeDocumentQuery(query, facts, markdownDocuments) {
  const reader = createReadSide()
  const changes = markdownDocuments.map(({ room, path, markdown }) => {
    const parsed = parse(markdown, path)
    assert.equal(parsed.ok, true, JSON.stringify(parsed))
    const types = facts.rooms.find(candidate => candidate.locator === room)?.types
    assert.ok(types, `No facts for ${room}`)
    const model = { status: 'available', types: Object.fromEntries(types.map(type => [type.name, type])) }
    return { locator: room, path, before: [], after: rowsOf(room, path, parsed.document, { model, selection: null }, null) }
  })
  try {
    reader.apply({ documents: changes, drafts: [], rooms: [], queues: [], presentations: [], messages: [], conversations: [] })
    return await reader.query(planOf(query, facts))
  } finally {
    reader.close()
  }
}
