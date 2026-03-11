// Cmd+K Command Palette using ninja-keys web component
// Singleton guard to prevent duplicate initialization

let initialized = false;
let ninjaKeysEl = null;

export function initCommandPalette(getActions) {
  if (initialized) return;
  initialized = true;

  ninjaKeysEl = document.createElement('ninja-keys');
  ninjaKeysEl.setAttribute('placeholder', '검색...');
  ninjaKeysEl.setAttribute('hideBreadcrumbs', '');
  document.body.appendChild(ninjaKeysEl);

  // Register keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      refreshActions(getActions);
      ninjaKeysEl.open();
    }
  });
}

function refreshActions(getActions) {
  if (!ninjaKeysEl || !getActions) return;
  const actions = getActions();
  ninjaKeysEl.data = actions;
}

// Helper to build common navigation actions
export function buildNavActions() {
  return [
    { id: 'nav-dashboard', title: '대시보드', icon: '🏠', section: '페이지', handler: () => { window.location.href = 'home.html'; } },
    { id: 'nav-new-dev', title: '출시위원회 (신규개발)', icon: '🛡️', section: '페이지', handler: () => { window.location.href = 'projects.html?type=신규개발'; } },
    { id: 'nav-change', title: '설계변경', icon: '✏️', section: '페이지', handler: () => { window.location.href = 'projects.html?type=설계변경'; } },
    { id: 'nav-checklist', title: '체크리스트 관리', icon: '📋', section: '페이지', handler: () => { window.location.href = 'admin-checklists.html'; } },
    { id: 'nav-sales', title: '영업 출시 준비', icon: '📊', section: '페이지', handler: () => { window.location.href = 'sales.html'; } },
    { id: 'nav-customers', title: '고객 관리', icon: '👥', section: '페이지', handler: () => { window.location.href = 'customers.html'; } },
    { id: 'nav-approvals', title: '승인 대기', icon: '✅', section: '페이지', handler: () => { window.location.href = 'approvals.html'; } },
    { id: 'nav-reports', title: '리포트', icon: '📈', section: '페이지', handler: () => { window.location.href = 'reports.html'; } },
    { id: 'nav-activity', title: '활동 로그', icon: '📝', section: '페이지', handler: () => { window.location.href = 'activity.html'; } },
    { id: 'nav-manual', title: '매뉴얼', icon: '📖', section: '페이지', handler: () => { window.location.href = 'manual.html'; } },
    { id: 'theme-toggle', title: '테마 전환 (라이트/다크)', icon: '🌓', section: '설정', handler: () => { document.getElementById('nav-theme-btn')?.click(); } },
  ];
}

// Build project-specific actions from data
export function buildProjectActions(projects) {
  return (projects || []).map(p => ({
    id: `proj-${p.id}`,
    title: p.name,
    icon: '📁',
    section: '프로젝트',
    handler: () => { window.location.href = `project.html?id=${p.id}`; }
  }));
}
