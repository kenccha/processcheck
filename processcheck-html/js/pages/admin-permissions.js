// =============================================================================
// Permissions Settings Page — 권한 설정
// =============================================================================

import { guardPage } from "../auth.js";
import { showToast } from "../ui/toast.js";
import { renderNav, initTheme } from "../components.js";
initTheme();
import {
  subscribePermissions,
  updatePermissions,
  subscribeUsers,
} from "../firestore-service.js";
import { getRoleName } from "../utils.js";

// --- Auth guard ---
const user = guardPage();
if (!user) throw new Error("Not authenticated");

// --- DOM refs ---
const navRoot = document.getElementById("nav-root");
const app = document.getElementById("app");

// --- State ---
let permissions = null;
let users = [];

// Default permissions — all roles can do everything
const DEFAULT_PERMISSIONS = {
  gateApproval: { worker: true, manager: true, observer: true },
  taskComplete: { worker: true, manager: true, observer: true },
  taskReassign: { worker: false, manager: true, observer: true },
  checklistEdit: { worker: false, manager: true, observer: true },
  projectCreate: { worker: false, manager: true, observer: true },
  meetingNoteAdd: { worker: true, manager: true, observer: true },
};

const PERMISSION_LABELS = {
  gateApproval: { label: "위원회 승인/반려", desc: "Phase별 위원회 승인 및 반려 처리" },
  taskComplete: { label: "작업 완료 처리", desc: "체크리스트 항목을 완료로 변경" },
  taskReassign: { label: "작업 배분/재배분", desc: "체크리스트 항목의 담당자 변경" },
  checklistEdit: { label: "체크리스트 편집", desc: "템플릿 체크리스트 항목 추가/수정/삭제" },
  projectCreate: { label: "프로젝트 생성", desc: "신규 프로젝트 등록" },
  meetingNoteAdd: { label: "회의록 등록", desc: "Phase 회의록/피드백 기록" },
};

const ROLE_KEYS = ["worker", "manager", "observer"];

// --- Render nav ---
const unsubNav = renderNav(navRoot);

// --- Subscriptions ---
const unsubPerms = subscribePermissions((data) => {
  permissions = data || { ...DEFAULT_PERMISSIONS };
  render();
});

const unsubUsers = subscribeUsers((list) => {
  users = list;
  render();
});

// --- Cleanup ---
window.addEventListener("beforeunload", () => {
  if (unsubPerms) unsubPerms();
  if (unsubUsers) unsubUsers();
  if (unsubNav) unsubNav();
});

// =============================================================================
// Merge with defaults (for new permission keys added later)
// =============================================================================
function getPerms() {
  const merged = {};
  for (const key of Object.keys(DEFAULT_PERMISSIONS)) {
    merged[key] = { ...DEFAULT_PERMISSIONS[key] };
    if (permissions && permissions[key]) {
      for (const role of ROLE_KEYS) {
        if (typeof permissions[key][role] === "boolean") {
          merged[key][role] = permissions[key][role];
        }
      }
    }
  }
  return merged;
}

// =============================================================================
// Main render
// =============================================================================
function render() {
  const perms = getPerms();

  // User role summary
  const roleCounts = {};
  for (const r of ROLE_KEYS) {
    roleCounts[r] = users.filter(u => u.role === r && u.active !== false).length;
  }

  app.innerHTML = `
    <div class="container animate-fade-in" style="max-width: 900px;">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold tracking-tight" style="color: var(--slate-100);">권한 설정</h1>
          <p class="text-sm text-dim" style="margin-top: 0.25rem;">역할별 기능 접근 권한을 관리합니다</p>
        </div>
        <button class="btn-primary" id="save-perms">저장</button>
      </div>

      <!-- Role summary -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        ${ROLE_KEYS.map(r => `
          <div class="stat-card">
            <div class="stat-card-label">${getRoleName(r)}</div>
            <div class="stat-card-row"><span class="stat-value">${roleCounts[r] || 0}</span><span class="text-xs text-dim">명</span></div>
          </div>
        `).join("")}
      </div>

      <!-- Permission Matrix -->
      <div class="card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="min-width:200px">기능</th>
                ${ROLE_KEYS.map(r => `<th style="text-align:center;min-width:100px">${getRoleName(r)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${Object.keys(PERMISSION_LABELS).map(key => `
                <tr>
                  <td>
                    <div class="font-semibold text-sm" style="color:var(--slate-200)">${PERMISSION_LABELS[key].label}</div>
                    <div class="text-xs text-dim">${PERMISSION_LABELS[key].desc}</div>
                  </td>
                  ${ROLE_KEYS.map(role => `
                    <td style="text-align:center">
                      <label class="perm-toggle">
                        <input type="checkbox" data-perm="${key}" data-role="${role}" ${perms[key][role] ? "checked" : ""}>
                        <span class="perm-toggle-slider"></span>
                      </label>
                    </td>
                  `).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Reset -->
      <div class="flex justify-end mt-4 gap-3">
        <button class="btn-ghost btn-sm" id="reset-perms" style="color:var(--danger-400)">기본값으로 초기화</button>
        <button class="btn-primary" id="save-perms-bottom">저장</button>
      </div>
    </div>

    <style>
      .perm-toggle { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; }
      .perm-toggle input { opacity: 0; width: 0; height: 0; }
      .perm-toggle-slider {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: var(--slate-600); border-radius: 24px; transition: 0.2s;
      }
      .perm-toggle-slider::before {
        content: ""; position: absolute; height: 18px; width: 18px;
        left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s;
      }
      .perm-toggle input:checked + .perm-toggle-slider { background: var(--primary-400); }
      .perm-toggle input:checked + .perm-toggle-slider::before { transform: translateX(20px); }
    </style>
  `;

  bindEvents();
}

// =============================================================================
// Event binding
// =============================================================================
function bindEvents() {
  // Save buttons
  const saveHandler = async () => {
    const data = {};
    app.querySelectorAll("[data-perm]").forEach(cb => {
      const key = cb.dataset.perm;
      const role = cb.dataset.role;
      if (!data[key]) data[key] = {};
      data[key][role] = cb.checked;
    });
    try {
      await updatePermissions(data);
      showToast("success", "권한 설정이 저장되었습니다");
    } catch (err) {
      showToast("error", "저장 실패: " + err.message);
    }
  };

  app.querySelector("#save-perms")?.addEventListener("click", saveHandler);
  app.querySelector("#save-perms-bottom")?.addEventListener("click", saveHandler);

  // Reset to defaults
  app.querySelector("#reset-perms")?.addEventListener("click", async () => {
    try {
      await updatePermissions(DEFAULT_PERMISSIONS);
      showToast("success", "기본값으로 초기화되었습니다");
    } catch (err) {
      showToast("error", "초기화 실패: " + err.message);
    }
  });
}
