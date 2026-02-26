// ═══════════════════════════════════════════════════════════════════════════════
// Shared Components — Nav, Spinner, Badges, etc.
// ═══════════════════════════════════════════════════════════════════════════════

import { getUser, logout } from "./auth.js";
import { subscribeNotifications, markNotificationRead } from "./firestore-service.js";
import { getRoleName, timeAgo, escapeHtml } from "./utils.js";

// ─── Theme Management ────────────────────────────────────────────────────────

function getTheme() {
  return localStorage.getItem("pc-theme") || "light";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pc-theme", theme);
}

function toggleTheme() {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
  // Update toggle button icon
  const btn = document.getElementById("nav-theme-btn");
  if (btn) btn.innerHTML = getThemeIcon();
}

function getThemeIcon() {
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
    href: "dashboard.html",
    label: "대시보드",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z"/></svg>`,
  },
  {
    href: "projects.html",
    label: "프로젝트",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>`,
  },
  {
    href: "customers.html",
    label: "고객",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8zm10 10v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75"/></svg>`,
  },
  {
    href: "sales.html",
    label: "영업 준비",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
  },
  {
    href: "reports.html",
    label: "보고서",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
  },
  {
    href: "admin-checklists.html",
    label: "체크리스트",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
  },
  {
    href: "activity.html",
    label: "활동 로그",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  },
  {
    href: "manual.html",
    label: "매뉴얼",
    icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
  },
];

const ADMIN_USER_LINK = {
  href: "admin-users.html",
  label: "사용자 관리",
  icon: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
};

function getNavLinks(userRole) {
  const links = [...BASE_NAV_LINKS];
  if (userRole === "observer") {
    // Insert before 매뉴얼 (last item)
    links.splice(links.length - 1, 0, ADMIN_USER_LINK);
  }
  return links;
}

export function renderNav(container) {
  const user = getUser();
  if (!user) return;

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const NAV_LINKS = getNavLinks(user.role);

  container.innerHTML = `
    <nav class="nav">
      <div class="nav-inner">
        <div class="flex items-center gap-8">
          <button class="nav-logo" data-nav="dashboard.html">
            <div class="nav-logo-icon"><span>PC</span></div>
            <span class="nav-logo-text">Process<span class="accent">Check</span></span>
          </button>
          <div class="nav-links">
            ${NAV_LINKS.map(link => {
              const isActive = currentPage === link.href;
              return `<button class="nav-link${isActive ? " active" : ""}" data-nav="${link.href}">
                ${link.icon}${link.label}
              </button>`;
            }).join("")}
          </div>
        </div>
        <div class="nav-right">
          <button class="nav-theme-toggle" id="nav-theme-btn" title="테마 전환">
            ${getThemeIcon()}
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
        ${NAV_LINKS.map(link => {
          const isActive = currentPage === link.href;
          return `<button class="nav-mobile-link${isActive ? " active" : ""}" data-nav="${link.href}">
            ${link.icon}${link.label}
          </button>`;
        }).join("")}
      </div>
    </nav>
    <div id="notif-panel-root"></div>
  `;

  // Bind navigation
  container.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      window.location.href = btn.dataset.nav;
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

  // Return unsubscribe for cleanup
  return unsub;
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
