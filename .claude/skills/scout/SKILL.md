---
name: scout
description: 경쟁 PM 도구(Jira, Asana, Monday.com, Notion, ClickUp, Linear 등)를 조사하여 ProcessCheck에 추가할 새 기능 아이디어를 발굴. Use when the user asks to find new features, research competitors, or explore PM trends.
argument-hint: "[조사 주제 또는 경쟁 제품명]"
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
context: fork
agent: Explore
---

# Feature Scout — 기능 탐색 & 벤치마킹

## 임무
ProcessCheck에 추가할 만한 새 기능을 경쟁 제품 분석과 트렌드 조사를 통해 발굴.

## 조사 대상 (인자가 있으면 해당 주제, 없으면 전체)
$ARGUMENTS

## 작업 순서

### 1. 현재 기능 파악
먼저 아래 파일을 읽어서 이미 있는 기능과 기존 제안을 확인:
- `CLAUDE.md` — 프로젝트 개요, 확정 디자인, Known Gaps
- `docs/feature-review-2026.md` — 기존 10개 개선안
- `processcheck-html/js/components.js` — 네비게이션 (현재 페이지 목록)

### 2. 경쟁 제품 & 트렌드 조사
WebSearch로 최신 정보 수집:
- 프로젝트 관리 도구 최신 기능/트렌드
- AI 기반 PM 기능 (자동 요약, 예측, 추천)
- 워크플로우 자동화, 리포팅, 협업 기능
- 모바일/반응형 경험

### 3. 갭 분석 & 제안서 작성
각 기능에 대해 아래 형식으로 정리:

```markdown
### [기능명] — [우선순위 HIGH/MEDIUM/LOW]

**현재**: (있는지/없는지/부분 구현)
**문제**: (왜 필요한지)
**레퍼런스**: (어떤 도구가 어떻게 구현했는지 + URL)
**구현 제안**: (ProcessCheck에서 어떻게 만들지 — 구체적으로)
**영향 범위**: (변경될 파일/페이지)
**난이도**: LOW/MEDIUM/HIGH
```

### 4. 결과 저장
`docs/` 디렉토리에 마크다운 파일로 저장.

## 제약 조건
- ProcessCheck = 전자 제품 개발 프로세스 관리 (일반 PM과 도메인이 다름)
- Firebase 서버리스 + GitHub Pages 정적 배포
- 한국어 UI, 3역할(실무자/매니저/기획조정실), 6 Phase 구조
