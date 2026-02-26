---
name: deploy
description: Next.js 빌드 + 린트 + 타입체크 통합 검증. Use when the user asks to build, verify, or deploy the application.
disable-model-invocation: true
allowed-tools: Bash, Read, Grep
---

# Deploy — 빌드 & 검증

## 실행할 검증 단계

### Step 1: TypeScript 타입체크
```bash
npx tsc --noEmit
```
- 실패 시: 에러 내용 분석 + 수정 방안 제시

### Step 2: ESLint 검사
```bash
npm run lint
```
- 실패 시: 위반 규칙 분석 + 수정 방안 제시

### Step 3: Next.js 빌드
```bash
npm run build
```
- 성공 시: `/out` 디렉토리 생성 확인
- 실패 시: 빌드 에러 분석 + 정적 export 호환성 체크

### Step 4: 결과 리포트
```
=== 빌드 검증 리포트 ===
[OK/FAIL] TypeScript: 에러 N개
[OK/FAIL] ESLint: 경고 N개, 에러 N개
[OK/FAIL] Build: /out 디렉토리 생성됨
```

## 주의사항
- `output: "export"` 모드 — API 라우트, SSR, 미들웨어 사용 불가
- `images.unoptimized: true` — 이미지 최적화 비활성화
- 빌드 실패 시 수정은 하지 않고 **리포트만** 제공 (수정은 /implement 사용)
