import type { JSX } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SettingsSection } from '..'

type SidebarNavProps = {
  items: { section: SettingsSection; title: string; icon: JSX.Element }[]
  section: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}
export function SidebarNav({ items, section, onSectionChange }: SidebarNavProps) {
  return <>
    <div className='p-1 md:hidden'><Select value={section} onValueChange={value => onSectionChange(value as SettingsSection)}>
      <SelectTrigger className='h-12 sm:w-48' aria-label='Settings section'><SelectValue placeholder='Settings section' /></SelectTrigger>
      <SelectContent>{items.map(item => <SelectItem key={item.section} value={item.section}><div className='flex gap-x-4 px-2 py-1'><span className='scale-125'>{item.icon}</span><span className='text-md'>{item.title}</span></div></SelectItem>)}</SelectContent>
    </Select></div>
    <div className='hidden w-full min-w-40 overflow-x-auto bg-background px-1 py-2 md:block'>
      <nav aria-label='Settings sections' className='flex space-x-2 py-1 lg:flex-col lg:space-y-1 lg:space-x-0'>
        {items.map(item => <button key={item.section} type='button' aria-current={section === item.section ? 'page' : undefined} onClick={() => onSectionChange(item.section)} className={cn(buttonVariants({ variant: 'ghost' }), section === item.section ? 'bg-muted hover:bg-accent' : 'hover:bg-accent hover:underline', 'justify-start')}><span className='me-2'>{item.icon}</span>{item.title}</button>)}
      </nav>
    </div>
  </>
}
