# ProcessCheck 개발자 핸드오프 패키지

> **문서 버전**: 1.0
> **작성일**: 2026-03-11
> **대상 독자**: 신규 합류 개발자, 유지보수 담당자

---

## 1. 프로젝트 온보딩 가이드

### 1.1 사전 요구사항

| 도구 | 최소 버전 | 용도 |
|------|----------|------|
| Node.js | 18+ | Next.js 빌드 및 개발 서버 |
| npm | 9+ | 패키지 관리 |
| Git | 2.30+ | 버전 관리 |
| Python 3 | 3.8+ | HTML Port 개발 서버 (선택) |
| Firebase CLI | 최신 | Firestore 시드, 배포 (선택) |

### 1.2 셋업 순서

```bash
# 1. 저장소 클론
git clone <repository-url> processcheck
cd processcheck

# 2. 환경 변수 설정
cp .env.local.example .env.local
# .env.local 파일을 열어 Firebase 인증 정보 입력:
#   NEXT_PUBLIC_FIREBASE_API_KEY=...
#   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
#   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
#   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
#   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
#   NEXT_PUBLIC_FIREBASE_APP_ID=...

# 3. 의존성 설치
npm install

# 4. 개발 서버 시작 (Next.js)
npm run dev
# -> http://localhost:3000

# 5. HTML Port 개발 서버 (별도 터미널)
cd processcheck-html
python3 -m http.server 8080
# -> http://localhost:8080
```

### 1.3 첫 접속 시 동작

1. `index.html` (또는 Next.js `/`) 접속
2. `seedDatabaseIfEmpty()` 자동 호출 -> Firestore가 비어있으면 시드 데이터 생성
3. 시딩 중 스피너 표시 -> 완료 후 로그인 카드 노출
4. 데모 카드 중 하나를 클릭하여 로그인

### 1.4 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | Next.js 개발 서버 (HMR 지원) |
| `npm run build` | 프로덕션 빌드 (Static Export -> `/out`) |
| `npm run lint` | ESLint 실행 |
| `npm run start` | 프로덕션 서버 시작 |
| `node scripts/seed.mjs` | Firestore 시드 데이터 수동 생성 |

---

## 2. 아키텍처 오버뷰

### 2.1 전체 아키텍처

```
+---------------------------------------------------+
|                    클라이언트                        |
|                                                     |
|  +------------------+    +----------------------+   |
|  |   Next.js App    |    |    HTML Port          |   |
|  |  (React 18 + TS) |    |  (Vanilla JS + CSS)  |   |
|  |  Port: 3000      |    |  Port: 8080           |   |
|  +--------+---------+    +----------+-----------+   |
|           |                         |               |
|           +----------+--------------+               |
|                      |                              |
+----------------------|------------------------------+
                       |
              Firebase SDK (Client)
                       |
         +-------------+---------------+
         |             |               |
    Firestore     Auth (OAuth)    Storage
    (NoSQL DB)   (Microsoft)    (미연동)
```

### 2.2 폴더 구조

