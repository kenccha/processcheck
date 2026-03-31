# Design System — ProcessCheck

## Product Context
- **What this is:** 전자제품 개발 프로세스 관리 시스템 (11단계, 9개 부서)
- **Who it's for:** 50~100명 실무자, 부서 관리자, 기조실 담당자
- **Space/industry:** 제조업 PLM (사내 도구)
- **Project type:** Web app / data-dense dashboard

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian + subtle glassmorphism
- **Decoration level:** Intentional (subtle backdrop-filter, border 강화, 과한 blur 지양)
- **Mood:** 제조업 사내 도구답게 기능 우선. 깨끗하지만 장식 최소. 신뢰감 있고 전문적.
- **Reference sites:** Linear, Asana, Windchill 13.x

## Typography
- **Display/Hero:** Pretendard Variable — 한국어 최적화, 깔끔한 고딕체
- **Body:** Pretendard Variable
- **UI/Labels:** Pretendard Variable
- **Data/Tables:** JetBrains Mono — tabular-nums, D-Day 뱃지, 수치 데이터
- **Code:** JetBrains Mono
- **Loading:** CDN (`cdn.jsdelivr.net/gh/orioncactus/pretendard`), Google Fonts (JetBrains Mono)
- **Scale:**
  - Display: 32px (2rem) / 700
  - H1: 24px (1.5rem) / 700
  - H2: 20px (1.25rem) / 600
  - H3: 16px (1rem) / 600
  - Body: 15px (0.9375rem) / 400
  - Small: 13px (0.8125rem) / 400
  - Caption: 12px (0.75rem) / 500
  - Data: 14px (0.875rem) / 400, JetBrains Mono

## Color
- **Approach:** Restrained (1 accent + neutrals)
- **Primary:** #06B6D4 (cyan) — 메인 액센트, CTA, 활성 상태
- **Primary scale:** 50:#ecfeff 100:#cffafe 200:#a5f3fc 300:#67e8f9 400:#22d3ee 500:#06B6D4 600:#0891b2 700:#0e7490
- **Neutrals:** Warm gray (stone) — #FAFAF9, #F5F5F4, #E7E5E4, #D6D3D1, #A8A29E, #78716C, #57534E, #44403C, #292524, #1C1917
- **Semantic:**
  - Success: #22C55E (완료, 정상, 녹색 건강 점수)
  - Warning: #F59E0B (진행 중, 주의, 황색 건강 점수)
  - Danger: #EF4444 (지연, 긴급, 적색 건강 점수)
  - Info: #3B82F6 (정보성 알림)
- **Dark mode:** Surface를 warm dark (#1C1917 base), 텍스트 off-white (#FAFAF9), accent 채도 10% 감소

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined
- **Grid:** 1 col (mobile) / 2 col (tablet) / 3 col (desktop)
- **Max content width:** 1280px
- **Border radius:** sm:4px md:8px lg:12px xl:16px full:9999px
- **Touch targets:** 최소 44px (접근성 필수)

## Motion
- **Approach:** Minimal-functional (전환과 피드백만, 장식 없음)
- **Easing:** enter: ease-out, exit: ease-in, move: ease-in-out
- **Duration:** micro: 100ms, short: 150ms, medium: 250ms, long: 400ms
- **Rule:** prefers-reduced-motion 존중, transition: all 금지, transform/opacity만 애니메이션

## Component Patterns
- **Badges:** .badge-success/warning/danger/neutral — 건강 점수, 상태 표시
- **D-Day:** JetBrains Mono 800, 색상 코딩 (danger/warning/success)
- **Cards:** surface-1 배경, border-subtle, hover 시 border 강화
- **Empty states:** 따뜻한 메시지 + CTA 버튼 + 아이콘 (절대 "없습니다"만 쓰지 않기)
- **Loading:** Skeleton shimmer (기존 패턴 유지)
- **Toast:** Notyf, bottom-right, 3초, aria-live="polite" 추가 필요

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Initial design system created | /design-consultation 기반, 경쟁사 리서치 (Linear, Asana, PLM tools) |
| 2026-03-31 | Warm gray surface (cool → warm) | 사내 도구에 더 친근한 느낌, stone 계열 |
| 2026-03-31 | Pretendard 통일 | 한국어 최적화, system font 혼용 제거 |
| 2026-03-31 | Glassmorphism 수위 낮춤 | backdrop-filter 줄이고 border 강화, 가독성 우선 |
| 2026-04-01 | Nav touch target 44px | 접근성 기준 충족 (design-review FINDING-001) |
| 2026-04-01 | 지연 작업 빨간 좌측 보더 | 우선순위 시각적 구분 (design-review FINDING-002) |
