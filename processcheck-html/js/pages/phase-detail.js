// =============================================================================
// Phase Detail Page — Gate Review + 인수인계 + 이력 + 회의록 (풀 페이지)
// =============================================================================

import { guardPage } from "../auth.js";
import { showToast } from "../ui/toast.js";
import { renderNav, initTheme } from "../components.js";
initTheme();
import {
  subscribeProjects,
  subscribeChecklistItems,
  subscribeGateRecords,
  updateGateRecord,
  updateGateApprovedAt,
  addGateMeetingNote,
  getTemplateStages,
  PHASE_DESCRIPTIONS,
  updateHandoffChecklist,
} from "../firestore-service.js";
import { storage } from "../firebase-init.js";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  PHASE_GROUPS,
  GATE_DECISIONS,
  GATE_CRITERIA_TEMPLATES,
  getGateStatusDisplay,
  escapeHtml,
  formatDate,
  getQueryParam,
} from "../utils.js";

// --- Auth guard ---
const user = guardPage();
if (!user) throw new Error("Not authenticated");

// --- URL params ---
const projectId = getQueryParam("projectId");
const phaseIdx = parseInt(getQueryParam("phase") || "0", 10);
if (!projectId) {
  window.location.href = "projects.html";
  throw new Error("No project ID");
}

// --- DOM ---
const navRoot = document.getElementById("nav-root");
const app = document.getElementById("app");
if (navRoot) renderNav(navRoot, "phase-detail.html", user);

// --- State ---
let project = null;
let checklistItems = [];
let gateRecords = [];
let dynamicPhaseGroups = [];

function getActivePhaseGroups() {
  return dynamicPhaseGroups.length > 0 ? dynamicPhaseGroups : PHASE_GROUPS;
}

// --- Subscriptions ---
getTemplateStages().then(stages => {
  dynamicPhaseGroups = stages.map(s => ({
    id: s.id, name: s.name, workStage: s.workStageName, gateStage: s.gateStageName,
  }));
}).catch(() => {});

subscribeProjects(projects => {
  project = projects.find(p => p.id === projectId) || null;
  render();
});

subscribeChecklistItems(projectId, items => {
  checklistItems = items;
  render();
});

subscribeGateRecords(projectId, records => {
  gateRecords = records;
  render();
});

// =============================================================================
// Render
// =============================================================================

