// ============================================================
// Render functions — build HTML strings + push to DOM
// v3: redesign với design token, "Sổ công việc"
// ============================================================
import type { Project, SubTask, Role } from './types';
import {
  STATUS_LABEL,
  PRIORITY_LABEL,
  escapeHtml,
  formatDate,
  formatDateTime,
  isOverdue,
  isSubTaskOverdue,
  progressColor,
  computeTaskProgress,
  getTodayLog,
  tagsBadgesHtml,
  isRecentlyCreated,
} from './utils';
import { state } from './state';
import { setHTML, setText, showElement, hideElement, refreshIcons } from './ui';
import { renderDailyReport } from './renderDailyReport';
import { today } from './utils';

// ============================================================
// Visibility helpers
// ============================================================

export function getVisibleProjects(): Project[] {
  if (!state.currentUser) return [];
  const { role, name, department, departments } = state.currentUser;
  const userDepts = departments && departments.length ? departments : (department ? [department] : []);

  if (role === 'director') return state.projects;

  if (role === 'manager') {
    return state.projects.filter(
      (p) =>
        userDepts.includes(p.department) ||
        p.assignee === name ||
        (p.collaboratingDepts || []).some((d) => userDepts.includes(d)),
    );
  }

  return state.projects.filter((p) => {
    if (p.subTasks && p.subTasks.length > 0) {
      return p.subTasks.some((st) => st.assignee === name);
    }
    return p.assignee === name;
  });
}

export function getMySubTasks(): { project: Project; subTask: SubTask }[] {
  if (!state.currentUser) return [];
  const name = state.currentUser.name;
  const result: { project: Project; subTask: SubTask }[] = [];
  for (const p of state.projects) {
    if (p.subTasks) {
      for (const st of p.subTasks) {
        if (st.assignee === name) result.push({ project: p, subTask: st });
      }
    }
  }
  return result;
}

// ============================================================
// Reusable atoms
// ============================================================

/** 10 ô vuông nhỏ thể hiện % tiến độ — signature "Sổ công việc". */
function progressCellsHtml(pct: number, colorVar: string): string {
  const filled = Math.round(pct / 10);
  let cells = '';
  for (let i = 0; i < 10; i++) {
    cells += `<span class="cell${i < filled ? ' on' : ''}"></span>`;
  }
  return `<span class="progress-cells" style="color: ${colorVar};" title="${pct}%">${cells}</span>`;
}

/** Status text — chữ in hoa + chấm tròn, KHÔNG pill. */
function statusTextHtml(status: string, label: string): string {
  const cls =
    status === 'completed' ? 's-done' :
    status === 'in_progress' ? 's-doing' :
    status === 'on_hold' ? 's-block' :
    's-todo';
  return `<span class="status-text ${cls}"><span class="dot"></span>${escapeHtml(label)}</span>`;
}

/** Stat bar 10 ô, dùng cho dashboard stat row. */
function renderStatBar(elId: string, pct: number): void {
  const el = document.getElementById(elId);
  if (!el) return;
  const filled = Math.round(pct / 10);
  let html = '';
  for (let i = 0; i < 10; i++) {
    html += `<span class="seg${i < filled ? ' on' : ''}"></span>`;
  }
  el.innerHTML = html;
}

function collabBadgesHtml(depts: string[]): string {
  if (!depts || !depts.length) return '';
  return depts.map((d) => `<span class="badge badge-collab">${escapeHtml(d)}</span>`).join('');
}

// ============================================================
// Dashboard — Director view
// ============================================================
function renderDashboardDirector(): void {
  const projects = state.projects;
  const allSubTasks = projects.flatMap((p) => p.subTasks || []);

  const total = projects.length;
  const inProgress = projects.filter((p) => p.status === 'in_progress').length;
  const completed = projects.filter((p) => p.status === 'completed').length;
  const overdue = projects.filter((p) => isOverdue(p)).length;

  setText('statTotal', String(total));
  setText('statInProgress', String(inProgress));
  setText('statCompleted', String(completed));
  setText('statOverdue', String(overdue));

  const totalMeta = document.getElementById('statTotalMeta');
  if (totalMeta) totalMeta.textContent = `${allSubTasks.length} đầu việc`;
  const inMeta = document.getElementById('statInProgressMeta');
  if (inMeta) inMeta.textContent = total > 0 ? `${Math.round((inProgress / total) * 100)}% tổng` : '—';
  const doneMeta = document.getElementById('statCompletedMeta');
  if (doneMeta) doneMeta.textContent = total > 0 ? `${Math.round((completed / total) * 100)}% tổng` : '—';

  renderStatBar('statTotalBar', total > 0 ? 100 : 0);
  renderStatBar('statInProgressBar', total > 0 ? (inProgress / total) * 100 : 0);
  renderStatBar('statCompletedBar', total > 0 ? (completed / total) * 100 : 0);
  renderStatBar('statOverdueBar', total > 0 ? Math.min(100, (overdue / total) * 100 * 5) : 0); // phóng đại để thấy

  // Extra stat
  const statExtra = document.getElementById('statExtra');
  if (statExtra) {
    statExtra.innerHTML = `
      <div class="card p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="stat-label">Đầu việc con</p>
            <p class="font-mono text-2xl font-semibold text-t1 mt-1">${allSubTasks.length}</p>
            <p class="text-xs text-t2 mt-0.5">Tổng số subtask đang quản lý</p>
          </div>
          <div class="w-10 h-10 rounded-md flex items-center justify-center" style="background: var(--accent-soft);">
            <i data-lucide="git-branch" class="w-5 h-5 text-accent"></i>
          </div>
        </div>
      </div>`;
  }

  // Recent projects
  const recent = [...projects]
    .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime())
    .slice(0, 6);

  setHTML('recentProjects', recent.length
    ? recent.map(projectRowHtml).join('')
    : `<div class="empty-state"><p class="empty-title">Chưa có dự án nào</p><p class="empty-desc">Tạo task đầu tiên để bắt đầu.</p></div>`);

  // Dept stats
  const deptMap: Record<string, { total: number; completed: number; inProgress: number }> = {};
  projects.forEach((p) => {
    if (!deptMap[p.department]) deptMap[p.department] = { total: 0, completed: 0, inProgress: 0 };
    deptMap[p.department]!.total += 1;
    if (p.status === 'completed') deptMap[p.department]!.completed += 1;
    if (p.status === 'in_progress') deptMap[p.department]!.inProgress += 1;
  });

  const deptEntries = Object.entries(deptMap);
  setHTML('deptStats', deptEntries.length
    ? deptEntries.map(([dept, s]) => {
        const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
        return `<div>
          <div class="flex justify-between text-sm mb-1.5">
            <span class="font-medium text-t1">${escapeHtml(dept)}</span>
            <span class="text-t2 font-mono">${s.completed}/${s.total}</span>
          </div>
          ${progressCellsHtml(pct, 'var(--success)')}
        </div>`;
      }).join('')
    : `<p class="text-sm text-t3 text-center py-4">Không có dữ liệu</p>`);

  // Overdue list
  const overdueList = document.getElementById('overdueList');
  if (overdueList) {
    const overdueTasks = projects.filter((p) => isOverdue(p));
    overdueList.innerHTML = overdueTasks.length
      ? overdueTasks.slice(0, 5).map((p) => overdueRowHtml(p)).join('')
      : `<div class="empty-state py-6"><p class="empty-title text-sm">Không có công việc quá hạn</p></div>`;
  }
}

