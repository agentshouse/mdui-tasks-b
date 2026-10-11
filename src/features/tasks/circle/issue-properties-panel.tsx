// Adapted from Circle details/issue-properties-panel.tsx at b0ba7dd.
// MIT (c) 2025 lndev-ui | Circle Template. See licenses/Circle-MIT.md.
import type { ReactNode } from 'react'
import { PropertySelector } from './property-selector'
import { LabelBadge } from './label-badge'
import type { TaskEditor } from './use-task-editor'
function Section({ title, children }: { title: string; children: ReactNode }) { return <div><h3 className='text-xs font-medium text-muted-foreground mb-2'>{title}</h3>{children}</div> }
export function IssuePropertiesPanel({ editor }: { editor: TaskEditor }) {
  return <div className='flex flex-col gap-7'>
    <Section title='Properties'><div className='flex flex-col gap-1.5'>
      <PropertySelector property='status' value={editor.values.status} onChange={value => editor.setField('status', value)} showName disabled={!editor.editable || editor.busy}/>
      <PropertySelector property='priority' value={editor.values.priority} onChange={value => editor.setField('priority', value)} showName disabled={!editor.editable || editor.busy}/>
    </div></Section>
    <Section title='Labels'><div className='flex items-center flex-wrap gap-1.5'><LabelBadge value={editor.values.label}/><PropertySelector property='label' value={editor.values.label} onChange={value => editor.setField('label', value)} showName disabled={!editor.editable || editor.busy}/></div></Section>
    <Section title='Room draft'><p className='text-xs leading-relaxed text-muted-foreground'>Changes are kept in this task’s Room draft as you type. Save queues them locally for House.</p>{editor.draft?.returned && <p role='alert' className='mt-2 text-xs text-destructive'>House returned this draft: {JSON.stringify(editor.draft.returned)}</p>}{editor.draft && Object.keys(editor.draft.changedUnderneath ?? {}).length > 0 && <p role='alert' className='mt-2 text-xs text-destructive'>The saved task changed underneath this draft. Review its preserved changes before saving.</p>}</Section>
    <details className='text-xs text-muted-foreground'><summary className='cursor-pointer'>Available task properties</summary><p className='mt-2 leading-relaxed'>This Room has status, priority, one label and Notes. Assignees, projects, cycles, due dates, sub-issues, activity and linked pull requests aren’t part of its task model.</p></details>
  </div>
}
