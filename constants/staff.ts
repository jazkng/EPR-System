import { Employee, RoleDefinition, RoleGuide, AllowanceKey } from '../types';

// ==========================================
// ROLE GUIDES (职位说明书) - 2-TIER SYSTEM
// ==========================================
export const DEFAULT_ROLE_GUIDES: Record<string, RoleGuide> = {
  // --- MANAGEMENT ---
  'Executive Chef (行政总厨)': {
    description: '厨房最高指挥官。负责菜品研发、成本控制与团队建设。',
    coreValue: '出品灵魂与厨房纪律',
    safetyRedLine: '严禁使用变质食材 / 供应商回扣 (商业欺诈报警)',
    duties: ['新菜研发', '成本核算', '厨房总控', '供应商管理'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 5000, max: 6500 },
    employeeRules: [],
    specialIncentive: '季度净利分红 (Profit Share)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '熟悉厨房运作，通过菜品试吃考核。',
    confirmedExpectation: '独立管理厨房团队，控制成本在 35% 以下。'
  },
  'Store Manager (门店经理)': {
    description: '门店的大脑。全面负责业绩、成本与团队稳定。',
    coreValue: '业绩增长与人才复制',
    safetyRedLine: '严禁伪造报表数据 / 收受回扣 (商业欺诈报警)',
    duties: ['业绩掌舵', '成本控制', '人才培养', '危机处理'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 3800, max: 4500 },
    employeeRules: [],
    specialIncentive: '季度净利分红 (Profit Sharing)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '掌握所有岗位SOP，能够独立排班。',
    confirmedExpectation: '带领团队达成月度业绩目标，零客诉。'
  },
  'Operations Supervisor (运营主管)': {
    description: '楼面总指挥。负责现场调度与顾客满意度。',
    coreValue: '现场效率与零客诉',
    safetyRedLine: '严禁排班偏私 / 包庇下属违规',
    duties: ['排班管理', '现场控场', '新人培训', '客诉处理'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 2800, max: 3200 },
    employeeRules: [],
    specialIncentive: '团队达标奖金 (Team Bonus)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '熟悉楼面动线，能够处理一般客诉。',
    confirmedExpectation: '独立带班，培训新员工，提升翻台率。'
  },

  // --- FRONT OF HOUSE (FOH) ---
  'Counter (柜台)': {
    description: '餐厅枢纽。负责收银、外卖交接与门面接待。',
    coreValue: '账目精准与亲切接待',
    safetyRedLine: '严禁私吞公款或挪用备用金 (报警处理)',
    duties: ['收银操作', '账目核对', '外卖接单', '电话接待'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 2200, max: 2500 },
    employeeRules: [],
    specialIncentive: '账目零差错津贴 (Zero Variance)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '熟练操作 POS，现金结算无误。',
    confirmedExpectation: '高效处理外卖订单，提升顾客第一印象。'
  },
  'Captain (写单员)': {
    description: '推销专家。负责点菜、推销招牌菜与跟进出餐。',
    coreValue: '精准写单与高客单价',
    safetyRedLine: '严禁漏单/写错单不报 (造成公司损失)',
    duties: ['准确写单', '推销招牌', '跟进出餐', '确认菜品'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 2300, max: 2600 },
    employeeRules: [],
    specialIncentive: '推销提成 (Sales Commission)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '背熟菜单，准确下单，无漏单。',
    confirmedExpectation: '主动推销高毛利产品，提升客单价。'
  },
  'Waiter (服务员)': {
    description: '服务基石。确保顾客用餐愉快，响应迅速。',
    coreValue: '响应速度与安全服务',
    safetyRedLine: '严禁跨过婴儿/小孩上菜 (极度危险)',
    duties: ['传菜', '巡台服务', '极速翻台', '外卖传递'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 1800, max: 2200 },
    employeeRules: [],
    specialIncentive: '每日小费 (Daily Tips)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '动作麻利，能够准确传菜到桌号。',
    confirmedExpectation: '眼观六路，主动服务，保持区域整洁。'
  },
  'Cleaner (清洁员)': {
    description: '环境卫士。维护店内整洁与卫生。',
    coreValue: '无死角清洁',
    safetyRedLine: '严禁地面积水不处理 (防滑倒)',
    duties: ['环境清洁', '厕所检查 (30min)', '垃圾处理', '翻台/抹桌'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 1500, max: 1800 },
    employeeRules: [],
    specialIncentive: '环境卫生奖 (Hygiene Bonus)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '勤快，厕所无异味，地面无垃圾。',
    confirmedExpectation: '主动发现卫生死角，维护店面形象。'
  },
  'Part-Time (兼职)': {
    description: '灵活支援。当日结算，无福利，仅享制服。',
    coreValue: '机动性与补位',
    safetyRedLine: '严禁无故缺席 (No Show)',
    duties: ['高峰期支援', '基础服务/清洁', '听从调配'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 0, max: 0 }, // Hourly
    employeeRules: [],
    specialIncentive: '当日出薪 (Daily Pay)',
    enabledAllowances: [],
    probationExpectation: 'Hourly Rate: RM 9 - RM 12 depending on skill.',
    confirmedExpectation: 'Reliable and fast.'
  },

  // --- BOH (KITCHEN) ---
  'Water Bar (水吧)': {
    description: '饮品专家。负责所有饮料与甜品的制作。',
    coreValue: '出品速度与标准口味',
    safetyRedLine: '严禁使用过期待料 (食品安全)',
    duties: ['饮料制作', '备料 (糖水/水果)', '吧台清洁', '杯具管理'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 2000, max: 2400 },
    employeeRules: [],
    specialIncentive: '新品研发奖 (New Drink Bonus)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '熟记所有饮料配方，出品速度达标。',
    confirmedExpectation: '独立管理吧台库存，保持品质稳定。'
  },
  'Head Chef (头手)': {
    description: '炒锅主力。负责核心菜品的烹饪。',
    coreValue: '锅气与速度',
    safetyRedLine: '严禁出品不熟或异物',
    duties: ['第一炒锅', '出餐品质', '协助总厨'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 4500, max: 5500 },
    employeeRules: [],
    specialIncentive: '出品质量奖 (Quality Bonus)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '掌握核心菜品口味，锅气十足。',
    confirmedExpectation: '高峰期出餐稳定，零退菜。'
  },
  'Assistant Chef (帮锅)': {
    description: '厨房中坚。协助头手与备料。',
    coreValue: '执行力与配合度',
    safetyRedLine: '严禁擅自修改配方',
    duties: ['协助烹饪', '备料管理', '出餐节奏'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 3000, max: 3800 },
    employeeRules: [],
    specialIncentive: '零退菜奖 (Zero Return)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '熟悉备料流程，配合头手出餐。',
    confirmedExpectation: '能够独立负责部分炒锅工作。'
  },
  'Kitchen Cutter (占板)': {
    description: '食材管家。负责切割与腌制。',
    coreValue: '规格统一与备料',
    safetyRedLine: '严禁生熟砧板混用',
    duties: ['精准切割', '腌制', '备料管理'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 2200, max: 2600 },
    employeeRules: [],
    specialIncentive: '无工伤安全奖 (Safety Bonus)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '刀功合格，分量控制准确。',
    confirmedExpectation: '管理冰箱库存，减少食材浪费。'
  },
  'Kitchen Apprentice (厨房学徒)': {
    description: '厨房新人。学习并协助各岗位。',
    coreValue: '勤奋与好学',
    safetyRedLine: '严禁操作不熟悉的设备 (安全第一)',
    duties: ['基础备料', '传递食材', '学习烹饪技巧'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 1500, max: 1800 },
    employeeRules: [],
    specialIncentive: '晋升考核奖 (Promotion Exam)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '肯学肯干，不迟到早退。',
    confirmedExpectation: '掌握基本备料，可以协助打荷。'
  },
  'Kitchen Helper (厨房帮手)': {
    description: '后勤多面手。负责杂务与清洁。',
    coreValue: '机动灵活',
    safetyRedLine: '严禁垃圾过夜',
    duties: ['打荷', '补货', '环境清洁', '洗碗支援'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 1500, max: 1800 },
    employeeRules: [],
    specialIncentive: '全勤奖励 (Attendance)',
    enabledAllowances: ['ATTENDANCE', 'MEAL', 'HOSTEL'],
    probationExpectation: '手脚麻利，服从安排。',
    confirmedExpectation: '熟悉厨房卫生标准，保持环境整洁。'
  },
  // OWNER ROLE DEFAULT
  'Owner (老板)': {
    description: 'Company Owner',
    coreValue: 'Ownership',
    safetyRedLine: 'No Limits',
    duties: ['All'],
    /* 修复：添加缺失的 troubleshooting */
    troubleshooting: [],
    salaryRange: { min: 0, max: 0 },
    employeeRules: [],
    specialIncentive: 'Profit',
    enabledAllowances: [],
    probationExpectation: '',
    confirmedExpectation: ''
  }
};

