// ============================================================
// renderDailyReport.ts
// Tab "Báo cáo hằng ngày" — bảng ngang + expandable card row
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

  // Thu thập công việc đang thực hiện của user
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
      // Task trực tiếp (không có subtask)
      const isAssigned = p.assigneeId === userId || p.assignee === userName;
      if (!isAssigned) continue;
      if (p.status === 'completed') continue;
      // Bọc task thành pseudo-subtask
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

  // ─── Summary bar ────────────────────────────────────────────
  const reportedCount = myItems.filter(
    ({ subTask }) => (subTask.dailyLogs || []).some(l => l.date === todayIso)
  ).length;
  const totalCount = myItems.length;
  const allReported = totalCount > 0 && reportedCount === totalCount;

  // Badge đỏ trên nav
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
        <div class="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
          <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-500 shrink-0"></i>
          <p class="text-emerald-700 font-semibold">Bạn đã báo cáo đầy đủ ${totalCount}/${totalCount} công việc hôm nay! 🎉</p>
        </div>`;
    } else {
      const pctBar = totalCount ? Math.round(reportedCount / totalCount * 100) : 0;
      summaryEl.innerHTML = `
        <div class="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <i data-lucide="alert-circle" class="w-5 h-5 text-amber-500 shrink-0"></i>
          <div class="flex-1 min-w-0">
            <p class="text-amber-800 font-semibold">Còn <strong>${totalCount - reportedCount}</strong> công việc chưa báo cáo hôm nay</p>
            <div class="flex items-center gap-2 mt-1.5">
              <div class="flex-1 h-2 bg-amber-100 rounded-full overflow-hidden">
                <div class="h-full bg-amber-400 rounded-full transition-all duration-500" style="width:${pctBar}%"></div>
              </div>
              <span class="text-xs text-amber-700 font-medium shrink-0">${reportedCount}/${totalCount}</span>
            </div>
          </div>
        </div>`;
    }
  }

  // ─── Table body ─────────────────────────────────────────────
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

  // ─── Đã hoàn thành ─────────────────────────────────────────
  const doneEl = document.getElementById('dailyReportDone');
  if (doneEl) {
    if (doneItems.length > 0) {
      doneEl.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200">
          <div class="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500"></i>
            <h3 class="font-semibold text-slate-700 text-sm">Đã hoàn thành (${doneItems.length})</h3>
          </div>
          <div class="p-4 flex flex-wrap gap-2">
            ${doneItems.map(({ project, subTask }) => `
              <span class="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs px-3 py-1.5 rounded-lg">
                <i data-lucide="check" class="w-3 h-3"></i>
                <span class="font-mono text-emerald-500 text-xs">${escapeHtml(project.code)}</span>
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

