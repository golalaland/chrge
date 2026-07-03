/**
 * dashboardFunctions.js
 * ------------------------------------------------------------
 * Aggregated stats for the Overview dashboard: total codes,
 * printed, verified, unused, counterfeit alerts, recent scans.
 *
 * NOTE ON SCALE: Firestore's count() aggregation query (used
 * below) is efficient even at millions of documents — it does
 * NOT read every document to count them, so this stays fast as
 * the product catalog grows into the millions as the spec
 * requires. Avoid the old anti-pattern of reading full
 * collections client-side to count — that's what actually
 * breaks at scale.
 * ------------------------------------------------------------
 */

const { onCall } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { requireAdmin } = require('./adminAuth');

const getDashboardStats = onCall({ region: 'us-central1' }, async (request) => {
  requireAdmin(request);
  const db = getFirestore();
  const codesRef = db.collection('codes');

  const [
    totalSnap,
    printedSnap,
    verifiedSnap,
    disabledSnap,
    blacklistedSnap,
    recentScansSnap,
    recentBatchesSnap,
    productsCountSnap
  ] = await Promise.all([
    codesRef.count().get(),
    codesRef.where('printed', '==', true).count().get(),
    codesRef.where('verified', '==', true).count().get(),
    codesRef.where('status', '==', 'disabled').count().get(),
    codesRef.where('status', '==', 'blacklisted').count().get(),
    db.collection('scans').orderBy('scannedAt', 'desc').limit(10).get(),
    db.collection('batches').orderBy('createdAt', 'desc').limit(5).get(),
    db.collection('products').count().get()
  ]);

  const total = totalSnap.data().count;
  const printed = printedSnap.data().count;
  const verified = verifiedSnap.data().count;
  const unused = total - verified;

  // Counterfeit alerts = scans flagged suspicious in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const alertsSnap = await db.collection('scans')
    .where('suspicious', '==', true)
    .where('scannedAt', '>=', thirtyDaysAgo)
    .count()
    .get();

  return {
    totalCodesGenerated: total,
    totalStickersPrinted: printed,
    totalVerified: verified,
    remainingUnused: unused,
    counterfeitAlerts: alertsSnap.data().count,
    disabledCodes: disabledSnap.data().count,
    blacklistedCodes: blacklistedSnap.data().count,
    totalProducts: productsCountSnap.data().count,
    recentScans: recentScansSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    recentBatches: recentBatchesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  };
});

module.exports = { getDashboardStats };
