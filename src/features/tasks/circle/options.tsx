// Circle status/priority presentation mapped to the existing Room enums.
import type { ComponentType } from 'react'
import type { TaskFields } from '../data/schema'
import { BacklogIcon, ToDoIcon, InProgressIcon, DoneIcon, CanceledIcon } from './status-icons'
import { LowPriorityIcon, MediumPriorityIcon, HighPriorityIcon, UrgentPriorityIcon } from './priority-icons'
export type Option = { id: string; name: string; color: string; icon?: ComponentType<{ className?: string }> }
export const statuses: Option[] = [
  { id: 'in progress', name: 'In Progress', color: '#facc15', icon: InProgressIcon },
  { id: 'todo', name: 'Todo', color: '#99a2b2', icon: ToDoIcon },
  { id: 'backlog', name: 'Backlog', color: '#95a2b3', icon: BacklogIcon },
  { id: 'done', name: 'Done', color: '#5e6ad2', icon: DoneIcon },
  { id: 'canceled', name: 'Canceled', color: '#95a2b3', icon: CanceledIcon },
]
export const priorities: Option[] = [
  { id: 'critical', name: 'Critical', color: '#eb5757', icon: UrgentPriorityIcon },
  { id: 'high', name: 'High', color: '#8f9299', icon: HighPriorityIcon },
  { id: 'medium', name: 'Medium', color: '#8f9299', icon: MediumPriorityIcon },
  { id: 'low', name: 'Low', color: '#8f9299', icon: LowPriorityIcon },
]
export const labels: Option[] = [
  { id: 'feature', name: 'Feature', color: '#22c55e' },
  { id: 'bug', name: 'Bug', color: '#ef4444' },
  { id: 'documentation', name: 'Documentation', color: '#5e6ad2' },
]
export const propertyOptions = { status: statuses, priority: priorities, label: labels }
export type Property = keyof typeof propertyOptions
export type EditableValues = TaskFields & { notes: string }
