import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DollarSign, Save, Calendar, CheckCircle2, Calculator, X, Plus, MinusCircle, Building2, Info, RotateCcw, Printer, FileDown, Loader2, Wallet, Banknote, CreditCard, ToggleLeft, ToggleRight, CalendarDays, CheckSquare, Square, UserX, ChevronLeft, ChevronRight, RefreshCw, LockOpen, Landmark, Ban, History, FileText } from 'lucide-react';
import { Employee, PayrollRecord, ExpenseItem, RosterStatus } from '../../../types';
import { DataManager } from '../../../utils/dataManager';
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from '../../../firebaseConfig';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

// --- INTERFACES ---

interface DetailedPayrollEntry {
    // Earnings
    basic: number;
    allowance: number; // Fixed Allowances
    ot: number;        // Overtime / Commission / Variable
    bonus: number;
    
    // Public Holiday Pay (3x)
    holidayDays: number;     // Number of PH days worked
    holidayPay: number;      // Auto-calculated: dailyRate * 2 * holidayDays (extra 2x on top of basic)
    
    // Deductions (Company)
    latePenalty: number;
    unpaidLeave: number;
    advanceLoan: number;
    
    // Statutory (Auto-calced but overrideable)
    ee_epf: number;
    ee_socso: number;
    ee_eis: number;
    ee_pcb: number; // Tax
    
    er_epf: number;
    er_socso: number;
    er_eis: number;
    
    note: string;
    
    // Settings for this entry
    autoCalc: boolean;
    hasEPF: boolean;
    hasSOCSO: boolean;
    paymentMethod: 'BANK' | 'CASH' | 'CHEQUE';
    proRateMode?: '26_DAYS' | 'CALENDAR_DAYS' | 'WORKABLE_DAYS'; // Persistent State
    workDays?: number; // Store the manually entered days
}

interface HRPayrollProps {
    employees: Employee[];
}

// --- MALAYSIA STATUTORY CALCULATION HELPERS ---

const calculateEPF = (gross: number, isEmployer: boolean) => {
    if (gross <= 0) return 0;
    if (!isEmployer) {
        return Math.ceil(gross * 0.11);
    } else {
        const rate = gross <= 5000 ? 0.13 : 0.12;
        return Math.ceil(gross * rate);
    }
};

const SOCSO_EMPLOYER_LOOKUP: Record<number, number> = {
    // Low wage brackets (per PERKESO Jadual Caruman)
    100: 0.40, 200: 0.70, 300: 1.20, 400: 1.75, 500: 2.30, 600: 2.80, 700: 3.35, 800: 3.90, 900: 4.40,
    1000: 4.95, 1100: 5.45, 1200: 5.95, 1300: 6.50, 1400: 7.00, 1500: 7.50, 1600: 8.05, 1700: 8.55, 
    1800: 9.05, 1900: 9.60, 2000: 10.10, 2100: 14.65, 2200: 16.35, 2300: 18.15, 2400: 19.85, 2500: 21.65,
    2600: 23.35, 2700: 25.15, 2800: 26.85, 2900: 28.65,
    // Standard brackets
    3000: 51.65, 3100: 53.35, 3200: 55.15, 3300: 56.85, 3400: 58.65,
    3500: 60.35, 3600: 62.15, 3700: 63.85, 3800: 65.65, 3900: 67.35,
    4000: 69.05, 4100: 70.85, 4200: 72.55, 4300: 74.35, 4400: 76.05,
    4500: 77.85, 4600: 79.55, 4700: 81.35, 4800: 83.05, 4900: 84.85,
    5000: 86.55, 5100: 88.35, 5200: 90.05, 5300: 91.85, 5400: 93.55,
    5500: 95.35, 5600: 97.05, 5700: 98.85, 5800: 100.55, 5900: 102.35,
    6000: 104.15
};

const SOCSO_EMPLOYEE_LOOKUP: Record<number, number> = {
    100: 0.10, 200: 0.20, 300: 0.30, 400: 0.50, 500: 0.60, 600: 0.70, 700: 0.85, 800: 1.00, 900: 1.10,
    1000: 1.25, 1100: 1.35, 1200: 1.50, 1300: 1.65, 1400: 1.75, 1500: 1.90, 1600: 2.05, 1700: 2.15,
    1800: 2.30, 1900: 2.45, 2000: 2.55, 2100: 3.65, 2200: 4.10, 2300: 4.55, 2400: 4.95, 2500: 5.40,
    2600: 5.85, 2700: 6.30, 2800: 6.70, 2900: 7.15,
    3000: 7.60, 3100: 7.85, 3200: 8.10, 3300: 8.35, 3400: 8.60, 3500: 8.85, 3600: 9.10, 3700: 9.35,
    3800: 9.65, 3900: 9.90, 4000: 10.15, 4100: 10.40, 4200: 10.65, 4300: 10.90, 4400: 11.15,
    4500: 11.40, 4600: 11.65, 4700: 11.90, 4800: 12.15, 4900: 12.45, 5000: 12.70,
    5100: 12.95, 5200: 13.20, 5300: 13.45, 5400: 13.70, 5500: 13.95, 5600: 14.20,
    5700: 14.45, 5800: 14.70, 5900: 14.95, 6000: 15.20
};

const calculateSOCSO = (wage: number, isEmployer: boolean) => {
    if (wage <= 0) return 0;
    const cappedWage = Math.min(wage, 6000);
    if (cappedWage < 30) return isEmployer ? 0.40 : 0.10;
    const bracket = Math.ceil(cappedWage / 100) * 100;
    
    const lookup = isEmployer ? SOCSO_EMPLOYER_LOOKUP : SOCSO_EMPLOYEE_LOOKUP;
    if (lookup[bracket]) return lookup[bracket];
    
    // Fallback formula (should not normally be needed)
    if (!isEmployer) {
        let amount = (bracket * 0.005);
        if (bracket > 200) amount = amount - 0.25;
        return parseFloat(amount.toFixed(2));
    } else {
        let amount = (bracket * 0.0175);
        if (bracket > 200) amount = amount - 0.85; 
        return parseFloat(amount.toFixed(2));
    }
};

const EIS_LOOKUP: Record<number, number> = {
    100: 0.05, 200: 0.10, 300: 0.15, 400: 0.20, 500: 0.25, 600: 0.30, 700: 0.35, 800: 0.40, 900: 0.45,
    1000: 0.50, 1100: 0.55, 1200: 0.60, 1300: 0.65, 1400: 0.70, 1500: 0.75, 1600: 0.80, 1700: 0.85,
    1800: 0.90, 1900: 0.95, 2000: 1.00, 2100: 2.10, 2200: 2.20, 2300: 2.30, 2400: 2.40, 2500: 2.50,
    2600: 2.60, 2700: 2.70, 2800: 2.80, 2900: 2.90, 3000: 3.00, 3100: 3.10, 3200: 3.20, 3300: 3.30,
    3400: 3.40, 3500: 3.50, 3600: 3.60, 3700: 3.70, 3800: 3.80, 3900: 3.90, 4000: 4.00,
    4100: 4.10, 4200: 4.20, 4300: 4.30, 4400: 4.40, 4500: 4.50, 4600: 4.60, 4700: 4.70,
    4800: 4.80, 4900: 4.90, 5000: 5.00, 5100: 5.10, 5200: 5.20, 5300: 5.30, 5400: 5.40,
    5500: 5.50, 5600: 5.60, 5700: 5.70, 5800: 5.80, 5900: 5.90, 6000: 6.00
};

const calculateEIS = (wage: number, isEmployer: boolean) => {
    if (wage <= 0) return 0;
    const cappedWage = Math.min(wage, 6000);
    if (cappedWage <= 30) return 0.05;
    const bracket = Math.ceil(cappedWage / 100) * 100;
    
    // EIS rate is same for employee and employer (0.2% each)
    if (EIS_LOOKUP[bracket]) return EIS_LOOKUP[bracket];
    
    // Fallback
    let amount = (bracket * 0.002);
    if (bracket > 200) amount = amount - 0.10; 
    return parseFloat(amount.toFixed(2));
};

// --- HISTORICAL SALARY HELPER ---
const getHistoricalSalary = (emp: Employee, monthStr: string) => {
    if (!emp.salaryHistory || emp.salaryHistory.length === 0) return emp.basicSalary || 0;

    // Changes are effective if date <= end of target month
    const targetDate = `${monthStr}-31`; 

    // Sort history: Newest first
    const sortedHistory = [...emp.salaryHistory].sort((a, b) => b.date.localeCompare(a.date));

    // Identify changes that happened AFTER the target month (Future Changes)
    const futureChanges = sortedHistory.filter(rec => rec.date > targetDate);

    if (futureChanges.length > 0) {
        // Reverse future adjustments to find past salary
        const totalFutureAdjustment = futureChanges.reduce((sum, rec) => sum + (rec.adjustment || 0), 0);
        return (emp.basicSalary || 0) - totalFutureAdjustment;
    }

    return emp.basicSalary || 0;
};

