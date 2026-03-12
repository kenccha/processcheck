// ═══════════════════════════════════════════════════════════════════════════════
// Reports Page Controller — Analytics & Charts
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage, getUser } from "../auth.js";
import { renderNav, initTheme } from "../components.js";
import {
  subscribeProjects,
  subscribeAllChecklistItems,
} from "../firestore-service.js";
import {
  escapeHtml,
  departments,
  PHASE_GROUPS,
  formatDate,
  getStatusLabel,
  getRiskLabel,
} from "../utils.js";

// ─── Theme ──────────────────────────────────────────────────────────────────
initTheme();

// ─── Auth Guard ─────────────────────────────────────────────────────────────

const user = guardPage();
if (!user) throw new Error("Not authenticated");

// ─── Render Navigation ──────────────────────────────────────────────────────

const navUnsub = renderNav(document.getElementById("nav-root"));

// ─── State ──────────────────────────────────────────────────────────────────

let allProjects = [];
let allTasks = [];
let dataReady = { projects: false, tasks: false };

const app = document.getElementById("app");
const unsubscribers = [];
const chartInstances = {};

// ─── Subscriptions ──────────────────────────────────────────────────────────

unsubscribers.push(
  subscribeProjects((projects) => {
    allProjects = projects;
    dataReady.projects = true;
    if (dataReady.tasks) render();
  })
);

unsubscribers.push(
  subscribeAllChecklistItems((tasks) => {
    allTasks = tasks;
    dataReady.tasks = true;
    if (dataReady.projects) render();
  })
);

if (navUnsub) unsubscribers.push(navUnsub);

// ─── Chart Color Helpers ────────────────────────────────────────────────────

function isDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function chartColors() {
  const dark = isDark();
  return {
    text: dark ? "#cbd5e1" : "#475569",
    grid: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    surface: dark ? "#1a2234" : "#ffffff",
    tooltipBg: dark ? "#1e293b" : "#ffffff",
    tooltipText: dark ? "#e2e8f0" : "#1e293b",
    tooltipBorder: dark ? "#334155" : "#e2e8f0",
  };
}

const CHART_PALETTE = [
  "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#f97316", "#14b8a6", "#6366f1",
  "#ef4444", "#84cc16",
];

// ─── CSV Download Helper ────────────────────────────────────────────────────

