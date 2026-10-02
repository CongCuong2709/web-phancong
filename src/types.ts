// ============================================================
// TypeScript types & interfaces
// ============================================================

export type Role = 'admin' | 'director' | 'manager' | 'employee';

export type ProjectStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold';

/** Trạng thái Hạng mục giao (Bundle) — 5 trạng thái mới */
export type BundleStatus = 'assigned' | 'in_progress' | 'blocked' | 'completed' | 'closed';

/** Trạng thái Dự án xây dựng */
export type ConstructionProjectStatus = 'planning' | 'in_progress' | 'completed' | 'cancelled';

/** Trạng thái Giai đoạn */
export type PhaseStatus = 'pending' | 'in_progress' | 'completed';

export type Priority = 'low' | 'medium' | 'high';

export type View = 'dashboard' | 'projects' | 'myTasks' | 'reports' | 'timeline' | 'adminUsers';

/** Chế độ xem trong view "Dòng thời gian" (gộp Lịch + Gantt) */
export type TimelineMode = 'calendar' | 'gantt';

/** Chế độ xem trong view "Việc của tôi" (gộp Danh sách + Báo cáo ngày) */
export type MyTasksMode = 'list' | 'daily';

/** Chế độ xem trong view "Dự án" (Phân cấp / Danh sách bundle) */
export type ProjectsViewMode = 'hierarchy' | 'list';


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

/** Đầu việc — Trưởng phòng tạo & giao cho Nhân viên (= tasks trong DB) */
export interface SubTask {
  id: string;
  taskId?: string;          // bundle_id (= hạng mục cha)
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
  tags: string[];           // nhãn tự do (VD: urgent, audit, recurring)
  history: HistoryEntry[];
  dailyLogs: DailyLog[];    // nhật ký hằng ngày
  // Liên kết 4-tier
  projectId?: string;       // construction_projects.id (nếu có)
  bundleId?: string;        // assignment_bundles.id (nếu có)
  projectName?: string;     // tên dự án (join)
  bundleName?: string;      // tên hạng mục cha (join)
  phaseName?: string;       // tên giai đoạn (join)
  department?: string;      // phòng ban của task
}

/**
 * Hạng mục giao (Project object dùng cho API cũ) — Giám đốc / Trưởng phòng tạo.
 * Khi có subTasks, progress được tính tự động từ trung bình subTask.
 * NOTE: "Project" ở đây thực ra là "assignment_bundles" trong DB mới.
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
  tags: string[];                   // nhãn tự do
  history: HistoryEntry[];
  subTasks: SubTask[];              // danh sách đầu việc
  createdAt?: string;
  updatedAt?: string;
  // Liên kết 4-tier (từ bundles API)
  projectId?: string;       // construction_projects.id
  projectName?: string;     // tên dự án (join)
  phaseId?: string;         // project_phases.id
  phaseName?: string;       // tên giai đoạn (join)
  bundleStatus?: BundleStatus; // trạng thái bundle thực
}

// ============================================================
// 4-TIER MODEL TYPES (Mới — dùng cho view Dự án)
// ============================================================

/** Tầng 1: Dự án xây dựng */
export interface ConstructionProject {
  id: string;
  code: string;
  name: string;
  description: string;
  address: string;
  projectManagerId?: string;
  projectManager?: string;          // fullname
  targetStart: string;              // YYYY-MM-DD
  targetEnd: string;                // YYYY-MM-DD
  actualEnd?: string;
  status: ConstructionProjectStatus;
  budget?: number;                  // VND
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Computed / join
  phases?: ProjectPhase[];
  totalBundles?: number;
  completedBundles?: number;
  overallProgress?: number;         // 0-100
}

/** Tầng 2: Giai đoạn dự án */
export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  sequence: number;
  description?: string;
  targetStart: string;
  targetEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: PhaseStatus;
  createdAt: string;
  updatedAt: string;
  // Computed / join
  bundles?: AssignmentBundle[];
}

/** Tầng 3: Hạng mục giao (Bundle) — BGĐ → TP */
export interface AssignmentBundle {
  id: string;
  code: string;
  name: string;
  description: string;
  projectId: string;
  projectName?: string;             // join
  phaseId?: string;
  phaseName?: string;               // join
  ownerId: string;
  ownerName?: string;               // fullname của TP nhận
  department: string;               // phòng ban chủ trì
  startDate: string;
  dueDate: string;
  status: BundleStatus;
  progress: number;                 // 0-100
  priority: Priority;
  notes?: string;
  tags: string[];
  budget?: number;
  collaboratingDepts: string[];
  blockReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Tầng 4: các đầu việc trong bundle
  tasks?: SubTask[];
}

export interface CurrentUser {
  id: string;           // user id từ DB
  username: string;     // tên đăng nhập
  role: Role;
  name: string;         // fullname hiển thị
  department: string;   // phòng ban chính (primary)
  departments: string[];// TẤT CẢ phòng ban user thuộc (multi-dept)
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
