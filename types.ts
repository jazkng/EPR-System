export enum UserRole {
  BOSS = 'BOSS',
  MANAGEMENT = 'MANAGEMENT',
  STAFF = 'STAFF'
}

export type StaffRole = string;

// NEW: Org Rank Definition
export type EmployeeRank = 'TOP' | 'MANAGEMENT' | 'HEAD' | 'PIC' | 'CREW';

export interface PayrollRecordDetail {
    employeeId: string;
    employeeName: string;
    basicSalary: number;
    allowance: number;
    penalty: number;
    advanceLoan: number;
    ee_epf: number;
    ee_socso: number;
    ee_eis?: number;
    ee_pcb?: number;
    er_epf: number;
    er_socso: number;
    er_eis: number;
    netPay: number;
    totalCost: number;
    note?: string;
    paymentMethod?: 'BANK' | 'CASH' | 'CHEQUE';
    proRateMode?: '26_DAYS' | 'CALENDAR_DAYS' | 'WORKABLE_DAYS';
    workDays?: number;
}

export interface PayrollRecord {
    id: string;
    month: string;
    totalAmount: number;
    totalNetPay: number;
    totalGovtPay: number;
    staffCount: number;
    status: 'POSTED' | 'DRAFT';
    isStatutoryPaid?: boolean;
    details: PayrollRecordDetail[];
}

export interface AttendanceRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    date: string;
    clockIn: string;
    clockOut: string;
    durationMinutes: number;
    status: 'PRESENT' | 'LATE' | 'COMPLETED' | 'ABSENT' | 'COMPLETED_LATE';
    notes?: string;
}

export type AppModule = 
    | 'SETTLEMENT' 
    | 'ROSTER' 
    | 'ROSTER_KITCHEN' 
    | 'ROSTER_FLOOR' 
    | 'LOGBOOK' 
    | 'SOP_INSPECT' 
    | 'INVENTORY_KITCHEN' 
    | 'INVENTORY_BAR' 
    | 'INVENTORY_GENERAL' 
    | 'INVENTORY_FUEL'
    | 'INVENTORY_CHECK'
    | 'INVENTORY_VIEW'
    | 'SUPPLIER_CONTACTS' 
    | 'QUEUE_MANAGER' 
    | 'ATTENDANCE_CONSOLE' 
    | 'PROCUREMENT' 
    | 'MENU_MANAGEMENT'
    | 'REPORTS'
    | 'HR_FILES'
    | 'QUEUE'
    | 'AP'
    | 'TREASURY'
    | 'BILLS'
    | 'SOP'
    | 'WARRANTY'
    | 'DAILY_ALERT'
    | 'ASSESSMENT';

export type RosterStatus = 'WORK' | 'OFF' | 'LEAVE' | 'MC' | 'ANNUAL' | 'ABSENT' | 'PENDING';

export type LogCategory = 'VIP' | 'COMPLAINT' | 'REPAIR' | 'OTHER';
export type LogPriority = 'NORMAL' | 'HIGH';

export type QueueSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type QueueStatus = 'WAITING' | 'CALLING' | 'SEATED' | 'CANCELLED';

export type RecurringBillCategory = 'RENT' | 'ELECTRICITY' | 'WATER' | 'INTERNET' | 'WASTE' | 'LICENSE' | 'SUBSCRIPTION' | 'OTHER';
export type RecurringBillType = 'MONTHLY' | 'YEARLY';

export type AllowanceKey = 'ATTENDANCE' | 'MEAL' | 'HOSTEL' | 'OTHER';

export interface EmployeeAttributes {
    efficiency: number;
    service: number;
    culinary: number;
    leadership: number;
    discipline: number;
}

// NEW: Record of who rated whom
export interface AssessmentRecord {
    raterId: string;
    raterName: string;
    raterRole: 'OWNER' | 'STAFF'; // For weighted calculation
    date: string;
    scores: EmployeeAttributes;
}

export interface WarningRecord {
    id: string;
    date: string;
    type: 'VERBAL' | 'WRITTEN' | 'FINAL'; // Mapped: Verbal (Record), Written (Yellow), Final (Red)
    reason: string;
    issuer: string;
    fineAmount?: number; // Added fine support
}

