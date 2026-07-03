/**
 * adminFunctions.js
 * ------------------------------------------------------------
 * Admin provisioning. Two distinct paths:
 *
 * 1. bootstrapFirstAdmin — used exactly ONCE, to create the very
 *    first admin when the system has zero admins. Protected by a
 *    setup secret (an env var YOU set, not something checked into
 *    code) rather than an admin check, because there's no admin
 *    to check against yet. After the first admin exists, this
 *    function refuses to run again.
 *
 * 2. provisionAdmin — used by an existing admin to grant admin
 *    rights to another Firebase Auth user (e.g. after that person
 *    signs up normally through Firebase Auth). Requires an
 *    existing admin to call it.
 * ------------------------------------------------------------
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { requireAdmin, grantAdminClaim } = require('./adminAuth');

// Set this secret once via:
//   firebase functions:secrets:set BOOTSTRAP_ADMIN_SECRET
// Pick a long random string, store it somewhere safe (password
// manager) — you'll type it once, in the browser console or a
// short setup script, to create your first admin account.
const bootstrapSecret = defineSecret('BOOTSTRAP_ADMIN_SECRET');

/**
 * bootstrapFirstAdmin
 * ------------------------------------------------------------
 * Input: { email, secret }
 * The user with this email must already exist in Firebase Auth
 * (create them first in the Firebase Console → Authentication →
 * Add User, or have them sign up via a sign-up form if you build
 * one later). This function just grants the admin claim.
 *
 * Refuses to run if an admin already exists — this is a
 * one-time bootstrap, not a backdoor.
 */
const bootstrapFirstAdmin = onCall(
  { region: 'us-central1', secrets: [bootstrapSecret] },
  async (request) => {
    const { email, secret } = request.data || {};

    if (!secret || secret !== bootstrapSecret.value()) {
      throw new HttpsError('permission-denied', 'Invalid setup secret.');
    }
    if (!email) {
      throw new HttpsError('invalid-argument', 'email is required.');
    }

    const db = getFirestore();
    const existingAdmins = await db.collection('admins').limit(1).get();
    if (!existingAdmins.empty) {
      throw new HttpsError(
        'failed-precondition',
        'An admin already exists. Use provisionAdmin (called by an existing admin) instead.'
      );
    }

    const userRecord = await getAuth().getUserByEmail(email);
    await grantAdminClaim(userRecord.uid, 'BOOTSTRAP', email);

    return { success: true, uid: userRecord.uid, email };
  }
);

/**
 * provisionAdmin
 * ------------------------------------------------------------
 * Input: { email }
 * Called by an existing admin to grant admin rights to another
 * already-registered Firebase Auth user.
 */
const provisionAdmin = onCall({ region: 'us-central1' }, async (request) => {
  const auth = requireAdmin(request);
  const { email } = request.data || {};

  if (!email) throw new HttpsError('invalid-argument', 'email is required.');

  const userRecord = await getAuth().getUserByEmail(email);
  await grantAdminClaim(userRecord.uid, auth.uid, email);

  return { success: true, uid: userRecord.uid, email };
});

/**
 * revokeAdmin
 * ------------------------------------------------------------
 * Removes admin rights from a user. Requires an existing admin
 * to call it, and refuses to let an admin revoke their own
 * access (prevents accidental total lockout).
 */
const revokeAdmin = onCall({ region: 'us-central1' }, async (request) => {
  const auth = requireAdmin(request);
  const { uid } = request.data || {};

  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.');
  if (uid === auth.uid) {
    throw new HttpsError('failed-precondition', "You can't revoke your own admin access.");
  }

  await getAuth().setCustomUserClaims(uid, { admin: false });
  await getFirestore().collection('admins').doc(uid).update({ active: false });

  return { success: true, uid };
});

module.exports = { bootstrapFirstAdmin, provisionAdmin, revokeAdmin };
