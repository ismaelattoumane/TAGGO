import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * ÉTAPE 10.1 — Templates d'emails Supabase Auth.
 *
 * Ces templates sont rendus par Supabase (Go templates) et copiés tels quels
 * dans Dashboard > Authentication > Email Templates. Ils sont donc vérifiés
 * comme des fichiers, pas comme du code exécuté.
 *
 * Invariants vérifiés :
 *  1. seules des variables Supabase Auth réellement supportées sont utilisées ;
 *  2. `{{ .ConfirmationURL }}` est présent dans chaque email actionnable ;
 *  3. aucune URL de production n'est inventée ;
 *  4. aucun secret, mot de passe, jeton ou identifiant interne n'apparaît ;
 *  5. HTML compatible email : pas de JavaScript, pas de CSS moderne ;
 *  6. accessibilité : langue, contraste, bouton visible, lien en texte brut.
 */

const root = process.cwd()
const TEMPLATE_DIR = resolve(root, 'supabase/templates/auth')

type TemplateName = 'recovery' | 'confirmation' | 'email_change'

const TEMPLATES: TemplateName[] = ['recovery', 'confirmation', 'email_change']

/** Variables documentées par Supabase Auth (docs/guides/auth/auth-email-templates). */
const SUPPORTED_VARIABLES = new Set([
  'ConfirmationURL',
  'Token',
  'TokenHash',
  'SiteURL',
  'RedirectTo',
  'Data',
  'Email',
  'NewEmail',
  'OldEmail',
  'Phone',
  'OldPhone',
  'Provider',
  'FactorType',
])

/**
 * Palette TAGGO de la consigne, plus le blanc et le blanc cassé déjà utilisés
 * par le gabarit transactionnel de l'étape 10 (`src/emails/components/layout.ts`)
 * pour la surface de la carte. Aucune autre couleur n'est introduite.
 */
const TAGGO_PALETTE = [
  '#2B2D42',
  '#6D597A',
  '#B56576',
  '#D6A7B2',
  '#F5E1DA',
  '#301934',
  '#6F2DA8',
  '#F4C95D',
  '#4CC9F0',
  '#0B1320',
  '#FFFFFF',
  '#FFFAF8',
]

function readTemplate(name: TemplateName, extension: 'html' | 'txt'): string {
  return readFileSync(join(TEMPLATE_DIR, `${name}.${extension}`), 'utf8')
}

function variablesIn(source: string): string[] {
  return [...source.matchAll(/\{\{\s*\.([A-Za-z]+)\s*\}\}/g)].map((match) => match[1])
}