function overdueRowHtml(p: Project): string {
  const pct = computeTaskProgress(p);
  return `
    <div class="task-row" onclick="window.openDetailModal('${p.id}')">
      <span class="status-text s-danger"><span class="dot"></span>QUÁ HẠN</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-t1 truncate">${escapeHtml(p.name)}</p>
        <p class="text-xs text-t2 truncate">${escapeHtml(p.assignee)} • ${escapeHtml(p.department)} • Hạn: ${formatDate(p.endDate)}</p>
      </div>
      <div class="hidden sm:flex items-center gap-2">
        ${progressCellsHtml(pct, progressColor(pct))}
        <span class="font-mono text-xs text-t2 w-8 text-right">${pct}%</span>
      </div>
    </div>`;
}

// ============================================================
// Dashboard — Manager view
// ============================================================
function renderDashboardManager(): void {
  const myProjects = getVisibleProjects();
  const mySubTasks = myProjects.flatMap((p) => p.subTasks || []);

  const total = myProjects.length;
  const inProgress = myProjects.filter((p) => p.status === 'in_progress').length;
  const completed = myProjects.filter((p) => p.status === 'completed').length;
  const overdue = myProjects.filter((p) => isOverdue(p)).length;

  setText('statTotal', String(total));
  setText('statInProgress', String(inProgress));
  setText('statCompleted', String(completed));
  setText('statOverdue', String(overdue));

  const totalMeta = document.getElementById('statTotalMeta');
  if (totalMeta) totalMeta.textContent = `${mySubTasks.length} đầu việc`;
  const inMeta = document.getElementById('statInProgressMeta');
  if (inMeta) inMeta.textContent = total > 0 ? `${Math.round((inProgress / total) * 100)}% tổng` : '—';
  const doneMeta = document.getElementById('statCompletedMeta');
  if (doneMeta) doneMeta.textContent = total > 0 ? `${Math.round((completed / total) * 100)}% tổng` : '—';

  renderStatBar('statTotalBar', total > 0 ? 100 : 0);
  renderStatBar('statInProgressBar', total > 0 ? (inProgress / total) * 100 : 0);
  renderStatBar('statCompletedBar', total > 0 ? (completed / total) * 100 : 0);
  renderStatBar('statOverdueBar', total > 0 ? Math.min(100, (overdue / total) * 100 * 5) : 0);

  const statExtra = document.getElementById('statExtra');
  if (statExtra) {
    const empCount = new Set(mySubTasks.map((s) => s.assignee)).size;
    statExtra.innerHTML = `
      <div class="card p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="stat-label">Nhân viên tham gia</p>
            <p class="font-mono text-2xl font-semibold text-t1 mt-1">${empCount}</p>
            <p class="text-xs text-t2 mt-0.5">Đang có đầu việc trong phòng</p>
          </div>
          <div class="w-10 h-10 rounded-md flex items-center justify-center" style="background: var(--accent-soft);">
            <i data-lucide="users" class="w-5 h-5 text-accent"></i>
          </div>
        </div>
      </div>`;
  }

  const recent = [...myProjects]
    .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime())
    .slice(0, 6);
  setHTML('recentProjects', recent.length
    ? recent.map(projectRowHtml).join('')
    : `<div class="empty-state"><p class="empty-title">Chưa có dự án nào</p></div>`);

  const deptStats = document.getElementById('deptStats');
  if (deptStats) {
    const empMap: Record<string, { total: number; done: number; avgPct: number }> = {};
    mySubTasks.forEach((st) => {
      if (!empMap[st.assignee]) empMap[st.assignee] = { total: 0, done: 0, avgPct: 0 };
      empMap[st.assignee]!.total += 1;
      if (st.status === 'completed') empMap[st.assignee]!.done += 1;
      empMap[st.assignee]!.avgPct += st.progress;
    });
    const empEntries = Object.entries(empMap);
    deptStats.innerHTML = empEntries.length
      ? empEntries.map(([name, s]) => {
          const avg = s.total > 0 ? Math.round(s.avgPct / s.total) : 0;
          return `<div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-medium text-t1">${escapeHtml(name)}</span>
              <span class="text-t2 font-mono">${s.done}/${s.total} • ${avg}%</span>
            </div>
            ${progressCellsHtml(avg, 'var(--accent)')}
          </div>`;
        }).join('')
      : `<p class="text-sm text-t3 text-center py-4">Chưa có đầu việc nào</p>`;

    const deptStatsTitle = document.getElementById('deptStatsTitle');
    if (deptStatsTitle) deptStatsTitle.textContent = 'Tiến độ nhân viên';
  }

  const overdueList = document.getElementById('overdueList');
  if (overdueList) {
    const overdueTasks = myProjects.filter((p) => isOverdue(p));
    overdueList.innerHTML = overdueTasks.length
      ? overdueTasks.slice(0, 5).map((p) => overdueRowHtml(p)).join('')
      : `<div class="empty-state py-6"><p class="empty-title text-sm">Không có công việc quá hạn</p></div>`;
  }
}

