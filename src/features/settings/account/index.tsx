import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'

export function SettingsAccount() {
  return (
    <ContentSection
      title='Account'
      desc='Update your account settings and preferred language.'
    >
      <AccountForm />
    </ContentSection>
  )
}