// ============================================================
// Build 1 row (gồm row chính + row mở rộng ẩn bên dưới)
// ============================================================
function buildRow(project: Project, st: SubTask, isTaskWrap: boolean, todayIso: string): string {
  const todayLog = (st.dailyLogs || []).find(l => l.date === todayIso);
  const reported = !!todayLog;
  const overdue = st.endDate && st.status !== 'completed'
    && new Date(st.endDate) < new Date(todayIso);
  const pct = st.progress;
  const rowId = escapeHtml(st.id);  // safe HTML attribute
  const taskId = escapeHtml(project.id);
  const subId  = isTaskWrap ? '' : escapeHtml(st.id);

  const statusOptions = [
    { v: 'not_started', label: 'Chưa bắt đầu' },
    { v: 'in_progress',  label: 'Đang thực hiện' },
    { v: 'completed',    label: 'Hoàn thành' },
    { v: 'on_hold',      label: 'Tạm dừng' },
  ].map(o => `<option value="${o.v}" ${st.status === o.v ? 'selected' : ''}>${o.label}</option>`).join('');

  return `
  <!-- ═══ ROW CHÍNH ═══ -->
  <tr class="dr-row hover:bg-slate-50 transition-colors ${reported ? 'bg-emerald-50/50' : ''}"
      data-task-id="${taskId}" data-sub-id="${subId}">

    <!-- Toggle expand -->
    <td class="px-3 py-2 text-center">
      <button onclick="window.toggleDailyReportRow('${rowId}')" title="Mở rộng"
        id="toggle-${rowId}"
        class="w-7 h-7 rounded-lg flex items-center justify-center mx-auto text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition">
        <i data-lucide="chevron-right" class="w-4 h-4 transition-transform duration-200"></i>
      </button>
    </td>

    <!-- Tên công việc -->
    <td class="px-4 py-2">
      <div class="flex items-start gap-2">
        ${reported
          ? '<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500 mt-0.5 shrink-0"></i>'
          : '<i data-lucide="circle" class="w-4 h-4 text-slate-300 mt-0.5 shrink-0"></i>'}
        <div>
          <p class="font-medium text-slate-800 text-sm leading-tight">${escapeHtml(st.name)}</p>
          ${overdue ? '<span class="text-xs text-rose-500 font-medium">⚠ Quá hạn</span>' : ''}
          ${reported ? '<span class="text-xs text-emerald-600">✓ Đã báo cáo</span>' : ''}
        </div>
      </div>
    </td>

    <!-- Dự án -->
    <td class="px-3 py-2 hidden md:table-cell">
      <span class="bg-indigo-50 text-indigo-700 text-xs font-mono font-semibold px-2 py-0.5 rounded">${escapeHtml(project.code)}</span>
      <p class="text-xs text-slate-400 mt-0.5 truncate max-w-[120px]">${escapeHtml(project.department)}</p>
    </td>

    <!-- Hạn -->
    <td class="px-3 py-2 hidden lg:table-cell">
      <span class="text-xs ${overdue ? 'text-rose-600 font-semibold' : 'text-slate-500'}">${st.endDate ? formatDate(st.endDate) : '—'}</span>
    </td>

    <!-- Tiến độ hiện tại -->
    <td class="px-3 py-2">
      <div class="flex items-center gap-1.5">
        <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[40px]">
          <div class="h-full rounded-full" style="width:${pct}%;background:${progressColor(pct)}"></div>
        </div>
        <span class="text-xs font-semibold text-slate-600 shrink-0">${pct}%</span>
      </div>
    </td>

    <!-- Hôm nay làm gì (inline) -->
    <td class="px-2 py-2">
      <textarea id="dr-desc-${rowId}" rows="2" placeholder="Hôm nay đã làm gì..."
        class="w-full min-w-[140px] px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none resize-none bg-white"
        >${escapeHtml(todayLog?.description ?? '')}</textarea>
    </td>

    <!-- Kết quả -->
    <td class="px-2 py-2 hidden xl:table-cell">
      <textarea id="dr-result-${rowId}" rows="2" placeholder="Kết quả..."
        class="w-full min-w-[120px] px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none resize-none bg-white"
        >${escapeHtml(todayLog?.result ?? '')}</textarea>
    </td>

    <!-- Vướng mắc -->
    <td class="px-2 py-2 hidden xl:table-cell">
      <textarea id="dr-obstacle-${rowId}" rows="2" placeholder="Vướng mắc..."
        class="w-full min-w-[100px] px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none resize-none bg-white"
        >${escapeHtml(todayLog?.obstacle ?? '')}</textarea>
    </td>

    <!-- % Mới -->
    <td class="px-2 py-2">
      <div class="flex flex-col items-center gap-0.5">
        <input id="dr-pct-${rowId}" type="range" min="0" max="100" step="5"
          value="${todayLog?.progress ?? pct}"
          oninput="document.getElementById('dr-pct-lbl-${rowId}').textContent=this.value+'%';document.getElementById('expand-pct-lbl-${rowId}').textContent=this.value+'%'"
          class="w-20 h-1.5 accent-indigo-600 cursor-pointer" />
        <span id="dr-pct-lbl-${rowId}" class="text-xs font-bold text-indigo-600">${todayLog?.progress ?? pct}%</span>
      </div>
    </td>

    <!-- Trạng thái -->
    <td class="px-2 py-2">
      <select id="dr-status-${rowId}"
        class="text-xs px-2 py-1 rounded-lg border border-slate-200 outline-none cursor-pointer bg-white w-full">
        ${statusOptions}
      </select>
    </td>

    <!-- Lưu -->
    <td class="px-2 py-2 text-center">
      <button id="save-btn-${rowId}"
        onclick="window.saveDailyReportRow('${taskId}','${subId}','${rowId}')" title="Lưu"
        class="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center mx-auto transition shadow-sm">
        <i data-lucide="check" class="w-4 h-4"></i>
      </button>
    </td>
  </tr>

  <!-- ═══ ROW MỞ RỘNG (ẩn mặc định) ═══ -->
  <tr id="expand-${rowId}" class="hidden">
    <td colspan="11" class="px-6 py-4 bg-indigo-50/40 border-b border-indigo-100">
      <div class="bg-white rounded-xl border border-indigo-100 shadow-sm p-5">

        <!-- Header card -->
        <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h4 class="font-semibold text-slate-800">${escapeHtml(st.name)}</h4>
            <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(project.code)} · ${escapeHtml(project.name)}</p>
            ${st.description ? `<p class="text-xs text-slate-400 mt-1 max-w-xl">${escapeHtml(st.description)}</p>` : ''}
          </div>
          <div class="flex items-center gap-4 text-center">
            <div>
              <p class="text-xs text-slate-400">Tiến độ cũ</p>
              <p class="text-xl font-bold text-slate-700">${pct}%</p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4 text-slate-300"></i>
            <div>
              <p class="text-xs text-slate-400">Cập nhật</p>
              <p class="text-xl font-bold text-indigo-600" id="expand-pct-lbl-${rowId}">${todayLog?.progress ?? pct}%</p>
            </div>
          </div>
        </div>

        <!-- Form chi tiết -->
        <div class="grid md:grid-cols-3 gap-4">
          <div class="md:col-span-3">
            <label class="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-1">
              <i data-lucide="pen-line" class="w-3.5 h-3.5"></i> Hôm nay đã làm gì? (chi tiết)
            </label>
            <textarea rows="3" placeholder="Mô tả chi tiết hơn các công việc đã thực hiện..."
              oninput="document.getElementById('dr-desc-${rowId}').value=this.value"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none resize-none"
              >${escapeHtml(todayLog?.description ?? '')}</textarea>
          </div>
          <div>
            <label class="text-xs font-semibold text-emerald-600 flex items-center gap-1 mb-1">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Kết quả đạt được
            </label>
            <textarea rows="3" placeholder="Kết quả cụ thể, con số nếu có..."
              oninput="document.getElementById('dr-result-${rowId}').value=this.value"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none resize-none"
              >${escapeHtml(todayLog?.result ?? '')}</textarea>
          </div>
          <div>
            <label class="text-xs font-semibold text-amber-600 flex items-center gap-1 mb-1">
              <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Vướng mắc / Khó khăn
            </label>
            <textarea rows="3" placeholder="Nêu vướng mắc, cần hỗ trợ gì..."
              oninput="document.getElementById('dr-obstacle-${rowId}').value=this.value"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none resize-none"
              >${escapeHtml(todayLog?.obstacle ?? '')}</textarea>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600 mb-2 block">% Hoàn thành đến hôm nay</label>
            <div class="flex items-center gap-3">
              <input type="range" min="0" max="100" step="5" value="${todayLog?.progress ?? pct}"
                oninput="
                  document.getElementById('dr-pct-${rowId}').value=this.value;
                  document.getElementById('dr-pct-lbl-${rowId}').textContent=this.value+'%';
                  document.getElementById('expand-pct-lbl-${rowId}').textContent=this.value+'%';
                "
                class="flex-1 h-2.5 accent-indigo-600 cursor-pointer rounded-full" />
              <span class="text-lg font-bold text-indigo-600 w-14 text-right">${todayLog?.progress ?? pct}%</span>
            </div>
          </div>
        </div>

        <!-- Card footer -->
        <div class="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
          <button onclick="window.toggleDailyReportRow('${rowId}')"
            class="px-4 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 font-medium transition">
            Thu gọn
          </button>
          <button onclick="window.saveDailyReportRow('${taskId}','${subId}','${rowId}')"
            class="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1.5 transition shadow-sm">
            <i data-lucide="save" class="w-3.5 h-3.5"></i> Lưu báo cáo
          </button>
        </div>
      </div>
    </td>
  </tr>`;
}
