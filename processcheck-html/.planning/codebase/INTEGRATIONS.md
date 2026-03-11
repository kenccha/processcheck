# External Integrations

**Analysis Date:** 2026-03-12

## APIs & External Services

**Firebase (Google):**
- SDK Version: 11.3.0 (CDN via gstatic.com)
- Project ID: `processsss-appp`
- Initialized in: `js/firebase-init.js`
- Services used: Firestore, Authentication, Storage

**draw.io (diagrams.net):**
- Used in: `docs/deliverables/diagram-viewer.html`
- Purpose: Renders `.drawio` diagram files embedded in the page
- Client: `https://viewer.diagrams.net/js/viewer-static.min.js`
- Auth: None required

**Chart.js:**
- Used in: `reports.html` (loaded via `reports.html` `<script>` tag)
- Purpose: Analytics charts (bar, doughnut, line, horizontal bar)
- CDN: `https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js`

**html2canvas:**
- Used in: `js/feedback-widget.js`, `docs/deliverables/js/deliverable-nav.js`
- Purpose: Viewport screenshot capture for feedback submissions
- CDN: `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js`
- Loaded: Lazy (dynamically injected `<script>` only when user triggers capture)

## Data Storage

**Databases:**
- **Firestore** (Google Cloud, NoSQL document database)
  - Connection: hardcoded Firebase config in `js/firebase-init.js`
  - Client: Firebase JS SDK v11.3.0
  - Exported as: `db` from `js/firebase-init.js`
  - Real-time via: `onSnapshot` subscriptions throughout `js/firestore-service.js`

**Collections and their purpose:**

| Collection | Purpose | Read | Write |
|---|---|---|---|
| `users` | User profiles and roles | public | authenticated |
| `projects` | Project records | public | authenticated |
| `checklistItems` | Per-project task items | public | authenticated |
| `templateStages` | Phase template definitions | public | authenticated |
| `templateDepartments` | Department templates | public | authenticated |
| `templateItems` | Checklist item templates | public | authenticated |
| `notifications` | In-app user notifications | public | authenticated |
| `changeRequests` | Design change requests | public | authenticated |
| `customers` | Customer/dealer records | public | authenticated |
| `launchChecklists` | Sales launch prep checklists | public | authenticated |
| `portalNotifications` | Customer portal notifications | public | authenticated |
| `reviews` | Page review comments/issues | public | authenticated |
| `activityLogs` | Activity audit trail | authenticated | authenticated |
| `feedbacks` | Design deliverable feedback | public | authenticated |

**File Storage:**
- Firebase Storage configured (`getStorage` exported from `js/firebase-init.js`)
- Rules: authenticated read/write (`storage.rules`)
- Status: UI-only — no active file upload integration in current code

**Caching:**
- None — no Redis, Memcache, or in-memory cache layer
- Firebase SDK provides local Firestore cache automatically (IndexedDB)

## Authentication & Identity

**Primary Auth Provider: Microsoft Azure AD (OAuth 2.0)**
- Implementation: Firebase Auth `OAuthProvider("microsoft.com")`
- Tenant: `547afe76-db4a-45d9-9af8-c970051a4c7d` (InBody Azure AD)
- Domain restriction: `@inbody.com` emails only (enforced in `js/auth.js`)
- Flow: popup → `signInWithPopup` → lookup user in Firestore by email → create if new (role: `worker`)
- Code: `js/auth.js` → `loginWithMicrosoft()`

**Secondary Auth: Demo Card Login**
- No password, name-only lookup in Firestore → create if missing
- Used for 3 demo persona cards on `index.html`
- Code: `js/auth.js` → `login(name, role)`

**Session Management:**
- Storage: `localStorage` key `pc_user` (JSON serialized user object)
- TTL: 24 hours; checked on page guard and via 5-minute interval watcher
- Logout: clears localStorage + calls Firebase `signOut()`
- Code: `js/auth.js` → `guardPage()`, `startSessionWatcher()`

**Customer Portal Auth:**
- Separate from main auth — email-only verification against `customers.portalLoginEmail`
- Also checks `customers.portalEnabled === true`
- Session: `sessionStorage` key (not `localStorage`)
- Code: `js/pages/customer-portal.js`

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Rollbar, or equivalent

**Logs:**
- `activityLogs` Firestore collection — written by `js/firestore-service.js` on key actions
- Browser console only; no structured logging service

**Analytics:**
- None — no Google Analytics, Mixpanel, or equivalent

## CI/CD & Deployment

**Hosting:**
- Firebase Hosting — project `processsss-appp`
- Config: `firebase.json` in `processcheck-html/`
- Public dir: `.` (root of `processcheck-html/`)

**CI Pipeline:**
- GitHub Actions: `FirebaseExtended/action-hosting-deploy@v0`
- Trigger: push to `main` branch
- Required secret: `FIREBASE_SERVICE_ACCOUNT` (GitHub repo secret)

**Dev Server:**
- `python3 -m http.server 8080` from `processcheck-html/` directory

## Environment Configuration

**Required configuration:**
- Firebase client config is hardcoded in `js/firebase-init.js` — no env vars needed for browser runtime
- Microsoft OAuth tenant ID hardcoded in `js/auth.js`

**Secrets location:**
- `FIREBASE_SERVICE_ACCOUNT` — GitHub repo secret (CI/CD deploy only; not used in browser)
- No `.env` files in `processcheck-html/`

## Webhooks & Callbacks

**Incoming:**
- None — no webhook endpoints (static hosting, no server)

**Outgoing:**
- None

## Font CDNs

**Pretendard (Korean UI font):**
- CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/`
- Loaded in: `css/styles.css` via `@import`

**JetBrains Mono (monospace):**
- CDN: `https://fonts.googleapis.com/`
- Loaded in: `css/styles.css` via `@import`

---

*Integration audit: 2026-03-12*