// ============================================================
// Dashboard — Employee view
// ============================================================
function renderDashboardEmployee(): void {
  const mySubTasks = getMySubTasks();
  const notLogged = mySubTasks.filter(({ subTask: st }) =>
    st.status !== 'completed' && !getTodayLog(st)
  ).length;
  const overdueCount = mySubTasks.filter(({ subTask: st }) => isSubTaskOverdue(st)).length;
  const total = mySubTasks.length;
  const completed = mySubTasks.filter(({ subTask: st }) => st.status === 'completed').length;
  const inProgress = mySubTasks.filter(({ subTask: st }) => st.status === 'in_progress').length;

  setText('statTotal', String(total));
  setText('statInProgress', String(inProgress));
  setText('statCompleted', String(completed));
  setText('statOverdue', String(overdueCount));

  const totalMeta = document.getElementById('statTotalMeta');
  if (totalMeta) totalMeta.textContent = 'đầu việc';
  const inMeta = document.getElementById('statInProgressMeta');
  if (inMeta) inMeta.textContent = total > 0 ? `${Math.round((inProgress / total) * 100)}% tổng` : '—';
  const doneMeta = document.getElementById('statCompletedMeta');
  if (doneMeta) doneMeta.textContent = total > 0 ? `${Math.round((completed / total) * 100)}% tổng` : '—';

  renderStatBar('statTotalBar', total > 0 ? 100 : 0);
  renderStatBar('statInProgressBar', total > 0 ? (inProgress / total) * 100 : 0);
  renderStatBar('statCompletedBar', total > 0 ? (completed / total) * 100 : 0);
  renderStatBar('statOverdueBar', total > 0 ? Math.min(100, (overdueCount / total) * 100 * 5) : 0);

  const statExtra = document.getElementById('statExtra');
  if (statExtra) {
    const isWarn = notLogged > 0;
    statExtra.innerHTML = `
      <div class="card p-5" style="${isWarn ? 'border-left: 2px solid var(--warn);' : ''}">
        <div class="flex items-center justify-between">
          <div>
            <p class="stat-label">Nhật ký hôm nay</p>
            <p class="font-mono text-2xl font-semibold mt-1" style="color: ${isWarn ? 'var(--warn)' : 'var(--success)'};">${notLogged}</p>
            <p class="text-xs mt-0.5" style="color: ${isWarn ? 'var(--warn)' : 'var(--text-secondary)'};">
              ${isWarn ? 'chưa điền — cần báo cáo' : 'đã điền đủ ✓'}
            </p>
          </div>
          <div class="w-10 h-10 rounded-md flex items-center justify-center" style="background: ${isWarn ? 'var(--warn-soft)' : 'var(--success-soft)'};">
            <i data-lucide="${isWarn ? 'bell' : 'check-circle'}" class="w-5 h-5" style="color: ${isWarn ? 'var(--warn)' : 'var(--success)'};"></i>
          </div>
        </div>
      </div>`;
  }

  const upcoming = [...mySubTasks]
    .filter(({ subTask: st }) => st.status !== 'completed')
    .sort((a, b) => {
      const ao = isSubTaskOverdue(a.subTask) ? 0 : 1;
      const bo = isSubTaskOverdue(b.subTask) ? 0 : 1;
      return ao - bo || new Date(a.subTask.endDate || 0).getTime() - new Date(b.subTask.endDate || 0).getTime();
    })
    .slice(0, 6);

  setHTML('recentProjects', upcoming.length
    ? upcoming.map(({ project: p, subTask: st }) => subTaskRowHtml(p, st)).join('')
    : `<div class="empty-state"><p class="empty-title">Không có công việc đang thực hiện</p><p class="empty-desc">Tuyệt vời — bạn đang rảnh.</p></div>`);

  const deptStats = document.getElementById('deptStats');
  if (deptStats) {
    const needLog = mySubTasks.filter(({ subTask: st }) => st.status !== 'completed' && !getTodayLog(st));
    deptStats.innerHTML = needLog.length
      ? needLog.map(({ project: p, subTask: st }) => `
          <div class="task-row" onclick="window.openDailyLogModal('${p.id}', '${st.id}')">
            <i data-lucide="clock" class="w-4 h-4 text-warn flex-shrink-0"></i>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-t1 truncate">${escapeHtml(st.name)}</p>
              <p class="text-xs text-t2 truncate">${escapeHtml(p.name)}</p>
            </div>
            <span class="text-xs text-warn font-medium whitespace-nowrap">Điền →</span>
          </div>`).join('')
      : `<div class="empty-state py-6"><p class="empty-title text-sm">Đã điền đủ nhật ký hôm nay ✓</p></div>`;

    const deptStatsTitle = document.getElementById('deptStatsTitle');
    if (deptStatsTitle) deptStatsTitle.textContent = 'Cần điền nhật ký hôm nay';
  }

  const overdueList = document.getElementById('overdueList');
  if (overdueList) {
    const overdueST = mySubTasks.filter(({ subTask: st }) => isSubTaskOverdue(st));
    overdueList.innerHTML = overdueST.length
      ? overdueST.slice(0, 5).map(({ project: p, subTask: st }) => {
          const pct = st.progress || 0;
          return `
            <div class="task-row" onclick="window.openDailyLogModal('${p.id}', '${st.id}')">
              <span class="status-text s-danger"><span class="dot"></span>QUÁ HẠN</span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-t1 truncate">${escapeHtml(st.name)}</p>
                <p class="text-xs text-t2 truncate">${escapeHtml(p.name)} • Hạn: ${formatDate(st.endDate)}</p>
              </div>
              <div class="hidden sm:flex items-center gap-2">
                ${progressCellsHtml(pct, progressColor(pct))}
                <span class="font-mono text-xs text-t2 w-8 text-right">${pct}%</span>
              </div>
            </div>`;
        }).join('')
      : `<div class="empty-state py-6"><p class="empty-title text-sm">Không có công việc quá hạn</p></div>`;
  }
}

// ============================================================
// Shared row HTML (có "gáy sách")
// ============================================================

