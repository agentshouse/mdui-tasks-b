import { useWorkspace } from '../../workspace/context'
export function Overview() {
  const data = (useWorkspace().records.find(record => record.type === 'dashboard')?.fields.overview ?? []) as {name:string;total:number}[]
  const max = Math.max(1,...data.map(item=>item.total))
  return <div className='flex h-87.5 items-end gap-2 px-4 pb-6' role='img' aria-label='Monthly revenue overview'>{data.map(item=><div key={item.name} className='flex h-full min-w-0 flex-1 flex-col justify-end gap-2 text-center'><div title={`${item.name}: $${item.total}`} aria-label={`${item.name}: $${item.total}`} className='rounded-t bg-primary' style={{height:`${item.total/max*90}%`}}/><span className='text-xs text-muted-foreground'>{item.name}</span></div>)}</div>
}
