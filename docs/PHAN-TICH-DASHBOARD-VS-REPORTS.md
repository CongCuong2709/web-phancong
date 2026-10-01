# Phân tích Dashboard vs Reports & Đề xuất tách vai trò

> **Vấn đề người dùng nêu:** "Dashboard thì thiếu thiếu còn Báo cáo thống kê thì cứ thừa thừa."
>
> **Chẩn đoán:** Hai view đang **chồng chéo chức năng** — 3/4 chart của Reports chỉ vẽ lại số liệu đã có ở Dashboard. Cả hai đều không có insight độc đáo.
>
> **Đề xuất:** Tách rõ vai trò — Dashboard = **operational** (cần hành động NGAY), Reports = **analytical** (xu hướng, so sánh).
>
> **Phạm vi:** Frontend (HTML + render). Không code.

---

## 1. Bằng chứng trùng lặp

Trích từ `index.html` và `src/render.ts`:

| Dữ liệu | Dashboard | Reports | Loại |
|---|---|---|---|
| Đếm task theo trạng thái | `statInProgress`, `statCompleted`, `statOverdue` (3 ô stat) | `#statusChart` "Phân bổ theo trạng thái" | **Trùng** |
| Đếm task theo phòng ban | `#deptStats` "Theo phòng ban" | `#deptChart` "Phân bổ theo phòng ban" | **Trùng** |
| Tiến độ TB theo phòng | (rollup trong `deptStats` cho Manager) | `#deptProgressChart` "Tiến độ trung bình theo phòng ban" | **Trùng** |
| Phân bổ theo priority | — | `#priorityChart` "Theo mức độ ưu tiên" | Độc nhất |
| Snapshot overdue | `#overdueList` (5 row) | — | Độc nhất |
| Recent activity | `#recentProjects` (6 row) | — | Độc nhất |

**3/4 Reports chart lặp Dashboard, chỉ khác hình thức trình bày.**

---

## 2. Nguyên tắc phân vai — Operational vs Analytical

| | **Dashboard (Operational)** | **Reports (Analytical)** |
|---|---|---|
| **Câu hỏi trả lời** | "Tôi cần làm gì NGAY?" | "Chuyện gì đang xảy ra theo XU HƯỚNG?" |
| **Đối tượng** | Người vận hành (NV, TP, BGĐ đang điều phối) | Người ra quyết định (BGĐ, TP đánh giá kỳ) |
| **Thời gian** | Hiện tại → 7 ngày tới | Quá khứ → so sánh các kỳ |
| **Dữ liệu** | Live, cập nhật liên tục | Lịch sử, snapshot từng kỳ |
| **Mục tiêu** | Cảnh báo + hành động nhanh | Phân tích sâu, xu hướng, benchmark |
| **Tần suất mở** | 10–20 lần/ngày | 1 lần/tuần hoặc 1 lần/tháng |

Một phép thử nhanh: **nếu xóa view này, người dùng có bỏ lỡ gì không?**

- Xóa Dashboard → NV không biết "task nào sắp đến hạn", TP không thấy "phòng nào đang quá tải", BGĐ không thấy "task nào overdue cần xử lý". → **Không thể xóa.**
- Xóa Reports → BGĐ/TP vẫn làm việc bình thường, chỉ mất cái nhìn dài hạn. → **Có thể bỏ hoặc thiết kế lại.**

Hiện tại cả hai đều đang "làm việc của nhau" → cùng nhạt.

---

## 3. Đề xuất Dashboard mới

### 3.1. Vai trò mới: **"Buồng điều khiển"** — operational

Mỗi phần tử phải trả lời 1 trong 3 câu:
1. **"Có gì CẦN LÀM NGAY không?"** (overdue, cần điền nhật ký)
2. **"Có gì SẮP XẢY RA không?"** (đến hạn trong 7 ngày)
3. **"Có gì TỐT/XẤU bất thường không?"** (overload, bottleneck)

### 3.2. Bố cục mới (chia 3 zone)

