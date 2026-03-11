# Requirements: ProcessCheck

**Defined:** 2026-03-12
**Core Value:** 여러 부서가 얽힌 하드웨어 개발 프로세스의 현재 상태와 병목을 누구나 즉시 파악할 수 있어야 한다.

## v1 Requirements

Requirements for production-ready release. Each maps to roadmap phases.

### Security

- [x] **SEC-01**: Firestore 보안 규칙이 역할 기반 쓰기 접근을 강제한다 (현재 `write: true` → 인증+역할 기반)
- [x] **SEC-02**: Firebase Storage 보안 규칙이 인증된 사용자만 파일 업로드/다운로드를 허용한다
- [x] **SEC-03**: 데모 카드 로그인이 프로덕션에서 비활성화된다 (localhost만 허용 또는 플래그)
- [x] **SEC-04**: 모든 innerHTML 사용처에서 사용자 입력이 escapeHtml()로 처리된다 (XSS 방지)
- [x] **SEC-05**: 세션이 24시간 후 만료되며, 만료 시 로그인 페이지로 리다이렉트된다

### Bug Fixes

- [ ] **BUG-01**: toDate() 함수가 Firestore `{seconds, nanoseconds}` 형식을 올바르게 처리하여 "Invalid Date" 표시가 사라진다
- [ ] **BUG-02**: 네트워크 에러 시 모달이 항상 닫히며 사용자에게 에러 메시지를 보여준다
- [ ] **BUG-03**: 존재하지 않는 프로젝트 URL 접근 시 "프로젝트를 찾을 수 없습니다" 메시지를 보여준다
- [ ] **BUG-04**: sales.js의 Firestore 구독이 페이지 이탈 시 올바르게 정리된다 (메모리 누수 수정)

### File Upload

- [ ] **FILE-01**: 작업 상세에서 파일을 Firebase Storage에 업로드하고 다운로드 링크를 확인할 수 있다
- [ ] **FILE-02**: 업로드된 파일 목록이 작업 상세 페이지에 표시된다

### Data Integrity

- [ ] **DATA-01**: completeTask, approveTask, rejectTask가 Firestore 트랜잭션으로 감싸져 원자적으로 실행된다
- [ ] **DATA-02**: applyTemplateToProject()가 이미 체크리스트가 존재하면 중복 생성하지 않는다 (멱등성)
- [ ] **DATA-03**: 벌크 승인/완료 작업이 Promise.allSettled()로 실행되어 성공/실패 건수를 사용자에게 보여준다

### Workflow Completeness

- [ ] **WORK-01**: 네비게이션 바에 읽지 않은 알림 뱃지 숫자가 실시간으로 표시된다
- [ ] **WORK-02**: 반려된 작업의 반려 사유가 작업 상세 상단에 색상 배너로 눈에 띄게 표시된다 (현재 DB에만 저장, UI 미렌더링)
- [ ] **WORK-03**: 체크리스트 목록/Phase 뷰에서 각 항목의 마감일이 표시된다

### Core Flow — 작업 완료/승인 파이프라인

- [ ] **PIPE-01**: Gate 승인 시 다음 Phase의 작업들이 자동으로 "in_progress"로 활성화된다
- [ ] **PIPE-02**: 작업 생성/배정 시 reviewer(검토자) 필드가 설정되고, 완료 시 검토자에게 알림이 발송된다
- [ ] **PIPE-03**: assignee가 없는 미배정 작업이 대시보드에 별도 섹션으로 표시된다 (현재 아무에게도 안 보임)
- [ ] **PIPE-04**: 매니저 대시보드가 자기 부서 작업만 필터링하여 표시한다 (현재 전체 작업이 보임)
- [ ] **PIPE-05**: 벌크 재배정 후 해당 프로젝트의 stats가 자동 재계산된다

### DB↔UI 정합성

