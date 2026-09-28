// ============================================================
// Render functions — build HTML strings + push to DOM
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
} from './utils';
import { state } from './state';
import { setHTML, setText, showElement, hideElement, refreshIcons } from './ui';
import { renderDailyReport } from './renderDailyReport';
import { today } from './utils';

// ============================================================
// Visibility helpers
// ============================================================

/** Tasks visible theo role:
 * - employee: SubTask được giao cho mình (cross-project)
 * - manager: Task của (các) phòng mình hoặc mình là assignee
 * - director: tất cả Task
 */
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

  // employee — thấy Task thuộc (các) phòng mình + SubTask giao cho mình
  return state.projects.filter((p) => {
    const inMyDept = userDepts.includes(p.department) ||
      (p.collaboratingDepts || []).some((d) => userDepts.includes(d));
    if (!inMyDept) return false;
    if (p.subTasks && p.subTasks.length > 0) {
      return p.subTasks.some((st) => st.assignee === name);
    }
    return p.assignee === name;
  });
}

/** SubTask được giao cho employee đăng nhập hiện tại */
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
// Badge / small component helpers
// ============================================================

function progressBarHtml(pct: number, height = 8): string {
  return `<div class="progress-bar" style="height:${height}px"><div class="progress-fill" style="width:${pct}%; background:${progressColor(pct)}"></div></div>`;
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

  // Extra stat: tổng SubTask
  const statExtra = document.getElementById('statExtra');
  if (statExtra) {
    statExtra.innerHTML = `
      <div class="bg-white p-5 rounded-xl border border-slate-200">
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
            <i data-lucide="git-branch" class="w-5 h-5 text-violet-600"></i>
          </div>
        </div>
        <p class="text-2xl font-bold text-slate-900">${allSubTasks.length}</p>
        <p class="text-sm text-slate-500 mt-1">Công việc con</p>
      </div>`;
  }

  // Recent projects
  const recent = [...projects]
    .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime())
    .slice(0, 6);

  setHTML('recentProjects', recent.length
    ? recent.map(projectRowHtml).join('')
    : `<div class="p-8 text-center text-slate-400"><p>Chưa có dự án nào</p></div>`);

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
            <span class="font-medium text-slate-700">${escapeHtml(dept)}</span>
            <span class="text-slate-500">${s.completed}/${s.total} HT</span>
          </div>
          ${progressBarHtml(pct)}
        </div>`;
      }).join('')
    : `<p class="text-sm text-slate-400 text-center py-4">Không có dữ liệu</p>`);

  // Overdue list
  const overdueList = document.getElementById('overdueList');
  if (overdueList) {
    const overdueTasks = projects.filter((p) => isOverdue(p));
    overdueList.innerHTML = overdueTasks.length
      ? overdueTasks.slice(0, 5).map((p) => `
          <div class="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-rose-50 px-2 rounded" onclick="window.openDetailModal('${p.id}')">
            <div class="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-800 truncate">${escapeHtml(p.name)}</p>
              <p class="text-xs text-slate-500">Hạn: ${formatDate(p.endDate)} • ${escapeHtml(p.assignee)}</p>
            </div>
            <span class="badge badge-overdue text-xs">Quá hạn</span>
          </div>`).join('')
      : `<p class="text-sm text-slate-400 text-center py-4">🎉 Không có công việc quá hạn</p>`;
  }
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

  const statExtra = document.getElementById('statExtra');
  if (statExtra) {
    statExtra.innerHTML = `
      <div class="bg-white p-5 rounded-xl border border-slate-200">
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
            <i data-lucide="users" class="w-5 h-5 text-violet-600"></i>
          </div>
        </div>
        <p class="text-2xl font-bold text-slate-900">${new Set(mySubTasks.map((s) => s.assignee)).size}</p>
        <p class="text-sm text-slate-500 mt-1">Nhân viên tham gia</p>
      </div>`;
  }

  // Recent projects of my dept
  const recent = [...myProjects]
    .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime())
    .slice(0, 6);
  setHTML('recentProjects', recent.length
    ? recent.map(projectRowHtml).join('')
    : `<div class="p-8 text-center text-slate-400"><p>Chưa có dự án nào</p></div>`);

  // Employee progress panel
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
              <span class="font-medium text-slate-700">${escapeHtml(name)}</span>
              <span class="text-slate-500">${s.done}/${s.total} HT • ${avg}%</span>
            </div>
            ${progressBarHtml(avg)}
          </div>`;
        }).join('')
      : `<p class="text-sm text-slate-400 text-center py-4">Chưa có công việc con nào</p>`;

    // Change label
    const deptStatsTitle = document.getElementById('deptStatsTitle');
    if (deptStatsTitle) deptStatsTitle.textContent = 'Tiến độ nhân viên';
  }

  // Overdue
  const overdueList = document.getElementById('overdueList');
  if (overdueList) {
    const overdueTasks = myProjects.filter((p) => isOverdue(p));
    overdueList.innerHTML = overdueTasks.length
      ? overdueTasks.slice(0, 5).map((p) => `
          <div class="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-rose-50 px-2 rounded" onclick="window.openDetailModal('${p.id}')">
            <div class="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-800 truncate">${escapeHtml(p.name)}</p>
              <p class="text-xs text-slate-500">Hạn: ${formatDate(p.endDate)}</p>
            </div>
            <span class="badge badge-overdue text-xs">Quá hạn</span>
          </div>`).join('')
      : `<p class="text-sm text-slate-400 text-center py-4">🎉 Không có công việc quá hạn</p>`;
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

  setText('statTotal', String(total));
  setText('statInProgress', String(mySubTasks.filter(({ subTask: st }) => st.status === 'in_progress').length));
  setText('statCompleted', String(completed));
  setText('statOverdue', String(overdueCount));

  const statExtra = document.getElementById('statExtra');
  if (statExtra) {
    statExtra.innerHTML = `
      <div class="bg-white p-5 rounded-xl border ${notLogged > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}">
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-lg ${notLogged > 0 ? 'bg-amber-100' : 'bg-emerald-100'} flex items-center justify-center">
            <i data-lucide="${notLogged > 0 ? 'bell' : 'check-circle'}" class="w-5 h-5 ${notLogged > 0 ? 'text-amber-600' : 'text-emerald-600'}"></i>
          </div>
        </div>
        <p class="text-2xl font-bold ${notLogged > 0 ? 'text-amber-700' : 'text-slate-900'}">${notLogged}</p>
        <p class="text-sm ${notLogged > 0 ? 'text-amber-600 font-semibold' : 'text-slate-500'} mt-1">${notLogged > 0 ? 'Chưa điền nhật ký hôm nay' : '✓ Đã điền nhật ký hôm nay'}</p>
      </div>`;
  }

  // Upcoming tasks
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
    : `<div class="p-8 text-center text-slate-400"><p>Không có công việc nào đang thực hiện 🎉</p></div>`);

  // DeptStats → Today's tasks needing log
  const deptStats = document.getElementById('deptStats');
  if (deptStats) {
    const needLog = mySubTasks.filter(({ subTask: st }) => st.status !== 'completed' && !getTodayLog(st));
    deptStats.innerHTML = needLog.length
      ? needLog.map(({ project: p, subTask: st }) => `
          <div class="p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center gap-3 cursor-pointer hover:bg-amber-100" onclick="window.openDailyLogModal('${p.id}', '${st.id}')">
            <i data-lucide="clock" class="w-4 h-4 text-amber-600 flex-shrink-0"></i>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-amber-900 truncate">${escapeHtml(st.name)}</p>
              <p class="text-xs text-amber-600">${escapeHtml(p.name)}</p>
            </div>
            <span class="text-xs text-amber-700 font-medium whitespace-nowrap">Điền ngay →</span>
          </div>`).join('')
      : `<p class="text-sm text-emerald-600 font-medium text-center py-4">✓ Đã điền đủ nhật ký hôm nay!</p>`;

    const deptStatsTitle = document.getElementById('deptStatsTitle');
    if (deptStatsTitle) deptStatsTitle.textContent = '⏰ Cần điền nhật ký hôm nay';
  }

  // Overdue
  const overdueList = document.getElementById('overdueList');
  if (overdueList) {
    const overdueST = mySubTasks.filter(({ subTask: st }) => isSubTaskOverdue(st));
    overdueList.innerHTML = overdueST.length
      ? overdueST.slice(0, 5).map(({ project: p, subTask: st }) => `
          <div class="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-rose-50 px-2 rounded" onclick="window.openDailyLogModal('${p.id}', '${st.id}')">
            <div class="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-800 truncate">${escapeHtml(st.name)}</p>
              <p class="text-xs text-slate-500">Hạn: ${formatDate(st.endDate)} • ${escapeHtml(p.name)}</p>
            </div>
            <span class="badge badge-overdue text-xs">Quá hạn</span>
          </div>`).join('')
      : `<p class="text-sm text-slate-400 text-center py-4">🎉 Không có công việc quá hạn</p>`;
  }
}

