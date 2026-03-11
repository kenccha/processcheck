# Technology Stack

**Analysis Date:** 2026-03-12

## Languages

**Primary:**
- JavaScript (ES modules) — Client-side logic, page controllers, utilities
- HTML5 — Page markup and layout templates
- CSS 3 — Design system with CSS custom properties (light/dark mode support)

**Secondary:**
- Firestore Security Rules — Database access control and permissions

## Runtime

**Environment:**
- Browser-based (no Node.js required for runtime)
- CDN-delivered Firebase SDK (v11.3.0)

**Execution Model:**
- Client-side SPA (Single Page Application)
- No build step required
- No framework — vanilla JavaScript ES modules with import/export
- Dev server: `python3 -m http.server 8080`

## Frameworks

**UI/Components:**
- None (vanilla HTML + CSS + JavaScript)
- Custom component architecture in `js/components.js` for shared UI (navigation, theme, notifications)
- Manual component composition via HTML templates

**Firebase Integration:**
- Firebase JavaScript SDK v11.3.0 (CDN via importmap)
  - `firebase/app` — Core initialization
  - `firebase/firestore` — Real-time database
  - `firebase/auth` — Microsoft OAuth authentication
  - `firebase/storage` — File storage (UI-only, not integrated)

## Key Dependencies

**Critical:**
- Firebase SDK v11.3.0 (CDN) — Database, auth, real-time subscriptions
  - Location: Script importmap in each HTML page (e.g., `index.html` lines 10-19)
  - Exports: `db`, `auth`, `storage` from `js/firebase-init.js`

**Infrastructure:**
- Pretendard Font (CDN) — Korean typography support
  - URL: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`
- JetBrains Mono (Google Fonts) — Code/monospace font
  - URL: `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap`

## Configuration

**Environment:**
- Firebase config hardcoded in `js/firebase-init.js` (lines 12-19)
  - Project ID: `processsss-appp`
  - API Key exposed (browser public key, safe)
  - Auth domain: `processsss-appp.firebaseapp.com`
  - Storage bucket: `processsss-appp.firebasestorage.app`

**Build/Dev:**
- `firebase.json` — Hosting configuration
  - Public directory: `.` (root)
  - Cache control: HTML (no-cache), JS/CSS (3600s), images (86400s)
  - Ignores: `firebase.json`, `.firebaserc`, `node_modules/`, `capture-screenshots.mjs`

**Page Structure:**
- Entry points: 14 HTML files (no routing framework)
  - `index.html` — Login page
  - `dashboard.html` — Main dashboard (role-based)
  - `project.html` — Single project detail
  - `projects.html` — Project list (7 views)
  - `task.html` — Task detail
  - `admin-checklists.html` — Template management
  - Others: sales, customers, activity, notifications, etc.

**Session Management:**
- localStorage-based auth (no server-side sessions)
  - Key: `pc_user` — Stores user object (name, email, role, department)
  - No persistent session tokens (demo cards) or Firebase Auth session (OAuth)

**Theme System:**
- CSS custom properties (`:root` for light, `[data-theme="dark"]` for dark)
- localStorage key: `pc-theme` (values: "light" or "dark")
- Default: light mode
- Flash prevention: inline `<script>` in each HTML `<head>` (lines 8-9 in index.html)

## Platform Requirements

**Development:**
- Browser with ES module support (all modern browsers)
- Python 3 (for local dev server)
- No build tools, npm, or Node.js required

**Production:**
- Firebase Hosting
- Custom domain or Firebase-provided domain
- Firestore database
- Firebase Authentication (Microsoft OAuth)

**Client Requirements:**
- Modern browser (ES2020+)
- Cookies/localStorage enabled
- JavaScript enabled

---

*Stack analysis: 2026-03-12*
