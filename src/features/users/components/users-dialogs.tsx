import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter } from '@/components/ui/dialog'
import { SelectDropdown } from '@/components/select-dropdown'
import { DraftSession } from '@/lib/task-draft'
import { useWorkspace,useDocumentDraft,type WorkspaceRecord } from '../../workspace/context'
import { useUsers } from './users-provider'
import { roles } from '../data/data'
export function UsersDialogs(){
  const users=useUsers(),workspace=useWorkspace()
  const record=workspace.records.find(record=>record.path===(users.currentRow?.path??users.draftPath)&&record.room===workspace.room)
  if(users.open==='add'||users.open==='edit')return <UserEditor key={record?.path??users.draftPath} record={record} path={record?.path??users.draftPath??undefined} onClose={()=>users.setOpen(null)}/>
  if(users.open==='delete'&&record)return <DeleteUser record={record} onClose={()=>users.setOpen(null)}/>
  return null
}
function UserEditor({record,path,onClose}:{record?:WorkspaceRecord;path?:string;onClose:()=>void}){
  const draft=useDocumentDraft(record,'workspace-user',path)
  const [validation,setValidation]=useState('')
  const fields=[['firstName','First Name','John'],['lastName','Last Name','Doe'],['username','Username','john_doe'],['email','Email','john.doe@gmail.com'],['phoneNumber','Phone Number','+123456789']]
  const save=async()=>{
    const values=draft.values
    if(fields.some(([name])=>!String(values[name]??'').trim())||!/^\S+@\S+\.\S+$/.test(String(values.email??''))||!roles.some(role=>role.value===values.role)){setValidation('Complete the name, username, email, phone and role. Your incomplete input remains in the Room Draft.');return}
    if(!record){draft.setField('id',path?.split('/').pop()?.replace('.md','')??crypto.randomUUID());draft.setField('createdAt',new Date().toISOString());draft.setField('updatedAt',new Date().toISOString());draft.setField('status',values.status??'active')}
    try{await draft.save();toast.success('Demo user saved to Room.');onClose()}catch(error){setValidation(String(error))}
  }
  return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className='sm:max-w-lg'><DialogHeader className='text-start'><DialogTitle>{record?'Edit User':'Add New User'}</DialogTitle><DialogDescription>Changes apply to this Room’s demo user record. They do not create or change a House account.</DialogDescription></DialogHeader><form id='workspace-user-form' className='max-h-[65vh] space-y-4 overflow-auto p-1' onSubmit={event=>{event.preventDefault();void save()}}><fieldset disabled={!draft.ready||draft.busy} className='space-y-4'>{fields.map(([name,label,placeholder])=><label key={name} className='grid grid-cols-6 items-center gap-4 text-sm font-medium'><span className='col-span-2 text-end'>{label}</span><Input className='col-span-4' autoComplete='off' placeholder={placeholder} value={String(draft.values[name]??'')} onChange={event=>draft.setField(name,event.target.value)}/></label>)}<label className='grid grid-cols-6 items-center gap-4 text-sm font-medium'><span className='col-span-2 text-end'>Role</span><SelectDropdown isControlled defaultValue={String(draft.values.role??'')} className='col-span-4' placeholder='Select a role' items={roles.map(({label,value})=>({label,value}))} onValueChange={value=>draft.setField('role',value)}/></label><label className='grid grid-cols-6 items-center gap-4 text-sm font-medium'><span className='col-span-2 text-end'>Status</span><SelectDropdown isControlled defaultValue={String(draft.values.status??'active')} className='col-span-4' items={['active','inactive','invited','suspended'].map(value=>({label:value,value}))} onValueChange={value=>draft.setField('status',value)}/></label><label className='grid grid-cols-6 items-center gap-4 text-sm font-medium'><span className='col-span-2 text-end'>Password</span><Input className='col-span-4' type='password' disabled placeholder='Account credentials unavailable'/></label><p className='text-xs text-muted-foreground'>Password changes and email invitations are unavailable in this donor demo.</p></fieldset>{(validation||draft.error)&&<p role='alert' className='text-sm text-destructive'>{validation||draft.error}</p>}</form><DialogFooter><Button type='submit' form='workspace-user-form' disabled={!draft.ready||draft.busy}>Save changes</Button></DialogFooter></DialogContent></Dialog>
}
function DeleteUser({record,onClose}:{record:WorkspaceRecord;onClose:()=>void}){
  const workspace=useWorkspace();const [error,setError]=useState('')
  const remove=async()=>{if(!workspace.runtime||!workspace.available())return;try{const result=await workspace.runtime.query({rooms:[record.room],select:{markdown:true}});const current=result.documents.find(item=>item.path===record.path);if(!current?.markdown)throw new Error('The user document is unavailable.');const session=new DraftSession(workspace.runtime,record.room,record.path);if(await session.read())throw new Error('This user has a Room Draft. Save or resolve it before deleting.');await session.stage({removal:{base:current.markdown}});if(!workspace.available())throw new Error('Room reach changed; the draft is retained.');await session.commit();onClose()}catch(error){setError(String(error))}}
  return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent><DialogHeader><DialogTitle>Delete User</DialogTitle><DialogDescription>Delete the demo record for {String(record.fields.username)} from this Room? This does not affect a real account.</DialogDescription></DialogHeader>{error&&<p role='alert'>{error}</p>}<DialogFooter><Button variant='outline' onClick={onClose}>Cancel</Button><Button variant='destructive' onClick={()=>void remove()}>Delete</Button></DialogFooter></DialogContent></Dialog>
}
