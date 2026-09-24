// ============================================================
// Seed/sample data — v2 (có SubTask & DailyLog mẫu)
// ============================================================
import type { Project, SubTask, DailyLog } from './types';
import { uid, shiftDays } from './utils';

function makeDailyLog(daysAgo: number, desc: string, result: string, obstacle: string, progress: number, user: string): DailyLog {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const dateStr = d.toISOString().slice(0, 10);
  return {
    id: uid(),
    date: dateStr,
    description: desc,
    result,
    obstacle,
    progress,
    user,
    createdAt: d.toISOString(),
  };
}

function makeSubTask(
  name: string,
  assignee: string,
  startDays: number,
  endDays: number,
  progress: number,
  status: SubTask['status'],
  priority: SubTask['priority'],
  results: string,
  dailyLogs: DailyLog[] = [],
): SubTask {
  return {
    id: uid(),
    name,
    description: '',
    assignee,
    startDate: shiftDays(startDays),
    endDate: shiftDays(endDays),
    progress,
    status,
    priority,
    results,
    notes: '',
    history: [],
    dailyLogs,
  };
}

export function seedProjects(): Project[] {
  const leNV = 'Lê Văn Nhân viên';
  const phamTNV = 'Phạm Thị Nhân viên';

  const sub1Logs: DailyLog[] = [
    makeDailyLog(3, 'Phân tích cấu trúc dữ liệu module kế toán cũ', 'Đã lập sơ đồ mapping 12 bảng', 'Không có', 40, leNV),
    makeDailyLog(2, 'Viết script migrate dữ liệu khách hàng', 'Hoàn thành script, test thử 500 records', 'Một số record có encoding UTF-8 lỗi', 55, leNV),
    makeDailyLog(1, 'Fix lỗi encoding, chạy migrate toàn bộ module kế toán', 'Migrate thành công 15.000 records', 'Không có', 70, leNV),
    makeDailyLog(0, 'Kiểm tra dữ liệu sau migrate, viết báo cáo', 'Báo cáo đã gửi Trưởng phòng', 'Không có', 80, leNV),
  ];

  const sub2Logs: DailyLog[] = [
    makeDailyLog(2, 'Nghiên cứu API module nhân sự mới', 'Đọc hiểu tài liệu API', 'Tài liệu thiếu ví dụ', 15, leNV),
    makeDailyLog(1, 'Viết code kết nối API nhân sự', 'Kết nối thành công endpoint chính', 'Không có', 30, leNV),
    makeDailyLog(0, 'Test và debug kết nối', 'Sửa 3 lỗi, kết nối ổn định', 'Không có', 45, leNV),
  ];

  const da001: Project = {
    id: uid(),
    code: 'DA001',
    name: 'Nâng cấp hệ thống ERP nội bộ',
    description: 'Triển khai phiên bản mới của hệ thống ERP, đồng bộ dữ liệu từ phần mềm cũ sang module mới.',
    department: 'Phòng IT',
    collaboratingDepts: ['Phòng Kế toán', 'Phòng Nhân sự'],
    assignee: 'Trần Thị Trưởng phòng',
    createdBy: 'Nguyễn Văn Giám đốc (Ban Giám đốc)',
    startDate: shiftDays(-20),
    endDate: shiftDays(15),
    progress: 65,
    status: 'in_progress',
    priority: 'high',
    results: 'Đã hoàn thành migrate dữ liệu module kế toán. Đang xử lý module nhân sự.',
    notes: 'Cần phối hợp với Phòng Kế toán để test trước khi go-live.',
    history: [{ at: shiftDays(-20) + 'T08:00:00.000Z', action: 'Tạo dự án', user: 'Nguyễn Văn Giám đốc' }],
    subTasks: [
      makeSubTask(
        'Migrate dữ liệu module Kế toán',
        leNV,
        -20, 5,
        80, 'in_progress', 'high',
        'Đã migrate 15.000 records kế toán, đang kiểm tra tính toàn vẹn.',
        sub1Logs,
      ),
      makeSubTask(
        'Migrate dữ liệu module Nhân sự',
        leNV,
        -10, 15,
        45, 'in_progress', 'high',
        'Đang viết script migrate, kết nối API ổn định.',
        sub2Logs,
      ),
      makeSubTask(
        'Đào tạo người dùng cuối sử dụng ERP mới',
        phamTNV,
        5, 20,
        0, 'not_started', 'medium',
        '',
      ),
    ],
  };

  const da002: Project = {
    id: uid(),
    code: 'DA002',
    name: 'Tổ chức khóa đào tạo kỹ năng mềm Q4',
    description: 'Lên kế hoạch và tổ chức khóa đào tạo kỹ năng giao tiếp và làm việc nhóm cho toàn công ty trong Quý 4.',
    department: 'Phòng Nhân sự',
    collaboratingDepts: ['Ban Giám đốc'],
    assignee: 'Phạm Văn Trưởng (Phòng Nhân sự)',
    createdBy: 'Nguyễn Văn Giám đốc (Ban Giám đốc)',
    startDate: shiftDays(-10),
    endDate: shiftDays(30),
    progress: 40,
    status: 'in_progress',
    priority: 'medium',
    results: 'Đã chốt giảng viên, đang khảo sát nhu cầu học viên.',
    notes: '',
    history: [],
    subTasks: [
      makeSubTask('Khảo sát nhu cầu học viên', 'Nguyễn Thị HR', -10, -2, 100, 'completed', 'medium', 'Đã khảo sát 120 nhân viên, thu thập kết quả.'),
      makeSubTask('Liên hệ và chốt giảng viên', 'Nguyễn Thị HR', -8, 0, 100, 'completed', 'high', 'Đã ký hợp đồng với công ty đào tạo ABC.'),
      makeSubTask('Chuẩn bị tài liệu và địa điểm', 'Phạm Thị Nhân viên', 0, 15, 20, 'in_progress', 'medium', 'Đang đặt phòng hội thảo.'),
    ],
  };

  const da003: Project = {
    id: uid(),
    code: 'DA003',
    name: 'Chiến dịch Marketing Tết 2026',
    description: 'Xây dựng và triển khai chiến dịch quảng bá sản phẩm dịp Tết Nguyên Đán.',
    department: 'Phòng Marketing',
    collaboratingDepts: ['Phòng Kinh doanh', 'Phòng Kế toán'],
    assignee: 'Đỗ Thị Trưởng (Phòng Marketing)',
    createdBy: 'Nguyễn Văn Giám đốc (Ban Giám đốc)',
    startDate: shiftDays(-40),
    endDate: shiftDays(-5),
    progress: 100,
    status: 'completed',
    priority: 'high',
    results: 'Chiến dịch đã hoàn thành, doanh số Tết tăng 25% so với cùng kỳ.',
    notes: 'Báo cáo tổng kết đã gửi BGĐ.',
    history: [],
    subTasks: [],
  };

  const da004: Project = {
    id: uid(),
    code: 'DA004',
    name: 'Kiểm toán nội bộ tài chính quý 3',
    description: 'Rà soát và đánh giá toàn bộ quy trình tài chính, kế toán quý 3.',
    department: 'Phòng Kế toán',
    collaboratingDepts: ['Ban Giám đốc'],
    assignee: 'Bùi Văn Trưởng (Phòng Kế toán)',
    createdBy: 'Nguyễn Văn Giám đốc (Ban Giám đốc)',
    startDate: shiftDays(5),
    endDate: shiftDays(45),
    progress: 0,
    status: 'not_started',
    priority: 'medium',
    results: '',
    notes: 'Chờ BGĐ phê duyệt kế hoạch kiểm toán.',
    history: [],
    subTasks: [],
  };

  const da005: Project = {
    id: uid(),
    code: 'DA005',
    name: 'Phát triển kênh bán hàng Online',
    description: 'Mở rộng kênh bán hàng qua sàn thương mại điện tử Shopee, Lazada và TikTok Shop.',
    department: 'Phòng Kinh doanh',
    collaboratingDepts: ['Phòng Marketing', 'Phòng IT'],
    assignee: 'Lý Thị Trưởng (Phòng Kinh doanh)',
    createdBy: 'Nguyễn Văn Giám đốc (Ban Giám đốc)',
    startDate: shiftDays(-15),
    endDate: shiftDays(20),
    progress: 30,
    status: 'in_progress',
    priority: 'high',
    results: 'Đã lập shop trên Shopee, chờ đăng ký TikTok Shop.',
    notes: '',
    history: [],
    subTasks: [
      makeSubTask('Lập shop Shopee và đăng sản phẩm', 'Vũ Văn Sale', -15, -5, 100, 'completed', 'high', 'Shop Shopee đã live, 50 sản phẩm đã đăng.'),
      makeSubTask('Đăng ký và setup TikTok Shop', 'Vũ Văn Sale', -5, 10, 20, 'in_progress', 'medium', 'Đang chờ xác minh tài khoản TikTok Business.'),
      makeSubTask('Chạy quảng cáo và theo dõi ROI', 'Vũ Văn Sale', 5, 20, 0, 'not_started', 'medium', ''),
    ],
  };

  const da006: Project = {
    id: uid(),
    code: 'DA006',
    name: 'Xây dựng hệ thống chấm công vân tay',
    description: 'Triển khai hệ thống chấm công bằng vân tay tại 3 chi nhánh.',
    department: 'Phòng IT',
    collaboratingDepts: ['Phòng Nhân sự'],
    assignee: 'Trần Thị Trưởng phòng',
    createdBy: 'Nguyễn Văn Giám đốc (Ban Giám đốc)',
    startDate: shiftDays(-60),
    endDate: shiftDays(-2),
    progress: 80,
    status: 'on_hold',
    priority: 'medium',
    results: 'Đã hoàn thành triển khai chi nhánh 1 và 2, chi nhánh 3 đang chờ thiết bị.',
    notes: 'Tạm dừng do nhà cung cấp thiết bị chậm giao.',
    history: [],
    subTasks: [
      makeSubTask('Triển khai chi nhánh 1', leNV, -60, -40, 100, 'completed', 'high', 'Hoàn thành, hệ thống hoạt động ổn định.'),
      makeSubTask('Triển khai chi nhánh 2', leNV, -40, -15, 100, 'completed', 'high', 'Hoàn thành.'),
      makeSubTask('Triển khai chi nhánh 3', leNV, -15, -2, 40, 'on_hold', 'medium', 'Tạm dừng chờ thiết bị từ nhà cung cấp.'),
    ],
  };

  return [da001, da002, da003, da004, da005, da006];
}
