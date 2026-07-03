# CHRGE Verify

Secure product authentication & QR serialization platform for CHRGE+. Every physical unit gets a unique, cryptographically unguessable code; scan it to verify authenticity.

## What's built in this pass

This is Phase 1: **the admin core** — authentication, product management, batch creation, and server-side secure code generation, plus a working dashboard. This was a deliberate scope choice: the full spec (public verification portal, sticker designer, variable-data PDF printing, scan geofencing, counterfeit detection) is a multi-week build. Building the admin core properly, with real security, was prioritized over building all fifteen-odd subsystems shallowly.

**Fully working:**
- Admin authentication (Firebase Auth + custom claims, not just "any logged-in user")
- Product Manager — create/list products
- Batch Manager — create batches, which triggers server-side generation of cryptographically secure codes
- Secure code generation — 256-bit `secureID` (crypto.randomBytes) + short `publicCode`, with real collision detection, running entirely in Cloud Functions (never client-side)
- Dashboard — live stats (total codes, printed, verified, unused, counterfeit alerts, recent batches/scans) via Firestore count() aggregation, which stays fast at millions of documents
- Admin provisioning — bootstrap the first admin, then grant/revoke admin access to others
- Firestore security rules — default-deny, admin-only reads, zero direct writes from any client (all writes go through Cloud Functions using the Admin SDK)
- **Public verification portal** (`verify.html`) — the customer-facing scan page. Handles all three states from the spec (genuine/first scan, already-activated with scan history, invalid), plus disabled/blacklisted codes and rate-limiting feedback. Backed by the `verifyCode` Cloud Function — the only unauthenticated endpoint in the whole system, so it's the most defensively written file in the project: rate-limited per IP (Firestore-backed sliding window, since Cloud Functions instances don't share memory), strict input format validation before any database lookup, and it never reveals whether a malformed guess was "close" to a real code.
- Counterfeit detection heuristics — impossible-travel flagging (haversine distance vs. elapsed time between scans), high scan-count flagging, multi-country flagging. Framed honestly as heuristics for human review, not automatic fraud determination.
- IP-based approximate geolocation for scans, with honest limits documented (city-level at best, VPN-defeatable, mobile-carrier-routing can mislead it) — used as a signal, not a fact.

**Scaffolded but not yet implemented** (nav links exist, pages show "not built yet" rather than breaking):
- Codes page — search/disable/reissue/blacklist individual codes
- Print Queue — variable-data PDF generation for thermal/roll/A4 printing
- Scan Activity — full scan history dashboard (the *data* is already being collected by `verifyCode`; this is the admin UI to browse it)

The data model, Firestore collections, and security rules already account for all of the above — adding them is additive, not a redesign.

## Architecture

```
chrge-verify/
├── firebase.json              # Hosting + Functions + Firestore config
├── firestore-rules/
│   ├── firestore.rules        # Default-deny, admin-only, zero public writes
│   └── firestore.indexes.json
├── functions/                 # Cloud Functions (Node 22, Admin SDK)
│   ├── index.js                # Entry point, wires all functions
│   └── src/
│       ├── adminAuth.js        # requireAdmin() guard, claim granting
│       ├── adminFunctions.js   # bootstrapFirstAdmin, provisionAdmin, revokeAdmin
│       ├── codeGenerator.js    # THE security core — crypto ID generation
│       ├── productFunctions.js
│       ├── batchFunctions.js   # createBatch (generates codes), listBatches
│       ├── dashboardFunctions.js
│       ├── verifyFunctions.js  # verifyCode — the public verification endpoint
│       ├── rateLimiter.js      # Firestore-backed sliding window rate limit
│       ├── geoLookup.js        # IP-based approximate geolocation
│       └── counterfeitDetection.js  # impossible-travel / scan-pattern heuristics
└── public/                    # Static frontend, vanilla ES6 modules, no build step
    ├── login.html / dashboard.html / products.html / batches.html / verify.html / ...
    ├── css/admin.css
    └── js/
        ├── services/
        │   ├── firebase-config.js   # ← paste your Firebase config here
        │   ├── auth-guard.js        # requireAdmin() for every protected page
        │   └── shell.js             # shared sidebar/nav
        └── pages/                   # one file per page
```

### Why Cloud Functions for code generation, not client-side

A "cryptographically secure" generator that runs in the browser is a contradiction — anyone can read your JS, see the algorithm, and in principle predict or manipulate it. Every `secureID` and `publicCode` is generated inside a Cloud Function using Node's `crypto` module (OS-level CSPRNG), with collision detection done via Firestore reads inside the same function, and the client only ever sees the finished result. This was a specific decision you confirmed before this build started.

### Why Firestore rules deny all direct writes

Every collection in `firestore.rules` is `allow write: if false` for `codes`, `batches`, `scans`, `admins`. This isn't an oversight — it means even a compromised or malicious admin browser session can't forge a "verified" code or inject fake batches directly into the database. All real writes happen via Cloud Functions using the Admin SDK, which bypasses client rules entirely and lets us enforce actual business logic (validation, collision checks, uniqueness) before anything touches the database.

### Why the public verification page never reads Firestore directly

`verify.html` calls the `verifyCode` Cloud Function for every lookup — it never queries Firestore from the browser. This is what stops someone from scraping the `codes` collection: there is no public read path into it at all. The function validates input format (must match either the 64-hex-char `secureID` pattern or the `XXXX-XXXX` `publicCode` pattern) *before* touching the database, and returns the same "invalid" response whether the input was well-formed-but-nonexistent or garbage — so an attacker probing the endpoint can't distinguish "wrong format" from "right format, doesn't exist," which would otherwise leak information useful for brute-forcing.

