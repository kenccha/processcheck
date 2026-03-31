// ═══════════════════════════════════════════════════════════════════════════════
// Customers Page — 고객 (대리점/법인) 목록 + 등록/편집
// ═══════════════════════════════════════════════════════════════════════════════

import { initTheme } from "../components.js";
import { showToast } from "../ui/toast.js";
import { renderNav } from "../components.js";
import { guardPage } from "../auth.js";
import { trapFocus, releaseFocus } from "../ui/focus-trap.js";
import {
  subscribeCustomers,
  createCustomer,
  updateCustomer,
} from "../firestore-service.js";
import { CUSTOMER_TYPE_LABELS } from "../sales-service.js";
import { escapeHtml } from "../utils.js";

initTheme();

const user = guardPage();
if (!user) throw new Error("Not authenticated");
const app = document.getElementById("app");
const navRoot = document.getElementById("nav-root");

let customers = [];
let filterType = "all";
let filterStatus = "all";
let searchQuery = "";

function init() {
  renderNav(navRoot);
  subscribeCustomers((data) => {
    customers = data;
    render();
  });
}

function getFiltered() {
  return customers.filter((c) => {
    if (filterType !== "all" && c.type !== filterType) return false;
    if (filterStatus !== "all" && c.contractStatus !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.contactName || "").toLowerCase().includes(q) ||
        (c.region || "").toLowerCase().includes(q) ||
        (c.salesRep || "").toLowerCase().includes(q)
      );
    }
    return true;
  });
}

