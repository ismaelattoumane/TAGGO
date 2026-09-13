import { useEffect } from 'react'
import { LandingHeader } from './LandingHeader'
import { LandingFooter } from './LandingFooter'
import { StoryCanvas } from './story/StoryCanvas'
import { UseCasesSection } from './UseCasesSection'
import { SecuritySection } from './SecuritySection'
import { FaqSection } from './FaqSection'
import { FinalCtaSection } from './FinalCtaSection'
import './landing.css'

const TITLE = 'TAGGO — Le T-shirt connecté'
const DESCRIPTION =
  'TAGGO : un QR code sur votre T-shirt, un profil public personnalisable, une expérience sociale. Créez votre identité connectée en quelques minutes.'

export function LandingPage() {
  useEffect(() => {
    document.title = TITLE
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (meta) {
      meta.content = DESCRIPTION
    }
  }, [])

  return (
    <>
      <LandingHeader />

      <main className="taggo-landing">
        <StoryCanvas />
        <UseCasesSection />
        <SecuritySection />
        <FaqSection />
        <FinalCtaSection />
      </main>

      <LandingFooter />
    </>
  )
}
