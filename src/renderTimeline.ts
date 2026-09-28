// ============================================================
// renderTimeline.ts — Orchestrator cho view "Dòng thời gian"
// Gộp Lịch (FullCalendar) + Gantt (CSS thuần) trong 1 view.
// User chuyển chế độ bằng toggle Lịch / Gantt trong header.
// ============================================================
import { state } from './state';
import type { TimelineMode } from './types';
import { renderCalendar } from './renderCalendar';
import { renderGantt } from './renderGantt';
import { setHTML } from './ui';
import { refreshIcons } from './ui';

let listenersBound = false;

/** Đổi chế độ Lịch / Gantt */
export function setTimelineMode(mode: TimelineMode): void {
  state.timelineMode = mode;
  renderTimeline();
}

/** Render chính */
export function renderTimeline(): void {
  const host = document.getElementById('timelineContent');
  if (!host) return;

  const mode = state.timelineMode;

  // Toggle UI (pill)
  const toggleHtml = `
    <div class="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1 text-sm">
      <button data-timeline-mode="calendar"
              class="px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition
                     ${mode === 'calendar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
        <i data-lucide="calendar" class="w-4 h-4"></i> Lịch
      </button>
      <button data-timeline-mode="gantt"
              class="px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition
                     ${mode === 'gantt' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
        <i data-lucide="gantt-chart" class="w-4 h-4"></i> Gantt
      </button>
    </div>
  `;
  const toggleMount = document.getElementById('timelineToggleMount');
  if (toggleMount) toggleMount.innerHTML = toggleHtml;

  // Body theo mode
  if (mode === 'calendar') {
    setHTML('timelineContent', `
      <div class="bg-white rounded-xl border border-slate-200 p-3">
        <div id="calendarHost"></div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <label class="flex items-center gap-2"><input id="calIncludeTasks" type="checkbox" checked class="rounded"> Bao gồm CV gốc</label>
        <label class="flex items-center gap-2"><input id="calIncludeSubs" type="checkbox" checked class="rounded"> Bao gồm đầu việc</label>
        <span class="flex items-center gap-1.5 ml-2"><span class="inline-block w-3 h-3 rounded bg-slate-400"></span>Chưa bắt đầu</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-blue-500"></span>Đang thực hiện</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-emerald-500"></span>Hoàn thành</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-amber-500"></span>Tạm dừng</span>
      </div>
    `);
    refreshIcons();
    // Gắn lại listener cho checkbox (vì innerHTML mới)
    bindCalendarCheckboxes();
    renderCalendar();
  } else {
    setHTML('timelineContent', `
      <div class="bg-white rounded-xl border border-slate-200 p-3">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <button id="ganttPrev" class="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm font-medium flex items-center gap-1">
            <i data-lucide="chevron-left" class="w-4 h-4"></i> Trước
          </button>
          <button id="ganttToday" class="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm font-medium">Hôm nay</button>
          <button id="ganttNext" class="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm font-medium flex items-center gap-1">
            Sau <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
          <select id="ganttRange" class="px-3 py-2 rounded-lg border border-slate-300 outline-none text-sm">
            <option value="week">Tuần</option>
            <option value="month" selected>Tháng</option>
            <option value="quarter">Quý</option>
          </select>
        </div>
        <div id="ganttHost" class="gantt-host"></div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-blue-500"></span>CV gốc</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-violet-500"></span>đầu việc</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-rose-500"></span>Quá hạn</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-emerald-500"></span>Hoàn thành</span>
      </div>
    `);
    refreshIcons();
    renderGantt();
  }
}

let cbBound = false;
function bindCalendarCheckboxes(): void {
  if (cbBound) return;
  cbBound = true;
  // event delegation ở document, không cần bind lại mỗi lần — đã làm trong renderCalendar.ts
  // Ở đây chỉ đánh dấu để tránh work thừa
}

/** Bind 1 lần cho toggle Lịch / Gantt (event delegation) */
export function bindTimelineToggle(): void {
  if (listenersBound) return;
  listenersBound = true;
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const btn = target.closest<HTMLElement>('[data-timeline-mode]');
    if (!btn) return;
    const mode = btn.dataset.timelineMode as TimelineMode | undefined;
    if (mode && (mode === 'calendar' || mode === 'gantt')) {
      e.preventDefault();
      setTimelineMode(mode);
    }
  });
}
