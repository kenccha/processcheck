# ProcessCheck 기능 개선 추천 — 업계 레퍼런스 기반

> 분석일: 2026-02-26
> 비교 대상: Jira, Asana, Monday.com, Notion

## 현재 기능 완성도

| 영역 | 완성도 | 상태 |
|------|--------|------|
| 대시보드 | 95% | 실시간 통계, 역할별 필터, 알림 |
| 프로젝트 뷰 (7종) | 90% | 테이블/매트릭스/카드/간트/칸반/타임라인/캘린더 |
| 프로젝트 상세 | 85% | 개요/체크리스트/설계변경 탭 동작, 파일탭 미구현 |
| 작업 관리 | 90% | 승인 워크플로우 완전, 체크리스트 하드코딩 |
| 2단계 승인 | 100% | 매니저(work) + 기획조정실(gate) |
| 템플릿 관리 | 85% | 매트릭스/트리/리스트 뷰 전부 동작 |
| 고객 관리 | 80% | CRUD 동작, 포털 미구현 |
| 영업 대시보드 | 90% | 출시 준비 추적 동작 |
| 테마/내비 | 100% | 라이트/다크 모드, 실시간 알림 |

---

## 추천 기능 개선안

### 1. 워크플로우 자동화 (Workflow Automation) — HIGH

**현재**: 작업 완료 → 수동으로 승인 요청, 승인 후 → 다음 단계 수동 전환
**문제**: 매니저가 모든 작업을 일일이 확인해야 함, 다음 단계 자동 전환 없음

**레퍼런스**:
- **Jira**: 워크플로우 트리거 — 조건 충족 시 자동 상태 전환, 자동 담당자 배정
- **Monday.com**: "If this, then that" 자동화 — 상태 변경 시 알림/배정/이동 자동 실행
- **Asana**: Rule-based automation — 작업 완료 시 다음 작업 자동 생성, 의존성 관리

**구현 제안**:
- Gate 승인 완료 시 → 다음 Phase 자동 활성화 + 해당 부서 담당자에게 알림
- Work stage 전체 완료 시 → Gate 승인 자동 요청 + 기획조정실 알림
- 마감일 D-3 → 담당자에게 자동 리마인더 알림
- 마감일 초과 → 매니저에게 에스컬레이션 알림

---

### 2. 대시보드 리포팅/차트 (Reporting & Analytics) — HIGH

**현재**: 숫자 카운트 4개 + 목록만 표시 (시각적 분석 없음)
**문제**: 전체 프로젝트 건강 상태를 한눈에 파악하기 어려움

**레퍼런스**:
- **Jira**: 번다운 차트, 벨로시티 차트, 커스텀 대시보드 위젯
- **Asana**: 프로젝트 상태 차트, 팀 워크로드 히트맵, 마일스톤 진행률 그래프
- **Monday.com**: 차트 위젯 (파이, 바, 라인), AI 자동 상태 리포트 생성

**구현 제안**:
- 부서별 진행률 바 차트 (10개 부서 × 완료/진행/대기)
- Phase별 완료율 도넛 차트 (6 phase)
- 주간 완료 추이 라인 차트 (최근 4주)
- 지연 작업 히트맵 (부서 × Phase)
- 라이브러리: Chart.js (CDN)

---

### 3. @멘션 & 리치 코멘트 (Rich Comments) — MEDIUM

**현재**: 평문 텍스트 코멘트만 가능, 수정/삭제 불가
**문제**: 팀 간 협업 시 특정 사람에게 주의를 끌기 어려움

**레퍼런스**:
- **Jira**: @멘션 + 마크다운 서식 + 첨부파일 + 이모지 리액션
- **Asana**: @멘션 시 상대방에게 알림, 좋아요 리액션, 리치 텍스트
- **Notion**: @멘션 + 날짜 링크 + 페이지 링크 + 리마인더

