// Circle group-issues.tsx, list branch, adapted at b0ba7dd.
// MIT (c) 2025 lndev-ui | Circle Template. See licenses/Circle-MIT.md.
import { Plus, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { taskRowIdentity, type Task } from '../data/schema'
import type { Option } from './options'
import { IssueLine } from './issue-line'
export function GroupIssues({ group, issues, onOpen, onCreate, showId, showLabels, disabled }: { group: Option; issues: Task[]; onOpen(path: string): void; onCreate(status?: string): void; showId: boolean; showLabels: boolean; disabled: boolean }) {
  const [expanded, setExpanded] = useState(true), Icon = group.icon
  return <section data-task-group={group.id} data-group-count={issues.length} aria-label={`${group.name} issues`}>
    <div className='sticky top-0 z-10 bg-background w-full h-10'>
      <div className='w-full h-full flex items-center justify-between px-3 sm:px-6' style={{ backgroundColor: `${group.color}08` }}>
        <button type='button' aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className='flex items-center gap-2 min-w-0'>
          <ChevronDown className={`size-3 text-muted-foreground ${expanded ? '' : '-rotate-90'}`}/>{Icon && <Icon/>}<span className='text-sm font-medium'>{group.name}</span><span className='text-sm text-muted-foreground'>{issues.length}</span>
        </button>
        <Button className='size-6' size='icon' variant='ghost' aria-label={`Create issue in ${group.name}`} disabled={disabled} onClick={() => onCreate(group.id)}><Plus className='size-4'/></Button>
      </div>
    </div>
    {expanded && <div className='space-y-0'>{issues.map(issue => <IssueLine key={taskRowIdentity(issue)} issue={issue} onOpen={onOpen} showId={showId} showLabels={showLabels}/>)}</div>}
  </section>
}
