# Phân tích UI & Đề xuất Redesign — Hệ thống Phân công Công việc

> **Mục tiêu tài liệu:** chỉ ra các dấu hiệu khiến giao diện hiện tại trông "AI-generic", đề xuất một hướng đi có chủ đích phù hợp với phần mềm nội bộ tiếng Việt, đồng thời đưa ra **kế hoạch dark mode** (auto theo hệ thống, có toggle).
>
> **Phạm vi:** Frontend `src/` + `index.html` + `src/styles.css`. Không đề xuất sửa backend.
>
> **Trạng thái:** Đề xuất, **chưa code**. Mục cuối có bản mockup ASCII cho 3 màn hình chính.

---

## 1. Chẩn đoán: vì sao giao diện hiện tại trông "AI-generic"

Đây không phải vì thiết kế xấu — nó **gọn gàng, dễ đọc, dùng được**. Nó trông generic vì đang nằm trong "vành đai an toàn" mà mọi AI (và phần lớn template Tailwind UI 2024–2026) cùng rơi vào:

| # | Dấu hiệu AI-generic | Vị trí trong code |
|---|---|---|
| 1 | **Bộ đôi `slate` + `indigo`** — phổ biến nhất trong Tailwind, gần như mặc định của AI | Toàn bộ `index.html`, `render.ts` |
| 2 | **Gradient login màu mè** `from-indigo-600 via-purple-600 to-pink-500` — chữ ký của AI generator | `index.html:14` |
| 3 | **Mọi thứ `rounded-2xl`** — card, modal, stat tile, nút — không phân biệt mức độ quan trọng | `index.html` xuyên suốt |
| 4 | **Stat card = ô vuông bo có icon nền pastel + icon màu đậm cùng tông** — layout signature | `index.html:122–158`, `render.ts:108–118` |
| 5 | **Badge pill 100%** — trạng thái, priority, collab, overdue đều `rounded-full` | `styles.css:50–73` |
| 6 | **`shadow-2xl` + `backdrop-blur-sm`** cho modal — mặc định của mọi Tailwind starter | `index.html:417, 565, 605+` |
| 7 | **Bảng `text-xs uppercase font-medium` header** + row hover nền nhạt — Linear/Notion clone | `index.html:245, 257` |
| 8 | **Phân cấp icon đồng nhất** (`w-4 h-4`) và mọi chỗ đều có icon — tạo cảm giác "icon soup" | Nav, buttons, table cells, empty states |
| 9 | **Màu status = 4 cặp pastel/đậm giống nhau** (`bg-blue-100/text-blue-600`, `bg-amber-100/text-amber-600`...) | `styles.css:61–73` |
| 10 | **Empty state = icon inbox lớn + 1 dòng text** — đẹp nhưng thiếu cá tính | `index.html:261–263, 280–282` |
| 11 | **Sticky top nav trắng với shadow mềm** — pattern xuất hiện ở 90% dashboard SaaS | `index.html:70` |
| 12 | **Khoảng cách đồng đều `gap-4` / `p-5`** giữa mọi card — không phân biệt thông tin chính/phụ | Toàn bộ dashboard |

Tóm lại: giao diện **đúng chuẩn nhưng vô danh**. Không có dấu hiệu nào khiến người dùng nhớ "đây là phần mềm của công ty mình".

---

## 2. Hướng đi đề xuất — Concept "**Sổ công việc**"

Ý tưởng cốt lõi: phần mềm này là **cuốn sổ giao việc nội bộ** của một công ty Việt Nam — không phải SaaS quốc tế. Đề xuất lấy cảm hứng từ **sổ tay + bảng kế hoạch treo tường + bảng Kanban truyền thống**, tránh phong cách "Linear/Notion clone".

### 2.1. Nguyên tắc chỉ đạo (5 điều)