function projectRowHtml(p: Project): string {
  const pct = computeTaskProgress(p);
  const overdue = isOverdue(p);
  const hasSubTasks = p.subTasks && p.subTasks.length > 0;
  const spineCls =
    p.status === 'completed' ? 's-done' :
    p.status === 'in_progress' ? 's-doing' :
    p.status === 'on_hold' ? 's-block' :
    's-todo';
  return `
    <div class="task-row book-spine ${overdue ? 's-danger' : spineCls}" onclick="window.openDetailModal('${p.id}')">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="font-mono text-xs font-semibold text-accent">${escapeHtml(p.code)}</span>
          ${statusTextHtml(p.status, STATUS_LABEL[p.status])}
          ${overdue ? `<span class="badge badge-overdue">Quá hạn</span>` : ''}
          ${hasSubTasks ? `<span class="badge badge-subtask">${p.subTasks!.length} đầu việc</span>` : ''}
        </div>
        <p class="font-medium text-t1 truncate">${escapeHtml(p.name)}</p>
        <p class="text-xs text-t2 truncate">${escapeHtml(p.assignee)} • ${escapeHtml(p.department)} • Hạn: ${formatDate(p.endDate)}</p>
      </div>
      <div class="hidden sm:flex items-center gap-2 flex-shrink-0">
        ${progressCellsHtml(pct, progressColor(pct))}
        <span class="font-mono text-xs text-t2 w-8 text-right">${pct}%</span>
      </div>
    </div>
  `;
}

function subTaskRowHtml(project: Project, st: SubTask): string {
  const overdue = isSubTaskOverdue(st);
  const hasLog = !!getTodayLog(st);
  const spineCls =
    st.status === 'completed' ? 's-done' :
    st.status === 'in_progress' ? 's-doing' :
    st.status === 'on_hold' ? 's-block' :
    's-todo';
  return `
    <div class="task-row book-spine ${overdue ? 's-danger' : spineCls}" onclick="window.openDailyLogModal('${project.id}', '${st.id}')">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          ${statusTextHtml(st.status, STATUS_LABEL[st.status])}
          ${overdue ? `<span class="badge badge-overdue">Quá hạn</span>` : ''}
          ${!hasLog && st.status !== 'completed' ? `<span class="badge badge-warn">Chưa điền hôm nay</span>` : ''}
        </div>
        <p class="font-medium text-t1 truncate">${escapeHtml(st.name)}</p>
        <p class="text-xs text-t2 truncate">${escapeHtml(project.name)} • Hạn: ${formatDate(st.endDate)}</p>
      </div>
      <div class="hidden sm:flex items-center gap-2 flex-shrink-0">
        ${progressCellsHtml(st.progress, progressColor(st.progress))}
        <span class="font-mono text-xs text-t2 w-8 text-right">${st.progress}%</span>
      </div>
    </div>
  `;
}

export function renderDashboard(): void {
  const role = state.currentUser?.role;
  if (role === 'director') renderDashboardDirector();
  else if (role === 'manager') renderDashboardManager();
  else renderDashboardEmployee();
  refreshIcons();
}

// ============================================================
// Projects table
// ============================================================
export function populateDeptFilter(): void {
  const sel = document.getElementById('filterDept');
  if (!sel) return;
  const visible = getVisibleProjects();
  const depts = Array.from(new Set(visible.map((p) => p.department))).sort();
  sel.innerHTML =
    '<option value="">Tất cả phòng ban</option>' +
    depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  populateTagFilter();
}

export function populateTagFilter(): void {
  const sel = document.getElementById('filterTag') as HTMLSelectElement | null;
  if (!sel) return;
  const tagSet = new Set<string>();
  for (const p of getVisibleProjects()) {
    for (const t of p.tags || []) tagSet.add(t);
    for (const s of p.subTasks || []) for (const t of s.tags || []) tagSet.add(t);
  }
  const tags = [...tagSet].sort();
  const prev = sel.value;
  sel.innerHTML =
    '<option value="">Tất cả tag</option>' +
    tags.map((t) => `<option value="${escapeHtml(t)}">#${escapeHtml(t)}</option>`).join('');
  if (prev && tags.includes(prev)) sel.value = prev;
}

function projectTableRowHtml(p: Project): string {
  const pct = computeTaskProgress(p);
  const overdue = isOverdue(p);
  const role: Role | undefined = state.currentUser?.role;
  const hasSubTasks = p.subTasks && p.subTasks.length > 0;
  const tagBadges = tagsBadgesHtml(p.tags);

  return `
    <tr class="clickable" onclick="window.openDetailModal('${p.id}')">
      <td><span class="font-mono text-xs font-semibold text-accent">${escapeHtml(p.code)}</span></td>
      <td>
        <div class="font-medium text-t1 line-clamp-2">${escapeHtml(p.name)}</div>
        ${p.description ? `<div class="text-xs text-t3 mt-0.5 line-clamp-2">${escapeHtml(p.description)}</div>` : ''}
        <div class="flex flex-wrap gap-1 mt-1">
          ${hasSubTasks ? `<span class="badge badge-subtask">${p.subTasks!.length} đầu việc</span>` : ''}
          ${tagBadges}
        </div>
      </td>
      <td class="hidden md:table-cell">
        <div class="text-t1">${escapeHtml(p.department)}</div>
        <div class="flex flex-wrap gap-1 mt-1">${collabBadgesHtml(p.collaboratingDepts || [])}</div>
      </td>
      <td class="hidden lg:table-cell text-t1">${escapeHtml(p.assignee)}</td>
      <td>
        <div class="flex items-center gap-2">
          ${progressCellsHtml(pct, progressColor(pct))}
          <span class="font-mono text-xs font-semibold text-t2 w-8 text-right">${pct}%</span>
        </div>
      </td>
      <td>
        ${statusTextHtml(p.status, STATUS_LABEL[p.status] || p.status)}
        ${overdue ? `<div class="mt-1"><span class="badge badge-overdue">Quá hạn</span></div>` : ''}
      </td>
      <td class="hidden lg:table-cell text-t2 font-mono text-xs">${formatDate(p.endDate)}</td>
      <td class="text-right" onclick="event.stopPropagation()">
        <div class="inline-flex gap-1">
          ${role === 'employee'
            ? `<button onclick="window.openDailyLogModal('${p.id}')" class="btn btn-ghost btn-icon" title="Cập nhật tiến độ">
                <i data-lucide="upload-cloud" class="w-4 h-4"></i>
              </button>`
            : `<button onclick="window.openProjectModal('${p.id}')" class="btn btn-ghost btn-icon" title="Sửa">
                <i data-lucide="pencil" class="w-4 h-4"></i>
              </button>
              <button onclick="window.confirmDelete('${p.id}')" class="btn btn-ghost btn-icon" title="Xóa" style="color: var(--danger);">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>`}
        </div>
      </td>
    </tr>
  `;
}

