# CLAUDE.md

## Project Overview

ProcessCheck (개발 프로세스 관리 시스템) — an electronic product development process management system for improving transparency and cross-departmental collaboration. Korean-language UI.

## Tech Stack

### Next.js App (primary)
- **Framework:** Next.js 15 (React 18), TypeScript 5, static export mode
- **Styling:** Tailwind CSS 3.4 with custom theme colors (primary, success, warning, danger)
- **Backend:** Firebase (Firestore, Authentication, Storage) — SDK v12.9
- **Deployment:** Firebase Hosting via GitHub Actions (push to `main`)

### HTML Port (`processcheck-html/`)
- **No framework** — plain HTML + CSS + vanilla JavaScript ES modules
- **Firebase SDK:** CDN via `<script type="importmap">` (v11.3.0) — Firestore + Authentication
- **Authentication:** Firebase Auth (Microsoft OAuth) + localStorage 기반 세션
- **Styling:** Single `css/styles.css` with CSS custom properties, 라이트모드(기본)+다크모드 토글
- **Dev server:** `cd processcheck-html && python3 -m http.server 8080`
- **Deployment:** Firebase Hosting (`firebase.json` + `.firebaserc` in processcheck-html/)
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
  processcheck.html       # Role-based dashboard (formerly dashboard.html)
  projects.html           # Project list (7 views)
  project.html            # Project detail (4 tabs)
  task.html               # Task detail
  admin-checklists.html   # Template admin
  customers.html          # Customer management
  customer-portal.html    # Customer portal (email auth)
  sales.html              # Sales launch dashboard
  manual.html             # User manual (no auth required)
  img/                    # Manual screenshots (14 PNG files)
  css/styles.css          # All design tokens + components
  js/firebase-init.js     # Firebase config
  js/firestore-service.js # All Firestore CRUD + subscriptions
  js/auth.js              # localStorage auth + page guard
  js/utils.js             # Helper functions
  js/components.js        # Shared nav, spinner, badges, review button
  js/review-system.js     # Review/feedback system (Firestore reviews collection)
  js/pages/*.js           # Page-specific controllers
  firebase.json           # Firebase Hosting config
  .firebaserc             # Firebase project link
  firestore.rules         # Firestore security rules
  docs/deliverables/      # Design deliverables (wireframes, flows, diagrams)
    wireframes.html
    checklist-wireframe.html
    user-flows.html
    flow-annotations.html
    diagram-viewer.html
    feedback.html
    js/review-bootstrap.js  # Standalone review system for deliverables
    js/checklist-live.js    # Live Firestore data for checklist wireframe
    js/deliverable-nav.js   # Top nav + sidebar + screenshot capture for deliverables
    js/feedback-system.js   # Firestore feedback CRUD (feedbacks collection)
docs/
  manual.md               # User manual content (Korean, source of truth)
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

### Login Design (확정 — 2026-03-11 간소화)
- **2가지 로그인 방식 공존**:
  1. **데모 카드 로그인**: 3개의 샘플 사용자 카드 버튼 (기존)
  2. **Microsoft OAuth 로그인**: Firebase Auth 연동
     - 기존 사용자: 이메일로 Firestore 조회 → 바로 대시보드
     - **신규 사용자: 역할/부서 선택 없이 바로 등록** (worker, 부서 미지정) → 대시보드 이동
     - 관리자(admin-users.html)가 나중에 역할/부서 수정
- **자동 시딩 비활성화**: 실제 데이터 사용
- `logout()` 시 Firebase Auth `signOut()`도 함께 호출

### Dashboard Design (확정 — 2026-03-12 변경) — 프로젝트 중심 뷰
- **프로젝트 중심**: 기본 탭이 "프로젝트" — 프로젝트 목록 D-Day + 지연 사유 표시
- **탭 3개**: 프로젝트 / 작업 / 알림 (승인 대기 탭 제거됨)
- **D-Day + 스케줄 지연 중심**: 진행률(%) 대신 D-Day 남은 일수와 지연 사유가 핵심 지표
- **프로젝트 카드**: D-Day(큰 글씨) + 현재Phase 뱃지 + 지연 사유 1줄 요약 (PM 제거됨)
- **긴급도 그룹핑**: 작업 탭에서 마감초과 → 오늘 → 이번주 → 이후 순 정렬, 이후 항목은 접힌 상태
- **통계 카드 3개**: 프로젝트(지연 N건), 긴급(초과+오늘), 알림 (승인 대기 카드 제거됨)
- **알림 탭**: 최근 알림 타임라인 표시
- **헤더**: 사용자 이름만 표시 (부서명 제거됨)
- **역할별 구독 분리**:
  - 실무자: `subscribeChecklistItemsByAssignee` (자기 이름 기준)
  - 매니저: `subscribeAllChecklistItems` → 자기 부서 필터
  - 기획조정실: `subscribeAllChecklistItems` (전체)
- **위원회 승인은 observer만**: 개별 작업 승인 없음, 매니저는 작업 배분만 담당

### Checklist Admin Design (확정)
- **3가지 뷰 모드**: 매트릭스(matrix), 트리(tree), 리스트(list) — 기본값 matrix
- **트리 뷰**: 좌측 단계 사이드바 + 부서 탭 + 아이템 목록 (드래그앤드롭 순서변경)
- **매트릭스 뷰**: stages×departments 테이블, 셀에 아이템 수/필수 수 표시, 클릭 시 트리 뷰 전환
- **리스트 뷰**: 전체 아이템 flat list, 검색+페이즈 필터+부서 필터, 편집 아이콘 → 트리 뷰 전환
- `subscribeAllTemplateItems`로 전체 항목 실시간 구독 (매트릭스/리스트 뷰용)

## Domain Model

### User Roles (3 roles) — 확정 (2026-03-11 변경)
- **실무자 (worker):** 실제 업무 담당자. 태스크 수행, 체크리스트 완료, 파일 업로드, 코멘트 작성.
- **매니저 (manager):** 부서별 관리자. **작업 배분/재배분만** (승인 권한 없음). 자기 부서 체크리스트 편집.
- **기획조정실 (observer):** 전체 프로젝트 현황 모니터링, **위원회(gate) 승인만** (개별 작업 승인 제거됨), 스테이지/부서 추가·삭제, 모든 체크리스트 열람/편집, 사용자 관리.

### Departments
10 departments: 개발팀, 품질팀, 영업팀, 제조팀, 구매팀, CS팀, 경영관리팀, 글로벌임상팀, 디자인연구소, 인증팀

### Project Types (프로젝트 유형) — 확정 (2026-03-12 변경)
- **신규개발**: 연 5-6건, 장기(1년), 6 phase 전체 진행
- **설계변경 기능 제거됨**: 네비, 프로젝트 유형 필터, changeRequests 컬렉션 전부 제거

### Project Stages (6 phases, 각각 작업+승인 쌍)
스테이지는 "작업 단계"와 "승인 위원회"가 한 쌍으로 묶여 있음.
숫자 접두사 제거, 의미 있는 이름 사용:

| Phase | 작업 단계 (●) | 승인 게이트 (●) |
|-------|--------------|----------------|
| **발의** | 발의검토 | 발의승인 |
| **기획** | 기획검토 | 기획승인 |
| **WM** | WM제작 | WM승인회 |
| **Tx** | Tx단계 | Tx승인회 |
| **MSG** | MasterGatePilot | MSG승인회 |
| **양산/이관** | 양산 | 영업이관 |

- 매트릭스 UI에서 한 Phase 안에 동그라미 1개(작업 완료/전체)로 표현
- 승인 위원회 = 해당 프로세스의 최종 게이트
- 사용자 UI에서는 항상 6개 phase만 표시. DB의 12개 stage name은 내부 데이터 키로만 사용.

### Firestore DB 구조 (확정)
- **`templateStages`** (6 phases): phase0-phase5, 각 phase에 `workStageName` + `gateStageName`
- **`templateItems`**: `stageId`로 phase ID 참조 (예: "phase0")
- **`checklistItems`** (실제 작업): `stage`에 12개 개별 stage name 사용 (예: "WM제작", "WM승인회")
- Stage name에 `N_` prefix 없음 — bare name만 사용 (예: "WM제작", NOT "4_WM제작")

### 고객 (대리점/법인) 데이터 모델 (확정)
- **고객**: 제품을 구매·유통하는 거래처 (대리점, 해외법인, 병원, 온라인 채널)
- **`customers`** 컬렉션: name, type(dealer/subsidiary/hospital/online), region, contactName, salesRep, contractStatus, products[]
- **`changeRequests`** 확장: `requestSource`(internal/customer), `customerId`, `customerName`, `customerContactName`, `customerRequestDetail` 필드 추가
- **`launchChecklists`**: 출시 준비 체크리스트 (D-Day 기준), 거래처별 항목에 `customerId` 연결
- **고객 포털 (확정)**: 대리점/법인이 자사 관련 프로젝트의 진행 단계를 확인할 수 있는 읽기 전용 뷰, 이메일 인증 필요
- 상세 설계: `docs/sales-launch-design.md` 참조

### 템플릿 → 프로젝트 체크리스트 생성 (확정)
- **`applyTemplateToProject(projectId, projectType, changeScale?)`**: 193개 templateItems를 프로젝트 유형에 맞게 필터링하여 checklistItems 자동 생성
- **신규개발**: 전체 193개 항목 생성
- **설계변경 minor**: `isRequired`만 + 3개 phase만 (발의/Tx/양산이관) — 약 50~60개
- **설계변경 medium**: `isRequired`만 + 전체 phase — 약 140~150개
- **설계변경 major**: 전체 항목 (신규개발과 동일)
- 프로젝트 상세 체크리스트 탭: 항목이 0개이면 "템플릿에서 체크리스트 생성" 버튼 표시
- 시드 데이터: 각 프로젝트별 `applyTemplateToProject()` 호출 후 프로젝트 상태에 맞게 status 업데이트

### 승인 구조 (확정 — 2026-03-12 변경)
- **개별 작업 승인 절차 제거됨**: 실무자가 작업 완료 처리하면 바로 완료 (approvalStatus 없음)
- `completeTask()`: status를 "completed"로 직접 변경, approvalStatus 미사용
- `approveTask()`, `rejectTask()`: stub 함수 (호출 시 console.warn만)
- **위원회 승인(gate approval)은 유지**: Phase별 `gateRecords` 컬렉션으로 승인/반려 관리
- `updateGateRecord()`: Phase 단위 위원회 승인/반려/초기화 (observer만 가능)
- Phase 뷰에 인라인으로 위원회 승인 상태 표시 + 승인/반려 버튼 (observer만)
- 매니저 주 역할: 작업 배분/재배분 (적합한 사람에게 작업 할당)

### Task Detail Design (확정 — 2026-03-12 변경)
- 타임라인에 각 이벤트별 날짜+행위자 표시
- 개별 작업 승인/반려 UI **제거됨** — 완료 처리만 표시
- `completeTask()` 시 status만 "completed"로 변경 (approvalStatus 미사용)

### Project Detail Design (확정 — 2026-03-12 변경)
- **3탭 구조**: `개요+작업 | 스케줄 | 병목` (기존 4탭에서 변경)
  - 파일 탭, 설계변경 탭 **제거**
  - 개요+체크리스트 **합침**
- **프로젝트 헤더 (탭 위, 항상 표시)**:
  - 제목 + Phase 뱃지 + D-Day (큰 글씨, 색상 강조) + 기간 (PM 제거됨)
  - 지연 시 사유 1줄 요약 (빨강 배너): "품질팀 WM제작 미완료로 3일 지연"
  - 정상 시 녹색 배너: "정상 진행"
  - ~~Phase 파이프라인~~ 제거됨
  - 우측: 전체작업/지연 숫자
- **개요+작업 탭 (2컬럼)**:
  - **위원회 승인 독립 카드** (최상단): 6개 Phase 그리드, 각 Phase별 승인/반려 버튼 — 모든 사용자 접근 가능
  - 좌측: 체크리스트 (max-height + 스크롤)
  - 우측: 최근 활동 타임라인 (sticky, 스크롤)
  - 6가지 뷰: Phase/타임라인/부서/보드(칸반)/매트릭스/리스트
  - **Phase 뷰 (인라인 카드 구조)**:
    - Phase 헤더: 이름 + 진행률 + 날짜범위 + 지연표시 + 접기/펼치기
    - Phase 설명: `PHASE_DESCRIPTIONS` 1줄 텍스트
    - **회의록 인라인**: 최근 2건 표시, "더 보기" 토글, "+ 등록" 인라인 textarea
    - 체크리스트: **고정 높이(320px) 스크롤** 영역, "더보기" 버튼 없음, 전체 항목 표시
    - 좌측 보더 컬러코딩: 완료=녹색, 진행중=파란색, 지연=빨간색, 대기=회색
    - 완료 Phase 기본 접힘, 현재/미래 Phase 펼침
  - 체크리스트 아이템: **단일 동그라미** + 인라인 상태 드롭다운
  - 필터: 단계, 부서
- **스케줄 탭**: 간트 차트 + Phase별 상세 테이블
- **병목 탭**: Phase×부서 히트맵 + 파이프라인 다이어그램 + 지연 원인 상세
- CSV/PDF 내보내기 유지

### Matrix View Design (확정)
- **6개 phase 열** (발의, 기획, WM, Tx, MSG, 양산/이관)
- 각 셀에 **동그라미 1개**: ●=작업(completed/total)
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

### Manual Page Design (확정)
- **인증 불필요**: 로그인 없이 누구나 접근 가능
- **레이아웃**: 좌측 사이드바 TOC + 우측 메인 콘텐츠 (Notion Help / GitBook 스타일)
- **ScrollSpy**: IntersectionObserver로 현재 섹션 자동 하이라이트
- **검색**: 사이드바 상단 실시간 검색, 섹션 제목 기준 필터링
- **모바일**: 사이드바 → 플로팅 TOC 버튼으로 전환
- **콘텐츠 소스**: `docs/manual.md` (한국어, 10개 섹션 + 용어집)
- **섹션 구조**: 시작하기, 프로젝트 관리, 작업 관리, 승인 워크플로우, 설계 변경, 출시 준비, 고객, 체크리스트 관리, 역할별 가이드, FAQ, 용어집
- **자체 CSS**: `manual.js` 내 `<style>` 태그로 삽입 (`.manual-*` 클래스)

### Task & Importance
- **Task statuses:** pending, in_progress, completed, rejected
- **개별 작업 approval 제거됨** — completeTask() → 바로 completed (approvalStatus 미사용)
- **위원회 승인**: gateRecords 컬렉션의 gateStatus (pending/approved/rejected) — Phase 단위
- **Importance levels (중요도):** green(보통), yellow(중요), red(긴급)

### Projects Page View Order (확정 — 2026-03-12 변경)
뷰 탭 순서: **테이블 → 카드** (기본 뷰 = 테이블). 매트릭스/간트/칸반/타임라인/캘린더 뷰 제거됨.

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
- ~~승인 권한 분리~~ → 개별 작업 승인 제거, 위원회(gate) 승인만 observer가 수행
- ~~작업 상세 히스토리 날짜 없음~~ → 타임라인에 날짜+행위자 표시
- ~~승인 대기 정보 부족~~ → 검토자 + 완료일 표시
- ~~반려 재작업 없음~~ → restartTask() + "재작업 시작" 버튼 추가
- ~~completeTask에 approvalStatus 없음~~ → approvalStatus 제거됨, completeTask()는 직접 completed 처리
- ~~매트릭스 12열~~ → 6 phase 열 + 동그라미 1개 (작업만)
- ~~시드 데이터 부족~~ → gate stage + 전 부서 + 설계변경 프로젝트 커버 (59 tasks, 10 projects)
- ~~프로젝트 상세 stat 카드 클릭 안됨~~ → 5개 카드 전부 클릭 가능
- ~~캘린더 담당자 없음~~ → assignee 표시
- ~~다크모드만~~ → 라이트모드(기본) + 다크모드 토글
- ~~위험도~~ → 중요도로 명칭 변경 (보통/중요/긴급)
- ~~템플릿 → 프로젝트 적용 기능 없음~~ → `applyTemplateToProject()` 구현 (193개 템플릿 기반)
- ~~시드 데이터 수동 59개~~ → 템플릿 기반 자동 생성 (프로젝트별 유형/규모에 따라 차등)
- ~~프로젝트 progress/riskLevel/currentStage 자동 계산 없음~~ → `recalculateProjectStats()` 구현 (completeTask/approveTask/rejectTask/restartTask 시 자동 호출)
- ~~작업 완료/승인/반려 시 알림 없음~~ → 자동 알림 생성 (검토자/담당자에게 notifications 컬렉션)
- ~~Gate 승인 시 포털 알림 없음~~ → approveTask에서 gate stage 시 고객 포털 알림 자동 생성
- ~~변경요청 승인/반려 시 포털 알림 없음~~ → updateChangeRequest에서 고객 출처 변경요청 시 portalNotifications 자동 생성
- ~~변경요청 등록 UI 없음~~ → 프로젝트 상세 설계변경 탭에 등록 모달 추가 (고객 출처 선택 + 고객 드롭다운)
- ~~대시보드 고객 요청 카드 없음~~ → 5번째 stat 카드 "고객 요청" 추가 (requestSource=customer, status=in_review 카운트)
- ~~고객 포털 인증 없음~~ → 이메일 인증 추가 (portalLoginEmail 일치 확인, portalEnabled 체크, sessionStorage)

### Remaining Gaps
- 파일 업로드: UI만 있고 Firebase Storage 연동 없음
- 변경 요청 부서별 개별 승인 흐름 없음

### ✅ Recently Fixed (최근 수정 — 2026-03-12)
- ~~설계변경 기능~~ → 전체 제거 (네비, 프로젝트 유형, changeRequests 컬렉션, 관련 UI 모두)
- ~~dashboard.html~~ → processcheck.html로 리네임 (모든 참조 업데이트)
- ~~프로젝트 뷰 7개~~ → 테이블+카드 2개로 축소 (매트릭스/간트/칸반/타임라인/캘린더 제거)
- ~~위원회 승인 Phase 카드 내부~~ → 별도 독립 카드로 분리 (개요+작업 탭 최상단)
- ~~Phase 파이프라인 바~~ → 프로젝트 헤더에서 제거
- ~~Phase 뷰 "20개 더보기"~~ → 제거, 각 Phase별 고정 높이 스크롤 영역으로 변경
- ~~Phase 카드 row (발의~양산/이관)~~ → 제거, 위원회 승인 카드가 대체
- ~~작업 완료 시 최근 활동 미표시~~ → completeTask/restartTask가 project-level 활동 로그 생성하도록 수정
- ~~권한 설정 페이지 없음~~ → admin-permissions.html 신규 생성 (역할별 기능 권한 매트릭스)
- ~~영업 준비 페이지에 프로젝트 안 나옴~~ → `launchChecklists` 생성 경로 추가: 프로젝트 상세에 "🚀 출시 준비 적용" 버튼 + 영업 페이지에서 직접 생성 가능
- ~~영업 일괄 버튼 영구 비활성화~~ → 처리 후 버튼 re-enable + 원래 텍스트 복원
- ~~영업 확인 처리 후 UI 갱신 없음~~ → 성공 토스트 추가 (UI는 onSnapshot 자동 갱신)
- ~~영업 출시 체크리스트 생성 시 고객 목록 미전달~~ → `subscribeCustomers` 구독 + `applyLaunchChecklistToProject`에 customers 배열 전달
- ~~피드백 페이지 네비게이션 없음~~ → `deliverable-nav.js` IIFE에서 `user` 변수가 `MAIN_NAV` 선언보다 나중에 정의되어 TDZ ReferenceError 발생 → `user` 선언을 `MAIN_NAV` 이전으로 이동하여 수정 (모든 deliverable 페이지 영향)
- ~~개별 작업 승인 절차~~ → 제거됨 (실무자 완료 처리 = 최종 완료), 위원회(gate) 승인만 유지
- ~~PM 표시~~ → 전체 페이지에서 PM 필드/표시 제거 (프로젝트 생성/목록/상세/대시보드/CSV)
- ~~대시보드 부서 표시~~ → 헤더에서 부서명 뱃지 제거
- ~~Phase 뷰 인라인 카드~~ → 설명/위원회승인/회의록/체크리스트 인라인 구조 구현
- ~~매트릭스 뷰 동그라미 2개~~ → 1개로 축소 (작업만)
- ~~피드백 캡처 흐릿함~~ → html2canvas scale을 devicePixelRatio로 변경
- ~~대시보드 세로 나열 너무 김~~ → 탭 UI(작업/프로젝트) + 차트 접기/펼치기 + 알림 스크롤 컴팩트화
- ~~대시보드 부가 정보 부족~~ → 오늘 날짜, 통계 카드 서브텍스트, 마감 임박 하이라이트, Phase 뱃지 추가
- ~~태스크 생성 모달 없음~~ → project-detail.js 체크리스트 탭에 "작업 추가" 모달 구현
- ~~프로젝트 정렬 미구현~~ → projects.js 테이블 뷰에 정렬 기능 추가 (이름, 상태, PM, 진행률, 시작일)
- ~~템플릿 적용 기능 없음~~ → project-detail.js 개요 탭에 "템플릿 적용" / "출시 준비 적용" 버튼 추가
- ~~영업 대시보드 없음~~ → sales.html + js/pages/sales.js 신규 생성 (전체 프로젝트 출시 준비 대시보드)
- ~~매뉴얼 스크린샷 없음~~ → Puppeteer로 14개 실제 스크린샷 캡처, manual.js에 이미지 렌더링
- ~~실제 인증 없음~~ → Firebase Auth Microsoft OAuth 연동 (HTML 포트), 데모 카드와 공존, 신규 사용자 역할/부서 선택
- ~~GitHub Pages 배포~~ → Firebase Hosting으로 전환 (보안 강화), deploy.yml 업데이트
- ~~산출물 리뷰 기능 없음~~ → review-system.js + review-bootstrap.js 구현, 전체 리뷰 워크플로우 (코멘트/이슈/승인, 투표, 답글, 상태관리)
- ~~체크리스트 와이어프레임 정적 데이터~~ → checklist-live.js로 Firestore templateStages/templateItems 실시간 연동
- ~~네비 구조 불필요한 항목~~ → 대시보드 탭 제거 (로고 클릭으로 이동), 매뉴얼을 리뷰 드롭다운에 통합
- ~~데모/실사용 데이터 미분리~~ → `isDemo: true` 플래그 + `filterDemo()` + 마이그레이션 함수로 완전 분리
- ~~피드백 스크린샷 전체페이지~~ → 뷰포트 캡처로 변경 + 다중 스크린샷 축적 지원

### Navigation Design (확정 — 2026-03-11 변경)
- **로고 클릭 → 대시보드**: ProcessCheck 로고 클릭으로 이동
- **네비 탭 순서**: 출시위원회 → 체크리스트 → 리뷰(드롭다운) → | → 다른 사이트(드롭다운)
- **설계변경 제거됨** (2026-03-12): 네비, 프로젝트 유형, changeRequests 전체 제거
- **리뷰 드롭다운**: 전체 화면 설계, 업무 흐름, 시스템 구조, 피드백 모아보기, 매뉴얼, **사용자 관리** (observer만)
- **다른 사이트 드롭다운** (구 "관련 서비스"): 영업 출시 준비(외부↗), 고객 관리(외부↗) — 구분선(|)으로 시각적 분리
- `components.js`의 `BASE_NAV_LINKS`와 `deliverable-nav.js`의 `MAIN_NAV` 동기화 필수

### Login Design — 간소화 (확정 — 2026-03-11 변경)
- **MS OAuth 신규 사용자**: 역할/부서 선택 화면 **제거**, 바로 기본값(`worker`, 부서 미지정)으로 Firestore 등록 → 대시보드 이동
- 관리자(admin-users.html)가 나중에 역할/부서 수정
- **데모 카드 로그인**: 유지 (기존대로)
- **자동 시딩 비활성화**: `seedDatabaseIfEmpty()` 호출 제거 — 실제 데이터 직접 입력

### Demo/Real Data Separation Design
- **isDemo 시스템 완전 제거됨** (2026-03-11): 실제 운영 모드로 전환
- 모든 샘플/시드 데이터 Firestore에서 삭제 완료 (2,486개 문서)
- 템플릿 데이터도 삭제 (210개) — 사용자가 직접 입력
- `seedDatabaseIfEmpty()` 비활성화

### Feedback/Screenshot System Design (확정 — 2026-03-12 변경)
- **뷰포트 캡처**: html2canvas로 현재 보이는 영역만 캡처 (전체 페이지 X)
- **해상도**: `scale: window.devicePixelRatio` 사용 (Retina 디스플레이 선명도 보장)
- **다중 스크린샷**: "저장 & 더 캡처" 버튼 → 페이지로 복귀 → 스크롤/이동 → 추가 캡처 → "피드백 작성"
- **플로팅 바**: 캡처 중 하단에 썸네일 + "추가 캡처" / "피드백 작성" / "취소" 버튼
- **Firestore `feedbacks` 컬렉션**: `screenshots` 배열 필드 (레거시 `screenshot` 문자열과 하위 호환)
- **파일**: `docs/deliverables/js/deliverable-nav.js` (섹션 7: 캡처 오버레이), `docs/deliverables/js/feedback-system.js`

### Review System Design (확정)
- **메인 앱 페이지**: 네비게이션 바에 💬 리뷰 버튼 (알림 벨 옆), 클릭 시 슬라이드인 패널
- **산출물 페이지**: FAB(Floating Action Button) 💬 버튼, 클릭 시 리뷰 패널
- **Firestore `reviews` 컬렉션**: pageId, type(comment/issue/approval), status(open/resolved/wontfix), votes, replies, history
- **권한**: MS OAuth 인증 사용자만 리뷰 작성 가능, 데모 카드 사용자는 읽기만
- **파일**: `js/review-system.js` (메인 앱 ES module), `docs/deliverables/js/review-bootstrap.js` (산출물 standalone)
- **실시간**: `onSnapshot` 구독으로 리뷰 실시간 동기화

### Deployment Design (확정)
- **Firebase Hosting**: `processcheck-html/firebase.json` + `.firebaserc`
- **CI/CD**: GitHub Actions → `FirebaseExtended/action-hosting-deploy@v0`
- **시크릿**: `FIREBASE_SERVICE_ACCOUNT` (GitHub repo secret 필요)
- **Firestore Rules**: `processcheck-html/firestore.rules` — reviews 컬렉션은 Firebase Auth 인증 필요

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

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
