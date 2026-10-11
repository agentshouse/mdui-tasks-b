import { useState, type FormEvent, type ReactNode } from 'react'
import type { z } from 'zod'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useWorkspace, useDocumentDraft } from '@/features/workspace/context'

type DraftDefaults = Record<string, unknown>
/** Invalid and incomplete input is written into the real document draft. Only
 * an explicit submission validates it and asks the Runtime to Save. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSettingsDraft(type: string, path: string, _defaults: DraftDefaults, schema: z.ZodType) {
  const { records, available, loading } = useWorkspace()
  const record = records.find(item => item.path === path && item.type === type) ?? records.find(item => item.type === type)
  const draft = useDocumentDraft(record)
  const values = record ? draft.values : {}
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const setField = (name: string, value: unknown) => { setNotice(''); draft.setField(name, value) }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || draft.busy) return
    setNotice('')
    if (!record) { setNotice('This Settings record is missing. Import the donor workspace before editing it.'); return }
    const checked = schema.safeParse(values)
    if (!checked.success) {
      setErrors(Object.fromEntries(checked.error.issues.map(issue => [issue.path.join('.'), issue.message])))
      return
    }
    setErrors({}); setSaving(true)
    try {
      await draft.save()
      setNotice('Saved to House. Provider synchronization is managed by House.')
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
    finally { setSaving(false) }
  }
  return { ...draft, values, setField, submit, errors, notice, ready: Boolean(record) && draft.ready, error: !record && !loading ? 'This Settings record is missing. Import the donor workspace before editing it.' : draft.error, busy: draft.busy || saving, canSave: Boolean(record) && draft.ready && available() }
}

export function Field({ id, label, description, error, children, className }: { id: string; label: string; description?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-2', className)}>
    <Label htmlFor={id} className={error ? 'text-destructive' : ''}>{label}</Label>
    {children}
    {description && <p id={`${id}-description`} className='text-sm text-muted-foreground'>{description}</p>}
    {error && <p id={`${id}-error`} role='alert' className='text-sm text-destructive'>{error}</p>}
  </div>
}

export function SaveStatus({ busy, canSave, error, notice, children }: { busy: boolean; canSave: boolean; error: string | null; notice: string; children: ReactNode }) {
  return <div className='space-y-3'>
    {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
    {notice && <p role='status' className='text-sm text-muted-foreground'>{notice}</p>}
    <Button type='submit' disabled={busy || !canSave}>{busy ? 'Saving…' : children}</Button>
  </div>
}

export function Toggle({ checked, onCheckedChange, className, ...props }: Omit<React.ComponentProps<'button'>, 'onChange'> & { checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <button type='button' role='switch' aria-checked={checked} data-state={checked ? 'checked' : 'unchecked'} onClick={() => onCheckedChange(!checked)} className={cn('peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input', className)} {...props}>
    <span className={cn('pointer-events-none block size-4 rounded-full bg-background ring-0 transition-transform', checked ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0')} />
  </button>
}
