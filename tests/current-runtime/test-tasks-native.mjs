import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { factsFromSchemaFile, assertNativeQuery, nativeDocumentQuery, runtimeVersion, modelVersion } from './native-query-contract.mjs'

const app = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../..', import.meta.url)))
const requireApp = createRequire(path.join(app, 'package.json'))
const ts = requireApp('typescript')
const locator = 'tasks-pilot'
const facts = factsFromSchemaFile(path.join(app, 'schema.yaml'), locator)
const context = { room: locator, selected: locator, record: { room: locator } }
const extracted = []

function evaluate(expression, source) {
  const js = ts.transpileModule(`const result = (${expression.getText(source)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
  // JSON transfer restores this realm's Object prototype for strict planOf.
  return JSON.parse(JSON.stringify(vm.runInNewContext(`${js}\nresult`, { ...context }, { timeout: 1000 })))
}

for (const relative of ['src/lib/house.ts', 'src/features/workspace/context.tsx', 'src/features/users/components/users-dialogs.tsx']) {
  const text = fs.readFileSync(path.join(app, relative), 'utf8')
  const source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, relative.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'tasksQuery') {
      context.tasksQuery = evaluate(node.initializer, source)
      extracted.push({ name: `${relative}:tasksQuery`, query: context.tasksQuery })
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      const query = method === 'query' ? node.arguments[0] : method === 'observe' && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === 'query' ? node.arguments[1] : null
      if (query && ts.isObjectLiteralExpression(query)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
        extracted.push({ name: `${relative}:${line + 1}:${method}`, query: evaluate(query, source) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
assert.equal(extracted.length, 5, 'All four call sites plus the task query constant must be checked')
for (const { name, query } of extracted) {
  assertNativeQuery(query, facts)
  console.log(`PASS native production query: ${name}`)
}

const old = structuredClone(context.tasksQuery)
old.select.fields = old.select.fields.map(field => field.slice(1))
assert.throws(() => assertNativeQuery(old, facts), /invalid-query at select\.fields\[0\]: expects a JSON Pointer/)
console.log('PASS native negative control: original bare select fields rejected')

for (const query of [
  { ...context.tasksQuery, where: { title: 'example' } },
  { ...context.tasksQuery, orderBy: [{ by: { field: 'title' } }] },
  { types: ['task'], groupBy: [{ field: 'status' }] },
  { ...context.tasksQuery, select: { fields: ['/missing'] } },
  { ...context.tasksQuery, select: { fields: ['/title~2'] } },
]) assert.throws(() => assertNativeQuery(query, facts), /invalid-query|unknown-field/)
console.log('PASS native negatives: bare where/order/group, unknown field, invalid escape rejected')

const markdown = '---\ntype: task\nid: TASK-1001\ntitle: Native pointer regression\nstatus: todo\nlabel: bug\npriority: high\n---\n## Notes\nNative notes\n'
const documents = [{ room: locator, path: 'tasks/native-query-test.md', markdown }]
const result = await nativeDocumentQuery({ ...context.tasksQuery, rooms: [locator] }, facts, documents)
assert.equal(result.documents.length, 1)
assert.deepEqual(result.documents[0].fields, { id: 'TASK-1001', title: 'Native pointer regression', status: 'todo', label: 'bug', priority: 'high' })
assert.deepEqual(result.documents[0].sections, { Notes: 'Native notes\n' })
assert.equal(result.documents[0].path, documents[0].path)
assert.ok(!('/id' in result.documents[0].fields))
console.log('PASS native projection: pointer selects retain original keys, Notes remains a section name, path ordering accepted')

const workspaceQuery = extracted.find(one => one.name.startsWith('src/features/workspace/context')).query
const workspaceResult = await nativeDocumentQuery(workspaceQuery, facts, documents)
assert.equal(workspaceResult.documents[0].fields.type, 'task')
assert.equal(workspaceResult.documents[0].fields.title, 'Native pointer regression')
assert.equal(workspaceResult.documents[0].change, null)
console.log('PASS native all-fields projection: all sentinel, change and path metadata accepted')

const removeQuery = extracted.find(one => one.name.startsWith('src/lib/house.ts:') && one.name.endsWith(':query')).query
const removalResult = await nativeDocumentQuery(removeQuery, facts, documents)
assert.equal(removalResult.documents[0].markdown, markdown)
assert.deepEqual(removalResult.documents[0].fields, result.documents[0].fields)
console.log('PASS native task deletion projection: current markdown and ordinary frontmatter keys preserved')
console.log(JSON.stringify({ status: 'PASS', runtimeVersion, modelVersion, node: process.version, productionQueries: extracted.length, schemaTypes: facts.rooms[0].types.map(type => type.name), app, testScope: 'Local official SDK validator and read-side only; no live host or browser acceptance' }, null, 2))
