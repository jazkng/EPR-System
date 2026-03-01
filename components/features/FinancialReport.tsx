import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Calendar, Search, ArrowDown, ArrowUp, ArrowRight, Filter, PieChart, TrendingUp, DollarSign, Download, Printer, Loader2, ChevronRight, BarChart3, AlertCircle, ListChecks, ArrowDownLeft, ChevronDown, ChevronUp, Percent, LayoutList, Info, Users, HelpCircle, Eye, EyeOff, ArrowRightLeft, FileText, Banknote, Landmark, RefreshCw, CalendarRange, Wallet, CreditCard, Truck, Calculator, Coins, ShoppingBag, Receipt, UserMinus, UserCheck, Briefcase } from 'lucide-react';
import { SettlementRecord, ExpenseItem, BillPaymentRecord, FundTransfer, TreasuryConfig, PayrollRecord } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from '../../firebaseConfig';

interface FinancialReportProps {
    onClose: () => void;
}

interface AuditLogItem {
    id: string;
    date: string;
    time: string;
    type: 'IN' | 'OUT' | 'TRANSFER';
    category: string;
    description: string;
    amount: number;
    account: string;
    tag?: string;
    balance: number; 
}

interface DetailedExpenseItem {
    id: string;
    date: string;
    category: string;
    desc: string;
    amount: number;
    source: string; 
    type: string; 
}

const CATEGORY_LABELS: Record<string, string> = {
    'INGREDIENT_MEAT': '食材-肉类 (Meat)',
    'INGREDIENT_SEAFOOD': '食材-海鲜 (Seafood)',
    'INGREDIENT_VEG': '食材-蔬果 (Veg)',
    'INGREDIENT_DRY': '食材-干货 (Dry)',
    'INGREDIENT_SAUCE': '食材-酱料 (Sauce)',
    'BEVERAGE': '水吧原料 (Beverage)',
    'PACKAGING': '包装材料 (Packaging)',
    'GAS_COGS': '烹饪煤气 (Gas)',
    'SUPPLIER': '一般进货 (General)',
    'SALARY': '薪资支出 (Salary)',
    'RENT': '租金 (Rent)',
    'UTILITIES': '水电费 (Utilities)',
    'SALES': '营业收入 (Sales)',
    'TRANSFER': '资金转账 (Transfer)',
    'BILL': '固定账单 (Bill)',
    'EXPENSE': '杂项支出 (Expense)',
    'ADJUSTMENT': '现金调整 (Adjustment)',
    'FUND': '资金注入/提取 (Fund)',
    'STAFF_ADVANCE': '员工预支 (Advance)',
    'PAYROLL': '月度薪资 (Payroll)',
    'EPF': '公积金 (EPF)',
    'SOCSO': '社险 (SOCSO)',
    'RENOVATION': '装修 (Renovation)',
    'EQUIPMENT': '设备 (Equipment)',
    'MAINTENANCE': '维修 (Maintenance)',
    'MARKETING': '营销 (Marketing)',
    'LICENSE': '执照 (License)',
    'MBB_COMM': '银行手续费 (Maybank)',
    'DIVIDEND': '股东分红 (Dividend)',
    'STAFF_MEAL': '员工餐 (Staff Meal)',
    'DEPOSIT': '押金 (Deposit)'
};

const categorizeExpense = (category: string) => {
    const c = category?.toUpperCase() || 'OTHER';
    if (c.includes('DEPOSIT')) return 'ASSET'; // 押金不算费用
    if (['INGREDIENT', 'MEAT', 'SEAFOOD', 'VEG', 'DRY', 'SAUCE', 'BEVERAGE', 'PACKAGING', 'GAS', 'SUPPLIER', 'HQ'].some(k => c.includes(k))) return 'COGS';
    if (['SALARY', 'EPF', 'SOCSO', 'ADVANCE', 'COMMISSION', 'STAFF_ADVANCE', 'ALLOWANCE', 'PAYROLL', 'STAFF_MEAL'].some(k => c.includes(k))) return 'LABOR';
    return 'OPEX'; 
};

interface CostGroup {
    id: string;
    label: string;
    amount: number;
    type: string;
    isPending?: boolean;
}

