// ============================================================
// renderDailyReport.ts
// Tab "Báo cáo hằng ngày" — bảng ngang + expandable card row
// v3: redesign với design token
// ============================================================
import type { Project, SubTask } from './types';
import { escapeHtml, formatDate, progressColor, today } from './utils';
import { state } from './state';
import { setText, refreshIcons } from './ui';

/** Render toàn bộ view Báo cáo hằng ngày */
export function renderDailyReport(): void {
  if (!state.currentUser) return;

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  setText('dailyReportDate', `${todayStr} — Điền trước khi kết thúc ngày làm việc`);

  const userId = state.currentUser.id;
  const userName = state.currentUser.name;
  const todayIso = today();

  const myItems: Array<{ project: Project; subTask: SubTask; isTaskWrap: boolean }> = [];
  const doneItems: Array<{ project: Project; subTask: SubTask }> = [];

  for (const p of state.projects) {
    const subs = p.subTasks || [];
    if (subs.length > 0) {
      for (const st of subs) {
        const isAssigned = st.assigneeId === userId || st.assignee === userName;
        if (!isAssigned) continue;
        if (st.status === 'completed') doneItems.push({ project: p, subTask: st });
        else myItems.push({ project: p, subTask: st, isTaskWrap: false });
      }
    } else {
      const isAssigned = p.assigneeId === userId || p.assignee === userName;
      if (!isAssigned) continue;
      if (p.status === 'completed') continue;
      const pseudo: SubTask = {
        id: `__task__${p.id}`,
        taskId: p.id,
        name: p.name,
        description: p.description,
        assigneeId: p.assigneeId,
        assignee: p.assignee,
        startDate: p.startDate,
        endDate: p.endDate,
        progress: p.progress,
        status: p.status,
        priority: p.priority,
        tags: p.tags || [],
        results: p.results,
        notes: p.notes,
        history: p.history,
        dailyLogs: [],
      };
      myItems.push({ project: p, subTask: pseudo, isTaskWrap: true });
    }
  }

  const reportedCount = myItems.filter(
    ({ subTask }) => (subTask.dailyLogs || []).some(l => l.date === todayIso)
  ).length;
  const totalCount = myItems.length;
  const allReported = totalCount > 0 && reportedCount === totalCount;

  const badge = document.getElementById('dailyReportBadge');
  if (badge) {
    const pending = totalCount - reportedCount;
    if (pending > 0) {
      badge.classList.remove('hidden');
      badge.textContent = String(pending);
    } else {
      badge.classList.add('hidden');
    }
  }

  // Summary block
  const summaryEl = document.getElementById('dailyReportSummary');
  if (summaryEl) {
    if (totalCount === 0) {
      summaryEl.innerHTML = '';
    } else if (allReported) {
      summaryEl.innerHTML = `
        <div class="note-block note-success flex items-center gap-3">
          <i data-lucide="check-circle-2" class="w-5 h-5 shrink-0" style="color: var(--success);"></i>
          <p class="font-semibold">Bạn đã báo cáo đầy đủ ${totalCount}/${totalCount} công việc hôm nay!</p>
        </div>`;
    } else {
      const pctBar = totalCount ? Math.round(reportedCount / totalCount * 100) : 0;
      summaryEl.innerHTML = `
        <div class="note-block note-warn flex items-center gap-4">
          <i data-lucide="alert-circle" class="w-5 h-5 shrink-0" style="color: var(--warn);"></i>
          <div class="flex-1 min-w-0">
            <p class="font-semibold">Còn <strong>${totalCount - reportedCount}</strong> công việc chưa báo cáo hôm nay</p>
            <div class="flex items-center gap-2 mt-1.5">
              <div class="progress-bar-thin flex-1"><div class="fill" style="width:${pctBar}%; background: var(--warn);"></div></div>
              <span class="text-xs font-mono font-medium shrink-0">${reportedCount}/${totalCount}</span>
            </div>
          </div>
        </div>`;
    }
  }

  const tbody = document.getElementById('dailyReportBody');
  const emptyEl = document.getElementById('emptyDailyReport');
  const tableEl = document.getElementById('dailyReportTable');

  if (!tbody) return;

  if (myItems.length === 0) {
    tbody.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    tableEl?.classList.add('hidden');
  } else {
    emptyEl?.classList.add('hidden');
    tableEl?.classList.remove('hidden');
    tbody.innerHTML = myItems.map(({ project, subTask, isTaskWrap }) =>
      buildRow(project, subTask, isTaskWrap, todayIso)
    ).join('');
  }

  const doneEl = document.getElementById('dailyReportDone');
  if (doneEl) {
    if (doneItems.length > 0) {
      doneEl.innerHTML = `
        <div class="card">
          <div class="px-5 py-3 border-b border-bd-soft flex items-center gap-2">
            <i data-lucide="check-circle-2" class="w-4 h-4" style="color: var(--success);"></i>
            <h3 class="font-semibold text-t1 text-sm">Đã hoàn thành (${doneItems.length})</h3>
          </div>
          <div class="p-4 flex flex-wrap gap-2">
            ${doneItems.map(({ project, subTask }) => `
              <span class="badge badge-completed">
                <i data-lucide="check" class="w-3 h-3"></i>
                <span class="font-mono">${escapeHtml(project.code)}</span>
                ${escapeHtml(subTask.name)}
              </span>`).join('')}
          </div>
        </div>`;
    } else {
      doneEl.innerHTML = '';
    }
  }

  refreshIcons();
}

