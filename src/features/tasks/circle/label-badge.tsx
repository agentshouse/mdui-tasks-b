// Adapted from Circle components/common/issues/label-badge.tsx at b0ba7dd.
// MIT (c) 2025 lndev-ui | Circle Template. See licenses/Circle-MIT.md.
import { Badge } from '@/components/ui/badge'
import { labels } from './options'
export function LabelBadge({ value }: { value: string }) {
  const label = labels.find(item => item.id === value)
  return <Badge variant='outline' className='gap-1.5 rounded-full text-muted-foreground bg-background'>
    <span className='size-1.5 rounded-full' style={{backgroundColor:label?.color}} aria-hidden='true'/>{label?.name ?? value}
  </Badge>
}
