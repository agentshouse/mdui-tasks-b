import { useEffect, useState } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { AppSidebar, type Module } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'
import { Tasks } from '@/features/tasks'
import { Dashboard } from '@/features/dashboard'
import { Chats } from '@/features/chats'
import { Users } from '@/features/users'
import { Apps } from '@/features/apps'
import { Settings } from '@/features/settings'
import { WorkspaceProvider } from '@/features/workspace/context'
const modules: Module[] = ['dashboard','tasks','chats','users','apps','settings']
function currentModule(): Module { const path=location.hash.slice(1).split('/')[0];return modules.includes(path as Module)?path as Module:'tasks' }
export function App() {
  const [active,setActive]=useState<Module>(currentModule)
  useEffect(()=>{const update=()=>setActive(currentModule());window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update)},[])
  const navigate=(module:Module)=>{setActive(module);if(location.hash!==`#${module}`)history.pushState(null,'',`#${module}`)}
  useEffect(()=>{const update=()=>setActive(currentModule());window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update)},[])
  return <WorkspaceProvider><SidebarProvider><SkipToMain/><AppSidebar active={active} onNavigate={navigate}/><SidebarInset className='min-w-0 @container/content has-data-[layout=fixed]:h-svh peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'>
    <div id='content' className='contents'>
      <section data-module='dashboard' hidden={active!=='dashboard'} className='min-h-0 flex-1 flex-col'><Dashboard/></section>
      <section data-module='tasks' hidden={active!=='tasks'} className='min-h-0 flex-1 flex-col'><Tasks/></section>
      <section data-module='chats' hidden={active!=='chats'} className='h-full min-h-0 flex-1 flex-col'><Chats/></section>
      <section data-module='users' hidden={active!=='users'} className='min-h-0 flex-1 flex-col'><Users/></section>
      <section data-module='apps' hidden={active!=='apps'} className='min-h-0 flex-1 flex-col'><Apps/></section>
      <section data-module='settings' hidden={active!=='settings'} className='min-h-0 flex-1 flex-col'><Settings/></section>
    </div>
  </SidebarInset><Toaster richColors closeButton/></SidebarProvider></WorkspaceProvider>
}
