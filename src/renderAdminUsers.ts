// ============================================================
// renderAdminUsers.ts — Trang Quản lý người dùng (Admin only)
// CRUD user với multi-select phòng ban
// ============================================================
import type { UserRecord } from './api';
import { usersApi } from './api';
import { state } from './state';
import { setHTML, showToast, refreshIcons, openModal, closeModal } from './ui';
import { ROLE_LABEL, escapeHtml } from './utils';

let _users: UserRecord[] = [];

export async function renderAdminUsers(): Promise<void> {
  try {
    setHTML('userTableBody', '<tr><td colspan="6" class="p-6 text-center text-t3">Đang tải...</td></tr>');
    _users = await usersApi.list();
    paint();
  } catch (e) {
    setHTML('userTableBody', `<tr><td colspan="6" class="p-6 text-center" style="color: var(--danger);">Lỗi: ${escapeHtml((e as Error).message)}</td></tr>`);
  }
  refreshIcons();
}

function paint(): void {
  if (!_users.length) {
    setHTML('userTableBody', '<tr><td colspan="6" class="p-6 text-center text-t3">Chưa có người dùng nào.</td></tr>');
    return;
  }
  setHTML(
    'userTableBody',
    _users.map((u) => {
      const depts = (u.departments && u.departments.length) ? u.departments : [u.department].filter(Boolean);
      const isSelf = u.id === state.currentUser?.id;
      return `
        <tr>
          <td><span class="font-mono text-xs font-semibold text-accent">${escapeHtml(u.username)}</span></td>
          <td>
            <div class="font-medium text-t1">${escapeHtml(u.fullname)}</div>
            <div class="text-xs text-t3 font-mono">ID: ${escapeHtml(u.id.slice(0, 8))}</div>
          </td>
          <td><span class="badge badge-collab">${ROLE_LABEL[u.role as keyof typeof ROLE_LABEL] ?? u.role}</span></td>
          <td>
            <div class="flex flex-wrap gap-1">
              ${depts.map((d) => `<span class="badge badge-subtask">${escapeHtml(d)}</span>`).join('')}
            </div>
          </td>
          <td class="text-center">
            ${u.active
              ? '<span class="badge badge-completed">Hoạt động</span>'
              : '<span class="badge badge-overdue">Đã khóa</span>'}
          </td>
          <td class="text-right">
            <div class="inline-flex gap-1">
              <button onclick="window.openUserModal('${u.id}')" class="btn btn-ghost btn-icon" title="Sửa">
                <i data-lucide="pencil" class="w-4 h-4"></i>
              </button>
              ${u.active && !isSelf ? `<button onclick="window.confirmDeleteUser('${u.id}')" class="btn btn-ghost btn-icon" title="Khóa" style="color: var(--danger);">
                <i data-lucide="lock" class="w-4 h-4"></i>
              </button>` : ''}
              ${isSelf ? '<span class="text-xs text-t3">(bạn)</span>' : ''}
            </div>
          </td>
        </tr>
      `;
    }).join(''),
  );
  refreshIcons();
}

/** Mở modal tạo/sửa user */
export function openUserModal(id?: string): void {
  const form = document.getElementById('userForm') as HTMLFormElement | null;
  if (!form) return;
  form.reset();

  // Reset dept checkboxes
  document.querySelectorAll<HTMLInputElement>('#userForm input[type="checkbox"][value]').forEach((cb) => {
    cb.checked = false;
  });

  const idEl = document.getElementById('ufId') as HTMLInputElement | null;
  const pwEl = document.getElementById('ufPassword') as HTMLInputElement | null;
  const pwHint = document.getElementById('ufPwHint');
  const titleEl = document.getElementById('userModalTitle');

  if (id) {
    const u = _users.find((x) => x.id === id);
    if (!u) return;
    if (titleEl) titleEl.textContent = `Sửa: ${u.fullname}`;
    if (idEl) idEl.value = u.id;
    if (pwEl) pwEl.required = false;
    if (pwHint) pwHint.textContent = '(để trống nếu không đổi)';
    (document.getElementById('ufUsername') as HTMLInputElement).value = u.username;
    (document.getElementById('ufUsername') as HTMLInputElement).disabled = true; // không cho sửa username
    (document.getElementById('ufFullname') as HTMLInputElement).value = u.fullname;
    (document.getElementById('ufRole') as HTMLSelectElement).value = u.role;

    const depts = u.departments && u.departments.length ? u.departments : [u.department].filter(Boolean);
    document.querySelectorAll<HTMLInputElement>('#userForm input[type="checkbox"][value]').forEach((cb) => {
      if (depts.includes(cb.value)) cb.checked = true;
    });
  } else {
    if (titleEl) titleEl.textContent = 'Thêm người dùng';
    if (idEl) idEl.value = '';
    if (pwEl) pwEl.required = true;
    if (pwHint) pwHint.textContent = '(bắt buộc khi tạo mới, ≥ 6 ký tự)';
    (document.getElementById('ufUsername') as HTMLInputElement).disabled = false;
  }

  openModal('userModal');
  refreshIcons();
}

