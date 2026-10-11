// Adapted from Circle status-selector.tsx and priority-selector.tsx at b0ba7dd.
// MIT (c) 2025 lndev-ui | Circle Template. See licenses/Circle-MIT.md.
import { useId, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { propertyOptions, type Property } from './options'

export function PropertySelector({ property, value, onChange, disabled = false, showName = false, counts = {} }: {
  property: Property; value: string; onChange(value: string): void; disabled?: boolean; showName?: boolean; counts?: Record<string, number>
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const options = propertyOptions[property], selected = options.find(option => option.id === value), Icon = selected?.icon
  return <div className='*:not-first:mt-2'>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} className={showName ? 'h-8 justify-start gap-2 px-1.5 font-normal' : 'size-7 flex items-center justify-center'} size={showName ? 'sm' : 'icon'} variant='ghost' role='combobox' aria-label={`Set ${property}${selected ? `: ${selected.name}` : ''}`} aria-expanded={open} disabled={disabled}>
          {Icon ? <Icon className='text-muted-foreground size-4'/> : <span className='size-1.5 rounded-full' style={{ backgroundColor: selected?.color }} aria-hidden='true'/>}
          {showName && (selected?.name ?? value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='border-input w-64 min-w-[var(--radix-popper-anchor-width)] p-0' align='start'>
        <Command>
          <CommandInput placeholder={`Set ${property}...`} aria-label={`Search ${property}`}/>
          <CommandList><CommandEmpty>No {property} found.</CommandEmpty><CommandGroup>
            {options.map(item => { const ItemIcon = item.icon; return <CommandItem key={item.id} value={item.id} onSelect={() => { onChange(item.id); setOpen(false) }} className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>{ItemIcon ? <ItemIcon className='text-muted-foreground size-4'/> : <span className='size-1.5 rounded-full' style={{backgroundColor:item.color}}/>}{item.name}</div>
              {value === item.id && <CheckIcon size={16} className='ml-auto'/>}
              {counts[item.id] !== undefined && <span className='text-muted-foreground text-xs'>{counts[item.id]}</span>}
            </CommandItem> })}
          </CommandGroup></CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
}
