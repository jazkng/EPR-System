import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Trophy, Star, Search, X, Save, Award, 
    BarChart2, Medal, User, Filter, Zap, 
    CheckCircle2, TrendingUp, AlertCircle,
    Users, ChevronRight, ShieldCheck, Lock,
    PieChart, Info, RotateCcw, MoreHorizontal, History, Settings, Trash2, Calendar, AlertTriangle, Loader2, Coffee, Wrench, ChefHat, Flame, Heart, DollarSign, BrainCircuit, Timer, Ban, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, PenTool, BookOpen, HelpCircle
} from 'lucide-react';
import { Employee, EmployeeAttributes, EmployeeRank, AssessmentRecord } from '../../types';
import { DataManager } from '../../utils/dataManager';

interface EmployeeAssessmentModuleProps {
    onClose: () => void;
    currentEmployee?: Employee | null;
}

// --- QUOTA CONFIGURATION ---
const QUOTA_CONFIG = {
    S: 5,  // Max S grades allowed per rater per month
    A: 10, // Max A grades allowed
    B: 15, // Max B grades allowed
    C_MIN: 5 // Recommended Min C grades
};

// --- CONSTANTS & HELPERS ---
const RANK_VALUE: Record<string, number> = {
    'TOP': 10,
    'MANAGEMENT': 8,
    'HEAD': 6,
    'PIC': 4,
    'CREW': 2,
    'PENDING': 0
};

const getRankValue = (rank?: EmployeeRank) => RANK_VALUE[rank || 'CREW'] || 0;

const getDepartment = (role: string): 'KITCHEN' | 'FLOOR' | 'MANAGEMENT' => {
    const r = role.toUpperCase();
    if (r.includes('OWNER') || r.includes('老板')) return 'MANAGEMENT';
    if (r.includes('MANAGER') || r.includes('经理') || r.includes('ADMIN')) return 'MANAGEMENT';
    
    // Kitchen Roles
    if (['CHEF', 'COOK', 'CUTTER', 'HELPER', 'DISH', 'BAR', 'FRYER', 'COMMIS', 'RUNNER', 'APPRENTICE', '头手', '帮锅', '厨', '占板', '马王', '打荷', '水吧', '洗碗'].some(k => r.includes(k))) return 'KITCHEN';
    
    // Floor Roles
    return 'FLOOR'; 
};

// Base Tiers for UI Colors and Icons
// UPDATED: S=100, A=60, B=40, C=20, D=0
// Added 'guide' property for detailed explanation
const ABILITY_TIERS = [
    { 
        label: 'S', baseScore: 100, desc: '完美榜样 (Model)', color: 'bg-purple-100 text-purple-700 border-purple-200 ring-purple-500', icon: CrownIcon,
        guide: '【完美榜样】无可挑剔，具备卓越的领导力或专业技能，完全值得信赖，是全员的标杆。'
    },
    { 
        label: 'A', baseScore: 60, desc: '优秀骨干 (Excellent)', color: 'bg-green-100 text-green-700 border-green-200 ring-green-500', icon: Star,
        guide: '【优秀骨干】表现超出预期，工作效率高，不仅完成本职还能主动帮助他人，极少出错。'
    },
    { 
        label: 'B', baseScore: 40, desc: '称职员工 (Good)', color: 'bg-blue-100 text-blue-700 border-blue-200 ring-blue-500', icon: CheckCircle2,
        guide: '【称职员工】能够独立完成本职工作，遵守SOP。表现中规中矩，无功无过，是合格的执行者。'
    },
    { 
        label: 'C', baseScore: 20, desc: '需要改进 (Average)', color: 'bg-orange-100 text-orange-700 border-orange-200 ring-orange-500', icon: AlertCircle,
        guide: '【需要改进】勉强达到最低标准，被动工作。虽然没有大错，但缺乏责任心，效率较低，需要提醒。'
    },
    { 
        label: 'D', baseScore: 0, desc: '严重不足 (Poor)', color: 'bg-red-100 text-red-700 border-red-200 ring-red-500', icon: X,
        guide: '【严重不足】无法完成基本工作，经常出错，态度消极，需要时刻监督。如果不改进，将无法胜任该岗位。'
    },
];

const ATTRIBUTE_CONFIG: Record<string, { label: string; desc: string }> = {
    efficiency: { label: '工作效率 (Efficiency)', desc: '出餐/服务速度，动作麻利程度' },
    service: { label: '服务态度 (Service)', desc: '对待客人的礼貌、微笑与耐心' },
    culinary: { label: '岗位技能 (Skill)', desc: '烹饪火候 / 摆盘 / 清洁标准' },
    leadership: { label: '团队配合 (Teamwork)', desc: '与同事沟通协作，不计较，服从安排' },
    discipline: { label: '纪律考勤 (Discipline)', desc: '不迟到早退，遵守公司 S.O.P' }
};

interface BehaviorTag {
    label: string;
    score: number; // Always positive now (+5)
}

