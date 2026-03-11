# ProcessCheck (프로세스체크)

## What This Is

하드웨어 제품 개발 프로세스를 한눈에 볼 수 있는 사내 관리 시스템. 10개 부서가 얽힌 6단계 개발 프로세스(발의→기획→WM→Tx→MSG→양산/이관)의 체크리스트, 승인, 일정을 실시간으로 추적한다. PLM/ERP가 있지만 프로세스 가시성이 부족해서 별도로 만드는 도구.

## Core Value

여러 부서가 얽힌 하드웨어 개발 프로세스의 현재 상태와 병목을 누구나 즉시 파악할 수 있어야 한다.

## Requirements

### Validated

<!-- 이미 구현되어 작동 중인 기능들 (코드베이스 분석 기반) -->

- ✓ Microsoft OAuth 로그인 + 데모 카드 로그인 — existing
- ✓ 3가지 역할 기반 접근 제어 (실무자/매니저/기획조정실) — existing
- ✓ 프로젝트 CRUD 및 목록 (7가지 뷰: 테이블/매트릭스/카드/간트/칸반/타임라인/캘린더) — existing
- ✓ 6단계 프로세스 파이프라인 시각화 (작업+승인 쌍) — existing
- ✓ 체크리스트 템플릿 관리 (193개 항목, 매트릭스/트리/리스트 뷰) — existing
- ✓ 템플릿 → 프로젝트 체크리스트 자동 생성 (프로젝트 유형별 차등) — existing
- ✓ 작업 완료 → 승인 대기 → 승인/반려 워크플로우 — existing
- ✓ 프로젝트 상세 3탭 (개요+작업 / 스케줄 / 병목) — existing
- ✓ 역할별 대시보드 4탭 (프로젝트/작업/승인대기/알림) — existing
- ✓ D-Day 기반 일정 관리 + 지연 사유 표시 — existing
- ✓ 실시간 Firestore 구독 (onSnapshot) — existing
- ✓ 라이트/다크 테마 토글 — existing
- ✓ 알림 자동 생성 (완료/승인/반려 시) — existing
- ✓ 설계변경 관리 (minor/medium/major 규모별 차등 프로세스) — existing
- ✓ 고객(대리점/법인) 관리 + 고객 포털 (읽기 전용, 이메일 인증) — existing
- ✓ 영업 출시 준비 대시보드 — existing
- ✓ 사용자 관리 (observer 전용) — existing
- ✓ 리뷰/피드백 시스템 (코멘트, 이슈, 승인 투표) — existing
- ✓ 매뉴얼 페이지 (인증 불필요, ScrollSpy, 검색) — existing
- ✓ Firebase Hosting 배포 + GitHub Actions CI/CD — existing

### Active

<!-- v2.0 UX/UI 대규모 개선 — 경쟁사 분석 기반 -->

- [ ] 즉시 체감 UX 개선 (인라인 승인, 토스트, 슬라이드 패널, 인라인 상태 변경)
- [ ] 시각적 품질 향상 (Battery-bar, 3색 시스템, 스켈레톤 로딩, CSS 토큰 정리)
- [ ] 파워유저 생산성 (Cmd+K, 필터 pill, 뷰 상태 저장, 일괄 작업, 워크로드 히트맵)
- [ ] 정보 구조 개선 (D-Day 컬럼, 뷰 정리, 승인 전용 페이지, 간트/히스토리 실데이터)
- [ ] 칸반 드래그앤드롭 (HTML DnD API, 부서 스윔레인, 긴급 고정 레인)

### Out of Scope

- 모바일 앱 — 웹 우선, 추후 검토
- PLM/ERP 연동 — 별도 시스템으로 운영
- 실시간 채팅 — 프로세스 관리 도구의 범위 밖
- 다국어 지원 — 사내 한국어 전용
- Next.js 앱 동기화 — HTML 포트에 집중

## Context

- 의료기기 하드웨어 개발 회사 (InBody) 내부용
- 10개 부서: 개발팀, 품질팀, 영업팀, 제조팀, 구매팀, CS팀, 경영관리팀, 글로벌임상팀, 디자인연구소, 인증팀
- 신규개발 연 5-6건 (1년 장기), 설계변경 월 ~50건 (짧은 사이클)
- 빌드 도구 없는 순수 HTML+CSS+JS (Firebase SDK CDN)
- Firestore 실시간 구독 기반 아키텍처
- 코드베이스 상당 규모: firestore-service.js 2,060줄, 14개 HTML 페이지
- 자동 테스트 없음, 수동 테스트에 의존

## Constraints

- **Tech Stack**: 순수 HTML+CSS+JS (빌드 스텝 없음) — 간단한 배포가 핵심
- **Auth**: Microsoft OAuth (@inbody.com 도메인 제한) + Firebase Auth
- **Backend**: Firebase only (Firestore + Auth + Storage + Hosting)
- **Users**: 사내 직원만 사용 (외부 공개 X, 고객 포털은 읽기 전용)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 빌드 스텝 없는 순수 HTML/JS | 간단한 배포, 프레임워크 의존성 제거 | ✓ Good |
| Firebase 전면 사용 | 서버 관리 불필요, 실시간 구독 용이 | ✓ Good |
| 6단계 프로세스 구조 확정 | 실제 하드웨어 개발 프로세스 반영 | ✓ Good |
| Observer만 승인 권한 | 기획조정실 중심 거버넌스 | ✓ Good |
| 라이트모드 기본 + 다크모드 토글 | 사용자 선호도 반영 | ✓ Good |

## Current Milestone: v2.0 UX/UI 대규모 개선

**Goal:** 경쟁사 분석(Linear, Notion, Monday.com, Arena PLM, Jira, ClickUp) 기반으로 ProcessCheck의 UX/UI를 전면 개선하여 실무자가 매일 쓰고 싶은 도구로 만든다.

**Target features:**
- 즉시 체감 UX (A1-A6): 체크리스트 연동, 인라인 승인, 알림 이동, 토스트, 슬라이드 패널, 인라인 상태 변경
- 시각적 품질 (B1-B6): Battery-bar, 3색 시스템, 스켈레톤 로딩, Hover 액션, CSS 토큰 정리, 뷰 전환 애니메이션
- 파워유저 생산성 (C1-C5): Cmd+K, 필터 pill, 뷰 상태 저장, 일괄 작업, 워크로드 히트맵
- 정보 구조 (D1-D7): D-Day 컬럼, 뷰 정리, 리포트 연결, Sales 네비, 승인 전용 페이지, 간트 실데이터, 히스토리 실데이터
- 칸반/DnD (E1-E3): 드래그앤드롭, 부서 스윔레인, 긴급 고정 레인

---
*Last updated: 2026-03-12 after milestone v2.0 started*
