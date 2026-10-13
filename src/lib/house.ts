import { DraftSession, type RoomDraft } from './task-draft'
import { houseBridge } from '@agentshouse/app-bridge'
import { taskSchema, taskFieldsSchema, type Task, type TaskFields } from '@/features/tasks/data/schema'

type MdRuntimeClient = Awaited<ReturnType<typeof houseBridge>['runtime']>

export type HouseRuntime = MdRuntimeClient
export { type RoomDraft }

let connection: Promise<MdRuntimeClient> | undefined
export function houseRuntime() {
  connection ??= (async () => {
    const bridge = houseBridge()
    bridge.setTab({ title: 'Tasks' })
    return bridge.runtime
  })()
  return connection
}
export const tasksQuery = {
  types: ['task'],
  select: { fields: ['/id', '/title', '/status', '/label', '/priority'], sections: ['Notes'] },
  orderBy: [{ by: 'path' as const, direction: 'asc' as const }],
}
export function readTasks(result: { documents: readonly { room: string; path: string; fields?: Readonly<Record<string, unknown>>; sections?: Readonly<Record<string, string>> }[] }): Task[] {
  return result.documents.map((document) => ({ ...taskSchema.parse(document.fields), room: document.room, path: document.path, notes: document.sections?.Notes }))
}
type DraftParts = Parameters<MdRuntimeClient['roomDraft']['write']>[3]
async function saveChanges(md: MdRuntimeClient, room: string, changes: { path: string; parts: DraftParts }[], isAvailable: () => boolean = () => true) {
  const check = () => { if (!isAvailable()) throw new Error('The data binding is not ready. Your open edits and House drafts are kept.') }
  // Never overwrite another tab's unfinished or returned draft.
  for (const change of changes) {
    check()
    if (await md.roomDraft.read(room, change.path)) throw new Error('This task has an unfinished House draft. Resolve it in House before editing it again.')
  }
  const drafts = []
  for (const change of changes) {
    check()
    const answer = await md.roomDraft.write(room, change.path, null, change.parts)
    if (answer.outcome !== 'written' || !answer.roomDraft) throw new Error('The task draft changed in another tab. Reload before retrying.')
    drafts.push({ path: change.path, revision: answer.roomDraft.revision })
  }
  check()
  const answer = await md.save(room, drafts)
  if (answer.outcome !== 'saved') throw new Error(`House did not save these changes: ${answer.code}. Your Room draft has been kept.`)
}
export async function createTasks(md: MdRuntimeClient, room: string, inputs: TaskFields[], isAvailable: () => boolean = () => true) {
  const changes = inputs.map((input) => {
    const identity = crypto.randomUUID()
    return { path: `tasks/task-${identity}.md`, parts: { creation: { type: 'task', fields: { id: `TASK-${identity.slice(0, 8).toUpperCase()}`, ...taskFieldsSchema.parse(input) }, sections: { Notes: '' } } } }
  })
  await saveChanges(md, room, changes, isAvailable)
}
export async function updateTasks(md: MdRuntimeClient, tasks: Task[], patch: Partial<TaskFields>, isAvailable: () => boolean = () => true) {
  const groups = new Map<string, Task[]>()
  for (const task of tasks) groups.set(task.room, [...(groups.get(task.room) ?? []), task])
  for (const [room, rows] of groups) {
    await saveChanges(md, room, rows.map((task) => {
      taskFieldsSchema.parse({ ...task, ...patch })
      const fields = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, { value, base: { value: task[key as keyof TaskFields] } }]))
      return { path: task.path, parts: { fields } }
    }), isAvailable)
  }
}
export async function deleteTasks(md: MdRuntimeClient, tasks: Task[], isAvailable: () => boolean = () => true) {
  const groups = new Map<string, Task[]>()
  for (const task of tasks) groups.set(task.room, [...(groups.get(task.room) ?? []), task])
  for (const [room, rows] of groups) {
    if (!isAvailable()) throw new Error('The data binding is not ready. Your open edits are kept.')
    const result = await md.query({ rooms: [room], types: ['task'], select: { fields: ['/id', '/title', '/status', '/label', '/priority'], markdown: true } })
    const changes = rows.map((task) => {
      const current = result.documents.find((document) => document.path === task.path)
      if (!current?.markdown || Object.keys(taskSchema.shape).some((key) => current.fields?.[key] !== task[key as keyof Task])) throw new Error('A selected task changed. Reload and review it before deleting.')
      return { path: task.path, parts: { removal: { base: current.markdown } } }
    })
    await saveChanges(md, room, changes, isAvailable)
  }
}

