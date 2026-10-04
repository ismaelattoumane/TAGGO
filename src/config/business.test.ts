import { describe, expect, it } from 'vitest'
import {
  BUSINESS,
  businessValue,
  isPending,
  pendingFields,
  placeholderFor,
  PLACEHOLDER_LABELS,
  type PendingFieldKey,
} from './business'

/**
 * Étape 10 — Source de vérité des informations d'entreprise.
 *
 * Ces tests verrouillent la règle centrale de l'étape : AUCUNE donnée légale,
 * aucun prix, aucun délai, aucun médiateur et aucune certification ne peut être
 * inventé. Tant que TAGGO n'a pas validé une valeur, elle reste `null` et les
 * pages publiques affichent un placeholder identifié.
 */

const CONFIRMED_FIELDS: PendingFieldKey[] = []

const MUST_STAY_UNKNOWN: PendingFieldKey[] = [
  'legalForm',
  'capital',
  'siret',
  'vatNumber',
  'address',
  'phone',
  'director',
  'host',
  'hostAddress',
  'hostPhone',
  'mediator',
  'mediatorWebsite',
  'mediatorContact',
  'returnAddress',
  'material',
  'certifications',
  'sizeGuide',
  'returnPolicy',
  'paymentProvider',
  'paymentMethods',
  'subscriptionPrice',
  'promoCode',
  'deliveryCarrier',
  'productionDelay',
  'deliveryDelayFrance',
  'deliveryDelayEurope',
  'deliveryDelayInternational',
  'freeShippingThreshold',
  'careInstructions',
]

describe('business config', () => {
  it('confirms only the data actually provided in the brief', () => {
    expect(BUSINESS.businessName).toBe('TAGGO')
    expect(BUSINESS.supportEmail).toBe('support-taggo@protonmail.com')
    expect(BUSINESS.primaryMarket).toBe('France')
    expect(CONFIRMED_FIELDS).toHaveLength(0)
  })

  it('keeps every unknown legal or commercial value null', () => {
    for (const key of MUST_STAY_UNKNOWN) {
      expect(BUSINESS[key], `${key} ne doit pas être renseigné`).toBeNull()
      expect(isPending(key)).toBe(true)
    }
  })

  it('never renders an empty string as if it were a real value', () => {
    for (const key of Object.keys(PLACEHOLDER_LABELS) as PendingFieldKey[]) {
      expect(businessValue(key).trim().length).toBeGreaterThan(0)
    }
  })

  it('produces a clearly identified placeholder for unknown values', () => {
    expect(businessValue('siret')).toBe('[À COMPLÉTER — SIRET]')
    expect(businessValue('mediator')).toBe('[À COMPLÉTER — médiateur de la consommation]')
    expect(businessValue('deliveryDelayFrance')).toBe('[À COMPLÉTER — délai de livraison France]')
    expect(placeholderFor('capital')).toBe('[À COMPLÉTER — capital social]')
  })

  it('returns the real value as soon as TAGGO fills the field', () => {
    const original = BUSINESS.siret
    BUSINESS.siret = '123 456 789 00011'
    try {
      expect(businessValue('siret')).toBe('123 456 789 00011')
      expect(isPending('siret')).toBe(false)
    } finally {
      BUSINESS.siret = original
    }
  })

  it('lists every field still to be completed', () => {
    const pending = pendingFields()
    expect(pending).toEqual(expect.arrayContaining(MUST_STAY_UNKNOWN))
    expect(pending).toHaveLength(Object.keys(PLACEHOLDER_LABELS).length)
  })
})