export function renderProjects(): void {
  populateDeptFilter();
  const searchEl = document.getElementById('filterSearch') as HTMLInputElement | null;
  const deptSel = document.getElementById('filterDept') as HTMLSelectElement | null;
  const statusSel = document.getElementById('filterStatus') as HTMLSelectElement | null;
  const prioritySel = document.getElementById('filterPriority') as HTMLSelectElement | null;
  const tagSel = document.getElementById('filterTag') as HTMLSelectElement | null;

  const search = (searchEl?.value || '').toLowerCase();
  const dept = deptSel?.value || '';
  const status = statusSel?.value || '';
  const priority = prioritySel?.value || '';
  const tag = tagSel?.value || '';

  let list = getVisibleProjects();
  if (dept) list = list.filter((p) => p.department === dept);
  if (status) list = list.filter((p) => p.status === status);
  if (priority) list = list.filter((p) => p.priority === priority);
  if (tag) {
    list = list.filter((p) =>
      (p.tags || []).includes(tag) ||
      (p.subTasks || []).some((s) => (s.tags || []).includes(tag))
    );
  }
  if (search) {
    list = list.filter(
      (p) =>
        (p.code || '').toLowerCase().includes(search) ||
        (p.name || '').toLowerCase().includes(search) ||
        (p.assignee || '').toLowerCase().includes(search) ||
        (p.description || '').toLowerCase().includes(search),
    );
  }

  const tbody = document.getElementById('projectTableBody');
  const empty = document.getElementById('emptyProjects');
  if (!tbody || !empty) return;

  if (!list.length) {
    tbody.innerHTML = '';
    showElement('emptyProjects');
  } else {
    hideElement('emptyProjects');
    tbody.innerHTML = list.map(projectTableRowHtml).join('');
  }
  refreshIcons();
}

