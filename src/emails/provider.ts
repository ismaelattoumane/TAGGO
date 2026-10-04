import type { EmailProvider, EmailSendRequest, EmailSendResult } from './emailTypes'

/**
 * ÉTAPE 10 — Provider d'emails.
 *
 * Aucun fournisseur externe n'est branché à ce jour : le rendu, la
 * déduplication et la journalisation sont prêts, mais l'envoi effectif est
 * désactivé tant que TAGGO n'a pas validé son prestataire transactionnel.
 *
 * Brancher un fournisseur plus tard consiste à :
 *  1. implémenter `EmailProvider` dans `api/_lib/emailProvider.ts` ;
 *  2. lire les secrets depuis les variables d'environnement SERVEUR ;
 *  3. renvoyer l'instance depuis `createEmailProvider`.
 *
 * Aucune clé ne vit dans ce module, et aucune clé ne doit être importée par le
 * frontend.
 */
export class DisabledEmailProvider implements EmailProvider {
  readonly name = 'disabled'

  async send(_request: EmailSendRequest): Promise<EmailSendResult> {
    return { delivered: false, provider: this.name, providerMessageId: null }
  }
}

/**
 * Provider de test / développement local.
 * Conserve les messages en mémoire : aucun réseau, aucun secret, aucun envoi.
 */
export function createMemoryEmailProvider(): EmailProvider & { sent: EmailSendRequest[] } {
  const sent: EmailSendRequest[] = []

  return {
    name: 'memory',
    sent,
    async send(request: EmailSendRequest): Promise<EmailSendResult> {
      sent.push(request)
      return { delivered: true, provider: 'memory', providerMessageId: `mem-${sent.length}` }
    },
  }
}

/** Provider par défaut tant qu'aucun prestataire n'est configuré. */
export function createEmailProvider(): EmailProvider {
  return new DisabledEmailProvider()
}