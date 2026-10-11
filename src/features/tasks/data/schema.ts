import { z } from 'zod'

export const taskFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(500),
  status: z.enum(['backlog', 'todo', 'in progress', 'done', 'canceled']),
  label: z.enum(['bug', 'feature', 'documentation']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
})
export const taskSchema = taskFieldsSchema.extend({ id: z.string() })
export type TaskFields = z.infer<typeof taskFieldsSchema>
export type Task = z.infer<typeof taskSchema> & { room: string; path: string; notes?: string }

// Displayed donor task IDs are not guaranteed unique. Room document identity is.
export function taskRowIdentity(task: Pick<Task, 'room' | 'path'>) {
  return JSON.stringify([task.room, task.path])
}
