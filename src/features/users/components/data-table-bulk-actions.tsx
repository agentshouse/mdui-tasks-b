import { type Table } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DataTableBulkActions as Toolbar } from '@/components/data-table'
import { DraftSession } from '@/lib/task-draft'
import { useWorkspace } from '../../workspace/context'
import type { User } from '../data/schema'
export function DataTableBulkActions({table}:{table:Table<User>}){
  const workspace=useWorkspace()
  const change=async(status:'active'|'inactive')=>{
    if(!workspace.runtime||!workspace.available())return
    try{for(const row of table.getFilteredSelectedRowModel().rows){if(!workspace.available()||workspace.room!==row.original.room)throw new Error('Room reach changed; remaining drafts are retained.');const session=new DraftSession(workspace.runtime,row.original.room,row.original.path);await session.stage({fields:{status:{value:status,base:{value:row.original.status}}}});if(!workspace.available())throw new Error('Room reach changed.');await session.commit()}table.resetRowSelection();toast.success('Demo user statuses saved to Room.')}catch(error){toast.error(String(error))}
  }
  return <Toolbar table={table} entityName='user'><Button variant='outline' size='sm' onClick={()=>toast.info('Email invitations are unavailable. These are donor demo user records.')}>Invite</Button><Button variant='outline' size='sm' onClick={()=>void change('active')}>Activate</Button><Button variant='outline' size='sm' onClick={()=>void change('inactive')}>Deactivate</Button></Toolbar>
}
