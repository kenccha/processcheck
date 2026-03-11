# Testing Patterns

**Analysis Date:** 2026-03-12

## Test Framework

**Runner:** None configured.

No test framework, test runner, or assertion library is present in this codebase. There are no `package.json`, `jest.config.*`, `vitest.config.*`, `.mocharc.*`, or any `*.test.*` / `*.spec.*` files in `processcheck-html/`.

**Run Commands:**
```bash
# No test commands available
```

## Current State

This is a no-build, no-dependencies plain HTML+JS app served directly via `python3 -m http.server 8080`. There is no Node.js dependency graph, no bundler, and no test infrastructure.

**What exists instead of automated tests:**
- Manual browser testing against a live Firebase project
- Demo user cards (`index.html`) for quick login as different roles (worker, manager, observer)
- Seed functions (`seedTemplatesIfEmpty`, `seedDatabaseIfEmpty` in `js/firestore-service.js`) that populate Firestore with predictable test data
- Visual verification via `docs/deliverables/` (wireframes, user flow diagrams, feedback system)
- Production guard in `js/pages/login.js` hides demo cards on non-localhost to prevent accidental demo use in prod

## What Can Be Tested (If Framework Added)

**Pure utility functions** in `js/utils.js` are ideal unit test targets (zero DOM/Firebase dependencies):
- `formatStageName(stage)` — string lookup table
- `getRiskClass(level)` / `getRiskLabel(level)` — switch statements
- `getStatusLabel(status)` / `getStatusBadgeClass(status)` — switch statements
- `formatDate(date)` / `formatDateTime(date)` / `timeAgo(date)` — date formatting
- `daysUntil(date)` — date arithmetic
- `escapeHtml(str)` — XSS prevention (DOM-based, requires jsdom)
- `parseMentions(text, userNames)` — regex-based mention parsing
- `renderSimpleMarkdown(text)` — regex-based markdown rendering
- `exportToCSV(data, headers, filename)` — CSV generation (requires Blob mock)
- `validateInput(str, maxLength)` — string sanitization
- `validateId(id)` — regex validation
- `validateFile(file)` — file type/size validation

**Auth module** `js/auth.js` logic can be unit tested with localStorage mocked:
- `getUser()` — reads `pc_user` from localStorage
- `guardPage()` — checks session TTL (`SESSION_TTL = 24 * 60 * 60 * 1000`)
- `startSessionWatcher()` — setInterval-based logout trigger

**Firestore service** `js/firestore-service.js` requires Firebase emulator or mock:
- All `subscribe*` functions return `onSnapshot` unsubscribers
- All `get*` / `create*` / `update*` functions are async Firestore CRUD
- `applyTemplateToProject(projectId, projectType, changeScale)` — complex filtering logic worth testing
- `recalculateProjectStats(projectId)` — aggregation logic

## Adding Tests (Recommended Approach)

Since this is a no-build vanilla JS app, the easiest path to add tests:

**Option A — Vitest with jsdom (minimal setup):**
```bash
# From processcheck-html/ directory:
npm init -y
npm install --save-dev vitest jsdom
```

```js
// vitest.config.js
export default {
  test: {
    environment: "jsdom",
    globals: true,
  },
};
```

```js
// js/__tests__/utils.test.js
import { describe, it, expect } from "vitest";
import { formatStageName, getRiskClass, daysUntil, escapeHtml } from "../utils.js";

describe("formatStageName", () => {
  it("returns formatted name for known stage", () => {
    expect(formatStageName("WM제작")).toBe("W/M 제작");
  });
  it("returns input unchanged for unknown stage", () => {
    expect(formatStageName("unknown")).toBe("unknown");
  });
});

describe("getRiskClass", () => {
  it("maps green to success", () => expect(getRiskClass("green")).toBe("success"));
  it("maps yellow to warning", () => expect(getRiskClass("yellow")).toBe("warning"));
  it("maps red to danger", () => expect(getRiskClass("red")).toBe("danger"));
  it("returns neutral for unknown", () => expect(getRiskClass("")).toBe("neutral"));
});

describe("escapeHtml", () => {
  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });
  it("returns empty string for falsy input", () => {
    expect(escapeHtml(null)).toBe("");
  });
});
```

**Option B — Firebase Emulator for integration tests:**
```bash
firebase emulators:start --only firestore
# Then run tests that call real Firestore operations against local emulator
```

## Coverage Gaps

**All functional code is currently untested.** Key risk areas:

**High risk — business logic without tests:**
- `js/firestore-service.js`: `applyTemplateToProject()` (193 template items, 3 project types, conditional filtering logic) — `js/firestore-service.js` lines 1415–1493
- `js/firestore-service.js`: `recalculateProjectStats()` — project progress, risk level, current stage recalculation — lines 1059–1123
- `js/auth.js`: `loginWithMicrosoft()` — email domain restriction (`@inbody.com` only), new user auto-registration
- `js/auth.js`: `guardPage()` — session TTL check (24h), redirect logic
- `js/utils.js`: `daysUntil()` — D-Day calculation used everywhere in UI

**Medium risk — UI rendering correctness:**
- `js/components.js`: `renderNav()` — role-based menu items (observer gets extra "사용자 관리" link)
- `js/pages/dashboard.js`: urgency grouping logic (overdue / today / this week / later)
- `js/pages/project-detail.js`: `getMatrixCellData()` / `getPhaseGateStatus()` — phase matrix display

**Low risk — pure formatters (easy to test, low impact if broken):**
- All `format*`, `get*Label`, `get*Class` functions in `js/utils.js`

## Test File Organization (When Implemented)

**Recommended layout:**
```
processcheck-html/
  js/
    __tests__/
      utils.test.js       # Pure utils — no mocks needed
      auth.test.js        # Auth logic — mock localStorage + firebase/auth
      firestore.test.js   # Service layer — requires Firebase emulator
```

**Naming convention (to follow):**
- Test files: `{module-name}.test.js`
- Test suites: `describe("functionName", ...)` matching the exported function name
- Test cases: `it("behavior description in plain Korean or English", ...)`

---

*Testing analysis: 2026-03-12*