```
processcheck/
  +-- app/                        # Next.js App Router
  |   +-- dashboard/              #   대시보드 페이지
  |   +-- projects/               #   프로젝트 목록 + [id] 상세
  |   +-- project/                #   프로젝트 상세 (단일 뷰)
  |   +-- task/                   #   작업 상세
  |   +-- admin/checklists/       #   체크리스트 템플릿 관리
  |   +-- landing/                #   랜딩 페이지
  |   +-- layout.tsx              #   루트 레이아웃
  |   +-- page.tsx                #   로그인 페이지 (/)
  |
  +-- components/                 # 공유 React 컴포넌트
  |   +-- Navigation.tsx          #   네비게이션 바
  |
  +-- contexts/                   # React Context
  |   +-- AuthContext.tsx          #   인증 + 권한 관리
  |
  +-- lib/                        # 핵심 라이브러리
  |   +-- firebase.ts             #   Firebase 초기화
  |   +-- firestoreService.ts     #   Firestore CRUD + 구독
  |   +-- types.ts                #   TypeScript 타입 정의
  |   +-- mockData.ts             #   Mock 데이터 + 유틸리티
  |
  +-- scripts/
  |   +-- seed.mjs                #   DB 시딩 스크립트
  |
  +-- processcheck-html/          # HTML Port (빌드 불필요)
  |   +-- index.html              #   로그인
  |   +-- dashboard.html          #   대시보드
  |   +-- projects.html           #   프로젝트 목록
  |   +-- project.html            #   프로젝트 상세
  |   +-- task.html               #   작업 상세
  |   +-- admin-checklists.html   #   체크리스트 관리
  |   +-- customers.html          #   고객 관리
  |   +-- customer-portal.html    #   고객 포털
  |   +-- sales.html              #   영업 대시보드
  |   +-- manual.html             #   매뉴얼
  |   +-- landing.html            #   랜딩 페이지
  |   +-- css/styles.css          #   전체 스타일
  |   +-- img/                    #   매뉴얼 스크린샷 (14개)
  |   +-- js/
  |       +-- firebase-init.js    #   Firebase 초기화
  |       +-- firestore-service.js #  Firestore CRUD + 구독
  |       +-- auth.js             #   인증 (localStorage + OAuth)
  |       +-- utils.js            #   헬퍼 함수
  |       +-- components.js       #   공유 UI (Nav, Spinner)
  |       +-- pages/
  |           +-- login.js        #   로그인 페이지 로직
  |           +-- dashboard.js    #   대시보드 로직
  |           +-- projects.js     #   프로젝트 목록 로직
  |           +-- project-detail.js # 프로젝트 상세 로직
  |           +-- task-detail.js  #   작업 상세 로직
  |           +-- admin-checklists.js # 템플릿 관리 로직
  |           +-- customers.js    #   고객 관리 로직
  |           +-- sales.js        #   영업 대시보드 로직
  |           +-- manual.js       #   매뉴얼 로직
  |           +-- landing.js      #   랜딩 페이지 로직
  |
  +-- docs/
  |   +-- manual.md               #   매뉴얼 콘텐츠 (한국어)
  |   +-- deliverables/           #   산출물 (본 문서 포함)
  |
  +-- .claude/                    #   Claude Code 설정
  |   +-- settings.json           #   Hook 설정
  |   +-- agents/                 #   서브 에이전트
  |
  +-- CLAUDE.md                   #   프로젝트 지침서
  +-- package.json
  +-- tsconfig.json
  +-- tailwind.config.ts
  +-- next.config.ts
  +-- .env.local.example
```

### 2.3 데이터 흐름

```
[사용자 액션]
      |
      v
[Page Controller]  (js/pages/*.js)
      |
      v
[Firestore Service] (js/firestore-service.js)
      |
      +--- onSnapshot() --> [실시간 콜백] --> [UI 렌더링]
      |
      +--- getDoc()/getDocs() --> [일회성 조회] --> [UI 렌더링]
      |
      +--- updateDoc()/addDoc() --> [Firestore 쓰기]
                                         |
                                    [사이드 이펙트]
                                         |
                              +----------+----------+
                              |          |          |
                         알림 생성  통계 재계산  포털 알림
```

### 2.4 주요 패턴

| 패턴 | 설명 | 적용 위치 |
|------|------|---------|
| **Real-time Subscription** | Firestore `onSnapshot()`으로 데이터 변경 실시간 반영 | 모든 목록 페이지 |
| **Page Controller** | 각 HTML 페이지에 대응하는 JS 파일이 초기화 + 렌더링 담당 | `js/pages/*.js` |
| **Document Conversion** | Firestore Timestamp -> JS Date 자동 변환 (`docToProject()` 등) | `firestore-service.js` |
| **Side Effect Chain** | 작업 상태 변경 시 알림/통계/포털 알림 자동 생성 | `completeTask()`, `approveTask()`, `rejectTask()` |
| **Template-based Generation** | 193개 템플릿 -> 프로젝트 유형별 필터 -> 체크리스트 일괄 생성 | `applyTemplateToProject()` |
| **Guard Pattern** | 페이지 로드 시 인증 확인, 미인증 시 리다이렉트 | `guardPage()` |

