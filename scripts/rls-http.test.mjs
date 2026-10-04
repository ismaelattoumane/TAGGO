#!/usr/bin/env node
// TAGGO — étape 13.1 : tests RLS de bout en bout, avec de VRAIS JWT.
//
// Pourquoi ce fichier existe alors que `supabase/tests/*.sql` couvre déjà la
// RLS : les tests SQL simulent le contexte PostgREST (`set local role` +
// `request.jwt.claims`). Ce fichier utilise le vrai chemin d'un navigateur :
//
//   1. inscription réelle via GoTrue  ->  un access_token HS256 réellement signé
//   2. appels HTTP réels sur PostgREST   ->  en-têtes `apikey` + `Authorization`
//
// C'est la seule façon de prouver que l.chainetaînage complet
// « GoTrue émet un JWT -> PostgREST le valide -> il donne `authenticated` ->
// la RLS filtre -> les droits SQL s'appliquent » tient, et non seulement que
// la RLS est correcte en SQL.
//
// `service_role` n'est utilisé NULLE PART ici. Un secret de service serait
// précisément le moyen de masquer une régression d'autorisation : toutes les
// preuves sont donc obtenues avec des comptes ordinaires.

import { createHmac, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const REST = `http://127.0.0.1:${process.env.TAGGO_REST_PORT ?? 3000}`
const AUTH = `http://127.0.0.1:${process.env.TAGGO_AUTH_PORT ?? 8081}`
const PG_CONTAINER = `${process.env.TAGGO_STACK_NAME ?? 'taggo'}_pg`

let passed = 0
let failed = 0
const failures = []

function ok(name, detail = '') {
  passed += 1
  console.log(`  \x1b[32mPASS\x1b[0m ${name}${detail ? ` \x1b[90m${detail}\x1b[0m` : ''}`)
}
function ko(name, detail = '') {
  failed += 1
  failures.push(`${name} :: ${detail}`)
  console.log(`  \x1b[31mFAIL\x1b[0m ${name}${detail ? ` \x1b[31m${detail}\x1b[0m` : ''}`)
}
function check(name, condition, detail = '') {
  if (condition) ok(name, detail)
  else ko(name, detail)
}
function section(title) {
  console.log(`\n\x1b[1m== ${title} ==\x1b[0m`)
}

/**
 * `transition_taggo` renvoie la COMPOSITE `qr_codes`. Quand la fonction ne fait
 * rien, PostgreSQL renvoie une ligne entièrement nulle ; PostgREST la sérialise
 * en objet dont tous les champs valent null. Ce n'est donc pas un `null` JSON,
 * et c'est la absence de `id` qui prouve le refus.
 */
function isRefused(body) {
  if (body === null || body === undefined) return true
  if (Array.isArray(body)) return body.length === 0
  if (typeof body !== 'object') return false
  return Object.values(body).every((value) => value === null || value === undefined)
}

async function request(url, { method = 'GET', token, body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // PostgREST >= 12 ne renvoie plus la ligne créée sur un INSERT sans
      // `Prefer: return=representation`. Les tests ont besoin de l'id.
      Prefer: 'return=representation',
      ...(token ? { apikey: token, Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: response.status, text, json }
}

/**
 * Inscription réelle via GoTrue. L'API locale est en autoconfirm : le token
 * retourné est un JWT HS256 signé par le même secret que celui lu par
 * PostgREST, avec `role: authenticated` et `sub` = identifiant de l'utilisateur.
 */
async function signUp(email, password) {
  const result = await request(`${AUTH}/signup`, {
    method: 'POST',
    body: { email, password, data: { full_name: email.split('@')[0] } },
  })
  if (result.status >= 400 || !result.json?.access_token) {
    throw new Error(`inscription impossible pour ${email} (HTTP ${result.status}) : ${result.text.slice(0, 200)}`)
  }
  const payload = JSON.parse(Buffer.from(result.json.access_token.split('.')[1], 'base64url').toString())
  if (payload.role !== 'authenticated') {
    throw new Error(`le JWT émis ne porte pas le rôle attendu : ${payload.role}`)
  }
  return { token: result.json.access_token, userId: payload.sub, email }
}

/** JWT anonyme : un jeton signé avec le rôle `anon`, comme le ferait l'anon key. */
function anonToken() {
  const secret = process.env.TAGGO_JWT_SECRET ?? 'taggo-local-test-jwt-secret-at-least-32-chars'
  const b64 = (value) => Buffer.from(value).toString('base64url')
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = b64(JSON.stringify({ role: 'anon', iss: 'supabase', iat: now, exp: now + 3600 }))
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${signature}`
}

function rpc(token, name, args) {
  return request(`${REST}/rpc/${name}`, { method: 'POST', token, body: args })
}

function createAssignedTaggoFixture(ownerId) {
  const orderId = randomUUID()
  const qrId = randomUUID()
  const publicId = `TGG-${randomUUID().replaceAll('-', '').slice(0, 7).toUpperCase()}`
  const sql = `
    insert into public.orders (id, customer_id, status, subtotal_cents, currency, paid_at)
    values (:'order_id'::uuid, :'owner_id'::uuid, 'paid', 1000, 'EUR', now());
    insert into public.qr_codes (
      id, owner_id, public_id, status, lifecycle_status, is_public,
      title, destination_url
    ) values (
      :'qr_id'::uuid, :'owner_id'::uuid, :'public_id', 'draft', 'assigned',
      false, 'Deletion test fixture', 'https://example.invalid/assigned'
    );
    insert into public.taggo_assignments (
      qr_code_id, order_id, assigned_user_id, status, assigned_by, assigned_at
    ) values (
      :'qr_id'::uuid, :'order_id'::uuid, :'owner_id'::uuid, 'assigned', 'stripe', now()
    );
    insert into public.order_items (order_id, product_type, quantity, taggo_id)
    values (:'order_id'::uuid, 'taggo', 1, :'qr_id'::uuid);
  `
  execFileSync('docker', [
    'exec',
    '-i',
    PG_CONTAINER,
    'psql',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    `owner_id=${ownerId}`,
    '-v',
    `order_id=${orderId}`,
    '-v',
    `qr_id=${qrId}`,
    '-v',
    `public_id=${publicId}`,
  ], { input: sql, stdio: ['pipe', 'ignore', 'pipe'] })
  return qrId
}

async function main() {
  section('0 — disponibilité de la pile')
  const health = await request(`${REST}/`)
  if (health.status >= 500) {
    console.error(`  PostgREST ne répond pas sur ${REST} (HTTP ${health.status})`)
    process.exit(1)
  }
  ok('PostgREST répond')

  section('1 — comptes réels créés via GoTrue')
  const suffix = Date.now().toString(36)
  // `public_id` doit respecter `^TGG-[A-Z0-9]{7}$` : le suffixe d'exécution,
  // mis en majuscules et complété, fournit les 7 caractères.
  const publicId = `TGG-${suffix.toUpperCase().padEnd(7, '0').slice(0, 7)}`
  const owner = await signUp(`f4-${suffix}@example.com`, 'TaggoTest!2026')
  const attacker = await signUp(`f3-${suffix}@example.com`, 'TaggoTest!2026')
  const anon = anonToken()
  ok('deux comptes authentiques créés, JWT rol=authenticated', `sub=${owner.userId.slice(0, 8)}…`)
  const anonClaims = JSON.parse(Buffer.from(anon.split('.')[1], 'base64url').toString())
  check('le JWT anonyme porte le rôle anon', anonClaims.role === 'anon', `role=${anonClaims.role}`)

  section('1a — emails de profil et parcours Auth')
  const emailPatch = await request(`${REST}/profiles?id=eq.${owner.userId}`, {
    method: 'PATCH',
    token: owner.token,
    body: { email: `forged-${suffix}@example.com` },
  })
  check(
    'le PATCH direct de profiles.email est refusé',
    emailPatch.status >= 400,
    `HTTP ${emailPatch.status}`,
  )

  const profileUpsert = await request(`${REST}/profiles?on_conflict=id`, {
    method: 'POST',
    token: owner.token,
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: { id: owner.userId, email: `forged-${suffix}@example.com`, full_name: 'Profile owner' },
  })
  const safeProfileEmail = Array.isArray(profileUpsert.json) ? profileUpsert.json[0]?.email : profileUpsert.json?.email
  check(
    'un upsert ne peut pas remplacer l’email Auth par celui du client',
    [200, 201].includes(profileUpsert.status) && safeProfileEmail === owner.email,
    `HTTP ${profileUpsert.status}, email=${safeProfileEmail ?? 'absent'}`,
  )

  const thirdPartyProfile = await request(`${REST}/profiles?id=eq.${owner.userId}`, {
    method: 'PATCH',
    token: attacker.token,
    body: { email: `third-party-${suffix}@example.com` },
  })
  check(
    'un tiers ne peut pas modifier l’email du profil d’un autre compte',
    thirdPartyProfile.status === 200 && Array.isArray(thirdPartyProfile.json) && thirdPartyProfile.json.length === 0,
    `HTTP ${thirdPartyProfile.status}`,
  )

  const changedEmail = `confirmed-${suffix}@example.com`
  const authEmailChange = await request(`${AUTH}/user`, {
    method: 'PUT',
    token: owner.token,
    body: { email: changedEmail },
  })
  check(
    'Supabase Auth accepte la demande et conserve l’adresse avant confirmation',
    authEmailChange.status === 200 && authEmailChange.json?.email === owner.email,
    `HTTP ${authEmailChange.status}, email=${authEmailChange.json?.email ?? 'absent'}`,
  )
  const changedProfile = await request(`${REST}/profiles?id=eq.${owner.userId}&select=email`, { token: owner.token })
  check(
    'le profil ne suit pas un changement Auth non confirmé',
    changedProfile.status === 200 && changedProfile.json?.[0]?.email === owner.email,
    `HTTP ${changedProfile.status}, email=${changedProfile.json?.[0]?.email ?? 'absent'}`,
  )

  section('2 — F4 : le cycle de vie ne s’écrit pas en direct')
  const created = await request(`${REST}/qr_codes`, {
    method: 'POST',
    token: owner.token,
    body: {
      owner_id: owner.userId,
      public_id: publicId,
      title: 'TAGGO e2e',
      destination_url: 'https://example.com/e2e',
      is_public: false,
      lifecycle_status: 'activated',
    },
  })
  check('un client peut créer son TAGGO (draft, non public)', created.status === 201, `HTTP ${created.status} ${created.text.slice(0, 160)}`)
  // PostgREST renvoie un tableau pour un INSERT, sauf `Prefer: return=single`.
  const qrId = Array.isArray(created.json) ? created.json[0]?.id : created.json?.id

  if (!qrId) {
    console.error('\n  impossible de poursuivre : aucun TAGGO créé.')
    process.exit(1)
  }

  const directLifecycle = await request(`${REST}/qr_codes?public_id=eq.${publicId}`, {
    method: 'PATCH',
    token: owner.token,
    body: { lifecycle_status: 'active' },
  })
  check(
    'écriture directe de lifecycle_status refusée par PostgreSQL',
    directLifecycle.status === 400 || directLifecycle.status === 403,
    `HTTP ${directLifecycle.status} ${(directLifecycle.json?.message ?? '').slice(0, 120)}`,
  )

  for (const [column, value] of [
    ['status', 'active'],
    ['is_public', true],
    ['activated_at', '2020-01-01T00:00:00Z'],
    ['reserved_at', '2020-01-01T00:00:00Z'],
    ['assigned_at', '2020-01-01T00:00:00Z'],
    ['owner_id', attacker.userId],
  ]) {
    const attempt = await request(`${REST}/qr_codes?public_id=eq.${publicId}`, {
      method: 'PATCH',
      token: owner.token,
      body: { [column]: value },
    })
    check(`écriture directe de ${column} refusée`, attempt.status === 400 || attempt.status === 403, `HTTP ${attempt.status}`)
  }

  const content = await request(`${REST}/qr_codes?public_id=eq.${publicId}`, {
    method: 'PATCH',
    token: owner.token,
    body: { title: 'Titre legit' },
  })
  check(
    'le contenu du TAGGO reste modifiable',
    content.status === 200 && content.json?.[0]?.title === 'Titre legit',
    `HTTP ${content.status}`,
  )

  const thirdParty = await request(`${REST}/qr_codes?public_id=eq.${publicId}`, {
    method: 'PATCH',
    token: attacker.token,
    body: { title: 'Vole' },
  })
  check(
    'le TAGGO d’un tiers n’est pas modifiable',
    thirdParty.status === 200 && Array.isArray(thirdParty.json) && thirdParty.json.length === 0,
    `HTTP ${thirdParty.status}, ${Array.isArray(thirdParty.json) ? thirdParty.json.length : '?'} ligne(s)`,
  )

  const stolen = await rpc(attacker.token, 'transition_taggo', { p_qr_id: qrId, p_target_status: 'inactive' })
  check(
    'transition_taggo ne fait rien sur le TAGGO d’un tiers',
    stolen.status === 200 && isRefused(stolen.json),
    `HTTP ${stolen.status}, id=${stolen.json?.id ?? 'null'}`,
  )

  section('3 — F4 : le chemin autorisé fonctionne, et garde-fou d’abonnement')
  const withoutSubscription = await rpc(owner.token, 'transition_taggo', { p_qr_id: qrId, p_target_status: 'active' })
  check(
    'entrer dans active sans abonnement est refusé',
    withoutSubscription.status === 200 && isRefused(withoutSubscription.json),
    `HTTP ${withoutSubscription.status}, id=${withoutSubscription.json?.id ?? 'null'}`,
  )

  const publishWithoutSubscription = await rpc(owner.token, 'set_taggo_status', { p_qr_id: qrId, p_status: 'active' })
  check(
    'set_taggo_status(active) sans abonnement est refusé',
    publishWithoutSubscription.status >= 400,
    `HTTP ${publishWithoutSubscription.status} ${(publishWithoutSubscription.json?.message ?? '').slice(0, 80)}`,
  )

  const stillActivated = await request(`${REST}/qr_codes?public_id=eq.${publicId}&select=lifecycle_status`, { token: owner.token })
  check(
    'le cycle de vie est resté intact',
    stillActivated.status === 200 && stillActivated.json?.[0]?.lifecycle_status === 'activated',
    `lifecycle_status=${stillActivated.json?.[0]?.lifecycle_status}`,
  )

  section('4 — F2 : l’anonyme n’obtient ni owner_id ni donnée privée')
  const anonTable = await request(`${REST}/qr_codes?select=*`, { token: anon })
  check(
    'lecture de la table qr_codes refusée à l’anonyme',
    anonTable.status === 401 || anonTable.status === 403 || anonTable.status === 400,
    `HTTP ${anonTable.status} ${(anonTable.json?.message ?? anonTable.text).slice(0, 120)}`,
  )

  const anonOwnerColumn = await request(`${REST}/qr_codes?select=owner_id`, { token: anon })
  check(
    'owner_id non sélectionnable sur la table par l’anonyme',
    anonOwnerColumn.status !== 200,
    `HTTP ${anonOwnerColumn.status}`,
  )

  const anonView = await request(`${REST}/public_taggo_cards?select=*`, { token: anon })
  check(
    'la vue publique répond à l’anonyme',
    anonView.status === 200 && Array.isArray(anonView.json),
    `HTTP ${anonView.status}`,
  )

  const viewKeys = anonView.status === 200 && Array.isArray(anonView.json) && anonView.json.length > 0
    ? Object.keys(anonView.json[0]).sort()
    : []
  check(
    'la vue publique ne contient aucune colonne interdite',
    !['owner_id', 'lifecycle_status', 'reserved_at', 'assigned_at', 'activated_at'].some((column) => viewKeys.includes(column)),
    `colonnes=${viewKeys.join(',') || '(aucune ligne visible)'}`,
  )

  const anonViewWrite = await request(`${REST}/public_taggo_cards`, {
    method: 'POST',
    token: anon,
    body: { public_id: 'TGG-EVIL001', title: 'vol', destination_url: 'https://evil.example' },
  })
  check(
    'la vue publique refuse toute écriture',
    anonViewWrite.status === 401 || anonViewWrite.status === 403 || anonViewWrite.status === 400,
    `HTTP ${anonViewWrite.status}`,
  )

  for (const table of ['orders', 'subscriptions', 'taggo_assignments', 'stripe_webhook_events', 'email_events']) {
    const denied = await request(`${REST}/${table}?select=*`, { token: anon })
    check(`${table} illisible par l'anonyme`, denied.status !== 200, `HTTP ${denied.status}`)
  }

  const publicState = await rpc(anon, 'get_public_taggo_state', { p_public_id: publicId })
  check(
    'get_public_taggo_state reste appelable et renvoie un état',
    publicState.status === 200 && ['unactivated', 'subscription_required', 'unavailable'].includes(publicState.json),
    `état=${publicState.json}`,
  )

  section('5 — F3 : les colonnes financières d’une commande sont verrouillées')
  const orderId = randomUUID()
  const orderInsert = await request(`${REST}/orders`, {
    method: 'POST',
    token: owner.token,
    body: { id: orderId, customer_id: owner.userId, status: 'draft', subtotal_cents: 1, currency: 'USD' },
  })
  check(
    'création d’une commande avec montant et devise refusée',
    orderInsert.status >= 400,
    `HTTP ${orderInsert.status}`,
  )

  const orderInsertClean = await request(`${REST}/orders`, {
    method: 'POST',
    token: owner.token,
    body: { id: orderId, customer_id: owner.userId, status: 'draft' },
  })
  check(
    'création d’une commande « draft » sans montant acceptée',
    orderInsertClean.status === 201,
    `HTTP ${orderInsertClean.status} ${orderInsertClean.text.slice(0, 120)}`,
  )

  if (orderInsertClean.status === 201) {
    for (const [column, value] of [
      ['currency', 'USD'],
      ['subtotal_cents', 1],
      ['paid_at', '2020-01-01T00:00:00Z'],
      ['stripe_checkout_session_id', 'cs_fabrique'],
    ]) {
      const attempt = await request(`${REST}/orders?id=eq.${orderId}`, {
        method: 'PATCH',
        token: owner.token,
        body: { [column]: value },
      })
      check(`écriture de orders.${column} refusée`, attempt.status >= 400, `HTTP ${attempt.status}`)
    }

    const paidAttempt = await request(`${REST}/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      token: owner.token,
      body: { status: 'paid' },
    })
    check('passage manuel de la commande à paid refusé', paidAttempt.status >= 400, `HTTP ${paidAttempt.status}`)

    const statusAttempt = await request(`${REST}/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      token: owner.token,
      body: { status: 'pending' },
    })
    check('passage draft -> pending autorisé', statusAttempt.status === 200, `HTTP ${statusAttempt.status}`)

    const deleteAttempt = await request(`${REST}/orders?id=eq.${orderId}`, { method: 'DELETE', token: owner.token })
    // 204 sans `Prefer: return=representation`, 200 avec la ligne renvoyée.
    check('suppression de la commande (non payée) autorisée', [200, 204].includes(deleteAttempt.status), `HTTP ${deleteAttempt.status}`)
  }

  section('6 — les flux serveur restent joignables par le client')
  const createOrder = await rpc(owner.token, 'create_order', {})
  check('create_order toujours exécutable par un client', createOrder.status === 200 && Boolean(createOrder.json?.id), `HTTP ${createOrder.status}`)

  const paymentStatus = await rpc(owner.token, 'get_shop_order_payment_status', { p_order_id: createOrder.json?.id ?? '00000000-0000-4000-8000-000000000000' })
  check(
    'get_shop_order_payment_status répond pour sa propre commande',
    paymentStatus.status === 200 && paymentStatus.json?.order_id === createOrder.json?.id,
    `HTTP ${paymentStatus.status}`,
  )

  const anonPaymentStatus = await rpc(anon, 'get_shop_order_payment_status', { p_order_id: createOrder.json?.id ?? '' })
  check('un anonyme ne peut pas lire un état de paiement', anonPaymentStatus.status >= 400, `HTTP ${anonPaymentStatus.status}`)

  const otherPaymentStatus = await rpc(attacker.token, 'get_shop_order_payment_status', { p_order_id: createOrder.json?.id ?? '' })
  check('un tiers ne peut pas lire le paiement d’une commande', otherPaymentStatus.status >= 400, `HTTP ${otherPaymentStatus.status}`)

  const serverOnly = [
    'mark_shop_order_paid',
    'reserve_taggos_for_paid_order',
    'begin_stripe_event',
    'finish_stripe_event',
    'record_taggo_scan',
    'get_taggo_scan_stats',
    'get_taggo_subscription_status',
    'renew_taggo_subscription',
    'reactivate_taggo_subscription',
    'provision_taggo_stock',
  ]
  for (const name of serverOnly) {
    const attempt = await rpc(owner.token, name, {})
    check(`${name} refuse l'appel par un client`, attempt.status >= 400, `HTTP ${attempt.status}`)
  }

  section('7 — suppression QR : propriété et historique')
  const attackerDelete = await request(`${REST}/qr_codes?id=eq.${qrId}`, {
    method: 'DELETE',
    token: attacker.token,
  })
  check(
    'un tiers ne peut pas supprimer le TAGGO d’un autre compte',
    attackerDelete.status === 200 && Array.isArray(attackerDelete.json) && attackerDelete.json.length === 0,
    `HTTP ${attackerDelete.status}`,
  )
  const remainsAfterAttack = await request(`${REST}/qr_codes?id=eq.${qrId}&select=id`, { token: owner.token })
  check(
    'le TAGGO reste présent après la tentative d’un tiers',
    remainsAfterAttack.status === 200 && remainsAfterAttack.json?.length === 1,
    `HTTP ${remainsAfterAttack.status}`,
  )

  // PostgreSQL admin is used only to install a paid-order/assignment fixture;
  // the actual DELETE authorization and trigger are exercised with owner's JWT.
  const assignedQrId = createAssignedTaggoFixture(owner.userId)
  const protectedDelete = await request(`${REST}/qr_codes?id=eq.${assignedQrId}`, {
    method: 'DELETE',
    token: owner.token,
  })
  check(
    'la suppression du TAGGO affecté est bloquée par PostgreSQL',
    protectedDelete.status >= 400,
    `HTTP ${protectedDelete.status} ${(protectedDelete.json?.message ?? '').slice(0, 100)}`,
  )

  const cleanDelete = await request(`${REST}/qr_codes?id=eq.${qrId}`, {
    method: 'DELETE',
    token: owner.token,
  })
  check(
    'le propriétaire peut supprimer un TAGGO sans historique',
    cleanDelete.status === 200 && Array.isArray(cleanDelete.json) && cleanDelete.json.length === 1,
    `HTTP ${cleanDelete.status}`,
  )

  console.log(`\n---- HTTP : ${passed} réussis, ${failed} échoués ----`)
  if (failures.length > 0) {
    console.log('Échecs :')
    for (const failure of failures) console.log(`  - ${failure}`)
  }
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(`\nÉCHEC DU SCÉNARIO HTTP : ${error.message}`)
  process.exit(1)
})