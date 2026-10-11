import { toast } from 'sonner'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import { WorkspaceHeader } from '../workspace/header'
import { useWorkspace } from '../workspace/context'
import { UsersProvider,useUsers } from './components/users-provider'
import { UsersTable } from './components/users-table'
import { UsersDialogs } from './components/users-dialogs'
import type { User } from './data/schema'
export function Users(){return <UsersProvider><UserList/></UsersProvider>}
function UserList(){
 const workspace=useWorkspace(),users=useUsers()
 const data=workspace.records.filter(record=>record.type==='workspace-user').map(record=>({...record.fields,room:record.room,path:record.path}) as User)
 const pending=workspace.drafts.filter(draft=>draft.parts.creation&&'type'in draft.parts.creation&&draft.parts.creation.type==='workspace-user')
 return <><WorkspaceHeader/><Main className='flex flex-1 flex-col gap-4 sm:gap-6'><div className='flex flex-wrap items-end justify-between gap-2'><div><h2 className='text-2xl font-bold tracking-tight'>User List</h2><p className='text-muted-foreground'>Manage the donor demo’s users and their roles here.</p></div><div className='flex gap-2'><Button variant='outline' onClick={()=>toast.info('Email invitations are unavailable in this Room demo.')}>Invite User</Button><Button onClick={()=>{users.setCurrentRow(null);users.setDraftPath(`users/user-${crypto.randomUUID()}.md`);users.setOpen('add')}}>Add User</Button></div></div>{pending.length>0&&<div className='flex flex-wrap gap-2'>{pending.map(draft=><Button key={draft.path} variant='outline' size='sm' onClick={()=>{users.setCurrentRow(null);users.setDraftPath(draft.path);users.setOpen('add')}}>Resume user draft</Button>)}</div>}<UsersTable data={data}/></Main><UsersDialogs/></>
}
