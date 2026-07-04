/**
 * auth-guard.js
 * ------------------------------------------------------------
 * Protects every dashboard page. Checks not just "is someone
 * logged in" but "does this user carry the admin custom claim" —
 * this mirrors the Firestore rules, so a non-admin authenticated
 * user (if one ever exists in this project) still can't see the
 * dashboard even though they have a valid session.
 *
 * Usage: import and call requireAdmin() at the top of every
 * protected page's script. It resolves with the user object if
 * authorized, or redirects to login.html and never resolves
 * otherwise.
 * ------------------------------------------------------------
 */

import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut as fbSignOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export function requireAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = 'login.html';
        return;
      }

      // Force-refresh the token so a just-granted admin claim
      // (e.g. right after bootstrap) is picked up without
      // requiring a manual re-login.
      const tokenResult = await user.getIdTokenResult(true);

      if (tokenResult.claims.admin !== true) {
        // Signed in, but not an admin — do not show the dashboard.
        await fbSignOut(auth);
        window.location.href = 'login.html?error=not_admin';
        return;
      }

      resolve({ user, claims: tokenResult.claims });
    });
  });
}

export async function signOut() {
  await fbSignOut(auth);
  window.location.href = 'login.html';
}
