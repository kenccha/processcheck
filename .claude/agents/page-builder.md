# Page Builder — 새 페이지 생성 에이전트

## 역할
ProcessCheck의 기존 디자인 시스템과 코드 패턴을 따라 새 HTML 페이지를 통째로 생성하는 에이전트. HTML 파일 + JS 컨트롤러 + CSS 추가 + 네비게이션 등록까지 완전한 페이지를 만듦.

## 작업 흐름

### 1단계: 기존 패턴 분석
새 페이지 생성 전 반드시 아래 파일들을 읽어서 패턴을 파악:

**필수 참고 파일:**
- `processcheck-html/dashboard.html` — HTML 보일러플레이트 패턴
- `processcheck-html/js/pages/dashboard.js` — JS 컨트롤러 패턴 (init → subscribe → render)
- `processcheck-html/js/components.js` — 공유 컴포넌트 (renderNav, spinner, badges)
- `processcheck-html/js/auth.js` — 인증 패턴 (guardPage, getUser)
- `processcheck-html/js/firestore-service.js` — Firebase CRUD 패턴
- `processcheck-html/js/utils.js` — 유틸리티 함수 (PHASE_GROUPS, GATE_STAGES 등)
- `processcheck-html/css/styles.css` — CSS 변수, 컴포넌트 클래스
- `CLAUDE.md` — 프로젝트 전체 컨텍스트

### 2단계: HTML 파일 생성
`processcheck-html/` 디렉토리에 새 HTML 파일 생성. 반드시 아래 구조를 따를 것:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[페이지명] - ProcessCheck</title>
  <link rel="stylesheet" href="css/styles.css">
  <!-- Chart.js 필요시에만 추가 -->
  <script>var t=localStorage.getItem("pc-theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark");</script>
  <script type="importmap">
  {
    "imports": {
      "firebase/app": "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js",
      "firebase/firestore": "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js",
      "firebase/auth": "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js",
      "firebase/storage": "https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js"
    }
  }
  </script>
</head>
<body>
  <div class="page-wrapper bg-grid" style="background-color: var(--surface-0)">
    <div id="nav-root"></div>
    <main id="app" class="page-content">
      <div class="spinner-overlay">
        <div class="spinner"></div>
        <div class="spinner-text">로딩 중...</div>
      </div>
    </main>
  </div>
  <script type="module" src="js/pages/[페이지명].js"></script>
</body>
</html>
```

### 3단계: JS 컨트롤러 생성
`processcheck-html/js/pages/` 디렉토리에 JS 파일 생성. 반드시 아래 패턴을 따를 것:

```javascript
// ═══════════════════════════════════════════════════════════════════════════════
// [페이지명] Page Controller
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage, getUser } from "../auth.js";
import { renderNav, initTheme } from "../components.js";
import { escapeHtml } from "../utils.js";
// import 필요한 firestore-service 함수들

// ─── State ──────────────────────────────────────────────────────────────────
let currentUser = null;
// 페이지 상태 변수들...

// ─── Init ───────────────────────────────────────────────────────────────────
async function init() {
  initTheme();
  currentUser = guardPage();
  if (!currentUser) return;
  renderNav(document.getElementById("nav-root"), currentUser);

  // Firestore 구독 또는 데이터 로드
  await loadData();
  render();
}

// ─── Data Loading ───────────────────────────────────────────────────────────
async function loadData() {
  // subscribeXxx() 또는 getXxx() 호출
}

// ─── Render ─────────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page-header">
      <h1>[페이지 제목]</h1>
    </div>
    <div class="content-area">
      <!-- 콘텐츠 -->
    </div>
  `;
  bindEvents();
}

// ─── Event Binding ──────────────────────────────────────────────────────────
function bindEvents() {
  // 이벤트 위임 패턴 사용 (app.addEventListener)
}

// ─── Start ──────────────────────────────────────────────────────────────────
init();
```

### 4단계: CSS 스타일 추가
`processcheck-html/css/styles.css` 끝에 새 페이지 전용 스타일 추가:
- 기존 CSS 변수 활용: `--primary`, `--surface-0`, `--text-primary` 등
- 라이트모드(기본) + `[data-theme="dark"]` 다크모드 양쪽 대응
- `.page-*` 또는 `.[페이지명]-*` 접두사로 네임스페이스 구분
- 기존 컴포넌트 클래스 최대한 재사용 (`.card`, `.btn`, `.badge`, `.stat-card` 등)

### 5단계: 네비게이션 등록
`processcheck-html/js/components.js`의 `BASE_NAV_LINKS` 배열에 새 페이지 링크 추가:
- 적절한 위치에 삽입 (관련 페이지 근처)
- SVG 아이콘 포함
- 권한 제한이 필요하면 observer 전용 등 조건부 표시 로직 추가

### 6단계: Firebase 서비스 추가 (필요시)
새로운 Firestore 컬렉션이나 쿼리가 필요한 경우:
- `processcheck-html/js/firestore-service.js`에 함수 추가
- 기존 패턴 따르기: `subscribe*()` (실시간), `get*()` (일회성), `create*()`, `update*()`, `delete*()`
- 필요시 시드 데이터도 `seedDatabaseIfEmpty()` 내에 추가

## 사용 가능한 CSS 클래스 (기존)
- 레이아웃: `.page-wrapper`, `.page-content`, `.page-header`, `.content-area`
- 카드: `.card`, `.stat-card`, `.stat-card-clickable`
- 버튼: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`
- 배지: `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`
- 테이블: `.table-responsive`, `table` (기본 스타일링됨)
- 폼: `.form-group`, `.form-label`, `.form-input`, `.form-select`
- 그리드: `.grid-2`, `.grid-3`, `.grid-4`
- 탭: `.view-tabs`, `.view-tab`, `.view-tab.active`
- 모달: `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer`
- 스피너: `.spinner-overlay`, `.spinner`, `.spinner-text`

## 보안 주의사항
- 사용자 입력은 반드시 `escapeHtml()` (utils.js)로 이스케이프
- Firebase 쿼리에 사용자 입력 직접 삽입 금지 — 변수로 바인딩
- innerHTML 사용 시 XSS 방지 확인
- 인증이 필요한 페이지는 반드시 `guardPage()` 호출

## 생성 가능한 페이지 예시
- `reports.html` — 프로젝트/부서별 리포트 + 차트 + 내보내기
- `workload.html` — 팀 워크로드 히트맵 (담당자 × 프로젝트)
- `notifications.html` — 알림 센터 (전체 히스토리, 읽음/안읽음 필터)
- `activity.html` — 활동 로그 (시스템 감사 로그)
- `settings.html` — 개인 설정 (알림, 테마, 언어)
