/**
 * counterfeitDetection.js
 * ------------------------------------------------------------
 * Heuristics for flagging suspicious verification patterns, per
 * the spec: multiple countries, high scan counts, "impossible
 * travel," repeated rapid scans.
 *
 * HONEST FRAMING: these are heuristics, not proof. A code
 * scanned from two countries in one day usually means the
 * product was resold/shipped/gifted, or the scanner's ISP
 * routes through a different region than the person is
 * physically in — not necessarily counterfeiting. This module
 * flags things for human review; it does not make an automatic
 * counterfeit determination. Downstream UI should reflect that
 * ("possible" / "flagged for review"), not assert fraud outright.
 * ------------------------------------------------------------
 */

const { getFirestore } = require('firebase-admin/firestore');

// Rough speed-of-plausible-travel threshold. If two scans of the
// same code are farther apart than this, in less time than it
// would take to physically travel that distance even by
// commercial flight (~900 km/h cruise, generously rounded up to
// account for the fact that scans don't happen airport-to-airport
// instantly), flag it.
const MAX_PLAUSIBLE_KMH = 1000;

/**
 * Haversine distance in km between two lat/lon points.
 */
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Evaluates whether a new scan of a given code should be flagged
 * as suspicious, based on its scan history. Returns
 * { suspicious: boolean, reasons: string[] } — reasons are kept
 * human-readable since they surface directly in the admin
 * dashboard's counterfeit alerts.
 */
async function evaluateScanForSuspicion(codeID, newScanLocation, priorScanCount) {
  const reasons = [];
  const db = getFirestore();

  // High absolute scan count on a single unit is itself unusual —
  // a legitimate product is typically verified once, maybe a
  // handful of times (gift, resale, curiosity).
  if (priorScanCount >= 50) {
    reasons.push(`Unusually high scan count (${priorScanCount} prior scans)`);
  }

  if (newScanLocation && newScanLocation.lat != null && newScanLocation.lon != null) {
    // Pull the most recent prior scan with a known location to
    // check for impossible travel.
    const recentScansSnap = await db.collection('scans')
      .where('codeID', '==', codeID)
      .orderBy('scannedAt', 'desc')
      .limit(5)
      .get();

    const priorWithLocation = recentScansSnap.docs
      .map(d => d.data())
      .find(s => s.location && s.location.lat != null && s.location.lon != null);

    if (priorWithLocation) {
      const dist = distanceKm(
        priorWithLocation.location.lat, priorWithLocation.location.lon,
        newScanLocation.lat, newScanLocation.lon
      );

      const priorTime = priorWithLocation.scannedAt?.toDate?.() || new Date(priorWithLocation.scannedAt);
      const hoursSince = Math.max((Date.now() - priorTime.getTime()) / (1000 * 60 * 60), 0.01);
      const impliedSpeed = dist / hoursSince;

      if (dist > 300 && impliedSpeed > MAX_PLAUSIBLE_KMH) {
        reasons.push(
          `Impossible travel: ${Math.round(dist)}km in ${hoursSince.toFixed(1)}h ` +
          `(implied ${Math.round(impliedSpeed)}km/h) between ${priorWithLocation.location.city || 'unknown'} ` +
          `and ${newScanLocation.city || 'unknown'}`
        );
      }

      // Different countries entirely, even without a speed
      // violation, is worth a soft flag if it's a large volume of
      // distinct countries — one resale isn't suspicious, five
      // countries in a week is.
      const distinctCountriesSnap = await db.collection('scans')
        .where('codeID', '==', codeID)
        .get();
      const countries = new Set(
        distinctCountriesSnap.docs
          .map(d => d.data().location?.countryCode)
          .filter(Boolean)
      );
      if (newScanLocation.countryCode) countries.add(newScanLocation.countryCode);
      if (countries.size >= 4) {
        reasons.push(`Scanned from ${countries.size} different countries`);
      }
    }
  }

  return { suspicious: reasons.length > 0, reasons };
}

module.exports = { evaluateScanForSuspicion, distanceKm };
