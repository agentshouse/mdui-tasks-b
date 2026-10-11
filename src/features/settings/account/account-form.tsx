import { useState } from 'react'
import { z } from 'zod'
import { CheckIcon, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Field, SaveStatus, useSettingsDraft } from '../components/fields'
import { cn } from '@/lib/utils'
import { DatePicker } from '../components/date-picker'

const languages = [
  { label: 'English', value: 'en' }, { label: 'French', value: 'fr' }, { label: 'German', value: 'de' },
  { label: 'Spanish', value: 'es' }, { label: 'Portuguese', value: 'pt' }, { label: 'Russian', value: 'ru' },
  { label: 'Japanese', value: 'ja' }, { label: 'Korean', value: 'ko' }, { label: 'Chinese', value: 'zh' },
] as const
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isFinite(parsed.getTime()) && parsed.getFullYear() === Number(value.slice(0, 4)) && parsed.getMonth() + 1 === Number(value.slice(5, 7)) && parsed.getDate() === Number(value.slice(8)) && value >= '1900-01-01' && parsed <= new Date()
}
const accountFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(30, 'Name must not be longer than 30 characters.'),
  dob: z.string().refine(validDate, 'Please enter a valid date of birth (YYYY-MM-DD).'),
  language: z.string().refine(value => languages.some(language => language.value === value), 'Please select a language.'),
})
export function AccountForm() {
  const form = useSettingsDraft('account', 'preferences/account.md', { name: '' }, accountFormSchema)
  const { values, setField, errors } = form
  const [open, setOpen] = useState(false)
  const text = (name: string) => typeof values[name] === 'string' ? values[name] as string : ''
  return <form onSubmit={form.submit} noValidate className='space-y-8'>
    <fieldset disabled={!form.ready} className='space-y-8'>
    <Field id='settings-name' label='Name' error={errors.name} description='This is the name stored in your Room account preferences.'>
      <Input id='settings-name' placeholder='Your name' value={text('name')} onChange={event => setField('name', event.target.value)} aria-invalid={!!errors.name} />
    </Field>
    <Field id='settings-dob' label='Date of birth' error={errors.dob} description='Your date of birth is stored as an account preference.'>
      <DatePicker value={text('dob')} onChange={value => setField('dob', value)} invalid={!!errors.dob} />
    </Field>
    <Field id='settings-language' label='Language' error={errors.language} description='Your language preference is saved. This donor interface currently remains in English.'>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button id='settings-language' type='button' variant='outline' role='combobox' aria-expanded={open} aria-invalid={!!errors.language} className={cn('w-50 justify-between', !values.language && 'text-muted-foreground')}>
          {languages.find(language => language.value === values.language)?.label ?? 'Select language'}<ChevronsUpDown className='ms-2 size-4 shrink-0 opacity-50' />
        </Button></PopoverTrigger>
        <PopoverContent className='w-50 p-0'><Command><CommandInput placeholder='Search language...' /><CommandEmpty>No language found.</CommandEmpty><CommandList><CommandGroup>
          {languages.map(language => <CommandItem value={language.label} key={language.value} onSelect={() => { setField('language', language.value); setOpen(false) }}><CheckIcon className={cn('size-4', language.value === values.language ? 'opacity-100' : 'opacity-0')} />{language.label}</CommandItem>)}
        </CommandGroup></CommandList></Command></PopoverContent>
      </Popover>
    </Field>
    <p className='text-sm text-muted-foreground'>These preferences are saved in this Room. Signing in, password changes, and external account connections are not available here.</p>
    <SaveStatus {...form}>Update account</SaveStatus>
    </fieldset>
  </form>
}
