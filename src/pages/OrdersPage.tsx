import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DashboardLayout } from '../components/DashboardLayout'
import { Badge } from '../components/ui/Badge/Badge'
import { EmptyState } from '../components/ui/State/State'
import { Eyebrow } from '../components/ui/Typography/Typography'
import { orderRepository } from '../features/orders/repository'
import type { OrderStatus, OrderSummary } from '../features/orders/orderTypes'
import type { QrStatus } from '../features/qr/qrTypes'
import { usePageSeo } from '../lib/usePageSeo'

export const orderStatusLabels: Record<OrderStatus, string> = {
  draft: 'Brouillon',
  pending: 'En attente',
  ready_for_assignment: 'En préparation',
  assigned: 'TAGGO attribué',
  cancelled: 'Annulée',
}

// Réutilise les tons existants du Badge (actif / inactif / brouillon).
export const orderStatusTone: Record<OrderStatus, QrStatus> = {
  draft: 'draft',
  pending: 'draft',
  ready_for_assignment: 'draft',
  assigned: 'active',
  cancelled: 'inactive',
}

export function formatOrderDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function shortOrderRef(id: string) {
  return id.slice(0, 8).toUpperCase()
}

export function OrdersPage() {
  usePageSeo({ title: 'Mes commandes — TAGGO', description: 'Historique de vos commandes TAGGO.', noindex: true })
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      try {
        const list = await orderRepository.listOrders(user.id)
        if (!cancelled) setOrders(list)
      } catch {
        if (!cancelled) setLoadError('Impossible de charger vos commandes pour le moment.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  return (
    <DashboardLayout>
      <header className="topbar">
        <div>
          <Eyebrow>Commandes</Eyebrow>
          <h1>Mes commandes</h1>
          <p className="topbar-subtitle">Suivez vos achats et retrouvez les TAGGO associés.</p>
        </div>
        <Link to="/shop" className="primary-button">Commander</Link>
      </header>

      <section className="panel">
        <div className="table-list" role="list" aria-label="Liste des commandes" aria-busy={loading}>
          {loading ? (
            <p role="status">Chargement de vos commandes...</p>
          ) : loadError ? (
            <p role="alert" className="form-error">{loadError}</p>
          ) : orders.length === 0 ? (
            <EmptyState
              title="Aucune commande"
              description="Vos commandes apparaîtront ici après votre premier achat."
              action={<Link to="/shop" className="primary-button">Découvrir la boutique</Link>}
            />
          ) : (
            orders.map((order) => (
              <article key={order.id} role="listitem" className="qr-row">
                <div className="qr-row-header">
                  <div>
                    <p className="qr-id">Commande {shortOrderRef(order.id)}</p>
                    <h3>Passée le {formatOrderDate(order.createdAt)}</h3>
                  </div>
                  <div className="pill-row">
                    <Badge tone={orderStatusTone[order.status]}>{orderStatusLabels[order.status]}</Badge>
                  </div>
                </div>
                <div className="qr-row-actions">
                  <Link to={`/dashboard/orders/${order.id}`} className="link-button">Voir le détail</Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </DashboardLayout>
  )
}
