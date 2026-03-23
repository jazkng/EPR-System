import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Calendar, ArrowRight, PieChart, TrendingUp, Download, Loader2, ListChecks, Info, Users, HelpCircle, Receipt, UserMinus, Briefcase, Calculator, Wallet, Banknote, CreditCard, Truck, ShoppingBag, BarChart3, ChevronRight, AlertCircle, Percent, LayoutList, ChevronLeft, Table2, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SettlementRecord, ExpenseItem, BillPaymentRecord, FundTransfer, TreasuryConfig, PayrollRecord } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';
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
    documentLink?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    'INGREDIENT_HQ': '食材-总店 (HQ Ingredients)',
    'INGREDIENT_MEAT': '食材-肉类 (Meat)', 'INGREDIENT_SEAFOOD': '食材-海鲜 (Seafood)', 'INGREDIENT_VEG': '食材-蔬果 (Veg)',
    'INGREDIENT_DRY': '食材-干货 (Dry)', 'INGREDIENT_SAUCE': '食材-酱料 (Sauce)', 'INGREDIENT_NOODLE': '食材-面条 (Noodle)',
    'INGREDIENT_OIL': '食材-油类 (Oil)', 'INGREDIENT_EGG': '食材-蛋类 (Eggs)', 'INGREDIENT_FROZEN': '食材-冷冻品 (Frozen)',
    'BEVERAGE': '水吧原料 (Beverage)', 'PACKAGING': '包装材料 (Packaging)', 'GAS_COGS': '烹饪煤气 (Gas)',
    'SUPPLIER': '一般进货 (General)', 'SUPPLIER_HQ': '总店进货 (HQ)', 'SALARY': '薪资支出 (Salary)',
    'RENT': '租金 (Rent)', 'UTILITIES': '水电杂费 (Utilities)', 'UTILITIES_ELECTRIC': '电费 (Electricity)',
    'UTILITIES_WATER': '水费 (Water)', 'UTILITIES_GAS': '管道煤气 (Piped Gas)', 'INTERNET': '网络/电话 (Internet)',
    'SALES': '营业收入 (Sales)', 'TRANSFER': '资金转账 (Transfer)', 'BILL': '固定账单 (Bill)',
    'EXPENSE': '杂项支出 (Expense)', 'ADJUSTMENT': '现金调整 (Adjustment)', 'FUND': '资金注入/提取 (Fund)',
    'STAFF_ADVANCE': '员工预支 (Advance)', 'STAFF_MEAL': '员工餐 (Staff Meal)', 'STAFF_ACCOMMODATION': '员工住宿 (Housing)',
    'PAYROLL': '月度薪资 (Payroll)', 'EPF': '公积金 (EPF)', 'SOCSO': '社险 (SOCSO)',
    'RENOVATION': '装修 (Renovation)', 'EQUIPMENT': '设备 (Equipment)', 'KITCHEN_EQUIPMENT': '厨房设备 (Kitchen)',
    'FURNITURE': '家具/桌椅 (Furniture)', 'IT_SYSTEM': '电脑/系统 (IT/POS)', 'SIGNAGE': '招牌/装饰 (Signage)',
    'MAINTENANCE': '维修 (Maintenance)', 'PEST_CONTROL': '虫害防治 (Pest)', 'CLEANING': '清洁服务 (Cleaning)',
    'WASTE': '垃圾处理 (Waste)', 'MARKETING': '营销 (Marketing)', 'PROFESSIONAL': '专业服务 (Professional)',
    'ACCOUNTING': '会计服务 (Accounting)', 'INSURANCE': '保险 (Insurance)', 'LICENSE': '执照 (License)',
    'LOGISTICS': '物流 (Logistics)', 'TRANSPORT': '交通/油费 (Transport)', 'PRINTING': '印刷品 (Printing)',
    'MISC_OPEX': '其他杂费 (Misc)', 'MBB_COMM': '银行手续费 (Maybank)', 'BANK_FEE': '银行刷卡手续费 (Card MDR)', 'DIVIDEND': '股东分红 (Dividend)',
    'DEPOSIT': '押金 (Deposit)',
    'PLATFORM_FEE': '平台手续费 (Platform Fee)', 'PLATFORM_FEE_GRAB': 'Grab 手续费', 'PLATFORM_FEE_PANDA': 'FoodPanda 手续费', 'PLATFORM_FEE_SHOPEE': 'ShopeeFood 手续费', 'PLATFORM_FEE_OTHER': '其他平台手续费'
};

