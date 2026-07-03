/**
 * batchFunctions.js
 * ------------------------------------------------------------
 * Callable functions for creating batches and generating the
 * unique code records that belong to them. This is where the
 * "create a batch of 5,000 products, get 5,000 unique QR-ready
 * codes back" behavior from the spec lives.
 * ------------------------------------------------------------
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireAdmin } = require('./adminAuth');
const { generateUniqueCodes } = require('./codeGenerator');

const FIRESTORE_BATCH_WRITE_LIMIT = 500; // hard Firestore limit per batch write
const MAX_CODES_PER_REQUEST = 20000; // sane upper bound per single generation call

/**
 * createBatch
 * ------------------------------------------------------------
 * Creates a batch record AND generates all of its unique codes
 * in one call. This matches the spec: create a batch, specify
 * quantity, get that many unique authentication records
 * automatically.
 *
 * Input:
 *   {
 *     batchNumber: "CHRGE10000-2026-07-A",
 *     productID: "prod_abc123",
 *     quantity: 5000,
 *     factory: "Shenzhen Facility 3",
 *     notes: "First production run"
 *   }
 *
 * Output:
 *   { batchID, codesGenerated, secureIDs: [...] }
 *   (secureIDs returned so the caller can immediately kick off
 *   sticker/PDF generation without a second round-trip read)
 */
const createBatch = onCall({ region: 'us-central1' }, async (request) => {
  const auth = requireAdmin(request);
  const db = getFirestore();

  const { batchNumber, productID, quantity, factory, notes, date } = request.data || {};

  // ---- Input validation ----
  if (!batchNumber || typeof batchNumber !== 'string' || batchNumber.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'batchNumber is required.');
  }
  if (!productID || typeof productID !== 'string') {
    throw new HttpsError('invalid-argument', 'productID is required.');
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CODES_PER_REQUEST) {
    throw new HttpsError(
      'invalid-argument',
      `quantity must be a whole number between 1 and ${MAX_CODES_PER_REQUEST}.`
    );
  }

  // ---- Verify the product actually exists ----
  const productSnap = await db.collection('products').doc(productID).get();
  if (!productSnap.exists) {
    throw new HttpsError('not-found', `No product found with ID ${productID}.`);
  }

  // ---- Prevent duplicate batch numbers ----
  const existingBatch = await db.collection('batches')
    .where('batchNumber', '==', batchNumber.trim())
    .limit(1)
    .get();
  if (!existingBatch.empty) {
    throw new HttpsError('already-exists', `Batch number "${batchNumber}" already exists.`);
  }

  // ---- Create the batch record ----
  const batchRef = db.collection('batches').doc();
  await batchRef.set({
    batchNumber: batchNumber.trim(),
    productID,
    quantity,
    factory: factory || null,
    notes: notes || null,
    date: date || FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: auth.uid,
    codesGenerated: 0,
    codesGeneratedAt: null,
    status: 'generating'
  });

  // ---- Generate the unique codes (crypto-secure, collision-checked) ----
  let codes;
  try {
    codes = await generateUniqueCodes(quantity);
  } catch (err) {
    await batchRef.update({ status: 'generation_failed', error: String(err.message || err) });
    throw new HttpsError('internal', `Code generation failed: ${err.message}`);
  }

  // ---- Write all code documents, chunked to Firestore's 500/batch limit ----
  const now = FieldValue.serverTimestamp();
  let written = 0;
  for (let i = 0; i < codes.length; i += FIRESTORE_BATCH_WRITE_LIMIT) {
    const chunk = codes.slice(i, i + FIRESTORE_BATCH_WRITE_LIMIT);
    const writeBatch = db.batch();

    for (const { secureID, publicCode } of chunk) {
      // secureID IS the document ID — this makes verification a
      // direct doc.get() by ID (fast, no query needed) rather than
      // a where() lookup, which matters at scale.
      const codeRef = db.collection('codes').doc(secureID);
      writeBatch.set(codeRef, {
        secureID,
        publicCode,
        batchID: batchRef.id,
        batchNumber: batchNumber.trim(),
        productID,
        createdAt: now,
        printed: false,
        printedAt: null,
        verified: false,
        verificationDate: null,
        verificationLocation: null,
        scanCount: 0,
        lastScan: null,
        status: 'active' // active | disabled | blacklisted | transferred
      });
    }

    await writeBatch.commit();
    written += chunk.length;
  }

  await batchRef.update({
    codesGenerated: written,
    codesGeneratedAt: FieldValue.serverTimestamp(),
    status: 'ready'
  });

  return {
    batchID: batchRef.id,
    batchNumber: batchNumber.trim(),
    codesGenerated: written,
    secureIDs: codes.map(c => c.secureID),
    publicCodes: codes.map(c => c.publicCode)
  };
});

/**
 * listBatches
 * ------------------------------------------------------------
 * Paginated batch listing for the dashboard. Firestore rules
 * already restrict `batches` reads to admins, but we also expose
 * this as a callable so the client can request enriched data
 * (e.g. joined product names) in one round trip instead of N+1
 * reads from the client.
 */
const listBatches = onCall({ region: 'us-central1' }, async (request) => {
  requireAdmin(request);
  const db = getFirestore();
  const { limit = 50, startAfterID = null } = request.data || {};

  const cappedLimit = Math.min(Math.max(1, limit), 200);

  let q = db.collection('batches').orderBy('createdAt', 'desc').limit(cappedLimit);
  if (startAfterID) {
    const cursorDoc = await db.collection('batches').doc(startAfterID).get();
    if (cursorDoc.exists) {
      q = q.startAfter(cursorDoc);
    }
  }

  const snap = await q.get();
  const batches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Enrich with product names in one pass (avoids N+1 from the client)
  const productIDs = [...new Set(batches.map(b => b.productID).filter(Boolean))];
  const productMap = {};
  await Promise.all(productIDs.map(async (pid) => {
    const pSnap = await db.collection('products').doc(pid).get();
    if (pSnap.exists) productMap[pid] = pSnap.data().productName || pSnap.data().name || pid;
  }));

  const enriched = batches.map(b => ({ ...b, productName: productMap[b.productID] || 'Unknown product' }));

  return {
    batches: enriched,
    lastID: batches.length > 0 ? batches[batches.length - 1].id : null,
    hasMore: batches.length === cappedLimit
  };
});

module.exports = { createBatch, listBatches };
