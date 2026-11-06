import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DashboardLayout } from '../components/DashboardLayout'
import { Badge } from '../components/ui/Badge/Badge'
import { EmptyState } from '../components/ui/State/State'
import { Eyebrow } from '../components/ui/Typography/Typography'
import { orderRepository } from '../features/orders/repository'
import type { OrderDetails } from '../features/orders/orderTypes'
import { usePageSeo } from '../lib/usePageSeo'
import { formatOrderDate, orderStatusLabels, orderStatusTone, shortOrderRef } from './OrdersPage'

export function OrderDetailPage() {
  usePageSeo({ title: 'Détail de la commande — TAGGO', description: 'Détail de votre commande TAGGO.', noindex: true })
  const { orderId } = useParams()
  const { user } = useAuth()
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !orderId) return
    let cancelled = false
    const load = async () => {
      try {
        const result = await orderRepository.getOrder(orderId, user.id)
        if (!cancelled) setOrder(result)
      } catch {
        if (!cancelled) setError('Impossible de charger cette commande pour le moment.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [orderId, user])

  return (
    <DashboardLayout>
      <header className="topbar">
        <div>
          <Eyebrow>Commande</Eyebrow>
          <h1>{order ? `Commande ${shortOrderRef(order.id)}` : 'Commande'}</h1>
          {order ? <p className="topbar-subtitle">Passée le {formatOrderDate(order.createdAt)}</p> : null}
        </div>
        <Link to="/dashboard/orders" className="ghost-button">Retour aux commandes</Link>
      </header>

      <section className="panel" aria-busy={loading}>
        {loading ? (
          <p role="status">Chargement de la commande...</p>
        ) : error ? (
          <p role="alert" className="form-error">{error}</p>
        ) : !order ? (
          <EmptyState
            title="Commande introuvable"
            description="Cette commande n’existe pas ou n’est pas rattachée à votre compte."
            action={<Link to="/dashboard/orders" className="primary-button">Mes commandes</Link>}
          />
        ) : (
          <>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Statut</p>
                <h2>
                  <Badge tone={orderStatusTone[order.status]}>{orderStatusLabels[order.status]}</Badge>
                </h2>
              </div>
            </div>

            <div className="table-list" role="list" aria-label="Articles de la commande">
              {order.items.length === 0 ? (
                <p>Aucun article dans cette commande.</p>
              ) : (
                order.items.map((item) => (
                  <article key={item.id} role="listitem" className="qr-row">
                    <div className="qr-row-header">
                      <div>
                        <p className="qr-id">{item.qr?.publicId ?? 'TAGGO'}</p>
                        <h3>TAGGO × {item.quantity}</h3>
                      </div>
                    </div>
                    <div className="qr-row-actions">
                      {item.taggoId ? (
                        <Link to={`/dashboard/qr/${item.taggoId}`} className="link-button">Configurer ce TAGGO</Link>
                      ) : (
                        <span>
                          {order.status === 'cancelled'
                            ? 'Commande annulée.'
                            : 'Votre TAGGO sera rattaché à votre compte dès que la commande sera traitée.'}
                        </span>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>

            {order.items.some((item) => item.taggoId) ? (
              <p style={{ marginTop: '1rem' }}>
                Vous avez reçu votre TAGGO ? <Link to="/activate" className="link-button">Activez-le avec son code</Link>.
              </p>
            ) : null}
          </>
        )}
      </section>
    </DashboardLayout>
  )
}
