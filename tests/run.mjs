import { assertQueryPointers, projectQueryResult, strictQueryObservation } from './query-contract.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { createHouseBridgeTestHost } from '@agentshouse/app-bridge/test-host'

const root = await fs.mkdtemp(path.join(process.cwd(), '.task-tests-'))
try {
  for (const name of ['features/tasks/data/schema', 'features/tasks/data/csv', 'lib/house', 'lib/task-draft']) {
    const source = await fs.readFile(`src/${name}.ts`, 'utf8')
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
      .replaceAll("'./task-draft'", "'./task-draft.js'").replaceAll("'./schema'", "'./schema.js'").replaceAll("'@/features/tasks/data/schema'", "'../features/tasks/data/schema.js'")
    const filename = path.join(root, name + '.js'); await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, output)
  }
  const taskProvider = await fs.readFile('src/features/tasks/components/tasks-provider.tsx', 'utf8')
  const taskScreen = await fs.readFile('src/features/tasks/circle/index.tsx', 'utf8')
  assert.doesNotMatch(taskProvider, /Offline ·|Saved in House|Syncing with House|Connecting to House/)
  assert.match(await fs.readFile('src/lib/house.ts', 'utf8'), /attentionRequired.length/)
  assert.match(taskProvider, /House uploads are paused; local drafts remain available/)
  assert.match(taskProvider, /Changes queued in House/)
  assert.match(taskScreen, /tasks.syncLabel && <p role=/)
  const { taskSchema, taskRowIdentity } = await import(pathToFileURL(path.join(root, 'features/tasks/data/schema.js')))
  const demo = JSON.parse(await fs.readFile('tests/support/fixtures/donor-tasks.json', 'utf8'))
  assert.equal(demo.length, 100)
  demo.forEach((task) => taskSchema.parse(task))
  assert.equal(new Set(demo.map((task) => task.id)).size, 99, 'Preserve the donor duplicate display ID')
  const identities = demo.map((task, index) => taskRowIdentity({ ...task, room: 'tasks-pilot', path: `tasks/donor-${index + 1}.md` }))
  assert.equal(new Set(identities).size, 100, 'Every donor document has independent row identity')
  assert.notEqual(taskRowIdentity({ room: 'one', path: 'task.md' }), taskRowIdentity({ room: 'two', path: 'task.md' }))
  const { parseTasksCsv, tasksCsv } = await import(pathToFileURL(path.join(root, 'features/tasks/data/csv.js')))
  const { houseRuntime, createTasks, updateTasks, deleteTasks, readTasks, observeTaskSession, stageTaskField, taskDraftValues } = await import(pathToFileURL(path.join(root, 'lib/house.js')))
  const fields = { title: 'Fix a "quoted", title', status: 'todo', label: 'bug', priority: 'high' }
  const task = { id: 'TASK-1001', ...fields, room: 'tasks-room', path: 'tasks/task-1001.md' }
  assert.deepEqual(parseTasksCsv(tasksCsv([task])), [fields])
  assert.equal(parseTasksCsv('title,status,label,priority\r\n"Line one\nLine two",done,feature,low')[0].title, 'Line one\nLine two')
  assert.throws(() => parseTasksCsv('title,status,label,priority\n"unfinished,todo,bug,high'), /unclosed quote/)
  assert.throws(() => parseTasksCsv('title,status,label,priority\nFix,unknown,bug,high'), /row 2/)
  assert.throws(() => parseTasksCsv('name\nTask'), /headers/)
  assert.match(tasksCsv([{ ...task, title: '=2+2' }]), /'=2\+2/)
  assert.equal(readTasks({ documents: [{ room: task.room, path: task.path, fields: task }] })[0].path, task.path)
  const writes = []; const saves = []
  const md = {
    roomDraft: { read: async () => null, write: async (room, path, revision, parts) => { writes.push({ room, path, revision, parts }); return { outcome: 'written', roomDraft: { revision: `draft-${writes.length}` } } } },
    save: async (room, drafts) => { saves.push({ room, drafts }); return { outcome: 'saved', identifier: 'test-only' } },
    query: async (query) => projectQueryResult(query, { documents: [{ room: task.room, path: task.path, fields: task, markdown: '# Test task' }] }),
  }
  const host = createHouseBridgeTestHost({ address: '/app/a_e.n' })
  host.attachRuntime(md)
  globalThis.houseBridge = host.port
  globalThis.houseRuntime = host.runtime
  const firstConnection = houseRuntime()
  assert.equal(firstConnection, houseRuntime(), 'The bridge connection is reused')
  assert.equal(await firstConnection, md, 'Use the exact runtime client supplied by the host')
  assert.deepEqual(host.tabs, [{ title: 'Tasks' }])
  delete globalThis.houseBridge
  delete globalThis.houseRuntime
  await createTasks(md, task.room, [fields]); assert.equal(writes[0].parts.creation.type, 'task'); assert.equal(saves.length, 1)
  await updateTasks(md, [task], { status: 'done' }); assert.deepEqual(writes[1].parts.fields.status, { value: 'done', base: { value: 'todo' } })
  await deleteTasks(md, [task]); assert.equal(writes[2].parts.removal.base, '# Test task')
  const before = writes.length
  await assert.rejects(updateTasks({ ...md, roomDraft: { ...md.roomDraft, read: async () => ({ revision: 'other-tab' }) } }, [task], { status: 'done' }), /unfinished House draft/)
  assert.equal(writes.length, before)
  await assert.rejects(deleteTasks({ ...md, query: async (query) => { assertQueryPointers(query); return { documents: [{ room: task.room, path: task.path, fields: { ...task, title: 'New title' }, markdown: '# Test task' }] } } }, [task]), /changed/)
  await assert.rejects(updateTasks({ ...md, save: async () => ({ outcome: 'refused', rule: 'changed-underneath' }) }, [task], { status: 'done' }), /changed-underneath/)
  const flush = async () => { for(let i=0;i<5;i++) await new Promise(resolve=>setImmediate(resolve)) }
  function signal(value) {
    const listeners=new Set();let closed=0
    return { current:()=>value, subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}, close:()=>{closed++}, emit:next=>{value=next;listeners.forEach(fn=>fn(next))}, get closed(){return closed},get listeners(){return listeners.size} }
  }
  function sessionFixture(initialRooms=[],lastCompleted=null) {
    const signals={rooms:signal(initialRooms),'sync-status':signal({lastCompleted,attentionRequired:[]}), 'room-drafts':signal([]),'service-mode':signal('open'),'connection-refusal':signal(null)}
    const queries=[];const states=[]
    const client={observe:async(kind,input)=>{if(kind==='query'){assertQueryPointers(input);const value=signal({documents:[{room:input.rooms[0],path:task.path,fields:task}]});queries.push(value);return strictQueryObservation(input,value)}return signals[kind]}}
    const session=observeTaskSession(client,value=>states.push(value));return {signals,queries,states,session,last:()=>states.at(-1)}
  }
  const sess=sessionFixture();await flush();assert.equal(sess.last().loading,true);assert.equal(sess.last().error,null);assert.equal(sess.queries.length,0)
  sess.signals['sync-status'].emit({lastCompleted:'2026-10-11T13:00:00Z',attentionRequired:[]});await flush();assert.match(sess.last().error,/Bind exactly one/)
  sess.signals.rooms.emit([{locator:task.room}]);await flush();assert.equal(sess.last().error,null);assert.equal(sess.last().tasks.length,1);assert.equal(sess.session.currentRoom(),task.room)
  const firstQuery=sess.queries[0];sess.signals.rooms.emit([]);await flush();assert.equal(sess.session.currentRoom(),null);assert.match(sess.last().error,/Bind exactly one/);assert.equal(firstQuery.closed,1)
  const beforeLossWrites=writes.length
  await assert.rejects(createTasks(md,task.room,[fields],()=>sess.session.currentRoom()===task.room),/binding is not ready/);assert.equal(writes.length,beforeLossWrites)
  sess.signals.rooms.emit([{locator:task.room}]);await flush();assert.equal(sess.last().error,null);assert.equal(sess.last().tasks.length,1)
  sess.signals.rooms.emit([{locator:task.room},{locator:'other'}]);await flush();assert.equal(sess.session.currentRoom(),null);assert.match(sess.last().error,/Bind exactly one/)
  sess.signals.rooms.emit([{locator:'other'}]);await flush();assert.match(sess.last().error,/binding changed/);assert.equal(sess.session.currentRoom(),null)
  sess.signals.rooms.emit([{locator:task.room}]);await flush();assert.equal(sess.session.currentRoom(),task.room)
  sess.session.close();for(const signal of Object.values(sess.signals)){assert.equal(signal.closed,1);assert.equal(signal.listeners,0)}
  const early=sessionFixture([{locator:task.room}]);await flush();assert.equal(early.queries.length,0);assert.equal(early.last().error,null)
  early.signals['sync-status'].emit({lastCompleted:'2026-10-11T13:00:00Z',attentionRequired:[]});await flush();assert.equal(early.queries.length,1);assert.equal(early.session.currentRoom(),task.room);early.session.close()
  // Async query setup resolving after reach loss must close without publishing stale records.
  let resolveQuery;const delayed=signal({documents:[]});const base={rooms:signal([{locator:task.room}]),'sync-status':signal({lastCompleted:'done',attentionRequired:[]}),'room-drafts':signal([]),'service-mode':signal('open'),'connection-refusal':signal(null)}
  const lateStates=[];const late=observeTaskSession({observe:(kind)=>kind==='query'?new Promise(resolve=>{resolveQuery=resolve}):Promise.resolve(base[kind])},value=>lateStates.push(value));await flush();base.rooms.emit([]);resolveQuery(delayed);await flush();assert.equal(delayed.closed,1);assert.match(lateStates.at(-1).error,/Bind exactly one/);late.close()
  assert.match(taskScreen, /<TasksDialogs\s*\/>/, 'Dialogs stay mounted independently of query readiness')
  assert.doesNotMatch(taskProvider, /setOpen\(null\)|setCurrentRow\(null\)/, 'Reach changes do not discard unsaved dialogs')
  const { DraftSession } = await import(pathToFileURL(path.join(root, 'lib/task-draft.js')))
  const durable = new Map();let draftRevision=0;const queuedDrafts=[]
  const draftRuntime={roomDraft:{
    read:async(_room,path)=>structuredClone(durable.get(path)??null),
    write:async(room,path,revision,parts)=>{
      const prior=durable.get(path)??null
      if((prior?.revision??null)!==revision)return{outcome:'stale',current:structuredClone(prior)}
      const next={room,path,revision:String(++draftRevision),parts:structuredClone(parts),returned:prior?.returned??null,changedUnderneath:{}}
      for(const section of ['fields','sections'])for(const key of Object.keys(next.parts[section]??{}))if(prior?.parts[section]?.[key])next.parts[section][key].base=prior.parts[section][key].base
      durable.set(path,next);return{outcome:'written',roomDraft:structuredClone(next)}
    }},save:async(room,drafts)=>{queuedDrafts.push({room,drafts});for(const draft of drafts)durable.delete(draft.path);return{outcome:'saved',identifier:'local-only'}}}
  const draftOne=new DraftSession(draftRuntime,task.room,task.path),draftTwo=new DraftSession(draftRuntime,task.room,task.path)
  await Promise.all([draftOne.read(),draftTwo.read()])
  await stageTaskField(draftOne,task,fields,'title','first tab text')
  await stageTaskField(draftTwo,task,fields,'status','done')
  await stageTaskField(draftTwo,task,fields,'title','later typed title')
  assert.equal(durable.get(task.path).parts.fields.title.value,'later typed title')
  assert.deepEqual(durable.get(task.path).parts.fields.title.base,{value:task.title})
  assert.equal(durable.get(task.path).parts.fields.status.value,'done')
  const reloadDraft=new DraftSession(draftRuntime,task.room,task.path)
  assert.equal(taskDraftValues(await reloadDraft.read(),fields).title,'later typed title')
  assert.equal(queuedDrafts.length,0,'Typing persists locally without save/provider transmission')
  const creationPath='tasks/task-new-creation.md',creation=new DraftSession(draftRuntime,task.room,creationPath)
  await stageTaskField(creation,undefined,fields,'title','')
  assert.equal(durable.get(creationPath).parts.creation.fields.title,'','Invalid partial input is retained until explicit Save validation')
  await stageTaskField(creation,undefined,fields,'title','New draft title')
  assert.equal((await new DraftSession(draftRuntime,task.room,creationPath).read()).parts.creation.fields.title,'New draft title')
  await creation.commit();assert.equal(queuedDrafts.length,1);assert.equal(durable.has(creationPath),false)
  console.log('PASS: durable task typing/reload hydration, rapid field staging, disjoint merge, latest local overlap input, first-base preservation and explicit-only local Save.')
  console.log('PASS: reactive first-sync readiness, both arrival orders, completed zero/multiple reach, late recovery, pinned Room changes, no stale query callbacks, cleanup and refusal-before-draft on reach loss.')
  console.log('PASS: exact 100-row donor fixture and duplicate-safe Room row identities, direct bridge runtime client and connection reuse, CSV round-trip, multiline, malformed input, schema validation, formula escaping, Room mapping, create, update bases, delete bases, draft collision, changed-document refusal, save refusal. These are local unit tests, not a live House or browser acceptance pass.')
} finally { await fs.rm(root, { recursive: true, force: true }) }
