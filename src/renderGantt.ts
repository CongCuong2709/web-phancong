// ============================================================
// renderGantt.ts — View Gantt thuần CSS/TS (không cần thư viện)
// ============================================================
import type { Project, SubTask } from './types';
import { state } from './state';
import { getVisibleProjects } from './render';
import {
  STATUS_LABEL,
  escapeHtml,
  isOverdue,
  isSubTaskOverdue,
  formatDate,
} from './utils';

type RangeKey = 'week' | 'month' | 'quarter';

interface GanttState {
  range: RangeKey;
  anchor: Date; // ngày neo (mặc định = hôm nay)
}

const ganttState: GanttState = {
  range: 'month',
  anchor: startOfDay(new Date()),
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeDays(r: RangeKey): number {
  return r === 'week' ? 7 : r === 'month' ? 30 : 90;
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtVN(d: Date): string {
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

/** Tính vị trí % của 1 ngày so với [start, end] */
function dayPercent(date: Date, start: Date, totalDays: number): number {
  const ms = date.getTime() - start.getTime();
  return (ms / (1000 * 60 * 60 * 24)) / totalDays * 100;
}

/** Sinh mảng headerCells: thông tin từng ô ngày */
function generateHeader(): Array<{ date: Date; iso: string; label: string; isWeekend: boolean; isToday: boolean; isMonthStart: boolean }> {
  const total = rangeDays(ganttState.range);
  const cells: ReturnType<typeof generateHeader> = [];
  const today = startOfDay(new Date());

  for (let i = 0; i < total; i++) {
    const d = new Date(ganttState.anchor);
    d.setDate(d.getDate() + i);
    cells.push({
      date: d,
      iso: fmtISO(d),
      label: pad(d.getDate()),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: fmtISO(d) === fmtISO(today),
      isMonthStart: d.getDate() === 1,
    });
  }
  return cells;
}

/** Tạo HTML cho 1 dòng Gantt */
function renderRow(
  labelHtml: string,
  startISO: string,
  endISO: string,
  pct: number,
  status: string,
  overdue: boolean,
  totalDays: number,
  startAnchor: Date,
  onClick: string,
  isSub: boolean,
): { left: string; right: string } {
  const left = `<div class="gantt-row-left ${isSub ? 'is-sub' : ''}" ${onClick}>${labelHtml}</div>`;
  const startDate = startISO ? new Date(startISO) : null;
  const endDate   = endISO ? new Date(endISO) : null;

  let bar = '';
  if (startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
    // Nếu ngoài phạm vi hiển thị thì clip
    const totalEnd = new Date(startAnchor);
    totalEnd.setDate(totalEnd.getDate() + totalDays);

    let s = startDate < startAnchor ? startAnchor : startDate;
    let e = endDate > totalEnd ? totalEnd : endDate;
    if (e < s) e = new Date(s.getTime() + 1000 * 60 * 60 * 24); // min 1 day

    const leftPct = Math.max(0, dayPercent(s, startAnchor, totalDays));
    const rightPct = Math.min(100, dayPercent(e, startAnchor, totalDays));
    const widthPct = Math.max(1.5, rightPct - leftPct);

    let cls = 'gantt-bar';
    if (isSub) cls += ' is-sub';
    else cls += ' is-task';
    if (status === 'completed') cls += ' is-completed';
    if (overdue && status !== 'completed') cls += ' is-overdue';

    const tip = `${labelHtml.replace(/<[^>]+>/g, '')} — ${formatDate(startISO)} → ${formatDate(endISO)} (${pct}%)`;
    bar = `<div class="${cls}" style="left:${leftPct}%; width:${widthPct}%"
                 title="${escapeHtml(tip)}" ${onClick}>
            <div class="gantt-bar-fill" style="width:${pct}%"></div>
            <span style="position:relative;z-index:1">${escapeHtml(pct + '%')}</span>
          </div>`;
  }

  const right = `<div class="gantt-row-right">${bar}</div>`;
  return { left, right };
}

/** Header của bảng */
function renderHeader(cells: ReturnType<typeof generateHeader>): string {
  const cellsHtml = cells
    .map((c) => {
      const classes = ['gantt-header-cell'];
      if (c.isWeekend) classes.push('weekend');
      if (c.isToday) classes.push('today');
      if (c.isMonthStart) classes.push('month-start');
      return `<div class="${classes.join(' ')}">${c.label}</div>`;
    })
    .join('');
  return `
    <div class="gantt-header-left">Công việc</div>
    <div class="gantt-header-right" style="--gantt-cols:${cells.length}">${cellsHtml}</div>
  `;
}

/** Render chính */
export function renderGantt(): void {
  const host = document.getElementById('ganttHost');
  if (!host) return;

  const cells = generateHeader();
  const total = cells.length;
  const startAnchor = ganttState.anchor;

  const rows: Array<{ left: string; right: string }> = [];
  const today = startOfDay(new Date());
  const todayPct = dayPercent(today, startAnchor, total);

  for (const p of getVisibleProjects()) {
    const pct = (() => {
      if (p.subTasks && p.subTasks.length > 0) {
        return Math.round(p.subTasks.reduce((acc, s) => acc + s.progress, 0) / p.subTasks.length);
      }
      return p.progress;
    })();

    const label = `<span class="font-mono text-xs text-indigo-600">${escapeHtml(p.code)}</span>
      <span class="font-medium">${escapeHtml(p.name)}</span>`;
    const onclick = `onclick="window.openDetailModal('${p.id}')"`;
    rows.push(renderRow(label, p.startDate, p.endDate, pct, p.status, isOverdue(p), total, startAnchor, onclick, false));

    if (p.subTasks && p.subTasks.length > 0) {
      for (const s of p.subTasks) {
        const sLabel = `<span class="ind">↳</span> ${escapeHtml(s.name)}`;
        const sOnclick = `onclick="window.openDetailModal('${p.id}')"`;
        rows.push(renderRow(sLabel, s.startDate, s.endDate, s.progress, s.status, isSubTaskOverdue(s), total, startAnchor, sOnclick, true));
      }
    }
  }

  if (rows.length === 0) {
    host.innerHTML = '<p class="p-6 text-slate-500 text-center">Không có công việc nào trong khoảng thời gian này.</p>';
    return;
  }

  const header = renderHeader(cells);
  const todayLine = `<div class="today-line" style="left:${todayPct}%"></div>`;
  const body = rows.map((r) => r.left + r.right).join('');

  host.innerHTML = `
    <div class="gantt-grid" style="--gantt-cols:${total}">
      ${header}
      ${body}
    </div>
    <div style="position:relative; pointer-events:none;">${todayLine}</div>
  `;

  bindGanttButtons();
}

function bindGanttButtons(): void {
  const shift = rangeDays(ganttState.range);

  document.getElementById('ganttPrev')?.addEventListener('click', () => {
    ganttState.anchor = new Date(ganttState.anchor.getTime() - shift * 86400000);
    renderGantt();
  });
  document.getElementById('ganttNext')?.addEventListener('click', () => {
    ganttState.anchor = new Date(ganttState.anchor.getTime() + shift * 86400000);
    renderGantt();
  });
  document.getElementById('ganttToday')?.addEventListener('click', () => {
    ganttState.anchor = startOfDay(new Date());
    renderGantt();
  });

  const sel = document.getElementById('ganttRange') as HTMLSelectElement | null;
  if (sel) {
    sel.value = ganttState.range;
    sel.onchange = () => {
      ganttState.range = sel.value as RangeKey;
      renderGantt();
    };
  }
}