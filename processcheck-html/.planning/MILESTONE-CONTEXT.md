# Milestone Context: v2.0 UX/UI 대규모 개선

## Milestone Goal

경쟁사 분석(Linear, Notion, Monday.com, Arena PLM, Jira, ClickUp) 기반으로 ProcessCheck의 UX/UI를 전면 개선하여 실무자가 매일 쓰고 싶은 도구로 만든다.

## Target Features (from research)

### A. 즉시 체감 (사용자가 "완전 달라졌다" 느끼는 것)

- **A1**: 작업 상세 체크리스트 Firestore 연동 — 현재 하드코딩 5개 항목, 저장 안 됨
- **A2**: 인라인 승인/반려 (대시보드에서 바로) — 현재 반려는 상세페이지 이동 필요. 승인 옆에 접수기준 체크리스트 표시 (Arena PLM 패턴)
- **A3**: 알림 클릭 → 해당 페이지 이동 — 현재 읽음 표시만 됨
- **A4**: 토스트 알림 시스템 — 현재 성공/실패 피드백 없음 (console.error만)
- **A5**: 슬라이드 오버 패널 (작업 상세) — 체크리스트에서 작업 클릭 시 전체 페이지 이동 대신 사이드 패널 (Linear peek view)
- **A6**: 인라인 상태/담당자 변경 — 현재 상태 변경하려면 상세 페이지 이동 (Monday.com 상태 pill, Notion 패턴)

### B. 시각적 품질 (프로답게 보이는 것)

- **B1**: Battery-bar 진행률 표시 — Monday.com Battery Widget 패턴
- **B2**: 일관된 3색 시스템 (초록/노랑/빨강) — 제조업 대시보드 표준. D-Day, 카드, 테이블 색상 통일
- **B3**: 스켈레톤 로딩 — 스피너 대신 shimmer 애니메이션
- **B4**: Hover-reveal 액션 버튼 — Linear 미니멀 패턴
- **B5**: CSS 토큰 정리 — --nav-hover 순환참조 버그, --radius-sm 미정의, 인라인 스타일 200+개 제거
- **B6**: 뷰 전환 애니메이션 — Linear 150ms fade

### C. 파워유저 생산성

- **C1**: Cmd+K 커맨드 팔레트 — 프로젝트/작업/사용자 글로벌 검색 + 액션 실행 (Linear)
- **C2**: 필터 pill 표시 — 활성 필터를 pill로 표시 (Notion)
- **C3**: 뷰 상태 localStorage 저장 — 페이지 새로고침 시 탭/뷰/필터 유지
- **C4**: 일괄 작업 개선 — 체크박스 크기 확대, 벌크 바 상단 이동 (Notion bulk toolbar)
- **C5**: 부서별 워크로드 히트맵 — 부서×주 그리드, 과부하 빨강 (Monday.com Workload View)

### D. 정보 구조 개선

- **D1**: 프로젝트 테이블에 D-Day 컬럼 추가 — 가장 중요한 정보인데 없음
- **D2**: 불필요한 뷰 정리 — 7개→4개 (테이블/매트릭스/카드/간트만 유지)
- **D3**: 리포트 페이지 네비 연결 — 완성됐는데 접근 불가
- **D4**: Sales 페이지 공통 네비 사용 — 자체 네비라 앱에서 분리됨
- **D5**: 승인 전용 풀 페이지 — 대시보드 탭 대신 전용 뷰, 컨텍스트+수락기준 표시 (Arena PLM gate review)
- **D6**: 간트 차트 실제 데이터 기반 — 현재 6등분 균등 → 실제 작업 날짜 사용
- **D7**: 작업 히스토리 실제 데이터 — 현재 가짜 날짜 (마감일-14일, -7일)

### E. 칸반/드래그앤드롭

- **E1**: 칸반 드래그앤드롭 실제 구현 — HTML Drag and Drop API (Jira, Notion Board)
- **E2**: 칸반 부서별 스윔레인 — 부서 그룹별 행 분리 (Jira Swimlanes)
- **E3**: 긴급 아이템 상단 고정 레인 — 지연/긴급 작업 시각적 분리 (Jira Expedite lane)

