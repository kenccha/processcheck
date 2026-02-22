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
  project/              # Project detail (single project view)
  task/                 # Task detail (single task view)
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

### User Roles (3 roles)
- **실무자 (worker):** 실제 업무 담당자. 영업, 개발, 디자이너 등 다양한 직군이 실무자에 포함됨. 태스크 수행, 체크리스트 완료, 파일 업로드, 코멘트 작성.
- **매니저 (manager):** 부서별 관리자. 태스크 승인/반려, 자기 부서 체크리스트 편집.
- **PM (pm):** 기획조정실. 전체 프로젝트를 관리·조율. 스테이지/부서 추가·삭제, 모든 체크리스트 편집, 프로젝트 생성.
- ~~scheduler~~ (삭제됨 — PM에 통합)

### Departments
10 departments: 개발팀, 품질팀, 영업팀, 제조팀, 구매팀, CS팀, 경영관리팀, 글로벌임상팀, 디자인연구소, 인증팀

### Project Stages (6 phases, 각각 작업+승인 쌍)
스테이지는 "작업 단계"와 "승인 위원회"가 한 쌍으로 묶여 표시됨 (동그라미 2개).
숫자 접두사 제거, 의미 있는 이름 사용:

| Phase | 작업 단계 (●) | 승인 게이트 (●) |
|-------|--------------|----------------|
| **발의** | 발의검토 | 발의승인 |
| **기획** | 기획검토 | 기획승인 |
| **WM** | WM제작 | WM승인회 |
| **Tx** | Tx단계 | Tx승인회 |
| **MSG** | MasterGatePilot | MSG승인회 |
| **양산/이관** | 양산 | 영업이관 |

- 매트릭스/진행률 UI에서 한 Phase 안에 동그라미 2개(작업●, 승인●)로 표현
- 승인 위원회 = 해당 프로세스의 최종 게이트

### Task & Risk
- **Task statuses:** pending, in_progress, completed, approved, rejected
- **Risk levels:** green, yellow, red

### Projects Page View Order
뷰 탭 순서: **테이블 → 매트릭스 → 카드** (기본 뷰 = 테이블). 나머지 뷰(간트, 칸반, 타임라인, 캘린더)는 후순위.

## Known Gaps (To Fix)

### Data Gaps
- PM(박민수) 로그인 시 대시보드가 비어 있음 — PM 전용 뷰/데이터 필요
- 매니저(강민지, 품질팀) 승인 대기 데이터 부족
- 알림이 특정 유저에만 할당, 나머지 유저 알림 0개
- 변경 요청 2개뿐 (proj1, proj4)

### Unimplemented Features
- 파일 업로드: UI만 있고 Firebase Storage 연동 없음
- 태스크 생성: 생성 페이지/모달 없음 (시드 데이터만 존재)
- 체크리스트 토글: 로컬 state만 변경, Firestore 미저장
- 대시보드 클릭: 승인 대기·내 프로젝트·통계 카드 클릭 시 상세 페이지 이동 안 됨
- 프로젝트 정렬(Sort) 미구현
- 템플릿 → 프로젝트 적용 기능 없음
- 태스크 승인 후 스테이지 자동 전환 없음
- 변경 요청 부서별 개별 승인 흐름 없음
- 알림 자동 생성 (태스크 완료/승인 시) 없음
- 빈 상태(Empty State) 안내 UI 없음
- 에러 처리 UI 없음

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