export function closeUserModal(): void {
  closeModal('userModal');
}

/** Lưu user (tạo hoặc sửa) */
export async function handleSaveUser(e: Event): Promise<void> {
  e.preventDefault();

  const id = (document.getElementById('ufId') as HTMLInputElement | null)?.value ?? '';
  const username = ((document.getElementById('ufUsername') as HTMLInputElement)?.value ?? '').trim();
  const password = (document.getElementById('ufPassword') as HTMLInputElement | null)?.value ?? '';
  const fullname = ((document.getElementById('ufFullname') as HTMLInputElement)?.value ?? '').trim();
  const role = (document.getElementById('ufRole') as HTMLSelectElement | null)?.value ?? 'employee';

  const departments: string[] = [];
  document.querySelectorAll<HTMLInputElement>('#userForm input[type="checkbox"][value]:checked').forEach((cb) => {
    departments.push(cb.value);
  });

  if (!fullname) { showToast('Vui lòng nhập họ tên', true); return; }
  if (!departments.length) { showToast('Vui lòng chọn ít nhất 1 phòng ban', true); return; }
  if (!id && (!username || password.length < 6)) {
    showToast('Username và mật khẩu ≥ 6 ký tự là bắt buộc khi tạo mới', true);
    return;
  }

  const btn = document.querySelector<HTMLButtonElement>('#userForm button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  try {
    if (id) {
      await usersApi.update(id, { fullname, role, departments });
      showToast('Đã cập nhật người dùng');
    } else {
      await usersApi.create({ username, password, fullname, role, departments });
      showToast('Đã tạo người dùng');
    }
    closeUserModal();
    await renderAdminUsers();
  } catch (err) {
    showToast((err as Error).message || 'Lỗi lưu người dùng', true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Lưu'; }
  }
}

/** Khóa user (admin không thể khóa chính mình) */
export async function confirmDeleteUser(id: string): Promise<void> {
  const u = _users.find((x) => x.id === id);
  if (!u) return;
  if (u.id === state.currentUser?.id) {
    showToast('Không thể khóa chính bạn', true);
    return;
  }
  if (!window.confirm(`Khóa tài khoản "${u.fullname}" (${u.username})?\nUser sẽ không thể đăng nhập nhưng dữ liệu vẫn giữ.`)) return;

  try {
    await usersApi.deactivate(id);
    showToast('Đã khóa tài khoản');
    await renderAdminUsers();
  } catch (err) {
    showToast((err as Error).message || 'Lỗi khóa', true);
  }
}

/** Reset mật khẩu cho user */
export async function resetUserPassword(id: string): Promise<void> {
  const u = _users.find((x) => x.id === id);
  if (!u) return;
  const newPw = window.prompt(`Nhập mật khẩu mới cho "${u.fullname}" (≥ 6 ký tự):`);
  if (!newPw) return;
  if (newPw.length < 6) { showToast('Mật khẩu phải ≥ 6 ký tự', true); return; }

  try {
    await usersApi.resetPassword(id, newPw);
    showToast('Đã đặt lại mật khẩu');
  } catch (err) {
    showToast((err as Error).message || 'Lỗi reset', true);
  }
}