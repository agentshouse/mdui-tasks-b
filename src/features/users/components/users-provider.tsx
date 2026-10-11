import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import type { User } from '../data/schema'
type Dialog = 'add'|'edit'|'delete'|'invite'|null
type ContextValue = {open:Dialog;setOpen:Dispatch<SetStateAction<Dialog>>;currentRow:User|null;setCurrentRow:Dispatch<SetStateAction<User|null>>;draftPath:string|null;setDraftPath:Dispatch<SetStateAction<string|null>>}
const Context=createContext<ContextValue|null>(null)
export function UsersProvider({children}:{children:ReactNode}){const [open,setOpen]=useState<Dialog>(null);const [currentRow,setCurrentRow]=useState<User|null>(null);const [draftPath,setDraftPath]=useState<string|null>(null);return <Context value={{open,setOpen,currentRow,setCurrentRow,draftPath,setDraftPath}}>{children}</Context>}
// eslint-disable-next-line react-refresh/only-export-components
export function useUsers(){const value=useContext(Context);if(!value)throw new Error('UsersProvider is required');return value}
