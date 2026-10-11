import { ClipboardList, ListTodo, LayoutDashboard, MessagesSquare, Users, AppWindow, Settings } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'

export type Module = 'dashboard' | 'tasks' | 'chats' | 'users' | 'apps' | 'settings'
const modules = [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { key: 'tasks', label: 'Tasks', icon: ListTodo }, { key: 'chats', label: 'Chats', icon: MessagesSquare }, { key: 'users', label: 'Users', icon: Users }, { key: 'apps', label: 'Apps', icon: AppWindow }, { key: 'settings', label: 'Settings', icon: Settings }] as const
export function AppSidebar({ active, onNavigate }: { active: Module; onNavigate: (module: Module) => void }) {
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible='icon' variant='inset'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <a href='#tasks' onClick={event => { event.preventDefault(); onNavigate('tasks'); setOpenMobile(false) }}>
                <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                  <ClipboardList className='size-4' />
                </div>
                <div className='grid flex-1 text-start text-sm leading-tight'>
                  <span className='truncate font-semibold'>Tasks</span>
                  <span className='truncate text-xs'>Your workspace</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map(item => <SidebarMenuItem key={item.key}>
                <SidebarMenuButton isActive={active === item.key} tooltip={item.label} asChild>
                  <a href={`#${item.key}`} aria-current={active === item.key ? 'page' : undefined} onClick={event => { event.preventDefault(); onNavigate(item.key); setOpenMobile(false) }}>
                    <item.icon /><span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