```
┌──────────────────────────────────────────────────────────────┐
│  TỔNG QUAN                                  [Tạo công việc] │
│  Hôm nay, thứ Năm 01/10                                      │
│  ─────────                                                   │
│  Chào BGĐ Dũng — bạn có 4 quá hạn + 7 sắp đến hạn tuần này│
├──────────────────────────────────────────────────────────────┤
│  ZONE 1 — STAT NGẮN (hàng ngang, giữ nguyên)                │
│  Tổng    Đang làm    Hoàn thành    Quá hạn    Sắp đến hạn  │ ← MỚI
│  52       18         20            4 ⚠        7 ⏰          │
│  ▰▰▰▰▰   ▰▰▰▰▱▱▱   ▰▰▰▰▰▱▱      ▰▱▱▱▱      ▰▰▱▱▱         │
├──────────────────────────────────────────────────────────────┤
│  ZONE 2A — QUÁ HẠN              │  ZONE 2B — SẮP ĐẾN HẠN 7d │
│  ⚠ 4 task cần xử lý            │  ⏰ 7 task tới deadline    │
│  ━━━━                          │  ━━━━                     │
│  ┃ DA005  Kiểm toán Q3         │  ┃ DA007  Triển khai  2d  │
│    Cao Văn Cường • HCNS • 25/09│  ┃ DA012  Audit       5d  │
│    ▰▰▰▰▰▱▱▱▱▱ 60%               │  ┃ DA003  Đào tạo    7d  │
│  ┃ DA011  Đối soát công nợ      │  ...                       │
│    ...                         │                            │
├──────────────────────────────────────────────────────────────┤
│  ZONE 3A — HOẠT ĐỘNG GẦN ĐÂY   │  ZONE 3B — PHÒNG ĐANG     │
│  (Activity feed, 10 dòng mới    │  QUÁ TẢI                  │
│   nhất)                        │  ━━━━                     │
│  ━━━━                          │  ▰▰▰▰▰▰▰▰▰▰ HCNS    18/24 │
│  10:42  Cao Văn Cường cập nhật│  ▰▰▰▰▰▰▰▰▱▱ Kế toán 11/16│
│        tiến độ DA005 → 60%     │  ▰▰▰▰▰▰▱▱▱▱ Thu mua  7/12│
│  09:15  Nguyễn Thảo Nhi điền   │  ▰▰▰▰▱▱▱▱▱▱ IT        4/10│
│        nhật ký DA022            │                           │
│  ...                           │  ⚠ HCNS đang quá tải     │
├──────────────────────────────────────────────────────────────┤
│  ZONE 4 — QUICK ACTIONS (theo vai trò)                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Điền nhật ký │ │ Xem quá hạn  │ │ Phân công    │         │
│  │ hôm nay (NV) │ │ (TP/BGĐ)     │ │ lại (BGĐ)   │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### 3.3. Các thành phần cụ thể

| Phần | Dữ liệu | Nguồn |
|---|---|---|
| **Stat ngắn** | Tổng / Đang / Xong / Quá hạn / **Sắp đến hạn (7 ngày tới)** | `state.projects` filter theo `endDate` |
| **Greeting cá nhân** | "Chào BGĐ Dũng — bạn có **X quá hạn** + **Y sắp đến hạn** tuần này" | Đếm + render inline |
| **Panel Quá hạn** | Hiện có, giữ nguyên — sort theo `daysOverdue` (quá hạn lâu nhất lên đầu) | `state.projects.filter(isOverdue)` |
| **Panel Sắp đến hạn** | 7 ngày tới, sort theo `endDate` tăng dần | Filter `endDate ∈ [today, today+7d)` |
| **Activity feed** | 10 log mới nhất: ai, làm gì, lúc nào | `state.projects[].subTasks[].dailyLogs[]` + `history[]` |
| **Phòng quá tải** | Số task / số NV active của phòng, đánh dấu "quá tải" nếu > 5 task/NV | Tính từ `state.projects` + `state.allUsers` |
| **Quick actions** | 3 nút tùy role: NV → "Điền nhật ký", TP → "Xem quá hạn phòng mình", BGĐ → "Phân công lại" | Buttons gắn `data-action` đã có |

### 3.4. Phần bỏ đi so với hiện tại

- ❌ **Bỏ "Công việc gần đây"** (6 row sort theo endDate) — không có insight, lặp "Sắp đến hạn"
- ❌ **Bỏ "Theo phòng ban" đếm tổng** — chuyển sang panel "Phòng quá tải" ở Zone 3B

### 3.5. Vai trò cụ thể (đã có nhưng thiếu tính "actionable")

| Vai trò | Cần thấy NGAY |
|---|---|
| **Nhân viên** | "Bạn có 3 task cần điền nhật ký hôm nay" → 1 nút mở Daily Report mode |
| **Trưởng phòng** | "Phòng bạn có 2 quá hạn, 4 sắp đến hạn, NV A đang quá tải" |
| **Giám đốc** | "4 quá hạn toàn công ty, HCNS đang bottleneck, NV A vừa hoàn thành 5/5 task tuần này" |

---

## 4. Đề xuất Reports mới

### 4.1. Vai trò mới: **"Phòng phân tích"** — analytical

Mỗi chart phải trả lời 1 trong:
1. **"Đang đi đúng hướng không?"** (so với kỳ trước, so với KPI)
2. **"Ai/bộ phận nào đang nổi bật?"** (top performers, bottleneck)
3. **"Xu hướng 3 tháng qua thế nào?"** (line chart trend)

### 4.2. Bố cục mới

```
┌──────────────────────────────────────────────────────────────┐
│  BÁO CÁO & THỐNG KÊ                                         │
│  Tổng hợp tình hình triển khai                              │
│  ─────                                                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Kỳ:  [Tuần này ▾] [Tháng này] [Quý] [Tùy chỉnh...] │  │
│  │ So sánh với:  [▼ Kỳ trước]                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Tổng quan kỳ này                                           │
│  ────                                                       │
│  Tạo mới          Hoàn thành        Quá hạn       Hiệu suất│
│  18  ▲ +3          15  ▲ +2          4  ▼ -1       78% ▲2% │
│  (so với kỳ trước) (so với kỳ trước) (so với kỳ trước)     │
│                                                              │
│  ┌────────────────────────────┐ ┌────────────────────────┐ │
│  │ Xu hướng hoàn thành        │ │ Phân bổ theo ưu tiên  │ │ ← Chart duy nhất giữ
│  │ (line chart 12 tuần qua)   │ │ (chỉ giữ chart này)   │ │
│  │                            │ │                        │ │
│  │   ^ hoàn thành             │ │  ▰▰▰▰▰▰▰▰▰▰ Cao   8  │ │
│  │  /   \    /\               │ │  ▰▰▰▰▰▰▱▱▱▱ TB  12 │ │
│  │ /     \/\/   \              │ │  ▰▰▱▱▱▱▱▱▱▱ Thấp 3 │ │
│  └────────────────────────────┘ └────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────┐ ┌────────────────────────┐ │
│  │ Top 5 NV hoàn thành nhiều  │ │ Top 5 task quá hạn     │ │ ← MỚI
│  │ nhất tháng này            │ │ lâu nhất               │ │
│  │ ━━━━                      │ │ ━━━━                  │ │
│  │ 🥇 Nguyễn A    12 task 100%│ │ ⚠ DA003  45 ngày     │ │
│  │ 🥈 Trần B       9 task  95%│ │ ⚠ DA007  23 ngày     │ │
│  │ 🥉 Lê C         8 task  88%│ │ ⚠ DA011  15 ngày     │ │
│  │ ...                       │ │ ...                   │ │
│  └────────────────────────────┘ └────────────────────────┘ │
│                                                              │
│  [📥 Export CSV]  [🖨 In báo cáo]   (bổ sung sau)          │
└──────────────────────────────────────────────────────────────┘
```

### 4.3. Các thành phần cụ thể

| Phần | Mô tả | Dữ liệu cần |
|---|---|---|
| **Filter kỳ** | 4 nút: Tuần / Tháng / Quý / Tùy chỉnh (2 date input) | Lưu state vào `state.reportsPeriod` |
| **So sánh kỳ** | Dropdown: "Kỳ trước" (mặc định), "Cùng kỳ năm ngoái", "Không so sánh" | Tính delta % |
| **Tổng quan kỳ** (4 mini-stat) | Tạo mới / Hoàn thành / Quá hạn / Hiệu suất, mỗi ô có ▲▼ so với kỳ trước | Filter `state.projects` theo kỳ |
| **Line chart xu hướng** | Số task hoàn thành mỗi tuần, 12 tuần gần nhất | Render SVG inline hoặc dùng `<canvas>` đơn giản |
| **Phân bổ theo ưu tiên** (giữ nguyên) | 3 bar ngang: Cao / TB / Thấp | Lọc theo kỳ |
| **Top 5 performers** | 5 NV có nhiều task hoàn thành nhất + % completion | Aggregate từ `state.projects` + `state.allUsers` |
| **Top 5 quá hạn lâu** | 5 task có `daysOverdue` lớn nhất | `state.projects` filter overdue, sort |
| **Export CSV / In** | Đặt sau (theo quyết định người dùng) | — |

### 4.4. Phần bỏ đi so với hiện tại

| Bỏ | Lý do |
|---|---|
| ❌ Phân bổ theo **trạng thái** | Trùng dashboard stat #2 #3 — đã có sẵn |
| ❌ Phân bổ theo **phòng ban** | Trùng dashboard "Theo phòng ban" |
| ❌ Tiến độ trung bình theo **phòng ban** | Trùng dept stats của Dashboard |

### 4.5. Khi nào cần thêm export?

Export (CSV/PDF) chỉ nên thêm khi:
- Đã có ít nhất 1 BGĐ/TP dùng Reports để chuẩn bị nội dung họp (qua observation hoặc user feedback)
- Hệ thống có > 100 task (xuất CSV để gửi mail tổng hợp)
- Hoặc: khi cần tích hợp với tool báo cáo khác (Google Sheets, Excel pivot)

**Đề xuất: triển khai sau 2 sprint kể từ khi Reports ổn định.** Trước tiên ưu tiên fix trùng lặp + thêm filter kỳ + line chart trend.

---

## 5. So sánh cũ ↔ mới

| | Hiện tại | Đề xuất |
|---|---|---|
| **Dashboard** | 5 stat + recent + dept + overdue | 5 stat + greeting + **sắp đến hạn** + overdue + **activity feed** + **phòng quá tải** + quick actions |
| **Reports** | 4 chart trùng dashboard | Filter kỳ + 4 mini-stat so sánh + **line chart trend** + ưu tiên + **top 5 performers/bottleneck** |

**Dashboard**: từ 9 element → 13 element (thêm 4 mới, bỏ 1 cũ "recent").
**Reports**: từ 4 chart trùng → 7 phần tử có giá trị độc lập.

---

## 6. Mockup chi tiết — Dashboard BGĐ

```
┌────────────────────────────────────────────────────────────────────────┐
│ TỔNG QUAN                                              [Tạo công việc] │
│ Hôm nay, thứ Năm 01/10                                                │
│ ━━━━━━                                                                 │
│ Chào BGĐ Dũng — bạn có 4 quá hạn, 7 sắp đến hạn tuần này,           │
│ NV A đã hoàn thành 5/5 task.                                            │
├────────────────────────────────────────────────────────────────────────┤
│ TỔNG          ĐANG LÀM       HOÀN THÀNH    QUÁ HẠN    SẮP ĐẾN HẠN 7d │
│ 52            18             20           4 ⚠        7 ⏰             │
│ đầu việc      35% tổng       38% tổng     cần xử lý  tuần này          │
│ ▰▰▰▰▰▰▰▰▰▰  ▰▰▰▰▱▱▱▱▱  ▰▰▰▰▰▱▱▱▱  ▰▱▱▱▱▱▱▱▱  ▰▰▱▱▱▱▱▱               │
├────────────────────────────────────┬───────────────────────────────────┤
│ ⚠ QUÁ HẠN — 4 task cần xử lý      │ ⏰ SẮP ĐẾN HẠN 7 NGÀY — 7 task   │
│ ━━━━━━                            │ ━━━━━━                           │
│ ┃ DA005  Kiểm toán Q3             │ ┃ DA007  Triển khai Q4     2 ngày│
│    Cao Văn Cường · HCNS · 25/09   │    Cao Văn Cường · IT           │
│    ▰▰▰▰▰▱▱▱▱▱ 60%                  │    ▰▰▰▰▱▱▱▱▱ 40%                 │
│                                    │                                   │
│ ┃ DA011  Đối soát công nợ         │ ┃ DA012  Audit nội bộ     5 ngày│
│    Lê Thị Hoa · Kế toán · 28/09   │    Nguyễn Văn A · Ban Giám đốc  │
│    ▰▰▰▱▱▱▱▱▱▱ 30%                  │    ▰▰▱▱▱▱▱▱▱ 20%                 │
│                                    │                                   │
│ ┃ DA018  Triển khai phần mềm      │ ┃ DA003  Đào tạo nhân viên 7 ngày│
│    ...                             │    ...                           │
│   [Xem tất cả →]                  │   [Xem tất cả →]                │
├────────────────────────────────────┴───────────────────────────────────┤
│ 📰 HOẠT ĐỘNG GẦN ĐÂY (10 mới nhất)        │ 🔥 PHÒNG BAN QUÁ TẢI    │
│ ━━━━━━                                       │ ━━━━━━                  │
│ 10:42  Cao Văn Cường                        │ HCNS      ▰▰▰▰▰▰▰▰▰▰ 18/24│
│        cập nhật DA005 → 60%                 │ Kế toán  ▰▰▰▰▰▰▰▰▱▱ 11/16│
│ 09:15  Nguyễn Thảo Nhi                      │ Thu mua  ▰▰▰▰▰▰▱▱▱▱  7/12│
│        điền nhật ký DA022                    │ IT       ▰▰▰▰▱▱▱▱▱▱  4/10│
│ 08:30  NV mới tạo DA030 "Audit quý 4"      │                            │
│ ...                                          │ ⚠ HCNS: 6 task/NV        │
├─────────────────────────────────────────────┴────────────────────────────┤
│ QUICK ACTIONS                                                            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│ │ 📋 Xem quá   │ │ 📊 Phân công │ │ 🏆 Top NV    │ │ 📥 Export    │    │
│ │    hạn chi   │ │    lại task  │ │    tháng này │ │    CSV       │    │
│ │    tiết      │ │    (mở DS)   │ │    (mở tab)  │ │    (sau)     │    │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Mockup chi tiết — Reports BGĐ (chế độ Tháng này)