---

## 3. 코딩 컨벤션

### 3.1 파일 명명 규칙

| 구분 | 규칙 | 예시 |
|------|------|------|
| Next.js 페이지 | `page.tsx` (App Router) | `app/dashboard/page.tsx` |
| React 컴포넌트 | PascalCase + `.tsx` | `Navigation.tsx` |
| TypeScript 라이브러리 | camelCase + `.ts` | `firestoreService.ts` |
| HTML Port 페이지 | kebab-case + `.html` | `admin-checklists.html` |
| HTML Port JS | kebab-case + `.js` | `firestore-service.js`, `project-detail.js` |
| CSS | kebab-case + `.css` | `styles.css` |

### 3.2 컴포넌트 구조 (HTML Port)

각 페이지의 JS 파일은 다음 구조를 따른다:

```javascript
// 1. Import
import { guardPage, getUser } from "../auth.js";
import { subscribeXxx } from "../firestore-service.js";
import { renderNav } from "../components.js";

// 2. 페이지 초기화
document.addEventListener("DOMContentLoaded", async () => {
  const user = guardPage();        // 인증 가드
  if (!user) return;

  renderNav(document.getElementById("nav"));  // 네비게이션 렌더링

  // 3. 데이터 구독
  const unsub = subscribeXxx((data) => {
    renderContent(data, user);     // UI 렌더링
  });

  // 4. 이벤트 바인딩
  bindEvents(user);
});

// 5. 렌더링 함수
function renderContent(data, user) {
  document.getElementById("content").innerHTML = `...`;
}

// 6. 이벤트 핸들러
function bindEvents(user) {
  document.addEventListener("click", (e) => { ... });
}
```

### 3.3 상태 관리

| 구분 | 방식 |
|------|------|
| Next.js | React Context (`AuthContext.tsx`) + `useState` / `useEffect` |
| HTML Port | 모듈 스코프 변수 + Firestore `onSnapshot` 콜백으로 상태 갱신 |
| 인증 상태 | `localStorage("pc_user")` |
| 테마 상태 | `localStorage("pc-theme")` |
| 포털 인증 | `sessionStorage` |

### 3.4 에러 처리

- Firestore 쿼리 실패: `try/catch`로 감싸고 `console.error()` 출력
- 알림/통계 사이드 이펙트: 실패해도 메인 작업은 성공 처리 (비차단)
- 인증 실패: `guardPage()`에서 로그인 페이지로 리다이렉트

### 3.5 코드 스타일

- **들여쓰기**: 2 spaces
- **세미콜론**: 필수
- **문자열**: 더블 쿼트(`"`)
- **함수**: ES6 arrow function + 일반 function 혼용
- **HTML in JS**: 템플릿 리터럴 (backtick) 사용
- **주석**: 한국어 가능 (도메인 용어는 한국어가 자연스러움)

---

## 4. 산출물 인덱스

`/docs/deliverables/` 폴더에 있는 모든 파일 목록이다.

### 4.1 인터랙티브 HTML 산출물

