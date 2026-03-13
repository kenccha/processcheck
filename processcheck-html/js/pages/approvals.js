// Approvals Page — dedicated approval queue for observers
import { guardPage } from '../auth.js';
import { renderNav, initTheme } from '../components.js';
initTheme();
import { subscribeAllChecklistItems, subscribeProjects, approveTask, rejectTask } from '../firestore-service.js';
import { escapeHtml, formatDate, formatStageName } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { renderSkeletonTable } from '../ui/skeleton.js';

const user = guardPage();
if (!user) throw new Error('Not authenticated');

renderNav(document.getElementById('nav-root'));
const app = document.getElementById('app');
if (app) app.innerHTML = `<div class="container">${renderSkeletonTable(6, 4)}</div>`;

let allTasks = [];
let allProjects = [];
let filterDept = 'all';
let filterStage = 'all';

const unsubTasks = subscribeAllChecklistItems((tasks) => {
  allTasks = tasks;
  render();
});

const unsubProjects = subscribeProjects((projects) => {
  allProjects = projects;
  window.__pcProjects = projects;
  render();
});

function getPendingApprovals() {
  let items = allTasks.filter(t => t.status === 'completed' && (!t.approvalStatus || t.approvalStatus === 'pending'));
  if (filterDept !== 'all') items = items.filter(t => t.department === filterDept);
  if (filterStage !== 'all') items = items.filter(t => t.stage === filterStage);
  return items;
}

function getProjectName(id) {
  const p = allProjects.find(proj => proj.id === id);
  return p ? p.name : id;
}

function render() {
  const pending = getPendingApprovals();
  const canApprove = user.role === 'observer';
  const departments = [...new Set(allTasks.filter(t => t.department).map(t => t.department))].sort();
  const stages = [...new Set(allTasks.filter(t => t.stage).map(t => t.stage))].sort();

  app.innerHTML = `
    <div class="container animate-fade-in">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-lg font-bold">승인 대기 <span class="badge badge-warning">${pending.length}</span></h1>
      </div>
      <div class="flex items-center gap-2 mb-4">
        <select class="input-field" id="filter-dept" style="width:auto;padding:0.375rem 0.75rem;font-size:0.75rem;">
          <option value="all">전체 부서</option>
          ${departments.map(d => `<option value="${d}" ${filterDept===d?'selected':''}>${d}</option>`).join('')}
        </select>
        <select class="input-field" id="filter-stage" style="width:auto;padding:0.375rem 0.75rem;font-size:0.75rem;">
          <option value="all">전체 단계</option>
          ${stages.map(s => `<option value="${s}" ${filterStage===s?'selected':''}>${formatStageName(s)}</option>`).join('')}
        </select>
      </div>
      ${pending.length === 0 ? `
        <div class="card p-6 text-center">
          <div class="text-soft">승인 대기 중인 작업이 없습니다</div>
        </div>
      ` : `
        <div class="card" style="overflow:hidden;">
          <table class="data-table" style="width:100%;">
            <thead>
              <tr>
                <th>작업</th>
                <th>프로젝트</th>
                <th>단계</th>
                <th>부서</th>
                <th>완료일</th>
                ${canApprove ? '<th style="width:120px;">액션</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${pending.map(t => `
                <tr>
                  <td><a href="task.html?projectId=${t.projectId}&taskId=${t.id}" style="color:var(--primary-400)">${escapeHtml(t.title)}</a></td>
                  <td class="text-sm text-soft">${escapeHtml(getProjectName(t.projectId))}</td>
                  <td class="text-sm">${formatStageName(t.stage)}</td>
                  <td class="text-sm">${escapeHtml(t.department || '-')}</td>
                  <td class="text-sm text-soft">${t.completedDate ? formatDate(t.completedDate) : '-'}</td>
                  ${canApprove ? `
                    <td>
                      <div class="flex gap-1">
                        <button class="btn-primary btn-xs" data-approve="${t.id}">승인</button>
                        <button class="btn-danger btn-xs" data-reject="${t.id}">반려</button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  // Bind filters
  app.querySelector('#filter-dept')?.addEventListener('change', (e) => { filterDept = e.target.value; render(); });
  app.querySelector('#filter-stage')?.addEventListener('change', (e) => { filterStage = e.target.value; render(); });

  // Bind approve/reject
  app.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await approveTask(btn.dataset.approve, user.name);
        showToast('success', '승인 완료');
      } catch (e) { showToast('error', '승인 실패: ' + e.message); btn.disabled = false; }
    });
  });
  app.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reason = prompt('반려 사유를 입력하세요:');
      if (!reason) return;
      btn.disabled = true;
      try {
        await rejectTask(btn.dataset.reject, user.name, reason);
        showToast('success', '반려 완료');
      } catch (e) { showToast('error', '반려 실패: ' + e.message); btn.disabled = false; }
    });
  });
}

window.addEventListener('beforeunload', () => { unsubTasks(); unsubProjects(); });
