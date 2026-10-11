import { z } from 'zod'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Field, SaveStatus, Toggle, useSettingsDraft } from '../components/fields'

const notificationsFormSchema = z.object({
  notificationType: z.enum(['all', 'mentions', 'none'], { error: 'Please select a notification type.' }),
  mobile: z.boolean().optional(), communication_emails: z.boolean().optional(),
  social_emails: z.boolean().optional(), marketing_emails: z.boolean().optional(), security_emails: z.boolean(),
})
const defaults = { communication_emails: false, marketing_emails: false, social_emails: true, security_emails: true }
const emails = [
  { field: 'communication_emails', title: 'Communication emails', description: 'Receive emails about your account activity.' },
  { field: 'marketing_emails', title: 'Marketing emails', description: 'Receive emails about new products, features, and more.' },
  { field: 'social_emails', title: 'Social emails', description: 'Receive emails for friend requests, follows, and more.' },
  { field: 'security_emails', title: 'Security emails', description: 'Receive emails about your account activity and security.' },
]
export function NotificationsForm() {
  const form = useSettingsDraft('notification-preferences', 'preferences/notifications.md', defaults, notificationsFormSchema)
  const { values, setField, errors } = form
  return <form onSubmit={form.submit} noValidate className='space-y-8'>
    <fieldset disabled={!form.ready} className='space-y-8'>
    <Field id='settings-notification-type' label='Notify me about...' error={errors.notificationType}>
      <RadioGroup id='settings-notification-type' value={typeof values.notificationType === 'string' ? values.notificationType : ''} onValueChange={value => setField('notificationType', value)} className='flex flex-col gap-2'>
        {[['all', 'All new messages'], ['mentions', 'Direct messages and mentions'], ['none', 'Nothing']].map(([value, label]) => <div key={value} className='flex items-center gap-2'><RadioGroupItem value={value} id={`notification-${value}`} /><Label htmlFor={`notification-${value}`} className='font-normal'>{label}</Label></div>)}
      </RadioGroup>
    </Field>
    <div><h3 className='mb-4 text-lg font-medium'>Email Notifications</h3><div className='space-y-4'>
      {emails.map(item => <div key={item.field} className='flex flex-row items-center justify-between gap-4 rounded-lg border p-4'>
        <div className='space-y-0.5'><Label htmlFor={`settings-${item.field}`} className='text-base'>{item.title}</Label><p className='text-sm text-muted-foreground'>{item.description}</p></div>
        <Toggle id={`settings-${item.field}`} checked={values[item.field] === true} onCheckedChange={value => setField(item.field, value)} disabled={item.field === 'security_emails'} aria-readonly={item.field === 'security_emails'} />
      </div>)}
    </div></div>
    <div className='flex items-start gap-2'><Checkbox id='settings-mobile' checked={values.mobile === true} onCheckedChange={value => setField('mobile', value === true)} /><div className='space-y-1 leading-none'><Label htmlFor='settings-mobile'>Use different settings for my mobile devices</Label><p className='text-sm text-muted-foreground'>Separate mobile delivery is not configured in this app.</p></div></div>
    <p className='text-sm text-muted-foreground'>These are Room preference records. Saving them does not subscribe you to emails, send messages, or enable device notifications.</p>
    <SaveStatus {...form}>Update notifications</SaveStatus>
    </fieldset>
  </form>
}