function getStatusBadge(status) {
  const map = {
    active: { label: "활성", cls: "badge-success" },
    negotiating: { label: "협상중", cls: "badge-warning" },
    inactive: { label: "비활성", cls: "badge-neutral" },
  };
  const s = map[status] || { label: status, cls: "badge-neutral" };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

function getTypeBadge(type) {
  return `<span class="badge badge-primary">${CUSTOMER_TYPE_LABELS[type] || type}</span>`;
}

function render() {
  const filtered = getFiltered();
  const stats = {
    total: customers.length,
    active: customers.filter((c) => c.contractStatus === "active").length,
    negotiating: customers.filter((c) => c.contractStatus === "negotiating").length,
    portal: customers.filter((c) => c.portalEnabled).length,
  };

  app.innerHTML = `
    <div class="container animate-fade-in">
    <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight" style="color:var(--slate-100)">고객 관리</h1>
        <p class="text-sm text-soft mt-1">대리점, 해외 법인, 병원 등 거래처 관리</p>
      </div>
      <button class="btn btn-primary" id="btn-add-customer">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        고객 등록
      </button>
    </div>

    <!-- 통계 카드 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-card-label">전체 고객</div></div>
      <div class="stat-card"><div class="stat-value text-success">${stats.active}</div><div class="stat-card-label">활성 거래처</div></div>
      <div class="stat-card"><div class="stat-value text-warning">${stats.negotiating}</div><div class="stat-card-label">협상 중</div></div>
      <div class="stat-card"><div class="stat-value text-primary">${stats.portal}</div><div class="stat-card-label">포털 활성</div></div>
    </div>

    <!-- 필터 -->
    <div class="card mb-6" style="padding: 1rem 1.25rem;">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <input type="text" class="input-field" id="search-input" placeholder="검색 (거래처명, 담당자, 지역, 영업 담당)" value="${escapeHtml(searchQuery)}" style="flex:1;min-width:200px;">
        <select class="input-field" id="filter-type" style="width:auto;">
          <option value="all">전체 유형</option>
          <option value="dealer" ${filterType === "dealer" ? "selected" : ""}>대리점</option>
          <option value="subsidiary" ${filterType === "subsidiary" ? "selected" : ""}>해외 법인</option>
          <option value="hospital" ${filterType === "hospital" ? "selected" : ""}>병원</option>
          <option value="online" ${filterType === "online" ? "selected" : ""}>온라인</option>
        </select>
        <select class="input-field" id="filter-status" style="width:auto;">
          <option value="all">전체 상태</option>
          <option value="active" ${filterStatus === "active" ? "selected" : ""}>활성</option>
          <option value="negotiating" ${filterStatus === "negotiating" ? "selected" : ""}>협상중</option>
          <option value="inactive" ${filterStatus === "inactive" ? "selected" : ""}>비활성</option>
        </select>
      </div>
    </div>

    <!-- 테이블 -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>거래처명</th>
              <th>유형</th>
              <th>지역</th>
              <th>담당자</th>
              <th>영업 담당</th>
              <th>상태</th>
              <th>포털</th>
              <th>취급 제품</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="8" style="text-align:center;padding:2rem;">고객이 없습니다</td></tr>`
              : filtered.map((c) => `
                <tr class="clickable-row" data-customer-id="${c.id}" style="cursor:pointer;">
                  <td><strong>${escapeHtml(c.name)}</strong></td>
                  <td>${getTypeBadge(c.type)}</td>
                  <td>${escapeHtml(c.region)}</td>
                  <td>${escapeHtml(c.contactName)}</td>
                  <td>${escapeHtml(c.salesRep)}</td>
                  <td>${getStatusBadge(c.contractStatus)}</td>
                  <td>${c.portalEnabled ? '<span class="badge badge-primary">ON</span>' : '<span class="badge badge-neutral">OFF</span>'}</td>
                  <td>${c.products?.length || 0}개</td>
                </tr>
              `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 고객 등록/편집 모달 -->
    <div class="modal-backdrop hidden" id="customer-modal">
      <div class="modal" style="max-width:600px;">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title">고객 등록</h3>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="modal-id">
          <div style="margin-bottom:0.75rem;">
            <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">거래처명 *</label>
            <input type="text" class="input-field" id="modal-name" required>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="margin-bottom:0.75rem;">
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">유형 *</label>
              <select class="input-field" id="modal-type">
                <option value="dealer">대리점</option>
                <option value="subsidiary">해외 법인</option>
                <option value="hospital">병원/의료기관</option>
                <option value="online">온라인 채널</option>
              </select>
            </div>
            <div style="margin-bottom:0.75rem;">
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">지역 *</label>
              <input type="text" class="input-field" id="modal-region" placeholder="예: 서울/경기, 일본">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="margin-bottom:0.75rem;">
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">담당자명 *</label>
              <input type="text" class="input-field" id="modal-contact-name">
            </div>
            <div style="margin-bottom:0.75rem;">
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">담당자 이메일</label>
              <input type="email" class="input-field" id="modal-contact-email">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="margin-bottom:0.75rem;">
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">담당자 전화</label>
              <input type="text" class="input-field" id="modal-contact-phone">
            </div>
            <div style="margin-bottom:0.75rem;">
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">영업 담당</label>
              <input type="text" class="input-field" id="modal-sales-rep">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="margin-bottom:0.75rem;">
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">계약 상태</label>
              <select class="input-field" id="modal-contract-status">
                <option value="active">활성</option>
                <option value="negotiating">협상중</option>
                <option value="inactive">비활성</option>
              </select>
            </div>
            <div style="margin-bottom:0.75rem;">
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">포털 활성화</label>
              <select class="input-field" id="modal-portal">
                <option value="false">OFF</option>
                <option value="true">ON</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom:0.75rem;">
            <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">포털 로그인 이메일</label>
            <input type="email" class="input-field" id="modal-portal-email" placeholder="포털 접속용 이메일">
          </div>
          <div style="margin-bottom:0.75rem;">
            <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem;">비고</label>
            <textarea class="input-field" id="modal-notes" rows="2" placeholder="거래처 메모"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel">취소</button>
          <button class="btn btn-primary" id="modal-save">저장</button>
        </div>
      </div>
    </div>
    </div>
  `;

  bindEvents();

  // Restore search focus after render
  if (searchQuery) {
    const input = app.querySelector("#search-input");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

function bindEvents() {
  // Search
  app.querySelector("#search-input")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    render();
  });
  app.querySelector("#filter-type").addEventListener("change", (e) => {
    filterType = e.target.value;
    render();
  });
  app.querySelector("#filter-status").addEventListener("change", (e) => {
    filterStatus = e.target.value;
    render();
  });

  // Row click → modal edit
  app.querySelectorAll(".clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.dataset.customerId;
      const c = customers.find((x) => x.id === id);
      if (c) openModal(c);
    });
  });

  // Add button
  app.querySelector("#btn-add-customer").addEventListener("click", () => openModal(null));

  // Modal
  const modal = app.querySelector("#customer-modal");
  app.querySelector("#modal-close").addEventListener("click", () => modal.classList.add("hidden"));
  app.querySelector("#modal-cancel").addEventListener("click", () => modal.classList.add("hidden"));
  app.querySelector("#modal-save").addEventListener("click", handleSave);
}

function openModal(customer) {
  const modal = app.querySelector("#customer-modal");
  const title = app.querySelector("#modal-title");

  if (customer) {
    title.textContent = "고객 편집";
    app.querySelector("#modal-id").value = customer.id;
    app.querySelector("#modal-name").value = customer.name;
    app.querySelector("#modal-type").value = customer.type;
    app.querySelector("#modal-region").value = customer.region;
    app.querySelector("#modal-contact-name").value = customer.contactName;
    app.querySelector("#modal-contact-email").value = customer.contactEmail || "";
    app.querySelector("#modal-contact-phone").value = customer.contactPhone || "";
    app.querySelector("#modal-sales-rep").value = customer.salesRep || "";
    app.querySelector("#modal-contract-status").value = customer.contractStatus;
    app.querySelector("#modal-portal").value = String(customer.portalEnabled);
    app.querySelector("#modal-portal-email").value = customer.portalLoginEmail || "";
    app.querySelector("#modal-notes").value = customer.notes || "";
  } else {
    title.textContent = "고객 등록";
    app.querySelector("#modal-id").value = "";
    app.querySelectorAll("#customer-modal input, #customer-modal textarea").forEach((el) => {
      if (el.type !== "hidden") el.value = "";
    });
    app.querySelector("#modal-type").value = "dealer";
    app.querySelector("#modal-contract-status").value = "active";
    app.querySelector("#modal-portal").value = "false";
  }

  modal.classList.remove("hidden");
  trapFocus(modal, () => { modal.classList.add("hidden"); releaseFocus(); });
}

async function handleSave() {
  const id = app.querySelector("#modal-id").value;
  const data = {
    name: app.querySelector("#modal-name").value.trim(),
    type: app.querySelector("#modal-type").value,
    region: app.querySelector("#modal-region").value.trim(),
    contactName: app.querySelector("#modal-contact-name").value.trim(),
    contactEmail: app.querySelector("#modal-contact-email").value.trim(),
    contactPhone: app.querySelector("#modal-contact-phone").value.trim(),
    salesRep: app.querySelector("#modal-sales-rep").value.trim(),
    contractStatus: app.querySelector("#modal-contract-status").value,
    portalEnabled: app.querySelector("#modal-portal").value === "true",
    portalLoginEmail: app.querySelector("#modal-portal-email").value.trim(),
    portalAccessLevel: "basic",
    notes: app.querySelector("#modal-notes").value.trim(),
    products: [],
  };

  if (!data.name || !data.region || !data.contactName) {
    showToast('warning', "거래처명, 지역, 담당자명은 필수입니다.");
    return;
  }

  try {
    if (id) {
      await updateCustomer(id, data);
    } else {
      await createCustomer(data);
    }
    app.querySelector("#customer-modal").classList.add("hidden");
  } catch (err) {
    console.error("고객 저장 실패:", err);
    showToast('error', "저장에 실패했습니다.");
  }
}

init();