```
┌────────────────────────────────────────────────────────────────────────┐
│ BÁO CÁO & THỐNG KÊ                                                      │
│ Phân tích tình hình triển khai theo kỳ                                  │
│ ━━━━━━                                                                   │
│                                                                        │
│ Kỳ:  [ Tuần này ] [●Tháng này] [Quý] [Tùy chỉnh: __/__/__ → __/__/__ ]│
│ So sánh với: [▼ Tháng trước]                                              │
│                                                                        │
│ TỔNG QUAN THÁNG NÀY                                                     │
│ ━━━━━━━━                                                               │
│ TẠO MỚI            HOÀN THÀNH        QUÁ HẠN         HIỆU SUẤT         │
│ 18 ▲ +3 (20%)      15 ▲ +2 (15%)     4 ▼ -1 (-20%)   78% ▲ +2%        │
│                                                                        │
│ ┌─────────────────────────────────┐ ┌─────────────────────────────┐    │
│ │ XU HƯỚNG HOÀN THÀNH 12 TUẦN    │ │ PHÂN BỔ THEO ƯU TIÊN        │    │
│ │ ━━━━━━                          │ │ ━━━━━━                    │    │
│ │  25│       ••                   │ │ Cao    ▰▰▰▰▰▰▰▰▰▰    8 (40%)│   │
│ │  20│   •••   ••                 │ │ TB     ▰▰▰▰▰▰▱▱▱▱   10 (50%)│   │
│ │  15│ ••   ••   ••  ••           │ │ Thấp  ▰▰▱▱▱▱▱▱▱▱    2 (10%)│   │
│ │  10│•  •• ••  •• •• •• ••       │ │                           │   │
│ │   5└────────────────────         │ │                           │   │
│ │    W1 W2 W3 W4 ... W12           │ │                           │   │
│ │    ── Hoàn thành  ── Tạo mới    │ │                           │   │
│ └─────────────────────────────────┘ └─────────────────────────────┘    │
│                                                                        │
│ ┌─────────────────────────────────┐ ┌─────────────────────────────┐    │
│ │ 🏆 TOP 5 NV HOÀN THÀNH NHIỀU    │ │ ⚠ TOP 5 TASK QUÁ HẠN LÂU   │    │
│ │    NHẤT THÁNG NÀY                │ │    NHẤT                     │    │
│ │ ━━━━━━                          │ │ ━━━━━━                    │    │
│ │ 🥇 Nguyễn Thảo Nhi   12/12 100% │ │ DA003 Triển khai PM     45 ngày│ │
│ │ 🥈 Trần Văn B        9/10  90% │ │ DA007 Đào tạo NV        23 ngày│ │
│ │ 🥉 Lê Thị C          8/9   89% │ │ DA011 Đối soát công nợ  15 ngày│ │
│ │ 4. Phạm D           7/8   88% │ │ DA018 Kiểm toán Q3      12 ngày│ │
│ │ 5. Hoàng E           6/7   86% │ │ DA024 Audit nội bộ       8 ngày│ │
│ └─────────────────────────────────┘ └─────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Roadmap triển khai đề xuất

| Giai đoạn | Nội dung | Ước tính |
|---|---|---|
| **R1 — Làm sạch Reports** | Bỏ 3 chart trùng (status/dept/progress), giữ ưu tiên. Thêm filter kỳ (4 nút). | 2 giờ |
| **R2 — Mini-stat so sánh** | 4 ô stat đầu Reports: Tạo mới / Hoàn thành / Quá hạn / Hiệu suất, mỗi ô có ▲▼ so với kỳ trước | 3 giờ |
| **R3 — Line chart trend** | SVG inline, 12 tuần gần nhất, 2 line (hoàn thành + tạo mới) | 4 giờ |
| **R4 — Top 5 panels** | Top 5 performers + Top 5 quá hạn lâu (aggregate từ `state.projects`) | 2 giờ |
| **R5 — Dashboard: panel Sắp đến hạn** | Filter `endDate ∈ [today, today+7d)`, sort tăng dần, list 5 row | 1 giờ |
| **R6 — Dashboard: activity feed** | Aggregate từ `history[]` + `dailyLogs[]` của tất cả task, sort theo timestamp giảm | 3 giờ |
| **R7 — Dashboard: phòng quá tải + quick actions** | Tính tỉ lệ task/NV, đánh dấu "quá tải" nếu > 5; thêm 3 nút quick action | 2 giờ |
| **R8 — Polish** | Empty states, animation, responsive mobile | 2 giờ |

**Tổng: ~19 giờ.** Có thể chia làm 2 đợt:
- **Đợt 1 (R1–R5, ~10 giờ):** fix Reports + Dashboard quan trọng nhất
- **Đợt 2 (R6–R8, ~9 giờ):** activity feed + quick actions + polish

---

## 9. Khi nào KHÔNG nên làm theo đề xuất này

- Nếu **số lượng task < 30** và hệ thống chỉ có 5 user — bỏ Reports luôn, mọi thứ vừa trong Dashboard
- Nếu BGĐ **không bao giờ mở Reports** (có thể check analytics sau) — đề xuất giữ nguyên dashboard, gỡ Reports
- Nếu **data nguồn không có `history[]` hoặc `dailyLogs[]`** — không thể làm activity feed

---

## 10. Câu hỏi cần bạn xác nhận trước khi code

1. **Filter kỳ**: lưu state cục bộ (chỉ trong session) hay lưu DB (mỗi user có preference riêng)?
2. **Top 5 performers**: hiển thị tên NV thật + ID, hay ẩn danh (chỉ số liệu)?
3. **Activity feed**: cần lọc theo phòng ban không (TP chỉ thấy hoạt động phòng mình)?
4. **Phòng quá tải**: ngưỡng "quá tải" là bao nhiêu task/NV? (đề xuất: ≥ 5)

---

*File này là đề xuất, không sửa code. Khi bạn duyệt hướng nào, tôi sẽ triển khai theo từng giai đoạn trong Roadmap.*
