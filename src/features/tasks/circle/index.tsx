// Circle's AllIssues/GroupedIssuesView composition, adapted at b0ba7dd.
// MIT (c) 2025 lndev-ui | Circle Template. See licenses/Circle-MIT.md.
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, LoaderCircle, Search, SlidersHorizontal, Plus, Download, Upload } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { ThemeSwitch } from '@/components/theme-switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { newTaskDraftPath, taskDraftValues } from '@/lib/house'
import { useTasks } from '../components/tasks-provider'
import { TasksDialogs } from '../components/tasks-dialogs'
import { TasksTable } from '../components/tasks-table'
import { downloadTasks } from '../data/csv'
import { statuses, priorities, labels } from './options'
import { GroupIssues } from './group-issues'
import { IssueDetails } from './issue-details'
import { CommandPalette } from './command-palette'

type Route = { path: string; creation: boolean; status: string } | null
function readRoute(): Route {
  const match = location.hash.match(/^#tasks\/(issue|draft)\/([^?]+)(?:\?(.*))?$/)
  if (!match) return null
  try { return { path: decodeURIComponent(match[2]), creation: match[1] === 'draft', status: new URLSearchParams(match[3]).get('status') ?? 'todo' } } catch { return null }
}
export function CircleTasks() {
  const tasks = useTasks(), [route, setRoute] = useState<Route>(readRoute), [commandOpen, setCommandOpen] = useState(false)
  const [tab, setTab] = useState('all'), [query, setQuery] = useState(''), [priority, setPriority] = useState('all'), [label, setLabel] = useState('all')
  const [ordering, setOrdering] = useState('priority'), [showEmpty, setShowEmpty] = useState(false), [showId, setShowId] = useState(true), [showLabels, setShowLabels] = useState(true), [view, setView] = useState('list')
  useEffect(() => {
    const update = () => { setRoute(readRoute()); setCommandOpen(false) }
    // The retained workspace shell uses pushState, which emits no hash event.
    // Its module anchors explicitly leave an issue route, including Tasks -> Tasks.
    const shellNavigation = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (/^#(?:tasks|dashboard|chats|users|apps|settings)$/.test(anchor?.getAttribute('href') ?? '')) { setRoute(null); setCommandOpen(false) }
    }
    window.addEventListener('hashchange', update); window.addEventListener('popstate', update); document.addEventListener('click', shellNavigation)
    return () => { window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update); document.removeEventListener('click', shellNavigation) }
  }, [])
  const navigate = (next: Route) => { const hash = next ? `#tasks/${next.creation ? 'draft' : 'issue'}/${encodeURIComponent(next.path)}${next.creation ? `?status=${encodeURIComponent(next.status)}` : ''}` : '#tasks'; if (location.hash !== hash) history.pushState(null, '', hash); setRoute(next); setCommandOpen(false) }
  const onOpen = (path: string) => navigate({ path, creation: false, status: 'todo' })
  const onCreate = (status = 'todo') => navigate({ path: newTaskDraftPath(), creation: true, status: statuses.some(item => item.id === status) ? status : 'todo' })
  const onBack = () => navigate(null)
  const scoped = useMemo(() => tasks.tasks.map(task => ({ ...task, ...taskDraftValues(tasks.drafts.find(draft => draft.room === task.room && draft.path === task.path) ?? null, task) })).filter(task => tab === 'all' || tab === 'active' && ['todo', 'in progress'].includes(task.status) || tab === 'backlog' && task.status === 'backlog'), [tasks.tasks, tasks.drafts, tab])
  const visible = useMemo(() => scoped.filter(task => (priority === 'all' || task.priority === priority) && (label === 'all' || task.label === label) && `${task.id} ${task.title}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => ordering === 'title' ? a.title.localeCompare(b.title) : ordering === 'id' ? a.id.localeCompare(b.id) : priorities.findIndex(item => item.id === a.priority) - priorities.findIndex(item => item.id === b.priority)), [scoped, priority, label, query, ordering])
  const groups = statuses.map(group => ({ group, issues: visible.filter(task => task.status === group.id) })).filter(entry => showEmpty || entry.issues.length > 0)
  const disabled = tasks.loading || !!tasks.error || tasks.busy || !tasks.room
  const creations = tasks.drafts.filter(draft => draft.room === tasks.room && draft.parts.creation && 'type' in draft.parts.creation && draft.parts.creation.type === 'task')
  return <>
    <Header fixed className='h-12 border-b [&>div]:gap-2 [&>div]:px-3'><nav aria-label='Task views' className='flex min-w-0 items-center gap-1'>
      {([['active', 'Active'], ['backlog', 'Backlog'], ['all', 'All issues']] as const).map(([value, title]) => <Button key={value} variant='ghost' size='sm' className={`h-7 px-2 rounded-full text-xs ${tab === value && !route ? 'bg-muted' : 'text-muted-foreground'}`} aria-pressed={tab === value && !route} onClick={() => { setTab(value); onBack() }}>{title}</Button>)}
    </nav><div className='ml-auto flex items-center gap-1'><Button variant='ghost' size='icon' className='size-7' aria-label='Open command menu' title='Command menu (Ctrl / ⌘ K)' onClick={() => setCommandOpen(true)}><Search className='size-4'/></Button><ThemeSwitch/></div></Header>
    {tasks.syncLabel && <p role='status' className='border-b px-5 py-2 text-xs text-muted-foreground'>{tasks.syncLabel}</p>}
    {tasks.error && <Alert variant='destructive' role='alert' className='m-3 w-auto'><AlertCircle/><AlertTitle>Tasks could not be loaded</AlertTitle><AlertDescription className='[overflow-wrap:anywhere]'>{tasks.error}</AlertDescription></Alert>}
    <main id='tasks-content' className='min-w-0 flex-1 flex flex-col'>
      {route ? <IssueDetails key={route.path} path={route.path} creation={route.creation} initialStatus={route.status} commandOpen={commandOpen} setCommandOpen={setCommandOpen} onOpen={onOpen} onCreate={onCreate} onBack={onBack}/> : <>
        <div className='border-b flex flex-wrap items-center gap-2 px-3 sm:px-6 py-2'>
          <h1 className='sr-only'>Tasks</h1><div className='relative flex-1 min-w-40 max-w-80'><Search className='absolute left-2.5 top-2 size-4 text-muted-foreground'/><Input value={query} onChange={event => setQuery(event.target.value)} placeholder='Search title or ID...' aria-label='Search tasks' className='h-8 pl-8 text-xs'/></div>
          <label className='sr-only' htmlFor='circle-priority-filter'>Filter priority</label><select id='circle-priority-filter' aria-label='Filter priority' value={priority} onChange={event => setPriority(event.target.value)} className='h-8 rounded-md border bg-background px-2 text-xs'><option value='all'>All priorities</option>{priorities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <label className='sr-only' htmlFor='circle-label-filter'>Filter label</label><select id='circle-label-filter' aria-label='Filter label' value={label} onChange={event => setLabel(event.target.value)} className='h-8 rounded-md border bg-background px-2 text-xs'><option value='all'>All labels</option>{labels.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <Popover><PopoverTrigger asChild><Button variant='outline' size='sm' className='h-8 ml-auto'><SlidersHorizontal className='size-3.5'/>Display</Button></PopoverTrigger><PopoverContent align='end' className='w-64 space-y-3 text-sm'>
            <label className='flex items-center justify-between gap-2'>View<select aria-label='Task view' value={view} onChange={event => setView(event.target.value)} className='rounded border bg-background px-2 py-1'><option value='list'>List</option><option value='table'>Table tools</option></select></label>
            <label className='flex items-center justify-between gap-2'>Order by<select aria-label='Order issues' value={ordering} onChange={event => setOrdering(event.target.value)} className='rounded border bg-background px-2 py-1'><option value='priority'>Priority</option><option value='title'>Title</option><option value='id'>ID</option></select></label>
            {([['Show issue ID', showId, setShowId], ['Show labels', showLabels, setShowLabels], ['Show empty groups', showEmpty, setShowEmpty]] as const).map(([title, checked, change]) => <label key={title} className='flex items-center justify-between gap-2'>{title}<input type='checkbox' checked={checked} onChange={event => change(event.target.checked)}/></label>)}
          </PopoverContent></Popover>
          <Button size='icon' variant='ghost' className='size-8' aria-label='Import tasks' disabled={disabled} onClick={() => tasks.setOpen('import')}><Upload className='size-4'/></Button><Button size='icon' variant='ghost' className='size-8' aria-label='Export visible tasks' disabled={!visible.length} onClick={() => downloadTasks(visible)}><Download className='size-4'/></Button>
          <Button size='sm' className='h-8' disabled={disabled} onClick={() => onCreate()}><Plus className='size-4'/><span>New issue</span></Button>
        </div>
        {creations.length > 0 && <section aria-label='Task drafts' className='flex flex-wrap gap-2 px-5 py-2 border-b'>{creations.map(draft => <Button key={draft.path} variant='outline' size='sm' onClick={() => navigate({ path: draft.path, creation: true, status: 'todo' })}>Draft: {draft.parts.creation && 'fields' in draft.parts.creation ? String(draft.parts.creation.fields.title || 'New task') : 'New task'}</Button>)}</section>}
        {tasks.loading ? <div className='flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground' role='status'><LoaderCircle className='size-4 animate-spin'/>Loading tasks…</div> : !tasks.error && <>
          {view === 'table' ? <div className='p-4'><TasksTable data={tasks.tasks}/></div> : <div className='w-full flex-1 min-w-0'>
            {groups.length === 0 && <div className='flex items-center justify-center h-40 text-sm text-muted-foreground'>No issues to show.</div>}
            {groups.map(({ group, issues }) => <GroupIssues key={group.id} group={group} issues={issues} onOpen={onOpen} onCreate={onCreate} showId={showId} showLabels={showLabels} disabled={disabled}/>)}
            {scoped.length > visible.length && <div className='flex items-center justify-center gap-3 py-4 text-xs text-muted-foreground'><span><span className='font-medium text-foreground'>{scoped.length - visible.length} issues</span> hidden by filters</span><button type='button' onClick={() => { setQuery(''); setPriority('all'); setLabel('all') }} className='hover:text-foreground'>Clear filters</button></div>}
          </div>}
        </>}
        <CommandPalette open={commandOpen} setOpen={setCommandOpen} tasks={tasks.tasks} onOpen={onOpen} onCreate={onCreate} onBack={onBack}/>
      </>}
    </main><TasksDialogs/>
  </>
}
