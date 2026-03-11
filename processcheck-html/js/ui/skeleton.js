// Skeleton placeholder utility

export function renderSkeletonCards(count = 4) {
  return Array(count).fill('').map(() => `
    <div class="skeleton skeleton-card"></div>
  `).join('');
}

export function renderSkeletonStats(count = 4) {
  return `<div class="grid grid-cols-${count}" style="gap: 1rem">
    ${Array(count).fill('').map(() => '<div class="skeleton skeleton-stat"></div>').join('')}
  </div>`;
}

export function renderSkeletonTable(rows = 5, cols = 4) {
  return `<div style="display:flex;flex-direction:column;gap:0.5rem;padding:1rem">
    ${Array(rows).fill('').map(() => `
      <div style="display:flex;gap:1rem">
        ${Array(cols).fill('').map(() => '<div class="skeleton skeleton-text" style="flex:1"></div>').join('')}
      </div>
    `).join('')}
  </div>`;
}