export interface SalaryRecord {
    date: string;
    amount: number;
    adjustment: number;
    percentage: number;
    reason: string;
}

export interface ReviewRecord {
    id: string;
    date: string;
    author: string;
    content: string;
    type: 'PRAISE' | 'CRITICISM' | 'NOTE';
    image?: string;
}

export interface CustomAllowance {
    id: string;
    amount: number;
    isActive: boolean;
}

// Ensure RoleGuide and SOP types are available
export interface RoleGuide {
    description: string;
    coreValue: string;
    safetyRedLine: string;
    duties: string[];
    troubleshooting: { issue: string; solution: string }[];
    salaryRange: { min: number; max: number };
    employeeRules: string[];
    specialIncentive: string;
    enabledAllowances: AllowanceKey[];
    probationExpectation: string;
    confirmedExpectation: string;
}

export interface SOPItem {
    id: string;
    label: string;
    completed: boolean;
    standard?: string;
    why?: string;
    isSystemTask?: boolean;
}

// NEW: Tracking stats for auto-calculation
export interface MisconductStats {
    smallCount: number;  // 5 triggers Yellow
    mediumCount: number; // 3 triggers Yellow
    yellowCount: number; // 3 triggers Red
}

export interface LoanRecord {
    id: string;
    date: string;
    type: 'BORROW' | 'REPAY';
    amount: number;
    note: string;
    via?: string; // e.g. 'CASH', 'BANK', 'SALARY_DEDUCT'
}

export interface Employee {
    id: string;
    name: string;
    role: string;
    pin?: string;
    status: 'CONFIRMED' | 'PROBATION' | 'TERMINATED';
    rank?: EmployeeRank; 
    level: string; 
    basicSalary: number;
    salaryMode?: 'MONTHLY' | 'DAILY' | 'HOURLY';
    phone: string;
    icNumber?: string; 
    joinDate: string;
    absentDays: number;
    gender: 'Male' | 'Female';
    nationality: string;
    age?: number;
    email?: string;
    address?: string;
    avatar?: string;
    allowedModules?: AppModule[];
    moduleProficiency?: Record<string, number>;
    salaryHistory?: SalaryRecord[];
    warningHistory?: WarningRecord[];
    reviews?: ReviewRecord[];
    monthlyRestDays?: number;
    hasHostel?: boolean;
    isArchived?: boolean;
    terminationReason?: string;
    terminationDate?: string;
    bankName?: string;
    bankAccount?: string;
    epfNo?: string;
    socsoNo?: string;
    emergencyName?: string;
    emergencyPhone?: string;
    typhoidExpiry?: string;
    foodHandlingDate?: string;
    dateOfBirth?: string;
    passportNo?: string;
    workPermitNo?: string;
    workPermitExpiry?: string;
    eisNo?: string;
    probationEndDate?: string;
    contractEndDate?: string;
    attributes?: EmployeeAttributes;
    assessmentHistory?: AssessmentRecord[]; 
    assessmentYearlyLimit?: number; 
    assessmentTargets?: string[]; 
    shirtSize?: string;
    height?: number;
    weight?: number;
    isQualityStaff?: boolean;
    hasEPF?: boolean;
    customAllowances?: CustomAllowance[];
    customGuide?: RoleGuide; 
    customSop?: { start: { title: string, tasks: SOPItem[] }, end: { title: string, tasks: SOPItem[] } };
    misconductStats?: MisconductStats;
    loanRecords?: LoanRecord[];
    terminationType?: 'RESIGNED' | 'FIRED' | 'CONTRACT_END' | 'ABSCONDED';
    noticeDate?: string;
    settlementStatus?: 'PENDING' | 'SETTLED';
}

export interface StoreConfig {
    businessDayCutoff: number;
    timeZoneOffset: number;
    googleScriptUrl?: string;
    cloudinaryCloudName?: string;
    cloudinaryUploadPreset?: string;
    googleDriveUrl?: string;
}

export interface SystemBackup {
    id?: string;
    version: string;
    timestamp: string;
    autoGenerated?: boolean;
    data: any;
}

