import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { verify, validate, parse } from '@agentshouse/mdmodel'

const schema = fs.readFileSync('schema.yaml', 'utf8')
const model = verify(schema)
assert.equal(model.verdict, 'accept', JSON.stringify(model))
const documents = {}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), 'Starter must contain regular documents only.')
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else {
      assert(entry.isFile() && file.endsWith('.md'), 'Starter contains a non-document.')
      documents[path.relative('starter', file)] = fs.readFileSync(file, 'utf8')
    }
  }
}
walk('starter')
assert(Object.keys(documents).length >= 3, 'Starter documents missing.')
const result = validate({ 'settings/schema.yaml': schema, ...documents }, { binaryTargets: [] }, model.model)
assert.equal(result.verdict, 'accept', JSON.stringify(result))
const tasks = JSON.parse(fs.readFileSync('tests/support/fixtures/donor-tasks.json', 'utf8'))
const batches = fs.readdirSync('tests/support/whole-demo').filter(name => /^batch-\d+\.json$/.test(name)).flatMap(name => JSON.parse(fs.readFileSync(path.join('tests/support/whole-demo', name))).changes)
const existing = new Map(batches.map(change => [change.path.replace('/rooms/tasks-pilot/', ''), change.content]))
const records = Object.entries(documents).map(([file, content]) => {
  const parsed = parse(content, file)
  assert.equal(parsed.ok, true, JSON.stringify(parsed))
  if (parsed.document.type === 'task') {
    const index = Number(file.match(/^tasks\/demo-(\d+)-task-\d+\.md$/)?.[1]) - 1
    assert(index >= 0, 'Task starter must retain an existing demo path.')
    assert.deepEqual(JSON.parse(JSON.stringify(parsed.document.fields)), { type: 'task', ...tasks[index] })
    assert(file.endsWith(tasks[index].id.toLowerCase() + '.md'), 'Task starter path changed.')
  } else assert.equal(content, existing.get(file), 'Starter must preserve the existing demo document verbatim.')
  return parsed.document
})
for (const record of records.filter(record => record.type === 'chat-message')) {
  assert(records.some(candidate => candidate.type === 'conversation' && candidate.fields.id === record.fields.conversation), 'Message references a missing conversation.')
}
console.log(`PASS: ${records.length} existing starter documents accepted by schema, with original paths and conversation closure.`)
