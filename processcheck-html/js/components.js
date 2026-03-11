// ═══════════════════════════════════════════════════════════════════════════════
// Shared Components — Nav, Spinner, Badges, etc.
// ═══════════════════════════════════════════════════════════════════════════════

import { getUser, logout, startSessionWatcher } from "./auth.js";
import { subscribeNotifications, markNotificationRead } from "./firestore-service.js";
import { getRoleName, timeAgo, escapeHtml } from "./utils.js";
import { ReviewPanel } from "./review-system.js";

// ─── Theme Management ────────────────────────────────────────────────────────

export function getTheme() {
  return localStorage.getItem("pc-theme") || "light";
}

export function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pc-theme", theme);
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
  // Update toggle button icon
  const btn = document.getElementById("nav-theme-btn");
  if (btn) btn.innerHTML = getThemeIcon();
}

export function getThemeIcon() {
  const isDark = getTheme() === "dark";
  if (isDark) {
    // Sun icon — click to switch to light
    return `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><path stroke-linecap="round" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  }
  // Moon icon — click to switch to dark
  return `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>`;
}

// Apply saved theme on load (before render to avoid flash)
export function initTheme() {
  const saved = getTheme();
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  // Light is default, no attribute needed (but set it explicitly for clarity)
  if (saved === "light") {
    document.documentElement.removeAttribute("data-theme");
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────

const BASE_NAV_LINKS = [
  {
    href: "projects.html?type=신규개발",
    label: "출시위원회",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
  },
  {
    href: "projects.html?type=설계변경",
    label: "설계변경",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
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
      { href: "docs/deliverables/feedback.html", label: "피드백 모아보기" },
      { href: "manual.html", label: "매뉴얼" },
    ],
  },
  {
    href: "#",
    label: "다른 사이트",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>`,
    isSeparated: true,
    children: [
      { href: "sales.html", label: "영업 출시 준비", external: true },
      { href: "customers.html", label: "고객 관리", external: true },
    ],
  },
];

const ADMIN_USER_LINK = {
  href: "admin-users.html",
  label: "사용자 관리",
  icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
};

function getNavLinks(userRole) {
  const links = JSON.parse(JSON.stringify(BASE_NAV_LINKS));
  // Add 사용자 관리 to 리뷰 dropdown for observer
  if (userRole === "observer") {
    const reviewMenu = links.find((l) => l.label === "리뷰");
    if (reviewMenu && reviewMenu.children) {
      reviewMenu.children.push({ href: "admin-users.html", label: "사용자 관리" });
    }
  }
  return links;
}

