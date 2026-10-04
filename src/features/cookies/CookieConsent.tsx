import { useEffect, useRef, useState } from 'react'
import { COOKIE_CATEGORIES } from '../../content/legal/cookies'
import type { CookieCategoryId } from '../../content/legal/cookies'
import {
  acceptAllCookieConsent,
  buildCookieConsent,
  readCookieConsent,
  rejectAllCookieConsent,
  writeCookieConsent,
  type CookieConsentState,
} from './cookieConsent'
import './CookieConsent.css'

function getLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export type CookieConsentProps = {
  /** Injectable pour les tests. Par défaut le consentement déjà stocké. */
  initialState?: CookieConsentState | null
}

/**
 * ÉTAPE 10 — Bandeau et panneau de gestion du consentement cookies.
 *
 * Accessibilité :
 * - région `aria-label` + `aria-live` pour annoncer les changements d'état ;
 * - le panneau personnalisé est un `dialog` avec un titre relié par
 *   `aria-labelledby`, piège de focus sur Tab et restitution du focus ;
 * - chaque case à cocher a une étiquette liée et une description ;
 * - les boutons ont des libellés explicites.
 *
 * Aucun traceur n'est installé par ce composant : il ne fait qu'enregistrer un
 * choix utilisateur.
 */
export function CookieConsent({ initialState }: CookieConsentProps) {
  const storage = getLocalStorage()
  const [state, setState] = useState<CookieConsentState | null>(
    initialState !== undefined ? initialState : readCookieConsent(storage),
  )
  const [customizing, setCustomizing] = useState(false)
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const decided = state !== null && state.decidedAt !== null

  useEffect(() => {
    if (!customizing) return

    const panel = panelRef.current
    if (!panel) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusable = panel.querySelector<HTMLElement>('button, input, [href]')
    focusable?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setCustomizing(false)
        previouslyFocused?.focus()
        return
      }

      if (event.key !== 'Tab') return

      const items = Array.from(
        panel.querySelectorAll<HTMLElement>('button, input, [href]'),
      ).filter((element) => !element.hasAttribute('disabled'))
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [customizing])

  function persist(next: CookieConsentState) {
    writeCookieConsent(storage, next)
    setState(next)
  }

  function openCustomize() {
    setDraft({
      preferences: state?.preferences ?? false,
      analytics: state?.analytics ?? false,
      marketing: state?.marketing ?? false,
    })
    setCustomizing(true)
  }

  function saveDraft() {
    persist(buildCookieConsent(draft, new Date().toISOString()))
    setCustomizing(false)
    triggerRef.current?.focus()
  }

  function toggleDraft(category: CookieCategoryId, value: boolean) {
    setDraft((current) => ({ ...current, [category]: value }))
  }

  if (customizing) {
    return (
      <div className="taggo-cookie" role="dialog" aria-modal="true" aria-labelledby="taggo-cookie-panel-title">
        <div className="taggo-cookie__panel" ref={panelRef}>
          <h2 className="taggo-cookie__title" id="taggo-cookie-panel-title">
            Personnaliser les cookies
          </h2>
          <p className="taggo-cookie__text">
            Les cookies strictement nécessaires sont toujours actifs : ils permettent la connexion et le
            panier. Les autres catégories ne sont utilisées par TAGGO que si vous les activez. Le comptage
            des scans de vos TAGGO est affiché à titre informatif : il n’utilise aucun cookie et ne peut pas
            être refusé.
          </p>

          <ul className="taggo-cookie__categories">
            {COOKIE_CATEGORIES.map((category) => {
              const inputId = `taggo-cookie-${category.id}`
              const descriptionId = `${inputId}-description`

              return (
                <li className="taggo-cookie__category" key={category.id}>
                  <label className="taggo-cookie__label" htmlFor={inputId}>
                    {category.title}
                  </label>

                  {category.required ? (
                    <p className="taggo-cookie__required" id={descriptionId}>
                      Toujours actif (non configurable)
                    </p>
                  ) : (
                    <>
                      <input
                        id={inputId}
                        className="taggo-cookie__checkbox"
                        type="checkbox"
                        checked={draft[category.id] ?? false}
                        // Une case cochable promet un refus possible. La mesure
                        // d'audience interne de TAGGO n'utilise ni cookie ni
                        // identifiant : elle est active mais non refusable, et
                        // doit donc être présentée comme telle.
                        disabled={!category.inUse || !category.consentRequired}
                        aria-describedby={descriptionId}
                        onChange={(event) => toggleDraft(category.id, event.target.checked)}
                      />
                      <p className="taggo-cookie__description" id={descriptionId}>
                        {category.inUse
                          ? category.consentRequired
                            ? category.description
                            : 'Actif, sans cookie ni identifiant : aucun consentement n’est requis.'
                          : 'Non utilisé par TAGGO à ce jour.'}
                      </p>
                    </>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="taggo-cookie__actions">
            <button
              type="button"
              className="taggo-button taggo-button--primary"
              onClick={saveDraft}
            >
              Enregistrer mes choix
            </button>
            <button
              type="button"
              className="taggo-button taggo-button--ghost"
              onClick={() => {
                setCustomizing(false)
                triggerRef.current?.focus()
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <>
      {decided ? (
        <div className="taggo-cookie__footer-action">
          <button
            type="button"
            className="taggo-cookie__link-button"
            ref={triggerRef}
            onClick={openCustomize}
          >
            Modifier mes choix
          </button>
        </div>
      ) : (
        <section
          className="taggo-cookie__banner"
          aria-label="Gestion des cookies"
          aria-live="polite"
        >
          <div className="taggo-cookie__panel">
            <h2 className="taggo-cookie__title">Cookies et vie privée</h2>
            <p className="taggo-cookie__text">
              TAGGO utilise uniquement des cookies strictement nécessaires au fonctionnement du site.
              Aucun outil de mesure d’audience ni traceur publicitaire n’est utilisé. Vous pouvez
              tout de même personnaliser vos choix.
            </p>

            <div className="taggo-cookie__actions">
              <button
                type="button"
                className="taggo-button taggo-button--primary"
                onClick={() => persist(acceptAllCookieConsent(new Date().toISOString()))}
              >
                Tout accepter
              </button>
              <button
                type="button"
                className="taggo-button taggo-button--ghost"
                onClick={() => persist(rejectAllCookieConsent(new Date().toISOString()))}
              >
                Tout refuser
              </button>
              <button
                type="button"
                className="taggo-button taggo-button--ghost"
                ref={triggerRef}
                onClick={openCustomize}
              >
                Personnaliser
              </button>
            </div>

            <p className="taggo-cookie__legal">
              Détail des catégories : <a href="/legal/cookies">politique cookies</a>.
            </p>
          </div>
        </section>
      )}
    </>
  )
}