**구현 제안**:
- `@이름` 입력 시 사용자 자동완성 드롭다운
- 멘션된 사용자에게 알림 자동 생성
- 코멘트 수정/삭제 (본인 코멘트만)
- 마크다운 기본 서식 (볼드, 이탤릭, 코드, 링크)

---

### 4. 파일 업로드 구현 (File Attachments) — HIGH

**현재**: 드래그앤드롭 UI만 있고 실제 기능 없음 (Known Gap)
**문제**: 산출물(문서, 도면, 테스트 결과)을 작업에 첨부할 수 없음

**레퍼런스**:
- **Jira**: 이슈당 첨부파일, 인라인 이미지, 최대 10MB
- **Asana**: 파일 첨부 + Google Drive/Dropbox 연동
- **Notion**: 드래그앤드롭 파일 업로드, 이미지 인라인 표시

**구현 제안**:
- Firebase Storage 연동 (경로: `tasks/{projectId}/{taskId}/{filename}`)
- 파일 타입 제한: PDF, DOC, XLS, PPT, PNG, JPG (최대 10MB)
- 업로드 진행률 표시 바
- 파일 목록: 이름, 크기, 업로더, 업로드일
- 파일 삭제 (업로더 본인만)

---

### 5. 활동 로그 / 히스토리 (Activity Feed) — MEDIUM

**현재**: 작업 상세에 간단한 타임라인만 (날짜 추정치 기반)
**문제**: "누가 언제 뭘 했는지" 정확한 추적 불가

**레퍼런스**:
- **Jira**: 이슈 히스토리 — 모든 필드 변경 기록 (이전값 → 변경값)
- **Asana**: Activity feed — 모든 변경사항 실시간 피드
- **Notion**: 페이지 히스토리 — 변경 이력 + 버전 복원

**구현 제안**:
- Firestore `activityLogs` 컬렉션
- `completeTask/approveTask/rejectTask/restartTask/addComment` 에 자동 기록
- 프로젝트 상세 + 작업 상세에서 실제 이벤트 기반 타임라인

---

### 6. 대량 작업 (Bulk Operations) — MEDIUM

**현재**: 작업 하나씩만 처리 가능
**문제**: 매니저가 10개 작업을 순차 승인해야 할 때 비효율적

**레퍼런스**:
- **Jira**: Bulk change — 여러 이슈 선택 후 일괄 상태/담당자 변경
- **Asana**: Multi-select — 여러 작업 선택 후 일괄 이동/완료/삭제
- **Monday.com**: Batch actions — 여러 항목 선택 + 일괄 처리

**구현 제안**:
- 체크리스트 탭에 체크박스 열 + "전체 선택"
- 선택 항목 일괄 승인, 일괄 담당자 변경
- 하단 플로팅 액션 바: "N개 선택됨 | 일괄 승인 | 담당자 변경"

---

### 7. 고객 포털 구현 (Customer Portal) — MEDIUM

**현재**: HTML 파일만 있고 JS 컨트롤러 미구현 (Known Gap)
**문제**: 대리점/법인이 자사 관련 프로젝트 진행 상황을 확인할 수 없음

**레퍼런스**:
- **Jira Service Management**: 고객 포털 — 요청 제출, 진행 추적
- **Asana**: 외부 게스트 — 제한된 읽기 권한으로 프로젝트 열람
- **Monday.com**: Guest access — 외부 사용자 제한된 보드 접근

**구현 제안**:
- 이메일 인증 (portalLoginEmail 일치 확인)
- 해당 고객 연관 프로젝트만 필터링 표시
- Phase 진행 상태 읽기 전용 뷰
- 포털 알림 목록 + 설계 변경 요청 제출

---

### 8. 내보내기 (Export) 기능 — LOW

**현재**: 데이터 내보내기 기능 전무
**문제**: 보고서 작성, 외부 공유 시 스크린샷에 의존

