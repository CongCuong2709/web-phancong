// ============================================================
// Event handlers — auth, CRUD, navigation, modal flows
// Phiên bản v3: dùng backend API thay localStorage
// ============================================================
import type { Project, SubTask, CurrentUser, Role, View } from './types';
import { state } from './state';
import { saveCurrentUser } from './storage';
import { authApi, tasksApi, usersApi, setToken, clearToken, type TaskPayload, type SubTaskPayload, type DailyLogPayload } from './api';
import { showToast, openModal, closeModal, setText, refreshIcons } from './ui';
import { ROLE_LABEL, today, normalizeTags, escapeHtml } from './utils';
import { getTags, setTags, resetTags, initAllTagsInputs } from './tagsInput';
import { renderTimeline, bindTimelineToggle } from './renderTimeline';
import { setMyTasksMode } from './render';
import { renderAdminUsers, openUserModal, closeUserModal, handleSaveUser, confirmDeleteUser, resetUserPassword } from './renderAdminUsers';
import {
  renderDashboard,
  renderProjects,
  renderMyTasks,
  renderReports,
  populateDeptFilter,
  renderDetailBody,
} from './render';
import { renderDailyReport } from './renderDailyReport';


// ============================================================
// Auth — show / hide login & app screens
// ============================================================
export function showLogin(): void {
  document.getElementById('loginScreen')?.classList.remove('hidden');
  document.getElementById('appScreen')?.classList.add('hidden');
}

export function showApp(): void {
  document.getElementById('loginScreen')?.classList.add('hidden');
  document.getElementById('appScreen')?.classList.remove('hidden');

  if (state.currentUser) {
    const roleText = ROLE_LABEL[state.currentUser.role] ?? state.currentUser.role;
    const depts = state.currentUser.departments?.length
      ? state.currentUser.departments.join(', ')
      : state.currentUser.department;
    setText('userInfo', `${state.currentUser.name} • ${roleText} • ${depts}`);

    const todayStr = new Date().toLocaleDateString('vi-VN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    setText('dashboardGreeting', `Hôm nay ${todayStr}. Chào mừng ${state.currentUser.name}!`);
  }

  // Khởi tạo tags input (một lần)
  initAllTagsInputs();

  applyRolePermissions();
  bindTimelineToggle();
  bindMyTasksSubTabs();
  // Tải dữ liệu ban đầu từ API
  void loadInitialData();
  refreshIcons();
}

/** Tải danh sách tasks + users/departments từ backend */
async function loadInitialData(): Promise<void> {
  try {
    state.loading = true;

    // Tải song song
    const [tasks, departments, users] = await Promise.all([
      tasksApi.list(),
      usersApi.departments(),
      usersApi.byDepartment(),
    ]);

    state.projects = tasks;
    state.departments = departments;
    state.allUsers = users;

    populateDeptFilter();
    updateMyTasksBadge();
    navigateTo('dashboard');
  } catch (err) {
    showToast('Không thể tải dữ liệu từ server. Kiểm tra kết nối.', true);
    console.error(err);
  } finally {
    state.loading = false;
  }
}

/** Reload tasks từ API và re-render view hiện tại */
async function reloadTasks(): Promise<void> {
  try {
    state.projects = await tasksApi.list();
    navigateTo(state.currentView);
    updateMyTasksBadge();
  } catch (err) {
    showToast('Lỗi cập nhật dữ liệu', true);
    console.error(err);
  }
}

/** Đếm số SubTask của user hiện tại mà chưa có daily log hôm nay */
export function countMyPendingDailyReports(): number {
  if (!state.currentUser) return 0;
  const t = today();
  let count = 0;
  for (const p of state.projects) {
    if (!p.subTasks) continue;
    for (const st of p.subTasks) {
      if (st.assignee !== state.currentUser.name) continue;
      if (st.status === 'completed') continue;
      const has = (st.dailyLogs || []).some((l) => l.date === t);
      if (!has) count++;
    }
  }
  return count;
}

/** Cập nhật badge "!" trên nút "Việc của tôi" */
export function updateMyTasksBadge(): void {
  const badge = document.getElementById('myTasksBadge');
  if (!badge) return;
  const n = countMyPendingDailyReports();
  if (n > 0) {
    badge.textContent = String(n);
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }
}

/** Bind 1 lần — click sub-tab (Danh sách / Báo cáo hôm nay) */
let subTabListenersBound = false;
export function bindMyTasksSubTabs(): void {
  if (subTabListenersBound) return;
  subTabListenersBound = true;
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const btn = target.closest<HTMLElement>('[data-mytasks-mode]');
    if (!btn) return;
    const mode = btn.dataset.mytasksMode;
    if (mode === 'list' || mode === 'daily') {
      e.preventDefault();
      setMyTasksMode(mode);
    }
  });
}