// ==========================================
// DEFAULT ROLES (SYSTEM CONFIG)
// ==========================================
export const DEFAULT_ROLES: RoleDefinition[] = [
    { id: 'r0', title: 'Executive Chef (行政总厨)', department: 'MANAGEMENT', rankCategory: 'MANAGEMENT', duties: ['厨房总控'], allowedModules: ['INVENTORY_KITCHEN', 'INVENTORY_BAR', 'SUPPLIER_CONTACTS', 'SOP_INSPECT', 'ROSTER', 'LOGBOOK'] },
    { id: 'r1', title: 'Store Manager (门店经理)', department: 'MANAGEMENT', rankCategory: 'MANAGEMENT', duties: ['全盘管理'], allowedModules: ['SETTLEMENT', 'ROSTER', 'LOGBOOK', 'INVENTORY_KITCHEN', 'INVENTORY_BAR', 'INVENTORY_GENERAL', 'SUPPLIER_CONTACTS', 'QUEUE_MANAGER', 'SOP_INSPECT'] },
    { id: 'r2', title: 'Operations Supervisor (运营主管)', department: 'MANAGEMENT', rankCategory: 'MANAGEMENT', duties: ['楼面管理'], allowedModules: ['ROSTER', 'LOGBOOK', 'SOP_INSPECT', 'QUEUE_MANAGER'] },
    
    { id: 'r3', title: 'Counter (柜台)', department: 'FOH', rankCategory: 'MID_LEVEL', duties: ['收银/接待'], allowedModules: ['SETTLEMENT', 'QUEUE_MANAGER'] },
    { id: 'r4', title: 'Captain (写单员)', department: 'FOH', rankCategory: 'MID_LEVEL', duties: ['点单'], allowedModules: ['QUEUE_MANAGER'] },
    { id: 'r5', title: 'Waiter (服务员)', department: 'FOH', rankCategory: 'ENTRY_LEVEL', duties: ['服务'], allowedModules: [] },
    { id: 'r6', title: 'Cleaner (清洁员)', department: 'FOH', rankCategory: 'ENTRY_LEVEL', duties: ['清洁'], allowedModules: [] },
    { id: 'r7', title: 'Part-Time (兼职)', department: 'FOH', rankCategory: 'ENTRY_LEVEL', duties: ['机动'], allowedModules: [] },

    { id: 'r8', title: 'Head Chef (头手)', department: 'BOH', rankCategory: 'MID_LEVEL', duties: ['烹饪'], allowedModules: ['INVENTORY_KITCHEN'] },
    { id: 'r9', title: 'Assistant Chef (帮锅)', department: 'BOH', rankCategory: 'MID_LEVEL', duties: ['协助烹饪'], allowedModules: ['INVENTORY_KITCHEN'] },
    { id: 'r10', title: 'Water Bar (水吧)', department: 'BOH', rankCategory: 'MID_LEVEL', duties: ['饮品'], allowedModules: ['INVENTORY_BAR'] },
    { id: 'r11', title: 'Kitchen Cutter (占板)', department: 'BOH', rankCategory: 'ENTRY_LEVEL', duties: ['切配'], allowedModules: [] },
    { id: 'r12', title: 'Kitchen Apprentice (厨房学徒)', department: 'BOH', rankCategory: 'ENTRY_LEVEL', duties: ['学习'], allowedModules: [] },
    { id: 'r13', title: 'Kitchen Helper (厨房帮手)', department: 'BOH', rankCategory: 'ENTRY_LEVEL', duties: ['杂务'], allowedModules: [] },
];