- [ ] **SYNC-01**: applyTemplateToProject() 후 프로젝트 progress/riskLevel/currentStage가 즉시 재계산된다
- [ ] **SYNC-02**: 대시보드의 currentPhase(6phase)와 프로젝트 상세의 currentStage(12stage)가 일관되게 표시된다
- [ ] **SYNC-03**: 프로젝트 상세 "활성 작업" 카운트의 필터 로직이 정확하다 (completed AND approved만 제외)
- [ ] **SYNC-04**: 승인 불가 시 이유가 명확히 표시된다 ("모든 작업이 완료되어야 승인 가능")

### UX — Forms & Feedback

- [ ] **UX-01**: 모든 폼에 실시간 유효성 검증 피드백이 표시된다 (빈 필드, 날짜 범위 등)
- [ ] **UX-02**: 승인/반려 등 중요 액션에 확인 다이얼로그가 표시된다
- [ ] **UX-03**: 모든 성공/실패 액션에 토스트 알림이 표시된다 (alert() 제거)
- [ ] **UX-04**: 빈 목록에 아이콘 + CTA 버튼이 포함된 빈 상태 화면이 표시된다
- [ ] **UX-05**: 삭제 액션에 5초간 "되돌리기" 버튼이 제공된다

### UX — Layout & Responsive

- [ ] **UX-06**: 모바일/태블릿에서 네비게이션, 모달, 테이블이 깨지지 않는다 (768px 브레이크포인트)
- [ ] **UX-07**: 프로젝트 헤더의 Phase 파이프라인이 모바일에서 축약형으로 표시된다
- [ ] **UX-08**: 대시보드 stat 카드에 긴급도별 색상 구분이 적용된다 (지연=빨강, 승인대기=노랑)
- [ ] **UX-09**: 매트릭스 뷰의 작업(○)/승인(●) 동그라미가 시각적으로 구분된다

### UX — Keyboard & Accessibility

- [ ] **UX-10**: Escape 키로 모달을 닫을 수 있고, 모달 열림 시 포커스가 트랩된다
- [ ] **UX-11**: 상태 표시가 색상 외에 아이콘/텍스트 라벨로도 구분된다 (색각 이상 대응)

### Navigation & Search

- [ ] **NAV-01**: 작업 상세의 브레드크럼이 해당 프로젝트 상세 페이지로 정확히 연결된다
- [ ] **NAV-02**: 알림/활동 로그에 페이지네이션이 적용되어 최근 50건만 로드하고 "더보기" 버튼을 제공한다
- [ ] **NAV-03**: 글로벌 검색이 네비게이션 바에 추가되어 프로젝트명+작업명으로 검색할 수 있다

### Workflow — Advanced

- [ ] **FLOW-01**: 승인 불가 시 이유가 명확히 표시된다 ("모든 작업이 완료되어야 승인 가능")
- [ ] **FLOW-02**: 신규 MS OAuth 사용자에게 부서 선택 안내가 표시된다 (현재 department=null)
- [ ] **FLOW-03**: 프로젝트 상세에 활동 타임라인이 표시된다 ("김철수 님이 작업 완료 — 2시간 전")
- [ ] **FLOW-04**: @mention 코멘트 시 해당 사용자에게 알림이 생성된다
- [ ] **FLOW-05**: 프로젝트 상세 체크리스트에서 벌크 작업 배정이 가능하다 (체크박스 선택 → 담당자 지정)
- [ ] **FLOW-06**: 프로젝트 인쇄용 뷰가 제공된다 (네비/버튼 숨김, 깔끔한 레이아웃)

## v2 Requirements: UX/UI 대규모 개선

경쟁사 분석(Linear, Notion, Monday.com, Arena PLM, Jira, ClickUp) 기반 26개 기능.

### 즉시 체감 UX (A)