// ============================================================
// My Tasks (nhân viên)
// ============================================================
function mySubTaskCardHtml(project: Project, st: SubTask): string {
  const pct = st.progress || 0;
  const overdue = isSubTaskOverdue(st);
  const hasLog = !!getTodayLog(st);

  return `
    <div class="card p-5" style="${overdue ? 'border-left: 2px solid var(--danger);' : ''}">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            ${statusTextHtml(st.status, STATUS_LABEL[st.status])}
            <span class="badge badge-priority-${st.priority}">Ưu tiên: ${PRIORITY_LABEL[st.priority]}</span>
            ${overdue ? `<span class="badge badge-overdue">⚠ Quá hạn (${formatDate(st.endDate)})</span>` : ''}
            ${!hasLog && st.status !== 'completed' ? `<span class="badge badge-warn">📝 Chưa điền nhật ký hôm nay</span>` : ''}
          </div>
          <h3 class="font-serif text-lg font-semibold text-t1">${escapeHtml(st.name)}</h3>
          <p class="text-sm text-accent font-medium mt-0.5">${escapeHtml(project.name)}</p>
          ${st.description ? `<p class="text-sm text-t2 mt-1">${escapeHtml(st.description)}</p>` : ''}
          <div class="flex flex-wrap gap-4 mt-3 text-xs text-t2">
            <span>Bắt đầu: ${formatDate(st.startDate)}</span>
            <span>Hạn cuối: ${formatDate(st.endDate)}</span>
          </div>
          ${st.results ? `
            <div class="note-block note-success mt-3">
              <p class="text-xs font-semibold mb-1 tracking-wide uppercase">Kết quả gần nhất</p>
              ${escapeHtml(st.results)}
            </div>` : ''}

          ${st.dailyLogs && st.dailyLogs.length > 0 ? `
            <div class="mt-3">
              <p class="text-xs font-semibold text-t3 uppercase tracking-wide mb-2">Nhật ký gần đây</p>
              <div class="space-y-1.5">
                ${[...st.dailyLogs].reverse().slice(0, 2).map((log) => `
                  <div class="flex gap-2 text-xs">
                    <span class="text-t3 whitespace-nowrap w-20 font-mono">${formatDate(log.date)}</span>
                    <span class="text-t1 flex-1">${escapeHtml(log.description || log.result)}</span>
                    <span class="text-accent font-mono font-semibold whitespace-nowrap">${log.progress}%</span>
                  </div>`).join('')}
              </div>
            </div>` : ''}
        </div>

        <div class="sm:w-48 flex flex-col items-stretch gap-3">
          <div>
            <div class="flex justify-between text-xs mb-1.5">
              <span class="text-t2">Tiến độ</span>
              <span class="font-mono font-bold text-t1">${pct}%</span>
            </div>
            ${progressCellsHtml(pct, progressColor(pct))}
          </div>
          <button onclick="window.openDailyLogModal('${project.id}', '${st.id}')"
                  class="btn ${hasLog ? 'btn-ghost' : 'btn-primary'}">
            <i data-lucide="${hasLog ? 'refresh-cw' : 'upload-cloud'}" class="w-4 h-4"></i>
            ${hasLog ? 'Cập nhật nhật ký' : 'Điền nhật ký hôm nay'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function myTaskDirectCardHtml(p: Project): string {
  const pct = computeTaskProgress(p);
  const overdue = isOverdue(p);
  const role: Role | undefined = state.currentUser?.role;

  return `
    <div class="card p-5" style="${overdue ? 'border-left: 2px solid var(--danger);' : ''}">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="font-mono text-xs font-semibold text-accent">${escapeHtml(p.code)}</span>
            ${statusTextHtml(p.status, STATUS_LABEL[p.status])}
            <span class="badge badge-priority-${p.priority}">Ưu tiên: ${PRIORITY_LABEL[p.priority]}</span>
            ${overdue ? `<span class="badge badge-overdue">⚠ Quá hạn (${formatDate(p.endDate)})</span>` : ''}
          </div>
          <h3 class="font-serif text-lg font-semibold text-t1">${escapeHtml(p.name)}</h3>
          ${p.description ? `<p class="text-sm text-t2 mt-1">${escapeHtml(p.description)}</p>` : ''}
          <div class="flex flex-wrap gap-4 mt-3 text-xs text-t2">
            <span>${escapeHtml(p.department)}</span>
            <span>Hạn cuối: ${formatDate(p.endDate)}</span>
          </div>
          ${p.results ? `
            <div class="note-block note-success mt-3">
              <p class="text-xs font-semibold mb-1 tracking-wide uppercase">Kết quả gần nhất</p>
              ${escapeHtml(p.results)}
            </div>` : ''}
        </div>
        <div class="sm:w-48 flex flex-col items-stretch gap-3">
          <div>
            <div class="flex justify-between text-xs mb-1.5">
              <span class="text-t2">Tiến độ</span>
              <span class="font-mono font-bold text-t1">${pct}%</span>
            </div>
            ${progressCellsHtml(pct, progressColor(pct))}
          </div>
          ${role === 'employee'
            ? `<button onclick="window.openDailyLogModal('${p.id}')" class="btn btn-primary">
                <i data-lucide="upload-cloud" class="w-4 h-4"></i> Cập nhật tiến độ
              </button>`
            : `<button onclick="window.openDetailModal('${p.id}')" class="btn btn-ghost">
                <i data-lucide="eye" class="w-4 h-4"></i> Xem chi tiết
              </button>`}
        </div>
      </div>
    </div>
  `;
}

export function renderMyTasks(): void {
  const role = state.currentUser?.role;

  const pendingCount = countPendingDailyReports();
  if (role === 'employee' && state.myTasksMode === 'list' && pendingCount > 0) {
    state.myTasksMode = 'daily';
  }

  paintMyTasksTabs(pendingCount);

  if (state.myTasksMode === 'daily') {
    renderMyTasksDailyMode();
  } else {
    renderMyTasksListMode();
  }
  updateNavMyTasksBadge(pendingCount);
  refreshIcons();
}

function updateNavMyTasksBadge(count: number): void {
  const badge = document.getElementById('myTasksBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }
}

function countPendingDailyReports(): number {
  if (!state.currentUser) return 0;
  const t = today();
  let count = 0;
  for (const { subTask: st } of getMySubTasks()) {
    if (st.status === 'completed') continue;
    const has = (st.dailyLogs || []).some((l) => l.date === t);
    if (!has) count++;
  }
  return count;
}

function paintMyTasksTabs(pendingCount: number): void {
  const mount = document.getElementById('myTasksTabsMount');
  if (!mount) return;
  const mode = state.myTasksMode;
  const role = state.currentUser?.role;

  const showDaily = role === 'employee';
  const badgeHtml = pendingCount > 0
    ? `<span class="badge badge-overdue">${pendingCount}</span>`
    : '';

  mount.innerHTML = `
    <div class="tabs">
      <button data-mytasks-mode="list"
              class="tab ${mode === 'list' ? 'active' : ''}">
        <i data-lucide="list-checks" class="w-4 h-4"></i> Danh sách
      </button>
      ${showDaily ? `
      <button data-mytasks-mode="daily"
              class="tab ${mode === 'daily' ? 'active' : ''}">
        <i data-lucide="notebook-pen" class="w-4 h-4"></i> Báo cáo hôm nay
        ${badgeHtml}
      </button>` : ''}
    </div>
  `;
  refreshIcons();
}

function renderMyTasksListMode(): void {
  const role = state.currentUser?.role;
  const el = document.getElementById('myTasksList');
  if (!el) return;

  if (role === 'employee') {
    const mySubTasks = getMySubTasks();
    mySubTasks.sort((a, b) => {
      const ao = isSubTaskOverdue(a.subTask) ? 0 : 1;
      const bo = isSubTaskOverdue(b.subTask) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.subTask.priority] ?? 9) - (order[b.subTask.priority] ?? 9);
    });

    const active = mySubTasks.filter(({ subTask: st }) => st.status !== 'completed');
    if (!active.length) {
      el.innerHTML = '';
      showElement('emptyMyTasks');
    } else {
      hideElement('emptyMyTasks');
      el.innerHTML = active.map(({ project, subTask }) => mySubTaskCardHtml(project, subTask)).join('');
    }
  } else {
    const list = getVisibleProjects()
      .filter((p) => p.status !== 'completed')
      .sort((a, b) => {
        const ao = isOverdue(a) ? 0 : 1;
        const bo = isOverdue(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
      });

    if (!list.length) {
      el.innerHTML = '';
      showElement('emptyMyTasks');
    } else {
      hideElement('emptyMyTasks');
      el.innerHTML = list.map(myTaskDirectCardHtml).join('');
    }
  }
}

function renderMyTasksDailyMode(): void {
  const listEl = document.getElementById('myTasksList');
  const emptyEl = document.getElementById('emptyMyTasks');
  if (listEl) listEl.innerHTML = '';
  if (emptyEl) hideElement('emptyMyTasks');

  renderDailyReport();

  const bodySrc = document.getElementById('dailyReportBody');
  const summarySrc = document.getElementById('dailyReportSummary');
  const emptySrc = document.getElementById('emptyDailyReport');
  const submitBtn = document.getElementById('btnSubmitAllReports');

  if (listEl && bodySrc) {
    let wrapper = document.getElementById('myTasksDailyWrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'myTasksDailyWrapper';
      listEl.appendChild(wrapper);
    }
    wrapper.innerHTML = '';

    if (summarySrc) wrapper.appendChild(summarySrc);

    const tableBox = document.createElement('div');
    tableBox.className = 'tbl-wrap';
    const tbl = document.createElement('div');
    tbl.className = 'tbl-scroll';
    const table = document.createElement('table');
    table.className = 'tbl';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width: 32px;"></th>
          <th>Công việc</th>
          <th class="hidden md:table-cell">Dự án</th>
          <th class="hidden lg:table-cell" style="width: 100px;">Hạn</th>
          <th style="width: 110px;">Tiến độ</th>
          <th style="min-width: 160px;">Hôm nay làm gì?</th>
          <th class="hidden xl:table-cell" style="min-width: 140px;">Kết quả</th>
          <th class="hidden xl:table-cell" style="min-width: 120px;">Vướng mắc</th>
          <th class="text-center" style="width: 90px;">% Mới</th>
          <th class="text-center" style="width: 80px;">Trạng thái</th>
          <th class="text-center" style="width: 60px;">Lưu</th>
        </tr>
      </thead>`;
    const tbody = document.createElement('tbody');
    tbody.id = 'myTasksDailyBody';
    table.appendChild(tbody);
    tbl.appendChild(table);
    tableBox.appendChild(tbl);
    wrapper.appendChild(tableBox);

    if (bodySrc) {
      while (bodySrc.firstChild) tbody.appendChild(bodySrc.firstChild);
    }

    if (emptySrc && !tbody.firstChild) {
      const e = emptySrc.cloneNode(true) as HTMLElement;
      e.classList.remove('hidden');
      wrapper.appendChild(e);
    }

    if (submitBtn) {
      const headerBtn = submitBtn.cloneNode(true) as HTMLElement;
      headerBtn.classList.add('mb-3');
      wrapper.insertBefore(headerBtn, wrapper.firstChild);
      headerBtn.onclick = () => window.submitAllDailyReports();
    }
  }
  refreshIcons();
}