// ==========================================
// SHARED DATA CONSTANTS (NEW)
// ==========================================
export const DEFAULT_STAFF: Employee[] = [
  // OWNERS
  { id: '001', pin: '8888', name: 'Boss 1', role: 'Owner (老板)', status: 'CONFIRMED', level: 'Confirmed', basicSalary: 0, phone: '', joinDate: '2024-01-01', absentDays: 0, gender: 'Male', nationality: 'Malaysian 🇲🇾' },
  { id: '002', pin: '8888', name: 'Boss 2', role: 'Owner (老板)', status: 'CONFIRMED', level: 'Confirmed', basicSalary: 0, phone: '', joinDate: '2024-01-01', absentDays: 0, gender: 'Male', nationality: 'Malaysian 🇲🇾' },

  // MANAGEMENT
  { id: '1', pin: '0000', name: 'Ah Hock', role: 'Store Manager (门店经理)', status: 'CONFIRMED', level: 'Confirmed', basicSalary: 4500, phone: '012-3456789', joinDate: '2018-03-15', absentDays: 0, gender: 'Male', age: 45, nationality: 'Malaysian 🇲🇾', email: 'hock@kimliankee.com', address: 'Kepong' },
  { id: '2', pin: '0000', name: 'Chef Wong', role: 'Executive Chef (行政总厨)', status: 'CONFIRMED', level: 'Confirmed', basicSalary: 6000, phone: '012-9876543', joinDate: '2019-01-01', absentDays: 0, gender: 'Male', age: 50, nationality: 'Malaysian 🇲🇾', address: 'KL' },

  // FOH
  { id: '304', pin: '0000', name: 'Muthu', role: 'Waiter (服务员)', status: 'CONFIRMED', level: 'Confirmed', basicSalary: 2400, phone: '016-2223333', joinDate: '2020-12-01', absentDays: 0, gender: 'Male', age: 29, nationality: 'Malaysian 🇲🇾', address: 'Brickfields' },
  { id: '305', pin: '0000', name: 'Xiao Wei', role: 'Counter (柜台)', status: 'PROBATION', level: 'Probation', basicSalary: 2200, phone: '011-1110000', joinDate: '2024-01-01', absentDays: 0, gender: 'Female', age: 22, nationality: 'Malaysian 🇲🇾', address: 'Kepong' },
  
  // FOREIGNER EXAMPLE
  { id: '401', pin: '0000', name: 'Ah Seng (Foreign)', role: 'Water Bar (水吧)', status: 'CONFIRMED', level: 'Confirmed', basicSalary: 2500, phone: '017-7778888', joinDate: '2021-05-01', absentDays: 0, gender: 'Male', age: 25, nationality: 'Vietnamese 🇻🇳', address: 'Jinjang', isQualityStaff: true, hasEPF: false },
];

