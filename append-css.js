const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'src', 'styles.css');

const addition = `

/* ----------------------------------------------------------
   4-TIER PROJECT VIEW — Hierarchy: Du an / Giai doan / Hang muc / Dau viec
   ---------------------------------------------------------- */

/* Construction project card — level 1 */
.construction-project-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 16px;
  transition: box-shadow var(--motion-base) var(--ease-standard);
}
.construction-project-card:hover { box-shadow: var(--shadow-2); }
.cp-header {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 20px 24px; cursor: pointer;
  transition: background-color var(--motion-fast) var(--ease-standard);
  border-bottom: 1px solid var(--border-soft);
}
.cp-header:hover { background: var(--bg-hover); }
.cp-left { flex: 1; min-width: 0; }
.cp-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.cp-code { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: var(--accent); text-transform: uppercase; }
.cp-name { font-family: var(--font-serif); font-size: 17px; font-weight: 600; color: var(--text-primary); line-height: 1.3; margin: 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
.cp-chevron { transition: transform var(--motion-base) var(--ease-standard); margin-top: 2px; }
.cp-phases { background: var(--bg-sunken); }

/* Giai doan — level 2 */
.phase-section { border-top: 1px solid var(--border-soft); }
.phase-section:first-child { border-top: 0; }
.phase-header { display: flex; align-items: center; gap: 12px; padding: 12px 24px; cursor: pointer; transition: background-color var(--motion-fast) var(--ease-standard); }
.phase-header:hover { background: var(--bg-hover); }
.phase-seq { width: 24px; height: 24px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.phase-chevron { transition: transform var(--motion-base) var(--ease-standard); margin-left: auto; }
.phase-bundles { padding: 8px 16px 16px 56px; display: flex; flex-direction: column; gap: 8px; }

/* Bundle card — level 3 */
.bundle-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; border-left-width: 3px; }
.bundle-header { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; cursor: pointer; transition: background-color var(--motion-fast) var(--ease-standard); }
.bundle-header:hover { background: var(--bg-hover); }
.bundle-chevron { transition: transform var(--motion-base) var(--ease-standard); margin-top: 2px; }
.bundle-tasks { border-top: 1px solid var(--border-soft); background: var(--bg-sunken); padding: 6px 12px 8px; }
.bundle-task-row { padding: 6px 4px; border-bottom: 1px solid var(--border-soft); transition: background-color var(--motion-fast) var(--ease-standard); }
.bundle-task-row:last-child { border-bottom: 0; }
.bundle-task-row:hover { background: var(--bg-hover); border-radius: var(--radius-sm); }
.bundle-task-info { display: flex; align-items: center; gap: 8px; }

/* Mode tabs */
.projects-mode-tabs { display: flex; background: var(--bg-sunken); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 2px; gap: 2px; }
.projects-mode-tab { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--text-secondary); background: transparent; border: 0; cursor: pointer; transition: all var(--motion-fast) var(--ease-standard); white-space: nowrap; }
.projects-mode-tab.active { background: var(--bg-surface); color: var(--accent); box-shadow: var(--shadow-1); }
.projects-mode-tab:not(.active):hover { color: var(--text-primary); }

/* Status badges */
.badge-bundle-assigned    { background: var(--accent-soft);  color: var(--accent); }
.badge-bundle-in_progress { background: var(--warn-soft);    color: var(--warn); }
.badge-bundle-blocked     { background: var(--danger-soft);  color: var(--danger); }
.badge-bundle-completed   { background: var(--success-soft); color: var(--success); }
.badge-bundle-closed      { background: var(--bg-sunken);    color: var(--text-tertiary); }
.badge-cp-planning    { background: var(--accent-soft);  color: var(--accent); }
.badge-cp-in_progress { background: var(--warn-soft);    color: var(--warn); }
.badge-cp-completed   { background: var(--success-soft); color: var(--success); }
.badge-cp-cancelled   { background: var(--danger-soft);  color: var(--danger); }
.btn-sm { padding: 5px 12px; font-size: 12px; }

@media (max-width: 640px) {
  .cp-header { padding: 14px 16px; }
  .cp-name { font-size: 15px; }
  .phase-bundles { padding-left: 16px; }
  .bundle-header { padding: 10px 12px; }
}
`;

fs.appendFileSync(target, addition, 'utf8');
console.log('CSS appended successfully. Total size:', fs.statSync(target).size, 'bytes');