// ============================================================
// Shared row HTML
// ============================================================

function projectRowHtml(p: Project): string {
  const pct = computeTaskProgress(p);
  const overdue = isOverdue(p);
  const hasSubTasks = p.subTasks && p.subTasks.length > 0;
  return `
    <div class="px-5 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3" onclick="window.openDetailModal('${p.id}')">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-mono text-xs font-semibold text-indigo-600">${escapeHtml(p.code)}</span>
          <span class="badge badge-${p.status}">${STATUS_LABEL[p.status]}</span>
          ${overdue ? `<span class="badge badge-overdue">Quá hạn</span>` : ''}
          ${hasSubTasks ? `<span class="badge badge-subtask">${p.subTasks!.length} CV con</span>` : ''}
        </div>
        <p class="font-medium text-slate-900 truncate">${escapeHtml(p.name)}</p>
        <p class="text-xs text-slate-500 truncate">${escapeHtml(p.assignee)} • ${escapeHtml(p.department)} • Hạn: ${formatDate(p.endDate)}</p>
      </div>
      <div class="hidden sm:block w-32">
        <div class="flex items-center gap-2">
          ${progressBarHtml(pct)}
          <span class="text-xs font-semibold text-slate-600">${pct}%</span>
        </div>
      </div>
    </div>
  `;
}

