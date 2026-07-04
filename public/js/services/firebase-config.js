/**
 * firebase-config.js
 * ------------------------------------------------------------
 * Single source of Firebase initialization for the whole admin
 * app. Every page imports `auth`, `db`, and `functions` from
 * here rather than re-initializing.
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
    "chrge"           // ← the named Firestore database for CHRGE Verify
  );
  console.log("✅ Connected to Firestore database: chrge");
} catch (err) {
  console.warn("Persistent cache unavailable:", err);
  db = getFirestore(app, "chrge");   // fallback still uses chrge
}

/* ── Other Services ── */
export const auth = getAuth(app);

/*
   Region matches where the CHRGE Verify functions are deployed.
*/
export const functions = getFunctions(app, "europe-west1");

export { db };
