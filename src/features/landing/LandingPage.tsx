import { useCallback, useState } from 'react'
import { usePageSeo } from '../../lib/usePageSeo'
import { LandingHeader } from './LandingHeader'
import { LandingFooter } from './LandingFooter'
import { LandingStructuredData } from './LandingStructuredData'
import { StackedSections } from './StackedSections'
import { StoryExperience } from './experience/StoryExperience'
import { LogoIntro } from './intro/LogoIntro'
import { usePageLoaded } from './intro/usePageLoaded'
import { ConceptSection } from './ConceptSection'
import { HowItWorksSection } from './HowItWorksSection'
import { CustomizationSection } from './CustomizationSection'
import { DashboardPreviewSection } from './DashboardPreviewSection'
import { UseCasesSection } from './UseCasesSection'
import { SecuritySection } from './SecuritySection'
import { ProductSection } from './ProductSection'
import { FaqSection } from './FaqSection'
import { FinalCtaSection } from './FinalCtaSection'
import './landing.css'

const TITLE = 'TAGGO — Le T-shirt qui connecte le physique au numérique'
const DESCRIPTION = 'TAGGO transforme ton T-shirt en identité numérique grâce à un QR code personnalisé.'

/**
 * Landing TAGGO : écran de chargement (logomark) → expérience hero 3D pilotée par une timeline
 * unique → sections qui s’empilent au scroll. Le T-shirt 3D est décoratif : tout le contenu
 * essentiel (textes, FAQ, données structurées) est présent dans le HTML.
 */
export function LandingPage() {
  const [shirtReady, setShirtReady] = useState(false)
  const handleReady = useCallback(() => setShirtReady(true), [])
  const pageLoaded = usePageLoaded()

  usePageSeo({ title: TITLE, description: DESCRIPTION, canonicalPath: '/' })

  return (
    <>
      <a className="taggo-skip-link" href="#main">
        Aller au contenu
      </a>
      <LogoIntro ready={shirtReady && pageLoaded} />
      <LandingStructuredData title={TITLE} description={DESCRIPTION} />
      <LandingHeader variant="overlay" />

      <main id="main" className="taggo-landing">
        <StoryExperience onReady={handleReady} />
        <StackedSections>
          <ConceptSection />
          <HowItWorksSection />
          <CustomizationSection />
          <DashboardPreviewSection />
          <UseCasesSection />
          <SecuritySection />
          <ProductSection />
          <FaqSection />
          <FinalCtaSection />
        </StackedSections>
      </main>

      <LandingFooter />
    </>
  )
}
