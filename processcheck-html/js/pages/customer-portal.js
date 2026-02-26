// =============================================================================
// Customer Portal — email-based auth, project progress, notifications, change requests
// =============================================================================

import { db } from "../firebase-init.js";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import {
  subscribeCustomers,
  subscribeProjects,
  subscribePortalNotifications,
  markPortalNotificationRead,
  subscribeAllChangeRequests,
} from "../firestore-service.js";
import {
  escapeHtml,
  formatDate,
  PHASE_GROUPS,
  getStatusLabel,
  getStatusBadgeClass,
  timeAgo,
} from "../utils.js";
import { initTheme } from "../components.js";
initTheme();

// --- DOM ---
const app = document.getElementById("app");

// --- State ---
let currentCustomer = null;
let allCustomers = [];
let portalProjects = [];
let allProjects = [];
let notifications = [];
let changeRequests = [];
let activeView = "projects"; // "projects" | "notifications" | "changes"
let showNewRequestModal = false;
let loginError = "";
const unsubs = [];

// --- Session check ---
const SESSION_KEY = "pc_portal_customer";
const saved = sessionStorage.getItem(SESSION_KEY);
if (saved) {
  try {
    currentCustomer = JSON.parse(saved);
    loadPortalData();
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

// Always subscribe to customers for login lookup
unsubs.push(
  subscribeCustomers((list) => {
    allCustomers = list;
    if (!currentCustomer) render();
  })
);

// --- Cleanup ---
window.addEventListener("beforeunload", () => {
  unsubs.forEach((fn) => fn && fn());
});

// =============================================================================
// Data loading
// =============================================================================

function loadPortalData() {
  unsubs.push(
    subscribeProjects((projects) => {
      allProjects = projects;
      portalProjects = projects.filter(
        (p) => currentCustomer.products && currentCustomer.products.includes(p.id)
      );
      render();
    })
  );

  unsubs.push(
    subscribePortalNotifications(currentCustomer.id, (notifs) => {
      notifications = notifs;
      render();
    })
  );

  unsubs.push(
    subscribeAllChangeRequests((reqs) => {
      changeRequests = reqs.filter(
        (r) =>
          r.customerId === currentCustomer.id ||
          (r.requestSource === "customer" &&
            currentCustomer.products &&
            currentCustomer.products.includes(r.projectId))
      );
      render();
    })
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getProjectStatusLabel(status) {
  switch (status) {
    case "active": return "진행 중";
    case "completed": return "완료";
    case "on_hold": return "보류";
    default: return status;
  }
}

function getProjectStatusBadge(status) {
  switch (status) {
    case "active": return "badge-primary";
    case "completed": return "badge-success";
    case "on_hold": return "badge-warning";
    default: return "badge-neutral";
  }
}

function getChangeStatusLabel(status) {
  switch (status) {
    case "in_review": return "검토 중";
    case "approved": return "승인";
    case "rejected": return "반려";
    default: return status;
  }
}

function getChangeStatusBadge(status) {
  switch (status) {
    case "in_review": return "badge-warning";
    case "approved": return "badge-success";
    case "rejected": return "badge-danger";
    default: return "badge-neutral";
  }
}

function getPhaseStatus(project, phaseIndex) {
  const currentIdx = PHASE_GROUPS.findIndex(
    (p) => p.workStage === project.currentStage || p.gateStage === project.currentStage
  );
  if (phaseIndex < currentIdx) return "completed";
  if (phaseIndex === currentIdx) return "current";
  return "future";
}

// =============================================================================
// Render
// =============================================================================

function render() {
  if (!currentCustomer) {
    renderLogin();
  } else {
    renderPortal();
  }
  bindEvents();
}

function renderLogin() {
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;padding:2rem">
      <div class="card p-8" style="max-width:400px;width:100%;text-align:center">
        <div style="margin-bottom:1.5rem">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,var(--primary-500),var(--primary-700));margin-bottom:1rem">
            <span style="color:white;font-weight:800;font-size:1.25rem">PC</span>
          </div>
          <h1 class="text-2xl font-bold" style="color:var(--slate-100)">고객 포털</h1>
          <p class="text-sm text-dim" style="margin-top:0.5rem">등록된 이메일로 로그인하세요</p>
        </div>
        ${loginError ? `<div style="padding:0.75rem;margin-bottom:1rem;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-lg);color:var(--danger-400);font-size:0.875rem">${escapeHtml(loginError)}</div>` : ""}
        <input type="email" class="input-field" id="portal-email" placeholder="포털 이메일 주소" style="margin-bottom:1rem;text-align:center">
        <button class="btn-primary" id="portal-login-btn" style="width:100%">로그인</button>
      </div>
    </div>
  `;
}

function renderPortal() {
  const unreadCount = notifications.filter((n) => !n.read).length;

  app.innerHTML = `
    <div class="container animate-fade-in" style="max-width:900px">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6" style="padding-top:1.5rem">
        <div class="flex items-center gap-3">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,var(--primary-500),var(--primary-700))">
            <span style="color:white;font-weight:800;font-size:0.875rem">PC</span>
          </div>
          <div>
            <h1 class="text-lg font-bold" style="color:var(--slate-100)">${escapeHtml(currentCustomer.name)}</h1>
            <span class="text-xs text-dim">${escapeHtml(currentCustomer.region || "")} · ${escapeHtml(currentCustomer.type || "")}</span>
          </div>
        </div>
        <button class="btn-ghost btn-sm" id="portal-logout-btn">로그아웃</button>
      </div>

      <!-- Tabs -->
      <div class="tab-bar mb-6">
        <button class="tab-btn${activeView === "projects" ? " active" : ""}" data-portal-tab="projects">프로젝트 현황</button>
        <button class="tab-btn${activeView === "notifications" ? " active" : ""}" data-portal-tab="notifications">
          알림 ${unreadCount > 0 ? `<span class="badge badge-danger" style="font-size:0.625rem;margin-left:0.25rem">${unreadCount}</span>` : ""}
        </button>
        <button class="tab-btn${activeView === "changes" ? " active" : ""}" data-portal-tab="changes">설계변경 요청</button>
      </div>

      <!-- Tab Content -->
      <div>
        ${activeView === "projects" ? renderProjectsView() : ""}
        ${activeView === "notifications" ? renderNotificationsView() : ""}
        ${activeView === "changes" ? renderChangesView() : ""}
      </div>

      ${showNewRequestModal ? renderNewRequestModal() : ""}
    </div>
  `;
}

function renderProjectsView() {
  if (portalProjects.length === 0) {
    return `
      <div class="card">
        <div class="empty-state" style="padding:3rem">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
          <span class="empty-state-text">연결된 프로젝트가 없습니다</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="flex flex-col gap-4">
      ${portalProjects
        .map((p) => {
          const currentPhaseIdx = PHASE_GROUPS.findIndex(
            (ph) => ph.workStage === p.currentStage || ph.gateStage === p.currentStage
          );
          return `
          <div class="card p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <h3 class="text-base font-bold" style="color:var(--slate-100)">${escapeHtml(p.name)}</h3>
                <span class="badge ${getProjectStatusBadge(p.status)}">${getProjectStatusLabel(p.status)}</span>
              </div>
              <span class="text-xs text-dim">PM: ${escapeHtml(p.pm || "-")}</span>
            </div>
            <div class="text-xs text-dim mb-3">${escapeHtml(p.productType || "")} · ${formatDate(p.startDate)} ~ ${formatDate(p.endDate)}</div>

            <!-- Phase Progress -->
            <div class="flex items-center gap-1 mb-3" style="flex-wrap:wrap">
              ${PHASE_GROUPS.map((ph, idx) => {
                const status = getPhaseStatus(p, idx);
                const bg =
                  status === "completed"
                    ? "var(--success-500)"
                    : status === "current"
                    ? "var(--primary-500)"
                    : "var(--surface-4)";
                const textColor =
                  status === "completed" || status === "current"
                    ? "white"
                    : "var(--slate-500)";
                return `
                  <div style="display:flex;align-items:center;gap:0.25rem">
                    <div style="padding:0.25rem 0.625rem;border-radius:var(--radius-lg);background:${bg};color:${textColor};font-size:0.7rem;font-weight:600;white-space:nowrap">
                      ${status === "completed" ? "✔ " : status === "current" ? "▶ " : ""}${ph.name}
                    </div>
                    ${idx < PHASE_GROUPS.length - 1 ? '<span style="color:var(--slate-600);font-size:0.7rem">→</span>' : ""}
                  </div>
                `;
              }).join("")}
            </div>

            <!-- Overall Progress -->
            <div class="flex items-center gap-3">
              <div class="progress-bar" style="flex:1;height:0.5rem">
                <div class="progress-fill" style="width:${p.progress || 0}%"></div>
              </div>
              <span class="text-sm font-semibold" style="color:var(--primary-400)">${p.progress || 0}%</span>
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
}

function renderNotificationsView() {
  if (notifications.length === 0) {
    return `
      <div class="card">
        <div class="empty-state" style="padding:3rem">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          <span class="empty-state-text">알림이 없습니다</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="flex flex-col gap-2">
      ${notifications
        .map(
          (n) => `
        <div class="card p-4 card-hover cursor-pointer" data-notif-mark="${n.id}" style="${!n.read ? "border-left:3px solid var(--primary-400)" : ""}">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-semibold" style="color:${n.read ? "var(--slate-400)" : "var(--slate-100)"}">${escapeHtml(n.title)}</span>
            <span class="text-xs text-dim">${timeAgo(n.createdAt)}</span>
          </div>
          <div class="text-xs" style="color:var(--slate-400)">${escapeHtml(n.message)}</div>
          ${!n.read ? '<div class="text-xs text-dim" style="margin-top:0.25rem">클릭하여 읽음 처리</div>' : ""}
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function renderChangesView() {
  return `
    <div class="flex items-center justify-between mb-4">
      <h3 class="section-title">설계변경 요청 (${changeRequests.length})</h3>
      <button class="btn-primary btn-sm" id="new-change-request-btn">새 요청</button>
    </div>
    ${
      changeRequests.length === 0
        ? `<div class="card"><div class="empty-state" style="padding:3rem"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg><span class="empty-state-text">설계변경 요청이 없습니다</span></div></div>`
        : `<div class="flex flex-col gap-3">${changeRequests
            .map(
              (r) => {
                const proj = allProjects.find((p) => p.id === r.projectId);
                return `
              <div class="card p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-semibold" style="color:var(--slate-100)">${escapeHtml(r.title)}</span>
                  <span class="badge ${getChangeStatusBadge(r.status)}">${getChangeStatusLabel(r.status)}</span>
                </div>
                <div class="text-xs text-dim mb-1">프로젝트: ${escapeHtml(proj ? proj.name : r.projectId)}</div>
                ${r.description ? `<div class="text-xs" style="color:var(--slate-400)">${escapeHtml(r.description)}</div>` : ""}
                <div class="text-xs text-dim" style="margin-top:0.5rem">${timeAgo(r.createdAt)}</div>
              </div>
            `;
              }
            )
            .join("")}</div>`
    }
  `;
}

function renderNewRequestModal() {
  return `
    <div class="modal-backdrop" id="cr-modal-backdrop">
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <h3 class="modal-title">새 설계변경 요청</h3>
          <button class="modal-close" id="cr-modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:1rem">
            <label class="text-xs font-semibold text-dim" style="display:block;margin-bottom:0.5rem">프로젝트</label>
            <select class="input-field" id="cr-project">
              ${portalProjects
                .map(
                  (p) =>
                    `<option value="${p.id}">${escapeHtml(p.name)}</option>`
                )
                .join("")}
            </select>
          </div>
          <div style="margin-bottom:1rem">
            <label class="text-xs font-semibold text-dim" style="display:block;margin-bottom:0.5rem">제목</label>
            <input type="text" class="input-field" id="cr-title" placeholder="변경 요청 제목">
          </div>
          <div style="margin-bottom:1rem">
            <label class="text-xs font-semibold text-dim" style="display:block;margin-bottom:0.5rem">설명</label>
            <textarea class="input-field" id="cr-desc" rows="4" placeholder="변경 내용을 상세히 설명해주세요"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" id="cr-cancel-btn">취소</button>
          <button class="btn-primary" id="cr-submit-btn">요청 제출</button>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// Event binding
// =============================================================================

function bindEvents() {
  // Login
  const loginBtn = app.querySelector("#portal-login-btn");
  const emailInput = app.querySelector("#portal-email");
  if (loginBtn) {
    const doLogin = () => {
      const email = emailInput.value.trim();
      if (!email) {
        loginError = "이메일을 입력해주세요";
        render();
        return;
      }
      const customer = allCustomers.find(
        (c) => c.portalLoginEmail === email && c.portalEnabled === true
      );
      if (!customer) {
        loginError = "등록되지 않은 이메일이거나 포털 접근이 비활성화되어 있습니다";
        render();
        return;
      }
      currentCustomer = customer;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(customer));
      loginError = "";
      loadPortalData();
      render();
    };
    loginBtn.addEventListener("click", doLogin);
    if (emailInput) {
      emailInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doLogin();
      });
    }
  }

  // Logout
  const logoutBtn = app.querySelector("#portal-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      currentCustomer = null;
      portalProjects = [];
      notifications = [];
      changeRequests = [];
      sessionStorage.removeItem(SESSION_KEY);
      render();
    });
  }

  // Tab switching
  app.querySelectorAll("[data-portal-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeView = btn.dataset.portalTab;
      render();
    });
  });

  // Notification mark as read
  app.querySelectorAll("[data-notif-mark]").forEach((el) => {
    el.addEventListener("click", () => {
      markPortalNotificationRead(el.dataset.notifMark);
    });
  });

  // New change request button
  const newCrBtn = app.querySelector("#new-change-request-btn");
  if (newCrBtn) {
    newCrBtn.addEventListener("click", () => {
      showNewRequestModal = true;
      render();
    });
  }

  // Modal close/cancel
  const modalClose = app.querySelector("#cr-modal-close");
  const modalCancel = app.querySelector("#cr-cancel-btn");
  const modalBackdrop = app.querySelector("#cr-modal-backdrop");
  [modalClose, modalCancel].forEach((el) => {
    if (el) {
      el.addEventListener("click", () => {
        showNewRequestModal = false;
        render();
      });
    }
  });
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) {
        showNewRequestModal = false;
        render();
      }
    });
  }

  // Submit change request
  const submitBtn = app.querySelector("#cr-submit-btn");
  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const projectId = app.querySelector("#cr-project")?.value;
      const title = app.querySelector("#cr-title")?.value.trim();
      const desc = app.querySelector("#cr-desc")?.value.trim();
      if (!title) {
        alert("제목을 입력해주세요");
        return;
      }
      try {
        await addDoc(collection(db, "changeRequests"), {
          projectId,
          title,
          description: desc,
          requestSource: "customer",
          customerId: currentCustomer.id,
          customerName: currentCustomer.name,
          customerContactName: currentCustomer.contactName || "",
          status: "in_review",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        showNewRequestModal = false;
        render();
      } catch (err) {
        alert("요청 제출 실패: " + err.message);
      }
    });
  }
}

// --- Initial render ---
render();
