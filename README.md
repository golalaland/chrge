# CHRGE+ — Landing Page & Waitlist Admin

Two standalone HTML files, no build step, no npm install. Push this repo to GitHub, flip on Pages, and it's live.

## Files

- **`index.html`** — the public landing page (hero, how-it-works, venue pitch, waitlist form)
- **`admin.html`** — private dashboard to view/export waitlist signups (not linked from the public site, but not password-protected either — see security note below)

## 1. Go live with GitHub Pages

1. Push this repo to GitHub (public or private — Pages works with either, private repos need GitHub Pro/Team/Enterprise for Pages).
2. In the repo: **Settings → Pages**.
3. Under "Build and deployment," set **Source** to `Deploy from a branch`.
4. Set **Branch** to `main` (or whichever branch this is on) and folder to `/ (root)`.
5. Save. GitHub gives you a URL like `https://yourusername.github.io/repo-name/` — usually live within a minute or two.

Your landing page will be at that root URL. The admin page will be at `https://yourusername.github.io/repo-name/admin.html`.

## 2. Connect Firebase (required before signups actually save)

Both files currently have placeholder Firebase config. Until you swap it in, the waitlist form will show a friendly "Firebase isn't connected yet" message instead of failing silently.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → create a new project (e.g. `chrge-plus`).
2. Inside the project, add a **Web App** — this gives you a `firebaseConfig` object.
3. Open **`index.html`**, find the `<script type="module">` block near the top, and paste your config in place of the placeholder values.
4. Do the same in **`admin.html`** — use the exact same config, since it reads from the same Firestore collection `index.html` writes to.
5. In Firestore, set your security rules:

   ```
   match /waitlist/{doc} {
     allow create: if true;
     allow read, update, delete: if false;
   }
   ```

   This lets anyone submit the form, but blocks reading the list from the browser — which also means **`admin.html` won't be able to load data** with this rule. See below.

## 3. Viewing signups (admin.html)

Because the rule above blocks reads, you have two paths:

**Quick (fine for a private pilot, you're the only one checking):**
Temporarily loosen the rule to also `allow read: if true;`. Anyone who has your Firebase config (which is visible in your public HTML source — that's normal for Firebase web apps) could technically read the collection. Not a real risk while this is small and unlisted, but tighten it before this is a public, scaled product.

**Correct long-term:**
Leave reads locked down and just check signups directly in the **Firebase Console** (your project → Firestore Database → `waitlist` collection) instead of using `admin.html`. Or ask for an Auth-gated version of the admin page later — that lets only you log in and read, with reads staying locked down for everyone else.

## 4. Custom domain (optional)

If you want `chrgeplus.com` instead of the `github.io` URL: buy the domain anywhere (Namecheap, Google Domains, etc.), then in **Settings → Pages → Custom domain**, enter it. GitHub will walk you through the DNS records to add at your registrar.

## Notes

- No React build tooling is used — React, ReactDOM, and Babel are all loaded from CDN `<script>` tags, and JSX is compiled live in the browser. This keeps deployment to "just upload the HTML file," at the cost of a slightly slower first load than a properly bundled app. Fine for a landing page; if this grows into a full product, a real Vite/Next build becomes worth it.
- `admin.html` has `noindex, nofollow` in its meta tags so search engines won't list it, but the URL itself isn't secret — don't treat it as secure until it's behind real auth.
