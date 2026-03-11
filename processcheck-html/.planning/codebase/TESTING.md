# Testing Patterns

**Analysis Date:** 2026-03-12

## Test Framework

**Runner:**
- Not detected — no test framework configured

**Build/Test Config:**
- No `jest.config.js`, `vitest.config.js`, `package.json` test scripts found
- No `*.test.js` or `*.spec.js` files in codebase

**Status:**
- **No automated testing infrastructure in place**
- This is a plain HTML + vanilla JavaScript project with no build step
- Testing must be manual or external (e.g., Puppeteer, Playwright for E2E)

**Run Commands:**
- No test command available: `npm test` is not configured
- Code is tested manually via:
  1. Browser dev tools (Chrome DevTools) for debugging
  2. Firebase Emulator Suite (for local Firestore testing, if set up)
  3. Manual QA in deployed environments

## Test File Organization

**Location:**
- No test files exist — no `/test`, `/tests`, `/__tests__` directories

**Naming:**
- Not applicable — no test files

**Structure:**
- Not applicable — no test files

## Manual Testing Patterns

**Browser DevTools:**
- localStorage inspection: `localStorage.getItem("pc_user")`, `localStorage.getItem("pc-theme")`
- Network tab for Firestore queries and Firebase Auth calls
- Console for error/warning inspection (`console.error()` calls)
- Breakpoints in `js/pages/*.js` for step-through debugging

**Firestore Emulator (if used):**
- Configuration: `firestore.rules` file exists at `processcheck-html/firestore.rules`
- Rules define Firestore security policies (read/write permissions)
- Local testing via `firebase emulator:start` (would require `firebase.json` setup)

**Login Testing:**
- Demo cards: 3 sample users for quick testing (hardcoded in seeding, now disabled)
- Microsoft OAuth: Real Azure AD integration for production testing
- localStorage persists session: Manual logout clears session

**Data Validation:**
- Input validation functions exist but not tested automatically:
  - `validateInput(str, maxLength)` — tests max length, trims whitespace
  - `validateFile(file)` — tests file size (max 10MB) and MIME type
  - `validateId(id)` — tests regex pattern `^[a-zA-Z0-9_-]+$`

## Mocking

**Framework:**
- No mocking library (no Jest/Vitest mock/spy utilities)

**Patterns:**
- Firestore is mocked via seeded test data during development
- Mock data in `js/firestore-service.js:72-100` defines sample users/projects
- Fallback loaders provide stub data when real-time subscriptions unavailable:
  - `fallbackLoadProjects()` — static project list
  - `fallbackLoadChecklistItemsByAssignee()` — task list by assignee
  - `fallbackLoadNotifications()` — notification stub array

**What to Mock:**
- Firestore operations (subscribe/get/add/update/delete)
- Firebase Auth (login, logout, signOut)
- localStorage (persist auth state, theme preference, cache)

**What NOT to Mock:**
- DOM operations (render functions expected to work with real DOM)
- Date/time calculations (use real `new Date()`)
- URL query parameters (`getQueryParam()` reads real window.location.search)

**Example fallback pattern from `dashboard.js`:**
```javascript
// Phase 1: Try real-time subscriptions
unsubProject = subscribeProjects((projects) => {
  allProjects = projects;
  if (hasFullData) computeDerived();
});

// Phase 2: Fall back to static data if subscription fails
setTimeout(() => {
  if (!hasFullData) {
    allProjects = fallbackLoadProjects();
    computeDerived();
    render();
  }
}, 2500);
```

## Fixtures and Factories

**Test Data:**
- `getMockData()` in `js/firestore-service.js:72-100`
  - Returns `mockUsers` (7 sample users with roles: worker/manager/observer)
  - Returns `mockProjects` (10 sample projects, mixed types: 신규개발/설계변경)
  - Mock template items generated from `getTemplateData()` (193 items across 6 phases)

**Example mock user:**
```javascript
{ id: "user1", name: "김철수", email: "chulsoo@company.com", role: "worker", department: "개발팀" }
```