function downloadCSV(csvContent, filename) {
  const BOM = "\uFEFF";
  const csv = BOM + csvContent;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSVRow(fields) {
  return fields.map((f) => {
    const s = String(f == null ? "" : f).replace(/"/g, '""');
    return `"${s}"`;
  }).join(",");
}

// ─── Data Computation Helpers ───────────────────────────────────────────────

function getPhaseForStage(stage) {
  for (const pg of PHASE_GROUPS) {
    if (pg.workStage === stage || pg.gateStage === stage) return pg.name;
  }
  return stage;
}

function getPhaseStages(phaseName) {
  const pg = PHASE_GROUPS.find((p) => p.name === phaseName);
  return pg ? [pg.workStage, pg.gateStage] : [];
}

function isOverdue(task) {
  if (task.status === "completed") return false;
  if (!task.dueDate) return false;
  const d = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < now;
}

function isCompleted(task) {
  return task.status === "completed";
}

function getWeekLabel(weekStart, weekEnd) {
  return `${weekStart.getMonth() + 1}/${weekStart.getDate()}~${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
}

// ─── Section 1: Project Progress Summary ────────────────────────────────────

function computeProjectProgress() {
  return allProjects
    .filter((p) => p.status === "active")
    .map((p) => ({
      id: p.id,
      name: p.name,
      progress: p.progress || 0,
      riskLevel: p.riskLevel || "green",
      currentStage: p.currentStage || "-",
      startDate: p.startDate,
      endDate: p.endDate,
    }))
    .sort((a, b) => a.progress - b.progress);
}

function exportProjectProgressCSV() {
  const data = computeProjectProgress();
  const header = toCSVRow(["프로젝트명", "진행률(%)", "중요도", "현재 단계", "시작일", "종료일"]);
  const rows = data.map((d) =>
    toCSVRow([d.name, d.progress, getRiskLabel(d.riskLevel), d.currentStage, formatDate(d.startDate), formatDate(d.endDate)])
  );
  downloadCSV([header, ...rows].join("\n"), "프로젝트현황_" + new Date().toISOString().slice(0, 10) + ".csv");
}

// ─── Section 2: Department Workload Heatmap ─────────────────────────────────

function computeDepartmentWorkload() {
  return departments.map((dept) => {
    const deptTasks = allTasks.filter((t) => t.department === dept);
    const total = deptTasks.length;
    const completed = deptTasks.filter((t) => isCompleted(t)).length;
    const inProgress = deptTasks.filter((t) => t.status === "in_progress").length;
    const overdue = deptTasks.filter((t) => isOverdue(t)).length;
    const pending = deptTasks.filter((t) => t.status === "pending").length;
    return { dept, total, completed, inProgress, pending, overdue };
  });
}

function exportDeptWorkloadCSV() {
  const data = computeDepartmentWorkload();
  const header = toCSVRow(["부서", "전체", "완료", "진행 중", "대기", "지연"]);
  const rows = data.map((d) =>
    toCSVRow([d.dept, d.total, d.completed, d.inProgress, d.pending, d.overdue])
  );
  downloadCSV([header, ...rows].join("\n"), "부서별업무량_" + new Date().toISOString().slice(0, 10) + ".csv");
}

// ─── Section 3: Phase Bottleneck Analysis ───────────────────────────────────

function computePhaseBottleneck() {
  return PHASE_GROUPS.map((pg) => {
    const stages = [pg.workStage, pg.gateStage];
    const phaseTasks = allTasks.filter((t) => stages.includes(t.stage));
    const total = phaseTasks.length;
    const completed = phaseTasks.filter((t) => isCompleted(t)).length;
    const overdue = phaseTasks.filter((t) => isOverdue(t)).length;
    const inProgress = phaseTasks.filter((t) => t.status === "in_progress").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { name: pg.name, total, completed, overdue, inProgress, completionRate };
  });
}

function exportPhaseCSV() {
  const data = computePhaseBottleneck();
  const header = toCSVRow(["Phase", "전체 작업", "완료", "진행 중", "지연", "완료율(%)"]);
  const rows = data.map((d) =>
    toCSVRow([d.name, d.total, d.completed, d.inProgress, d.overdue, d.completionRate])
  );
  downloadCSV([header, ...rows].join("\n"), "Phase별분석_" + new Date().toISOString().slice(0, 10) + ".csv");
}

// ─── Section 4: Weekly/Monthly Completion Trend ─────────────────────────────

function computeWeeklyTrend(weeks = 8) {
  const now = new Date();
  const result = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now.getTime() - w * 7 * 86400000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
    const completed = allTasks.filter((t) => {
      if (!t.completedDate) return false;
      const cd = t.completedDate instanceof Date ? t.completedDate : new Date(t.completedDate);
      return cd >= weekStart && cd < weekEnd;
    }).length;
    result.push({ label: getWeekLabel(weekStart, weekEnd), completed, weekStart, weekEnd });
  }
  return result;
}

function computeMonthlyTrend(months = 6) {
  const now = new Date();
  const result = [];
  for (let m = months - 1; m >= 0; m--) {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const completed = allTasks.filter((t) => {
      if (!t.completedDate) return false;
      const cd = t.completedDate instanceof Date ? t.completedDate : new Date(t.completedDate);
      return cd >= monthStart && cd < monthEnd;
    }).length;
    const created = allTasks.filter((t) => {
      if (!t.createdAt) return false;
      const ca = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
      return ca >= monthStart && ca < monthEnd;
    }).length;
    result.push({
      label: `${monthStart.getFullYear()}.${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
      completed,
      created,
    });
  }
  return result;
}

function exportTrendCSV() {
  const weekly = computeWeeklyTrend(8);
  const header = toCSVRow(["기간", "완료 작업 수"]);
  const rows = weekly.map((d) => toCSVRow([d.label, d.completed]));
  downloadCSV([header, ...rows].join("\n"), "완료추이_주간_" + new Date().toISOString().slice(0, 10) + ".csv");
}