1. **Có một "chữ ký"** (signature) — một motif lặp lại ở mọi màn hình: viền trái 2 px màu accent + chữ serif cho tiêu đề + ô trạng thái dạng chữ in hoa nhỏ thay vì pill màu.
2. **Màu có chủ đích** — bỏ slate/indigo, dùng **một bộ màu trung tính ấm** (off-white, charcoal) + **một accent chính** (màu mực indigo truyền thống, không phải Tailwind indigo-600 chói) + **2 màu phụ cho trạng thái** (xanh ngọc, đỏ đất).
3. **Phân cấp thông tin bằng typography + khoảng trắng**, không phải bằng card.
4. **Ít icon hơn, đặt icon có ý nghĩa** — bỏ icon trong mọi badge, mọi header. Icon chỉ xuất hiện ở action quan trọng.
5. **Dark mode không phải "invert"** — xây từ đầu với palette riêng, không dùng `dark:bg-slate-900` cho mọi thứ.

### 2.2. Bảng so sánh nhanh

| Yếu tố | Hiện tại | Đề xuất |
|---|---|---|
| Nền | `bg-slate-50` lạnh | `bg-[#FAF8F3]` (off-white ấm) / dark: `#0F1115` |
| Chữ chính | `text-slate-900` | `#1A1815` (gần đen ấm) / dark: `#E8E4DA` |
| Accent chính | `indigo-600` chói | `#2A4D7A` (indigo mực truyền thống) / dark: `#7BA0D4` |
| Status colors | 4 cặp pastel/đậm Tailwind | 2 màu đất: xanh ngọc `#3F7D6F`, đỏ đất `#A04A3A`; 2 màu phụ: vàng nhạt `#C8A951`, xám than |
| Bo góc | `rounded-xl/2xl` mọi nơi | 3 cấp: `2px` (border/divider), `4px` (input/nút), `8px` (chỉ modal) |
| Shadow | `shadow-2xl` cho modal | `border` 1px là chính, shadow chỉ dùng cho floating element |
| Font heading | `font-bold` (Inter) | Serif có chân (VD: **Source Serif 4**) cho H1/H2, Inter cho body |
| Icon | Lucide w-4 h-4 khắp nơi | Lucide, nhưng giảm 60%; thay bằng ký tự / chữ viết tắt |
| Stat card | Ô vuông pastel + icon | Hàng ngang **số to + nhãn nhỏ** kèm thanh bar nhỏ phía dưới |
| Empty state | Icon inbox | Một câu thơ ngắn hoặc hình vẽ tối giản 1 nét |

---

## 3. Hệ thống thiết kế (Design Tokens)

### 3.1. Bảng màu — Light theme

```css
:root {
  /* Nền & chữ */
  --bg-app:       #FAF8F3;   /* nền chính — off-white ấm */
  --bg-surface:   #FFFFFF;   /* card, modal */
  --bg-sunken:    #F2EEE5;   /* vùng lõm (filter bar, table header) */
  --bg-hover:     #F2EEE5;   /* row hover */
  --border:       #E5DFD1;   /* viền chính */
  --border-soft:  #EFEBE0;

  --text-primary:   #1A1815;
  --text-secondary: #5C564A;
  --text-tertiary:  #8A8273;   /* placeholder, hint */
  --text-inverse:   #FAF8F3;

  /* Accent — "indigo mực" */
  --accent:         #2A4D7A;
  --accent-hover:   #1E3A5F;
  --accent-soft:    #E8EEF5;   /* dùng cho tag, hover nhẹ */
  --accent-fg:      #FFFFFF;

  /* Trạng thái — 4 trạng thái */
  --status-todo-bg:    #F2EEE5;
  --status-todo-fg:    #5C564A;
  --status-doing-bg:   #E8EEF5;
  --status-doing-fg:   #2A4D7A;
  --status-done-bg:    #E0EDE9;
  --status-done-fg:    #3F7D6F;
  --status-block-bg:   #FAEEDD;
  --status-block-fg:   #A04A3A;

  /* Priority — 3 cấp, KHÔNG dùng đỏ chói */
  --priority-low:    #8A8273;
  --priority-medium: #C8A951;
  --priority-high:   #A04A3A;

  /* Quá hạn — đỏ đất */
  --danger:          #A04A3A;
  --danger-soft:     #F5E4DF;

  /* Cảnh báo */
  --warn:            #C8A951;
  --warn-soft:       #F5EFE0;
}
```

