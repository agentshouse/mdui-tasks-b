import * as React from 'react'
import { toast } from 'sonner'
import { houseRuntime, observeTaskSession, createTasks, updateTasks, deleteTasks, newTaskDraftPath, type RoomDraft } from '@/lib/house'
import type { Task, TaskFields } from '../data/schema'

type TasksDialogType = 'create' | 'update' | 'delete' | 'import'
type TasksContextType = {
  open: TasksDialogType | null
  setOpen: (value: TasksDialogType | null) => void
  currentRow: Task | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Task | null>>
  tasks: Task[]
  loading: boolean
  error: string | null
  busy: boolean
  syncLabel: string
  room: string | null
  drafts: readonly RoomDraft[]
  editorPath: string | null
  openCreate: (path?: string) => void
  canSave: (room: string) => boolean
  create: (values: TaskFields[]) => Promise<boolean>
  update: (rows: Task[], values: Partial<TaskFields>) => Promise<boolean>
  remove: (rows: Task[]) => Promise<boolean>
}
const TasksContext = React.createContext<TasksContextType | null>(null)
export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState<TasksDialogType | null>(null)
  const [currentRow, setCurrentRow] = React.useState<Task | null>(null)
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [syncLabel, setSyncLabel] = React.useState('')
  const [room, setRoom] = React.useState<string | null>(null)
  const [drafts, setDrafts] = React.useState<readonly RoomDraft[]>([])
  const [editorPath, setEditorPath] = React.useState<string | null>(null)
  const [writeHalted, setWriteHalted] = React.useState(false)
  const mutationLock = React.useRef(false)
  const session = React.useRef<ReturnType<typeof observeTaskSession> | null>(null)
  React.useEffect(() => {
    let canceled = false
    void houseRuntime().then(md => {
      if (canceled) return
      session.current = observeTaskSession(md, value => {
        setTasks(value.tasks); setRoom(value.room); setLoading(value.loading); setError(value.error)
        setSyncLabel(value.syncLabel); setWriteHalted(value.writeHalted); setDrafts(value.drafts)
      })
    }).catch((e: unknown) => { if (!canceled) { setError(e instanceof Error ? e.message : String(e)); setLoading(false) } })
    return () => { canceled = true; session.current?.close(); session.current = null }
  }, [])
  const mutate = async (action: () => Promise<void>) => {
    if (mutationLock.current || loading || error || !room || session.current?.currentRoom() !== room) return false
    mutationLock.current = true; setBusy(true)
    try { await action(); toast.success('Changes queued in House.'); return true }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); return false }
    finally { mutationLock.current = false; setBusy(false) }
  }
  return <TasksContext value={{ room, drafts, editorPath, openCreate: (path) => { setEditorPath(path ?? newTaskDraftPath()); setOpen('create') }, open, setOpen, currentRow, setCurrentRow, tasks, loading, error, busy, syncLabel: writeHalted ? 'House uploads are paused; local drafts remain available' : syncLabel,
    canSave: target => session.current?.currentRoom() === target,
    create: (values) => mutate(async () => createTasks(await houseRuntime(), room!, values, () => session.current?.currentRoom() === room)),
    update: (rows, values) => mutate(async () => updateTasks(await houseRuntime(), rows, values, () => session.current?.currentRoom() === room)),
    remove: (rows) => mutate(async () => deleteTasks(await houseRuntime(), rows, () => session.current?.currentRoom() === room)),
  }}>{children}</TasksContext>
}
// eslint-disable-next-line react-refresh/only-export-components
export const useTasks = () => {
  const value = React.useContext(TasksContext)
  if (!value) throw new Error('useTasks must be used inside TasksProvider')
  return value
}
