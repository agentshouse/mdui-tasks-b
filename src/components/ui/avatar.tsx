import { createContext, useContext, useState, type HTMLAttributes, type ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
const Context=createContext({loaded:false,setLoaded:(_loaded:boolean)=>{}})
export function Avatar({className,...props}:HTMLAttributes<HTMLSpanElement>){const [loaded,setLoaded]=useState(false);return <Context value={{loaded,setLoaded}}><span className={cn('relative flex size-10 shrink-0 overflow-hidden rounded-full',className)} {...props}/></Context>}
export function AvatarImage({src,className,...props}:ImgHTMLAttributes<HTMLImageElement>){const {setLoaded}=useContext(Context); if(!src || !src.startsWith('./')) return null; return <img loading='lazy' src={src} onLoad={()=>setLoaded(true)} className={cn('aspect-square size-full',className)} {...props}/>}
export function AvatarFallback({className,...props}:HTMLAttributes<HTMLSpanElement>){const {loaded}=useContext(Context);return loaded?null:<span className={cn('flex size-full items-center justify-center rounded-full bg-muted',className)} {...props}/>}