function render() {
  if (!app || !project) return;
  const phases = getActivePhaseGroups();
  const phase = phases[phaseIdx];
  if (!phase) {
    app.innerHTML = `<div class="container" style="padding:3rem;text-align:center;">
      <h2>Phase를 찾을 수 없습니다</h2>
      <a href="project.html?id=${encodeURIComponent(projectId)}" class="btn-primary" style="display:inline-block;margin-top:1rem;padding:0.5rem 1.5rem;border-radius:0.5rem;text-decoration:none;">프로젝트로 돌아가기</a>
    </div>`;
    return;
  }

  const phaseId = `phase${phaseIdx}`;
  const gr = gateRecords.find(r => r.phaseId === phaseId) || null;
  const gateStatus = gr?.gateStatus || "pending";
  const gsd = getGateStatusDisplay(gateStatus);
  const notes = gr?.meetingNotes || [];
  const desc = PHASE_DESCRIPTIONS[phase.name] || "";
  const isObserver = user.role === "observer" || user.role === "admin";

  const phaseTasks = checklistItems.filter(t => t.stage === phase.workStage || t.stage === phase.gateStage);
  const doneTasks = phaseTasks.filter(t => t.status === "completed").length;
  const totalTasks = phaseTasks.length;

  const template = GATE_CRITERIA_TEMPLATES[phase.name] || { mustMeet: [], shouldMeet: [] };
  const savedMustMeet = gr?.mustMeetItems || template.mustMeet.map((label, i) => ({ id: `mm${i}`, label, checked: false }));
  const savedShouldMeet = gr?.shouldMeetItems || template.shouldMeet.map((s, i) => ({ id: `sm${i}`, label: s.label, description: s.description, score: 0, maxScore: 10 }));
  const mustMeetAllPassed = savedMustMeet.length > 0 && savedMustMeet.every(m => m.checked);
  const shouldMeetTotal = savedShouldMeet.reduce((sum, s) => sum + (s.score || 0), 0);
  const shouldMeetMax = savedShouldMeet.length * 10;
  const scorePercent = shouldMeetMax > 0 ? Math.round(shouldMeetTotal / shouldMeetMax * 100) : 0;
  const scoreColor = scorePercent >= 70 ? "var(--success-400)" : scorePercent >= 40 ? "var(--warning-500)" : "var(--danger-400)";

  const handoffItems = gr?.handoffChecklist || [
    { id: "h0", label: "산출물 검토 및 승인 완료", checked: false },
    { id: "h1", label: "미결 이슈 목록 정리 및 인수인계", checked: false },
    { id: "h2", label: "다음 단계 담당자에게 브리핑 완료", checked: false },
    { id: "h3", label: "관련 문서/파일 공유 및 접근 권한 확인", checked: false },
    { id: "h4", label: "리스크/주의사항 전달", checked: false },
  ];
  const handoffDone = handoffItems.filter(h => h.checked).length;

  // Phase navigation
  const prevPhase = phaseIdx > 0 ? phases[phaseIdx - 1] : null;
  const nextPhase = phaseIdx < phases.length - 1 ? phases[phaseIdx + 1] : null;

  app.innerHTML = `
    <div class="container" style="max-width:800px;margin:0 auto;padding-bottom:3rem;">
      <!-- Breadcrumb -->
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;font-size:0.75rem;color:var(--slate-400);">
        <a href="project.html?id=${encodeURIComponent(projectId)}" style="color:var(--primary-400);text-decoration:none;">${escapeHtml(project.name)}</a>
        <span>/</span>
        <span style="color:var(--slate-200);">${phase.name} — ${phase.gateStage}</span>
      </div>

      <!-- Header -->
      <div class="card p-5 mb-4">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;">
          <div>
            <h1 style="font-size:1.5rem;font-weight:700;color:var(--slate-100);margin:0 0 0.25rem;">${phase.name} — ${phase.gateStage}</h1>
            <p style="font-size:0.8rem;color:var(--slate-400);margin:0;">${escapeHtml(desc) || "Phase 설명 없음"}</p>
          </div>
          <div style="text-align:right;">
            <div class="gate-status ${gsd.cls}" style="font-size:1rem;display:inline-flex;align-items:center;gap:0.375rem;">
              ${gsd.icon} ${gsd.label}
            </div>
            <div style="font-size:0.75rem;color:var(--slate-400);margin-top:0.25rem;">${doneTasks}/${totalTasks} 작업 완료</div>
          </div>
        </div>
        ${totalTasks > 0 ? `<div class="gate-progress-bar" style="margin-top:0.75rem;"><div class="gate-progress-fill" style="width:${Math.round(doneTasks/totalTasks*100)}%"></div></div>` : ""}
        ${gr?.approvedBy ? `<div style="font-size:0.75rem;color:var(--slate-400);margin-top:0.5rem;">결정자: ${escapeHtml(gr.approvedBy)} · ${gr.approvedAt ? formatDate(new Date(gr.approvedAt)) : ""}</div>` : ""}
        ${gr?.decisionReason ? `<div style="font-size:0.8rem;margin-top:0.5rem;padding:0.5rem 0.75rem;background:var(--surface-2);border-radius:var(--radius-md);border-left:3px solid ${gsd.color};color:var(--slate-200);">${escapeHtml(gr.decisionReason)}</div>` : ""}
      </div>

      <!-- 2-column layout -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">

        <!-- Left: Gate Review -->
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <!-- Must-Meet -->
          <div class="card p-4">
            <h3 style="font-size:0.85rem;font-weight:700;color:var(--slate-100);margin:0 0 0.75rem;">🚦 Must-Meet 기준</h3>
            <div id="gate-must-meet-list">
              ${savedMustMeet.map((m, i) => `
                <label class="gate-must-meet-item ${m.checked ? "checked" : ""}" data-mm-idx="${i}" style="${isObserver ? "cursor:pointer;" : "pointer-events:none;opacity:0.8;"}">
                  <input type="checkbox" ${m.checked ? "checked" : ""} ${isObserver ? "" : "disabled"}>
                  <span>${escapeHtml(m.label)}</span>
                </label>
              `).join("")}
            </div>
            <div id="gate-must-meet-result" class="gate-must-meet-summary ${mustMeetAllPassed ? "pass" : "fail"}" style="margin-top:0.5rem;">
              ${mustMeetAllPassed ? "전체 충족 — Go 가능" : `미충족 ${savedMustMeet.filter(m => !m.checked).length}건 — Go 불가`}
            </div>
          </div>

          <!-- Should-Meet -->
          <div class="card p-4">
            <h3 style="font-size:0.85rem;font-weight:700;color:var(--slate-100);margin:0 0 0.75rem;">📊 Should-Meet 스코어카드</h3>
            <div id="gate-should-meet-list">
              ${savedShouldMeet.map((s, i) => `
                <div class="gate-score-item" data-sm-idx="${i}">
                  <div class="gate-score-label">
                    ${escapeHtml(s.label)}
                    <span class="gate-score-desc">${escapeHtml(s.description || "")}</span>
                  </div>
                  ${isObserver ? `<input type="number" class="gate-score-input" min="0" max="10" value="${s.score || 0}">` : `<span style="font-weight:700;font-size:0.85rem;">${s.score || 0}</span>`}
                  <span class="gate-score-max">/ 10</span>
                </div>
              `).join("")}
            </div>
            <div class="gate-score-total" style="margin-top:0.5rem;">
              <span>총점</span>
              <span id="gate-score-value" style="color:${scoreColor};">${shouldMeetTotal} / ${shouldMeetMax}</span>
            </div>
            <div class="gate-score-bar">
              <div class="gate-score-bar-fill" style="width:${scorePercent}%;background:${scoreColor};"></div>
            </div>
          </div>

          ${isObserver ? `
          <!-- Gate 의사결정 -->
          <div class="card p-4">
            <h3 style="font-size:0.85rem;font-weight:700;color:var(--slate-100);margin:0 0 0.75rem;">🎯 Gate 의사결정</h3>
            <div class="gate-decision-grid">
              ${GATE_DECISIONS.map(d => `
                <button class="gate-decision-btn" data-gate-decision="${d.value}" style="color:${d.color};border-color:${gateStatus === d.value || (d.value === "go" && gateStatus === "approved") || (d.value === "kill" && gateStatus === "rejected") ? d.color : "var(--surface-3)"}; background:${gateStatus === d.value || (d.value === "go" && gateStatus === "approved") || (d.value === "kill" && gateStatus === "rejected") ? d.bg : "var(--surface-1)"};">
                  <span style="font-size:1rem;">${d.icon}</span> ${d.label}
                </button>
              `).join("")}
            </div>
            <div style="margin-top:0.5rem;">
              <label style="font-size:0.75rem;font-weight:600;display:block;margin-bottom:0.25rem;">결정 사유</label>
              <textarea id="gate-decision-reason" style="width:100%;font-size:0.8rem;padding:0.5rem;border:1px solid var(--surface-4);border-radius:var(--radius-md);background:var(--surface-1);color:var(--text-primary);resize:vertical;min-height:80px;" placeholder="결정의 근거와 후속 조치를 기록하세요...">${escapeHtml(gr?.decisionReason || "")}</textarea>
            </div>
            <button class="btn-primary" id="gate-submit-decision" style="margin-top:0.5rem;width:100%;padding:0.5rem;font-size:0.85rem;">결정 저장</button>
            ${gateStatus !== "pending" ? `<button class="btn-ghost" id="gate-reset-decision" style="margin-top:0.25rem;width:100%;font-size:0.75rem;">↩ 초기화 (대기로 변경)</button>` : ""}
          </div>
          ` : ""}
        </div>

        <!-- Right: 인수인계 + 이력 + 회의록 -->
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <!-- 인수인계 -->
          <div class="card p-4">
            <h3 style="font-size:0.85rem;font-weight:700;color:var(--slate-100);margin:0 0 0.75rem;">🤝 Phase 인수인계 체크리스트</h3>
            <div id="gate-handoff-list">
              ${handoffItems.map((h, i) => `
                <label class="gate-must-meet-item ${h.checked ? "checked" : ""}" data-handoff-idx="${i}" style="cursor:pointer;">
                  <input type="checkbox" ${h.checked ? "checked" : ""} class="handoff-cb">
                  <span>${escapeHtml(h.label)}</span>
                  ${h.checkedBy ? `<span style="font-size:0.625rem;color:var(--slate-400);margin-left:auto;">${escapeHtml(h.checkedBy)}</span>` : ""}
                </label>
              `).join("")}
            </div>
            <div style="font-size:0.75rem;margin-top:0.5rem;color:${handoffDone === handoffItems.length ? "var(--success-400)" : "var(--slate-400)"};">
              ${handoffDone === handoffItems.length ? "전체 인수인계 완료" : `${handoffDone}/${handoffItems.length} 완료`}
            </div>
          </div>

          <!-- 의사결정 이력 -->
          <div class="card p-4">
            <h3 style="font-size:0.85rem;font-weight:700;color:var(--slate-100);margin:0 0 0.75rem;">📋 의사결정 이력 ${gr?.decisionHistory?.length ? `<span style="font-weight:400;color:var(--slate-400);">${gr.decisionHistory.length}건</span>` : ""}</h3>
            ${gr?.decisionHistory?.length > 0 ? `
              <div style="max-height:300px;overflow-y:auto;">
                ${[...gr.decisionHistory].reverse().map(h => {
                  const decisionLabels = { go: "Go ✅", kill: "Kill ❌", hold: "Hold ⏸", recycle: "Recycle ♻", approved: "승인 ✅", rejected: "반려 ❌", pending: "초기화 ↩" };
                  const decisionColors = { go: "var(--success-400)", kill: "var(--danger-400)", hold: "var(--warning-400)", recycle: "var(--primary-400)", approved: "var(--success-400)", rejected: "var(--danger-400)", pending: "var(--slate-400)" };
                  const dAt = h.decidedAt ? (typeof h.decidedAt.toDate === "function" ? h.decidedAt.toDate() : new Date(h.decidedAt)) : null;
                  return `<div style="display:flex;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid var(--surface-3);font-size:0.8rem;">
                    <span style="flex-shrink:0;font-weight:700;color:${decisionColors[h.decision] || "var(--slate-300)"};">${decisionLabels[h.decision] || h.decision}</span>
                    <span style="flex:1;min-width:0;color:var(--slate-300);">${h.reason ? escapeHtml(h.reason) : "<span style='color:var(--slate-500);'>사유 없음</span>"}</span>
                    <span style="flex-shrink:0;color:var(--slate-400);white-space:nowrap;">${escapeHtml(h.decidedBy)} · ${dAt ? formatDate(dAt) : ""}</span>
                  </div>`;
                }).join("")}
              </div>
            ` : `<div style="font-size:0.8rem;color:var(--slate-400);">아직 의사결정 이력이 없습니다.</div>`}
          </div>

          <!-- 회의록 -->
          <div class="card p-4">
            <h3 style="font-size:0.85rem;font-weight:700;color:var(--slate-100);margin:0 0 0.75rem;">💬 회의록 · 피드백 <span style="font-weight:400;color:var(--slate-400);">${notes.length}건</span></h3>
            <div style="max-height:400px;overflow-y:auto;margin-bottom:0.75rem;">
              ${notes.length === 0 ? `<div style="padding:1rem;text-align:center;font-size:0.8rem;color:var(--slate-400);">등록된 회의록이 없습니다</div>` :
                notes.slice().reverse().map(n => `
                  <div style="padding:0.625rem;background:var(--surface-1);border:1px solid var(--surface-3);border-radius:var(--radius-md);margin-bottom:0.5rem;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
                      <span style="font-size:0.8rem;font-weight:600;color:var(--primary-400);">${escapeHtml(n.author || "")}</span>
                      <span style="font-size:0.7rem;color:var(--slate-400);">${n.createdAt ? formatDate(n.createdAt) : ""}</span>
                    </div>
                    <div style="font-size:0.8rem;color:var(--slate-200);white-space:pre-wrap;line-height:1.5;">${escapeHtml(n.content || "")}</div>
                    ${(n.files && n.files.length > 0) ? `
                      <div style="margin-top:0.375rem;display:flex;flex-wrap:wrap;gap:0.25rem;">
                        ${n.files.map(f => `
                          <a href="${f.url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.25rem 0.5rem;background:var(--surface-2);border:1px solid var(--surface-4);border-radius:var(--radius-sm);font-size:0.7rem;color:var(--primary-400);text-decoration:none;">
                            📎 ${escapeHtml(f.name)}${f.size ? ` (${(f.size/1024).toFixed(0)}KB)` : ""}
                          </a>
                        `).join("")}
                      </div>
                    ` : ""}
                  </div>
                `).join("")
              }
            </div>
            <!-- 작성 폼 -->
            <div style="border-top:1px solid var(--surface-3);padding-top:0.75rem;">
              <textarea class="gate-note-input" placeholder="회의 내용, 피드백, 결정 사항 등을 기록하세요..." rows="3" style="width:100%;font-size:0.8rem;padding:0.5rem;border:1px solid var(--surface-4);border-radius:var(--radius-md);background:var(--surface-1);color:var(--text-primary);resize:vertical;"></textarea>
              <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.375rem;">
                <label style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.35rem 0.6rem;background:var(--surface-2);border:1px solid var(--surface-4);border-radius:var(--radius-sm);font-size:0.75rem;color:var(--slate-300);cursor:pointer;">
                  📎 파일 첨부
                  <input type="file" class="gate-note-file-input" multiple style="display:none;">
                </label>
                <span class="gate-note-file-list" style="font-size:0.7rem;color:var(--slate-400);"></span>
                <button class="btn-primary gate-note-submit" style="margin-left:auto;padding:0.375rem 1rem;font-size:0.8rem;">등록</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Phase navigation -->
      <div style="display:flex;justify-content:space-between;margin-top:1.5rem;">
        ${prevPhase ? `<a href="phase-detail.html?projectId=${encodeURIComponent(projectId)}&phase=${phaseIdx - 1}" style="font-size:0.8rem;color:var(--primary-400);text-decoration:none;">← ${prevPhase.name}</a>` : `<span></span>`}
        ${nextPhase ? `<a href="phase-detail.html?projectId=${encodeURIComponent(projectId)}&phase=${phaseIdx + 1}" style="font-size:0.8rem;color:var(--primary-400);text-decoration:none;">${nextPhase.name} →</a>` : `<span></span>`}
      </div>
    </div>
  `;

  bindEvents(phase, phaseIdx, phaseId, gr, gateStatus, savedMustMeet, savedShouldMeet, shouldMeetMax, notes, isObserver);
}