export type TaskSession = { tasks: Task[]; room: string | null; loading: boolean; error: string | null; syncLabel: string; writeHalted: boolean; drafts: readonly RoomDraft[] }
/** Device-local Rooms are provisional until the first completed sync. */
export function observeTaskSession(md: MdRuntimeClient, update: (value: TaskSession) => void) {
  let disposed = false
  let rooms: Awaited<ReturnType<MdRuntimeClient['rooms']>> = []
  let completed = false
  let selected: string | null = null
  let tasks: Task[] = []
  let loading = true
  let queryError: string | null = null
  let fatal: string | null = null
  let syncLabel = ''
  let writeHalted = false
  let drafts: readonly RoomDraft[] = []
  let queryRoom: string | null = null
  let generation = 0
  let stopQuery: (() => void) | undefined
  const cleanup: (() => void)[] = []
  const bindingError = () => !completed ? null : rooms.length !== 1 ? 'Bind exactly one Tasks Room to this App in House.' : selected && rooms[0].locator !== selected ? 'The Tasks data binding changed. Copy your open edits before reloading; they have not been moved.' : null
  const currentRoom = () => !disposed && completed && !fatal && !bindingError() && selected ? selected : null
  const emit = () => { if (!disposed) update({ tasks, room: currentRoom(), loading: !completed || (Boolean(currentRoom()) && loading), error: fatal || bindingError() || queryError, syncLabel, writeHalted, drafts }) }
  function reconcile() {
    if (!selected && completed && rooms.length === 1) selected = rooms[0].locator
    const room = currentRoom()
    if (room !== queryRoom) {
      generation++; stopQuery?.(); stopQuery = undefined; queryRoom = room; queryError = null; loading = true
      if (room) {
        const expected = generation
        void md.observe('query', { ...tasksQuery, rooms: [room] }).then(observation => {
          if (disposed || generation !== expected) { observation.close(); return }
          const render = () => {
            if (disposed || generation !== expected) return
            try { tasks = readTasks(observation.current()); loading = false; queryError = null } catch (error) { queryError = error instanceof Error ? error.message : String(error); loading = false }
            emit()
          }
          render(); const unsubscribe = observation.subscribe(render)
          stopQuery = () => { unsubscribe(); observation.close() }
        }).catch(error => { if (!disposed && generation === expected) { queryError = error instanceof Error ? error.message : String(error); loading = false; emit() } })
      }
    }
    emit()
  }
  async function watch<T>(promise: Promise<{ current(): T; subscribe(listener: (value: T) => void): () => void; close(): void }>, apply: (value: T) => void) {
    try {
      const observation = await promise
      if (disposed) { observation.close(); return }
      apply(observation.current())
      cleanup.push(observation.subscribe(value => { if (!disposed) apply(value) }), () => observation.close())
    } catch (error) { if (!disposed) { fatal = error instanceof Error ? error.message : String(error); reconcile() } }
  }
  void watch(md.observe('rooms'), value => { rooms = value; reconcile() })
  void watch(md.observe('sync-status'), value => { completed = typeof value.lastCompleted === 'string'; syncLabel = value.attentionRequired.length ? 'Some House changes need attention. Review the returned drafts before editing again.' : ''; reconcile() })
  void watch(md.observe('room-drafts'), value => { drafts = value; emit() })
  void watch(md.observe('service-mode'), value => { writeHalted = value === 'write-halted'; emit() })
  void watch(md.observe('connection-refusal'), value => { fatal = value ? `House connection refused: ${value.code}` : null; reconcile() })
  return { currentRoom: () => !loading && !queryError ? currentRoom() : null, close() { disposed = true; generation++; stopQuery?.(); cleanup.forEach(close => close()) } }
}


export async function taskDraftSession(room: string, path: string, observed?: RoomDraft | null) {
  const session = new DraftSession(await houseRuntime(), room, path)
  if (observed !== undefined) session.accept(observed)
  return session
}
export function newTaskDraftPath() { return `tasks/task-${crypto.randomUUID()}.md` }
export function taskDraftValues(draft: RoomDraft | null, fallback: TaskFields): TaskFields {
  const creation = draft?.parts.creation
  const values = creation && 'fields' in creation ? creation.fields : {}
  return Object.fromEntries(Object.entries(fallback).map(([name, value]) => [name, draft?.parts.fields?.[name]?.value ?? values[name] ?? value])) as TaskFields
}
export function stageTaskField(session: DraftSession, row: Task | undefined, initial: TaskFields, name: keyof TaskFields, value: string) {
  return session.stage(current => {
    if (row) return { fields: { [name]: { value, base: { value: row[name] } } } }
    const creation = current?.parts.creation
    const fields = creation && 'fields' in creation ? creation.fields : { id: `TASK-${session.path.slice('tasks/task-'.length, 'tasks/task-'.length + 8).toUpperCase()}`, ...initial }
    return { creation: { type: 'task', fields: { ...fields, [name]: value }, sections: creation && 'sections' in creation ? creation.sections : { Notes: '' } } }
  })
}
