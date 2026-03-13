import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, LogIn, LogOut, User, Search, CheckCircle2, AlertCircle, Calendar, X, History, Briefcase, Coffee, Edit3, Lock, AlertTriangle, ListChecks, FileBarChart, CheckSquare, XCircle, TrendingUp, ChefHat, Utensils, Trash2, Check, ArrowRight, CalendarOff, Palmtree, Home, Zap, ChevronDown, Users, FileDown, Loader2, Droplets } from 'lucide-react';
import { Employee, AttendanceRecord, RosterStatus } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

interface AttendanceConsoleProps {
    onClose: () => void;
}

// --- CONSTANTS ---
const STANDARD_WORK_HOURS = 10;
// Defaults strictly for fallback if profile data is missing
const DEFAULT_LOCAL_REST = 4;
const DEFAULT_FOREIGN_REST = 2;

const getRosterBadge = (status: RosterStatus) => {
    switch (status) {
        case 'OFF': return { label: '休息 (OFF)', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: Home };
        case 'MC': return { label: '病假 (MC)', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: AlertCircle };
        case 'ANNUAL': return { label: '年假 (AL)', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: Palmtree };
        case 'LEAVE': return { label: '事假 (UL)', color: 'bg-red-50 text-red-600 border-red-200', icon: CalendarOff };
        case 'ABSENT': return { label: '缺席 (ABS)', color: 'bg-purple-50 text-purple-600 border-purple-200', icon: XCircle };
        default: return null; // WORK or undefined
    }
};

const RollCallModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    staffList: Employee[];
    todayRecords: AttendanceRecord[];
    dateStr: string;
    onUpdate: () => void;
    dailyRoster: Record<string, RosterStatus>; 
}> = ({ isOpen, onClose, staffList, todayRecords, dateStr, onUpdate, dailyRoster }) => {
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
    const [customTimeId, setCustomTimeId] = useState<string | null>(null);
    const [customTimeValue, setCustomTimeValue] = useState<string>('16:00');

    if (!isOpen) return null;

    const handleQuickPresent = async (emp: Employee) => {
        setProcessingId(emp.id);
        const inTime = new Date(dateStr);
        inTime.setHours(16, 0, 0, 0);
        const outTime = new Date(dateStr);
        outTime.setDate(outTime.getDate() + 1);
        outTime.setHours(2, 0, 0, 0);

        const newRecord: AttendanceRecord = {
            id: `${dateStr}_${emp.id}`,
            employeeId: emp.id,
            employeeName: emp.name,
            date: dateStr,
            clockIn: inTime.toISOString(),
            clockOut: outTime.toISOString(),
            durationMinutes: 600,
            status: 'COMPLETED',
            notes: 'Manager Quick Check (全天)'
        };

        await DataManager.saveAttendance(newRecord);
        await onUpdate();
        setProcessingId(null);
    };

    const handleTimeClockIn = async (emp: Employee) => {
        if (!customTimeValue) return;
        setProcessingId(emp.id);
        try {
            const [hh, mm] = customTimeValue.split(':').map(Number);
            const clockInDate = new Date(dateStr);
            clockInDate.setHours(hh, mm, 0, 0);
            if (hh < 12) clockInDate.setDate(clockInDate.getDate() + 1);

            const ruleDate = new Date(dateStr);
            ruleDate.setHours(16, 0, 0, 0);
            const isLate = clockInDate > ruleDate;

            const targetOutTime = new Date(dateStr);
            targetOutTime.setDate(targetOutTime.getDate() + 1); 
            targetOutTime.setHours(2, 0, 0, 0); 

            const durationMinutes = Math.floor((targetOutTime.getTime() - clockInDate.getTime()) / 60000);

            const newRecord: AttendanceRecord = {
                id: `${dateStr}_${emp.id}`,
                employeeId: emp.id,
                employeeName: emp.name,
                date: dateStr,
                clockIn: clockInDate.toISOString(),
                clockOut: targetOutTime.toISOString(), 
                durationMinutes: Math.max(0, durationMinutes),
                status: isLate ? 'LATE' : 'COMPLETED', 
                notes: 'Manual Time In (Auto-out @ 2AM)'
            };

            await DataManager.saveAttendance(newRecord);
            await onUpdate();
        } catch (error) {
            console.error(error);
        } finally {
            setProcessingId(null);
            setCustomTimeId(null);
        }
    };

    const confirmMarkAbsent = async () => {
        if (!deleteCandidateId) return;
        setProcessingId(deleteCandidateId);
        await DataManager.deleteAttendance(`${dateStr}_${deleteCandidateId}`);
        await onUpdate();
        setProcessingId(null);
        setDeleteCandidateId(null);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] relative">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl">
                    <div>
                        <h3 className="font-black text-2xl text-[#1A1A1A]">快速点名 (Roll Call)</h3>
                        <p className="text-sm text-gray-500 font-bold mt-1">{dateStr} • {staffList.length} Staff</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white hover:bg-gray-100 rounded-full shadow-sm"><X size={24}/></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-[#F5F7FA]">
                    {staffList.map(staff => {
                        const record = todayRecords.find(r => r.employeeId === staff.id);
                        const isPresent = !!record;
                        const planStatus = dailyRoster[staff.id] || 'WORK';
                        const rosterBadge = getRosterBadge(planStatus);

                        return (
                            <div key={staff.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 shadow-sm transition-all ${isPresent ? 'bg-white border-green-200' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-sm ${isPresent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                        {staff.avatar ? <img src={staff.avatar} className="w-full h-full object-cover rounded-full"/> : staff.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-black text-lg text-[#1A1A1A] flex items-center gap-2">
                                            {staff.name}
                                            {rosterBadge && (
                                                <span className={`text-[9px] px-2 py-0.5 rounded border flex items-center gap-1 ${rosterBadge.color}`}>
                                                    <rosterBadge.icon size={10} /> {rosterBadge.label}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">{staff.role.split('(')[0]}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {isPresent ? (
                                        <>
                                            <div className="text-right mr-2 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                                <div className="text-xs font-black text-green-700 uppercase">{record.status === 'COMPLETED' ? 'WORK (To 2AM)' : record.status}</div>
                                                <div className="text-xs text-gray-500 font-mono font-bold">{record.durationMinutes ? `${(record.durationMinutes/60).toFixed(1)}h` : new Date(record.clockIn).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                                            </div>
                                            <button onClick={() => setDeleteCandidateId(staff.id)} disabled={!!processingId} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 border border-red-100 transition-colors">
                                                <X size={20}/>
                                            </button>
                                        </>
                                    ) : customTimeId === staff.id ? (
                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 bg-gray-100 p-2 rounded-xl">
                                            <input type="time" value={customTimeValue} onChange={(e) => setCustomTimeValue(e.target.value)} className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold w-28 outline-none focus:border-[#FFD700] shadow-sm"/>
                                            <button onClick={() => handleTimeClockIn(staff)} disabled={!!processingId} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 shadow-sm"><Check size={20} strokeWidth={3}/></button>
                                            <button onClick={() => setCustomTimeId(null)} className="bg-white text-gray-500 p-2 rounded-lg hover:bg-gray-200"><X size={20}/></button>
                                        </div>
                                    ) : (
                                        <>
                                            <button onClick={() => { setCustomTimeId(staff.id); setCustomTimeValue('16:00'); }} disabled={!!processingId || !!customTimeId} className="px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 hover:border-gray-300 flex items-center gap-2">
                                                <Clock size={16}/> 打卡
                                            </button>
                                            <button onClick={() => handleQuickPresent(staff)} disabled={!!processingId || !!customTimeId} className="px-5 py-3 bg-[#1A1A1A] text-[#FFD700] rounded-xl text-sm font-bold shadow-md flex items-center gap-2 hover:bg-black active:scale-95 transition-transform">
                                                <CheckSquare size={16}/> 全天
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {deleteCandidateId && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm rounded-3xl animate-in fade-in">
                        <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl border-t-8 border-red-500 animate-in zoom-in-95">
                            <Trash2 size={48} className="text-red-500 mx-auto mb-4"/>
                            <h3 className="font-black text-2xl text-[#1A1A1A] mb-2">确认删除考勤?</h3>
                            <p className="text-sm text-gray-500 font-bold mb-8">此操作将移除该员工的今日记录。</p>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setDeleteCandidateId(null)} className="py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-bold text-sm">取消</button>
                                <button onClick={confirmMarkAbsent} className="py-4 bg-red-600 text-white hover:bg-red-700 rounded-2xl font-bold text-sm shadow-xl">确认删除</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ComplianceReportModal: React.FC<{ isOpen: boolean; onClose: () => void; staffList: Employee[]; }> = ({ isOpen, onClose, staffList }) => {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (isOpen) loadReport(); }, [isOpen, month]);

    const loadReport = async () => {
        setLoading(true);
        const data = await DataManager.getAttendanceByMonth(month);
        setRecords(data);
        setLoading(false);
    };

    const reportData = useMemo(() => {
        const daysInMonth = new Date(parseInt(month.slice(0,4)), parseInt(month.slice(5,7)), 0).getDate();
        return staffList.map(emp => {
            const empRecords = records.filter(r => r.employeeId === emp.id);
            const totalMinutes = empRecords.reduce((sum, r) => sum + (r.durationMinutes || 0), 0);
            const daysWorked = empRecords.length;
            const lateCount = empRecords.filter(r => r.status === 'LATE').length;
            const isLocal = emp.nationality.includes('Malaysian') || emp.nationality.includes('🇲🇾');
            
            const restDaysQuota = emp.monthlyRestDays ?? (isLocal ? DEFAULT_LOCAL_REST : DEFAULT_FOREIGN_REST);
            const targetDays = daysInMonth - restDaysQuota;
            
            return { emp, daysWorked, targetDays, totalHours: totalMinutes/60, metDays: daysWorked >= targetDays, isLocal, lateCount, restDaysQuota };
        }).sort((a,b) => (a.metDays === b.metDays) ? 0 : a.metDays ? -1 : 1);
    }, [staffList, records, month]);

    const handleExportPDF = async () => {
        if (!printRef.current) return;
        setIsGeneratingPdf(true);
        try {
            await new Promise(r => setTimeout(r, 500)); 
            const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            
            const pdf = new jsPDF('p', 'mm', 'a4'); 
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Attendance_Report_${month}.pdf`);
        } catch (e) {
            console.error(e);
            alert("PDF Export Failed");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600"><FileBarChart size={24}/></div>
                        <div>
                            <h3 className="font-black text-xl text-[#1A1A1A]">月度工时达标检查</h3>
                            <p className="text-xs text-gray-400 font-bold mt-1">Monthly Compliance Report</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                         <button onClick={handleExportPDF} disabled={isGeneratingPdf} className="flex items-center gap-2 bg-[#1A1A1A] text-[#FFD700] px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-black transition-all disabled:opacity-50">
                            {isGeneratingPdf ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} 导出报表 (PDF)
                        </button>
                        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"/>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                    </div>
                </div>
                <div className="flex-grow overflow-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200">
                            <tr><th className="p-4 bg-gray-50">Employee</th><th className="p-4 text-center bg-gray-50">Type / Quota</th><th className="p-4 text-center bg-gray-50">Days Worked</th><th className="p-4 text-center bg-gray-50">Late</th><th className="p-4 text-center bg-gray-50">Total Hours</th><th className="p-4 text-center bg-gray-50">Status</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (<tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading...</td></tr>) : reportData.map(row => (
                                <tr key={row.emp.id} className="hover:bg-gray-50/50">
                                    <td className="p-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black">{row.emp.name.charAt(0)}</div><div><div className="font-bold text-[#1A1A1A]">{row.emp.name}</div><div className="text-[10px] text-gray-400">{row.emp.role.split('(')[0]}</div></div></div></td>
                                    <td className="p-4 text-center">
                                        <span className={`text-[9px] px-2 py-1 rounded font-black uppercase ${row.isLocal ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{row.isLocal ? 'Local' : 'Foreign'}</span>
                                        <div className="text-[9px] text-gray-400 mt-1 font-bold">Quota: {row.restDaysQuota} Off</div>
                                    </td>
                                    <td className="p-4 text-center"><div className="font-mono font-bold text-base">{row.daysWorked} <span className="text-gray-300 text-xs">/ {row.targetDays}</span></div></td>
                                    <td className="p-4 text-center"><span className={`font-mono font-bold ${row.lateCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>{row.lateCount}</span></td>
                                    <td className="p-4 text-center"><div className="font-mono font-bold text-base">{row.totalHours.toFixed(1)}h</div><div className="text-[9px] text-gray-400">Avg {(row.daysWorked > 0 ? row.totalHours/row.daysWorked : 0).toFixed(1)}h</div></td>
                                    <td className="p-4 text-center">{row.metDays ? <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100"><CheckCircle2 size={12}/> 达标 (Met)</span> : <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-100"><XCircle size={12}/> 缺 {row.targetDays - row.daysWorked} 天</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* HIDDEN PRINT TEMPLATE */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                <div ref={printRef} className="w-[210mm] min-h-[297mm] bg-white p-12 font-sans text-black relative">
                    <div className="flex justify-between items-start border-b-4 border-black pb-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-widest mb-1">Attendance Report</h1>
                            <p className="text-xs font-bold text-gray-500">KIM LIAN KEE (KEPONG)</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xl font-black uppercase">{month}</p>
                            <p className="text-xs font-mono text-gray-400">Generated: {new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <table className="w-full text-left text-xs mb-8">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-2 uppercase font-black">Employee</th>
                                <th className="p-2 uppercase font-black text-center">Type</th>
                                <th className="p-2 uppercase font-black text-center">Quota (Off)</th>
                                <th className="p-2 uppercase font-black text-center">Days Worked</th>
                                <th className="p-2 uppercase font-black text-center">Target</th>
                                <th className="p-2 uppercase font-black text-center">Late</th>
                                <th className="p-2 uppercase font-black text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {reportData.map((row, i) => (
                                <tr key={i} className="break-inside-avoid">
                                    <td className="p-2 font-bold">{row.emp.name}</td>
                                    <td className="p-2 text-center">{row.isLocal ? 'Local' : 'Foreign'}</td>
                                    <td className="p-2 text-center font-mono">{row.restDaysQuota} Days</td>
                                    <td className="p-2 text-center font-mono font-bold">{row.daysWorked}</td>
                                    <td className="p-2 text-center font-mono text-gray-500">{row.targetDays}</td>
                                    <td className={`p-2 text-center font-mono font-bold ${row.lateCount > 0 ? 'text-red-600' : 'text-gray-300'}`}>{row.lateCount}</td>
                                    <td className="p-2 text-center font-bold">{row.metDays ? 'MET' : 'FAILED'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="border-t-2 border-black pt-2 mt-auto">
                        <div className="flex justify-between items-end mt-12">
                            <div><p className="text-[10px] font-bold uppercase tracking-widest">Verified By (HR/Manager)</p><div className="w-48 border-b border-black mt-8"></div></div>
                            <div><p className="text-[10px] font-bold uppercase tracking-widest">Approved By (Owner)</p><div className="w-48 border-b border-black mt-8"></div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const SecurityPinModal: React.FC<{ isOpen: boolean; onClose: () => void; onSuccess: () => void; employeeName: string; targetPin: string; }> = ({ isOpen, onClose, onSuccess, employeeName, targetPin }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    useEffect(() => { if (isOpen) { setPin(''); setError(''); } }, [isOpen]);
    const handleVerify = () => { if (pin === targetPin) { onSuccess(); onClose(); } else { setError('Wrong PIN'); setPin(''); } };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center border-t-8 border-[#FFD700]">
                <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mb-6"><Lock size={40} className="text-yellow-600"/></div>
                <h3 className="font-black text-2xl text-[#1A1A1A] mb-2">身份验证</h3>
                <p className="text-sm text-gray-500 font-bold mb-8">请输入 <span className="text-black bg-gray-100 px-2 py-0.5 rounded">{employeeName}</span> 的密码</p>
                <input type="password" value={pin} onChange={e => { setPin(e.target.value); setError(''); }} className="w-full p-5 bg-gray-50 rounded-2xl text-center text-3xl font-black tracking-[0.5em] outline-none border-2 focus:border-[#FFD700] mb-6 shadow-inner" placeholder="••••" autoFocus />
                {error && <p className="text-red-500 text-sm font-bold mb-6 animate-pulse flex items-center gap-2"><AlertCircle size={16}/> {error}</p>}
                <div className="grid grid-cols-2 gap-4 w-full"><button onClick={onClose} className="py-4 bg-gray-100 rounded-2xl font-bold text-gray-600 text-sm hover:bg-gray-200">取消</button><button onClick={handleVerify} disabled={!pin} className="py-4 bg-[#1A1A1A] text-[#FFD700] rounded-2xl font-bold shadow-xl disabled:opacity-50 text-sm hover:scale-105 transition-transform">确认 (Confirm)</button></div>
            </div>
        </div>
    );
};

const EditRecordModal: React.FC<{ isOpen: boolean; onClose: () => void; record: AttendanceRecord; onSave: (updated: AttendanceRecord) => void; }> = ({ isOpen, onClose, record, onSave }) => {
    const [inTime, setInTime] = useState('');
    const [outTime, setOutTime] = useState('');
    useEffect(() => { if (isOpen && record) { setInTime(new Date(record.clockIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })); setOutTime(record.clockOut ? new Date(record.clockOut).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''); } }, [isOpen, record]);
    const handleSave = () => {
        const constructISO = (timeStr: string, isNextDay: boolean) => { if (!timeStr) return undefined; const [hh, mm] = timeStr.split(':').map(Number); const d = new Date(record.date); d.setHours(hh, mm, 0, 0); if (isNextDay && hh < 12) d.setDate(d.getDate() + 1); return d.toISOString(); };
        const newIn = constructISO(inTime, false); const newOut = constructISO(outTime, true);
        if (!newIn) return;
        const duration = newOut ? Math.floor((new Date(newOut).getTime() - new Date(newIn).getTime()) / 60000) : 0;
        const checkInDate = new Date(newIn); const ruleDate = new Date(record.date); ruleDate.setHours(16, 0, 0, 0);
        let status: any = 'PRESENT'; if (checkInDate > ruleDate) status = 'LATE'; if (newOut) status = 'COMPLETED';
        onSave({ ...record, clockIn: newIn, clockOut: newOut || '', durationMinutes: duration, status: status }); onClose();
    };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl"><h3 className="font-black text-2xl text-[#1A1A1A] mb-6">修正考勤记录</h3><div className="space-y-6 mb-8"><div><label className="text-xs font-bold text-gray-400 uppercase block mb-2">上班时间 (Clock In)</label><input type="time" value={inTime} onChange={e => setInTime(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-mono text-xl font-bold border-2 border-gray-200 outline-none focus:border-[#FFD700]" /></div><div><label className="text-xs font-bold text-gray-400 uppercase block mb-2">下班时间 (Clock Out)</label><input type="time" value={outTime} onChange={e => setOutTime(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-mono text-xl font-bold border-2 border-gray-200 outline-none focus:border-[#FFD700]" /></div></div><div className="grid grid-cols-2 gap-4"><button onClick={onClose} className="py-4 bg-gray-100 rounded-2xl font-bold text-gray-600">取消</button><button onClick={handleSave} className="py-4 bg-[#1A1A1A] text-[#FFD700] rounded-2xl font-bold shadow-lg">保存修正</button></div></div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export const AttendanceConsole: React.FC<AttendanceConsoleProps> = ({ onClose }) => {
    const [staffList, setStaffList] = useState<Employee[]>([]);
    const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
    const [dailyRoster, setDailyRoster] = useState<Record<string, RosterStatus>>({}); 
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string>('');

    // Interaction States
    const [securityModalOpen, setSecurityModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ type: 'IN' | 'OUT', employee: Employee } | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
    const [showRollCall, setShowRollCall] = useState(false);
    const [showReport, setShowReport] = useState(false);
    
    // Batch Menu State
    const [showBatchMenu, setShowBatchMenu] = useState(false);
    const batchMenuRef = useRef<HTMLDivElement>(null);

    // Scroll Lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; }
    }, []);

    // Close batch menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (batchMenuRef.current && !batchMenuRef.current.contains(event.target as Node)) {
                setShowBatchMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);
    useEffect(() => { const dateStr = getBusinessDate(); setSelectedDate(dateStr); loadData(dateStr); }, []);

    const getBusinessDate = () => { const now = new Date(); if (now.getHours() < 4) now.setDate(now.getDate() - 1); return now.toISOString().split('T')[0]; };
    const loadData = async (dateStr: string) => {
        setIsLoading(true);
        const allStaff = await DataManager.getEmployees();
        setStaffList(allStaff.filter(s => !s.isArchived && !s.role.includes('Owner')));
        
        const [attendanceData, { roster }] = await Promise.all([
            DataManager.getAttendanceByDate(dateStr),
            DataManager.getRosterData()
        ]);
        
        setTodayRecords(attendanceData);
        setDailyRoster(roster[dateStr] || {}); 
        setIsLoading(false);
    };

    const initiateClockAction = (employee: Employee, type: 'IN' | 'OUT') => { 
        if (type === 'IN') {
             setPendingAction({ type, employee }); 
             setSecurityModalOpen(true); 
        } else {
             setPendingAction({ type, employee });
             setSecurityModalOpen(true);
        }
    };
    
    const executeClockAction = async () => {
        if (!pendingAction) return;
        const { employee, type } = pendingAction;
        const now = new Date();
        const dateStr = selectedDate; 
        
        if (type === 'IN') {
            const ruleDate = new Date(dateStr); ruleDate.setHours(16, 0, 0, 0);
            const isLate = now > ruleDate;
            
            const targetOutTime = new Date(dateStr);
            targetOutTime.setDate(targetOutTime.getDate() + 1); 
            targetOutTime.setHours(2, 0, 0, 0); 
            
            const durationMinutes = Math.floor((targetOutTime.getTime() - now.getTime()) / 60000);

            const newRecord: AttendanceRecord = { 
                id: `${dateStr}_${employee.id}`, 
                employeeId: employee.id, 
                employeeName: employee.name, 
                date: dateStr, 
                clockIn: now.toISOString(), 
                clockOut: targetOutTime.toISOString(), 
                durationMinutes: Math.max(0, durationMinutes), 
                status: isLate ? 'LATE' : 'COMPLETED', 
                notes: 'Auto-Clocked Out @ 2AM'
            };
            
            await DataManager.saveAttendance(newRecord);
            setTodayRecords(prev => [...prev, newRecord]);
        } else {
            const record = todayRecords.find(r => r.employeeId === employee.id);
            if (!record) return;
            const duration = Math.floor((now.getTime() - new Date(record.clockIn).getTime()) / 60000);
            const newRecord = { ...record, clockOut: now.toISOString(), durationMinutes: duration, status: 'COMPLETED' as any };
            await DataManager.saveAttendance(newRecord);
            setTodayRecords(prev => prev.map(r => r.id === record.id ? newRecord : r));
        }
        setPendingAction(null);
    };

    const getBatchGroup = (role: string): 'FLOOR' | 'KITCHEN' => {
        const r = role.toUpperCase();
        if (['MANAGER', 'SUPERVISOR', 'COUNTER', 'CAPTAIN', 'WAITER', 'CLEANER', 'PART_TIME', 'BAR', 'DISH', '水吧', '洗碗'].some(k => r.includes(k))) {
            return 'FLOOR';
        }
        return 'KITCHEN';
    };

    const handleBatchClockIn = async (targetGroup: 'FLOOR' | 'KITCHEN' | 'ALL') => {
        setShowBatchMenu(false); 

        const eligibleStaff = staffList.filter(staff => {
            const hasRecord = todayRecords.some(r => r.employeeId === staff.id);
            if (hasRecord) return false;

            const status = dailyRoster[staff.id];
            if (status && ['OFF', 'MC', 'LEAVE', 'ABSENT', 'ANNUAL'].includes(status)) return false;

            if (targetGroup !== 'ALL') {
                const staffGroup = getBatchGroup(staff.role);
                if (staffGroup !== targetGroup) return false;
            }

            return true;
        });

        if (eligibleStaff.length === 0) {
            alert(`没有需要打卡的${targetGroup === 'FLOOR' ? '楼面' : targetGroup === 'KITCHEN' ? '厨房' : ''}员工 (No eligible staff)`);
            return;
        }

        const groupName = targetGroup === 'FLOOR' ? '楼面+水吧+洗碗' : targetGroup === 'KITCHEN' ? '厨房核心' : '全员';
        if (!confirm(`确定要为 ${eligibleStaff.length} 位 [${groupName}] 员工一键打卡吗？\n(Batch Clock In for ${eligibleStaff.length} staff?)`)) return;

        setIsLoading(true);
        try {
            const clockInTime = new Date(selectedDate);
            clockInTime.setHours(16, 0, 0, 0); 
            
            const clockOutTime = new Date(selectedDate);
            clockOutTime.setDate(clockOutTime.getDate() + 1);
            clockOutTime.setHours(2, 0, 0, 0);

            const updates = eligibleStaff.map(staff => {
                const newRecord: AttendanceRecord = {
                    id: `${selectedDate}_${staff.id}`,
                    employeeId: staff.id,
                    employeeName: staff.name,
                    date: selectedDate,
                    clockIn: clockInTime.toISOString(),
                    clockOut: clockOutTime.toISOString(),
                    durationMinutes: 600, 
                    status: 'COMPLETED',
                    notes: `Batch Auto-In (${groupName})`
                };
                return DataManager.saveAttendance(newRecord);
            });

            await Promise.all(updates);
            await loadData(selectedDate);
            alert(`✅ 已为 ${eligibleStaff.length} 位员工打卡`);
        } catch (error) {
            console.error(error);
            alert("Batch operation failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        setSelectedDate(newDate);
        loadData(newDate);
    };

    const saveEditedRecord = async (updated: AttendanceRecord) => {
        await DataManager.saveAttendance(updated);
        setTodayRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
    };

    const filteredStaff = staffList.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.includes(searchTerm));
    
    // --- UPDATED FOUR-TIER ROLE CLASSIFICATION ---
    const isWaterBar = (role: string) => ['BAR', '水吧'].some(r => role.toUpperCase().includes(r));
    const isDishwasher = (role: string) => ['DISH', '洗碗', 'CLEANER', '清洁', '后勤'].some(r => role.toUpperCase().includes(r));
    const isFOH = (role: string) => ['MANAGER', 'SUPERVISOR', 'COUNTER', 'CAPTAIN', 'WAITER', 'PART_TIME'].some(r => role.toUpperCase().includes(r)) && !isWaterBar(role) && !isDishwasher(role);
    const isBOH = (role: string) => !isFOH(role) && !isWaterBar(role) && !isDishwasher(role); // Everyone else defaults to Kitchen/BOH

    const fohStaff = filteredStaff.filter(s => isFOH(s.role));
    const waterBarStaff = filteredStaff.filter(s => isWaterBar(s.role));
    const dishwasherStaff = filteredStaff.filter(s => isDishwasher(s.role));
    const bohStaff = filteredStaff.filter(s => isBOH(s.role));

    const sortStaff = (list: Employee[]) => {
        return list.sort((a, b) => {
            const recA = todayRecords.find(r => r.employeeId === a.id);
            const recB = todayRecords.find(r => r.employeeId === b.id);
            const statusA = recA ? (recA.clockOut ? 2 : 0) : 1; 
            const statusB = recB ? (recB.clockOut ? 2 : 0) : 1;
            return statusA - statusB;
        });
    };

    const sortedFOH = sortStaff(fohStaff);
    const sortedWaterBar = sortStaff(waterBarStaff);
    const sortedDishwasher = sortStaff(dishwasherStaff);
    const sortedBOH = sortStaff(bohStaff);

    const renderStaffCard = (staff: Employee) => {
        const record = todayRecords.find(r => r.employeeId === staff.id);
        const isCompleted = !!(record && record.clockOut); 
        const isLate = record && (record.status === 'LATE' || record.status === 'COMPLETED_LATE'); 
        
        const now = new Date();
        const isActiveShift = isCompleted && new Date(record.clockOut).getTime() > now.getTime();

        const planStatus = dailyRoster[staff.id] || 'WORK'; 
        const isPlannedOff = planStatus !== 'WORK';
        const rosterBadge = getRosterBadge(planStatus);

        return (
            <div key={staff.id} className={`p-5 rounded-3xl border-2 transition-all shadow-sm flex flex-col justify-between gap-4 group relative overflow-hidden active:scale-[0.98] ${
                isActiveShift ? 'bg-white border-green-400 ring-2 ring-green-100' : 
                isCompleted ? 'bg-gray-50 border-gray-200 opacity-80' : 
                isPlannedOff ? 'bg-gray-50 border-gray-200 opacity-75' : 
                'bg-white border-gray-100 hover:border-gray-300'
            }`}>
                <div className={`absolute top-0 left-0 w-full h-1.5 ${isActiveShift ? 'bg-green-500' : isCompleted ? 'bg-blue-400' : isPlannedOff ? 'bg-gray-300' : 'bg-gray-200'}`}></div>
                
                <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center font-black text-lg shrink-0 border-4 overflow-hidden ${isActiveShift ? 'border-green-100 text-green-700 bg-green-50' : 'border-gray-100 bg-gray-100 text-gray-400'}`}>
                        {staff.avatar ? <img src={staff.avatar} className="w-full h-full object-cover"/> : staff.name.charAt(0)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-lg text-[#1A1A1A] leading-none">{staff.name}</h3>
                            {isLate && <span className="bg-red-100 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded-md animate-pulse">LATE</span>}
                            {rosterBadge && !isCompleted && (
                                <span className={`text-[9px] px-2 py-0.5 rounded border flex items-center gap-1 font-bold ${rosterBadge.color}`}>
                                    <rosterBadge.icon size={10} /> {rosterBadge.label}
                                </span>
                            )}
                        </div>
                        <div className="text-xs font-bold text-gray-400 uppercase mt-1 tracking-wider">{staff.role.split('(')[0]}</div>
                        <div className="text-[10px] font-mono text-gray-300 mt-0.5">#{staff.id}</div>
                    </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    {isCompleted ? (
                        <>
                            <div className="flex flex-col">
                                {isActiveShift ? (
                                    <div className="text-green-600 font-bold text-xs flex items-center gap-1">
                                        <Clock size={12} className="animate-spin-slow"/> 
                                        Working until 2AM
                                    </div>
                                ) : (
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">Shift Ended</span>
                                )}
                                <span className="text-sm font-black text-gray-700 font-mono">
                                    {new Date(record!.clockIn).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} - 02:00
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Done</span>
                                <button onClick={() => { setEditingRecord(record); setEditModalOpen(true); }} className="p-2 bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600"><Edit3 size={16}/></button>
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="text-xs font-bold text-gray-300 italic">{isPlannedOff ? 'Scheduled OFF' : 'Not Started'}</span>
                            <button onClick={() => initiateClockAction(staff, 'IN')} className={`border-2 text-sm font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 ${isPlannedOff ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100' : 'bg-white border-gray-200 text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200'}`}>
                                <LogIn size={16}/> {isPlannedOff ? '加班 (OT)' : '上班 (In)'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-[#F5F7FA] z-[100] flex flex-col animate-in fade-in duration-200 font-sans">
            {/* Header - Mobile & iPad Optimized & Safe-Area */}
            <div className="bg-[#1A1A1A] px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] md:px-5 md:pb-5 md:pt-[max(env(safe-area-inset-top),1.25rem)] flex flex-col md:flex-row justify-between items-center text-white shrink-0 shadow-xl z-20 border-b-4 border-[#FFD700]">
                <div className="flex items-center gap-3 md:gap-5 w-full md:w-auto mb-3 md:mb-0">
                    <div className="bg-[#FFD700] text-black p-2 md:p-3 rounded-xl md:rounded-2xl shadow-gold"><Briefcase size={20} className="md:w-7 md:h-7" /></div>
                    <div>
                        <h2 className="text-lg md:text-2xl font-black tracking-wide text-white">考勤指挥台</h2>
                        <p className="text-[9px] md:text-xs text-gray-400 font-mono tracking-[0.2em] uppercase mt-0.5">Central Attendance Control</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-between md:justify-end overflow-x-auto scrollbar-hide">
                    
                    <div className="relative shrink-0" ref={batchMenuRef}>
                        <button 
                            onClick={() => setShowBatchMenu(!showBatchMenu)} 
                            disabled={isLoading} 
                            className="bg-[#FFD700] text-black hover:bg-white px-3 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl text-[10px] md:text-sm font-bold transition-all border border-[#FFD700] flex items-center gap-1 md:gap-2 active:scale-95 shadow-lg whitespace-nowrap"
                        >
                            <Zap size={14} className="md:w-[18px] md:h-[18px]" fill="currentColor"/> <span className="hidden sm:inline">一键开工</span><span className="sm:hidden">批量</span> <ChevronDown size={14} className={`transition-transform ${showBatchMenu ? 'rotate-180' : ''}`}/>
                        </button>
                        
                        {showBatchMenu && (
                            <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 w-48 md:w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in slide-in-from-top-2">
                                <button onClick={() => handleBatchClockIn('FLOOR')} className="w-full text-left px-3 py-2 md:px-4 md:py-3 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-50">
                                    <div className="p-1.5 md:p-2 bg-blue-100 text-blue-600 rounded-lg"><Coffee size={14} className="md:w-4 md:h-4"/></div>
                                    <div><span className="font-bold text-xs md:text-sm text-[#1A1A1A]">楼面 & 水吧</span><p className="text-[8px] md:text-[10px] text-gray-400">Floor, Bar & Dish</p></div>
                                </button>
                                <button onClick={() => handleBatchClockIn('KITCHEN')} className="w-full text-left px-3 py-2 md:px-4 md:py-3 hover:bg-orange-50 flex items-center gap-3 border-b border-gray-50">
                                    <div className="p-1.5 md:p-2 bg-orange-100 text-orange-600 rounded-lg"><ChefHat size={14} className="md:w-4 md:h-4"/></div>
                                    <div><span className="font-bold text-xs md:text-sm text-[#1A1A1A]">厨房团队</span><p className="text-[8px] md:text-[10px] text-gray-400">Kitchen Team</p></div>
                                </button>
                                <button onClick={() => handleBatchClockIn('ALL')} className="w-full text-left px-3 py-2 md:px-4 md:py-3 hover:bg-gray-50 flex items-center gap-3">
                                    <div className="p-1.5 md:p-2 bg-gray-100 text-gray-600 rounded-lg"><Users size={14} className="md:w-4 md:h-4"/></div>
                                    <div><span className="font-bold text-xs md:text-sm text-[#1A1A1A]">全员开工</span><p className="text-[8px] md:text-[10px] text-gray-400">All Staff</p></div>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 shrink-0">
                        <button onClick={() => setShowRollCall(true)} className="bg-white/10 hover:bg-white/20 px-3 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl text-[10px] md:text-sm font-bold transition-all border border-white/10 flex items-center gap-1 md:gap-2 active:scale-95 whitespace-nowrap"><ListChecks size={14} className="md:w-[18px] md:h-[18px]"/> 点名</button>
                        <button onClick={() => setShowReport(true)} className="bg-white/10 hover:bg-white/20 px-3 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl text-[10px] md:text-sm font-bold transition-all border border-white/10 flex items-center gap-1 md:gap-2 active:scale-95 whitespace-nowrap"><FileBarChart size={14} className="md:w-[18px] md:h-[18px]"/> 达标</button>
                    </div>
                    <div className="h-8 md:h-10 w-px bg-white/10 mx-1 md:mx-2 hidden sm:block"></div>
                    <button onClick={onClose} className="p-2 md:p-3 hover:bg-white/10 rounded-full transition-colors shrink-0"><X size={20} className="md:w-6 md:h-6"/></button>
                </div>
            </div>

            <div className="bg-white px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-3 w-full md:w-auto bg-gray-50 p-1.5 rounded-2xl border border-gray-200">
                    <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toISOString().split('T')[0]); loadData(d.toISOString().split('T')[0]); }} className="p-3 hover:bg-white rounded-xl text-gray-500 transition-colors shadow-sm"><TrendingUp size={20} className="rotate-180"/></button>
                    <input type="date" value={selectedDate} onChange={handleDateChange} className="bg-transparent font-black text-lg outline-none text-center w-40 text-[#1A1A1A]" />
                    <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toISOString().split('T')[0]); loadData(d.toISOString().split('T')[0]); }} className="p-3 hover:bg-white rounded-xl text-gray-500 transition-colors shadow-sm"><TrendingUp size={20}/></button>
                </div>
                
                <div className="flex gap-6 text-sm font-bold text-gray-500">
                    <span className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-lg"><div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div> Active: {todayRecords.filter(r => {
                        return r.clockOut && new Date(r.clockOut).getTime() > new Date().getTime();
                    }).length}</span>
                    <span className="flex items-center gap-2 bg-gray-100 text-gray-600 px-3 py-1 rounded-lg"><div className="w-2.5 h-2.5 rounded-full bg-gray-400"></div> Total: {todayRecords.length}</span>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
                    <input type="text" placeholder="搜索员工 (Search Staff)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-100 border-none rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-[#1A1A1A] transition-all shadow-inner"/>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto bg-[#F5F7FA]">
                <div className="p-4 md:p-8 grid grid-cols-1 gap-8">
                    {isLoading ? <div className="text-center py-20 text-gray-400 font-bold animate-pulse text-lg">Loading Staff Data...</div> : (
                        <>
                            {/* FOH Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-2 pb-2 border-b-2 border-gray-100">
                                    <div className="p-2.5 bg-yellow-100 text-yellow-700 rounded-xl"><Briefcase size={24}/></div>
                                    <h3 className="font-black text-gray-800 text-xl tracking-tight">楼面团队 (FOH)</h3>
                                    <span className="bg-gray-200 text-gray-600 text-xs font-black px-3 py-1 rounded-full">{sortedFOH.length}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {sortedFOH.map(renderStaffCard)}
                                    {sortedFOH.length === 0 && <div className="text-center py-12 text-gray-400 text-sm font-bold italic col-span-full bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">No FOH Staff Found</div>}
                                </div>
                            </div>

                            {/* Water Bar Section */}
                            {(sortedWaterBar.length > 0 || searchTerm) && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 mb-2 pb-2 border-b-2 border-gray-100 mt-4">
                                        <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl"><Coffee size={24}/></div>
                                        <h3 className="font-black text-gray-800 text-xl tracking-tight">水吧团队 (Water Bar)</h3>
                                        <span className="bg-gray-200 text-gray-600 text-xs font-black px-3 py-1 rounded-full">{sortedWaterBar.length}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {sortedWaterBar.map(renderStaffCard)}
                                        {sortedWaterBar.length === 0 && <div className="text-center py-12 text-gray-400 text-sm font-bold italic col-span-full bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">No Water Bar Staff Found</div>}
                                    </div>
                                </div>
                            )}

                            {/* Dishwasher / Support Section */}
                            {(sortedDishwasher.length > 0 || searchTerm) && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 mb-2 pb-2 border-b-2 border-gray-100 mt-4">
                                        <div className="p-2.5 bg-teal-100 text-teal-600 rounded-xl"><Droplets size={24}/></div>
                                        <h3 className="font-black text-gray-800 text-xl tracking-tight">后勤与洗碗 (Support/Dish)</h3>
                                        <span className="bg-gray-200 text-gray-600 text-xs font-black px-3 py-1 rounded-full">{sortedDishwasher.length}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {sortedDishwasher.map(renderStaffCard)}
                                        {sortedDishwasher.length === 0 && <div className="text-center py-12 text-gray-400 text-sm font-bold italic col-span-full bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">No Support/Dish Staff Found</div>}
                                    </div>
                                </div>
                            )}

                            {/* BOH Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-2 pb-2 border-b-2 border-gray-100 mt-4">
                                    <div className="p-2.5 bg-orange-100 text-orange-600 rounded-xl"><ChefHat size={24}/></div>
                                    <h3 className="font-black text-gray-800 text-xl tracking-tight">厨房团队 (BOH)</h3>
                                    <span className="bg-gray-200 text-gray-600 text-xs font-black px-3 py-1 rounded-full">{sortedBOH.length}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {sortedBOH.map(renderStaffCard)}
                                    {sortedBOH.length === 0 && <div className="text-center py-12 text-gray-400 text-sm font-bold italic col-span-full bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">No BOH Staff Found</div>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <SecurityPinModal isOpen={securityModalOpen} onClose={() => setSecurityModalOpen(false)} onSuccess={executeClockAction} employeeName={pendingAction?.employee.name || ''} targetPin={pendingAction?.employee.pin || '0000'} />
            {editingRecord && <EditRecordModal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} record={editingRecord} onSave={saveEditedRecord} />}
            <RollCallModal isOpen={showRollCall} onClose={() => setShowRollCall(false)} staffList={staffList} todayRecords={todayRecords} dateStr={selectedDate} onUpdate={() => loadData(selectedDate)} dailyRoster={dailyRoster} />
            <ComplianceReportModal isOpen={showReport} onClose={() => setShowReport(false)} staffList={staffList} />
        </div>
    );
};