const categorizeExpense = (category: string) => {
    const c = category?.toUpperCase() || 'OTHER';
    if (c.includes('DEPOSIT')) return 'ASSET'; 
    if (['INGREDIENT', 'MEAT', 'SEAFOOD', 'VEG', 'DRY', 'SAUCE', 'NOODLE', 'OIL', 'EGG', 'FROZEN', 'BEVERAGE', 'PACKAGING', 'GAS_COGS', 'SUPPLIER', 'HQ'].some(k => c.includes(k))) return 'COGS';
    if (['SALARY', 'EPF', 'SOCSO', 'ADVANCE', 'COMMISSION', 'STAFF_ADVANCE', 'ALLOWANCE', 'PAYROLL', 'STAFF_MEAL', 'STAFF_ACCOMMODATION'].some(k => c.includes(k))) return 'LABOR';
    if (['EQUIPMENT', 'KITCHEN_EQUIPMENT', 'FURNITURE', 'RENOVATION', 'IT_SYSTEM', 'SIGNAGE'].some(k => c === k)) return 'CAPEX';
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
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`; 
    };
    
    const getTodayStr = () => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    
    const [startDate, setStartDate] = useState(getMonthStartStr()); 
    const [endDate, setEndDate] = useState(getTodayStr());
    
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SALES' | 'COST' | 'AUDIT' | 'DIVIDEND'>('OVERVIEW');
    const [accountingMode, setAccountingMode] = useState<'ACCRUAL' | 'CASH'>('ACCRUAL');
    const [retentionRate, setRetentionRate] = useState(20); 
    const [detailView, setDetailView] = useState<{ title: string, type: string, items: DetailedExpenseItem[] } | null>(null);
    const [showQuickDates, setShowQuickDates] = useState(false); // 控制手机端日期折叠的状态

    const handleMonthChange = (delta: number) => {
        const currentStart = new Date(startDate);
        currentStart.setMonth(currentStart.getMonth() + delta);
        const y = currentStart.getFullYear();
        const m = String(currentStart.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, currentStart.getMonth() + 1, 0).getDate();
        
        setStartDate(`${y}-${m}-01`);
        setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // 👑 修复 1: 加上 T23:59:59，确保选中月末最后一天晚上的所有数据不丢失！
                const endOfDay = `${endDate}T23:59:59`;

                // 👑 修复 2: 绕开 DataManager 的截断限制，使用带严格时间区间的查询。
                // 这样无论查多旧的报表都能查到，且绝不超额计费！
                const [config, payrolls, setSnap, billsSnap, fundsSnap, expSnap1, expSnap2] = await Promise.all([
                    DataManager.getTreasuryConfig(),
                    DataManager.getPayrollRecords(), // 薪水表每月只有1条，无所谓全拉
                    getDocs(query(collection(db, 'settlements'), where("date", ">=", startDate), where("date", "<=", endOfDay))),
                    getDocs(query(collection(db, 'bill_payments'), where("date", ">=", startDate), where("date", "<=", endOfDay))),
                    getDocs(query(collection(db, 'fund_transfers'), where("date", ">=", startDate), where("date", "<=", endOfDay))),
                    // 👑 修复 3: 双重查询，确保“在这个月创建的账”和“在这个月才付款的旧账”统统拉回来！
                    getDocs(query(collection(db, 'standalone_expenses'), where("time", ">=", startDate), where("time", "<=", endOfDay))),
                    getDocs(query(collection(db, 'standalone_expenses'), where("paymentDate", ">=", startDate), where("paymentDate", "<=", endOfDay)))
                ]);

                // 组装并去重 Expenses
                const expMap = new Map();
                expSnap1.docs.forEach(d => expMap.set(d.id, { id: d.id, ...d.data() }));
                expSnap2.docs.forEach(d => expMap.set(d.id, { id: d.id, ...d.data() }));
                const mergedExpenses = Array.from(expMap.values()) as ExpenseItem[];

                setSettlementRecords(setSnap.docs.map(d => ({ id: d.id, ...d.data() } as SettlementRecord)));
                setStandaloneExpenses(mergedExpenses);
                setBillPayments(billsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BillPaymentRecord)));
                setTransfers(fundsSnap.docs.map(d => ({ id: d.id, ...d.data() } as FundTransfer)));
                
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
    }, [startDate, endDate]);

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
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
            cash: 0, tng: 0, debitCard: 0, creditCard: 0, amex: 0, delivery: 0, totalRevenue: 0, variance: 0, refunds: 0 
        };
        
        const deliveryBreakdown = { grab: 0, panda: 0, shopee: 0, lalamove: 0 };

        const deliveryRecon: Record<string, { gross: number, net: number, reconDays: number, totalDays: number }> = {
            grab: { gross: 0, net: 0, reconDays: 0, totalDays: 0 },
            panda: { gross: 0, net: 0, reconDays: 0, totalDays: 0 },
            shopee: { gross: 0, net: 0, reconDays: 0, totalDays: 0 },
        };

        let totalCOGS = 0, totalLabor = 0, totalOPEX = 0, totalDeposits = 0, totalCapex = 0;
        const groups: Record<string, CostGroup> = {};

        const addCost = (amount: number, category: string, label?: string, isPending: boolean = false) => {
            if (!amount && !isPending) return; 
            
            const catKey = category ? category.toUpperCase() : 'OTHER';
            const type = categorizeExpense(catKey);

            if (type === 'ASSET') {
                totalDeposits += amount;
                if (!groups[catKey]) groups[catKey] = { id: catKey, label: label || CATEGORY_LABELS[catKey] || '押金 (Deposit)', amount: 0, type, isPending };
                groups[catKey].amount += amount;
                return;
            }
            if (type === 'CAPEX') {
                totalCapex += amount;
                if (!groups[catKey]) groups[catKey] = { id: catKey, label: label || CATEGORY_LABELS[catKey] || catKey, amount: 0, type, isPending };
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

        const dailySalesMap: Record<string, number> = {};
        const dailyExpenseMap: Record<string, number> = {};

        settlementRecords.filter(s => isInRange(s.date)).forEach(s => {
            const cashAmt = Number(s.sales?.cash || 0);
            const tngAmt = Number(s.sales?.tng || 0);
            const duitnowAmt = Number(s.sales?.duitnow || 0);
            const cardAmt = Number(s.sales?.card || 0);
            const amexAmt = Number(s.sales?.amex || 0);
            const varianceAmt = Number(s.variance || 0);

            let deliveryAmt = 0;
            if (s.sales?.deliveryBreakdown) {
                const bdown = s.sales.deliveryBreakdown as any;
                const g = (Number(bdown.grabGross) || Number(bdown.grab) || 0);
                const p = (Number(bdown.pandaGross) || Number(bdown.panda) || 0);
                const sh = (Number(bdown.shopeeGross) || Number(bdown.shopee) || 0);
                const l = (Number(bdown.lalamove) || 0);
                
                deliveryBreakdown.grab += g;
                deliveryBreakdown.panda += p;
                deliveryBreakdown.shopee += sh;
                deliveryBreakdown.lalamove += l;
                deliveryAmt += (g + p + sh + l);

                const rs = (s as any).reconStatus || {};
                
                // Grab
                if (g > 0) {
                    deliveryRecon.grab.gross += g;
                    deliveryRecon.grab.totalDays += 1;
                    if (typeof rs.grab === 'number') {
                        deliveryRecon.grab.net += rs.grab;
                        deliveryRecon.grab.reconDays += 1;
                    } else if (rs.grab === true) {
                        deliveryRecon.grab.net += g;
                        deliveryRecon.grab.reconDays += 1;
                    }
                }
                // FoodPanda
                if (p > 0) {
                    deliveryRecon.panda.gross += p;
                    deliveryRecon.panda.totalDays += 1;
                    if (typeof rs.panda === 'number') {
                        deliveryRecon.panda.net += rs.panda;
                        deliveryRecon.panda.reconDays += 1;
                    } else if (rs.panda === true) {
                        deliveryRecon.panda.net += p;
                        deliveryRecon.panda.reconDays += 1;
                    }
                }
                // ShopeeFood
                if (sh > 0) {
                    deliveryRecon.shopee.gross += sh;
                    deliveryRecon.shopee.totalDays += 1;
                    if (typeof rs.shopee === 'number') {
                        deliveryRecon.shopee.net += rs.shopee;
                        deliveryRecon.shopee.reconDays += 1;
                    } else if (rs.shopee === true) {
                        deliveryRecon.shopee.net += sh;
                        deliveryRecon.shopee.reconDays += 1;
                    }
                }
            }

            const posSales = cashAmt + tngAmt + duitnowAmt + cardAmt + amexAmt;
            const refundAmt = Number(s.sales?.refundTotal || 0);
            
            const netStoreSales = posSales - refundAmt;
            revenueDetails.totalRevenue += netStoreSales + deliveryAmt;
            revenueDetails.cash += cashAmt;
            revenueDetails.tng += tngAmt; 
            revenueDetails.debitCard += duitnowAmt;
            revenueDetails.creditCard += cardAmt;
            revenueDetails.amex += amexAmt;
            revenueDetails.delivery += deliveryAmt;
            revenueDetails.variance += varianceAmt;
            revenueDetails.refunds += refundAmt;

            const dStr = s.date.split('T')[0];
            dailySalesMap[dStr] = (dailySalesMap[dStr] || 0) + netStoreSales + deliveryAmt;
            
            let dayExp = 0;
            s.expenses?.forEach(e => {
                const amt = Number(e.amount || 0);
                addCost(amt, e.category);
                dayExp += amt;
            });
            dailyExpenseMap[dStr] = (dailyExpenseMap[dStr] || 0) + dayExp;
        });

        standaloneExpenses.forEach(e => {
            if (e.id.startsWith('payroll_') || e.category === 'PAYROLL') return;
            if (e.id.startsWith('salary_')) return; 
            if (e.settlementId) return; 

            if (accountingMode === 'ACCRUAL') {
                if (!isInRange(e.time)) return;
                const fullCost = Number(e.totalBillAmount || e.amount || 0) - Number(e.creditNote || 0);
                if (fullCost > 0) addCost(fullCost, e.category);
            } else {
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

        const payrollSummary = {
            monthlyTotal: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            staffCount: 0,
            months: [] as string[]
        };

        payrollRecords.forEach(p => {
            const effectiveDate = `${p.month}-28`;
            if (effectiveDate >= startDate && effectiveDate <= endDate && p.status === 'POSTED') {
                const netPay = Number(p.totalNetPay || 0);
                const govtPay = Number(p.totalGovtPay || 0);
                payrollSummary.monthlyTotal += (netPay + govtPay);
                payrollSummary.staffCount = Math.max(payrollSummary.staffCount, Number(p.staffCount || 0));
                if (!payrollSummary.months.includes(p.month)) payrollSummary.months.push(p.month);

                payrollSummary.paidAmount += netPay;
                if (p.isStatutoryPaid) {
                    payrollSummary.paidAmount += govtPay;
                } else {
                    payrollSummary.unpaidAmount += govtPay;
                }
            }
        });

        // 🏦 银行刷卡手续费 vs 平台手续费：彻底分开
        const BANK_FEE_KEYS = ['BANK_FEE', 'MBB_COMM'];
        const PLATFORM_FEE_KEYS = ['PLATFORM_FEE', 'PLATFORM_FEE_GRAB', 'PLATFORM_FEE_PANDA', 'PLATFORM_FEE_SHOPEE', 'PLATFORM_FEE_OTHER'];
        
        const bankFeeList = Object.values(groups).filter(g => BANK_FEE_KEYS.includes(g.id));
        const totalBankFees = bankFeeList.reduce((sum, g) => sum + g.amount, 0);
        
        const platformFeeList = Object.values(groups).filter(g => PLATFORM_FEE_KEYS.includes(g.id));
        const totalPlatformFees = platformFeeList.reduce((sum, g) => sum + g.amount, 0);

        const totalPaymentMethodVolume = revenueDetails.cash + revenueDetails.tng + revenueDetails.debitCard + revenueDetails.creditCard + revenueDetails.amex;
        const cashPercentage = totalPaymentMethodVolume > 0 ? (revenueDetails.cash / totalPaymentMethodVolume) * 100 : 0;
        const ewalletPercentage = totalPaymentMethodVolume > 0 ? ((revenueDetails.tng + revenueDetails.debitCard + revenueDetails.creditCard + revenueDetails.amex) / totalPaymentMethodVolume) * 100 : 0;

        const totalExpenses = totalCOGS + totalLabor + totalOPEX;
        const grossProfit = revenueDetails.totalRevenue - totalCOGS;
        const netProfit = grossProfit - (totalLabor + totalOPEX);
        const adjustedNetProfit = netProfit + revenueDetails.variance;
        const netCashFlow = adjustedNetProfit - totalCapex; 

        const cogsMargin = revenueDetails.totalRevenue > 0 ? (totalCOGS / revenueDetails.totalRevenue) * 100 : 0;
        const laborMargin = revenueDetails.totalRevenue > 0 ? (totalLabor / revenueDetails.totalRevenue) * 100 : 0;
        const opexMargin = revenueDetails.totalRevenue > 0 ? (totalOPEX / revenueDetails.totalRevenue) * 100 : 0;
        const netMargin = revenueDetails.totalRevenue > 0 ? (netProfit / revenueDetails.totalRevenue) * 100 : 0;

        const dailySales = Object.entries(dailySalesMap)
            .map(([date, sales]) => ({ date, sales, expenses: dailyExpenseMap[date] || 0 }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const settlementCount = settlementRecords.filter(s => isInRange(s.date)).length;
        const avgDailySales = settlementCount > 0 ? revenueDetails.totalRevenue / settlementCount : 0;

        // 🔴 剥离计算外卖宏观数据 (Macro Delivery Data - 仅计算已核销的天数)
        let macroGross = 0;
        let macroNet = 0;
        let macroCommission = 0;
        (['grab', 'panda', 'shopee'] as const).forEach(plat => {
            const r = deliveryRecon[plat];
            if (r.reconDays > 0) {
                macroGross += r.gross;
                macroNet += r.net;
                macroCommission += (r.gross - r.net);
            }
        });
        const macroCommissionRate = macroGross > 0 ? (macroCommission / macroGross) * 100 : 0;
        const deliveryMacro = { gross: macroGross, net: macroNet, commission: macroCommission, rate: macroCommissionRate };

        return {
            revenueDetails, deliveryBreakdown, deliveryRecon, payrollSummary, deliveryMacro,
            bankFees: { total: totalBankFees, list: bankFeeList },
            platformFees: { total: totalPlatformFees, list: platformFeeList },
            percentages: { cash: cashPercentage, ewallet: ewalletPercentage },
            grossProfit, netProfit, adjustedNetProfit, netCashFlow, netMargin,
            costs: { totalCOGS, totalLabor, totalOPEX, totalExpenses, totalDeposits, totalCapex },
            margins: { cogs: cogsMargin, labor: laborMargin, opex: opexMargin },
            lists: {
                cogsList: Object.values(groups).filter(g => g.type === 'COGS').sort((a,b) => b.amount - a.amount),
                laborList: Object.values(groups).filter(g => g.type === 'LABOR').sort((a,b) => b.amount - a.amount),
                opexList: Object.values(groups).filter(g => g.type === 'OPEX').sort((a,b) => b.amount - a.amount),
                capexList: Object.values(groups).filter(g => g.type === 'CAPEX').sort((a,b) => b.amount - a.amount),
                depositList: Object.values(groups).filter(g => g.type === 'ASSET').sort((a,b) => b.amount - a.amount)
            },
            dailySales, avgDailySales, settlementCount
        };
    }, [settlementRecords, standaloneExpenses, billPayments, payrollRecords, startDate, endDate, accountingMode]);

    const getDrillDownData = (criteria: { type?: string, categoryId?: string }) => {
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
                addItem({ id: `${s.id}_${idx}`, date: s.date.split('T')[0], category: e.category, desc: `${e.company || 'Petty Cash'} (from Daily Settlement)`, amount: Number(e.amount || 0), source: 'Settlement', type: '', documentLink: (e as any).documentLink || (e as any).receiptUrl || '' });
            });
        });

        standaloneExpenses.forEach(e => {
            if (e.id.startsWith('payroll_') || e.category === 'PAYROLL') return;
            if (e.id.startsWith('salary_')) return;
            if (e.settlementId) return;

            const docLink = (e as any).documentLink || (e as any).receiptUrl || (e as any).link || (e as any).fileUrl || '';

            if (accountingMode === 'ACCRUAL') {
                if (!isInRange(e.time)) return;
                const fullCost = Number(e.totalBillAmount || e.amount || 0) - Number(e.creditNote || 0);
                const statusTag = e.paymentStatus === 'PAID' ? '' : e.paymentStatus === 'PARTIAL' ? ' [部分付款]' : ' [未付款]';
                addItem({ id: e.id, date: e.time.split('T')[0], category: e.category, desc: e.company + (e.note ? ` - ${e.note}` : '') + statusTag, amount: fullCost, source: 'AP/Voucher', type: '', documentLink: docLink });
            } else {
                if (e.paymentStatus !== 'PAID' && e.paymentStatus !== 'PARTIAL') return;
                const effectiveDate = e.paymentDate || e.time;
                if (!isInRange(effectiveDate)) return;
                const paidAmt = Number(e.amount || 0) - Number(e.creditNote || 0);
                addItem({ id: e.id, date: (effectiveDate).split('T')[0], category: e.category, desc: e.company + (e.note ? ` - ${e.note}` : ''), amount: paidAmt, source: 'AP/Voucher', type: '', documentLink: docLink });
            }
        });

        billPayments.filter(b => isInRange(b.date)).forEach(b => {
            addItem({ id: b.id, date: b.date, category: b.category, desc: b.name, amount: Number(b.amount || 0), source: 'Bill Payment', type: '', documentLink: (b as any).documentLink || (b as any).receiptUrl || '' });
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

        return rawItems.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };
    
    const handleDrillDown = (criteria: { type?: string, categoryId?: string }, title: string) => {
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
                    allTransactions.push({ id: `cash_${s.id}`, date: s.date.split('T')[0], time: s.timestamp || `${s.date.split('T')[0]}T12:00:00`, type: actualCash > 0 ? 'IN' : 'OUT', category: 'SALES', description: 'Cash Sales (Net)', amount: Math.abs(actualCash), account: 'CASH' });
                }

                const bankIncome = Number(s.sales?.tng || 0) + Number(s.sales?.duitnow || 0) + Number(s.sales?.card || 0) + Number(s.sales?.amex || 0);
                const bdown2 = s.sales?.deliveryBreakdown as any;
                const delivery = bdown2 ? 
                    ((Number(bdown2.grabGross) || Number(bdown2.grab) || 0) + 
                     (Number(bdown2.pandaGross) || Number(bdown2.panda) || 0) + 
                     (Number(bdown2.shopeeGross) || Number(bdown2.shopee) || 0) + 
                     (Number(bdown2.lalamove) || 0))
                    : 0;
                
                if (bankIncome + delivery > 0) {
                    allTransactions.push({ id: `bank_${s.id}`, date: s.date.split('T')[0], time: s.timestamp || `${s.date.split('T')[0]}T12:00:00`, type: 'IN', category: 'SALES', description: 'Digital/Delivery Sales', amount: bankIncome + delivery, account: 'BANK' });
                }
                
                s.expenses?.forEach((e, idx) => { 
                    allTransactions.push({ id: `${s.id}_e_${idx}`, date: s.date.split('T')[0], time: s.timestamp || `${s.date.split('T')[0]}T12:00:00`, type: 'OUT', category: e.category, description: `Petty: ${e.company || ''}`, amount: Number(e.amount || 0), account: 'CASH' }); 
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

        transfers.forEach(t => {
            const dateStr = t.date.split('T')[0];
            if (dateStr < configStart) return;

            if (t.fromAccount === 'SHAREHOLDER' as any || t.fromAccount === 'OTHER' as any) {
                allTransactions.push({ 
                    id: t.id, date: dateStr, time: t.date, type: 'IN', category: 'FUND', description: t.note || 'Injection / Extra Income', amount: Number(t.amount || 0), account: t.toAccount 
                });
            } else {
                allTransactions.push({ 
                    id: `trf_out_${t.id}`, date: dateStr, time: t.date, type: 'TRANSFER', category: 'TRANSFER', description: `${t.fromAccount} → ${t.toAccount}${t.note ? ` (${t.note})` : ''}`, amount: Number(t.amount || 0), account: t.fromAccount 
                });
            }
        });

        allTransactions.sort((a, b) => new Date(a.time || a.date).getTime() - new Date(b.time || b.date).getTime());
        
        const displayItems: AuditLogItem[] = [];
        let periodNetFlow = 0; 

        allTransactions.forEach(t => {
            if (t.date >= startDate && t.date <= endDate) {
                if (t.type === 'IN') periodNetFlow += t.amount; 
                else if (t.type === 'OUT') periodNetFlow -= t.amount;
                
                displayItems.push({ ...t, balance: periodNetFlow }); 
            }
        });

        return { auditTrail: displayItems.reverse(), openingBalance: 0 };
    }, [settlementRecords, standaloneExpenses, billPayments, transfers, treasuryConfig, startDate, endDate]);

    const formatMoney = (amount: number) => `RM ${Number(amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    const handleExportCSV = () => {
        const rev = analytics.revenueDetails;
        const cost = analytics.costs;
        const bdown = analytics.deliveryBreakdown;

        const rows = [
            ['KIM LIAN KEE - 财务核算报表 (Financial Report)'],
            ['期间 (Period)', `${startDate} to ${endDate}`],
            ['核算模式 (Mode)', accountingMode === 'ACCRUAL' ? '权责发生制 (Accrual)' : '收付实现制 (Cash Basis)'],
            [],
            ['【 1. 营收明细 REVENUE 】', '金额 (RM)'],
            ['总营业额 (Total Revenue)', rev.totalRevenue.toFixed(2)],
            ['堂食现金 (Cash Sales)', rev.cash.toFixed(2)],
            ['电子/刷卡 (Digital/Card)', (rev.tng + rev.debitCard + rev.creditCard + rev.amex).toFixed(2)],
            [' - TNG eWallet', rev.tng.toFixed(2)],
            [' - Debit Card', rev.debitCard.toFixed(2)],
            [' - Credit Card', rev.creditCard.toFixed(2)],
            [' - Amex', rev.amex.toFixed(2)],
            ['总外卖流水 (Total Delivery)', rev.delivery.toFixed(2)],
            [' - GrabFood', bdown.grab.toFixed(2)],
            [' - FoodPanda', bdown.panda.toFixed(2)],
            [' - ShopeeFood', bdown.shopee.toFixed(2)],
            [' - Lalamove', bdown.lalamove.toFixed(2)],
            ['退款金额 (Refunds)', rev.refunds.toFixed(2)],
            ['现金盘点差异 (Variance)', rev.variance.toFixed(2)],
            [],
            ['【 2. 支出明细 EXPENSES 】', '金额 (RM)', '占营收比例 (%)'],
            ['销货成本 (Total COGS)', cost.totalCOGS.toFixed(2), analytics.margins.cogs.toFixed(2) + '%'],
            ['人工成本 (Total Labor)', cost.totalLabor.toFixed(2), analytics.margins.labor.toFixed(2) + '%'],
            ['运营杂费 (Total OPEX)', cost.totalOPEX.toFixed(2), analytics.margins.opex.toFixed(2) + '%'],
            ['资本支出 (CAPEX - 资产)', cost.totalCapex.toFixed(2), '-'],
            ['押金流出 (Deposits - 资产)', cost.totalDeposits.toFixed(2), '-'],
            [],
            ['【 3. 核心利润指标 KPI 】', '金额 (RM)', '利润率 (%)'],
            ['毛利润 (Gross Profit)', analytics.grossProfit.toFixed(2), (rev.totalRevenue ? (analytics.grossProfit / rev.totalRevenue * 100) : 0).toFixed(2) + '%'],
            ['经营净利 (Net Profit)', analytics.netProfit.toFixed(2), analytics.netMargin.toFixed(2) + '%'],
            ['含差异实际净利 (Adj. Net Profit)', analytics.adjustedNetProfit.toFixed(2), '-'],
            ['真实可用现金流 (Net Cash Flow)', analytics.netCashFlow.toFixed(2), '-'],
        ];

        const csvContent = rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Financial_Report_${startDate}_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPDF = async () => {
        if (!printRef.current) return;
        setIsExporting(true);
        try {
            await new Promise(r => setTimeout(r, 800));
            const canvas = await html2canvas(printRef.current, { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: '#ffffff',
                windowWidth: 1000
            });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            let heightLeft = pdfHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - pdfHeight; 
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`Financial_Report_${startDate}_to_${endDate}.pdf`);
        } catch (e) { 
            console.error(e);
            alert("Export failed"); 
        } finally { 
            setIsExporting(false); 
        }
    };

    // 🟢 外卖平台颜色配置
    const PLATFORM_COLORS: Record<string, { bg: string, text: string, border: string, label: string }> = {
        grab: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'GrabFood' },
        panda: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', label: 'FoodPanda' },
        shopee: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'ShopeeFood' },
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-[#F5F7FA] w-full h-full md:w-[95vw] md:h-[92vh] lg:max-w-7xl md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl relative font-sans">
                
                <div className="bg-[#1A1A1A] px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] md:px-5 md:pb-5 md:pt-[max(env(safe-area-inset-top),1.25rem)] flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700]">
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <div className="bg-[#FFD700] text-black p-2 md:p-2.5 rounded-xl shadow-lg shrink-0"><PieChart size={20} className="md:w-6 md:h-6"/></div>
                        <div className="min-w-0">
                            <h3 className="font-serif font-black text-base md:text-xl tracking-wide truncate">财务审计报表</h3>
                            <p className="text-[9px] md:text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">FINANCIAL INTELLIGENCE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                        <button onClick={handleExportCSV} className="bg-[#1A1A1A] hover:bg-black text-[#FFD700] px-3 md:px-4 py-2 rounded-xl text-[10px] md:text-xs font-black items-center gap-2 shadow-lg transition-all active:scale-95 border border-[#FFD700]/30 hidden sm:flex">
                            <Table2 size={16}/> 导出 Excel (CSV)
                        </button>
                        <button onClick={handleExportPDF} disabled={isExporting} className="bg-white/10 hover:bg-white/20 text-white px-2.5 md:px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold flex items-center gap-1.5 md:gap-2 transition-all active:scale-95">
                            {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} <span className="hidden sm:inline">导出</span> PDF
                        </button>
                        <button onClick={onClose} className="w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors active:scale-95 -mr-1"><X size={24}/></button>
                    </div>
                </div>

                <div className="bg-white border-b border-gray-200 p-3 md:p-4 flex flex-col md:flex-row gap-3 md:gap-4 shrink-0 shadow-sm z-10 touch-manipulation items-center justify-between">
                    
                    <div className="flex items-center bg-[#1A1A1A] rounded-xl p-1 shadow-inner border border-gray-800 w-full md:w-auto justify-between md:justify-start">
                        <button onClick={() => handleMonthChange(-1)} className="p-2 text-gray-400 hover:text-[#FFD700] hover:bg-white/10 rounded-lg transition-colors active:scale-95"><ChevronLeft size={18} /></button>
                        <div className="flex flex-col items-center px-4 md:px-6">
                            <div className="flex items-center gap-2 text-[#FFD700]">
                                <Calendar size={14} />
                                <span className="font-black text-sm tracking-wider uppercase">{new Date(startDate).toLocaleString('en-US', { month: 'short', year: 'numeric' })}</span>
                            </div>
                            <span className="text-[9px] text-gray-500 font-mono mt-0.5">{startDate} ~ {endDate}</span>
                        </div>
                        <button onClick={() => handleMonthChange(1)} className="p-2 text-gray-400 hover:text-[#FFD700] hover:bg-white/10 rounded-lg transition-colors active:scale-95"><ChevronRight size={18} /></button>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4 w-full md:w-auto">
                        
                        {/* 手机端第一行：日期输入框 + 展开按钮 */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 sm:gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1.5 sm:p-2 px-2 sm:px-3 flex-grow md:flex-grow-0 justify-center">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-[11px] sm:text-xs font-bold outline-none w-full min-w-[90px] cursor-pointer text-center text-gray-600"/>
                                <ArrowRight size={12} className="text-gray-300 shrink-0"/>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-[11px] sm:text-xs font-bold outline-none w-full min-w-[90px] cursor-pointer text-center text-gray-600"/>
                            </div>
                            <button 
                                onClick={() => setShowQuickDates(!showQuickDates)} 
                                className={`md:hidden px-3 py-2 rounded-xl border transition-all shrink-0 text-[11px] font-black tracking-widest ${showQuickDates ? 'bg-[#1A1A1A] text-[#FFD700] border-[#1A1A1A]' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}
                            >
                                快捷
                            </button>
                        </div>
                        
                        {/* 手机端第二行：快捷按钮 (默认折叠隐藏，展开时变 3列 网格防挤压) */}
                        <div className={`${showQuickDates ? 'grid grid-cols-3' : 'hidden'} md:flex gap-1.5 md:gap-1 bg-gray-100 p-1.5 md:p-1 rounded-xl md:overflow-x-auto w-full md:w-auto scrollbar-hide border border-gray-200/50 animate-in slide-in-from-top-2 md:animate-none`}>
                            {[
                                { key: 'YESTERDAY', label: '昨日' },
                                { key: 'TODAY', label: '今日' },
                                { key: 'WEEK', label: '本周' },
                                { key: 'MONTH', label: '本月' },
                                { key: 'LAST_MONTH', label: '上月' }
                            ].map(t => (
                                <button 
                                    key={t.key} 
                                    onClick={() => { setQuickDate(t.key as any); setShowQuickDates(false); }} 
                                    className="flex-1 md:flex-none px-2 py-2 md:py-1.5 bg-white shadow-sm rounded-lg text-[10px] font-bold text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-50 transition-colors whitespace-nowrap active:scale-95 text-center truncate"
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white border-b border-gray-200 px-3 md:px-4 py-2 shrink-0">
                    <div className="flex bg-[#E2E8F0]/60 p-1 md:p-1.5 rounded-2xl w-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] border border-gray-200">
                        {[
                            { id: 'OVERVIEW', label: '损益', en: 'P&L', icon: LayoutList },
                            { id: 'SALES', label: '营收', en: 'Sales', icon: TrendingUp },
                            { id: 'COST', label: '成本', en: 'Cost', icon: PieChart },
                            { id: 'AUDIT', label: '审计', en: 'Audit', icon: ListChecks },
                            { id: 'DIVIDEND', label: '分红', en: 'Dividend', icon: Percent }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)} 
                                    className={`group flex-1 py-1.5 md:py-2.5 rounded-xl transition-all duration-300 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 active:scale-95 relative overflow-hidden ${
                                        isActive 
                                            ? 'bg-[#1A1A1A] text-[#FFD700] shadow-[0_4px_12px_rgba(0,0,0,0.15)] ring-1 ring-black/50' 
                                            : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-white/80'
                                    }`}
                                >
                                    {isActive && (<div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFD700]/20 to-transparent opacity-50 translate-x-[-100%] animate-[pulse_2s_infinite]"></div>)}
                                    <Icon className={`relative z-10 transition-transform duration-300 w-4 h-4 md:w-[18px] md:h-[18px] shrink-0 ${isActive ? 'text-[#FFD700] scale-110' : 'text-gray-400 group-hover:text-gray-600'}`}/> 
                                    <div className="relative z-10 flex flex-col lg:flex-row items-center lg:gap-1 leading-none mt-0.5 md:mt-0">
                                        <span className="text-[10px] md:text-sm font-black tracking-tighter md:tracking-wide whitespace-nowrap truncate">{tab.label}</span>
                                        <span className="hidden lg:inline-block font-mono text-[10px] opacity-70 ml-1">({tab.en})</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    
                    {(activeTab === 'OVERVIEW' || activeTab === 'COST' || activeTab === 'DIVIDEND') && (
                        <div className="flex items-center justify-between bg-gray-50/80 border-t border-gray-100 px-2 md:px-4 pt-3 pb-1 mt-2 -mx-3 md:mx-0">
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <HelpCircle size={13} className="text-gray-400 shrink-0"/>
                                <span className="text-[9px] md:text-[10px] text-gray-500 font-bold leading-tight">
                                    {accountingMode === 'ACCRUAL' ? '权责发生制 (含未付账单)' : '收付实现制 (仅计已付)'}
                                </span>
                            </div>
                            <div className="flex bg-white border border-gray-200 rounded-lg p-0.5 shrink-0 ml-2">
                                <button onClick={() => setAccountingMode('ACCRUAL')} className={`px-2 md:px-3 py-1 md:py-1.5 rounded-md text-[9px] md:text-[10px] font-black transition-all whitespace-nowrap ${accountingMode === 'ACCRUAL' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>权责发生</button>
                                <button onClick={() => setAccountingMode('CASH')} className={`px-2 md:px-3 py-1 md:py-1.5 rounded-md text-[9px] md:text-[10px] font-black transition-all whitespace-nowrap ${accountingMode === 'CASH' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>收付实现</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 🛡️ 注入 iOS 底部安全区 pb-[calc(2rem+env(safe-area-inset-bottom))] 防遮挡 */}
                <div className="flex-grow overflow-y-auto p-3 sm:p-4 md:p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] bg-[#F5F7FA] touch-pan-y">
                    {loading ? (
                        <div className="flex items-center justify-center h-40"><Loader2 size={32} className="animate-spin text-gray-400"/></div>
                    ) : (
                        <div className="max-w-7xl mx-auto">
                            
                            {activeTab === 'OVERVIEW' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold ${accountingMode === 'ACCRUAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-sky-50 text-sky-700 border border-sky-200'}`}>
                                        <Info size={12} className="shrink-0"/>
                                        {accountingMode === 'ACCRUAL' 
                                            ? '📋 权责发生制 (Accrual) — 成本按入账/收货日计算，包含未付款账单。利润反映真实经营状况。' 
                                            : '💰 收付实现制 (Cash Basis) — 成本按实际付款日计算，仅含已付金额。数据与资金管理同步。'}
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                        <div className="bg-blue-50 p-3.5 sm:p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden group">
                                            <p className="text-[9px] md:text-[10px] font-bold text-blue-600 uppercase mb-1 tracking-tighter md:tracking-wider relative z-10 whitespace-nowrap truncate">总营收 (Revenue)</p>
                                            <p className="text-lg sm:text-xl md:text-2xl font-black text-blue-900 font-mono relative z-10 tracking-tighter">{formatMoney(analytics.revenueDetails.totalRevenue)}</p>
                                            <p className="text-[9px] text-blue-500 font-bold mt-1 relative z-10 whitespace-nowrap truncate">{analytics.settlementCount}天 · 日均 {formatMoney(analytics.avgDailySales)}</p>
                                        </div>
                                        <div className="bg-red-50 p-3.5 sm:p-5 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden group">
                                            <p className="text-[9px] md:text-[10px] font-bold text-red-600 uppercase mb-1 tracking-tighter md:tracking-wider relative z-10 whitespace-nowrap truncate">总支出 (Expenses)</p>
                                            <p className="text-lg sm:text-xl md:text-2xl font-black text-red-900 font-mono relative z-10 tracking-tighter">{formatMoney(analytics.costs.totalExpenses)}</p>
                                            <p className="text-[9px] text-red-400 font-bold mt-1 relative z-10 whitespace-nowrap truncate">占营收 {analytics.revenueDetails.totalRevenue > 0 ? ((analytics.costs.totalExpenses / analytics.revenueDetails.totalRevenue) * 100).toFixed(1) : '0'}%</p>
                                        </div>
                                        
                                        <div className={`${analytics.netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-200'} p-3.5 sm:p-5 rounded-2xl border shadow-sm relative group flex flex-col justify-between`}>
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <p className="text-[9px] md:text-[10px] font-bold text-emerald-700 uppercase mb-1 tracking-tighter md:tracking-wider whitespace-nowrap truncate">毛利润 (Gross)</p>
                                                </div>
                                                <p className={`text-lg sm:text-xl md:text-2xl font-black font-mono tracking-tighter ${analytics.grossProfit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                                                    {formatMoney(analytics.grossProfit)}
                                                </p>
                                                <p className="text-[9px] text-emerald-600 font-bold mt-1 whitespace-nowrap truncate">
                                                    毛利率 {analytics.revenueDetails.totalRevenue > 0 ? ((analytics.grossProfit / analytics.revenueDetails.totalRevenue) * 100).toFixed(1) : '0'}%
                                                </p>
                                            </div>
                                            
                                            {analytics.revenueDetails.totalRevenue > 0 && (
                                                <div className="mt-3 pt-2 border-t border-emerald-200/50">
                                                    {((analytics.grossProfit / analytics.revenueDetails.totalRevenue) * 100) >= 65 ? (
                                                        <span className="inline-block bg-emerald-100 text-emerald-700 text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.5 rounded font-black tracking-tighter sm:tracking-wide shadow-sm whitespace-nowrap">✅ 定价与损耗健康</span>
                                                    ) : ((analytics.grossProfit / analytics.revenueDetails.totalRevenue) * 100) < 50 ? (
                                                        <span className="inline-flex items-center gap-0.5 sm:gap-1 bg-red-100 text-red-700 text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.5 rounded font-black tracking-tighter sm:tracking-wide shadow-sm animate-pulse whitespace-nowrap"><AlertCircle size={10} className="shrink-0"/> 报警: 查损耗/涨价</span>
                                                    ) : (
                                                        <span className="inline-block bg-orange-100 text-orange-700 text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.5 rounded font-black tracking-tighter sm:tracking-wide shadow-sm whitespace-nowrap">⚠️ 毛利偏低需优化</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className={`${analytics.netCashFlow >= 0 ? 'bg-[#1A1A1A]' : 'bg-red-900'} p-3.5 sm:p-5 rounded-2xl shadow-xl relative overflow-hidden group flex flex-col justify-between`}>
                                            <div>
                                                <p className="text-[9px] md:text-[10px] font-bold text-[#FFD700] uppercase mb-1 tracking-tighter md:tracking-wider relative z-10 whitespace-nowrap truncate">经营净利 (Net Profit)</p>
                                                <p className="text-lg sm:text-xl md:text-2xl font-black text-white font-mono relative z-10 tracking-tighter">{formatMoney(analytics.netProfit)}</p>
                                            </div>
                                            
                                            {(analytics.revenueDetails.variance !== 0 || analytics.costs.totalCapex > 0) && (
                                                <div className="mt-2 pt-2 border-t border-white/20 relative z-10 space-y-1">
                                                    {analytics.revenueDetails.variance !== 0 && (
                                                        <div className="flex justify-between text-[9px] text-white/60 font-mono">
                                                            <span className="whitespace-nowrap">现金盘点差异:</span>
                                                            <span className={analytics.revenueDetails.variance > 0 ? 'text-green-400 whitespace-nowrap' : 'text-red-400 whitespace-nowrap'}>{analytics.revenueDetails.variance > 0 ? '+' : ''}{formatMoney(analytics.revenueDetails.variance)}</span>
                                                        </div>
                                                    )}
                                                    {analytics.costs.totalCapex > 0 && (
                                                        <div className="flex justify-between text-[9px] text-white/60 font-mono">
                                                            <span className="whitespace-nowrap">- CAPEX:</span>
                                                            <span className="text-red-400 whitespace-nowrap">-{formatMoney(analytics.costs.totalCapex)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold text-[#FFD700] mt-1 pt-1 border-t border-white/10">
                                                        <span className="whitespace-nowrap">= 净现金流:</span>
                                                        <span className="font-mono whitespace-nowrap tracking-tighter">{formatMoney(analytics.netCashFlow)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {analytics.payrollSummary.monthlyTotal > 0 && (
                                        <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-black text-sm text-[#1A1A1A] mb-4 uppercase tracking-widest flex items-center gap-2">
                                                <Users size={16}/> 人工成本摘要 (Labor Summary)
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100/80">
                                                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">当月薪资总和 (Monthly Total)</p>
                                                    <p className="text-2xl font-black font-mono text-purple-300">{formatMoney(analytics.payrollSummary.monthlyTotal)}</p>
                                                    <p className="text-[10px] text-purple-300 font-bold mt-1">
                                                        {analytics.payrollSummary.staffCount} 名员工 · {analytics.payrollSummary.months.join(', ')}
                                                    </p>
                                                </div>
                                                <div className="bg-purple-100 p-4 rounded-2xl border border-purple-200">
                                                    <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">已出资 (Paid / Disbursed)</p>
                                                    <p className="text-2xl font-black font-mono text-purple-900">{formatMoney(analytics.payrollSummary.paidAmount)}</p>
                                                    <p className="text-[10px] text-purple-600 font-bold mt-1">
                                                        含 Net Pay + 已缴 Statutory
                                                    </p>
                                                </div>
                                                <div className={`p-4 rounded-2xl border ${analytics.payrollSummary.unpaidAmount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                                                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${analytics.payrollSummary.unpaidAmount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                        未出资 (Pending Statutory)
                                                    </p>
                                                    <p className={`text-2xl font-black font-mono ${analytics.payrollSummary.unpaidAmount > 0 ? 'text-amber-700' : 'text-gray-300'}`}>
                                                        {formatMoney(analytics.payrollSummary.unpaidAmount)}
                                                    </p>
                                                    <p className={`text-[10px] font-bold mt-1 ${analytics.payrollSummary.unpaidAmount > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                                                        {analytics.payrollSummary.unpaidAmount > 0 ? 'EPF/SOCSO 待缴纳' : '全部已结清 ✅'}
                                                    </p>
                                                </div>
                                            </div>
                                            {analytics.payrollSummary.monthlyTotal > 0 && (
                                                <div className="mt-4">
                                                    <div className="flex justify-between text-[10px] font-bold mb-1.5">
                                                        <span className="text-purple-700">出资进度 ({((analytics.payrollSummary.paidAmount / analytics.payrollSummary.monthlyTotal) * 100).toFixed(0)}%)</span>
                                                        <span className="text-gray-400">{formatMoney(analytics.payrollSummary.paidAmount)} / {formatMoney(analytics.payrollSummary.monthlyTotal)}</span>
                                                    </div>
                                                    <div className="h-3 bg-purple-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-purple-600 rounded-full transition-all duration-700"
                                                            style={{ width: `${Math.min(100, (analytics.payrollSummary.paidAmount / analytics.payrollSummary.monthlyTotal) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

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
                                                                                <div className={`w-full rounded-t-md transition-all ${isToday ? 'bg-blue-500' : isHighest ? 'bg-blue-400' : 'bg-blue-200 hover:bg-blue-300'}`} style={{ height: h }} title={`${d.date}: RM ${d.sales.toFixed(2)}`}></div>
                                                                                <span className={`text-[7px] font-mono ${isToday ? 'text-blue-600 font-black' : 'text-gray-400'}`}>{d.date.slice(8)}</span>
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

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

                                    {(analytics.costs.totalDeposits > 0 || analytics.costs.totalCapex > 0) && (
                                        <div className="space-y-1.5">
                                            {analytics.costs.totalCapex > 0 && (
                                                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-[10px] text-purple-600 font-bold">
                                                    <Info size={12} className="shrink-0"/>
                                                    资本支出 (CAPEX) {formatMoney(analytics.costs.totalCapex)} 不计入经营损益，但将从分红现金池扣除。
                                                </div>
                                            )}
                                            {analytics.costs.totalDeposits > 0 && (
                                                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[10px] text-gray-500 font-bold">
                                                    <Info size={12} className="shrink-0"/>
                                                    押金 (Deposit) {formatMoney(analytics.costs.totalDeposits)} 不计入损益（属于资产，非费用）
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'SALES' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
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

                                    <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-gray-200 shadow-sm">
                                        <h4 className="font-black text-xs sm:text-sm text-[#1A1A1A] mb-4 sm:mb-6 uppercase tracking-tight sm:tracking-widest flex items-center gap-1.5 sm:gap-2 whitespace-nowrap truncate"><Wallet size={16} className="shrink-0"/> 堂食收款方式 <span className="hidden sm:inline">(In-Store Payments)</span></h4>
                                        <div className="flex h-3 sm:h-4 rounded-full overflow-hidden mb-3 sm:mb-4 bg-gray-100">
                                            <div className="bg-green-500 transition-all duration-1000" style={{ width: `${analytics.percentages.cash}%` }}></div>
                                            <div className="bg-blue-500 transition-all duration-1000" style={{ width: `${analytics.percentages.ewallet}%` }}></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                                            <div className="p-3 sm:p-4 bg-green-50 rounded-xl sm:rounded-2xl border border-green-100 flex flex-col justify-between">
                                                <div className="flex flex-col 2xl:flex-row 2xl:justify-between 2xl:items-start mb-1 sm:mb-2 gap-0.5">
                                                    <span className="text-[10px] sm:text-xs font-bold text-green-700 flex items-center gap-1.5 whitespace-nowrap truncate"><Banknote size={14} className="shrink-0"/> <span className="truncate">Cash (现金)</span></span>
                                                    <span className="text-sm sm:text-lg font-black text-green-800 tracking-tighter leading-none">{analytics.percentages.cash.toFixed(1)}%</span>
                                                </div>
                                                <div className="text-base sm:text-xl font-mono font-black text-[#1A1A1A] tracking-tighter whitespace-nowrap truncate">{formatMoney(analytics.revenueDetails.cash)}</div>
                                            </div>
                                            <div className="p-3 sm:p-4 bg-blue-50 rounded-xl sm:rounded-2xl border border-blue-100 flex flex-col justify-between">
                                                <div className="flex flex-col 2xl:flex-row 2xl:justify-between 2xl:items-start mb-1 sm:mb-2 gap-0.5">
                                                    <span className="text-[10px] sm:text-xs font-bold text-blue-700 flex items-center gap-1.5 whitespace-nowrap truncate"><CreditCard size={14} className="shrink-0"/> <span className="truncate">Digital (电子)</span></span>
                                                    <span className="text-sm sm:text-lg font-black text-blue-800 tracking-tighter leading-none">{analytics.percentages.ewallet.toFixed(1)}%</span>
                                                </div>
                                                <div className="text-base sm:text-xl font-mono font-black text-[#1A1A1A] tracking-tighter whitespace-nowrap truncate">{formatMoney(analytics.revenueDetails.tng + analytics.revenueDetails.debitCard + analytics.revenueDetails.creditCard + analytics.revenueDetails.amex)}</div>
                                                <div className="mt-1.5 sm:mt-2 text-[9px] sm:text-[10px] text-blue-600 space-y-0.5 sm:space-y-1">
                                                    <div className="flex justify-between items-center"><span className="truncate pr-1">Debit:</span><span className="font-mono tracking-tighter">{formatMoney(analytics.revenueDetails.debitCard)}</span></div>
                                                    <div className="flex justify-between items-center"><span className="truncate pr-1">Credit:</span><span className="font-mono tracking-tighter">{formatMoney(analytics.revenueDetails.creditCard)}</span></div>
                                                    <div className="flex justify-between items-center"><span className="truncate pr-1">Amex:</span><span className="font-mono tracking-tighter">{formatMoney(analytics.revenueDetails.amex)}</span></div>
                                                    <div className="flex justify-between items-center"><span className="truncate pr-1">TNG:</span><span className="font-mono tracking-tighter">{formatMoney(analytics.revenueDetails.tng)}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 🔴 外卖平台抽佣明细 (Delivery Platform Commission) */}
                                    <div className="bg-white p-5 sm:p-6 rounded-[2rem] shadow-sm border border-gray-200">
                                        <div className="flex justify-between items-center mb-5 sm:mb-6">
                                            <h3 className="font-black text-[#1A1A1A] text-sm md:text-base flex items-center gap-2 uppercase tracking-widest">
                                                <Truck className="text-orange-500" size={18}/>
                                                外卖营收分析 (Delivery Revenue)
                                            </h3>
                                            <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded font-bold uppercase tracking-widest hidden md:inline-block border border-orange-100">Gross vs Net</span>
                                        </div>

                                        {analytics.deliveryMacro.gross > 0 ? (
                                            <div className="mb-6 sm:mb-8 space-y-4">
                                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-[10px] text-gray-500 font-bold border border-gray-100">
                                                    <Info size={12} className="shrink-0"/>
                                                    此处为宏观分析（按 Gross-Net 差额估算抽佣率），实际入账金额以上方「手续费总览」为准。
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-400 mb-1">已核销总营业额 (Gross)</p>
                                                        <p className="font-mono text-xl md:text-2xl font-black text-[#1A1A1A]">RM {analytics.deliveryMacro.gross.toFixed(2)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold text-gray-400 mb-1">已核销实收 (Net)</p>
                                                        <p className="font-mono text-xl md:text-2xl font-black text-green-600">RM {analytics.deliveryMacro.net.toFixed(2)}</p>
                                                    </div>
                                                </div>

                                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-inner">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-black uppercase text-gray-600">综合抽佣率 (Commission Rate)</span>
                                                        <span className={`font-black text-lg ${analytics.deliveryMacro.rate > 30 ? 'text-red-600' : 'text-orange-500'}`}>
                                                            {analytics.deliveryMacro.rate.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden flex">
                                                        <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${100 - analytics.deliveryMacro.rate}%` }}></div>
                                                        <div className={`h-full transition-all duration-1000 ${analytics.deliveryMacro.rate > 30 ? 'bg-red-500' : 'bg-orange-400'}`} style={{ width: `${analytics.deliveryMacro.rate}%` }}></div>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] font-bold">
                                                        <span className="text-green-600">到手: RM {analytics.deliveryMacro.net.toFixed(2)}</span>
                                                        <span className={analytics.deliveryMacro.rate > 30 ? 'text-red-600' : 'text-orange-500'}>被抽: RM {analytics.deliveryMacro.commission.toFixed(2)}</span>
                                                    </div>
                                                </div>

                                                {analytics.deliveryMacro.rate > 30 ? (
                                                    <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex gap-3 items-start">
                                                        <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5"/>
                                                        <div>
                                                            <p className="text-xs font-black text-red-800">利润警报：外卖成本过高！</p>
                                                            <p className="text-[10px] text-red-600 mt-1 font-bold">当前平均抽成已达 {analytics.deliveryMacro.rate.toFixed(1)}%。建议检查是否误开平台 Ads，或调高外卖菜单定价。</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-green-50 border border-green-200 p-3 rounded-xl flex gap-3 items-center">
                                                        <CheckCircle2 size={18} className="text-green-600 shrink-0"/>
                                                        <p className="text-[10px] font-bold text-green-800">平台抽佣率处于健康范围内 (30% 以下)。</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mb-6 sm:mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center text-xs text-gray-500 italic">
                                                <Info size={16} className="mx-auto mb-2 opacity-50"/>
                                                本时段暂无已核销的外卖数据，无法计算综合抽佣率。<br/>请前往「每日结算 -{'>'} 历史记录」进行数字对账。
                                            </div>
                                        )}

                                        <div className="border-t border-gray-100 pt-5 sm:pt-6">
                                            <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold mb-3 sm:mb-4 uppercase tracking-widest leading-relaxed">
                                                各平台明细 <span className="sm:hidden"><br/>(Gross营业额 · Net实收)</span><span className="hidden sm:inline">(Gross 为系统营业额 · Net 为核销实收)</span>
                                            </p>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                                                {(['grab', 'panda', 'shopee'] as const).map(platform => {
                                                    const recon = analytics.deliveryRecon[platform];
                                                    const colors = PLATFORM_COLORS[platform];
                                                    if (recon.gross <= 0) return null;
                                                    
                                                    const commission = recon.reconDays > 0 ? (recon.gross - recon.net) : 0;
                                                    const commissionPct = recon.reconDays > 0 && recon.gross > 0 ? ((commission / recon.gross) * 100) : 0;
                                                    const hasRecon = recon.reconDays > 0;
                                                    const allReconciled = recon.reconDays === recon.totalDays;

                                                    return (
                                                        <div key={platform} className={`p-3.5 sm:p-4 rounded-2xl border ${colors.border} ${colors.bg}`}>
                                                            <div className="flex justify-between items-center mb-2.5 sm:mb-3 gap-2">
                                                                <span className={`text-[11px] sm:text-xs font-black ${colors.text} uppercase whitespace-nowrap truncate pr-1`}>{colors.label}</span>
                                                                {!allReconciled && recon.totalDays > 0 && (
                                                                    <span className="text-[8px] sm:text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap shrink-0">
                                                                        {recon.reconDays}/{recon.totalDays} 天已核销
                                                                    </span>
                                                                )}
                                                                {allReconciled && recon.totalDays > 0 && (
                                                                    <span className="text-[8px] sm:text-[9px] font-bold text-green-600 bg-green-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-green-200 whitespace-nowrap shrink-0">
                                                                        ✅ 全部核销
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="space-y-1.5 sm:space-y-2">
                                                                <div className="flex justify-between items-center gap-1">
                                                                    <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 whitespace-nowrap">Gross <span className="hidden sm:inline">(营业额)</span></span>
                                                                    <span className="font-mono font-black text-[#1A1A1A] tracking-tighter whitespace-nowrap truncate text-right">{formatMoney(recon.gross)}</span>
                                                                </div>
                                                                {hasRecon && (
                                                                    <>
                                                                        <div className="flex justify-between items-center gap-1">
                                                                            <span className="text-[9px] sm:text-[10px] font-bold text-green-600 whitespace-nowrap">Net <span className="hidden sm:inline">(实收)</span></span>
                                                                            <span className="font-mono font-black text-green-700 tracking-tighter whitespace-nowrap truncate text-right">{formatMoney(recon.net)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center pt-1.5 sm:pt-2 border-t border-gray-200/50 gap-1">
                                                                            <span className="text-[9px] sm:text-[10px] font-bold text-red-500 whitespace-nowrap">Comm <span className="hidden sm:inline">(抽佣)</span></span>
                                                                            <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0">
                                                                                <span className="font-mono font-bold text-red-600 text-[10px] sm:text-xs tracking-tighter whitespace-nowrap truncate">-{formatMoney(commission)}</span>
                                                                                <span className="text-[8px] sm:text-[9px] font-black text-red-500 bg-red-50 px-1 sm:px-1.5 py-0.5 rounded border border-red-200 whitespace-nowrap shrink-0">{commissionPct.toFixed(1)}%</span>
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                                {!hasRecon && (
                                                                    <p className="text-[9px] sm:text-[10px] text-gray-400 italic pt-1 whitespace-nowrap truncate">尚未核销，无 Net 数据</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {analytics.deliveryBreakdown.lalamove > 0 && (
                                                <div className="mt-4 flex justify-between items-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                                                    <span className="text-xs font-bold text-blue-700">Lalamove (自行配送)</span>
                                                    <span className="font-mono font-black text-[#1A1A1A]">{formatMoney(analytics.deliveryBreakdown.lalamove)}</span>
                                                </div>
                                            )}

                                            <div className="mt-5 sm:mt-6 pt-4 border-t border-gray-200 grid grid-cols-2 gap-3 sm:gap-4">
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-100 gap-1 sm:gap-0">
                                                    <span className="text-[10px] sm:text-xs font-bold text-gray-600 flex items-center gap-1.5 whitespace-nowrap truncate">
                                                        <ShoppingBag size={14} className="shrink-0"/> <span className="truncate">In-Store</span>
                                                    </span>
                                                    <span className="text-sm sm:text-base font-mono font-black text-[#1A1A1A] tracking-tighter whitespace-nowrap truncate">
                                                        {formatMoney(analytics.revenueDetails.totalRevenue - analytics.revenueDetails.delivery)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl border border-orange-100 gap-1 sm:gap-0">
                                                    <span className="text-[10px] sm:text-xs font-bold text-orange-700 flex items-center gap-1.5 whitespace-nowrap truncate">
                                                        <Truck size={14} className="shrink-0"/> <span className="truncate">Delivery</span>
                                                    </span>
                                                    <span className="text-sm sm:text-base font-mono font-black text-orange-800 tracking-tighter whitespace-nowrap truncate">
                                                        {formatMoney(analytics.revenueDetails.delivery)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 🏦 银行手续费明细 (Bank & Payment Fees) */}
                                    <div className="bg-white p-5 sm:p-6 rounded-[2rem] shadow-sm border border-gray-200">
                                        <div className="flex justify-between items-center mb-5 sm:mb-6">
                                            <h3 className="font-black text-[#1A1A1A] text-sm md:text-base flex items-center gap-2 uppercase tracking-widest">
                                                <CreditCard className="text-blue-500" size={18}/>
                                                银行手续费 (Bank & Payment Fees)
                                            </h3>
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold uppercase tracking-widest hidden md:inline-block border border-blue-100">Bank</span>
                                        </div>

                                        {analytics.bankFees.total > 0 ? (
                                            <div className="space-y-4">
                                                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-xs font-black uppercase text-blue-700">本期银行手续费合计</span>
                                                        <span className="font-black text-xl font-mono text-blue-700 tracking-tighter">{formatMoney(analytics.bankFees.total)}</span>
                                                    </div>
                                                    {(() => {
                                                        const storeRevenue = analytics.revenueDetails.totalRevenue - analytics.revenueDetails.delivery;
                                                        const bankPct = storeRevenue > 0 ? (analytics.bankFees.total / storeRevenue) * 100 : 0;
                                                        return (
                                                            <>
                                                                <div className="w-full bg-blue-100 rounded-full h-2.5 mb-2 overflow-hidden">
                                                                    <div className="bg-blue-500 h-full transition-all duration-1000 rounded-full" style={{ width: `${Math.min(bankPct * 5, 100)}%` }}></div>
                                                                </div>
                                                                <div className="flex justify-between text-[10px] font-bold">
                                                                    <span className="text-blue-600">占堂食营收 {bankPct.toFixed(2)}%</span>
                                                                    <span className="text-gray-400">堂食营收: {formatMoney(storeRevenue)}</span>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>

                                                <div className="space-y-2">
                                                    {analytics.bankFees.list.map((fee: any) => (
                                                        <div key={fee.id} onClick={() => handleDrillDown({ categoryId: fee.id }, fee.label)} className="flex justify-between items-center p-3.5 bg-gray-50 hover:bg-blue-50/50 rounded-xl border border-gray-100 cursor-pointer transition-colors group active:scale-[0.98]">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                                                    <CreditCard size={14} className="text-blue-600"/>
                                                                </div>
                                                                <span className="text-sm font-bold text-gray-700 group-hover:text-blue-800">{CATEGORY_LABELS[fee.id] || fee.id}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-black text-[#1A1A1A]">{formatMoney(fee.amount)}</span>
                                                                <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500"/>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {analytics.bankFees.total > 0 && (() => {
                                                    const storeRevenue = analytics.revenueDetails.totalRevenue - analytics.revenueDetails.delivery;
                                                    const bankPct = storeRevenue > 0 ? (analytics.bankFees.total / storeRevenue) * 100 : 0;
                                                    return bankPct > 2 ? (
                                                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex gap-3 items-start">
                                                            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5"/>
                                                            <div>
                                                                <p className="text-xs font-black text-amber-800">注意：银行手续费偏高</p>
                                                                <p className="text-[10px] text-amber-600 mt-1 font-bold">占堂食营收 {bankPct.toFixed(2)}% (建议控制在 2% 以下)。可考虑与银行谈判降低 MDR 或鼓励现金/TNG 支付。</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-green-50 border border-green-200 p-3 rounded-xl flex gap-3 items-center">
                                                            <CheckCircle2 size={16} className="text-green-600 shrink-0"/>
                                                            <p className="text-[10px] font-bold text-green-800">银行手续费占比正常 (2% 以下)。</p>
                                                        </div>
                                                    );
                                                })()}

                                                <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl mt-3">
                                                    <p className="text-[10px] font-black text-gray-600 mb-1.5">💡 如何区分银行费 vs 平台费？</p>
                                                    <div className="text-[10px] text-gray-500 space-y-1 leading-relaxed">
                                                        <p>• <span className="font-mono bg-blue-50 px-1 rounded border border-blue-100 text-blue-700">BANK_FEE</span> / <span className="font-mono bg-blue-50 px-1 rounded border border-blue-100 text-blue-700">MBB_COMM</span> → 仅限银行刷卡 MDR（Visa/MC/Amex 手续费）</p>
                                                        <p>• <span className="font-mono bg-pink-50 px-1 rounded border border-pink-100 text-pink-700">PLATFORM_FEE</span> → Grab/Panda/Shopee 平台收取的额外手续费、广告费</p>
                                                        <p className="text-gray-400 italic pt-1">如之前已混入，请前往「应付账款」修改对应条目的类别。</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 text-center">
                                                <CreditCard size={24} className="mx-auto mb-2 text-gray-300"/>
                                                <p className="text-xs text-gray-500 italic">本时段暂无银行手续费记录。</p>
                                                <p className="text-[10px] text-gray-400 mt-1">如有信用卡/借记卡 MDR 费用，请在「应付账款」模块录入，类别选 <span className="font-mono bg-gray-200 px-1 rounded">BANK_FEE</span> 或 <span className="font-mono bg-gray-200 px-1 rounded">MBB_COMM</span>。</p>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}

                            {activeTab === 'COST' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold ${accountingMode === 'ACCRUAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-sky-50 text-sky-700 border border-sky-200'}`}>
                                        <Info size={12} className="shrink-0"/>
                                        {accountingMode === 'ACCRUAL' ? '📋 权责发生制 — 费用含未付账单，按收货日归入。点击行项可查看付款状态。' : '💰 收付实现制 — 仅显示已实际付款的费用。'}
                                    </div>
                                    
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                        <button onClick={() => handleDrillDown({ type: 'COGS' }, '销货成本 (COGS)')} className="bg-red-50 p-3.5 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-red-100 text-left hover:shadow-md transition-all active:scale-[0.98] group min-h-[100px] sm:min-h-[120px]">
                                            <div className="flex justify-between items-center mb-1 sm:mb-2"><p className="text-[9px] sm:text-[10px] font-bold text-red-600 uppercase truncate pr-1">COGS (销货成本)</p><ChevronRight size={14} className="text-red-300 group-hover:text-red-500 transition-colors shrink-0"/></div>
                                            <p className="text-lg sm:text-2xl font-black text-[#1A1A1A] font-mono tracking-tighter">{formatMoney(analytics.costs.totalCOGS)}</p>
                                            <div className="mt-1 sm:mt-2 text-[9px] sm:text-[10px] font-bold text-red-400 truncate">{analytics.margins.cogs.toFixed(1)}% of Sales</div>
                                        </button>
                                        <button onClick={() => handleDrillDown({ type: 'LABOR' }, '人工薪资 (Labor)')} className="bg-purple-50 p-3.5 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-purple-100 text-left hover:shadow-md transition-all active:scale-[0.98] group min-h-[100px] sm:min-h-[120px]">
                                            <div className="flex justify-between items-center mb-1 sm:mb-2"><p className="text-[9px] sm:text-[10px] font-bold text-purple-600 uppercase truncate pr-1">Labor (人工薪资)</p><ChevronRight size={14} className="text-purple-300 group-hover:text-purple-500 transition-colors shrink-0"/></div>
                                            <p className="text-lg sm:text-2xl font-black text-[#1A1A1A] font-mono tracking-tighter">{formatMoney(analytics.costs.totalLabor)}</p>
                                            <div className="mt-1 sm:mt-2 text-[9px] sm:text-[10px] font-bold text-purple-400 truncate">{analytics.margins.labor.toFixed(1)}% of Sales</div>
                                        </button>
                                        <button onClick={() => handleDrillDown({ type: 'OPEX' }, '运营支出 (OPEX)')} className="bg-orange-50 p-3.5 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-orange-100 text-left hover:shadow-md transition-all active:scale-[0.98] group min-h-[100px] sm:min-h-[120px]">
                                            <div className="flex justify-between items-center mb-1 sm:mb-2"><p className="text-[9px] sm:text-[10px] font-bold text-orange-600 uppercase truncate pr-1">OPEX (运营支出)</p><ChevronRight size={14} className="text-orange-300 group-hover:text-orange-500 transition-colors shrink-0"/></div>
                                            <p className="text-lg sm:text-2xl font-black text-[#1A1A1A] font-mono tracking-tighter">{formatMoney(analytics.costs.totalOPEX)}</p>
                                            <div className="mt-1 sm:mt-2 text-[9px] sm:text-[10px] font-bold text-orange-400 truncate">{analytics.margins.opex.toFixed(1)}% of Sales</div>
                                        </button>
                                        <button onClick={() => handleDrillDown({ type: 'CAPEX' }, '资本支出 (CAPEX)')} className="bg-blue-50 p-3.5 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-blue-100 text-left hover:shadow-md transition-all active:scale-[0.98] group min-h-[100px] sm:min-h-[120px]">
                                            <div className="flex justify-between items-center mb-1 sm:mb-2"><p className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase truncate pr-1">CAPEX (资本支出)</p><ChevronRight size={14} className="text-blue-300 group-hover:text-blue-500 transition-colors shrink-0"/></div>
                                            <p className="text-lg sm:text-2xl font-black text-[#1A1A1A] font-mono tracking-tighter">{formatMoney(analytics.costs.totalCapex)}</p>
                                            <div className="mt-1 sm:mt-2 text-[8px] sm:text-[10px] font-bold text-blue-400 truncate">不计入当期损益</div>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="bg-white p-6 rounded-[2rem] border border-gray-200">
                                            <h4 className="font-black text-sm text-[#1A1A1A] mb-4 uppercase tracking-widest border-b pb-2">COGS Breakdown (销货成本明细)</h4>
                                            <div className="space-y-2 max-h-80 overflow-y-auto touch-pan-y">
                                                {analytics.lists.cogsList.map((g: any) => (
                                                    <div key={g.id} onClick={() => handleDrillDown({ categoryId: g.id }, g.label)} className="flex justify-between items-center text-sm font-bold p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group active:scale-[0.98]">
                                                        <span className="text-gray-500 group-hover:text-[#1A1A1A]">{g.label}</span>
                                                        <div className="flex items-center gap-2"><span className="font-mono">{formatMoney(g.amount)}</span><ChevronRight size={14} className="text-gray-300 group-hover:text-black"/></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="bg-white p-6 rounded-[2rem] border border-gray-200">
                                            <h4 className="font-black text-sm text-[#1A1A1A] mb-4 uppercase tracking-widest border-b pb-2">Labor & OPEX (人工与运营)</h4>
                                            <div className="space-y-2 max-h-80 overflow-y-auto touch-pan-y">
                                                <p className="text-[10px] font-black text-purple-600 uppercase mt-2 pl-2">Labor</p>
                                                <div onClick={() => handleDrillDown({ categoryId: 'STAFF_ADVANCE' }, '员工预支 (Staff Advance)')} className="flex justify-between items-center text-sm font-bold pl-2 border-l-2 border-red-400 p-3 bg-red-50/50 hover:bg-red-100 cursor-pointer rounded-r-lg transition-colors group mb-1 active:scale-[0.98]">
                                                    <div className="flex items-center gap-2"><UserMinus size={14} className="text-red-500"/><span className="text-red-700">员工预支 (Staff Advance)</span></div>
                                                    <div className="flex items-center gap-2"><span className="font-mono font-black text-red-700">{formatMoney(analytics.lists.laborList.find((g:any)=>g.id==='STAFF_ADVANCE')?.amount || 0)}</span><ChevronRight size={14} className="text-red-400"/></div>
                                                </div>
                                                {analytics.lists.laborList.filter((g:any) => g.id !== 'STAFF_ADVANCE').map((g: any) => (
                                                    <div key={g.id} onClick={() => handleDrillDown({ categoryId: g.id }, g.label)} className={`flex justify-between items-center text-sm font-bold pl-2 border-l-2 p-3 cursor-pointer rounded-r-lg transition-colors group active:scale-[0.98] ${g.isPending ? 'border-gray-200 text-gray-400 bg-gray-50/30 hover:bg-gray-50' : 'border-purple-100 hover:bg-purple-50/50'}`}>
                                                        <span className={g.isPending ? "italic" : "text-gray-500 group-hover:text-purple-900"}>{g.label}</span>
                                                        <div className="flex items-center gap-2"><span className="font-mono">{formatMoney(g.amount)}</span><ChevronRight size={14} className="text-gray-300 group-hover:text-purple-400"/></div>
                                                    </div>
                                                ))}
                                                <p className="text-[10px] font-black text-orange-600 uppercase mt-4 pl-2">OPEX</p>
                                                {analytics.lists.opexList.map((g: any) => (
                                                    <div key={g.id} onClick={() => handleDrillDown({ categoryId: g.id }, g.label)} className="flex justify-between items-center text-sm font-bold pl-2 border-l-2 border-orange-100 p-3 hover:bg-orange-50/50 cursor-pointer rounded-r-lg transition-colors group active:scale-[0.98]">
                                                        <span className="text-gray-500 group-hover:text-orange-900">{g.label}</span>
                                                        <div className="flex items-center gap-2"><span className="font-mono">{formatMoney(g.amount)}</span><ChevronRight size={14} className="text-gray-300 group-hover:text-orange-400"/></div>
                                                    </div>
                                                ))}
                                                {analytics.lists.capexList.length > 0 && (
                                                    <>
                                                        <p className="text-[10px] font-black text-blue-600 uppercase mt-4 pl-2">CAPEX 资本支出</p>
                                                        {analytics.lists.capexList.map((g: any) => (
                                                            <div key={g.id} onClick={() => handleDrillDown({ categoryId: g.id }, g.label)} className="flex justify-between items-center text-sm font-bold pl-2 border-l-2 border-blue-200 p-3 hover:bg-blue-50/50 cursor-pointer rounded-r-lg transition-colors group active:scale-[0.98]">
                                                                <span className="text-gray-500 group-hover:text-blue-900">{g.label}</span>
                                                                <div className="flex items-center gap-2"><span className="font-mono">{formatMoney(g.amount)}</span><ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400"/></div>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                                {analytics.lists.depositList.length > 0 && (
                                                    <>
                                                        <p className="text-[10px] font-black text-gray-500 uppercase mt-4 pl-2">ASSET 押金与资产</p>
                                                        {analytics.lists.depositList.map((g: any) => (
                                                            <div key={g.id} onClick={() => handleDrillDown({ categoryId: g.id }, g.label)} className="flex justify-between items-center text-sm font-bold pl-2 border-l-2 border-gray-200 p-3 hover:bg-gray-50 cursor-pointer rounded-r-lg transition-colors group active:scale-[0.98]">
                                                                <span className="text-gray-500 group-hover:text-gray-900">{g.label}</span>
                                                                <div className="flex items-center gap-2"><span className="font-mono">{formatMoney(g.amount)}</span><ChevronRight size={14} className="text-gray-300 group-hover:text-gray-400"/></div>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
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
                                                <div><h3 className="font-black text-lg text-[#1A1A1A]">资金流水审计 (Cash Flow Audit)</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Running Balance from Day 1</p></div>
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
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shrink-0 ${log.type === 'IN' ? 'bg-green-100 text-green-700' : log.type === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{log.type}</div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2"><span className="font-bold text-[#1A1A1A] text-sm truncate">{CATEGORY_LABELS[log.category] || log.category}</span><span className="text-[9px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{log.date}</span></div>
                                                            <div className="text-xs text-gray-500 font-medium mt-0.5 truncate max-w-[200px] md:max-w-md">{log.description}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className={`font-mono font-black text-sm md:text-base ${log.type === 'IN' ? 'text-green-600' : log.type === 'OUT' ? 'text-red-600' : 'text-blue-600'}`}>{log.type === 'IN' ? '+' : log.type === 'OUT' ? '-' : '⇄'}{formatMoney(log.amount).replace('RM ','')}</div>
                                                        <div className="text-[10px] font-mono font-bold text-gray-400 mt-1">Bal: {formatMoney(log.balance).replace('RM ','')}</div>
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
                                            <div><h3 className="font-black text-xl flex items-center gap-2 text-[#FFD700]"><Briefcase size={24}/> 股东分红计算器</h3><p className="text-xs text-white/60 mt-1">Dividend Distribution Planner</p></div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Net Cash Flow (真实可支配现金)</p>
                                                <p className={`text-3xl font-black font-mono ${analytics.netCashFlow >= 0 ? 'text-white' : 'text-red-400'}`}>{formatMoney(analytics.netCashFlow)}</p>
                                                {analytics.costs.totalCapex > 0 && (<p className="text-[9px] text-red-400 mt-1">已扣除 CAPEX: {formatMoney(analytics.costs.totalCapex)}</p>)}
                                            </div>
                                        </div>
                                        <div className="mt-8 bg-white/10 p-4 rounded-xl border border-white/10">
                                            <div className="flex justify-between text-xs font-bold mb-2">
                                                <span>Retained Earnings (公司预留): <span className="text-[#FFD700]">{retentionRate}%</span></span>
                                                <span>Distributable (股东可分): {100 - retentionRate}%</span>
                                            </div>
                                            <input type="range" min="0" max="100" step="5" value={retentionRate} onChange={(e) => setRetentionRate(parseInt(e.target.value))} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#FFD700]"/>
                                        </div>
                                    </div>

                                    {analytics.netCashFlow <= 0 ? (
                                        <div className="text-center py-20 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                                            <AlertCircle size={48} className="mx-auto text-gray-300 mb-4"/>
                                            <h3 className="text-lg font-black text-gray-400">本期无可用现金流，无法分红</h3>
                                            <p className="text-xs text-gray-400">Net Cash Flow is negative or zero after CAPEX.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Company Retained (预留储备金)</p>
                                                <p className="text-3xl font-black text-blue-600 font-mono mb-4">{formatMoney(analytics.netCashFlow * (retentionRate / 100))}</p>
                                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${retentionRate}%` }}></div></div>
                                            </div>
                                            <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Distributable (最终可分红)</p>
                                                <p className="text-3xl font-black text-green-600 font-mono mb-4">{formatMoney(analytics.netCashFlow * ((100 - retentionRate) / 100))}</p>
                                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${100 - retentionRate}%` }}></div></div>
                                            </div>
                                            <div className="col-span-full">
                                                <h4 className="text-sm font-black text-[#1A1A1A] uppercase tracking-widest mb-4 ml-2 flex items-center gap-2"><Users size={16}/> 股东分配明细 (Breakdown)</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {(treasuryConfig?.shareholders || []).map(sh => {
                                                        const distributableTotal = analytics.netProfit * ((100 - retentionRate) / 100);
                                                        
                                                        // 核心修改：无视股权比例，强制平分为 3 份
                                                        const shareAmount = distributableTotal / 3;
                                                        
                                                        return (
                                                            <div key={sh.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-[#FFD700] transition-all">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-500 text-sm border-2 border-white shadow-sm">
                                                                        {sh.name.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-sm text-[#1A1A1A]">{sh.name}</div>
                                                                        {/* UI 更新：将原本的股权 % 改为显示 "1/3 均分" 标签 */}
                                                                        <div className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded w-fit mt-0.5">1/3 均分 (Equal Split)</div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-xs font-bold text-gray-400 uppercase">Payout</div>
                                                                    <div className="text-lg font-mono font-black text-[#1A1A1A]">{formatMoney(shareAmount)}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {(treasuryConfig?.shareholders || []).length === 0 && (<div className="col-span-full text-center py-10 text-gray-400 text-xs italic">暂无股东信息，请在资金管理模块设置。</div>)}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                             )}

                            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                                <div ref={printRef} className="w-[800px] bg-white p-12 font-sans text-black relative" style={{ minHeight: '1122px' }}>
                                    <div className="flex justify-between items-end border-b-4 border-black pb-6 mb-8">
                                        <div><h1 className="text-4xl font-black uppercase tracking-widest mb-2 text-[#1A1A1A]">Financial Report</h1><p className="text-sm font-bold text-gray-500 uppercase tracking-widest">KIM LIAN KEE (KEPONG)</p></div>
                                        <div className="text-right"><p className="text-xl font-bold uppercase text-[#1A1A1A]">{startDate} <span className="text-gray-400 mx-1">TO</span> {endDate}</p><p className="text-xs font-mono text-gray-400 mt-1">Generated: {new Date().toLocaleString()}</p><p className="text-[10px] text-gray-400 mt-1">Mode: {accountingMode === 'ACCRUAL' ? 'Accrual Basis (权责发生制)' : 'Cash Basis (收付实现制)'}</p></div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-4 mb-8">
                                        <div className="bg-gray-100 p-4 rounded-xl border border-gray-200"><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Revenue</p><p className="text-xl font-black font-mono text-[#1A1A1A]">{formatMoney(analytics.revenueDetails.totalRevenue)}</p></div>
                                        <div className="bg-gray-100 p-4 rounded-xl border border-gray-200"><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Gross Profit</p><p className="text-xl font-black font-mono text-emerald-700">{formatMoney(analytics.grossProfit)}</p></div>
                                        <div className="bg-gray-100 p-4 rounded-xl border border-gray-200"><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Net Profit</p><p className={`text-xl font-black font-mono ${analytics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatMoney(analytics.netProfit)}</p></div>
                                        <div className="bg-gray-100 p-4 rounded-xl border border-gray-200"><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Net Cash Flow</p><p className={`text-xl font-black font-mono ${analytics.netCashFlow >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatMoney(analytics.netCashFlow)}</p></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-10 mb-8">
                                        <div>
                                            <h2 className="text-sm font-black uppercase tracking-widest border-b-2 border-gray-300 pb-2 mb-4 text-[#1A1A1A]">1. Revenue Breakdown</h2>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between items-center font-bold"><span>In-Store Sales</span><span className="font-mono">{formatMoney(analytics.revenueDetails.totalRevenue - analytics.revenueDetails.delivery)}</span></div>
                                                <div className="pl-4 space-y-1.5 text-xs text-gray-600">
                                                    <div className="flex justify-between"><span>- Cash</span><span className="font-mono">{formatMoney(analytics.revenueDetails.cash)}</span></div>
                                                    <div className="flex justify-between"><span>- TNG eWallet</span><span className="font-mono">{formatMoney(analytics.revenueDetails.tng)}</span></div>
                                                    <div className="flex justify-between"><span>- Debit Card</span><span className="font-mono">{formatMoney(analytics.revenueDetails.debitCard)}</span></div>
                                                    <div className="flex justify-between"><span>- Credit Card</span><span className="font-mono">{formatMoney(analytics.revenueDetails.creditCard)}</span></div>
                                                    <div className="flex justify-between"><span>- Amex</span><span className="font-mono">{formatMoney(analytics.revenueDetails.amex)}</span></div>
                                                </div>
                                                <div className="flex justify-between items-center font-bold pt-3 border-t border-dashed border-gray-200"><span>Delivery Sales</span><span className="font-mono">{formatMoney(analytics.revenueDetails.delivery)}</span></div>
                                                <div className="pl-4 space-y-1.5 text-xs text-gray-600">
                                                    <div className="flex justify-between"><span>- GrabFood</span><span className="font-mono">{formatMoney(analytics.deliveryBreakdown.grab)}</span></div>
                                                    <div className="flex justify-between"><span>- FoodPanda</span><span className="font-mono">{formatMoney(analytics.deliveryBreakdown.panda)}</span></div>
                                                    <div className="flex justify-between"><span>- ShopeeFood</span><span className="font-mono">{formatMoney(analytics.deliveryBreakdown.shopee)}</span></div>
                                                    <div className="flex justify-between"><span>- Lalamove</span><span className="font-mono">{formatMoney(analytics.deliveryBreakdown.lalamove)}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-black uppercase tracking-widest border-b-2 border-gray-300 pb-2 mb-4 text-[#1A1A1A]">2. Cost Structure</h2>
                                            <div className="space-y-4 text-sm">
                                                <div><div className="flex justify-between items-center font-bold"><span>COGS</span><span className="font-mono text-red-700">{formatMoney(analytics.costs.totalCOGS)}</span></div><div className="text-[10px] text-gray-500 text-right mt-0.5">占营收 {analytics.margins.cogs.toFixed(1)}%</div></div>
                                                <div><div className="flex justify-between items-center font-bold"><span>Labor</span><span className="font-mono text-red-700">{formatMoney(analytics.costs.totalLabor)}</span></div><div className="text-[10px] text-gray-500 text-right mt-0.5">占营收 {analytics.margins.labor.toFixed(1)}%</div></div>
                                                <div><div className="flex justify-between items-center font-bold"><span>OPEX</span><span className="font-mono text-red-700">{formatMoney(analytics.costs.totalOPEX)}</span></div><div className="text-[10px] text-gray-500 text-right mt-0.5">占营收 {analytics.margins.opex.toFixed(1)}%</div></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-20 pt-8 border-t border-black flex justify-between px-10">
                                        <div className="text-center"><div className="w-48 h-px bg-black mb-2"></div><p className="text-xs font-bold uppercase">Prepared By</p><p className="text-[10px] text-gray-500">Finance Dept</p></div>
                                        <div className="text-center"><div className="w-48 h-px bg-black mb-2"></div><p className="text-xs font-bold uppercase">Approved By</p><p className="text-[10px] text-gray-500">Director / Owner</p></div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {detailView && (
                    <div className="fixed inset-0 bg-black/80 z-[200] flex items-end md:items-center justify-center backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full h-full md:h-auto md:rounded-[2rem] md:w-[95vw] md:max-w-4xl shadow-2xl flex flex-col md:max-h-[90vh] overflow-hidden">
                            <div className="p-4 pt-[max(env(safe-area-inset-top),1rem)] md:p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50 shrink-0">
                                <div className="min-w-0 flex-1"><h3 className="font-black text-lg md:text-xl text-[#1A1A1A] flex items-center gap-2"><Receipt size={20} className="text-gray-400 shrink-0 md:w-6 md:h-6"/><span className="truncate">{detailView?.title}</span></h3><p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-widest">{detailView?.items?.length} Transactions found</p></div>
                                <button onClick={() => setDetailView(null)} className="w-11 h-11 flex items-center justify-center hover:bg-gray-200 bg-gray-100 rounded-full active:scale-95 transition-all shrink-0 ml-3"><X size={22}/></button>
                            </div>
                            <div className="flex-grow overflow-y-auto touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
                                <table className="w-full text-left text-sm hidden md:table">
                                    <thead className="bg-gray-100 text-gray-500 font-bold text-xs uppercase sticky top-0 z-10 border-b border-gray-200"><tr><th className="p-4">Date</th><th className="p-4">Description / Payee</th><th className="p-4">Source</th><th className="p-4 text-right">Amount</th><th className="p-4 w-12">Doc</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {detailView?.items?.length === 0 ? (<tr><td colSpan={5} className="p-10 text-center text-gray-400 italic">无相关记录</td></tr>) : (
                                            detailView?.items?.map((item) => (
                                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-4 font-mono text-gray-600 whitespace-nowrap">{item.date}</td>
                                                    <td className="p-4"><div className="font-bold text-[#1A1A1A]">{item.desc}</div><div className="text-[10px] text-gray-400 font-mono mt-0.5">{item.id}</div></td>
                                                    <td className="p-4"><span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${item.source === 'Settlement' ? 'bg-orange-50 text-orange-700' : item.source.startsWith('Payroll') ? 'bg-purple-50 text-purple-700' : item.source === 'Bill Payment' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{item.source}</span></td>
                                                    <td className="p-4 text-right font-mono font-black text-[#1A1A1A]">RM {Number(item.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                    <td className="p-4">{item.documentLink ? (<a href={item.documentLink} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" title="查看原档"><ExternalLink size={14} className="text-blue-600"/></a>) : null}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                <div className="md:hidden">
                                    {detailView?.items?.length === 0 ? (<div className="p-10 text-center text-gray-400 italic text-sm">无相关记录</div>) : (
                                        <div className="divide-y divide-gray-100">
                                            {detailView?.items?.map((item) => (
                                                <div key={item.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-2"><span className="text-[11px] font-mono font-bold text-gray-500">{item.date}</span><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${item.source === 'Settlement' ? 'bg-orange-50 text-orange-700' : item.source.startsWith('Payroll') ? 'bg-purple-50 text-purple-700' : item.source === 'Bill Payment' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{item.source}</span></div>
                                                        <span className="font-mono font-black text-[#1A1A1A] text-sm">RM {Number(item.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-[#1A1A1A] leading-snug">{item.desc}</p>
                                                    <div className="flex items-center justify-between mt-1.5">
                                                        <span className="text-[10px] text-gray-400 font-mono truncate max-w-[70%]">{item.id}</span>
                                                        {item.documentLink ? (<a href={item.documentLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg active:scale-95 transition-transform" onClick={(e) => e.stopPropagation()}><ExternalLink size={11}/> 查看原档</a>) : null}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 pb-[max(env(safe-area-inset-bottom),1rem)] bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
                                <span className="text-xs font-bold text-gray-500 uppercase">Total Selected</span>
                                <span className="text-xl font-black font-mono text-[#1A1A1A]">RM {Number(detailView?.items?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};