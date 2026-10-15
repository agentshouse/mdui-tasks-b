import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { houseRuntime, observeTaskSession, type HouseRuntime, type RoomDraft } from '@/lib/house'
import { DraftSession } from '@/lib/task-draft'

export type WorkspaceRecord = { room: string; path: string; type: string; fields: Record<string, unknown>; lastSavedBy?: string }
type Workspace = { records: WorkspaceRecord[]; room: string | null; drafts: readonly RoomDraft[]; runtime: HouseRuntime | null; available(): boolean; loading: boolean; error: string | null }
const Context = createContext<Workspace | null>(null)
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<WorkspaceRecord[]>([])
  const [runtime, setRuntime] = useState<HouseRuntime | null>(null)
  const [state, setState] = useState({ room: null as string | null, drafts: [] as readonly RoomDraft[], loading: true, error: null as string | null })
  const reach = useRef<ReturnType<typeof observeTaskSession> | null>(null)
  useEffect(() => {
    let disposed = false, generation = 0
    let selected: string | null = null, stopQuery: (() => void) | undefined
    void houseRuntime().then(md => {
      if (disposed) return
      setRuntime(md)
      reach.current = observeTaskSession(md, value => {
        setState({ room: value.room, drafts: value.drafts, loading: value.loading, error: value.error })
        if (selected === value.room) return
        selected = value.room; generation++; stopQuery?.(); stopQuery = undefined
        if (!selected) return
        const expected = generation
        void md.observe('query', { rooms: [selected], select: { fields: 'all', change: true }, orderBy: [{ by: 'path', direction: 'asc' }] }).then(observation => {
          if (disposed || generation !== expected) { observation.close(); return }
          const render = () => {
            if (disposed || generation !== expected) return
            const result = observation.current()
            if ('pending' in result) return
            setRecords(result.documents.map(document => ({ room: document.room, path: document.path, type: document.type ?? '', fields: { ...document.fields }, lastSavedBy: document.change?.author?.name } )))
          }
          render(); const unsubscribe = observation.subscribe(render)
          stopQuery = () => { unsubscribe(); observation.close() }
        }).catch(error => { if (!disposed && generation === expected) setState(previous => ({ ...previous, error: String(error) })) })
      })
    }).catch(error => { if (!disposed) setState(previous => ({ ...previous, loading: false, error: String(error) })) })
    return () => { disposed = true; generation++; stopQuery?.(); reach.current?.close(); reach.current = null }
  }, [])
  return <Context value={{ records, runtime, ...state, available: () => Boolean(reach.current?.currentRoom()) }}>{children}</Context>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const value = useContext(Context)
  if (!value) throw new Error('WorkspaceProvider is required')
  return value
}
function businessFields(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).filter(([name]) => name !== 'type'))
}
// eslint-disable-next-line react-refresh/only-export-components
export function draftValues(draft: RoomDraft | null, fallback: Record<string, unknown>) {
  const creation = draft?.parts.creation
  const fields = creation && 'fields' in creation ? creation.fields : {}
  return businessFields({ ...fallback, ...fields, ...Object.fromEntries(Object.entries(draft?.parts.fields ?? {}).map(([name, field]) => [name, field.value])) })
}
// eslint-disable-next-line react-refresh/only-export-components
export function useDocumentDraft(record: WorkspaceRecord | undefined, type?: string, newPath?: string, initialFields: Record<string, unknown> = {}) {
  const workspace = useWorkspace()
  const room = record?.room ?? workspace.room, path = record?.path ?? newPath
  // A fresh identity for every scope transition, including A -> B -> A, keeps
  // readiness and async acknowledgements tied to the exact opened session.
  const target = useMemo(() => ({ runtime: workspace.runtime, room, path }), [workspace.runtime, room, path])
  type Pending = { value: unknown; sequence: number; failed?: boolean }
  type Editor = { target: typeof target; current: DraftSession; pending: Map<string, Pending> }
  const session = useRef<Editor | null>(null)
  const recordRef = useRef(record)
  const initialRef = useRef(initialFields)
  useEffect(() => { recordRef.current = record }, [record])
  useEffect(() => { initialRef.current = initialFields }, [initialFields])
  const sequence = useRef(0)
  const [snapshot, setSnapshot] = useState({ target, values: businessFields(record?.fields ?? {}), error: null as string | null, busy: false, ready: false })
  const matches = (row: WorkspaceRecord | undefined, current: DraftSession) => row?.room === current.room && row?.path === current.path
  const stateFor = useCallback((editor: Editor) => {
    const row = recordRef.current
    const next = draftValues(editor.current.current(), row?.room === editor.current.room && row?.path === editor.current.path ? row.fields : {})
    for (const [name, input] of editor.pending) next[name] = input.value
    return next
  }, [])
  useEffect(() => {
    if (!target.runtime || !target.room || !target.path) return
    const current = new DraftSession(target.runtime, target.room, target.path)
    const editor: Editor = { target, current, pending: new Map() }
    session.current = editor
    const publish = () => {
      if (session.current !== editor) return
      setSnapshot(previous => ({ target, values: stateFor(editor), error: previous.target === target ? previous.error : null, busy: previous.target === target && previous.busy, ready: previous.target === target && previous.ready }))
    }
    const unsubscribe = current.subscribe(publish)
    void current.read().then(() => {
      if (session.current !== editor) return
      setSnapshot(previous => ({ target, values: stateFor(editor), error: previous.target === target ? previous.error : null, busy: false, ready: true }))
    }).catch(reason => {
      if (session.current === editor) setSnapshot({ target, values: stateFor(editor), error: String(reason), busy: false, ready: false })
    })
    return () => { unsubscribe(); if (session.current === editor) session.current = null }
  }, [target, stateFor])
  useEffect(() => {
    const editor = session.current
    if (editor?.target === target) editor.current.accept(workspace.drafts.find(draft => draft.room === room && draft.path === path) ?? null)
  }, [workspace.drafts, room, path, record, target])
  const ready = snapshot.target === target && snapshot.ready
  const setField = (name: string, value: unknown) => {
    const editor = session.current
    if (!editor || editor.target !== target || !ready) return
    const current = editor.current
    const recordAtInput = matches(recordRef.current, current) ? recordRef.current : undefined
    const creationDefaults = businessFields(initialRef.current)
    if (name === 'type') { setSnapshot(previous => ({ ...previous, error: 'The document type cannot be edited as a business field.' })); return }
    const id = ++sequence.current
    editor.pending.set(name, { value, sequence: id })
    setSnapshot(previous => ({ ...previous, values: { ...previous.values, [name]: value } }))
    void current.stage(draft => {
      const latest = matches(recordRef.current, current) ? recordRef.current : recordAtInput
      if (latest) return { fields: { [name]: { value, base: name in latest.fields ? { value: latest.fields[name] } : null } } }
      const creation = draft?.parts.creation
      return { creation: { type: type!, fields: { ...creationDefaults, ...(creation && 'fields' in creation ? creation.fields : {}), [name]: value as never }, sections: creation && 'sections' in creation ? creation.sections : {} } }
    }).then(() => {
      if (editor.pending.get(name)?.sequence === id) editor.pending.delete(name)
      if (session.current !== editor) return
      setSnapshot(previous => ({ ...previous, values: stateFor(editor), error: [...editor.pending.values()].some(input => input.failed) ? previous.error : null }))
    }).catch(reason => {
      const input = editor.pending.get(name)
      if (input?.sequence === id) input.failed = true
      if (session.current === editor && input?.sequence === id) setSnapshot(previous => ({ ...previous, error: String(reason) }))
    })
  }
  const save = async () => {
    const editor = session.current
    if (!editor || editor.target !== target || !ready || !workspace.available() || workspace.room !== room) throw new Error('The Room binding is unavailable. Your local draft is retained.')
    setSnapshot(previous => ({ ...previous, busy: true }))
    try {
      await editor.current.flush()
      if (editor.pending.size) throw new Error('Some edits could not be written to the Room draft. Retry those fields before saving.')
      if (session.current !== editor || !workspace.available() || workspace.room !== room) throw new Error('Room reach changed. Your local draft is retained.')
      await editor.current.commit()
      if (session.current === editor) setSnapshot(previous => ({ ...previous, error: null }))
    } catch (reason) {
      if (session.current === editor) setSnapshot(previous => ({ ...previous, error: String(reason) }))
      throw reason
    } finally { if (session.current === editor) setSnapshot(previous => ({ ...previous, busy: false })) }
  }
  return { values: snapshot.target === target ? snapshot.values : businessFields(record?.fields ?? {}), setField, save, error: snapshot.target === target ? snapshot.error : null, busy: snapshot.target === target && snapshot.busy, ready }
}
