
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Save, FileDown, Loader2, Eraser, X, CheckSquare, Square, Printer, Calendar, User, ArrowLeft, MoreHorizontal, UserX } from 'lucide-react';
import { Employee, RosterStatus, AppModule } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

interface RosterModuleProps {
    onClose?: () => void;
    allowedModules?: AppModule[];
}

// --- CONSTANTS & CONFIG (Defined OUTSIDE component to avoid re-creation) ---
const STATUS_CONFIG: Record<RosterStatus, { label: string, color: string, short: string, mobileBg: string }> = {
    'WORK': { label: '上班', color: 'text-gray-900', short: '', mobileBg: 'bg-white border-gray-200' }, // Removed bg-white from WORK to allow column coloring
    'OFF': { label: '休息', color: 'bg-gray-200 text-gray-500', short: 'OFF', mobileBg: 'bg-gray-100 border-gray-300' },
    'LEAVE': { label: '事假', color: 'bg-orange-100 text-orange-700', short: 'UL', mobileBg: 'bg-orange-50 border-orange-200' },
    'MC': { label: '病假', color: 'bg-red-100 text-red-700', short: 'MC', mobileBg: 'bg-red-50 border-red-200' },
    'ANNUAL': { label: '年假', color: 'bg-blue-100 text-blue-700', short: 'AL', mobileBg: 'bg-blue-50 border-blue-200' },
    'ABSENT': { label: '缺席', color: 'bg-purple-100 text-purple-700', short: 'ABS', mobileBg: 'bg-purple-50 border-purple-200' },
    'PENDING': { label: '待定', color: 'bg-yellow-50 text-yellow-700', short: '?', mobileBg: 'bg-yellow-50 border-yellow-200' }
};

const STATUS_ORDER: RosterStatus[] = ['WORK', 'OFF', 'LEAVE', 'MC', 'ANNUAL'];

const DEPT_THEMES: Record<string, string> = {
    'FLOOR': 'bg-indigo-100 text-indigo-900 border-indigo-300',
    'KITCHEN': 'bg-orange-100 text-orange-900 border-orange-300',
    'BAR': 'bg-cyan-100 text-cyan-900 border-cyan-300',
    'DISH': 'bg-slate-200 text-slate-800 border-slate-300',
    'OTHERS': 'bg-gray-100 text-gray-800 border-gray-300'
};

const getMalaysianHoliday = (date: Date) => {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    const dateStr = `${m}-${d}`;

    if (dateStr === '1-1') return "New Year";
    if (dateStr === '5-1') return "Labor Day";
    if (dateStr === '8-31') return "Merdeka";
    if (dateStr === '12-25') return "Christmas";
    
    // Simplified dynamic check for demo
    if (y === 2025) {
        if (dateStr === '1-29') return "CNY";
        if (dateStr === '10-20') return "Deepavali";
    }
    return null;
};