| 파일명 | 설명 | 용도 |
|--------|------|------|
| `sitemap.html` | 사이트맵 다이어그램 | 전체 페이지 구조와 네비게이션 흐름을 시각적으로 표현. 새 페이지 추가 시 참조 |
| `data-model.html` | 데이터 모델 다이어그램 | Firestore 컬렉션 간 관계, 필드 정의, 참조 관계를 ER 다이어그램 형식으로 표현 |
| `process-map.html` | 프로세스 맵 | 6 Phase 승인 워크플로우, 역할별 책임, 상태 전이를 플로우차트로 표현 |
| `architecture.html` | 아키텍처 다이어그램 | 시스템 구성요소, 기술 스택, 데이터 흐름을 아키텍처 다이어그램으로 표현 |
| `user-flows.html` | 사용자 플로우 다이어그램 | 주요 사용자 시나리오(로그인, 작업 완료, 승인 등)의 단계별 흐름을 표현 |

### 4.2 마크다운 문서

| 파일명 | 설명 | 용도 |
|--------|------|------|
| `spec.md` | 개발자용 기능 명세서 | 전체 시스템의 기능, 데이터 모델, API, 권한, 워크플로우를 상세히 기술. 개발/QA 참조용 |
| `ideate.md` | 3관점 기능 제안서 | 사용자/관리자/시스템 관점에서 30개 개선 제안을 우선순위와 함께 정리. 로드맵 수립 참조용 |
| `handoff.md` | 개발자 핸드오프 패키지 | 신규 개발자 온보딩, 코딩 컨벤션, 의사결정 로그, 개발 체크리스트를 정리. 본 문서 |

---

## 5. 주요 의사결정 로그

CLAUDE.md에서 "(확정)" 표기된 항목들을 시간순으로 정리한다.

### 5.1 인증 및 역할 체계

| 결정 사항 | 내용 |
|----------|------|
| **Login Design** | 데모 카드 로그인(3명) + Microsoft OAuth 공존. 신규 OAuth 사용자는 역할/부서 선택 후 등록 |
| **User Roles** | 3단계: worker(실무자), manager(매니저), observer(기획조정실) |
| **Departments** | 10개 부서 고정: 개발팀, 품질팀, 영업팀, 제조팀, 구매팀, CS팀, 경영관리팀, 글로벌임상팀, 디자인연구소, 인증팀 |

### 5.2 프로젝트 구조

| 결정 사항 | 내용 |
|----------|------|
| **Project Types** | 신규개발(연 5-6건, 전체 Phase) + 설계변경(월 ~50건, 규모별 차등) |
| **Project Stages** | 6 Phase, 각각 작업(Work Stage) + 승인(Gate Stage) 쌍. 총 12개 stage name |
| **Firestore DB 구조** | templateStages(6), templateItems(193개, stageId로 phase 참조), checklistItems(12개 개별 stage name) |
| **Stage Name Format** | 숫자 접두사(`N_`) 없음. bare name만 사용 (예: "WM제작", NOT "4_WM제작") |

### 5.3 승인 워크플로우

| 결정 사항 | 내용 |
|----------|------|
| **승인 2단계 구조** | Work Stage -> manager 승인, Gate Stage -> observer 승인 |
| **GATE_STAGES** | `["발의승인", "기획승인", "WM승인회", "Tx승인회", "MSG승인회", "영업이관"]` |
| **Task Detail** | 타임라인에 날짜+행위자, 승인 대기 시 검토자+완료일, 반려 시 "재작업 시작" 버튼 |
| **completeTask** | `approvalStatus: "pending"` 자동 설정 |

### 5.4 UI/UX

| 결정 사항 | 내용 |
|----------|------|
| **Dashboard** | 통계 카드 5개 전부 클릭 가능. 역할별 구독 분리 |
| **Project Detail** | Stat 카드 5개(클릭가능). 프로젝트 상태 요약 카드 1개. "부서별 진행 상황" 없음 |
| **Matrix View** | 6 Phase 열, 각 셀에 동그라미 2개(작업/승인). 미승인 시 경고만(잠금 없음) |
| **Projects Page View Order** | 테이블 -> 매트릭스 -> 카드 -> 간트 -> 칸반 -> 타임라인 -> 캘린더 |
| **Theme** | 기본=라이트모드, 다크모드 토글. localStorage("pc-theme") |
| **Calendar View** | 담당자(assignee) 이름 표시, 이전/다음 월 이동 |
| **Checklist Admin** | 3가지 뷰(매트릭스/트리/리스트), 기본=매트릭스 |
| **Task & Importance** | 중요도: green(보통)/yellow(중요)/red(긴급) |

