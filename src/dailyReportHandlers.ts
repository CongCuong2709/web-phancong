// ============================================================
// dailyReportHandlers.ts
// Handlers cho tab "Báo cáo hằng ngày"
// ============================================================
import { state } from './state';
import { tasksApi, type DailyLogPayload } from './api';
import { showToast, refreshIcons } from './ui';
import { today } from './utils';
import { renderDailyReport } from './renderDailyReport';

/** Toggle mở / đóng card chi tiết bên dưới hàng bảng */
export function toggleDailyReportRow(rowId: string): void {
  const expandRow = document.getElementById(`expand-${rowId}`);
  if (!expandRow) return;

  const isHidden = expandRow.classList.contains('hidden');
  expandRow.classList.toggle('hidden', !isHidden);

  // Xoay mũi tên
  const toggleBtn = document.getElementById(`toggle-${rowId}`);
  if (toggleBtn) {
    const svg = toggleBtn.querySelector<SVGElement>('svg');
    if (svg) svg.style.transform = isHidden ? 'rotate(90deg)' : '';
  }
}

/** Lưu báo cáo cho 1 hàng cụ thể */
export function saveDailyReportRow(taskId: string, subId: string, rowId: string): void {
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T | null;

  const description = (get<HTMLTextAreaElement>(`dr-desc-${rowId}`)?.value ?? '').trim();
  const result      = (get<HTMLTextAreaElement>(`dr-result-${rowId}`)?.value ?? '').trim();
  const obstacle    = (get<HTMLTextAreaElement>(`dr-obstacle-${rowId}`)?.value ?? '').trim();
  const newProgress = Number(get<HTMLInputElement>(`dr-pct-${rowId}`)?.value ?? 0);

  if (!description) {
    showToast('Vui lòng điền "Hôm nay đã làm gì"', true);
    return;
  }

  const saveBtn = get<HTMLButtonElement>(`save-btn-${rowId}`);
  if (saveBtn) saveBtn.disabled = true;

  // rowId bắt đầu bằng __task__ → task trực tiếp, không có subtask
  const isTaskWrap = rowId.startsWith('__task__');
  const save: Promise<unknown> = isTaskWrap
    ? tasksApi.update(taskId, { progress: newProgress, results: result })
    : tasksApi.addLog(taskId, subId, {
        date: today(),
        description,
        result,
        obstacle,
        progress: newProgress,
      } satisfies DailyLogPayload);

  save
    .then(() => {
      showToast('✓ Đã lưu báo cáo');
      // Đóng expand nếu đang mở
      document.getElementById(`expand-${rowId}`)?.classList.add('hidden');
      return _reload();
    })
    .catch((e: Error) => showToast(e.message || 'Lỗi lưu báo cáo', true))
    .finally(() => { if (saveBtn) saveBtn.disabled = false; });
}

/** Gửi tất cả báo cáo đã điền mô tả */
export function submitAllDailyReports(): void {
  const rows = document.querySelectorAll<HTMLTableRowElement>('tr.dr-row[data-task-id]');
  if (rows.length === 0) {
    showToast('Không có công việc nào cần báo cáo', true);
    return;
  }

  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const saves: Promise<unknown>[] = [];
  let skipped = 0;

  rows.forEach(row => {
    const taskId  = row.dataset.taskId ?? '';
    const subId   = row.dataset.subId  ?? '';
    const saveBtn = row.querySelector<HTMLButtonElement>('[id^="save-btn-"]');
    if (!saveBtn) return;

    const rowId       = saveBtn.id.replace('save-btn-', '');
    const description = (get<HTMLTextAreaElement>(`dr-desc-${rowId}`)?.value ?? '').trim();
    const result      = (get<HTMLTextAreaElement>(`dr-result-${rowId}`)?.value ?? '').trim();
    const obstacle    = (get<HTMLTextAreaElement>(`dr-obstacle-${rowId}`)?.value ?? '').trim();
    const newProgress = Number(get<HTMLInputElement>(`dr-pct-${rowId}`)?.value ?? 0);

    if (!description) { skipped++; return; }

    if (!subId || rowId.startsWith('__task__')) {
      saves.push(tasksApi.update(taskId, { progress: newProgress, results: result }));
    } else {
      saves.push(tasksApi.addLog(taskId, subId, {
        date: today(), description, result, obstacle, progress: newProgress,
      } satisfies DailyLogPayload));
    }
  });

  if (saves.length === 0) {
    showToast('Vui lòng điền "Hôm nay làm gì" cho ít nhất 1 công việc', true);
    return;
  }

  const btn = document.getElementById('btnSubmitAllReports') as HTMLButtonElement | null;
  if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }

  Promise.all(saves)
    .then(() => {
      showToast(skipped > 0
        ? `Đã gửi ${saves.length} báo cáo (bỏ qua ${skipped} chưa điền)`
        : `🎉 Đã gửi ${saves.length} báo cáo hôm nay!`);
      return _reload();
    })
    .catch((e: Error) => showToast(e.message || 'Lỗi gửi báo cáo', true))
    .finally(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send" class="w-4 h-4 mr-1 inline-block"></i>Gửi toàn bộ báo cáo';
        refreshIcons();
      }
    });
}

async function _reload(): Promise<void> {
  try {
    state.projects = await tasksApi.list();
    renderDailyReport();
  } catch (e) {
    console.error('reload error', e);
  }
}
