# Feature Research: v2.0 UX/UI 대규모 개선

**Researched:** 2026-03-12
**Source:** Competitor analysis (Linear, Notion, Monday.com, Arena PLM, Jira, ClickUp)

## Feature Categories & Priority

### A. 즉시 체감 UX (Immediate Impact) — Foundation first

| ID | Feature | Complexity | Dependencies | Library |
|----|---------|-----------|--------------|---------|
| A1 | 체크리스트 탭 자동 연동 | Low | None | None |
| A2 | 인라인 승인 (대시보드) | Medium | Toast | None |
| A3 | 알림→해당 작업 이동 | Low | None | None |
| A4 | 토스트 알림 (alert 제거) | Low | None | Notyf |
| A5 | 슬라이드 오버 (peek panel) | Medium | Toast | None |
| A6 | 인라인 상태 변경 | Medium | Toast | None |

### B. 시각적 품질 (Visual Quality) — CSS-heavy

| ID | Feature | Complexity | Dependencies | Library |
|----|---------|-----------|--------------|---------|
| B1 | Battery-bar 진행률 | Low | None | None (CSS) |
| B2 | 3색 시스템 정리 | Low | None | None (CSS) |
| B3 | 스켈레톤 로딩 | Low | None | None (CSS) |
| B4 | Hover 액션 표시 | Low | None | None (CSS) |
| B5 | CSS 토큰 정리 | Medium | None | None (CSS) |
| B6 | 뷰 전환 애니메이션 | Low | None | None (CSS) |

### C. 파워유저 생산성 (Power User) — Needs foundation

| ID | Feature | Complexity | Dependencies | Library |
|----|---------|-----------|--------------|---------|
| C1 | Cmd+K 명령 팔레트 | Medium | Toast | ninja-keys |
| C2 | 필터 pill 시스템 | Medium | None | None |
| C3 | 뷰 상태 저장 | Low | None | None (localStorage) |
| C4 | 일괄 작업 (bulk ops) | High | Toast, inline-edit | None |
| C5 | 워크로드 히트맵 | Medium | None | None (CSS grid) |

### D. 정보 구조 개선 (Information Architecture)

| ID | Feature | Complexity | Dependencies | Library |
|----|---------|-----------|--------------|---------|
| D1 | D-Day 컬럼 추가 | Low | None | None |
| D2 | 뷰 정리 (7→핵심 위주) | Low | None | None |
| D3 | 리포트 연결 | Low | None | None |
| D4 | Sales 네비 통합 | Low | None | None |
| D5 | 승인 전용 페이지 | Medium | None | None |
| D6 | 간트 실데이터 | Medium | None | None |
| D7 | 히스토리 실데이터 | Medium | None | None |

### E. 칸반/DnD (Drag & Drop) — Most complex, last

| ID | Feature | Complexity | Dependencies | Library |
|----|---------|-----------|--------------|---------|
| E1 | 드래그앤드롭 칸반 | High | Toast, inline-edit | SortableJS |
| E2 | 부서 스윔레인 | Medium | E1 | SortableJS |
| E3 | 긴급 고정 레인 | Low | E1 | SortableJS |

## Recommended Build Order

```
Phase 7: Foundation CSS + Toast + Skeleton
  → B1, B2, B3, B4, B5, B6, A4

Phase 8: Inline Actions + Navigation
  → A1, A2, A3, A6, A5, D1

Phase 9: Power User + Info Architecture
  → C1, C2, C3, D2, D3, D4, D5

Phase 10: Advanced Features
  → C4, C5, D6, D7, E1, E2, E3
```

## Complexity Assessment

- **Low (13 features):** Pure CSS, simple JS toggle, or config change
- **Medium (10 features):** New component + integration with existing pages
- **High (3 features):** Multi-page impact, complex state management (C4 bulk ops, E1 DnD, D6 Gantt real data)
