/**
 * firebase-config.js
 * ------------------------------------------------------------
 * Single source of Firebase initialization for the whole admin
 * app. Every page imports `auth`, `db`, and `functions` from
 * here rather than re-initializing.
 *
 * SETUP: paste your Firebase project config below. Get it from
 * Firebase Console → Project Settings → General → Your apps →
 * Web app → SDK setup and configuration.
 * ------------------------------------------------------------
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

// ============================================================
// PASTE YOUR FIREBASE CONFIG HERE
// ============================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "chrge-verify.firebaseapp.com",
  projectId: "chrge-verify",
  storageBucket: "chrge-verify.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
