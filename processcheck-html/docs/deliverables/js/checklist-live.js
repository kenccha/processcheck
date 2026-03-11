// ═══════════════════════════════════════════════════════════════════════════════
// Checklist Live Data — Connects wireframe to Firestore templateStages/templateItems
// Dynamically replaces static wireframe data with real Firestore data
// Falls back to static content if Firebase fails
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  "use strict";

  const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/11.3.0";
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCmQ4-zOqeZKIxBIdYP71uhIdZ0eQu2rn0",
    authDomain: "processsss-appp.firebaseapp.com",
    projectId: "processsss-appp",
    storageBucket: "processsss-appp.firebasestorage.app",
    messagingSenderId: "1041230235574",
    appId: "1:1041230235574:web:de73f68d8c567ee5d96317",
  };

  // Default department display order (fallback if templateDepartments not loaded)
  const DEFAULT_DEPT_ORDER = [
    { id: "dept1", name: "개발팀" }, { id: "dept2", name: "품질팀" },
    { id: "dept3", name: "영업팀" }, { id: "dept4", name: "제조팀" },
    { id: "dept5", name: "구매팀" }, { id: "dept6", name: "CS팀" },
    { id: "dept7", name: "경영관리팀" }, { id: "dept8", name: "글로벌임상팀" },
    { id: "dept9", name: "디자인연구소" }, { id: "dept10", name: "인증팀" }
  ];

  let firebase = null;
  let db = null;
  let stages = [];
  let departments = DEFAULT_DEPT_ORDER;
  let allItems = [];
  let unsubStages = null;
  let unsubItems = null;
  let unsubDepts = null;

  // ─── Load Firebase ──────────────────────────────────────────────────────────

  async function loadFirebase() {
    const [appMod, firestoreMod] = await Promise.all([
      import(`${FIREBASE_CDN}/firebase-app.js`),
      import(`${FIREBASE_CDN}/firebase-firestore.js`)
    ]);
    const app = appMod.getApps().length === 0
      ? appMod.initializeApp(FIREBASE_CONFIG)
      : appMod.getApp();
    db = firestoreMod.getFirestore(app);
    firebase = { firestore: firestoreMod };
  }

  // ─── Subscribe ──────────────────────────────────────────────────────────────

  function subscribeData() {
    const { collection, onSnapshot } = firebase.firestore;

    // Subscribe to departments
    unsubDepts = onSnapshot(collection(db, "templateDepartments"), (snap) => {
      const deps = snap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (deps.length > 0) departments = deps;
      onDataUpdate();
    });

    // Subscribe to stages
    unsubStages = onSnapshot(collection(db, "templateStages"), (snap) => {
      stages = snap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => a.order - b.order);
      onDataUpdate();
    });

    // Subscribe to items
    unsubItems = onSnapshot(collection(db, "templateItems"), (snap) => {
      allItems = snap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      onDataUpdate();
    });
  }

  // ─── Data Update Handler ────────────────────────────────────────────────────

  function onDataUpdate() {
    if (stages.length === 0) return; // Wait for both to load
    showLiveBanner();
    updateMatrixView();
    updateTreeView();
    updateListView();
    updateTotalCounts();
  }

  // ─── Live Banner ────────────────────────────────────────────────────────────

  function showLiveBanner() {
    let banner = document.getElementById("live-data-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "live-data-banner";
      banner.style.cssText = `
        position: fixed; bottom: 6rem; left: 2rem; z-index: 9000;
        background: linear-gradient(135deg, #06b6d4, #0891b2);
        color: #fff; padding: 8px 16px; border-radius: 8px;
        font-size: 0.75rem; font-weight: 500;
        box-shadow: 0 4px 16px rgba(6,182,212,0.3);
        display: flex; align-items: center; gap: 8px;
        animation: rb-fade-in 0.3s ease;
      `;
      document.body.appendChild(banner);
    }
    const pulseDot = `<span style="width:8px;height:8px;border-radius:50%;background:#4ade80;display:inline-block;animation:pulse 2s infinite;"></span>`;
    banner.innerHTML = `${pulseDot} 실시간 데이터 — ${stages.length}개 단계, ${allItems.length}개 항목`;

    // Pulse animation
    if (!document.getElementById("live-pulse-style")) {
      const style = document.createElement("style");
      style.id = "live-pulse-style";
      style.textContent = `@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`;
      document.head.appendChild(style);
    }
  }

  // ─── Matrix View Update ─────────────────────────────────────────────────────

  function getDeptName(deptId) {
    const d = departments.find(dep => dep.id === deptId);
    return d ? d.name : deptId;
  }

  function updateMatrixView() {
    const tbody = document.querySelector("#view-matrix .mx-table tbody");
    if (!tbody) return;

    // Also update thead to reflect actual departments
    const thead = document.querySelector("#view-matrix .mx-table thead");
    if (thead) {
      let thHtml = `<tr><th class="mx-corner">단계 ╲ 부서</th>`;
      departments.forEach(dept => {
        thHtml += `<th>${esc(dept.name)}</th>`;
      });
      thHtml += `<th class="total-col">합계</th></tr>`;
      thead.innerHTML = thHtml;
    }

    // Build matrix data using department IDs
    const matrix = {};
    const rowTotals = {};
    const colTotals = {};
    let grandTotal = 0;

    stages.forEach(s => {
      matrix[s.id] = {};
      rowTotals[s.id] = { total: 0, required: 0 };
      departments.forEach(dept => {
        matrix[s.id][dept.id] = { total: 0, required: 0 };
      });
    });

    departments.forEach(dept => {
      colTotals[dept.id] = 0;
    });

    allItems.forEach(item => {
      const stageId = item.stageId;
      const deptId = item.departmentId;
      if (matrix[stageId] && matrix[stageId][deptId] !== undefined) {
        matrix[stageId][deptId].total++;
        if (item.isRequired) matrix[stageId][deptId].required++;
        rowTotals[stageId].total++;
        if (item.isRequired) rowTotals[stageId].required++;
        colTotals[deptId] = (colTotals[deptId] || 0) + 1;
        grandTotal++;
      }
    });

    // Render rows
    let html = "";
    stages.forEach(stage => {
      const phaseName = stage.name || stage.id;
      html += `<tr><td>${esc(phaseName)}</td>`;
      departments.forEach(dept => {
        const cell = matrix[stage.id][dept.id];
        if (cell.total === 0) {
          html += `<td><span class="mx-cell-empty">—</span></td>`;
        } else {
          html += `<td><span class="mx-cell" data-stage="${stage.id}" data-dept="${dept.id}">`;
          html += `<span class="cnt">${cell.total}</span>`;
          html += `<span class="req">필수 ${cell.required}</span>`;
          html += `<span class="mx-tooltip">클릭 → 트리 뷰 전환</span>`;
          html += `</span></td>`;
        }
      });
      html += `<td class="total-col"><span class="mx-total">${rowTotals[stage.id].total}</span></td></tr>`;
    });

    // Total row
    html += `<tr class="total-row"><td>합계</td>`;
    departments.forEach(dept => {
      html += `<td>${colTotals[dept.id] || 0}</td>`;
    });
    html += `<td class="total-col" style="color: var(--accent); font-size: .8rem;"><strong>${grandTotal}</strong></td></tr>`;

    tbody.innerHTML = html;

    // Rebind cell click events
    tbody.querySelectorAll(".mx-cell").forEach(cell => {
      cell.addEventListener("click", () => {
        const tabs = document.querySelectorAll(".topbar-tab");
        const panels = document.querySelectorAll(".view-panel");
        tabs.forEach(t => t.classList.remove("active"));
        panels.forEach(p => p.classList.remove("active"));
        tabs[1].classList.add("active");
        document.getElementById("view-tree").classList.add("active");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  // ─── Tree View Update ───────────────────────────────────────────────────────

  function updateTreeView() {
    const sidebar = document.querySelector("#view-tree .tree-sidebar");
    if (!sidebar) return;

    // Find all existing .tree-stage elements and replace them
    const existingStages = sidebar.querySelectorAll(".tree-stage");
    const header = sidebar.querySelector(".tree-sidebar-header");
    const warn = sidebar.querySelector(".tree-sidebar-warn");
    if (!header) return;

    // Remove existing stage elements
    existingStages.forEach(el => el.remove());

    // Insert new stage elements after header, before warning
    stages.forEach((stage, i) => {
      const phaseName = stage.name || stage.id;
      const workName = stage.workStageName || "";
      const gateName = stage.gateStageName || "";
      const itemCount = allItems.filter(it => it.stageId === stage.id).length;
      const isActive = i === 0;

      const div = document.createElement("div");
      div.className = "tree-stage" + (isActive ? " active" : "");
      div.dataset.stageId = stage.id;
      div.innerHTML = `
        <div style="flex: 1;">
          <div class="tree-stage-name">${esc(phaseName)}</div>
          <div class="tree-stage-sub">${esc(workName)} / ${esc(gateName)}</div>
        </div>
        <span class="tree-stage-count">${itemCount}</span>
        ${isActive ? '<button class="tree-stage-del" style="display: inline-flex;">✕</button>' : ""}
      `;
      if (warn) {
        sidebar.insertBefore(div, warn);
      } else {
        sidebar.appendChild(div);
      }
    });

    // Update department tabs in tree view
    updateTreeDeptTabs();

    // Update items for first stage + first dept
    updateTreeItems(stages[0]?.id, departments[0]?.id);
  }

  function updateTreeDeptTabs() {
    const tabBar = document.querySelector("#view-tree .tree-dept-tabs");
    if (!tabBar) return;

    // Keep anno-dot if present
    const annoDot = tabBar.querySelector(".anno-dot");
    const annoHtml = annoDot ? annoDot.outerHTML : "";

    let html = annoHtml;
    departments.forEach((dept, i) => {
      html += `<button class="dept-tab${i === 0 ? " active" : ""}" data-dept-id="${dept.id}">${esc(dept.name)}</button>`;
    });
    // Keep action buttons
    html += `<button class="dept-action">+ 부서 추가</button>`;
    html += `<button class="dept-action danger">부서 삭제</button>`;
    tabBar.innerHTML = html;
  }

  function updateTreeItems(stageId, deptId) {
    if (!stageId || !deptId) return;

    const stage = stages.find(s => s.id === stageId);
    const phaseName = stage?.name || stageId;
    const deptName = getDeptName(deptId);
    const items = allItems.filter(it => it.stageId === stageId && it.departmentId === deptId);

    // Update breadcrumb
    const breadcrumb = document.querySelector("#view-tree .tree-breadcrumb");
    if (breadcrumb) {
      // Keep anno-dot if it exists
      const annoDot = breadcrumb.querySelector(".anno-dot");
      const annoHtml = annoDot ? annoDot.outerHTML : "";
      breadcrumb.innerHTML = `
        ${annoHtml}
        <strong>${esc(phaseName)}</strong> <span style="color: var(--ink-5);">›</span> <strong>${esc(deptName)}</strong>
        <span style="margin-left: 8px; font-family: var(--mono); color: var(--ink-4);">— ${items.length}개 항목</span>
      `;
    }

    // Update item list
    const itemList = document.querySelector("#view-tree .tree-items");
    if (!itemList) return;

    // Keep the anno-dot
    const annoDot = itemList.querySelector(".anno-dot");
    const annoHtml = annoDot ? annoDot.outerHTML : "";

    if (items.length === 0) {
      itemList.innerHTML = `
        ${annoHtml}
        <div style="padding: 2rem; text-align: center; color: var(--ink-4); font-size: .75rem;">
          이 단계/부서에 등록된 항목이 없습니다
        </div>
        <div class="tree-add-btn"><span style="font-size: .9rem;">+</span> 항목 추가</div>
      `;
    } else {
      let html = annoHtml;
      items.forEach((item, idx) => {
        // Show first item with drag demo styling if it's the 3rd item
        const isDragDemo = idx === 2;
        const isDropTarget = idx === 3;
        html += `
          <div class="tree-item${isDragDemo ? " dragging" : ""}${isDropTarget ? " drop-target" : ""}"
               ${isDragDemo ? 'style="opacity: .45; border-style: dashed;"' : ""}
               ${isDropTarget ? 'style="border-width: 2px;"' : ""}>
            <span class="drag-handle">☰</span>
            <span class="item-name">${esc(item.content || item.name)}</span>
            <span class="item-badge ${item.isRequired ? "required" : "optional"}">${item.isRequired ? "필수" : "선택"}</span>
            <div class="item-actions">
              <button class="item-btn" title="편집">✎</button>
              <button class="item-btn danger" title="삭제">✕</button>
            </div>
            ${isDragDemo ? '<span class="drag-indicator">↕</span>' : ""}
          </div>
        `;
      });
      html += `<div class="tree-add-btn"><span style="font-size: .9rem;">+</span> 항목 추가</div>`;
      itemList.innerHTML = html;
    }
  }

  // ─── List View Update ───────────────────────────────────────────────────────

  function updateListView() {
    const listTbody = document.querySelector("#view-list .list-table tbody");
    if (!listTbody) return;

    // Show first 20 items as sample
    const displayItems = allItems.slice(0, 20);
    let html = "";
    displayItems.forEach((item, idx) => {
      const stage = stages.find(s => s.id === item.stageId);
      const phaseName = stage?.name || item.stageId;
      const deptName = getDeptName(item.departmentId);
      html += `
        <tr>
          <td style="font-family: var(--mono); color: var(--ink-4);">${idx + 1}</td>
          <td style="font-weight: 500;">${esc(item.content || item.name)}</td>
          <td><span style="font-size: .6rem; padding: 2px 6px; border-radius: 3px; background: var(--cyan-bg); color: var(--cyan);">${esc(phaseName)}</span></td>
          <td>${esc(deptName)}</td>
          <td><span style="font-size: .6rem; padding: 2px 6px; border-radius: 3px; background: ${item.isRequired ? "var(--red-bg)" : "var(--surface-0)"}; color: ${item.isRequired ? "var(--red-fg)" : "var(--ink-4)"}; font-weight: ${item.isRequired ? "600" : "normal"};">${item.isRequired ? "필수" : "선택"}</span></td>
          <td>
            <span class="list-edit">✎ 편집</span>
          </td>
        </tr>
      `;
    });
    listTbody.innerHTML = html;

    // Update filter count (class is .list-count)
    const countEl = document.querySelector("#view-list .list-count");
    if (countEl) {
      // Keep the anno-dot
      const annoDot = countEl.querySelector(".anno-dot");
      const annoHtml = annoDot ? annoDot.outerHTML : "";
      countEl.innerHTML = `${displayItems.length}개 항목 표시 (총 ${allItems.length}개 중) ${annoHtml}`;
    }
  }

  // ─── Total Count Update ─────────────────────────────────────────────────────

  function updateTotalCounts() {
    // Update all mock-header h2 small elements across all views
    document.querySelectorAll(".mock-header h2 small").forEach(el => {
      el.textContent = `총 ${allItems.length}개 항목`;
    });

    // Update list view description text (mentions 193)
    const listDesc = document.querySelector("#view-list .section-sub");
    if (listDesc) {
      listDesc.textContent = `전체 ${allItems.length}개 항목 플랫 테이블. 검색 + Phase 필터 + 부서 필터 조합`;
    }
  }

  // ─── Helper ─────────────────────────────────────────────────────────────────

  function esc(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ─── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    try {
      await loadFirebase();
      subscribeData();
    } catch (e) {
      console.warn("Checklist live data: Firebase unavailable, keeping static wireframe", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
