
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Users, User, DollarSign, Globe, Briefcase, X, BarChart3, Layers, Layout, ChevronRight, Crown, ChefHat, Coffee, Droplets, Sparkles, Utensils, Star, ShieldCheck, Flame, Move, FileDown, Loader2, ChevronDown } from 'lucide-react';
import { Employee } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

// --- INTERFACES & UTILS ---
interface OrgChartProps {
    onClose: () => void;
}

const formatMoney = (val: number | string | undefined) => {
    const num = Number(val);
    if (isNaN(num)) return 'RM 0';
    return `RM ${num.toLocaleString()}`;
};

// --- SUB-COMPONENT: MEMBER CARD ---
interface MemberCardProps {
    emp: Employee;
    isLeader?: boolean;
}

const MemberCard: React.FC<MemberCardProps> = ({ emp, isLeader = false }) => (
    <div className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all hover:shadow-md h-full ${isLeader ? 'bg-white border-yellow-400 ring-1 ring-yellow-100' : 'bg-white border-gray-100'}`}>
        {/* Avatar: Fixed shrink-0 to prevent squashing during PDF export */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 overflow-hidden border mt-0.5 ${isLeader ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
            {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover"/> : emp.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                {/* Name: break-words to handle long names gracefully */}
                <span className="font-bold text-xs text-[#1A1A1A] break-words leading-tight">{emp.name}</span>
                {isLeader && <span className="text-[7px] font-black bg-yellow-400 text-black px-1 rounded uppercase shrink-0">LEAD</span>}
                {emp.rank === 'PIC' && !isLeader && <span className="text-[7px] font-black bg-purple-200 text-purple-800 px-1 rounded uppercase shrink-0">PIC</span>}
            </div>
            {/* Role */}
            <div className="text-[9px] text-gray-400 font-bold break-words leading-tight">{emp.role.split('(')[0]}</div>
        </div>
    </div>
);

// --- SUB-COMPONENT: TEAM GROUP ---
// Used for "Cutter", "Runner", "Floor Team" etc.
interface TeamGroupProps {
    title: string;
    icon: any;
    members: Employee[];
    colorClass: string;
    borderColor: string;
}

const TeamGroup: React.FC<TeamGroupProps> = ({ title, icon, members, colorClass, borderColor }) => {
    // Separate Lead (PIC or specific role) from Crew
    const leads = members.filter(m => 
        m.rank === 'PIC' || 
        m.rank === 'HEAD' || 
        m.role.toLowerCase().includes('lead') || 
        m.role.toLowerCase().includes('head')
    );
    const crew = members.filter(m => !leads.includes(m));

    // Sort: Leads first, then by salary/seniority
    const sorted = [...leads, ...crew.sort((a,b) => (Number(b.basicSalary)||0) - (Number(a.basicSalary)||0))];

    return (
        <div className={`rounded-2xl border p-3 flex flex-col h-full ${colorClass} ${borderColor}`}>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/5 shrink-0">
                {icon}
                <span className="text-xs font-black uppercase tracking-wider opacity-80">{title}</span>
                <span className="ml-auto text-[9px] font-bold bg-white/50 px-1.5 py-0.5 rounded-full">{members.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 content-start">
                {sorted.length > 0 ? (
                    sorted.map(m => <MemberCard key={m.id} emp={m} isLeader={leads.includes(m)} />)
                ) : (
                    <div className="text-center py-4 text-[10px] opacity-40 italic font-bold">暂无成员 (Empty)</div>
                )}
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: STAT CARD ---
const StatCard = ({ label, value, icon, color, sub, valueColor = 'text-[#1A1A1A]' }: any) => (
    <div className={`${color} p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group`}>
        <div className="flex items-center gap-2 text-gray-400 mb-2 font-bold text-[10px] uppercase tracking-wider">
            {icon} {label}
        </div>
        <div className={`text-3xl font-black ${valueColor} tracking-tight`}>{value}</div>
        {sub && <div className="text-xs font-bold text-gray-400 mt-1">{sub} of total</div>}
    </div>
);

// --- SUB-COMPONENT: PROFILE HEADER ---
interface ProfileHeaderProps {
    emp: Employee;
    title: string;
    colorClass: string;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ emp, title, colorClass }) => (
    <div className={`flex items-center gap-4 p-3 rounded-2xl border-2 shadow-sm ${colorClass}`}>
        <div className="w-14 h-14 rounded-full bg-white border-2 border-white shadow-sm overflow-hidden shrink-0 flex items-center justify-center text-lg font-black text-gray-400">
            {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover"/> : emp.name.charAt(0)}
        </div>
        <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5 truncate">{title}</div>
            <div className="font-black text-base leading-tight break-words">{emp.name}</div>
            <div className="text-[9px] font-bold opacity-80">{emp.id}</div>
        </div>
    </div>
);

export const OrgChart: React.FC<OrgChartProps> = ({ onClose }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [viewMode, setViewMode] = useState<'ANALYTICS' | 'STRUCTURE'>('STRUCTURE');
    
    // PDF Export Refs
    const chartRef = useRef<HTMLDivElement>(null);    // Full Chart
    const opsRef = useRef<HTMLDivElement>(null);      // Operations Section
    const kitchenRef = useRef<HTMLDivElement>(null);  // Kitchen Section
    
    const [isExporting, setIsExporting] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    
    useEffect(() => {
        const loadData = async () => {
            const data = await DataManager.getEmployees();
            setEmployees(data);
        };
        loadData();
    }, []);

    // --- PDF EXPORT HANDLER ---
    const handleExportPDF = async (targetRef: React.RefObject<HTMLDivElement>, filenameSuffix: string) => {
        if (!targetRef.current) return;
        setIsExporting(true);
        setShowExportMenu(false);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const canvas = await html2canvas(targetRef.current, {
                scale: 2.5,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                ignoreElements: (element) => element.classList.contains('no-print')
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const orientation = imgWidth > imgHeight ? 'l' : 'p';
            const pdf = new jsPDF(orientation, 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const widthRatio = (pdfWidth - 20) / imgWidth;
            const heightRatio = (pdfHeight - 20) / imgHeight;
            const ratio = Math.min(widthRatio, heightRatio);
            const w = imgWidth * ratio;
            const h = imgHeight * ratio;
            const x = (pdfWidth - w) / 2;
            const y = (pdfHeight - h) / 2;

            pdf.addImage(imgData, 'JPEG', x, y, w, h);
            pdf.save(`OrgChart_${filenameSuffix}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("Export Error:", error);
            alert("导出 PDF 失败，请重试 (Export Failed)");
        } finally {
            setIsExporting(false);
        }
    };

    // --- HIERARCHY LOGIC REWRITE ---
    const { stats, hierarchy } = useMemo(() => {
        const activeStaff = employees.filter(e => !e.isArchived && !e.role.includes('Owner') && !e.role.includes('老板'));
        
        // --- 1. STORE MANAGER (TOP) ---
        const storeManagers = activeStaff.filter(e => 
            e.rank === 'TOP' && (e.role.toLowerCase().includes('manager') || e.role.includes('经理')) || 
            (!e.rank && (e.role.toLowerCase().includes('store manager') || e.role.includes('门店经理')))
        );
        
        // --- 2. OPERATIONS DIVISION ---
        const opsSupervisor = activeStaff.filter(e => 
            e.rank === 'MANAGEMENT' || 
            (!e.rank && (e.role.toLowerCase().includes('supervisor') || e.role.includes('运营主管')))
        );
        
        const floorTeam: Employee[] = [];
        const barTeam: Employee[] = [];
        const hygieneTeam: Employee[] = [];

        // --- 3. KITCHEN DIVISION ---
        const execChef = activeStaff.filter(e => 
            e.rank === 'TOP' && (e.role.toLowerCase().includes('chef') || e.role.includes('总厨')) || 
            (!e.rank && (e.role.toLowerCase().includes('executive chef') || e.role.includes('行政总厨')))
        );
        
        const headChefs: Employee[] = [];
        const asstChefs: Employee[] = [];
        const kitchenPics: Employee[] = [];
        const kitchenCooks: Employee[] = [];
        const cutterTeam: Employee[] = [];
        const runnerTeam: Employee[] = [];
        const fryerTeam: Employee[] = [];
        
        activeStaff.forEach(emp => {
            if (storeManagers.includes(emp) || opsSupervisor.includes(emp) || execChef.includes(emp)) return;

            const r = emp.role.toLowerCase();
            const roleName = emp.role.toUpperCase();

            // OPERATIONS BUCKET
            if (roleName.includes('BAR') || roleName.includes('水吧')) {
                barTeam.push(emp);
            } else if (roleName.includes('CLEANER') || roleName.includes('DISH') || roleName.includes('清洁') || roleName.includes('洗碗')) {
                hygieneTeam.push(emp);
            } else if (['CAPTAIN', 'WAITER', 'COUNTER', '楼面', '服务', '写单', '柜台', 'PART_TIME', '兼职'].some(k => roleName.includes(k))) {
                floorTeam.push(emp);
            }
            // KITCHEN BUCKET
            else {
                if (emp.rank === 'HEAD' || r.includes('head chef') || r.includes('头手')) {
                    headChefs.push(emp);
                } else if (r.includes('assistant chef') || r.includes('帮锅') || r.includes('sous') || r.includes('副厨')) {
                    asstChefs.push(emp);
                } else if (emp.rank === 'PIC') {
                    kitchenPics.push(emp);
                } else if (r.includes('cook') || r.includes('厨师') || r.includes('kitchen cook')) {
                    kitchenCooks.push(emp);
                } else if (r.includes('cutter') || r.includes('占板')) {
                    cutterTeam.push(emp);
                } else if (r.includes('fryer') || r.includes('打荷')) {
                    fryerTeam.push(emp);
                } else if (r.includes('commis') || r.includes('runner') || r.includes('马王') || r.includes('helper') || r.includes('帮手')) {
                    runnerTeam.push(emp);
                } else {
                    runnerTeam.push(emp); 
                }
            }
        });

        // Analytics Data
        let totalBurnRate = 0;
        let localCount = 0;
        let foreignCount = 0;
        const roleGroups: Record<string, { employees: Employee[], cost: number }> = {};
        
        activeStaff.forEach(emp => {
            totalBurnRate += (Number(emp.basicSalary) || 0);
            if (emp.nationality.includes('Malaysian') || emp.nationality.includes('🇲🇾')) localCount++; else foreignCount++;
            const roleKey = emp.role.split('(')[0].trim();
            if (!roleGroups[roleKey]) roleGroups[roleKey] = { employees: [], cost: 0 };
            roleGroups[roleKey].employees.push(emp);
            roleGroups[roleKey].cost += (Number(emp.basicSalary) || 0);
        });

        return {
            stats: { totalCount: activeStaff.length, totalBurnRate, localCount, foreignCount, roleGroups },
            hierarchy: {
                storeManagers,
                ops: { supervisor: opsSupervisor, floor: floorTeam, bar: barTeam, hygiene: hygieneTeam },
                kitchen: {
                    exec: execChef,
                    core: { head: headChefs, asst: asstChefs, pic: kitchenPics },
                    teams: { cook: kitchenCooks, cutter: cutterTeam, runner: runnerTeam, fryer: fryerTeam }
                }
            }
        };
    }, [employees]);

    return (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-[#F5F7FA] w-full h-full md:max-w-7xl md:h-[95vh] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl relative font-sans">
                
                {/* Header */}
                <div className="bg-[#1A1A1A] p-4 flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700] safe-area-top z-20">
                    <div>
                        <h3 className="font-serif font-black text-lg md:text-xl text-[#FFD700] flex items-center gap-2">
                            <Layers className="text-white" size={20}/> <span className="hidden sm:inline">组织结构图 (Org Structure)</span><span className="sm:hidden">组织架构</span>
                        </h3>
                    </div>
                    <div className="flex gap-2 items-center">
                        <div className="relative">
                            <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={isExporting} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50">
                                {isExporting ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} <span className="hidden md:inline">导出 PDF</span><ChevronDown size={14} />
                            </button>
                            {showExportMenu && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in slide-in-from-top-2">
                                    <button onClick={() => handleExportPDF(chartRef, 'FULL')} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm font-bold text-gray-700 flex items-center gap-2"><Layers size={14}/> 完整架构 (All)</button>
                                    <div className="h-px bg-gray-100"></div>
                                    <button onClick={() => handleExportPDF(opsRef, 'OPS')} className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm font-bold text-blue-700 flex items-center gap-2"><Briefcase size={14}/> 仅运营部 (Ops)</button>
                                    <button onClick={() => handleExportPDF(kitchenRef, 'KITCHEN')} className="w-full text-left px-4 py-3 hover:bg-orange-50 text-sm font-bold text-orange-700 flex items-center gap-2"><ChefHat size={14}/> 仅厨房部 (Kitchen)</button>
                                </div>
                            )}
                        </div>
                        <div className="flex bg-white/10 p-1 rounded-lg">
                            <button onClick={() => setViewMode('STRUCTURE')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'STRUCTURE' ? 'bg-[#FFD700] text-black shadow-sm' : 'text-white hover:bg-white/10'}`}><Layout size={14}/> <span className="hidden md:inline">架构 (Chart)</span></button>
                            <button onClick={() => setViewMode('ANALYTICS')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'ANALYTICS' ? 'bg-[#FFD700] text-black shadow-sm' : 'text-white hover:bg-white/10'}`}><BarChart3 size={14}/> <span className="hidden md:inline">分析 (Data)</span></button>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full active:scale-95 transition-transform"><X size={20}/></button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-grow overflow-auto p-4 md:p-6 bg-[#F5F7FA]">
                    {viewMode === 'STRUCTURE' && (
                        <div ref={chartRef} className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
                            
                            {/* LEVEL 1: STORE MANAGER */}
                            <div className="flex justify-center mb-8">
                                {hierarchy.storeManagers.length > 0 ? hierarchy.storeManagers.map(mgr => (
                                    <div key={mgr.id} className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-5 rounded-[2rem] shadow-2xl border-4 border-[#FFD700] w-full max-w-md relative overflow-hidden">
                                        <div className="absolute -right-4 -top-4 text-white/5 rotate-12"><Crown size={120}/></div>
                                        <div className="flex items-center gap-5 relative z-10">
                                            <div className="w-20 h-20 rounded-2xl bg-white border-2 border-[#FFD700] shadow-lg overflow-hidden shrink-0">
                                                {mgr.avatar ? <img src={mgr.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-purple-900 font-black text-2xl">{mgr.name.charAt(0)}</div>}
                                            </div>
                                            <div>
                                                <div className="bg-[#FFD700] text-black text-[10px] font-black px-2 py-0.5 rounded w-fit mb-1 uppercase tracking-wider">Top Command</div>
                                                <h2 className="text-2xl font-black">{mgr.name}</h2>
                                                <p className="text-white/60 text-sm font-bold">Store Manager (门店经理)</p>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="bg-gray-200 text-gray-500 p-4 rounded-xl font-bold border-2 border-dashed border-gray-300">Vacant: Store Manager</div>
                                )}
                            </div>

                            {/* LEVEL 2: DIVISIONS (Grid Layout - Updated for Tablet lg:grid-cols-2) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                
                                {/* === OPERATIONS DIVISION === */}
                                <div ref={opsRef} className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                                    <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-xl text-indigo-600 shadow-sm"><Briefcase size={20}/></div>
                                        <h3 className="font-black text-lg text-indigo-900">运营部 (Operations)</h3>
                                    </div>
                                    
                                    <div className="p-5 bg-indigo-50/30 flex-grow space-y-6 flex flex-col">
                                        {/* Ops Supervisor */}
                                        <div className="flex justify-center w-full">
                                            {hierarchy.ops.supervisor.length > 0 ? hierarchy.ops.supervisor.map(sup => (
                                                <ProfileHeader key={sup.id} emp={sup} title="Operations Supervisor" colorClass="bg-indigo-100 border-indigo-200 text-indigo-900 w-full max-w-sm shadow-md" />
                                            )) : <div className="text-xs text-gray-400 font-bold bg-white px-4 py-2 rounded-full border border-dashed border-gray-300">Vacant: Supervisor</div>}
                                        </div>

                                        {/* Ops Departments - Grid 3 Cols (Tablet friendly) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-grow">
                                            <TeamGroup 
                                                title="楼面 (Floor)" 
                                                icon={<Coffee size={14}/>} 
                                                members={hierarchy.ops.floor} 
                                                colorClass="bg-blue-50/50"
                                                borderColor="border-blue-100"
                                            />
                                            <TeamGroup 
                                                title="水吧 (Bar)" 
                                                icon={<Droplets size={14}/>} 
                                                members={hierarchy.ops.bar} 
                                                colorClass="bg-cyan-50/50"
                                                borderColor="border-cyan-100"
                                            />
                                            <TeamGroup 
                                                title="后勤 (Hygiene)" 
                                                icon={<Sparkles size={14}/>} 
                                                members={hierarchy.ops.hygiene} 
                                                colorClass="bg-slate-50/50"
                                                borderColor="border-slate-100"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* === CULINARY DIVISION (KITCHEN) === */}
                                <div ref={kitchenRef} className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                                    <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-xl text-orange-600 shadow-sm"><ChefHat size={20}/></div>
                                        <h3 className="font-black text-lg text-orange-900">厨房部 (Culinary)</h3>
                                    </div>

                                    <div className="p-5 bg-orange-50/30 flex-grow space-y-6 flex flex-col">
                                        {/* Executive Chef */}
                                        <div className="flex justify-center w-full">
                                            {hierarchy.kitchen.exec.length > 0 ? hierarchy.kitchen.exec.map(chef => (
                                                <ProfileHeader key={chef.id} emp={chef} title="Executive Chef (行政总厨)" colorClass="bg-orange-600 border-orange-500 text-white w-full max-w-sm shadow-xl" />
                                            )) : <div className="text-xs text-gray-400 font-bold bg-white px-4 py-2 rounded-full border border-dashed border-gray-300">Vacant: Executive Chef</div>}
                                        </div>

                                        {/* Kitchen Command Chain */}
                                        <div className="space-y-2">
                                            <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest text-center">Kitchen Command</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                {/* Head Chef */}
                                                <div className="bg-white border-l-4 border-l-red-500 p-3 rounded-r-xl border shadow-sm h-full flex flex-col">
                                                    <div className="text-[9px] font-black text-red-500 uppercase mb-2">正厨/头手 (Head Chef)</div>
                                                    <div className="space-y-2">
                                                        {hierarchy.kitchen.core.head.length > 0 ? hierarchy.kitchen.core.head.map(c => <MemberCard key={c.id} emp={c} isLeader={true}/>) : <span className="text-[10px] text-gray-400 italic">Vacant</span>}
                                                    </div>
                                                </div>
                                                {/* Asst Chef */}
                                                <div className="bg-white border-l-4 border-l-orange-400 p-3 rounded-r-xl border shadow-sm h-full flex flex-col">
                                                    <div className="text-[9px] font-black text-orange-500 uppercase mb-2">副厨 (Asst Chef)</div>
                                                    <div className="space-y-2">
                                                        {hierarchy.kitchen.core.asst.length > 0 ? hierarchy.kitchen.core.asst.map(c => <MemberCard key={c.id} emp={c} isLeader={true}/>) : <span className="text-[10px] text-gray-400 italic">Vacant</span>}
                                                    </div>
                                                </div>
                                                {/* PIC */}
                                                <div className="bg-white border-l-4 border-l-purple-400 p-3 rounded-r-xl border shadow-sm h-full flex flex-col">
                                                    <div className="text-[9px] font-black text-purple-600 uppercase mb-2">负责人 (Kitchen PIC)</div>
                                                    <div className="space-y-2">
                                                        {hierarchy.kitchen.core.pic.length > 0 ? hierarchy.kitchen.core.pic.map(c => <MemberCard key={c.id} emp={c} isLeader={true}/>) : <span className="text-[10px] text-gray-400 italic">Vacant</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-orange-200 w-full opacity-50"></div>

                                        {/* Functional Teams (2x2 Grid for Neatness) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-grow">
                                             <TeamGroup 
                                                title="厨师 (Cook)" 
                                                icon={<Flame size={14}/>} 
                                                members={hierarchy.kitchen.teams.cook} 
                                                colorClass="bg-yellow-50/50"
                                                borderColor="border-yellow-200"
                                            />
                                            <TeamGroup 
                                                title="砧板 (Cutter)" 
                                                icon={<Utensils size={14}/>} 
                                                members={hierarchy.kitchen.teams.cutter} 
                                                colorClass="bg-red-50/50"
                                                borderColor="border-red-100"
                                            />
                                            <TeamGroup 
                                                title="马王 (Runner/Commis)" 
                                                icon={<Move size={14}/>} 
                                                members={hierarchy.kitchen.teams.runner} 
                                                colorClass="bg-amber-50/50"
                                                borderColor="border-amber-100"
                                            />
                                            <TeamGroup 
                                                title="打荷 (Fryer)" 
                                                icon={<Flame size={14}/>} 
                                                members={hierarchy.kitchen.teams.fryer} 
                                                colorClass="bg-orange-50/50"
                                                borderColor="border-orange-100"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {viewMode === 'ANALYTICS' && (
                        <div ref={chartRef} className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <StatCard label="总人数 (Headcount)" value={stats.totalCount} icon={<Users size={16}/>} color="bg-white" />
                                <StatCard label="月薪成本 (Monthly)" value={formatMoney(stats.totalBurnRate)} icon={<DollarSign size={16}/>} color="bg-white" valueColor="text-green-600" />
                                <StatCard label="本地 (Local)" value={`${stats.localCount}`} sub={`${stats.totalCount > 0 ? ((stats.localCount/stats.totalCount)*100).toFixed(0) : 0}%`} icon={<Globe size={16}/>} color="bg-blue-50 border-blue-100" />
                                <StatCard label="外籍 (Foreign)" value={`${stats.foreignCount}`} sub={`${stats.totalCount > 0 ? ((stats.foreignCount/stats.totalCount)*100).toFixed(0) : 0}%`} icon={<Globe size={16}/>} color="bg-orange-50 border-orange-100" />
                            </div>
                            
                            <h3 className="font-black text-[#1A1A1A] text-lg mb-4 flex items-center gap-2"><Layout size={18}/> 职位详情 (Role Breakdown)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(stats.roleGroups as Record<string, { employees: Employee[], cost: number }>).sort((a,b) => b[1].cost - a[1].cost).map(([role, data]) => (
                                    <div key={role} className="bg-white rounded-[1.5rem] border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                            <div>
                                                <h5 className="font-bold text-sm text-[#1A1A1A]">{role}</h5>
                                                <p className="text-[10px] text-gray-400 font-mono font-bold mt-0.5">{formatMoney(data.cost)}/mo</p>
                                            </div>
                                            <span className="bg-[#1A1A1A] text-white px-2 py-1 rounded-lg text-xs font-black">{data.employees.length}</span>
                                        </div>
                                        <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                                            {data.employees.map(emp => (
                                                <div key={emp.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-xl text-xs transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${emp.status === 'CONFIRMED' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                        <span className="font-bold text-gray-700">{emp.name}</span>
                                                    </div>
                                                    <span className="font-mono text-gray-400">{formatMoney(emp.basicSalary)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