export async function handleLogin(): Promise<void> {
  const usernameEl = document.getElementById('loginUsername') as HTMLInputElement | null;
  const passwordEl = document.getElementById('loginPassword') as HTMLInputElement | null;
  if (!usernameEl || !passwordEl) return;

  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  if (!username || !password) {
    showToast('Vui lòng nhập tên đăng nhập và mật khẩu', true);
    return;
  }

  // Hiển thị trạng thái đang đăng nhập
  const btnEl = document.getElementById('loginBtn') as HTMLButtonElement | null;
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Đang đăng nhập...'; }

  try {
    const { token, user } = await authApi.login(username, password);
    setToken(token);

    const currentUser: CurrentUser = {
      id: user.id,
      username: user.username,
      role: user.role as Role,
      name: user.fullname,
      department: user.department,
      departments: user.departments ?? [user.department].filter(Boolean),
      loginAt: new Date().toISOString(),
    };
    state.currentUser = currentUser;
    saveCurrentUser(currentUser);
    showApp();
    showToast(`Xin chào ${user.fullname}!`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại';
    showToast(msg, true);
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Đăng nhập'; }
  }
}

export function handleLogout(): void {
  if (!window.confirm('Bạn có chắc muốn đăng xuất?')) return;
  state.currentUser = null;
  state.projects = [];
  clearToken();
  saveCurrentUser(null);
  showLogin();
}

function applyRolePermissions(): void {
  const role = state.currentUser?.role;
  const canCreate = role === 'director' || role === 'manager' || role === 'admin';
  const isAdmin = role === 'admin';

  document.querySelectorAll<HTMLButtonElement>('[data-action="open-project-modal"]').forEach((b) => {
    b.style.display = canCreate ? '' : 'none';
  });

  const reportsNavBtn = document.querySelector<HTMLButtonElement>('[data-nav="reports"]');
  if (reportsNavBtn) {
    reportsNavBtn.style.display = role === 'employee' ? 'none' : '';
  }

  // Nút "Quản lý NV" chỉ admin mới thấy
  const adminNavBtn = document.querySelector<HTMLButtonElement>('[data-nav="adminUsers"]');
  if (adminNavBtn) {
    adminNavBtn.style.display = isAdmin ? '' : 'none';
  }

  // "Việc của tôi" chỉ hiển thị với manager + employee
  // BGĐ/Admin chỉ giao việc chứ không "nhận việc của tôi" riêng
  const myTasksNavBtn = document.querySelector<HTMLButtonElement>('[data-nav="myTasks"]');
  if (myTasksNavBtn) {
    const showMyTasks = role === 'manager' || role === 'employee';
    myTasksNavBtn.style.display = showMyTasks ? '' : 'none';
  }
}

// ============================================================
// Navigation
// ============================================================
export function navigateTo(view: View): void {
  state.currentView = view;

  (['dashboard', 'projects', 'myTasks', 'reports', 'timeline', 'adminUsers'] as View[]).forEach((v) => {
    document.getElementById(`view-${v}`)?.classList.add('hidden');
  });
  document.getElementById(`view-${view}`)?.classList.remove('hidden');

  document.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((btn) => btn.classList.remove('active'));
  document.querySelector<HTMLButtonElement>(`[data-nav="${view}"]`)?.classList.add('active');

  switch (view) {
    case 'dashboard':    renderDashboard();       break;
    case 'projects':     renderProjects();        break;
    case 'myTasks':      renderMyTasks();         break;
    case 'reports':      renderReports();         break;
    case 'timeline':     renderTimeline();        break;
    case 'adminUsers':   void renderAdminUsers(); break;
  }
  refreshIcons();
}

// ============================================================
// Project modal (create / edit)
// ============================================================
export function openProjectModal(id?: string): void {
  const form = document.getElementById('projectForm') as HTMLFormElement | null;
  if (!form) return;
  form.reset();

  document.querySelectorAll<HTMLInputElement>('input[name="collabDept"]').forEach((cb) => {
    cb.checked = false;
  });

  resetTags('fTags');

  // Reset parent task (chỉ dùng khi tạo mới, không dùng khi edit)
  const parentSel = document.getElementById('fParentTask') as HTMLSelectElement | null;
  if (parentSel) parentSel.value = '';

  const idEl = document.getElementById('projectId') as HTMLInputElement | null;
  if (idEl) idEl.value = '';

  const titleEl = document.getElementById('projectModalTitle');

  if (id) {
    const p = state.projects.find((x) => x.id === id);
    if (!p) return;
    if (titleEl) titleEl.textContent = 'Sửa công việc';

    (document.getElementById('fCode') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fCode') as HTMLInputElement).value = p.code || '');
    (document.getElementById('fName') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fName') as HTMLInputElement).value = p.name || '');
    (document.getElementById('fDescription') as HTMLTextAreaElement | null)?.value !== undefined &&
      ((document.getElementById('fDescription') as HTMLTextAreaElement).value = p.description || '');
    (document.getElementById('fDept') as HTMLSelectElement | null)?.value !== undefined &&
      ((document.getElementById('fDept') as HTMLSelectElement).value = p.department || '');
    (document.getElementById('fAssigneeId') as HTMLSelectElement | null)?.value !== undefined &&
      ((document.getElementById('fAssigneeId') as HTMLSelectElement).value = p.assigneeId || '');
    (document.getElementById('fStartDate') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fStartDate') as HTMLInputElement).value = p.startDate || '');
    (document.getElementById('fEndDate') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fEndDate') as HTMLInputElement).value = p.endDate || '');
    (document.getElementById('fPriority') as HTMLSelectElement | null)?.value !== undefined &&
      ((document.getElementById('fPriority') as HTMLSelectElement).value = p.priority || 'medium');
    (document.getElementById('fProgress') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fProgress') as HTMLInputElement).value = String(p.progress || 0));
    (document.getElementById('fResults') as HTMLTextAreaElement | null)?.value !== undefined &&
      ((document.getElementById('fResults') as HTMLTextAreaElement).value = p.results || '');
    (document.getElementById('fStatus') as HTMLSelectElement | null)?.value !== undefined &&
      ((document.getElementById('fStatus') as HTMLSelectElement).value = p.status || 'not_started');
    if (idEl) idEl.value = p.id;
    // Modal title: "Sửa: [Code] Tên"
    if (titleEl) titleEl.textContent = `Sửa: [${p.code}] ${p.name}`;
    // Hiện "Kết quả thực hiện" khi edit
    document.getElementById('fResultsWrapper')?.classList.remove('hidden');

    const collabDepts = p.collaboratingDepts || [];
    document.querySelectorAll<HTMLInputElement>('input[name="collabDept"]').forEach((cb) => {
      cb.checked = collabDepts.includes(cb.value);
    });

    setTags('fTags', p.tags || []);
  } else {
    if (titleEl) titleEl.textContent = 'Tạo công việc mới';
    // Ẩn "Kết quả thực hiện" khi tạo mới (chưa có kết quả)
    document.getElementById('fResultsWrapper')?.classList.add('hidden');
    (document.getElementById('fStartDate') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fStartDate') as HTMLInputElement).value = today());
    const nextNo = String(state.projects.length + 1).padStart(3, '0');
    (document.getElementById('fCode') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fCode') as HTMLInputElement).value = `DA${nextNo}`);
  }

  // Populate assignee dropdown từ danh sách users
  populateAssigneeDropdown('fAssigneeId');
  populateDeptSelectInForm();
  populateCollabCheckboxes();
  populateParentTaskSelect();
  populateTagSuggestions();
  autoFillDeptFromAssignee();
  // Validation realtime
  attachFormGuards();
  // Auto-suggest mã mới (nếu không phải edit)
  if (!id) suggestNextCode();

  // Gợi ý theo vai trò (BGĐ vs TP)
  const hintEl = document.getElementById('projectRoleHint');
  if (hintEl && state.currentUser) {
    const role = state.currentUser.role;
    if (role === 'director') {
      hintEl.innerHTML = `💡 <strong>Gợi ý:</strong> BGĐ nên tạo Hạng mục công việc lớn, giao cho Trưởng phòng để họ phân rã thành SubTask cho Nhân viên (tránh giao vi mô).`;
      hintEl.classList.remove('hidden');
    } else if (role === 'manager') {
      hintEl.innerHTML = `💡 <strong>Gợi ý:</strong> Sau khi tạo, bạn nên phân rã thành các SubĐầu việc và giao cho Nhân viên trong phòng (≥ 1 SubTask, trừ việc nhỏ 1 người làm).`;
      hintEl.classList.remove('hidden');
    } else {
      hintEl.classList.add('hidden');
    }
  }

  openModal('projectModal');
  refreshIcons();
}

export function closeProjectModal(): void {
  // Confirm nếu form có dữ liệu đang nhập
  const nameEl = document.getElementById('fName') as HTMLInputElement | null;
  if (nameEl?.value?.trim() && !window.confirm('Form đang có dữ liệu chưa lưu. Đóng cửa sổ?')) {
    return;
  }
  closeModal('projectModal');
}

/**
 * Dropdown "Giao cho (Trưởng phòng)" cho task CHA.
 * - BGĐ: chỉ thấy manager (TP) - không giao cho BGĐ khác, không tự giao
 * - Admin: thấy tất cả manager + director (trừ self)
 * - Manager: chỉ thấy manager + director trong (các) phòng của mình (trừ self)
 * Tránh: BGĐ tự giao cho mình; TP giao cho TP khác phòng ban.
 */
function populateAssigneeDropdown(selectId: string, _deptFilter?: string): void {
  const el = document.getElementById(selectId) as HTMLSelectElement | null;
  if (!el) return;
  const current = el.value;
  const me = state.currentUser;
  if (!me) return;

  const myDepts = getMyDeptList(me);

  // BGĐ: chỉ giao cho Trưởng phòng (role=manager); không giao cho BGĐ khác
  // Admin: tất cả manager + director (trừ self)
  // Manager: manager + director trong cùng phòng (trừ self)
  let users = state.allUsers.filter((u) => u.id !== me.id);

  if (me.role === 'director') {
    users = users.filter((u) => u.role === 'manager');
  } else if (me.role === 'admin') {
    users = users.filter((u) => u.role === 'manager' || u.role === 'director');
  } else if (me.role === 'manager') {
    users = users.filter(
      (u) => (u.role === 'manager' || u.role === 'director') &&
      (() => {
        const ud = (u.departments && u.departments.length) ? u.departments : [u.department].filter(Boolean);
        return ud.some((d) => myDepts.includes(d));
      })()
    );
  } else {
    // NV không nên vào đây, fallback an toàn: chỉ manager trong phòng mình
    users = users.filter((u) => u.role === 'manager');
  }

  el.innerHTML = '<option value="">— Chọn người nhận —</option>' +
    users.map(u => `<option value="${u.id}">${u.fullname} (${u.department})</option>`).join('');
  if (current && users.some((u) => u.id === current)) el.value = current;
}

/**
 * Dropdown "Giao cho (Nhân viên)" cho SUBTASK.
 * - BGĐ/Admin: thấy tất cả employee + manager (chọn người thực hiện)
 * - Manager/Employee: chỉ thấy người trong (các) phòng mình, trừ chính mình
 */
function populateEmployeeDropdown(selectId: string): void {
  const el = document.getElementById(selectId) as HTMLSelectElement | null;
  if (!el) return;
  const current = el.value;
  const me = state.currentUser;
  if (!me) return;

  const myDepts = getMyDeptList(me);

  let users = state.allUsers.filter((u) =>
    (u.role === 'employee' || u.role === 'manager') && u.id !== me.id
  );

  if (me.role === 'manager' || me.role === 'employee') {
    // TP / NV chỉ thấy đồng nghiệp cùng phòng
    users = users.filter((u) => {
      const ud = (u.departments && u.departments.length) ? u.departments : [u.department].filter(Boolean);
      return ud.some((d) => myDepts.includes(d));
    });
  }

  el.innerHTML = '<option value="">— Chọn nhân viên —</option>' +
    users.map(u => `<option value="${u.id}">${u.fullname} (${u.department})</option>`).join('');
  if (current && users.some((u) => u.id === current)) el.value = current;
}

/** Helper: lấy danh sách phòng của user hiện tại (ưu tiên departments[], fallback department) */
function getMyDeptList(me: { departments?: string[]; department: string }): string[] {
  if (me.departments && me.departments.length) return me.departments;
  return me.department ? [me.department] : [];
}

/**
 * Populate dropdown "Phòng ban chủ trì" trong form tạo/sửa task.
 * - BGĐ/Admin: thấy tất cả phòng ban có trong hệ thống
 * - Manager: chỉ thấy các phòng mà mình thuộc
 * Dữ liệu lấy từ state.departments (load qua API /api/users/departments).
 */
function populateDeptSelectInForm(): void {
  const sel = document.getElementById('fDept') as HTMLSelectElement | null;
  if (!sel) return;
  const me = state.currentUser;
  if (!me) return;

  const allDepts = state.departments && state.departments.length
    ? state.departments
    : ['Ban Giám đốc']; // fallback tối thiểu

  let allowed: string[];
  if (me.role === 'admin' || me.role === 'director') {
    allowed = allDepts;
  } else {
    // Manager (và NV nếu lỡ vào đây): chỉ phòng của mình
    const myDepts = getMyDeptList(me);
    allowed = myDepts.filter((d) => allDepts.includes(d));
    if (!allowed.length) allowed = allDepts; // fallback hiếm gặp
  }
  const prev = sel.value;
  sel.innerHTML = allowed.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  if (prev && allowed.includes(prev)) sel.value = prev;
}

/**
 * Populate checkbox group "Phòng phối hợp thêm" - dùng state.departments (động theo DB)
 */
function populateCollabCheckboxes(): void {
  const wrap = document.getElementById('collabDeptContainer');
  if (!wrap) return;
  const me = state.currentUser;
  if (!me) return;
  const allDepts = state.departments && state.departments.length
    ? state.departments
    : [];
  const myDept = me.department || '';
  // Loại trừ phòng chủ trì của mình ra khỏi collab (logic nghiệp vụ: collab ≠ primary)
  const filtered = allDepts.filter((d) => d && d !== myDept);
  wrap.innerHTML = filtered
    .map((d) => `
      <label>
        <input type="checkbox" name="collabDept" value="${escapeHtml(d)}" class="w-4 h-4 rounded text-indigo-600" />
        <span>${escapeHtml(d)}</span>
      </label>`)
    .join('');
}

/**
 * Auto-fill "Phòng ban chủ trì" khi user chọn Assignee (TP).
 * Nếu TP có nhiều phòng → lấy phòng chính.
 */
function autoFillDeptFromAssignee(): void {
  const sel = document.getElementById('fAssigneeId') as HTMLSelectElement | null;
  const deptSel = document.getElementById('fDept') as HTMLSelectElement | null;
  if (!sel || !deptSel) return;
  sel.onchange = () => {
    const assigneeId = sel.value;
    if (!assigneeId) return;
    const assignee = state.allUsers.find((u) => u.id === assigneeId);
    if (!assignee) return;
    // Ưu tiên: departments[0] (primary), fallback department
    const primaryDept = (assignee.departments && assignee.departments[0])
      || assignee.department;
    if (primaryDept && deptSel.querySelector(`option[value="${primaryDept}"]`)) {
      deptSel.value = primaryDept;
    }
  };
}

/**
 * Auto-suggest mã tiếp theo khi tạo task mới: "DAxxx" với số lượng + 1.
 */
function suggestNextCode(): void {
  const codeInput = document.getElementById('fCode') as HTMLInputElement | null;
  if (!codeInput || codeInput.value) return;
  const count = state.projects.length;
  const next = `DA${String(count + 1).padStart(3, '0')}`;
  codeInput.placeholder = `VD: ${next} (để trống để tự sinh)`;
}

/**
 * Gắn 1 lần: validate realtime endDate>=startDate + status↔progress
 */
let formGuardsBound = false;
function attachFormGuards(): void {
  if (formGuardsBound) return;
  formGuardsBound = true;

  const startEl = document.getElementById('fStartDate') as HTMLInputElement | null;
  const endEl = document.getElementById('fEndDate') as HTMLInputElement | null;
  const statusEl = document.getElementById('fStatus') as HTMLSelectElement | null;
  const progressEl = document.getElementById('fProgress') as HTMLInputElement | null;
  const warnEl = document.getElementById('projectFormWarn');

  const showWarn = (msg: string) => {
    if (!warnEl) return;
    warnEl.textContent = msg;
    warnEl.classList.remove('hidden');
  };
  const clearWarn = () => {
    if (!warnEl) return;
    warnEl.textContent = '';
    warnEl.classList.add('hidden');
  };

  const check = () => {
    clearWarn();
    if (startEl?.value && endEl?.value) {
      if (new Date(endEl.value) < new Date(startEl.value)) {
        showWarn('⚠ Hạn xong phải >= ngày bắt đầu.');
        return;
      }
    }
    if (statusEl && progressEl) {
      const s = statusEl.value;
      const p = Number(progressEl.value || 0);
      if (s === 'completed' && p < 100) {
        showWarn('⚠ Trạng thái "Hoàn thành" yêu cầu tiến độ = 100%.');
        return;
      }
      if (s === 'not_started' && p > 0) {
        showWarn('⚠ Trạng thái "Chưa bắt đầu" yêu cầu tiến độ = 0%.');
        return;
      }
    }
  };

  startEl?.addEventListener('change', check);
  endEl?.addEventListener('change', check);
  statusEl?.addEventListener('change', check);
  progressEl?.addEventListener('input', check);
}

/**
 * Tạo <datalist> gợi ý tag từ tất cả tag đã dùng trong tasks.
 */
function populateTagSuggestions(): void {
  const tagSet = new Set<string>();
  for (const p of state.projects) {
    for (const t of p.tags || []) tagSet.add(t);
    for (const s of p.subTasks || []) for (const t of s.tags || []) tagSet.add(t);
  }
  const sorted = [...tagSet].sort();
  let dl = document.getElementById('tagSuggestionsList') as HTMLDataListElement | null;
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = 'tagSuggestionsList';
    document.body.appendChild(dl);
  }
  dl.innerHTML = sorted.map((t) => `<option value="${escapeHtml(t)}"></option>`).join('');
  const tagInput = document.getElementById('fTags') as HTMLInputElement | null;
  const stTagInput = document.getElementById('stTags') as HTMLInputElement | null;
  if (tagInput) tagInput.setAttribute('list', 'tagSuggestionsList');
  if (stTagInput) stTagInput.setAttribute('list', 'tagSuggestionsList');
}

/**
 * Populate dropdown "Gắn vào Hạng mục công việc" trong form Tạo công việc.
 * - BGĐ: KHÔNG hiển thị (BGĐ không tạo Đầu việc trực tiếp)
 * - Manager/Admin: hiện tất cả task mà user có thể quản lý trong (các) phòng của mình
 */
function populateParentTaskSelect(): void {
  const sel = document.getElementById('fParentTask') as HTMLSelectElement | null;
  const wrapper = document.getElementById('fParentTaskWrapper');
  const me = state.currentUser;
  if (!sel || !wrapper || !me) return;

  // BGĐ không được gắn hạng mục công việc (vì sẽ trở thành Đầu việc — BGĐ bị cấm)
  if (me.role === 'director') {
    wrapper.classList.add('hidden');
    sel.disabled = true;
    return;
  }
  wrapper.classList.remove('hidden');
  sel.disabled = false;

  const myDepts = getMyDeptList(me);
  const allVisible = state.projects.filter((p) => {
    // Chỉ task chưa hoàn thành, có thể gắn SubTask
    if (p.status === 'completed') return false;
    if (me.role === 'admin') return true;
    // Manager: task trong phòng mình
    return myDepts.includes(p.department) ||
      (p.collaboratingDepts || []).some((d) => myDepts.includes(d));
  });

  const prev = sel.value;
  sel.innerHTML =
    '<option value="">— Để tạo Task độc lập —</option>' +
    allVisible.map((p) => {
      const subCount = p.subTasks?.length || 0;
      return `<option value="${p.id}">[${escapeHtml(p.code)}] ${escapeHtml(p.name)} (${subCount} đầu việc)</option>`;
    }).join('');
  if (prev && allVisible.some((p) => p.id === prev)) sel.value = prev;
}

function readProjectForm(): TaskPayload | null {
  const code = (document.getElementById('fCode') as HTMLInputElement | null)?.value.trim() ?? '';
  const name = (document.getElementById('fName') as HTMLInputElement | null)?.value.trim() ?? '';
  const description = (document.getElementById('fDescription') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const department = (document.getElementById('fDept') as HTMLSelectElement | null)?.value ?? '';
  const assigneeId = (document.getElementById('fAssigneeId') as HTMLSelectElement | null)?.value ?? '';
  const startDate = (document.getElementById('fStartDate') as HTMLInputElement | null)?.value ?? '';
  const endDate = (document.getElementById('fEndDate') as HTMLInputElement | null)?.value ?? '';
  const priority = ((document.getElementById('fPriority') as HTMLSelectElement | null)?.value as 'low' | 'medium' | 'high') || 'medium';
  const progress = Number((document.getElementById('fProgress') as HTMLInputElement | null)?.value ?? 0);
  const results = (document.getElementById('fResults') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const status = ((document.getElementById('fStatus') as HTMLSelectElement | null)?.value as Project['status']) || 'not_started';

  const collaboratingDepts: string[] = [];
  document.querySelectorAll<HTMLInputElement>('input[name="collabDept"]:checked').forEach((cb) => {
    if (cb.value !== department) collaboratingDepts.push(cb.value);
  });

  if (!name) return null;

  const tags = normalizeTags(getTags('fTags'));

  return {
    code, name, description, department, collaboratingDepts,
    assigneeId: assigneeId || undefined,
    startDate, endDate, priority, progress, results, status,
    tags,
  };
}

export function handleSaveProject(e: Event): void {
  e.preventDefault();
  const id = (document.getElementById('projectId') as HTMLInputElement | null)?.value ?? '';
  // Nếu user chọn "Gắn vào Hạng mục công việc" → tạo Đầu việc thay vì Hạng mục gốc
  const parentTaskId = (document.getElementById('fParentTask') as HTMLSelectElement | null)?.value ?? '';
  const data = readProjectForm();
  if (!data) {
    showToast('Vui lòng nhập tên công việc', true);
    return;
  }

  // Phát hiện trùng tên task trong cùng phòng
  if (!id) {
    const dup = state.projects.find((p) =>
      p.department === data.department &&
      p.name.trim().toLowerCase() === data.name.trim().toLowerCase()
    );
    if (dup && !window.confirm(
      `Đã có task "${dup.code} — ${dup.name}" trong phòng "${data.department}".\n\n` +
      `Bạn vẫn muốn tạo thêm task trùng tên?`
    )) {
      // User hủy → focus lại ô tên
      (document.getElementById('fName') as HTMLInputElement | null)?.focus();
      return;
    }
  }

  const btn = document.querySelector<HTMLButtonElement>('#projectForm button[type="submit"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Đang lưu...'; }

  // Nếu đang tạo mới + có parent → tạo Đầu việc thuộc Hạng mục đó
  const promise: Promise<Project | SubTask> =
    id
      ? tasksApi.update(id, data)
      : parentTaskId
        ? tasksApi.createSubTask(parentTaskId, data)
        : tasksApi.create(data);

  promise
    .then((createdOrUpdated) => {
      showToast(id ? 'Đã cập nhật công việc' : 'Đã tạo công việc mới');
      closeProjectModal();
      // Hỏi TP/Admin phân rã Đầu việc ngay sau khi tạo Hạng mục công việc MỚI (chỉ khi tạo root task, không phải SubTask)
      const me = state.currentUser;
      if (!id && !parentTaskId && createdOrUpdated && me && (me.role === 'manager' || me.role === 'admin')) {
        const taskCode = (createdOrUpdated as Project).code || '';
        setTimeout(() => {
          if (window.confirm(
            `Task "${taskCode} — ${(createdOrUpdated as Project).name}" đã tạo.\n\n` +
            `Bạn có muốn phân rã thành các Đầu việc và giao cho Nhân viên ngay bây giờ không?\n` +
            `(Khuyến nghị cho Trưởng phòng theo quy trình chuẩn)`
          )) {
            openSubTaskModal((createdOrUpdated as Project).id);
          }
        }, 200);
      }
      return reloadTasks();
    })
    .catch((err: Error) => {
      showToast(err.message || 'Lỗi lưu công việc', true);
    })
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = 'Lưu'; }
    });
}

export function confirmDelete(id: string): void {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  if (!window.confirm(`Xóa công việc "${p.code} - ${p.name}"?\nHành động này không thể hoàn tác.`)) return;

  tasksApi.delete(id)
    .then(() => {
      showToast('Đã xóa công việc');
      return reloadTasks();
    })
    .catch((err: Error) => showToast(err.message || 'Lỗi xóa công việc', true));
}

// ============================================================
// SubTask modal (create / edit) — Trưởng phòng dùng
// ============================================================
export function openSubTaskModal(projectId: string, subTaskId?: string): void {
  const form = document.getElementById('subTaskForm') as HTMLFormElement | null;
  if (!form) return;
  form.reset();

  resetTags('stTags');

  const pidEl = document.getElementById('stProjectId') as HTMLInputElement | null;
  const sidEl = document.getElementById('stSubTaskId') as HTMLInputElement | null;
  if (pidEl) pidEl.value = projectId;
  if (sidEl) sidEl.value = '';

  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return;

  const titleEl = document.getElementById('subTaskModalTitle');
  const contextEl = document.getElementById('subTaskContext');
  // Context: "Thuộc: [Code] Tên — Phòng XYZ"
  if (contextEl) {
    contextEl.textContent = `Thuộc: [${p.code}] ${p.name} • ${p.department}`;
    contextEl.classList.remove('hidden');
  }

  if (subTaskId) {
    const st = p.subTasks?.find((s) => s.id === subTaskId);
    if (!st) return;
    if (titleEl) titleEl.textContent = `Sửa: ${st.name}`;
    if (sidEl) sidEl.value = st.id;

    (document.getElementById('stName') as HTMLInputElement | null) &&
      ((document.getElementById('stName') as HTMLInputElement).value = st.name || '');
    (document.getElementById('stDescription') as HTMLTextAreaElement | null) &&
      ((document.getElementById('stDescription') as HTMLTextAreaElement).value = st.description || '');
    (document.getElementById('stStartDate') as HTMLInputElement | null) &&
      ((document.getElementById('stStartDate') as HTMLInputElement).value = st.startDate || '');
    (document.getElementById('stEndDate') as HTMLInputElement | null) &&
      ((document.getElementById('stEndDate') as HTMLInputElement).value = st.endDate || '');
    (document.getElementById('stPriority') as HTMLSelectElement | null) &&
      ((document.getElementById('stPriority') as HTMLSelectElement).value = st.priority || 'medium');
    (document.getElementById('stStatus') as HTMLSelectElement | null) &&
      ((document.getElementById('stStatus') as HTMLSelectElement).value = st.status || 'not_started');
    (document.getElementById('stProgress') as HTMLInputElement | null) &&
      ((document.getElementById('stProgress') as HTMLInputElement).value = String(st.progress || 0));
    (document.getElementById('stResults') as HTMLTextAreaElement | null) &&
      ((document.getElementById('stResults') as HTMLTextAreaElement).value = st.results || '');

    setTags('stTags', st.tags || []);
  } else {
    if (titleEl) titleEl.textContent = 'Thêm đầu việc';
    (document.getElementById('stStartDate') as HTMLInputElement | null) &&
      ((document.getElementById('stStartDate') as HTMLInputElement).value = today());
    (document.getElementById('stEndDate') as HTMLInputElement | null) &&
      ((document.getElementById('stEndDate') as HTMLInputElement).value = p.endDate || '');
  }

  // Populate nhân viên dropdown
  populateEmployeeDropdown('stAssigneeId');
  if (subTaskId) {
    const st = p.subTasks?.find((s) => s.id === subTaskId);
    if (st?.assigneeId) {
      const sel = document.getElementById('stAssigneeId') as HTMLSelectElement | null;
      if (sel) sel.value = st.assigneeId;
    }
  }

  openModal('subTaskModal');
  refreshIcons();
}

export function closeSubTaskModal(): void {
  const nameEl = document.getElementById('stName') as HTMLInputElement | null;
  if (nameEl?.value?.trim() && !window.confirm('Form đang có dữ liệu chưa lưu. Đóng cửa sổ?')) {
    return;
  }
  closeModal('subTaskModal');
}

export function handleSaveSubTask(e: Event): void {
  e.preventDefault();
  const projectId = (document.getElementById('stProjectId') as HTMLInputElement | null)?.value ?? '';
  const subTaskId = (document.getElementById('stSubTaskId') as HTMLInputElement | null)?.value ?? '';

  const name = (document.getElementById('stName') as HTMLInputElement | null)?.value.trim() ?? '';
  const description = (document.getElementById('stDescription') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const assigneeId = (document.getElementById('stAssigneeId') as HTMLSelectElement | null)?.value ?? '';
  const startDate = (document.getElementById('stStartDate') as HTMLInputElement | null)?.value ?? '';
  const endDate = (document.getElementById('stEndDate') as HTMLInputElement | null)?.value ?? '';
  const priority = ((document.getElementById('stPriority') as HTMLSelectElement | null)?.value as SubTask['priority']) || 'medium';
  const status = ((document.getElementById('stStatus') as HTMLSelectElement | null)?.value as SubTask['status']) || 'not_started';

  if (!name) {
    showToast('Vui lòng nhập tên đầu việc', true);
    return;
  }

  const tags = normalizeTags(getTags('stTags'));
  const progress = Number((document.getElementById('stProgress') as HTMLInputElement | null)?.value ?? 0);
  const results = ((document.getElementById('stResults') as HTMLTextAreaElement | null)?.value ?? '').trim();
  const payload: SubTaskPayload = {
    name, description, assigneeId: assigneeId || undefined,
    startDate, endDate, priority, status, tags, progress, results,
  };

  const btn = document.querySelector<HTMLButtonElement>('#subTaskForm button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  const save = subTaskId
    ? tasksApi.updateSubTask(projectId, subTaskId, payload)
    : tasksApi.createSubTask(projectId, payload);

  save
    .then(() => {
      showToast(subTaskId ? 'Đã cập nhật đầu việc' : 'Đã thêm đầu việc');
      closeSubTaskModal();
      return reloadTasks();
    })
    .then(() => {
      // Re-render detail modal nếu đang mở
      const detailModal = document.getElementById('detailModal');
      if (detailModal && !detailModal.classList.contains('hidden')) {
        const p = state.projects.find((x) => x.id === projectId);
        if (p) renderDetailBody(p);
      }
    })
    .catch((err: Error) => showToast(err.message || 'Lỗi lưu', true))
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = 'Lưu'; }
    });
}

export function confirmDeleteSubTask(projectId: string, subTaskId: string): void {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return;
  const st = p.subTasks?.find((s) => s.id === subTaskId);
  if (!st) return;
  if (!window.confirm(`Xóa đầu việc "${st.name}"?\nHành động này không thể hoàn tác.`)) return;

  tasksApi.deleteSubTask(projectId, subTaskId)
    .then(() => {
      showToast('Đã xóa đầu việc');
      return reloadTasks();
    })
    .then(() => {
      const detailModal = document.getElementById('detailModal');
      if (detailModal && !detailModal.classList.contains('hidden')) {
        const p2 = state.projects.find((x) => x.id === projectId);
        if (p2) renderDetailBody(p2);
      }
    })
    .catch((err: Error) => showToast(err.message || 'Lỗi xóa', true));
}

// ============================================================
// Daily Log modal — nhân viên điền nhật ký hằng ngày
// ============================================================
export function openDailyLogModal(projectId: string, subTaskId?: string): void {
  const pidEl = document.getElementById('dlProjectId') as HTMLInputElement | null;
  const sidEl = document.getElementById('dlSubTaskId') as HTMLInputElement | null;
  if (pidEl) pidEl.value = projectId;
  if (sidEl) sidEl.value = subTaskId || '';

  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return;

  let currentProgress = 0;

  if (subTaskId) {
    const st = p.subTasks?.find((s) => s.id === subTaskId);
    if (!st) return;
    currentProgress = st.progress;

    const todayStr = today();
    const existingLog = st.dailyLogs?.find((l) => l.date === todayStr);

    (document.getElementById('dlDescription') as HTMLTextAreaElement | null)!.value = existingLog?.description || '';
    (document.getElementById('dlResult') as HTMLTextAreaElement | null)!.value = existingLog?.result || '';
    (document.getElementById('dlObstacle') as HTMLTextAreaElement | null)!.value = existingLog?.obstacle || '';

    const titleEl = document.getElementById('dlSubTaskName');
    if (titleEl) titleEl.textContent = st.name;
  } else {
    currentProgress = p.progress;
    const titleEl = document.getElementById('dlSubTaskName');
    if (titleEl) titleEl.textContent = p.name;
    (document.getElementById('dlDescription') as HTMLTextAreaElement | null)!.value = '';
    (document.getElementById('dlResult') as HTMLTextAreaElement | null)!.value = p.results || '';
    (document.getElementById('dlObstacle') as HTMLTextAreaElement | null)!.value = '';
  }

  const dlProgressEl = document.getElementById('dlProgress') as HTMLInputElement | null;
  if (dlProgressEl) {
    dlProgressEl.value = String(currentProgress);
    const labelEl = document.getElementById('dlProgressLabel');
    if (labelEl) labelEl.textContent = `${currentProgress}%`;
  }

  openModal('dailyLogModal');
  refreshIcons();
}

export function closeDailyLogModal(): void {
  closeModal('dailyLogModal');
}

export function handleSaveDailyLog(e: Event): void {
  e.preventDefault();
  const projectId = (document.getElementById('dlProjectId') as HTMLInputElement | null)?.value ?? '';
  const subTaskId = (document.getElementById('dlSubTaskId') as HTMLInputElement | null)?.value ?? '';

  const description = (document.getElementById('dlDescription') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const result = (document.getElementById('dlResult') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const obstacle = (document.getElementById('dlObstacle') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const newProgress = Number((document.getElementById('dlProgress') as HTMLInputElement | null)?.value ?? 0);

  if (newProgress < 0 || newProgress > 100) {
    showToast('Tiến độ phải từ 0 - 100', true);
    return;
  }

  const btn = document.querySelector<HTMLButtonElement>('#dailyLogForm button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  let savePromise: Promise<unknown>;

  if (subTaskId) {
    const logPayload: DailyLogPayload = {
      date: today(),
      description,
      result,
      obstacle,
      progress: newProgress,
    };
    savePromise = tasksApi.addLog(projectId, subTaskId, logPayload);
  } else {
    // Cập nhật trực tiếp Hạng mục nếu không có đầu việc
    savePromise = tasksApi.update(projectId, { progress: newProgress, results: result });
  }

  savePromise
    .then(() => {
      showToast('Đã lưu nhật ký hôm nay');
      closeDailyLogModal();
      return reloadTasks();
    })
    .catch((err: Error) => showToast(err.message || 'Lỗi lưu nhật ký', true))
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = 'Lưu nhật ký'; }
    });
}

// ============================================================
// Progress modal (legacy aliases)
// ============================================================
export function openProgressModal(id: string): void { openDailyLogModal(id); }
export function closeProgressModal(): void { closeDailyLogModal(); }
export function handleSaveProgress(e: Event): void { handleSaveDailyLog(e); }

// ============================================================
// Detail modal
// ============================================================
export function openDetailModal(id: string): void {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  renderDetailBody(p);
  openModal('detailModal');
}

export function closeDetailModal(): void {
  closeModal('detailModal');
}