export const HRPayroll: React.FC<HRPayrollProps> = ({ employees }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [payrollData, setPayrollData] = useState<Record<string, DetailedPayrollEntry>>({});
    const [dailyRoster, setDailyRoster] = useState<Record<string, Record<string, RosterStatus>>>({});
    const [isPosted, setIsPosted] = useState(false);
    const [isStatutoryPaid, setIsStatutoryPaid] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    // Store raw advances for history lookup
    const [monthAdvances, setMonthAdvances] = useState<ExpenseItem[]>([]);
    
    // Filter & Selection State
    const [showResigned, setShowResigned] = useState(false);
    const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());

    // Modal State
    const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
    const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
    const [advForm, setAdvForm] = useState({ empId: '', amount: '', date: new Date().toISOString().split('T')[0], note: '', method: 'BANK_TRANSFER' });
    const [showAdvanceHistory, setShowAdvanceHistory] = useState(false);

    // Pro-rate Tool State
    const [proRateSettings, setProRateSettings] = useState({
        days: 0,
        mode: '26_DAYS' as '26_DAYS' | 'CALENDAR_DAYS' | 'WORKABLE_DAYS', 
        startDate: '',
        endDate: ''
    });

    const [showPayConfirm, setShowPayConfirm] = useState(false);

    // PDF Ref
    const printSlipRef = useRef<HTMLDivElement>(null);
    const printSummaryRef = useRef<HTMLDivElement>(null);

    // Derived States
    const displayEmployees = useMemo(() => {
        return employees.filter(e => (!e.isArchived || showResigned) && !e.role.includes('Owner'));
    }, [employees, showResigned]);

    const localEmployees = useMemo(() => {
        return displayEmployees.filter(e => e.nationality.includes('Malaysian') || e.nationality.includes('🇲🇾'));
    }, [displayEmployees]);

    const foreignEmployees = useMemo(() => {
        return displayEmployees.filter(e => !e.nationality.includes('Malaysian') && !e.nationality.includes('🇲🇾'));
    }, [displayEmployees]);

    const editingEntry = editingEmpId ? payrollData[editingEmpId] : null;
    const editingEmp = editingEmpId ? employees.find(e => e.id === editingEmpId) : null;
    
    // Get advances for current editing employee
    const currentEmpAdvances = useMemo(() => {
        if (!editingEmp) return [];
        return monthAdvances
            .filter(a => a.company === editingEmp.name)
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    }, [editingEmp, monthAdvances]);

    // --- LOGIC FUNCTIONS ---

    // 1. Create Default Entry (Moved inside component to access selectedMonth)
    const createDefaultEntry = (emp: Employee, advances: ExpenseItem[]): DetailedPayrollEntry => {
        // Strict Name Matching for Advance (from standalone_expenses)
        const totalAdv = advances
            .filter(a => a.company === emp.name) // EXACT MATCH
            .reduce((sum, a) => sum + (a.amount || 0), 0);

        // LOAN SYNC: Also include outstanding loan balance from employee profile
        const loanBalance = (emp.loanRecords || []).reduce((sum, r) => sum + (r.type === 'BORROW' ? r.amount : -r.amount), 0);

        const isLocal = emp.nationality.includes('Malaysian') || emp.nationality.includes('🇲🇾');
        const historicalBasic = getHistoricalSalary(emp, selectedMonth);

        return {
            basic: Number(historicalBasic) || 0,
            allowance: 0,
            ot: 0,
            bonus: 0,
            holidayDays: 0,
            holidayPay: 0,
            latePenalty: 0,
            unpaidLeave: 0,
            advanceLoan: totalAdv + Math.max(0, loanBalance), // Combine advances + outstanding loans
            ee_epf: 0, ee_socso: 0, ee_eis: 0, ee_pcb: 0,
            er_epf: 0, er_socso: 0, er_eis: 0,
            note: loanBalance > 0 ? `[Auto] Outstanding loan: RM${loanBalance.toFixed(2)}` : '',
            autoCalc: true,
            hasEPF: isLocal || emp.hasEPF === true,
            hasSOCSO: isLocal,
            paymentMethod: 'BANK',
            proRateMode: '26_DAYS',
            workDays: 0
        };
    };

    const loadPayrollForMonth = async () => {
        setIsLoading(true);
        try {
            const initialData: Record<string, DetailedPayrollEntry> = {};
            
            const [allRecords, rosterData] = await Promise.all([
                DataManager.getPayrollRecords(),
                DataManager.getRosterData()
            ]);

            const existingRecord = allRecords.find(r => r.id === selectedMonth);
            setDailyRoster(rosterData.roster || {});

            const startOfMonth = `${selectedMonth}-01`;
            const endOfMonth = `${selectedMonth}-31`; // Loose end date covers all
            
            // Get all expenses to filter for advances
            const snap = await getDocs(collection(db, 'standalone_expenses'));
            const allExpenses = snap.docs.map(d => d.data() as ExpenseItem);
            
            const advances = allExpenses.filter(e => 
                e.category === 'STAFF_ADVANCE' && 
                e.time >= startOfMonth && 
                e.time <= endOfMonth
            );
            
            // Store raw advances for history view
            setMonthAdvances(advances);

            // We iterate over displayEmployees but need to cover everyone potentially in the month
            const targetEmployees = employees.filter(e => (!e.isArchived || showResigned) && !e.role.includes('Owner'));

            if (existingRecord) {
                setIsPosted(existingRecord.status === 'POSTED');
                setIsStatutoryPaid(!!existingRecord.isStatutoryPaid);
                
                targetEmployees.forEach(emp => {
                    const savedDetail = existingRecord.details.find(d => d.employeeId === emp.id);
                    
                    // AUTO-SYNC FIX: Calculate real-time advance regardless of saved value
                    const realTimeAdvance = advances
                        .filter(a => a.company === emp.name)
                        .reduce((sum, a) => sum + (a.amount || 0), 0);
                    
                    // LOAN SYNC: Include outstanding loan from employee profile
                    const empLoanBalance = (emp.loanRecords || []).reduce((sum: number, r: any) => sum + (r.type === 'BORROW' ? r.amount : -r.amount), 0);
                    const totalAdvanceWithLoan = realTimeAdvance + Math.max(0, empLoanBalance);

                    if (savedDetail) {
                        initialData[emp.id] = {
                            basic: Number(savedDetail.basicSalary) || 0,
                            allowance: Number(savedDetail.allowance) || 0,
                            ot: 0, 
                            bonus: 0,
                            holidayDays: Number(savedDetail.holidayDays) || 0,
                            holidayPay: Number(savedDetail.holidayPay) || 0,
                            latePenalty: Number(savedDetail.penalty) || 0,
                            unpaidLeave: 0,
                            // FORCE OVERRIDE ADVANCE+LOAN IF IN DRAFT MODE
                            advanceLoan: existingRecord.status === 'DRAFT' ? totalAdvanceWithLoan : (Number(savedDetail.advanceLoan) || 0),
                            ee_epf: Number(savedDetail.ee_epf) || 0,
                            ee_socso: Number(savedDetail.ee_socso) || 0,
                            ee_eis: Number(savedDetail.ee_eis) || 0,
                            ee_pcb: Number(savedDetail.ee_pcb) || 0,
                            er_epf: Number(savedDetail.er_epf) || 0,
                            er_socso: Number(savedDetail.er_socso) || 0,
                            er_eis: Number(savedDetail.er_eis) || 0,
                            note: savedDetail.note || '',
                            autoCalc: false, 
                            hasEPF: emp.nationality.includes('Malaysian') || emp.hasEPF === true, 
                            hasSOCSO: emp.nationality.includes('Malaysian'),
                            paymentMethod: savedDetail.paymentMethod || 'BANK',
                            proRateMode: savedDetail.proRateMode || '26_DAYS', 
                            workDays: savedDetail.workDays || 0 
                        };
                    } else {
                        // If new employee added after payroll saved, calculate default for them
                        initialData[emp.id] = createDefaultEntry(emp, advances);
                    }
                });
            } else {
                setIsPosted(false);
                setIsStatutoryPaid(false);
                targetEmployees.forEach(emp => {
                    initialData[emp.id] = createDefaultEntry(emp, advances);
                });
            }

            setPayrollData(initialData);
        } catch (error) {
            console.error("Load Payroll Error", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Load Data Effect
    useEffect(() => {
        loadPayrollForMonth();
    }, [selectedMonth, employees, showResigned]); 

    // Sync ProRate Settings
    useEffect(() => {
        if (editingEmpId && payrollData[editingEmpId]) {
            const entry = payrollData[editingEmpId];
            if (entry.proRateMode) {
                setProRateSettings(prev => ({ ...prev, mode: entry.proRateMode }));
            }
        }
    }, [editingEmpId, payrollData]);

    // Recalc Days on Edit Open
    useEffect(() => {
        if (editingEmpId && editingEmp) {
            const [year, month] = selectedMonth.split('-').map(Number);
            const totalDaysInMonth = new Date(year, month, 0).getDate();
            
            let rosterWorkDays = 0;
            const joinDate = editingEmp.joinDate || '';
            const isJoinMonth = joinDate.startsWith(selectedMonth);

            for (let d = 1; d <= totalDaysInMonth; d++) {
                const dayStr = String(d).padStart(2, '0');
                const dateStr = `${selectedMonth}-${dayStr}`;
                if (isJoinMonth && dateStr < joinDate) continue;
                const status = dailyRoster[dateStr]?.[editingEmpId] || 'WORK';
                if (status === 'WORK') rosterWorkDays++;
            }

            const currentEntry = payrollData[editingEmpId];
            const currentMode = currentEntry?.proRateMode || '26_DAYS';
            const daysToUse = (currentEntry?.workDays && currentEntry.workDays > 0) ? currentEntry.workDays : rosterWorkDays;

            setProRateSettings(prev => ({ 
                ...prev, days: daysToUse, mode: currentMode,
                startDate: isJoinMonth ? editingEmp.joinDate : `${selectedMonth}-01`, endDate: `${selectedMonth}-${totalDaysInMonth}` 
            }));
        }
    }, [editingEmpId, selectedMonth, dailyRoster]);

    const handleMonthChange = (delta: number) => {
        const [year, month] = selectedMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1 + delta, 1);
        const newYear = date.getFullYear();
        const newMonth = String(date.getMonth() + 1).padStart(2, '0');
        setSelectedMonth(`${newYear}-${newMonth}`);
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedEmpIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedEmpIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedEmpIds.size === displayEmployees.length && displayEmployees.length > 0) {
            setSelectedEmpIds(new Set());
        } else {
            setSelectedEmpIds(new Set(displayEmployees.map(e => e.id)));
        }
    };

    const handleSaveAdvance = async () => {
        if (!advForm.empId || !advForm.amount) return alert("Select staff and amount");
        const emp = employees.find(e => e.id === advForm.empId);
        if (!emp) return;

        const newExpense: ExpenseItem = {
            id: `adv_${Date.now()}`,
            category: 'STAFF_ADVANCE', 
            expenseType: 'SALARY',
            company: emp.name, // Using Name for easy matching
            amount: parseFloat(advForm.amount),
            note: `预支薪水 - ${advForm.note}`,
            time: advForm.date,
            paymentMethod: advForm.method as any, 
            paymentStatus: 'PAID'
        };

        await DataManager.saveStandaloneExpense(newExpense);
        setIsAdvanceModalOpen(false);
        setAdvForm({ empId: '', amount: '', date: new Date().toISOString().split('T')[0], note: '', method: 'BANK_TRANSFER' });
        alert("✅ 预支已记录 (Advance Recorded)");
        loadPayrollForMonth(); // Reload to update advance amount
    };

    const updateEntry = (id: string, updates: Partial<DetailedPayrollEntry>) => {
        setPayrollData(prev => {
            const current = { ...prev[id], ...updates };
            if (('ee_epf' in updates) || ('er_epf' in updates) || ('ee_socso' in updates) || ('er_socso' in updates)) {
                current.autoCalc = false; 
            }
            if (current.autoCalc && !isPosted) {
                const grossForStatutory = current.basic + current.allowance + current.ot + current.bonus + (current.holidayPay || 0) - current.unpaidLeave;
                const safeGross = Math.max(0, grossForStatutory);
                
                if (current.hasEPF) {
                    current.ee_epf = calculateEPF(safeGross, false);
                    current.er_epf = calculateEPF(safeGross, true);
                } else {
                    current.ee_epf = 0; current.er_epf = 0;
                }

                if (current.hasSOCSO) {
                    current.ee_socso = calculateSOCSO(safeGross, false);
                    current.er_socso = calculateSOCSO(safeGross, true);
                    current.ee_eis = calculateEIS(safeGross, false);
                    current.er_eis = calculateEIS(safeGross, true);
                } else {
                    current.ee_socso = 0; current.er_socso = 0;
                    current.ee_eis = 0; current.er_eis = 0;
                }
            }
            return { ...prev, [id]: current };
        });
    };

    const triggerRecalculateStatutory = (id: string) => {
        setPayrollData(prev => {
            const current = { ...prev[id], autoCalc: true }; 
            const grossForStatutory = current.basic + current.allowance + current.ot + current.bonus + (current.holidayPay || 0) - current.unpaidLeave;
            const safeGross = Math.max(0, grossForStatutory);
            
            if (current.hasEPF) {
                current.ee_epf = calculateEPF(safeGross, false);
                current.er_epf = calculateEPF(safeGross, true);
            } else {
                current.ee_epf = 0; current.er_epf = 0;
            }
            if (current.hasSOCSO) {
                current.ee_socso = calculateSOCSO(safeGross, false);
                current.er_socso = calculateSOCSO(safeGross, true);
                current.ee_eis = calculateEIS(safeGross, false);
                current.er_eis = calculateEIS(safeGross, true);
            } else {
                current.ee_socso = 0; current.er_socso = 0;
                current.ee_eis = 0; current.er_eis = 0;
            }
            return { ...prev, [id]: current };
        });
    };

    const toggleStatutory = (id: string, type: 'EPF' | 'SOCSO') => {
        const entry = payrollData[id];
        if (!entry) return;
        if (type === 'EPF') updateEntry(id, { hasEPF: !entry.hasEPF, autoCalc: true });
        else updateEntry(id, { hasSOCSO: !entry.hasSOCSO, autoCalc: true });
    };

    const syncBasicSalary = (id: string) => {
        const emp = employees.find(e => e.id === id);
        if(emp) {
            const historicalBasic = getHistoricalSalary(emp, selectedMonth);
            updateEntry(id, { basic: Number(historicalBasic) || 0, autoCalc: true });
        }
    };

    const handleFinalSettlement = () => {
        if (!editingEmpId || !editingEmp) return;
        
        if (!editingEmp.terminationDate) return alert("此员工未设置离职日期");
        if (!editingEmp.terminationDate.startsWith(selectedMonth)) {
            return alert(`离职日期 (${editingEmp.terminationDate}) 不在当前选中的月份`);
        }

        if (!confirm(`确认进行离职结清 (Final Settlement)?`)) return;

        let startDateStr = `${selectedMonth}-01`;
        if (editingEmp.joinDate > startDateStr) startDateStr = editingEmp.joinDate;
        const endDateStr = editingEmp.terminationDate;
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        let workedDaysExcludingOff = 0;
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateIso = d.toISOString().split('T')[0];
            const status = dailyRoster[dateIso]?.[editingEmpId] || 'WORK';
            if (status === 'WORK') workedDaysExcludingOff++;
        }

        const originalBasic = getHistoricalSalary(editingEmp, selectedMonth);
        const newBasic = parseFloat(((originalBasic / 26) * workedDaysExcludingOff).toFixed(2));

        updateEntry(editingEmpId, {
            basic: newBasic,
            autoCalc: true,
            proRateMode: '26_DAYS',
            workDays: workedDaysExcludingOff,
            note: (payrollData[editingEmpId].note || '') + `\n[FINAL SETTLEMENT] Last Day: ${endDateStr}\nCalculated ${workedDaysExcludingOff} working days.`
        });
        
        alert(`✅ 已自动计算离职薪资。\n工作天数: ${workedDaysExcludingOff} 天\n实发底薪: RM ${newBasic}`);
    };

    const calculateProRate = () => {
        if (!editingEmpId) return;
        const emp = employees.find(e => e.id === editingEmpId);
        if (!emp) return;

        const originalBasic = getHistoricalSalary(emp, selectedMonth);
        const days = parseFloat(proRateSettings.days as any);
        if (isNaN(days) || days <= 0) return alert("Please enter valid working days");

        let newBasic = 0;
        const [yearStr, monthStr] = selectedMonth.split('-');
        const totalDaysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
        const restDays = emp.monthlyRestDays || 4;

        if (proRateSettings.mode === '26_DAYS') newBasic = parseFloat(((originalBasic / 26) * days).toFixed(2));
        else if (proRateSettings.mode === 'CALENDAR_DAYS') newBasic = parseFloat(((originalBasic / totalDaysInMonth) * days).toFixed(2));
        else if (proRateSettings.mode === 'WORKABLE_DAYS') {
            const denominator = totalDaysInMonth - restDays;
            newBasic = parseFloat(((originalBasic / denominator) * days).toFixed(2));
        }
        
        updateEntry(editingEmpId, { 
            basic: newBasic,
            autoCalc: true, 
            proRateMode: proRateSettings.mode, 
            workDays: days,
            note: (payrollData[editingEmpId].note || '') + `\n[Pro-rate] Worked ${days} days (${proRateSettings.mode})`
        });
    };

    const handleSettlePayment = async (method: 'CASH' | 'BANK_TRANSFER') => {
        const emp = employees.find(e => e.id === editingEmpId);
        const entry = editingEmpId ? payrollData[editingEmpId] : null;
        if (!editingEmpId || !entry || !emp) return;
        
        const t = getTotals(entry);
        if (t.netPay <= 0) return alert("Net Pay is 0 or negative.");

        const expense: ExpenseItem = {
            id: `salary_${editingEmpId}_${selectedMonth}_${Date.now()}`,
            category: 'SALARY',
            expenseType: 'SALARY',
            company: emp.name,
            amount: t.netPay,
            paymentStatus: 'PAID',
            paymentMethod: method,
            time: new Date().toISOString(),
            note: `[Salary Payment] ${selectedMonth} - ${emp.name}`,
            paidBy: 'COMPANY'
        };
        
        await DataManager.saveStandaloneExpense(expense);
        updateEntry(editingEmpId, { note: (entry.note || '') + `\n[PAID] RM${t.netPay.toFixed(2)} via ${method} on ${new Date().toLocaleDateString()}` });
        alert(`✅ 支付成功！\n已从资金管理 (${method === 'CASH' ? '现金' : '银行'}) 扣除 RM ${t.netPay.toFixed(2)}`);
        setShowPayConfirm(false);
    };

    const handlePrintSingleSlip = async () => {
        if (!printSlipRef.current) return;
        setIsGeneratingPdf(true);
        try {
            await new Promise(r => setTimeout(r, 800)); 
            const canvas = await html2canvas(printSlipRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 2000, windowHeight: 2000 });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('p', 'mm', 'a4'); 
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Payslip_${selectedMonth}_${editingEmpId}.pdf`);
        } catch (e) { console.error(e); alert("Print Failed"); } finally { setIsGeneratingPdf(false); }
    };

    const handlePrintSummary = async () => {
        if (selectedEmpIds.size === 0) return alert("请先勾选需要打印的员工");
        if (!printSummaryRef.current) return;
        setIsGeneratingPdf(true);
        try {
            await new Promise(r => setTimeout(r, 500));
            const canvas = await html2canvas(printSummaryRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 2000 });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('l', 'mm', 'a4'); 
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Payroll_Summary_${selectedMonth}.pdf`);
        } catch(e) { console.error(e); alert("Summary Print Failed"); } finally { setIsGeneratingPdf(false); }
    };

    const getTotals = (entry: DetailedPayrollEntry) => {
        const gross = entry.basic + entry.allowance + entry.ot + entry.bonus + (entry.holidayPay || 0);
        const employeeDeductions = entry.latePenalty + entry.unpaidLeave + entry.advanceLoan + entry.ee_epf + entry.ee_socso + entry.ee_eis + entry.ee_pcb;
        const netPay = gross - employeeDeductions;
        const employerCost = entry.er_epf + entry.er_socso + entry.er_eis;
        const totalCompanyCost = gross + employerCost;
        const totalGovtPay = (entry.ee_epf + entry.er_epf) + (entry.ee_socso + entry.er_socso) + (entry.ee_eis + entry.er_eis) + entry.ee_pcb;

        return { gross, netPay, totalCompanyCost, employerCost, deductions: employeeDeductions, totalGovtPay };
    };

    const grandTotals = useMemo(() => {
        let net = 0, cost = 0, govt = 0;
        Object.values(payrollData).forEach((e: DetailedPayrollEntry) => {
            const t = getTotals(e);
            net += t.netPay;
            cost += t.totalCompanyCost;
            govt += t.totalGovtPay;
        });
        return { net, cost, govt };
    }, [payrollData]);

    const handleSaveSingleDraft = async () => {
        setIsLoading(true);
        try {
            const details = Object.entries(payrollData).map(([id, entry]: [string, DetailedPayrollEntry]) => {
                const emp = employees.find(e => e.id === id);
                const t = getTotals(entry);
                return {
                    employeeId: id,
                    employeeName: emp?.name || 'Unknown',
                    basicSalary: entry.basic,
                    allowance: entry.allowance + entry.ot + entry.bonus,
                    holidayDays: entry.holidayDays || 0,
                    holidayPay: entry.holidayPay || 0,
                    penalty: entry.latePenalty + entry.unpaidLeave,
                    advanceLoan: entry.advanceLoan,
                    ee_epf: entry.ee_epf, ee_socso: entry.ee_socso, ee_eis: entry.ee_eis, ee_pcb: entry.ee_pcb,
                    er_epf: entry.er_epf, er_socso: entry.er_socso, er_eis: entry.er_eis,
                    netPay: t.netPay, totalCost: t.totalCompanyCost, note: entry.note,
                    paymentMethod: entry.paymentMethod || 'BANK', proRateMode: entry.proRateMode || '26_DAYS', workDays: entry.workDays || 0
                };
            });
            const record: PayrollRecord = {
                id: selectedMonth, month: selectedMonth, totalAmount: grandTotals.cost,
                totalNetPay: grandTotals.net, totalGovtPay: grandTotals.govt, staffCount: details.length,
                status: isPosted ? 'POSTED' : 'DRAFT', details: details as any
            };
            await DataManager.savePayrollRecord(record);
            setEditingEmpId(null);
        } catch (e) { console.error(e); alert("保存失败 (Save Failed)"); } finally { setIsLoading(false); }
    };

    const handleRevertStatus = async () => {
        if (!confirm("⚠️ 确定要撤销结账吗？(Revert to Draft)\n\n这将重新启用编辑功能，并自动删除之前自动生成的“资金管理”支出记录。")) return;
        
        setIsLoading(true);
        try {
            const records = await DataManager.getPayrollRecords();
            const currentRecord = records.find(r => r.id === selectedMonth);
            
            if (currentRecord) {
                 const record: PayrollRecord = {
                    ...currentRecord,
                    status: 'DRAFT',
                    isStatutoryPaid: false
                };
                await DataManager.savePayrollRecord(record);
            }
            
            try {
                await deleteDoc(doc(db, 'standalone_expenses', `payroll_net_cash_${selectedMonth}`));
                await deleteDoc(doc(db, 'standalone_expenses', `payroll_net_bank_${selectedMonth}`));
                await deleteDoc(doc(db, 'standalone_expenses', `payroll_stat_${selectedMonth}`));
            } catch (err) { console.warn("Cleanup skipped", err); }

            setIsPosted(false);
            setIsStatutoryPaid(false);
            alert("✅ 已撤销结账 (Reverted to Draft)");
        } catch (e) { console.error(e); alert("撤销失败"); } finally { setIsLoading(false); }
    };

    const handlePayStatutory = async () => {
        if (!confirm(`确认缴纳政府费用 (KWSP/SOCSO/EIS/PCB)?\n总额: RM ${grandTotals.govt.toLocaleString()}`)) return;
        
        setIsLoading(true);
        try {
            const payDate = new Date().toISOString();
            const statExp: ExpenseItem = {
                id: `payroll_stat_${selectedMonth}`,
                category: 'SALARY',
                expenseType: 'SALARY',
                company: `Govt Bodies (KWSP/SOCSO/LHDN) - ${selectedMonth}`,
                amount: grandTotals.govt,
                paymentStatus: 'PAID',
                paymentMethod: 'BANK_TRANSFER',
                time: payDate,
                note: `[Statutory Payment] Contributions for ${selectedMonth}`,
                paidBy: 'COMPANY'
            };
            await DataManager.saveStandaloneExpense(statExp);

            const records = await DataManager.getPayrollRecords();
            const currentRecord = records.find(r => r.id === selectedMonth);
            if (currentRecord) {
                const updatedRecord: PayrollRecord = {
                    ...currentRecord,
                    isStatutoryPaid: true
                };
                await DataManager.savePayrollRecord(updatedRecord);
            }

            setIsStatutoryPaid(true);
            alert("✅ 法定缴纳已记录 (Statutory Paid)!");

        } catch (e) { console.error("Pay Stat Error", e); alert("支付记录失败"); } finally { setIsLoading(false); }
    };

    const handleSavePayroll = async () => {
        if (!confirm(`确认结算 ${selectedMonth} 薪资？\n\n注意：此操作将仅扣除员工实发薪资 (Net Pay)。`)) return;
        
        setIsLoading(true);
        try {
            const details = Object.entries(payrollData).map(([id, entry]: [string, DetailedPayrollEntry]) => {
                const emp = employees.find(e => e.id === id);
                const t = getTotals(entry);
                return {
                    employeeId: id, employeeName: emp?.name || 'Unknown',
                    basicSalary: entry.basic, allowance: entry.allowance + entry.ot + entry.bonus,
                    holidayDays: entry.holidayDays || 0,
                    holidayPay: entry.holidayPay || 0,
                    penalty: entry.latePenalty + entry.unpaidLeave, advanceLoan: entry.advanceLoan,
                    ee_epf: entry.ee_epf, ee_socso: entry.ee_socso, ee_eis: entry.ee_eis, ee_pcb: entry.ee_pcb,
                    er_epf: entry.er_epf, er_socso: entry.er_socso, er_eis: entry.er_eis,
                    netPay: t.netPay, totalCost: t.totalCompanyCost, note: entry.note,
                    paymentMethod: entry.paymentMethod || 'BANK', proRateMode: entry.proRateMode || '26_DAYS', workDays: entry.workDays || 0
                };
            });
            const record: PayrollRecord = {
                id: selectedMonth, month: selectedMonth, totalAmount: grandTotals.cost,
                totalNetPay: grandTotals.net, totalGovtPay: grandTotals.govt, staffCount: details.length,
                status: 'POSTED', 
                isStatutoryPaid: false,
                details: details as any
            };
            
            await DataManager.savePayrollRecord(record);

            try {
                await deleteDoc(doc(db, 'standalone_expenses', `payroll_net_cash_${selectedMonth}`));
                await deleteDoc(doc(db, 'standalone_expenses', `payroll_net_bank_${selectedMonth}`));
            } catch (err) { console.log("Cleanup skipped", err); }

            let netCashTotal = 0;
            let netBankTotal = 0;

            Object.values(payrollData).forEach((entry: DetailedPayrollEntry) => {
                const t = getTotals(entry);
                if (entry.paymentMethod === 'CASH') { netCashTotal += t.netPay; } 
                else { netBankTotal += t.netPay; }
            });

            const payDate = new Date().toISOString(); 

            if (netCashTotal > 0) {
                const cashExp: ExpenseItem = {
                    id: `payroll_net_cash_${selectedMonth}`,
                    category: 'SALARY',
                    expenseType: 'SALARY',
                    company: `Staff Payroll (Cash) - ${selectedMonth}`,
                    amount: netCashTotal,
                    paymentStatus: 'PAID',
                    paymentMethod: 'CASH',
                    time: payDate,
                    note: `[Auto-Sync] Net Pay via Cash for ${selectedMonth}`,
                    paidBy: 'COMPANY'
                };
                await DataManager.saveStandaloneExpense(cashExp);
            }

            if (netBankTotal > 0) {
                const bankExp: ExpenseItem = {
                    id: `payroll_net_bank_${selectedMonth}`,
                    category: 'SALARY',
                    expenseType: 'SALARY',
                    company: `Staff Payroll (Bank) - ${selectedMonth}`,
                    amount: netBankTotal,
                    paymentStatus: 'PAID',
                    paymentMethod: 'BANK_TRANSFER',
                    time: payDate,
                    note: `[Auto-Sync] Net Pay via Bank for ${selectedMonth}`,
                    paidBy: 'COMPANY'
                };
                await DataManager.saveStandaloneExpense(bankExp);
            }

            setIsPosted(true);
            setIsStatutoryPaid(false);
            alert("✅ 结算成功 (Employees Paid)");
        } catch (e) { console.error("Payroll Save Error", e); alert("保存失败"); } finally { setIsLoading(false); }
    };

    const inputClassName = "w-full p-4 !bg-white border-2 border-gray-200 rounded-xl text-lg font-black text-black outline-none focus:border-[#1A1A1A] focus:ring-4 focus:ring-black/5 transition-all text-right shadow-sm disabled:bg-gray-50 disabled:text-gray-400 touch-manipulation";

    const renderEmployeeCard = (emp: Employee) => {
        const entry = payrollData[emp.id];
        if(!entry) return null;
        const totals = getTotals(entry);
        const isNewJoiner = emp.joinDate?.startsWith(selectedMonth);
        const isSelected = selectedEmpIds.has(emp.id);
        const isLocal = emp.nationality.includes('Malaysian') || emp.nationality.includes('🇲🇾');

        return (
            <div 
                key={emp.id} 
                onClick={() => { setEditingEmpId(emp.id); setShowPayConfirm(false); setShowAdvanceHistory(false); }}
                className={`w-full bg-white rounded-2xl p-4 shadow-sm border hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center gap-4 group cursor-pointer active:scale-[0.99] ${emp.isArchived ? 'border-red-200 bg-red-50/10' : isSelected ? 'border-[#1A1A1A] ring-1 ring-[#1A1A1A]' : 'border-gray-200 hover:border-[#FFD700]'}`}
            >
                <div className="flex items-center gap-4 w-full md:w-1/3">
                    <div 
                        onClick={(e) => { e.stopPropagation(); toggleSelection(emp.id); }}
                        className="p-2 -ml-2 text-gray-300 hover:text-black cursor-pointer"
                    >
                        {isSelected ? <CheckSquare size={20} className="text-[#1A1A1A]"/> : <Square size={20}/>}
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-gray-400 border-2 shadow-sm overflow-hidden shrink-0 ${emp.isArchived ? 'bg-red-100 border-red-200 grayscale' : 'bg-gray-100 border-white group-hover:border-[#FFD700]'}`}>
                        {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover"/> : emp.name.charAt(0)}
                    </div>
                    <div className="text-left min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className={`font-bold truncate text-sm md:text-base ${emp.isArchived ? 'text-red-700' : 'text-[#1A1A1A]'}`}>{emp.name}</h4>
                            {emp.isArchived && <span className="bg-red-100 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded">离职</span>}
                            {isNewJoiner && <span className="bg-blue-100 text-blue-600 text-[9px] font-bold px-1.5 py-0.5 rounded">新人 (New)</span>}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">{emp.role.split('(')[0]}</div>
                    </div>
                </div>
                <div className="w-full md:w-2/3 flex flex-row justify-between items-center md:justify-end gap-2 md:gap-6 text-right mt-2 md:mt-0">
                    {entry.advanceLoan > 0 && (
                        <div className="hidden md:block">
                            <div className="text-[9px] text-red-400 uppercase font-bold mb-0.5">Advance/Loan</div>
                            <div className="text-xs font-mono font-bold text-red-600">-RM {entry.advanceLoan.toFixed(2)}</div>
                        </div>
                    )}
                    
                    {isLocal && (
                        <div className="flex-1 md:flex-none">
                            <div className="text-[9px] text-blue-600 uppercase font-bold mb-0.5">To Govt</div>
                            <div className="text-xs md:text-sm font-mono font-bold text-blue-800">RM {totals.totalGovtPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        </div>
                    )}

                    <div className="flex-1 md:flex-none">
                        <div className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Total Cost</div>
                        <div className="text-xs md:text-sm font-mono font-bold text-gray-600">RM {totals.totalCompanyCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <div className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-xl border transition-colors ${emp.isArchived ? 'bg-red-100 border-red-200' : 'bg-emerald-50 border-emerald-100 group-hover:bg-emerald-100'}`}>
                        <div className={`text-[9px] uppercase font-bold mb-0.5 ${emp.isArchived ? 'text-red-600' : 'text-emerald-600'}`}>Net Pay</div>
                        <div className={`text-base md:text-lg font-mono font-black ${emp.isArchived ? 'text-red-700' : 'text-emerald-700'}`}>RM {totals.netPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-[#F8F9FA]">
            {/* Header */}
            <div className="bg-[#1A1A1A] text-white p-4 md:p-6 shadow-lg safe-area-bottom z-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="bg-[#FFD700] text-black p-3 rounded-xl shadow-gold"><DollarSign size={24}/></div>
                        <div>
                            <h2 className="text-lg md:text-xl font-black text-white tracking-wide">薪资管理 (Payroll)</h2>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                                {isPosted ? (isStatutoryPaid ? <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={12}/> 结算完毕 (All Paid)</span> : <span className="text-blue-400 flex items-center gap-1"><CheckCircle2 size={12}/> 已结薪资 (Net Paid)</span>) : '草稿 (Draft Mode)'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
                         <button 
                            onClick={handlePrintSummary}
                            disabled={isGeneratingPdf || selectedEmpIds.size === 0}
                            className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            {isGeneratingPdf ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>} 打印汇总
                        </button>
                        <button 
                            onClick={() => setShowResigned(!showResigned)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${showResigned ? 'bg-red-900 text-red-100 border-red-700' : 'bg-white/10 text-gray-400 border-white/10 hover:bg-white/20'}`}
                        >
                            <UserX size={14}/> {showResigned ? '隐藏离职' : '显示离职'}
                        </button>

                        {!isPosted && (
                            <button 
                                onClick={() => setIsAdvanceModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                            >
                                <Wallet size={16}/> 预支管理
                            </button>
                        )}

                        <div className="flex items-center bg-white/10 rounded-xl border border-white/10 p-1">
                            <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-2 px-2 border-x border-white/10 mx-1">
                                <Calendar size={16} className="text-[#FFD700]" />
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="bg-transparent text-white font-bold outline-none text-sm w-36 text-center appearance-none cursor-pointer"
                                />
                            </div>
                            <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main List */}
            <div className="flex-grow overflow-y-auto p-4 md:p-6 pb-32 touch-pan-y">
                <div className="max-w-5xl mx-auto mb-2 flex items-center gap-2">
                    <button onClick={handleSelectAll} className="bg-white px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 flex items-center gap-2 active:scale-95 transition-transform">
                        {selectedEmpIds.size === displayEmployees.length && displayEmployees.length > 0 ? <CheckSquare size={14} className="text-[#1A1A1A]"/> : <Square size={14}/>}
                        Select All
                    </button>
                    {selectedEmpIds.size > 0 && <span className="text-xs font-bold text-[#1A1A1A]">{selectedEmpIds.size} Selected</span>}
                </div>

                <div className="max-w-5xl mx-auto space-y-8">
                     {/* Locals Group */}
                    {localEmployees.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="font-black text-sm text-gray-500 uppercase tracking-widest mb-4 ml-2 flex items-center gap-2">
                                <span className="text-xl">🇲🇾</span> 本地员工 (Locals)
                            </h3>
                            <div className="space-y-4">
                                {localEmployees.map(emp => renderEmployeeCard(emp))}
                            </div>
                        </div>
                    )}

                    {/* Foreigners Group */}
                    {foreignEmployees.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="font-black text-sm text-gray-500 uppercase tracking-widest mb-4 ml-2 flex items-center gap-2">
                                <span className="text-xl">🌍</span> 外籍员工 (Foreigners)
                            </h3>
                            <div className="space-y-4">
                                {foreignEmployees.map(emp => renderEmployeeCard(emp))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Save Button */}
            <div className="bg-white p-4 border-t border-gray-200 safe-area-bottom z-20">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex gap-6 text-xs font-bold text-gray-500 w-full md:w-auto justify-between md:justify-start">
                        <div><span className="block text-[10px] text-gray-400 uppercase">Total Payout (Net)</span><span className="text-xl font-mono text-[#1A1A1A] font-black">RM {grandTotals.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                        <div className="w-px h-8 bg-gray-200"></div>
                        <div><span className="block text-[10px] text-blue-500 uppercase">To Govt (Statutory)</span><span className="text-xl font-mono text-blue-600 font-black">RM {grandTotals.govt.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto">
                        {isPosted ? (
                            <>
                                <button onClick={handleRevertStatus} disabled={isLoading} className="flex-1 md:flex-none bg-red-50 text-red-600 border border-red-100 px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-red-100 active:scale-95 transition-all text-sm flex items-center justify-center gap-2">
                                    <LockOpen size={16}/> 撤销结账 (Revert)
                                </button>
                                {!isStatutoryPaid ? (
                                    <button onClick={handlePayStatutory} disabled={isLoading} className="flex-1 md:flex-none bg-blue-600 text-white border border-blue-600 px-6 py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all text-sm flex items-center justify-center gap-2">
                                        <Building2 size={16}/> 缴纳政府费用 (Pay Statutory)
                                    </button>
                                ) : (
                                    <button disabled className="flex-1 md:flex-none bg-gray-100 text-gray-400 border border-gray-200 px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed">
                                        <CheckCircle2 size={16}/> 结算完毕 (All Paid)
                                    </button>
                                )}
                            </>
                        ) : (
                            <button onClick={handleSavePayroll} disabled={isLoading} className="w-full md:w-auto bg-[#1A1A1A] text-[#FFD700] px-8 py-3 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all text-sm md:text-base disabled:opacity-50">
                                {isLoading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} 确认并入账 (Pay Employees)
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* === ADVANCE MODAL === */}
            {isAdvanceModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-[#1A1A1A]">发放预支薪水 (Advance)</h3>
                            <button onClick={() => setIsAdvanceModalOpen(false)}><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Staff (员工)</label><select value={advForm.empId} onChange={e => setAdvForm({...advForm, empId: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none"><option value="">Select Staff...</option>{displayEmployees.map(e => <option key={e.id} value={e.id}>{e.name} {e.isArchived ? '(离职)' : ''}</option>)}</select></div>
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Method (资金来源)</label><div className="grid grid-cols-2 gap-2"><button onClick={() => setAdvForm({...advForm, method: 'BANK_TRANSFER'})} className={`py-3 rounded-xl font-bold text-xs border ${advForm.method === 'BANK_TRANSFER' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>银行转账 (Bank)</button><button onClick={() => setAdvForm({...advForm, method: 'CASH'})} className={`py-3 rounded-xl font-bold text-xs border ${advForm.method === 'CASH' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200'}`}>现金 (Cash)</button></div></div>
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Amount (金额)</label><input type="number" value={advForm.amount} onChange={e => setAdvForm({...advForm, amount: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-black text-lg outline-none" placeholder="0.00" /></div>
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Date (日期)</label><input type="date" value={advForm.date} onChange={e => setAdvForm({...advForm, date: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" /></div>
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Note (备注)</label><input type="text" value={advForm.note} onChange={e => setAdvForm({...advForm, note: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" placeholder="Reason..." /></div>
                            <button onClick={handleSaveAdvance} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-transform">确认发放 (Issue)</button>
                        </div>
                    </div>
                </div>
            )}

            {/* === CALCULATOR MODAL (OPTIMIZED FOR IPAD) === */}
            {editingEmpId && editingEntry && editingEmp && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in">
                    {/* UPDATED: h-[100dvh] for mobile full height, md:h-[95vh] for tablet, padding bottom added */}
                    <div className="bg-[#F8F9FA] w-full h-[100dvh] md:max-w-3xl md:h-[95vh] md:rounded-[2rem] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 border border-gray-200 relative">
                        
                        {/* Header */}
                        <div className="bg-white p-4 md:p-5 flex justify-between items-center shrink-0 border-b border-gray-200 safe-area-top">
                            <div>
                                <h3 className="font-bold text-lg text-[#1A1A1A] flex items-center gap-2"><Calculator size={20} className="text-[#FFD700] fill-current stroke-black"/> 薪资计算器</h3>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs text-gray-500 font-mono mt-0.5">{editingEmp.name}</p>
                                    {editingEmp.isArchived && <span className="bg-red-100 text-red-600 text-[9px] px-1.5 rounded font-bold">离职</span>}
                                </div>
                            </div>
                            <button onClick={() => { setEditingEmpId(null); setShowAdvanceHistory(false); }} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors active:scale-95"><X size={20}/></button>
                        </div>

                        {/* Content - SCROLLABLE AREA WITH EXTRA PADDING */}
                        <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6 pb-40 touch-pan-y overscroll-contain">
                            
                            {/* PRO-RATE TOOL */}
                            {(!isPosted) && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 animate-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CalendarDays size={14} className="text-blue-600"/>
                                        <h4 className="text-xs font-black text-blue-800 uppercase tracking-widest">
                                            {editingEmp.isArchived ? '离职结算 (Resignation Pro-rate)' : '新入职/天数计算 (Joiner Pro-rate)'}
                                        </h4>
                                    </div>
                                    <div className="flex items-end gap-3">
                                        <div className="flex-grow">
                                            <label className="text-[9px] font-bold text-blue-500 uppercase mb-1 block">Work Days (Synced with Roster)</label>
                                            <input 
                                                type="number" 
                                                value={proRateSettings.days || ''} 
                                                onChange={e => setProRateSettings({...proRateSettings, days: parseFloat(e.target.value)})} 
                                                className="w-full p-3 bg-white border border-blue-200 rounded-lg text-sm font-bold outline-none focus:border-blue-400"
                                                placeholder="e.g. 15"
                                            />
                                        </div>
                                        <div className="w-48">
                                            <label className="text-[9px] font-bold text-blue-500 uppercase mb-1 block">Calculation Basis</label>
                                            <select 
                                                value={proRateSettings.mode} 
                                                onChange={e => setProRateSettings({...proRateSettings, mode: e.target.value as any})}
                                                className="w-full p-3 bg-white border border-blue-200 rounded-lg text-[10px] font-bold outline-none"
                                            >
                                                <option value="26_DAYS">Fixed 26 Days (Standard)</option>
                                                <option value="WORKABLE_DAYS">Dynamic (Month - Off Days)</option>
                                                <option value="CALENDAR_DAYS">Full Calendar Days</option>
                                            </select>
                                        </div>
                                        <button 
                                            onClick={calculateProRate}
                                            disabled={!proRateSettings.days}
                                            className="px-4 py-3 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50 active:scale-95"
                                        >
                                            Calculate
                                        </button>
                                    </div>

                                    {/* NEW: Final Settlement Button for Terminated Staff */}
                                    {(editingEmp.isArchived || editingEmp.status === 'TERMINATED') && (
                                        <div className="mt-3 pt-3 border-t border-blue-200">
                                            <button 
                                                onClick={handleFinalSettlement}
                                                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
                                            >
                                                <Ban size={14}/> ⚡️ 离职一键结清 (Final Settlement)
                                            </button>
                                            <p className="text-[9px] text-red-500 mt-1 text-center font-bold">
                                                Based on Termination Date: {editingEmp.terminationDate || 'Not Set'}
                                            </p>
                                        </div>
                                    )}

                                    <p className="text-[9px] text-blue-500 mt-2 italic font-bold">
                                        {proRateSettings.startDate ? `Detected: Joined/Start ${proRateSettings.startDate}` : 'Days auto-calculated from Roster (WORK status)'}
                                    </p>
                                </div>
                            )}

                            {/* EARNINGS */}
                            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>
                                <h4 className="text-xs font-black text-green-700 uppercase mb-4 flex items-center gap-2 tracking-widest pl-2"><Plus size={14}/> 收入 (Earnings)</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* BASIC SALARY - SPLIT INTO ORIGINAL AND ACTUAL */}
                                    <div className="col-span-full sm:col-span-2 grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">Monthly Rate (档案底薪)</label>
                                            <div className="w-full p-3 bg-gray-100 border border-transparent rounded-xl text-sm font-bold text-gray-400 outline-none text-right">
                                                {/* Use getHistoricalSalary to show what the salary SHOULD be for this month based on history */}
                                                {getHistoricalSalary(editingEmp, selectedMonth).toFixed(2)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[9px] font-bold text-green-700 uppercase">Actual Basic (实发底薪)</label>
                                                <button onClick={() => syncBasicSalary(editingEmpId)} className="text-blue-500 hover:text-blue-700" title="Reset to Original"><RotateCcw size={12}/></button>
                                            </div>
                                            <input 
                                                type="number" 
                                                disabled={isPosted} 
                                                value={editingEntry.basic.toFixed(2)} // Enforce 2 decimal display
                                                onChange={e => updateEntry(editingEmpId, {basic: parseFloat(e.target.value)||0})} 
                                                className="w-full p-3 bg-white border-2 border-green-200 rounded-xl text-sm font-black text-[#1A1A1A] outline-none focus:border-green-500 text-right shadow-sm" 
                                                inputMode="decimal"
                                            />
                                        </div>
                                    </div>

                                    <div><label className="input-label text-[10px] font-bold text-gray-400 uppercase mb-1 block">Fixed Allowance (津贴)</label><input type="number" disabled={isPosted} value={editingEntry.allowance} onChange={e => updateEntry(editingEmpId, {allowance: parseFloat(e.target.value)||0})} className={inputClassName} inputMode="decimal"/></div>
                                    <div><label className="input-label text-[10px] font-bold text-gray-400 uppercase mb-1 block">OT / Commission</label><input type="number" disabled={isPosted} value={editingEntry.ot} onChange={e => updateEntry(editingEmpId, {ot: parseFloat(e.target.value)||0})} className={inputClassName} inputMode="decimal"/></div>
                                    <div><label className="input-label text-[10px] font-bold text-gray-400 uppercase mb-1 block">Bonus (奖金)</label><input type="number" disabled={isPosted} value={editingEntry.bonus} onChange={e => updateEntry(editingEmpId, {bonus: parseFloat(e.target.value)||0})} className={inputClassName} inputMode="decimal"/></div>
                                    {/* PUBLIC HOLIDAY PAY (3X) */}
                                    <div className="col-span-full bg-red-50 p-3 rounded-xl border border-red-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-black text-red-700 uppercase">🎌 Public Holiday Pay (公假3倍工资)</span>
                                            <span className="text-[9px] text-gray-400">Daily Rate = Basic / 26</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 items-end">
                                            <div>
                                                <label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">PH Days Worked</label>
                                                <input type="number" disabled={isPosted} min="0" step="0.5" value={editingEntry.holidayDays || ''} onChange={e => { const days = parseFloat(e.target.value) || 0; const dailyRate = editingEntry.basic / 26; const extra = parseFloat((dailyRate * 2 * days).toFixed(2)); updateEntry(editingEmpId, { holidayDays: days, holidayPay: extra }); }} className="w-full p-3 bg-white border-2 border-red-200 rounded-xl text-sm font-black text-center outline-none focus:border-red-400" placeholder="0"/>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">Daily Rate (÷26)</label>
                                                <div className="w-full p-3 bg-white/50 border border-gray-200 rounded-xl text-sm font-mono text-gray-500 text-center">RM {(editingEntry.basic / 26).toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-red-600 uppercase mb-1 block">Extra 2x Pay</label>
                                                <div className={`w-full p-3 rounded-xl text-sm font-black font-mono text-center ${(editingEntry.holidayPay || 0) > 0 ? 'bg-red-100 border-2 border-red-300 text-red-700' : 'bg-gray-100 border border-gray-200 text-gray-400'}`}>+ RM {(editingEntry.holidayPay || 0).toFixed(2)}</div>
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-gray-400 mt-2">计算方式: 底薪 ÷ 26 × 2 × 天数 = 额外补贴 (基本薪已包含1倍, 此处补额外2倍 = 总共3倍)</p>
                                    </div>
                                </div>
                            </div>

                            {/* DEDUCTIONS */}
                            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                                <h4 className="text-xs font-black text-red-700 uppercase mb-4 flex items-center gap-2 tracking-widest pl-2"><MinusCircle size={14}/> 扣除 (Deductions)</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label className="input-label text-[10px] font-bold text-gray-400 uppercase mb-1 block">Late Penalty (迟到)</label><input type="number" disabled={isPosted} value={editingEntry.latePenalty} onChange={e => updateEntry(editingEmpId, {latePenalty: parseFloat(e.target.value)||0})} className={`${inputClassName} text-red-600`} inputMode="decimal"/></div>
                                    <div><label className="input-label text-[10px] font-bold text-gray-400 uppercase mb-1 block">Unpaid Leave (无薪假)</label><input type="number" disabled={isPosted} value={editingEntry.unpaidLeave} onChange={e => updateEntry(editingEmpId, {unpaidLeave: parseFloat(e.target.value)||0})} className={`${inputClassName} text-red-600`} inputMode="decimal"/></div>
                                    
                                    {/* ADVANCE + LOAN SYNC */}
                                    <div className="relative">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="input-label text-[10px] font-bold text-gray-400 uppercase block">Advance/Loan (预支/借款)</label>
                                            <div className="flex gap-1">
                                                {(() => {
                                                    const empLoan = (editingEmp?.loanRecords || []).reduce((s: number, r: any) => s + (r.type === 'BORROW' ? r.amount : -r.amount), 0);
                                                    return empLoan > 0 ? (
                                                        <span className="text-[9px] bg-red-50 text-red-600 px-2 py-0.5 rounded-lg border border-red-100 font-bold">
                                                            💰 欠款: RM{empLoan.toFixed(0)}
                                                        </span>
                                                    ) : null;
                                                })()}
                                                {currentEmpAdvances.length > 0 && (
                                                    <button 
                                                        onClick={() => setShowAdvanceHistory(true)}
                                                        className="text-[9px] bg-red-50 text-red-600 px-2 py-0.5 rounded-lg border border-red-100 hover:bg-red-100 flex items-center gap-1 font-bold"
                                                    >
                                                        <History size={10}/> {currentEmpAdvances.length} records
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <input type="number" disabled={isPosted} value={editingEntry.advanceLoan} onChange={e => updateEntry(editingEmpId, {advanceLoan: parseFloat(e.target.value)||0})} className={`${inputClassName} text-red-600`} inputMode="decimal"/>
                                    </div>

                                    <div><label className="input-label text-[10px] font-bold text-gray-400 uppercase mb-1 block">Tax (PCB)</label><input type="number" disabled={isPosted} value={editingEntry.ee_pcb} onChange={e => updateEntry(editingEmpId, {ee_pcb: parseFloat(e.target.value)||0})} className={`${inputClassName} text-red-600`} inputMode="decimal"/></div>
                                </div>
                            </div>

                            {/* STATUTORY (EPF/SOCSO/EIS) */}
                            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                                <h4 className="text-xs font-black text-blue-700 uppercase mb-4 flex items-center gap-2 tracking-widest pl-2">
                                    <Building2 size={14}/> 法定缴纳 (Statutory) 
                                    <span className="ml-2 text-[9px] text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded">(Editable / 可编辑)</span>
                                </h4>
                                
                                {/* RECALCULATE BUTTON - RESTORES AUTO CALC */}
                                <div className="mb-4">
                                    <button 
                                        onClick={() => triggerRecalculateStatutory(editingEmpId)} 
                                        className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors w-full justify-center"
                                        title="Recalculate based on Current Basic Salary"
                                    >
                                        <RefreshCw size={12}/> 重置为自动计算 (Reset to Auto)
                                    </button>
                                </div>
                                
                                <div className="space-y-4">
                                    {/* EPF ROW */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                        <div className="flex items-center justify-between sm:justify-start gap-4 min-w-[120px]">
                                            <span className="text-xs font-black text-gray-600">EPF (KWSP)</span>
                                            <button 
                                                onClick={() => toggleStatutory(editingEmpId, 'EPF')}
                                                disabled={isPosted}
                                                className={`transition-colors ${editingEntry.hasEPF ? 'text-green-600' : 'text-gray-400'}`}
                                            >
                                                {editingEntry.hasEPF ? <ToggleRight size={32} fill="currentColor"/> : <ToggleLeft size={32}/>}
                                            </button>
                                        </div>
                                        {editingEntry.hasEPF && (
                                            <div className="flex gap-4 w-full">
                                                <div className="flex-1"><label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Employee (11%)</label><input type="number" disabled={isPosted} value={editingEntry.ee_epf.toFixed(2)} onChange={e => updateEntry(editingEmpId, {ee_epf: parseFloat(e.target.value)||0})} className={`${inputClassName} py-2 text-sm`} inputMode="decimal"/></div>
                                                <div className="flex-1"><label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Employer (13%)</label><input type="number" disabled={isPosted} value={editingEntry.er_epf.toFixed(2)} onChange={e => updateEntry(editingEmpId, {er_epf: parseFloat(e.target.value)||0})} className={`${inputClassName} py-2 text-sm`} inputMode="decimal"/></div>
                                            </div>
                                        )}
                                        {!editingEntry.hasEPF && <span className="text-xs text-gray-400 italic">Skipped</span>}
                                    </div>

                                    {/* SOCSO/EIS ROW - SPLIT INTO TWO ROWS */}
                                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                             <span className="text-xs font-black text-gray-600">SOCSO & EIS</span>
                                             <button 
                                                onClick={() => toggleStatutory(editingEmpId, 'SOCSO')}
                                                disabled={isPosted}
                                                className={`transition-colors ${editingEntry.hasSOCSO ? 'text-green-600' : 'text-gray-400'}`}
                                            >
                                                {editingEntry.hasSOCSO ? <ToggleRight size={32} fill="currentColor"/> : <ToggleLeft size={32}/>}
                                            </button>
                                        </div>

                                        {editingEntry.hasSOCSO ? (
                                            <div className="space-y-3">
                                                {/* SOCSO ROW */}
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <div className="w-24 pt-2 text-[10px] font-bold text-gray-500 uppercase">SOCSO</div>
                                                    <div className="flex gap-2 flex-1">
                                                        <div className="flex-1">
                                                            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">Employee</label>
                                                            <input type="number" disabled={isPosted} value={editingEntry.ee_socso.toFixed(2)} onChange={e => updateEntry(editingEmpId, {ee_socso: parseFloat(e.target.value)||0})} className={`${inputClassName} py-1.5 text-xs`} placeholder="0.00" inputMode="decimal"/>
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">Employer</label>
                                                            <input type="number" disabled={isPosted} value={editingEntry.er_socso.toFixed(2)} onChange={e => updateEntry(editingEmpId, {er_socso: parseFloat(e.target.value)||0})} className={`${inputClassName} py-1.5 text-xs`} placeholder="0.00" inputMode="decimal"/>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* EIS ROW */}
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <div className="w-24 pt-2 text-[10px] font-bold text-gray-500 uppercase">EIS</div>
                                                    <div className="flex gap-2 flex-1">
                                                        <div className="flex-1">
                                                            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">Employee</label>
                                                            <input type="number" disabled={isPosted} value={editingEntry.ee_eis.toFixed(2)} onChange={e => updateEntry(editingEmpId, {ee_eis: parseFloat(e.target.value)||0})} className={`${inputClassName} py-1.5 text-xs`} placeholder="0.00" inputMode="decimal"/>
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">Employer</label>
                                                            <input type="number" disabled={isPosted} value={editingEntry.er_eis.toFixed(2)} onChange={e => updateEntry(editingEmpId, {er_eis: parseFloat(e.target.value)||0})} className={`${inputClassName} py-1.5 text-xs`} placeholder="0.00" inputMode="decimal"/>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="text-[8px] text-blue-400 font-bold mt-2 text-center bg-blue-50 py-1 rounded">
                                                    * Rates based on simulated Official Table logic (Act 4 & Act 800)
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Skipped</span>
                                        )}
                                    </div>

                                </div>
                            </div>

                            {/* NOTE */}
                            <div><label className="input-label text-[10px] font-bold text-gray-400 uppercase mb-1 block">备注 (Note)</label><textarea className="w-full p-4 bg-white border border-gray-200 rounded-xl text-sm outline-none resize-none h-24 focus:border-[#1A1A1A] transition-colors" placeholder="Optional..." value={editingEntry.note} onChange={e => updateEntry(editingEmpId, {note: e.target.value})} disabled={isPosted}></textarea></div>
                            
                            {/* PAYMENT METHOD SELECTOR */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">付款方式 (Payment Method)</label>
                                <select 
                                    value={editingEntry.paymentMethod} 
                                    onChange={e => updateEntry(editingEmpId, {paymentMethod: e.target.value as any})}
                                    disabled={isPosted}
                                    className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold outline-none focus:border-[#1A1A1A] transition-colors"
                                >
                                    <option value="BANK">Bank Transfer (银行转账)</option>
                                    <option value="CASH">Cash (现金)</option>
                                    <option value="CHEQUE">Cheque (支票)</option>
                                </select>
                            </div>

                        </div>
                        {/* Footer (Fixed) */}
                        <div className="p-4 md:p-5 bg-white border-t border-gray-200 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] safe-area-bottom z-10">
                            <div className="text-right mb-4">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">NET PAY (实发)</div>
                                <div className="text-4xl font-mono font-black text-[#1A1A1A] drop-shadow-sm">RM {getTotals(editingEntry).netPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                            </div>
                            <div className="flex gap-2">
                                {!showPayConfirm ? (
                                    <>
                                        <button onClick={handlePrintSingleSlip} disabled={isGeneratingPdf} className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 md:py-4 rounded-xl font-bold text-xs md:text-sm hover:bg-gray-50 flex items-center justify-center gap-2 active:scale-95 transition-transform">
                                            {isGeneratingPdf ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>} 打印
                                        </button>
                                        
                                        {!isPosted && (
                                            <button onClick={() => setShowPayConfirm(true)} className="flex-1 bg-green-600 text-white py-3 md:py-4 rounded-xl font-bold text-xs md:text-sm shadow-md hover:bg-green-700 flex items-center justify-center gap-2 active:scale-95 transition-transform">
                                                <CreditCard size={16}/> 发放薪资 (Pay)
                                            </button>
                                        )}

                                        <button onClick={handleSaveSingleDraft} className="flex-[2] bg-[#1A1A1A] text-[#FFD700] py-3 md:py-4 rounded-xl font-black text-xs md:text-sm shadow-lg hover:bg-black transition-colors flex items-center justify-center gap-2 active:scale-95 transition-transform"><Save size={18}/> 保存 (Save)</button>
                                    </>
                                ) : (
                                    <div className="flex-1 flex gap-2 animate-in fade-in slide-in-from-bottom-2">
                                        <button onClick={() => handleSettlePayment('BANK_TRANSFER')} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-blue-700 flex flex-col items-center justify-center">
                                            <Building2 size={16} className="mb-1"/> Bank Pay
                                        </button>
                                        <button onClick={() => handleSettlePayment('CASH')} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-green-700 flex flex-col items-center justify-center">
                                            <Banknote size={16} className="mb-1"/> Cash Pay
                                        </button>
                                        <button onClick={() => setShowPayConfirm(false)} className="px-4 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs hover:bg-gray-200">Cancel</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ADVANCE HISTORY MODAL OVERLAY */}
            {showAdvanceHistory && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" onClick={() => setShowAdvanceHistory(false)}>
                     {/* Invisible backdrop to catch clicks */}
                     <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"></div>
                     
                     <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 animate-in zoom-in-95 relative z-10 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-sm text-gray-800 flex items-center gap-2">
                                <History size={16} className="text-red-500"/> 预支记录 (Advance History)
                            </h3>
                            <button onClick={() => setShowAdvanceHistory(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={16}/></button>
                        </div>
                        
                        <div className="max-h-64 overflow-y-auto p-0 bg-gray-50">
                            {currentEmpAdvances.length === 0 ? (
                                 <div className="p-8 text-center text-gray-400 text-xs">无记录</div>
                            ) : (
                                currentEmpAdvances.map((adv, idx) => (
                                    <div key={adv.id} className="p-3 border-b border-gray-200 bg-white flex justify-between items-center">
                                        <div>
                                            <div className="text-xs font-bold text-[#1A1A1A]">{adv.time.split('T')[0]}</div>
                                            <div className="text-[10px] text-gray-400 mt-0.5 max-w-[150px] truncate">{adv.note || 'No description'}</div>
                                        </div>
                                        <div className="text-right">
                                             <div className="text-sm font-black text-red-600">- RM {adv.amount.toFixed(2)}</div>
                                             <div className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-0.5">{adv.paymentMethod === 'CASH' ? 'CASH' : 'BANK'}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <div className="p-4 bg-white border-t border-gray-100 flex justify-between items-center shadow-[0_-5px_15px_rgba(0,0,0,0.05)] relative z-20">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Advance</span>
                            <span className="text-xl font-black text-red-600 font-mono">RM {currentEmpAdvances.reduce((s,a)=>s+(a.amount||0),0).toFixed(2)}</span>
                        </div>
                     </div>
                </div>
            )}
            
            {/* HIDDEN PRINT SLIP (A4 Layout) - RESTRUCTURED */}
            <div style={{ position: 'fixed', left: '-10000px', top: 0, zIndex: -50 }}>
                <div ref={printSlipRef} className="w-[210mm] min-h-[297mm] bg-white p-12 text-black font-sans relative flex flex-col">
                    {editingEntry && editingEmp && (
                        <>
                            {/* Header */}
                            <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                                <div>
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="w-12 h-12 bg-black text-white flex items-center justify-center font-black text-2xl rounded-lg">K</div>
                                        <div>
                                            <h1 className="text-2xl font-black uppercase tracking-widest leading-none">KIM LIAN KEE (KEPONG) SDN. BHD.</h1>
                                            {/* Subtitle Removed */}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-4xl font-black uppercase text-gray-200">PAYSLIP</p>
                                    <p className="text-lg font-bold mt-1">{selectedMonth}</p>
                                </div>
                            </div>

                            {/* Employee Info Grid - MODIFIED TO 3 COLUMNS */}
                            <div className="grid grid-cols-3 gap-y-6 gap-x-4 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Employee Name</p>
                                    <p className="text-lg font-black">{editingEmp.name}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Employee ID</p>
                                    <p className="text-lg font-mono font-bold">{editingEmp.id}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Position / Dept</p>
                                    <p className="text-sm font-bold">{editingEmp.role.split('(')[0]}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">IC / Passport</p>
                                    <p className="text-sm font-mono font-bold">{editingEmp.icNumber || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Join Date</p>
                                    <p className="text-sm font-bold">{editingEmp.joinDate || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Bank Name</p>
                                    <p className="text-sm font-bold">{editingEmp.bankName || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Account No.</p>
                                    <p className="text-sm font-mono font-bold">{editingEmp.bankAccount || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">EPF No.</p>
                                    <p className="text-sm font-mono font-bold">{editingEmp.epfNo || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">SOCSO / EIS No.</p>
                                    <p className="text-sm font-mono font-bold">{editingEmp.socsoNo || '-'}</p>
                                </div>
                            </div>

                            {/* Main Content: 2 Columns */}
                            <div className="grid grid-cols-2 gap-12 flex-grow items-start">
                                
                                {/* LEFT: EARNINGS -> DEDUCTIONS -> NET */}
                                <div className="flex flex-col gap-8">
                                    
                                    {/* EARNINGS */}
                                    <div>
                                        <div className="flex justify-between border-b-2 border-black pb-1 mb-2"><h4 className="text-sm font-black uppercase">EARNINGS (收入)</h4><span className="text-xs font-bold text-gray-500">MYR</span></div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between"><span>Basic Salary (底薪)</span><span className="font-mono">{editingEntry.basic.toFixed(2)}</span></div>
                                            {editingEntry.allowance > 0 && <div className="flex justify-between"><span>Allowances (津贴)</span><span className="font-mono">{editingEntry.allowance.toFixed(2)}</span></div>}
                                            {editingEntry.ot > 0 && <div className="flex justify-between"><span>Overtime / Comm (加班/佣金)</span><span className="font-mono">{editingEntry.ot.toFixed(2)}</span></div>}
                                            {editingEntry.bonus > 0 && <div className="flex justify-between"><span>Bonus (奖金)</span><span className="font-mono">{editingEntry.bonus.toFixed(2)}</span></div>}
                                            {(editingEntry.holidayPay || 0) > 0 && <div className="flex justify-between text-red-700"><span>PH 3x Pay (公假补贴) — {editingEntry.holidayDays || 0}天</span><span className="font-mono">{(editingEntry.holidayPay || 0).toFixed(2)}</span></div>}
                                            <div className="flex justify-between font-bold pt-2 border-t border-gray-200 mt-2"><span>GROSS PAY (总收入)</span><span className="font-mono">{getTotals(editingEntry).gross.toFixed(2)}</span></div>
                                        </div>
                                    </div>

                                    {/* DEDUCTIONS (LESS) */}
                                    <div>
                                        <div className="flex justify-between border-b-2 border-black pb-1 mb-2"><h4 className="text-sm font-black uppercase">LESS / DEDUCTIONS (扣除)</h4><span className="text-xs font-bold text-gray-500">MYR</span></div>
                                        <div className="space-y-2 text-sm">
                                            {editingEntry.ee_epf > 0 && <div className="flex justify-between"><span>EPF (Employee)</span><span className="font-mono">{editingEntry.ee_epf.toFixed(2)}</span></div>}
                                            {editingEntry.ee_socso > 0 && <div className="flex justify-between"><span>SOCSO (Employee)</span><span className="font-mono">{editingEntry.ee_socso.toFixed(2)}</span></div>}
                                            {editingEntry.ee_eis > 0 && <div className="flex justify-between"><span>EIS (Employee)</span><span className="font-mono">{editingEntry.ee_eis.toFixed(2)}</span></div>}
                                            {editingEntry.ee_pcb > 0 && <div className="flex justify-between"><span>PCB (Tax)</span><span className="font-mono">{editingEntry.ee_pcb.toFixed(2)}</span></div>}
                                            {editingEntry.advanceLoan > 0 && <div className="flex justify-between"><span>Advance / Loan (预支)</span><span className="font-mono">{editingEntry.advanceLoan.toFixed(2)}</span></div>}
                                            {(editingEntry.latePenalty + editingEntry.unpaidLeave) > 0 && <div className="flex justify-between"><span>Late / Unpaid (迟到/缺席)</span><span className="font-mono">{(editingEntry.latePenalty + editingEntry.unpaidLeave).toFixed(2)}</span></div>}
                                            <div className="flex justify-between font-bold pt-2 border-t border-gray-200 mt-2"><span>TOTAL DEDUCTIONS (总扣除)</span><span className="font-mono">{getTotals(editingEntry).deductions.toFixed(2)}</span></div>
                                        </div>
                                    </div>

                                    {/* NET PAY */}
                                    <div className="mt-4 border-t-4 border-black pt-4 flex justify-between items-center bg-gray-100 p-4 rounded-xl">
                                         <div>
                                            <span className="text-xl font-black uppercase block">NET PAY (实发薪资)</span>
                                            <span className="text-xs font-bold text-gray-500 uppercase">Payment via {editingEntry.paymentMethod}</span>
                                         </div>
                                         <span className="text-2xl font-mono font-black">RM {getTotals(editingEntry).netPay.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* RIGHT: INFORMATION (STATUTORY BREAKDOWN) */}
                                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 h-full">
                                    <h4 className="text-sm font-black uppercase border-b-2 border-gray-300 pb-2 mb-4 text-gray-500">INFORMATION (CONTRIBUTIONS)</h4>
                                    
                                    <div className="space-y-6 text-xs">
                                        {/* EPF */}
                                        <div>
                                            <p className="font-bold text-gray-500 mb-1 uppercase">EPF (KWSP)</p>
                                            <table className="w-full">
                                                <tbody>
                                                    <tr><td className="py-1">Employee Share (11%)</td><td className="text-right font-mono">{editingEntry.ee_epf.toFixed(2)}</td></tr>
                                                    <tr><td className="py-1">Employer Share (13%)</td><td className="text-right font-mono">{editingEntry.er_epf.toFixed(2)}</td></tr>
                                                    <tr className="font-bold border-t border-gray-300"><td className="py-1">Total Contribution</td><td className="text-right font-mono">{(editingEntry.ee_epf + editingEntry.er_epf).toFixed(2)}</td></tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* SOCSO */}
                                        <div>
                                            <p className="font-bold text-gray-500 mb-1 uppercase">SOCSO (PERKESO)</p>
                                            <table className="w-full">
                                                <tbody>
                                                    <tr><td className="py-1">Employee Share</td><td className="text-right font-mono">{editingEntry.ee_socso.toFixed(2)}</td></tr>
                                                    <tr><td className="py-1">Employer Share</td><td className="text-right font-mono">{editingEntry.er_socso.toFixed(2)}</td></tr>
                                                    <tr className="font-bold border-t border-gray-300"><td className="py-1">Total Contribution</td><td className="text-right font-mono">{(editingEntry.ee_socso + editingEntry.er_socso).toFixed(2)}</td></tr>
                                                </tbody>
                                            </table>
                                        </div>

                                         {/* EIS */}
                                        <div>
                                            <p className="font-bold text-gray-500 mb-1 uppercase">EIS (SIP)</p>
                                            <table className="w-full">
                                                <tbody>
                                                    <tr><td className="py-1">Employee Share</td><td className="text-right font-mono">{editingEntry.ee_eis.toFixed(2)}</td></tr>
                                                    <tr><td className="py-1">Employer Share</td><td className="text-right font-mono">{editingEntry.er_eis.toFixed(2)}</td></tr>
                                                    <tr className="font-bold border-t border-gray-300"><td className="py-1">Total Contribution</td><td className="text-right font-mono">{(editingEntry.ee_eis + editingEntry.er_eis).toFixed(2)}</td></tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Payment Info */}
                                        <div className="pt-8 mt-8 border-t border-gray-200">
                                             <div className="flex justify-between mb-1"><span>Issued Date:</span><span className="font-bold">{new Date().toLocaleDateString()}</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Signatures */}
                            <div className="mt-auto pt-12">
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-bold">DISCLAIMER & ACKNOWLEDGEMENT:</p>
                                <p className="text-[9px] text-gray-500 mb-8 leading-relaxed">
                                    I hereby acknowledge that I have received the sum stated above as full payment of my salary for the period indicated. I confirm that the details, including deductions for EPF, SOCSO, EIS, and PCB (if applicable), are correct. I further declare that I have no further claims against the company regarding this payment period. Any discrepancies must be reported to HR within 7 days of receipt.
                                </p>

                                <div className="grid grid-cols-2 gap-16 text-center text-xs">
                                    <div>
                                        <div className="border-b border-black mb-2 h-12"></div>
                                        <p className="font-bold uppercase">EMPLOYER SIGNATURE</p>
                                        <p className="text-[9px] text-gray-400">Kim Lian Kee</p>
                                    </div>
                                    <div>
                                        <div className="border-b border-black mb-2 h-12"></div>
                                        <p className="font-bold uppercase">EMPLOYEE SIGNATURE</p>
                                        <p className="text-[9px] text-gray-400">I acknowledge receipt of the above salary.</p>
                                    </div>
                                </div>
                                <p className="text-[9px] text-gray-300 text-center mt-6 uppercase tracking-[0.2em]">THIS IS A COMPUTER GENERATED DOCUMENT • {new Date().toISOString().split('T')[0]}</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* HIDDEN PRINT SUMMARY TABLE (Landscape A4) */}
            <div style={{ position: 'fixed', left: '-10000px', top: 0, zIndex: -50 }}>
                <div ref={printSummaryRef} className="w-[297mm] min-h-[210mm] bg-white p-10 font-sans text-black relative">
                    <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-widest">PAYROLL SUMMARY</h1>
                            <p className="text-sm font-bold text-gray-500">Month: {selectedMonth}</p>
                        </div>
                        <div className="text-right"><p className="text-xl font-black">KIM LIAN KEE</p></div>
                    </div>
                    
                    <table className="w-full text-left text-[10px] border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-y border-black">
                                <th className="p-2 border-r border-gray-300">ID</th>
                                <th className="p-2 border-r border-gray-300">Name</th>
                                <th className="p-2 text-right border-r border-gray-300">Basic</th>
                                <th className="p-2 text-right border-r border-gray-300">Allowances</th>
                                <th className="p-2 text-right border-r border-gray-300">OT/Bonus</th>
                                <th className="p-2 text-right border-r border-gray-300">Advance</th>
                                <th className="p-2 text-right border-r border-gray-300">EPF (EE)</th>
                                <th className="p-2 text-right border-r border-gray-300">SOCSO (EE)</th>
                                <th className="p-2 text-right border-r border-gray-300">EIS (EE)</th>
                                <th className="p-2 text-right border-r border-gray-300 font-black">NET PAY</th>
                                <th className="p-2 text-center">Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from(selectedEmpIds).map(id => {
                                const emp = employees.find(e => e.id === id);
                                const entry = payrollData[id];
                                if(!emp || !entry) return null;
                                const t = getTotals(entry);
                                
                                return (
                                    <tr key={id} className="border-b border-gray-200">
                                        <td className="p-2 border-r border-gray-100 font-mono">{emp.id}</td>
                                        <td className="p-2 border-r border-gray-100 font-bold">{emp.name}</td>
                                        <td className="p-2 text-right border-r border-gray-100">{entry.basic.toFixed(2)}</td>
                                        <td className="p-2 text-right border-r border-gray-100">{entry.allowance.toFixed(2)}</td>
                                        <td className="p-2 text-right border-r border-gray-100">{(entry.ot + entry.bonus + (entry.holidayPay || 0)).toFixed(2)}</td>
                                        <td className="p-2 text-right border-r border-gray-100 text-red-600">{entry.advanceLoan > 0 ? `(${entry.advanceLoan.toFixed(2)})` : '-'}</td>
                                        <td className="p-2 text-right border-r border-gray-100 text-red-600">{entry.ee_epf > 0 ? `(${entry.ee_epf.toFixed(2)})` : '-'}</td>
                                        <td className="p-2 text-right border-r border-gray-100 text-red-600">{entry.ee_socso > 0 ? `(${entry.ee_socso.toFixed(2)})` : '-'}</td>
                                        <td className="p-2 text-right border-r border-gray-100 text-red-600">{entry.ee_eis > 0 ? `(${entry.ee_eis.toFixed(2)})` : '-'}</td>
                                        <td className="p-2 text-right border-r border-gray-100 font-black">{t.netPay.toFixed(2)}</td>
                                        <td className="p-2 text-center text-[9px]">{entry.paymentMethod}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-100 font-bold border-t-2 border-black">
                                <td colSpan={9} className="p-2 text-right uppercase">Total Net Pay:</td>
                                <td className="p-2 text-right font-black">
                                    RM {(Array.from(selectedEmpIds).reduce((acc: number, id: string) => {
                                        const entry = payrollData[id];
                                        return acc + (entry ? getTotals(entry).netPay : 0);
                                    }, 0) as number).toFixed(2)}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <div className="mt-12 flex justify-between pt-8 border-t border-black">
                        <div><p className="text-xs uppercase font-bold">Prepared By</p><div className="w-48 h-px bg-black mt-8"></div></div>
                        <div><p className="text-xs uppercase font-bold">Approved By</p><div className="w-48 h-px bg-black mt-8"></div></div>
                    </div>
                </div>
            </div>

        </div>
    );
};