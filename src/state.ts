// ============================================================
// Module-level state (single source of truth)
// ============================================================
import type {
  Project,
  CurrentUser,
  View,
  TimelineMode,
  MyTasksMode,
  ProjectsViewMode,
  ConstructionProject,
  AssignmentBundle,
} from './types';

interface AppState {
  /** Hạng mục giao (legacy tasks API — dùng cho hiện tại) */
  projects: Project[];
  /** Dự án xây dựng (4-tier model mới) */
  constructionProjects: ConstructionProject[];
  /** Hạng mục giao flat (4-tier model mới — không join phases) */
  bundles: AssignmentBundle[];
  currentUser: CurrentUser | null;
  currentView: View;
  /** Chế độ xem hiện tại của view Timeline (Lịch / Gantt) */
  timelineMode: TimelineMode;
  /** Chế độ xem hiện tại của view MyTasks (Danh sách / Báo cáo ngày) */
  myTasksMode: MyTasksMode;
  /** Chế độ xem trong view Projects (Phân cấp / Danh sách) */
  projectsViewMode: ProjectsViewMode;
  /** Danh sách phòng ban (lấy từ API /users/departments) */
  departments: string[];
  /** Danh sách user active (để dropdown giao việc) */
  allUsers: Array<{ id: string; fullname: string; role: string; department: string; departments?: string[]; active?: number; username?: string }>;
  /** Loading state khi fetch API */
  loading: boolean;
}

export const state: AppState = {
  projects: [],
  constructionProjects: [],
  bundles: [],
  currentUser: null,
  currentView: 'dashboard',
  timelineMode: 'calendar',
  myTasksMode: 'list',
  projectsViewMode: 'hierarchy',
  departments: [],
  allUsers: [],
  loading: false,
};
