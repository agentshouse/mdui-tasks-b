import { useState } from 'react'
import { Monitor, Bell, Palette, Wrench, UserCog } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { WorkspaceHeader } from '@/features/workspace/header'
import { Main } from '@/components/layout/main'
import { SidebarNav } from './components/sidebar-nav'
import { SettingsProfile } from './profile'
import { SettingsAccount } from './account'
import { SettingsAppearance } from './appearance'
import { SettingsNotifications } from './notifications'
import { SettingsDisplay } from './display'
import { SettingsPresentationProvider } from './presentation'

export type SettingsSection = 'profile' | 'account' | 'appearance' | 'notifications' | 'display'
const sidebarNavItems = [
  { title: 'Profile', section: 'profile' as const, icon: <UserCog size={18} /> },
  { title: 'Account', section: 'account' as const, icon: <Wrench size={18} /> },
  { title: 'Appearance', section: 'appearance' as const, icon: <Palette size={18} /> },
  { title: 'Notifications', section: 'notifications' as const, icon: <Bell size={18} /> },
  { title: 'Display', section: 'display' as const, icon: <Monitor size={18} /> },
]
const sections = { profile: SettingsProfile, account: SettingsAccount, appearance: SettingsAppearance, notifications: SettingsNotifications, display: SettingsDisplay }

export function Settings({ section, onSectionChange }: { section?: SettingsSection; onSectionChange?: (value: SettingsSection) => void } = {}) {
  const [localSection, setLocalSection] = useState<SettingsSection>('profile')
  const selected = section ?? localSection
  const changeSection = (value: SettingsSection) => { setLocalSection(value); onSectionChange?.(value) }
  return <SettingsPresentationProvider>
    <WorkspaceHeader />
    <Main id='settings-content' fixed>
      <div className='space-y-0.5'><h1 className='text-2xl font-bold tracking-tight md:text-3xl'>Settings</h1><p className='text-muted-foreground'>Manage the Room’s demo profile and preferences. These are separate from your House account.</p></div>
      <Separator className='my-4 lg:my-6' />
      <div className='flex min-h-0 flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
        <aside className='top-0 lg:sticky lg:w-1/5'><SidebarNav items={sidebarNavItems} section={selected} onSectionChange={changeSection} /></aside>
        <div className='flex min-h-0 w-full overflow-y-hidden p-1'>
          {Object.entries(sections).map(([name, Component]) => <section key={name} aria-label={`${name} settings`} className={name === selected ? 'flex min-h-0 w-full' : 'hidden'} hidden={name !== selected}><Component /></section>)}
        </div>
      </div>
    </Main>
  </SettingsPresentationProvider>
}
