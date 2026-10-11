import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useSettingsPresentation } from '../presentation'
const items = [
  { id: 'recents', label: 'Recents' }, { id: 'home', label: 'Home' }, { id: 'applications', label: 'Applications' },
  { id: 'desktop', label: 'Desktop' }, { id: 'downloads', label: 'Downloads' }, { id: 'documents', label: 'Documents' },
]
export function DisplayForm() {
  const presentation = useSettingsPresentation()
  const [notice, setNotice] = useState('')
  const [invalid, setInvalid] = useState(false)
  const selected = presentation.values.display.items
  return <form className='space-y-8' onSubmit={async event => {
    event.preventDefault(); setNotice('')
    if (!selected.length) { setInvalid(true); return }
    setInvalid(false)
    try { await presentation.update('display', { items: selected }); await presentation.flush(); setNotice('Display preferences saved.') }
    catch { setNotice('Display preferences could not be saved. Try again when House is ready.') }
  }}>
    <fieldset disabled={!presentation.ready} className='space-y-8'>
      <div className='grid gap-2'><div className='mb-4 space-y-2'><Label className='text-base'>Sidebar</Label><p className='text-sm text-muted-foreground'>Select the items you want to display in the sidebar.</p></div>
        {items.map(item => <div key={item.id} className='flex items-start gap-2'><Checkbox id={`display-${item.id}`} checked={selected.includes(item.id)} onCheckedChange={checked => {
          setNotice('')
          void presentation.update('display', { items: checked ? [...selected, item.id] : selected.filter(value => value !== item.id) }).catch(() => undefined)
        }} /><Label htmlFor={`display-${item.id}`} className='font-normal'>{item.label}</Label></div>)}
        {invalid && <p role='alert' className='text-sm text-destructive'>You have to select at least one item.</p>}
      </div>
      <p className='text-sm text-muted-foreground'>These donor display preferences are kept in House Presentation State. File-browser sidebar destinations are not part of this task workspace.</p>
      {presentation.error && <p role='alert' className='text-sm text-destructive'>{presentation.error}</p>}
      {notice && <p role='status' className='text-sm text-muted-foreground'>{notice}</p>}
      <Button type='submit'>Update display</Button>
    </fieldset>
  </form>
}
