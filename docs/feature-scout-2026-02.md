# ProcessCheck 신규 기능 제안 — 2026년 2월 트렌드 분석

> 조사일: 2026-02-26
> 기존 feature-review-2026.md와 중복되지 않는 신규 아이디어만 수록

---

## 조사 배경

2026년 PM/PLM 도구 트렌드:
- AI가 핵심 구매 요인 (55% PM 소프트웨어 구매자가 AI를 이유로 선택)
- AI 에이전트 & 자율 워크플로우 (Asana AI Studio, ClickUp AI)
- 예측 분석 & 리스크 관리 (Wrike, Monday.com Portfolio Risk Insights)
- 디지털 스레드/디지털 트윈 (Siemens Teamcenter, PTC Windchill)
- 규제 준수 자동화 (FDA QMS 규정, ISO 13485)
- 클라우드 네이티브 + 모바일 우선

---

## 신규 기능 제안 (8개)

### 1. AI 리스크 예측 대시보드 — HIGH

**현재**: 프로젝트 위험도(riskLevel)가 green/yellow/red 수동 설정
**문제**: 지연 위험을 사전에 감지할 수 없음. 문제가 발생한 후에야 인지.
**레퍼런스**:
- Monday.com Portfolio Risk Insights — 프로젝트 보드 스캔 → 심각도별 리스크 플래그
- Wrike AI — 워크스페이스 분석, 프로젝트 복잡도, 작업량 기반 리스크 예측
**구현 제안**:
- 기존 데이터 기반 리스크 점수 자동 계산 알고리즘:
  - 지연 작업 비율 (overdue / total)
  - 병목 부서 감지 (특정 부서 완료율 < 평균의 50%)
  - 마감 접근 속도 (D-Day vs 남은 작업량)
  - 승인 대기 기간 (평균 승인 소요일)
- 대시보드에 "리스크 점수" 게이지 + 리스크 요인 목록 표시
- 리스크 높은 프로젝트에 자동 경고 알림
**영향 범위**: `dashboard.js`, `firestore-service.js` (recalculateProjectStats 확장)
**난이도**: MEDIUM

---

### 2. 프로젝트 타임라인 비교 뷰 — HIGH

**현재**: 개별 프로젝트의 진행 상태만 확인 가능
**문제**: 여러 프로젝트를 동시에 비교할 수 없음. 기획조정실이 전체 현황 파악 어려움.
**레퍼런스**:
- Asana Portfolio — 여러 프로젝트를 하나의 뷰에서 비교, 색상 코딩으로 상태 표시
- ClickUp Dashboard — 다중 프로젝트 진행률 비교 위젯
**구현 제안**:
- 보고서 페이지에 "프로젝트 비교" 탭 추가
- 수평 타임라인: 프로젝트별 6 Phase 진행 바를 세로로 나열
- 색상 코딩: 정상(초록), 지연(주황), 심각(빨강)
- 마감일 마커 + 현재 위치 표시
- Chart.js 또는 커스텀 SVG로 구현
**영향 범위**: `reports.js` (새 탭), `styles.css`
**난이도**: MEDIUM

---

### 3. 스마트 담당자 추천 — MEDIUM

**현재**: 작업 담당자를 수동으로 배정
**문제**: 누가 여유 있는지, 누가 해당 부서 전문가인지 알기 어려움
**레퍼런스**:
- Wrike AI — 실시간 가용성, 기술, 워크로드 기반 자동 리소스 매칭
- Motion AI — 팀원 워크로드 분석 + 자동 태스크 재분배
**구현 제안**:
- 작업 배정 시 "추천 담당자" 드롭다운 표시
- 추천 로직: 해당 부서 + 현재 할당 작업 수 적은 순 + 지연 작업 없는 순
- 담당자별 현재 워크로드 수치 표시 (예: "김철수 (3건 진행 중)")
- `checklistItems`에서 실시간 집계
**영향 범위**: `project-detail.js` (작업 추가/수정 모달), `firestore-service.js`
**난이도**: LOW

---

### 4. 규제 준수 추적기 — HIGH

**현재**: 규제/인증 관련 체크리스트가 일반 작업과 구분 없음
**문제**: 전자 제품 개발은 FDA, CE, KC 등 인증 필수. 규제 관련 문서/승인 상태 별도 추적 필요.
**레퍼런스**:
- Arena PLM — 규제 준수 모듈, 감사 추적, 자동 문서화
- PTC Windchill — 변경 이력 + 규제 요구사항 매핑
- FDA 2024 QMS 규정 — ISO 13485 준수 문서화 의무 (2026.02부터)
**구현 제안**:
- 새 페이지: `compliance.html` — 규제 준수 대시보드
- 인증 유형별 체크리스트: FDA/CE/KC/UL 등
- 프로젝트별 인증 상태 매트릭스 (인증유형 × 프로젝트)
- 만료일 추적 + D-Day 알림
- 감사 로그 연동 (활동 로그 활용)
- `templateItems`에 `isRegulatory: true` 필드 추가로 규제 항목 구분
**영향 범위**: 새 페이지 + `firestore-service.js` + `styles.css`
**난이도**: HIGH

---

### 5. 실시간 접속자 표시 (Presence) — LOW