### 3.2. Bảng màu — Dark theme

Dark mode không invert — nó là **một cuốn sổ làm việc ban đêm** với nền gần-đen ấm (không pure black) và accent dịu hơn.

```css
:root[data-theme="dark"] {
  --bg-app:       #0F1115;
  --bg-surface:   #171A1F;
  --bg-sunken:    #0B0D11;
  --bg-hover:     #1E2229;
  --border:       #262B33;
  --border-soft:  #1E2229;

  --text-primary:   #E8E4DA;
  --text-secondary: #A8A294;
  --text-tertiary:  #6E695C;
  --text-inverse:   #0F1115;

  --accent:         #7BA0D4;   /* sáng hơn để đủ contrast trên nền tối */
  --accent-hover:   #9DB8DD;
  --accent-soft:    #1A2330;
  --accent-fg:      #0F1115;

  --status-todo-bg:    #1E2229;
  --status-todo-fg:    #A8A294;
  --status-doing-bg:   #1A2330;
  --status-doing-fg:   #7BA0D4;
  --status-done-bg:    #142822;
  --status-done-fg:    #6BB39E;
  --status-block-bg:   #2A1A18;
  --status-block-fg:   #D88672;

  --priority-low:    #6E695C;
  --priority-medium: #D8B86B;
  --priority-high:   #D88672;

  --danger:          #D88672;
  --danger-soft:     #2A1A18;

  --warn:            #D8B86B;
  --warn-soft:       #2A2516;
}
```

### 3.3. Typography

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| Font chính (body, UI) | `Inter`, system-ui | như cũ | mọi thứ trừ heading chính |
| Font heading (serif) | `'Source Serif 4'`, `Georgia`, serif | như cũ | H1, H2, tiêu đề modal, tên task nổi bật |
| Font mono | `'JetBrains Mono'`, monospace | như cũ | Mã task (`DA001`), số liệu lớn |

Cỡ chữ (rem):

```
text-display:  1.875  /* H1 trang chính, số liệu dashboard */
text-h2:       1.375  /* H2 section */
text-h3:       1.125  /* tiêu đề card, modal */
text-body:     0.9375 /* mặc định (15px) */
text-sm:       0.8125
text-xs:       0.75    /* helper, hint, badge chữ thường */
text-micro:    0.6875  /* ngày tháng, metadata */
```

Hai điểm khác biệt so với hiện tại:
- **Body mặc định 15px** thay vì 14px → dễ đọc hơn trên màn desktop công ty.
- **Heading là serif** → tạo "chữ ký" ngay từ trang login.

### 3.4. Khoảng cách & bo góc

```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  24px
--space-6:  32px
--space-7:  48px

--radius-sm: 2px   /* border, divider */
--radius-md: 4px   /* input, button, tag */
--radius-lg: 8px   /* chỉ dùng cho modal, popover */
```

**Không dùng `rounded-2xl`** ở bất kỳ đâu nữa.

### 3.5. Border + Shadow

```
--border-thin:  1px solid var(--border)
--border-accent: 2px solid var(--accent)   /* "chữ ký" viền trái */

--shadow-1: 0 1px 0 var(--border)          /* underline kiểu giấy */
--shadow-2: 0 4px 12px rgba(0,0,0,0.06)    /* popover, dropdown */
--shadow-3: 0 16px 40px rgba(0,0,0,0.10)   /* modal — KHÔNG dùng shadow-2xl Tailwind */
```

Nguyên tắc: **border trước, shadow sau**. Card dùng border 1px, không shadow.

---

## 4. Dark Mode — kế hoạch kỹ thuật

### 4.1. Cách hoạt động