function subTaskRowHtml(project: Project, st: SubTask): string {
  const overdue = isSubTaskOverdue(st);
  const hasLog = !!getTodayLog(st);
  return `
    <div class="px-5 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3" onclick="window.openDailyLogModal('${project.id}', '${st.id}')">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="badge badge-${st.status}">${STATUS_LABEL[st.status]}</span>
          ${overdue ? `<span class="badge badge-overdue">Quá hạn</span>` : ''}
          ${!hasLog && st.status !== 'completed' ? `<span class="badge badge-warn">Chưa điền hôm nay</span>` : ''}
        </div>
        <p class="font-medium text-slate-900 truncate">${escapeHtml(st.name)}</p>
        <p class="text-xs text-slate-500 truncate">${escapeHtml(project.name)} • Hạn: ${formatDate(st.endDate)}</p>
      </div>
      <div class="hidden sm:block w-32">
        <div class="flex items-center gap-2">
          ${progressBarHtml(st.progress)}
          <span class="text-xs font-semibold text-slate-600">${st.progress}%</span>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// Main renderDashboard dispatcher
// ============================================================
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
  const depts = Array.from(new Set(state.projects.map((p) => p.department))).sort();
  sel.innerHTML =
    '<option value="">Tất cả phòng ban</option>' +
    depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  populateTagFilter();
}

/** Populate dropdown lọc theo tag — lấy từ tất cả task + subtask */
export function populateTagFilter(): void {
  const sel = document.getElementById('filterTag') as HTMLSelectElement | null;
  if (!sel) return;
  const tagSet = new Set<string>();
  for (const p of state.projects) {
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
    <tr class="hover:bg-slate-50 cursor-pointer" onclick="window.openDetailModal('${p.id}')">
      <td class="px-4 py-3 font-mono text-xs font-semibold text-indigo-600">${escapeHtml(p.code)}</td>
      <td class="px-4 py-3">
        <div class="font-medium text-slate-900 line-clamp-2">${escapeHtml(p.name)}</div>
        ${p.description ? `<div class="text-xs text-slate-400 mt-0.5 line-clamp-2">${escapeHtml(p.description)}</div>` : ''}
        <div class="flex flex-wrap gap-1 mt-1">
          ${hasSubTasks ? `<span class="badge badge-subtask">${p.subTasks!.length} CV con</span>` : ''}
          ${tagBadges}
        </div>
      </td>
      <td class="px-4 py-3 hidden md:table-cell">
        <div class="text-slate-700">${escapeHtml(p.department)}</div>
        <div class="flex flex-wrap gap-1 mt-1">${collabBadgesHtml(p.collaboratingDepts || [])}</div>
      </td>
      <td class="px-4 py-3 text-slate-700 hidden lg:table-cell">${escapeHtml(p.assignee)}</td>
      <td class="px-4 py-3 w-40">
        <div class="flex items-center gap-2">
          ${progressBarHtml(pct)}
          <span class="text-xs font-semibold text-slate-600 w-9 text-right">${pct}%</span>
        </div>
      </td>
      <td class="px-4 py-3">
        <span class="badge badge-${p.status}">${STATUS_LABEL[p.status] || p.status}</span>
        ${overdue ? `<div class="mt-1"><span class="badge badge-overdue">Quá hạn</span></div>` : ''}
      </td>
      <td class="px-4 py-3 text-slate-600 hidden lg:table-cell">${formatDate(p.endDate)}</td>
      <td class="px-4 py-3 text-right" onclick="event.stopPropagation()">
        <div class="inline-flex gap-1">
          ${role === 'employee'
            ? `<button onclick="window.openDailyLogModal('${p.id}')" class="p-1.5 rounded hover:bg-indigo-50 text-indigo-600" title="Cập nhật tiến độ">
                <i data-lucide="upload-cloud" class="w-4 h-4"></i>
              </button>`
            : `<button onclick="window.openProjectModal('${p.id}')" class="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Sửa">
                <i data-lucide="pencil" class="w-4 h-4"></i>
              </button>
              <button onclick="window.confirmDelete('${p.id}')" class="p-1.5 rounded hover:bg-rose-50 text-rose-600" title="Xóa">
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
    <div class="bg-white rounded-xl border ${overdue ? 'border-rose-300' : 'border-slate-200'} p-5">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="badge badge-${st.status}">${STATUS_LABEL[st.status]}</span>
            <span class="badge badge-priority-${st.priority}">Ưu tiên: ${PRIORITY_LABEL[st.priority]}</span>
            ${overdue ? `<span class="badge badge-overdue">⚠ Quá hạn (${formatDate(st.endDate)})</span>` : ''}
            ${!hasLog && st.status !== 'completed' ? `<span class="badge badge-warn">📝 Chưa điền nhật ký hôm nay</span>` : ''}
          </div>
          <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(st.name)}</h3>
          <p class="text-sm text-indigo-600 font-medium mt-0.5">
            <i data-lucide="folder" class="w-3.5 h-3.5 inline-block mr-1"></i>${escapeHtml(project.name)}
          </p>
          ${st.description ? `<p class="text-sm text-slate-600 mt-1">${escapeHtml(st.description)}</p>` : ''}
          <div class="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
            <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-3.5 h-3.5"></i>Bắt đầu: ${formatDate(st.startDate)}</span>
            <span class="flex items-center gap-1"><i data-lucide="flag" class="w-3.5 h-3.5"></i>Hạn cuối: ${formatDate(st.endDate)}</span>
          </div>
          ${st.results ? `
            <div class="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-900">
              <p class="text-xs font-semibold mb-1">Kết quả gần nhất:</p>
              ${escapeHtml(st.results)}
            </div>` : ''}

          <!-- Daily log mini-timeline -->
          ${st.dailyLogs && st.dailyLogs.length > 0 ? `
            <div class="mt-3">
              <p class="text-xs font-semibold text-slate-500 uppercase mb-2">Nhật ký gần đây</p>
              <div class="space-y-1.5">
                ${[...st.dailyLogs].reverse().slice(0, 2).map((log) => `
                  <div class="flex gap-2 text-xs">
                    <span class="text-slate-400 whitespace-nowrap w-20">${formatDate(log.date)}</span>
                    <span class="text-slate-700 flex-1">${escapeHtml(log.description || log.result)}</span>
                    <span class="text-indigo-600 font-semibold whitespace-nowrap">${log.progress}%</span>
                  </div>`).join('')}
              </div>
            </div>` : ''}
        </div>

        <div class="sm:w-48 flex flex-col items-stretch gap-2">
          <div>
            <div class="flex justify-between text-xs mb-1.5">
              <span class="text-slate-600">Tiến độ</span>
              <span class="font-bold text-slate-900">${pct}%</span>
            </div>
            ${progressBarHtml(pct)}
          </div>
          <button onclick="window.openDailyLogModal('${project.id}', '${st.id}')"
                  class="mt-2 flex items-center justify-center gap-2 ${hasLog ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-3 py-2 rounded-lg font-medium text-sm transition">
            <i data-lucide="${hasLog ? 'refresh-cw' : 'upload-cloud'}" class="w-4 h-4"></i>
            ${hasLog ? 'Cập nhật nhật ký' : 'Điền nhật ký hôm nay'}
          </button>
        </div>
      </div>
    </div>
  `;
}

// Card cho task không có SubTask (nhân viên là assignee trực tiếp)
function myTaskDirectCardHtml(p: Project): string {
  const pct = computeTaskProgress(p);
  const overdue = isOverdue(p);
  const role: Role | undefined = state.currentUser?.role;

  return `
    <div class="bg-white rounded-xl border ${overdue ? 'border-rose-300' : 'border-slate-200'} p-5">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="font-mono text-xs font-semibold text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded">${escapeHtml(p.code)}</span>
            <span class="badge badge-${p.status}">${STATUS_LABEL[p.status]}</span>
            <span class="badge badge-priority-${p.priority}">Ưu tiên: ${PRIORITY_LABEL[p.priority]}</span>
            ${overdue ? `<span class="badge badge-overdue">⚠ Quá hạn (${formatDate(p.endDate)})</span>` : ''}
          </div>
          <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(p.name)}</h3>
          ${p.description ? `<p class="text-sm text-slate-600 mt-1">${escapeHtml(p.description)}</p>` : ''}
          <div class="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
            <span class="flex items-center gap-1"><i data-lucide="building-2" class="w-3.5 h-3.5"></i>${escapeHtml(p.department)}</span>
            <span class="flex items-center gap-1"><i data-lucide="flag" class="w-3.5 h-3.5"></i>Hạn cuối: ${formatDate(p.endDate)}</span>
          </div>
          ${p.results ? `
            <div class="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-900">
              <p class="text-xs font-semibold mb-1">Kết quả gần nhất:</p>
              ${escapeHtml(p.results)}
            </div>` : ''}
        </div>
        <div class="sm:w-48 flex flex-col items-stretch gap-2">
          <div>
            <div class="flex justify-between text-xs mb-1.5">
              <span class="text-slate-600">Tiến độ</span>
              <span class="font-bold text-slate-900">${pct}%</span>
            </div>
            ${progressBarHtml(pct)}
          </div>
          ${role === 'employee'
            ? `<button onclick="window.openDailyLogModal('${p.id}')" class="mt-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-medium text-sm transition">
                <i data-lucide="upload-cloud" class="w-4 h-4"></i> Cập nhật tiến độ
              </button>`
            : `<button onclick="window.openDetailModal('${p.id}')" class="mt-2 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-medium text-sm transition">
                <i data-lucide="eye" class="w-4 h-4"></i> Xem chi tiết
              </button>`}
        </div>
      </div>
    </div>
  `;
}

export function renderMyTasks(): void {
  const role = state.currentUser?.role;

  // Tự động chuyển sang "Báo cáo hôm nay" nếu NV có việc chưa báo cáo
  // và đang ở mode 'list' (default lần đầu)
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
  // Cập nhật badge trên navbar "Việc của tôi"
  updateNavMyTasksBadge(pendingCount);
  refreshIcons();
}

/** Cập nhật badge "!" đỏ trên nút navbar Việc của tôi */
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

/** Đếm số SubTask của NV hiện tại mà chưa có daily log hôm nay */
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

/** Vẽ sub-tabs (Danh sách / Báo cáo hôm nay) + badge số pending */
function paintMyTasksTabs(pendingCount: number): void {
  const mount = document.getElementById('myTasksTabsMount');
  if (!mount) return;
  const mode = state.myTasksMode;
  const role = state.currentUser?.role;

  // Chỉ hiển thị sub-tab "Báo cáo hôm nay" cho employee
  const showDaily = role === 'employee';
  const badgeHtml = pendingCount > 0
    ? `<span class="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-xs font-semibold rounded-full">${pendingCount}</span>`
    : '';

  mount.innerHTML = `
    <div class="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1 text-sm">
      <button data-mytasks-mode="list"
              class="px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition
                     ${mode === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
        <i data-lucide="list-checks" class="w-4 h-4"></i> Danh sách
      </button>
      ${showDaily ? `
      <button data-mytasks-mode="daily"
              class="px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition
                     ${mode === 'daily' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
        <i data-lucide="notebook-pen" class="w-4 h-4"></i> Báo cáo hôm nay
        ${badgeHtml}
      </button>` : ''}
    </div>
  `;
  refreshIcons();
}

/** Sub-mode: Danh sách (gọi logic cũ của renderMyTasks) */
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

/** Sub-mode: Báo cáo hôm nay — dùng lại renderDailyReport nhưng đổ vào #myTasksList */
function renderMyTasksDailyMode(): void {
  const listEl = document.getElementById('myTasksList');
  const emptyEl = document.getElementById('emptyMyTasks');
  if (listEl) listEl.innerHTML = '';
  if (emptyEl) hideElement('emptyMyTasks');

  // Reuse logic từ renderDailyReport: gắn nội dung vào 2 vùng chính
  // renderDailyReport dùng #dailyReportBody / #emptyDailyReport / #dailyReportSummary / #btnSubmitAllReports
  // Để tránh sửa renderDailyReport, ta clone body sang #myTasksList và ẩn các id kia.
  renderDailyReport();

  // Sau khi render xong, di chuyển nội dung sang vùng của myTasks
  const bodySrc = document.getElementById('dailyReportBody');
  const summarySrc = document.getElementById('dailyReportSummary');
  const emptySrc = document.getElementById('emptyDailyReport');
  const submitBtn = document.getElementById('btnSubmitAllReports');

  if (listEl && bodySrc) {
    // Tạo wrapper
    let wrapper = document.getElementById('myTasksDailyWrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'myTasksDailyWrapper';
      listEl.appendChild(wrapper);
    }
    wrapper.innerHTML = '';

    if (summarySrc) wrapper.appendChild(summarySrc);

    const tableBox = document.createElement('div');
    tableBox.className = 'bg-white rounded-xl border border-slate-200 overflow-hidden';
    const tbl = document.createElement('div');
    tbl.className = 'overflow-x-auto';
    const table = document.createElement('table');
    table.className = 'w-full text-sm';
    table.innerHTML = `
      <thead class="bg-gradient-to-r from-indigo-50 to-purple-50 text-slate-700 text-xs">
        <tr>
          <th class="px-4 py-3 text-left font-semibold w-8"></th>
          <th class="px-4 py-3 text-left font-semibold">Công việc</th>
          <th class="px-4 py-3 text-left font-semibold hidden md:table-cell">Dự án</th>
          <th class="px-4 py-3 text-left font-semibold hidden lg:table-cell w-28">Hạn</th>
          <th class="px-4 py-3 text-left font-semibold w-28">Tiến độ</th>
          <th class="px-4 py-3 text-left font-semibold min-w-40">Hôm nay làm gì?</th>
          <th class="px-4 py-3 text-left font-semibold min-w-36 hidden xl:table-cell">Kết quả</th>
          <th class="px-4 py-3 text-left font-semibold min-w-32 hidden xl:table-cell">Vướng mắc</th>
          <th class="px-4 py-3 text-center font-semibold w-24">% Mới</th>
          <th class="px-4 py-3 text-center font-semibold w-20">Trạng thái</th>
          <th class="px-4 py-3 text-center font-semibold w-16">Lưu</th>
        </tr>
      </thead>`;
    const tbody = document.createElement('tbody');
    tbody.id = 'myTasksDailyBody';
    tbody.className = 'divide-y divide-slate-100';
    table.appendChild(tbody);
    tbl.appendChild(table);
    tableBox.appendChild(tbl);
    wrapper.appendChild(tableBox);

    // Move rows từ #dailyReportBody sang #myTasksDailyBody
    if (bodySrc) {
      while (bodySrc.firstChild) tbody.appendChild(bodySrc.firstChild);
      // Cập nhật rowId references cho saveAll handler trong dailyReportHandlers
      // Vì các nút save gọi saveDailyReportRow(rowId) — chúng ta KHÔNG đổi id của input/textarea,
      // chỉ di chuyển DOM. Các data-task-id, data-sub-id trên tr vẫn dùng đúng.
    }

    if (emptySrc && !tbody.firstChild) {
      const e = emptySrc.cloneNode(true) as HTMLElement;
      e.classList.remove('hidden');
      wrapper.appendChild(e);
    }

    if (submitBtn) {
      // Đưa nút Submit All lên đầu wrapper
      const headerBtn = submitBtn.cloneNode(true) as HTMLElement;
      headerBtn.classList.add('mb-3');
      wrapper.insertBefore(headerBtn, wrapper.firstChild);
      // Gắn lại onclick
      headerBtn.onclick = () => window.submitAllDailyReports();
    }
  }
  refreshIcons();
}

/** Handler khi user click sub-tab */
export function setMyTasksMode(mode: 'list' | 'daily'): void {
  state.myTasksMode = mode;
  renderMyTasks();
}

// ============================================================
// Reports
// ============================================================
function reportBarsHtml(items: { label: string; count: number; pct: number }[]): string {
  if (!items.length) return '<p class="text-sm text-slate-400">Không có dữ liệu</p>';
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  return items
    .map(
      (it, idx) => `
    <div>
      <div class="flex justify-between text-sm mb-1.5">
        <span class="font-medium text-slate-700">${escapeHtml(it.label)}</span>
        <span class="text-slate-500">${it.count} (${it.pct}%)</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${it.pct}%; background:${palette[idx % palette.length]}"></div>
      </div>
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
  if (!entries.length) return '<p class="text-sm text-slate-400">Không có dữ liệu</p>';
  return entries
    .map(
      (it) => `
    <div>
      <div class="flex justify-between text-sm mb-1.5">
        <span class="font-medium text-slate-700">${escapeHtml(it.label)}</span>
        <span class="font-bold text-slate-900">${it.avg}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${it.avg}%; background:${progressColor(it.avg)}"></div>
      </div>
    </div>`,
    )
    .join('');
}

