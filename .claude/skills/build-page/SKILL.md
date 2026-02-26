---
name: build-page
description: ProcessCheck 디자인 시스템을 따르는 새 HTML 페이지를 생성. Use when the user asks to create a new page, build a new view, or add a new section to the app.
argument-hint: "[페이지명] [설명]"
disable-model-invocation: true
---

# Page Builder — 새 페이지 생성

## 만들 페이지
$ARGUMENTS

## 반드시 읽을 파일 (패턴 파악용)
1. `processcheck-html/dashboard.html` — HTML 보일러플레이트
2. `processcheck-html/js/pages/dashboard.js` — JS 컨트롤러 패턴 (init → subscribe → render)
3. `processcheck-html/js/components.js` — 공유 컴포넌트 (renderNav, initTheme)
4. `processcheck-html/js/auth.js` — 인증 (guardPage, getUser)
5. `processcheck-html/js/firestore-service.js` — Firebase CRUD 패턴
6. `processcheck-html/js/utils.js` — 유틸리티 (PHASE_GROUPS, escapeHtml 등)
7. `processcheck-html/css/styles.css` — CSS 변수, 컴포넌트 클래스
8. `.claude/agents/page-builder.md` — 상세 가이드

## 생성할 파일
1. **HTML**: `processcheck-html/[페이지명].html`
2. **JS 컨트롤러**: `processcheck-html/js/pages/[페이지명].js`
3. **CSS 추가**: `processcheck-html/css/styles.css` 끝에 페이지 전용 스타일

## 필수 체크리스트
- [ ] HTML 보일러플레이트 (importmap, theme flash 방지 스크립트)
- [ ] JS: init() → guardPage() → renderNav() → 데이터 로드 → render()
- [ ] CSS: 라이트 + 다크모드 양쪽 대응
- [ ] 네비게이션: `components.js` BASE_NAV_LINKS에 추가
- [ ] 보안: escapeHtml() 처리, XSS 방지
- [ ] 빈 상태(empty state) + 로딩 상태 처리
- [ ] 반응형 레이아웃 (모바일 대응)

## HTML 템플릿
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[제목] - ProcessCheck</title>
  <link rel="stylesheet" href="css/styles.css">
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

## JS 컨트롤러 템플릿
```javascript
import { guardPage, getUser } from "../auth.js";
import { renderNav, initTheme } from "../components.js";
import { escapeHtml } from "../utils.js";

let currentUser = null;

async function init() {
  initTheme();
  currentUser = guardPage();
  if (!currentUser) return;
  renderNav(document.getElementById("nav-root"), currentUser);
  await loadData();
  render();
}

async function loadData() { /* Firestore 구독/로드 */ }

function render() {
  const app = document.getElementById("app");
  app.innerHTML = `<!-- 콘텐츠 -->`;
  bindEvents();
}

function bindEvents() { /* 이벤트 위임 */ }

init();
```
