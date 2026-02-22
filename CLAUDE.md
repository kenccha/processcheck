# CLAUDE.md

## Project Overview

ProcessCheck (개발 프로세스 관리 시스템) — an electronic product development process management system for improving transparency and cross-departmental collaboration. Korean-language UI.

## Tech Stack

- **Framework:** Next.js 15 (React 18), TypeScript 5, static export mode
- **Styling:** Tailwind CSS 3.4 with custom theme colors (primary, success, warning, danger)
- **Backend:** Firebase (Firestore, Authentication, Storage) — SDK v12.9
- **Deployment:** GitHub Pages via GitHub Actions (push to `main`)

## Commands

- `npm run dev` — start local dev server
- `npm run build` — production build (static export to `/out`)
- `npm run lint` — ESLint check
- `npm run start` — start production server
- `node scripts/seed.mjs` — seed Firestore with sample data

## Project Structure

```
app/                    # Next.js App Router pages (all "use client")
  dashboard/            # Role-based dashboard
  projects/             # Project list (multi-view) and [id] detail
  project/              # Project creation
  task/                 # Task creation
  admin/checklists/     # Checklist template management
  landing/              # Landing page
components/             # Shared components (Navigation.tsx)
contexts/               # AuthContext.tsx (auth + authorization)
lib/
  firebase.ts           # Firebase initialization
  firestoreService.ts   # All Firestore CRUD operations
  types.ts              # TypeScript type definitions
  mockData.ts           # Mock data & utilities
scripts/
  seed.mjs              # Database seeding script
```

## Key Conventions

- All pages use `"use client"` directive — this is a fully client-rendered SPA
- Path alias: `@/*` maps to project root (e.g., `@/lib/types`)
- TypeScript strict mode enabled
- Authentication is name-based (no passwords), stored in localStorage via `useAuth()` hook
- Protected routes use `useRequireAuth()` which auto-redirects to `/` if unauthenticated
- Real-time data via Firestore `onSnapshot` subscriptions (`subscribeProjects`, etc.)
- Firestore timestamps are converted to JS Dates via helper functions in `firestoreService.ts`
- Database auto-seeds on first load via `seedDatabaseIfEmpty()`

## Domain Model

- **User roles:** worker, manager, pm, scheduler
- **Departments:** 10 departments (dev, quality, sales, manufacturing, etc.)
- **Project stages:** 11 stages from 발의검토 to 영업이관
- **Task statuses:** pending, in_progress, completed, approved, rejected
- **Risk levels:** green, yellow, red

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in Firebase credentials:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_BASE_PATH` (optional, for subdirectory deployment)

## Important Notes

- No test framework is currently configured
- Static export mode (`output: "export"`) — no server-side features (API routes, SSR, middleware)
- Image optimization is disabled for static export compatibility
- ESLint extends `next/core-web-vitals` and `next/typescript`
