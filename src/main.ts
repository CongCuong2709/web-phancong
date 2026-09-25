// ============================================================
// main.ts — entry point v3 (backend API mode)
// ============================================================
import './styles.css';

import { state } from './state';
import { loadCurrentUser } from './storage';
import { getToken, authApi, setToken } from './api';
import { setupModalBackdropClose, setupEscapeClose, refreshIcons } from './ui';
import * as H from './handlers';
import * as DR from './dailyReportHandlers';
import { renderProjects } from './render';


import type { View, CurrentUser, Role } from './types';
import { saveCurrentUser } from './storage';

// ============================================================
// Expose handlers cho HTML render động
// ============================================================
declare global {
  interface Window {
    handleLogin: () => void;
    handleLogout: () => void;
    navigateTo: (view: string) => void;
    openProjectModal: (id?: string) => void;
    closeProjectModal: () => void;
    handleSaveProject: (e: Event) => void;
    confirmDelete: (id: string) => void;
    openSubTaskModal: (projectId: string, subTaskId?: string) => void;
    closeSubTaskModal: () => void;
    handleSaveSubTask: (e: Event) => void;
    confirmDeleteSubTask: (projectId: string, subTaskId: string) => void;
    openDailyLogModal: (projectId: string, subTaskId?: string) => void;
    closeDailyLogModal: () => void;
    handleSaveDailyLog: (e: Event) => void;
    openProgressModal: (id: string) => void;
    closeProgressModal: () => void;
    handleSaveProgress: (e: Event) => void;
    openDetailModal: (id: string) => void;
    closeDetailModal: () => void;
    // Daily Report tab
    toggleDailyReportRow: (rowId: string) => void;
    saveDailyReportRow: (taskId: string, subId: string, rowId: string) => void;
    submitAllDailyReports: () => void;
  }
}


window.handleLogin    = () => { void H.handleLogin(); };
window.handleLogout   = () => H.handleLogout();
window.navigateTo     = (view: string) => H.navigateTo(view as View);

window.openProjectModal   = (id?: string) => H.openProjectModal(id);
window.closeProjectModal  = () => H.closeProjectModal();
window.handleSaveProject  = (e: Event) => H.handleSaveProject(e);
window.confirmDelete      = (id: string) => H.confirmDelete(id);

window.openSubTaskModal      = (projectId: string, subTaskId?: string) => H.openSubTaskModal(projectId, subTaskId);
window.closeSubTaskModal     = () => H.closeSubTaskModal();
window.handleSaveSubTask     = (e: Event) => H.handleSaveSubTask(e);
window.confirmDeleteSubTask  = (projectId: string, subTaskId: string) => H.confirmDeleteSubTask(projectId, subTaskId);

window.openDailyLogModal  = (projectId: string, subTaskId?: string) => H.openDailyLogModal(projectId, subTaskId);
window.closeDailyLogModal = () => H.closeDailyLogModal();
window.handleSaveDailyLog = (e: Event) => H.handleSaveDailyLog(e);

window.openProgressModal  = (id: string) => H.openProgressModal(id);
window.closeProgressModal = () => H.closeProgressModal();
window.handleSaveProgress = (e: Event) => H.handleSaveProgress(e);

window.openDetailModal  = (id: string) => H.openDetailModal(id);
window.closeDetailModal = () => H.closeDetailModal();

// Daily Report handlers
window.toggleDailyReportRow   = (rowId: string) => DR.toggleDailyReportRow(rowId);
window.saveDailyReportRow     = (taskId: string, subId: string, rowId: string) => DR.saveDailyReportRow(taskId, subId, rowId);
window.submitAllDailyReports  = () => DR.submitAllDailyReports();


// ============================================================
// Event delegation
// ============================================================
type ActionHandler = (target: HTMLElement) => void;

const ACTION_MAP: Record<string, ActionHandler> = {
  login:   () => { void H.handleLogin(); },
  logout:  () => H.handleLogout(),

  'open-project-modal': (t) => {
    const id = t.dataset.id;
    H.openProjectModal(id && id.length > 0 ? id : undefined);
  },
  'close-project-modal':  () => H.closeProjectModal(),
  'close-subtask-modal':  () => H.closeSubTaskModal(),
  'close-dailylog-modal': () => H.closeDailyLogModal(),
  'close-detail-modal':   () => H.closeDetailModal(),
};

function handleClick(e: MouseEvent): void {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  const actionEl = target.closest<HTMLElement>('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action) {
      const handler = ACTION_MAP[action];
      if (handler) {
        e.preventDefault();
        handler(actionEl);
        return;
      }
    }
  }

  const navEl = target.closest<HTMLElement>('[data-nav]');
  if (navEl) {
    const view = navEl.dataset.nav as View | undefined;
    if (view) {
      e.preventDefault();
      H.navigateTo(view);
    }
  }
}

function handleSubmit(e: SubmitEvent): void {
  const form = e.target as HTMLFormElement | null;
  if (!form) return;

  if (form.id === 'loginForm') {
    e.preventDefault();
    void H.handleLogin();
  } else if (form.id === 'projectForm') {
    e.preventDefault();
    H.handleSaveProject(e);
  } else if (form.id === 'subTaskForm') {
    e.preventDefault();
    H.handleSaveSubTask(e);
  } else if (form.id === 'dailyLogForm') {
    e.preventDefault();
    H.handleSaveDailyLog(e);
  }
}

function handleInput(e: Event): void {
  const target = e.target as HTMLInputElement | HTMLSelectElement | null;
  if (!target) return;
  const id = target.id;
  if (
    state.currentView === 'projects' &&
    (id === 'filterSearch' || id === 'filterDept' || id === 'filterStatus' || id === 'filterPriority' || id === 'filterTag')
  ) {
    renderProjects();
  }
  // Cập nhật label % progress trong daily log modal
  if (id === 'dlProgress') {
    const label = document.getElementById('dlProgressLabel');
    if (label) label.textContent = `${(target as HTMLInputElement).value}%`;
  }
}

function attachGlobalListeners(): void {
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('input', handleInput);
}

// ============================================================
// Boot
// ============================================================
async function init(): Promise<void> {
  setupModalBackdropClose();
  setupEscapeClose();
  attachGlobalListeners();
  refreshIcons();

  // Kiểm tra token + session còn hợp lệ không
  const token = getToken();
  const savedUser = loadCurrentUser();

  if (token && savedUser) {
    try {
      // Verify token với server
      const me = await authApi.me();
      const currentUser: CurrentUser = {
        id: me.id,
        username: me.username,
        role: me.role as Role,
        name: me.fullname,
        department: me.department,
        loginAt: savedUser.loginAt,
      };
      state.currentUser = currentUser;
      saveCurrentUser(currentUser);
      H.showApp();
    } catch {
      // Token hết hạn
      H.showLogin();
    }
  } else {
    H.showLogin();
  }

  console.info('✅ Phân công công việc v3 — Backend API mode');
}

void init();