// ─── Section 5: Assignee Workload ───────────────────────────────────────────

function computeAssigneeWorkload() {
  const assigneeMap = {};
  for (const task of allTasks) {
    const name = task.assignee || "미배정";
    if (!assigneeMap[name]) {
      assigneeMap[name] = { name, total: 0, completed: 0, inProgress: 0, overdue: 0, pending: 0 };
    }
    assigneeMap[name].total++;
    if (isCompleted(task)) assigneeMap[name].completed++;
    else if (task.status === "in_progress") assigneeMap[name].inProgress++;
    else if (task.status === "pending") assigneeMap[name].pending++;
    if (isOverdue(task)) assigneeMap[name].overdue++;
  }
  return Object.values(assigneeMap).sort((a, b) => b.total - a.total);
}

function exportAssigneeCSV() {
  const data = computeAssigneeWorkload();
  const header = toCSVRow(["담당자", "전체", "완료", "진행 중", "대기", "지연"]);
  const rows = data.map((d) =>
    toCSVRow([d.name, d.total, d.completed, d.inProgress, d.pending, d.overdue])
  );
  downloadCSV([header, ...rows].join("\n"), "담당자별워크로드_" + new Date().toISOString().slice(0, 10) + ".csv");
}

// ─── Render ─────────────────────────────────────────────────────────────────

