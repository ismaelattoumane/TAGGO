import { useMemo } from 'react'
import { BUSINESS } from '../../config/business'
import { FAQ_ITEMS } from './landingFaqItems'
import { buildLandingJsonLd, serializeJsonLd } from './landingStructuredData'

type LandingStructuredDataProps = { title: string; description: string }

export function LandingStructuredData({ title, description }: LandingStructuredDataProps) {
  const json = useMemo(
    () =>
      serializeJsonLd(
        buildLandingJsonLd({
          origin: window.location.origin,
          title,
          description,
          supportEmail: BUSINESS.supportEmail,
          faq: FAQ_ITEMS,
        }),
      ),
    [title, description],
  )
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