1. **Cấu hình Tailwind (CDN)**: thêm `tailwind.config = { darkMode: ['class', '[data-theme="dark"]'] }` ngay trong `<head>` sau khi load Tailwind.
2. **Mặc định theo hệ thống**: dùng `@media (prefers-color-scheme: dark)` để set `data-theme="dark"` trên `<html>` nếu user chưa chọn thủ công.
3. **Toggle thủ công**: nút trên navbar cho 3 trạng thái — *Sáng / Tối / Theo hệ thống* (mặc định).
4. **Lưu lựa chọn** vào `localStorage` key `pc-theme` (giá trị: `"light"` | `"dark"` | `"system"`).
5. **Áp dụng token**: vì hệ thống token màu nằm trong `:root` và `:root[data-theme="dark"]`, mọi class Tailwind phải dùng arbitrary value kiểu `bg-[var(--bg-surface)]` thay vì `bg-white`. Cách này hơi cồng kềnh nhưng **không phụ thuộc variant `dark:`**, sạch hơn cho dynamic HTML render.

### 4.2. Phạm vi phải đổi

| File | Loại thay đổi | Số dòng ước tính |
|---|---|---|
| `index.html` | Đổi tất cả `bg-white/bg-slate-50/text-slate-*/border-slate-*` → token | ~250 dòng |
| `src/styles.css` | Thêm block `:root[data-theme="dark"]` + override badge/progress/gantt/tooltip | +120 dòng |
| `src/render.ts` | Tất cả HTML template string phải dùng class token | ~180 dòng |
| `src/renderDailyReport.ts`, `renderCalendar.ts`, `renderGantt.ts`, `renderTimeline.ts`, `renderAdminUsers.ts` | Tương tự | ~300 dòng tổng |
| `src/handlers.ts` | Thêm hàm `applyTheme()`, lắng nghe `matchMedia`, gắn toggle | +40 dòng |
| FullCalendar | Inject CSS override `.fc-theme-standard` theo token | +30 dòng |
| Login gradient | Thay bằng nền `--bg-app` + 1 khối accent nhỏ | ~10 dòng |

### 4.3. Toggle UI (vị trí & hành vi)

Đặt **nút nhỏ ở góc phải navbar**, ngay trước nút "Đăng xuất":

```
┌──────────────────────────────────────────┐
│ [☀] [🌙] [○]   ← 3 icon Sáng/Tối/Auto   │
└──────────────────────────────────────────┘
```

- 3 icon nối tiếp, icon đang chọn có nền `--bg-sunken` và chữ accent.
- Click 1 lần → đổi theme + lưu localStorage.
- Hover → tooltip "Sáng / Tối / Theo hệ thống".

### 4.4. Tránh "flash of wrong theme"

Khi load trang:
1. Trong `<head>`, **inline script ngắn** đọc `localStorage["pc-theme"]` → set `data-theme` lên `<html>` TRƯỚC khi render bất kỳ thứ gì.
2. Nếu giá trị là `"system"` hoặc không có → check `matchMedia("(prefers-color-scheme: dark)")`.
3. Đoạn script này ~10 dòng, không phụ thuộc bundle JS.

---

## 5. Component Language — "ít card, nhiều khoảng trắng"

### 5.1. Stat (thay thế stat card hiện tại)

Thay vì 5 ô vuông pastel + icon, dùng **một hàng ngang** với số to + nhãn nhỏ + một thanh nhỏ bên dưới thể hiện tỉ lệ.

```
TỔNG CÔNG VIỆC              ĐANG THỰC HIỆN           HOÀN THÀNH            QUÁ HẠN
─────                        ─────                     ─────                 ─────
   42                          18                       20                    4
Đầu việc                   Trong tổng                47.6% tổng            Cần xử lý
▰▰▰▰▰▰▰▰▱▱▱ 42/52         ▰▰▰▰▰▱▱▱▱▱  18/42        ▰▰▰▰▰▰▰▰▰▱ 20/42      ▰▱▱▱▱▱▱▱▱▱ 4/42
```

- Số lớn dùng font mono.
- Nhãn trên là small-caps + tracking rộng.
- Thanh dưới cùng màu `--accent` (đang làm) hoặc `--danger` (quá hạn).

### 5.2. Status — chữ in hoa, không pill