export interface Shareholder {
    id: string;
    name: string;
    investmentAmount: number;
    equityPercentage: number;
    role?: string;
}

export interface TreasuryConfig {
    initialDate: string;
    initialCash: number;
    initialBank: number;
    shareholders: Shareholder[];
}

export interface FundTransfer {
    id: string;
    date: string;
    amount: number;
    fromAccount: 'CASH' | 'BANK' | 'SHAREHOLDER' | 'OTHER';
    toAccount: 'CASH' | 'BANK';
    type: 'DEPOSIT' | 'WITHDRAWAL';
    note?: string;
}

export interface ExpenseItem {
    id: string;
    category: string;
    expenseType: 'CASH_OUT' | 'GENERAL' | 'RECURRING' | 'SALARY';
    company: string;
    amount: number;
    paymentStatus: 'PAID' | 'UNPAID' | 'PARTIAL';
    paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'DUITNOW';
    time: string;
    note?: string;
    paidBy?: 'COMPANY' | 'SHOP_CASH' | string;
    isAdvancePayment?: boolean;
    totalBillAmount?: number;
    outstandingAmount?: number;
    creditNote?: number;
    dueDate?: string;
    linkUrl?: string;
    tags?: string[];
    settlementId?: string;
    paymentDate?: string;
}

export interface SettlementRecord {
    id: string;
    date: string;
    timestamp: string;
    openingCash: number;
    closingCash: number;
    sales: {
        total: number;
        storeHubTotal: number;
        refundTotal?: number;
        cash: number;
        tng: number;
        duitnow: number;
        card: number;
        deliveryBreakdown: {
            grab: number;
            panda: number;
            shopee: number;
            lalamove: number;
        };
    };
    expenses: ExpenseItem[];
    variance: number;
    varianceReason?: string;
    submittedBy: string;
    isClosed: boolean;
}

export interface RecurringBill {
    id: string;
    name: string;
    amount: number;
    type: RecurringBillType;
    dueDay: number;
    dueMonth?: number;
    category: RecurringBillCategory;
    isActive: boolean;
    lastPaidDate?: string;
    reminderDays: number;
    isArchived: boolean;
    accountNumber?: string;
    payableTo?: string;
    paymentLink?: string;
    contractStart?: string;
    contractEnd?: string;
    depositAmount?: number;
    softLimit?: number;
    hardLimit?: number;
}

export interface BillPaymentRecord {
    id: string;
    billId: string;
    name: string;
    amount: number;
    date: string;
    category: RecurringBillCategory;
    method: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'DUITNOW';
    referenceNo?: string;
    usage?: number;
    usageUnit?: string;
    linkUrl?: string;
}

export interface UomOption {
    label: string;
    value: string;
    ratio: number;
    price?: number;
}

export interface StockItem {
    id: string;
    name: string;
    category: string;
    unit: string;
    maxQty: number;
    minLevel: number;
    currentQty: number;
    cost: number;
    isKeyItem: boolean;
    uomOptions?: UomOption[];
    weightPerUnit?: number;
    conversionUnit?: string;
}

export interface InventoryLogItem {
    stockId: string;
    stockName: string;
    oldQty: number;
    newQty: number;
    diff: number;
    unit: string;
    cost: number;
    valueChange: number;
}

export interface InventoryLog {
    id: string;
    date: string;
    timestamp: string;
    staffName: string;
    totalValueChange: number;
    items: InventoryLogItem[];
    category: string;
}

export interface InventoryTaskItem {
    stockId: string;
    stockName: string;
    category: string;
    currentQty: number;
    countedQty?: number;
}

export interface InventoryTask {
    id: string;
    createdAt: string;
    creatorId: string;
    creatorName: string;
    assigneeId: string;
    assigneeName: string;
    status: 'PENDING' | 'COMPLETED';
    items: InventoryTaskItem[];
    completedAt?: string;
}

export interface CatalogItem {
    id: string;
    name: string;
    unit: string;
    price: number;
    category: string;
    uomOptions: UomOption[];
    linkedStockId?: string;
    supplierCode?: string;
}

