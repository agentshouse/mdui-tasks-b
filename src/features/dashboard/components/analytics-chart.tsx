import { useWorkspace } from '../../workspace/context'
export function AnalyticsChart() {
  const data = (useWorkspace().records.find(record=>record.type==='dashboard')?.fields.traffic ?? []) as {name:string;clicks:number;uniques:number}[]
  const max=Math.max(1,...data.map(item=>Math.max(item.clicks,item.uniques)))
  const points=(field:'clicks'|'uniques')=>data.map((item,i)=>`${40+i*90},${260-item[field]/max*230}`).join(' ')
  return <svg viewBox='0 0 620 300' className='h-75 w-full' role='img' aria-label='Weekly clicks and unique visitors'><polygon points={`40,260 ${points('clicks')} 580,260`} className='fill-primary/15'/><polyline points={points('clicks')} fill='none' className='stroke-primary' strokeWidth='3'/><polyline points={points('uniques')} fill='none' className='stroke-muted-foreground' strokeWidth='2'/>{data.map((item,i)=><g key={item.name}><title>{`${item.name}: ${item.clicks} clicks, ${item.uniques} unique visitors`}</title><text x={40+i*90} y='285' textAnchor='middle' className='fill-muted-foreground text-xs'>{item.name}</text></g>)}</svg>
}
