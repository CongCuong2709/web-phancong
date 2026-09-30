// ============================================================
// renderTimeline.ts — Orchestrator cho view "Dòng thời gian"
// Gộp Lịch (FullCalendar) + Gantt (CSS thuần) trong 1 view.
// v3: dùng design token
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
    <div class="tabs">
      <button data-timeline-mode="calendar"
              class="tab ${mode === 'calendar' ? 'active' : ''}">
        <i data-lucide="calendar" class="w-4 h-4"></i> Lịch
      </button>
      <button data-timeline-mode="gantt"
              class="tab ${mode === 'gantt' ? 'active' : ''}">
        <i data-lucide="gantt-chart" class="w-4 h-4"></i> Gantt
      </button>
    </div>
  `;
  const toggleMount = document.getElementById('timelineToggleMount');
  if (toggleMount) toggleMount.innerHTML = toggleHtml;

  // Body theo mode
  if (mode === 'calendar') {
    setHTML('timelineContent', `
      <div class="card p-3">
        <div id="calendarHost"></div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-t2">
        <label class="flex items-center gap-2"><input id="calIncludeTasks" type="checkbox" checked class="rounded"> Bao gồm CV gốc</label>
        <label class="flex items-center gap-2"><input id="calIncludeSubs" type="checkbox" checked class="rounded"> Bao gồm đầu việc</label>
        <span class="flex items-center gap-1.5 ml-2"><span class="inline-block w-3 h-3 rounded" style="background: var(--text-tertiary);"></span>Chưa bắt đầu</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded" style="background: var(--accent);"></span>Đang thực hiện</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded" style="background: var(--success);"></span>Hoàn thành</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded" style="background: var(--warn);"></span>Tạm dừng</span>
      </div>
    `);
    refreshIcons();
    bindCalendarCheckboxes();
    renderCalendar();
  } else {
    setHTML('timelineContent', `
      <div class="card p-3">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <button id="ganttPrev" class="btn btn-ghost">
            <i data-lucide="chevron-left" class="w-4 h-4"></i> Trước
          </button>
          <button id="ganttToday" class="btn btn-ghost">Hôm nay</button>
          <button id="ganttNext" class="btn btn-ghost">
            Sau <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
          <select id="ganttRange" class="select">
            <option value="week">Tuần</option>
            <option value="month" selected>Tháng</option>
            <option value="quarter">Quý</option>
          </select>
        </div>
        <div id="ganttHost" class="gantt-host"></div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-t2">
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded" style="background: var(--accent);"></span>CV gốc</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded" style="background: var(--text-secondary);"></span>đầu việc</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded" style="background: var(--danger);"></span>Quá hạn</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded" style="background: var(--success);"></span>Hoàn thành</span>
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