export const RosterModule: React.FC<RosterModuleProps> = ({ onClose, allowedModules }) => {
    // --- STATE ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [rosterData, setRosterData] = useState<Record<string, Record<string, RosterStatus>>>({});
    const [rosterNotes, setRosterNotes] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showResigned, setShowResigned] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [selectedMobileEmployee, setSelectedMobileEmployee] = useState<Employee | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportConfig, setExportConfig] = useState({
        FLOOR: true, KITCHEN: true, BAR: true, DISH: true, OTHERS: true
    });

    const printRef = useRef<HTMLDivElement>(null);

    // --- DERIVED HELPERS ---
    // Defined INSIDE to access state safely
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // Permission Logic
    const showAll = !allowedModules || allowedModules.length === 0 || allowedModules.includes('ROSTER');
    const showKitchen = showAll || allowedModules.includes('ROSTER_KITCHEN');
    const showFloor = showAll || allowedModules.includes('ROSTER_FLOOR');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        loadData();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [emps, rData] = await Promise.all([
            DataManager.getEmployees(),
            DataManager.getRosterData()
        ]);
        setEmployees(emps.filter(e => !e.role.includes('Owner')));
        if (rData) {
            setRosterData(rData.roster || {});
            setRosterNotes(rData.notes || {});
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await DataManager.saveRosterData(rosterData, rosterNotes);
            alert("✅ 排班表已保存 (Roster Saved)");
        } catch (e) {
            console.error(e);
            alert("保存失败");
        } finally {
            setIsSaving(false);
        }
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setCurrentDate(newDate);
    };

    const getStatus = (dateStr: string, empId: string): RosterStatus => {
        return rosterData[dateStr]?.[empId] || 'WORK';
    };

    const toggleStatus = (day: number, empId: string) => {
        const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
        const current = getStatus(dateStr, empId);
        const nextIdx = (STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length;
        const nextStatus = STATUS_ORDER[nextIdx];

        setRosterData(prev => ({
            ...prev,
            [dateStr]: {
                ...(prev[dateStr] || {}),
                [empId]: nextStatus
            }
        }));
    };

    const staffGroups = useMemo(() => {
        const targetEmployees = employees.filter(e => showResigned || !e.isArchived);
        const kitchen = targetEmployees.filter(e => ['CHEF', 'COOK', 'CUTTER', 'KITCHEN', 'HELPER', 'COMMIS', '头手', '帮锅', '厨房', '打荷'].some(k => e.role.toUpperCase().includes(k)));
        const bar = targetEmployees.filter(e => e.role.toUpperCase().includes('BAR') || e.role.includes('水吧'));
        const floor = targetEmployees.filter(e => ['MANAGER', 'SUPERVISOR', 'CAPTAIN', 'WAITER', 'COUNTER', '楼面', '服务'].some(k => e.role.toUpperCase().includes(k)));
        const dish = targetEmployees.filter(e => e.role.toUpperCase().includes('DISH') || e.role.includes('洗碗') || e.role.toUpperCase().includes('CLEANER'));
        const others = targetEmployees.filter(e => !kitchen.includes(e) && !bar.includes(e) && !floor.includes(e) && !dish.includes(e));
        return { kitchen, bar, floor, dish, others };
    }, [employees, showResigned]);

    const handleBatchSet = (status: RosterStatus) => {
        let message = `将本月所有空格设置为 ${status}?`;
        if (status === 'WORK') message = "⚠️ 严重警告 (WARNING)\n\n您确定要【重置】本月的排班表吗？\n\n此操作将删除当月所有已保存的排班数据，并将所有员工状态重置为“上班”。\n\n确认后数据无法恢复，需要重新排过！";
        if (!confirm(message)) return;

        const newData = { ...rosterData };
        const visibleEmployees = [
            ...(showFloor ? staffGroups.floor : []),
            ...(showKitchen ? staffGroups.kitchen : []),
            ...(showFloor ? staffGroups.bar : []),
            ...(showFloor ? staffGroups.dish : []),
            ...(showFloor ? staffGroups.others : []),
        ];

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
            if (!newData[dateStr]) newData[dateStr] = {};
            visibleEmployees.forEach(emp => {
                newData[dateStr][emp.id] = status;
            });
        }
        setRosterData(newData);
    };

    // --- RENDERERS ---

    // 1. Desktop Table Row Renderer
    const renderTableRows = (staffGroup: Employee[], groupName: string, themeKey: string) => {
        if (staffGroup.length === 0) return null;
        const themeClass = DEPT_THEMES[themeKey] || DEPT_THEMES['OTHERS'];

        return (
            <>
                <tr className={`${themeClass} border-y-2`}>
                    <td colSpan={daysInMonth + 2} className="px-3 py-2 md:px-4 md:py-3 text-xs font-black uppercase tracking-widest sticky left-0 z-10 text-left shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r-2 border-current">
                        {groupName}
                    </td>
                </tr>
                {staffGroup.map(emp => {
                    const daysArray = Array.from({ length: daysInMonth });
                    const workDaysCount = daysArray.filter((_, i) => {
                        const dateStr = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
                        return emp.joinDate <= dateStr && getStatus(dateStr, emp.id) === 'WORK';
                    }).length;
                    const offDaysCount = daysArray.filter((_, i) => {
                        const dateStr = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
                        return emp.joinDate <= dateStr && getStatus(dateStr, emp.id) === 'OFF';
                    }).length;
                    const targetRestDays = emp.monthlyRestDays || 4;
                    const isRestMet = offDaysCount >= targetRestDays;

                    return (
                        <tr key={emp.id} className={`hover:bg-gray-50 border-b-2 border-gray-100 transition-colors h-12 md:h-14 ${emp.isArchived ? 'opacity-60 bg-gray-50/50' : ''}`}>
                            <td className="p-2 md:p-3 border-r-2 border-gray-200 text-xs md:text-sm font-bold whitespace-nowrap sticky left-0 bg-white z-10 w-40 md:w-48 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0 ${emp.isArchived ? 'bg-red-500' : emp.status === 'CONFIRMED' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1">
                                            <div className="truncate font-black text-[#1A1A1A]">{emp.name}</div>
                                            {emp.isArchived && <span className="text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded">离职</span>}
                                        </div>
                                        <div className="text-[9px] md:text-[10px] text-gray-400 font-mono">#{emp.id}</div>
                                    </div>
                                </div>
                            </td>
                            {daysArray.map((_, i) => {
                                const day = i + 1;
                                const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
                                const isPreJoin = emp.joinDate > dateStr;

                                if (isPreJoin) {
                                    return (
                                        <td key={day} className="border-r border-gray-100 text-center bg-gray-50 select-none cursor-not-allowed">
                                            <span className="text-[8px] md:text-[9px] font-black text-gray-200">N/A</span>
                                        </td>
                                    );
                                }

                                const status = getStatus(dateStr, emp.id);
                                const conf = STATUS_CONFIG[status];
                                const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                                const dayOfWeek = dateObj.getDay();
                                const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
                                const holiday = getMalaysianHoliday(dateObj);
                                
                                // NEW: Today Highlighting Logic
                                const today = new Date();
                                const isToday = today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();

                                // Determine Cell Background
                                let cellClass = 'bg-white';
                                if (status === 'WORK') {
                                    if (holiday) cellClass = 'bg-orange-50';
                                    else if (isWeekend) cellClass = 'bg-red-50/40';
                                    // if just WORK and not holiday/weekend, defaults to white
                                } else {
                                    // Non-work statuses have their own colors defined in CONFIG
                                    cellClass = conf.color;
                                }

                                // Apply Today Highlight Overlay (Stronger Specificity)
                                let borderClass = 'border-r border-gray-100';
                                if (isToday) {
                                    // Ensure highlight background doesn't override status colors completely, but provides a tint
                                    // Actually, for today, we want the Blue Beam effect.
                                    // We will use a wrapper or direct classes.
                                    cellClass = status === 'WORK' ? 'bg-blue-50' : cellClass; // Keep status color if present, else blue tint
                                    borderClass = 'border-x-2 border-blue-500 z-20';
                                }

                                return (
                                    <td 
                                        key={day} 
                                        onClick={() => toggleStatus(day, emp.id)}
                                        className={`text-center cursor-pointer transition-colors select-none relative ${cellClass} ${borderClass}`}
                                    >
                                        <span className="text-[10px] md:text-xs font-black">{conf.short}</span>
                                    </td>
                                );
                            })}
                            <td className="p-2 md:p-3 text-center text-[9px] md:text-[10px] font-mono font-bold text-gray-600 bg-gray-50 whitespace-nowrap sticky right-0 z-10 border-l-2 border-gray-200 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                                <div className="flex flex-col items-center leading-tight space-y-0.5 md:space-y-1">
                                    <span className="text-gray-800">Work: {workDaysCount}</span>
                                    <span className={`font-black ${isRestMet ? 'text-green-600' : 'text-red-500'}`}>OFF: {offDaysCount}/{targetRestDays}</span>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </>
        );
    };

    // 2. Mobile Renderer
    const renderMobileGroup = (group: Employee[], title: string, themeKey: string) => {
        if (group.length === 0) return null;
        return (
            <div className="mb-6">
                <h4 className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg mb-3 flex items-center justify-between border-l-4 ${DEPT_THEMES[themeKey]}`}>
                    {title} <span className="bg-white/50 px-2 py-0.5 rounded text-[10px]">{group.length}</span>
                </h4>
                <div className="space-y-3">
                    {group.map(emp => {
                        const daysArray = Array.from({ length: daysInMonth });
                        const offCount = daysArray.filter((_, i) => getStatus(`${monthKey}-${String(i+1).padStart(2,'0')}`, emp.id) === 'OFF').length;
                        const target = emp.monthlyRestDays || 4;
                        const met = offCount >= target;
                        return (
                            <div key={emp.id} onClick={() => setSelectedMobileEmployee(emp)} className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between active:bg-gray-50 active:scale-[0.99] transition-all ${emp.isArchived ? 'opacity-70' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${emp.isArchived ? 'bg-red-100 text-red-700' : met ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.name.charAt(0)}</div>
                                    <div><div className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">{emp.name}{emp.isArchived && <span className="text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded">离职</span>}</div><div className="text-[10px] text-gray-400 font-mono">#{emp.id}</div></div>
                                </div>
                                <div className="text-right"><div className="text-[9px] text-gray-400 font-bold uppercase">Rest Days</div><div className={`text-sm font-black font-mono ${met ? 'text-green-600' : 'text-red-500'}`}>{offCount} / {target}</div></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // 3. Mobile Detail View
    const renderMobileEmployeeDetail = () => {
        if (!selectedMobileEmployee) return null;
        const emp = selectedMobileEmployee;
        
        return (
            <div className="absolute inset-0 z-50 bg-[#F5F7FA] flex flex-col animate-in slide-in-from-right duration-300">
                <div className="bg-white p-4 border-b border-gray-200 shadow-sm flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3"><button onClick={() => setSelectedMobileEmployee(null)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={20}/></button><div><h3 className="font-black text-lg text-[#1A1A1A] flex items-center gap-2">{emp.name}{emp.isArchived && <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded">离职</span>}</h3><p className="text-xs text-gray-500 font-bold">{emp.role.split('(')[0]}</p></div></div>
                    <div className="text-right"><p className="text-[10px] text-gray-400 font-bold uppercase">OFF Days</p><p className="text-lg font-black font-mono text-blue-600">{Array.from({ length: daysInMonth }).filter((_, i) => getStatus(`${monthKey}-${String(i+1).padStart(2,'0')}`, emp.id) === 'OFF').length} <span className="text-xs text-gray-300"> / {emp.monthlyRestDays || 4}</span></p></div>
                </div>
                <div className="flex-grow overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm"><button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20}/></button><span className="font-black text-sm uppercase tracking-widest">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20}/></button></div>
                    <div className="grid grid-cols-1 gap-3">
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
                            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                            const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
                            const status = getStatus(dateStr, emp.id);
                            const conf = STATUS_CONFIG[status];
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            const holiday = getMalaysianHoliday(date);
                            
                            // Today Highlight for Mobile
                            const today = new Date();
                            const isToday = today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
                            
                            return (
                                <div key={day} onClick={() => toggleStatus(day, emp.id)} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all active:scale-[0.98] ${conf.mobileBg} ${isToday ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50' : holiday ? 'ring-2 ring-orange-400 border-orange-400' : isWeekend ? 'border-red-200' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center border font-bold ${isToday ? 'bg-blue-600 text-white border-blue-600' : isWeekend || holiday ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                            <span className="text-[9px] uppercase leading-none">{dayOfWeek}</span>
                                            <span className="text-sm leading-none mt-0.5">{day}</span>
                                        </div>
                                        <div><div className="font-black text-sm text-[#1A1A1A]">{holiday || (status === 'WORK' ? 'Working' : conf.label)}</div>{holiday && <div className="text-[10px] text-orange-600 font-bold uppercase">Holiday</div>}</div>
                                    </div>
                                    <div className={`px-4 py-2 rounded-lg text-xs font-black uppercase ${status === 'WORK' ? 'bg-[#1A1A1A] text-[#FFD700]' : 'bg-white border-2 border-gray-200 text-gray-500'}`}>{status === 'WORK' ? 'WORK' : conf.short}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // 4. Print Logic & Renderer
    const executeExportPDF = async () => {
        if (!printRef.current) return;
        setIsGeneratingPdf(true);
        setIsExportModalOpen(false);
        try {
            await new Promise(r => setTimeout(r, 800));
            const canvas = await html2canvas(printRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('l', 'mm', 'a3'); 
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`KLK_Roster_${monthKey}.pdf`);
        } catch (e) { console.error(e); alert("Export Failed"); } finally { setIsGeneratingPdf(false); }
    };

    const renderPrintTableBody = (staffGroup: Employee[]) => {
        return staffGroup.map((emp, idx) => {
            const daysArray = Array.from({ length: daysInMonth });
            let workCount = 0;
            let offCount = 0;

            daysArray.forEach((_, i) => {
                const dateStr = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
                if (emp.joinDate <= dateStr) {
                    const status = getStatus(dateStr, emp.id);
                    if (status === 'WORK') workCount++;
                    if (status === 'OFF') offCount++;
                }
            });

            return (
                <tr key={emp.id} className="text-[10px] border-b border-gray-300 break-inside-avoid">
                    <td className="p-2 border-r-2 border-black font-bold text-black whitespace-nowrap bg-white w-48">{emp.name} {emp.isArchived ? '(离职)' : ''}</td>
                    {daysArray.map((_, i) => {
                        const dateStr = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
                        const isPreJoin = emp.joinDate > dateStr;
                        const status = getStatus(dateStr, emp.id);
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
                        const dayOfWeek = date.getDay();
                        const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
                        const holiday = getMalaysianHoliday(date);
                        
                        let bgClass = "bg-white";
                        let textClass = "text-black";
                        let content = "";

                        if (isPreJoin) { bgClass = "bg-gray-100"; content = "-"; } else {
                            if (holiday) { bgClass = "bg-amber-100"; } else if (isWeekend) { bgClass = "bg-red-50"; }
                            if (status === 'OFF') { bgClass = "bg-gray-600"; textClass = "text-white"; content = "OFF"; } 
                            else if (status === 'MC') { bgClass = "bg-red-600"; textClass = "text-white"; content = "MC"; } 
                            else if (status === 'LEAVE') { bgClass = "bg-yellow-400"; textClass = "text-black"; content = "UL"; } 
                            else if (status === 'ANNUAL') { bgClass = "bg-blue-600"; textClass = "text-white"; content = "AL"; } 
                            else if (status === 'ABSENT') { bgClass = "bg-purple-600"; textClass = "text-white"; content = "ABS"; } 
                            else if (status === 'PENDING') { content = "?"; } 
                        }
                        return (<td key={i} className={`text-center border-r border-gray-300 p-0.5 ${bgClass}`}><div className={`w-full h-full flex items-center justify-center font-bold text-[9px] ${textClass}`}>{content}</div></td>);
                    })}
                    <td className="p-2 text-center font-black border-l-2 border-black bg-white w-12">{workCount}</td>
                    <td className="p-2 text-center font-black border-l border-gray-300 bg-gray-50 w-12">{offCount}</td>
                </tr>
            );
        });
    };

    const renderPrintSection = (group: Employee[], title: string, colorClass: string) => {
        if (group.length === 0) return null;
        return (<><tr><td colSpan={daysInMonth + 3} className={`p-2 font-black uppercase text-xs tracking-[0.2em] border-y-2 border-black ${colorClass}`}>{title}</td></tr>{renderPrintTableBody(group)}</>);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#F5F7FA] flex flex-col animate-in fade-in duration-200 font-sans">
            {/* Header Controls */}
            <div className="bg-[#1A1A1A] p-4 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-xl z-40 border-b-4 border-[#FFD700]">
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#FFD700] text-black p-2 md:p-2.5 rounded-xl shadow-lg"><Calendar size={20} className="md:w-6 md:h-6"/></div>
                        <div><h3 className="font-serif font-black text-lg md:text-xl tracking-wide text-white">排班管理</h3><p className="text-[9px] md:text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">STAFF SCHEDULING</p></div>
                    </div>
                    {isMobile && !selectedMobileEmployee && (<div className="flex items-center bg-white/10 rounded-lg p-1"><button onClick={() => changeMonth(-1)} className="p-2 text-white hover:bg-white/20 rounded"><ChevronLeft size={16}/></button><span className="text-xs font-black text-white w-20 text-center">{currentDate.toLocaleString('default', { month: 'short' })}</span><button onClick={() => changeMonth(1)} className="p-2 text-white hover:bg-white/20 rounded"><ChevronRight size={16}/></button></div>)}
                </div>

                <div className="flex gap-2 w-full md:w-auto items-center justify-end overflow-x-auto">
                    {!isMobile && (<div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/10 mr-4"><button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/20 text-white rounded-lg transition-all"><ChevronLeft size={20}/></button><span className="px-4 font-black text-lg min-w-[160px] text-center text-white font-mono">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/20 text-white rounded-lg transition-all"><ChevronRight size={20}/></button></div>)}
                    <ModuleGuideButton module="ROSTER" />
                    <button onClick={() => setShowResigned(!showResigned)} className={`px-3 md:px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${showResigned ? 'bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}><UserX size={16}/> <span className="hidden md:inline">{showResigned ? '隐藏离职' : '显示离职'}</span></button>
                    <button onClick={() => handleBatchSet('WORK')} className="px-3 md:px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors"><Eraser size={16}/> <span className="hidden md:inline">重置</span></button>
                    <button onClick={() => setIsExportModalOpen(true)} disabled={isGeneratingPdf} className="px-3 md:px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50 shadow-md">{isGeneratingPdf ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} <span className="hidden md:inline">PDF</span></button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 md:px-6 py-2.5 bg-[#FFD700] text-black rounded-xl text-xs font-black shadow-lg hover:bg-white transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap">{isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} <span className="hidden md:inline">保存</span></button>
                    <div className="w-px h-8 bg-white/20 mx-2 hidden md:block"></div>
                    <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-full text-white transition-colors"><X size={24}/></button>
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="flex-grow overflow-hidden relative">
                {isMobile && !selectedMobileEmployee && (<div className="h-full overflow-y-auto p-4 bg-[#F5F7FA]">{loading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-gray-400"/></div> : (<>{showFloor && renderMobileGroup(staffGroups.floor, '楼面 (Floor)', 'FLOOR')}{showKitchen && renderMobileGroup(staffGroups.kitchen, '厨房 (Kitchen)', 'KITCHEN')}{showFloor && renderMobileGroup(staffGroups.bar, '水吧 (Bar)', 'BAR')}{showFloor && renderMobileGroup(staffGroups.dish, '后勤 (Dish)', 'DISH')}{showFloor && renderMobileGroup(staffGroups.others, '其他 (Others)', 'OTHERS')}</>)}<div className="h-20"></div></div>)}
                {isMobile && selectedMobileEmployee && renderMobileEmployeeDetail()}
                
                {/* 3. DESKTOP/TABLET VIEW: GRID MODE */}
                {!isMobile && (
                    <div className="h-full overflow-auto bg-white relative">
                        <table className="w-full border-collapse table-fixed min-w-[1200px]">
                            <thead className="sticky top-0 z-40 bg-[#1A1A1A] text-white shadow-xl">
                                <tr>
                                    <th className="p-3 md:p-4 text-left w-40 md:w-48 sticky left-0 top-0 bg-[#1A1A1A] z-50 border-r-2 border-white/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]"><span className="text-xs uppercase font-black tracking-[0.2em] text-[#FFD700]">Employee</span></th>
                                    {Array.from({ length: daysInMonth }).map((_, i) => {
                                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
                                        const dayOfWeek = date.getDay();
                                        const isWeekend = dayOfWeek === 6 || dayOfWeek === 0; 
                                        const holiday = getMalaysianHoliday(date);
                                        
                                        // TODAY HIGHLIGHT: Header
                                        const today = new Date();
                                        const isToday = today.getDate() === (i + 1) && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();

                                        let headerClass = "bg-[#1A1A1A] text-white border-white/10";
                                        if (isToday) {
                                            headerClass = "bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.6)] z-50 transform scale-105 rounded-t-lg"; 
                                        } else if (holiday) {
                                            headerClass = "bg-orange-600 text-white border-orange-500";
                                        } else if (isWeekend) {
                                            headerClass = "bg-red-700 text-white border-red-600";
                                        }

                                        return (
                                            <th key={i} className={`p-1 md:p-2 text-center min-w-[2.5rem] md:min-w-[3.5rem] border-r border-b-4 ${headerClass}`}>
                                                <div className="text-[8px] md:text-[9px] uppercase opacity-80 font-mono tracking-tighter">{date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}</div>
                                                <div className="text-xs md:text-sm font-black font-mono">{i + 1}</div>
                                            </th>
                                        );
                                    })}
                                    <th className="p-2 w-24 md:w-28 text-center text-[9px] md:text-[10px] uppercase font-bold text-[#FFD700] sticky right-0 top-0 bg-[#1A1A1A] z-40 shadow-[-2px_0_10px_rgba(0,0,0,0.05)] border-b-4 border-white/10 border-l-2">Summary</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-gray-100">
                                {loading ? (<tr><td colSpan={daysInMonth + 2} className="py-40 text-center"><Loader2 size={48} className="animate-spin mx-auto text-gray-300"/></td></tr>) : (<>{showFloor && renderTableRows(staffGroups.floor, "楼面 (FRONT OF HOUSE)", 'FLOOR')}{showKitchen && renderTableRows(staffGroups.kitchen, "厨房 (BACK OF HOUSE)", 'KITCHEN')}{showFloor && renderTableRows(staffGroups.bar, "水吧 (BAR)", 'BAR')}{showFloor && renderTableRows(staffGroups.dish, "后勤 (CLEANING/DISH)", 'DISH')}{showFloor && renderTableRows(staffGroups.others, "其他 (OTHERS)", 'OTHERS')}</>)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* EXPORT MODAL */}
            {isExportModalOpen && (<div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 border-t-8 border-[#FFD700]"><div className="flex justify-between items-center mb-6"><h3 className="font-black text-xl text-[#1A1A1A]">导出 PDF 配置</h3><button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button></div><p className="text-xs text-gray-500 font-bold mb-4">请选择要包含在报表中的部门:</p><div className="space-y-2 mb-6">{[{ key: 'FLOOR', label: '楼面 (Floor)' }, { key: 'KITCHEN', label: '厨房 (Kitchen)' }, { key: 'BAR', label: '水吧 (Bar)' }, { key: 'DISH', label: '后勤/洗碗 (Dish/Cleaning)' }, { key: 'OTHERS', label: '其他 (Others)' }].map(dept => (<div key={dept.key} onClick={() => setExportConfig(prev => ({ ...prev, [dept.key]: !prev[dept.key as keyof typeof exportConfig] }))} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${exportConfig[dept.key as keyof typeof exportConfig] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}><span className="font-bold text-sm text-[#1A1A1A]">{dept.label}</span>{exportConfig[dept.key as keyof typeof exportConfig] ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20} className="text-gray-300"/>}</div>))}</div><button onClick={executeExportPDF} disabled={!Object.values(exportConfig).some(Boolean)} className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-2xl font-black text-lg shadow-lg hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"><Printer size={20}/> 确认导出 (Print)</button></div></div>)}
            {/* HIDDEN PRINT */}
            <div style={{ position: 'absolute', top: -9999, left: -9999 }}><div ref={printRef} className="w-[1500px] bg-white p-8 font-sans text-black"><div className="flex justify-between items-center mb-6 border-b-4 border-[#8B0000] pb-4"><div className="flex items-center gap-4"><div className="w-16 h-16 bg-[#8B0000] flex items-center justify-center rounded-lg text-white font-serif font-black text-2xl border-2 border-[#FFD700]">K</div><div><h1 className="text-4xl font-black uppercase tracking-widest text-[#1A1A1A]">Duty Roster</h1><p className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-[0.2em]">Kim Lian Kee (Petaling Street) • {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p></div></div><div className="text-right"><p className="text-[10px] font-bold text-gray-400 uppercase">Generated On</p><p className="text-sm font-mono font-black">{new Date().toLocaleDateString()}</p></div></div><table className="w-full border-collapse text-left border-2 border-black"><thead><tr className="bg-[#1A1A1A] text-white"><th className="p-3 w-48 border-r-2 border-white/20 uppercase text-xs font-black tracking-widest">Employee</th>{Array.from({ length: daysInMonth }).map((_, i) => { const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1); const dayOfWeek = date.getDay(); const isWeekend = dayOfWeek === 6 || dayOfWeek === 0; const holiday = getMalaysianHoliday(date); let headerClass = "bg-[#1A1A1A]"; let textClass = "text-white"; if (holiday) { headerClass = "bg-amber-500"; textClass = "text-black"; } else if (isWeekend) { headerClass = "bg-[#8B0000]"; } return (<th key={i} className={`p-1 text-center w-8 border-r border-white/20 ${headerClass} ${textClass}`}><div className="text-[8px] uppercase opacity-70">{date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}</div><div className="text-sm font-black">{i + 1}</div></th>); })}<th className="p-2 w-12 text-center uppercase text-[10px] font-black border-l-2 border-white/20 text-[#FFD700] bg-[#1A1A1A]">Work</th><th className="p-2 w-12 text-center uppercase text-[10px] font-black border-l border-white/20 text-white bg-gray-800">OFF</th></tr></thead><tbody>{exportConfig.FLOOR && showFloor && renderPrintSection(staffGroups.floor, "FLOOR TEAM", "bg-blue-100 text-blue-900 border-blue-300")}{exportConfig.KITCHEN && showKitchen && renderPrintSection(staffGroups.kitchen, "KITCHEN TEAM", "bg-orange-100 text-orange-900 border-orange-300")}{exportConfig.BAR && showFloor && renderPrintSection(staffGroups.bar, "BAR TEAM", "bg-cyan-100 text-cyan-900 border-cyan-300")}{exportConfig.DISH && showFloor && renderPrintSection(staffGroups.dish, "DISHWASHING", "bg-slate-200 text-slate-900 border-slate-300")}{exportConfig.OTHERS && showFloor && renderPrintSection(staffGroups.others, "OTHERS", "bg-gray-100 text-gray-900 border-gray-300")}</tbody></table><div className="mt-12 pt-8 border-t-2 border-black flex justify-between items-end"><div><p className="text-xs font-black uppercase tracking-widest mb-8">Prepared By:</p><div className="w-64 border-b-2 border-black"></div><p className="text-[10px] font-bold text-gray-500 mt-2">Manager / Supervisor</p></div><div><p className="text-xs font-black uppercase tracking-widest mb-8">Approved By:</p><div className="w-64 border-b-2 border-black"></div><p className="text-[10px] font-bold text-gray-500 mt-2">Owner / Director</p></div></div></div></div>
        </div>
    );
};
