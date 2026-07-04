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

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFunctions
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

/* ── Firebase Configuration ── */
const firebaseConfig = {
  apiKey: "AIzaSyD_GjkTox5tum9o4AupO0LeWzjTocJg8RI",
  authDomain: "dettyverse.firebaseapp.com",
  projectId: "dettyverse",
  storageBucket: "cubeology",
  messagingSenderId: "1036459652488",
  appId: "1:1036459652488:web:f4284cbc49c8074bc9b63d",
  measurementId: "G-KPSCEYNZWX"
};

/* ── Initialize App ── */
export const app = initializeApp(firebaseConfig);

/* ── Firestore (CHRGE database) ── */
let db;

try {
  db = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    },
    "chrge"           // ← your NEW Firestore database
  );

  console.log("✅ Connected to Firestore database: chrge");

} catch (err) {

  console.warn("Persistent cache unavailable:", err);

  db = getFirestore(app, "chrge");   // fallback still uses chrge
}

/* ── Other Services ── */

export const auth = getAuth(app);

/*
   Use the region where you'll deploy the CHRGE functions.
   Replace if different.
*/
export const functions = getFunctions(app, "europe-west1");

export { db };