Bỏ `badge-pill` cho status. Thay bằng **ô chữ in hoa size 10px + tracking + 1 dấu chấm tròn phía trước**:

```html
<span class="status-text status-doing">
  <span class="dot"></span> ĐANG LÀM
</span>
```

CSS:
```css
.status-text {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.status-text .dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
}
```

4 status:
- `CHƯA BẮT ĐẦU` — chấm xám
- `ĐANG LÀM` — chấm accent
- `HOÀN THÀNH` — chấm xanh ngọc
- `TẠM DỪNG` — chấm vàng

Priority & overdue vẫn có thể dùng pill (rounded-md 4px), nhưng **màu đất, không chói**.

### 5.3. Task row — có "gáy sách"

Mỗi task trong danh sách có **một viền trái 2px** phân loại trạng thái (đề xuất thay cho nền row hover trống trơn):

```
┃  DA001   ĐANG LÀM    Cao
┃  Triển khai phần mềm kế toán tại chi nhánh Hà Nội
┃  HCNS • Cao Văn Cường • Hạn 25/10/2026
┃                                  ▰▰▰▰▰▰▰▱▱▱  70%
```

`┃` ở đây là 1 div 2px nền `var(--status-doing-fg)`. Khi task quá hạn → đổi sang `--danger`.

### 5.4. Bảng (Projects)

- Bỏ `bg-slate-50` ở header → dùng `--bg-sunken` với border dưới 2px.
- Bỏ `text-xs uppercase` chữ trắng-nhạt → dùng `text-micro font-medium tracking-wide uppercase` màu `--text-tertiary`.
- Row hover: chỉ đổi `bg-hover`, không có border-left thay đổi.
- Cột tiến độ: bỏ thanh pill tròn → dùng **ô kẻ ô** (10 ô vuông nhỏ, tô màu theo %).

### 5.5. Modal — viền đôi

- Border ngoài 1px `--border` + shadow-3 + không `backdrop-blur`.
- Header có **viền dưới 2px** (không 1px), chữ serif.
- Bỏ `rounded-2xl` → `rounded-lg` (8px) + `overflow-hidden`.

### 5.6. Button

Phẳng hơn, không gradient, không shadow:

```css
.btn-primary {
  background: var(--accent);
  color: var(--accent-fg);
  border-radius: 4px;
  padding: 8px 16px;
  font-weight: 500;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.btn-ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

Nút "phá" (Xóa task, Hủy modal) dùng chữ `--danger` không nền.

### 5.7. Empty state

Thay vì icon inbox + 1 dòng:

```
        ┌──────────────────────────┐
        │                          │
        │     Chưa có công việc    │
        │                          │
        │  Bắt đầu bằng cách tạo  │
        │  một task mới — nhấn    │
        │  nút + ở góc trên.      │
        │                          │
        └──────────────────────────┘