function render() {
  const projectData = computeProjectProgress();
  const deptData = computeDepartmentWorkload();
  const phaseData = computePhaseBottleneck();
  const assigneeData = computeAssigneeWorkload();

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => isCompleted(t)).length;
  const overdueTasks = allTasks.filter((t) => isOverdue(t)).length;
  const activeProjects = allProjects.filter((p) => p.status === "active").length;

  app.innerHTML = `
    <div class="container animate-fade-in">
      <!-- Page Header -->
      <div class="rpt-header">
        <div>
          <h1 class="text-2xl font-bold tracking-tight" style="color: var(--slate-100)">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;margin-right:0.5rem;color:var(--primary-400)">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            보고서
          </h1>
          <p class="text-sm mt-1" style="color: var(--slate-400)">프로젝트 현황 및 업무 분석 리포트</p>
        </div>
      </div>

      <!-- Summary Stat Cards -->
      <div class="rpt-summary-grid">
        <div class="stat-card">
          <div class="stat-card-label">활성 프로젝트</div>
          <div class="stat-card-row"><span class="stat-value" style="color: var(--primary-400)">${activeProjects}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">전체 작업</div>
          <div class="stat-card-row"><span class="stat-value" style="color: var(--slate-200)">${totalTasks}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">완료 작업</div>
          <div class="stat-card-row"><span class="stat-value" style="color: var(--success-400)">${completedTasks}</span></div>
          <div class="stat-sub" style="color: var(--success-400)">${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% 달성</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">지연 작업</div>
          <div class="stat-card-row"><span class="stat-value" style="color: var(--danger-400)">${overdueTasks}</span></div>
          ${overdueTasks > 0 ? `<div class="stat-sub" style="color: var(--danger-400)">즉시 조치 필요</div>` : `<div class="stat-sub" style="color: var(--success-400)">양호</div>`}
        </div>
      </div>

      <!-- Report Sections Grid -->
      <div class="rpt-grid">

        <!-- Section 1: Project Progress (Bar Chart) -->
        <div class="card rpt-section rpt-col-full">
          <div class="rpt-section-header">
            <div class="rpt-section-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              <span>프로젝트 현황 리포트</span>
            </div>
            <button class="btn btn-sm rpt-csv-btn" data-csv="project-progress">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              CSV
            </button>
          </div>
          <div class="rpt-chart-container" style="height: 320px;">
            <canvas id="chart-project-progress"></canvas>
          </div>
        </div>

        <!-- Section 2: Department Workload (Heatmap Table) -->
        <div class="card rpt-section rpt-col-full">
          <div class="rpt-section-header">
            <div class="rpt-section-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span>부서별 업무량</span>
            </div>
            <button class="btn btn-sm rpt-csv-btn" data-csv="dept-workload">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              CSV
            </button>
          </div>
          <div class="table-responsive">
            <table class="rpt-heatmap-table">
              <thead>
                <tr>
                  <th>부서</th>
                  <th>전체</th>
                  <th>완료</th>
                  <th>진행 중</th>
                  <th>대기</th>
                  <th>지연</th>
                  <th>완료율</th>
                </tr>
              </thead>
              <tbody>
                ${deptData.map((d) => {
                  const rate = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0;
                  return `<tr>
                    <td class="rpt-dept-name">${escapeHtml(d.dept)}</td>
                    <td class="rpt-cell-num">${d.total}</td>
                    <td class="rpt-cell-num"><span class="rpt-hm-cell rpt-hm-success" style="opacity: ${d.total > 0 ? Math.max(0.2, d.completed / d.total) : 0.1}">${d.completed}</span></td>
                    <td class="rpt-cell-num"><span class="rpt-hm-cell rpt-hm-primary" style="opacity: ${d.total > 0 ? Math.max(0.2, d.inProgress / d.total) : 0.1}">${d.inProgress}</span></td>
                    <td class="rpt-cell-num"><span class="rpt-hm-cell rpt-hm-neutral" style="opacity: ${d.total > 0 ? Math.max(0.2, d.pending / d.total) : 0.1}">${d.pending}</span></td>
                    <td class="rpt-cell-num"><span class="rpt-hm-cell rpt-hm-danger ${d.overdue > 0 ? "rpt-hm-danger-active" : ""}">${d.overdue}</span></td>
                    <td class="rpt-cell-num">
                      <div class="rpt-rate-bar">
                        <div class="rpt-rate-fill" style="width: ${rate}%;"></div>
                      </div>
                      <span class="rpt-rate-text">${rate}%</span>
                    </td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 3: Phase Bottleneck (Doughnut Chart) -->
        <div class="card rpt-section">
          <div class="rpt-section-header">
            <div class="rpt-section-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>
              <span>Phase별 병목 분석</span>
            </div>
            <button class="btn btn-sm rpt-csv-btn" data-csv="phase-bottleneck">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              CSV
            </button>
          </div>
          <div class="rpt-chart-container" style="height: 280px;">
            <canvas id="chart-phase-bottleneck"></canvas>
          </div>
          <div class="rpt-phase-legend">
            ${phaseData.map((p, i) => `
              <div class="rpt-phase-item">
                <span class="rpt-phase-dot" style="background: ${CHART_PALETTE[i]}"></span>
                <span class="rpt-phase-name">${escapeHtml(p.name)}</span>
                <span class="rpt-phase-stat">${p.completionRate}%</span>
                ${p.overdue > 0 ? `<span class="badge badge-danger" style="font-size:0.625rem;padding:0.0625rem 0.375rem">지연 ${p.overdue}</span>` : ""}
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Section 4: Weekly/Monthly Completion Trend (Line Chart) -->
        <div class="card rpt-section">
          <div class="rpt-section-header">
            <div class="rpt-section-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              <span>주간/월간 완료 추이</span>
            </div>
            <div class="rpt-section-actions">
              <div class="rpt-trend-toggle" id="trend-toggle">
                <button class="rpt-trend-btn active" data-trend="weekly">주간</button>
                <button class="rpt-trend-btn" data-trend="monthly">월간</button>
              </div>
              <button class="btn btn-sm rpt-csv-btn" data-csv="trend">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                CSV
              </button>
            </div>
          </div>
          <div class="rpt-chart-container" style="height: 280px;">
            <canvas id="chart-trend"></canvas>
          </div>
        </div>

        <!-- Section 5: Assignee Workload (Horizontal Bar Chart) -->
        <div class="card rpt-section rpt-col-full">
          <div class="rpt-section-header">
            <div class="rpt-section-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              <span>담당자별 워크로드</span>
            </div>
            <button class="btn btn-sm rpt-csv-btn" data-csv="assignee-workload">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              CSV
            </button>
          </div>
          <div class="rpt-chart-container" style="height: ${Math.max(300, assigneeData.length * 36)}px;">
            <canvas id="chart-assignee"></canvas>
          </div>
        </div>

      </div>
    </div>
  `;

  bindEvents();
  renderCharts("weekly");
}

// ─── Chart Rendering ────────────────────────────────────────────────────────

function destroyChart(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    delete chartInstances[key];
  }
}

