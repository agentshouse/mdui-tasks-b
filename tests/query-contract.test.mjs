import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { assertQueryPointers, projectQueryResult } from './query-contract.mjs'
const selected = ['/id', '/title', '/status', '/label', '/priority']
const valid = { types: ['task'], where: { $and: [{ '/status': { $in: ['todo', 'done'] } }, { $or: [{ '/priority': 'high' }, { '/priority': 'critical' }] }] }, select: { fields: selected, sections: ['Notes'] }, orderBy: [{ by: 'path' }] }
assert.doesNotThrow(() => assertQueryPointers(valid))
for (const query of [
  { select: { fields: ['title'] } },
  { select: { fields: ['/bad~escape'] } },
  { select: 'all', where: { title: 'Old shorthand' } },
  { select: 'all', where: { $or: [{ '/status': 'done' }, { status: 'todo' }] } },
  { select: 'all', orderBy: [{ by: { field: 'title' } }] },
  { groupBy: [{ field: 'status' }] },
  { select: 'all', hop: { field: 'assignee' } },
  { select: 'all', backlinks: { field: 'task' } },
  { select: 'all', hop: { field: '/assignee', where: { name: 'Old shorthand' } } },
  { select: 'all', backlinks: { where: { status: 'todo' } } },
]) assert.throws(() => assertQueryPointers(query), /expects a JSON Pointer/)
assert.throws(() => assertQueryPointers({ groupBy: ['path'] }), /Invalid metadata key/)
assert.doesNotThrow(() => assertQueryPointers({ select: { fields: 'all', sections: ['Notes'], change: true }, orderBy: [{ by: 'path' }] }))
assert.doesNotThrow(() => assertQueryPointers({ select: 'all', hop: { field: '/assignees/0', where: { '/name': 'A' } }, backlinks: { field: '/task', where: { '/status': 'todo' } } }))
assert.doesNotThrow(() => assertQueryPointers({ groupBy: [{ field: '/status' }], orderBy: [{ by: 'count' }] }))
const document = { room: 'tasks-room', path: 'tasks/example.md', type: 'task', fields: { id: 'TASK-TEST', title: 'Visible', status: 'todo', label: 'feature', priority: 'medium', unselected: 'hidden', shipping: { city: 'Paris', ignored: 'hidden' }, 'a/b': { '~key': 'escaped' } }, sections: { Notes: 'Original Notes', Other: 'Unselected section' }, markdown: 'Unselected Markdown' }
const projection = projectQueryResult(valid, { documents: [document] }).documents[0]
assert.deepEqual(projection.fields, { id: 'TASK-TEST', title: 'Visible', status: 'todo', label: 'feature', priority: 'medium' })
assert.equal(projection.fields['/title'], undefined)
assert.deepEqual(projection.sections, { Notes: 'Original Notes' })
assert.equal(projection.markdown, undefined)
assert.deepEqual(projectQueryResult({ select: { fields: ['/shipping/city', '/a~1b/~0key'] } }, { documents: [document] }).documents[0].fields, { shipping: { city: 'Paris' }, 'a/b': { '~key': 'escaped' } })
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const { tasksQuery, readTasks } = await server.ssrLoadModule('/src/lib/house.ts')
  assert.deepEqual(tasksQuery.select.fields, selected)
  assertQueryPointers(tasksQuery)
  const task = readTasks(projectQueryResult(tasksQuery, { documents: [document] }))[0]
  assert.equal(task.title, 'Visible'); assert.equal(task.id, 'TASK-TEST'); assert.equal(task.notes, 'Original Notes')
} finally { await server.close() }
console.log('PASS: current pointer-only query syntax in every query position; metadata/all/section sentinels preserved; original nested projection keys and real Tasks decoder verified; old shorthand rejected.')
