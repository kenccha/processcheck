// ═══════════════════════════════════════════════════════════════
// Deliverable Pages — Top Nav + Sidebar + Screenshot Feedback
// ═══════════════════════════════════════════════════════════════

(function () {
  const BASE = "../../";
  const SIDEBAR_W = 210;
  const NAV_H = 52;

  let user = null;
  try { user = JSON.parse(localStorage.getItem("pc_user")); } catch {}

  const SUB_PAGES = [
    { href: "wireframes.html", label: "전체 화면 설계", icon: "📱" },
    { href: "user-flows.html", label: "업무 흐름", icon: "🔀" },
    { href: "flow-annotations.html", label: "개선점 분석", icon: "📝" },
    { href: "diagram-viewer.html", label: "시스템 구조", icon: "📐" },
    { href: "checklist-wireframe.html", label: "체크리스트 상세", icon: "✅" },
    { href: "feedback.html", label: "피드백 모아보기", icon: "💬", isFeedback: true },
  ];

  // ── Load main app CSS for unified nav styling ──
  const mainCSS = document.createElement("link");
  mainCSS.rel = "stylesheet";
  mainCSS.href = BASE + "css/styles.css";
  document.head.appendChild(mainCSS);

  // NAV_LINKS — identical to components.js BASE_NAV_LINKS + admin links
  // All hrefs are relative to project root; we'll prepend BASE when rendering
  const NAV_LINKS = [
    {
      href: "projects.html?type=신규개발",
      label: "출시위원회",
      icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
    },
    {
      href: "admin-checklists.html",
      label: "체크리스트",
      icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
    },
    {
      href: "docs/deliverables/wireframes.html",
      label: "리뷰",
      icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>`,
      children: [
        { href: "docs/deliverables/wireframes.html", label: "전체 화면 설계" },
        { href: "docs/deliverables/user-flows.html", label: "업무 흐름" },
        { href: "docs/deliverables/diagram-viewer.html", label: "시스템 구조" },
        { href: "manual.html", label: "매뉴얼" },
        // 사용자 관리 + 권한 설정: observer만 표시 (아래 동적 삽입)
        { href: "docs/deliverables/feedback.html", label: "피드백 모아보기" },
      ],
    },
    {
      href: null,
      label: "다른 사이트",
      icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>`,
      isSeparated: true,
      children: [
        { href: "sales.html", label: "영업 출시 준비", external: true },
        { href: "customers.html", label: "고객 관리", external: true },
      ],
    },
  ];

  // observer만 관리자 링크 동적 삽입 (components.js와 동일 로직)
  if (user && user.role === "observer") {
    const reviewMenu = NAV_LINKS.find(l => l.label === "리뷰");
    if (reviewMenu && reviewMenu.children) {
      const fbIdx = reviewMenu.children.findIndex(c => c.label === "피드백 모아보기");
      const insertIdx = fbIdx >= 0 ? fbIdx : reviewMenu.children.length;
      reviewMenu.children.splice(insertIdx, 0,
        { href: "admin-users.html", label: "사용자 관리" },
        { href: "admin-permissions.html", label: "권한 설정" }
      );
    }
  }

  const currentFile = location.pathname.split("/").pop();
  const isFeedbackPage = currentFile === "feedback.html";

  // ── Load html2canvas ──
  const h2cScript = document.createElement("script");
  h2cScript.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  document.head.appendChild(h2cScript);

  // ══════════════════════════════════
  // 1. TOP NAV — uses main app CSS classes (.nav, .nav-link, etc.)
  // ══════════════════════════════════
  const currentPath = location.pathname;
  const currentSearch = location.search;

  function isLinkActive(link) {
    if (link.children) return link.children.some(c => currentPath.endsWith(c.href));
    if (link.href && link.href.includes("?")) {
      const [f, q] = link.href.split("?");
      return currentPath.endsWith(f) && currentSearch.includes(q);
    }
    return currentPath.endsWith(link.href);
  }

  function getThemeIcon() {
    const isDark = (localStorage.getItem("pc-theme") || "light") === "dark";
    return isDark
      ? `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><path stroke-linecap="round" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>`;
  }

  const topNav = document.createElement("div");
  topNav.id = "dr-topnav";
  topNav.innerHTML = `
    <nav class="nav">
      <div class="nav-inner">
        <div class="flex items-center gap-8">
          <button class="nav-logo" data-nav="projects.html?type=신규개발">
            <div class="nav-logo-icon"><span>PC</span></div>
            <span class="nav-logo-text">Process<span class="accent">Check</span></span>
          </button>
          <div class="nav-links">
            ${NAV_LINKS.map(link => {
              const isActive = isLinkActive(link);
              const sep = link.isSeparated ? '<span class="nav-separator"></span>' : '';
              if (link.children) {
                return `${sep}<div class="nav-dropdown">
                  <button class="nav-link${isActive ? " active" : ""}${link.isSeparated ? " nav-link-secondary" : ""}" data-nav="${link.href || "#"}">
                    ${link.icon}${link.label}
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-left:2px;opacity:.5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  <div class="nav-dropdown-menu">
                    ${link.children.map(child => `<button class="nav-dropdown-item${currentPath.endsWith(child.href) ? " active" : ""}" data-nav="${child.href}"${child.external ? ' data-external="true"' : ''}>${child.label}${child.external ? ' <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-left:4px;opacity:.4;vertical-align:middle"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>' : ''}</button>`).join("")}
                  </div>
                </div>`;
              }
              return `${sep}<button class="nav-link${isActive ? " active" : ""}" data-nav="${link.href}">
                ${link.icon}${link.label}
              </button>`;
            }).join("")}
          </div>
        </div>
        <div class="nav-right">
          <button class="nav-theme-toggle" id="nav-theme-btn" title="테마 전환">
            ${getThemeIcon()}
          </button>
          <button class="nav-icon-btn" data-nav="home.html" title="홈">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/></svg>
          </button>
          <div class="nav-user">
            <div class="nav-user-info">
              <div class="nav-user-name">${esc(user?.name || "")}</div>
            </div>
            <button class="nav-logout" id="dr-logout-btn" title="로그아웃">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;

  // ══════════════════════════════════
  // 2. LEFT SIDEBAR
  // ══════════════════════════════════
  const sidebar = document.createElement("aside");
  sidebar.id = "dr-sidebar";
  sidebar.innerHTML = `
    <div class="dr-section-label">리뷰</div>
    <nav class="dr-nav">
      ${SUB_PAGES.map(p =>
        `<a href="${p.href}" class="dr-nav-link${currentFile === p.href ? " dr-active" : ""}${p.isFeedback ? " dr-feedback-link" : ""}">
          <span class="dr-nav-icon">${p.icon}</span>
          <span class="dr-nav-text">${p.label}</span>
          <span class="dr-badge" data-page-badge="${p.href}" style="display:none">0</span>
        </a>`
      ).join("")}
    </nav>
    ${!isFeedbackPage ? `
    <div class="dr-divider"></div>
    <div class="dr-fb-summary">
      <div class="dr-fb-label">이 페이지 피드백</div>
      <div class="dr-fb-stats">
        <span><strong class="fb-count">0</strong> 전체</span>
        <span class="dr-fb-open"><strong class="fb-open">0</strong> 미해결</span>
      </div>
      <button class="dr-fb-btn" id="open-feedback-panel">📸 화면 캡처 피드백</button>
      <button class="dr-fb-btn dr-fb-btn-text" id="open-text-feedback" style="margin-top:4px;border-color:rgba(255,255,255,0.15);color:#94a3b8">✏️ 텍스트 피드백</button>
    </div>` : ""}
  `;

  // ══════════════════════════════════
  // 3. FEEDBACK SIDE PANEL (view list)
  // ══════════════════════════════════
  const panel = document.createElement("div");
  panel.id = "feedback-panel";
  panel.innerHTML = `
    <div class="fp-header">
      <h3>💬 피드백</h3>
      <button class="fp-close" id="close-feedback-panel">✕</button>
    </div>
    <div class="fp-form" id="fp-form" style="display:none">
      <input type="text" class="fp-input" id="fp-author" placeholder="이름 (필수)">
      <select class="fp-select" id="fp-type">
        <option value="suggestion">💡 개선 제안</option>
        <option value="bug">🐛 문제 보고</option>
        <option value="question">❓ 질문</option>
      </select>
      <select class="fp-select" id="fp-priority">
        <option value="medium">보통</option>
        <option value="high">🔴 높음</option>
        <option value="low">낮음</option>
      </select>
      <input type="text" class="fp-input" id="fp-section" placeholder="관련 섹션 (선택)">
      <textarea class="fp-textarea" id="fp-content" placeholder="피드백 내용..." rows="3"></textarea>
      <button class="fp-submit" id="fp-submit-btn">등록</button>
    </div>
    <div class="fp-divider"></div>
    <div class="fp-list" id="fp-list">
      <div class="fp-empty">아직 피드백이 없습니다</div>
    </div>
  `;

  // ══════════════════════════════════
  // 4. SCREENSHOT ANNOTATION OVERLAY
  // ══════════════════════════════════
  const captureOverlay = document.createElement("div");
  captureOverlay.id = "capture-overlay";
  captureOverlay.innerHTML = `
    <div class="co-toolbar">
      <div class="co-toolbar-left">
        <span class="co-title">📸 화면에 표시하고 피드백을 남기세요</span>
        <span class="co-hint">드래그로 영역을 표시하세요. 여러 개 가능합니다.</span>
      </div>
      <div class="co-toolbar-right">
        <button class="co-btn co-btn-undo" id="co-undo">↩ 되돌리기</button>
        <button class="co-btn co-btn-save-more" id="co-save-more">✅ 저장 & 더 캡처</button>
        <button class="co-btn co-btn-cancel" id="co-cancel">취소</button>
      </div>
    </div>
    <div class="co-canvas-wrap" id="co-canvas-wrap">
      <canvas id="co-canvas"></canvas>
    </div>
    <div class="co-form-bar" id="co-form-bar">
      <div class="co-thumbs-row" id="co-thumbs-row"></div>
      <div class="co-form-fields">
        <input type="text" class="co-input" id="co-author" placeholder="이름">
        <select class="co-select" id="co-type">
          <option value="suggestion">💡 제안</option>
          <option value="bug">🐛 문제</option>
          <option value="question">❓ 질문</option>
        </select>
        <select class="co-select" id="co-priority">
          <option value="medium">보통</option>
          <option value="high">🔴 높음</option>
          <option value="low">낮음</option>
        </select>
        <textarea class="co-textarea" id="co-content" placeholder="여기에 피드백 내용을 입력하세요..." rows="2"></textarea>
        <button class="co-btn co-btn-submit" id="co-submit">📤 피드백 등록</button>
      </div>
    </div>
  `;

  const toggle = document.createElement("button");
  toggle.id = "dr-toggle";
  toggle.innerHTML = "☰";
  const mobOverlay = document.createElement("div");
  mobOverlay.id = "dr-overlay";

  // ══════════════════════════════════
  // 5. STYLES
  // ══════════════════════════════════
  const style = document.createElement("style");
  style.textContent = `
    /* ── Top Nav override: use main app .nav from styles.css, just pin it fixed ── */
    #dr-topnav .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 10000; }
    #dr-topnav .nav-inner { max-width: 100%; }
    body { margin-top: 0 !important; padding-top: ${NAV_H}px !important; }

    /* ── Sidebar ── */
    #dr-sidebar { position: fixed; top: ${NAV_H}px; left: 0; bottom: 0; width: ${SIDEBAR_W}px; z-index: 9999; background: #0f172a; color: #e2e8f0; display: flex; flex-direction: column; padding: 12px 0; overflow-y: auto; border-right: 1px solid rgba(255,255,255,0.08); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif; transition: transform 0.25s ease; }
    .dr-section-label { padding: 8px 16px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .dr-nav { display: flex; flex-direction: column; gap: 2px; padding: 0 8px; }
    .dr-nav-link { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; text-decoration: none; color: #94a3b8; font-size: 13px; font-weight: 500; transition: all 0.15s; }
    .dr-nav-link:hover { background: rgba(255,255,255,0.06); color: #e2e8f0; }
    .dr-nav-link.dr-active { background: rgba(6,182,212,0.15); color: #06b6d4; font-weight: 600; }
    .dr-nav-icon { font-size: 14px; flex-shrink: 0; width: 20px; text-align: center; }
    .dr-nav-text { flex: 1; }
    .dr-badge { font-size: 10px; background: #ef4444; color: #fff; border-radius: 8px; padding: 0 5px; min-width: 16px; text-align: center; font-weight: 700; }
    .dr-feedback-link.dr-active { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .dr-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 10px 16px; }
    .dr-fb-summary { padding: 0 16px; }
    .dr-fb-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
    .dr-fb-stats { display: flex; gap: 12px; font-size: 12px; color: #94a3b8; margin-bottom: 8px; }
    .dr-fb-stats strong { color: #06b6d4; }
    .dr-fb-open strong { color: #fbbf24; }
    .dr-fb-btn { width: 100%; padding: 7px 0; border-radius: 6px; border: 1px dashed rgba(6,182,212,0.4); background: transparent; color: #06b6d4; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .dr-fb-btn:hover { background: rgba(6,182,212,0.1); border-style: solid; }
    body { margin-top: ${NAV_H}px !important; margin-left: ${SIDEBAR_W}px !important; }

    /* ── Mobile ── */
    #dr-toggle { display: none; position: fixed; top: ${NAV_H + 8}px; left: 8px; z-index: 10000; width: 36px; height: 36px; border-radius: 8px; background: #1e293b; border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; font-size: 18px; cursor: pointer; align-items: center; justify-content: center; }
    #dr-overlay { display: none; position: fixed; inset: 0; z-index: 9998; background: rgba(0,0,0,0.5); }
    #dr-overlay.open { display: block; }
    @media (max-width: 900px) {
      #dr-sidebar { transform: translateX(-100%); }
      #dr-sidebar.open { transform: translateX(0); }
      body { margin-left: 0 !important; }
      #dr-toggle { display: flex; }
      .nav-links { display: none; }
      .nav-user { display: none; }
    }

    /* ══ Screenshot Capture Overlay ══ */
    #capture-overlay {
      display: none; position: fixed; inset: 0; z-index: 20000;
      background: #0f172a; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
    }
    #capture-overlay.open { display: flex; }

    .co-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 20px; background: #1e293b;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .co-toolbar-left { display: flex; flex-direction: column; gap: 2px; }
    .co-title { font-size: 14px; font-weight: 700; color: #e2e8f0; }
    .co-hint { font-size: 12px; color: #64748b; }
    .co-toolbar-right { display: flex; gap: 8px; }
    .co-btn {
      padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: none; transition: all 0.15s;
    }
    .co-btn-undo { background: #334155; color: #e2e8f0; }
    .co-btn-undo:hover { background: #475569; }
    .co-btn-save-more { background: rgba(34,197,94,0.15); color: #22c55e; }
    .co-btn-save-more:hover { background: rgba(34,197,94,0.25); }
    .co-btn-cancel { background: rgba(239,68,68,0.15); color: #ef4444; }
    .co-btn-cancel:hover { background: rgba(239,68,68,0.25); }

    .co-canvas-wrap {
      flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center;
      padding: 12px; background: #0f172a; position: relative;
    }
    #co-canvas {
      max-width: 100%; max-height: 100%;
      border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      cursor: crosshair;
    }

    .co-form-bar {
      display: flex; flex-direction: column; gap: 8px;
      padding: 12px 20px; background: #1e293b;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .co-thumbs-row {
      display: flex; gap: 8px; align-items: center; overflow-x: auto; padding: 4px 0;
      min-height: 0;
    }
    .co-thumbs-row:empty { display: none; }
    .co-thumb-wrap {
      position: relative; flex-shrink: 0;
    }
    .co-thumb {
      width: 80px; height: 50px; object-fit: cover; border-radius: 6px;
      border: 2px solid rgba(255,255,255,0.15); cursor: pointer;
      transition: border-color 0.15s;
    }
    .co-thumb:hover { border-color: #06b6d4; }
    .co-thumb-num {
      position: absolute; top: -4px; left: -4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #06b6d4; color: #fff; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .co-thumb-del {
      position: absolute; top: -4px; right: -4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #ef4444; color: #fff; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; border: none; line-height: 1; opacity: 0;
      transition: opacity 0.15s;
    }
    .co-thumb-wrap:hover .co-thumb-del { opacity: 1; }
    .co-form-fields {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .co-input, .co-select, .co-textarea {
      padding: 7px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15);
      background: #0f172a; color: #e2e8f0; font-size: 12px; font-family: inherit; outline: none;
    }
    .co-input:focus, .co-select:focus, .co-textarea:focus { border-color: #06b6d4; }
    .co-input { width: 100px; }
    .co-select { width: 90px; }
    .co-textarea { flex: 1; min-width: 200px; resize: none; }
    .co-btn-submit {
      background: linear-gradient(135deg, #06b6d4, #0284c7); color: #fff;
      padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;
      border: none; cursor: pointer; white-space: nowrap;
    }
    .co-btn-submit:hover { opacity: 0.9; }
    .co-btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Floating capture bar (shown when screenshots accumulated, overlay closed) */
    #capture-float-bar {
      display: none; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 10002; background: #1e293b; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 14px; padding: 10px 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
      display: none; align-items: center; gap: 10px;
    }
    #capture-float-bar.open { display: flex; }
    .cfb-thumbs { display: flex; gap: 6px; align-items: center; }
    .cfb-thumb {
      width: 56px; height: 36px; object-fit: cover; border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .cfb-count { font-size: 12px; color: #94a3b8; font-weight: 600; white-space: nowrap; }
    .cfb-btn {
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: none; transition: all 0.15s; white-space: nowrap;
    }
    .cfb-btn-capture { background: #334155; color: #e2e8f0; }
    .cfb-btn-capture:hover { background: #475569; }
    .cfb-btn-submit { background: linear-gradient(135deg, #06b6d4, #0284c7); color: #fff; }
    .cfb-btn-submit:hover { opacity: 0.9; }
    .cfb-btn-discard { background: none; color: #ef4444; font-size: 11px; padding: 4px 8px; }
    .cfb-btn-discard:hover { text-decoration: underline; }

    /* ── Feedback Side Panel ── */
    #feedback-panel { position: fixed; top: ${NAV_H}px; right: -400px; width: 380px; bottom: 0; z-index: 10001; background: #0f172a; color: #e2e8f0; box-shadow: -4px 0 20px rgba(0,0,0,0.4); transition: right 0.3s ease; overflow-y: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif; }
    #feedback-panel.open { right: 0; }
    .fp-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .fp-header h3 { font-size: 16px; font-weight: 700; }
    .fp-close { background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
    .fp-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .fp-form { padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
    .fp-input, .fp-select, .fp-textarea { padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: #1e293b; color: #e2e8f0; font-size: 13px; font-family: inherit; outline: none; }
    .fp-input:focus, .fp-select:focus, .fp-textarea:focus { border-color: #06b6d4; }
    .fp-textarea { resize: vertical; min-height: 60px; }
    .fp-submit { padding: 10px; border-radius: 8px; border: none; background: linear-gradient(135deg, #06b6d4, #0284c7); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
    .fp-submit:hover { opacity: 0.9; }
    .fp-submit:disabled { opacity: 0.4; cursor: not-allowed; }
    .fp-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 0 20px; }
    .fp-list { padding: 12px 20px; }
    .fp-empty { color: #64748b; font-size: 13px; text-align: center; padding: 20px 0; }

    /* Feedback items */
    .fp-item { padding: 12px; margin-bottom: 8px; border-radius: 8px; background: #1e293b; border: 1px solid rgba(255,255,255,0.06); }
    .fp-item-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
    .fp-item-type { font-size: 11px; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
    .fp-type-suggestion { background: rgba(6,182,212,0.15); color: #06b6d4; }
    .fp-type-bug { background: rgba(239,68,68,0.15); color: #ef4444; }
    .fp-type-question { background: rgba(168,85,247,0.15); color: #a78bfa; }
    .fp-item-priority-high { border-left: 3px solid #ef4444; }
    .fp-item-author { font-size: 12px; font-weight: 600; color: #cbd5e1; }
    .fp-item-time { font-size: 11px; color: #64748b; margin-left: auto; }
    .fp-item-content { font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 6px; }
    .fp-item-screenshots { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 6px; padding: 2px 0; }
    .fp-item-screenshot { width: 100%; max-width: 160px; border-radius: 6px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
    .fp-item-screenshots:has(:only-child) .fp-item-screenshot { max-width: 100%; }
    .fp-item-screenshot:hover { border-color: #06b6d4; }
    .fp-item-section { font-size: 11px; color: #64748b; background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 3px; }
    .fp-item-status { display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: 600; }
    .fp-status-open { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .fp-status-in_progress { background: rgba(59,130,246,0.15); color: #3b82f6; }
    .fp-status-resolved { background: rgba(34,197,94,0.15); color: #22c55e; }
    .fp-status-wontfix { background: rgba(107,114,128,0.15); color: #6b7280; }
    .fp-item-actions { display: flex; gap: 6px; margin-top: 8px; }
    .fp-item-actions button { font-size: 11px; padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: none; color: #94a3b8; cursor: pointer; }
    .fp-item-actions button:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
    .fp-vote-active { color: #06b6d4 !important; border-color: #06b6d4 !important; }

    /* Screenshot preview modal */
    #screenshot-modal { display: none; position: fixed; inset: 0; z-index: 30000; background: rgba(0,0,0,0.85); align-items: center; justify-content: center; cursor: zoom-out; }
    #screenshot-modal.open { display: flex; }
    #screenshot-modal img { max-width: 95vw; max-height: 95vh; border-radius: 8px; }

    /* ═══ Override original page navs/headers ═══ */
    /* wireframes.html: push its fixed .top-nav below our nav, after sidebar */
    body > .top-nav:not(#dr-topnav) {
      top: ${NAV_H}px !important;
      left: ${SIDEBAR_W}px !important;
      z-index: 999 !important;
    }
    /* wireframes.html: push .main down to account for the double nav */
    body > .main {
      margin-top: ${NAV_H + 52 + 16}px !important;
    }
    .screen-section {
      scroll-margin-top: ${NAV_H + 52 + 16}px !important;
    }
    /* user-flows.html: adjust sticky tab-nav */
    .tab-nav {
      z-index: 99 !important;
    }
    /* diagram-viewer.html: fix body height/overflow issues */
    body {
      height: auto !important;
      min-height: calc(100vh - ${NAV_H}px) !important;
      overflow: visible !important;
    }
  `;

  // ══════════════════════════════════
  // 6. INJECT
  // ══════════════════════════════════
  document.head.appendChild(style);
  document.body.prepend(topNav);
  topNav.after(sidebar);
  document.body.appendChild(panel);
  document.body.appendChild(captureOverlay);
  document.body.appendChild(toggle);
  document.body.appendChild(mobOverlay);

  // Screenshot preview modal
  const ssModal = document.createElement("div");
  ssModal.id = "screenshot-modal";
  ssModal.innerHTML = '<img id="screenshot-modal-img">';
  document.body.appendChild(ssModal);
  ssModal.addEventListener("click", () => ssModal.classList.remove("open"));

  // Floating capture bar (persistent across captures)
  const floatBar = document.createElement("div");
  floatBar.id = "capture-float-bar";
  floatBar.innerHTML = `
    <div class="cfb-thumbs" id="cfb-thumbs"></div>
    <span class="cfb-count" id="cfb-count"></span>
    <button class="cfb-btn cfb-btn-capture" id="cfb-add-more">📸 추가 캡처</button>
    <button class="cfb-btn cfb-btn-submit" id="cfb-go-submit">📤 피드백 작성</button>
    <button class="cfb-btn cfb-btn-discard" id="cfb-discard">✕ 취소</button>
  `;
  document.body.appendChild(floatBar);

  // Mobile toggle
  toggle.addEventListener("click", () => { sidebar.classList.toggle("open"); mobOverlay.classList.toggle("open"); });
  mobOverlay.addEventListener("click", () => { sidebar.classList.remove("open"); mobOverlay.classList.remove("open"); });

  // Logout
  document.getElementById("dr-logout-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("pc_user");
    window.location.href = BASE + "index.html";
  });

  // Theme toggle
  const themeBtn = document.getElementById("nav-theme-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const newTheme = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("pc-theme", newTheme);
      themeBtn.innerHTML = getThemeIcon();
    });
  }

  // data-nav click handlers — prepend BASE for navigation from docs/deliverables/
  topNav.querySelectorAll("[data-nav]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const href = el.dataset.nav;
      if (!href || href === "#") return;
      const isExternal = el.dataset.external === "true";
      // hrefs are relative to project root; prepend BASE
      const fullHref = BASE + href;
      if (isExternal) {
        window.open(fullHref, "_blank");
      } else {
        window.location.href = fullHref;
      }
    });
  });

  // ══════════════════════════════════
  // 7. SCREENSHOT CAPTURE + ANNOTATE (viewport-only, multi-screenshot)
  // ══════════════════════════════════
  let captureCanvas, captureCtx, baseImage;
  let rects = []; // drawn rectangles for current screenshot
  let drawing = false, startX, startY;
  let savedScreenshots = []; // accumulated base64 screenshots

  function openCaptureMode() {
    if (typeof html2canvas === "undefined") {
      alert("캡처 라이브러리 로딩 중입니다. 잠시 후 다시 시도하세요.");
      return;
    }

    // Hide our UI before capturing
    topNav.style.display = "none";
    sidebar.style.display = "none";
    panel.classList.remove("open");
    floatBar.classList.remove("open");

    requestAnimationFrame(() => {
      // Capture viewport only (not full page)
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      html2canvas(document.body, {
        useCORS: true,
        scale: window.devicePixelRatio || 2,
        logging: false,
        x: window.scrollX,
        y: window.scrollY,
        width: vw,
        height: vh,
        windowWidth: vw,
        windowHeight: vh,
        ignoreElements: (el) => {
          return el.id === "dr-topnav" || el.id === "dr-sidebar" || el.id === "feedback-panel"
            || el.id === "capture-overlay" || el.id === "dr-toggle" || el.id === "dr-overlay"
            || el.id === "screenshot-modal" || el.id === "capture-float-bar";
        },
      }).then(canvas => {
        topNav.style.display = "";
        sidebar.style.display = "";

        captureCanvas = document.getElementById("co-canvas");
        captureCtx = captureCanvas.getContext("2d");
        captureCanvas.width = canvas.width;
        captureCanvas.height = canvas.height;
        captureCtx.drawImage(canvas, 0, 0);
        baseImage = captureCtx.getImageData(0, 0, canvas.width, canvas.height);
        rects = [];

        if (user?.name) {
          const inp = document.getElementById("co-author");
          if (inp && !inp.value) inp.value = user.name;
        }

        renderThumbsInOverlay();
        captureOverlay.classList.add("open");
      }).catch(err => {
        console.error("캡처 실패:", err);
        topNav.style.display = "";
        sidebar.style.display = "";
        alert("화면 캡처에 실패했습니다.");
      });
    });
  }

  function closeCaptureMode() {
    captureOverlay.classList.remove("open");
    rects = [];
    // If there are saved screenshots, show floating bar
    updateFloatBar();
  }

  function discardAllCaptures() {
    savedScreenshots = [];
    closeCaptureMode();
    floatBar.classList.remove("open");
  }

  function saveCurrentScreenshot() {
    // Save annotated screenshot to the collection
    redrawCanvas();
    const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.6);
    savedScreenshots.push(dataUrl);
    rects = [];
    // Close overlay, go back to page for more captures
    captureOverlay.classList.remove("open");
    updateFloatBar();
  }

  function openSubmitMode() {
    // If currently in overlay with unsaved annotation, save it first
    if (captureOverlay.classList.contains("open")) {
      if (rects.length > 0 || !savedScreenshots.length) {
        redrawCanvas();
        const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.6);
        savedScreenshots.push(dataUrl);
        rects = [];
      }
    }
    // Show the overlay with form visible + all thumbnails
    if (!captureOverlay.classList.contains("open")) {
      // Re-open overlay in submit mode — show last screenshot as background
      if (savedScreenshots.length > 0) {
        captureCanvas = document.getElementById("co-canvas");
        captureCtx = captureCanvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
          captureCanvas.width = img.naturalWidth;
          captureCanvas.height = img.naturalHeight;
          captureCtx.drawImage(img, 0, 0);
          baseImage = captureCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
          rects = [];
        };
        img.src = savedScreenshots[savedScreenshots.length - 1];
      }
    }
    floatBar.classList.remove("open");
    renderThumbsInOverlay();
    captureOverlay.classList.add("open");

    if (user?.name) {
      const inp = document.getElementById("co-author");
      if (inp && !inp.value) inp.value = user.name;
    }
  }

  function renderThumbsInOverlay() {
    const row = document.getElementById("co-thumbs-row");
    if (!row) return;
    if (!savedScreenshots.length) { row.innerHTML = ""; return; }
    row.innerHTML = savedScreenshots.map((ss, i) =>
      `<div class="co-thumb-wrap">
        <span class="co-thumb-num">${i + 1}</span>
        <img class="co-thumb" src="${ss}" alt="캡처 ${i + 1}" data-idx="${i}">
        <button class="co-thumb-del" data-del="${i}">✕</button>
      </div>`
    ).join("") + `<span style="font-size:11px;color:#64748b;white-space:nowrap;">${savedScreenshots.length}장</span>`;

    row.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        savedScreenshots.splice(Number(btn.dataset.del), 1);
        renderThumbsInOverlay();
        updateFloatBar();
      });
    });
    row.querySelectorAll(".co-thumb").forEach(img => {
      img.addEventListener("click", () => {
        document.getElementById("screenshot-modal-img").src = img.src;
        ssModal.classList.add("open");
      });
    });
  }

  function updateFloatBar() {
    if (!savedScreenshots.length) {
      floatBar.classList.remove("open");
      return;
    }
    floatBar.classList.add("open");
    const thumbs = document.getElementById("cfb-thumbs");
    thumbs.innerHTML = savedScreenshots.slice(-3).map((ss, i) =>
      `<img class="cfb-thumb" src="${ss}" alt="">`
    ).join("");
    document.getElementById("cfb-count").textContent = `${savedScreenshots.length}장 캡처됨`;
  }

  // Drawing on canvas
  function getCanvasCoords(e) {
    const c = captureCanvas;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function redrawCanvas() {
    captureCtx.putImageData(baseImage, 0, 0);
    rects.forEach((r, i) => {
      captureCtx.strokeStyle = "#ef4444";
      captureCtx.lineWidth = 3;
      captureCtx.setLineDash([]);
      captureCtx.strokeRect(r.x, r.y, r.w, r.h);
      captureCtx.fillStyle = "#ef4444";
      captureCtx.font = "bold 18px sans-serif";
      captureCtx.fillText(String(i + 1), r.x + 4, r.y + 18);
    });
  }

  captureOverlay.addEventListener("mousedown", (e) => {
    if (e.target !== captureCanvas) return;
    drawing = true;
    const { x, y } = getCanvasCoords(e);
    startX = x; startY = y;
  });
  captureOverlay.addEventListener("mousemove", (e) => {
    if (!drawing || e.target.closest(".co-form-bar") || e.target.closest(".co-toolbar")) return;
    const { x, y } = getCanvasCoords(e);
    redrawCanvas();
    captureCtx.strokeStyle = "rgba(239,68,68,0.7)";
    captureCtx.lineWidth = 2;
    captureCtx.setLineDash([6, 3]);
    captureCtx.strokeRect(startX, startY, x - startX, y - startY);
  });
  captureOverlay.addEventListener("mouseup", (e) => {
    if (!drawing) return;
    drawing = false;
    const { x, y } = getCanvasCoords(e);
    const w = x - startX, h = y - startY;
    if (Math.abs(w) > 10 && Math.abs(h) > 10) {
      rects.push({ x: Math.min(startX, x), y: Math.min(startY, y), w: Math.abs(w), h: Math.abs(h) });
    }
    redrawCanvas();
  });

  document.getElementById("co-undo")?.addEventListener("click", () => {
    rects.pop();
    redrawCanvas();
  });
  document.getElementById("co-save-more")?.addEventListener("click", saveCurrentScreenshot);
  document.getElementById("co-cancel")?.addEventListener("click", discardAllCaptures);

  // Floating bar buttons
  document.getElementById("cfb-add-more")?.addEventListener("click", openCaptureMode);
  document.getElementById("cfb-go-submit")?.addEventListener("click", openSubmitMode);
  document.getElementById("cfb-discard")?.addEventListener("click", discardAllCaptures);

  // ══════════════════════════════════
  // 8. SIDEBAR BUTTONS
  // ══════════════════════════════════
  if (!isFeedbackPage) {
    document.getElementById("open-feedback-panel")?.addEventListener("click", openCaptureMode);
    document.getElementById("open-text-feedback")?.addEventListener("click", () => {
      panel.classList.add("open");
      document.getElementById("fp-form").style.display = "flex";
      if (user?.name) {
        const inp = document.getElementById("fp-author");
        if (inp && !inp.value) inp.value = user.name;
      }
    });
  }
  document.getElementById("close-feedback-panel")?.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  // ══════════════════════════════════
  // 9. FIRESTORE
  // ══════════════════════════════════
  let _addFeedback, _pageInfo;

  loadFeedbackModule();

  async function loadFeedbackModule() {
    try {
      const mod = await import("./feedback-system.js");
      const { subscribeFeedbacks, addFeedback, voteFeedback, unvoteFeedback, updateFeedbackStatus, getPageInfo, getCurrentUser, timeAgo } = mod;
      _addFeedback = addFeedback;
      _pageInfo = getPageInfo();

      if (!_pageInfo && !isFeedbackPage) return;

      if (_pageInfo) {
        subscribeFeedbacks(_pageInfo.id, (items) => {
          renderFeedbackList(items, { getCurrentUser, timeAgo, voteFeedback, unvoteFeedback, updateFeedbackStatus });
          updateSidebarSummary(items);
          updateNavBadge(currentFile, items.filter(i => i.status === "open").length);
        });
      }

      // Text-mode submit
      document.getElementById("fp-submit-btn")?.addEventListener("click", async function () {
        const author = document.getElementById("fp-author").value.trim();
        const content = document.getElementById("fp-content").value.trim();
        if (!author || !content) { alert("이름과 내용을 입력하세요"); return; }
        this.disabled = true; this.textContent = "등록 중...";
        try {
          await addFeedback({ pageId: _pageInfo.id, pageName: _pageInfo.name, content, section: document.getElementById("fp-section")?.value.trim() || "", type: document.getElementById("fp-type").value, priority: document.getElementById("fp-priority").value, authorName: author, authorEmail: "" });
          document.getElementById("fp-content").value = "";
          document.getElementById("fp-section").value = "";
        } catch (e) { alert("등록 실패: " + e.message); }
        this.disabled = false; this.textContent = "등록";
      });

      // Screenshot-mode submit (multi-screenshot)
      document.getElementById("co-submit")?.addEventListener("click", async function () {
        const author = document.getElementById("co-author").value.trim();
        const content = document.getElementById("co-content").value.trim();
        if (!author || !content) { alert("이름과 피드백 내용을 입력하세요"); return; }
        if (!_pageInfo) return;

        this.disabled = true; this.textContent = "등록 중...";
        try {
          // If current canvas has annotations, save it too
          let allScreenshots = [...savedScreenshots];
          if (rects.length > 0 || allScreenshots.length === 0) {
            redrawCanvas();
            const currentCapture = captureCanvas.toDataURL("image/jpeg", 0.6);
            allScreenshots.push(currentCapture);
          }

          await addFeedback({
            pageId: _pageInfo.id,
            pageName: _pageInfo.name,
            content,
            section: "",
            type: document.getElementById("co-type").value,
            priority: document.getElementById("co-priority").value,
            authorName: author,
            authorEmail: "",
            screenshots: allScreenshots,
          });

          document.getElementById("co-content").value = "";
          savedScreenshots = [];
          rects = [];
          closeCaptureMode();
          floatBar.classList.remove("open");
        } catch (e) {
          console.error("피드백 등록 오류:", e);
          alert("등록 실패: " + e.message);
        }
        this.disabled = false; this.textContent = "📤 피드백 등록";
      });

    } catch (e) {
      console.warn("피드백 모듈 로드 실패:", e);
    }
  }

  function renderFeedbackList(items, { getCurrentUser, timeAgo, voteFeedback, unvoteFeedback, updateFeedbackStatus }) {
    const list = document.getElementById("fp-list");
    if (!list) return;
    if (!items.length) { list.innerHTML = '<div class="fp-empty">첫 번째 피드백을 남겨주세요!</div>'; return; }

    const u = getCurrentUser();
    const uName = u?.name || "";

    list.innerHTML = items.map(item => {
      const tl = { suggestion: "💡 제안", bug: "🐛 문제", question: "❓ 질문" }[item.type] || "💡 제안";
      const sl = { open: "미해결", in_progress: "진행중", resolved: "해결", wontfix: "보류" }[item.status] || "미해결";
      const voted = (item.votedBy || []).includes(uName);
      // Support both single screenshot (legacy) and screenshots array
      const ssArr = (item.screenshots && item.screenshots.length > 0)
        ? item.screenshots
        : (item.screenshot && item.screenshot.length > 100 ? [item.screenshot] : []);
      return `<div class="fp-item ${item.priority === "high" ? "fp-item-priority-high" : ""}">
        <div class="fp-item-header">
          <span class="fp-item-type fp-type-${item.type || "suggestion"}">${tl}</span>
          <span class="fp-item-author">${esc(item.author?.name || "익명")}</span>
          <span class="fp-item-time">${timeAgo(item.createdAt)}</span>
        </div>
        ${ssArr.length > 0 ? `<div class="fp-item-screenshots">${ssArr.map((ss, i) =>
          `<img class="fp-item-screenshot" src="${ss}" data-full="${ss}" alt="캡처 ${i + 1}">`
        ).join("")}</div>` : ""}
        <div class="fp-item-content">${esc(item.content)}</div>
        <div class="fp-item-header">
          <span class="fp-item-status fp-status-${item.status}">${sl}</span>
          ${item.resolution ? `<span style="font-size:11px;color:#64748b">→ ${esc(item.resolution)}</span>` : ""}
        </div>
        <div class="fp-item-actions">
          <button class="${voted ? "fp-vote-active" : ""}" data-vote="${item.id}">👍 ${item.votes || 0}</button>
          ${uName && (item.status === "open" || item.status === "in_progress") ? `<button data-resolve="${item.id}">✅ 처리</button>` : ""}
          ${uName && (item.status === "resolved" || item.status === "wontfix") ? `<button data-reopen="${item.id}" style="color:var(--warning-500);">↩ 되돌리기</button>` : ""}
        </div>
      </div>`;
    }).join("");

    // Screenshot click → full preview
    list.querySelectorAll(".fp-item-screenshot").forEach(img => {
      img.addEventListener("click", () => {
        document.getElementById("screenshot-modal-img").src = img.dataset.full;
        ssModal.classList.add("open");
      });
    });

    list.querySelectorAll("[data-vote]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!uName) { alert("로그인 후 투표 가능"); return; }
        const it = items.find(i => i.id === btn.dataset.vote);
        if ((it?.votedBy || []).includes(uName)) await unvoteFeedback(btn.dataset.vote, uName);
        else await voteFeedback(btn.dataset.vote, uName);
      });
    });
    list.querySelectorAll("[data-resolve]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const r = prompt("처리 내용:");
        if (r === null) return;
        await updateFeedbackStatus(btn.dataset.resolve, "resolved", r, uName);
      });
    });
    list.querySelectorAll("[data-reopen]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("이 피드백을 미해결 상태로 되돌리시겠습니까?")) return;
        await updateFeedbackStatus(btn.dataset.reopen, "open", "", uName);
      });
    });
  }

  function updateSidebarSummary(items) {
    if (isFeedbackPage) return;
    const t = items.length, o = items.filter(i => i.status === "open" || i.status === "in_progress").length;
    const ce = document.querySelector(".fb-count"), oe = document.querySelector(".fb-open");
    if (ce) ce.textContent = t;
    if (oe) oe.textContent = o;
  }

  function updateNavBadge(file, count) {
    const b = document.querySelector(`[data-page-badge="${file}"]`);
    if (b) { b.style.display = count > 0 ? "inline" : "none"; b.textContent = count; }
  }

  function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
})();