- [ ] **UXA-01**: 프로젝트 상세에서 체크리스트 탭이 현재 Phase에 맞게 자동으로 열린다
- [ ] **UXA-02**: 대시보드 승인 대기 탭에서 인라인 승인/반려 버튼으로 페이지 이동 없이 처리한다
- [ ] **UXA-03**: 알림 클릭 시 해당 작업 상세 페이지로 정확히 이동한다 (현재 일부 404)
- [ ] **UXA-04**: 모든 성공/실패/경고 피드백이 토스트 알림으로 표시된다 (alert() 완전 제거, Notyf 사용)
- [ ] **UXA-05**: 프로젝트/작업 목록에서 항목 클릭 시 슬라이드 오버 패널로 미리보기한다 (전체 페이지 이동 없이)
- [ ] **UXA-06**: 체크리스트에서 작업 상태를 인라인 드롭다운으로 직접 변경한다 (모달/페이지 이동 없이)

### 시각적 품질 (B)

- [ ] **VIS-01**: 프로젝트 진행률이 Battery-bar(배터리 막대)로 시각화된다 (숫자% 대신)
- [ ] **VIS-02**: 상태 색상이 3색 시스템(green/yellow/red)으로 통일된다 (현재 불일치 해소)
- [ ] **VIS-03**: 데이터 로딩 중 스켈레톤 플레이스홀더가 표시된다 (빈 화면/스피너 대신)
- [ ] **VIS-04**: 목록 항목에 마우스 오버 시 액션 버튼이 나타난다 (항상 표시 대신)
- [ ] **VIS-05**: CSS 디자인 토큰이 semantic 변수로 정리된다 (--bg-surface, --text-primary 등)
- [ ] **VIS-06**: 뷰/탭 전환 시 fade/slide 애니메이션이 적용된다

### 파워유저 생산성 (C)

- [ ] **PWR-01**: Cmd+K(Mac)/Ctrl+K(Win) 단축키로 명령 팔레트를 열어 프로젝트/작업/페이지를 검색·이동한다 (ninja-keys)
- [ ] **PWR-02**: 목록 필터가 pill(태그) 형태로 표시되며 클릭으로 토글/제거한다
- [ ] **PWR-03**: 뷰 모드, 정렬, 필터 상태가 localStorage에 저장되어 다음 방문 시 복원된다
- [ ] **PWR-04**: 체크리스트에서 여러 항목을 선택하여 일괄 상태 변경/담당자 배정한다
- [ ] **PWR-05**: 부서×Phase 워크로드 히트맵이 프로젝트 병목 탭에 표시된다 (CSS grid 기반)

### 정보 구조 (D)

- [ ] **INF-01**: 프로젝트 목록 테이블에 D-Day 컬럼이 추가되어 마감 임박 순 정렬 가능하다
- [ ] **INF-02**: 프로젝트 목록 뷰가 핵심 위주로 정리된다 (사용 빈도 낮은 뷰 축소/접기)
- [ ] **INF-03**: 대시보드에서 리포트/분석 페이지로 직접 연결 링크가 제공된다
- [ ] **INF-04**: Sales 대시보드가 메인 네비게이션에 통합된다 (별도 사이트 링크 대신)
- [ ] **INF-05**: 승인 대기 항목만 모아보는 전용 페이지가 제공된다 (observer용)
- [ ] **INF-06**: 간트 차트가 실제 Firestore 데이터(시작일/종료일/진행률)로 렌더링된다
- [ ] **INF-07**: 활동 히스토리가 실제 Firestore 데이터(알림/변경 로그)로 렌더링된다

### 칸반 DnD (E)

- [ ] **DND-01**: 칸반 뷰에서 카드를 드래그앤드롭으로 상태 변경한다 (SortableJS)
- [ ] **DND-02**: 칸반 뷰에 부서별 스윔레인(가로 구분선)이 표시된다
- [ ] **DND-03**: 긴급(red) 항목이 칸반 상단에 고정 레인으로 표시된다

### Deferred (v3+)

- **ADV-01**: 태스크 간 의존성 설정
- **ADV-02**: 마감일 N일 전 자동 알림 (Cloud Functions)
- **ADV-03**: 프로젝트 복사
- **PERF-01**: Firestore 복합 인덱스 최적화
- **PERF-02**: 매트릭스 뷰 메모이제이션
- **PERF-03**: 알림 90일 아카이브