export function renderReports(): void {
  const list = getVisibleProjects();
  if (!list.length) {
    setHTML('statusChart', '<p class="text-sm text-slate-400 text-center py-4">Không có dữ liệu</p>');
    setHTML('deptChart', '<p class="text-sm text-slate-400 text-center py-4">Không có dữ liệu</p>');
    setHTML('priorityChart', '<p class="text-sm text-slate-400 text-center py-4">Không có dữ liệu</p>');
    setHTML('deptProgressChart', '<p class="text-sm text-slate-400 text-center py-4">Không có dữ liệu</p>');
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
      ? `<div class="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
          <p class="text-sm text-slate-400 mb-2">Chưa có công việc con nào</p>
          <button onclick="window.openSubTaskModal('${p.id}')" class="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            <i data-lucide="plus-circle" class="w-4 h-4"></i> Thêm công việc con
          </button>
        </div>`
      : '';
  }

  return `
    <div class="space-y-2">
      ${p.subTasks.map((st) => {
        const overdue = isSubTaskOverdue(st);
        const hasLog = !!getTodayLog(st);
        return `
          <div class="border border-slate-200 rounded-lg p-3 hover:border-indigo-200 transition">
            <div class="flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-1.5 mb-1">
                  <span class="badge badge-${st.status} text-xs">${STATUS_LABEL[st.status]}</span>
                  <span class="badge badge-priority-${st.priority} text-xs">${PRIORITY_LABEL[st.priority]}</span>
                  ${overdue ? `<span class="badge badge-overdue text-xs">Quá hạn</span>` : ''}
                  ${!hasLog && st.status !== 'completed' ? `<span class="badge badge-warn text-xs">Chưa điền hôm nay</span>` : ''}
                </div>
                <p class="font-medium text-slate-800 text-sm">${escapeHtml(st.name)}</p>
                <div class="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                  <span><i data-lucide="user" class="w-3 h-3 inline"></i> ${escapeHtml(st.assignee)}</span>
                  <span><i data-lucide="flag" class="w-3 h-3 inline"></i> Hạn: ${formatDate(st.endDate)}</span>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <div class="progress-bar flex-1" style="height:5px"><div class="progress-fill" style="width:${st.progress}%; background:${progressColor(st.progress)}"></div></div>
                  <span class="text-xs font-semibold text-slate-600">${st.progress}%</span>
                </div>
              </div>
              <div class="flex gap-1 flex-shrink-0">
                <button onclick="window.openDailyLogModal('${p.id}', '${st.id}')" class="p-1.5 rounded hover:bg-indigo-50 text-indigo-600" title="Cập nhật tiến độ">
                  <i data-lucide="upload-cloud" class="w-3.5 h-3.5"></i>
                </button>
                ${canManage ? `
                  <button onclick="window.openSubTaskModal('${p.id}', '${st.id}')" class="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Sửa">
                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                  </button>
                  <button onclick="window.confirmDeleteSubTask('${p.id}', '${st.id}')" class="p-1.5 rounded hover:bg-rose-50 text-rose-600" title="Xóa">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>` : ''}
              </div>
            </div>

            <!-- DailyLog mini trong SubTask card -->
            ${st.dailyLogs && st.dailyLogs.length > 0 ? `
              <div class="mt-2 pt-2 border-t border-slate-100">
                <div class="flex items-center gap-1 mb-1.5">
                  <i data-lucide="book-open" class="w-3 h-3 text-slate-400"></i>
                  <span class="text-xs text-slate-400 font-medium">Nhật ký (${st.dailyLogs.length} ngày)</span>
                </div>
                ${[...st.dailyLogs].reverse().slice(0, 2).map((log) => `
                  <div class="flex gap-2 text-xs py-0.5">
                    <span class="text-slate-400 whitespace-nowrap">${formatDate(log.date)}</span>
                    <span class="text-slate-600 flex-1 truncate">${escapeHtml(log.description || log.result || '—')}</span>
                    <span class="text-indigo-600 font-semibold">${log.progress}%</span>
                  </div>`).join('')}
              </div>` : ''}
          </div>`;
      }).join('')}
      ${canManage ? `
        <button onclick="window.openSubTaskModal('${p.id}')" class="w-full border-2 border-dashed border-slate-200 rounded-lg py-2 text-sm text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition flex items-center justify-center gap-1">
          <i data-lucide="plus" class="w-4 h-4"></i> Thêm công việc con
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
      <span class="badge badge-${p.status}">${STATUS_LABEL[p.status]}</span>
      <span class="badge badge-priority-${p.priority}">Ưu tiên: ${PRIORITY_LABEL[p.priority]}</span>
      ${overdue ? `<span class="badge badge-overdue">⚠ Quá hạn</span>` : ''}
    </div>

    ${p.description
      ? `<div>
          <h4 class="text-xs font-semibold text-slate-500 uppercase mb-1">Mô tả</h4>
          <p class="text-sm text-slate-700 whitespace-pre-line">${escapeHtml(p.description)}</p>
        </div>`
      : ''}

    <div class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <h4 class="text-xs font-semibold text-slate-500 uppercase mb-1">Phòng ban chủ trì</h4>
        <p class="text-slate-700">${escapeHtml(p.department)}</p>
      </div>
      <div>
        <h4 class="text-xs font-semibold text-slate-500 uppercase mb-1">Người nhận chính</h4>
        <p class="text-slate-700">${escapeHtml(p.assignee)}</p>
      </div>
      ${p.collaboratingDepts && p.collaboratingDepts.length > 0 ? `
      <div class="col-span-2">
        <h4 class="text-xs font-semibold text-slate-500 uppercase mb-1">Phòng phối hợp</h4>
        <div class="flex flex-wrap gap-1">${collabBadgesHtml(p.collaboratingDepts)}</div>
      </div>` : ''}
      <div>
        <h4 class="text-xs font-semibold text-slate-500 uppercase mb-1">Người tạo</h4>
        <p class="text-slate-700">${escapeHtml(p.createdBy || '—')}</p>
      </div>
      <div>
        <h4 class="text-xs font-semibold text-slate-500 uppercase mb-1">Thời gian</h4>
        <p class="text-slate-700">${formatDate(p.startDate)} → ${formatDate(p.endDate)}</p>
      </div>
    </div>

    <div>
      <h4 class="text-xs font-semibold text-slate-500 uppercase mb-1">Tiến độ tổng ${p.subTasks && p.subTasks.length > 0 ? '(tính từ CV con)' : ''}</h4>
      <div class="flex items-center gap-3">
        ${progressBarHtml(pct)}
        <span class="font-bold text-slate-900">${pct}%</span>
      </div>
    </div>

    <!-- SubTask list -->
    ${p.subTasks !== undefined ? `
    <div>
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-xs font-semibold text-slate-500 uppercase">Công việc con (${p.subTasks.length})</h4>
      </div>
      ${subTaskListHtml(p)}
    </div>` : ''}

    ${p.results
      ? `<div>
          <h4 class="text-xs font-semibold text-slate-500 uppercase mb-1">Kết quả thực hiện</h4>
          <p class="text-sm text-slate-700 p-3 bg-emerald-50 border border-emerald-100 rounded-lg whitespace-pre-line">${escapeHtml(p.results)}</p>
        </div>`
      : ''}

    ${p.notes
      ? `<div>
          <h4 class="text-xs font-semibold text-slate-500 uppercase mb-1">Ghi chú</h4>
          <p class="text-sm text-slate-700 p-3 bg-amber-50 border border-amber-100 rounded-lg whitespace-pre-line">${escapeHtml(p.notes)}</p>
        </div>`
      : ''}

    ${p.history && p.history.length
      ? `<div>
          <h4 class="text-xs font-semibold text-slate-500 uppercase mb-2">Lịch sử cập nhật</h4>
          <div class="space-y-2">
            ${[...p.history]
              .reverse()
              .slice(0, 5)
              .map(
                (h) => `
              <div class="flex items-start gap-2 text-xs">
                <div class="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></div>
                <div>
                  <span class="font-medium text-slate-700">${escapeHtml(h.action)}</span>
                  <span class="text-slate-400"> • ${escapeHtml(h.user || '')}</span>
                  <p class="text-slate-400">${formatDateTime(h.at)}</p>
                </div>
              </div>`,
              )
              .join('')}
          </div>
        </div>`
      : ''}

    <div class="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
      ${role === 'employee'
        ? `<button onclick="window.closeDetailModal(); window.openDailyLogModal('${p.id}');" class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition">
            <i data-lucide="upload-cloud" class="w-4 h-4"></i> Cập nhật tiến độ
          </button>`
        : `<button onclick="window.closeDetailModal(); window.openProjectModal('${p.id}');" class="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition">
            <i data-lucide="pencil" class="w-4 h-4"></i> Sửa công việc
          </button>
          <button onclick="window.openSubTaskModal('${p.id}')" class="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition">
            <i data-lucide="plus-circle" class="w-4 h-4"></i> Thêm CV con
          </button>
          <button onclick="window.confirmDelete('${p.id}'); window.closeDetailModal();" class="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i> Xóa
          </button>`}
      <button onclick="window.closeDetailModal()" class="ml-auto px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm font-medium">Đóng</button>
    </div>
  `,
  );

  refreshIcons();
}