**현재**: 누가 현재 시스템을 사용 중인지 알 수 없음
**문제**: 같은 프로젝트/작업을 동시에 편집하는지 알 수 없음
**레퍼런스**:
- Notion — 페이지 상단에 현재 접속자 아바타 표시
- Google Docs — 실시간 커서 + 접속자 표시
- Linear — 이슈 상세에 현재 보고 있는 사용자 표시
**구현 제안**:
- Firestore `presence` 컬렉션: `{ userId, userName, currentPage, lastSeen }`
- 페이지 로드 시 자동 등록, 떠날 때 삭제 (beforeunload)
- 네비게이션 바에 접속자 수 뱃지 + 클릭 시 목록 드롭다운
- 프로젝트 상세에서 "현재 보는 사람" 아바타 표시
**영향 범위**: `components.js` (nav), `firestore-service.js`, 모든 페이지 JS
**난이도**: MEDIUM

---

### 6. 프로젝트 복제 & 템플릿 라이브러리 — MEDIUM

**현재**: 프로젝트 생성 시 템플릿에서 체크리스트만 자동 생성
**문제**: 비슷한 프로젝트를 반복 생성할 때 매번 처음부터 설정해야 함
**레퍼런스**:
- Asana — 프로젝트 템플릿 갤러리, 기존 프로젝트 복제
- Monday.com — 보드 템플릿 + 마켓플레이스
- ClickUp — 템플릿 센터 (개인/팀/커뮤니티)
**구현 제안**:
- 프로젝트 상세에 "프로젝트 복제" 버튼
- 복제 시 옵션: 체크리스트 포함, 담당자 초기화, 날짜 시프트
- "프로젝트 템플릿으로 저장" 기능
- 템플릿 라이브러리 뷰 (관리자용)
**영향 범위**: `project-detail.js`, `firestore-service.js` (cloneProject)
**난이도**: MEDIUM

---

### 7. 모바일 PWA 최적화 — MEDIUM

**현재**: 반응형 CSS는 있지만 PWA가 아님
**문제**: 현장 실무자(제조팀, 품질팀)가 모바일에서 작업 확인/완료 해야 함
**레퍼런스**:
- Monday.com — 2026 업데이트에서 모바일 경험 대폭 개선
- Asana — 모바일 앱에서 작업 완료, 코멘트, 승인 가능
**구현 제안**:
- `manifest.json` + Service Worker 추가 → PWA 변환
- 홈 화면 추가 가능 (Add to Home Screen)
- 오프라인 읽기 지원 (기본 캐싱)
- 모바일 전용 하단 탭 바 (대시보드/프로젝트/작업/알림)
- 푸시 알림 (Firebase Cloud Messaging)
**영향 범위**: 새 파일 (manifest.json, sw.js) + `styles.css` + 모든 HTML
**난이도**: HIGH

---

### 8. 자연어 작업 생성 (NLP) — LOW

**현재**: 작업 추가 시 모달에서 필드를 하나씩 채워야 함
**문제**: 빠르게 작업을 만들기 어려움
**레퍼런스**:
- ClickUp AI — 자연어로 "다음 주 금요일까지 김철수가 WM 검토" → 자동 파싱
- Asana AI — 코멘트에서 액션 아이템 자동 추출
**구현 제안**:
- 작업 추가 모달에 "빠른 입력" 텍스트 필드
- 간단한 패턴 매칭으로 파싱: `@담당자 #부서 !긴급 내용 ~마감일`
- 예: `@김철수 #개발팀 !긴급 WM 도면 검토 ~2026-03-05`
- 파싱 결과 프리뷰 → 확인 후 생성
**영향 범위**: `project-detail.js` (작업 추가 모달)
**난이도**: LOW

---

## 우선순위 요약

| 순위 | 기능 | 영향도 | 난이도 | 바로 구현 가능? |
|------|------|--------|--------|----------------|
| 1 | AI 리스크 예측 대시보드 | HIGH | MEDIUM | O (기존 데이터 활용) |
| 2 | 규제 준수 추적기 | HIGH | HIGH | O (새 페이지) |
| 3 | 프로젝트 타임라인 비교 | HIGH | MEDIUM | O (reports.js 확장) |
| 4 | 스마트 담당자 추천 | MEDIUM | LOW | O |
| 5 | 프로젝트 복제 & 템플릿 | MEDIUM | MEDIUM | O |
| 6 | 실시간 접속자 표시 | LOW | MEDIUM | O (Firestore) |
| 7 | 모바일 PWA | MEDIUM | HIGH | O (manifest+SW) |
| 8 | 자연어 작업 생성 | LOW | LOW | O |

---

## 출처
- [Zapier: Best AI PM Tools 2026](https://zapier.com/blog/best-ai-project-management-tools/)
- [Breeze: AI PM Statistics 2026](https://www.breeze.pm/articles/ai-project-management-statistics)
- [TechTarget: AI Transforming PM](https://www.techtarget.com/searchenterpriseai/feature/How-AI-is-transforming-project-management)
- [GoodDay: PM Software Trends 2026](https://www.goodday.work/blog/project-management-software-trends/)
- [Celoxis: AI Transforming PM 2026](https://www.celoxis.com/article/ai-transforming-project-management)
- [Monday.com: PLM Guide 2026](https://monday.com/blog/rnd/product-lifecycle-management/)
- [Wrike: PLM Software 2026](https://www.wrike.com/blog/product-lifecycle-management-software-plm/)
- [PTC: PLM Technologies](https://www.ptc.com/en/technologies/plm)
