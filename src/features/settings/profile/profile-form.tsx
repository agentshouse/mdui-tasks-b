import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, SaveStatus, useSettingsDraft } from '../components/fields'

const profileFormSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters.').max(30, 'Username must not be longer than 30 characters.'),
  email: z.email('Please select an email to display.'),
  bio: z.string().min(4, 'Bio must be at least 4 characters.').max(160, 'Bio must not be longer than 160 characters.'),
  urls: z.array(z.object({ value: z.url('Please enter a valid URL.') })).optional(),
})
const defaults = { bio: 'I own a computer.', urls: [{ value: 'https://shadcn.com' }, { value: 'http://twitter.com/shadcn' }] }

export function ProfileForm() {
  const form = useSettingsDraft('profile', 'preferences/profile.md', defaults, profileFormSchema)
  const { values, setField, errors } = form
  const urls = Array.isArray(values.urls) ? values.urls as { value: string }[] : []
  const text = (name: string) => typeof values[name] === 'string' ? values[name] as string : ''
  return <form onSubmit={form.submit} noValidate className='space-y-8'>
    <fieldset disabled={!form.ready} className='space-y-8'>
    <Field id='settings-username' label='Username' error={errors.username} description='This is your public display name. It can be your real name or a pseudonym.'>
      <Input id='settings-username' placeholder='shadcn' value={text('username')} onChange={event => setField('username', event.target.value)} aria-invalid={!!errors.username} />
    </Field>
    <Field id='settings-email' label='Email' error={errors.email} description='These donor demo addresses are profile choices. Email verification and account connections are not available in this app.'>
      <Select value={text('email')} onValueChange={value => setField('email', value)}>
        <SelectTrigger id='settings-email' aria-invalid={!!errors.email}><SelectValue placeholder='Select an email to display' /></SelectTrigger>
        <SelectContent>{['m@example.com', 'm@google.com', 'm@support.com'].map(email => <SelectItem key={email} value={email}>{email}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <Field id='settings-bio' label='Bio' error={errors.bio} description='Tell others a little bit about yourself.'>
      <textarea id='settings-bio' placeholder='Tell us a little bit about yourself' className='flex min-h-16 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50' value={text('bio')} onChange={event => setField('bio', event.target.value)} aria-invalid={!!errors.bio} />
    </Field>
    <div className='space-y-2'>
      {urls.map((url, index) => <Field key={index} id={`settings-url-${index}`} label={index === 0 ? 'URLs' : `URL ${index + 1}`} error={errors[`urls.${index}.value`]} description={index === 0 ? 'Add links to your website, blog, or social media profiles.' : undefined}>
        <Input id={`settings-url-${index}`} value={typeof url?.value === 'string' ? url.value : ''} aria-invalid={!!errors[`urls.${index}.value`]} onChange={event => setField('urls', urls.map((current, at) => at === index ? { value: event.target.value } : current))} />
      </Field>)}
      <Button type='button' variant='outline' size='sm' className='mt-2' onClick={() => setField('urls', [...urls, { value: '' }])}>Add URL</Button>
    </div>
    <SaveStatus {...form}>Update profile</SaveStatus>
    </fieldset>
  </form>
}
