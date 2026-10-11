import { useEffect, useMemo, useRef, useState } from 'react'
import { taskDraftSession, taskDraftValues, stageTaskField } from '@/lib/house'
import type { DraftSession } from '@/lib/task-draft'
import { type z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTasks } from './tasks-provider'
import { taskFieldsSchema, type Task } from '../data/schema'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SelectDropdown } from '@/components/select-dropdown'

type TaskMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Task
  draftPath?: string
}

const formSchema = taskFieldsSchema
type TaskForm = z.infer<typeof formSchema>

export function TasksMutateDrawer({
  open,
  onOpenChange,
  currentRow,
  draftPath,
}: TaskMutateDrawerProps) {
  const { room, tasks, drafts, busy, error, loading, canSave } = useTasks()
  const row = currentRow ?? tasks.find(task => task.path === draftPath && task.room === room)
  const isUpdate = !!row
  const session = useRef<DraftSession | null>(null)
  const pending = useRef(new Map<string, number>())
  const [draftError, setDraftError] = useState('')
  const [readyScope, setReadyScope] = useState<string | null>(null)
  const path = row?.path ?? draftPath
  const selectedRoom = row?.room ?? room
  const fallback = useMemo<TaskForm>(() => ({ title: row?.title ?? '', status: row?.status ?? 'todo', label: row?.label ?? 'feature', priority: row?.priority ?? 'medium' }), [row?.title, row?.status, row?.label, row?.priority])

  const form = useForm<TaskForm>({
    resolver: zodResolver(formSchema),
    defaultValues: row ?? {
      title: '',
      status: 'todo',
      label: 'feature',
      priority: 'medium',
    },
  })

  useEffect(() => {
    if (!selectedRoom || !path) return
    let disposed = false
    let unsubscribe: (() => unknown) | undefined
    void taskDraftSession(selectedRoom, path).then(async current => {
      if (disposed) return
      session.current = current
      const redraw = () => {
        const values = taskDraftValues(current.current(), fallback)
        for (const name of Object.keys(values) as (keyof TaskForm)[]) if (!pending.current.has(name)) form.setValue(name, values[name])
      }
      redraw(); unsubscribe = current.subscribe(redraw); await current.read()
      if (!disposed) { redraw(); setReadyScope(`${selectedRoom}:${path}`) }
    }).catch(error => { if (!disposed) setDraftError(error instanceof Error ? error.message : String(error)) })
    return () => { disposed = true; unsubscribe?.(); session.current = null }
  }, [selectedRoom, path, fallback, form])
  useEffect(() => {
    if (session.current && selectedRoom && path) session.current.accept(drafts.find(draft => draft.room === selectedRoom && draft.path === path) ?? null)
  }, [drafts, selectedRoom, path])
  const persist = (name: keyof TaskForm, value: string) => {
    const current = session.current
    if (!current) return
    const sequence = (pending.current.get(name) ?? 0) + 1
    pending.current.set(name, sequence)
    void stageTaskField(current, row, fallback, name, value).then(() => {
      if (pending.current.get(name) === sequence) { pending.current.delete(name); form.setValue(name, taskDraftValues(current.current(), fallback)[name]) }
      setDraftError('')
    }).catch(error => setDraftError(error instanceof Error ? error.message : String(error)))
  }
  const onSubmit = async (_data: TaskForm) => {
    try {
      const current = session.current
      if (!current || !room || room !== selectedRoom || loading || error) return
      await current.flush()
      if (!canSave(selectedRoom)) return
      await current.commit()
      onOpenChange(false)
    } catch (error) { setDraftError(error instanceof Error ? error.message : String(error)) }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!busy) { onOpenChange(v); form.reset() }
      }}
    >
      <SheetContent className='flex flex-col'>
        <SheetHeader className='text-start'>
          <SheetTitle>{isUpdate ? 'Update' : 'Create'} Task</SheetTitle>
          <SheetDescription>
            {isUpdate
              ? 'Update the task by providing necessary info.'
              : 'Add a new task by providing necessary info.'}
            Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        {draftError && <p role='alert' className='px-4 text-sm text-destructive'>{draftError}</p>}
        <Form {...form}>
          <form
            id='tasks-form'
            onSubmit={event => { void form.handleSubmit(onSubmit)(event) }}
            className='flex-1 space-y-6 overflow-y-auto px-4'
          >
            <fieldset disabled={readyScope !== `${selectedRoom}:${path}` || busy || !room || room !== selectedRoom} className='contents'>
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} onChange={event => { field.onChange(event); persist('title', event.target.value) }} placeholder='Enter a title' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='status'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    isControlled
                    onValueChange={value => { field.onChange(value); persist(field.name, value) }}
                    placeholder='Select dropdown'
                    items={[
                      { label: 'In Progress', value: 'in progress' },
                      { label: 'Backlog', value: 'backlog' },
                      { label: 'Todo', value: 'todo' },
                      { label: 'Canceled', value: 'canceled' },
                      { label: 'Done', value: 'done' },
                    ]}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='label'
              render={({ field }) => (
                <FormItem className='relative'>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={value => { field.onChange(value); persist(field.name, value) }}
                      value={field.value}
                      className='flex flex-col space-y-1'
                    >
                      <FormItem className='flex items-center'>
                        <FormControl>
                          <RadioGroupItem value='documentation' />
                        </FormControl>
                        <FormLabel className='font-normal'>
                          Documentation
                        </FormLabel>
                      </FormItem>
                      <FormItem className='flex items-center'>
                        <FormControl>
                          <RadioGroupItem value='feature' />
                        </FormControl>
                        <FormLabel className='font-normal'>Feature</FormLabel>
                      </FormItem>
                      <FormItem className='flex items-center'>
                        <FormControl>
                          <RadioGroupItem value='bug' />
                        </FormControl>
                        <FormLabel className='font-normal'>Bug</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='priority'
              render={({ field }) => (
                <FormItem className='relative'>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={value => { field.onChange(value); persist(field.name, value) }}
                      value={field.value}
                      className='flex flex-col space-y-1'
                    >
                      <FormItem className='flex items-center'><FormControl><RadioGroupItem value='critical' /></FormControl><FormLabel className='font-normal'>Critical</FormLabel></FormItem>
                      <FormItem className='flex items-center'>
                        <FormControl>
                          <RadioGroupItem value='high' />
                        </FormControl>
                        <FormLabel className='font-normal'>High</FormLabel>
                      </FormItem>
                      <FormItem className='flex items-center'>
                        <FormControl>
                          <RadioGroupItem value='medium' />
                        </FormControl>
                        <FormLabel className='font-normal'>Medium</FormLabel>
                      </FormItem>
                      <FormItem className='flex items-center'>
                        <FormControl>
                          <RadioGroupItem value='low' />
                        </FormControl>
                        <FormLabel className='font-normal'>Low</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </fieldset>
          </form>
        </Form>
        <SheetFooter className='gap-2'>
          <SheetClose asChild>
            <Button variant='outline' disabled={busy}>Close</Button>
          </SheetClose>
          <Button form='tasks-form' type='submit' disabled={busy || loading || !!error || readyScope !== `${selectedRoom}:${path}` || !room || room !== selectedRoom}>
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
