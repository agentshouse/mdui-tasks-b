import { assertQueryPointers, strictQueryObservation } from './query-contract.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { Window } from 'happy-dom'
import { createHouseBridgeTestHost } from '@agentshouse/app-bridge/test-host'
import { createServer } from 'vite'

// Exercise the actual mounted Circle UI against the same native bridge surface
// as the existing donor UI tests. No mocked React hooks or alternate draft store.
const window = new Window({ url: 'http://localhost/#tasks' })
for (const name of ['window', 'document', 'navigator', 'location', 'history', 'HTMLElement', 'Element', 'Node', 'NodeFilter', 'Text', 'Event', 'CustomEvent', 'FocusEvent', 'MouseEvent', 'KeyboardEvent', 'InputEvent', 'MutationObserver', 'ResizeObserver', 'FileList', 'File', 'DocumentFragment', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLButtonElement', 'HTMLFormElement', 'HTMLSelectElement', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  const value = name === 'window' ? window : window[name]
  if (value !== undefined) Object.defineProperty(globalThis, name, { configurable: true, value: typeof value === 'function' && /^[a-z]/.test(name) ? value.bind(window) : value })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const signal = initial => {
  let value = initial
  const listeners = new Set()
  return { current: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }, close() {}, emit(next) { value = next; listeners.forEach(fn => fn(next)) } }
}
const room = 'circle-tasks-room'
const fixture = JSON.parse(fs.readFileSync('fixtures/donor-tasks.json', 'utf8'))
const tasks = fixture.map((fields, index) => ({ room, path: `tasks/donor-${String(index).padStart(3, '0')}.md`, type: 'task', fields: { ...fields }, sections: { Notes: `Original Notes for ${fields.id} at ${index}.` } }))
const duplicateTasks = tasks.filter(task => task.fields.id === 'TASK-1373')
assert.equal(duplicateTasks.length, 2)
duplicateTasks[1].path = 'tasks/duplicate #1373 résumé.md'
const missingNotesTask = tasks.at(-1)
missingNotesTask.sections = {}
const workspace = JSON.parse(fs.readFileSync('fixtures/donor-workspace.json', 'utf8')).map(record => ({ ...record, room }))
const drafts = new Map(), saves = [], writes = [], queries = []
let revision = 0, staleCount = 0
let writeBarrier = null, readBarrier = null, rejectWrite = null, rejectRead = null, injectStale = null, saveFailure = null
const key = (targetRoom, path) => JSON.stringify([targetRoom, path])
const draftAt = path => drafts.get(key(room, path))
const signals = {
  rooms: signal([{ locator: room }]),
  'sync-status': signal({ lastCompleted: 'complete', attentionRequired: [] }),
  'room-drafts': signal([]), 'service-mode': signal('open'), 'connection-refusal': signal(null),
  tasks: signal({ documents: tasks }), query: signal({ documents: [...workspace, ...tasks] }), presentation: signal({}),
}
const emitDrafts = () => signals['room-drafts'].emit([...drafts.values()].map(value => structuredClone(value)))
const emitRecords = () => { signals.tasks.emit({ documents: [...tasks] }); signals.query.emit({ documents: [...workspace, ...tasks] }) }
function putDraft(path, patch, emit = true) {
  const previous = draftAt(path)
  const parts = { ...previous?.parts, ...structuredClone(patch) }
  for (const group of ['fields', 'sections']) if (previous?.parts[group] || patch[group]) parts[group] = { ...previous?.parts[group], ...structuredClone(patch[group]) }
  const next = { room, path, revision: `draft-${++revision}`, parts, returned: null, changedUnderneath: {} }
  for (const group of ['fields', 'sections']) for (const name of Object.keys(next.parts[group] ?? {})) if (previous?.parts[group]?.[name]) next.parts[group][name].base = previous.parts[group][name].base
  drafts.set(key(room, path), next)
  if (emit) emitDrafts()
  return next
}
const runtime = {
  observe: async (kind, query) => { if (kind === 'query') { assertQueryPointers(query); queries.push(structuredClone(query)); return strictQueryObservation(query, query.types ? signals.tasks : signals.query) } return signals[kind] },
  presentation: { read: async () => ({}), write: async value => signals.presentation.emit(value) },
  roomDraft: {
    read: async (targetRoom, path) => {
      if (readBarrier?.path === path) await readBarrier.promise
      if (rejectRead === path) throw new Error('Injected draft read failure')
      return structuredClone(drafts.get(key(targetRoom, path)) ?? null)
    },
    write: async (targetRoom, path, seen, parts) => {
      writes.push({ room: targetRoom, path, seen, parts: structuredClone(parts) })
      if (rejectWrite?.path === path && rejectWrite.test(parts)) { rejectWrite = null; throw new Error('Injected draft write failure') }
      if (injectStale?.path === path) { const patch = injectStale.parts; injectStale = null; putDraft(path, patch, false) }
      const previous = drafts.get(key(targetRoom, path))
      if ((previous?.revision ?? null) !== seen) { staleCount++; return { outcome: 'stale', current: structuredClone(previous) } }
      const next = { room: targetRoom, path, revision: `draft-${++revision}`, parts: structuredClone(parts), returned: null, changedUnderneath: {} }
      for (const group of ['fields', 'sections']) for (const name of Object.keys(next.parts[group] ?? {})) if (previous?.parts[group]?.[name]) next.parts[group][name].base = previous.parts[group][name].base
      drafts.set(key(targetRoom, path), next); emitDrafts()
      if (writeBarrier?.path === path) await writeBarrier.promise
      return { outcome: 'written', roomDraft: structuredClone(next) }
    },
  },
  save: async (targetRoom, items) => {
    if (saveFailure) return { outcome: 'refused', rule: saveFailure }
    saves.push({ room: targetRoom, items: structuredClone(items) })
    for (const item of items) {
      const draft = drafts.get(key(targetRoom, item.path))
      assert.equal(draft?.revision, item.revision, 'Save names the current native RoomDraft revision')
      if (draft.parts.creation) tasks.push({ room: targetRoom, path: item.path, type: draft.parts.creation.type, fields: structuredClone(draft.parts.creation.fields), sections: structuredClone(draft.parts.creation.sections) })
      else {
        const record = tasks.find(task => task.room === targetRoom && task.path === item.path)
        assert(record, 'Save must target the selected business document')
        for (const [name, part] of Object.entries(draft.parts.fields ?? {})) record.fields[name] = part.value
        for (const [name, part] of Object.entries(draft.parts.sections ?? {})) record.sections[name] = part.value
      }
      drafts.delete(key(targetRoom, item.path))
    }
    emitRecords(); emitDrafts()
    return { outcome: 'saved', identifier: 'local-queue' }
  },
}
const host = createHouseBridgeTestHost({ address: '/app/a_e.n' })
host.attachRuntime(runtime)
globalThis.houseBridge = window.houseBridge = host.port
globalThis.houseRuntime = window.houseRuntime = host.runtime
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
let root, container
const trace = label => { if (process.env.CIRCLE_DEBUG) console.log(label, `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MiB`) }
const flush = async () => { await act(async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)) }) }
const within = () => document.querySelector('[data-module="tasks"]')
const required = (selector, scope = document) => { const element = scope.querySelector(selector); assert(element, `Expected mounted element: ${selector}`); return element }
const click = async element => { assert(element, 'Expected clickable element'); await act(async () => element.click()); await flush() }
const byText = (text, selector = 'button', scope = within()) => [...scope.querySelectorAll(selector)].find(element => element.textContent.trim() === text)
const input = async (element, value) => {
  assert(element, 'Expected input element')
  await act(async () => {
    const prototype = element instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
    element.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await flush()
}
const navigate = async hash => { trace(`navigate ${hash}`); await act(async () => { history.pushState(null, '', hash); window.dispatchEvent(new window.Event('hashchange')) }); await flush() }
const openTask = async task => navigate(`#tasks/issue/${encodeURIComponent(task.path)}`)
const select = async (element, value) => { await act(async () => { element.value = value; element.dispatchEvent(new window.Event('change', { bubbles: true })) }); await flush() }
const keypress = async (key, options = {}, element = window) => { trace(`key ${JSON.stringify(options)} ${key}`); await act(async () => element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }))); await flush() }
const commandInput = () => required('input[aria-label="Command menu search"]')
const commandItem = text => byText(text, '[cmdk-item]', document)