### 5.5 고객 및 출시 관리

| 결정 사항 | 내용 |
|----------|------|
| **고객 데이터 모델** | customers 컬렉션: type(dealer/subsidiary/hospital/online), portalEnabled, portalLoginEmail |
| **고객 포털** | 읽기 전용, 이메일 인증(sessionStorage), portalEnabled 체크 |
| **템플릿 적용** | `applyTemplateToProject()`: 193개 기반, 프로젝트 유형/규모별 필터링 |
| **출시 준비 체크리스트** | `applyLaunchChecklistToProject()`: 177개 기본 템플릿, D-Day 기준, 거래처별 곱하기 |

### 5.6 매뉴얼

| 결정 사항 | 내용 |
|----------|------|
| **Manual Page** | 인증 불필요, 좌측 TOC + ScrollSpy + 검색, 모바일 플로팅 TOC |
| **콘텐츠 소스** | `docs/manual.md` (한국어, 10개 섹션 + 용어집) |

---

## 6. 개발 체크리스트

새 기능을 추가하거나 기존 기능을 수정할 때 반드시 확인해야 할 항목들이다.

### 6.1 코드 변경 시

- [ ] **CLAUDE.md 업데이트**: 새로운 설계 결정이 있으면 "(확정)" 표기로 기록
- [ ] **Next.js + HTML Port 동기화**: `firestoreService.ts` 변경 -> `firestore-service.js`에 동일 반영
- [ ] **types.ts 업데이트**: 새 필드/타입 추가 시 TypeScript 타입 정의 갱신
- [ ] **utils.js 동기화**: 유틸리티 함수 추가/변경 시 양쪽 포트 동일 적용

### 6.2 기능 추가 시

- [ ] **역할별 권한 확인**: worker/manager/observer 각각에서 동작 검증
- [ ] **다크모드 지원 확인**: 새 UI 요소에 CSS 변수 사용, `[data-theme="dark"]` 대응
- [ ] **모바일 반응형 확인**: 브레이크포인트별 레이아웃 확인
- [ ] **실시간 구독 확인**: 새 데이터 소스에 onSnapshot 구독 적용 여부
- [ ] **사이드 이펙트 확인**: 상태 변경 시 알림/통계/포털 알림 자동 생성 여부

### 6.3 데이터 모델 변경 시

- [ ] **Firestore 보안 규칙 검토**: 새 컬렉션/필드에 대한 접근 권한 설정
- [ ] **시드 데이터 업데이트**: `getMockData()` 및 `seedDatabaseIfEmpty()`에 새 데이터 반영
- [ ] **타임스탬프 변환 확인**: 새 Timestamp 필드에 `toDate()` 변환 적용
- [ ] **문서 변환 함수 업데이트**: `docToXxx()` 함수에 새 필드 매핑 추가

### 6.4 배포 전

- [ ] **TypeScript 타입 체크**: `tsc --noEmit` 에러 없음
- [ ] **ESLint 통과**: `npm run lint` 경고/에러 없음
- [ ] **빌드 성공**: `npm run build` 정상 완료
- [ ] **HTML Port 테스트**: `python3 -m http.server 8080`으로 주요 페이지 동작 확인
- [ ] **3가지 역할로 로그인 테스트**: worker, manager, observer 각각으로 로그인하여 기능 확인

### 6.5 HTML Port 동기화 체크

변경한 파일에 따라 아래 대응 파일을 확인한다:

