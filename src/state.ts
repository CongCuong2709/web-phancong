// ============================================================
// Module-level state (single source of truth)
// ============================================================
import type { Project, CurrentUser, View, TimelineMode, MyTasksMode } from './types';

interface AppState {
  projects: Project[];
  currentUser: CurrentUser | null;
  currentView: View;
  /** Chế độ xem hiện tại của view Timeline (Lịch / Gantt) */
  timelineMode: TimelineMode;
  /** Chế độ xem hiện tại của view MyTasks (Danh sách / Báo cáo ngày) */
  myTasksMode: MyTasksMode;
  /** Danh sách phòng ban (lấy từ API /users/departments) */
  departments: string[];
  /** Danh sách user active (để dropdown giao việc) */
  allUsers: Array<{ id: string; fullname: string; role: string; department: string; departments?: string[]; active?: number; username?: string }>;
  /** Loading state khi fetch API */
  loading: boolean;
}

export const state: AppState = {
  projects: [],
  currentUser: null,
  currentView: 'dashboard',
  timelineMode: 'calendar',
  myTasksMode: 'list',
  departments: [],
  allUsers: [],
  loading: false,
};
