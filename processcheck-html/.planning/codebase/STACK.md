# Technology Stack

**Analysis Date:** 2026-03-12

## Languages

**Primary:**
- JavaScript (ES2022+) - All application logic, vanilla ES modules, no transpilation
- CSS3 - All styling via custom properties (design tokens), single file

**Secondary:**
- HTML5 - Page templates (18 `.html` files, each a standalone SPA shell)

## Runtime

**Environment:**
- Browser — no Node.js runtime in production; pages served as static files
- ES module imports via native browser `<script type="module">` support
- Firebase SDK loaded via `<script type="importmap">` — maps bare module specifiers to CDN URLs

**Dev Server:**
- `python3 -m http.server 8080` — zero-dependency local server

**Package Manager:**
- None — no `package.json` in `processcheck-html/`; all dependencies loaded via CDN
- Puppeteer (screenshot tool) is a dev-only dependency in the parent repo (`/Users/injooncha/processcheck/`)

## Frameworks

**Core:**
- None — plain HTML + CSS + vanilla JavaScript; no framework or build step

**Styling:**
- Custom CSS design system — single file `css/styles.css` (~2800+ lines)
- CSS custom properties for design tokens (surfaces, primary/success/warning/danger color scales)
- Light mode default; dark mode via `[data-theme="dark"]` attribute
- Theme persisted to `localStorage("pc-theme")`

**Testing:**
- None — no test framework configured

**Build/Dev:**
- No build step — files are served directly
- `capture-screenshots.mjs` — Puppeteer-based screenshot automation (dev tool only); requires Node.js

## Key Dependencies (all CDN)

**Firebase SDK v11.3.0 (gstatic CDN):**
- `firebase/app` — app initialization
- `firebase/firestore` — real-time database, all CRUD + subscriptions
- `firebase/auth` — Microsoft OAuth (OAuthProvider)
- `firebase/storage` — file storage (rules exist; UI-only, no active upload integration)

Loaded via `importmap` in every HTML page:
```html
<script type="importmap">
{
  "imports": {
    "firebase/app":       "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js",
    "firebase/firestore": "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js",
    "firebase/auth":      "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js",
    "firebase/storage":   "https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js"
  }
}
</script>
```

**Chart.js v4.4.7 (jsdelivr CDN):**
- Used in `reports.html` only: bar, doughnut, line, horizontal bar charts
- Loaded via `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js">`

**html2canvas v1.4.1 (cdnjs CDN):**
- Viewport screenshot capture in `js/feedback-widget.js` and `docs/deliverables/js/deliverable-nav.js`
- Lazy-loaded on demand (not bundled)

**draw.io Viewer (viewer.diagrams.net CDN):**
- Used only in `docs/deliverables/diagram-viewer.html`
- `<script src="https://viewer.diagrams.net/js/viewer-static.min.js">`

**Fonts (CDN):**
- Pretendard v1.3.9 — primary Korean UI font (cdn.jsdelivr.net)
- JetBrains Mono — monospace/code font (fonts.googleapis.com)

**Puppeteer (Node.js, dev-only):**
- Used only by `capture-screenshots.mjs` to generate manual screenshots
- Not part of the browser runtime

## Configuration

**Firebase:**
- Config is hardcoded in `js/firebase-init.js` (Firebase public client config; intentional for client-side apps)
- Project: `processsss-appp` on Google Firebase

**Theme:**
- Flash prevention inline script on every HTML page:
  ```html
  <script>var t=localStorage.getItem("pc-theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark");</script>
  ```

**Hosting:**
- `firebase.json` in repo root (`processcheck-html/`)
- Cache headers: HTML = `no-cache`, JS/CSS = `max-age=3600`, images = `max-age=86400`
- Firebase project linked via `.firebaserc` to `processsss-appp`

**Security Rules:**
- Firestore rules: `firestore.rules` — most collections `read: true`, `write: if isAuthenticated()`
- Storage rules: `storage.rules` — `read/write: if request.auth != null`

## Platform Requirements

**Development:**
- Python 3 (for dev server) — `python3 -m http.server 8080`
- Node.js (optional, for Puppeteer screenshots only)
- A modern browser with ES module and importmap support (Chrome 89+, Firefox 108+, Safari 16.4+)

**Production:**
- Firebase Hosting (static file hosting, no server)
- All Firebase services: Firestore, Authentication, Storage
- CI/CD: GitHub Actions via `FirebaseExtended/action-hosting-deploy@v0`
- Secret required: `FIREBASE_SERVICE_ACCOUNT` (GitHub repo secret)

---

*Stack analysis: 2026-03-12*