// =============================================================================
// Events
// =============================================================================

function bindEvents(phase, phaseIdx, phaseId, gr, gateStatus, savedMustMeet, savedShouldMeet, shouldMeetMax, notes, isObserver) {
  // Must-Meet (observer)
  if (isObserver) {
    app.querySelectorAll("#gate-must-meet-list .gate-must-meet-item input").forEach(cb => {
      cb.addEventListener("change", () => {
        const item = cb.closest(".gate-must-meet-item");
        if (cb.checked) item.classList.add("checked"); else item.classList.remove("checked");
        const allChecked = [...app.querySelectorAll("#gate-must-meet-list input")].every(c => c.checked);
        const unchecked = [...app.querySelectorAll("#gate-must-meet-list input")].filter(c => !c.checked).length;
        const result = app.querySelector("#gate-must-meet-result");
        if (result) {
          result.className = `gate-must-meet-summary ${allChecked ? "pass" : "fail"}`;
          result.textContent = allChecked ? "전체 충족 — Go 가능" : `미충족 ${unchecked}건 — Go 불가`;
        }
      });
    });

    // Should-Meet
    app.querySelectorAll(".gate-score-input").forEach(input => {
      input.addEventListener("input", () => {
        let val = parseInt(input.value) || 0;
        if (val > 10) { val = 10; input.value = 10; }
        if (val < 0) { val = 0; input.value = 0; }
        const total = [...app.querySelectorAll(".gate-score-input")].reduce((s, inp) => s + (parseInt(inp.value) || 0), 0);
        const max = app.querySelectorAll(".gate-score-input").length * 10;
        const pct = Math.round(total / max * 100);
        const c = pct >= 70 ? "var(--success-400)" : pct >= 40 ? "var(--warning-500)" : "var(--danger-400)";
        const sv = app.querySelector("#gate-score-value");
        if (sv) { sv.textContent = `${total} / ${max}`; sv.style.color = c; }
        const bar = app.querySelector(".gate-score-bar-fill");
        if (bar) { bar.style.width = `${pct}%`; bar.style.background = c; }
      });
    });

    // Decision buttons
    let selectedDecision = gateStatus === "approved" ? "go" : gateStatus === "rejected" ? "kill" : (gateStatus !== "pending" ? gateStatus : "");
    app.querySelectorAll(".gate-decision-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedDecision = btn.dataset.gateDecision;
        const dec = GATE_DECISIONS.find(d => d.value === selectedDecision);
        app.querySelectorAll(".gate-decision-btn").forEach(b => {
          if (b === btn) {
            b.style.borderColor = dec.color;
            b.style.background = dec.bg;
          } else {
            b.style.borderColor = "var(--surface-3)";
            b.style.background = "var(--surface-1)";
          }
        });
      });
    });

    // Submit decision
    app.querySelector("#gate-submit-decision")?.addEventListener("click", async () => {
      if (!selectedDecision) { showToast("warning", "의사결정을 선택해주세요."); return; }
      const allMustMet = [...app.querySelectorAll("#gate-must-meet-list input")].every(c => c.checked);
      if (selectedDecision === "go" && !allMustMet) {
        showToast("warning", "Must-Meet 기준이 모두 충족되지 않아 Go를 선택할 수 없습니다.");
        return;
      }
      const mustMeetItems = [...app.querySelectorAll("#gate-must-meet-list .gate-must-meet-item")].map((el, i) => ({
        id: `mm${i}`, label: el.querySelector("span")?.textContent || "", checked: el.querySelector("input")?.checked || false,
      }));
      const shouldMeetItems = [...app.querySelectorAll(".gate-score-item")].map((el, i) => ({
        id: `sm${i}`, label: el.querySelector(".gate-score-label")?.childNodes[0]?.textContent?.trim() || "",
        description: el.querySelector(".gate-score-desc")?.textContent || "",
        score: parseInt(el.querySelector(".gate-score-input")?.value) || 0, maxScore: 10,
      }));
      const smTotal = shouldMeetItems.reduce((s, it) => s + it.score, 0);
      const smMax = shouldMeetItems.length * 10;
      const reason = app.querySelector("#gate-decision-reason")?.value?.trim() || "";
      const statusMap = { go: "go", kill: "kill", hold: "hold", recycle: "recycle" };
      const btn = app.querySelector("#gate-submit-decision");
      try {
        if (btn) { btn.disabled = true; btn.textContent = "저장 중..."; }
        await updateGateRecord(projectId, phaseId, phase.name, statusMap[selectedDecision], user?.name || "", {
          mustMeetItems, shouldMeetItems, shouldMeetTotal: smTotal, shouldMeetMax: smMax, decisionReason: reason,
        });
        showToast("success", `${phase.name} Gate: ${GATE_DECISIONS.find(d => d.value === selectedDecision)?.label || selectedDecision}`);
      } catch (err) {
        showToast("error", "저장 실패: " + err.message);
        if (btn) { btn.disabled = false; btn.textContent = "결정 저장"; }
      }
    });

    // Reset
    app.querySelector("#gate-reset-decision")?.addEventListener("click", async () => {
      try {
        await updateGateRecord(projectId, phaseId, phase.name, "pending", user?.name || "", {
          mustMeetItems: savedMustMeet.map(m => ({ ...m, checked: false })),
          shouldMeetItems: savedShouldMeet.map(s => ({ ...s, score: 0 })),
          shouldMeetTotal: 0, shouldMeetMax, decisionReason: "",
        });
        showToast("success", "초기화 완료");
      } catch (err) {
        showToast("error", "초기화 실패: " + err.message);
      }
    });
  }

  // Handoff
  app.querySelectorAll(".handoff-cb").forEach(cb => {
    cb.addEventListener("change", async () => {
      const items = [...app.querySelectorAll("[data-handoff-idx]")].map((el, i) => {
        const input = el.querySelector("input");
        return {
          id: `h${i}`, label: el.querySelector("span").textContent.trim(),
          checked: input.checked, checkedBy: input.checked ? (user?.name || "") : "",
          checkedAt: input.checked ? new Date().toISOString() : null,
        };
      });
      try {
        await updateHandoffChecklist(projectId, phaseId, items);
      } catch (e) {
        console.error("핸드오프 저장 실패:", e);
      }
    });
  });

  // File input
  const fileInput = app.querySelector(".gate-note-file-input");
  const fileListEl = app.querySelector(".gate-note-file-list");
  if (fileInput && fileListEl) {
    fileInput.addEventListener("change", () => {
      fileListEl.textContent = Array.from(fileInput.files).map(f => f.name).join(", ");
    });
  }

  // Submit note
  const submitBtn = app.querySelector(".gate-note-submit");
  const textarea = app.querySelector(".gate-note-input");
  if (submitBtn && textarea) {
    submitBtn.addEventListener("click", async () => {
      const content = textarea.value.trim();
      const files = fileInput ? Array.from(fileInput.files) : [];
      if (!content && files.length === 0) { showToast("warning", "내용 또는 파일을 입력해주세요"); return; }
      try {
        submitBtn.disabled = true;
        submitBtn.textContent = files.length > 0 ? "업로드 중..." : "등록 중...";
        const uploadedFiles = [];
        for (const file of files) {
          const fileId = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          const path = `gateNotes/${projectId}/${phaseId}/${fileId}_${file.name}`;
          const ref = storageRef(storage, path);
          const snap = await uploadBytesResumable(ref, file);
          const url = await getDownloadURL(snap.ref);
          uploadedFiles.push({ name: file.name, url, size: file.size, type: file.type });
        }
        await addGateMeetingNote(projectId, phaseId, phase.name, user?.name || "익명", content || "(파일 첨부)", uploadedFiles);
        showToast("success", "회의록이 등록되었습니다");
        // onSnapshot will trigger re-render
      } catch (err) {
        showToast("error", "등록 실패: " + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "등록";
      }
    });
  }
}
