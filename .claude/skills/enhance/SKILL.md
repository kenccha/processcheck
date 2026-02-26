---
name: enhance
description: 기존 ProcessCheck 페이지의 UX/UI를 개선. Use when the user asks to improve, polish, or enhance an existing page's user experience, visuals, or interactions.
argument-hint: "[페이지명 또는 개선 영역]"
---

# UI Enhancer — 기존 페이지 UX 개선

## 개선 대상
$ARGUMENTS

## 작업 순서

### 1. 현재 상태 분석
대상 페이지의 HTML, JS, CSS를 읽고 현재 UI 파악:
- `processcheck-html/[페이지].html`
- `processcheck-html/js/pages/[페이지].js`
- `processcheck-html/css/styles.css`
- `.claude/agents/ui-enhancer.md` — 상세 가이드

### 2. 벤치마킹
WebSearch로 해당 유형의 UI 베스트 프랙티스 조사.

### 3. 개선 체크리스트
- [ ] 로딩 상태 (스켈레톤/스피너)
- [ ] 빈 상태 (안내 + 액션 버튼)
- [ ] 에러 상태 (재시도 버튼)
- [ ] 반응형 (모바일 375px)
- [ ] 다크모드 (`[data-theme="dark"]`)
- [ ] 마이크로 인터랙션 (호버, 트랜지션)
- [ ] 데이터 시각화 (Chart.js)
- [ ] 접근성 (키보드, ARIA)
- [ ] 토스트 알림 (성공/실패 피드백)

### 4. 구현
- 기존 CSS 변수 활용: `--primary`, `--surface-0`, `--text-primary` 등
- 새 스타일은 페이지 접두사: `.dash-*`, `.proj-*`, `.task-*`
- JS: 기존 render() 패턴 유지, escapeHtml() 보안 유지

### 5. 검증
- 라이트 + 다크모드 양쪽 확인
- 데이터 있을 때 / 없을 때 확인
- 3역할(실무자/매니저/기획조정실)로 확인

## 현재 페이지 목록
| 페이지 | JS | 설명 |
|--------|-----|------|
| dashboard.html | dashboard.js | 대시보드 |
| projects.html | projects.js | 프로젝트 목록 (7뷰) |
| project.html | project-detail.js | 프로젝트 상세 |
| task.html | task-detail.js | 작업 상세 |
| admin-checklists.html | admin-checklists.js | 템플릿 관리 |
| customers.html | customers.js | 고객 관리 |
| sales.html | sales.js | 영업 대시보드 |
| customer-portal.html | customer-portal.js | 고객 포털 |
| admin-users.html | admin-users.js | 사용자 관리 |
| manual.html | manual.js | 매뉴얼 |
