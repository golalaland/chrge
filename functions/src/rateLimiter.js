/**
 * rateLimiter.js
 * ------------------------------------------------------------
 * Per-IP rate limiting for the public verification endpoint.
 * This is a public, unauthenticated endpoint (anyone with a
 * physical sticker can hit it), so it's the one part of this
 * system explicitly exposed to abuse — someone could try to
 * enumerate codes by brute-forcing publicCode values, or hammer
 * the endpoint to run up your Cloud Functions bill.
 *
 * IMPLEMENTATION NOTE: Cloud Functions instances are stateless
 * and don't share memory between invocations/instances, so an
 * in-memory counter wouldn't actually limit anything at scale
 * (each concurrent instance would have its own counter). This
 * uses a Firestore document per IP as the shared state, with a
 * sliding window.
 *
 * This is a first line of defense, not a complete solution — for
 * production at real scale, pairing this with Firebase App Check
 * (blocks non-browser/scripted traffic) and/or Cloud Armor rate
 * limiting at the load balancer level is worth adding. Flagging
 * that honestly rather than implying this alone is bulletproof.
 * ------------------------------------------------------------
 */

const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const WINDOW_MS = 60 * 1000; // 1 minute sliding window
const MAX_REQUESTS_PER_WINDOW = 20; // generous for a real user scanning/retrying, tight for a script

/**
 * Returns { allowed: boolean, remaining: number } for the given
 * identifier (typically an IP address). Uses a Firestore
 * transaction to avoid race conditions from concurrent requests
 * from the same IP arriving at nearly the same time.
 */
async function checkRateLimit(identifier) {
  if (!identifier) {
    // No identifier to key on — fail open rather than blocking
    // everyone behind a shared/unknown IP, but log it for visibility.
    console.warn('Rate limiter called with no identifier — allowing by default.');
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW };
  }

  const db = getFirestore();
  // Firestore doc IDs can't contain certain characters that can
  // appear in IPv6 addresses (colons are fine, but sanitize defensively)
  const safeId = identifier.replace(/[^a-zA-Z0-9.:_-]/g, '_');
  const ref = db.collection('_rateLimits').doc(safeId);

  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : { requests: [] };

    // Keep only requests within the current window
    const recentRequests = (data.requests || []).filter(ts => ts > windowStart);

    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
      return { allowed: false, remaining: 0 };
    }

    recentRequests.push(now);
    tx.set(ref, {
      requests: recentRequests,
      updatedAt: FieldValue.serverTimestamp()
    });

    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - recentRequests.length };
  });
}

module.exports = { checkRateLimit, WINDOW_MS, MAX_REQUESTS_PER_WINDOW };