**레퍼런스**:
- **Jira**: CSV/Excel 내보내기, PDF 보고서
- **Asana**: CSV 내보내기, 인쇄 뷰
- **Notion**: CSV/PDF/마크다운 내보내기

**구현 제안**:
- 프로젝트 목록 → CSV, 체크리스트 → Excel, 상태 요약 → PDF
- 라이브러리: SheetJS (xlsx), jsPDF

---

### 9. 사용자 관리 UI (User Administration) — LOW

**현재**: 사용자가 시드 데이터로만 존재, 관리 UI 없음
**문제**: 신규 사용자 추가/역할 변경/부서 이동 불가

**레퍼런스**:
- **Jira**: 사용자 관리 콘솔 — 역할/그룹/권한 배정
- **Asana**: Admin Console — 사용자 프로비저닝, 역할 관리
- **Notion**: 멤버 관리 — 초대/제거/역할 변경

**구현 제안**:
- 관리자(observer) 전용 사용자 관리 페이지
- 역할 변경, 부서 이동, 사용자 비활성화

---

### 10. 칸반 드래그앤드롭 (Kanban DnD) — LOW

**현재**: 칸반 뷰가 있지만 카드 드래그앤드롭 없음 (정적 표시만)
**문제**: 칸반의 핵심 인터랙션인 상태 전환이 드래그로 안됨

**레퍼런스**:
- **Jira**: 보드에서 이슈를 드래그하여 상태 전환
- **Asana**: 보드 뷰에서 카드 드래그 이동
- **Monday.com**: 칸반 보드 완전한 드래그앤드롭

**구현 제안**:
- HTML5 Drag & Drop API 또는 SortableJS
- 칸반 열 간 카드 이동 → 상태 자동 업데이트
- 이동 시 확인 모달

---

## 우선순위 요약

| 순위 | 기능 | 영향도 | 난이도 | 레퍼런스 |
|------|------|--------|--------|----------|
| 1 | 워크플로우 자동화 | HIGH | MEDIUM | Jira, Monday.com, Asana |
| 2 | 대시보드 차트/리포팅 | HIGH | LOW | Jira, Asana, Monday.com |
| 3 | 파일 업로드 | HIGH | MEDIUM | Jira, Asana, Notion |
| 4 | 활동 로그 | MEDIUM | LOW | Jira, Asana, Notion |
| 5 | @멘션 & 리치 코멘트 | MEDIUM | MEDIUM | Jira, Asana, Notion |
| 6 | 대량 작업 | MEDIUM | MEDIUM | Jira, Asana, Monday.com |
| 7 | 고객 포털 | MEDIUM | HIGH | Jira SM, Monday.com |
| 8 | 내보내기 | LOW | LOW | Jira, Asana, Notion |
| 9 | 사용자 관리 | LOW | MEDIUM | Jira, Asana, Notion |
| 10 | 칸반 DnD | LOW | LOW | Jira, Asana, Monday.com |

---

## 출처
- [Jira vs Asana 비교 2025](https://plaky.com/blog/asana-vs-jira/)
- [Jira vs Monday.com | Atlassian](https://www.atlassian.com/software/jira/comparison/jira-vs-monday)
- [Notion vs Asana vs Monday.com 2025](https://ones.com/blog/notion-vs-asana-vs-monday-com/)
- [Asana vs Notion 2026](https://efficient.app/compare/asana-vs-notion)
- [Project Management Apps 2026 Guide](https://www.saner.ai/blogs/best-project-management-apps)
- [Workflow Automation 2026 | Atlassian](https://www.atlassian.com/agile/project-management/workflow-automation-software)
- [PM Software Trends 2026](https://www.goodday.work/blog/project-management-software-trends/)
- [AI in PM 2025 | Capterra](https://www.capterra.com/resources/2025-pm-software-trends/)
- [AI Transforming PM 2026 | Celoxis](https://www.celoxis.com/article/ai-transforming-project-management)