### Rate limiting reality check

The `checkRateLimit` function throttles the verify endpoint to 20 requests/minute per IP, using a Firestore document per IP as shared state (necessary because Cloud Functions instances don't share memory — an in-process counter wouldn't actually limit anything once you have concurrent instances). This is a real first line of defense, not a complete one. At real scale, pairing it with **Firebase App Check** (blocks non-browser/scripted traffic entirely) is the natural next layer — flagged in the code comments, not yet implemented here.

### A known dependency vulnerability, disclosed rather than silently left in

`npm install` in `functions/` currently reports moderate-severity advisories in a transitive `uuid` package, several layers deep inside Google's own Cloud SDK dependencies (`google-gax`, `gaxios`, `@google-cloud/firestore`) — not something introduced by any code written for this project. The fix `npm audit` suggests is a breaking `firebase-admin` major version bump, which isn't something to force silently without knowing if it'd break anything else in your setup. Worth running `npm audit` yourself after `npm install` and deciding if/when to take that upgrade.

## Setup

### 1. Create the Firebase project

```bash
npm install -g firebase-tools
firebase login
firebase projects:create chrge-verify   # or use an existing project
```

### 2. Get your web app config

Firebase Console → Project Settings → General → Your apps → Add app → Web. Copy the config object.

Paste it into **`public/js/services/firebase-config.js`** (replace the placeholder values).

### 3. Enable required services

In the Firebase Console:
- **Authentication** → Sign-in method → enable Email/Password
- **Firestore Database** → Create database (start in production mode — the rules file handles security)
- **Functions** → will activate on first deploy; requires the Blaze (pay-as-you-go) plan, since Cloud Functions aren't available on the free Spark plan. Realistically this stays very cheap at pilot scale — you're mostly paying for reads/writes and function invocations, not idle infrastructure.

### 4. Connect this project locally

```bash
firebase use --add
# select your project, give it an alias like "default"
```

### 5. Set the admin bootstrap secret

This is the one-time secret that lets you create your very first admin account (since no admin exists yet to authorize one).

```bash
firebase functions:secrets:set BOOTSTRAP_ADMIN_SECRET
# paste a long random string when prompted — save it in a password manager
```

### 6. Deploy Firestore rules and Cloud Functions

```bash
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,firestore:indexes,functions
```

### 7. Create your first Firebase Auth user

Firebase Console → Authentication → Add user. Use the email/password you'll actually sign in with.

### 8. Bootstrap that user as an admin

Open your browser console on any page of your deployed site (or run this via `firebase functions:shell`), and call:

```js
// In browser console, after importing firebase functions SDK, or via functions:shell:
const bootstrap = httpsCallable(functions, 'bootstrapFirstAdmin');
await bootstrap({ email: 'you@chrgeplus.com', secret: 'THE_SECRET_YOU_SET_IN_STEP_5' });
```

Or the simplest path: temporarily add a small script tag to `login.html` that calls this once, then remove it. Ask for a one-off bootstrap page if you'd rather have a UI for this step.

### 9. Deploy hosting

```bash
firebase deploy --only hosting
```

You're live. Sign in at `https://your-project.web.app/login.html`.

## Testing the verification flow

Once a batch has been generated (via the Batches page), you have real `secureID` and `publicCode` values to test with — `createBatch` returns them directly in its response, or you can find them in the Firestore Console under the `codes` collection.

- **Simulating a QR scan:** visit `https://your-domain/v/<secureID>` — the full 64-character hex string. First visit shows "Genuine Product," every visit after that shows "Already Activated" with a scan count.
- **Simulating manual entry:** visit `https://your-domain/verify.html` (no code in the URL) and type the short `publicCode` (format `CGA8-K2MX`) into the form.
- **Testing invalid codes:** any string that doesn't match either format returns "Invalid Code" without hitting the database at all (rejected by input validation in `verifyCode` before any Firestore read).
- **Testing disabled/blacklisted:** these status values exist in the data model now, but there's no admin UI yet to set them (that's the staged "Codes page" work) — you can set `status: 'disabled'` or `status: 'blacklisted'` directly on a code document in the Firestore Console to test that path in the meantime.

## Local development

```bash
firebase emulators:start
```

This runs Auth, Firestore, and Functions emulators together with Hosting, so you can test the whole flow (including code generation) without touching production data or paying for function invocations.

## A note on the brand accent color

The build spec asked for an "orange accent matching the CHRGE+ brand." Every CHRGE+ asset built so far — the logo, landing page, venue one-pager — uses neon-green (`#C3F60C`) as the signature accent, not orange. This dashboard uses neon-green to stay visually consistent with those assets. If orange was intentional (e.g. this product has a distinct sub-brand identity), the swap is a one-line change: `--accent` in `public/css/admin.css`.

## Next build phases (in priority order, based on what unlocks the most)

1. **QR generation + Sticker Designer** — turning `secureID`/`publicCode` pairs into actual printable artwork. Now that verification is live, this is what connects code generation to something a customer actually holds and scans.
2. **Variable-data PDF printing** — merging the sticker template with each unique code for batch printing.
3. **Codes page (admin)** — search, disable, reissue, blacklist individual codes (the data and rules already support this; it's a CRUD UI on top).
4. **Scan Activity page (admin)** — browsing the scan/suspicion data `verifyCode` is already collecting, since right now it's only visible via the dashboard's aggregate counts and Firestore Console.

Each phase builds on this foundation without touching what's already here.