```

- Không icon, không màu, chỉ chữ serif cỡ h2 + 1 dòng phụ.
- Có 1 nút nhỏ "Tạo task đầu tiên" nếu user có quyền.

---

## 6. Layout & Density

### 6.1. Nguyên tắc phân cấp

Trong 1 màn hình có **3 lớp thông tin**:

| Lớp | Đặc điểm | Ví dụ |
|---|---|---|
| **Chính** | Lớn, nổi bật, không cần tìm | Tên task đang mở, hạn cuối, trạng thái |
| **Phụ** | Nhỏ hơn, màu `--text-secondary` | Phòng ban, người nhận, ngày tạo |
| **Metadata** | `text-micro`, màu `--text-tertiary`, mono | Mã task, timestamp |

Hiện tại: mọi thứ ngang hàng nhau, dẫn đến dashboard trông "phẳng".

### 6.2. Density

Dashboard hiện tại thưa (`gap-4 p-5`) → đề xuất **tăng density** cho bảng danh sách, **giữ thưa** cho dashboard overview.

- Bảng Projects: padding dọc `py-2.5` thay vì `py-3`, font `13px` thay vì `14px`.
- Filter bar: gộp thành 1 hàng ngang cao 44px, có icon search bên trái, không nền card riêng (chỉ border-bottom).

### 6.3. Responsive

Giữ nguyên các breakpoint Tailwind hiện tại (`sm/md/lg/xl`). Bổ sung:
- **`< 1024px`**: nav chuyển thành drawer icon (1 nút hamburger).
- **`>= 1280px`**: dashboard mở rộng thành 3 cột (thêm cột "Hoạt động gần đây").

---

## 7. Motion

### 7.1. Nguyên tắc

- **Ít animation hơn hiện tại** — AI hay nhồi fade/slide lung tung.
- Chỉ animate khi:
  - Mở/đóng modal (slide-up 200ms ease-out, KHÔNG có bounce).
  - Hover row (chỉ đổi màu nền, 100ms).
  - Toggle theme (cross-fade 150ms cho toàn app).
- **Không** animate: toast, badge, icon, button hover (trừ primary).

### 7.2. Transition duy nhất

```css
:root {
  --motion-fast:   100ms;
  --motion-base:   200ms;
  --motion-slow:   300ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);  /* Material 3 style */
}
```

Mọi transition dùng `var(--motion-base) var(--ease-standard)`. KHÔNG dùng `ease-in-out` tròn trịa.

---

## 8. Information Architecture — đề xuất sắp xếp lại

### 8.1. Navbar (rút gọn từ 6 xuống 5 nút chính)

```
[Logo]  Tổng quan | Công việc | Việc của tôi | Báo cáo | Lịch/Gantt   ⋯  [Theme] [User]
```

- Bỏ "Dòng thời gian" riêng, gộp thành **"Lịch / Gantt"** (đã có toggle trong timeline mode).
- "Quản lý NV" → ẩn sau menu **User dropdown** (icon avatar góc phải) thay vì nút nav → giảm nhiễu.
- Icon trong nav giảm xuống còn **mỗi nút 1 icon 16px**, không label phụ.

### 8.2. Dashboard — tuỳ vai trò

Đề xuất **3 layout khác nhau** cho 3 role (hiện tại đã có ý này nhưng triển khai chưa rõ):

- **Giám đốc**: hàng stat (4) + 2 cột "Phòng ban đang quá tải" / "Công việc sắp đến hạn" + bảng "Quá hạn" full-width.
- **Trưởng phòng**: hàng stat (4) + bảng "Nhân viên của tôi" (tên, đang làm, hoàn thành, deadline gần nhất) + bảng "Cần duyệt" (các task chờ).
- **Nhân viên**: HÔM NAY (3 ô lớn: đến hạn / quá hạn / cần báo cáo) + "Đầu việc của tôi" + "Lịch sử báo cáo 7 ngày".

### 8.3. "Việc của tôi" — thêm chế độ xem Kanban nhỏ

Hiện chỉ có list + daily report. Đề xuất thêm **Kanban mini 3 cột** (Cần làm / Đang làm / Xong) để nhân viên kéo thả đổi trạng thái. HTML5 native drag-and-drop, không cần thư viện.

---

## 9. Bản mockup ASCII — 3 màn hình chính

### 9.1. Login (sau khi đổi)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│         PHÂN CÔNG CÔNG VIỆC                              │  ← Source Serif 4, 28px
│         ────────────────                                 │  ← gạch ngang 32px
│                                                          │
│         Đăng nhập để tiếp tục                            │  ← 14px, --text-secondary
│                                                          │
│         ┌─────────────────────────┐                      │
│         │ Tên đăng nhập           │                      │
│         └─────────────────────────┘                      │
│         ┌─────────────────────────┐                      │
│         │ Mật khẩu                │                      │
│         └─────────────────────────┘                      │
│                                                          │
│         [    ĐĂNG NHẬP    ]                               │  ← nút đặc, --accent
│                                                          │
│                                                          │
│         v3 · © 2026 Công ty ABC                          │  ← chân trang, text-micro
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Bỏ gradient. Bỏ icon briefcase. Bỏ block "tài khoản mẫu + mật khẩu" (chuyển vào trang riêng `/dev-accounts` ẩn, chỉ bật khi `import.meta.env.DEV`).

### 9.2. Dashboard (giám đốc)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ PHÂN CÔNG CÔNG VIỆC            [☀][🌙][○]  BGĐ — Nguyễn Văn A ▾        │
├──────────────────────────────────────────────────────────────────────────┤
│ Tổng quan                                                                  │
│ Hôm nay, thứ Tư 30/09                                                     │
│                                                                          │
│ TỔNG                ĐANG LÀM              HOÀN THÀNH         QUÁ HẠN     │
│ ────                ────────              ──────────         ───────     │
│  52                   18                    20                4         │
│ Đầu việc             Trong tổng            47.6%             Cần xử lý  │
│ ▰▰▰▰▰▰▰▰▰▰ 52/60    ▰▰▰▰▰▱▱▱▱▱ 18/52       ▰▰▰▰▰▰▰▰▰▱ 20/52  ▰▱▱▱▱▱▱▱▱▱ 4/52 │
│                                                                          │
│ ┌────────────────────────────────────────┐ ┌────────────────────────────┐│
│ │ Phòng ban đang quá tải                │ │ Sắp đến hạn (7 ngày tới)   ││
│ │ ────────                              │ │ ─────                      ││
│ │ ▰▰▰▰▰▰▰▰▰▰ HCNS    18/24              │ │ ┃ DA007 Triển khai Q4   2d ││
│ │ ▰▰▰▰▰▰▰▰▱▱ Kế toán 11/16              │ │ ┃ DA012 Audit nội bộ   5d ││
│ │ ▰▰▰▰▰▰▱▱▱▱ Thu mua  7/12              │ │ ┃ DA003 Đào tạo nv     7d ││
│ └────────────────────────────────────────┘ └────────────────────────────┘│
│                                                                          │
│ Quá hạn                                                                   │
│ ───                                                                      │
│ ┃ DA005  Kiểm toán Q3                  Cao Văn Cường    25/09  ▰▰▰▰▰▱▱▱▱▱ │
│ ┃ DA011  Đối soát công nợ              Lê Thị Hoa       28/09  ▰▰▰▱▱▱▱▱▱▱ │
└──────────────────────────────────────────────────────────────────────────┘
```