export function setMyTasksMode(mode: 'list' | 'daily'): void {
  state.myTasksMode = mode;
  renderMyTasks();
}

// ============================================================
// Reports
// ============================================================
function reportBarsHtml(items: { label: string; count: number; pct: number }[]): string {
  if (!items.length) return '<p class="text-sm text-t3">Không có dữ liệu</p>';
  // Dùng 4 màu token chính thay vì palette Tailwind ngẫu nhiên
  const palette = [
    'var(--accent)',
    'var(--success)',
    'var(--warn)',
    'var(--danger)',
    'var(--text-secondary)',
  ];
  return items
    .map(
      (it, idx) => `
    <div>
      <div class="flex justify-between text-sm mb-1.5">
        <span class="font-medium text-t1">${escapeHtml(it.label)}</span>
        <span class="text-t2 font-mono">${it.count} (${it.pct}%)</span>
      </div>
      <div class="progress-bar-thin"><div class="fill" style="width:${it.pct}%; background:${palette[idx % palette.length]}"></div></div>
    </div>`,
    )
    .join('');
}

function groupCount<K extends keyof Project>(
  list: Project[],
  key: K,
  labelMap?: Record<string, string>,
): { label: string; count: number; pct: number }[] {
  const map: Record<string, number> = {};
  list.forEach((p) => {
    const k = String(p[key]);
    if (!k) return;
    map[k] = (map[k] || 0) + 1;
  });
  const total = list.length;
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({
      label: labelMap ? labelMap[k] || k : k,
      count: v,
      pct: total > 0 ? Math.round((v / total) * 100) : 0,
    }));
}

function reportAvgProgressHtml(list: Project[]): string {
  const map: Record<string, { sum: number; count: number }> = {};
  list.forEach((p) => {
    if (!p.department) return;
    if (!map[p.department]) map[p.department] = { sum: 0, count: 0 };
    map[p.department]!.sum += computeTaskProgress(p);
    map[p.department]!.count += 1;
  });
  const entries = Object.entries(map)
    .map(([dept, v]) => ({ label: dept, avg: v.count > 0 ? Math.round(v.sum / v.count) : 0 }))
    .sort((a, b) => b.avg - a.avg);
  if (!entries.length) return '<p class="text-sm text-t3">Không có dữ liệu</p>';
  return entries
    .map(
      (it) => `
    <div>
      <div class="flex justify-between text-sm mb-1.5">
        <span class="font-medium text-t1">${escapeHtml(it.label)}</span>
        <span class="font-mono font-bold text-t1">${it.avg}%</span>
      </div>
      ${progressCellsHtml(it.avg, progressColor(it.avg))}
    </div>`,
    )
    .join('');
}

export function renderReports(): void {
  const list = getVisibleProjects();
  const emptyHtml = '<p class="text-sm text-t3 text-center py-4">Không có dữ liệu</p>';
  if (!list.length) {
    setHTML('statusChart', emptyHtml);
    setHTML('deptChart', emptyHtml);
    setHTML('priorityChart', emptyHtml);
    setHTML('deptProgressChart', emptyHtml);
    return;
  }

  setHTML('statusChart', reportBarsHtml(groupCount(list, 'status', STATUS_LABEL)));
  setHTML('deptChart', reportBarsHtml(groupCount(list, 'department')));
  setHTML('priorityChart', reportBarsHtml(groupCount(list, 'priority', PRIORITY_LABEL)));
  setHTML('deptProgressChart', reportAvgProgressHtml(list));
}

// ============================================================
// Detail Modal body
// ============================================================

function subTaskListHtml(p: Project): string {
  const role = state.currentUser?.role;
  const canManage = role === 'director' || role === 'manager';

  if (!p.subTasks || !p.subTasks.length) {
    return canManage
      ? `<div class="border-2 border-dashed card p-4 text-center" style="border-style: dashed;">
          <p class="text-sm text-t3 mb-2">Chưa có đầu việc nào</p>
          <button onclick="window.openSubTaskModal('${p.id}')" class="btn btn-ghost">
            <i data-lucide="plus-circle" class="w-4 h-4"></i> Thêm đầu việc
          </button>
        </div>`
      : '';
  }

  return `
    <div class="space-y-2">
      ${p.subTasks.map((st) => {
        const overdue = isSubTaskOverdue(st);
        const hasLog = !!getTodayLog(st);
        const spineCls =
          st.status === 'completed' ? 's-done' :
          st.status === 'in_progress' ? 's-doing' :
          st.status === 'on_hold' ? 's-block' :
          's-todo';
        return `
          <div class="book-spine ${overdue ? 's-danger' : spineCls}" style="background: var(--bg-sunken); border: 1px solid var(--border-soft); padding: 12px;">
            <div class="flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-1.5 mb-1">
                  ${statusTextHtml(st.status, STATUS_LABEL[st.status])}
                  <span class="badge badge-priority-${st.priority}">${PRIORITY_LABEL[st.priority]}</span>
                  ${overdue ? `<span class="badge badge-overdue">Quá hạn</span>` : ''}
                  ${!hasLog && st.status !== 'completed' ? `<span class="badge badge-warn">Chưa điền hôm nay</span>` : ''}
                </div>
                <p class="font-medium text-t1 text-sm">${escapeHtml(st.name)}</p>
                <div class="flex flex-wrap gap-3 mt-1 text-xs text-t2">
                  <span>${escapeHtml(st.assignee)}</span>
                  <span>Hạn: ${formatDate(st.endDate)}</span>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  ${progressCellsHtml(st.progress, progressColor(st.progress))}
                  <span class="text-xs font-mono font-semibold text-t2">${st.progress}%</span>
                </div>
              </div>
              <div class="flex gap-1 flex-shrink-0">
                <button onclick="window.openDailyLogModal('${p.id}', '${st.id}')" class="btn btn-ghost btn-icon" title="Cập nhật tiến độ">
                  <i data-lucide="upload-cloud" class="w-3.5 h-3.5"></i>
                </button>
                ${canManage ? `
                  <button onclick="window.openSubTaskModal('${p.id}', '${st.id}')" class="btn btn-ghost btn-icon" title="Sửa">
                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                  </button>
                  <button onclick="window.confirmDeleteSubTask('${p.id}', '${st.id}')" class="btn btn-ghost btn-icon" title="Xóa" style="color: var(--danger);">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>` : ''}
              </div>
            </div>

            ${st.dailyLogs && st.dailyLogs.length > 0 ? `
              <div class="mt-3 pt-3 border-t border-bd-soft">
                <p class="text-xs text-t3 font-medium mb-1.5 tracking-wide uppercase">Nhật ký (${st.dailyLogs.length} ngày)</p>
                ${[...st.dailyLogs].reverse().slice(0, 2).map((log) => `
                  <div class="flex gap-2 text-xs py-0.5">
                    <span class="text-t3 whitespace-nowrap font-mono">${formatDate(log.date)}</span>
                    <span class="text-t1 flex-1 truncate">${escapeHtml(log.description || log.result || '—')}</span>
                    <span class="text-accent font-mono font-semibold">${log.progress}%</span>
                  </div>`).join('')}
              </div>` : ''}
          </div>`;
      }).join('')}
      ${canManage ? `
        <button onclick="window.openSubTaskModal('${p.id}')" class="w-full border-2 border-dashed card py-2 text-sm text-t3 hover:text-accent transition flex items-center justify-center gap-1" style="border-style: dashed;">
          <i data-lucide="plus" class="w-4 h-4"></i> Thêm đầu việc
        </button>` : ''}
    </div>
  `;
}