export function renderNav(container) {
  const user = getUser();
  if (!user) return;

  const currentPath = window.location.pathname;
  const currentPage = currentPath.split("/").pop() || "index.html";
  const NAV_LINKS = getNavLinks(user.role);

  const currentSearch = window.location.search;

  function isLinkActive(link) {
    if (link.children) {
      return link.children.some(c => currentPath.endsWith(c.href));
    }
    // Handle links with query params (e.g., "projects.html?type=신규개발")
    if (link.href && link.href.includes("?")) {
      const [linkFile, linkQuery] = link.href.split("?");
      return currentPage === linkFile && currentSearch.includes(linkQuery);
    }
    return currentPage === link.href;
  }

  container.innerHTML = `
    <nav class="nav">
      <div class="nav-inner">
        <div class="flex items-center gap-8">
          <button class="nav-logo" data-nav="home.html">
            <div class="nav-logo-icon"><span>PC</span></div>
            <span class="nav-logo-text">Process<span class="accent">Check</span></span>
          </button>
          <div class="nav-links">
            ${NAV_LINKS.map(link => {
              const isActive = isLinkActive(link);
              const sep = link.isSeparated ? '<span class="nav-separator"></span>' : '';
              if (link.children) {
                return `${sep}<div class="nav-dropdown">
                  <button class="nav-link${isActive ? " active" : ""}${link.isSeparated ? " nav-link-secondary" : ""}" data-nav="${link.href}">
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
          <button class="nav-review-btn" id="nav-review-btn" title="리뷰">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
            </svg>
            <span class="nav-review-dot hidden" id="nav-review-dot"></span>
          </button>
          <button class="nav-bell" id="nav-bell-btn">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            <span class="nav-bell-dot hidden" id="nav-bell-dot"></span>
          </button>
          <div class="nav-user">
            <div class="nav-user-info">
              <div class="nav-user-name">${escapeHtml(user.name)}</div>
              <div class="nav-user-role">${getRoleName(user.role)}</div>
            </div>
            <button class="nav-logout" id="nav-logout-btn" title="로그아웃">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
          <button class="nav-hamburger" id="nav-hamburger-btn">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="nav-mobile-menu" id="nav-mobile-menu">
        ${NAV_LINKS.flatMap(link => {
          if (link.children) {
            return link.children.map(child => {
              const isActive = currentPage === child.href;
              return `<button class="nav-mobile-link${isActive ? " active" : ""}" data-nav="${child.href}"${child.external ? ' data-external="true"' : ''}>
                ${link.icon}${child.label}${child.external ? ' ↗' : ''}
              </button>`;
            });
          }
          const isActive = currentPage === link.href;
          return [`<button class="nav-mobile-link${isActive ? " active" : ""}" data-nav="${link.href}">
            ${link.icon}${link.label}
          </button>`];
        }).join("")}
      </div>
    </nav>
    <div id="notif-panel-root"></div>
    <div id="review-panel-root"></div>
  `;

  // Bind navigation
  container.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const href = btn.dataset.nav;
      if (href === "#") return; // dropdown parent, no action
      if (btn.dataset.external === "true") {
        window.open(href, "_blank");
      } else {
        window.location.href = href;
      }
    });
  });

  // Logout
  container.querySelector("#nav-logout-btn").addEventListener("click", logout);

  // Theme toggle
  container.querySelector("#nav-theme-btn").addEventListener("click", toggleTheme);

  // Mobile hamburger
  const hamburger = container.querySelector("#nav-hamburger-btn");
  const mobileMenu = container.querySelector("#nav-mobile-menu");
  hamburger.addEventListener("click", () => {
    mobileMenu.classList.toggle("open");
    const isOpen = mobileMenu.classList.contains("open");
    hamburger.innerHTML = isOpen
      ? `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>`
      : `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/></svg>`;
  });

  // Notification subscription
  let notifPanelOpen = false;
  let notifications = [];
  const bellBtn = container.querySelector("#nav-bell-btn");
  const bellDot = container.querySelector("#nav-bell-dot");
  const notifRoot = container.querySelector("#notif-panel-root");

  const unsub = subscribeNotifications(user.id, (notifs) => {
    notifications = notifs;
    const unreadCount = notifs.filter(n => !n.read).length;
    bellDot.classList.toggle("hidden", unreadCount === 0);
    if (notifPanelOpen) renderNotifPanel();
  });

  function renderNotifPanel() {
    if (!notifPanelOpen) {
      notifRoot.innerHTML = "";
      return;
    }
    notifRoot.innerHTML = `
      <div class="notif-panel">
        <div class="notif-panel-header">
          <span class="notif-panel-title">알림</span>
          <span class="text-xs text-soft">${notifications.filter(n => !n.read).length}개 읽지 않음</span>
        </div>
        <div class="notif-panel-body">
          ${notifications.length === 0
            ? `<div class="empty-state" style="padding:2rem"><span class="empty-state-text">알림이 없습니다</span></div>`
            : notifications.map(n => `
              <div class="notif-item${n.read ? "" : " unread"}" data-notif-id="${n.id}" data-notif-link="${n.link || ""}">
                <div class="notif-item-title">${escapeHtml(n.title)}</div>
                <div class="notif-item-message">${escapeHtml(n.message)}</div>
                <div class="notif-item-time">${timeAgo(n.createdAt)}</div>
              </div>
            `).join("")}
        </div>
        <div class="notif-panel-footer">
          <a href="notifications.html" class="notif-panel-view-all">전체 알림 보기</a>
        </div>
      </div>
    `;

    notifRoot.querySelectorAll("[data-notif-id]").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.notifId;
        markNotificationRead(id);
        // link navigation could be added here
      });
    });
  }

  bellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notifPanelOpen = !notifPanelOpen;
    renderNotifPanel();
  });

  document.addEventListener("click", (e) => {
    if (notifPanelOpen && !notifRoot.contains(e.target) && e.target !== bellBtn) {
      notifPanelOpen = false;
      renderNotifPanel();
    }
  });

  // ─── Review Panel ──────────────────────────────────────────────────────────
  const reviewBtn = container.querySelector("#nav-review-btn");
  const reviewRoot = container.querySelector("#review-panel-root");
  const reviewDot = container.querySelector("#nav-review-dot");
  const reviewPanel = new ReviewPanel(reviewRoot);
  reviewPanel.init();

  // Show dot when there are open reviews
  const reviewUnsub = reviewPanel.unsubscribe;
  // The panel auto-updates via its internal subscription; update the dot badge
  const origRender = reviewPanel.render.bind(reviewPanel);
  const origPanelInit = reviewPanel.init.bind(reviewPanel);
  // Patch: track open count for dot
  const _origSub = reviewPanel.unsubscribe;
  reviewPanel.destroy();
  reviewPanel.unsubscribe = null;
  // Re-init with dot callback
  import("./review-system.js").then(({ subscribeReviews }) => {
    const pageId = (window.location.pathname.split("/").pop() || "index.html").replace(".html", "");
    reviewPanel.unsubscribe = subscribeReviews(pageId, (reviews) => {
      reviewPanel.reviews = reviews;
      const openCount = reviews.filter(r => r.status === "open").length;
      reviewDot.classList.toggle("hidden", openCount === 0);
      if (reviewPanel.isOpen) reviewPanel.render();
    });
  });

  reviewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    // Close notif panel if open
    if (notifPanelOpen) {
      notifPanelOpen = false;
      renderNotifPanel();
    }
    reviewPanel.toggle();
  });

  // ─── Global Feedback Widget ─────────────────────────────────────────────────
  import("./feedback-widget.js").then(m => m.initFeedbackWidget()).catch(() => {});

  // Start session watcher — auto-logout after 24h of inactivity
  startSessionWatcher();

  // Return unsubscribe for cleanup
  return () => {
    unsub();
    reviewPanel.destroy();
  };
}

// ─── Home Nav (minimal — logo + user + logout only) ─────────────────────────

export function renderHomeNav(container) {
  const user = getUser();
  if (!user) return;

  container.innerHTML = `
    <nav class="nav">
      <div class="nav-inner">
        <div class="flex items-center gap-8">
          <div class="nav-logo">
            <div class="nav-logo-icon"><span>PC</span></div>
            <span class="nav-logo-text">Process<span class="accent">Check</span></span>
          </div>
        </div>
        <div class="nav-right">
          <button class="nav-theme-toggle" id="nav-theme-btn" title="테마 전환">
            ${getThemeIcon()}
          </button>
          <div class="nav-user">
            <div class="nav-user-info">
              <div class="nav-user-name">${escapeHtml(user.name)}</div>
              <div class="nav-user-role">${getRoleName(user.role)}</div>
            </div>
            <button class="nav-logout" id="nav-logout-btn" title="로그아웃">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;

  container.querySelector("#nav-logout-btn").addEventListener("click", logout);
  container.querySelector("#nav-theme-btn").addEventListener("click", toggleTheme);

  // Global Feedback Widget
  import("./feedback-widget.js").then(m => m.initFeedbackWidget()).catch(() => {});
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function renderSpinner(message = "로딩 중...") {
  return `
    <div class="spinner-overlay">
      <div class="spinner"></div>
      <div class="spinner-text">${escapeHtml(message)}</div>
    </div>
  `;
}

// ─── Badge Helper ────────────────────────────────────────────────────────────

export function renderBadge(text, variant = "neutral") {
  return `<span class="badge badge-${variant}">${escapeHtml(text)}</span>`;
}

// ─── Navigate Helper ─────────────────────────────────────────────────────────

export function navigate(page, params = {}) {
  const qs = new URLSearchParams(params).toString();
  window.location.href = qs ? `${page}?${qs}` : page;
}

// ─── Import Map HTML Block ───────────────────────────────────────────────────
// Use this in each HTML file's <head>:
// <script type="importmap">
// {
//   "imports": {
//     "firebase/app": "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js",
//     "firebase/firestore": "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js"
//   }
// }
// </script>