**Example mock project:**
```javascript
{
  id: "proj1", name: "신규 체성분 분석기 개발",
  projectType: "신규개발", status: "active", progress: 35,
  startDate: new Date("2026-01-01"), endDate: new Date("2026-08-31"),
  pm: "박민수", riskLevel: "yellow", currentStage: "WM제작"
}
```

**Location:**
- `js/firestore-service.js:72-343` — all mock data constants and template generator

**Usage:**
- Called during Firestore initialization for seeding (now disabled per CLAUDE.md)
- Used as fallback when real-time subscriptions timeout

## Coverage

**Requirements:**
- Not enforced — no coverage tool configured
- No target percentage specified

**View Coverage:**
- Not applicable — no coverage reporting tool available

**Current State:**
- 0% automated test coverage
- Manual testing only via browser and Firestore emulator

## Test Types

**Unit Tests:**
- Not implemented
- Would test utility functions: `formatDate()`, `validateInput()`, `daysUntil()`, etc.
- Would test data transformers: `docToProject()`, `docToChecklistItem()`, etc.

**Integration Tests:**
- Not implemented
- Would test Firestore CRUD operations with real/emulated database
- Would test auth flow: login → user creation → role assignment

**E2E Tests:**
- Not implemented
- Would use Puppeteer or Playwright to test full user flows:
  1. Login with Microsoft OAuth
  2. Navigate to dashboard
  3. Create project
  4. Add checklist item
  5. Complete task
  6. Approve task (observer role)

**Performance Tests:**
- Not implemented
- Cache performance could be tested: `loadFromCache()` / `saveToCache()` timing
- Subscription speed monitored via manual timing

## Common Patterns

**Async Testing:**
- All Firestore operations are promise-based: `async function`, `await`, `.then()/.catch()`
- Page loads use subscription callbacks for real-time updates
- Fallback mechanism with `setTimeout()` for timeout handling: waits 2.5s before fallback

**Example from `dashboard.js:124-163`:**
```javascript
// Phase 1: Try subscriptions
unsubProject = subscribeProjects((projects) => {
  allProjects = projects;
  hasFullData = true; // Mark as loaded
  render();
});

// Phase 2: Timeout + fallback
setTimeout(() => {
  if (!hasFullData) {
    // Subscription didn't complete in time
    allProjects = fallbackLoadProjects();
    computeDerived();
    render();
  }
}, 2500);
```

**Error Testing:**
- Try-catch around data parsing: `catch { return null; }`
- UI error states rendered when data load fails:
  ```javascript
  catch (err) {
    console.error("Init error:", err);
    app.innerHTML = `<div class="empty-state">...</div>`;
  }
  ```

**State Management Testing:**
- Manual via browser DevTools: inspect `activeTab`, `checklistItems`, `selectedStage`
- Session cache inspected: `sessionStorage.getItem("pc_dash_" + userId)`
- localStorage checked: `localStorage.getItem("pc_user")`, `localStorage.getItem("pc-theme")`

**Firestore Rule Testing:**
- Rules stored in `processcheck-html/firestore.rules`
- Can be tested with Firebase Emulator: `firebase emulator:exec`
- Manual testing via browser: attempt read/write and observe permission errors

## Snapshot & Regression Testing

- Not implemented — no snapshot testing library configured

## Manual Test Checklist (Examples)

**Authentication Flow:**
1. Open `index.html` → see login page
2. Click Microsoft OAuth button → authenticate with Azure AD
3. Verify redirect to dashboard and user in localStorage
4. Verify theme preference persists on page reload

**Data Loading:**
1. Dashboard → wait for Firestore subscription
2. Check sessionStorage cache: `pc_dash_[userId]` populated within 2.5s
3. Verify project cards render without fallback data

**Error Handling:**
1. Network offline → Firestore subscription fails after 2.5s
2. Verify fallback data loads
3. Check console.error() logged the timeout/error
4. UI remains functional with stale/fallback data

**File Operations:**
1. Upload file > 10MB → validation catches error: "파일 크기가 10MB를 초과합니다"
2. Upload .exe file → MIME type validation rejects: "허용되지 않는 파일 형식입니다"
3. Upload valid PDF → file upload to Firebase Storage succeeds

---

*Testing analysis: 2026-03-12*
