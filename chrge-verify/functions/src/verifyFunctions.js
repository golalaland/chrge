/**
 * verifyFunctions.js
 * ------------------------------------------------------------
 * The public verification backend. This is the only part of
 * the entire system callable by unauthenticated users, so it
 * is deliberately the most defensively written file in the
 * project: rate limited, input-validated, and structured so
 * that it never leaks more information than a legitimate
 * customer needs.
 *
 * SECURITY NOTE ON PUBLIC CODE LOOKUPS: a user can verify by
 * either the full secureID (from a QR scan, effectively
 * unguessable) or the short publicCode (typed manually, ~1.1
 * trillion possible values). Both paths go through the same
 * rate limiter, so brute-forcing publicCode values is throttled
 * to 20 attempts/minute per IP — at that rate, exhausting even
 * a tiny fraction of the code space is not practical.
 * ------------------------------------------------------------
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { checkRateLimit } = require('./rateLimiter');
const { lookupIPLocation } = require('./geoLookup');
const { evaluateScanForSuspicion } = require('./counterfeitDetection');

const SECURE_ID_PATTERN = /^[0-9a-f]{64}$/;
const PUBLIC_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/**
 * verifyCode
 * ------------------------------------------------------------
 * Input: { code: string }  — either a secureID or a publicCode.
 * The caller doesn't need to specify which; we detect the format.
 *
 * Also accepts optional client-supplied context for the scan log:
 *   { userAgent: string }
 * IP is extracted server-side from the request context, never
 * trusted from client input.
 *
 * Output shapes (discriminated by `result`):
 *
 *   { result: 'invalid' }
 *
 *   { result: 'genuine_first_scan', product: {...}, batch: {...} }
 *
 *   { result: 'already_verified', product: {...},
 *     firstVerifiedAt, scanCount, firstCountry, suspicious }
 *
 *   { result: 'rate_limited' }
 *
 *   { result: 'disabled' | 'blacklisted' }
 * ------------------------------------------------------------
 */
const verifyCode = onCall({ region: 'us-central1', cors: true }, async (request) => {
  const db = getFirestore();
  const rawInput = (request.data?.code || '').trim();
  const userAgent = (request.data?.userAgent || '').slice(0, 300); // cap length defensively

  // ---- Extract caller IP ----
  // Callable functions (onCall) expose the raw request via
  // request.rawRequest, which carries the same proxy headers as
  // onRequest functions.
  const forwardedFor = request.rawRequest?.headers?.['x-forwarded-for'];
  const callerIP = forwardedFor ? forwardedFor.split(',')[0].trim() : (request.rawRequest?.ip || null);

  // ---- Rate limit BEFORE doing any real work ----
  const rateResult = await checkRateLimit(callerIP);
  if (!rateResult.allowed) {
    return { result: 'rate_limited' };
  }

  // ---- Validate input format ----
  if (!rawInput) {
    throw new HttpsError('invalid-argument', 'A code is required.');
  }

  let secureID = null;
  let publicCode = null;

  if (SECURE_ID_PATTERN.test(rawInput)) {
    secureID = rawInput;
  } else if (PUBLIC_CODE_PATTERN.test(rawInput.toUpperCase())) {
    publicCode = rawInput.toUpperCase();
  } else {
    // Doesn't match either known format — this is an invalid code,
    // not a system error. Return the same "invalid" shape a
    // well-formed-but-nonexistent code would get, so format
    // guessing doesn't leak information about what's valid.
    return { result: 'invalid' };
  }

  // ---- Look up the code ----
  let codeDoc;
  if (secureID) {
    const snap = await db.collection('codes').doc(secureID).get();
    if (!snap.exists) return { result: 'invalid' };
    codeDoc = { id: snap.id, ...snap.data() };
  } else {
    const snap = await db.collection('codes').where('publicCode', '==', publicCode).limit(1).get();
    if (snap.empty) return { result: 'invalid' };
    codeDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  // ---- Check status (disabled/blacklisted codes never pass) ----
  if (codeDoc.status === 'disabled') {
    return { result: 'disabled' };
  }
  if (codeDoc.status === 'blacklisted') {
    return { result: 'blacklisted' };
  }

  // ---- Look up product info to display ----
  const productSnap = await db.collection('products').doc(codeDoc.productID).get();
  const product = productSnap.exists ? { id: productSnap.id, ...productSnap.data() } : null;

  // ---- Geolocate this scan (best-effort, fails open) ----
  const location = await lookupIPLocation(callerIP);

  // ---- Record the scan ----
  const scanRef = db.collection('scans').doc();
  const isFirstScan = !codeDoc.verified;

  // Run suspicion evaluation for repeat scans (a first scan has no
  // history to compare against, so it's never flagged).
  let suspicionResult = { suspicious: false, reasons: [] };
  if (!isFirstScan) {
    suspicionResult = await evaluateScanForSuspicion(codeDoc.id, location, codeDoc.scanCount || 0);
  }

  await scanRef.set({
    codeID: codeDoc.id,
    publicCode: codeDoc.publicCode,
    scannedAt: FieldValue.serverTimestamp(),
    ip: callerIP, // stored for admin fraud investigation only — never returned to the public caller
    location,
    userAgent,
    suspicious: suspicionResult.suspicious,
    suspicionReasons: suspicionResult.reasons,
    isFirstScan
  });

  const codeRef = db.collection('codes').doc(codeDoc.id);

  if (isFirstScan) {
    await codeRef.update({
      verified: true,
      verificationDate: FieldValue.serverTimestamp(),
      verificationLocation: location,
      scanCount: FieldValue.increment(1),
      lastScan: FieldValue.serverTimestamp()
    });

    return {
      result: 'genuine_first_scan',
      product: product ? {
        productName: product.productName,
        brand: product.brand,
        imageURL: product.imageURL,
        color: product.color,
        capacity: product.capacity
      } : null,
      batch: { batchNumber: codeDoc.batchNumber, manufacturingDate: codeDoc.manufacturingDate || null },
      publicCode: codeDoc.publicCode
    };
  } else {
    await codeRef.update({
      scanCount: FieldValue.increment(1),
      lastScan: FieldValue.serverTimestamp()
    });

    return {
      result: 'already_verified',
      product: product ? {
        productName: product.productName,
        brand: product.brand,
        imageURL: product.imageURL,
        color: product.color,
        capacity: product.capacity
      } : null,
      firstVerifiedAt: codeDoc.verificationDate,
      scanCount: (codeDoc.scanCount || 0) + 1,
      firstCountry: codeDoc.verificationLocation?.country || null,
      suspicious: suspicionResult.suspicious,
      publicCode: codeDoc.publicCode
    };
  }
});

module.exports = { verifyCode };
