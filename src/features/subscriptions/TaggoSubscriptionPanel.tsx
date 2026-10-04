import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card/Card'
import { Eyebrow } from '../../components/ui/Typography/Typography'
import {
  fetchTaggoSubscription,
  requestTaggoRenewal,
  setTaggoAutoRenew,
} from '../subscriptions/subscriptionClient'
import {
  formatSubscriptionDate,
  SUBSCRIPTION_DISPLAY_LABELS,
  subscriptionFailureMessage,
  toSubscriptionDisplay,
  type SubscriptionActionResult,
  type SubscriptionReadResult,
  type TaggoSubscriptionState,
} from '../subscriptions/subscriptionTypes'
import './TaggoSubscriptionPanel.css'

/**
 * ÉTAPE 12 — Panneau d'abonnement d'un TAGGO, dans le dashboard.
 *
 * Ce panneau affiche des FAITS servidor et propose deux actions qui ne sont que
 * des INTENTIONS :
 *   - « Renouveler » : demande de renouvellement manuel. Tant que le tarif n'est
 *     pas configuré, elle est explicitement indisponible — aucun prix n'est
 *     affiché, aucune commande n'est créée ;
 *   - « Renouvellement automatique » : une préférence enregistrée côté serveur.
 *
 * Le panneau n'écrit JAMAIS de date ni de statut. Un TAGGO expiré ne peut pas
 * être réactivé depuis ici : la réactivation suit un renouvellement confirmé
 * côté serveur.
 */

export type TaggoSubscriptionPanelProps = {
  qrId: string
  publicId: string
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; state: TaggoSubscriptionState }

const REFRESH_INTERVAL_MS = 60_000

export function TaggoSubscriptionPanel({ qrId, publicId }: TaggoSubscriptionPanelProps) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [actionMessage, setActionMessage] = useState('')
  const [actionFailed, setActionFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadState = useCallback(async () => {
    const result: SubscriptionReadResult = await fetchTaggoSubscription(qrId)
    setLoad(
      result.ok
        ? { kind: 'ready', state: result.state }
        : { kind: 'error', message: subscriptionFailureMessage(result.reason) },
    )
  }, [qrId])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const result: SubscriptionReadResult = await fetchTaggoSubscription(qrId)
      if (cancelled) return
      setLoad(
        result.ok
          ? { kind: 'ready', state: result.state }
          : { kind: 'error', message: subscriptionFailureMessage(result.reason) },
      )
    }

    void run()

    // Rafraîchissement périodique : l'échéance peut passer pendant que le
    // tableau de bord est ouvert. Le balayage d'expiration est de toute façon
    // déclenché côté serveur à chaque lecture.
    const timer = window.setInterval(() => {
      void run()
    }, REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [qrId])

  const runAction = async (action: () => Promise<SubscriptionActionResult>) => {
    setBusy(true)
    setActionMessage('')
    setActionFailed(false)

    const result = await action()

    setBusy(false)
    if (result.ok) {
      await loadState()
      return
    }
    setActionFailed(true)
    setActionMessage(subscriptionFailureMessage(result.reason))
  }

  if (load.kind === 'loading') {
    return (
      <Card as="section" className="taggo-subscription" aria-labelledby="taggo-subscription-title">
        <Eyebrow>Abonnement</Eyebrow>
        <h2 id="taggo-subscription-title">Abonnement de {publicId}</h2>
        <p role="status" aria-busy="true">
          Chargement de l’abonnement...
        </p>
      </Card>
    )
  }

  if (load.kind === 'error') {
    return (
      <Card as="section" className="taggo-subscription" aria-labelledby="taggo-subscription-title">
        <Eyebrow>Abonnement</Eyebrow>
        <h2 id="taggo-subscription-title">Abonnement de {publicId}</h2>
        <p role="alert" className="form-error">
          {load.message}
        </p>
        <button type="button" className="ghost-button" onClick={() => void loadState()}>
          Réessayer
        </button>
      </Card>
    )
  }

  const { state } = load
  const display = toSubscriptionDisplay(state)
  const canRenew = state.managed && state.status === 'expired'

  return (
    <Card as="section" className="taggo-subscription" aria-labelledby="taggo-subscription-title">
      <Eyebrow>Abonnement</Eyebrow>
      <h2 id="taggo-subscription-title">Abonnement de {publicId}</h2>

      <dl className="taggo-subscription__facts">
        <div>
          <dt>Statut</dt>
          <dd data-subscription-display={display}>
            {SUBSCRIPTION_DISPLAY_LABELS[display]}
          </dd>
        </div>
        <div>
          <dt>Début de période</dt>
          <dd>{formatSubscriptionDate(state.startedAt)}</dd>
        </div>
        <div>
          <dt>Date d’expiration</dt>
          <dd>{formatSubscriptionDate(state.endsAt)}</dd>
        </div>
        <div>
          <dt>Renouvellement automatique</dt>
          <dd>{state.autoRenew ? 'Activé' : 'Désactivé'}</dd>
        </div>
        <div>
          <dt>Origine de la période</dt>
          <dd>
            {state.source === 'included'
              ? 'Première année incluse'
              : state.source === 'renewal'
                ? 'Renouvellement'
                : '—'}
          </dd>
        </div>
      </dl>

      {display === 'unmanaged' ? (
        <p className="taggo-subscription__note taggo-subscription__note--warning">
          Aucune période n’est rattachée à ce TAGGO : sa page publique est désactivée et
          il ne redirige pas vers sa destination. C’est le cas d’un TAGGO qui n’a pas été
          attribué par une commande payante. Ce n’est pas une expiration : rien n’a jamais
          expiré ici.
        </p>
      ) : null}

      {display === 'expired' ? (
        <p className="taggo-subscription__note taggo-subscription__note--warning">
          La période de ce TAGGO est terminée. Sa page publique est suspendue et ne
          redirige plus vers sa destination. Un renouvellement doit être confirmé pour
          le réactiver.
        </p>
      ) : null}

      {display === 'suspended' || display === 'replaced' ? (
        <p className="taggo-subscription__note">
          Ce TAGGO n’est pas disponible pour une raison qui ne concerne pas son
          abonnement. Aucune date d’expiration d’abonnement ne lui est appliquée.
        </p>
      ) : null}

      <div className="taggo-subscription__actions">
        <button
          type="button"
          className="primary-button"
          disabled={busy || !canRenew || !state.renewalAvailable}
          onClick={() => void runAction(() => requestTaggoRenewal(qrId))}
        >
          {state.renewalAvailable ? 'Renouveler' : 'Renouvellement indisponible'}
        </button>

        {canRenew && !state.renewalAvailable ? (
          <p className="taggo-subscription__note">
            Le tarif de renouvellement n’est pas encore défini. Aucun paiement ne peut
            être effectué pour le moment.
          </p>
        ) : null}
      </div>

      {state.managed ? (
        <label className="taggo-subscription__auto-renew">
          <input
            type="checkbox"
            checked={state.autoRenew}
            disabled={busy}
            onChange={(event) => {
              const enabled = event.target.checked
              void runAction(() => setTaggoAutoRenew(qrId, enabled))
            }}
          />
          <span>Renouveler automatiquement chaque année</span>
        </label>
      ) : null}

      {actionMessage ? (
        <p role="alert" className={actionFailed ? 'form-error' : 'taggo-subscription__note'}>
          {actionMessage}
        </p>
      ) : null}
    </Card>
  )
}