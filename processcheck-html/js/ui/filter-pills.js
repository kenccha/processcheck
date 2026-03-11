// Filter pill system — renders removable filter tags

export function renderFilterPills(filters, onRemove) {
  if (!filters || filters.length === 0) return '';
  return `
    <div class="filter-pills">
      ${filters.map(f => `
        <button class="filter-pill active" data-filter-key="${f.key}" data-filter-value="${f.value}">
          ${f.label}
          <span class="filter-pill-remove">&times;</span>
        </button>
      `).join('')}
      <button class="filter-pill-clear">전체 해제</button>
    </div>
  `;
}

export function bindFilterPills(container, onRemove, onClear) {
  container.querySelectorAll('.filter-pill[data-filter-key]').forEach(pill => {
    pill.querySelector('.filter-pill-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove(pill.dataset.filterKey, pill.dataset.filterValue);
    });
  });
  const clearBtn = container.querySelector('.filter-pill-clear');
  if (clearBtn) clearBtn.addEventListener('click', onClear);
}
