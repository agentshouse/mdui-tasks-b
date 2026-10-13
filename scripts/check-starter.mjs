import { checkCurrentStarter } from './check-current-starter.mjs';
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
checkCurrentStarter(documents);
const records = Object.entries(documents).map(([file, content]) => {
  const parsed = parse(content, file)
  assert.equal(parsed.ok, true, JSON.stringify(parsed))
  return parsed.document
})
for (const record of records.filter(record => record.type === 'chat-message')) {
  assert(records.some(candidate => candidate.type === 'conversation' && candidate.fields.id === record.fields.conversation), 'Message references a missing conversation.')
}
console.log(`PASS: ${records.length} current Starter documents accepted by schema, with committed paths and conversation closure.`)
