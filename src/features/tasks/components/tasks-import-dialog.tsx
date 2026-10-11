import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useTasks } from './tasks-provider'
import { parseTasksCsv } from '../data/csv'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const formSchema = z.object({
  file: z
    .instanceof(FileList)
    .refine((files) => files.length > 0, {
      message: 'Please upload a file.',
    })
    .refine(
      (files) => files?.[0]?.name.toLowerCase().endsWith('.csv'),
      'Please upload csv format.'
    ),
})

type TaskImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TasksImportDialog({
  open,
  onOpenChange,
}: TaskImportDialogProps) {
  const { create, busy } = useTasks()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { file: undefined },
  })

  const fileRef = form.register('file')

  const onSubmit = async () => {
    const file = form.getValues('file')?.[0]
    if (!file) return
    try {
      if (file.size > 1024 * 1024) throw new Error('CSV must be smaller than 1 MB.')
      const values = parseTasksCsv(await file.text())
      if (await create(values)) { onOpenChange(false); form.reset() }
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!busy) { onOpenChange(val); form.reset() }
      }}
    >
      <DialogContent className='gap-2 sm:max-w-sm'>
        <DialogHeader className='text-start'>
          <DialogTitle>Import Tasks</DialogTitle>
          <DialogDescription>
            Import CSV with title, status, label, and priority headers.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id='task-import-form' onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name='file'
              render={() => (
                <FormItem className='my-2'>
                  <FormLabel>File</FormLabel>
                  <FormControl>
                    <Input
                      type='file'
                      accept='text/csv'
                      {...fileRef}
                      className='h-8 py-0'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className='gap-2'>
          <DialogClose asChild>
            <Button variant='outline' disabled={busy}>Close</Button>
          </DialogClose>
          <Button type='submit' form='task-import-form' disabled={busy}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
