import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eyebrow } from '../components/ui/Typography/Typography'
import { BUSINESS } from '../config/business'
import { CONTACT_CHANNELS, CONTACT_SECTIONS, CONTACT_UPDATED_AT } from '../content/contact/contactContent'
import { ContentBlocks } from '../features/content/ContentBlocks'
import { ContentFooter, ContentHeader } from '../features/content/ContentShell'
import {
  buildContactMailto,
  EMPTY_CONTACT_FORM,
  validateContactForm,
  type ContactFormErrors,
  type ContactFormValues,
} from '../features/contact/contactForm'
import { usePageSeo } from '../lib/usePageSeo'
import '../features/content/content.css'

const TITLE = 'Contact TAGGO — Écrire à l’équipe'
const DESCRIPTION =
  'Contactez l’équipe TAGGO : canal de contact officiel, formulaire de rédaction de message et liens vers la FAQ, la livraison et les mentions légales.'

const FIELD_LABELS: { name: keyof ContactFormValues; label: string; type: string }[] = [
  { name: 'name', label: 'Prénom', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'orderReference', label: 'Référence de commande (facultatif)', type: 'text' },
]

/**
 * ÉTAPE 10 — Page de contact (`/contact`).
 *
 * Le formulaire N'ENVOIE RIEN à un serveur TAGGO : il prépare un message dans la
 * messagerie du visiteur via `mailto:`. Les erreurs sont annoncées dans un
 * `role="alert"` et reliées au champ par `aria-describedby` / `aria-invalid`.
 */
export function ContactPage() {
  usePageSeo({ title: TITLE, description: DESCRIPTION, canonicalPath: '/contact' })

  const [values, setValues] = useState<ContactFormValues>(EMPTY_CONTACT_FORM)
  const [errors, setErrors] = useState<ContactFormErrors>({})
  const [mailtoLink, setMailtoLink] = useState<string | null>(null)

  function update(name: keyof ContactFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateContactForm(values)
    setErrors(validationErrors)
    setMailtoLink(Object.keys(validationErrors).length === 0 ? buildContactMailto(values) : null)
  }

  return (
    <div className="taggo-content-page">
      <a className="taggo-content__skip-link" href="#taggo-content">
        Aller au contenu
      </a>

      <ContentHeader />

      <main className="taggo-content" id="taggo-content">
        <header className="taggo-content__header">
          <Eyebrow>Contact</Eyebrow>
          <h1 className="taggo-content__title">Nous contacter</h1>
          <p className="taggo-content__lead">
            Une question sur un TAGGO, une commande, une taille ou un retour ? Le canal officiel de
            TAGGO est l’email.
          </p>
        </header>

        <section className="taggo-content__section" aria-labelledby="contact-canaux">
          <h2 className="taggo-content__section-title" id="contact-canaux">
            Canaux de contact
          </h2>

          <div className="taggo-contact__channels">
            {CONTACT_CHANNELS.map((channel) => (
              <article className="taggo-contact__channel" key={channel.id}>
                <p className="taggo-contact__channel-label">{channel.label}</p>
                <p className="taggo-contact__channel-value">
                  {channel.href ? (
                    <a href={channel.href}>{channel.value}</a>
                  ) : (
                    channel.value
                  )}
                </p>
                <ContentBlocks blocks={channel.blocks} />
              </article>
            ))}
          </div>
        </section>

        <section className="taggo-content__section" aria-labelledby="contact-formulaire">
          <h2 className="taggo-content__section-title" id="contact-formulaire">
            Préparer un message
          </h2>
          <p className="taggo-content__paragraph">
            Remplis ces champs : TAGGO prépare un message dans ta messagerie. Rien n’est envoyé ni
            stocké par TAGGO, tu décides de l’envoyer.
          </p>

          <form className="taggo-contact__form" noValidate onSubmit={onSubmit}>
            {FIELD_LABELS.map((field) => {
              const errorId = `contact-${field.name}-error`

              return (
                <div className="taggo-contact__field" key={field.name}>
                  <label htmlFor={`contact-${field.name}`}>{field.label}</label>
                  <input
                    id={`contact-${field.name}`}
                    name={field.name}
                    type={field.type}
                    value={values[field.name]}
                    autoComplete={field.name === 'email' ? 'email' : 'on'}
                    aria-invalid={errors[field.name] ? true : undefined}
                    aria-describedby={errors[field.name] ? errorId : undefined}
                    onChange={(event) => update(field.name, event.target.value)}
                  />
                  {errors[field.name] ? (
                    <p className="taggo-contact__error" id={errorId} role="alert">
                      {errors[field.name]}
                    </p>
                  ) : null}
                </div>
              )
            })}

            <div className="taggo-contact__field">
              <label htmlFor="contact-message">Message</label>
              <textarea
                id="contact-message"
                name="message"
                rows={6}
                value={values.message}
                aria-invalid={errors.message ? true : undefined}
                aria-describedby={errors.message ? 'contact-message-error' : undefined}
                onChange={(event) => update('message', event.target.value)}
              />
              {errors.message ? (
                <p className="taggo-contact__error" id="contact-message-error" role="alert">
                  {errors.message}
                </p>
              ) : null}
            </div>

            <div>
              <button type="submit" className="taggo-button taggo-button--primary">
                Préparer le message
              </button>
            </div>

            <div aria-live="polite">
              {mailtoLink ? (
                <p className="taggo-contact__hint" role="status">
                  Ton message est prêt.{' '}
                  <a href={mailtoLink}>Ouvre ta messagerie pour l’envoyer à {BUSINESS.supportEmail}</a>.
                </p>
              ) : null}
            </div>
          </form>
        </section>

        {CONTACT_SECTIONS.map((section) => (
          <section className="taggo-content__section" key={section.id} id={section.id}>
            <h2 className="taggo-content__section-title">{section.title}</h2>
            <ContentBlocks blocks={section.blocks} />
          </section>
        ))}

        <section className="taggo-content__section" aria-labelledby="contact-liens">
          <h2 className="taggo-content__section-title" id="contact-liens">
            Pages utiles
          </h2>
          <ul className="taggo-content__list">
            <li>
              <Link to="/faq">Questions fréquentes</Link>
            </li>
            <li>
              <Link to="/shipping">Livraison et retours</Link>
            </li>
            <li>
              <Link to="/legal/terms">Conditions générales de vente</Link>
            </li>
            <li>
              <Link to="/legal/privacy">Politique de confidentialité</Link>
            </li>
            <li>
              <Link to="/legal/notice">Mentions légales</Link>
            </li>
          </ul>
          <p className="taggo-content__note">Dernière révision de cette page : {CONTACT_UPDATED_AT}.</p>
        </section>
      </main>

      <ContentFooter />
    </div>
  )
}