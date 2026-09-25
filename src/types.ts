// ============================================================
// TypeScript types & interfaces
// ============================================================

export type Role = 'admin' | 'director' | 'manager' | 'employee';

export type ProjectStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold';

export type Priority = 'low' | 'medium' | 'high';

export type View = 'dashboard' | 'projects' | 'myTasks' | 'reports' | 'dailyReport';


export interface HistoryEntry {
  at: string;       // ISO 8601 date-time
  action: string;
  user: string;
}

/** Nhật ký làm việc hằng ngày của nhân viên cho 1 SubTask */
export interface DailyLog {
  id: string;
  date: string;           // YYYY-MM-DD (ngày điền)
  description: string;    // Hôm nay đã làm gì
  result: string;         // Kết quả đạt được
  obstacle: string;       // Vướng mắc / khó khăn
  progress: number;       // % xong tính đến hôm nay (0-100)
  user: string;           // người điền (fullname)
  userId?: string;        // user id
  createdAt: string;      // ISO timestamp
}

/** Công việc con — Trưởng phòng tạo & giao cho Nhân viên */
export interface SubTask {
  id: string;
  taskId?: string;          // task cha (từ backend)
  name: string;
  description: string;
  assigneeId?: string;      // user id người thực hiện
  assignee: string;         // fullname người thực hiện
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  progress: number;         // 0-100
  status: ProjectStatus;
  priority: Priority;
  results: string;
  notes: string;
  history: HistoryEntry[];
  dailyLogs: DailyLog[];    // nhật ký hằng ngày
}

/**
 * Task (Công việc gốc) — Giám đốc / Trưởng phòng tạo.
 * Khi có subTasks, progress được tính tự động từ trung bình subTask.
 */
export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  department: string;               // phòng ban chủ trì
  collaboratingDepts: string[];     // các phòng ban phối hợp
  assigneeId?: string;              // user id Trưởng phòng nhận
  assignee: string;                 // fullname Trưởng phòng / người nhận chính
  createdBy: string;
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  progress: number;         // 0-100 (auto-computed nếu có subTasks)
  status: ProjectStatus;
  priority: Priority;
  results: string;
  notes: string;
  history: HistoryEntry[];
  subTasks: SubTask[];              // danh sách công việc con
}

export interface CurrentUser {
  id: string;           // user id từ DB
  username: string;     // tên đăng nhập
  role: Role;
  name: string;         // fullname hiển thị
  department: string;
  loginAt: string;
}

export interface ReportItem {
  label: string;
  count: number;
  pct: number;
}

export interface DeptProgress {
  sum: number;
  count: number;
}