// --- BEHAVIOR CHECKLISTS ---
const BEHAVIOR_CHECKLISTS: Record<string, Record<string, Record<number, BehaviorTag[]>>> = {
    // 1. DISCIPLINE (纪律)
    discipline: {
        'ALL': {
            60: [ // A (60 -> 75): Role Model
                { label: '全勤无休 (Full Attendance)', score: 5 },
                { label: '从不看手机 (No Phone)', score: 5 },
                { label: '主动加班/代班 (Volunteer)', score: 5 }
            ],
            40: [ // B (40 -> 55): Standard
                { label: '准时打卡 (On Time)', score: 5 },
                { label: '制服整洁 (Uniform Tidy)', score: 5 },
                { label: '严格遵守 SOP', score: 5 }
            ],
            20: [ // C (20 -> 35): Minimal
                { label: '偶尔迟到有报备', score: 5 },
                { label: '工作时不抽烟', score: 5 },
                { label: '被提醒后能改正', score: 5 }
            ],
            0: [ // D (0 -> 15): Fail but trying
                { label: '承认错误 (Admits Fault)', score: 5 },
                { label: '愿意补救 (Remedies)', score: 5 },
                { label: '接受警告 (Accepts Warning)', score: 5 }
            ]
        }
    },
    // 2. EFFICIENCY (效率)
    efficiency: {
        'KITCHEN': {
            60: [{label:'一人顶两 (One Man Army)', score:5}, {label:'预判单量 (Anticipates)', score:5}, {label:'极速出餐 (Super Fast)', score:5}],
            40: [{label:'速度达标 (Standard Speed)', score:5}, {label:'不积压单 (No Backlog)', score:5}, {label:'收档迅速 (Fast Closing)', score:5}],
            20: [{label:'肯帮忙 (Willing to Help)', score:5}, {label:'听从催单 (Responds)', score:5}, {label:'不偷懒 (Not Lazy)', score:5}],
            0: [{label:'在尝试学习 (Trying)', score:5}, {label:'能做简单活 (Basic Tasks)', score:5}, {label:'态度端正 (Good Attitude)', score:5}]
        },
        'FLOOR': {
            60: [{label:'极速翻台 (Fast Turnover)', score:5}, {label:'全场游走 (Full Coverage)', score:5}, {label:'补位及时 (Fills Gaps)', score:5}],
            40: [{label:'勤快跑动 (Active)', score:5}, {label:'不躲避 (No Hiding)', score:5}, {label:'声音洪亮 (Loud Voice)', score:5}],
            20: [{label:'叫得动 (Responsive)', score:5}, {label:'肯收碗 (Clears Tables)', score:5}, {label:'不发脾气 (No Temper)', score:5}],
            0: [{label:'人在现场 (Present)', score:5}, {label:'帮忙传菜 (Runs Food)', score:5}, {label:'不玩手机 (No Phone)', score:5}]
        }
    },
    // 3. SERVICE (服务)
    service: {
        'ALL': {
            60: [{label:'顾客点名表扬 (Praised)', score:5}, {label:'全程微笑 (Full Smile)', score:5}, {label:'记住熟客 (Knows Regulars)', score:5}],
            40: [{label:'礼貌待客 (Polite)', score:5}, {label:'有问必答 (Answers Qs)', score:5}, {label:'主动加水 (Auto Refill)', score:5}],
            20: [{label:'无功无过 (Standard)', score:5}, {label:'没被投诉 (No Complaint)', score:5}, {label:'表情自然 (Normal Face)', score:5}],
            0: [{label:'没吵架 (No Fight)', score:5}, {label:'情绪稳定 (Stable)', score:5}, {label:'尝试沟通 (Tries)', score:5}]
        }
    },
    // 4. SKILL/CULINARY (技能)
    culinary: {
         'KITCHEN': {
            60: [{label:'出品完美 (Perfect Dish)', score:5}, {label:'零退菜 (Zero Returns)', score:5}, {label:'解决疑难 (Prob Solver)', score:5}],
            40: [{label:'味道稳定 (Consistent)', score:5}, {label:'份量准确 (Right Portion)', score:5}, {label:'很少出错 (Rare Errors)', score:5}],
            20: [{label:'能独立完成 (Independent)', score:5}, {label:'味道尚可 (Edible)', score:5}, {label:'卖相及格 (Looks OK)', score:5}],
            0: [{label:'肯学 (Willing to Learn)', score:5}, {label:'听话 (Obedient)', score:5}, {label:'备料没问题 (Prep OK)', score:5}]
        },
        'FLOOR': { // Product Knowledge for Floor
            60: [{label:'推销高手 (Upsell King)', score:5}, {label:'解决客诉 (Fixes Issues)', score:5}, {label:'极少漏单 (No Misses)', score:5}],
            40: [{label:'熟悉菜单 (Knows Menu)', score:5}, {label:'下单准确 (Accurate)', score:5}, {label:'会用POS (POS Skill)', score:5}],
            20: [{label:'能基本介绍 (Basic Info)', score:5}, {label:'字迹工整 (Readable)', score:5}, {label:'算对钱 (Calc OK)', score:5}],
            0: [{label:'正在记菜单 (Learning)', score:5}, {label:'会端盘子 (Can Carry)', score:5}, {label:'不摔破 (No Breakage)', score:5}]
        }
    },
    // 5. LEADERSHIP (配合)
    leadership: {
         'ALL': {
            60: [{label:'核心骨干 (Core Pillar)', score:5}, {label:'教导新人 (Teaches)', score:5}, {label:'解决冲突 (Peacemaker)', score:5}],
            40: [{label:'团队融合 (Team Player)', score:5}, {label:'不计较 (Easygoing)', score:5}, {label:'互相帮忙 (Helpful)', score:5}],
            20: [{label:'服从安排 (Obedient)', score:5}, {label:'不搞小团体 (No Cliques)', score:5}, {label:'沟通顺畅 (Talks)', score:5}],
            0: [{label:'不惹事 (No Trouble)', score:5}, {label:'安分守己 (Quiet)', score:5}, {label:'出席会议 (Attends)', score:5}]
        }
    }
};

// Helper to get checks
const getChecklist = (attr: string, dept: string, baseScore: number): BehaviorTag[] => {
    if (BEHAVIOR_CHECKLISTS[attr]?.[dept]?.[baseScore]) return BEHAVIOR_CHECKLISTS[attr][dept][baseScore];
    if (BEHAVIOR_CHECKLISTS[attr]?.['ALL']?.[baseScore]) return BEHAVIOR_CHECKLISTS[attr]['ALL'][baseScore];
    return [
        { label: '表现尚可 (+5)', score: 5 },
        { label: '有些亮点 (+5)', score: 5 },
        { label: '值得鼓励 (+5)', score: 5 }
    ];
};

const getKPIConfig = (dept: 'KITCHEN' | 'FLOOR' | 'MANAGEMENT'): Record<string, { label: string; desc: string; icon: any }> => {
    const COMMON_METRICS = {
        discipline: { label: '纪律考勤 (Discipline)', desc: '准时打卡，着装规范，严守S.O.P', icon: ClockIcon },
        leadership: { label: '团队协作 (Teamwork)', desc: '不计较，互相补位，沟通顺畅', icon: Users },
        efficiency: { label: '执行效率 (Execution)', desc: '服从上级安排，动作麻利，不拖延', icon: Zap },
    };

    if (dept === 'KITCHEN') {
        return {
            ...COMMON_METRICS,
            culinary: { label: '出品稳定性 (Consistency)', desc: '味道/份量/摆盘标准统一，无退菜', icon: Flame },
            service: { label: '卫生与损耗 (Hygiene & Waste)', desc: '冰箱整洁，无浪费食材，收档干净', icon: Trash2 }
        };
    } 
    
    if (dept === 'FLOOR') {
        return {
            ...COMMON_METRICS,
            culinary: { label: '服务待客 (Hospitality)', desc: '微笑问候，耐心解答，顾客满意', icon: Heart },
            service: { label: '销售技巧 (Upselling)', desc: '主动推销招牌菜/饮料，提升客单价', icon: DollarSign }
        };
    }

    return {
        ...COMMON_METRICS,
        culinary: { label: '专业技能 (Pro Skill)', desc: '岗位专业知识掌握程度', icon: BrainCircuit },
        service: { label: '服务意识 (Service)', desc: '对待内外部客户的态度', icon: Heart }
    };
};