function renderCharts(trendMode) {
  const c = chartColors();

  // 1. Project Progress — horizontal bar chart
  const projectData = computeProjectProgress();
  const ctx1 = document.getElementById("chart-project-progress");
  if (ctx1) {
    destroyChart("projectProgress");
    chartInstances.projectProgress = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: projectData.map((p) => p.name.length > 15 ? p.name.slice(0, 15) + "..." : p.name),
        datasets: [{
          label: "진행률 (%)",
          data: projectData.map((p) => p.progress),
          backgroundColor: projectData.map((p) => {
            if (p.progress >= 80) return "rgba(16, 185, 129, 0.7)";
            if (p.progress >= 40) return "rgba(6, 182, 212, 0.7)";
            return "rgba(245, 158, 11, 0.7)";
          }),
          borderRadius: 4,
          barThickness: 24,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: c.tooltipBg,
            titleColor: c.tooltipText,
            bodyColor: c.tooltipText,
            borderColor: c.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return projectData[idx].name;
              },
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const p = projectData[idx];
                return [`중요도: ${getRiskLabel(p.riskLevel)}`, `단계: ${p.currentStage}`];
              },
            },
          },
        },
        scales: {
          x: {
            min: 0, max: 100,
            ticks: { color: c.text, callback: (v) => v + "%" },
            grid: { color: c.grid },
          },
          y: {
            ticks: { color: c.text, font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });
  }

  // 3. Phase Bottleneck — doughnut chart
  const phaseData = computePhaseBottleneck();
  const ctx3 = document.getElementById("chart-phase-bottleneck");
  if (ctx3) {
    destroyChart("phaseBottleneck");
    const overdueData = phaseData.map((p) => p.overdue);
    chartInstances.phaseBottleneck = new Chart(ctx3, {
      type: "doughnut",
      data: {
        labels: phaseData.map((p) => p.name),
        datasets: [{
          data: overdueData.every((v) => v === 0) ? phaseData.map((p) => p.total) : overdueData,
          backgroundColor: CHART_PALETTE.slice(0, 6),
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "55%",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: c.tooltipBg,
            titleColor: c.tooltipText,
            bodyColor: c.tooltipText,
            borderColor: c.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const p = phaseData[idx];
                return [
                  `전체: ${p.total}건`,
                  `완료: ${p.completed}건 (${p.completionRate}%)`,
                  `지연: ${p.overdue}건`,
                ];
              },
            },
          },
        },
      },
    });
  }

  // 4. Trend — line chart
  renderTrendChart(trendMode);

  // 5. Assignee Workload — horizontal stacked bar chart
  const assigneeData = computeAssigneeWorkload().slice(0, 15);
  const ctx5 = document.getElementById("chart-assignee");
  if (ctx5) {
    destroyChart("assignee");
    chartInstances.assignee = new Chart(ctx5, {
      type: "bar",
      data: {
        labels: assigneeData.map((a) => a.name),
        datasets: [
          {
            label: "완료",
            data: assigneeData.map((a) => a.completed),
            backgroundColor: "rgba(16, 185, 129, 0.7)",
            borderRadius: 2,
          },
          {
            label: "진행 중",
            data: assigneeData.map((a) => a.inProgress),
            backgroundColor: "rgba(6, 182, 212, 0.7)",
            borderRadius: 2,
          },
          {
            label: "대기",
            data: assigneeData.map((a) => a.pending),
            backgroundColor: "rgba(148, 163, 184, 0.4)",
            borderRadius: 2,
          },
          {
            label: "지연",
            data: assigneeData.map((a) => a.overdue),
            backgroundColor: "rgba(239, 68, 68, 0.7)",
            borderRadius: 2,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: c.text, font: { size: 11 }, usePointStyle: true, pointStyle: "rectRounded" },
          },
          tooltip: {
            backgroundColor: c.tooltipBg,
            titleColor: c.tooltipText,
            bodyColor: c.tooltipText,
            borderColor: c.tooltipBorder,
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: c.text, stepSize: 1 },
            grid: { color: c.grid },
          },
          y: {
            stacked: true,
            ticks: { color: c.text, font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });
  }
}

function renderTrendChart(mode) {
  const c = chartColors();
  const ctx4 = document.getElementById("chart-trend");
  if (!ctx4) return;

  destroyChart("trend");

  if (mode === "weekly") {
    const weeklyData = computeWeeklyTrend(8);
    chartInstances.trend = new Chart(ctx4, {
      type: "line",
      data: {
        labels: weeklyData.map((d) => d.label),
        datasets: [{
          label: "완료된 작업",
          data: weeklyData.map((d) => d.completed),
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6, 182, 212, 0.1)",
          fill: true,
          tension: 0.3,
          pointBackgroundColor: "#06b6d4",
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: c.tooltipBg,
            titleColor: c.tooltipText,
            bodyColor: c.tooltipText,
            borderColor: c.tooltipBorder,
            borderWidth: 1,
          },
        },
        scales: {
          x: { ticks: { color: c.text, font: { size: 10 } }, grid: { color: c.grid } },
          y: { beginAtZero: true, ticks: { color: c.text, stepSize: 1 }, grid: { color: c.grid } },
        },
      },
    });
  } else {
    const monthlyData = computeMonthlyTrend(6);
    chartInstances.trend = new Chart(ctx4, {
      type: "bar",
      data: {
        labels: monthlyData.map((d) => d.label),
        datasets: [
          {
            label: "생성",
            data: monthlyData.map((d) => d.created),
            backgroundColor: "rgba(148, 163, 184, 0.4)",
            borderRadius: 4,
          },
          {
            label: "완료",
            data: monthlyData.map((d) => d.completed),
            backgroundColor: "rgba(6, 182, 212, 0.7)",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: c.text, font: { size: 11 }, usePointStyle: true, pointStyle: "rectRounded" },
          },
          tooltip: {
            backgroundColor: c.tooltipBg,
            titleColor: c.tooltipText,
            bodyColor: c.tooltipText,
            borderColor: c.tooltipBorder,
            borderWidth: 1,
          },
        },
        scales: {
          x: { ticks: { color: c.text }, grid: { color: c.grid } },
          y: { beginAtZero: true, ticks: { color: c.text, stepSize: 1 }, grid: { color: c.grid } },
        },
      },
    });
  }
}

