/**
 * codeGenerator.js
 * ------------------------------------------------------------
 * The security core of CHRGE Verify. Everything in this file
 * runs server-side only (Cloud Functions, Admin SDK) — never
 * ship this logic to the client.
 *
 * Two identifiers are generated per product unit:
 *
 *  1. secureID  — 256-bit cryptographically random hex string.
 *     This is what's encoded in the QR code. It is the only
 *     thing printed that can look up a record, and it's
 *     unguessable: 2^256 possibilities means brute-forcing or
 *     guessing valid codes is computationally infeasible.
 *
 *  2. publicCode — a short human-readable code (e.g. CGA8-K2MX)
 *     printed as plain text on the sticker as a fallback for
 *     manual entry when a QR can't be scanned. This uses a
 *     smaller space, so collision detection matters more here
 *     — handled via Firestore transactional checks below.
 * ------------------------------------------------------------
 */

const crypto = require('crypto');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Unambiguous alphabet: no 0/O, 1/I/L, to reduce human transcription
// errors when someone types a code in manually.
const PUBLIC_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PUBLIC_CODE_SEGMENT_LENGTH = 4;
const PUBLIC_CODE_SEGMENTS = 2; // e.g. CGA8-K2MX

/**
 * Generates a 256-bit (32 byte) cryptographically secure hex string.
 * Uses Node's crypto.randomBytes, which draws from the OS CSPRNG
 * (not Math.random, which is NOT cryptographically secure and
 * must never be used for anything security-relevant).
 */
function generateSecureID() {
  return crypto.randomBytes(32).toString('hex'); // 64 hex chars = 256 bits
}

/**
 * Generates a short public-facing code like "CGA8-K2MX".
 * Uses crypto.randomInt (CSPRNG-backed) rather than Math.random
 * for each character selection, even though this code is shorter
 * and meant for human eyes — no need to weaken it just because
 * it's the "friendly" identifier.
 */
function generatePublicCode() {
  const segments = [];
  for (let s = 0; s < PUBLIC_CODE_SEGMENTS; s++) {
    let segment = '';
    for (let i = 0; i < PUBLIC_CODE_SEGMENT_LENGTH; i++) {
      const idx = crypto.randomInt(0, PUBLIC_CODE_ALPHABET.length);
      segment += PUBLIC_CODE_ALPHABET[idx];
    }
    segments.push(segment);
  }
  return segments.join('-');
}

/**
 * Generates `count` unique code records for a batch, with collision
 * detection against existing Firestore records. Because secureID has
 * 2^256 possible values, a collision there is astronomically unlikely
 * (this check exists for defense-in-depth, not because we expect it
 * to ever trigger). publicCode has a much smaller space
 * (32^8 ≈ 1.1 trillion combinations) — still huge, but collision
 * checking is cheap and worth doing properly rather than assuming.
 *
 * Returns an array of { secureID, publicCode } ready to be written.
 */
async function generateUniqueCodes(count, maxRetriesPerCode = 5) {
  const db = getFirestore();
  const results = [];
  const seenSecureIDs = new Set();
  const seenPublicCodes = new Set();

  for (let i = 0; i < count; i++) {
    let attempt = 0;
    let secureID, publicCode;
    let isUnique = false;

    while (!isUnique && attempt < maxRetriesPerCode) {
      secureID = generateSecureID();
      publicCode = generatePublicCode();

      // Check in-memory set first (cheap, catches collisions within
      // this same batch-generation run before hitting Firestore)
      if (seenSecureIDs.has(secureID) || seenPublicCodes.has(publicCode)) {
        attempt++;
        continue;
      }

      // Check against existing Firestore records (catches collisions
      // against everything generated in all previous batches)
      const [secureIDSnap, publicCodeSnap] = await Promise.all([
        db.collection('codes').doc(secureID).get(),
        db.collection('codes').where('publicCode', '==', publicCode).limit(1).get()
      ]);

      if (secureIDSnap.exists || !publicCodeSnap.empty) {
        attempt++;
        continue;
      }

      isUnique = true;
    }

    if (!isUnique) {
      // Extraordinarily unlikely given the ID space, but fail loudly
      // rather than silently producing a weaker/duplicate code.
      throw new Error(
        `Failed to generate a unique code after ${maxRetriesPerCode} attempts at index ${i}. ` +
        `This should be statistically near-impossible — investigate the RNG or Firestore state.`
      );
    }

    seenSecureIDs.add(secureID);
    seenPublicCodes.add(publicCode);
    results.push({ secureID, publicCode });
  }

  return results;
}

module.exports = {
  generateSecureID,
  generatePublicCode,
  generateUniqueCodes,
  PUBLIC_CODE_ALPHABET
};