| Next.js 파일 | HTML Port 대응 파일 |
|-------------|-------------------|
| `lib/firestoreService.ts` | `js/firestore-service.js` |
| `lib/types.ts` | 해당 없음 (JS는 타입 없음, 하지만 인터페이스 변경 시 JS 로직 반영 필요) |
| `lib/mockData.ts` | `firestore-service.js` 내 `getMockData()` |
| `contexts/AuthContext.tsx` | `js/auth.js` |
| `components/Navigation.tsx` | `js/components.js` |
| `app/dashboard/page.tsx` | `js/pages/dashboard.js` |
| `app/projects/page.tsx` | `js/pages/projects.js` |
| `app/projects/[id]/page.tsx` | `js/pages/project-detail.js` |
| `app/task/page.tsx` | `js/pages/task-detail.js` |
| `app/admin/checklists/page.tsx` | `js/pages/admin-checklists.js` |

---

## 7. 연락처 & 리소스

### 7.1 프로젝트 리소스

| 리소스 | URL/위치 |
|--------|---------|
| **GitHub Repository** | (프로젝트 저장소 URL) |
| **GitHub Pages (배포)** | GitHub Actions -> main branch push 시 자동 배포 |
| **Firebase Console** | https://console.firebase.google.com/ (프로젝트 선택) |
| **Firebase 프로젝트 ID** | `.env.local`의 `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 참조 |

### 7.2 핵심 파일 경로

| 용도 | 절대 경로 |
|------|---------|
| 프로젝트 지침서 | `/Users/injooncha/processcheck/CLAUDE.md` |
| TypeScript 타입 | `/Users/injooncha/processcheck/lib/types.ts` |
| Firestore 서비스 (TS) | `/Users/injooncha/processcheck/lib/firestoreService.ts` |
| Firestore 서비스 (JS) | `/Users/injooncha/processcheck/processcheck-html/js/firestore-service.js` |
| 인증 모듈 (JS) | `/Users/injooncha/processcheck/processcheck-html/js/auth.js` |
| 유틸리티 (JS) | `/Users/injooncha/processcheck/processcheck-html/js/utils.js` |
| 공유 컴포넌트 (JS) | `/Users/injooncha/processcheck/processcheck-html/js/components.js` |
| CSS 스타일 | `/Users/injooncha/processcheck/processcheck-html/css/styles.css` |
| 환경 변수 예시 | `/Users/injooncha/processcheck/.env.local.example` |
| 매뉴얼 콘텐츠 | `/Users/injooncha/processcheck/docs/manual.md` |
| 산출물 폴더 | `/Users/injooncha/processcheck/docs/deliverables/` |

### 7.3 기술 문서 참조

| 기술 | 문서 URL |
|------|---------|
| Next.js 15 | https://nextjs.org/docs |
| Firebase Firestore | https://firebase.google.com/docs/firestore |
| Firebase Authentication | https://firebase.google.com/docs/auth |
| Tailwind CSS 3.4 | https://tailwindcss.com/docs |
| TypeScript 5 | https://www.typescriptlang.org/docs/ |

### 7.4 도메인 참조 규격

| 규격 | 설명 |
|------|------|
| ISO 13485 | 의료기기 품질 경영 시스템 |
| IEC 62304 | 의료기기 소프트웨어 생명 주기 프로세스 |
| IEC 60601-1 | 의료 전기기기 안전 |
| IEC 62366 | 의료기기 사용적합성 공학 |
| ISO 14971 | 의료기기 위험 관리 |
| ISO 10993 | 의료기기 생물학적 평가 |

### 7.5 Claude Code 자동화

| 자동화 | 설명 |
|--------|------|
| **PostToolUse Hook** | 파일 수정(Edit/Write) 시 `tsc --noEmit` 자동 실행 |
| **PreToolUse Hook** | `.env` 파일 수정 차단 |
| **build-verifier Agent** | 빌드 + 린트 + 타입체크 통합 검증 |
| **context7 MCP** | Next.js, Firebase, React 최신 문서 실시간 참조 |