function CrownIcon(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-3-4 3-6-7zm5 16h10v2H7z"/></svg>;
}

function ClockIcon(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}

const getAverageScore = (attrs?: EmployeeAttributes) => {
    if (!attrs) return 0;
    const values = Object.values(attrs) as number[];
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round(sum / values.length);
};

const getTierFromScore = (score: number) => {
    if (score >= 80) return ABILITY_TIERS[0]; // S (80-100)
    if (score >= 60) return ABILITY_TIERS[1]; // A (60-79)
    if (score >= 40) return ABILITY_TIERS[2]; // B (40-59)
    if (score >= 20) return ABILITY_TIERS[3]; // C (20-39)
    return ABILITY_TIERS[4]; // D (0-19)
};

const calculateWeightedAttributes = (history: AssessmentRecord[]): { final: EmployeeAttributes, ownerAvg: number, staffAvg: number, ownerCount: number } => {
    if (!history || history.length === 0) {
        return { 
            final: { efficiency: 0, service: 0, culinary: 0, leadership: 0, discipline: 0 }, 
            ownerAvg: 0, staffAvg: 0, ownerCount: 0 
        };
    }

    const ownerAssessments = history.filter(h => h.raterRole === 'OWNER');
    const staffAssessments = history.filter(h => h.raterRole === 'STAFF');

    const calculateGroupAverage = (assessments: AssessmentRecord[]): EmployeeAttributes => {
        if (assessments.length === 0) return { efficiency: 0, service: 0, culinary: 0, leadership: 0, discipline: 0 };
        const sumAttr: EmployeeAttributes = { efficiency: 0, service: 0, culinary: 0, leadership: 0, discipline: 0 };
        assessments.forEach(rec => {
            sumAttr.efficiency += rec.scores.efficiency;
            sumAttr.service += rec.scores.service;
            sumAttr.culinary += rec.scores.culinary;
            sumAttr.leadership += rec.scores.leadership;
            sumAttr.discipline += rec.scores.discipline;
        });
        return {
            efficiency: sumAttr.efficiency / assessments.length,
            service: sumAttr.service / assessments.length,
            culinary: sumAttr.culinary / assessments.length,
            leadership: sumAttr.leadership / assessments.length,
            discipline: sumAttr.discipline / assessments.length
        };
    };

    const ownerAttrs = calculateGroupAverage(ownerAssessments);
    const staffAttrs = calculateGroupAverage(staffAssessments);
    const ownerCount = ownerAssessments.length;
    const staffCount = staffAssessments.length;
    const finalAttrs: EmployeeAttributes = { efficiency: 0, service: 0, culinary: 0, leadership: 0, discipline: 0 };
    
    (Object.keys(finalAttrs) as Array<keyof EmployeeAttributes>).forEach(key => {
        if (ownerCount > 0 && staffCount > 0) {
            finalAttrs[key] = Math.round((ownerAttrs[key] * 0.6) + (staffAttrs[key] * 0.4));
        } else if (ownerCount > 0) {
            finalAttrs[key] = Math.round(ownerAttrs[key]);
        } else {
            finalAttrs[key] = Math.round(staffAttrs[key]);
        }
    });

    return {
        final: finalAttrs,
        ownerAvg: getAverageScore(ownerAttrs),
        staffAvg: getAverageScore(staffAttrs),
        ownerCount
    };
};

// --- GUIDE MODAL (NEW) ---
const AssessmentGuideModal = ({ isOpen, onClose, usage, quota }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 relative border-4 border-[#FFD700]">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-[#1A1A1A] text-[#FFD700] rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-[#FFD700] shadow-lg">
                        <Award size={32}/>
                    </div>
                    <h2 className="text-2xl font-black text-[#1A1A1A] mb-2">评分规则说明</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Assessment Rules & Guidelines</p>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm font-bold text-gray-600 leading-relaxed">
                        <p className="mb-2">为确保评测公正，我们采用<span className="text-[#FFD700] bg-black px-1 rounded mx-1">强制分布法</span>。您在每一轮评测中，针对所有员工的所有能力项，有以下数量限制：</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-purple-50 border-purple-100 border rounded-xl flex justify-between items-center">
                            <div><span className="text-purple-700 font-black">S (完美)</span><p className="text-[9px] text-purple-400">Model</p></div>
                            <div className="text-right"><span className="text-lg font-black text-purple-800">{usage.S} / {quota.S}</span><p className="text-[8px] text-purple-400">已用/上限</p></div>
                        </div>
                        <div className="p-3 bg-green-50 border-green-100 border rounded-xl flex justify-between items-center">
                            <div><span className="text-green-700 font-black">A (优秀)</span><p className="text-[9px] text-green-400">Excellent</p></div>
                            <div className="text-right"><span className="text-lg font-black text-green-800">{usage.A} / {quota.A}</span><p className="text-[8px] text-green-400">已用/上限</p></div>
                        </div>
                        <div className="p-3 bg-blue-50 border-blue-100 border rounded-xl flex justify-between items-center">
                            <div><span className="text-blue-700 font-black">B (普通)</span><p className="text-[9px] text-blue-400">Good</p></div>
                            <div className="text-right"><span className="text-lg font-black text-blue-800">{usage.B} / {quota.B}</span><p className="text-[8px] text-blue-400">已用/上限</p></div>
                        </div>
                        <div className="p-3 bg-orange-50 border-orange-100 border rounded-xl flex justify-between items-center">
                            <div><span className="text-orange-700 font-black">C (改进)</span><p className="text-[9px] text-orange-400">Average</p></div>
                            <div className="text-right"><span className="text-lg font-black text-orange-800">{usage.C}</span><p className="text-[8px] text-orange-400">建议至少 {quota.C_MIN} 个</p></div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold bg-gray-50 p-2 rounded-lg justify-center">
                         <Info size={12}/> 请勿随意打分，系统会拦截超额评分。
                    </div>
                </div>

                <button onClick={onClose} className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-2xl font-black text-lg shadow-lg hover:bg-black transition-transform active:scale-95">
                    我明白了 (I Understand)
                </button>
            </div>
        </div>
    );
};

