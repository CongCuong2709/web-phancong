// ============================================================
// Utility functions & constants
// ============================================================
import type {
  Project,
  SubTask,
  ProjectStatus,
  Priority,
  Role,
} from './types';

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  on_hold: 'Tạm dừng',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Quản trị',
  director: 'Ban Giám đốc',
  manager: 'Trưởng phòng',
  employee: 'Nhân viên',
};

export const DEPARTMENTS: readonly string[] = [
  'HCNS',
  'Kế toán',
  'Thu mua',
  'Ban Giám đốc',
  'Phòng IT',
  'Phòng Kế toán',
  'Phòng Nhân sự',
  'Phòng Kinh doanh',
  'Phòng Marketing',
] as const;

export function uid(): string {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN');
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN');
}

export function isOverdue(project: Project): boolean {
  if (!project.endDate || project.status === 'completed') return false;
  return new Date(project.endDate) < new Date(today());
}

export function isSubTaskOverdue(st: SubTask): boolean {
  if (!st.endDate || st.status === 'completed') return false;
  return new Date(st.endDate) < new Date(today());
}

export function progressColor(p: number): string {
  if (p >= 80) return '#10b981';
  if (p >= 40) return '#3b82f6';
  if (p >= 20) return '#f59e0b';
  return '#94a3b8';
}

export function escapeHtml(str: string | null | undefined): string {
  if (str == null) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function shiftDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function lucideRefresh(): void {
  if (typeof window !== 'undefined' && window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Tính tiến độ tổng của Task.
 * - Nếu có SubTask: tính trung bình cộng tiến độ của các SubTask.
 * - Nếu không có SubTask: dùng progress thủ công.
 */
export function computeTaskProgress(project: Project): number {
  if (!project.subTasks || project.subTasks.length === 0) return project.progress;
  const sum = project.subTasks.reduce((acc, st) => acc + (st.progress || 0), 0);
  return Math.round(sum / project.subTasks.length);
}

/**
 * Trả về DailyLog của ngày hôm nay nếu đã có, null nếu chưa.
 */
export function getTodayLog(st: SubTask): import('./types').DailyLog | null {
  const t = today();
  return st.dailyLogs?.find((l) => l.date === t) ?? null;
}

// ============================================================
// Tags — helpers
// ============================================================
const TAG_PALETTE = [
  { bg: '#e0e7ff', fg: '#4338ca' }, // indigo
  { bg: '#d1fae5', fg: '#047857' }, // emerald
  { bg: '#fee2e2', fg: '#b91c1c' }, // rose
  { bg: '#fed7aa', fg: '#c2410c' }, // orange
  { bg: '#fef3c7', fg: '#b45309' }, // amber
  { bg: '#ede9fe', fg: '#6d28d9' }, // violet
  { bg: '#cffafe', fg: '#0e7490' }, // cyan
  { bg: '#fce7f3', fg: '#9d174d' }, // pink
];

/** Mã màu ổn định theo tên tag (hash đơn giản) */
export function tagColor(tag: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % TAG_PALETTE.length;
  return TAG_PALETTE[idx];
}

/** Trả về true nếu task vừa tạo trong vòng `days` ngày gần đây. Dùng để gắn badge "Mới" / "Chưa phân rã". */
export function isRecentlyCreated(createdAt: string | undefined | null, days = 7): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  const diff = Date.now() - created;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

/** Chuẩn hoá tag: trim, bỏ rỗng, viết thường, bỏ trùng, giữ thứ tự */
export function normalizeTags(input: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (raw == null) continue;
    const t = String(raw).trim().toLowerCase();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Render HTML danh sách tag (badge) — escape + auto màu */
export function tagsBadgesHtml(tags: readonly string[] | undefined): string {
  if (!tags || !tags.length) return '';
  return tags
    .map((t) => {
      const c = tagColor(t);
      return `<span class="badge" style="background:${c.bg};color:${c.fg}">#${escapeHtml(t)}</span>`;
    })
    .join(' ');
}
