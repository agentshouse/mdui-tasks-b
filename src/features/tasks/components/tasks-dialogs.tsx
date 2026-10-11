import { ConfirmDialog } from '@/components/confirm-dialog'
import { TasksImportDialog } from './tasks-import-dialog'
import { TasksMutateDrawer } from './tasks-mutate-drawer'
import { useTasks } from './tasks-provider'

export function TasksDialogs() {
  const { open, setOpen, currentRow, setCurrentRow, remove, busy, editorPath } = useTasks()
  const close = (next: boolean) => { if (!next && !busy) { setOpen(null); setCurrentRow(null) } }
  return <>
    {open === 'create' && <TasksMutateDrawer key={editorPath ?? 'create'} draftPath={editorPath ?? undefined} open onOpenChange={close} />}
    {open === 'import' && <TasksImportDialog key='import' open onOpenChange={close} />}
    {currentRow && open === 'update' && <TasksMutateDrawer key={currentRow.id} currentRow={currentRow} open onOpenChange={close} />}
    {currentRow && open === 'delete' && <ConfirmDialog destructive open onOpenChange={close} isLoading={busy}
      handleConfirm={() => { void remove([currentRow]).then((saved) => { if (saved) { setOpen(null); setCurrentRow(null) } }) }}
      className='max-w-md' title={`Delete this task: ${currentRow.id}?`}
      desc={<>The task <strong>{currentRow.title}</strong> will be removed from its House Room.</>}
      confirmText='Delete' />}
  </>
}
