// ============================================================
// renderCalendar.ts — View Lịch dùng FullCalendar (CDN)
// ============================================================
import type { Project, SubTask } from './types';
import { state } from './state';
import { getVisibleProjects } from './render';
import { STATUS_LABEL, escapeHtml } from './utils';

// Khai báo kiểu cho FullCalendar (loaded từ CDN)
declare global {
  interface Window {
    FullCalendar?: {
      Calendar: new (el: HTMLElement, opts: unknown) => unknown;
    };
  }
}

let calendarInstance: unknown = null;
const STATUS_COLOR: Record<string, string> = {
  not_started: '#94a3b8',
  in_progress: '#3b82f6',
  completed:   '#10b981',
  on_hold:     '#f59e0b',
};

/** Build events cho FullCalendar từ danh sách task + subtask */
function buildEvents(): Array<Record<string, unknown>> {
  const includeTasks = (document.getElementById('calIncludeTasks') as HTMLInputElement | null)?.checked ?? true;
  const includeSubs  = (document.getElementById('calIncludeSubs')  as HTMLInputElement | null)?.checked ?? true;

  const events: Array<Record<string, unknown>> = [];
  const projects = getVisibleProjects();

  for (const p of projects) {
    if (includeTasks && p.startDate && p.endDate) {
      events.push({
        id: `task:${p.id}`,
        title: `[${p.code}] ${p.name}`,
        start: p.startDate,
        end:   p.endDate,
        backgroundColor: STATUS_COLOR[p.status] ?? '#6366f1',
        borderColor:     STATUS_COLOR[p.status] ?? '#6366f1',
        extendedProps:   { kind: 'task', projectId: p.id },
      });
    }
    if (includeSubs && p.subTasks) {
      for (const s of p.subTasks) {
        if (!s.startDate || !s.endDate) continue;
        events.push({
          id: `sub:${p.id}:${s.id}`,
          title: `↳ ${s.name}`,
          start: s.startDate,
          end:   s.endDate,
          backgroundColor: '#a78bfa',
          borderColor:     '#7c3aed',
          extendedProps:   { kind: 'subtask', projectId: p.id, subId: s.id },
        });
      }
    }
  }
  return events;
}

function rebuildAndRefresh(): void {
  // Sau khi thay đổi checkbox, recreate calendar
  const host = document.getElementById('calendarHost');
  if (!host) return;
  host.innerHTML = '';
  calendarInstance = null;
  renderCalendar();
}

/** Hàm render chính — bind FullCalendar vào #calendarHost */
export function renderCalendar(): void {
  const host = document.getElementById('calendarHost');
  if (!host) return;

  // Nếu đã có instance thì chỉ refetch events
  if (calendarInstance) {
    try {
      const evs = buildEvents();
      // @ts-ignore
      calendarInstance.removeAllEvents();
      // @ts-ignore
      calendarInstance.addEventSource(evs);
      return;
    } catch {
      calendarInstance = null;
    }
  }

  const FC = window.FullCalendar;
  if (!FC || typeof FC.Calendar !== 'function') {
    host.innerHTML = '<p class="p-6 text-slate-500 text-center">Đang tải thư viện lịch… (vui lòng kiểm tra kết nối Internet)</p>';
    return;
  }

  const events = buildEvents();

  calendarInstance = new FC.Calendar(host, {
    initialView: 'dayGridMonth',
    locale: 'vi',
    firstDay: 1, // Thứ 2
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listMonth',
    },
    buttonText: {
      today: 'Hôm nay',
      month: 'Tháng',
      week:  'Tuần',
      day:   'Ngày',
      list:  'Danh sách',
    },
    height: 700,
    events,
    eventClick(info: { event: { id: string }; jsEvent: MouseEvent }) {
      info.jsEvent.preventDefault();
      const id = info.event.id;
      const match = /^sub:([^:]+):(.+)$/.exec(id);
      if (match) {
        const projectId = match[1];
        // Mở modal chi tiết của task cha, có sẵn subtask trong danh sách
        window.openDetailModal(projectId);
      } else if (id.startsWith('task:')) {
        const projectId = id.slice(5);
        window.openDetailModal(projectId);
      }
    },
    eventDidMount(arg: { el: HTMLElement; event: { title: string } }) {
      arg.el.setAttribute('title', arg.event.title);
    },
  });
}

/** Gắn listener 1 lần để checkbox "Bao gồm" trigger re-render */
let listenersBound = false;
export function ensureCalendarListeners(): void {
  if (listenersBound) return;
  listenersBound = true;
  document.getElementById('calIncludeTasks')?.addEventListener('change', rebuildAndRefresh);
  document.getElementById('calIncludeSubs')?.addEventListener('change', rebuildAndRefresh);
}

// Auto-bind khi DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', ensureCalendarListeners);
}