function buildRow(project: Project, st: SubTask, isTaskWrap: boolean, todayIso: string): string {
  const todayLog = (st.dailyLogs || []).find(l => l.date === todayIso);
  const reported = !!todayLog;
  const overdue = st.endDate && st.status !== 'completed'
    && new Date(st.endDate) < new Date(todayIso);
  const pct = st.progress;
  const rowId = escapeHtml(st.id);
  const taskId = escapeHtml(project.id);
  const subId  = isTaskWrap ? '' : escapeHtml(st.id);

  const statusOptions = [
    { v: 'not_started', label: 'Chưa bắt đầu' },
    { v: 'in_progress',  label: 'Đang thực hiện' },
    { v: 'completed',    label: 'Hoàn thành' },
    { v: 'on_hold',      label: 'Tạm dừng' },
  ].map(o => `<option value="${o.v}" ${st.status === o.v ? 'selected' : ''}>${o.label}</option>`).join('');

  const rowBg = reported ? 'style="background: var(--success-soft);"' : '';

  return `
  <tr class="dr-row transition-colors" ${rowBg}
      data-task-id="${taskId}" data-sub-id="${subId}">

    <td class="text-center">
      <button onclick="window.toggleDailyReportRow('${rowId}')" title="Mở rộng"
        id="toggle-${rowId}"
        class="btn btn-ghost btn-icon">
        <i data-lucide="chevron-right" class="w-4 h-4 transition-transform duration-200"></i>
      </button>
    </td>

    <td>
      <div class="flex items-start gap-2">
        ${reported
          ? '<i data-lucide="check-circle-2" class="w-4 h-4 mt-0.5 shrink-0" style="color: var(--success);"></i>'
          : '<i data-lucide="circle" class="w-4 h-4 mt-0.5 shrink-0" style="color: var(--text-tertiary);"></i>'}
        <div>
          <p class="font-medium text-t1 text-sm leading-tight">${escapeHtml(st.name)}</p>
          ${overdue ? '<span class="text-xs font-medium" style="color: var(--danger);">⚠ Quá hạn</span>' : ''}
          ${reported ? '<span class="text-xs" style="color: var(--success);">✓ Đã báo cáo</span>' : ''}
        </div>
      </div>
    </td>

    <td class="hidden md:table-cell">
      <span class="font-mono text-xs font-semibold text-accent">${escapeHtml(project.code)}</span>
      <p class="text-xs text-t3 mt-0.5 truncate max-w-[120px]">${escapeHtml(project.department)}</p>
    </td>

    <td class="hidden lg:table-cell">
      <span class="text-xs font-mono ${overdue ? '' : 'text-t2'}" style="${overdue ? 'color: var(--danger); font-weight: 600;' : ''}">${st.endDate ? formatDate(st.endDate) : '—'}</span>
    </td>

    <td>
      <div class="flex items-center gap-1.5">
        <div class="progress-bar-thin flex-1 min-w-[40px]">
          <div class="fill" style="width:${pct}%;background:${progressColor(pct)}"></div>
        </div>
        <span class="text-xs font-mono font-semibold text-t2 shrink-0">${pct}%</span>
      </div>
    </td>

    <td>
      <textarea id="dr-desc-${rowId}" rows="2" placeholder="Hôm nay đã làm gì?"
        class="textarea text-xs py-1.5 resize-none"
        style="min-width: 140px;"
        >${escapeHtml(todayLog?.description ?? '')}</textarea>
    </td>

    <td class="hidden xl:table-cell">
      <textarea id="dr-result-${rowId}" rows="2" placeholder="Kết quả..."
        class="textarea text-xs py-1.5 resize-none"
        style="min-width: 120px;"
        >${escapeHtml(todayLog?.result ?? '')}</textarea>
    </td>

    <td class="hidden xl:table-cell">
      <textarea id="dr-obstacle-${rowId}" rows="2" placeholder="Vướng mắc..."
        class="textarea text-xs py-1.5 resize-none"
        style="min-width: 100px;"
        >${escapeHtml(todayLog?.obstacle ?? '')}</textarea>
    </td>

    <td>
      <div class="flex flex-col items-center gap-0.5">
        <input id="dr-pct-${rowId}" type="range" min="0" max="100" step="5"
          value="${todayLog?.progress ?? pct}"
          oninput="document.getElementById('dr-pct-lbl-${rowId}').textContent=this.value+'%';document.getElementById('expand-pct-lbl-${rowId}').textContent=this.value+'%'"
          class="range w-20 cursor-pointer" />
        <span id="dr-pct-lbl-${rowId}" class="text-xs font-mono font-bold text-accent">${todayLog?.progress ?? pct}%</span>
      </div>
    </td>

    <td>
      <select id="dr-status-${rowId}" class="select text-xs py-1 w-full">
        ${statusOptions}
      </select>
    </td>

    <td class="text-center">
      <button id="save-btn-${rowId}"
        onclick="window.saveDailyReportRow('${taskId}','${subId}','${rowId}')" title="Lưu"
        class="btn btn-primary btn-icon">
        <i data-lucide="check" class="w-4 h-4"></i>
      </button>
    </td>
  </tr>

  <tr id="expand-${rowId}" class="hidden">
    <td colspan="11" style="background: var(--bg-sunken); padding: 16px 24px;">
      <div class="card p-5">

        <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h4 class="font-semibold text-t1">${escapeHtml(st.name)}</h4>
            <p class="text-xs text-t2 mt-0.5 font-mono">${escapeHtml(project.code)} · ${escapeHtml(project.name)}</p>
            ${st.description ? `<p class="text-xs text-t3 mt-1 max-w-xl">${escapeHtml(st.description)}</p>` : ''}
          </div>
          <div class="flex items-center gap-4 text-center">
            <div>
              <p class="text-xs text-t3">Tiến độ cũ</p>
              <p class="text-xl font-mono font-bold text-t1">${pct}%</p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4 text-t3"></i>
            <div>
              <p class="text-xs text-t3">Cập nhật</p>
              <p class="text-xl font-mono font-bold text-accent" id="expand-pct-lbl-${rowId}">${todayLog?.progress ?? pct}%</p>
            </div>
          </div>
        </div>

        <div class="grid md:grid-cols-3 gap-4">
          <div class="md:col-span-3">
            <label class="label flex items-center gap-1">
              <i data-lucide="pen-line" class="w-3.5 h-3.5"></i> Hôm nay đã làm gì? (chi tiết)
            </label>
            <textarea rows="3" placeholder="Mô tả chi tiết hơn các công việc đã thực hiện..."
              oninput="document.getElementById('dr-desc-${rowId}').value=this.value"
              class="textarea text-sm resize-none"
              >${escapeHtml(todayLog?.description ?? '')}</textarea>
          </div>
          <div>
            <label class="label flex items-center gap-1" style="color: var(--success);">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Kết quả đạt được
            </label>
            <textarea rows="3" placeholder="Kết quả cụ thể, con số nếu có..."
              oninput="document.getElementById('dr-result-${rowId}').value=this.value"
              class="textarea text-sm resize-none"
              >${escapeHtml(todayLog?.result ?? '')}</textarea>
          </div>
          <div>
            <label class="label flex items-center gap-1" style="color: var(--warn);">
              <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Vướng mắc / Khó khăn
            </label>
            <textarea rows="3" placeholder="Nêu vướng mắc, cần hỗ trợ gì..."
              oninput="document.getElementById('dr-obstacle-${rowId}').value=this.value"
              class="textarea text-sm resize-none"
              >${escapeHtml(todayLog?.obstacle ?? '')}</textarea>
          </div>
          <div>
            <label class="label">% Hoàn thành đến hôm nay</label>
            <div class="flex items-center gap-3">
              <input type="range" min="0" max="100" step="5" value="${todayLog?.progress ?? pct}"
                oninput="
                  document.getElementById('dr-pct-${rowId}').value=this.value;
                  document.getElementById('dr-pct-lbl-${rowId}').textContent=this.value+'%';
                  document.getElementById('expand-pct-lbl-${rowId}').textContent=this.value+'%';
                "
                class="range flex-1 cursor-pointer" />
              <span class="text-lg font-mono font-bold text-accent w-14 text-right">${todayLog?.progress ?? pct}%</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-bd-soft">
          <button onclick="window.toggleDailyReportRow('${rowId}')" class="btn btn-ghost">Thu gọn</button>
          <button onclick="window.saveDailyReportRow('${taskId}','${subId}','${rowId}')" class="btn btn-primary">
            <i data-lucide="save" class="w-3.5 h-3.5"></i> Lưu báo cáo
          </button>
        </div>
      </div>
    </td>
  </tr>`;
}
