# Requirements: ProcessCheck

**Defined:** 2026-03-12
**Core Value:** 여러 부서가 얽힌 하드웨어 개발 프로세스의 현재 상태와 병목을 누구나 즉시 파악할 수 있어야 한다.

## v1 Requirements

Requirements for production-ready release. Each maps to roadmap phases.

### Security

- [ ] **SEC-01**: Firestore 보안 규칙이 역할 기반 쓰기 접근을 강제한다 (현재 `write: true` → 인증+역할 기반)
- [ ] **SEC-02**: Firebase Storage 보안 규칙이 인증된 사용자만 파일 업로드/다운로드를 허용한다
- [ ] **SEC-03**: 데모 카드 로그인이 프로덕션에서 비활성화된다 (localhost만 허용 또는 플래그)
- [ ] **SEC-04**: 모든 innerHTML 사용처에서 사용자 입력이 escapeHtml()로 처리된다 (XSS 방지)
- [ ] **SEC-05**: 세션이 24시간 후 만료되며, 만료 시 로그인 페이지로 리다이렉트된다

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
- [ ] **WORK-02**: 반려된 작업의 반려 사유가 작업 상세 상단에 색상 배너로 눈에 띄게 표시된다
- [ ] **WORK-03**: 체크리스트 목록/Phase 뷰에서 각 항목의 마감일이 표시된다

### Navigation & UX

- [ ] **NAV-01**: 작업 상세의 브레드크럼이 해당 프로젝트 상세 페이지로 정확히 연결된다
- [ ] **NAV-02**: 알림/활동 로그에 페이지네이션이 적용되어 최근 50건만 로드하고 "더보기" 버튼을 제공한다
- [ ] **NAV-03**: 글로벌 검색이 네비게이션 바에 추가되어 프로젝트명+작업명으로 검색할 수 있다

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Workflow

- **ADV-01**: 태스크 간 의존성 설정 (A 완료 전 B 시작 불가)
- **ADV-02**: 마감일 N일 전 자동 알림 (Cloud Functions 필요)
- **ADV-03**: 프로젝트 복사 기능 ("프로젝트 X에서 복사")
- **ADV-04**: 변경요청 상태 이력 타임라인 (statusHistory 배열)
- **ADV-05**: 프로젝트 체크리스트 내 항목 드래그 순서 변경

### Performance

- **PERF-01**: Firestore 복합 인덱스 최적화 (부서+상태+마감일)
- **PERF-02**: 매트릭스 뷰 셀 데이터 메모이제이션
- **PERF-03**: 알림/활동 로그 90일 이후 아카이브

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
| SEC-01 | Phase ? | Pending |
| SEC-02 | Phase ? | Pending |
| SEC-03 | Phase ? | Pending |
| SEC-04 | Phase ? | Pending |
| SEC-05 | Phase ? | Pending |
| BUG-01 | Phase ? | Pending |
| BUG-02 | Phase ? | Pending |
| BUG-03 | Phase ? | Pending |
| BUG-04 | Phase ? | Pending |
| FILE-01 | Phase ? | Pending |
| FILE-02 | Phase ? | Pending |
| DATA-01 | Phase ? | Pending |
| DATA-02 | Phase ? | Pending |
| DATA-03 | Phase ? | Pending |
| WORK-01 | Phase ? | Pending |
| WORK-02 | Phase ? | Pending |
| WORK-03 | Phase ? | Pending |
| NAV-01 | Phase ? | Pending |
| NAV-02 | Phase ? | Pending |
| NAV-03 | Phase ? | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20 ⚠️

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after initial definition*
