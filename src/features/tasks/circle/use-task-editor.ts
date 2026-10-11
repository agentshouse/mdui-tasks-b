import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { taskDraftSession, taskDraftValues, stageTaskField, type RoomDraft } from '@/lib/house'
import type { DraftSession } from '@/lib/task-draft'
import { taskFieldsSchema, type Task } from '../data/schema'
import { useTasks } from '../components/tasks-provider'
import type { EditableValues } from './options'

type Pending = { value: string; sequence: number; failed?: boolean }
function valuesOf(draft: RoomDraft | null, row: Task | undefined, defaults: EditableValues): EditableValues {
  const creation = draft?.parts.creation
  return { ...taskDraftValues(draft, row ?? defaults), notes: draft?.parts.sections?.Notes?.value ?? (creation && 'sections' in creation ? creation.sections?.Notes : undefined) ?? row?.notes ?? defaults.notes }
}
/** One actual business-document editor. Raw input is immediately staged; only
 * explicit Save queues it. Pending input is tied to an exact editor identity. */
export function useTaskEditor(room: string | null, path: string, row: Task | undefined, initialStatus = 'todo') {
  const tasks = useTasks()
  const target = useMemo(() => ({ room, path }), [room, path])
  const defaults = useMemo<EditableValues>(() => ({ title: '', status: initialStatus as EditableValues['status'], priority: 'medium', label: 'feature', notes: '' }), [initialStatus])
  type Editor = { target: typeof target; current: DraftSession; pending: Map<keyof EditableValues, Pending> }
  const editorRef = useRef<Editor | null>(null), rowRef = useRef(row), sequence = useRef(0)
  useEffect(() => { rowRef.current = row }, [row])
  const [snapshot, setSnapshot] = useState({ target, values: valuesOf(null, row, defaults), ready: false, busy: false, error: '', receipt: '' })
  const stateFor = useCallback((editor: Editor) => {
    const selected = rowRef.current
    const values = valuesOf(editor.current.current(), selected?.room === editor.current.room && selected.path === editor.current.path ? selected : undefined, defaults)
    for (const [name, input] of editor.pending) Object.assign(values, { [name]: input.value })
    return values
  }, [defaults])
  useEffect(() => {
    if (!target.room) return
    let disposed = false, unsubscribe: (() => void) | undefined
    void taskDraftSession(target.room, target.path).then(async current => {
      if (disposed) return
      const editor: Editor = { target, current, pending: new Map() }
      editorRef.current = editor
      const publish = () => { if (editorRef.current === editor) setSnapshot(previous => ({ target, values: stateFor(editor), ready: previous.target === target && previous.ready, busy: previous.target === target && previous.busy, error: previous.target === target ? previous.error : '', receipt: previous.target === target ? previous.receipt : '' })) }
      unsubscribe = current.subscribe(publish)
      await current.read()
      if (!disposed && editorRef.current === editor) setSnapshot({ target, values: stateFor(editor), ready: true, busy: false, error: '', receipt: '' })
    }).catch(reason => { if (!disposed) setSnapshot(previous => ({ ...previous, target, error: String(reason), ready: false })) })
    return () => { disposed = true; unsubscribe?.(); if (editorRef.current?.target === target) editorRef.current = null }
  }, [target, stateFor])
  useEffect(() => {
    const editor = editorRef.current
    if (editor?.target === target) editor.current.accept(tasks.drafts.find(draft => draft.room === room && draft.path === path) ?? null)
  }, [tasks.drafts, room, path, row, target])
  const ready = snapshot.target === target && snapshot.ready
  const editable = ready && !!room && tasks.room === room && !tasks.loading && !tasks.error
  const setField = (name: keyof EditableValues, value: string) => {
    const editor = editorRef.current
    if (!editor || editor.target !== target || !editable) return
    const current = editor.current, atInput = rowRef.current, id = ++sequence.current
    editor.pending.set(name, { value, sequence: id })
    setSnapshot(previous => ({ ...previous, values: { ...previous.values, [name]: value }, receipt: '' }))
    const operation = name === 'notes' ? current.stage(draft => {
      // Bases belong to the document shown when input occurred, not a newer
      // confirmed revision that may arrive while an earlier write is in flight.
      if (atInput) return { sections: { Notes: { value, base: atInput.notes ?? '' } } }
      const creation = draft?.parts.creation
      return { creation: { type: 'task', fields: creation && 'fields' in creation ? creation.fields : { id: `TASK-${current.path.slice('tasks/task-'.length, 'tasks/task-'.length + 8).toUpperCase()}`, title: defaults.title, status: defaults.status, priority: defaults.priority, label: defaults.label }, sections: { ...(creation && 'sections' in creation ? creation.sections : {}), Notes: value } } }
    }) : stageTaskField(current, atInput, { title: defaults.title, status: defaults.status, priority: defaults.priority, label: defaults.label }, name, value)
    void operation.then(() => {
      if (editor.pending.get(name)?.sequence === id) editor.pending.delete(name)
      if (editorRef.current === editor) setSnapshot(previous => ({ ...previous, values: stateFor(editor), error: [...editor.pending.values()].some(input => input.failed) ? previous.error : '' }))
    }).catch(reason => {
      const input = editor.pending.get(name)
      if (input?.sequence === id) input.failed = true
      if (editorRef.current === editor && input?.sequence === id) setSnapshot(previous => ({ ...previous, error: String(reason) }))
    })
  }
  const save = async () => {
    const editor = editorRef.current
    if (!editor || editor.target !== target || !editable || !room || !tasks.canSave(room)) return false
    setSnapshot(previous => ({ ...previous, busy: true, receipt: '' }))
    try {
      // A refused prior Save may leave the serialized tail rejected. Failed
      // field writes are independently retained in pending and still block Save.
      await editor.current.flush().catch(() => undefined)
      if (editor.pending.size) throw new Error('Some edits could not be written to the Room draft. Retry those fields before saving.')
      const parsed = taskFieldsSchema.safeParse(stateFor(editor))
      if (!parsed.success) throw new Error(parsed.error.issues[0].message)
      if (editorRef.current !== editor || !tasks.canSave(room)) throw new Error('Room reach changed. Your draft is retained.')
      const identifier = await editor.current.commit()
      if (editorRef.current === editor) setSnapshot(previous => ({ ...previous, error: '', receipt: identifier ? 'Changes queued in House.' : 'No changes to save.' }))
      return true
    } catch (reason) {
      if (editorRef.current === editor) setSnapshot(previous => ({ ...previous, error: reason instanceof Error ? reason.message : String(reason) }))
      return false
    } finally { if (editorRef.current === editor) setSnapshot(previous => ({ ...previous, busy: false })) }
  }
  return { values: snapshot.target === target ? snapshot.values : valuesOf(null, row, defaults), setField, save, ready, editable, busy: snapshot.target === target && snapshot.busy, error: snapshot.target === target ? snapshot.error : '', receipt: snapshot.target === target ? snapshot.receipt : '', draft: tasks.drafts.find(draft => draft.room === room && draft.path === path) }
}
export type TaskEditor = ReturnType<typeof useTaskEditor>
