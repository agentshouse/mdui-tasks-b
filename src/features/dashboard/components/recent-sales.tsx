import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useWorkspace } from '../../workspace/context'
export function RecentSales() {
  const sales=(useWorkspace().records.find(record=>record.type==='dashboard')?.fields.sales??[]) as {name:string;initials:string;email:string;amount:string}[]
  return <div className='space-y-8'>{sales.map(sale=><div key={sale.email} className='flex items-center gap-4'><Avatar className='h-9 w-9'><AvatarFallback>{sale.initials}</AvatarFallback></Avatar><div className='flex flex-1 flex-wrap items-center justify-between'><div className='space-y-1'><p className='text-sm leading-none font-medium'>{sale.name}</p><p className='text-sm text-muted-foreground'>{sale.email}</p></div><div className='font-medium'>{sale.amount}</div></div></div>)}</div>
}
