// Adapted from Circle components/layout/command-palette.tsx at b0ba7dd.
// MIT (c) 2025 lndev-ui | Circle Template. See licenses/Circle-MIT.md.
import { useEffect, useState } from 'react'
import { Check, CircleDot, Layers, Tags, SquarePen, Save, ArrowLeft, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { taskRowIdentity, type Task } from '../data/schema'
import { propertyOptions, type Property } from './options'
import type { TaskEditor } from './use-task-editor'

type PaletteRoute = 'root' | Property
function Keys({ keys }: { keys: string[] }) {
  return <span className='ml-auto flex items-center gap-1'>{keys.map((key, index) => <kbd key={index} className='min-w-5 h-5 px-1 inline-flex items-center justify-center rounded border bg-muted/50 text-[11px] text-muted-foreground font-sans'>{key}</kbd>)}</span>
}
export function CommandPalette({ open, setOpen, tasks, issue, editor, onOpen, onCreate, onBack }: { open: boolean; setOpen(open: boolean): void; tasks: Task[]; issue?: Task; editor?: TaskEditor; onOpen(path: string): void; onCreate(): void; onBack(): void }) {
  const [route, setRoute] = useState<PaletteRoute>('root'), [query, setQuery] = useState(''), [contextCleared, setContextCleared] = useState(false)
  const reset = () => { setRoute('root'); setQuery(''); setContextCleared(false) }
  const close = () => { setOpen(false); reset() }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (location.hash.split('/')[0] !== '#tasks' && location.hash !== '') return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (open) { setRoute('root'); setQuery(''); setContextCleared(false) } setOpen(!open) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])
  const contextual = editor && !contextCleared
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) reset() }}>
    <DialogContent onEscapeKeyDown={event => { if (route !== 'root') { event.preventDefault(); setRoute('root'); setQuery('') } }} showCloseButton={false} className='overflow-hidden p-0 sm:max-w-2xl top-[22%] translate-y-0 gap-0'>
      <DialogTitle className='sr-only'>Command menu</DialogTitle><DialogDescription className='sr-only'>Search tasks or prepare changes to the current task. Save explicitly to queue changes.</DialogDescription>
      <Command className='[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5'>
        {contextual && <div className='flex items-center gap-1.5 px-3 pt-3 pb-1'><span className='inline-flex items-center gap-1.5 max-w-full rounded-md bg-muted/70 border border-border/60 px-2 py-1 text-xs'><span className='text-muted-foreground shrink-0'>{issue?.id ?? 'New task'} ⋅</span><span className='truncate'>{editor.values.title || 'Untitled draft'}</span><button onClick={() => { setContextCleared(true); setRoute('root') }} className='text-muted-foreground hover:text-foreground shrink-0' aria-label='Clear issue context'>⌫</button></span></div>}
        <CommandInput autoFocus placeholder='Type a command or search…' aria-label='Command menu search' value={query} onValueChange={setQuery} onKeyDown={event => {
          if (event.key === 'Escape' && route !== 'root') { event.preventDefault(); event.stopPropagation(); setRoute('root'); setQuery('') }
          if (event.key === 'Backspace' && query === '' && route !== 'root') setRoute('root')
        }}/>
        <CommandList className='max-h-96'><CommandEmpty>No results found.</CommandEmpty>
          {route === 'root' && <>
            {contextual && <CommandGroup heading='Issue'>
              <CommandItem disabled={!editor.editable} onSelect={() => { setRoute('status'); setQuery('') }}><CircleDot/>Change status…</CommandItem>
              <CommandItem disabled={!editor.editable} onSelect={() => { setRoute('priority'); setQuery('') }}><Layers/>Set priority…</CommandItem>
              <CommandItem disabled={!editor.editable} onSelect={() => { setRoute('label'); setQuery('') }}><Tags/>Change label…</CommandItem>
              <CommandItem disabled={!editor.editable || editor.busy} onSelect={() => { void editor.save(); close() }}><Save/>Save changes<Keys keys={['Save']}/></CommandItem>
            </CommandGroup>}
            <CommandGroup heading='Actions'>
              <CommandItem onSelect={() => { close(); onCreate() }}><SquarePen/>Create new issue</CommandItem>
              <CommandItem onSelect={() => { close(); onBack() }}><ArrowLeft/>Back to all issues</CommandItem>
            </CommandGroup>
            <CommandGroup heading='Find an issue'>
              {tasks.map(task => <CommandItem key={taskRowIdentity(task)} value={`${task.id} ${task.title} ${task.path}`} onSelect={() => { close(); onOpen(task.path) }}><Search className='text-muted-foreground'/><span className='text-xs text-muted-foreground shrink-0'>{task.id}</span><span className='truncate'>{task.title}</span></CommandItem>)}
            </CommandGroup>
          </>}
          {route !== 'root' && contextual && <CommandGroup heading={`Set ${route}…`}>
            {propertyOptions[route].map(candidate => { const Icon = candidate.icon; return <CommandItem key={candidate.id} value={candidate.name} disabled={!editor.editable} onSelect={() => { editor.setField(route, candidate.id); close() }}>{Icon ? <Icon/> : <span className='size-2 rounded-full' style={{backgroundColor:candidate.color}}/>}{candidate.name}{editor.values[route] === candidate.id && <Check className='ml-auto size-4'/>}</CommandItem> })}
          </CommandGroup>}
        </CommandList>
      </Command>
    </DialogContent>
  </Dialog>
}
