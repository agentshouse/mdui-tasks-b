import { Download, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTasks } from './tasks-provider'

export function TasksPrimaryButtons() {
  const { setOpen, openCreate, busy, loading, error } = useTasks()
  return (
    <div className='flex gap-2'>
      <Button
          disabled={busy || loading || !!error}
        variant='outline'
        className='space-x-1'
        onClick={() => setOpen('import')}
      >
        <span>Import</span> <Download size={18} />
      </Button>
      <Button disabled={busy || loading || !!error} className='space-x-1' onClick={() => openCreate()}>
        <span>Create</span> <Plus size={18} />
      </Button>
    </div>
  )
}