export const FinancialReport: React.FC<FinancialReportProps> = ({ onClose }) => {
    const [settlementRecords, setSettlementRecords] = useState<SettlementRecord[]>([]);
    const [standaloneExpenses, setStandaloneExpenses] = useState<ExpenseItem[]>([]);
    const [billPayments, setBillPayments] = useState<BillPaymentRecord[]>([]);
    const [transfers, setTransfers] = useState<FundTransfer[]>([]);
    const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
    const [treasuryConfig, setTreasuryConfig] = useState<TreasuryConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    
    const printRef = useRef<HTMLDivElement>(null);

    const getMonthStartStr = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}-01`; 
    };
    
    const getTodayStr = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const [startDate, setStartDate] = useState(getMonthStartStr()); 
    const [endDate, setEndDate] = useState(getTodayStr());
    
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SALES' | 'COST' | 'AUDIT' | 'DIVIDEND'>('OVERVIEW');
    const [accountingMode, setAccountingMode] = useState<'ACCRUAL' | 'CASH'>('ACCRUAL');
    const [retentionRate, setRetentionRate] = useState(20); 
    const [detailView, setDetailView] = useState<{ title: string, type: 'COGS' | 'LABOR' | 'OPEX', items: DetailedExpenseItem[] } | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [bills, funds, config, payrolls] = await Promise.all([
                    DataManager.getBillPayments(),
                    DataManager.getFundTransfers(),
                    DataManager.getTreasuryConfig(),
                    DataManager.getPayrollRecords()
                ]);

                const configStart = config?.initialDate || '2000-01-01';

                const settlementsRef = collection(db, 'settlements'); 
                const expensesRef = collection(db, 'standalone_expenses');

                const [setSnap, expSnap] = await Promise.all([
                    getDocs(query(settlementsRef, where("date", ">=", configStart))),
                    getDocs(query(expensesRef, where("time", ">=", configStart)))
                ]);

                const settlements = setSnap.docs.map(d => ({ id: d.id, ...d.data() } as SettlementRecord));
                const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseItem));

                setSettlementRecords(settlements);
                setStandaloneExpenses(expenses);
                setBillPayments(bills);
                setTransfers(funds);
                setTreasuryConfig(config);
                setPayrollRecords(payrolls);
            } catch (error) {
                console.error("Failed to load financial data", error);
                alert("⚠️ 财务数据拉取异常，请检查网络或联系管理员。");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // FIX: WEEK 日期计算 bug — end 必须基于修改前的 start 计算
    const setQuickDate = (type: 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'LAST_MONTH') => {
        const now = new Date();
        let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (type === 'TODAY') {
            // No change
        } else if (type === 'YESTERDAY') {
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() - 1);
        } else if (type === 'WEEK') {
            const day = start.getDay() || 7;
            // FIX: 先算好本周一，再基于本周一算本周日，避免 start 被修改后影响 end 的计算
            const monday = new Date(start);
            monday.setDate(start.getDate() - day + 1);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            start = monday;
            end = sunday;
        } else if (type === 'MONTH') {
            start.setDate(1); 
        } else if (type === 'LAST_MONTH') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
        }

        const formatLocal = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        setStartDate(formatLocal(start));
        setEndDate(formatLocal(end));
    };

    const analytics = useMemo(() => {
        const isInRange = (dateStr: string) => {
            if (!dateStr) return false;
            const d = dateStr.split('T')[0];
            return d >= startDate && d <= endDate;
        };

        const revenueDetails = {
            cash: 0, tng: 0, debitCard: 0, creditCard: 0, delivery: 0, totalRevenue: 0, variance: 0 
        };

        settlementRecords.filter(s => isInRange(s.date)).forEach(s => {
            const cashAmt = Number(s.sales?.cash || 0);
            const tngAmt = Number(s.sales?.tng || 0);
            const duitnowAmt = Number(s.sales?.duitnow || 0);
            const cardAmt = Number(s.sales?.card || 0);
            const varianceAmt = Number(s.variance || 0);

            const del = s.sales?.deliveryBreakdown 
                ? Object.values(s.sales.deliveryBreakdown).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
                : 0;
            const deliveryAmt = Number(del);

            // sales.total = 堂食 POS 总额（不含 delivery）
            // 总营收 = POS 堂食 + 外卖平台到账
            const posTotal = Number(s.sales?.total || 0);
            const posCalculated = cashAmt + tngAmt + duitnowAmt + cardAmt;
            const storeSales = Math.max(posTotal, posCalculated);
            
            revenueDetails.totalRevenue += storeSales + deliveryAmt;
            revenueDetails.cash += cashAmt;
            revenueDetails.tng += tngAmt; 
            revenueDetails.debitCard += duitnowAmt;
            revenueDetails.creditCard += cardAmt;
            revenueDetails.delivery += deliveryAmt;
            revenueDetails.variance += varianceAmt;
        });

        const totalPaymentMethodVolume = revenueDetails.cash + revenueDetails.tng + revenueDetails.debitCard + revenueDetails.creditCard; 
        const cashPercentage = totalPaymentMethodVolume > 0 ? (revenueDetails.cash / totalPaymentMethodVolume) * 100 : 0;
        const ewalletPercentage = totalPaymentMethodVolume > 0 ? ((revenueDetails.tng + revenueDetails.debitCard + revenueDetails.creditCard) / totalPaymentMethodVolume) * 100 : 0;

        let totalCOGS = 0, totalLabor = 0, totalOPEX = 0, totalDeposits = 0;
        const groups: Record<string, CostGroup> = {};

        const addCost = (amount: number, category: string, label?: string, isPending: boolean = false) => {
            if (!amount && !isPending) return; 
            
            const catKey = category ? category.toUpperCase() : 'OTHER';
            const type = categorizeExpense(catKey);

            // ASSET（押金）不计入损益，单独追踪
            if (type === 'ASSET') {
                totalDeposits += amount;
                if (!groups[catKey]) groups[catKey] = { id: catKey, label: label || CATEGORY_LABELS[catKey] || '押金 (Deposit)', amount: 0, type, isPending };
                groups[catKey].amount += amount;
                return;
            }
            
            if (!isPending) {
                if (type === 'COGS') totalCOGS += amount;
                else if (type === 'LABOR') totalLabor += amount;
                else totalOPEX += amount;
            }

            if (!groups[catKey]) groups[catKey] = { id: catKey, label: label || CATEGORY_LABELS[catKey] || catKey, amount: 0, type, isPending };
            groups[catKey].amount += amount;
        };

        settlementRecords.filter(s => isInRange(s.date)).forEach(s => {
            s.expenses?.forEach(e => addCost(Number(e.amount || 0), e.category));
        });

        standaloneExpenses.forEach(e => {
            if (e.id.startsWith('payroll_') || e.category === 'PAYROLL') return;
            if (e.settlementId) return; 

            if (accountingMode === 'ACCRUAL') {
                // ACCRUAL: 按入账日(time)归类，包含所有已记录的费用（不管有没有付款）
                // 用 totalBillAmount 作为真实成本
                if (!isInRange(e.time)) return;
                const fullCost = Number(e.totalBillAmount || e.amount || 0) - Number(e.creditNote || 0);
                if (fullCost > 0) addCost(fullCost, e.category);
            } else {
                // CASH: 按付款日(paymentDate)归类，只计算已付金额
                if (e.paymentStatus !== 'PAID' && e.paymentStatus !== 'PARTIAL') return;
                const effectiveDate = e.paymentDate || e.time;
                if (!isInRange(effectiveDate)) return;
                const paidAmt = Number(e.amount || 0) - Number(e.creditNote || 0);
                if (paidAmt > 0) addCost(paidAmt, e.category);
            }
        });

        billPayments.filter(b => isInRange(b.date)).forEach(b => addCost(Number(b.amount || 0), b.category));

        payrollRecords.forEach(p => {
             const effectiveDate = `${p.month}-28`;
             if (effectiveDate >= startDate && effectiveDate <= endDate && p.status === 'POSTED') {
                 addCost(Number(p.totalNetPay || 0), 'PAYROLL', `Staff Payroll (Net - ${p.month})`);
                 if (p.isStatutoryPaid) {
                     addCost(Number(p.totalGovtPay || 0), 'EPF_SOCSO', `Statutory Paid (${p.month})`);
                 } else {
                     const pendingKey = `STAT_PENDING_${p.month}`;
                     if (!groups[pendingKey]) {
                         groups[pendingKey] = { id: pendingKey, label: `Statutory (${p.month}) - Draft`, amount: Number(p.totalGovtPay || 0), type: 'LABOR', isPending: true };
                     }
                 }
             }
        });

        const debitFee = revenueDetails.debitCard * 0.0045;
        const creditFee = revenueDetails.creditCard * 0.01;
        const totalCommission = debitFee + creditFee;
        
        // FIX: MBB_COMM 只在 groups 里不存在时才加，防止重复计算
        if (totalCommission > 0 && !groups['MBB_COMM']) {
            addCost(totalCommission, 'MBB_COMM');
        }

        const totalExpenses = totalCOGS + totalLabor + totalOPEX;
        const grossProfit = revenueDetails.totalRevenue - totalCOGS;
        // Fix #4: 净利润 = 经营利润，不含现金差异
        const netProfit = grossProfit - (totalLabor + totalOPEX);
        // 含差异的实际净利
        const adjustedNetProfit = netProfit + revenueDetails.variance;

        const cogsMargin = revenueDetails.totalRevenue > 0 ? (totalCOGS / revenueDetails.totalRevenue) * 100 : 0;
        const laborMargin = revenueDetails.totalRevenue > 0 ? (totalLabor / revenueDetails.totalRevenue) * 100 : 0;
        const opexMargin = revenueDetails.totalRevenue > 0 ? (totalOPEX / revenueDetails.totalRevenue) * 100 : 0;
        const netMargin = revenueDetails.totalRevenue > 0 ? (netProfit / revenueDetails.totalRevenue) * 100 : 0;

        // Fix #8: Daily Sales Trend — 与总营收逻辑一致（POS堂食 + delivery）
        const dailySalesMap: Record<string, number> = {};
        const dailyExpenseMap: Record<string, number> = {};
        settlementRecords.filter(s => isInRange(s.date)).forEach(s => {
            const d = s.date.split('T')[0];
            const posTotal = Number(s.sales?.total || 0);
            const posCal = Number(s.sales?.cash || 0) + Number(s.sales?.tng || 0) + Number(s.sales?.duitnow || 0) + Number(s.sales?.card || 0);
            const delivery = s.sales?.deliveryBreakdown ? Object.values(s.sales.deliveryBreakdown).reduce((a: number, b: any) => a + (Number(b) || 0), 0) : 0;
            dailySalesMap[d] = (dailySalesMap[d] || 0) + Math.max(posTotal, posCal) + Number(delivery);
            const dayExp = s.expenses?.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0) || 0;
            dailyExpenseMap[d] = (dailyExpenseMap[d] || 0) + dayExp;
        });
        const dailySales = Object.entries(dailySalesMap)
            .map(([date, sales]) => ({ date, sales, expenses: dailyExpenseMap[date] || 0 }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Settlement count for averages
        const settlementCount = settlementRecords.filter(s => isInRange(s.date)).length;
        const avgDailySales = settlementCount > 0 ? revenueDetails.totalRevenue / settlementCount : 0;

        return {
            revenueDetails, percentages: { cash: cashPercentage, ewallet: ewalletPercentage },
            grossProfit, netProfit, adjustedNetProfit, netMargin,
            costs: { totalCOGS, totalLabor, totalOPEX, totalExpenses, totalDeposits },
            margins: { cogs: cogsMargin, labor: laborMargin, opex: opexMargin },
            lists: {
                cogsList: Object.values(groups).filter(g => g.type === 'COGS').sort((a,b) => b.amount - a.amount),
                laborList: Object.values(groups).filter(g => g.type === 'LABOR').sort((a,b) => b.amount - a.amount),
                opexList: Object.values(groups).filter(g => g.type === 'OPEX').sort((a,b) => b.amount - a.amount),
                depositList: Object.values(groups).filter(g => g.type === 'ASSET').sort((a,b) => b.amount - a.amount)
            },
            fees: { debitFee, creditFee, totalCommission },
            dailySales, avgDailySales, settlementCount
        };
    }, [settlementRecords, standaloneExpenses, billPayments, payrollRecords, startDate, endDate, accountingMode]);

    const getDrillDownData = (criteria: { type?: 'COGS'|'LABOR'|'OPEX', categoryId?: string }) => {
        const rawItems: DetailedExpenseItem[] = [];
        const isInRange = (dateStr: string) => {
            if (!dateStr) return false;
            const d = dateStr.split('T')[0];
            return d >= startDate && d <= endDate;
        };

        const addItem = (item: DetailedExpenseItem) => {
            const itemType = categorizeExpense(item.category);
            if (criteria.type && itemType !== criteria.type) return;
            if (criteria.categoryId && item.category.toUpperCase() !== criteria.categoryId && !criteria.categoryId.startsWith('STAT_PENDING')) return;
            if (criteria.categoryId?.startsWith('STAT_PENDING') && item.id !== criteria.categoryId) return; 

            item.type = itemType;
            rawItems.push(item);
        };

        settlementRecords.filter(s => isInRange(s.date)).forEach(s => {
            s.expenses?.forEach((e, idx) => {
                addItem({ id: `${s.id}_${idx}`, date: s.date, category: e.category, desc: `${e.company || 'Petty Cash'} (from Daily Settlement)`, amount: Number(e.amount || 0), source: 'Settlement', type: '' });
            });
        });

        standaloneExpenses.forEach(e => {
            if (e.id.startsWith('payroll_') || e.category === 'PAYROLL') return;
            if (e.settlementId) return;

            if (accountingMode === 'ACCRUAL') {
                if (!isInRange(e.time)) return;
                const fullCost = Number(e.totalBillAmount || e.amount || 0) - Number(e.creditNote || 0);
                const statusTag = e.paymentStatus === 'PAID' ? '' : e.paymentStatus === 'PARTIAL' ? ' [部分付款]' : ' [未付款]';
                addItem({ id: e.id, date: e.time.split('T')[0], category: e.category, desc: e.company + (e.note ? ` - ${e.note}` : '') + statusTag, amount: fullCost, source: 'AP/Voucher', type: '' });
            } else {
                if (e.paymentStatus !== 'PAID' && e.paymentStatus !== 'PARTIAL') return;
                const effectiveDate = e.paymentDate || e.time;
                if (!isInRange(effectiveDate)) return;
                const paidAmt = Number(e.amount || 0) - Number(e.creditNote || 0);
                addItem({ id: e.id, date: (effectiveDate).split('T')[0], category: e.category, desc: e.company + (e.note ? ` - ${e.note}` : ''), amount: paidAmt, source: 'AP/Voucher', type: '' });
            }
        });

        billPayments.filter(b => isInRange(b.date)).forEach(b => {
            addItem({ id: b.id, date: b.date, category: b.category, desc: b.name, amount: Number(b.amount || 0), source: 'Bill Payment', type: '' });
        });

        payrollRecords.forEach(p => {
             const effectiveDate = `${p.month}-28`;
             if (effectiveDate >= startDate && effectiveDate <= endDate && p.status === 'POSTED') {
                 if (!criteria.categoryId || criteria.categoryId === 'PAYROLL') {
                    addItem({ id: p.id, date: effectiveDate, category: 'PAYROLL', desc: `Net Pay for ${p.month} (Staff Count: ${p.staffCount})`, amount: Number(p.totalNetPay || 0), source: 'Payroll (Net)', type: 'LABOR' });
                 }
                 if (p.isStatutoryPaid && (!criteria.categoryId || criteria.categoryId === 'EPF_SOCSO')) {
                     addItem({ id: `${p.id}_STAT`, date: effectiveDate, category: 'EPF_SOCSO', desc: `EPF/SOCSO/EIS for ${p.month}`, amount: Number(p.totalGovtPay || 0), source: 'Payroll (Statutory)', type: 'LABOR' });
                 }
                 if (!p.isStatutoryPaid && criteria.categoryId === `STAT_PENDING_${p.month}`) {
                     addItem({ id: `STAT_PENDING_${p.month}`, date: effectiveDate, category: 'EPF_SOCSO', desc: `[DRAFT] Statutory for ${p.month} (Not yet paid)`, amount: Number(p.totalGovtPay || 0), source: 'Payroll (Pending)', type: 'LABOR' });
                 }
             }
        });

        // FIX: MBB_COMM 钻取时不再手动 push（因为 standalone_expenses 里不会有这条）
        // 改为从 analytics.fees 读取，避免重复
        if (criteria.categoryId === 'MBB_COMM' && rawItems.length === 0) {
            rawItems.push({ id: 'MBB_FEE_CALC', date: endDate, category: 'MBB_COMM', desc: `Maybank Transaction Fees (Auto-Calculated)`, amount: analytics.fees.totalCommission, source: 'System Auto-Calc', type: 'OPEX' });
        }

        return rawItems.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const handleDrillDown = (criteria: { type?: 'COGS'|'LABOR'|'OPEX', categoryId?: string }, title: string) => {
        const items = getDrillDownData(criteria);
        setDetailView({ title: title, type: criteria.type || 'OPEX', items: items || [] });
    };

    const { auditTrail, openingBalance } = useMemo(() => {
        const allTransactions: any[] = [];
        const configStart = treasuryConfig?.initialDate || '2000-01-01';
        let runningBalance = Number(treasuryConfig?.initialCash || 0) + Number(treasuryConfig?.initialBank || 0);

        settlementRecords.forEach(s => {
            if (s.date >= configStart) {
                const actualCash = Number(s.sales?.cash || 0) + Number(s.variance || 0);
                if (actualCash !== 0) {
                    allTransactions.push({ id: `cash_${s.id}`, date: s.date, time: s.timestamp, type: 'IN', category: 'SALES', description: 'Cash Sales (Net)', amount: actualCash, account: 'CASH' });
                }

                const bankIncome = Number(s.sales?.tng || 0) + Number(s.sales?.duitnow || 0) + Number(s.sales?.card || 0);
                const delivery = s.sales?.deliveryBreakdown ? Object.values(s.sales.deliveryBreakdown).reduce((a: number, b: any) => a + (Number(b) || 0), 0) : 0;
                
                if (bankIncome + delivery > 0) {
                    allTransactions.push({ id: `bank_${s.id}`, date: s.date, time: s.timestamp, type: 'IN', category: 'SALES', description: 'Digital/Delivery Sales', amount: bankIncome + delivery, account: 'BANK' });
                }
                
                s.expenses?.forEach((e, idx) => { 
                    allTransactions.push({ id: `${s.id}_e_${idx}`, date: s.date, time: s.timestamp, type: 'OUT', category: e.category, description: `Petty: ${e.company || ''}`, amount: Number(e.amount || 0), account: 'CASH' }); 
                });
            }
        });

        standaloneExpenses.forEach(e => {
            if (e.settlementId || e.expenseType === 'RECURRING') return; 
            if ((e.paymentStatus === 'PAID' || e.paymentStatus === 'PARTIAL') && Number(e.amount || 0) > 0) {
                const transactionTime = e.paymentDate || e.time;
                if (transactionTime.split('T')[0] >= configStart) {
                    allTransactions.push({ id: e.id, date: transactionTime.split('T')[0], time: transactionTime, type: 'OUT', category: e.category, description: e.company, amount: Number(e.amount || 0), account: e.paymentMethod || 'BANK' });
                }
            }
        });

        billPayments.forEach(b => {
            if (b.date >= configStart) allTransactions.push({ id: b.id, date: b.date, time: `${b.date}T12:00:00`, type: 'OUT', category: b.category, description: b.name, amount: Number(b.amount || 0), account: b.method || 'BANK' });
        });

        // FIX: 补上所有类型的 transfers，包括日常 CASH ↔ BANK 互转
        transfers.forEach(t => {
            const dateStr = t.date.split('T')[0];
            if (dateStr < configStart) return;

            if (t.fromAccount === 'SHAREHOLDER' as any || t.fromAccount === 'OTHER' as any) {
                // 注资/额外收入：净 IN
                allTransactions.push({ 
                    id: t.id, 
                    date: dateStr, 
                    time: t.date, 
                    type: 'IN', 
                    category: 'FUND', 
                    description: t.note || 'Injection / Extra Income', 
                    amount: Number(t.amount || 0), 
                    account: t.toAccount 
                });
            } else {
                // 日常 CASH ↔ BANK 互转：记为 TRANSFER（余额不变，但显示流水）
                allTransactions.push({ 
                    id: `trf_out_${t.id}`, 
                    date: dateStr, 
                    time: t.date, 
                    type: 'TRANSFER', 
                    category: 'TRANSFER', 
                    description: `${t.fromAccount} → ${t.toAccount}${t.note ? ` (${t.note})` : ''}`, 
                    amount: Number(t.amount || 0), 
                    account: t.fromAccount 
                });
            }
        });

        allTransactions.sort((a, b) => new Date(a.time || a.date).getTime() - new Date(b.time || b.date).getTime());
        
        const displayItems: AuditLogItem[] = [];
        let balanceAtStartOfRange = runningBalance; 

        allTransactions.forEach(t => {
            // FIX: TRANSFER 类型不影响总余额（只是账户间移动）
            if (t.type === 'IN') runningBalance += t.amount; 
            else if (t.type === 'OUT') runningBalance -= t.amount;
            // TRANSFER: runningBalance 不变
            
            if (t.date < startDate) balanceAtStartOfRange = runningBalance;
            else if (t.date <= endDate) displayItems.push({ ...t, balance: runningBalance });
        });

        return { auditTrail: displayItems.reverse(), openingBalance: balanceAtStartOfRange };
    }, [settlementRecords, standaloneExpenses, billPayments, transfers, treasuryConfig, startDate, endDate]);

    const formatMoney = (amount: number) => `RM ${Number(amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    const handleExport = async () => {
        if (!printRef.current) return;
        setIsExporting(true);
        try {
            await new Promise(r => setTimeout(r, 500));
            const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Financial_Report_${startDate}_${endDate}.pdf`);
        } catch (e) { alert("Export failed"); } finally { setIsExporting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-[#F5F7FA] w-full h-full md:w-[95vw] md:h-[92vh] lg:max-w-7xl md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl relative font-sans">
                
                <div className="bg-[#1A1A1A] p-4 md:p-5 flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700]">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#FFD700] text-black p-2.5 rounded-xl shadow-lg"><PieChart size={24}/></div>
                        <div>
                            <h3 className="font-serif font-black text-xl tracking-wide">财务审计报表</h3>
                            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">FINANCIAL INTELLIGENCE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExport} disabled={isExporting} className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95">
                            {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>} 导出 PDF
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95"><X size={24}/></button>
                    </div>
                </div>

                <div className="bg-white border-b border-gray-200 p-4 flex flex-col gap-4 shrink-0 shadow-sm z-10 touch-manipulation">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 px-3">
                                <Calendar size={14} className="text-gray-400"/>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm font-bold outline-none w-32 cursor-pointer"/>
                                <ArrowRight size={14} className="text-gray-300"/>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm font-bold outline-none w-32 cursor-pointer"/>
                            </div>
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-hide">
                                {['YESTERDAY', 'TODAY', 'WEEK', 'MONTH', 'LAST_MONTH'].map(t => (
                                    <button key={t} onClick={() => setQuickDate(t as any)} className="px-3 py-2 bg-white shadow-sm rounded-lg text-[10px] md:text-xs font-bold hover:bg-gray-50 transition-colors whitespace-nowrap active:scale-95">{t.replace('_', ' ')}</button>
                                ))}
                            </div>
                        </div>

                        <div className="flex bg-gray-100 p-1.5 rounded-xl overflow-x-auto w-full lg:w-auto scrollbar-hide">
                        {[
                            { id: 'OVERVIEW', label: '总览 (Overview)', icon: LayoutList },
                            { id: 'SALES', label: '营收分析 (Sales)', icon: TrendingUp },
                            { id: 'COST', label: '成本分析 (Cost)', icon: PieChart },
                            { id: 'AUDIT', label: '资金流水 (Audit)', icon: ListChecks },
                            { id: 'DIVIDEND', label: '分红计算 (Dividend)', icon: Percent }
                        ].map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)} 
                                    className={`px-4 md:px-5 py-2.5 rounded-lg text-xs md:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 ${activeTab === tab.id ? 'bg-white shadow text-[#1A1A1A] ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Icon size={16}/> {tab.label}
                                </button>
                            );
                        })}
                    </div>
                    </div>
                    
                    {/* Accounting Mode Toggle - 会计模式切换 */}
                    {(activeTab === 'OVERVIEW' || activeTab === 'COST' || activeTab === 'DIVIDEND') && (
                        <div className="flex items-center justify-between bg-gray-50/80 border-t border-gray-100 px-4 py-2.5">
                            <div className="flex items-center gap-2">
                                <HelpCircle size={13} className="text-gray-400 shrink-0"/>
                                <span className="text-[10px] text-gray-500 font-bold leading-tight">
                                    {accountingMode === 'ACCRUAL' 
                                        ? '权责发生制：按入账日归类，包含未付账单（反映真实经营成本）' 
                                        : '收付实现制：按付款日归类，只计已付金额（与资金管理一致）'}
                                </span>
                            </div>
                            <div className="flex bg-white border border-gray-200 rounded-lg p-0.5 shrink-0 ml-3">
                                <button 
                                    onClick={() => setAccountingMode('ACCRUAL')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all whitespace-nowrap ${accountingMode === 'ACCRUAL' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    权责发生制
                                </button>
                                <button 
                                    onClick={() => setAccountingMode('CASH')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all whitespace-nowrap ${accountingMode === 'CASH' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    收付实现制
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-[#F5F7FA] touch-pan-y">
                    {loading ? (
                        <div className="flex items-center justify-center h-40"><Loader2 size={32} className="animate-spin text-gray-400"/></div>
                    ) : (
                        <div className="max-w-7xl mx-auto">
                            
                            {activeTab === 'OVERVIEW' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                    {/* Accounting Mode Indicator */}
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold ${accountingMode === 'ACCRUAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-sky-50 text-sky-700 border border-sky-200'}`}>
                                        <Info size={12} className="shrink-0"/>
                                        {accountingMode === 'ACCRUAL' 
                                            ? '📋 权责发生制 (Accrual) — 成本按入账/收货日计算，包含未付款账单。利润反映真实经营状况。' 
                                            : '💰 收付实现制 (Cash Basis) — 成本按实际付款日计算，仅含已付金额。数据与资金管理同步。'}
                                    </div>

                                    {/* KPI Cards Row */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                        <div className="bg-blue-50 p-4 md:p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden group">
                                            <p className="text-[9px] md:text-[10px] font-bold text-blue-600 uppercase mb-1 tracking-wider relative z-10">总营收 (Revenue)</p>
                                            <p className="text-xl md:text-2xl font-black text-blue-900 font-mono relative z-10">{formatMoney(analytics.revenueDetails.totalRevenue)}</p>
                                            <p className="text-[9px] text-blue-500 font-bold mt-1 relative z-10">{analytics.settlementCount} 天 · 日均 {formatMoney(analytics.avgDailySales)}</p>
                                        </div>
                                        <div className="bg-red-50 p-4 md:p-5 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden group">
                                            <p className="text-[9px] md:text-[10px] font-bold text-red-600 uppercase mb-1 tracking-wider relative z-10">总支出 (Expenses)</p>
                                            <p className="text-xl md:text-2xl font-black text-red-900 font-mono relative z-10">{formatMoney(analytics.costs.totalExpenses)}</p>
                                            <p className="text-[9px] text-red-400 font-bold mt-1 relative z-10">占营收 {analytics.revenueDetails.totalRevenue > 0 ? ((analytics.costs.totalExpenses / analytics.revenueDetails.totalRevenue) * 100).toFixed(1) : '0'}%</p>
                                        </div>
                                        <div className={`${analytics.netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-200'} p-4 md:p-5 rounded-2xl border shadow-sm relative overflow-hidden group`}>
                                            <p className="text-[9px] md:text-[10px] font-bold text-emerald-700 uppercase mb-1 tracking-wider relative z-10">毛利润 (Gross)</p>
                                            <p className={`text-xl md:text-2xl font-black font-mono relative z-10 ${analytics.grossProfit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>{formatMoney(analytics.grossProfit)}</p>
                                            <p className="text-[9px] text-emerald-500 font-bold mt-1 relative z-10">毛利率 {analytics.revenueDetails.totalRevenue > 0 ? ((analytics.grossProfit / analytics.revenueDetails.totalRevenue) * 100).toFixed(1) : '0'}%</p>
                                        </div>
                                        <div className={`${analytics.netProfit >= 0 ? 'bg-[#1A1A1A]' : 'bg-red-900'} p-4 md:p-5 rounded-2xl shadow-xl relative overflow-hidden group`}>
                                            <p className="text-[9px] md:text-[10px] font-bold text-[#FFD700] uppercase mb-1 tracking-wider relative z-10">经营净利 (Operating Profit)</p>
                                            <p className="text-xl md:text-2xl font-black text-white font-mono relative z-10">{formatMoney(analytics.netProfit)}</p>
                                            <p className="text-[9px] text-[#FFD700]/80 font-bold mt-1 relative z-10">净利率 {analytics.netMargin.toFixed(1)}%</p>
                                            {analytics.revenueDetails.variance !== 0 && (
                                                <p className="text-[8px] text-white/50 font-mono mt-0.5 relative z-10">含差异后: {formatMoney(analytics.adjustedNetProfit)}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Daily Sales Trend Chart */}
                                    {analytics.dailySales.length > 1 && (
                                        <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-black text-sm text-[#1A1A1A] mb-4 uppercase tracking-widest flex items-center gap-2"><BarChart3 size={16}/> 每日营收趋势 (Daily Revenue Trend)</h4>
                                            <div className="w-full overflow-x-auto">
                                                <div className="min-w-[400px]">
                                                    {(() => {
                                                        const data = analytics.dailySales;
                                                        const maxVal = Math.max(...data.map(d => d.sales), 1);
                                                        const chartH = 160;
                                                        const barW = Math.max(16, Math.min(40, (600 / data.length) - 4));
                                                        const totalW = data.length * (barW + 4);
                                                        return (
                                                            <div>
                                                                <div className="flex items-end gap-1 justify-center" style={{ minWidth: totalW, height: chartH }}>
                                                                    {data.map((d, i) => {
                                                                        const h = Math.max(4, (d.sales / maxVal) * (chartH - 24));
                                                                        const isHighest = d.sales === maxVal;
                                                                        const isToday = d.date === getTodayStr();
                                                                        return (
                                                                            <div key={i} className="flex flex-col items-center gap-1" style={{ width: barW }}>
                                                                                <span className={`text-[8px] font-mono font-bold ${isHighest ? 'text-blue-600' : 'text-gray-400'}`}>
                                                                                    {d.sales >= 1000 ? `${(d.sales/1000).toFixed(1)}k` : d.sales.toFixed(0)}
                                                                                </span>
                                                                                <div 
                                                                                    className={`w-full rounded-t-md transition-all ${isToday ? 'bg-blue-500' : isHighest ? 'bg-blue-400' : 'bg-blue-200 hover:bg-blue-300'}`}
                                                                                    style={{ height: h }}
                                                                                    title={`${d.date}: RM ${d.sales.toFixed(2)}`}
                                                                                ></div>
                                                                                <span className={`text-[7px] font-mono ${isToday ? 'text-blue-600 font-black' : 'text-gray-400'}`}>
                                                                                    {d.date.slice(8)}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div className="flex justify-between items-center mt-3 px-1">
                                                                    <span className="text-[9px] text-gray-400 font-bold">📊 {data.length} 天 · 日均 {formatMoney(analytics.avgDailySales)}</span>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-[9px] text-gray-400 flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm inline-block"></span> Today</span>
                                                                        <span className="text-[9px] text-gray-400 flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded-sm inline-block"></span> Highest</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Cost Structure Visual */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Donut-like proportional bar */}
                                        <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-black text-sm text-[#1A1A1A] mb-4 uppercase tracking-widest flex items-center gap-2"><PieChart size={16}/> 成本结构 (Cost Structure)</h4>
                                            {analytics.costs.totalExpenses > 0 ? (
                                                <div>
                                                    {/* Stacked bar */}
                                                    <div className="flex h-8 rounded-full overflow-hidden mb-4 bg-gray-100">
                                                        <div className="bg-red-400 transition-all duration-700" style={{ width: `${(analytics.costs.totalCOGS / analytics.costs.totalExpenses) * 100}%` }} title={`COGS: ${formatMoney(analytics.costs.totalCOGS)}`}></div>
                                                        <div className="bg-purple-400 transition-all duration-700" style={{ width: `${(analytics.costs.totalLabor / analytics.costs.totalExpenses) * 100}%` }} title={`Labor: ${formatMoney(analytics.costs.totalLabor)}`}></div>
                                                        <div className="bg-orange-400 transition-all duration-700" style={{ width: `${(analytics.costs.totalOPEX / analytics.costs.totalExpenses) * 100}%` }} title={`OPEX: ${formatMoney(analytics.costs.totalOPEX)}`}></div>
                                                    </div>
                                                    {/* Legend */}
                                                    <div className="space-y-2">
                                                        <button onClick={() => handleDrillDown({ type: 'COGS' }, '销货成本 (COGS)')} className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-red-50 transition-colors active:scale-[0.99] group">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 bg-red-400 rounded-sm shrink-0"></div>
                                                                <span className="text-xs font-bold text-gray-600 group-hover:text-red-700">COGS 食材成本</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-mono font-black text-[#1A1A1A]">{formatMoney(analytics.costs.totalCOGS)}</span>
                                                                <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{analytics.margins.cogs.toFixed(1)}%</span>
                                                                <ChevronRight size={12} className="text-gray-300"/>
                                                            </div>
                                                        </button>
                                                        <button onClick={() => handleDrillDown({ type: 'LABOR' }, '人工薪资 (Labor)')} className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 transition-colors active:scale-[0.99] group">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 bg-purple-400 rounded-sm shrink-0"></div>
                                                                <span className="text-xs font-bold text-gray-600 group-hover:text-purple-700">Labor 人工成本</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-mono font-black text-[#1A1A1A]">{formatMoney(analytics.costs.totalLabor)}</span>
                                                                <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">{analytics.margins.labor.toFixed(1)}%</span>
                                                                <ChevronRight size={12} className="text-gray-300"/>
                                                            </div>
                                                        </button>
                                                        <button onClick={() => handleDrillDown({ type: 'OPEX' }, '运营支出 (OPEX)')} className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-orange-50 transition-colors active:scale-[0.99] group">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 bg-orange-400 rounded-sm shrink-0"></div>
                                                                <span className="text-xs font-bold text-gray-600 group-hover:text-orange-700">OPEX 运营支出</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-mono font-black text-[#1A1A1A]">{formatMoney(analytics.costs.totalOPEX)}</span>
                                                                <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">{analytics.margins.opex.toFixed(1)}%</span>
                                                                <ChevronRight size={12} className="text-gray-300"/>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-10 text-gray-400 text-xs">暂无支出数据</div>
                                            )}
                                        </div>

                                        {/* Profit Waterfall */}
                                        <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-black text-sm text-[#1A1A1A] mb-4 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={16}/> 利润瀑布图 (Profit Waterfall)</h4>
                                            {analytics.revenueDetails.totalRevenue > 0 ? (
                                                <div className="space-y-3">
                                                    {(() => {
                                                        const rev = analytics.revenueDetails.totalRevenue;
                                                        const items = [
                                                            { label: '营收 Revenue', value: rev, color: 'bg-blue-400', pct: 100 },
                                                            { label: '− COGS 食材', value: -analytics.costs.totalCOGS, color: 'bg-red-300', pct: (analytics.costs.totalCOGS / rev) * 100 },
                                                            { label: '= 毛利 Gross', value: analytics.grossProfit, color: 'bg-emerald-400', pct: (analytics.grossProfit / rev) * 100 },
                                                            { label: '− Labor 人工', value: -analytics.costs.totalLabor, color: 'bg-purple-300', pct: (analytics.costs.totalLabor / rev) * 100 },
                                                            { label: '− OPEX 运营', value: -analytics.costs.totalOPEX, color: 'bg-orange-300', pct: (analytics.costs.totalOPEX / rev) * 100 },
                                                            { label: '= 净利 Net', value: analytics.netProfit, color: analytics.netProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500', pct: Math.abs(analytics.netMargin) },
                                                        ];
                                                        return items.map((item, i) => (
                                                            <div key={i} className="flex items-center gap-3">
                                                                <span className="text-[9px] font-bold text-gray-500 w-20 shrink-0 text-right">{item.label}</span>
                                                                <div className="flex-1 h-5 bg-gray-50 rounded-full overflow-hidden relative">
                                                                    <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(100, Math.abs(item.pct))}%` }}></div>
                                                                </div>
                                                                <span className={`text-[10px] font-mono font-black w-24 text-right shrink-0 ${item.value >= 0 ? 'text-[#1A1A1A]' : 'text-red-600'}`}>
                                                                    {formatMoney(Math.abs(item.value))}
                                                                </span>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            ) : (
                                                <div className="text-center py-10 text-gray-400 text-xs">暂无数据</div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Cash Variance + Payment Mix */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><Calculator size={14} className="text-gray-400"/> 现金差异 (Variance)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">不计入经营净利，仅供参考</p>
                                                </div>
                                                <div className={`text-xl font-black font-mono ${analytics.revenueDetails.variance >= 0 ? 'text-gray-400' : 'text-red-600'}`}>
                                                    {analytics.revenueDetails.variance > 0 ? '+' : ''}{formatMoney(analytics.revenueDetails.variance)}
                                                </div>
                                            </div>
                                            {analytics.revenueDetails.variance !== 0 && (
                                                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-[10px]">
                                                    <span className="text-gray-400 font-bold">含差异实际净利</span>
                                                    <span className={`font-mono font-black ${analytics.adjustedNetProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(analytics.adjustedNetProfit)}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2 mb-3"><Wallet size={14} className="text-gray-400"/> 堂食收款 (In-Store Payments)</h4>
                                            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 mb-2">
                                                <div className="bg-green-500 transition-all duration-700" style={{ width: `${analytics.percentages.cash}%` }}></div>
                                                <div className="bg-blue-500 transition-all duration-700" style={{ width: `${analytics.percentages.ewallet}%` }}></div>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold">
                                                <span className="text-green-600">💵 现金 {analytics.percentages.cash.toFixed(0)}%</span>
                                                <span className="text-blue-600">💳 电子支付 {analytics.percentages.ewallet.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deposit notice (if any) */}
                                    {analytics.costs.totalDeposits > 0 && (
                                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[10px] text-gray-500 font-bold">
                                            <Info size={12} className="shrink-0"/>
                                            押金 (Deposit) {formatMoney(analytics.costs.totalDeposits)} 不计入损益（属于资产，非费用）
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'SALES' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    {/* Daily Sales Breakdown - Horizontal Bars */}
                                    {analytics.dailySales.length > 0 && (
                                        <div className="bg-white p-5 md:p-6 rounded-[2rem] border border-gray-200 shadow-sm">
                                            <h4 className="font-black text-sm text-[#1A1A1A] mb-4 uppercase tracking-widest flex items-center gap-2"><BarChart3 size={16}/> 每日营收明细 (Daily Breakdown)</h4>
                                            <div className="space-y-2 max-h-[400px] overflow-y-auto touch-pan-y pr-1">
                                                {(() => {
                                                    const data = analytics.dailySales;
                                                    const maxVal = Math.max(...data.map(d => d.sales), 1);
                                                    return data.map((d, i) => {
                                                        const pct = (d.sales / maxVal) * 100;
                                                        const dayName = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                                                        const isToday = d.date === getTodayStr();
                                                        return (
                                                            <div key={i} className={`flex items-center gap-2 p-2 rounded-xl ${isToday ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}>
                                                                <span className={`text-[10px] font-mono w-14 shrink-0 ${isToday ? 'font-black text-blue-600' : 'text-gray-400 font-bold'}`}>{d.date.slice(5)}</span>
                                                                <span className="text-[9px] font-bold text-gray-400 w-8 shrink-0">{dayName}</span>
                                                                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div className={`h-full rounded-full transition-all duration-500 ${isToday ? 'bg-blue-500' : 'bg-blue-300'}`} style={{ width: `${pct}%` }}></div>
                                                                </div>
                                                                <span className={`text-[10px] font-mono font-black w-20 text-right shrink-0 ${isToday ? 'text-blue-600' : 'text-[#1A1A1A]'}`}>{formatMoney(d.sales)}</span>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm">
                                        <h4 className="font-black text-sm text-[#1A1A1A] mb-6 uppercase tracking-widest flex items-center gap-2"><Wallet size={16}/> 堂食收款方式 (In-Store Payment Methods)</h4>
                                        <div className="flex h-4 rounded-full overflow-hidden mb-4 bg-gray-100">
                                            <div className="bg-green-500 transition-all duration-1000" style={{ width: `${analytics.percentages.cash}%` }}></div>
                                            <div className="bg-blue-500 transition-all duration-1000" style={{ width: `${analytics.percentages.ewallet}%` }}></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold text-green-700 flex items-center gap-2"><Banknote size={14}/> Cash (现金)</span>
                                                    <span className="text-lg font-black text-green-800">{analytics.percentages.cash.toFixed(1)}%</span>
                                                </div>
                                                <div className="text-xl font-mono font-black text-[#1A1A1A]">{formatMoney(analytics.revenueDetails.cash)}</div>
                                            </div>
                                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold text-blue-700 flex items-center gap-2"><CreditCard size={14}/> Digital (Bank/QR)</span>
                                                    <span className="text-lg font-black text-blue-800">{analytics.percentages.ewallet.toFixed(1)}%</span>
                                                </div>
                                                <div className="text-xl font-mono font-black text-[#1A1A1A]">{formatMoney(analytics.revenueDetails.tng + analytics.revenueDetails.debitCard + analytics.revenueDetails.creditCard)}</div>
                                                <div className="mt-2 text-[10px] text-blue-600 space-y-0.5">
                                                    <div className="flex justify-between"><span>Debit Card:</span><span>{formatMoney(analytics.revenueDetails.debitCard)}</span></div>
                                                    <div className="flex justify-between"><span>Credit Card:</span><span>{formatMoney(analytics.revenueDetails.creditCard)}</span></div>
                                                    <div className="flex justify-between"><span>TNG eWallet:</span><span>{formatMoney(analytics.revenueDetails.tng)}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm">
                                        <h4 className="font-black text-sm text-[#1A1A1A] mb-4 uppercase tracking-widest flex items-center gap-2"><Truck size={16}/> 渠道分析 (Channels)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-white p-2 rounded-lg shadow-sm text-gray-600"><Truck size={18}/></div>
                                                    <span className="font-bold text-sm text-gray-700">Delivery Platforms</span>
                                                </div>
                                                <span className="font-mono font-black text-[#1A1A1A]">{formatMoney(analytics.revenueDetails.delivery)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-white p-2 rounded-lg shadow-sm text-gray-600"><ShoppingBag size={18}/></div>
                                                    <span className="font-bold text-sm text-gray-700">In-Store Sales</span>
                                                </div>
                                                <span className="font-mono font-black text-[#1A1A1A]">{formatMoney(analytics.revenueDetails.totalRevenue - analytics.revenueDetails.delivery)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'COST' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    {/* Accounting Mode Indicator */}
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold ${accountingMode === 'ACCRUAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-sky-50 text-sky-700 border border-sky-200'}`}>
                                        <Info size={12} className="shrink-0"/>
                                        {accountingMode === 'ACCRUAL' 
                                            ? '📋 权责发生制 — 费用含未付账单，按收货日归入。点击行项可查看付款状态。' 
                                            : '💰 收付实现制 — 仅显示已实际付款的费用。'}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <button onClick={() => handleDrillDown({ type: 'COGS' }, '销货成本 (COGS)')} className="bg-red-50 p-5 rounded-[2rem] border border-red-100 text-left hover:shadow-md transition-all active:scale-[0.98] group min-h-[120px]">
                                            <div className="flex justify-between items-center mb-2">
                                                <p className="text-[10px] font-bold text-red-600 uppercase">COGS (Cost of Goods)</p>
                                                <ChevronRight size={16} className="text-red-300 group-hover:text-red-500 transition-colors"/>
                                            </div>
                                            <p className="text-2xl font-black text-[#1A1A1A] font-mono">{formatMoney(analytics.costs.totalCOGS)}</p>
                                            <div className="mt-2 text-xs font-bold text-red-400">{analytics.margins.cogs.toFixed(1)}% of Sales</div>
                                        </button>
                                        
                                        <button onClick={() => handleDrillDown({ type: 'LABOR' }, '人工薪资 (Labor)')} className="bg-purple-50 p-5 rounded-[2rem] border border-purple-100 text-left hover:shadow-md transition-all active:scale-[0.98] group min-h-[120px]">
                                            <div className="flex justify-between items-center mb-2">
                                                <p className="text-[10px] font-bold text-purple-600 uppercase">Labor (人工薪资)</p>
                                                <ChevronRight size={16} className="text-purple-300 group-hover:text-purple-500 transition-colors"/>
                                            </div>
                                            <p className="text-2xl font-black text-[#1A1A1A] font-mono">{formatMoney(analytics.costs.totalLabor)}</p>
                                            <div className="mt-2 text-xs font-bold text-purple-400">{analytics.margins.labor.toFixed(1)}% of Sales</div>
                                        </button>

                                        <button onClick={() => handleDrillDown({ type: 'OPEX' }, '运营支出 (OPEX)')} className="bg-orange-50 p-5 rounded-[2rem] border border-orange-100 text-left hover:shadow-md transition-all active:scale-[0.98] group md:col-span-2 lg:col-span-1 min-h-[120px]">
                                            <div className="flex justify-between items-center mb-2">
                                                <p className="text-[10px] font-bold text-orange-600 uppercase">OPEX (运营支出)</p>
                                                <ChevronRight size={16} className="text-orange-300 group-hover:text-orange-500 transition-colors"/>
                                            </div>
                                            <p className="text-2xl font-black text-[#1A1A1A] font-mono">{formatMoney(analytics.costs.totalOPEX)}</p>
                                            <div className="mt-2 text-xs font-bold text-orange-400">{analytics.margins.opex.toFixed(1)}% of Sales</div>
                                        </button>
                                    </div>

                                    {analytics.fees.totalCommission > 0 && (
                                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 flex justify-between items-center text-xs text-yellow-800">
                                            <div className="flex items-center gap-2 font-bold"><AlertCircle size={14}/> Maybank Merchant Fees Included in OPEX</div>
                                            <div className="font-mono font-black">{formatMoney(analytics.fees.totalCommission)}</div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="bg-white p-6 rounded-[2rem] border border-gray-200">
                                            <h4 className="font-black text-sm text-[#1A1A1A] mb-4 uppercase tracking-widest border-b pb-2">COGS Breakdown (销货成本明细)</h4>
                                            <div className="space-y-2 max-h-80 overflow-y-auto touch-pan-y">
                                                {analytics.lists.cogsList.map((g: any) => (
                                                    <div 
                                                        key={g.id} 
                                                        onClick={() => handleDrillDown({ categoryId: g.id }, g.label)}
                                                        className="flex justify-between items-center text-sm font-bold p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group active:scale-[0.98]"
                                                    >
                                                        <span className="text-gray-500 group-hover:text-[#1A1A1A]">{g.label}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono">{formatMoney(g.amount)}</span>
                                                            <ChevronRight size={14} className="text-gray-300 group-hover:text-black"/>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="bg-white p-6 rounded-[2rem] border border-gray-200">
                                            <h4 className="font-black text-sm text-[#1A1A1A] mb-4 uppercase tracking-widest border-b pb-2">Labor & OPEX (人工与运营)</h4>
                                            <div className="space-y-2 max-h-80 overflow-y-auto touch-pan-y">
                                                <p className="text-[10px] font-black text-purple-600 uppercase mt-2 pl-2">Labor</p>
                                                <div 
                                                    onClick={() => handleDrillDown({ categoryId: 'STAFF_ADVANCE' }, '员工预支 (Staff Advance)')}
                                                    className="flex justify-between items-center text-sm font-bold pl-2 border-l-2 border-red-400 p-3 bg-red-50/50 hover:bg-red-100 cursor-pointer rounded-r-lg transition-colors group mb-1 active:scale-[0.98]"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <UserMinus size={14} className="text-red-500"/>
                                                        <span className="text-red-700">员工预支 (Staff Advance)</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-black text-red-700">
                                                            {formatMoney(analytics.lists.laborList.find((g:any)=>g.id==='STAFF_ADVANCE')?.amount || 0)}
                                                        </span>
                                                        <ChevronRight size={14} className="text-red-400"/>
                                                    </div>
                                                </div>

                                                {analytics.lists.laborList.filter((g:any) => g.id !== 'STAFF_ADVANCE').map((g: any) => (
                                                    <div 
                                                        key={g.id} 
                                                        onClick={() => handleDrillDown({ categoryId: g.id }, g.label)}
                                                        className={`flex justify-between items-center text-sm font-bold pl-2 border-l-2 p-3 cursor-pointer rounded-r-lg transition-colors group active:scale-[0.98] ${
                                                            g.isPending 
                                                                ? 'border-gray-200 text-gray-400 bg-gray-50/30 hover:bg-gray-50' 
                                                                : 'border-purple-100 hover:bg-purple-50/50'
                                                        }`}
                                                    >
                                                        <span className={g.isPending ? "italic" : "text-gray-500 group-hover:text-purple-900"}>{g.label}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono">{formatMoney(g.amount)}</span>
                                                            <ChevronRight size={14} className="text-gray-300 group-hover:text-purple-400"/>
                                                        </div>
                                                    </div>
                                                ))}
                                                <p className="text-[10px] font-black text-orange-600 uppercase mt-4 pl-2">OPEX</p>
                                                
                                                {analytics.fees.totalCommission > 0 && (
                                                    <div 
                                                        onClick={() => handleDrillDown({ categoryId: 'MBB_COMM' }, 'Maybank Commission (Auto-Calc)')}
                                                        className="flex justify-between items-center text-sm font-bold pl-2 border-l-2 border-yellow-400 p-3 bg-yellow-50 hover:bg-yellow-100 cursor-pointer rounded-r-lg transition-colors group mb-1 active:scale-[0.98]"
                                                    >
                                                        <span className="text-yellow-800">银行手续费 (Maybank Commission)</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono">{formatMoney(analytics.fees.totalCommission)}</span>
                                                            <ChevronRight size={14} className="text-yellow-600"/>
                                                        </div>
                                                    </div>
                                                )}

                                                {analytics.lists.opexList.map((g: any) => (
                                                    <div 
                                                        key={g.id} 
                                                        onClick={() => handleDrillDown({ categoryId: g.id }, g.label)}
                                                        className="flex justify-between items-center text-sm font-bold pl-2 border-l-2 border-orange-100 p-3 hover:bg-orange-50/50 cursor-pointer rounded-r-lg transition-colors group active:scale-[0.98]"
                                                    >
                                                        <span className="text-gray-500 group-hover:text-orange-900">{g.label}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono">{formatMoney(g.amount)}</span>
                                                            <ChevronRight size={14} className="text-gray-300 group-hover:text-orange-400"/>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'AUDIT' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="bg-gray-50/50 p-5 border-b border-gray-100 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-purple-100 text-purple-700 p-2 rounded-xl"><ListChecks size={20}/></div>
                                                <div>
                                                    <h3 className="font-black text-lg text-[#1A1A1A]">资金流水审计 (Cash Flow Audit)</h3>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Running Balance from Day 1</p>
                                                </div>
                                            </div>
                                            <div className="text-right bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-inner">
                                                <p className="text-[9px] text-gray-400 font-bold uppercase">Opening Balance</p>
                                                <p className="text-sm font-black font-mono text-green-700">{formatMoney(openingBalance)}</p>
                                            </div>
                                        </div>

                                        <div className="divide-y divide-gray-100">
                                            {auditTrail.length === 0 ? (
                                                <div className="p-20 text-center text-gray-400 text-sm font-bold italic">该时段无资金变动记录</div>
                                            ) : auditTrail.map((log, idx) => (
                                                <div key={idx} className="p-4 md:p-5 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shrink-0 ${
                                                            log.type === 'IN' ? 'bg-green-100 text-green-700' : 
                                                            log.type === 'OUT' ? 'bg-red-100 text-red-700' : 
                                                            'bg-blue-100 text-blue-700'
                                                        }`}>
                                                            {log.type}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-[#1A1A1A] text-sm truncate">{CATEGORY_LABELS[log.category] || log.category}</span>
                                                                <span className="text-[9px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{log.date}</span>
                                                            </div>
                                                            <div className="text-xs text-gray-500 font-medium mt-0.5 truncate max-w-[200px] md:max-w-md">{log.description}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className={`font-mono font-black text-sm md:text-base ${log.type === 'IN' ? 'text-green-600' : log.type === 'OUT' ? 'text-red-600' : 'text-blue-600'}`}>
                                                            {log.type === 'IN' ? '+' : log.type === 'OUT' ? '-' : '⇄'}{formatMoney(log.amount).replace('RM ','')}
                                                        </div>
                                                        <div className="text-[10px] font-mono font-bold text-gray-400 mt-1">
                                                            Bal: {formatMoney(log.balance).replace('RM ','')}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                             {activeTab === 'DIVIDEND' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="bg-[#1A1A1A] p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-10 rounded-full blur-3xl pointer-events-none"></div>
                                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                            <div>
                                                <h3 className="font-black text-xl flex items-center gap-2 text-[#FFD700]"><Briefcase size={24}/> 股东分红计算器</h3>
                                                <p className="text-xs text-white/60 mt-1">Dividend Distribution Planner</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Net Profit (本期净利)</p>
                                                <p className={`text-3xl font-black font-mono ${analytics.netProfit >= 0 ? 'text-white' : 'text-red-400'}`}>
                                                    {formatMoney(analytics.netProfit)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-8 bg-white/10 p-4 rounded-xl border border-white/10">
                                            <div className="flex justify-between text-xs font-bold mb-2">
                                                <span>Retained Earnings (留存收益): <span className="text-[#FFD700]">{retentionRate}%</span></span>
                                                <span>Distributable: {100 - retentionRate}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                step="5"
                                                value={retentionRate} 
                                                onChange={(e) => setRetentionRate(parseInt(e.target.value))}
                                                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#FFD700]"
                                            />
                                        </div>
                                    </div>

                                    {analytics.netProfit <= 0 ? (
                                        <div className="text-center py-20 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                                            <AlertCircle size={48} className="mx-auto text-gray-300 mb-4"/>
                                            <h3 className="text-lg font-black text-gray-400">本期亏损，无法分红</h3>
                                            <p className="text-xs text-gray-400">Net profit is negative or zero.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Company Retained (储备金)</p>
                                                <p className="text-3xl font-black text-blue-600 font-mono mb-4">
                                                    {formatMoney(analytics.netProfit * (retentionRate / 100))}
                                                </p>
                                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${retentionRate}%` }}></div>
                                                </div>
                                            </div>

                                            <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Distributable (可分配)</p>
                                                <p className="text-3xl font-black text-green-600 font-mono mb-4">
                                                    {formatMoney(analytics.netProfit * ((100 - retentionRate) / 100))}
                                                </p>
                                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-500" style={{ width: `${100 - retentionRate}%` }}></div>
                                                </div>
                                            </div>

                                            <div className="col-span-full">
                                                <h4 className="text-sm font-black text-[#1A1A1A] uppercase tracking-widest mb-4 ml-2 flex items-center gap-2">
                                                    <Users size={16}/> 股东分配明细 (Breakdown)
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {(treasuryConfig?.shareholders || []).map(sh => {
                                                        const distributableTotal = analytics.netProfit * ((100 - retentionRate) / 100);
                                                        const shareAmount = distributableTotal * (sh.equityPercentage / 100);
                                                        
                                                        return (
                                                            <div key={sh.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-[#FFD700] transition-all">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-500 text-sm border-2 border-white shadow-sm">
                                                                        {sh.name.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-sm text-[#1A1A1A]">{sh.name}</div>
                                                                        <div className="text-[10px] font-black text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded w-fit mt-0.5">{sh.equityPercentage}% Equity</div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-xs font-bold text-gray-400 uppercase">Payout</div>
                                                                    <div className="text-lg font-mono font-black text-[#1A1A1A]">{formatMoney(shareAmount)}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {(treasuryConfig?.shareholders || []).length === 0 && (
                                                        <div className="col-span-full text-center py-10 text-gray-400 text-xs italic">
                                                            暂无股东信息，请在资金管理模块设置。
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                             )}

                            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                                <div ref={printRef} className="w-[210mm] min-h-[297mm] bg-white p-12 font-sans text-black relative">
                                    <div className="flex justify-between items-start border-b-4 border-black pb-4 mb-8">
                                        <div>
                                            <h1 className="text-3xl font-black uppercase tracking-widest mb-1">Financial Report</h1>
                                            <p className="text-xs font-bold text-gray-500">KIM LIAN KEE (KEPONG)</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black uppercase">{startDate} to {endDate}</p>
                                            <p className="text-xs font-mono text-gray-400">Generated: {new Date().toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8 mb-8 border-b border-gray-200 pb-8">
                                        <div>
                                            <p className="text-xs font-black uppercase mb-2">REVENUE</p>
                                            <div className="flex justify-between text-sm mb-1"><span>Total Revenue</span><span className="font-mono font-bold">RM {Number(analytics.revenueDetails.totalRevenue || 0).toFixed(2)}</span></div>
                                            <div className="flex justify-between text-xs text-gray-500"><span>- Cash</span><span className="font-mono">RM {Number(analytics.revenueDetails.cash || 0).toFixed(2)}</span></div>
                                            <div className="flex justify-between text-xs text-gray-500"><span>- Digital/Card</span><span className="font-mono">RM {Number((analytics.revenueDetails.tng || 0) + (analytics.revenueDetails.creditCard || 0) + (analytics.revenueDetails.debitCard || 0)).toFixed(2)}</span></div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase mb-2">EXPENSES</p>
                                            <div className="flex justify-between text-sm mb-1"><span>Cost of Goods</span><span className="font-mono font-bold">RM {Number(analytics.costs.totalCOGS || 0).toFixed(2)}</span></div>
                                            <div className="flex justify-between text-sm mb-1"><span>Labor</span><span className="font-mono font-bold">RM {Number(analytics.costs.totalLabor || 0).toFixed(2)}</span></div>
                                            <div className="flex justify-between text-sm mb-1"><span>OPEX</span><span className="font-mono font-bold">RM {Number(analytics.costs.totalOPEX || 0).toFixed(2)}</span></div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-100 p-4 rounded mb-8">
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-black uppercase">Net Profit</span>
                                            <span className="text-2xl font-mono font-black">RM {Number(analytics.netProfit || 0).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <p className="text-xs font-black uppercase mb-4">Audit Trail Preview</p>
                                    <table className="w-full text-left text-[10px]">
                                        <thead className="bg-black text-white">
                                            <tr>
                                                <th className="p-2">Date</th>
                                                <th className="p-2">Category</th>
                                                <th className="p-2">Desc</th>
                                                <th className="p-2 text-right">Amount</th>
                                                <th className="p-2 text-right">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {auditTrail.slice(0, 30).map((row, i) => (
                                                <tr key={i} className="border-b border-gray-200">
                                                    <td className="p-2 font-mono">{row?.date}</td>
                                                    <td className="p-2 font-bold">{CATEGORY_LABELS[row?.category] || row?.category}</td>
                                                    <td className="p-2 truncate max-w-[200px]">{row?.description}</td>
                                                    <td className={`p-2 text-right font-mono ${row?.type === 'IN' ? 'text-green-600' : row?.type === 'OUT' ? 'text-red-600' : 'text-blue-600'}`}>{row?.type==='IN'?'+':row?.type==='OUT'?'-':'⇄'}{Number(row?.amount || 0).toFixed(2)}</td>
                                                    <td className="p-2 text-right font-mono text-gray-500">{Number(row?.balance || 0).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {detailView && (
                    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="font-black text-xl text-[#1A1A1A] flex items-center gap-2">
                                        <Receipt size={24} className="text-gray-400"/>
                                        {detailView?.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-widest">{detailView?.items?.length} Transactions found</p>
                                </div>
                                <button onClick={() => setDetailView(null)} className="p-2 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"><X size={24}/></button>
                            </div>
                            
                            <div className="flex-grow overflow-y-auto p-0 touch-pan-y">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-100 text-gray-500 font-bold text-xs uppercase sticky top-0 z-10 border-b border-gray-200">
                                        <tr>
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Description / Payee</th>
                                            <th className="p-4">Source</th>
                                            <th className="p-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {detailView?.items?.length === 0 ? (
                                            <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic">无相关记录</td></tr>
                                        ) : (
                                            detailView?.items?.map((item, idx) => (
                                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-4 font-mono text-gray-600 whitespace-nowrap">{item.date}</td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-[#1A1A1A]">{item.desc}</div>
                                                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{item.id}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${
                                                            item.source === 'Settlement' ? 'bg-orange-50 text-orange-700' :
                                                            item.source === 'Payroll' ? 'bg-purple-50 text-purple-700' :
                                                            item.source === 'Bill Payment' ? 'bg-blue-50 text-blue-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {item.source}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-mono font-black text-[#1A1A1A]">
                                                        RM {Number(item.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="p-4 bg-gray-50 border-t border-gray-200 text-right">
                                <span className="text-xs font-bold text-gray-500 uppercase mr-4">Total Selected</span>
                                <span className="text-xl font-black font-mono text-[#1A1A1A]">
                                    RM {Number(detailView?.items?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};