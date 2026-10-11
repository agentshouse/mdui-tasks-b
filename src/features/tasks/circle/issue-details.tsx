// Adapted from Circle details/issue-details.tsx at b0ba7dd.
// MIT (c) 2025 lndev-ui | Circle Template. See licenses/Circle-MIT.md.
import { useState } from 'react'
import { ChevronUp, ChevronDown, ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTasks } from '../components/tasks-provider'
import { IssuePropertiesPanel } from './issue-properties-panel'
import { CommandPalette } from './command-palette'
import { useTaskEditor } from './use-task-editor'
export function IssueDetails({ path, creation, initialStatus, commandOpen, setCommandOpen, onOpen, onCreate, onBack }: { path: string; creation: boolean; initialStatus: string; commandOpen: boolean; setCommandOpen(open: boolean): void; onOpen(path: string): void; onCreate(): void; onBack(): void }) {
  const tasks = useTasks(), row = tasks.tasks.find(task => task.path === path)
  const [openedRoom, setOpenedRoom] = useState(row?.room ?? tasks.room)
  // Capture only the first admitted Room, including first-sync after reload.
  // Once captured, temporary loss or a replacement never retargets this editor.
  if (openedRoom === null && tasks.room) setOpenedRoom(tasks.room)
  const editor = useTaskEditor(openedRoom ?? tasks.room, path, row, initialStatus)
  const index = tasks.tasks.findIndex(task => task.path === path)
  if (!row && !creation && !tasks.loading && !tasks.error) return <div className='flex flex-col items-center justify-center min-h-80 gap-3 text-sm text-muted-foreground'><p>This task is not available in the current Room.</p><Button variant='outline' onClick={onBack}>Back to issues</Button></div>
  return <div data-task-detail={path} className='w-full min-w-0 flex flex-1 flex-col'>
    <div className='flex items-center gap-2 h-11 shrink-0 border-b px-3 sm:px-6'>
      <Button size='icon' variant='ghost' className='size-7' aria-label='Back to issues' onClick={onBack}><ArrowLeft className='size-4'/></Button>
      <span className='text-xs text-muted-foreground shrink-0'>{row?.id ?? 'New task'}</span><span className='truncate text-sm'>{editor.values.title || 'Untitled draft'}</span>
      <div className='ml-auto flex items-center gap-1 shrink-0'>{index >= 0 && <><span className='text-xs text-muted-foreground hidden sm:inline'>{index + 1} / {tasks.tasks.length}</span><Button variant='ghost' size='icon' className='size-7' aria-label='Previous issue' disabled={index === 0} onClick={() => onOpen(tasks.tasks[index-1].path)}><ChevronUp className='size-4'/></Button><Button variant='ghost' size='icon' className='size-7' aria-label='Next issue' disabled={index === tasks.tasks.length-1} onClick={() => onOpen(tasks.tasks[index+1].path)}><ChevronDown className='size-4'/></Button></>}
      <Button size='sm' disabled={!editor.editable || editor.busy} onClick={() => { void editor.save() }}>Save changes</Button></div>
    </div>
    <div className='w-full flex-1 flex flex-col lg:flex-row min-w-0'>
      <div className='flex-1 min-w-0'>
        <div className='max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-10'>
          <fieldset disabled={!editor.editable || editor.busy} className='min-w-0'>
            <label className='sr-only' htmlFor='circle-issue-title'>Title</label><textarea id='circle-issue-title' name='title' rows={2} value={editor.values.title} onChange={event => editor.setField('title', event.target.value)} placeholder='Issue title' className='w-full resize-y text-3xl font-semibold leading-tight text-balance bg-transparent border-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-20' aria-label='Title'/>
            <div className='mt-6'><label htmlFor='circle-issue-notes' className='text-sm font-medium'>Description</label><textarea id='circle-issue-notes' name='notes' rows={12} value={editor.values.notes} onChange={event => editor.setField('notes', event.target.value)} placeholder='Add a description…' className='mt-3 w-full resize-y rounded bg-transparent text-sm leading-7 border-0 outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-56' aria-label='Description'/></div>
          </fieldset>
          {editor.error && <p role='alert' className='mt-4 text-sm text-destructive'>{editor.error}</p>}{editor.receipt && <p role='status' className='mt-4 text-sm text-muted-foreground'>{editor.receipt}</p>}
          <div className='border-t border-border/60 mt-8 pt-4 flex flex-wrap items-center gap-2'><Button variant='outline' onClick={onBack}>Close</Button>{row && <Button variant='ghost' className='text-destructive' disabled={!editor.editable || editor.busy} onClick={() => { tasks.setCurrentRow(row); tasks.setOpen('delete') }}><Trash2 className='size-4'/>Delete task</Button>}<span className='text-xs text-muted-foreground'>Description is the task’s existing Notes section.</span></div>
        </div>
      </div>
      <aside aria-label='Issue properties' className='lg:w-72 xl:w-80 shrink-0 border-t lg:border-t-0 lg:border-l bg-background px-5 py-6'><IssuePropertiesPanel editor={editor}/></aside>
    </div>
    <CommandPalette open={commandOpen} setOpen={setCommandOpen} tasks={tasks.tasks} issue={row} editor={editor} onOpen={onOpen} onCreate={onCreate} onBack={onBack}/>
  </div>
}
