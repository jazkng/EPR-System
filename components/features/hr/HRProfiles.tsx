
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Plus, Search, Edit3, Save, Trash2, ArrowLeft, CheckCircle2, Clock, Ban, Lock, Camera, ChevronUp, ChevronDown, Trophy, Shield, Settings2, Syringe, GraduationCap, Shirt, Ruler, Weight, History, Hash, HardDrive, LogOut, FileDown, Loader2, X, MapPin, Mail, Phone, Calendar, Briefcase, CreditCard, Eye, EyeOff, Activity, AlertTriangle, Zap, ClipboardList, Stethoscope, BookOpen, Printer, Archive, Home, CalendarDays, MessageSquarePlus, ThumbsUp, ThumbsDown, StickyNote, Crown, Image as ImageIcon, Medal, Layout, CheckSquare, Square, Star, Settings } from 'lucide-react';
import { Employee, EmployeeAttributes, AppModule, WarningRecord, SalaryRecord, AttendanceRecord, ReviewRecord, EmployeeRank } from '../../../types';
import { DataManager } from '../../../utils/dataManager';
import { uploadToCloudinary } from '../../utils';
import { DEFAULT_ROLES, NATIONALITY_OPTS, BANK_OPTIONS } from '../../constants';
import { MODULE_DEFINITIONS } from '../../constants';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

// --- SHARED HELPERS (SYNCED WITH ASSESSMENT MODULE) ---
const getAverageScore = (attrs?: EmployeeAttributes) => {
    if (!attrs) return 0;
    const values = Object.values(attrs);
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round(sum / values.length);
};

const ABILITY_TIERS = [
    { label: 'S', score: 100, desc: '完美 (Perfect)', color: 'bg-purple-100 text-purple-700 border-purple-200 ring-purple-500', icon: Crown },
    { label: 'A', score: 80, desc: '优秀 (Excellent)', color: 'bg-green-100 text-green-700 border-green-200 ring-green-500', icon: Star },
    { label: 'B', score: 60, desc: '普通 (Average)', color: 'bg-blue-100 text-blue-700 border-blue-200 ring-blue-500', icon: CheckCircle2 },
    { label: 'C', score: 40, desc: '差 (Poor)', color: 'bg-orange-100 text-orange-700 border-orange-200 ring-orange-500', icon: AlertTriangle },
    { label: 'D', score: 20, desc: '不合格 (Fail)', color: 'bg-red-100 text-red-700 border-red-200 ring-red-500', icon: X },
];

const ATTRIBUTE_CONFIG: Record<string, { label: string; desc: string }> = {
    efficiency: { label: '工作效率 (Efficiency)', desc: '出餐/服务速度，动作麻利程度' },
    service: { label: '服务态度 (Service)', desc: '对待客人的礼貌、微笑与耐心' },
    culinary: { label: '岗位技能 (Skill)', desc: '烹饪火候 / 摆盘 / 清洁标准' },
    leadership: { label: '团队配合 (Teamwork)', desc: '与同事沟通协作，不计较，服从安排' },
    discipline: { label: '纪律考勤 (Discipline)', desc: '不迟到早退，遵守公司 S.O.P' }
};

const getGradeInfo = (score: number) => {
    if (score >= 90) return ABILITY_TIERS[0];
    if (score >= 75) return ABILITY_TIERS[1];
    if (score >= 55) return ABILITY_TIERS[2];
    if (score >= 35) return ABILITY_TIERS[3];
    return ABILITY_TIERS[4];
};

const InputField = ({ label, value, onChange, placeholder, type = "text", isEditing, className = "" }: any) => (
    <div className={className}>
        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">{label}</label>
        {isEditing ? (
            <input type={type} value={value || ''} onChange={onChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1A1A] outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/50 transition-all" placeholder={placeholder} />
        ) : (
            <div className="text-sm font-bold text-[#1A1A1A] p-2 border border-transparent truncate">{value || '-'}</div>
        )}
    </div>
);

const SelectField = ({ label, value, onChange, options, isEditing }: any) => (
    <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">{label}</label>
        {isEditing ? (
            <select value={value || ''} onChange={onChange} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#1A1A1A] outline-none focus:border-[#FFD700]">
                <option value="">Select...</option>
                {options.map((opt: any) => {
                    const val = typeof opt === 'string' ? opt : opt.value;
                    const lab = typeof opt === 'string' ? opt : opt.label;
                    return <option key={val} value={val}>{lab}</option>;
                })}
            </select>
        ) : (
            <div className="text-sm font-bold text-[#1A1A1A] p-2 border border-transparent truncate">{
                typeof options[0] === 'string' ? (value || '-') : (options.find((o: any) => o.value === value)?.label || value || '-')
            }</div>
        )}
    </div>
);

