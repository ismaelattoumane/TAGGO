import { readServerEnv } from './env'
import { DisabledEmailProvider } from '../../src/emails/provider'
import type { EmailProvider } from '../../src/emails/emailTypes'
import { createMemoryEmailProvider } from '../../src/emails/provider'

/**
 * ÉTAPE 10 — Provider d'emails côté serveur.
 *
 * Aucun prestataire transactionnel n'est intégré à ce jour : le provider par
 * défaut est volontairement désactivé (aucun appel réseau, aucun secret).
 * Brancher un service plus tard consiste à :
 *  1. ajouter les variables SERVEUR (`EMAIL_PROVIDER_*`, jamais `VITE_*`) ;
 *  2. implémenter `EmailProvider` dans ce fichier ;
 *  3. renvoyer l'instance depuis `createEmailProvider`.
 */

export function createEmailProvider(env = readServerEnv()): EmailProvider {
  const providerName = env.emailProviderName

  if (!providerName) return new DisabledEmailProvider()

  // Un nom de provider inconnu ne doit jamais faire croire qu'un email a été
  // envoyé : on retombe sur le provider désactivé, qui n'émet aucun message.
  switch (providerName) {
    case 'memory':
      return createMemoryEmailProvider()
    default:
      return new DisabledEmailProvider()
  }
}