const title = () => required('textarea[name="title"]', within())
const notes = () => required('textarea[name="notes"]', within())
const save = () => click(byText('Save changes'))
const barrier = path => { let release; const promise = new Promise(resolve => { release = resolve }); return { path, promise, release } }

try {
  const { App } = await server.ssrLoadModule('/src/App.tsx')
  const { ThemeProvider } = await server.ssrLoadModule('/src/context/theme-provider.tsx')
  const { DirectionProvider } = await server.ssrLoadModule('/src/context/direction-provider.tsx')
  const unmount = async () => { if (root) await act(async () => root.unmount()); root = null; container?.remove() }
  const mount = async () => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root.render(h(ThemeProvider, null, h(DirectionProvider, null, h(App)))))
    await flush()
  }
  await mount()
  trace('mounted')

  // Assertions are deliberately against user-facing controls and bridge calls.
  // The Circle implementation is loaded by App, not a test-only screen.
  assert.equal(document.querySelectorAll('[data-module]').length, 6)
  assert.equal(within().hidden, false)
  assert.equal(required('input[placeholder="Search title or ID..."]', within()).value, '')

  const allRows = () => [...within().querySelectorAll('[data-task-path]')]
  assert.equal(allRows().length, 100, 'Default Circle list shows every donor issue without pagination')
  for (const [status, count] of Object.entries({ 'In Progress': 24, Todo: 16, Backlog: 18, Done: 18, Canceled: 24 })) {
    const group = required(`section[aria-label="${status} issues"]`, within())
    assert.equal(group.querySelectorAll('[data-task-path]').length, count)
    assert.match(group.querySelector('button[aria-expanded]').textContent, new RegExp(`${count}$`), 'Group heading counts match mounted issues')
  }
  const localQueries = queries.length
  await click(byText('Active'))
  assert.equal(allRows().length, 40, 'Active includes Todo and In Progress')
  await click(byText('Backlog'))
  assert.equal(allRows().length, 18)
  await click(byText('All issues'))
  assert.equal(allRows().length, 100)
  await select(required('select[aria-label="Filter priority"]', within()), 'high')
  assert.equal(allRows().length, fixture.filter(task => task.priority === 'high').length)
  await select(required('select[aria-label="Filter label"]', within()), 'bug')
  assert.equal(allRows().length, fixture.filter(task => task.priority === 'high' && task.label === 'bug').length)
  await click(byText('Clear filters'))
  assert.equal(allRows().length, 100)
  const collapsible = required('[data-task-group="todo"] button[aria-expanded]', within())
  await click(collapsible)
  assert.equal(allRows().length, 84, 'Group collapse changes only the local visible rows')
  await click(collapsible)
  assert.equal(allRows().length, 100)

  const search = () => required('input[placeholder="Search title or ID..."]', within())
  await input(search(), 'TASK-1373')
  assert.equal(allRows().length, 2, 'Duplicate display IDs remain separate Room documents')
  for (const duplicate of duplicateTasks) {
    const row = allRows().find(element => element.dataset.taskPath === duplicate.path)
    assert(row, `Both duplicate paths remain available: ${duplicate.path}`)
    await click(required('a', row))
    assert.equal(location.hash, `#tasks/issue/${encodeURIComponent(duplicate.path)}`)
    assert.equal(title().value, duplicate.fields.title, 'Detail selection resolves path identity, not donor display ID')
    assert.equal(notes().value, duplicate.sections.Notes)
    await navigate('#tasks')
  }
  await input(search(), '')
  assert.equal(allRows().length, 100)
  assert.equal(queries.length, localQueries, 'Search and encoded issue navigation use already-observed Room data')

  const editableTask = tasks.find(task => task.fields.status === 'todo')
  const initialTitle = editableTask.fields.title, initialNotes = editableTask.sections.Notes
  const inlineRow = allRows().find(element => element.dataset.taskPath === editableTask.path)
  await click(required('[aria-label="Set status: Todo"]', inlineRow))
  await click(required('[cmdk-item][data-value="done"]'))
  assert.deepEqual(draftAt(editableTask.path).parts.fields.status, { value: 'done', base: { value: 'todo' } })
  assert.equal(saves.length, 0, 'Inline property selection stages without saving')
  await openTask(editableTask)
  assert(required('[aria-label="Set status: Done"]', within()), 'Detail opens the inline native draft')
  await keypress('k', { ctrlKey: true })
  assert(commandInput(), 'Ctrl K opens the contextual command menu')
  await click(commandItem('Change status…'))
  await input(commandInput(), 'Backlog')
  await keypress('ArrowDown', {}, commandInput())
  await keypress('Enter', {}, commandInput())
  assert.equal(draftAt(editableTask.path).parts.fields.status.value, 'backlog', 'Keyboard command selection stages status')
  assert.equal(document.querySelector('input[aria-label="Command menu search"]'), null)
  await keypress('k', { metaKey: true })
  await click(commandItem('Set priority…'))
  await click(commandItem('High'))
  assert.equal(draftAt(editableTask.path).parts.fields.priority.value, 'high')
  await keypress('k', { ctrlKey: true })
  await click(commandItem('Change label…'))
  await click(commandItem('Documentation'))
  assert.equal(draftAt(editableTask.path).parts.fields.label.value, 'documentation')
  assert.equal(saves.length, 0, 'Status, priority, and label command edits all remain local drafts')
  await keypress('k', { ctrlKey: true })
  await click(commandItem('Change status…'))
  await input(commandInput(), 'Backlog')
  await keypress('k', { ctrlKey: true })
  assert.equal(document.querySelector('input[aria-label="Command menu search"]'), null, 'Ctrl K closes an open nested command menu')
  await keypress('k', { ctrlKey: true })
  assert.equal(commandInput().value, '', 'Reopening the command menu clears the previous nested query')
  assert(commandItem('Change status…'), 'Ctrl K close/reopen resets the nested route to the contextual root')
  await navigate('#users')
  assert.equal(document.querySelector('[data-module="users"]').hidden, false)
  assert.equal(document.querySelector('input[aria-label="Command menu search"]'), null, 'External module hash navigation closes the portaled task command menu')
  await keypress('k', { ctrlKey: true })
  assert.equal(document.querySelector('input[aria-label="Command menu search"]'), null, 'Tasks keyboard shortcuts remain inactive in other modules')
  await openTask(editableTask)
  await keypress('k', { ctrlKey: true })
  await click(commandItem('Change status…'))
  await keypress('Escape', {}, commandInput())
  assert(commandItem('Change status…'), 'Escape in a property submenu returns to the command root')
  await click(required('[aria-label="Clear issue context"]'))
  assert.equal(commandItem('Change status…'), undefined, 'Clearing context removes issue mutations')
  await input(commandInput(), 'TASK-1373')
  const duplicateCommands = [...document.querySelectorAll('[cmdk-item]')].filter(element => element.textContent.includes('TASK-1373'))
  assert.equal(duplicateCommands.length, 2)
  await click(duplicateCommands.find(element => element.textContent.includes(duplicateTasks[1].fields.title)))
  assert.equal(title().value, duplicateTasks[1].fields.title)
  assert.equal(location.hash, `#tasks/issue/${encodeURIComponent(duplicateTasks[1].path)}`)
  assert.equal(queries.length, localQueries, 'Tabs, filters, selectors, commands, and issue navigation perform no new Room queries')
  await click(required('a[href="#dashboard"]'))
  assert.equal(location.hash, '#dashboard')
  assert.equal(document.querySelector('[data-module="dashboard"]').hidden, false)
  await click(required('a[href="#tasks"]'))
  assert.equal(location.hash, '#tasks')
  assert.equal(within().hidden, false)
  assert.equal(within().querySelector('[data-task-detail]'), null, 'Sidebar return from another module opens the list, not a stale issue route')
  assert.equal(allRows().length, 100)
  await openTask(editableTask)
  await click(required('a[href="#tasks"]'))
  assert.equal(location.hash, '#tasks')
  assert.equal(within().querySelector('[data-task-detail]'), null, 'Clicking the already-active Tasks sidebar entry exits issue detail')
  assert.equal(allRows().length, 100)
  assert.equal(queries.length, localQueries, 'Retained shell pushState navigation stays local to the already-mounted modules')
  await openTask(editableTask)

  await input(title(), 'Unfinished Circle title')
  await input(notes(), 'Unfinished **Markdown** Notes\nSecond line.')
  assert.deepEqual(draftAt(editableTask.path).parts.fields.title, { value: 'Unfinished Circle title', base: { value: initialTitle } })
  assert.deepEqual(draftAt(editableTask.path).parts.sections.Notes, { value: 'Unfinished **Markdown** Notes\nSecond line.', base: initialNotes })
  assert.equal(draftAt(editableTask.path).parts.fields.notes, undefined, 'Description uses the real Notes section')
  assert.equal(saves.length, 0, 'Typing only stages the native RoomDraft')
  await input(title(), '   ')
  assert.equal(draftAt(editableTask.path).parts.fields.title.value, '   ', 'Invalid raw text is durable before explicit validation')
  await save()
  assert.equal(saves.length, 0, 'Invalid title cannot enter the local Save queue')
  assert.match(within().textContent, /Title is required/)
  await input(title(), 'Survives mounted UI reload')
  await unmount(); await mount()
  assert.equal(title().value, 'Survives mounted UI reload')
  assert.equal(notes().value, 'Unfinished **Markdown** Notes\nSecond line.', 'Real title and Notes fields rehydrate from native RoomDraft')

  await act(async () => putDraft(editableTask.path, {
    fields: { title: { value: 'Other tab latest title', base: { value: initialTitle } }, status: { value: 'done', base: { value: editableTask.fields.status } } },
    sections: { Notes: { value: 'Other tab latest Notes', base: initialNotes } },
  }))
  await flush()
  assert.equal(title().value, 'Other tab latest title')
  assert.equal(notes().value, 'Other tab latest Notes')
  assert(required('[aria-label="Set status: Done"]', within()), 'Cross-tab properties redraw the actual selector')
  injectStale = { path: editableTask.path, parts: {
    fields: { title: { value: 'Concurrent earlier title', base: { value: 'must not replace first base' } }, priority: { value: 'critical', base: { value: editableTask.fields.priority } } },
    sections: { Notes: { value: 'Concurrent disjoint Notes', base: 'must not replace first Notes base' } },
  } }
  await input(title(), 'Later local title wins overlap')
  assert.equal(staleCount, 1, 'Real UI exercises the native stale-revision retry')
  assert.equal(draftAt(editableTask.path).parts.fields.title.value, 'Later local title wins overlap')
  assert.deepEqual(draftAt(editableTask.path).parts.fields.title.base, { value: initialTitle })
  assert.equal(draftAt(editableTask.path).parts.fields.priority.value, 'critical', "Stale retry retains another editor's disjoint property")
  assert.equal(notes().value, 'Concurrent disjoint Notes')
  assert.equal(draftAt(editableTask.path).parts.sections.Notes.base, initialNotes, 'Stale retry retains the first Notes base')
  assert(required('[aria-label="Set priority: Critical"]', within()))

  writeBarrier = barrier(editableTask.path)
  await input(title(), 'Delayed first input')
  await input(title(), 'Delayed latest input')
  assert.equal(title().value, 'Delayed latest input')
  writeBarrier.release(); writeBarrier = null; await flush()
  assert.equal(title().value, 'Delayed latest input')
  assert.equal(draftAt(editableTask.path).parts.fields.title.value, 'Delayed latest input', 'Older acknowledgements do not erase queued later typing')

  rejectWrite = { path: editableTask.path, test: parts => parts.fields?.title?.value === 'Failed raw title remains visible' }
  await input(title(), 'Failed raw title remains visible')
  assert.equal(title().value, 'Failed raw title remains visible')
  assert.match(within().textContent, /Injected draft write failure/)
  await input(notes(), 'A different field writes successfully')
  await save()
  assert.equal(saves.length, 0, 'A failed visible field blocks Save even after a disjoint field succeeds')
  assert.equal(title().value, 'Failed raw title remains visible', 'Failed raw text is not silently redrawn from an older draft')
  await input(title(), 'Retried visible title')
  assert.equal(draftAt(editableTask.path).parts.fields.title.value, 'Retried visible title')

  const otherTask = tasks.find(task => task.path !== editableTask.path && task.fields.status === 'todo')
  writeBarrier = barrier(editableTask.path)
  await input(title(), 'Pending old-scope title')
  await save()
  await openTask(otherTask)
  assert.equal(title().value, otherTask.fields.title)
  await input(notes(), 'New scope Notes')
  writeBarrier.release(); writeBarrier = null; await flush()
  assert.equal(title().value, otherTask.fields.title, 'Delayed old-scope acknowledgement cannot redraw another issue')
  assert.equal(notes().value, 'New scope Notes')
  assert.equal(saves.length, 0, 'A Save waiting on old-scope writes cannot commit after issue navigation')
  assert.deepEqual(draftAt(editableTask.path).parts.fields.title.base, { value: initialTitle })
  assert.equal(draftAt(otherTask.path).parts.fields?.title, undefined, 'Old-scope title does not leak into another document')

  const failedReadTask = tasks.find(task => ![editableTask.path, otherTask.path].includes(task.path))
  rejectRead = failedReadTask.path
  await openTask(failedReadTask)
  assert.equal(title().value, failedReadTask.fields.title)
  assert.match(within().textContent, /Injected draft read failure/)
  assert.equal(title().closest('fieldset')?.disabled || title().disabled, true, 'Failed native read keeps this exact editor unready')
  await save(); assert.equal(saves.length, 0)
  rejectRead = null
  await openTask(otherTask)
  await openTask(failedReadTask)
  assert.equal(title().closest('fieldset')?.disabled || title().disabled, false, 'Reopening recovers after a native read failure')
  await openTask(missingNotesTask)
  assert.equal(notes().value, '')
  await input(notes(), 'First description in an empty Notes section')
  assert.deepEqual(draftAt(missingNotesTask.path).parts.sections.Notes, { value: 'First description in an empty Notes section', base: '' })
  assert.equal(draftAt(missingNotesTask.path).parts.fields?.notes, undefined)
  await openTask(otherTask)
  readBarrier = barrier(editableTask.path)
  await openTask(editableTask)
  assert.equal(title().closest('fieldset')?.disabled || title().disabled, true, 'A revisited path must finish its new exact-session read')
  readBarrier.release(); readBarrier = null; await flush()
  assert.equal(title().value, 'Pending old-scope title')

  // The base is what this user saw when typing, even if another confirmed
  // version arrives while an earlier draft write delays the serialized stage.
  const queuedNotesTask = tasks.find(task => ![editableTask.path, otherTask.path, failedReadTask.path, missingNotesTask.path].includes(task.path) && !draftAt(task.path))
  await openTask(queuedNotesTask)
  const shownNotesBase = notes().value
  assert.equal(shownNotesBase, queuedNotesTask.sections.Notes)
  writeBarrier = barrier(queuedNotesTask.path)
  await input(title(), 'Earlier field write holds the native draft queue')
  await input(notes(), 'Notes typed against the original displayed section')
  assert.equal(draftAt(queuedNotesTask.path).parts.sections?.Notes, undefined, 'Notes stage is still waiting behind the earlier field write')
  await act(async () => { queuedNotesTask.sections.Notes = 'Later confirmed Notes not seen when the user typed'; emitRecords() })
  await flush()
  assert.equal(notes().value, 'Notes typed against the original displayed section', 'The later confirmed version does not overwrite pending raw Notes')
  writeBarrier.release(); writeBarrier = null; await flush()
  assert.deepEqual(draftAt(queuedNotesTask.path).parts.sections.Notes, {
    value: 'Notes typed against the original displayed section', base: shownNotesBase,
  }, 'Delayed Notes staging retains the original shown section base rather than a later unseen confirmed value')
  assert.notEqual(draftAt(queuedNotesTask.path).parts.sections.Notes.base, queuedNotesTask.sections.Notes)
  assert.equal(saves.length, 0)
  await openTask(editableTask)

  // A Save already waiting for local writes must recheck reach before queuing.
  writeBarrier = barrier(editableTask.path)
  await input(title(), 'Preserved when reach disappears during Save')
  await save()
  await act(async () => signals.rooms.emit([])); await flush()
  writeBarrier.release(); writeBarrier = null; await flush()
  assert.equal(saves.length, 0, 'Reach loss during an awaited flush cannot queue a Save')
  assert.equal(title().value, 'Preserved when reach disappears during Save')
  assert.equal(title().closest('fieldset')?.disabled || title().disabled, true)
  await act(async () => { signals.rooms.emit([{ locator: room }]); signals['service-mode'].emit('write-halted') }); await flush()
  assert.equal(title().closest('fieldset')?.disabled || title().disabled, false, 'Provider upload halt allows native local drafting')
  saveFailure = 'injected-save-refusal'
  await save()
  assert.equal(saves.length, 0)
  assert(draftAt(editableTask.path), 'A refused native Save retains the draft')
  assert.match(within().textContent, /injected-save-refusal/)
  saveFailure = null
  await save()
  assert.equal(saves.length, 1, 'Explicit Save queues locally even during provider write halt')
  assert.deepEqual(saves[0].items.map(item => item.path), [editableTask.path])
  assert.equal(draftAt(editableTask.path), undefined)
  assert([...within().querySelectorAll('[role="status"]')].some(element => element.textContent.includes('Changes queued in House.')))

  const creationPath = 'tasks/task-new circle #issue.md'
  await navigate(`#tasks/draft/${encodeURIComponent(creationPath)}`)
  await input(title(), 'Unfinished created Circle issue')
  await input(notes(), 'Creation Notes are a section')
  assert.equal(draftAt(creationPath).parts.creation.type, 'task')
  assert.equal(draftAt(creationPath).parts.creation.fields.title, 'Unfinished created Circle issue')
  assert.equal(draftAt(creationPath).parts.creation.sections.Notes, 'Creation Notes are a section')
  assert.equal(draftAt(creationPath).parts.creation.fields.notes, undefined)
  assert.equal(saves.length, 1)
  await unmount(); await mount()
  assert.equal(title().value, 'Unfinished created Circle issue')
  assert.equal(notes().value, 'Creation Notes are a section')
  await act(async () => {
    drafts.delete(key(room, creationPath))
    tasks.push({ room, path: creationPath, type: 'task', fields: { id: 'TASK-CREATED', title: 'Saved from another tab', status: 'todo', label: 'feature', priority: 'medium' }, sections: { Notes: 'Saved Notes from another tab' } })
    emitRecords(); emitDrafts()
  }); await flush()
  assert.equal(title().value, 'Saved from another tab')
  assert.equal(notes().value, 'Saved Notes from another tab')
  await input(title(), 'Edited after another tab saves creation')
  assert.equal(draftAt(creationPath).parts.creation, undefined, 'An open creation becomes a field edit when the real document arrives')
  assert.deepEqual(draftAt(creationPath).parts.fields.title.base, { value: 'Saved from another tab' })
  await input(notes(), 'Edited saved Notes')
  assert.deepEqual(draftAt(creationPath).parts.sections.Notes, { value: 'Edited saved Notes', base: 'Saved Notes from another tab' })

  // The compact list's explicit Save uses that same draft and revision.
  await navigate('#tasks')
  const rowToSave = allRows().find(element => element.dataset.taskPath === otherTask.path)
  assert(rowToSave)
  await click(required(`button[aria-label="Save changes to ${otherTask.fields.id}"]`, rowToSave))
  assert.equal(saves.length, 2, 'Compact row Save explicitly queues its real native draft')
  assert.deepEqual(saves[1].items.map(item => item.path), [otherTask.path])
  assert.equal(otherTask.sections.Notes, 'New scope Notes')
  assert.equal(draftAt(otherTask.path), undefined)
  assert(draftAt(creationPath), 'Saving another compact row does not clear the unfinished creation edit')
  await navigate(`#tasks/draft/${encodeURIComponent(creationPath)}`)

  const writesBeforeBindingChange = writes.length
  await act(async () => signals.rooms.emit([{ locator: 'different-room' }])); await flush()
  assert.equal(title().value, 'Edited after another tab saves creation')
  await save()
  assert.equal(saves.length, 2, 'A binding change cannot retarget the open draft')
  assert.equal(writes.length, writesBeforeBindingChange)
  assert.equal(draftAt(creationPath).room, room)
  console.log('PASS: mounted Circle groups and duplicate path identity; local tabs/filters/search/navigation and keyboard commands; inline properties and Save; native title and Notes staging; invalid raw input; remount and cross-tab hydration; stale overlap/disjoint first bases and captured Notes base under delayed staging; modal module-dismissal and reopen reset; rapid-input acknowledgement ordering; failed-write protection and retry; exact-session read/scope isolation; reach-loss and binding-change protection; refused Save preservation; explicit local Save during provider halt; and creation-to-saved transition.')
} finally {
  if (root) await act(async () => root.unmount())
  await server.close()
  await window.happyDOM.abort()
}