## Out of Scope

| Feature | Reason |
|---------|--------|
| 실시간 채팅 | 프로세스 관리 도구의 범위 밖; @mention 코멘트로 충분 |
| 모바일 앱 (iOS/Android) | 웹 우선; 태블릿 반응형으로 대응 |
| PLM/ERP 연동 | 별도 시스템으로 운영; 가시성 도구가 목적 |
| 다국어 지원 | 사내 한국어 전용 |
| 하드 스테이지 잠금 | 경고만 표시, 긴급 오버라이드 허용 |
| 간트 차트 편집 | 읽기 전용 시각화; 날짜는 프로젝트 상세에서 편집 |
| AI 자동화/추천 | 50명 내부 도구에 과도한 복잡도 |
| 오프라인 모드/PWA | Firebase 실시간 구독 필수; 접속 끊김 시 배너 표시로 대응 |
| Next.js 앱 동기화 | HTML 포트에 집중 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| SEC-05 | Phase 1 | Complete |
| BUG-01 | Phase 2 | Pending |
| BUG-02 | Phase 2 | Pending |
| BUG-03 | Phase 2 | Pending |
| BUG-04 | Phase 2 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| PIPE-01 | Phase 3 | Pending |
| PIPE-02 | Phase 3 | Pending |
| PIPE-03 | Phase 3 | Pending |
| PIPE-04 | Phase 3 | Pending |
| PIPE-05 | Phase 3 | Pending |
| WORK-01 | Phase 3 | Pending |
| WORK-02 | Phase 3 | Pending |
| WORK-03 | Phase 3 | Pending |
| SYNC-01 | Phase 3 | Pending |
| SYNC-02 | Phase 3 | Pending |
| SYNC-03 | Phase 3 | Pending |
| SYNC-04 | Phase 3 | Pending |
| FLOW-01 | Phase 3 | Pending |
| FILE-01 | Phase 4 | Pending |
| FILE-02 | Phase 4 | Pending |
| UX-01 | Phase 5 | Pending |
| UX-02 | Phase 5 | Pending |
| UX-03 | Phase 5 | Pending |
| UX-04 | Phase 5 | Pending |
| UX-05 | Phase 5 | Pending |
| UX-06 | Phase 5 | Pending |
| UX-07 | Phase 5 | Pending |
| UX-08 | Phase 5 | Pending |
| UX-09 | Phase 5 | Pending |
| UX-10 | Phase 5 | Pending |
| UX-11 | Phase 5 | Pending |
| NAV-01 | Phase 5 | Pending |
| NAV-02 | Phase 5 | Pending |
| NAV-03 | Phase 5 | Pending |
| FLOW-02 | Phase 6 | Pending |
| FLOW-03 | Phase 6 | Pending |
| FLOW-04 | Phase 6 | Pending |
| FLOW-05 | Phase 6 | Pending |
| FLOW-06 | Phase 6 | Pending |

**v1 Coverage:**
- v1 requirements: 46 total → Mapped to phases 1-6: 46, Unmapped: 0
- Note: FLOW-01 and SYNC-04 are identical ("승인 불가 시 이유 명확히 표시") — single implementation in Phase 3

**v2 Coverage:**

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIS-01 ~ VIS-06 | Phase 7 | Pending |
| UXA-04 | Phase 7 | Pending |
| UXA-01, UXA-02, UXA-03, UXA-05, UXA-06 | Phase 8 | Pending |
| INF-01 | Phase 8 | Pending |
| PWR-01, PWR-02, PWR-03 | Phase 9 | Pending |
| INF-02, INF-03, INF-04, INF-05 | Phase 9 | Pending |
| PWR-04, PWR-05 | Phase 10 | Pending |
| INF-06, INF-07 | Phase 10 | Pending |
| DND-01, DND-02, DND-03 | Phase 10 | Pending |

- v2 requirements: 26 total → Mapped to phases 7-10: 26, Unmapped: 0

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 — v2.0 requirements added (26 features across 4 phases)*