const AbilityRadar = ({ attributes }: { attributes?: EmployeeAttributes }) => {
    const isAssessing = !attributes || Object.keys(attributes).length === 0 || Object.values(attributes).every((val: number) => val === 0);
    const avgScore = getAverageScore(attributes);
    const overallGrade = getGradeInfo(avgScore);

    if (isAssessing) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 h-full min-h-[160px] animate-in fade-in">
                <div className="bg-white p-4 rounded-full shadow-sm mb-3 border border-gray-100"><ClipboardList size={28} className="text-gray-300"/></div>
                <span className="text-sm font-black text-gray-500">评估中... (Assessing)</span>
                <span className="text-[10px] text-gray-400 mt-1 font-bold bg-white px-2 py-0.5 rounded border border-gray-100">暂无评分数据 (No Data)</span>
            </div>
        );
    }
    
    return (
        <div className="space-y-3">
             <div className={`p-3 rounded-xl border flex items-center justify-between ${overallGrade.color.replace('text-', 'bg-opacity-10 text-')}`}>
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-white shadow-sm ${overallGrade.color.split(' ')[1]}`}>
                        <overallGrade.icon size={16}/>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase opacity-60">Overall Grade</p>
                        <p className="text-lg font-black leading-none">{overallGrade.label}-Tier</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase opacity-60">Score</p>
                    <p className="text-lg font-mono font-black leading-none">{avgScore}</p>
                </div>
             </div>

            <div className="grid grid-cols-1 gap-2">
                {Object.entries(attributes!).map(([key, val]) => {
                    const config = ATTRIBUTE_CONFIG[key] || { label: key, desc: '' };
                    const grade = getGradeInfo(val as number);
                    return (
                        <div key={key} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                            <div className="flex flex-col"><span className="text-[10px] font-black text-gray-500 uppercase tracking-wide">{config.label.split('(')[0]}</span><span className="text-[8px] text-gray-400 font-bold">{config.label.split('(')[1]?.replace(')', '')}</span></div>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm border ${grade.color} shadow-sm`}>{grade.label}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const AbilityAssessmentModal = ({ isOpen, onClose, attributes, onChange }: any) => {
    if (!isOpen) return null;
    const isUnset = !attributes || Object.values(attributes as Record<string, number>).every((v: number) => v === 0);
    const attrs = !isUnset ? attributes : { efficiency: 60, service: 60, culinary: 60, leadership: 60, discipline: 60 };
    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="bg-[#1A1A1A] p-4 flex justify-between items-center text-white shrink-0"><h3 className="font-black text-lg flex items-center gap-2"><Trophy size={18} className="text-[#FFD700]"/> 能力评估 (Assessment)</h3><button onClick={onClose}><X size={20} className="text-white/50 hover:text-white"/></button></div>
                <div className="p-6 overflow-y-auto space-y-6 bg-gray-50 flex-grow">
                    {Object.keys(attrs).map(key => {
                        const config = ATTRIBUTE_CONFIG[key] || { label: key, desc: 'N/A' };
                        const currentVal = attrs[key as keyof EmployeeAttributes];
                        return (
                            <div key={key} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                                <div className="mb-3"><h4 className="text-sm font-black text-[#1A1A1A]">{config.label}</h4><p className="text-[10px] text-gray-400 font-bold mt-0.5">{config.desc}</p></div>
                                <div className="flex justify-between gap-1">{ABILITY_TIERS.slice().reverse().map(tier => { const isSelected = getGradeInfo(currentVal).label === tier.label; return (<button key={tier.label} onClick={() => onChange({...attrs, [key]: tier.score})} className={`flex-1 py-2 rounded-lg flex flex-col items-center justify-center border-2 transition-all active:scale-95 ${isSelected ? `${tier.color} ring-2 ring-offset-1 border-transparent shadow-md font-black` : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}><span className="text-sm">{tier.label}</span>{isSelected && <span className="text-[8px] uppercase mt-0.5">{tier.desc.split(' ')[0]}</span>}</button>) })}</div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-4 bg-white border-t border-gray-100 shrink-0"><button onClick={onClose} className="w-full bg-[#1A1A1A] hover:bg-black text-[#FFD700] py-4 rounded-xl font-black shadow-lg transition-colors flex items-center justify-center gap-2"><CheckCircle2 size={18}/> 完成评估 (Complete)</button></div>
            </div>
        </div>
    );
};

// --- UPDATED SYSTEM ACCESS MODAL WITH GROUPING ---
const SystemAccessModal = ({ isOpen, onClose, allowedModules, onToggle, assessmentTargets, onUpdateTargets, allEmployees }: any) => {
    const [isTargetConfigOpen, setIsTargetConfigOpen] = useState(false);

    if (!isOpen) return null;

    // Define Groups for clearer UX
    const MODULE_GROUPS = [
        {
            title: '核心管理 (Core Management)',
            modules: ['HR_FILES', 'REPORTS', 'ASSESSMENT', 'TREASURY', 'AP', 'BILLS', 'DAILY_ALERT'] as AppModule[],
            color: 'bg-red-50 text-red-700 border-red-100'
        },
        {
            title: '日常运营 (Daily Operations)',
            modules: ['SETTLEMENT', 'ROSTER', 'LOGBOOK', 'SOP_INSPECT', 'QUEUE_MANAGER'] as AppModule[],
            color: 'bg-blue-50 text-blue-700 border-blue-100'
        },
        {
            title: '供应链与产品 (Supply & Product)',
            modules: ['PROCUREMENT', 'SUPPLIER_CONTACTS', 'MENU_MANAGEMENT', 'INVENTORY_VIEW', 'INVENTORY_CHECK'] as AppModule[],
            color: 'bg-orange-50 text-orange-700 border-orange-100'
        },
        {
            title: '库存区域 (Inventory Areas)',
            modules: ['INVENTORY_KITCHEN', 'INVENTORY_BAR', 'INVENTORY_GENERAL', 'INVENTORY_FUEL'] as AppModule[],
            color: 'bg-green-50 text-green-700 border-green-100'
        }
    ];

    // Helper to toggle a whole group
    const toggleGroup = (groupModules: AppModule[]) => {
        const allSelected = groupModules.every(m => allowedModules.includes(m));
        if (allSelected) {
            groupModules.forEach(m => { if (allowedModules.includes(m)) onToggle(m); });
        } else {
            groupModules.forEach(m => { if (!allowedModules.includes(m)) onToggle(m); });
        }
    };

    // Sub-component for Assessment Target Selection
    const AssessmentTargetSelector = () => {
        const groupedStaff = { 'KITCHEN': [], 'FLOOR': [], 'BAR': [], 'CLEANER': [] } as any;
        const currentTargets = assessmentTargets || [];

        // Simple grouping logic
        allEmployees.forEach((e: Employee) => {
            if (e.isArchived || e.role.includes('Owner')) return;
            const r = e.role.toUpperCase();
            if (r.includes('CHEF') || r.includes('COOK') || r.includes('KITCHEN') || r.includes('头手') || r.includes('厨房')) groupedStaff['KITCHEN'].push(e);
            else if (r.includes('BAR') || r.includes('水吧')) groupedStaff['BAR'].push(e);
            else if (r.includes('CLEANER') || r.includes('DISH') || r.includes('洗碗')) groupedStaff['CLEANER'].push(e);
            else groupedStaff['FLOOR'].push(e);
        });

        const toggleTarget = (id: string) => {
            if (currentTargets.includes(id)) {
                onUpdateTargets(currentTargets.filter((t: string) => t !== id));
            } else {
                onUpdateTargets([...currentTargets, id]);
            }
        };

        const toggleGroupTargets = (groupKey: string) => {
            const groupIds = groupedStaff[groupKey].map((e: Employee) => e.id);
            const allIn = groupIds.every((id: string) => currentTargets.includes(id));
            
            if (allIn) {
                // Remove all
                onUpdateTargets(currentTargets.filter((id: string) => !groupIds.includes(id)));
            } else {
                // Add missing
                const toAdd = groupIds.filter((id: string) => !currentTargets.includes(id));
                onUpdateTargets([...currentTargets, ...toAdd]);
            }
        };

        return (
            <div className="absolute inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-right">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h4 className="font-black text-lg">评测对象配置 (Targets)</h4>
                        <p className="text-xs text-gray-500">勾选该员工允许评测的人员</p>
                    </div>
                    <button onClick={() => setIsTargetConfigOpen(false)} className="bg-gray-200 p-2 rounded-full"><X size={20}/></button>
                </div>
                <div className="flex-grow overflow-y-auto p-4 space-y-6">
                    {Object.keys(groupedStaff).map(key => (
                        <div key={key}>
                             <div className="flex justify-between items-center mb-2">
                                <h5 className="font-black text-xs text-gray-500 uppercase tracking-widest">{key} TEAM</h5>
                                <button onClick={() => toggleGroupTargets(key)} className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">Toggle All</button>
                             </div>
                             <div className="grid grid-cols-2 gap-2">
                                 {groupedStaff[key].map((e: Employee) => (
                                     <button 
                                        key={e.id} 
                                        onClick={() => toggleTarget(e.id)}
                                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${currentTargets.includes(e.id) ? 'bg-green-50 border-green-500 text-green-800' : 'bg-white border-gray-200 text-gray-500'}`}
                                     >
                                         <span className="text-xs font-bold truncate">{e.name}</span>
                                         {currentTargets.includes(e.id) && <CheckCircle2 size={14}/>}
                                     </button>
                                 ))}
                             </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t"><button onClick={() => setIsTargetConfigOpen(false)} className="w-full bg-[#1A1A1A] text-white py-3 rounded-xl font-bold">完成配置 (Done)</button></div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
                
                {isTargetConfigOpen && <AssessmentTargetSelector />}

                <div className="p-6 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
                    <h3 className="font-black text-xl flex items-center gap-2"><Shield size={24} className="text-blue-600"/> 系统权限配置 (Access)</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-400"/></button>
                </div>
                
                <div className="p-6 overflow-y-auto bg-[#F5F7FA] space-y-6">
                    {MODULE_GROUPS.map(group => {
                        const allSelected = group.modules.every(m => allowedModules.includes(m));
                        return (
                            <div key={group.title} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className={`px-4 py-3 flex justify-between items-center border-b ${group.color} ${group.title.includes('Core') ? 'border-red-100' : 'border-gray-100'}`}>
                                    <h4 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                                        <Layout size={14}/> {group.title}
                                    </h4>
                                    <button 
                                        onClick={() => toggleGroup(group.modules)}
                                        className="text-[10px] font-bold bg-white/50 px-2 py-1 rounded hover:bg-white transition-colors flex items-center gap-1"
                                    >
                                        {allSelected ? <CheckSquare size={12}/> : <Square size={12}/>} {allSelected ? '取消全选' : '全选'}
                                    </button>
                                </div>
                                <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {group.modules.map(mod => {
                                        const def = MODULE_DEFINITIONS[mod];
                                        if (!def) return null;
                                        const isSelected = allowedModules.includes(mod);
                                        return (
                                            <div 
                                                key={mod} 
                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-md' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-300'}`}
                                            >
                                                <div 
                                                    className="flex-grow flex items-center gap-3 cursor-pointer"
                                                    onClick={() => onToggle(mod)} 
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-white/20 text-[#FFD700]' : 'bg-gray-100 text-gray-400'}`}>
                                                        <def.icon size={16}/>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#1A1A1A]'}`}>{def.label.split('(')[0]}</div>
                                                        <div className={`text-[9px] truncate ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>{def.desc}</div>
                                                    </div>
                                                </div>
                                                
                                                {/* Config Button for Assessment Module */}
                                                {mod === 'ASSESSMENT' && isSelected && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setIsTargetConfigOpen(true); }}
                                                        className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-[#FFD700] ml-2"
                                                        title="配置评测对象"
                                                    >
                                                        <Settings size={14}/>
                                                    </button>
                                                )}

                                                <div className="ml-auto pointer-events-none">
                                                    {isSelected ? <CheckCircle2 size={16} className="text-green-400"/> : <div className="w-4 h-4 rounded-full border-2 border-gray-200"></div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                    <button onClick={onClose} className="w-full bg-[#1A1A1A] text-[#FFD700] py-4 rounded-xl font-black text-lg shadow-lg hover:bg-black transition-transform active:scale-[0.98]">
                        保存配置 (Save Configuration)
                    </button>
                </div>
            </div>
        </div>
    );
};

const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const DISCIPLINARY_TYPES = [{id: 'VERBAL', label: '口头警告 (Verbal)', color: 'text-yellow-600 bg-yellow-50'}, {id: 'WRITTEN', label: '书面警告 (Written)', color: 'text-orange-600 bg-orange-50'}, {id: 'FINAL', label: '最后警告 (Final)', color: 'text-red-600 bg-red-50'}];

interface HRProfilesProps {
    employees: Employee[];
    onSave: (employees: Employee[]) => void;
    currentBossId?: string;
}

export const HRProfiles: React.FC<HRProfilesProps> = ({ employees, onSave, currentBossId }) => {
    // ... (Keep existing State & Logic) ...
    const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [form, setForm] = useState<Partial<Employee>>({});
    const [isUploading, setIsUploading] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [showResigned, setShowResigned] = useState(false); 
    const fileInputRef = useRef<HTMLInputElement>(null);
    const printRef = useRef<HTMLDivElement>(null); 
    const singleProfileRef = useRef<HTMLDivElement>(null); 
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isGeneratingSinglePdf, setIsGeneratingSinglePdf] = useState(false);
    const [isSalaryExpanded, setIsSalaryExpanded] = useState(false);
    const [showAbilityModal, setShowAbilityModal] = useState(false);
    const [showAccessModal, setShowAccessModal] = useState(false);
    const [showWarningInput, setShowWarningInput] = useState(false);
    const [warnType, setWarnType] = useState('VERBAL');
    const [warnReason, setWarnReason] = useState('');
    const [showTerminateModal, setShowTerminateModal] = useState(false);
    const [terminationData, setTerminationData] = useState({ reason: '', date: new Date().toISOString().split('T')[0] });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [viewImage, setViewImage] = useState<string | null>(null);
    
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewFormState, setReviewFormState] = useState({ content: '', type: 'NOTE' as 'PRAISE' | 'CRITICISM' | 'NOTE', image: '' });
    const reviewFileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingReviewImage, setIsUploadingReviewImage] = useState(false);
    
    const [attendanceSnapshot, setAttendanceSnapshot] = useState<{ late: number, lateDates: string[], absent: number, work: number }>({ late: 0, lateDates: [], absent: 0, work: 0 });

    const filteredEmployees = useMemo(() => {
        return employees.filter(e => {
            const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.id.includes(searchTerm);
            const isOwner = e.role.includes('Owner');
            if (isOwner) return false;
            const archiveMatch = showResigned ? e.isArchived : !e.isArchived;
            return matchesSearch && archiveMatch;
        });
    }, [employees, searchTerm, showResigned]);

    const groupedEmployees = useMemo(() => {
        const groups: Record<string, Employee[]> = { 'KITCHEN': [], 'BAR': [], 'FLOOR': [], 'CLEANER': [], 'OTHERS': [] };
        filteredEmployees.forEach(emp => {
            const r = emp.role.toUpperCase();
            if (r.includes('CLEANER') || r.includes('DISH') || r.includes('清洁') || r.includes('洗碗')) groups['CLEANER'].push(emp);
            else if (r.includes('BAR') || r.includes('水吧')) groups['BAR'].push(emp);
            else if (r.includes('CHEF') || r.includes('COOK') || r.includes('CUTTER') || r.includes('FRYER') || r.includes('COMMIS') || r.includes('RUNNER') || r.includes('HELPER') || r.includes('APPRENTICE') || r.includes('头手') || r.includes('帮锅') || r.includes('占板') || r.includes('马王') || r.includes('厨房')) groups['KITCHEN'].push(emp);
            else if (r.includes('MANAGER') || r.includes('SUPERVISOR') || r.includes('COUNTER') || r.includes('CAPTAIN') || r.includes('WAITER') || r.includes('PART') || r.includes('经理') || r.includes('主管') || r.includes('柜台') || r.includes('写单') || r.includes('服务') || r.includes('兼职')) groups['FLOOR'].push(emp);
            else groups['OTHERS'].push(emp);
        });
        Object.keys(groups).forEach(key => groups[key].sort((a, b) => parseInt(a.id) - parseInt(b.id)));
        return groups;
    }, [filteredEmployees]);

    const SECTIONS = [
        { id: 'KITCHEN', label: '🍳 厨房 (Kitchen)', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-100' },
        { id: 'BAR', label: '🥤 水吧 (Bar)', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-100' },
        { id: 'FLOOR', label: '🛎️ 楼面 (Floor)', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-100' },
        { id: 'CLEANER', label: '🧹 清洁 (Cleaning)', bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-100' },
        { id: 'OTHERS', label: '❓ 其他 (Others)', bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-100' },
    ];

    // ... (Keep existing useEffects and Handlers) ...
    useEffect(() => {
        if (!selectedEmpId) return;
        
        const fetchAttendance = async () => {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const records = await DataManager.getAttendanceByMonth(currentMonth);
            const myRecords = records.filter(r => r.employeeId === selectedEmpId);
            
            let late = 0;
            const lateDates: string[] = [];
            let absent = 0; 
            let work = 0;

            myRecords.forEach(r => {
                if (r.status === 'LATE') {
                    late++;
                    lateDates.push(r.date.split('-')[2]);
                } else if (r.status === 'ABSENT') {
                    absent++;
                }
                if (r.clockIn) work++;
            });

            setAttendanceSnapshot({ late, lateDates, absent, work });
        };
        fetchAttendance();

    }, [selectedEmpId]);

    const handleSelect = (emp: Employee) => {
        setSelectedEmpId(emp.id);
        const copy = JSON.parse(JSON.stringify(emp));
        if (!copy.salaryMode) copy.salaryMode = copy.role.includes('Part-Time') || copy.role.includes('兼职') ? 'HOURLY' : 'MONTHLY';
        if (!copy.salaryHistory) copy.salaryHistory = [];
        if (!copy.warningHistory) copy.warningHistory = [];
        if (!copy.reviews) copy.reviews = [];
        if (!copy.allowedModules) copy.allowedModules = [];
        if (!copy.assessmentTargets) copy.assessmentTargets = []; // Init target array
        setForm(copy);
        setIsEditing(false);
        setIsSalaryExpanded(false);
        setShowWarningInput(false);
        setShowPin(false);
    };

    const handleAddNew = () => {
        const validIds = employees.map(e => parseInt(e.id)).filter(n => !isNaN(n));
        const sequenceIds = validIds.filter(n => n >= 1000 && n < 9000);
        const maxId = sequenceIds.length > 0 ? Math.max(...sequenceIds) : 1019;
        const newId = (maxId + 1).toString();
        const newEmp: Partial<Employee> = { 
            id: newId, 
            name: '', 
            role: 'Part-Time (兼职)', 
            status: 'PROBATION', 
            rank: 'CREW', // Default rank
            level: 'Probation', 
            phone: '', 
            joinDate: new Date().toISOString().split('T')[0], 
            nationality: 'Malaysian 🇲🇾', 
            basicSalary: 0, 
            salaryMode: 'MONTHLY', 
            allowedModules: [], 
            assessmentTargets: [],
            moduleProficiency: {}, 
            pin: '0000', 
            salaryHistory: [], 
            warningHistory: [], 
            reviews: [], 
            monthlyRestDays: 4, 
            hasHostel: false 
        };
        setForm(newEmp);
        setSelectedEmpId(newId);
        setIsEditing(true);
    };

    const handleSaveForm = async () => {
        if (!form.name || !form.id) return alert("姓名和ID必填");
        const newEmployee = form as Employee;
        await DataManager.saveEmployee(newEmployee);
        const existingIdx = employees.findIndex(e => e.id === newEmployee.id);
        let newList;
        if (existingIdx >= 0) { newList = [...employees]; newList[existingIdx] = newEmployee; } else { newList = [...employees, newEmployee]; }
        onSave(newList);
        setIsEditing(false);
        alert("✅ 档案已保存 (Saved)");
    };

    // ... (Other handlers unchanged: Reviews, Delete, Restore etc.) ...
    const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsUploadingReviewImage(true); try { const url = await uploadToCloudinary(file); setReviewFormState(prev => ({ ...prev, image: url })); } catch (error) { alert('Upload Failed'); } finally { setIsUploadingReviewImage(false); if(reviewFileInputRef.current) reviewFileInputRef.current.value = ''; } };
    const handleAddReview = async () => { if (!reviewFormState.content.trim()) return; const newReview: ReviewRecord = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], author: currentBossId ? 'Manager' : 'Admin', content: reviewFormState.content, type: reviewFormState.type, image: reviewFormState.image }; const updatedReviews = [newReview, ...(form.reviews || [])]; const updatedEmp = { ...form, reviews: updatedReviews } as Employee; await DataManager.saveEmployee(updatedEmp); setForm(updatedEmp); const newList = employees.map(e => e.id === updatedEmp.id ? updatedEmp : e); onSave(newList); setReviewFormState({ content: '', type: 'NOTE', image: '' }); };
    const handleDeleteReview = async (reviewId: string) => { if (!confirm("确定删除此条评语?")) return; const updatedReviews = (form.reviews || []).filter(r => r.id !== reviewId); const updatedEmp = { ...form, reviews: updatedReviews } as Employee; await DataManager.saveEmployee(updatedEmp); setForm(updatedEmp); const newList = employees.map(e => e.id === updatedEmp.id ? updatedEmp : e); onSave(newList); };
    const handleResetPin = () => { if(confirm(`Reset PIN for ${form.name} to 0000?`)) { setForm({ ...form, pin: '0000' }); alert("PIN Reset to 0000. Please save."); } };
    const handleTerminateClick = () => { setTerminationData({ reason: '', date: new Date().toISOString().split('T')[0] }); setShowTerminateModal(true); };
    const confirmTermination = async () => { if (!terminationData.reason) return alert("请填写离职原因 (Reason required)"); const updated = { ...form, status: 'TERMINATED', isArchived: true, terminationReason: terminationData.reason, terminationDate: terminationData.date }; setForm(updated as Employee); await DataManager.saveEmployee(updated as Employee); const newList = employees.map(e => e.id === updated.id ? updated as Employee : e); onSave(newList); setShowTerminateModal(false); setIsEditing(false); alert("✅ 员工已离职归档 (Terminated & Archived)"); };
    const handleRestore = async () => { if (!confirm("确认复职该员工? (Restore Employee?)")) return; const updated = { ...form, status: 'PROBATION', isArchived: false, terminationReason: undefined, terminationDate: undefined }; setForm(updated as Employee); await DataManager.saveEmployee(updated as Employee); const newList = employees.map(e => e.id === updated.id ? updated as Employee : e); onSave(newList); setIsEditing(false); alert("✅ 员工已复职 (Restored)"); };
    const confirmDelete = async () => { if (!selectedEmpId || !form.name) return; try { await DataManager.deleteEmployee(selectedEmpId); const newList = employees.filter(e => e.id !== selectedEmpId); onSave(newList); setSelectedEmpId(null); setIsEditing(false); setShowDeleteModal(false); alert("✅ 档案已永久删除 (Deleted)"); } catch (e) { console.error(e); alert("❌ 删除失败 (Delete Failed)"); } };
    const addSalaryRecord = () => { const amountStr = prompt("输入新薪资 (New Amount):", form.basicSalary?.toString()); const reason = prompt("调整原因 (Reason):", "Annual Increment"); if(amountStr && reason) { const amount = parseFloat(amountStr); const newRecord: SalaryRecord = { date: new Date().toISOString().split('T')[0], amount: amount, adjustment: amount - (form.basicSalary || 0), percentage: 0, reason: reason }; setForm({ ...form, basicSalary: amount, salaryHistory: [newRecord, ...(form.salaryHistory || [])] }); } };
    const deleteSalaryRecord = (index: number) => { if(!form.salaryHistory) return; if(!confirm("确定删除此薪资记录? (Confirm Delete?)")) return; const newHistory = [...form.salaryHistory]; newHistory.splice(index, 1); setForm({...form, salaryHistory: newHistory}); };
    const confirmAddWarning = () => { if(!warnReason) return alert("请填写原因"); const newWarning: WarningRecord = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], type: warnType as any, reason: warnReason, issuer: currentBossId || 'Admin' }; setForm({ ...form, warningHistory: [newWarning, ...(form.warningHistory || [])] }); setShowWarningInput(false); setWarnReason(''); };
    const handleToggleModule = (mod: AppModule) => { const current = form.allowedModules || []; if(current.includes(mod)) { setForm({...form, allowedModules: current.filter(m => m !== mod)}); } else { setForm({...form, allowedModules: [...current, mod]}); } };
    const handleUpdateAssessmentTargets = (targets: string[]) => { setForm({ ...form, assessmentTargets: targets }); };
    
    const getTenure = (dateStr: string) => { if(!dateStr) return '-'; const start = new Date(dateStr); const now = new Date(); const diffTime = Math.abs(now.getTime() - start.getTime()); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if(diffDays < 30) return `${diffDays} Days`; if(diffDays < 365) return `${Math.floor(diffDays/30)} Months`; return `${(diffDays/365).toFixed(1)} Years`; };
    const handleExportPDF = async () => { if (!printRef.current) return; setIsGeneratingPdf(true); try { await new Promise(resolve => setTimeout(resolve, 100)); const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }); const imgData = canvas.toDataURL('image/jpeg', 1.0); const pdf = new jsPDF('p', 'mm', 'a4'); const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = (canvas.height * pdfWidth) / canvas.width; pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight); pdf.save(`Staff_Directory_${new Date().toISOString().split('T')[0]}.pdf`); } catch (err) { console.error("PDF Gen Error:", err); alert("PDF 生成失败，请重试。"); } finally { setIsGeneratingPdf(false); } };
    const handleExportSinglePDF = async () => { if (!singleProfileRef.current || !form.id) return; setIsGeneratingSinglePdf(true); try { await new Promise(resolve => setTimeout(resolve, 100)); const canvas = await html2canvas(singleProfileRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }); const imgData = canvas.toDataURL('image/jpeg', 1.0); const pdf = new jsPDF('p', 'mm', 'a4'); const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = (canvas.height * pdfWidth) / canvas.width; pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight); pdf.save(`Profile_${form.name}_${form.id}.pdf`); } catch (err) { console.error("Single PDF Gen Error:", err); alert("档案生成失败，请重试。"); } finally { setIsGeneratingSinglePdf(false); } };

    return (
        <div className="flex h-full w-full bg-[#FAFAFA] flex-col md:flex-row overflow-hidden relative">
            {/* List Sidebar */}
            <div className={`w-full md:w-80 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full ${selectedEmpId ? 'hidden md:flex' : 'flex'}`}>
                {/* ... (Sidebar content remains exactly same) ... */}
                <div className="p-4 border-b border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-sm text-[#1A1A1A] uppercase tracking-widest">员工通讯录 (Directory)</h3>
                        <div className="flex gap-2">
                            <button onClick={handleExportPDF} disabled={isGeneratingPdf} className="p-2 bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-full transition-colors shadow-sm disabled:opacity-50" title="导出名录 (Export Directory)">
                                {isGeneratingPdf ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>}
                            </button>
                            <button onClick={handleAddNew} className="p-2 bg-[#1A1A1A] text-white rounded-full hover:bg-gray-800 transition-colors shadow-md"><Plus size={16}/></button>
                        </div>
                    </div>
                    <div className="relative group"><Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-[#1A1A1A] transition-colors" size={18}/><input type="text" placeholder="搜索姓名 / ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-gray-300 focus:bg-white transition-all" /></div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer p-2 hover:bg-gray-50 rounded-lg select-none">
                        <input type="checkbox" checked={showResigned} onChange={e => { setShowResigned(e.target.checked); setSelectedEmpId(null); }} className="accent-[#1A1A1A]" />
                        <Archive size={14}/> {showResigned ? '显示: 已离职 (Archived)' : '显示: 在职员工 (Active)'}
                    </label>
                </div>
                <div className="flex-grow overflow-y-auto p-2 space-y-4 pb-32">
                    {filteredEmployees.length === 0 ? (<div className="p-8 text-center text-gray-400 text-xs">无员工数据</div>) : (SECTIONS.map(section => { const items = groupedEmployees[section.id]; if (!items || items.length === 0) return null; return (<div key={section.id} className="space-y-1"><div className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-between ${section.bg} ${section.text}`}><span>{section.label}</span><span className="bg-white/50 px-1.5 rounded text-[10px]">{items.length}</span></div>{items.map(emp => (<div key={emp.id} onClick={() => handleSelect(emp)} className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 border ${selectedEmpId === emp.id ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-gray-600 border-transparent hover:bg-gray-50'} ${emp.isArchived ? 'opacity-70 grayscale' : ''}`}><div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 overflow-hidden ${selectedEmpId === emp.id ? 'bg-gray-800 text-[#FFD700]' : 'bg-gray-100 text-gray-400'}`}>{emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover"/> : emp.name.charAt(0)}</div><div className="min-w-0 flex-grow"><div className="flex justify-between items-center"><div className="text-sm font-black truncate">{emp.name}</div><div className="flex gap-1">{emp.rank && emp.rank !== 'CREW' && (<span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${emp.rank === 'TOP' ? 'bg-[#FFD700] text-black' : emp.rank === 'MANAGEMENT' ? 'bg-indigo-100 text-indigo-700' : emp.rank === 'HEAD' ? 'bg-red-100 text-red-700' : emp.rank === 'PIC' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>{emp.rank}</span>)}<span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${emp.status === 'CONFIRMED' ? (selectedEmpId === emp.id ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700') : emp.status === 'TERMINATED' ? (selectedEmpId === emp.id ? 'bg-red-900 text-white' : 'bg-red-100 text-red-700') : (selectedEmpId === emp.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}`}>{emp.status === 'CONFIRMED' ? '正式' : emp.status === 'TERMINATED' ? '离职' : '试用'}</span></div></div><div className={`text-[10px] font-bold truncate mt-0.5 ${selectedEmpId === emp.id ? 'text-gray-400' : 'text-gray-400'}`}>{emp.role.split('(')[0]}</div></div></div>))}</div>); }))}
                </div>
            </div>

            {/* Detail View */}
            <div className={`flex-grow flex flex-col h-full bg-[#F5F7FA] overflow-y-auto relative ${!selectedEmpId ? 'hidden md:flex' : 'flex'}`}>
                {!selectedEmpId ? (<div className="m-auto text-gray-300 flex flex-col items-center gap-4"><div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center animate-pulse"><User size={40} className="opacity-20"/></div><p className="font-bold tracking-widest uppercase text-xs">Select an employee to view details</p></div>) : (
                    <>
                        {/* Header Section */}
                        <div className={`bg-gradient-to-br p-5 pb-20 md:p-6 md:pb-28 relative shadow-lg shrink-0 ${form.isArchived ? 'from-gray-800 to-gray-900 grayscale' : 'from-[#1A1A1A] to-[#2A2A2A]'}`}>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                            <div className="flex justify-between items-start relative z-10 text-white">
                                <button onClick={() => setSelectedEmpId(null)} className="md:hidden p-2 -ml-2 bg-white/10 rounded-full hover:bg-white/20 active:scale-95 transition-all"><ArrowLeft size={20}/></button>
                                <div className="hidden md:block"></div>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowReviewModal(true)} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                                        <MessageSquarePlus size={14}/> 记录评语
                                    </button>
                                    <button onClick={handleExportSinglePDF} disabled={isGeneratingSinglePdf} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                                        {isGeneratingSinglePdf ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} 导出档案
                                    </button>
                                    {isEditing ? (
                                        <>
                                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white">取消</button>
                                            <button onClick={handleSaveForm} className="px-6 py-2 bg-[#FFD700] hover:bg-[#E5C100] text-black rounded-xl text-xs font-black shadow-lg flex items-center gap-2"><Save size={14}/> 保存档案</button>
                                        </>
                                    ) : (
                                        <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white text-black rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 hover:bg-gray-100"><Edit3 size={14}/> 编辑资料</button>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 md:mt-0 text-white">
                                {/* NAME & GRADE BADGE ROW */}
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl md:text-3xl font-black tracking-tight leading-tight flex items-center gap-3">
                                        {form.name || 'New Staff'}
                                    </h1>
                                    
                                    {/* --- GRADE BADGE (VISUAL SYNC) --- */}
                                    {getGradeInfo(getAverageScore(form.attributes)).label !== 'Fail' && (
                                        <div className={`px-2 py-0.5 rounded-lg text-xs font-black uppercase flex items-center gap-1 border ${getGradeInfo(getAverageScore(form.attributes)).color} bg-opacity-100 shadow-lg`}>
                                            {React.createElement(getGradeInfo(getAverageScore(form.attributes)).icon, { size: 12 })}
                                            {getGradeInfo(getAverageScore(form.attributes)).label}
                                        </div>
                                    )}

                                    {form.isArchived && <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">已离职 (Terminated)</span>}
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-y-2 gap-x-3 mt-2 text-white/60 text-xs font-bold uppercase tracking-widest">
                                    {isEditing ? (
                                        <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="bg-white/10 text-white border border-white/20 rounded px-2 py-1 outline-none text-xs font-bold">{DEFAULT_ROLES.map(r => <option key={r.id} value={r.title} className="text-black">{r.title}</option>)}</select>
                                    ) : (
                                        <span className="bg-white/10 px-2 py-1 rounded border border-white/10 whitespace-nowrap">{form.role}</span>
                                    )}
                                    <span className="flex items-center gap-1 whitespace-nowrap"><Hash size={12}/> ID: {isEditing ? (<input value={form.id} onChange={e => setForm({...form, id: e.target.value})} className="bg-white/10 text-white border-b border-white/30 w-16 px-1 outline-none text-xs font-mono"/>) : (form.id)}</span>
                                    <span className="flex items-center gap-1 whitespace-nowrap"><Clock size={12}/> Tenure: {getTenure(form.joinDate || '')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="px-4 md:px-8 -mt-16 pb-20 space-y-6 relative z-10 max-w-6xl mx-auto w-full">
                            {/* ... (Keep existing archived banner and left column content) ... */}
                            {form.isArchived && (<div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm flex items-start gap-4 animate-in slide-in-from-top-4"><div className="p-2 bg-red-100 rounded-full text-red-600"><Ban size={24}/></div><div><h4 className="text-red-800 font-black text-lg">此员工已离职</h4><p className="text-red-600 text-sm font-bold mt-1">离职日期: {form.terminationDate || '未知'}</p><div className="mt-2 text-red-700 text-xs bg-white/50 p-3 rounded-lg border border-red-100 italic">"{form.terminationReason || '无记录原因'}"</div></div></div>)}

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                                {/* LEFT COLUMN: AVATAR / STATUS / SALARY (Unchanged) */}
                                <div className="xl:col-span-4 flex flex-col gap-6">
                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
                                        <div className="relative w-40 h-40 mb-4 cursor-pointer" onClick={() => isEditing && fileInputRef.current?.click()}>
                                            <div className={`w-40 h-40 rounded-full overflow-hidden border-4 shadow-xl bg-gray-100 relative z-10 ${form.isArchived ? 'border-gray-300 grayscale' : 'border-white'}`}>
                                                {form.avatar ? <img src={form.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-5xl text-gray-300 font-black">{form.name?.charAt(0)}</div>}
                                            </div>
                                            {isEditing && <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white z-20"><Camera size={24}/></div>}
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if(!file) return; setIsUploading(true); try { const url = await uploadToCloudinary(file); setForm({...form, avatar: url}); } catch(err) { alert("Upload Failed"); } finally { setIsUploading(false); } }} />
                                        </div>
                                        <div className="flex gap-2 flex-wrap justify-center">
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ${form.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : form.status === 'TERMINATED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {form.status === 'CONFIRMED' ? <CheckCircle2 size={12}/> : form.status === 'TERMINATED' ? <LogOut size={12}/> : <Clock size={12}/>}
                                                {form.status}
                                            </div>
                                            {form.rank && (
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border ${
                                                    form.rank === 'TOP' ? 'bg-gray-800 text-[#FFD700] border-gray-800' : 
                                                    form.rank === 'MANAGEMENT' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 
                                                    form.rank === 'HEAD' ? 'bg-red-100 text-red-700 border-red-200' :
                                                    form.rank === 'PIC' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                                                    'bg-gray-100 text-gray-500 border-gray-200'
                                                }`}>
                                                    <Medal size={12}/> {form.rank}
                                                </div>
                                            )}
                                            <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-700">{form.nationality}</div>
                                        </div>
                                    </div>
                                    
                                    <div className={`rounded-[2rem] p-6 shadow-sm border border-gray-200 transition-all ${attendanceSnapshot.late > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                                        <h4 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${attendanceSnapshot.late > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                            <CalendarDays size={14}/> 本月考勤 (This Month)
                                        </h4>
                                        <div className="flex justify-between text-center mb-4">
                                            <div>
                                                <div className={`text-2xl font-black ${attendanceSnapshot.late > 0 ? 'text-red-600' : 'text-gray-800'}`}>{attendanceSnapshot.late}</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase">Late</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black text-gray-800">{attendanceSnapshot.absent}</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase">Absent</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black text-green-600">{attendanceSnapshot.work}</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase">Work Days</div>
                                            </div>
                                        </div>
                                        {attendanceSnapshot.late > 0 && (
                                            <div className="bg-white/60 rounded-xl p-3 text-xs text-red-700 border border-red-100">
                                                <span className="font-bold">Late Dates:</span> {attendanceSnapshot.lateDates.join(', ')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Lock size={14}/> 登录密码 (Access PIN)</h4>
                                        <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between border border-gray-100">
                                            <div className="flex items-center gap-3"><div className="p-2 bg-white rounded-xl shadow-sm"><Lock size={16} className="text-gray-400"/></div><div><p className="text-[10px] font-bold text-gray-400 uppercase">PIN CODE</p><p className="text-lg font-mono font-black text-[#1A1A1A] tracking-widest">{showPin ? (form.pin || '0000') : '••••'}</p></div></div>
                                            <button onClick={() => setShowPin(!showPin)} className="p-2 text-gray-400 hover:text-black transition-colors">{showPin ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                                        </div>
                                    </div>

                                    <div className={`bg-[#1A1A1A] rounded-[2rem] shadow-lg text-white relative overflow-hidden group transition-all duration-300 ${form.isArchived ? 'grayscale opacity-80' : ''}`}>
                                        <button onClick={() => setIsSalaryExpanded(!isSalaryExpanded)} className="w-full p-6 flex justify-between items-center text-left relative z-10 hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-3 w-full">
                                                <div className="p-2 bg-white/10 rounded-full text-[#FFD700] shrink-0"><div className="font-mono text-lg">$</div></div>
                                                <div className="min-w-0 flex-1">
                                                    {isEditing ? (
                                                        <select value={form.salaryMode || 'MONTHLY'} onChange={(e) => setForm({...form, salaryMode: e.target.value as any})} onClick={e => e.stopPropagation()} className="bg-white/10 text-[#FFD700] text-[10px] font-bold uppercase tracking-widest border border-white/20 rounded px-1 outline-none cursor-pointer w-full max-w-[120px]"><option value="MONTHLY" className="text-black">Monthly (月薪)</option><option value="DAILY" className="text-black">Daily (日薪)</option><option value="HOURLY" className="text-black">Hourly (时薪)</option></select>
                                                    ) : (
                                                        <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest truncate">Salary ({form.salaryMode || 'MONTHLY'})</p>
                                                    )}
                                                    {!isSalaryExpanded && <p className="text-xs font-mono font-bold text-white/80">RM {(form.basicSalary || 0).toLocaleString()}</p>}
                                                </div>
                                                
                                                <div className="ml-2 border-l border-white/20 pl-4 hidden sm:block shrink-0">
                                                    <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">Rest Days</p>
                                                    {isEditing ? (
                                                        <select onClick={e => e.stopPropagation()} value={form.monthlyRestDays || 4} onChange={e => setForm({...form, monthlyRestDays: parseInt(e.target.value)})} className="bg-white/10 text-white text-xs font-bold rounded px-1 outline-none border border-white/20 mt-0.5">
                                                            <option className="text-black" value={2}>2 Days</option>
                                                            <option className="text-black" value={4}>4 Days</option>
                                                            <option className="text-black" value={6}>6 Days</option>
                                                            <option className="text-black" value={8}>8 Days</option>
                                                        </select>
                                                    ) : (
                                                        <p className="text-xs font-bold text-white/80">{form.monthlyRestDays || '-'} Days</p>
                                                    )}
                                                </div>

                                                <div className="ml-4 border-l border-white/20 pl-4 hidden sm:block shrink-0">
                                                    <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">Hostel</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Home size={12} className={form.hasHostel ? "text-green-400" : "text-white/30"} />
                                                        <p className={`text-xs font-bold ${form.hasHostel ? "text-green-400" : "text-white/30"}`}>
                                                            {form.hasHostel ? 'Yes' : 'No'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            {isSalaryExpanded ? <ChevronUp size={20} className="text-white/50 ml-2"/> : <ChevronDown size={20} className="text-white/50 ml-2"/>}
                                        </button>
                                        
                                        {isSalaryExpanded && (
                                            <div className="px-6 pb-6 relative z-10 animate-in slide-in-from-top-2">
                                                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                                                    <div className="sm:hidden flex-1 bg-white/10 p-3 rounded-xl border border-white/10">
                                                        <label className="text-[10px] font-bold text-[#FFD700] uppercase mb-1 block">Monthly Rest Days</label>
                                                        {isEditing ? (
                                                            <select value={form.monthlyRestDays || 4} onChange={e => setForm({...form, monthlyRestDays: parseInt(e.target.value)})} className="bg-white/10 text-white text-sm font-bold rounded p-2 w-full outline-none border border-white/20">
                                                                <option className="text-black" value={2}>2 Days (Foreigner)</option>
                                                                <option className="text-black" value={4}>4 Days (Standard)</option>
                                                                <option className="text-black" value={6}>6 Days</option>
                                                                <option className="text-black" value={8}>8 Days</option>
                                                            </select>
                                                        ) : (
                                                            <p className="text-sm font-bold text-white">{form.monthlyRestDays || '-'} Days</p>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 bg-white/10 p-3 rounded-xl border border-white/10 flex items-center justify-between">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-[#FFD700] uppercase mb-1 block">Hostel</label>
                                                            <div className="text-xs font-bold text-white flex items-center gap-1">
                                                                <Home size={14}/> {form.hasHostel ? 'Provided' : 'No'}
                                                            </div>
                                                        </div>
                                                        {isEditing && (
                                                            <input 
                                                                type="checkbox" 
                                                                checked={form.hasHostel || false} 
                                                                onChange={e => setForm({...form, hasHostel: e.target.checked})} 
                                                                className="w-5 h-5 accent-green-500 cursor-pointer"
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between mb-4">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2"><span className="text-sm text-white/50 font-bold">$</span><input type="number" value={form.basicSalary || 0} onChange={e => setForm({...form, basicSalary: parseFloat(e.target.value)})} className="bg-white/10 text-white rounded p-1 outline-none w-24 font-mono font-bold" /></div>
                                                    ) : (
                                                        <div className="text-3xl font-mono font-black">RM {(form.basicSalary || 0).toLocaleString()}</div>
                                                    )}
                                                    {isEditing && <button onClick={addSalaryRecord} className="text-[10px] bg-[#FFD700] text-black px-2 py-1 rounded font-bold">+ Increment</button>}
                                                </div>
                                                <div className="space-y-3 pt-4 border-t border-white/10 mb-4">
                                                    <div className="flex justify-between items-center text-xs"><span className="text-white/60">Bank</span>{isEditing ? <select value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value})} className="bg-white/10 text-white text-[10px] rounded p-1 outline-none"><option value="">Select</option>{BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}</select> : <span className="font-bold">{form.bankName || '-'}</span>}</div>
                                                    <div className="flex justify-between items-center text-xs"><span className="text-white/60">Account</span>{isEditing ? <input value={form.bankAccount || ''} onChange={e => setForm({...form, bankAccount: e.target.value})} className="bg-white/10 text-white text-[10px] rounded p-1 outline-none w-24 text-right" /> : <span className="font-mono font-bold">{form.bankAccount || '-'}</span>}</div>
                                                </div>
                                                <div className="pt-2 border-t border-white/10">
                                                    <p className="text-[9px] font-bold text-white/40 uppercase mb-2">History</p>
                                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">{form.salaryHistory?.length === 0 && <p className="text-[10px] text-white/30 italic">No records</p>}{form.salaryHistory?.map((rec, idx) => (<div key={idx} className="flex justify-between items-center text-[10px] bg-white/5 p-2 rounded"><div><div className="font-bold text-white/80">{rec.date}</div><div className="text-white/50">{rec.reason}</div></div><div className="text-right"><div className="font-mono font-bold text-[#FFD700]">RM {rec.amount}</div><div className={`${rec.adjustment >= 0 ? 'text-green-400' : 'text-red-400'}`}>{rec.adjustment >= 0 ? '+' : ''}{rec.adjustment}</div></div>{isEditing && <button onClick={() => deleteSalaryRecord(idx)} className="text-red-400 ml-2"><Trash2 size={10}/></button>}</div>))}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="xl:col-span-8 flex flex-col gap-6">
                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><User size={14}/> 个人档案 (Personal)</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                                            <InputField label="全名 (Full Name)" value={form.name} onChange={(e: any) => setForm({...form, name: e.target.value})} placeholder="Name" isEditing={isEditing} />
                                            <InputField label="IC / Passport" value={form.icNumber} onChange={(e: any) => setForm({...form, icNumber: e.target.value})} placeholder="ID" isEditing={isEditing} />
                                            <InputField label="手机 (Phone)" value={form.phone} onChange={(e: any) => setForm({...form, phone: e.target.value})} placeholder="012..." isEditing={isEditing} />
                                            <SelectField label="性别 (Gender)" value={form.gender} onChange={(e: any) => setForm({...form, gender: e.target.value})} options={['Male', 'Female']} isEditing={isEditing} />
                                            <SelectField label="国籍 (Nationality)" value={form.nationality} onChange={(e: any) => setForm({...form, nationality: e.target.value})} options={NATIONALITY_OPTS} isEditing={isEditing} />
                                            
                                            {/* UPDATED STATUS SELECT */}
                                            <SelectField 
                                                label="雇佣状态 (Employment Status)" 
                                                value={form.status} 
                                                onChange={(e: any) => setForm({...form, status: e.target.value})} 
                                                options={[
                                                    {label:'正式 (Confirmed)', value:'CONFIRMED'}, 
                                                    {label:'试用 (Probation)', value:'PROBATION'}, 
                                                    {label:'离职 (Terminated)', value:'TERMINATED'}
                                                ]} 
                                                isEditing={isEditing} 
                                            />

                                            {/* NEW RANK SELECT */}
                                            <SelectField 
                                                label="组织职级 (Org Rank)" 
                                                value={form.rank || 'CREW'} 
                                                onChange={(e: any) => setForm({...form, rank: e.target.value})} 
                                                options={[
                                                    {label:'最高指挥 (Top Command)', value:'TOP'}, 
                                                    {label:'管理层 (Management)', value:'MANAGEMENT'}, 
                                                    {label:'部门主管 (Head/Leader)', value:'HEAD'}, 
                                                    {label:'负责人 (PIC)', value:'PIC'}, 
                                                    {label:'普通员工 (Crew/Junior)', value:'CREW'}
                                                ]} 
                                                isEditing={isEditing} 
                                            />
                                            
                                            <div className="grid grid-cols-2 gap-2"><InputField label="身高 (cm)" type="number" value={form.height} onChange={(e: any) => setForm({...form, height: parseInt(e.target.value)})} placeholder="cm" isEditing={isEditing} /><InputField label="体重 (kg)" type="number" value={form.weight} onChange={(e: any) => setForm({...form, weight: parseInt(e.target.value)})} placeholder="kg" isEditing={isEditing} /></div>
                                            <SelectField label="制服尺寸 (Size)" value={form.shirtSize} onChange={(e: any) => setForm({...form, shirtSize: e.target.value})} options={SHIRT_SIZES} isEditing={isEditing} />
                                            <InputField label="入职日期 (Join Date)" value={form.joinDate} onChange={(e: any) => setForm({...form, joinDate: e.target.value})} type="date" isEditing={isEditing} />
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-50"><InputField label="住址 (Address)" value={form.address} onChange={(e: any) => setForm({...form, address: e.target.value})} placeholder="Full Address" isEditing={isEditing} /></div>
                                    </div>

                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Briefcase size={14}/> 政府与卫生 (Govt & Health)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-blue-50 rounded text-blue-600"><Shield size={14}/></div><span className="text-xs font-bold text-gray-700">法定缴纳 (Statutory)</span></div>
                                                <div className="grid grid-cols-2 gap-4"><InputField label="EPF No" value={form.epfNo} onChange={(e: any) => setForm({...form, epfNo: e.target.value})} placeholder="KWSP" isEditing={isEditing} /><InputField label="SOCSO No" value={form.socsoNo} onChange={(e: any) => setForm({...form, socsoNo: e.target.value})} placeholder="PERKESO" isEditing={isEditing} /></div>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-green-50 rounded text-green-600"><Stethoscope size={14}/></div><span className="text-xs font-bold text-gray-700">卫生认证 (Health)</span></div>
                                                <div className="grid grid-cols-2 gap-4"><InputField label="打针有效期 (Typhoid)" value={form.typhoidExpiry} onChange={(e: any) => setForm({...form, typhoidExpiry: e.target.value})} type="date" isEditing={isEditing} /><InputField label="餐馆课程 (Course Date)" value={form.foodHandlingDate} onChange={(e: any) => setForm({...form, foodHandlingDate: e.target.value})} type="date" isEditing={isEditing} /></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Phone size={14}/> 紧急联系人 (Emergency Contact)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><InputField label="联系人姓名 (Name)" value={form.emergencyName} onChange={(e: any) => setForm({...form, emergencyName: e.target.value})} placeholder="Relative Name" isEditing={isEditing} /><InputField label="联系电话 (Phone)" value={form.emergencyPhone} onChange={(e: any) => setForm({...form, emergencyPhone: e.target.value})} placeholder="Emergency Phone" isEditing={isEditing} /></div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                                            <div className="flex justify-between items-center mb-4"><h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Activity size={14}/> 综合能力 (Ability)</h4>{isEditing && <button onClick={() => setShowAbilityModal(true)} className="text-[10px] bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 font-bold">Edit</button>}</div>
                                            <AbilityRadar attributes={form.attributes} />
                                        </div>
                                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                                            <div className="flex justify-between items-center mb-4"><h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Shield size={14}/> 系统权限 (Access)</h4>{isEditing && <button onClick={() => setShowAccessModal(true)} className="text-[10px] bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 font-bold">Config</button>}</div>
                                            <div className="flex flex-wrap gap-2">{(!form.allowedModules || form.allowedModules.length === 0) && <span className="text-xs text-gray-400 italic">No access granted</span>}{form.allowedModules?.map(mod => (<span key={mod} className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">{MODULE_DEFINITIONS[mod]?.label.split('(')[0]}</span>))}</div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                                        <div className="flex justify-between items-center mb-6"><h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14}/> 奖惩记录 (Disciplinary)</h4>{isEditing && !showWarningInput && <button onClick={() => setShowWarningInput(true)} className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded font-bold border border-red-100 hover:bg-red-100">+ Add Warning</button>}</div>
                                        {showWarningInput && (<div className="bg-red-50 p-4 rounded-xl mb-4 border border-red-100 animate-in slide-in-from-top-2"><div className="flex gap-2 mb-2">{DISCIPLINARY_TYPES.map(t => (<button key={t.id} onClick={() => setWarnType(t.id)} className={`flex-1 py-1 text-[10px] font-bold rounded ${warnType === t.id ? 'bg-red-600 text-white' : 'bg-white text-gray-500 border'}`}>{t.label}</button>))}</div><input className="w-full p-2 text-xs border border-gray-200 rounded mb-2 bg-white text-[#1A1A1A] outline-none" placeholder="违规原因 (e.g. Late, Mistakes)" value={warnReason} onChange={e => setWarnReason(e.target.value)} /><div className="flex gap-2"><button onClick={() => setShowWarningInput(false)} className="flex-1 py-1 bg-white text-gray-500 text-xs rounded font-bold">Cancel</button><button onClick={confirmAddWarning} className="flex-1 py-1 bg-red-600 text-white text-xs rounded font-bold">Confirm</button></div></div>)}
                                        <div className="space-y-2">{(!form.warningHistory || form.warningHistory.length === 0) && <p className="text-center text-xs text-gray-300 italic py-4">无违规记录 (Clean Record)</p>}{form.warningHistory?.map((warn, idx) => { const typeConfig = DISCIPLINARY_TYPES.find(t => t.id === warn.type); return (<div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"><div className="flex items-center gap-3"><div className={`text-[10px] font-black px-2 py-1 rounded uppercase ${typeConfig?.color}`}>{typeConfig?.label}</div><div><div className="text-xs font-bold text-[#1A1A1A]">{warn.reason}</div><div className="text-[10px] text-gray-400">{warn.date} • by {warn.issuer}</div></div></div>{isEditing && <button onClick={() => { const h = [...(form.warningHistory||[])]; h.splice(idx,1); setForm({...form, warningHistory: h}); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>}</div>); })}</div>
                                    </div>

                                    {isEditing && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
                                            <button onClick={handleResetPin} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"><Lock size={14}/> 重置密码 (Reset PIN)</button>
                                            {form.isArchived ? (
                                                <button onClick={handleRestore} className="flex-1 py-3 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"><CheckCircle2 size={14}/> 复职 (Restore)</button>
                                            ) : (
                                                <button onClick={handleTerminateClick} className="flex-1 py-3 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"><Ban size={14}/> 离职 (Terminate)</button>
                                            )}
                                            <button onClick={() => setShowDeleteModal(true)} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors hover:bg-red-700 shadow-md"><Trash2 size={14}/> 永久删除</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
            
            {/* ... (Keep existing Review Modal, Ability Modal, Access Modal, etc.) ... */}
            {/* The rest of the file content remains unchanged, including the Review Modal, Access Modal, Ability Modal, and PDF printing logic */}
            {/* Just ensuring closing brackets are present */}
            {showReviewModal && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-[#1A1A1A]">员工表现评语 (Reviews)</h3>
                            <button onClick={() => setShowReviewModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto space-y-3 mb-6 pr-2">
                            {(!form.reviews || form.reviews.length === 0) && (
                                <div className="text-center py-10 text-gray-400 italic text-sm">暂无评语记录</div>
                            )}
                            {form.reviews?.map(review => (
                                <div key={review.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 ${
                                                review.type === 'PRAISE' ? 'bg-green-100 text-green-700' : 
                                                review.type === 'CRITICISM' ? 'bg-red-100 text-red-700' : 
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {review.type === 'PRAISE' && <ThumbsUp size={10}/>}
                                                {review.type === 'CRITICISM' && <ThumbsDown size={10}/>}
                                                {review.type === 'NOTE' && <StickyNote size={10}/>}
                                                {review.type === 'PRAISE' ? '表扬' : review.type === 'CRITICISM' ? '改进' : '备注'}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-mono">{review.date}</span>
                                        </div>
                                        <button onClick={() => handleDeleteReview(review.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                    <p className="text-sm font-bold text-gray-700 whitespace-pre-wrap">{review.content}</p>
                                    {review.image && (
                                        <div className="mt-2 relative group/img cursor-pointer" onClick={() => setViewImage(review.image || null)}>
                                            <img src={review.image} className="w-20 h-20 rounded-lg object-cover border border-gray-200 hover:opacity-90 transition-opacity" />
                                            <div className="absolute top-0 left-0 bg-black/40 w-20 h-20 rounded-lg flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                                <Eye size={16} className="text-white"/>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-100 pt-4 space-y-3">
                            <div className="flex gap-2">
                                <button onClick={() => setReviewFormState({...reviewFormState, type: 'PRAISE'})} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${reviewFormState.type === 'PRAISE' ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : 'bg-gray-50 text-gray-500'}`}><ThumbsUp size={14}/> 表扬 (Praise)</button>
                                <button onClick={() => setReviewFormState({...reviewFormState, type: 'NOTE'})} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${reviewFormState.type === 'NOTE' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-50 text-gray-500'}`}><StickyNote size={14}/> 备注 (Note)</button>
                                <button onClick={() => setReviewFormState({...reviewFormState, type: 'CRITICISM'})} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${reviewFormState.type === 'CRITICISM' ? 'bg-red-100 text-red-700 ring-2 ring-red-500' : 'bg-gray-50 text-gray-500'}`}><ThumbsDown size={14}/> 待改进 (Improve)</button>
                            </div>
                            <textarea 
                                value={reviewFormState.content}
                                onChange={e => setReviewFormState({...reviewFormState, content: e.target.value})}
                                className="w-full p-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-[#1A1A1A] h-24 resize-none placeholder:font-normal"
                                placeholder="请输入评语内容..."
                            />
                            
                            <div className="flex gap-2 items-center">
                                {/* Image Upload for Review */}
                                <div className="relative">
                                    {reviewFormState.image ? (
                                        <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden relative group">
                                            <img src={reviewFormState.image} className="w-full h-full object-cover"/>
                                            <button 
                                                onClick={() => setReviewFormState(prev => ({...prev, image: ''}))}
                                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} className="text-white"/>
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => reviewFileInputRef.current?.click()}
                                            disabled={isUploadingReviewImage}
                                            className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                                        >
                                            {isUploadingReviewImage ? <Loader2 size={16} className="animate-spin text-gray-400"/> : <Camera size={18} className="text-gray-500"/>}
                                        </button>
                                    )}
                                    <input type="file" ref={reviewFileInputRef} className="hidden" accept="image/*" onChange={handleReviewImageUpload} />
                                </div>
                                
                                <button onClick={handleAddReview} disabled={isUploadingReviewImage} className="flex-grow bg-[#1A1A1A] text-[#FFD700] py-3 rounded-xl font-black shadow-lg hover:bg-black transition-all disabled:opacity-70">
                                    {isUploadingReviewImage ? 'Uploading...' : '提交记录 (Add Record)'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {viewImage && (
                <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setViewImage(null)}>
                    <button className="absolute top-4 right-4 text-white/50 hover:text-white p-2" onClick={() => setViewImage(null)}>
                        <X size={32}/>
                    </button>
                    <img src={viewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}/>
                </div>
            )}

            <AbilityAssessmentModal isOpen={showAbilityModal} onClose={() => setShowAbilityModal(false)} attributes={form.attributes} onChange={(newAttr: EmployeeAttributes) => setForm({...form, attributes: newAttr})} />
            
            <SystemAccessModal 
                isOpen={showAccessModal} 
                onClose={() => setShowAccessModal(false)} 
                allowedModules={form.allowedModules || []} 
                onToggle={(mod: AppModule) => handleToggleModule(mod)}
                assessmentTargets={form.assessmentTargets || []}
                onUpdateTargets={handleUpdateAssessmentTargets}
                allEmployees={employees}
            />

            {showTerminateModal && (<div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95"><div className="text-center mb-6"><div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><LogOut size={32}/></div><h3 className="font-black text-xl text-[#1A1A1A] mb-1">办理离职手续</h3><p className="text-xs text-gray-500 font-bold">Terminate Employee Account</p></div><div className="space-y-4 mb-6"><div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Last Working Day (离职日期)</label><input type="date" value={terminationData.date} onChange={e => setTerminationData({...terminationData, date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"/></div><div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Reason (离职原因)</label><textarea value={terminationData.reason} onChange={e => setTerminationData({...terminationData, reason: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none h-24 resize-none focus:border-red-300 transition-colors" placeholder="请输入原因 (e.g. Resigned, Fired...)"/></div></div><div className="grid grid-cols-2 gap-3"><button onClick={() => setShowTerminateModal(false)} className="py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-200">取消</button><button onClick={confirmTermination} className="py-3 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 shadow-lg">确认离职</button></div></div></div>)}
            {showDeleteModal && (<div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 text-center border-t-8 border-red-600"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><Trash2 size={32} className="text-red-600"/></div><h3 className="font-black text-2xl text-[#1A1A1A] mb-2">确认永久删除?</h3><p className="text-sm text-gray-500 font-bold mb-6">此操作将永久移除该员工的所有资料、薪资记录且<span className="text-red-600 underline">无法恢复</span>。</p><div className="grid grid-cols-2 gap-4"><button onClick={() => setShowDeleteModal(false)} className="py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200">取消 (Cancel)</button><button onClick={confirmDelete} className="py-3 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 shadow-xl">确认删除 (Delete)</button></div></div></div>)}
            <div style={{ position: 'absolute', top: 0, left: '-9999px' }}><div ref={printRef} className="w-[794px] bg-white p-10 font-sans text-black min-h-[1123px] relative"><div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end"><div><h1 className="text-3xl font-black uppercase tracking-widest mb-1">Kim Lian Kee</h1><p className="text-xs font-bold text-gray-500 uppercase tracking-[0.3em]">Employee Directory</p></div><div className="text-right"><p className="text-xs font-bold text-gray-400">{new Date().toLocaleDateString()}</p><p className="text-sm font-black">Total Staff: {filteredEmployees.length}</p></div></div><table className="w-full text-left text-xs"><thead><tr className="border-b-2 border-black"><th className="py-2 uppercase font-black">ID</th><th className="py-2 uppercase font-black">Name</th><th className="py-2 uppercase font-black">Role</th><th className="py-2 uppercase font-black">Phone</th><th className="py-2 uppercase font-black">Status</th><th className="py-2 uppercase font-black">Join Date</th></tr></thead><tbody>{filteredEmployees.map((emp, i) => (<tr key={emp.id} className="border-b border-gray-100"><td className="py-3 font-mono font-bold text-gray-500">{emp.id}</td><td className="py-3 font-bold">{emp.name}</td><td className="py-3 font-medium text-gray-700">{emp.role.split('(')[0]}</td><td className="py-3 font-mono">{emp.phone || '-'}</td><td className="py-3"><span className={`px-1 py-0.5 rounded text-[10px] font-bold uppercase ${emp.status === 'CONFIRMED' ? 'bg-green-100' : 'bg-gray-100'}`}>{emp.status}</span></td><td className="py-3 font-mono text-gray-500">{emp.joinDate}</td></tr>))}</tbody></table><div className="absolute bottom-10 left-0 w-full text-center"><p className="text-[9px] font-bold uppercase tracking-[0.5em] text-gray-300">Confidential • Internal Use Only</p></div></div></div>
            <div style={{ position: 'absolute', top: 0, left: '-9999px' }}><div ref={singleProfileRef} className="w-[794px] bg-white p-12 font-sans text-black min-h-[1123px] relative flex flex-col"><div className="flex justify-between items-start border-b-4 border-[#8B0000] pb-6 mb-8"><div><h1 className="text-4xl font-black uppercase tracking-wider text-[#1A1A1A] mb-1">{form.name || 'EMPLOYEE NAME'}</h1><p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{form.role || 'ROLE'}</p><div className="mt-4 flex gap-4 text-xs font-mono text-gray-600"><span className="bg-gray-100 px-2 py-1 rounded">ID: {form.id}</span><span className="bg-gray-100 px-2 py-1 rounded">JOINED: {form.joinDate}</span><span className="bg-gray-100 px-2 py-1 rounded">STATUS: {form.status}</span></div></div><div className="w-24 h-24 bg-gray-200 border-2 border-gray-300 flex items-center justify-center overflow-hidden">{form.avatar ? <img src={form.avatar} className="w-full h-full object-cover" /> : <span className="text-4xl text-gray-400 font-black">{form.name?.charAt(0)}</span>}</div></div><div className="grid grid-cols-2 gap-x-12 gap-y-8"><div className="col-span-2"><h3 className="text-sm font-black uppercase border-b border-gray-300 pb-2 mb-4">Personal Information</h3><div className="grid grid-cols-3 gap-y-4 text-xs"><div><span className="block text-gray-400 font-bold uppercase text-[10px]">IC / Passport</span><span className="font-mono font-bold text-sm">{form.icNumber || '-'}</span></div><div><span className="block text-gray-400 font-bold uppercase text-[10px]">Phone</span><span className="font-mono font-bold text-sm">{form.phone || '-'}</span></div><div><span className="block text-gray-400 font-bold uppercase text-[10px]">Nationality</span><span className="font-bold text-sm">{form.nationality || '-'}</span></div><div><span className="block text-gray-400 font-bold uppercase text-[10px]">Gender</span><span className="font-bold text-sm">{form.gender || '-'}</span></div><div><span className="block text-gray-400 font-bold uppercase text-[10px]">Shirt Size</span><span className="font-bold text-sm">{form.shirtSize || '-'}</span></div><div><span className="block text-gray-400 font-bold uppercase text-[10px]">Tenure</span><span className="font-bold text-sm">{getTenure(form.joinDate || '')}</span></div><div className="col-span-3"><span className="block text-gray-400 font-bold uppercase text-[10px]">Address</span><span className="font-bold text-sm">{form.address || '-'}</span></div></div></div><div><h3 className="text-sm font-black uppercase border-b border-gray-300 pb-2 mb-4">Employment Details</h3><div className="space-y-3 text-xs"><div className="flex justify-between border-b border-gray-100 pb-1"><span>Basic Salary</span><span className="font-mono font-bold">RM {form.basicSalary?.toLocaleString() || '0'}</span></div><div className="flex justify-between border-b border-gray-100 pb-1"><span>Salary Mode</span><span className="font-bold">{form.salaryMode}</span></div><div className="flex justify-between border-b border-gray-100 pb-1"><span>Rest Days</span><span className="font-bold">{form.monthlyRestDays || '-'} Days</span></div><div className="flex justify-between border-b border-gray-100 pb-1"><span>Bank Name</span><span className="font-bold">{form.bankName || '-'}</span></div><div className="flex justify-between border-b border-gray-100 pb-1"><span>Bank Account</span><span className="font-mono font-bold">{form.bankAccount || '-'}</span></div><div className="flex justify-between border-b border-gray-100 pb-1"><span>EPF No</span><span className="font-mono font-bold">{form.epfNo || '-'}</span></div><div className="flex justify-between border-b border-gray-100 pb-1"><span>SOCSO No</span><span className="font-mono font-bold">{form.socsoNo || '-'}</span></div></div></div><div><h3 className="text-sm font-black uppercase border-b border-gray-300 pb-2 mb-4">Health & Emergency</h3><div className="space-y-3 text-xs"><div><span className="block text-gray-400 font-bold uppercase text-[10px]">Emergency Contact</span><span className="font-bold text-sm">{form.emergencyName || '-'}</span></div><div><span className="block text-gray-400 font-bold uppercase text-[10px]">Emergency Phone</span><span className="font-mono font-bold text-sm">{form.emergencyPhone || '-'}</span></div><div><span className="block text-gray-400 font-bold uppercase text-[10px]">Typhoid Injection</span><span className="font-mono font-bold text-sm">{form.typhoidExpiry || '-'}</span></div><div><span className="block text-gray-400 font-bold uppercase text-[10px]">Food Course Date</span><span className="font-mono font-bold text-sm">{form.foodHandlingDate || '-'}</span></div></div></div><div className="col-span-2"><h3 className="text-sm font-black uppercase border-b border-gray-300 pb-2 mb-4">Performance Assessment</h3><div className="grid grid-cols-5 gap-2 text-center">{Object.entries(form.attributes || { efficiency:0, service:0, culinary:0, leadership:0, discipline:0 }).map(([key, val]) => (<div key={key} className="border border-gray-200 p-2 rounded"><div className="text-[10px] text-gray-500 uppercase font-bold mb-1">{key}</div><div className="text-lg font-black">{getGradeInfo(val as number).label} <span className="text-xs font-normal text-gray-400">({val as number})</span></div></div>))}</div></div><div className="col-span-2"><h3 className="text-sm font-black uppercase border-b border-gray-300 pb-2 mb-4">Disciplinary Record</h3>{(!form.warningHistory || form.warningHistory.length === 0) ? (<p className="text-xs text-gray-400 italic">No disciplinary records found.</p>) : (<table className="w-full text-left text-xs"><thead><tr className="bg-gray-100"><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Reason</th><th className="p-2">Issuer</th></tr></thead><tbody>{form.warningHistory.map((w, i) => (<tr key={i} className="border-b border-gray-100"><td className="p-2 font-mono">{w.date}</td><td className="p-2 font-bold uppercase">{w.type}</td><td className="p-2">{w.reason}</td><td className="p-2">{w.issuer}</td></tr>))}</tbody></table>)}</div></div><div className="mt-auto pt-8 border-t-2 border-black flex justify-between items-end"><div><p className="text-lg font-black uppercase tracking-widest">Kim Lian Kee</p><p className="text-[10px] text-gray-500 font-bold uppercase">Human Resources Department</p></div><div className="text-right"><p className="text-[10px] text-gray-400 uppercase">Generated on {new Date().toLocaleDateString()}</p><p className="text-[10px] text-gray-400 uppercase">Confidential Document</p></div></div></div></div>
        </div>
    );
};
