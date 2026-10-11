import { useState } from 'react'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** Donor-style calendar with an editable raw value. Invalid typing is retained
 * in the Room draft rather than normalized away by a native date input. */
export function DatePicker({ value, onChange, invalid }: { value: string; onChange: (value: string) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(NaN)
  const valid = Number.isFinite(parsed.getTime()) && parsed.getFullYear() === Number(value.slice(0, 4)) && parsed.getMonth() + 1 === Number(value.slice(5, 7)) && parsed.getDate() === Number(value.slice(8))
  const [month, setMonth] = useState(() => valid && parsed.getFullYear() >= 1900 && parsed <= today ? new Date(parsed.getFullYear(), parsed.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1))
  const monthNumber = month.getMonth(), year = month.getFullYear()
  const days = new Date(year, monthNumber + 1, 0).getDate()
  const offset = new Date(year, monthNumber, 1).getDay()
  const key = (day: number) => `${year}-${String(monthNumber + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const lastDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button id='settings-dob' type='button' variant='outline' aria-invalid={invalid} className={cn('w-60 max-w-full justify-start text-start font-normal', !value && 'text-muted-foreground')}>
      <span className='truncate'>{value ? valid ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : value : 'Pick a date'}</span><CalendarIcon className='ms-auto size-4 opacity-50' />
    </Button></PopoverTrigger>
    <PopoverContent className='w-72 space-y-3 p-3'>
      <Input aria-label='Date of birth, YYYY-MM-DD' placeholder='YYYY-MM-DD' value={value} onChange={event => onChange(event.target.value)} aria-invalid={invalid} />
      <div className='flex items-center justify-between gap-2'>
        <Button type='button' variant='ghost' size='icon' aria-label='Previous month' disabled={year <= 1900 && monthNumber === 0} onClick={() => setMonth(new Date(year, monthNumber - 1, 1))}><ChevronLeft /></Button>
        <select aria-label='Month' className='min-w-0 bg-background text-sm' value={monthNumber} onChange={event => setMonth(new Date(year, Number(event.target.value), 1))}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{new Date(2000, index, 1).toLocaleDateString('en-US', { month: 'short' })}</option>)}</select>
        <select aria-label='Year' className='bg-background text-sm' value={year} onChange={event => setMonth(new Date(Number(event.target.value), monthNumber, 1))}>{Array.from({ length: today.getFullYear() - 1899 }, (_, index) => today.getFullYear() - index).map(value => <option key={value} value={value}>{value}</option>)}</select>
        <Button type='button' variant='ghost' size='icon' aria-label='Next month' disabled={year >= today.getFullYear() && monthNumber >= today.getMonth()} onClick={() => setMonth(new Date(year, monthNumber + 1, 1))}><ChevronRight /></Button>
      </div>
      <div className='grid grid-cols-7 gap-1 text-center text-xs'>{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day} className='py-1 text-muted-foreground'>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => index + 1).map(day => <button key={day} type='button' aria-label={key(day)} aria-pressed={value === key(day)} disabled={key(day) > lastDate} className={cn('size-8 rounded-md text-sm hover:bg-accent disabled:opacity-30', value === key(day) && 'bg-primary text-primary-foreground')} onClick={() => { onChange(key(day)); setOpen(false) }}>{day}</button>)}
      </div>
    </PopoverContent>
  </Popover>
}
