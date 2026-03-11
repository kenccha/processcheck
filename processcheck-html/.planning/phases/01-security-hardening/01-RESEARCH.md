# Phase 1: Security Hardening - Research

**Researched:** 2026-03-12
**Domain:** Firebase Security Rules, XSS Prevention, Session Management, Demo Auth Gating
**Confidence:** HIGH

## Summary

ProcessCheck's HTML port has a critical security gap: every Firestore collection uses `allow write: if true`, making the entire database writable by anyone with the Firebase config (which is public in client-side code). The app has two login paths — demo card login (pure localStorage, no Firebase Auth token) and Microsoft OAuth (real Firebase Auth token). This dual-auth design is the central constraint for security rules: rules can only gate on `request.auth != null` for MS OAuth users; demo card users have no Firebase Auth token and cannot satisfy Firestore rules that require `isAuthenticated()`.

The design decision already made (CLAUDE.md, STATE.md) is: demo card login is disabled on production, allowed only on localhost. This means production Firestore rules can safely require Firebase Auth (`request.auth != null`) for all writes. The rules do NOT need to enforce roles server-side because: (a) role data lives in Firestore, not in the Firebase Auth token, and (b) the users collection does NOT store `firebaseUid` — user documents use auto-generated Firestore IDs, making `request.auth.uid`-based role lookups impossible without a schema change.

The practical strategy is: require `isAuthenticated()` (Firebase Auth token present) for all writes, keep reads open for now (the app needs real-time subscriptions from MS OAuth users across all collections). XSS is mostly handled — `escapeHtml()` exists and is used in 181 places across 12 files — but `components.js` uses `innerHTML` with data fields in 6 places and a targeted audit is needed. Session expiry requires adding a `loginAt` timestamp to localStorage and a periodic check in `guardPage()`.

**Primary recommendation:** Implement Firestore rules requiring `request.auth != null` for writes, gate demo cards with `window.location.hostname` check, add `loginAt` to localStorage session for 24-hour expiry, audit `components.js` and `feedback-widget.js` innerHTML usages, and deploy Firebase Storage rules (new file — does not yet exist).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Firestore 보안 규칙이 역할 기반 쓰기 접근을 강제 (현재 `write: true` → 인증+역할 기반) | All 11 collections currently open. Rules must require `request.auth != null` for writes. Role-based enforcement beyond auth check is not feasible server-side without a schema change (no `firebaseUid` stored). |
| SEC-02 | Firebase Storage 보안 규칙이 인증된 사용자만 파일 업로드/다운로드를 허용 | `storage.rules` file does not exist in the repo. Must create it. |
| SEC-03 | 데모 카드 로그인이 프로덕션에서 비활성화 (localhost만 허용) | Demo cards are rendered in `index.html`; gating logic lives in `js/pages/login.js`. `window.location.hostname` check is the correct mechanism — no build step exists, so no env variables. |
| SEC-04 | 모든 innerHTML 사용처에서 사용자 입력이 escapeHtml()로 처리 (XSS 방지) | `escapeHtml()` already exists in `js/utils.js` and is used in 181 places across 12 files. Remaining risk: `components.js` (6 innerHTML uses — nav, notif panel), `feedback-widget.js` (7 innerHTML uses), and large template literals in `sales.js`, `project-detail.js`, `admin-checklists.js` that may interpolate unescaped data. |
| SEC-05 | 세션이 24시간 후 만료, 만료 시 로그인 페이지 리다이렉트 | `auth.js` `login()` and `loginWithMicrosoft()` save to localStorage with no `loginAt` timestamp. `guardPage()` reads localStorage but does not check expiry. Needs: add `loginAt: Date.now()` on save, check in `guardPage()`, periodic check interval on active pages. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Firebase Security Rules | Firestore Rules v2 | Server-side access control for Firestore | Only server-side enforcement available; client-side checks are bypassed by curl |
| Firebase Storage Rules | Storage Rules v2 | Server-side access control for Cloud Storage | Same enforcement model as Firestore rules |
| `window.location.hostname` | browser built-in | Detect localhost vs production | No build step = no env vars; hostname check is reliable and zero-dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMPurify | 3.x (CDN) | Sanitize HTML before `innerHTML` injection | Only needed if `innerHTML` must receive rich HTML from user input (comments, descriptions). NOT needed if `escapeHtml()` is applied consistently — escapeHtml already prevents execution by converting `<` to `&lt;` |
| `localStorage` with `loginAt` field | browser built-in | Session expiry timestamp | Extend existing pc_user object — no new storage key needed |
| `setInterval` | browser built-in | Periodic session expiry check | Check every 5 minutes; redirect to index.html if `Date.now() - loginAt > 86400000` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `hostname === "localhost"` check | Firebase Remote Config flag | Remote Config adds SDK complexity and a round-trip; hostname check is instant and requires no network |
| `escapeHtml()` DOM-trick implementation | DOMPurify library | `escapeHtml()` via `div.textContent / div.innerHTML` is correct for plain text escaping. DOMPurify is only needed if you want to allow a subset of HTML tags (like `<b>`, `<em>`). The current app does not need rich HTML in user content. |
| `setInterval` expiry check | Firebase Auth `onAuthStateChanged` + token expiry | MS OAuth Firebase Auth tokens auto-expire after 1 hour, but demo users have no Firebase Auth token. The localStorage `loginAt` approach is consistent for both auth paths. |