export function renderDetailBody(p: Project): void {
  const pct = computeTaskProgress(p);
  const overdue = isOverdue(p);
  const role = state.currentUser?.role;

  setText('detailTitle', `${p.code} — ${p.name}`);

  setHTML(
    'detailBody',
    `
    <div class="flex flex-wrap items-center gap-2">
      ${statusTextHtml(p.status, STATUS_LABEL[p.status])}
      <span class="badge badge-priority-${p.priority}">Ưu tiên: ${PRIORITY_LABEL[p.priority]}</span>
      ${overdue ? `<span class="badge badge-overdue">⚠ Quá hạn</span>` : ''}
    </div>

    ${p.description
      ? `<div>
          <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide mb-1">Mô tả</h4>
          <p class="text-sm text-t1 whitespace-pre-line">${escapeHtml(p.description)}</p>
        </div>`
      : ''}

    <div class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide mb-1">Phòng ban chủ trì</h4>
        <p class="text-t1">${escapeHtml(p.department)}</p>
      </div>
      <div>
        <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide mb-1">Người nhận chính</h4>
        <p class="text-t1">${escapeHtml(p.assignee)}</p>
      </div>
      ${p.collaboratingDepts && p.collaboratingDepts.length > 0 ? `
      <div class="col-span-2">
        <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide mb-1">Phòng phối hợp</h4>
        <div class="flex flex-wrap gap-1">${collabBadgesHtml(p.collaboratingDepts)}</div>
      </div>` : ''}
      <div>
        <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide mb-1">Người tạo</h4>
        <p class="text-t1">${escapeHtml(p.createdBy || '—')}</p>
      </div>
      <div>
        <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide mb-1">Thời gian</h4>
        <p class="text-t1 font-mono text-xs">${formatDate(p.startDate)} → ${formatDate(p.endDate)}</p>
      </div>
    </div>

    <div>
      <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide mb-1">Tiến độ tổng ${p.subTasks && p.subTasks.length > 0 ? '(tính từ đầu việc)' : ''}</h4>
      <div class="flex items-center gap-3">
        ${progressCellsHtml(pct, progressColor(pct))}
        <span class="font-mono font-bold text-t1">${pct}%</span>
      </div>
    </div>

    ${p.subTasks !== undefined ? `
    <div>
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide">Đầu việc (${p.subTasks.length})</h4>
      </div>
      ${subTaskListHtml(p)}
    </div>` : ''}

    ${p.results
      ? `<div>
          <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide mb-1">Kết quả thực hiện</h4>
          <div class="note-block note-success">${escapeHtml(p.results)}</div>
        </div>`
      : ''}

    ${p.notes
      ? `<div>
          <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide mb-1">Ghi chú</h4>
          <div class="note-block note-warn">${escapeHtml(p.notes)}</div>
        </div>`
      : ''}

    ${p.history && p.history.length
      ? `<div>
          <h4 class="text-xs font-semibold text-t3 uppercase tracking-wide mb-2">Lịch sử cập nhật</h4>
          <div class="space-y-2">
            ${[...p.history]
              .reverse()
              .slice(0, 5)
              .map(
                (h) => `
              <div class="flex items-start gap-2 text-xs">
                <div class="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0"></div>
                <div>
                  <span class="font-medium text-t1">${escapeHtml(h.action)}</span>
                  <span class="text-t3"> • ${escapeHtml(h.user || '')}</span>
                  <p class="text-t3 font-mono">${formatDateTime(h.at)}</p>
                </div>
              </div>`,
              )
              .join('')}
          </div>
        </div>`
      : ''}

    <div class="flex flex-wrap gap-2 pt-4 border-t border-bd-soft">
      ${role === 'employee'
        ? `<button onclick="window.closeDetailModal(); window.openDailyLogModal('${p.id}');" class="btn btn-primary">
            <i data-lucide="upload-cloud" class="w-4 h-4"></i> Cập nhật tiến độ
          </button>`
        : `<button onclick="window.closeDetailModal(); window.openProjectModal('${p.id}');" class="btn btn-primary">
            <i data-lucide="pencil" class="w-4 h-4"></i> Sửa công việc
          </button>
          <button onclick="window.openSubTaskModal('${p.id}')" class="btn btn-ghost">
            <i data-lucide="plus-circle" class="w-4 h-4"></i> Thêm đầu việc
          </button>
          <button onclick="window.confirmDelete('${p.id}'); window.closeDetailModal();" class="btn btn-danger">
            <i data-lucide="trash-2" class="w-4 h-4"></i> Xóa
          </button>`}
      <button onclick="window.closeDetailModal()" class="btn btn-ghost ml-auto">Đóng</button>
    </div>
  `,
  );

  refreshIcons();
}
