// ═══════════════════════════════════════════════════════════════════════════════
// Reports Page Controller — Analytics & Charts
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage } from "../auth.js";
import { renderNav, initTheme } from "../components.js";
import {
  subscribeProjects,
  subscribeAllChecklistItems,
  subscribeAllGateRecords,
  subscribeAllLessons,
} from "../firestore-service.js";
import {
  escapeHtml,
  departments,
  PHASE_GROUPS,
  formatDate,
  getRiskLabel,
  toLocalDateStr,
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
let allGateRecords = [];
let allLessons = [];
let dataReady = { projects: false, tasks: false, gates: false, lessons: false };

const app = document.getElementById("app");
const unsubscribers = [];
const chartInstances = {};

// ─── Subscriptions ──────────────────────────────────────────────────────────

function tryRender() {
  if (dataReady.projects && dataReady.tasks && dataReady.gates && dataReady.lessons) render();
}

unsubscribers.push(
  subscribeProjects((projects) => {
    allProjects = projects;
    dataReady.projects = true;
    tryRender();
  })
);

unsubscribers.push(
  subscribeAllChecklistItems((tasks) => {
    allTasks = tasks;
    dataReady.tasks = true;
    tryRender();
  })
);

unsubscribers.push(
  subscribeAllGateRecords((records) => {
    allGateRecords = records;
    dataReady.gates = true;
    tryRender();
  })
);

unsubscribers.push(
  subscribeAllLessons((lessons) => {
    allLessons = lessons;
    dataReady.lessons = true;
    tryRender();
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

function _getPhaseForStage(stage) {
  for (const pg of PHASE_GROUPS) {
    if (pg.workStage === stage || pg.gateStage === stage) return pg.name;
  }
  return stage;
}

function _getPhaseStages(phaseName) {
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
  downloadCSV([header, ...rows].join("\n"), "프로젝트현황_" + toLocalDateStr(new Date()) + ".csv");
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
  downloadCSV([header, ...rows].join("\n"), "부서별업무량_" + toLocalDateStr(new Date()) + ".csv");
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
  downloadCSV([header, ...rows].join("\n"), "Phase별분석_" + toLocalDateStr(new Date()) + ".csv");
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
  downloadCSV([header, ...rows].join("\n"), "완료추이_주간_" + toLocalDateStr(new Date()) + ".csv");
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

// ─── Section 6: Assignee×Project Heatmap (개인별 프로젝트 횡단 워크로드) ────

const OVERLOAD_THRESHOLD = 8; // 미완료 작업 N건 이상이면 과부하

function computeAssigneeProjectHeatmap() {
  const activeProjects = allProjects.filter(p => p.status === "active");
  const activeTasks = allTasks.filter(t => t.status !== "completed" && t.assignee);

  // 담당자 목록 (미완료 작업 보유자만)
  const assigneeSet = new Set(activeTasks.map(t => t.assignee));
  const assignees = [...assigneeSet].sort();

  // 담당자×프로젝트 매트릭스
  const matrix = {};
  const assigneeTotals = {};

  for (const name of assignees) {
    matrix[name] = {};
    assigneeTotals[name] = { active: 0, overdue: 0, projects: new Set() };
  }

  for (const task of activeTasks) {
    const name = task.assignee;
    const projId = task.projectId;
    if (!matrix[name][projId]) matrix[name][projId] = { total: 0, overdue: 0 };
    matrix[name][projId].total++;
    assigneeTotals[name].active++;
    assigneeTotals[name].projects.add(projId);
    if (isOverdue(task)) {
      matrix[name][projId].overdue++;
      assigneeTotals[name].overdue++;
    }
  }

  // 과부하 순으로 정렬
  assignees.sort((a, b) => assigneeTotals[b].active - assigneeTotals[a].active);

  return { assignees, activeProjects, matrix, assigneeTotals };
}

function exportHeatmapCSV() {
  const { assignees, activeProjects, matrix, assigneeTotals } = computeAssigneeProjectHeatmap();
  const projNames = activeProjects.map(p => p.name);
  const header = toCSVRow(["담당자", "미완료", "지연", "프로젝트 수", ...projNames]);
  const rows = assignees.map(name => {
    const t = assigneeTotals[name];
    const cells = activeProjects.map(p => {
      const cell = matrix[name][p.id];
      return cell ? (cell.overdue > 0 ? `${cell.total}(지연${cell.overdue})` : cell.total) : "";
    });
    return toCSVRow([name, t.active, t.overdue, t.projects.size, ...cells]);
  });
  downloadCSV([header, ...rows].join("\n"), "워크로드히트맵_" + toLocalDateStr(new Date()) + ".csv");
}

// ─── Section 7: Resource Conflict Detection (교차 프로젝트 리소스 충돌) ──────

function computeResourceConflicts() {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 86400000);
  const activeTasks = allTasks.filter(t =>
    t.status !== "completed" && t.assignee && t.dueDate
  );

  // 담당자별 이번 주 마감 작업 그룹핑
  const assigneeUpcoming = {};
  for (const task of activeTasks) {
    const due = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
    if (due > weekLater) continue; // 이번 주 이후는 제외
    const name = task.assignee;
    if (!assigneeUpcoming[name]) assigneeUpcoming[name] = [];
    assigneeUpcoming[name].push(task);
  }

  // 2개 이상 프로젝트에서 동시 마감인 사람만 추출
  const conflicts = [];
  for (const [name, tasks] of Object.entries(assigneeUpcoming)) {
    const projectIds = new Set(tasks.map(t => t.projectId));
    if (projectIds.size < 2) continue;
    conflicts.push({
      name,
      taskCount: tasks.length,
      projectCount: projectIds.size,
      tasks: tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    });
  }

  return conflicts.sort((a, b) => b.taskCount - a.taskCount);
}

function exportAssigneeCSV() {
  const data = computeAssigneeWorkload();
  const header = toCSVRow(["담당자", "전체", "완료", "진행 중", "대기", "지연"]);
  const rows = data.map((d) =>
    toCSVRow([d.name, d.total, d.completed, d.inProgress, d.pending, d.overdue])
  );
  downloadCSV([header, ...rows].join("\n"), "담당자별워크로드_" + toLocalDateStr(new Date()) + ".csv");
}

// ─── Section 9: Approval Anomaly Detection (승인 이상 감지) ─────────────────

function computeApprovalAnomalies() {
  const now = new Date();
  const anomalies = [];

  // 승인 완료된 기록에서 평균 처리 시간 계산
  const completedGates = allGateRecords.filter(g =>
    g.gateStatus !== "pending" && g.createdAt && g.approvedAt
  );

  const approvalTimes = completedGates.map(g => {
    const created = g.createdAt instanceof Date ? g.createdAt : new Date(g.createdAt);
    const approved = g.approvedAt instanceof Date ? g.approvedAt : new Date(g.approvedAt);
    return (approved - created) / 86400000; // days
  }).filter(d => d > 0);

  const avgApprovalDays = approvalTimes.length > 0
    ? approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length
    : 5; // 기본값 5일

  const stdDev = approvalTimes.length > 1
    ? Math.sqrt(approvalTimes.reduce((sum, d) => sum + (d - avgApprovalDays) ** 2, 0) / approvalTimes.length)
    : avgApprovalDays * 0.5;

  // 대기 중인 Gate 중 이상치 탐색
  const pendingGates = allGateRecords.filter(g => g.gateStatus === "pending" && g.createdAt);

  for (const gate of pendingGates) {
    const created = gate.createdAt instanceof Date ? gate.createdAt : new Date(gate.createdAt);
    const waitingDays = (now - created) / 86400000;

    // 평균 + 1.5*표준편차 초과 시 이상
    const threshold = avgApprovalDays + 1.5 * stdDev;
    if (waitingDays <= Math.max(threshold, 3)) continue; // 최소 3일은 대기

    const project = allProjects.find(p => p.id === gate.projectId);
    const severity = waitingDays > avgApprovalDays + 3 * stdDev ? "critical" : "warning";

    anomalies.push({
      gate,
      project,
      waitingDays: Math.round(waitingDays * 10) / 10,
      avgDays: Math.round(avgApprovalDays * 10) / 10,
      deviation: Math.round(((waitingDays - avgApprovalDays) / (stdDev || 1)) * 10) / 10,
      severity,
    });
  }

  return {
    anomalies: anomalies.sort((a, b) => b.waitingDays - a.waitingDays),
    avgApprovalDays: Math.round(avgApprovalDays * 10) / 10,
    completedCount: completedGates.length,
    pendingCount: pendingGates.length,
  };
}

// ─── Section 8: Delay Prediction (지연 추세 예측) ────────────────────────────

function computeDelayPredictions() {
  const activeProjects = allProjects.filter(p => p.status === "active");
  const predictions = [];

  for (const project of activeProjects) {
    const projTasks = allTasks.filter(t => t.projectId === project.id);
    const totalTasks = projTasks.length;
    if (totalTasks === 0) continue;

    const completedTasks = projTasks.filter(t => isCompleted(t));
    const completedCount = completedTasks.length;
    const remainingCount = totalTasks - completedCount;

    if (remainingCount === 0) continue; // 완료된 프로젝트 제외

    // 완료된 작업들의 평균 소요 기간 (생성→완료)
    let avgDaysPerTask = 7; // 기본값
    const durations = [];
    for (const t of completedTasks) {
      if (t.completedDate && t.createdAt) {
        const start = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
        const end = t.completedDate instanceof Date ? t.completedDate : new Date(t.completedDate);
        const days = Math.max(1, Math.round((end - start) / 86400000));
        durations.push(days);
      }
    }
    if (durations.length > 0) {
      avgDaysPerTask = durations.reduce((a, b) => a + b, 0) / durations.length;
    }

    // 최근 2주간 완료 속도 (일평균)
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
    const recentCompleted = completedTasks.filter(t => {
      const cd = t.completedDate instanceof Date ? t.completedDate : new Date(t.completedDate);
      return cd >= twoWeeksAgo;
    }).length;
    const dailyRate = recentCompleted / 14;

    // 예상 남은 일수
    const estimatedRemainingDays = dailyRate > 0
      ? Math.ceil(remainingCount / dailyRate)
      : Math.ceil(remainingCount * avgDaysPerTask);

    const now = new Date();
    const estimatedEndDate = new Date(now.getTime() + estimatedRemainingDays * 86400000);
    const plannedEndDate = project.endDate instanceof Date ? project.endDate : new Date(project.endDate);
    const delayDays = Math.round((estimatedEndDate - plannedEndDate) / 86400000);

    // Phase별 진행 상태
    const phaseStatus = PHASE_GROUPS.map(pg => {
      const stageTasks = projTasks.filter(t => t.stage === pg.workStage || t.stage === pg.gateStage);
      const done = stageTasks.filter(t => isCompleted(t)).length;
      const total = stageTasks.length;
      const overdue = stageTasks.filter(t => isOverdue(t)).length;
      return { name: pg.name, done, total, overdue, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    });

    predictions.push({
      project,
      totalTasks,
      completedCount,
      remainingCount,
      dailyRate: Math.round(dailyRate * 10) / 10,
      avgDaysPerTask: Math.round(avgDaysPerTask * 10) / 10,
      estimatedEndDate,
      plannedEndDate,
      delayDays,
      delayRisk: delayDays > 14 ? "high" : delayDays > 3 ? "medium" : "low",
      phaseStatus,
    });
  }

  // 지연 위험 높은 순 정렬
  return predictions.sort((a, b) => b.delayDays - a.delayDays);
}

// ─── Section 6 & 7 Render Helpers ────────────────────────────────────────────

function renderAssigneeHeatmapSection() {
  const { assignees, activeProjects, matrix, assigneeTotals } = computeAssigneeProjectHeatmap();
  if (assignees.length === 0) return "";

  const projHeaders = activeProjects.map(p => {
    const shortName = p.name.length > 8 ? p.name.slice(0, 8) + ".." : p.name;
    return `<th class="rpt-hm-proj-header" title="${escapeHtml(p.name)}">${escapeHtml(shortName)}</th>`;
  }).join("");

  const rows = assignees.map(name => {
    const t = assigneeTotals[name];
    const isOverloaded = t.active >= OVERLOAD_THRESHOLD;
    const rowClass = isOverloaded ? "rpt-overload-row" : "";

    const projCells = activeProjects.map(p => {
      const cell = matrix[name][p.id];
      if (!cell) return `<td class="rpt-cell-num rpt-hm-empty">-</td>`;
      const intensity = Math.min(1, cell.total / 10);
      const bg = cell.overdue > 0
        ? `rgba(239,68,68,${Math.max(0.2, intensity)})`
        : `rgba(6,182,212,${Math.max(0.15, intensity)})`;
      return `<td class="rpt-cell-num" style="background:${bg};font-weight:600;" title="${escapeHtml(name)} / ${escapeHtml(p.name)}: ${cell.total}건${cell.overdue > 0 ? ` (지연 ${cell.overdue})` : ""}">
        ${cell.total}${cell.overdue > 0 ? `<span style="color:var(--danger-400);font-size:0.625rem;"> !</span>` : ""}
      </td>`;
    }).join("");

    return `<tr class="${rowClass}">
      <td class="rpt-dept-name" style="white-space:nowrap;">
        ${escapeHtml(name)}
        ${isOverloaded ? `<span class="badge badge-danger" style="font-size:0.5625rem;padding:0.0625rem 0.25rem;margin-left:0.25rem;">과부하</span>` : ""}
      </td>
      <td class="rpt-cell-num" style="font-weight:700;color:${isOverloaded ? "var(--danger-400)" : "var(--slate-200)"}">${t.active}</td>
      <td class="rpt-cell-num">${t.overdue > 0 ? `<span style="color:var(--danger-400);font-weight:600;">${t.overdue}</span>` : "0"}</td>
      <td class="rpt-cell-num">${t.projects.size}</td>
      ${projCells}
    </tr>`;
  }).join("");

  return `
    <div class="card rpt-section rpt-col-full">
      <div class="rpt-section-header">
        <div class="rpt-section-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
          <span>담당자 × 프로젝트 워크로드 히트맵</span>
        </div>
        <button class="btn btn-sm rpt-csv-btn" data-csv="heatmap">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          CSV
        </button>
      </div>
      <div class="text-xs mb-2" style="color:var(--slate-400);padding:0 1rem;">
        셀 색상 강도 = 작업 수, <span style="color:var(--danger-400)">빨간색</span> = 지연 포함, 미완료 ${OVERLOAD_THRESHOLD}건 이상 = <span class="badge badge-danger" style="font-size:0.5625rem;padding:0.0625rem 0.25rem;">과부하</span>
      </div>
      <div class="table-responsive">
        <table class="rpt-heatmap-table" style="font-size:0.75rem;">
          <thead>
            <tr>
              <th>담당자</th>
              <th>미완료</th>
              <th>지연</th>
              <th>프로젝트</th>
              ${projHeaders}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderResourceConflictsSection() {
  const conflicts = computeResourceConflicts();
  if (conflicts.length === 0) {
    return `
      <div class="card rpt-section rpt-col-full">
        <div class="rpt-section-header">
          <div class="rpt-section-title">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            <span>교차 프로젝트 리소스 충돌</span>
          </div>
        </div>
        <div class="empty-state" style="padding:2rem 1rem;">
          <span class="empty-state-text" style="color:var(--success-400)">이번 주 리소스 충돌 없음</span>
        </div>
      </div>
    `;
  }

  const rows = conflicts.map(c => {
    const projGroups = {};
    c.tasks.forEach(t => {
      const pName = allProjects.find(p => p.id === t.projectId)?.name || t.projectId;
      if (!projGroups[pName]) projGroups[pName] = [];
      projGroups[pName].push(t);
    });
    const projDetail = Object.entries(projGroups).map(([pName, tasks]) =>
      `<span class="badge badge-neutral" style="font-size:0.625rem;margin-right:0.25rem;" title="${tasks.map(t => t.title).join(", ")}">${escapeHtml(pName.length > 12 ? pName.slice(0,12)+".." : pName)} (${tasks.length})</span>`
    ).join("");

    return `<tr>
      <td class="rpt-dept-name" style="white-space:nowrap;">
        <span style="color:var(--warning-400);margin-right:0.25rem;">⚠</span>${escapeHtml(c.name)}
      </td>
      <td class="rpt-cell-num" style="font-weight:700;color:var(--danger-400)">${c.taskCount}</td>
      <td class="rpt-cell-num">${c.projectCount}</td>
      <td>${projDetail}</td>
    </tr>`;
  }).join("");

  return `
    <div class="card rpt-section rpt-col-full">
      <div class="rpt-section-header">
        <div class="rpt-section-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
          <span>교차 프로젝트 리소스 충돌 <span class="badge badge-danger" style="font-size:0.625rem;">${conflicts.length}명</span></span>
        </div>
      </div>
      <div class="text-xs mb-2" style="color:var(--slate-400);padding:0 1rem;">
        이번 주 내 2개 이상 프로젝트에서 동시 마감 작업을 가진 담당자
      </div>
      <div class="table-responsive">
        <table class="rpt-heatmap-table" style="font-size:0.75rem;">
          <thead>
            <tr>
              <th>담당자</th>
              <th>마감 작업</th>
              <th>프로젝트 수</th>
              <th>상세</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

let lessonSearchTerm = "";
let lessonFilterPhase = "";
let lessonFilterCategory = "";

function renderLessonsSection() {
  if (allLessons.length === 0) {
    return `
      <div class="card rpt-section rpt-col-full">
        <div class="rpt-section-header">
          <div class="rpt-section-title">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            <span>Lessons Learned</span>
          </div>
        </div>
        <div class="empty-state" style="padding:2rem 1rem;">
          <span class="empty-state-text">등록된 교훈이 없습니다. 프로젝트 상세 → 교훈 탭에서 추가할 수 있습니다.</span>
        </div>
      </div>
    `;
  }

  // 필터링
  let filtered = allLessons;
  if (lessonSearchTerm) {
    const term = lessonSearchTerm.toLowerCase();
    filtered = filtered.filter(l =>
      (l.title || "").toLowerCase().includes(term) ||
      (l.content || "").toLowerCase().includes(term) ||
      (l.tags || []).some(t => t.toLowerCase().includes(term))
    );
  }
  if (lessonFilterPhase) {
    filtered = filtered.filter(l => l.phase === lessonFilterPhase);
  }
  if (lessonFilterCategory) {
    filtered = filtered.filter(l => l.category === lessonFilterCategory);
  }

  // 카테고리/Phase별 통계
  const categories = {};
  const phases = {};
  allLessons.forEach(l => {
    if (l.category) categories[l.category] = (categories[l.category] || 0) + 1;
    if (l.phase) phases[l.phase] = (phases[l.phase] || 0) + 1;
  });

  const categoryOptions = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `<option value="${escapeHtml(c)}" ${lessonFilterCategory === c ? "selected" : ""}>${escapeHtml(c)} (${n})</option>`)
    .join("");

  const phaseOptions = Object.entries(phases)
    .sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `<option value="${escapeHtml(p)}" ${lessonFilterPhase === p ? "selected" : ""}>${escapeHtml(p)} (${n})</option>`)
    .join("");

  const lessonCards = filtered.slice(0, 20).map(l => {
    const project = allProjects.find(p => p.id === l.projectId);
    const tags = (l.tags || []).map(t => `<span class="badge badge-neutral" style="font-size:0.5625rem;padding:0.0625rem 0.25rem;">${escapeHtml(t)}</span>`).join("");

    return `<div class="card" style="padding:0.75rem;margin-bottom:0.5rem;border-left:3px solid var(--primary-400);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.8rem;color:var(--slate-100);margin-bottom:0.25rem;">${escapeHtml(l.title)}</div>
          <div style="font-size:0.75rem;color:var(--slate-300);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(l.content)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.25rem;flex-shrink:0;">
          <span style="font-size:0.75rem;color:var(--primary-400);">👍 ${l.upvotes || 0}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.4rem;flex-wrap:wrap;">
        ${l.phase ? `<span class="badge badge-primary" style="font-size:0.5625rem;padding:0.0625rem 0.3rem;">${escapeHtml(l.phase)}</span>` : ""}
        ${l.category ? `<span class="badge badge-neutral" style="font-size:0.5625rem;padding:0.0625rem 0.3rem;">${escapeHtml(l.category)}</span>` : ""}
        ${tags}
        <span class="text-xs" style="color:var(--slate-500);margin-left:auto;">${project ? escapeHtml(project.name.slice(0,15)) : ""} · ${escapeHtml(l.author || "")} · ${l.createdAt ? formatDate(l.createdAt) : ""}</span>
      </div>
    </div>`;
  }).join("");

  return `
    <div class="card rpt-section rpt-col-full">
      <div class="rpt-section-header">
        <div class="rpt-section-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          <span>Lessons Learned <span class="badge badge-neutral" style="font-size:0.625rem;">${allLessons.length}건</span></span>
        </div>
      </div>
      <div style="padding:0 1rem;margin-bottom:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
        <input type="text" id="lesson-search" placeholder="교훈 검색 (제목, 내용, 태그)" value="${escapeHtml(lessonSearchTerm)}" style="flex:1;min-width:150px;padding:0.4rem 0.6rem;font-size:0.75rem;border:1px solid var(--surface-4);border-radius:var(--radius-md);background:var(--surface-1);color:var(--text-primary);">
        <select id="lesson-filter-phase" style="padding:0.35rem 0.5rem;font-size:0.75rem;border:1px solid var(--surface-4);border-radius:var(--radius-md);background:var(--surface-1);color:var(--text-primary);">
          <option value="">전체 Phase</option>
          ${phaseOptions}
        </select>
        <select id="lesson-filter-category" style="padding:0.35rem 0.5rem;font-size:0.75rem;border:1px solid var(--surface-4);border-radius:var(--radius-md);background:var(--surface-1);color:var(--text-primary);">
          <option value="">전체 카테고리</option>
          ${categoryOptions}
        </select>
      </div>
      <div style="padding:0 1rem;max-height:500px;overflow-y:auto;">
        ${filtered.length === 0 ? `<div class="text-sm" style="color:var(--slate-400);padding:1rem 0;">검색 결과가 없습니다.</div>` : lessonCards}
        ${filtered.length > 20 ? `<div class="text-xs" style="color:var(--slate-400);padding:0.5rem 0;">총 ${filtered.length}건 중 최근 20건 표시</div>` : ""}
      </div>
    </div>
  `;
}

function renderApprovalAnomaliesSection() {
  const { anomalies, avgApprovalDays, completedCount, pendingCount } = computeApprovalAnomalies();

  const statsHtml = `
    <div style="display:flex;gap:1rem;padding:0 1rem;margin-bottom:0.5rem;flex-wrap:wrap;">
      <div class="text-xs" style="color:var(--slate-400);">평균 승인 소요: <span style="color:var(--primary-400);font-weight:600;">${avgApprovalDays}일</span></div>
      <div class="text-xs" style="color:var(--slate-400);">완료된 승인: ${completedCount}건</div>
      <div class="text-xs" style="color:var(--slate-400);">대기 중: ${pendingCount}건</div>
    </div>
  `;

  if (anomalies.length === 0) {
    return `
      <div class="card rpt-section rpt-col-full">
        <div class="rpt-section-header">
          <div class="rpt-section-title">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <span>승인 이상 감지</span>
          </div>
        </div>
        ${statsHtml}
        <div class="empty-state" style="padding:2rem 1rem;">
          <span class="empty-state-text" style="color:var(--success-400);">이상 감지 없음 — 모든 승인이 정상 범위</span>
        </div>
      </div>
    `;
  }

  const rows = anomalies.map(a => {
    const sevColor = a.severity === "critical" ? "var(--danger-400)" : "var(--warning-400)";
    const sevLabel = a.severity === "critical" ? "심각" : "주의";
    const barWidth = Math.min(100, (a.waitingDays / (a.avgDays * 3)) * 100);

    return `<tr>
      <td class="rpt-dept-name" style="white-space:nowrap;">
        <span style="color:${sevColor};margin-right:0.25rem;">${a.severity === "critical" ? "🔴" : "🟡"}</span>
        ${escapeHtml(a.project?.name?.slice(0, 18) || a.gate.projectId)}
      </td>
      <td class="rpt-cell-num">${escapeHtml(a.gate.phaseName || a.gate.phaseId)}</td>
      <td class="rpt-cell-num" style="font-weight:700;color:${sevColor};">${a.waitingDays}일</td>
      <td class="rpt-cell-num">${a.avgDays}일</td>
      <td class="rpt-cell-num" style="font-weight:600;color:${sevColor};">+${a.deviation}σ</td>
      <td style="min-width:80px;">
        <div style="height:6px;background:var(--surface-3);border-radius:3px;overflow:hidden;">
          <div style="width:${barWidth}%;height:100%;background:${sevColor};border-radius:3px;"></div>
        </div>
      </td>
      <td class="rpt-cell-num"><span class="badge" style="background:${sevColor}20;color:${sevColor};font-size:0.625rem;padding:0.1rem 0.375rem;">${sevLabel}</span></td>
    </tr>`;
  }).join("");

  return `
    <div class="card rpt-section rpt-col-full">
      <div class="rpt-section-header">
        <div class="rpt-section-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
          <span>승인 이상 감지 <span class="badge badge-danger" style="font-size:0.625rem;">${anomalies.length}건</span></span>
        </div>
      </div>
      ${statsHtml}
      <div class="text-xs mb-2" style="color:var(--slate-400);padding:0 1rem;">
        평균 승인 소요 대비 1.5σ 초과 시 이상 감지. σ = 표준편차 기준 이탈도
      </div>
      <div class="table-responsive">
        <table class="rpt-heatmap-table" style="font-size:0.75rem;">
          <thead>
            <tr>
              <th>프로젝트</th>
              <th>Phase</th>
              <th>대기</th>
              <th>평균</th>
              <th>이탈</th>
              <th>시각화</th>
              <th>심각도</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDelayPredictionSection() {
  const predictions = computeDelayPredictions();
  if (predictions.length === 0) return "";

  const riskColors = { high: "var(--danger-400)", medium: "var(--warning-400)", low: "var(--success-400)" };
  const riskLabels = { high: "높음", medium: "보통", low: "낮음" };

  const rows = predictions.map(p => {
    const rColor = riskColors[p.delayRisk];
    const phaseBars = p.phaseStatus.map(ph => {
      const bg = ph.overdue > 0 ? "var(--danger-400)" : ph.pct === 100 ? "var(--success-400)" : ph.pct > 0 ? "var(--primary-400)" : "var(--surface-4)";
      return `<div title="${ph.name}: ${ph.done}/${ph.total} (${ph.pct}%)" style="flex:1;height:6px;background:var(--surface-3);border-radius:3px;overflow:hidden;">
        <div style="width:${ph.pct}%;height:100%;background:${bg};border-radius:3px;"></div>
      </div>`;
    }).join("");

    return `<tr>
      <td class="rpt-dept-name" style="white-space:nowrap;">${escapeHtml(p.project.name.length > 20 ? p.project.name.slice(0,20)+".." : p.project.name)}</td>
      <td class="rpt-cell-num">${p.completedCount}/${p.totalTasks}</td>
      <td class="rpt-cell-num" style="font-weight:600;">${p.dailyRate}/일</td>
      <td class="rpt-cell-num">${formatDate(p.plannedEndDate)}</td>
      <td class="rpt-cell-num" style="font-weight:700;color:${p.delayDays > 0 ? "var(--danger-400)" : "var(--success-400)"};">
        ${formatDate(p.estimatedEndDate)}
        ${p.delayDays > 0 ? `<div style="font-size:0.625rem;">+${p.delayDays}일</div>` : `<div style="font-size:0.625rem;">정상</div>`}
      </td>
      <td class="rpt-cell-num"><span class="badge" style="background:${rColor}20;color:${rColor};font-size:0.625rem;padding:0.1rem 0.375rem;">${riskLabels[p.delayRisk]}</span></td>
      <td style="min-width:100px;">
        <div style="display:flex;gap:2px;align-items:center;">${phaseBars}</div>
      </td>
    </tr>`;
  }).join("");

  const highRiskCount = predictions.filter(p => p.delayRisk === "high").length;

  return `
    <div class="card rpt-section rpt-col-full">
      <div class="rpt-section-header">
        <div class="rpt-section-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
          <span>지연 추세 예측 ${highRiskCount > 0 ? `<span class="badge badge-danger" style="font-size:0.625rem;">${highRiskCount}건 위험</span>` : ""}</span>
        </div>
      </div>
      <div class="text-xs mb-2" style="color:var(--slate-400);padding:0 1rem;">
        최근 2주 완료 속도 기반 예상 완료일 산출. Phase 막대: <span style="color:var(--success-400);">완료</span> / <span style="color:var(--primary-400);">진행중</span> / <span style="color:var(--danger-400);">지연</span>
      </div>
      <div class="table-responsive">
        <table class="rpt-heatmap-table" style="font-size:0.75rem;">
          <thead>
            <tr>
              <th>프로젝트</th>
              <th>진행</th>
              <th>속도</th>
              <th>계획 완료</th>
              <th>예상 완료</th>
              <th>위험도</th>
              <th>Phase 진행</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Render ─────────────────────────────────────────────────────────────────

function render() {
  const _projectData = computeProjectProgress();
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

        <!-- Section 6: Assignee×Project Heatmap -->
        ${renderAssigneeHeatmapSection()}

        <!-- Section 7: Resource Conflicts -->
        ${renderResourceConflictsSection()}

        <!-- Section 8: Delay Prediction -->
        ${renderDelayPredictionSection()}

        <!-- Section 9: Approval Anomalies -->
        ${renderApprovalAnomaliesSection()}

        <!-- Section 10: Lessons Learned -->
        ${renderLessonsSection()}

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
        case "heatmap": exportHeatmapCSV(); break;
      }
      return;
    }

    // Lesson search/filter
    if (e.target.id === "lesson-search" || e.target.id === "lesson-filter-phase" || e.target.id === "lesson-filter-category") return;

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

  // Lesson search/filter
  const lessonSearch = app.querySelector("#lesson-search");
  if (lessonSearch) {
    let debounce;
    lessonSearch.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        lessonSearchTerm = lessonSearch.value;
        render();
      }, 300);
    });
  }
  const lessonPhaseFilter = app.querySelector("#lesson-filter-phase");
  if (lessonPhaseFilter) {
    lessonPhaseFilter.addEventListener("change", () => {
      lessonFilterPhase = lessonPhaseFilter.value;
      render();
    });
  }
  const lessonCatFilter = app.querySelector("#lesson-filter-category");
  if (lessonCatFilter) {
    lessonCatFilter.addEventListener("change", () => {
      lessonFilterCategory = lessonCatFilter.value;
      render();
    });
  }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

window.addEventListener("beforeunload", () => {
  unsubscribers.forEach((fn) => typeof fn === "function" && fn());
  Object.keys(chartInstances).forEach((k) => destroyChart(k));
});