export interface Supplier {
    id: string;
    name: string;
    category: string;
    tags: string[];
    contact: string;
    contactPerson?: string;
    email?: string;
    note?: string;
    paymentTerm: string;
    status: 'ACTIVE' | 'INACTIVE';
    address?: string;
    catalog?: CatalogItem[];
    bankAccount?: string;
    ssmNumber?: string;
    sstNumber?: string;
    deliverySchedule?: string;
    minOrderValue?: number;
    website?: string;
    isFavorite?: boolean; 
    restDayNote?: string; 
}

export interface PurchaseOrderItem {
    stockId: string;
    name: string;
    orderQty: number;
    unit: string;
    ratio: number;
    cost: number;
    supplierCode?: string;
}

export interface PurchaseOrder {
    id: string;
    supplierId: string;
    supplierName: string;
    date: string;
    status: 'ORDERED' | 'RECEIVED' | 'CANCELLED';
    items: PurchaseOrderItem[];
    totalEstimated: number;
    createdBy?: string;
}

export interface MenuIngredient {
    stockId: string;
    stockName: string;
    qty: number;
    unit: string;
    costPerUnit: number;
}

export interface MenuVariant {
    label: string;
    price: number;
    cost: number;
    recipe?: MenuIngredient[];
}

export interface MenuItem {
    id: string;
    name: string;
    category: string;
    variants: MenuVariant[];
    options: string[];
    image?: string;
}

export interface MenuCategory {
    id: string;
    label: string;
}

export interface QueueTicket {
    id: string;
    number: string;
    sizeCategory: QueueSize;
    pax: number;
    status: QueueStatus;
    createdAt: string;
    calledAt?: string;
    phone?: string;
}

export interface RoleDefinition {
    id: string;
    title: string;
    department: 'MANAGEMENT' | 'FOH' | 'BOH';
    rankCategory: 'MANAGEMENT' | 'MID_LEVEL' | 'ENTRY_LEVEL';
    duties: string[];
    allowedModules: AppModule[];
}

// NEW: Misconduct Data on Log
export interface MisconductRecord {
    employeeId: string;
    employeeName: string;
    type: 'SMALL' | 'MEDIUM' | 'BIG';
    fineAmount?: number;
    actionResult?: string; // e.g., "Triggered Yellow Warning"
}

export interface LogEntry {
    id: string;
    date: string;
    time: string;
    issue: string;
    action: string;
    category: LogCategory;
    priority: LogPriority;
    status: 'PENDING' | 'RESOLVED';
    creatorName: string;
    image?: string;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
    misconduct?: MisconductRecord; // NEW FIELD
}

export interface WarrantyRecord {
    id: string;
    productName: string;
    purchaseDate: string;
    expiryDate: string;
    linkUrl?: string;
    notes?: string;
}

export interface ProposalComment {
    id: string;
    author: string;
    text: string;
    date: string;
}

export interface Proposal {
    id: string;
    title: string;
    description: string;
    type: 'EXPANSION' | 'POLICY' | 'MARKETING' | 'MENU';
    budget: number;
    createdBy: string;
    createdAt: string;
    deadline: string;
    status: 'VOTING' | 'APPROVED' | 'REJECTED';
    votes: { approvals: string[], rejections: string[] };
    comments: ProposalComment[];
}

export interface OKRKeyResult {
    label: string;
    target: number;
    current: number;
    unit: string;
}

export interface OKR {
    id: string;
    quarter: string;
    objective: string;
    progress: number;
    status: 'ON_TRACK' | 'AT_RISK' | 'BEHIND';
    keyResults: OKRKeyResult[];
}

export interface MarketingCampaign {
    id: string;
    name: string;
    platform: 'FACEBOOK' | 'TIKTOK' | 'XIAOHONGSHU' | 'OFFLINE';
    status: 'ACTIVE' | 'PLANNED' | 'ENDED';
    budget: number;
    spend: number;
    roi: number;
    startDate: string;
    endDate: string;
}

export interface EventChecklistItem {
    id: string;
    label: string;
    done: boolean;
}

export interface StoreEvent {
    id: string;
    name: string;
    date: string;
    type: 'PROMO' | 'HOLIDAY' | 'TEAM_BUILDING';
    status: 'UPCOMING' | 'COMPLETED';
    checklist?: EventChecklistItem[];
}