Đặc điểm:
- Stat là **hàng ngang**, không card.
- Bảng không có header `bg-slate-50`; chỉ border-bottom 2px.
- Mỗi row có **viền trái 2px** màu status.
- Tiến độ dùng **10 ô vuông nhỏ**, không pill bar.

### 9.3. Modal "Tạo công việc"

```
┌──────────────────────────────────────────────────────────┐
│  Tạo công việc mới                                  [×] │ ← header serif, border-bottom 2px
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Mã công việc *                  Tên công việc *         │
│  ┌──────────────┐                ┌─────────────────────┐ │
│  │ DA0__        │                │                     │ │
│  └──────────────┘                └─────────────────────┘ │
│                                                          │
│  Mô tả / Yêu cầu                                        │
│  ┌──────────────────────────────────────────────────────┐│
│  │                                                      ││
│  └──────────────────────────────────────────────────────┘│
│                                            0 ký tự       │
│                                                          │
│  Phòng ban chủ trì *          Giao cho *                 │
│  ┌──────────────┐                ┌─────────────────────┐ │
│  │ HCNS      ▾  │                │ Cao Văn Cường    ▾  │ │
│  └──────────────┘                └─────────────────────┘ │
│                                                          │
│  Phòng phối hợp                                          │
│  [ ] Kế toán  [ ] Thu mua  [ ] IT                        │
│                                                          │
│  Ngày bắt đầu           Hạn xong                         │
│  ┌──────────────┐       ┌──────────────┐                 │
│  │ 30/09/2026   │       │ 30/10/2026   │                 │
│  └──────────────┘       └──────────────┘                 │
│                                                          │
│  Ưu tiên             Tiến độ %          Trạng thái       │
│  ┌─────────┐         ┌──────┐           ┌──────────┐     │
│  │ Trung bình▾│      │ 0    │           │ Chưa bắt đầu▾│
│  └─────────┘         └──────┘           └──────────┘     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                       [ Hủy ]   [ Lưu ] │ ← footer border-top
└──────────────────────────────────────────────────────────┘
```

