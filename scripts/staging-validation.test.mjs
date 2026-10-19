#!/usr/bin/env node
// Local unit tests for staging-validation.mjs logic
// Tests the EXACT pure functions exported by the script (no simulated logic).
// No network access — validates: HTTP classification, anonymous access blocking,
// PATCH protection logic, orphan detection, cleanup logic, migration references.
//
// Run: node scripts/staging-validation.test.mjs

import {
  classifyResponse,
  isAnonymousAccessBlocked,
  classifyPatchProtection,
  classifyCrossUserPatch,
  createCleanupGuard,
  handleOrphanCreation,
  classifyPreCheck,
  classifyCleanup,
} from './staging-validation.mjs'
import fs from 'fs'

let passed = 0
let failed = 0
const pendingTests = []

function test(name, fn) {
  const record = (ok, message) => {
    if (ok) {
      passed += 1
      console.log(`  \x1b[32mPASS\x1b[0m ${name}`)
    } else {
      failed += 1
      console.log(`  \x1b[31mFAIL\x1b[0m ${name}`)
      console.log(`         ${message}`)
    }
  }

  try {
    const result = fn()

    if (result && typeof result.then === 'function') {
      pendingTests.push(
        result.then(
          () => record(true),
          e => record(false, e?.message || String(e)),
        ),
      )
      return
    }

    record(true)
  } catch (e) {
    record(false, e?.message || String(e))
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || 'assertEqual'}: expected ${expected}, got ${actual}`)
}

function assertTrue(cond, msg) {
  if (!cond) throw new Error(msg || 'assertTrue failed')
}

function assertFalse(cond, msg) {
  if (cond) throw new Error(msg || 'assertFalse failed')
}

// ── Tests ─────────────────────────────────────────────────────────────

console.log('\n\x1b[1m== Classification des réponses HTTP ==\x1b[0m')

test('200 → success', () => {
  assertEqual(classifyResponse(200), 'success')
})

test('201 → success', () => {
  assertEqual(classifyResponse(201), 'success')
})

test('204 → success_no_content', () => {
  assertEqual(classifyResponse(204), 'success_no_content')
})

test('401 → denied', () => {
  assertEqual(classifyResponse(401), 'denied')
})

test('403 → denied', () => {
  assertEqual(classifyResponse(403), 'denied')
})

test('500 → server_error (NOT denied)', () => {
  assertEqual(classifyResponse(500), 'server_error')
  const res = { type: 'server_error', status: 500 }
  assertFalse(isAnonymousAccessBlocked(res, false), '500 must not be treated as blocked access')
})

test('502 → server_error', () => {
  assertEqual(classifyResponse(502), 'server_error')
})

test('503 → server_error', () => {
  assertEqual(classifyResponse(503), 'server_error')
})

test('404 → not_found', () => {
  assertEqual(classifyResponse(404), 'not_found')
})

test('0 → network_error', () => {
  assertEqual(classifyResponse(0), 'network_error')
})

test('999 → unexpected', () => {
  assertEqual(classifyResponse(999), 'unexpected')
})

console.log('\n\x1b[1m== Détection d accès anonyme bloqué (tables with revoke) ==\x1b[0m')

test('401 → accès bloqué (revoke table)', () => {
  const res = { type: 'denied', status: 401, json: null }
  assertTrue(isAnonymousAccessBlocked(res, false), '401 should be blocked for revoke tables')
})

test('403 → accès bloqué (revoke table)', () => {
  const res = { type: 'denied', status: 403, json: null }
  assertTrue(isAnonymousAccessBlocked(res, false), '403 should be blocked for revoke tables')
})

test('200 [] → NON bloqué pour revoke table (revoke a échoué — FAIL)', () => {
  const res = { type: 'success', status: 200, json: [] }
  assertFalse(isAnonymousAccessBlocked(res, false), '200 [] must NOT be considered blocked for revoke tables')
})

test('200 [data] → NON bloqué (faille de sécurité)', () => {
  const res = { type: 'success', status: 200, json: [{ id: 1 }] }
  assertFalse(isAnonymousAccessBlocked(res, false), '200 [data] must NOT be considered blocked')
})

test('200 objet → NON bloqué (réponse inattendue)', () => {
  const res = { type: 'success', status: 200, json: { id: 1 } }
  assertFalse(isAnonymousAccessBlocked(res, false), '200 with object must NOT be considered blocked')
})

test('500 → NON bloqué (erreur serveur ≠ refus)', () => {
  const res = { type: 'server_error', status: 500, json: null }
  assertFalse(isAnonymousAccessBlocked(res, false), '500 must NOT be treated as blocked')
})

test('network_error → NON bloqué', () => {
  const res = { type: 'network_error', status: 0, json: null }
  assertFalse(isAnonymousAccessBlocked(res, false), 'network_error must NOT be treated as blocked')
})

console.log('\n\x1b[1m== Détection d accès anonyme bloqué (RLS filter tables: profiles) ==\x1b[0m')

test('401 → bloqué (profil RLS)', () => {
  const res = { type: 'denied', status: 401, json: null }
  assertTrue(isAnonymousAccessBlocked(res, true), '401 should be blocked for profiles')
})

test('200 [] → bloqué (RLS filter, profiles accepte 200 [])', () => {
  const res = { type: 'success', status: 200, json: [] }
  assertTrue(isAnonymousAccessBlocked(res, true), '200 [] should be blocked for profiles')
})

test('200 [data] → NON bloqué (faille RLS pour profiles)', () => {
  const res = { type: 'success', status: 200, json: [{ id: 1, email: 'leaked@taggo.com' }] }
  assertFalse(isAnonymousAccessBlocked(res, true), '200 [data] must NOT be considered blocked for profiles')
})

test('200 objet → NON bloqué (réponse inattendue)', () => {
  const res = { type: 'success', status: 200, json: { id: 1 } }
  assertFalse(isAnonymousAccessBlocked(res, true), '200 with object must NOT be considered blocked')
})

test('500 → NON bloqué (erreur serveur ≠ refus)', () => {
  const res = { type: 'server_error', status: 500, json: null }
  assertFalse(isAnonymousAccessBlocked(res, true), '500 must NOT be treated as blocked for profiles')
})

test('network_error → NON bloqué', () => {
  const res = { type: 'network_error', status: 0, json: null }
  assertFalse(isAnonymousAccessBlocked(res, true), 'network_error must NOT be treated as blocked')
})

console.log('\n\x1b[1m== Logique de nettoyage (classifyCleanup) ==\x1b[0m')

const QR_TRIGGER_MESSAGES = ['qr_codes_server_fields_are_read_only', 'qr_codes_must_be_created_as_draft']

// Case: read error during pre-check → cleanup incomplete (failure)
test('Pré-check read error (denied) → cleanup ÉCHEC (non complete)', () => {
  const preCheck = { found: false, error: 'denied', status: 401 }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: false, detail: 'empty array (200)' }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, 'should fail')
  assertTrue(result.readError, 'should be readError')
  assertFalse(result.alreadyAbsent, 'should not be alreadyAbsent')
})

test('Pré-check read error (server_error) → cleanup ÉCHEC (non complete)', () => {
  const preCheck = { found: false, error: 'server_error', status: 500 }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: false, detail: 'empty array (200)' }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, 'should fail')
  assertTrue(result.readError, 'should be readError')
})

// Case: resource already absent → counted separately
test('Pré-check already absent (detail, no error) → alreadyAbsent=true', () => {
  const preCheck = { found: false, detail: 'empty array (200)' }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: false, detail: 'empty array (200)' }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertTrue(result.success, 'should succeed (already absent)')
  assertTrue(result.alreadyAbsent, 'should be alreadyAbsent')
  assertFalse(result.readError, 'should not be readError')
  assertFalse(result.deleteFailed, 'should not be deleteFailed')
})

// Case: DELETE 200 + post-read confirms absence → success
test('DELETE 200 + post-read confirms absence → success', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' } }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: false, detail: 'empty array (200)' }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertTrue(result.success, 'should succeed')
  assertFalse(result.alreadyAbsent, 'should not be alreadyAbsent')
  assertFalse(result.readError, 'should not be readError')
  assertFalse(result.deleteFailed, 'should not be deleteFailed')
})

// Case: DELETE 204 + post-read confirms absence → success
test('DELETE 204 + post-read confirms absence → success', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' } }
  const delRes = { type: 'success_no_content', status: 204 }
  const verifyDel = { found: false, detail: '204 no content' }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertTrue(result.success, 'should succeed')
})

// Case: DELETE 200 + resource still found → failure
test('DELETE 200 + resource still found → ÉCHEC', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' } }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: true, data: { id: 'abc' } }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, 'should fail if resource still exists')
  assertTrue(result.deleteFailed, 'should be deleteFailed')
})

// Case: DELETE 401 (denied) → failure
test('DELETE 401 refusé → ÉCHEC', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' } }
  const delRes = { type: 'denied', status: 401 }
  const verifyDel = { found: false, detail: 'empty array (200)' }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, 'should fail if DELETE was denied')
  assertTrue(result.deleteFailed, 'should be deleteFailed')
})

// Case: post-read error → failure (don't conflate error with absence)
test('DELETE 200 + post-read error → ÉCHEC (ne pas confondre erreur et absence)', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' } }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: false, error: 'denied', status: 401 }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, 'should fail if post-read was a read error')
})

test('DELETE 200 + post-read error (server_error) → ÉCHEC', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' } }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: false, error: 'server_error', status: 500 }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, '500 read error must not be confused with deletion')
})

// Case: post-read absence non confirmée (no detail) → failure
test('DELETE 200 + post-read found=false sans detail → ÉCHEC (absence non confirmée)', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' } }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: false, error: undefined }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, 'absence must be confirmed via detail field')
})

// Case: pre-check inconclusive (found=false, no error, no detail) → failure
test('Pré-check inconclus → ÉCHEC', () => {
  const preCheck = { found: false, error: undefined }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: false, detail: 'empty array (200)' }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, 'inconclusive pre-check should fail')
  assertTrue(result.deleteFailed, 'inconclusive pre-check should be deleteFailed')
  assertFalse(result.readError, 'inconclusive pre-check should NOT be readError')
})

console.log('\n\x1b[1m== classifyPreCheck: pré-vérification de sécurité ==\x1b[0m')

test('Pre-check: found + id match + no ambiguity → prêt à DELETE', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' }, ambiguous: false }
  const result = classifyPreCheck(preCheck)
  assertFalse(result.alreadyAbsent, 'should not be alreadyAbsent')
  assertFalse(result.readError, 'should not be readError')
  assertFalse(result.inconclusive, 'should not be inconclusive')
  assertTrue(result.found === true, 'should have found=true')
  assertFalse(result.ambiguous, 'should not be ambiguous')
})

test('Pre-check: found + ambiguous=true → AMBIGÜITÉ (ne pas supprimer)', () => {
  const preCheck = { found: true, data: { id: 'first' }, ambiguous: true }
  const result = classifyPreCheck(preCheck)
  assertFalse(result.alreadyAbsent, 'should not be alreadyAbsent')
  assertFalse(result.readError, 'should not be readError')
  assertTrue(result.found === true, 'resource found')
  assertTrue(result.ambiguous, 'should be ambiguous')
  // In main loop: ambiguous check prevents DELETE
  // Test verifies the flag is propagated
})

test('Pre-check: id mismatch (tracked ≠ found) → safety check fails', () => {
  const preCheck = { found: true, data: { id: 'different-id', public_id: 'TGG-TEST' }, ambiguous: false }
  const result = classifyPreCheck(preCheck)
  assertTrue(result.found === true, 'resource found')
  // The main loop checks preCheck.data.id !== resource.id before DELETE
  // This test verifies the data structure exposes the id for comparison
  assertEqual(result.data.id, 'different-id', 'id from pre-check')
})

test('Pre-check: already absent → alreadyAbsent=true', () => {
  const preCheck = { found: false, detail: 'empty array (200)' }
  const result = classifyPreCheck(preCheck)
  assertTrue(result.alreadyAbsent, 'should be alreadyAbsent')
  assertFalse(result.readError, 'should not be readError')
})

test('Pre-check: read error → readError=true', () => {
  const preCheck = { found: false, error: 'denied', status: 401 }
  const result = classifyPreCheck(preCheck)
  assertTrue(result.readError, 'should be readError')
  assertFalse(result.alreadyAbsent, 'should not be alreadyAbsent')
  assertFalse(result.inconclusive, 'should not be inconclusive')
})

test('Pre-check: inconclusive → inconclusive=true', () => {
  const preCheck = { found: false, error: undefined }
  const result = classifyPreCheck(preCheck)
  assertTrue(result.inconclusive, 'should be inconclusive')
  assertFalse(result.alreadyAbsent, 'should not be alreadyAbsent')
  assertFalse(result.readError, 'should not be readError')
})

console.log('\n\x1b[1m== Scénarios de nettoyage réels (classifyCleanup end-to-end) ===\x1b[0m')

test('Scénario: ressource créée, DELETE 200, post-read absente → cleanup OK', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' }, ambiguous: false }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: false, detail: 'empty array (200)' }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertTrue(result.success, 'should succeed')
  assertFalse(result.alreadyAbsent, 'should not be alreadyAbsent')
})

test('Scénario: ressource créée, DELETE 500, post-read trouvée → ÉCHEC', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' }, ambiguous: false }
  const delRes = { type: 'server_error', status: 500 }
  const verifyDel = { found: true, data: { id: 'abc' } }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, 'should fail')
  assertTrue(result.deleteFailed, 'should be deleteFailed')
})

test('Scénario: ressources multiples — 1 orpheine read-error, 1 OK → cleanupFailed=1', () => {
  // Simulate the multi-resource scenario where one has a read error
  const preChecks = [
    { found: true, data: { id: 'abc', public_id: 'TGG-A' }, ambiguous: false },
    { found: false, error: 'server_error', status: 500 },
  ]
  const delResList = [
    { type: 'success', status: 200 },
    null, // not deleted due to read error
  ]
  const verifyDels = [
    { found: false, detail: 'empty array (200)' },
    null,
  ]

  let cleanupFailed = 0
  for (let i = 0; i < preChecks.length; i++) {
    const result = classifyCleanup(delResList[i], verifyDels[i], preChecks[i])
    if (!result.success) cleanupFailed += 1
  }
  assertTrue(cleanupFailed === 1, `expected 1 failure, got ${cleanupFailed}`)
})

console.log('\n\x1b[1m== Logique de création orpheline (handleOrphanCreation) ===\x1b[0m')

test('Création 201 + response avec id et public_id → succès (pas orpheine)', () => {
  const createQr = { type: 'success', status: 201, json: [{ id: 'abc', public_id: 'TGG-TEST' }] }
  const result = handleOrphanCreation(createQr, null)
  assertTrue(result.handled, 'should be handled')
  assertFalse(result.orphan, 'should not be orphan')
  assertEqual(result.id, 'abc')
  assertEqual(result.publicId, 'TGG-TEST')
})

test('Création 201 + response sans id mais public_id + retry OK → succès (pas orpheine)', () => {
  const createQr = { type: 'success', status: 201, json: [{ public_id: 'TGG-NOID' }] }
  const retryResult = { found: true, data: { id: 'recovered-id', public_id: 'TGG-NOID', status: 'draft' }, ambiguous: false }
  const result = handleOrphanCreation(createQr, retryResult)
  assertTrue(result.handled, 'should be handled via retry')
  assertFalse(result.orphan, 'should not be orphan')
  assertEqual(result.id, 'recovered-id')
  assertEqual(result.publicId, 'TGG-NOID')
})

test('Création 201 + response sans id + retry non trouvé → ORPHEINE', () => {
  const createQr = { type: 'success', status: 201, json: [{ public_id: 'TGG-NOID' }] }
  const retryResult = { found: false, detail: 'empty array (200)' }
  const result = handleOrphanCreation(createQr, retryResult)
  assertFalse(result.handled, 'should not be handled')
  assertTrue(result.orphan, 'should be orphan')
})

test('Création 201 + response sans id + retry AMBIGU → ORPHEINE (ambigüité)', () => {
  const createQr = { type: 'success', status: 201, json: [{ public_id: 'TGG-NOID' }] }
  const retryResult = { found: true, data: { id: 'first' }, ambiguous: true }
  const result = handleOrphanCreation(createQr, retryResult)
  assertFalse(result.handled, 'should not be handled')
  assertTrue(result.orphan, 'should be orphan (ambiguous)')
})

test('Création 201 + response sans id ni public_id → ORPHEINE', () => {
  const createQr = { type: 'success', status: 201, json: [{ title: 'No IDs' }] }
  const result = handleOrphanCreation(createQr, null)
  assertFalse(result.handled, 'should not be handled')
  assertTrue(result.orphan, 'should be orphan')
})

test('Création 400/403 → échec (pas de création, pas orpheine)', () => {
  const createQr = { type: 'denied', status: 403, json: null }
  const result = handleOrphanCreation(createQr, null)
  assertFalse(result.handled, 'should not be handled')
  assertFalse(result.orphan, 'should not be orphan (no creation attempt succeeded)')
})

test('Création 200 (pas 201) → échec (pas de création)', () => {
  const createQr = { type: 'success', status: 200, json: [] }
  const result = handleOrphanCreation(createQr, null)
  assertFalse(result.handled, 'should not be handled')
  assertFalse(result.orphan, 'should not be orphan')
})

console.log('\n\x1b[1m== PATCH protégé: refus explicite vs silencieux vs 500 trigger ==\x1b[0m')

test('PATCH denied (403) + valeur inchangée → refusé correct', () => {
  const attempt = { type: 'denied', status: 403, json: null, text: '' }
  const result = classifyPatchProtection(attempt, true, true, true, QR_TRIGGER_MESSAGES)
  assertTrue(result.denied, 'should be denied')
  assertTrue(result.readsOk, 'reads should be OK')
})

test('PATCH 200 + tableau vide + valeur inchangée → refus silencieux (RLS)', () => {
  const attempt = { type: 'success', status: 200, json: [], text: '' }
  const result = classifyPatchProtection(attempt, true, true, true, QR_TRIGGER_MESSAGES)
  assertTrue(result.isSilent, 'should be silent denial')
  assertTrue(result.denied, 'should be considered denied')
})

test('PATCH 500 + message trigger + lectures OK + valeur inchangée → refus via trigger (acceptable)', () => {
  const attempt = { type: 'server_error', status: 500, json: null, text: 'ERROR: qr_codes_server_fields_are_read_only' }
  const result = classifyPatchProtection(attempt, true, true, true, QR_TRIGGER_MESSAGES)
  assertTrue(result.isTriggerRaise, 'should be trigger raise')
  assertTrue(result.denied, 'should be considered denied')
})

test('PATCH 500 + message trigger + valeur CHANGÉE → ÉCHEC (500 + changement ≠ protection)', () => {
  const attempt = { type: 'server_error', status: 500, json: null, text: 'ERROR: qr_codes_server_fields_are_read_only' }
  const result = classifyPatchProtection(attempt, true, true, false, QR_TRIGGER_MESSAGES)
  assertFalse(result.isTriggerRaise, '500 with changed value must NOT be trigger denial')
  assertFalse(result.denied, 'should NOT be considered denied')
})

test('PATCH 500 + message trigger + lecture avant échouée → ÉCHEC', () => {
  const attempt = { type: 'server_error', status: 500, json: null, text: 'ERROR: qr_codes_server_fields_are_read_only' }
  const result = classifyPatchProtection(attempt, false, true, true, QR_TRIGGER_MESSAGES)
  assertFalse(result.isTriggerRaise, '500 with failed pre-read must NOT be trigger denial')
})

test('PATCH 500 + message trigger + lecture après échouée → ÉCHEC', () => {
  const attempt = { type: 'server_error', status: 500, json: null, text: 'ERROR: qr_codes_server_fields_are_read_only' }
  const result = classifyPatchProtection(attempt, true, false, true, QR_TRIGGER_MESSAGES)
  assertFalse(result.isTriggerRaise, '500 with failed post-read must NOT be trigger denial')
})

test('PATCH 500 + message trigger DIFFÉRENT → ÉCHEC (message non correspondant)', () => {
  const attempt = { type: 'server_error', status: 500, json: null, text: 'ERROR: some_other_error' }
  const result = classifyPatchProtection(attempt, true, true, true, QR_TRIGGER_MESSAGES)
  assertFalse(result.isTriggerRaise, '500 with non-matching message must NOT be trigger denial')
})

test('PATCH 500 + message trigger MAIS value changed → ÉCHEC', () => {
  const attempt = { type: 'server_error', status: 500, json: null, text: 'ERROR: qr_codes_must_be_created_as_draft' }
  const result = classifyPatchProtection(attempt, true, true, false, QR_TRIGGER_MESSAGES)
  assertFalse(result.isTriggerRaise, '500 trigger but value changed must NOT be accepted')
})

test('PATCH 200 + objet non-array → ÉCHEC (200 non interprétable)', () => {
  const attempt = { type: 'success', status: 200, json: { id: 1 }, text: '' }
  const result = classifyPatchProtection(attempt, true, true, true, QR_TRIGGER_MESSAGES)
  assertFalse(result.isSilent, '200 with object must NOT be silent denial')
  assertFalse(result.denied, '200 with object must NOT be considered denied')
})

test('PATCH 200 + tableau non-vide → ÉCHEC (écriture a réussi)', () => {
  const attempt = { type: 'success', status: 200, json: [{ id: 1, title: 'TGG-VOL' }], text: '' }
  const result = classifyPatchProtection(attempt, true, true, false, QR_TRIGGER_MESSAGES)
  assertFalse(result.isSilent, '200 with rows should not be silent')
  assertFalse(result.denied, '200 with rows should not be considered denied')
})

test('PATCH 200 + tableau vide mais valeur CHANGÉE → ÉCHEC', () => {
  const attempt = {
    type: 'success',
    status: 200,
    json: [],
    text: '',
  }

  const result = classifyPatchProtection(
    attempt,
    true,
    true,
    false,
    QR_TRIGGER_MESSAGES,
  )

  assertTrue(result.isSilent, 'la réponse doit être classée silencieuse')
  assertFalse(
    result.stateVerified,
    'la valeur modifiée ne peut pas être considérée comme inchangée',
  )
  assertFalse(
    result.denied,
    'une valeur modifiée ne doit jamais prouver la protection',
  )
})

test('PATCH 204 sans contenu → refus non prouvé', () => {
  const attempt = {
    type: 'success_no_content',
    status: 204,
    json: null,
    text: '',
  }

  const result = classifyPatchProtection(
    attempt,
    true,
    true,
    true,
    QR_TRIGGER_MESSAGES,
  )

  assertFalse(result.isSilent, '204 ne doit pas être classé comme refus silencieux')
  assertFalse(result.isTriggerRaise, '204 ne doit pas être classé comme erreur trigger')
  assertFalse(result.denied, '204 seul ne prouve pas un refus')
})

test('PATCH 403 mais lecture avant échouée → ÉCHEC', () => {
  const attempt = { type: 'denied', status: 403, json: null, text: '' }
  const result = classifyPatchProtection(attempt, false, true, true, QR_TRIGGER_MESSAGES)
  assertFalse(result.denied, 'failed pre-read must not prove protection')
})

test('PATCH 403 mais lecture après échouée → refus non prouvé', () => {
  const attempt = {
    type: 'denied',
    status: 403,
    json: null,
    text: '',
  }

  const result = classifyPatchProtection(
    attempt,
    true,
    false,
    true,
    QR_TRIGGER_MESSAGES,
  )

  assertFalse(result.readsOk, 'la lecture après doit être considérée comme invalide')
  assertFalse(result.denied, 'une lecture après échouée ne prouve pas la protection')
})

test('PATCH 400 → ÉCHEC, ce n’est pas un refus de sécurité prouvé', () => {
  const attempt = { type: 'client_error', status: 400, json: null, text: '' }
  const result = classifyPatchProtection(attempt, true, true, true, QR_TRIGGER_MESSAGES)
  assertFalse(result.denied, '400 must not count as proof of protection')
})

console.log('\n\x1b[1m== PATCH protégé profiles.email: trigger message matching ==\x1b[0m')

const PROFILE_TRIGGER_MESSAGES = ['profile_email_is_read_only', 'profile_owner_email_cannot_be_modified']

test('PATCH email 500 + trigger message + OK reads + unchanged → refus acceptable', () => {
  const attempt = { type: 'server_error', status: 500, json: null, text: 'ERROR: profile_email_is_read_only' }
  const result = classifyPatchProtection(attempt, true, true, true, PROFILE_TRIGGER_MESSAGES)
  assertTrue(result.isTriggerRaise, 'should be trigger raise')
  assertTrue(result.denied, 'should be considered denied')
})

test('PATCH email 500 + message non correspondant → ÉCHEC', () => {
  const attempt = { type: 'server_error', status: 500, json: null, text: 'ERROR: some_other_error' }
  const result = classifyPatchProtection(attempt, true, true, true, PROFILE_TRIGGER_MESSAGES)
  assertFalse(result.isTriggerRaise, 'should NOT be trigger raise with non-matching message')
})

test('PATCH email 500 + message trigger + valeur CHANGÉE → ÉCHEC', () => {
  const attempt = { type: 'server_error', status: 500, json: null, text: 'ERROR: profile_email_is_read_only' }
  const result = classifyPatchProtection(attempt, true, true, false, PROFILE_TRIGGER_MESSAGES)
  assertFalse(result.isTriggerRaise, '500 with changed value must NOT be accepted for email')
  assertFalse(result.denied, 'should NOT be considered denied')
})

console.log('\n\x1b[1m== PATCH inter-utilisateurs (classifyCrossUserPatch) ==\x1b[0m')

function crossUserRow(title, ownerId) {
  return {
    status: 200,
    json: [{ id: 'abc', owner_id: ownerId, title }],
  }
}

test('PATCH 403 explicite + état inchangé → refus prouvé', () => {
  const before = crossUserRow('Titre initial', 'user-a')
  const attempt = { type: 'denied', status: 403, json: null, text: '' }
  const after = crossUserRow('Titre initial', 'user-a')
  const result = classifyCrossUserPatch(before, attempt, after)
  assertTrue(result.readsOk, 'les deux lectures doivent être valides')
  assertTrue(result.stateVerified, 'id, propriétaire et titre doivent être inchangés')
  assertTrue(result.denied, 'un refus explicite avec état inchangé prouve la protection')
  assertFalse(result.modified, 'aucune modification ne doit être détectée')
})

test('PATCH 200 + tableau vide + état inchangé → refus silencieux prouvé', () => {
  const before = crossUserRow('Titre initial', 'user-a')
  const attempt = { type: 'success', status: 200, json: [], text: '' }
  const after = crossUserRow('Titre initial', 'user-a')
  const result = classifyCrossUserPatch(before, attempt, after)
  assertTrue(result.stateVerified, 'état inchangé')
  assertTrue(result.denied, '200 avec tableau vide et état inchangé prouve le refus')
})

test('PATCH 200 + ligne retournée → écriture réussie, protection non prouvée', () => {
  const before = crossUserRow('Titre initial', 'user-a')
  const attempt = {
    type: 'success',
    status: 200,
    json: [{ id: 'abc', owner_id: 'user-a', title: 'Tentative de modification interdite' }],
    text: '',
  }
  const after = crossUserRow('Tentative de modification interdite', 'user-a')
  const result = classifyCrossUserPatch(before, attempt, after)
  assertFalse(result.denied, 'une ligne retournée prouve que l’écriture a réussi')
  assertTrue(result.modified, 'une ligne retournée indique une modification')
})

test('titre modifié après la tentative → protection non prouvée', () => {
  const before = crossUserRow('Titre initial', 'user-a')
  const attempt = { type: 'success', status: 200, json: [], text: '' }
  const after = crossUserRow('Titre modifié', 'user-a')
  const result = classifyCrossUserPatch(before, attempt, after)
  assertFalse(result.titleUnchanged, 'le titre a changé')
  assertFalse(result.stateVerified, 'l’état n’est pas vérifié')
  assertFalse(result.denied, 'un titre modifié ne prouve jamais la protection')
})

test('lecture après tentative impossible → protection non prouvée', () => {
  const before = crossUserRow('Titre initial', 'user-a')
  const attempt = { type: 'denied', status: 403, json: null, text: '' }
  const after = { status: 500, json: null, text: 'server error' }
  const result = classifyCrossUserPatch(before, attempt, after)
  assertFalse(result.readsOk, 'la lecture après est invalide')
  assertFalse(result.stateVerified, 'l’état n’est pas vérifié')
  assertFalse(result.denied, 'une lecture impossible ne prouve pas la protection')
})

test('erreur réseau (status 0) → protection non prouvée', () => {
  const before = crossUserRow('Titre initial', 'user-a')
  const attempt = { type: 'network_error', status: 0, json: null, text: 'fetch failed' }
  const after = crossUserRow('Titre initial', 'user-a')
  const result = classifyCrossUserPatch(before, attempt, after)
  assertFalse(result.denied, 'une erreur réseau ne prouve pas la protection')
})

test('HTTP 500 → protection non prouvée', () => {
  const before = crossUserRow('Titre initial', 'user-a')
  const attempt = { type: 'server_error', status: 500, json: null, text: 'ERROR: internal' }
  const after = crossUserRow('Titre initial', 'user-a')
  const result = classifyCrossUserPatch(before, attempt, after)
  assertFalse(result.denied, 'un HTTP 5xx ne prouve pas la protection')
})

console.log('\n\x1b[1m== Vérification des références de migration ==\x1b[0m')

const migrationFiles = {
  '20260922000000': fs.readFileSync('supabase/migrations/20260922000000_initial_schema.sql', 'utf8'),
  '20260922002000': fs.readFileSync('supabase/migrations/20260922002000_taggo_lifecycle.sql', 'utf8'),
  '20260928004000': fs.readFileSync('supabase/migrations/20260928004000_orders.sql', 'utf8'),
  '20260931000000': fs.readFileSync('supabase/migrations/20260931000000_taggo_scans.sql', 'utf8'),
  '20260931100000': fs.readFileSync('supabase/migrations/20260931100000_taggo_subscriptions.sql', 'utf8'),
  '20260931110000': fs.readFileSync('supabase/migrations/20260931110000_taggo_write_protection.sql', 'utf8'),
  '20260931120000': fs.readFileSync('supabase/migrations/20260931120000_public_taggo_exposure.sql', 'utf8'),
  '20260931130000': fs.readFileSync('supabase/migrations/20260931130000_taggo_hardening_followup.sql', 'utf8'),
  '20260931140000': fs.readFileSync('supabase/migrations/20260931140000_security_regressions.sql', 'utf8'),
  '20260931141000': fs.readFileSync('supabase/migrations/20260931141000_step141_security_corrections.sql', 'utf8'),
}

function getLine(fileKey, lineNum) {
  return migrationFiles[fileKey].split('\n')[lineNum - 1] || ''
}

test('20260922000000:283 — activate_taggo grant to authenticated only', () => {
  const line = getLine('20260922000000', 283)
  assertTrue(line.includes('grant execute on function public.activate_taggo'),
    `Expected grant activate_taggo at line 283, got: "${line}"`)
  assertTrue(!line.includes('anon'),
    'activate_taggo should NOT be granted to anon')
})

test('20260931100000:1053 — get_public_taggo_state grant to anon', () => {
  const line = getLine('20260931100000', 1053)
  assertTrue(line.includes('grant execute on function public.get_public_taggo_state') && line.includes('anon'),
    `Expected grant to anon at line 1053, got: "${line}"`)
})

test('20260931130000:323 — public_taggo_is_visible grant to anon', () => {
  const line = getLine('20260931130000', 323)
  assertTrue(line.includes('grant') && line.includes('public_taggo_is_visible') && line.includes('anon'),
    `Expected grant to anon at line 323, got: "${line}"`)
})

test('20260931130000:248 — revoke all on qr_codes from anon', () => {
  const line = getLine('20260931130000', 248)
  assertTrue(line.includes('revoke all on public.qr_codes from anon'),
    `Expected revoke at line 248, got: "${line}"`)
})

test('20260931130000:276 — revoke all on subscriptions from anon (not 277)', () => {
  const line276 = getLine('20260931130000', 276)
  const line277 = getLine('20260931130000', 277)
  assertTrue(line276.includes('revoke all on public.subscriptions from anon'),
    `Expected revoke anon at line 276, got: "${line276}"`)
  assertTrue(line277.includes('authenticated'),
    `Line 277 should mention authenticated, got: "${line277}"`)
})

test('20260931110000:61 — trigger checks status=draft, is_public=false on INSERT', () => {
  const line = getLine('20260931110000', 61)
  assertTrue(line.includes("new.status <> 'draft'") && line.includes('new.is_public'),
    `Expected trigger INSERT guard at line 61, got: "${line}"`)
})

test('20260931110000:110 — revoke update on qr_codes from authenticated', () => {
  const line = getLine('20260931110000', 110)
  assertTrue(line.includes('revoke update on public.qr_codes from anon, authenticated'),
    `Expected revoke update at line 110, got: "${line}"`)
})

test('20260931110000:86 — trigger checks current_user for UPDATE', () => {
  const line = getLine('20260931110000', 86)
  assertTrue(line.includes('current_user'),
    `Expected current_user check at line 86, got: "${line}"`)
})

test('20260931140000:127 — delete guard trigger on qr_codes', () => {
  const line = getLine('20260931140000', 127)
  assertTrue(line.includes('drop trigger') && line.includes('trg_taggo_delete_guard'),
    `Expected trigger drop at line 127, got: "${line}"`)
  const line128 = getLine('20260931140000', 128)
  assertTrue(line128.includes('create trigger trg_taggo_delete_guard'),
    `Expected trigger create at line 128, got: "${line128}"`)
})

console.log('\n\x1b[1m== Résumé de nettoyage (scénario multi-ressources) ==\x1b[0m')

test('Scénario: 2 ressources — 1 déjà absente, 1 nettoyée → cleanupFailed=0', () => {
  const resources = [
    { publicId: 'TGG-ABSENT', id: null },
    { publicId: 'TGG-CLEAN', id: 'abc' },
  ]

  const preChecks = [
    { found: false, detail: 'empty array (200)' },  // already absent
    { found: true, data: { id: 'abc', public_id: 'TGG-CLEAN' } },  // exists
  ]
  const delResList = [
    null,  // not deleted (already absent)
    { type: 'success', status: 200 },  // deleted OK
  ]
  const verifyDels = [
    null,  // not verified (already absent)
    { found: false, detail: 'empty array (200)' },  // confirmed absent
  ]

  let cleanedUp = 0
  let cleanupFailed = 0
  let cleanupAlreadyAbsent = 0
  let cleanupReadError = 0

  for (let i = 0; i < resources.length; i++) {
    const result = classifyCleanup(delResList[i], verifyDels[i], preChecks[i])
    if (result.alreadyAbsent) cleanupAlreadyAbsent += 1
    if (result.readError) cleanupReadError += 1
    if (result.success && !result.alreadyAbsent) cleanedUp += 1
    if (!result.success) cleanupFailed += 1
  }

  assertTrue(cleanupFailed === 0, `expected 0 failures, got ${cleanupFailed}`)
  assertTrue(cleanedUp === 1, `expected 1 cleaned, got ${cleanedUp}`)
  assertTrue(cleanupAlreadyAbsent === 1, `expected 1 already absent, got ${cleanupAlreadyAbsent}`)
})

test('Scénario: 1 ressource — lecture erreur pré-check → cleanupFailed=1, validation échoue', () => {
  const preCheck = { found: false, error: 'server_error', status: 500 }
  const delRes = { type: 'success', status: 200 }
  const verifyDel = { found: false, detail: 'empty array (200)' }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, 'cleanup should fail due to read error')
  assertTrue(result.readError, 'should be marked as readError')
  assertTrue(1 > 0 && !result.success, 'overall cleanup check should fail')
})

test('Scénario: 1 ressource — DELETE failed (500), post-read found → cleanupFailed=1', () => {
  const preCheck = { found: true, data: { id: 'abc', public_id: 'TGG-TEST' } }
  const delRes = { type: 'server_error', status: 500, text: 'ERROR: qr_codes_server_fields_are_read_only' }
  const verifyDel = { found: true, data: { id: 'abc' } }
  const result = classifyCleanup(delRes, verifyDel, preCheck)
  assertFalse(result.success, 'cleanup should fail if DELETE 500 and resource still found')
  assertTrue(result.deleteFailed, 'should be marked as deleteFailed')
})

console.log('\n\x1b[1m== Nettoyage après erreur (createCleanupGuard) ==\x1b[0m')

test('nettoyage exécuté après une erreur inattendue', async () => {
  const cleaned = []
  const resources = [{ id: 'abc', publicId: 'TGG-A', token: 'jwt-a' }]
  const runCleanup = createCleanupGuard(resources, async item => {
    cleaned.push(item.publicId)
  })

  let propagated = null

  try {
    try {
      throw new Error('erreur inattendue pendant les tests')
    } finally {
      await runCleanup()
    }
  } catch (error) {
    propagated = error
  }

  assertEqual(cleaned.length, 1, 'le nettoyage doit s’exécuter malgré l’erreur')
  assertEqual(
    propagated?.message,
    'erreur inattendue pendant les tests',
    'l’erreur initiale doit être propagée',
  )
})

test('plusieurs ressources : l’échec de la première n’empêche pas la seconde', async () => {
  const cleaned = []
  const signaled = []
  const resources = [
    { id: 'abc', publicId: 'TGG-A', token: 'jwt-a' },
    { id: 'def', publicId: 'TGG-B', token: 'jwt-b' },
  ]
  const runCleanup = createCleanupGuard(
    resources,
    async item => {
      if (item.publicId === 'TGG-A') {
        throw new Error('échec inattendu')
      }
      cleaned.push(item.publicId)
    },
    (item, error) => {
      signaled.push(`${item.publicId}: ${error.message}`)
    },
  )

  const result = await runCleanup()

  assertEqual(cleaned.length, 1, 'la seconde ressource doit être nettoyée')
  assertEqual(cleaned[0], 'TGG-B')
  assertEqual(signaled.length, 1, 'l’échec doit être signalé')
  assertEqual(signaled[0], 'TGG-A: échec inattendu')
  assertEqual(result.errors.length, 1, 'le résultat expose l’erreur')
  assertEqual(result.cleaned, 1)
})

test('l’erreur initiale reste visible après le nettoyage', async () => {
  const cleaned = []
  const resources = [{ id: 'abc', publicId: 'TGG-A', token: 'jwt-a' }]
  const runCleanup = createCleanupGuard(resources, async item => {
    cleaned.push(item.publicId)
  })

  async function runTestsLikeMain() {
    try {
      throw new Error('erreur initiale')
    } finally {
      await runCleanup()
    }
  }

  let propagated = null

  try {
    await runTestsLikeMain()
  } catch (error) {
    propagated = error
  }

  assertEqual(cleaned.length, 1, 'le nettoyage doit avoir été exécuté')
  assertEqual(
    propagated?.message,
    'erreur initiale',
    'l’erreur initiale doit rester visible après le nettoyage',
  )
})

test('aucune double tentative de nettoyage', async () => {
  let attempts = 0
  const resources = [{ id: 'abc', publicId: 'TGG-A', token: 'jwt-a' }]
  const runCleanup = createCleanupGuard(resources, async () => {
    attempts += 1
  })

  const first = await runCleanup()
  const second = await runCleanup()

  assertEqual(attempts, 1, 'une seule exécution de nettoyage attendue')
  assertTrue(first.attempted === true, 'le premier appel doit être effectif')
  assertTrue(second.alreadyRun === true, 'le second appel doit être ignoré')
})

test('échec du nettoyage signalé explicitement', async () => {
  const signaled = []
  const resources = [{ id: 'abc', publicId: 'TGG-A', token: 'jwt-a' }]
  const runCleanup = createCleanupGuard(
    resources,
    async () => {
      throw new Error('impossible de supprimer')
    },
    (item, error) => {
      signaled.push(`${item.publicId}: ${error.message}`)
    },
  )

  const result = await runCleanup()

  assertEqual(signaled.length, 1, 'le signalement d’échec doit être appelé')
  assertEqual(signaled[0], 'TGG-A: impossible de supprimer')
  assertEqual(result.errors.length, 1, 'l’erreur doit figurer dans le résultat')
  assertTrue(result.cleaned === 0, 'aucune ressource n’a été nettoyée')
})

test('success: false n’est pas compté comme un nettoyage réussi', async () => {
  const cleaned = []
  const signaled = []
  const resources = [
    { id: 'abc', publicId: 'TGG-A', token: 'jwt-a' },
    { id: 'def', publicId: 'TGG-B', token: 'jwt-b' },
  ]
  const runCleanup = createCleanupGuard(
    resources,
    async item => {
      if (item.publicId === 'TGG-A') {
        return { success: false, detail: 'lecture non concluante' }
      }
      cleaned.push(item.publicId)
      return { success: true }
    },
    (item, error) => {
      signaled.push(`${item.publicId}: ${error.message}`)
    },
  )

  const result = await runCleanup()

  assertEqual(cleaned.length, 1, 'la seconde ressource doit être nettoyée')
  assertEqual(signaled.length, 1, 'l’échec doit être signalé')
  assertEqual(signaled[0], 'TGG-A: lecture non concluante')
  assertEqual(result.cleaned, 1, 'seule la seconde ressource compte')
  assertEqual(result.errors.length, 1, 'le résultat expose l’erreur')
})

async function summarize() {
  await Promise.all(pendingTests)

  console.log('\n\x1b[1m== Résultats ==\x1b[0m')
  console.log(`  \x1b[32mPASS\x1b[0m ${passed}`)
  if (failed > 0) console.log(`  \x1b[31mFAIL\x1b[0m ${failed}`)
  console.log(`  Total: ${passed + failed}`)
  process.exit(failed === 0 ? 0 : 1)
}

summarize()