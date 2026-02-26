---
name: sync-check
description: Next.js 앱과 HTML 포트 사이의 동기화 상태를 검증. Use when checking if HTML port is in sync with Next.js, or after making changes to either version.
allowed-tools: Read, Grep, Glob, Bash
context: fork
agent: Explore
---

# Sync Checker — Next.js ↔ HTML 포트 동기화 검증

## 검증 항목

### 1. 함수 동기화
`lib/firestoreService.ts`의 export 함수 vs `processcheck-html/js/firestore-service.js` 비교:
- Grep으로 양쪽 파일의 export 함수명 추출
- 한쪽에만 있는 함수 → WARNING

### 2. 상수 동기화
`lib/types.ts`의 타입 정의 vs `processcheck-html/js/utils.js` 비교:
- UserRole 값들
- Department 값들
- ProjectStage 값들
- PHASE_GROUPS 배열
- GATE_STAGES 배열

### 3. 페이지 대응
`app/` 디렉토리의 page.tsx vs `processcheck-html/*.html` 매핑:
- Next.js에만 있는 페이지
- HTML에만 있는 페이지

### 4. 시드 데이터
`lib/firestoreService.ts` vs `processcheck-html/js/firestore-service.js`:
- 사용자 데이터, 프로젝트 데이터 일치 여부

## 출력 형식
```
=== ProcessCheck 동기화 리포트 ===

[OK] 함수 동기화: N/N 일치
[WARNING] 누락 함수: xxx (HTML에 없음)

[OK] 상수 동기화: PHASE_GROUPS 일치
[WARNING] 상수 불일치: GATE_STAGES 값 다름

[OK] 페이지 대응: N개 일치
[INFO] HTML 전용: admin-users.html, customers.html ...

[OK] 시드 데이터: 사용자 N명 일치
```
