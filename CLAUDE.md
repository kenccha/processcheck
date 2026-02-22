# CLAUDE.md

## Project Overview

ProcessCheck (개발 프로세스 관리 시스템) — an electronic product development process management system for improving transparency and cross-departmental collaboration. Korean-language UI.

## Tech Stack

### Next.js App (primary)
- **Framework:** Next.js 15 (React 18), TypeScript 5, static export mode
- **Styling:** Tailwind CSS 3.4 with custom theme colors (primary, success, warning, danger)
- **Backend:** Firebase (Firestore, Authentication, Storage) — SDK v12.9
- **Deployment:** GitHub Pages via GitHub Actions (push to `main`)

### HTML Port (`processcheck-html/`)
- **No framework** — plain HTML + CSS + vanilla JavaScript ES modules
- **Firebase SDK:** CDN via `<script type="importmap">` (v11.3.0)
- **Styling:** Single `css/styles.css` with CSS custom properties, 라이트모드(기본)+다크모드 토글
- **Dev server:** `cd processcheck-html && python3 -m http.server 8080`
- **Purpose:** Simpler deployment without build step, same Firebase Firestore backend

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
processcheck-html/        # Plain HTML port (no build step)
  index.html              # Login (3 sample user cards)
  landing.html            # Marketing page
  dashboard.html          # Role-based dashboard
  projects.html           # Project list (7 views)
  project.html            # Project detail (4 tabs)
  task.html               # Task detail
  admin-checklists.html   # Template admin
  css/styles.css          # All design tokens + components
  js/firebase-init.js     # Firebase config
  js/firestore-service.js # All Firestore CRUD + subscriptions
  js/auth.js              # localStorage auth + page guard
  js/utils.js             # Helper functions
  js/components.js        # Shared nav, spinner, badges
  js/pages/*.js           # Page-specific controllers
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

### Login Design (확정)
- **이름 입력 필드 없음** — 로그인 화면에서 이름을 직접 입력하는 방식을 사용하지 않음
- 3개의 샘플 사용자 카드 버튼으로 구성:
  - 김철수 (실무자/worker) — 개발팀
  - 이영희 (매니저/manager) — 개발팀
  - 박민수 (기획조정실/observer) — 경영관리팀
- 카드 클릭 → 즉시 해당 역할로 로그인 → 대시보드 이동
- DB 시딩 중에는 스피너 표시, 완료 후 카드 노출

### Dashboard Design (확정)
- **통계 카드 4개 전부 클릭 가능**: 작업대기→섹션스크롤, 승인대기→섹션스크롤, 프로젝트→projects.html, 알림→섹션스크롤
- **역할별 구독 분리**:
  - 실무자: `subscribeChecklistItemsByAssignee` (자기 이름 기준, 마감 3일 이내)
  - 매니저: `subscribeAllChecklistItems` → 자기 부서 필터
  - 기획조정실: `subscribeAllChecklistItems` (전체)
- **알림 클릭 시 해당 페이지로 이동** (Next.js 라우트 → HTML 파일 라우트 자동 변환)
- 작업/승인대기/프로젝트 행 클릭 → 각각 task.html, project.html로 네비게이션

### Checklist Admin Design (확정)
- **3가지 뷰 모드**: 매트릭스(matrix), 트리(tree), 리스트(list) — 기본값 matrix
- **트리 뷰**: 좌측 단계 사이드바 + 부서 탭 + 아이템 목록 (드래그앤드롭 순서변경)
- **매트릭스 뷰**: stages×departments 테이블, 셀에 아이템 수/필수 수 표시, 클릭 시 트리 뷰 전환
- **리스트 뷰**: 전체 아이템 flat list, 검색+페이즈 필터+부서 필터, 편집 아이콘 → 트리 뷰 전환
- `subscribeAllTemplateItems`로 전체 항목 실시간 구독 (매트릭스/리스트 뷰용)

## Domain Model

### User Roles (3 roles)
- **실무자 (worker):** 실제 업무 담당자. 영업, 개발, 디자이너 등 다양한 직군이 실무자에 포함됨. 태스크 수행, 체크리스트 완료, 파일 업로드, 코멘트 작성.
- **매니저 (manager):** 부서별 관리자. **work stage** 작업 승인/반려, 자기 부서 체크리스트 편집.
- **기획조정실 (observer):** 전체 프로젝트 현황 모니터링, **gate stage** 작업 최종 승인, 스테이지/부서 추가·삭제, 모든 체크리스트 열람/편집.

### Departments
10 departments: 개발팀, 품질팀, 영업팀, 제조팀, 구매팀, CS팀, 경영관리팀, 글로벌임상팀, 디자인연구소, 인증팀

### Project Types (프로젝트 유형) — 확정
- **신규개발**: 연 5-6건, 장기(1년), 6 phase 전체 진행. 프로젝트 목록의 "신규개발" 탭.
- **설계변경**: 월 ~50건, 짧은 사이클. 프로젝트 목록의 "설계변경" 탭.
  - 규모별 차등 프로세스:
    - 경미(minor): 접수 → 승인 (2단계)
    - 중간(medium): 접수 → 검토 → 승인 → 적용 (4단계)
    - 대규모(major): 기존 6 phase 전체

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
- 사용자 UI에서는 항상 6개 phase만 표시. DB의 12개 stage name은 내부 데이터 키로만 사용.

### Firestore DB 구조 (확정)
- **`templateStages`** (6 phases): phase0-phase5, 각 phase에 `workStageName` + `gateStageName`
- **`templateItems`**: `stageId`로 phase ID 참조 (예: "phase0")
- **`checklistItems`** (실제 작업): `stage`에 12개 개별 stage name 사용 (예: "WM제작", "WM승인회")
- Stage name에 `N_` prefix 없음 — bare name만 사용 (예: "WM제작", NOT "4_WM제작")

### 승인 2단계 구조 (확정)
프로젝트에는 **두 가지 승인 유형**이 존재:

1. **매니저 승인 (Task Approval)**: 부서 관리자(manager)가 **work stage** 작업을 승인/반려
   - 대상 stage: 발의검토, 기획검토, WM제작, Tx단계, MasterGatePilot, 양산
   - `checklistItems`의 `approvalStatus`, `approvedBy`, `approvedAt` 필드 사용

2. **게이트 승인 (Gate/Committee Approval)**: 기획조정실(observer)이 **gate stage** 작업을 최종 승인
   - 대상 stage: 발의승인, 기획승인, WM승인회, Tx승인회, MSG승인회, 영업이관
   - 해당 work stage의 모든 작업이 매니저 승인 완료 후 진행
   - 동일한 `approvalStatus/approvedBy/approvedAt` 필드 사용

**승인 권한 규칙 (코드)**: `GATE_STAGES` 배열(`utils.js`)로 판별. work stage → manager만, gate stage → observer만.

### Task Detail Design (확정)
- 타임라인에 각 이벤트별 날짜+행위자 표시
- 승인 대기 시 검토자 이름 + 완료일 표시
- 반려 시 worker에게 "재작업 시작" 버튼 제공 (`restartTask()`)
- `completeTask()` 시 `approvalStatus: "pending"` 자동 설정

### Project Detail Design (확정)
- **Stat 카드 5개 (클릭 가능)**: 전체작업, 진행중, 지연, 매니저승인대기, 위원회승인대기
  - 클릭 → 체크리스트 탭 + 해당 필터 적용
- **프로젝트 상태 요약 카드**: "단계별/부서별 진행 상황" 대신 요약 카드 1개
  - 현재 phase + phase 진행 바 (✔완료/[현재]/미래)
  - 마감일 + D-day
  - 계획 대비 진행 상태 (정상/지연/심각)
  - 병목: 어느 부서에서 막혀있는지
- **"부서별 진행 상황" 없음** — 의미 없으므로 제거됨

### Matrix View Design (확정)
- **6개 phase 열** (발의, 기획, WM, Tx, MSG, 양산/이관)
- 각 셀에 **동그라미 2개**: 왼쪽 ●=작업(completed/total), 오른쪽 ●=승인위원회(✓/✗/⏳/—)
- `PHASE_GROUPS` 배열: `utils.js`에서 export
- 미승인 시: 경고만 표시 (다음 phase 진행 가능, 잠금 없음)

### Theme Design (확정)
- **기본 = 라이트모드**, 다크모드 토글 가능
- 네비게이션 바에 sun/moon 토글 버튼
- `:root` = 라이트모드, `[data-theme="dark"]` = 다크모드 CSS 변수
- 선택은 `localStorage("pc-theme")`에 저장하여 유지
- 각 HTML 파일에 inline `<script>`로 flash 방지

### Calendar View Design (확정)
- 각 이벤트에 **담당자(assignee) 이름** 표시
- 이전/다음 월 이동 가능

### Task & Importance
- **Task statuses:** pending, in_progress, completed, rejected
- **Approval statuses:** pending, approved, rejected
- **Importance levels (중요도):** green(보통), yellow(중요), red(긴급)

### Projects Page View Order (확정)
뷰 탭 순서: **테이블 → 매트릭스 → 카드** → 간트 → 칸반 → 타임라인 → 캘린더 (기본 뷰 = 테이블).

## Known Gaps (To Fix)

### ✅ Fixed (수정 완료)
- ~~대시보드 클릭 안됨~~ → 통계 카드 전부 클릭 가능 (스크롤/네비게이션)
- ~~알림 링크 404~~ → 전체 13개 알림 링크 올바른 쿼리스트링 형식으로 수정
- ~~알림 자동 생성 없음~~ → completeTask/approveTask/rejectTask에서 자동 알림 생성
- ~~체크리스트 하드코딩~~ → Firestore 템플릿 기반 동적 로드 (stage+department별)
- ~~스테이지명 깨짐~~ → 전체 페이지에서 N_ prefix 완전 제거, bare name 사용
- ~~변경요청 권한 없음~~ → PM/매니저만 승인·반려 가능, 반려사유 저장
- ~~시드 데이터 불일치~~ → firestoreService 시드와 mockData 통일
- ~~대시보드 간격 깨짐~~ → mb-8 CSS 클래스 추가
- ~~뷰 탭 순서~~ → 테이블 → 매트릭스 → 카드 순으로 재배치
- ~~승인 권한 분리~~ → work stage=매니저, gate stage=기획조정실
- ~~작업 상세 히스토리 날짜 없음~~ → 타임라인에 날짜+행위자 표시
- ~~승인 대기 정보 부족~~ → 검토자 + 완료일 표시
- ~~반려 재작업 없음~~ → restartTask() + "재작업 시작" 버튼 추가
- ~~completeTask에 approvalStatus 없음~~ → "pending" 자동 설정
- ~~매트릭스 12열~~ → 6 phase 열 + 동그라미 2개 (작업+승인)
- ~~시드 데이터 부족~~ → gate stage + 전 부서 + 설계변경 프로젝트 커버 (59 tasks, 10 projects)
- ~~프로젝트 상세 stat 카드 클릭 안됨~~ → 5개 카드 전부 클릭 가능
- ~~캘린더 담당자 없음~~ → assignee 표시
- ~~다크모드만~~ → 라이트모드(기본) + 다크모드 토글
- ~~위험도~~ → 중요도로 명칭 변경 (보통/중요/긴급)

### Remaining Gaps
- 파일 업로드: UI만 있고 Firebase Storage 연동 없음
- 태스크 생성: 생성 페이지/모달 없음 (시드 데이터만 존재)
- 프로젝트 정렬(Sort) 미구현
- 템플릿 → 프로젝트 적용 기능 없음
- 태스크 승인 후 스테이지 자동 전환 없음
- 변경 요청 부서별 개별 승인 흐름 없음
- 프로젝트 progress/riskLevel/currentStage 자동 계산 없음

## Claude Code Automations

### Hooks (`.claude/settings.json`)
- **PostToolUse (Edit|Write)**: 파일 수정 시 자동 TypeScript 타입체크 (`tsc --noEmit`)
- **PreToolUse (Edit|Write)**: `.env` 파일 수정 차단

### Subagents (`.claude/agents/`)
- **build-verifier**: 빌드+린트+타입체크 통합 검증 에이전트

### MCP Servers
- **context7**: Next.js, Firebase, React 최신 문서 실시간 참조 (이미 설치됨)

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in Firebase credentials:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_BASE_PATH` (optional, for subdirectory deployment)

## HTML Port Sync Rules (중요)

HTML 포트(`processcheck-html/`)는 Next.js 앱의 수동 포팅 버전이다. Next.js 소스를 수정할 때 HTML 포트에도 동일한 변경을 반영해야 한다.

### 반드시 동기화해야 하는 항목:
1. **역할 변경** (예: pm → observer) → `firestore-service.js`, `utils.js`, `index.html` 모두 수정
2. **DB 구조 변경** (예: 12 stages → 6 phases) → `firestore-service.js` 시드 데이터 + 모든 page JS
3. **UI 기능 추가** (예: 뷰 모드, 클릭 네비게이션) → 해당 page JS에 동일 기능 구현
4. **디자인 결정 사항** → 이 CLAUDE.md에 "(확정)" 표기로 문서화

### 변경 누락 방지:
- Next.js 소스 변경 시 항상 `processcheck-html/js/` 대응 파일 확인
- 새로운 기능 추가 시 CLAUDE.md "Design (확정)" 섹션에 기록
- 역할/구조 변경은 `grep -r` 으로 HTML 포트 전체 검색 후 수정

## Important Notes

- No test framework is currently configured
- Static export mode (`output: "export"`) — no server-side features (API routes, SSR, middleware)
- Image optimization is disabled for static export compatibility
- ESLint extends `next/core-web-vitals` and `next/typescript`
