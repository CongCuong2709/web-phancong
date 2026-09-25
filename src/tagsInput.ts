// ============================================================
// tagsInput.ts — Quản lý chip input cho tags
// Cho phép gõ tag → Enter hoặc dấu phẩy → tạo chip có nút X.
// Mỗi chip lưu giá trị trong state.tags[inputId]
// ============================================================
import { escapeHtml, tagColor } from './utils';

const state = new Map<string, string[]>(); // inputId -> tags

function chipsContainerId(inputId: string): string {
  // fTags -> fTagsChips, stTags -> stTagsChips
  return `${inputId}Chips`;
}

function paintChips(inputId: string): void {
  const host = document.getElementById(chipsContainerId(inputId));
  if (!host) return;
  const tags = state.get(inputId) ?? [];
  host.innerHTML = tags
    .map((t) => {
      const c = tagColor(t);
      return `<span class="tag-chip" style="background:${c.bg};color:${c.fg}">
        #${escapeHtml(t)}
        <button type="button" data-remove-tag="${escapeHtml(t)}" data-for="${inputId}" aria-label="Xoá">&times;</button>
      </span>`;
    })
    .join('');
}

function addTag(inputId: string, raw: string): boolean {
  const t = (raw || '').trim().toLowerCase();
  if (!t) return false;
  const list = state.get(inputId) ?? [];
  if (list.includes(t)) return false;
  list.push(t);
  state.set(inputId, list);
  paintChips(inputId);
  return true;
}

function removeTag(inputId: string, tag: string): void {
  const list = state.get(inputId) ?? [];
  const next = list.filter((t) => t !== tag);
  state.set(inputId, next);
  paintChips(inputId);
}

/** Khởi tạo một tags-input cho inputId (vd: 'fTags', 'stTags') */
export function initTagsInput(inputId: string): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;
  state.set(inputId, []);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = input.value;
      // Tách theo dấu phẩy nếu user paste nhiều tag
      const parts = v.split(',');
      parts.forEach((p) => addTag(inputId, p));
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value) {
      const list = state.get(inputId) ?? [];
      if (list.length) {
        list.pop();
        state.set(inputId, list);
        paintChips(inputId);
      }
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim()) {
      addTag(inputId, input.value);
      input.value = '';
    }
  });

  // Click handler cho nút xoá trên chip (event delegation)
  const container = document.getElementById(`${inputId}Container`);
  if (container) {
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest<HTMLElement>('[data-remove-tag]');
      if (btn) {
        const tag = btn.dataset.removeTag ?? '';
        const forId = btn.dataset.for ?? inputId;
        removeTag(forId, tag);
      }
    });
  }
}

/** Lấy giá trị tags hiện tại */
export function getTags(inputId: string): string[] {
  return [...(state.get(inputId) ?? [])];
}

/** Set giá trị tags (khi mở modal sửa) */
export function setTags(inputId: string, tags: readonly string[]): void {
  state.set(inputId, [...tags]);
  paintChips(inputId);
}

/** Reset về rỗng (khi mở modal tạo mới) */
export function resetTags(inputId: string): void {
  state.set(inputId, []);
  paintChips(inputId);
}

/** Khởi tạo tất cả tags input trên trang — gọi 1 lần lúc boot */
export function initAllTagsInputs(): void {
  initTagsInput('fTags');
  initTagsInput('stTags');
}