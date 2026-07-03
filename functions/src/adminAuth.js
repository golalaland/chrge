/**
 * adminAuth.js
 * ------------------------------------------------------------
 * Handles the admin permission model. Admin status is a Firebase
 * Auth custom claim (`admin: true`), not just "any signed-in
 * user" — this is what Firestore rules check, and what every
 * callable function in this project verifies before doing
 * anything sensitive.
 *
 * There is deliberately NO public "sign up as admin" path.
 * The very first admin must be provisioned once via the
 * `bootstrapFirstAdmin` function below (protected by a setup
 * secret you set yourself, used exactly once), and every admin
 * after that is provisioned by an existing admin through
 * `provisionAdmin`.
 * ------------------------------------------------------------
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

/**
 * Throws if the calling user is not authenticated or does not
 * carry the admin custom claim. Call this at the top of every
 * admin-only callable function.
 */
function requireAdmin(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  if (request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }
  return request.auth;
}

/**
 * Grants the admin custom claim to a user by UID, and mirrors
 * that into an `admins` Firestore document for easy dashboard
 * listing (custom claims aren't queryable directly).
 */
async function grantAdminClaim(uid, grantedByUid, email) {
  await getAuth().setCustomUserClaims(uid, { admin: true });
  await getFirestore().collection('admins').doc(uid).set({
    uid,
    email: email || null,
    grantedBy: grantedByUid,
    grantedAt: FieldValue.serverTimestamp(),
    active: true
  });
}

module.exports = {
  requireAdmin,
  grantAdminClaim
};