**Installation:** No new packages required. All mechanisms are built-in or already imported.

---

## Architecture Patterns

### Recommended Project Structure
No directory changes needed. All changes are in existing files:
```
js/auth.js                    # Add loginAt, expiry check to guardPage()
js/pages/login.js             # Add hostname-based demo card gating
js/components.js              # Audit innerHTML usages, apply escapeHtml
js/feedback-widget.js         # Audit innerHTML usages
firestore.rules               # Replace open writes with isAuthenticated()
storage.rules                 # NEW — create this file
firebase.json                 # Add storage rules path
```

### Pattern 1: Firestore Rules — Auth-Only Writes
**What:** Require `request.auth != null` for all collection writes. Keep reads open (real-time subscriptions work without auth for pages like the customer portal and manual, and locking reads would break existing subscriptions for all demo users).
**When to use:** When you cannot enforce role-based rules server-side (because role is stored in Firestore, not the Auth token claim).

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    // Users: authenticated users can write their own doc or observer creates new user
    // Keep reads open — user list needed for task assignment dropdowns
    match /users/{userId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // Projects: authenticated write only
    match /projects/{projectId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // ChecklistItems: authenticated write only
    match /checklistItems/{itemId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // TemplateStages/Departments/Items: authenticated write only
    match /templateStages/{stageId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
    match /templateDepartments/{deptId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
    match /templateItems/{itemId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // Notifications: authenticated write only (system generates them)
    match /notifications/{notifId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // ChangeRequests: authenticated write
    match /changeRequests/{requestId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // Customers: authenticated write
    match /customers/{customerId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // LaunchChecklists: authenticated write
    match /launchChecklists/{checklistId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // PortalNotifications: authenticated write
    match /portalNotifications/{notifId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // Reviews: authenticated write (already correct)
    match /reviews/{reviewId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // ActivityLogs: authenticated write
    match /activityLogs/{logId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
  }
}
```

**Confidence:** HIGH — verified against Firebase Security Rules docs.

### Pattern 2: Demo Card Gating via Hostname
**What:** In `login.js`, check `window.location.hostname` before rendering demo card buttons. Hide (or do not wire up) the demo card section when not on localhost.
**When to use:** Static HTML deployment with no build step — cannot use env vars.

```javascript
// js/pages/login.js — add near top, after DOM refs
const IS_PROD = window.location.hostname !== "localhost"
             && window.location.hostname !== "127.0.0.1";

if (IS_PROD) {
  // Hide demo card row and the divider
  const demoSection = document.getElementById("user-cards");
  const divider = document.getElementById("login-divider");
  const prompt = document.querySelector(".login-prompt");
  if (demoSection) demoSection.style.display = "none";
  if (divider) divider.style.display = "none";
  // Update prompt text
  if (prompt) prompt.textContent = "InBody 계정으로 로그인하세요";
}
```

**Why hide rather than remove click handlers only:** If the HTML is still rendered, a motivated user could DevTools-enable the button and call `login()` manually. Hiding the DOM element AND not wiring events is defense in depth. The demo card HTML in `index.html` can remain — the JS gate is sufficient since `login()` itself still works (it creates a localStorage session with no Firebase Auth token). The Firestore rules gate is what actually enforces security — the demo gate is a UX convenience that also prevents accidental demo use in production.

**Confidence:** HIGH — `window.location.hostname` is reliable and synchronous.

### Pattern 3: Session Expiry via loginAt Timestamp
**What:** Store `loginAt: Date.now()` when writing to localStorage. Check expiry in `guardPage()` and via a `setInterval` on every protected page.
**When to use:** Apps with localStorage-based sessions that need time-bounded validity.

```javascript
// js/auth.js — modify login() and loginWithMicrosoft()
// In login():
const sessionUser = { ...user, role, loginAt: Date.now() };
localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));

// In loginWithMicrosoft():
const msUser = { ...existingUser, authProvider: "microsoft", loginAt: Date.now() };
localStorage.setItem(STORAGE_KEY, JSON.stringify(msUser));

// guardPage() — add expiry check
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

export function guardPage() {
  const user = getUser();
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
  if (user.loginAt && Date.now() - user.loginAt > SESSION_TTL) {
    logout(); // clears localStorage + Firebase Auth signOut
    return null;
  }
  return user;
}

// startSessionWatcher() — call from each protected page's init
export function startSessionWatcher() {
  const INTERVAL = 5 * 60 * 1000; // check every 5 minutes
  setInterval(() => {
    const user = getUser();
    if (!user || (user.loginAt && Date.now() - user.loginAt > SESSION_TTL)) {
      logout();
    }
  }, INTERVAL);
}
```

Pages that call `guardPage()` at init: add `startSessionWatcher()` call after successful `guardPage()` return. The `js/components.js` `initNav()` function is a good central location since every protected page calls it.

**Confidence:** HIGH — no external dependencies, matches existing auth.js patterns.

### Pattern 4: Firebase Storage Rules (New File)
**What:** Create `storage.rules` file requiring authenticated users for all Storage operations. Register in `firebase.json`.
**When to use:** Any Firebase project using Storage with sensitive files.

```javascript
// storage.rules (new file)
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

```json
// firebase.json — add storage section
{
  "hosting": { ... },
  "storage": {
    "rules": "storage.rules"
  }
}
```

**Confidence:** HIGH — standard Firebase Storage rules pattern.

### Anti-Patterns to Avoid
- **Role-checking in Firestore rules via Firestore lookups (`get()`):** The users collection uses auto-generated document IDs; `request.auth.uid` does not match any document ID. `get(path)` rules are also expensive and add latency to every write. Since role enforcement is already done client-side (UI hides unauthorized actions), server-side `isAuthenticated()` is the correct boundary.
- **Storing auth state only in Firebase Auth `onAuthStateChanged`:** The app has demo users who never go through Firebase Auth. Mixing `onAuthStateChanged` with localStorage would create two competing sources of truth.
- **Removing demo card HTML from index.html:** The HTML is not the attack surface — an unauthenticated API call to Firestore is. The Firestore rules gate is the real defense. Removing HTML increases maintenance cost with minimal security gain.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-side role authorization | Custom role-check functions in Firestore rules that `get()` user documents | `isAuthenticated()` only, with role enforcement client-side | Users collection has no `firebaseUid` field; `get()` by `request.auth.uid` will always fail |
| HTML sanitization library | Custom escapeHtml regex/replace | Existing `escapeHtml()` in `utils.js` (DOM-based, correct) | The DOM trick `div.textContent = x; return div.innerHTML` correctly escapes all HTML special chars |
| Session storage encryption | Encrypt localStorage session JSON | Plain JSON is fine | The session only stores name/role/dept — no passwords, tokens, or PII beyond email |

---

## Common Pitfalls

### Pitfall 1: Firestore Rules Deployment Without Testing
**What goes wrong:** Deploy rules that break existing functionality — e.g., a Firestore subscription that fires before the user has a Firebase Auth token ready.
**Why it happens:** `onAuthStateChanged` is async; if a page subscribes to Firestore before the auth token is loaded, the subscription fires as unauthenticated.
**How to avoid:** The app's `guardPage()` runs synchronously at page load — it checks localStorage before any Firestore calls. MS OAuth users have a Firebase Auth token persisted via `indexedDB` (Firebase Auth persistence default). The token is typically available immediately. Watch for edge cases where `auth.currentUser` is `null` for a few ms on page load.
**Warning signs:** Console errors `FirebaseError: Missing or insufficient permissions` on page load after deploying rules.

### Pitfall 2: Demo Card Login Breaks Firestore Writes After Rules Deploy
**What goes wrong:** Demo users (no Firebase Auth token) can still log in via localStorage but then cannot write to Firestore.
**Why it happens:** The session guard passes (localStorage has user), but `request.auth` is `null` for demo users.
**How to avoid:** SEC-03 (demo cards disabled in production) must be implemented BEFORE or AT THE SAME TIME as SEC-01 (Firestore rules). Deploy order matters: gate demo cards first, then tighten rules. On localhost, demo users can still write — this is acceptable.
**Warning signs:** "작업 완료" button clicks silently fail for demo users on production.

### Pitfall 3: Session Watcher Fires During Legitimate Use
**What goes wrong:** A user in the middle of filling out a form gets redirected mid-session because `logout()` is called.
**Why it happens:** `logout()` calls `window.location.href = "index.html"` immediately, losing any unsaved form state.
**How to avoid:** The watcher fires only every 5 minutes. Since the TTL is 24 hours, this is a negligible UX impact. The watcher should call `logout()` only when expiry is confirmed — the current `logout()` implementation is appropriate.

### Pitfall 4: escapeHtml Missed in Template Literals
**What goes wrong:** A developer adds a new template literal with `${item.name}` without wrapping in `escapeHtml()`.
**Why it happens:** Template literals look safe because they're in JS source code, but they inject HTML strings into `innerHTML`.
**How to avoid:** The XSS audit must check every `innerHTML = \`...\`` template literal in the files that have NOT yet applied `escapeHtml` to all data fields. Key files to audit: `components.js` (notification panel renders user-controlled `notif.title` and `notif.message`), `feedback-widget.js` (renders user-entered feedback text).

### Pitfall 5: Storage Rules File Missing from Deployment
**What goes wrong:** `storage.rules` file is created but `firebase.json` is not updated, so the rules are never deployed.
**Why it happens:** Firebase CLI requires explicit `"storage": { "rules": "storage.rules" }` in `firebase.json`.
**How to avoid:** Add the storage section to `firebase.json` at the same time as creating `storage.rules`.

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### Current escapeHtml Implementation (js/utils.js:154) — Already Correct
```javascript
export function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
```
This implementation is correct and sufficient for plain text escaping. It handles all HTML special characters (`<`, `>`, `&`, `"`, `'`) by using the browser's own serializer.

### Current guardPage Implementation (js/auth.js:108) — Needs loginAt check
```javascript
// CURRENT (no expiry):
export function guardPage() {
  const user = getUser();
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
  return user;
}
```

### Firestore Rules Deployment Command
```bash
cd /Users/injooncha/processcheck/processcheck-html
firebase deploy --only firestore:rules
```

### Storage Rules Deployment Command
```bash
cd /Users/injooncha/processcheck/processcheck-html
firebase deploy --only storage
```

### Full Deploy (rules + hosting)
```bash
cd /Users/injooncha/processcheck/processcheck-html
firebase deploy
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `allow write: if true` | `allow write: if isAuthenticated()` | Phase 1 | Eliminates unauthenticated writes to all 12 collections |
| No demo gating | `IS_PROD` hostname check hides demo section | Phase 1 | Demo cards work on localhost, invisible on production |
| No session TTL | 24-hour loginAt check in guardPage | Phase 1 | Sessions auto-expire after 24 hours |
| No Storage rules file | `storage.rules` requiring auth | Phase 1 | Blocks unauthenticated file uploads/downloads |

**Deprecated/outdated:**
- `allow write: if isAuthenticated() || true;` comment pattern in current `firestore.rules` — remove the `|| true` bypass from all collections.

---

## Open Questions

1. **activityLogs collection — is it in firestore.rules?**
   - What we know: `js/firestore-service.js` writes to `activityLogs` collection (line 1939). The current `firestore.rules` does not have a match rule for `activityLogs`.
   - What's unclear: Does a missing match rule in Firestore v2 default to `allow: if false` (deny all) or is there an implicit fallback?
   - Recommendation: In Firestore Rules v2, unmatched documents default to `deny`. But since the app writes to `activityLogs`, add an explicit rule for it. This is a write-only collection from the app perspective — add `allow read, write: if isAuthenticated();`.

2. **Should reads require authentication too?**
   - What we know: The customer portal uses `sessionStorage`-based auth (not Firebase Auth). Locking reads would break the portal.
   - What's unclear: Are there other truly public read paths needed?
   - Recommendation: Keep reads open (`allow read: if true`) for Phase 1. Restrict reads per-collection in a future phase when customer portal auth is upgraded.

3. **MS OAuth users — is the Firebase Auth token guaranteed available before Firestore writes?**
   - What we know: `auth.js` saves user to `localStorage` immediately after `signInWithPopup`. Firebase Auth persists the token to `indexedDB`. On page reload, `auth.currentUser` may be `null` for ~100ms while Firebase resolves the persisted session.
   - Recommendation: The app's existing pattern (localStorage-first session check in `guardPage()`) is fine. Firebase Auth token is needed only for Firestore writes, not reads. The UI only triggers writes after user interaction (not on page load), so by the time a user clicks a button, `auth.currentUser` is populated.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — no test framework configured (confirmed by CLAUDE.md "No test framework is currently configured") |
| Config file | none — Wave 0 must create or document manual verification |
| Quick run command | Manual browser test (see Phase Gate below) |
| Full suite command | Manual browser test (see Phase Gate below) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Unauthenticated HTTP POST to Firestore rejected | smoke (manual) | `curl -X POST "https://firestore.googleapis.com/v1/projects/processsss-appp/databases/(default)/documents/projects" -H "Content-Type: application/json" -d '{}'` — expect 403 | ❌ manual only |
| SEC-02 | Unauthenticated Storage upload rejected | smoke (manual) | Attempt upload via Storage REST API without auth token — expect 403 | ❌ manual only |
| SEC-03 | Demo cards hidden on production hostname | smoke (manual) | Open production URL, verify demo card section not visible | ❌ manual only |
| SEC-04 | XSS payload in task name does not execute | smoke (manual) | Create task with name `<img src=x onerror=alert(1)>`, verify no alert | ❌ manual only |
| SEC-05 | Session expires after 24 hours | unit (manual) | Set `loginAt` to `Date.now() - 86400001` in localStorage, reload any protected page, verify redirect to index.html | ❌ manual only |

### Sampling Rate
- **Per task commit:** Manual spot-check of the specific behavior changed
- **Per wave merge:** All 5 manual checks above
- **Phase gate:** Full manual suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No automated test infrastructure — all verification is manual browser/curl checks
- [ ] Manual test checklist should be documented in verify-work step

*(No automated test files to create — this project has no test framework. Manual verification procedures are the validation layer for Phase 1.)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `firestore.rules`, `js/auth.js`, `js/firebase-init.js`, `js/utils.js`, `js/pages/login.js`, `js/components.js`, `js/firestore-service.js`
- CLAUDE.md project instructions — login design, navigation design, security decisions
- `.planning/STATE.md` — decision: "Demo card + Firebase Auth conflict must be resolved before Firestore rules can be finalized. SEC-03 prerequisite for SEC-01"

### Secondary (MEDIUM confidence)
- Firebase Security Rules documentation patterns — `rules_version = '2'`, `request.auth != null`, `get()` limitations
- Firebase Hosting + Storage rules deployment via `firebase.json`

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools are existing (Firebase Rules, browser built-ins); no new dependencies
- Architecture: HIGH — patterns derived from direct codebase inspection, not speculation
- Pitfalls: HIGH — derived from reading actual code state (no `loginAt` in auth.js, no `storage.rules` file, demo cards wired unconditionally in login.js)

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain; Firebase SDK v11.3.0 rules syntax is stable)