export const NATIONALITY_OPTS = [
    'Malaysian 🇲🇾',
    'Foreigner (WP)',
    'Indonesian 🇮🇩',
    'Bangladeshi 🇧🇩',
    'Nepalese 🇳🇵',
    'Vietnamese 🇻🇳',
    'Myanmar 🇲🇲',
    'Chinese 🇨🇳',
    'Other'
];

export const SKILL_OPTS = [
    'Calculation (计算)',
    'Speed (速度)',
    'Service (服务)',
    'Cooking (烹饪)',
    'Cleaning (清洁)',
    'Leadership (领导力)',
    'Language (语言)',
    'Punctuality (守时)'
];

export const SPECIALTY_OPTS = [
    'Driving License (驾照)',
    'First Aid (急救)',
    'Food Handling Cert (食品安全)',
    'Halal Knowledge (清真知识)',
    'Inventory Management (库存管理)',
    'POS System (收银系统)'
];

export const DEFAULT_BENEFIT_OPTIONS = [
    { id: 'UNIFORM', label: 'Uniform (制服)' },
    { id: 'BASIC', label: 'Basic Salary (底薪)' },
    { id: 'APP', label: 'App Access (系统权限)' },
    { id: 'TRAINING', label: 'Training (培训)' },
    { id: 'EPF', label: 'EPF & SOCSO (公积金)' },
    { id: 'LEAVE', label: 'Annual/MC Leave (年假病假)' },
    { id: 'ATTENDANCE', label: 'Attendance (全勤)' },
    { id: 'MEAL', label: 'Staff Meal (员工餐)' },
    { id: 'HOSTEL', label: 'Hostel (宿舍)' },
    { id: 'EXCLUSIVE', label: 'Senior Exclusive (资深专属)' }
];

export const SALARY_TABLE: Record<string, any> = {};

export const ALLOWANCE_RULES: Record<AllowanceKey, number> = {
    'ATTENDANCE': 100, 
    'MEAL': 200,
    'HOSTEL': 300,
    'OTHER': 0
};
