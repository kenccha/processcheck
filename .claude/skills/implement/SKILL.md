---
name: implement
description: ProcessCheck에 새 기능을 구현 (프론트엔드 + Firebase 백엔드). Use when the user asks to implement, build, or add a specific feature to the application.
argument-hint: "[기능명 또는 설명]"
disable-model-invocation: true
---

# Feature Implementer — 기능 구현

## 구현할 기능
$ARGUMENTS

## 작업 순서

### 1. 요구사항 분석
- `CLAUDE.md` 읽기 — 전체 컨텍스트, 확정 디자인
- `docs/feature-review-2026.md` — 기존 제안에 해당하는지 확인
- `.claude/agents/feature-implementer.md` — 상세 가이드
- 영향받는 기존 파일 식별

### 2. 기존 코드 파악 (반드시)
- `processcheck-html/js/firestore-service.js` — Firestore CRUD 패턴
- `processcheck-html/js/utils.js` — 유틸리티, 상수
- `processcheck-html/js/components.js` — 공유 컴포넌트
- 관련 페이지 JS 컨트롤러

### 3. 데이터 모델 설계 (필요시)
기존 Firestore 컬렉션:
```
users, projects, checklistItems, changeRequests, notifications,
templateStages, templateItems, templateDepartments,
customers, portalNotifications, launchChecklists
```
새 컬렉션이 필요하면 `firestore-service.js`에 CRUD + subscribe 함수 추가.

### 4. 코드 구현
- **Firestore**: subscribe*/get*/create*/update*/delete* 패턴
- **UI**: innerHTML 기반, 이벤트 위임, escapeHtml() 필수
- **CSS**: styles.css 끝에 추가, 라이트+다크모드 대응
- **시드 데이터**: 필요시 seedDatabaseIfEmpty() 확장

### 5. 검증
- 3역할로 테스트
- 라이트/다크모드 확인
- 빈 데이터 + 있을 때 양쪽

## 구현 가능 기능 (우선순위순)
1. 워크플로우 자동화 (Gate → 다음 Phase 자동 전환)
2. 파일 업로드 (Firebase Storage)
3. 대시보드 차트 강화
4. @멘션 코멘트
5. 활동 로그 시스템
6. 대량 작업 (일괄 승인)
7. CSV/Excel/PDF 내보내기
8. 칸반 드래그앤드롭

## 제약
- 정적 배포 (SSR/API 라우트 불가)
- Firebase CDN (importmap)
- 한국어 UI
- HTML 포트 우선 (processcheck-html/)
