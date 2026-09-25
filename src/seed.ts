// ============================================================
// Seed/sample data â€” v2 (cÃ³ SubTask & DailyLog máº«u)
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
    tags: [],
    history: [],
    dailyLogs,
  };
}

export function seedProjects(): Project[] {
  const leNV = 'LÃª VÄƒn NhÃ¢n viÃªn';
  const phamTNV = 'Pháº¡m Thá»‹ NhÃ¢n viÃªn';

  const sub1Logs: DailyLog[] = [
    makeDailyLog(3, 'PhÃ¢n tÃ­ch cáº¥u trÃºc dá»¯ liá»‡u module káº¿ toÃ¡n cÅ©', 'ÄÃ£ láº­p sÆ¡ Ä‘á»“ mapping 12 báº£ng', 'KhÃ´ng cÃ³', 40, leNV),
    makeDailyLog(2, 'Viáº¿t script migrate dá»¯ liá»‡u khÃ¡ch hÃ ng', 'HoÃ n thÃ nh script, test thá»­ 500 records', 'Má»™t sá»‘ record cÃ³ encoding UTF-8 lá»—i', 55, leNV),
    makeDailyLog(1, 'Fix lá»—i encoding, cháº¡y migrate toÃ n bá»™ module káº¿ toÃ¡n', 'Migrate thÃ nh cÃ´ng 15.000 records', 'KhÃ´ng cÃ³', 70, leNV),
    makeDailyLog(0, 'Kiá»ƒm tra dá»¯ liá»‡u sau migrate, viáº¿t bÃ¡o cÃ¡o', 'BÃ¡o cÃ¡o Ä‘Ã£ gá»­i TrÆ°á»Ÿng phÃ²ng', 'KhÃ´ng cÃ³', 80, leNV),
  ];

  const sub2Logs: DailyLog[] = [
    makeDailyLog(2, 'NghiÃªn cá»©u API module nhÃ¢n sá»± má»›i', 'Äá»c hiá»ƒu tÃ i liá»‡u API', 'TÃ i liá»‡u thiáº¿u vÃ­ dá»¥', 15, leNV),
    makeDailyLog(1, 'Viáº¿t code káº¿t ná»‘i API nhÃ¢n sá»±', 'Káº¿t ná»‘i thÃ nh cÃ´ng endpoint chÃ­nh', 'KhÃ´ng cÃ³', 30, leNV),
    makeDailyLog(0, 'Test vÃ  debug káº¿t ná»‘i', 'Sá»­a 3 lá»—i, káº¿t ná»‘i á»•n Ä‘á»‹nh', 'KhÃ´ng cÃ³', 45, leNV),
  ];

  const da001: Project = {
    id: uid(),
    code: 'DA001',
    name: 'NÃ¢ng cáº¥p há»‡ thá»‘ng ERP ná»™i bá»™',
    description: 'Triá»ƒn khai phiÃªn báº£n má»›i cá»§a há»‡ thá»‘ng ERP, Ä‘á»“ng bá»™ dá»¯ liá»‡u tá»« pháº§n má»m cÅ© sang module má»›i.',
    department: 'PhÃ²ng IT',
    collaboratingDepts: ['PhÃ²ng Káº¿ toÃ¡n', 'PhÃ²ng NhÃ¢n sá»±'],
    assignee: 'Tráº§n Thá»‹ TrÆ°á»Ÿng phÃ²ng',
    createdBy: 'Nguyá»…n VÄƒn GiÃ¡m Ä‘á»‘c (Ban GiÃ¡m Ä‘á»‘c)',
    startDate: shiftDays(-20),
    endDate: shiftDays(15),
    progress: 65,
    status: 'in_progress',
    priority: 'high',
    results: 'ÄÃ£ hoÃ n thÃ nh migrate dá»¯ liá»‡u module káº¿ toÃ¡n. Äang xá»­ lÃ½ module nhÃ¢n sá»±.',
    notes: 'Cáº§n phá»‘i há»£p vá»›i PhÃ²ng Káº¿ toÃ¡n Ä‘á»ƒ test trÆ°á»›c khi go-live.',
    tags: [],
    history: [{ at: shiftDays(-20) + 'T08:00:00.000Z', action: 'Táº¡o dá»± Ã¡n', user: 'Nguyá»…n VÄƒn GiÃ¡m Ä‘á»‘c' }],
    subTasks: [
      makeSubTask(
        'Migrate dá»¯ liá»‡u module Káº¿ toÃ¡n',
        leNV,
        -20, 5,
        80, 'in_progress', 'high',
        'ÄÃ£ migrate 15.000 records káº¿ toÃ¡n, Ä‘ang kiá»ƒm tra tÃ­nh toÃ n váº¹n.',
        sub1Logs,
      ),
      makeSubTask(
        'Migrate dá»¯ liá»‡u module NhÃ¢n sá»±',
        leNV,
        -10, 15,
        45, 'in_progress', 'high',
        'Äang viáº¿t script migrate, káº¿t ná»‘i API á»•n Ä‘á»‹nh.',
        sub2Logs,
      ),
      makeSubTask(
        'ÄÃ o táº¡o ngÆ°á»i dÃ¹ng cuá»‘i sá»­ dá»¥ng ERP má»›i',
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
    name: 'Tá»• chá»©c khÃ³a Ä‘Ã o táº¡o ká»¹ nÄƒng má»m Q4',
    description: 'LÃªn káº¿ hoáº¡ch vÃ  tá»• chá»©c khÃ³a Ä‘Ã o táº¡o ká»¹ nÄƒng giao tiáº¿p vÃ  lÃ m viá»‡c nhÃ³m cho toÃ n cÃ´ng ty trong QuÃ½ 4.',
    department: 'PhÃ²ng NhÃ¢n sá»±',
    collaboratingDepts: ['Ban GiÃ¡m Ä‘á»‘c'],
    assignee: 'Pháº¡m VÄƒn TrÆ°á»Ÿng (PhÃ²ng NhÃ¢n sá»±)',
    createdBy: 'Nguyá»…n VÄƒn GiÃ¡m Ä‘á»‘c (Ban GiÃ¡m Ä‘á»‘c)',
    startDate: shiftDays(-10),
    endDate: shiftDays(30),
    progress: 40,
    status: 'in_progress',
    priority: 'medium',
    results: 'ÄÃ£ chá»‘t giáº£ng viÃªn, Ä‘ang kháº£o sÃ¡t nhu cáº§u há»c viÃªn.',
    notes: '',
    tags: [],
    history: [],
    subTasks: [
      makeSubTask('Kháº£o sÃ¡t nhu cáº§u há»c viÃªn', 'Nguyá»…n Thá»‹ HR', -10, -2, 100, 'completed', 'medium', 'ÄÃ£ kháº£o sÃ¡t 120 nhÃ¢n viÃªn, thu tháº­p káº¿t quáº£.'),
      makeSubTask('LiÃªn há»‡ vÃ  chá»‘t giáº£ng viÃªn', 'Nguyá»…n Thá»‹ HR', -8, 0, 100, 'completed', 'high', 'ÄÃ£ kÃ½ há»£p Ä‘á»“ng vá»›i cÃ´ng ty Ä‘Ã o táº¡o ABC.'),
      makeSubTask('Chuáº©n bá»‹ tÃ i liá»‡u vÃ  Ä‘á»‹a Ä‘iá»ƒm', 'Pháº¡m Thá»‹ NhÃ¢n viÃªn', 0, 15, 20, 'in_progress', 'medium', 'Äang Ä‘áº·t phÃ²ng há»™i tháº£o.'),
    ],
  };

  const da003: Project = {
    id: uid(),
    code: 'DA003',
    name: 'Chiáº¿n dá»‹ch Marketing Táº¿t 2026',
    description: 'XÃ¢y dá»±ng vÃ  triá»ƒn khai chiáº¿n dá»‹ch quáº£ng bÃ¡ sáº£n pháº©m dá»‹p Táº¿t NguyÃªn ÄÃ¡n.',
    department: 'PhÃ²ng Marketing',
    collaboratingDepts: ['PhÃ²ng Kinh doanh', 'PhÃ²ng Káº¿ toÃ¡n'],
    assignee: 'Äá»— Thá»‹ TrÆ°á»Ÿng (PhÃ²ng Marketing)',
    createdBy: 'Nguyá»…n VÄƒn GiÃ¡m Ä‘á»‘c (Ban GiÃ¡m Ä‘á»‘c)',
    startDate: shiftDays(-40),
    endDate: shiftDays(-5),
    progress: 100,
    status: 'completed',
    priority: 'high',
    results: 'Chiáº¿n dá»‹ch Ä‘Ã£ hoÃ n thÃ nh, doanh sá»‘ Táº¿t tÄƒng 25% so vá»›i cÃ¹ng ká»³.',
    notes: 'BÃ¡o cÃ¡o tá»•ng káº¿t Ä‘Ã£ gá»­i BGÄ.',
    tags: [],
    history: [],
    subTasks: [],
  };

  const da004: Project = {
    id: uid(),
    code: 'DA004',
    name: 'Kiá»ƒm toÃ¡n ná»™i bá»™ tÃ i chÃ­nh quÃ½ 3',
    description: 'RÃ  soÃ¡t vÃ  Ä‘Ã¡nh giÃ¡ toÃ n bá»™ quy trÃ¬nh tÃ i chÃ­nh, káº¿ toÃ¡n quÃ½ 3.',
    department: 'PhÃ²ng Káº¿ toÃ¡n',
    collaboratingDepts: ['Ban GiÃ¡m Ä‘á»‘c'],
    assignee: 'BÃ¹i VÄƒn TrÆ°á»Ÿng (PhÃ²ng Káº¿ toÃ¡n)',
    createdBy: 'Nguyá»…n VÄƒn GiÃ¡m Ä‘á»‘c (Ban GiÃ¡m Ä‘á»‘c)',
    startDate: shiftDays(5),
    endDate: shiftDays(45),
    progress: 0,
    status: 'not_started',
    priority: 'medium',
    results: '',
    notes: 'Chá» BGÄ phÃª duyá»‡t káº¿ hoáº¡ch kiá»ƒm toÃ¡n.',
    tags: [],
    history: [],
    subTasks: [],
  };

  const da005: Project = {
    id: uid(),
    code: 'DA005',
    name: 'PhÃ¡t triá»ƒn kÃªnh bÃ¡n hÃ ng Online',
    description: 'Má»Ÿ rá»™ng kÃªnh bÃ¡n hÃ ng qua sÃ n thÆ°Æ¡ng máº¡i Ä‘iá»‡n tá»­ Shopee, Lazada vÃ  TikTok Shop.',
    department: 'PhÃ²ng Kinh doanh',
    collaboratingDepts: ['PhÃ²ng Marketing', 'PhÃ²ng IT'],
    assignee: 'LÃ½ Thá»‹ TrÆ°á»Ÿng (PhÃ²ng Kinh doanh)',
    createdBy: 'Nguyá»…n VÄƒn GiÃ¡m Ä‘á»‘c (Ban GiÃ¡m Ä‘á»‘c)',
    startDate: shiftDays(-15),
    endDate: shiftDays(20),
    progress: 30,
    status: 'in_progress',
    priority: 'high',
    results: 'ÄÃ£ láº­p shop trÃªn Shopee, chá» Ä‘Äƒng kÃ½ TikTok Shop.',
    notes: '',
    tags: [],
    history: [],
    subTasks: [
      makeSubTask('Láº­p shop Shopee vÃ  Ä‘Äƒng sáº£n pháº©m', 'VÅ© VÄƒn Sale', -15, -5, 100, 'completed', 'high', 'Shop Shopee Ä‘Ã£ live, 50 sáº£n pháº©m Ä‘Ã£ Ä‘Äƒng.'),
      makeSubTask('ÄÄƒng kÃ½ vÃ  setup TikTok Shop', 'VÅ© VÄƒn Sale', -5, 10, 20, 'in_progress', 'medium', 'Äang chá» xÃ¡c minh tÃ i khoáº£n TikTok Business.'),
      makeSubTask('Cháº¡y quáº£ng cÃ¡o vÃ  theo dÃµi ROI', 'VÅ© VÄƒn Sale', 5, 20, 0, 'not_started', 'medium', ''),
    ],
  };

  const da006: Project = {
    id: uid(),
    code: 'DA006',
    name: 'XÃ¢y dá»±ng há»‡ thá»‘ng cháº¥m cÃ´ng vÃ¢n tay',
    description: 'Triá»ƒn khai há»‡ thá»‘ng cháº¥m cÃ´ng báº±ng vÃ¢n tay táº¡i 3 chi nhÃ¡nh.',
    department: 'PhÃ²ng IT',
    collaboratingDepts: ['PhÃ²ng NhÃ¢n sá»±'],
    assignee: 'Tráº§n Thá»‹ TrÆ°á»Ÿng phÃ²ng',
    createdBy: 'Nguyá»…n VÄƒn GiÃ¡m Ä‘á»‘c (Ban GiÃ¡m Ä‘á»‘c)',
    startDate: shiftDays(-60),
    endDate: shiftDays(-2),
    progress: 80,
    status: 'on_hold',
    priority: 'medium',
    results: 'ÄÃ£ hoÃ n thÃ nh triá»ƒn khai chi nhÃ¡nh 1 vÃ  2, chi nhÃ¡nh 3 Ä‘ang chá» thiáº¿t bá»‹.',
    notes: 'Táº¡m dá»«ng do nhÃ  cung cáº¥p thiáº¿t bá»‹ cháº­m giao.',
    tags: [],
    history: [],
    subTasks: [
      makeSubTask('Triá»ƒn khai chi nhÃ¡nh 1', leNV, -60, -40, 100, 'completed', 'high', 'HoÃ n thÃ nh, há»‡ thá»‘ng hoáº¡t Ä‘á»™ng á»•n Ä‘á»‹nh.'),
      makeSubTask('Triá»ƒn khai chi nhÃ¡nh 2', leNV, -40, -15, 100, 'completed', 'high', 'HoÃ n thÃ nh.'),
      makeSubTask('Triá»ƒn khai chi nhÃ¡nh 3', leNV, -15, -2, 40, 'on_hold', 'medium', 'Táº¡m dá»«ng chá» thiáº¿t bá»‹ tá»« nhÃ  cung cáº¥p.'),
    ],
  };

  return [da001, da002, da003, da004, da005, da006];
}