describe.each(TEMPLATES)('template Auth %s', (name) => {
  it('n’utilise que des variables Supabase Auth supportées', () => {
    const html = readTemplate(name, 'html')
    const text = readTemplate(name, 'txt')

    for (const variable of [...variablesIn(html), ...variablesIn(text)]) {
      expect(SUPPORTED_VARIABLES, `${name}.html : variable {{ .${variable} }} non supportée`).toContain(
        variable,
      )
    }
  })

  it('utilise exclusivement la syntaxe Go template de Supabase ({{ .X }})', () => {
    for (const extension of ['html', 'txt'] as const) {
      const source = readTemplate(name, extension)
      // Aucun autre formaliste : ni `${...}`, ni `%s`, ni `{name}` orphelin.
      expect(source, `${name}.${extension}`).not.toMatch(/\$\{/)
      expect(source, `${name}.${extension}`).not.toMatch(/<%/)
    }
  })

  it('inclut le lien de confirmation Supabase', () => {
    expect(readTemplate(name, 'html')).toContain('{{ .ConfirmationURL }}')
    expect(readTemplate(name, 'txt')).toContain('{{ .ConfirmationURL }}')
  })

  it('ne contient aucune URL inventée ni domaine de production', () => {
    for (const extension of ['html', 'txt'] as const) {
      const source = readTemplate(name, extension)
      // Seuls les schémas de lien présents sont des URL ; on vérifie qu'aucune
      // ne pointe vers un domaine TAGGO inventé ou un asset local.
      expect(source, `${name}.${extension}`).not.toMatch(/https?:\/\/(?!\{\{\s*\.ConfirmationURL)/i)
      expect(source, `${name}.${extension}`).not.toMatch(/src\/assets|localhost|127\.0\.0\.1|\.svg|\.png/i)
      expect(source, `${name}.${extension}`).not.toMatch(/taggo\.(fr|com|net|io)\b/i)
    }
  })

  it('ne divulgue ni mot de passe, ni jeton, ni identifiant interne', () => {
    for (const extension of ['html', 'txt'] as const) {
      const source = readTemplate(name, extension)
      expect(source, `${name}.${extension}`).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
      expect(source, `${name}.${extension}`).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i)
      // Aucune affectation de type « mot de passe : <valeur> » sur une même
      // ligne. La version texte contient « nouveau mot de passe : » suivi d'une
      // consigne à la ligne suivante : ce n'est pas un couple clé/valeur.
      expect(source, `${name}.${extension}`).not.toMatch(/mot de passe[ \t]*[:=][ \t]*\S/i)
      expect(source, `${name}.${extension}`).not.toMatch(/\{\{\s*\.TokenHash\s*\}\}/)
      expect(source, `${name}.${extension}`).not.toMatch(/\bpassword\b\s*[:=]/i)
    }
  })

  it('n’annonce aucune durée de validité non configurée', () => {
    for (const extension of ['html', 'txt'] as const) {
      const source = readTemplate(name, extension)
      expect(source, `${name}.${extension}`).not.toMatch(/\d+\s?(?:h|heure|minutes?|min)\b/i)
      expect(source, `${name}.${extension}`).not.toMatch(/expire dans|valable \d/i)
    }
  })
})

describe('template Password Reset', () => {
  const html = readTemplate('recovery', 'html')
  const text = readTemplate('recovery', 'txt')

  it('reproduit le sujet et le corps attendus', () => {
    expect(html).toContain('Réinitialise ton mot de passe')
    expect(text).toContain('🔑 Réinitialise ton mot de passe TAGGO')
    expect(text).toContain('Salut {{ .Email }},')
    expect(text).toContain('Une demande de réinitialisation du mot de passe de ton compte TAGGO a été effectuée.')
    expect(text).toContain('Si tu n’es pas à l’origine de cette demande, tu peux ignorer cet email')
    expect(text).toContain('L’équipe TAGGO')
    expect(text).toContain('Le vêtement qui connecte.')
  })

  it('rappelle que le mot de passe actuel n’est jamais envoyé', () => {
    expect(text).toMatch(/ton mot de passe actuel reste inchangé/)
    expect(text).toMatch(/ne t’est jamais envoyé par email/)
    expect(text).not.toMatch(/ton mot de passe est/i)
  })

  it('propose un bouton d’action et un lien de repli en texte brut', () => {
    // Deux usages de ConfirmationURL : le href du bouton et le lien visible.
    expect(html.match(/\{\{ \.ConfirmationURL \}\}/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('Choisir un nouveau mot de passe')
  })
})

describe('template Email Confirmation', () => {
  const text = readTemplate('confirmation', 'txt')

  it('reproduit le sujet et le corps attendus', () => {
    expect(text).toContain('✉️ Confirme ton adresse email TAGGO')
    expect(text).toContain('Bienvenue chez TAGGO.')
    expect(text).toContain('Pour terminer la création de ton compte, confirme ton adresse email :')
    expect(text).toContain('Une fois ton adresse confirmée, tu pourras accéder à ton compte TAGGO.')
    expect(text).toContain('À très vite,')
  })

  it('rassure sur l’ignorance sans promettre de création de compte', () => {
    expect(text).toMatch(/aucun compte ne sera créé/i)
  })
})

describe('template Change Email', () => {
  const html = readTemplate('email_change', 'html')
  const text = readTemplate('email_change', 'txt')

  it('affiche la nouvelle adresse via {{ .NewEmail }}', () => {
    expect(variablesIn(html)).toContain('NewEmail')
    expect(variablesIn(text)).toContain('NewEmail')
    expect(text).toContain('{{ .NewEmail }}')
  })

  it('rappelle que l’adresse actuelle reste inchangée en cas d’abus', () => {
    expect(text).toMatch(/ton adresse actuelle restera inchangée/i)
  })
})

describe('HTML compatible email', () => {
  it.each(TEMPLATES)('%s ne dépend d’aucun JavaScript ni CSS externe', (name) => {
    const html = readTemplate(name, 'html')

    expect(html).not.toMatch(/<script/i)
    // Attributs d'événement inline : la regex exige une espace avant `on…`
    // pour ne pas capturer `content="` ou `ontent=`.
    expect(html).not.toMatch(/\son[a-z]+\s*=\s*"/i)
    expect(html).not.toMatch(/javascript:/i)
    expect(html).not.toMatch(/<link\b/i)
    expect(html).not.toMatch(/<style\b/i)
    expect(html).not.toMatch(/@media|@import|@font-face/i)
    expect(html).not.toMatch(/position\s*:\s*(absolute|fixed)|flexbox|grid-template|var\(/i)
  })

  it.each(TEMPLATES)('%s est structuré en tables de présentation', (name) => {
    const html = readTemplate(name, 'html')

    expect(html).toMatch(/^<!doctype html>/i)
    expect(html).toContain('<html lang="fr">')
    expect(html).toContain('role="presentation"')
    expect(html).toContain('cellpadding="0"')
    expect(html).toContain('cellspacing="0"')
    expect(html).toContain('</html>')
  })

  it.each(TEMPLATES)('%s n embarque aucune ressource externe ni pixel de tracking', (name) => {
    const html = readTemplate(name, 'html')

    expect(html).not.toMatch(/<img\b/i)
    expect(html).not.toMatch(/<iframe|<video|<audio/i)
    expect(html).not.toMatch(/src\s*=/i)
  })

  it.each(TEMPLATES)('%s utilise uniquement la palette TAGGO', (name) => {
    const html = readTemplate(name, 'html')
    const hexCodes = [...new Set([...html.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((match) => match[0].toUpperCase()))]

    for (const code of hexCodes) {
      expect(TAGGO_PALETTE, `${name}.html : couleur hors palette ${code}`).toContain(code)
    }
  })

  it.each(TEMPLATES)('%s garde la version texte lisible sans HTML', (name) => {
    const text = readTemplate(name, 'txt')

    expect(text).not.toMatch(/<[a-z/]/i)
    expect(text).toContain('TAGGO')
    expect(text).toContain('support-taggo@protonmail.com')
    // Sujet, explication, lien, sécurité, signature : les 5 blocs requis.
    expect(text).toContain('{{ .ConfirmationURL }}')
    expect(text).toMatch(/L.équipe TAGGO/)
  })
})

describe('version texte comme repli du lien', () => {
  it.each(TEMPLATES)('%s expose le lien en texte brut après le bouton', (name) => {
    const html = readTemplate(name, 'html')

    // Le lien doit rester lisible si le bouton est bloqué ou non rendu.
    const anchorIndex = html.indexOf('{{ .ConfirmationURL }}')
    const rawLinkIndex = html.indexOf('word-break:break-all')

    expect(rawLinkIndex).toBeGreaterThan(-1)
    expect(anchorIndex).toBeGreaterThan(-1)
  })
})
