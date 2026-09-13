import './ProfilePreview.css'

const profile = {
  handle: '@alex',
  bio: 'Ton identité. Ton monde.',
  links: [
    { label: 'Instagram', href: '#' },
    { label: 'Snapchat', href: '#' },
    { label: 'WhatsApp', href: '#' },
  ],
}

/**
 * TAGGO profile preview — visual representation of what someone sees when
 * they scan a TAGGO QR code. Uses static demo data (no auth, no Supabase).
 * Reveals with a symbolic "scan" effect on scroll.
 */
export function ProfilePreview() {
  return (
    <section className="taggo-profile">
      <div className="taggo-profile__card">
        {/* Symbolic scan line — represents the QR being scanned */}
        <div className="taggo-profile__scan" aria-hidden="true" />

        <div className="taggo-profile__avatar" aria-hidden="true">
          👤
        </div>

        <p className="taggo-profile__handle">{profile.handle}</p>
        <p className="taggo-profile__bio">{profile.bio}</p>

        <div className="taggo-profile__links">
          {profile.links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="taggo-button taggo-button--ghost"
              onClick={(e) => e.preventDefault()}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
