import { Header } from '@/components/layout/header'
import { ThemeSwitch } from '@/components/theme-switch'
import { useWorkspace } from './context'
export function WorkspaceHeader() {
  const { error, loading } = useWorkspace()
  return <Header><span className='me-auto text-sm text-muted-foreground'>{loading ? 'Loading…' : 'Workspace'}</span>{error && <span role='alert' className='max-w-md text-sm text-destructive'>{error}</span>}<ThemeSwitch /></Header>
}