## Key UX Patterns to Adopt (from competitor research)

### From Linear
- Command palette (Cmd+K) for global search/actions
- Peek view (side panel) for issue detail without losing list context
- Optimistic UI updates (instant DOM change, background Firestore sync)
- Single-key keyboard shortcuts (S=status, A=assign, C=create)
- Inbox as triage queue with inline actions
- Spring physics card animations, 150ms transitions

### From Monday.com
- Battery-bar progress widget
- Status column as color-coded pills with click-to-change dropdown
- Workload view (department×week heatmap, red=overloaded)
- Timeline baseline comparison (original plan vs actual)
- Dashboard widget customization

### From Notion
- Multi-view tabs with independent filter/sort state per view
- Inline cell editing (click to edit in place, no modal)
- Filter builder with visual pills showing active filters
- Drag-and-drop row reordering

### From Arena PLM
- Gate review panel with acceptance criteria checklist beside approve/reject
- Nudge approver button on pending items
- Pre-submission validation (check required items before gate submit)
- ECO impact analysis view

### From Jira
- Board swimlanes by department
- Expedite swimlane for urgent items at top
- Sprint Health gadget (compact D-Day vs completion indicator)
- WHEN-IF-THEN automation builder pattern
- F-pattern dashboard layout

### From ClickUp
- "Me Mode" toggle for personal view
- Custom status sets per phase
- Dependency blocking indicators

## Page-Specific UX Audit Results

### Dashboard
- Approval tab has no context for decisions (no description, no checklist status)
- Project tab is flat list with no severity hierarchy
- Worker task tab has no inline quick-complete
- Tab label "내 작업" misleading for manager/observer (shows all dept tasks)
- Stat cards need drill-down (click to filter list below)

### Projects
- 7 view modes → 3-4 too many (kill timeline, calendar, kanban for 신규개발)
- Table missing D-Day column (most important metric not there)
- Search only matches project name, not PM/department/status
- Matrix view has no loading skeleton

### Project Detail
- 5 checklist views → 3 sufficient (Phase, Board, List)
- Right sidebar "Recent Activity" shows same task data, not actual activity events
- Bulk action checkboxes 14px, hard to hit on mobile
- Quick-add syntax (@담당자 #부서) not parsed — placeholder only
- No phase group collapsing (193 tasks = endless scroll)

### Task Detail
- Checklist is HARDCODED mock data (lines 49-55), not Firestore
- Approve/reject UX backwards — reject textarea always visible (should be hidden, expand on click)
- Timeline uses FAKE dates (dueDate - 14 days fabricated)
- Comment editing uses browser prompt() dialog
- Missing importance level in metadata grid

### Sales
- 6 view modes is excessive for sales team — keep 2 (table, product card)
- Own nav (renderSalesNav) disconnected from main app
- Sales-relevant filter too narrow (category-based, misses assignee-based)

### CSS
- --nav-hover circular reference in dark mode
- --radius-sm referenced in JS but never defined
- No spacing scale between gap-1 and gap-8
- Two parallel stat card systems (.stat-card vs .dash-stat-card)
- Badge colors designed dark-mode-first, untested in light mode

## Research Sources

- Linear UI redesign blog, Linear documentation
- Monday.com Battery/Workload/Chart widget docs
- Arena PLM design principles, ECO workflow
- Jira dashboard gadgets, swimlanes, automation
- Notion database views, inline editing
- ClickUp dashboards, approval workflows
- Manufacturing KPI dashboard best practices (Tulip, MachineMetrics)
- PLM approval workflow best practices (BuyPLM, Xavor)

## Constraints

- Must remain vanilla HTML+CSS+JS (no build step)
- Firebase SDK CDN only
- Korean language UI
- 3 roles: worker, manager, observer
- v1.0 Phase 1 (Security Hardening) already complete — continue numbering from Phase 2+