Đặc điểm:
- Modal **không có shadow-2xl**, chỉ border 1px + shadow-3 nhẹ.
- Input có border 1px `--border`, focus border `--accent`, **không ring xanh chói**.
- Label `font-medium` nhỏ, không có icon bên cạnh.

---

## 10. Roadmap triển khai đề xuất (nếu bạn duyệt)

| Giai đoạn | Nội dung | Ước tính thời gian |
|---|---|---|
| **P0 — Nền tảng** | Thêm token màu + biến CSS + cấu hình Tailwind `darkMode` + script set theme ngay `<head>` + nút toggle ở navbar | 2–3 giờ |
| **P1 — Áp dụng dark mode** | Đổi toàn bộ `index.html` sang dùng token; override FullCalendar; đổi custom CSS trong `styles.css` | 4–5 giờ |
| **P2 — Render động** | Đổi template string trong `render.ts`, `renderDailyReport.ts`, `renderCalendar.ts`, `renderGantt.ts`, `renderTimeline.ts`, `renderAdminUsers.ts` | 5–6 giờ |
| **P3 — Redesign visual** | Áp dụng concept "Sổ công việc": heading serif, status chữ in hoa, viền trái 2px, stat ngang, density cao hơn ở bảng | 6–8 giờ |
| **P4 — Hoàn thiện** | Motion chuẩn, empty state mới, login redesign, modal viền đôi, Kanban mini cho "Việc của tôi" | 4–5 giờ |
| **P5 — Polish** | Test contrast dark mode (WCAG AA), responsive mobile, in ấn `@media print`, screenshot 2 theme để so sánh | 2–3 giờ |

**Tổng ước tính: ~25–30 giờ code + test.**

Có thể làm P0–P2 trước (dark mode hoàn chỉnh) rồi quyết định có đi tiếp P3–P5 hay không.

---

## 11. Những thứ **không** nên làm

Để tránh quay lại vùng "AI-generic":

1. **Đừng thêm gradient vào stat card** — dù accent có đẹp đến đâu, gradient là chữ ký AI.
2. **Đừng thêm animation bounce/spring** cho modal/toast — chỉ slide tuyến tính.
3. **Đừng dùng emoji làm icon UI** chính (hiện có 🎉, 📋, 👔 trong empty state) — chuyển sang SVG có chủ đích.
4. **Đừng thêm illustration 3D / blob background** — xu hướng 2024 đã hết, giờ trông lỗi thời.
5. **Đừng nhồi icon vào mọi label** — đã có icon ở nav, không cần thêm ở header section.
6. **Đừng thêm micro-interaction quá nhiều** — một hệ thống nội bộ công ty cần **nhanh và ổn định**, không phải "vui mắt".

---

## 12. Câu hỏi cần bạn xác nhận trước khi code

1. **Có dùng Google Fonts (Source Serif 4 + Inter)** hay giữ nguyên font hệ thống để giảm phụ thuộc ngoài?
2. **Có cần giữ tương thích FullCalendar v6.1.15** không? Theme của nó khó override hoàn toàn — có thể phải đổi sang `@fullcalendar/core` + custom CSS, hoặc giữ nguyên và chấp nhận FC có phần "lệch tông".
3. **Có muốn làm P0–P2 (chỉ dark mode) trước, rồi xem xét P3–P5 (redesign)?** Hay làm song song?
4. **Có chấp nhận tăng nhẹ bundle size** (thêm vài chục KB cho Source Serif subset + JetBrains Mono subset) hay phải giữ dưới 200 KB tổng?

---

*File này là đề xuất, không sửa code. Khi bạn duyệt hướng nào, tôi sẽ triển khai theo từng giai đoạn trong Roadmap.*