// ─── Event Binding ──────────────────────────────────────────────────────────

function bindEvents() {
  // CSV export buttons
  app.addEventListener("click", (e) => {
    const csvBtn = e.target.closest("[data-csv]");
    if (csvBtn) {
      const type = csvBtn.dataset.csv;
      switch (type) {
        case "project-progress": exportProjectProgressCSV(); break;
        case "dept-workload": exportDeptWorkloadCSV(); break;
        case "phase-bottleneck": exportPhaseCSV(); break;
        case "trend": exportTrendCSV(); break;
        case "assignee-workload": exportAssigneeCSV(); break;
      }
      return;
    }

    // Trend toggle
    const trendBtn = e.target.closest("[data-trend]");
    if (trendBtn) {
      const mode = trendBtn.dataset.trend;
      const toggleContainer = document.getElementById("trend-toggle");
      if (toggleContainer) {
        toggleContainer.querySelectorAll(".rpt-trend-btn").forEach((b) => b.classList.remove("active"));
        trendBtn.classList.add("active");
      }
      renderTrendChart(mode);
    }
  });
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

window.addEventListener("beforeunload", () => {
  unsubscribers.forEach((fn) => typeof fn === "function" && fn());
  Object.keys(chartInstances).forEach((k) => destroyChart(k));
});