export const EmployeeAssessmentModule: React.FC<EmployeeAssessmentModuleProps> = ({ onClose, currentEmployee }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'KITCHEN' | 'BAR' | 'FLOOR' | 'GENERAL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [editAttributes, setEditAttributes] = useState<EmployeeAttributes | null>(null);
    const [performanceInsights, setPerformanceInsights] = useState<{ lateCount: number, absentCount: number, warningCount: number, tenureMonths: number } | null>(null);
    const [viewMode, setViewMode] = useState<'ASSESS' | 'HISTORY' | 'SETTINGS' | 'RESET_CONFIRM' | 'RESET_FINAL'>('ASSESS');
    const [menuOpen, setMenuOpen] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [tempLimit, setTempLimit] = useState(3);
    const [isResetting, setIsResetting] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    // UI State for mobile collapsible insights
    const [showInsights, setShowInsights] = useState(true);
    
    // NEW: State for selected behavior tags per attribute
    const [selectedTags, setSelectedTags] = useState<Record<string, string[]>>({});
    const [customNotes, setCustomNotes] = useState<Record<string, string>>({});

    // NEW: Guide Modal State
    const [showGuide, setShowGuide] = useState(true);

    const isOwner = currentEmployee?.role.includes('Owner') || currentEmployee?.role.includes('老板') || currentEmployee?.rank === 'TOP';
    const myRankValue = getRankValue(currentEmployee?.rank);
    const myDept = currentEmployee ? getDepartment(currentEmployee.role) : 'MANAGEMENT';
    const myRaterRole: 'OWNER' | 'STAFF' = isOwner ? 'OWNER' : 'STAFF';

    useEffect(() => {
        loadData();
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await DataManager.getEmployees();
        setEmployees(data.filter(e => !e.role.includes('Owner') && !e.isArchived));
        setLoading(false);
    };

    // --- QUOTA CALCULATION ---
    const quotaUsage = useMemo(() => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const usage = { S: 0, A: 0, B: 0, C: 0, D: 0 };
        
        employees.forEach(emp => {
            // Exclude the currently edited employee from the count to allow updating
            if (selectedEmp && emp.id === selectedEmp.id) return;

            const myRating = emp.assessmentHistory?.find(h => h.raterId === currentEmployee?.id && h.date.startsWith(currentMonth));
            if (myRating) {
                Object.values(myRating.scores).forEach((score) => {
                    const grade = getTierFromScore(score as number).label;
                    if (grade === 'S') usage.S++;
                    else if (grade === 'A') usage.A++;
                    else if (grade === 'B') usage.B++;
                    else if (grade === 'C') usage.C++;
                    else usage.D++;
                });
            }
        });
        return usage;
    }, [employees, selectedEmp, currentEmployee]);

    // ... (Insight effect remains same) ...
    useEffect(() => {
        const fetchInsights = async () => {
            if (!selectedEmp) {
                setPerformanceInsights(null);
                return;
            }
            const today = new Date();
            const currentMonthStr = today.toISOString().slice(0, 7); 
            const attRecords = await DataManager.getAttendanceByMonth(currentMonthStr);
            const myAtt = attRecords.filter(r => r.employeeId === selectedEmp.id);
            const lateCount = myAtt.filter(r => r.status === 'LATE').length;
            const absentCount = myAtt.filter(r => r.status === 'ABSENT').length;
            const warningCount = selectedEmp.warningHistory?.length || 0;
            const joinDate = new Date(selectedEmp.joinDate);
            const diffTime = Math.abs(today.getTime() - joinDate.getTime());
            const tenureMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)); 
            setPerformanceInsights({ lateCount, absentCount, warningCount, tenureMonths });
        };
        fetchInsights();
    }, [selectedEmp]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(e => {
            // Rule 1: Cannot assess self
            if (e.id === currentEmployee?.id) return false;

            // Rule 2: If not Owner, restrict to allowed targets
            if (!isOwner) {
                const allowedTargets = currentEmployee?.assessmentTargets || [];
                if (!allowedTargets.includes(e.id)) return false;
            }

            const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.id.includes(searchTerm);
            let matchesFilter = true;
            const roleUpper = e.role.toUpperCase();

            if (filter === 'KITCHEN') {
                matchesFilter = ['CHEF', 'COOK', 'CUTTER', 'KITCHEN', 'HELPER', '头手', '厨房', '帮锅', '打荷', '马王', 'APPRENTICE', '学徒', 'COMMIS'].some(k => roleUpper.includes(k)) 
                                && !['BAR', '水吧', 'DISH', 'WASH', '洗碗', 'CLEANER', '清洁'].some(k => roleUpper.includes(k));
            }
            if (filter === 'BAR') {
                matchesFilter = ['BAR', '水吧'].some(k => roleUpper.includes(k));
            }
            if (filter === 'FLOOR') {
                matchesFilter = ['MANAGER', 'SUPERVISOR', 'CAPTAIN', 'WAITER', 'COUNTER', '楼面', '服务', '写单', '柜台', 'PART_TIME', '兼职', '经理', '主管'].some(k => roleUpper.includes(k));
            }
            if (filter === 'GENERAL') {
                matchesFilter = ['CLEANER', 'DISH', '清洁', '洗碗', 'DRIVER', '司机', '后勤'].some(k => roleUpper.includes(k));
            }

            return matchesSearch && matchesFilter;
        }).sort((a,b) => getAverageScore(b.attributes) - getAverageScore(a.attributes)); 
    }, [employees, searchTerm, filter, isOwner, currentEmployee]);

    const stats = useMemo(() => {
        let sCount = 0, aCount = 0, bCount = 0;
        filteredEmployees.forEach(e => {
            const score = getAverageScore(e.attributes);
            const grade = getTierFromScore(score);
            if (grade.label === 'S') sCount++;
            if (grade.label === 'A') aCount++;
            if (grade.label === 'B') bCount++;
        });
        return { sCount, aCount, bCount, total: filteredEmployees.length };
    }, [filteredEmployees]);

    const handleOpenAssess = (emp: Employee) => { 
        setSelectedEmp(emp); 
        const myPreviousRating = emp.assessmentHistory?.find(h => h.raterId === currentEmployee?.id); 
        if (myPreviousRating) { 
            setEditAttributes(myPreviousRating.scores); 
        } else { 
            setEditAttributes(emp.attributes || { efficiency: 0, service: 0, culinary: 0, leadership: 0, discipline: 0 }); 
        } 
        setSelectedTags({}); // Reset tags on open
        setCustomNotes({}); // Reset custom notes
        setViewMode('ASSESS'); 
        setMenuOpen(false); 
    };

    const handleSaveAssessment = async () => { 
        if (!selectedEmp || !editAttributes || !currentEmployee) return; 

        // --- QUOTA VALIDATION ---
        const newUsage = { S: 0, A: 0, B: 0, C: 0, D: 0 };
        Object.values(editAttributes).forEach((score) => {
            const grade = getTierFromScore(score as number).label;
            if (grade === 'S') newUsage.S++;
            else if (grade === 'A') newUsage.A++;
            else if (grade === 'B') newUsage.B++;
            else if (grade === 'C') newUsage.C++;
            else newUsage.D++;
        });

        // Check if adding this employee's grades exceeds the total allowed quota
        if ((quotaUsage.S + newUsage.S) > QUOTA_CONFIG.S) {
            return alert(`❌ S级名额已超标！\n您本月已给 ${quotaUsage.S} 个S，本次试图给 ${newUsage.S} 个S。\n剩余名额: ${QUOTA_CONFIG.S - quotaUsage.S}`);
        }
        if ((quotaUsage.A + newUsage.A) > QUOTA_CONFIG.A) {
            return alert(`❌ A级名额已超标！\n您本月已给 ${quotaUsage.A} 个A，本次试图给 ${newUsage.A} 个A。\n剩余名额: ${QUOTA_CONFIG.A - quotaUsage.A}`);
        }
        if ((quotaUsage.B + newUsage.B) > QUOTA_CONFIG.B) {
            return alert(`❌ B级名额已超标！\n您本月已给 ${quotaUsage.B} 个B，本次试图给 ${newUsage.B} 个B。\n剩余名额: ${QUOTA_CONFIG.B - quotaUsage.B}`);
        }

        // Saving logic
        const currentYear = new Date().getFullYear(); 
        const thisYearCount = (selectedEmp.assessmentHistory || []).filter(h => new Date(h.date).getFullYear() === currentYear).length; 
        const limit = selectedEmp.assessmentYearlyLimit || 3; 
        const isUpdate = (selectedEmp.assessmentHistory || []).some(h => h.raterId === currentEmployee.id); 
        
        if (!isUpdate && thisYearCount >= limit) { return alert(`❌ 评测次数已达上限 (${limit} 次/年)`); } 
        
        const newRecord: AssessmentRecord = { raterId: currentEmployee.id, raterName: currentEmployee.name, raterRole: myRaterRole, date: new Date().toISOString(), scores: editAttributes }; 
        const oldHistory = selectedEmp.assessmentHistory || []; 
        const newHistory = [ ...oldHistory.filter(h => h.raterId !== currentEmployee.id), newRecord ]; 
        const { final: weightedAttributes } = calculateWeightedAttributes(newHistory); 
        const updatedEmp = { ...selectedEmp, assessmentHistory: newHistory, attributes: weightedAttributes }; 
        
        await DataManager.saveEmployee(updatedEmp); 
        setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e)); 
        setSelectedEmp(null); 
        alert(`✅ ${updatedEmp.name} 的评测已提交！`); 
    };

    // ... (Existing handlers: verifyPassword, finalReset, updateLimit, etc. - unchanged) ...
    const handleVerifyPassword = () => { if (!selectedEmp) return; if (resetPassword !== '9394') { return alert("❌ 密码错误 (Wrong Password)"); } setViewMode('RESET_FINAL'); };
    const handleFinalReset = async () => { if (!selectedEmp) return; setIsResetting(true); try { const emptyAttrs = { efficiency: 0, service: 0, culinary: 0, leadership: 0, discipline: 0 }; const updatedEmp: Employee = { ...selectedEmp, assessmentHistory: [], attributes: undefined }; const safePayload = JSON.parse(JSON.stringify(updatedEmp)); await DataManager.saveEmployee(safePayload); setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e)); setSelectedEmp(updatedEmp); setEditAttributes(emptyAttrs); setViewMode('ASSESS'); setResetPassword(''); alert("✅ 评分已重置，状态变更为【未评测】"); } catch (error) { console.error("Reset Failed:", error); alert("❌ 重置失败，请检查网络 (Reset Failed)"); } finally { setIsResetting(false); } };
    const handleUpdateLimit = async () => { if (!selectedEmp) return; const updatedEmp = { ...selectedEmp, assessmentYearlyLimit: tempLimit }; await DataManager.saveEmployee(updatedEmp); setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e)); setSelectedEmp(updatedEmp); setViewMode('ASSESS'); alert(`✅ 频率限制已更新为 ${tempLimit} 次/年`); };

    const handleTierSelect = (key: string, baseScore: number) => {
        const newTags = { ...selectedTags };
        delete newTags[key];
        setSelectedTags(newTags);
        setEditAttributes(prev => prev ? ({ ...prev, [key]: calculateTotalScore(key, baseScore, [], customNotes[key]) }) : prev);
    };

    const toggleBehaviorTag = (key: string, tag: BehaviorTag, baseScore: number) => {
        const currentTags = selectedTags[key] || [];
        let newTags: string[] = [];
        if (currentTags.includes(tag.label)) { newTags = currentTags.filter(t => t !== tag.label); } 
        else { newTags = [...currentTags, tag.label]; }
        setSelectedTags({ ...selectedTags, [key]: newTags });
        const newScore = calculateTotalScore(key, baseScore, newTags, customNotes[key]);
        setEditAttributes(prev => prev ? ({ ...prev, [key]: newScore }) : prev);
    };

    const handleCustomNoteChange = (key: string, value: string, baseScore: number) => {
        const newNotes = { ...customNotes, [key]: value };
        setCustomNotes(newNotes);
        const currentTags = selectedTags[key] || [];
        const newScore = calculateTotalScore(key, baseScore, currentTags, value);
        setEditAttributes(prev => prev ? ({ ...prev, [key]: newScore }) : prev);
    };

    const calculateTotalScore = (key: string, base: number, tags: string[], note: string | undefined) => {
        const dept = selectedEmp ? getDepartment(selectedEmp.role) : 'MANAGEMENT';
        const checklist = getChecklist(key, dept, base);
        let totalOffset = 0;
        tags.forEach(tagName => { const tagDef = checklist.find(t => t.label === tagName); if (tagDef) totalOffset += tagDef.score; });
        if (note && note.trim().length > 0) { totalOffset += 4; }
        return Math.min(100, Math.max(0, base + totalOffset));
    };

    // ... (renderAttributeSlider - same as before) ...
    const renderAttributeSlider = (key: keyof EmployeeAttributes) => {
        if (!editAttributes || !selectedEmp) return null;
        
        const dept = getDepartment(selectedEmp.role);
        const configMap = getKPIConfig(dept);
        const config = configMap[key];
        if (!config) return null;

        const val = editAttributes[key];
        
        let activeBaseScore = 0;
        if (val >= 100) activeBaseScore = 100;
        else if (val >= 60) activeBaseScore = 60;
        else if (val >= 40) activeBaseScore = 40;
        else if (val >= 20) activeBaseScore = 20;
        else activeBaseScore = 0;

        const grade = getTierFromScore(val); 
        const checklist = getChecklist(key, dept, activeBaseScore);
        const currentTierConfig = ABILITY_TIERS.find(t => t.baseScore === activeBaseScore) || ABILITY_TIERS[4];

        return (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 animate-in slide-in-from-bottom-2">
                <div className="flex justify-between items-end mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white rounded-lg shadow-sm text-gray-500">
                            {React.createElement(config.icon, { size: 16 })}
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-[#1A1A1A]">{config.label}</h4>
                            <p className="text-[10px] text-gray-400 font-medium">{config.desc}</p>
                        </div>
                    </div>
                    <div className={`px-2 py-0.5 rounded-lg text-xs font-black border ${grade.color} flex items-center gap-1`}>
                        {grade.label} <span className="opacity-50">|</span> {val}
                    </div>
                </div>
                <div className="flex gap-1 h-12 mb-3">
                    {ABILITY_TIERS.slice().reverse().map(tier => {
                        const isSelectedTier = tier.baseScore === activeBaseScore;
                        return (
                            <button
                                key={tier.label}
                                onClick={() => handleTierSelect(key, tier.baseScore)}
                                className={`flex-1 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center ${isSelectedTier ? `${tier.color} shadow-sm ring-2 ring-offset-1 ring-transparent` : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-100 active:scale-95'}`}
                            >
                                <span className="text-[10px]">{tier.label}</span>
                            </button>
                        );
                    })}
                </div>
                <div className={`mb-3 p-3 rounded-lg border text-[10px] leading-relaxed transition-all ${currentTierConfig.color.replace('text-', 'bg-opacity-10 border-opacity-30 text-').replace('ring-', ' ')}`}>
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                        📌 评分标准 ({currentTierConfig.label} - {currentTierConfig.desc})
                    </p>
                    <p className="opacity-80">
                        {currentTierConfig.guide}
                    </p>
                </div>
                {activeBaseScore < 100 && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                        <div className="flex flex-wrap gap-2">
                            {checklist.map((tag, idx) => {
                                const isChecked = selectedTags[key]?.includes(tag.label);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => toggleBehaviorTag(key, tag, activeBaseScore)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 ${isChecked ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        {isChecked && <ThumbsUp size={10}/>}
                                        {tag.label}
                                        <span className={`ml-1 text-[9px] ${isChecked ? 'opacity-100' : 'opacity-50'}`}>+{tag.score}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="relative">
                             <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><PenTool size={12}/></div>
                             <input 
                                type="text"
                                placeholder="✍️ 额外加分 (Owner Bonus) +4"
                                value={customNotes[key] || ''}
                                onChange={(e) => handleCustomNoteChange(key, e.target.value, activeBaseScore)}
                                className={`w-full pl-9 pr-12 py-2.5 rounded-xl text-xs font-bold border outline-none transition-all ${customNotes[key] ? 'bg-blue-50 border-blue-300 text-blue-800 focus:ring-1 focus:ring-blue-400' : 'bg-white border-gray-200 text-gray-700 focus:border-[#FFD700]'}`}
                             />
                             {customNotes[key] && (<div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-600 bg-white/50 px-1.5 py-0.5 rounded">+4</div>)}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderInsightsCard = () => {
        if (!performanceInsights) return null;
        const { lateCount, absentCount, warningCount, tenureMonths } = performanceInsights;
        return (
            <div className="bg-[#1A1A1A] text-white rounded-xl mb-4 shadow-lg border border-gray-800 overflow-hidden">
                <div onClick={() => setShowInsights(!showInsights)} className="flex justify-between items-center p-3 border-b border-gray-700 cursor-pointer bg-gray-900/50">
                    <h4 className="text-xs font-black uppercase text-[#FFD700] flex items-center gap-2"><BrainCircuit size={14}/> 系统辅助情报</h4>
                    <div className="flex items-center gap-2"><span className="text-[9px] bg-gray-700 px-2 py-0.5 rounded text-gray-300">本月数据</span>{showInsights ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</div>
                </div>
                {showInsights && (
                    <div className="p-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-4 gap-2 text-center mb-3">
                            <div className="bg-gray-800 p-2 rounded-lg"><div className={`text-lg font-black ${lateCount === 0 ? 'text-green-400' : 'text-red-400'}`}>{lateCount}</div><div className="text-[8px] text-gray-400 uppercase">迟到</div></div>
                            <div className="bg-gray-800 p-2 rounded-lg"><div className={`text-lg font-black ${absentCount === 0 ? 'text-green-400' : 'text-red-400'}`}>{absentCount}</div><div className="text-[8px] text-gray-400 uppercase">缺席</div></div>
                            <div className="bg-gray-800 p-2 rounded-lg"><div className={`text-lg font-black ${warningCount === 0 ? 'text-green-400' : 'text-red-400'}`}>{warningCount}</div><div className="text-[8px] text-gray-400 uppercase">警告</div></div>
                            <div className="bg-gray-800 p-2 rounded-lg"><div className="text-lg font-black text-blue-400">{tenureMonths}</div><div className="text-[8px] text-gray-400 uppercase">月资历</div></div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {lateCount === 0 && absentCount === 0 && (<div className="flex items-center gap-1 text-[9px] font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded border border-green-800"><Star size={10}/> 建议纪律分: 满分</div>)}
                            {warningCount > 0 && (<div className="flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-900/30 px-2 py-1 rounded border border-red-800"><Ban size={10}/> 建议扣分</div>)}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderWeightInfo = () => {
        if (!selectedEmp) return null;
        const history = selectedEmp.assessmentHistory || [];
        const { ownerCount, ownerAvg, staffAvg } = calculateWeightedAttributes(history);
        const currentYear = new Date().getFullYear();
        const thisYearCount = history.filter(h => new Date(h.date).getFullYear() === currentYear).length;
        const limit = selectedEmp.assessmentYearlyLimit || 3;
        
        return (
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-4 flex justify-between items-center text-xs">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-blue-800">频率:</span>
                        <span className={`font-mono font-bold ${thisYearCount >= limit ? 'text-red-500' : 'text-blue-600'}`}>{thisYearCount}/{limit}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-blue-600">
                        <span>Boss: {ownerAvg}</span><span>•</span><span>Staff: {staffAvg}</span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[9px] text-gray-500 uppercase font-bold">Rating As:</p>
                    <p className={`font-black text-xs ${myRaterRole === 'OWNER' ? 'text-purple-600' : 'text-green-600'}`}>{myRaterRole}</p>
                </div>
            </div>
        );
    };

    const FILTER_BUTTONS = [{ id: 'ALL', label: '全部', icon: Users }, { id: 'KITCHEN', label: '厨房部', icon: ChefHat }, { id: 'BAR', label: '水吧', icon: Coffee }, { id: 'FLOOR', label: '楼面部', icon: User }, { id: 'GENERAL', label: '后勤', icon: Wrench }];

    const StatCard = ({ label, count, colorClass, icon: Icon }: any) => (
         <div className={`p-3 rounded-xl border flex flex-col justify-center items-center min-w-[80px] shrink-0 ${colorClass}`}>
             <Icon size={16} className="mb-1"/>
             <p className="text-[10px] font-bold uppercase opacity-80">{label}</p>
             <p className="text-xl font-black">{count}</p>
         </div>
    );

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-[#F5F7FA] w-full h-full md:max-w-6xl md:h-[95vh] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl relative font-sans">
                
                {/* Header */}
                <div className="bg-[#1A1A1A] px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] md:px-5 md:pb-5 md:pt-[max(env(safe-area-inset-top),1.25rem)] flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700]">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#FFD700] text-black p-2 rounded-xl shadow-lg"><Award size={20}/></div>
                        <div>
                            <h3 className="font-serif font-black text-lg tracking-wide">
                                {isOwner ? '全员评测' : `${myDept} 评测`}
                            </h3>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowGuide(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-[#FFD700]"><HelpCircle size={24}/></button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-3 md:p-8">
                    
                    {/* Stats Row */}
                    <div className="flex md:grid md:grid-cols-4 gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide snap-x">
                        <StatCard label="S-Tier" count={stats.sCount} colorClass="bg-purple-50 text-purple-700 border-purple-200 snap-center" icon={CrownIcon}/>
                        <StatCard label="A-Tier" count={stats.aCount} colorClass="bg-green-50 text-green-700 border-green-200 snap-center" icon={Star}/>
                        <StatCard label="B-Tier" count={stats.bCount} colorClass="bg-blue-50 text-blue-700 border-blue-200 snap-center" icon={CheckCircle2}/>
                        <StatCard label="Total" count={stats.total} colorClass="bg-gray-50 text-gray-700 border-gray-200 snap-center" icon={Users}/>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-3">
                        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 overflow-x-auto w-full md:w-auto scrollbar-hide">
                            {FILTER_BUTTONS.map(f => (
                                <button key={f.id} onClick={() => setFilter(f.id as any)} className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${filter === f.id ? 'bg-[#1A1A1A] text-[#FFD700] shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
                                    <f.icon size={14}/> {f.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                            <input type="text" placeholder="搜索员工..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD700] transition-all"/>
                        </div>
                    </div>

                    {/* Employee Grid */}
                    {filteredEmployees.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {filteredEmployees.map(emp => {
                                const score = getAverageScore(emp.attributes);
                                const grade = getTierFromScore(score);
                                const isUnrated = !emp.attributes;
                                
                                return (
                                    <div key={emp.id} onClick={() => handleOpenAssess(emp)} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer group relative overflow-hidden">
                                        {!isUnrated && <div className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10 -translate-y-1/2 translate-x-1/2 pointer-events-none ${grade.color.split(' ')[0].replace('bg-', 'bg-')}`}></div>}
                                        
                                        <div className="flex justify-between items-center mb-3 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-400 border border-white shadow-sm overflow-hidden">
                                                    {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover"/> : emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-sm text-[#1A1A1A]">{emp.name}</h4>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">{emp.role.split('(')[0]}</p>
                                                </div>
                                            </div>
                                            {isUnrated ? <div className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-dashed border-gray-200">New</div> : <div className={`flex flex-col items-center justify-center w-8 h-8 rounded-lg border ${grade.color}`}><span className="text-xs font-black leading-none">{grade.label}</span></div>}
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-[10px] font-bold text-gray-400">
                                            <span>Score: {score}</span>
                                            <div className="flex items-center gap-1 text-[#1A1A1A]">评测 <ChevronRight size={12}/></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="py-20 text-center text-gray-400 flex flex-col items-center">
                            {isOwner ? <Trophy size={48} className="mb-4 opacity-20"/> : <Lock size={48} className="mb-4 opacity-20"/>}
                            <p className="font-bold text-sm">暂无可见员工</p>
                            <p className="text-xs text-gray-300 mt-1">您可能没有评测权限，请联系管理员配置。</p>
                        </div>
                    )}
                </div>

                {/* ASSESSMENT MODAL */}
                {selectedEmp && (
                    <div className="fixed inset-0 bg-black/60 z-[150] flex items-end md:items-center justify-center md:p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full md:max-w-lg h-[90vh] md:h-auto md:max-h-[90vh] rounded-t-[2rem] md:rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-10 md:zoom-in-95 flex flex-col relative overflow-hidden">
                            <div className="flex justify-between items-center p-4 md:p-6 shrink-0 relative z-20 border-b border-gray-100 bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-400 overflow-hidden border border-white shadow">
                                        {selectedEmp.avatar ? <img src={selectedEmp.avatar} className="w-full h-full object-cover"/> : selectedEmp.name.charAt(0)}
                                    </div>
                                    <div><h3 className="font-black text-lg text-[#1A1A1A]">{selectedEmp.name}</h3><p className="text-[10px] text-gray-400 font-bold uppercase">{viewMode === 'ASSESS' ? '能力评估' : '设置/历史'}</p></div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isOwner && (<div className="relative" ref={menuRef}><button onClick={() => setMenuOpen(!menuOpen)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><MoreHorizontal size={20}/></button>{menuOpen && (<div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in slide-in-from-top-2"><button onClick={() => { setViewMode('ASSESS'); setMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm font-bold text-gray-700 flex items-center gap-2"><Award size={14}/> 评分界面</button><button onClick={() => { setViewMode('HISTORY'); setMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm font-bold text-gray-700 flex items-center gap-2"><History size={14}/> 历史记录</button><button onClick={() => { setViewMode('SETTINGS'); setTempLimit(selectedEmp.assessmentYearlyLimit || 3); setMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm font-bold text-gray-700 flex items-center gap-2"><Settings size={14}/> 频率设置</button><div className="h-px bg-gray-100 my-1"></div><button onClick={() => { setViewMode('RESET_CONFIRM'); setMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-red-50 text-sm font-bold text-red-600 flex items-center gap-2"><Trash2 size={14}/> 重置评分</button></div>)}</div>)}
                                    <button onClick={() => setSelectedEmp(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                                </div>
                            </div>
                            
                            {viewMode === 'ASSESS' && (
                                <div className="flex-grow overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 space-y-4 bg-[#F9FAFB]">
                                    {renderWeightInfo()}
                                    {renderInsightsCard()}
                                    <div className="space-y-4">{Object.keys(ATTRIBUTE_CONFIG).map(key => renderAttributeSlider(key as keyof EmployeeAttributes))}</div>
                                </div>
                            )}

                            {viewMode === 'HISTORY' && (<div className="flex-grow overflow-y-auto p-4 md:p-6 pb-20">{(!selectedEmp.assessmentHistory || selectedEmp.assessmentHistory.length === 0) ? (<div className="text-center py-20 text-gray-400 text-sm italic font-bold">暂无历史记录</div>) : (<div className="space-y-3">{selectedEmp.assessmentHistory.map((rec, idx) => (<div key={idx} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center"><div><p className="text-sm font-black text-[#1A1A1A]">{rec.raterName} <span className="text-[10px] text-gray-400 font-normal">({rec.raterRole})</span></p><p className="text-[10px] text-gray-400 mt-1">{new Date(rec.date).toLocaleDateString()}</p></div><div className="text-right"><div className="text-lg font-black text-blue-600">{getAverageScore(rec.scores)}</div><p className="text-[9px] font-bold text-gray-400 uppercase">Score</p></div></div>))}</div>)}</div>)}
                            {viewMode === 'SETTINGS' && (<div className="flex-grow flex flex-col justify-center p-6"><div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 text-center"><h4 className="text-lg font-black text-[#1A1A1A] mb-2">年度评测频率限制</h4><div className="flex items-center justify-center gap-4 mb-6 mt-6"><button onClick={() => setTempLimit(Math.max(1, tempLimit - 1))} className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center font-black text-lg">-</button><span className="text-3xl font-black font-mono w-16">{tempLimit}</span><button onClick={() => setTempLimit(tempLimit + 1)} className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center font-black text-lg">+</button></div><button onClick={handleUpdateLimit} className="w-full py-3 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-bold text-sm shadow-lg">保存设置 (Save)</button></div></div>)}
                            {viewMode === 'RESET_CONFIRM' && (<div className="flex-grow flex flex-col justify-center p-6"><div className="bg-red-50 p-6 rounded-3xl border border-red-100 text-center"><AlertTriangle size={48} className="mx-auto text-red-500 mb-4"/><input type="password" placeholder="Admin PIN" value={resetPassword} onChange={e => setResetPassword(e.target.value)} className="w-full p-3 bg-white border border-red-200 rounded-xl text-center font-black tracking-widest mb-4"/><button onClick={handleVerifyPassword} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg">Verify</button></div></div>)}
                            {viewMode === 'RESET_FINAL' && (<div className="flex-grow flex flex-col justify-center p-6 text-center"><h4 className="text-2xl font-black text-red-600 mb-2">FINAL WARNING</h4><p className="text-sm font-bold text-gray-500 mb-6">确定清空所有评分数据吗？</p><button onClick={handleFinalReset} className="w-full py-4 bg-red-600 text-white font-black rounded-xl shadow-xl mb-3">确认重置 (Reset)</button><button onClick={() => setViewMode('ASSESS')} className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl">取消</button></div>)}

                            {/* Bottom Actions (Sticky) */}
                            {viewMode === 'ASSESS' && (
                                <div className="p-4 bg-white border-t border-gray-100 shrink-0 safe-area-bottom">
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Current Score</span>
                                        <span className="text-2xl font-black text-[#1A1A1A] font-mono">{getAverageScore(editAttributes!)} <span className="text-sm text-gray-400">/ 100</span></span>
                                    </div>
                                    <button onClick={handleSaveAssessment} className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-lg shadow-lg hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2">
                                        <Save size={20}/> 提交评测 (Submit)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <AssessmentGuideModal 
                    isOpen={showGuide} 
                    onClose={() => setShowGuide(false)} 
                    usage={quotaUsage} 
                    quota={QUOTA_CONFIG}
                />

            </div>
        </div>
    );
};