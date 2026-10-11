import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDocumentDraft, useWorkspace, type WorkspaceRecord } from '../../workspace/context'
function newPath() { return `messages/message-${crypto.randomUUID()}.md` }
export function ChatComposer({ record }: { record: WorkspaceRecord }) {
  const workspace = useWorkspace()
  const conversation = String(record.fields.id)
  const unfinished = workspace.drafts.filter(draft => draft.room === record.room && draft.parts.creation && 'type' in draft.parts.creation && draft.parts.creation.type === 'chat-message' && draft.parts.creation.fields.conversation === conversation)
  const [path, setPath] = useState(() => unfinished[0]?.path ?? newPath())
  const selected = unfinished.find(draft => draft.path === path) ?? unfinished[0]
  const editorPath = selected?.path ?? path
  const sent = workspace.records.find(item => item.room === record.room && item.path === editorPath)
  const [timestamp] = useState(() => new Date().toISOString())
  const draft = useDocumentDraft(sent, 'chat-message', editorPath, { conversation, sender: 'Room member', timestamp })
  const [validation, setValidation] = useState('')
  useEffect(() => { let disposed = false; if (sent) queueMicrotask(() => { if (!disposed) setPath(newPath()) }); return () => { disposed = true } }, [sent])
  const text = typeof draft.values.message === 'string' && !sent ? draft.values.message : ''
  const send = async () => {
    if (!text.trim()) { setValidation('Type a message before sending.'); return }
    try { await draft.save(); setPath(newPath()); setValidation(''); toast.success('Message saved to the Room.') }
    catch (error) { setValidation(String(error)) }
  }
  return <div className='space-y-2'>
    <form className='flex w-full flex-none gap-2' onSubmit={event => { event.preventDefault(); void send() }}>
      <div className='flex flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 py-1 focus-within:ring-1 focus-within:ring-ring'>
        <label className='flex-1'><span className='sr-only'>Chat Text Box</span><input className='h-8 w-full bg-inherit focus-visible:outline-hidden' placeholder='Type your messages...' value={text} disabled={!draft.ready || Boolean(sent)} onChange={event => draft.setField('message', event.target.value)} /></label>
        <Button variant='ghost' size='icon' aria-label='Send to Room' title='Send to everyone in this Room' disabled={!draft.ready || draft.busy || !workspace.available()}><Send size={20} /></Button>
      </div>
      <Button className='sm:hidden' disabled={!draft.ready || draft.busy || !workspace.available()}><Send size={18} /> Send</Button>
    </form>
    <p className='text-xs text-muted-foreground'>Send shares this message with everyone in this Room. Calls and external chat delivery are unavailable.</p>
    {(draft.error || validation) && <p role='alert' className='text-sm text-destructive'>{draft.error || validation}</p>}
  </div>
}
