// Adapted from Circle components/common/issues/issue-line.tsx at b0ba7dd.
// MIT (c) 2025 lndev-ui | Circle Template. See licenses/Circle-MIT.md.
import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Task } from '../data/schema'
import { LabelBadge } from './label-badge'
import { PropertySelector } from './property-selector'
import { useTaskEditor } from './use-task-editor'

export function IssueLine({ issue, onOpen, showId, showLabels }: { issue: Task; onOpen(path: string): void; showId: boolean; showLabels: boolean }) {
  const editor = useTaskEditor(issue.room, issue.path, issue)
  const [expanded, setExpanded] = useState(false)
  return <div data-task-path={issue.path}>
    <div className='w-full flex items-center justify-start min-h-11 px-3 sm:px-6 hover:bg-sidebar/50'>
      <div className='flex items-center gap-0.5 shrink-0'>
        <PropertySelector property='priority' value={editor.values.priority} onChange={value => editor.setField('priority', value)} disabled={!editor.editable || editor.busy}/>
        {showId && <span className='text-sm hidden sm:inline-block text-muted-foreground font-medium w-[84px] truncate shrink-0 mr-0.5' title={issue.id}>{issue.id}</span>}
        <PropertySelector property='status' value={editor.values.status} onChange={value => editor.setField('status', value)} disabled={!editor.editable || editor.busy}/>
      </div>
      <a href={`#tasks/issue/${encodeURIComponent(issue.path)}`} onClick={event => { event.preventDefault(); onOpen(issue.path) }} className='min-w-0 flex-1 flex items-center justify-start mr-1 ml-0.5 py-2 focus-visible:ring-2 focus-visible:ring-ring rounded'>
        <span className='text-xs sm:text-sm font-medium sm:font-semibold truncate' title={editor.values.title}>{editor.values.title || 'Untitled draft'}</span>
      </a>
      <div className='flex items-center justify-end gap-2 ml-auto sm:w-fit shrink-0'>
        {showLabels && <div className='items-center justify-end hidden sm:flex'><LabelBadge value={editor.values.label}/></div>}
        {editor.draft && <Button size='sm' variant='ghost' className='h-7 px-2 text-xs' onClick={() => { setExpanded(true); void editor.save() }} disabled={!editor.editable || editor.busy} aria-label={`Save changes to ${issue.id}`}><Save className='size-3'/><span className='hidden sm:inline'>Save</span></Button>}
      </div>
    </div>
    {editor.error && <p role='alert' className='px-6 py-1 text-xs text-destructive'>{editor.error} <button className='underline' onClick={() => onOpen(issue.path)}>Open issue</button></p>}
    {expanded && editor.receipt && <p role='status' className='px-6 py-1 text-xs text-muted-foreground'>{editor.receipt}</p>}
  </div>
}
