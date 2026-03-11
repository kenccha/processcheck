# External Integrations

**Analysis Date:** 2026-03-12

## APIs & External Services

**Microsoft Azure AD (Microsoft OAuth):**
- Service: Microsoft 365 / InBody Azure AD tenant authentication
- What it's used for: Enterprise user login (alternative to demo cards)
- SDK/Client: Firebase Auth `OAuthProvider("microsoft.com")`
- Auth: Azure AD tenant ID `547afe76-db4a-45d9-9af8-c970051a4c7d` (hardcoded in `js/auth.js` line 46)
- Scope: Restricted to `@inbody.com` email domain only
- Implementation: `loginWithMicrosoft()` in `js/auth.js` (lines 43-80)
- New user flow: Auto-registers as `worker` role, admin assigns role/department later

## Data Storage

**Databases:**
- Firestore (Google Cloud)
  - Project: `processsss-appp`
  - Type: NoSQL document database
  - Collections: users, projects, checklistItems, changeRequests, customers, launchChecklists, notifications, portalNotifications, reviews, templateStages, templateDepartments, templateItems
  - Client: Firebase Firestore SDK v11.3.0 (CDN)
  - Connection: Initialized in `js/firebase-init.js` → exported as `db`

**File Storage:**
- Firebase Storage (within same project)
  - Bucket: `processsss-appp.firebasestorage.app`
  - Use: Checklist item file attachments (UI-only, not fully integrated)
  - Client: `getStorage()` in `js/firebase-init.js`
  - Status: Not operationally integrated (no upload/download implementation)

**Caching:**
- None (client-side, browser cache only via HTTP headers)

## Authentication & Identity

**Auth Provider:**
- Hybrid: Demo cards (localStorage) + Microsoft OAuth (Firebase Auth)

**Demo Card Authentication:**
- Implementation: 3 hardcoded sample users in `index.html` (lines 365-377)
  - 김철수 (worker/개발팀)
  - 이영희 (manager/개발팀)
  - 박민수 (observer/경영관리팀)
- Storage: localStorage under key `pc_user`
- Used for: Testing, non-OAuth access

**Microsoft OAuth Flow:**
- Implementation: `js/auth.js` lines 43-80
- Steps:
  1. User clicks "Microsoft 계정으로 로그인" button
  2. `signInWithPopup()` opens Microsoft auth flow
  3. Email domain validated (`@inbody.com` only)
  4. User looked up in Firestore `users` collection by email
  5. If new: auto-created as `worker` role
  6. User stored in localStorage as `pc_user`
- Session: No server-side session; Firebase Auth token in browser

**Logout:**
- Clears localStorage `pc_user`
- Calls `signOut(auth)` (Firebase Auth)
- Redirects to `index.html`

## Monitoring & Observability

**Error Tracking:**
- None (no error tracking service integrated)

**Logs:**
- Browser console only (no centralized logging)

## CI/CD & Deployment

**Hosting:**
- Firebase Hosting (Google Cloud)
  - Project: `processsss-appp`
  - Config: `processcheck-html/firebase.json`
  - Linked in: `processcheck-html/.firebaserc`

**CI Pipeline:**
- GitHub Actions (in parent repo)
  - Action: `FirebaseExtended/action-hosting-deploy@v0`
  - Trigger: Push to `main` branch
  - Secret required: `FIREBASE_SERVICE_ACCOUNT` (JSON key)

## Environment Configuration

**Required env vars:**
- None (all Firebase config hardcoded in `js/firebase-init.js`)

**Firebase config (public, safe to expose):**
- `apiKey`: `AIzaSyCmQ4-zOqeZKIxBIdYP71uhIdZ0eQu2rn0`
- `projectId`: `processsss-appp`
- `authDomain`: `processsss-appp.firebaseapp.com`
- `storageBucket`: `processsss-appp.firebasestorage.app`
- `messagingSenderId`: `1041230235574`
- `appId`: `1:1041230235574:web:de73f68d8c567ee5d96317`

**Secrets location:**
- Firebase service account key: GitHub Actions secret `FIREBASE_SERVICE_ACCOUNT`
- Firestore access: Controlled by `firestore.rules` (permissive for MVP, should restrict before production)

**localStorage keys:**
- `pc_user` — Current authenticated user
- `pc-theme` — Light/dark mode preference

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- Firestore writes trigger no external webhooks
- Real-time subscriptions use `onSnapshot()` (client-side listener, no outbound calls)

## Real-time Synchronization

**Firestore Subscriptions (via `onSnapshot`):**
- Used throughout for live data
- Examples:
  - `subscribeProjects()` — `js/firestore-service.js`
  - `subscribeChecklistItemsByAssignee()` — Filters by current user
  - `subscribeAllChecklistItems()` — All items (managers/observers)
  - `subscribeNotifications()` — Real-time alerts
  - `subscribeReviews()` — Inline feedback/review comments
- Updates automatically reflected in UI without page refresh

## Data Models & Collections

**Core Collections (Firestore):**

| Collection | Purpose | Key Fields |
|-----------|---------|-----------|
| `users` | User accounts | id, name, email, role, department, authProvider |
| `projects` | Development projects | id, name, projectType, status, progress, startDate, endDate, pm, currentStage, riskLevel |
| `checklistItems` | Work tasks (instances) | id, projectId, stage, title, assignee, status, approvalStatus, dueDate, comments |
| `changeRequests` | Design change requests | id, projectId, title, status, affectedDepartments, requestSource, customerId |
| `customers` | External partners/dealers | id, name, type (dealer/subsidiary/hospital), contractStatus, portalEnabled, portalLoginEmail |
| `launchChecklists` | Sales launch prep checklist | id, projectId, title, dueDate, status, customerId |
| `notifications` | User alerts | id, userId, type, title, message, link, read, createdAt |
| `portalNotifications` | Customer portal alerts | id, customerId, type, message, createdAt |
| `reviews` | Code/design review comments | id, pageId, type (comment/issue/approval), status, createdAt |
| `templateStages` | Process phase definitions | id, phaseName, order |
| `templateDepartments` | Department list | id, name |
| `templateItems` | Checklist template items (193 total) | id, stageId, departmentId, content, isRequired |

## Authentication Rules (Firestore Security)

**Current Status:** Permissive (MVP mode)

- Location: `processcheck-html/firestore.rules`
- Rules:
  - `users`: Read/write allowed (should restrict to user's own record)
  - `projects`: Read/write allowed (should restrict to assigned users)
  - `checklistItems`: Read/write allowed (should restrict by assignment)
  - `reviews`: Write restricted to `isAuthenticated()` (Microsoft OAuth only)
  - All template collections: Read allowed, write allowed (should restrict to observer role)

**Client-side Auth Checks:**
- Role validation happens in JavaScript, not Firestore rules
- Example: Only `role === "observer"` can approve tasks
- Firestore rules should be hardened before production

---

*Integration audit: 2026-03-12*
