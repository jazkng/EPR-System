import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CreditCard, Calendar, Clock, DollarSign, Filter, CheckCircle2, AlertTriangle, X, Link as LinkIcon, Loader2, Plus, Save, Edit3, Trash2, Cloud, Clipboard, Search, ArrowLeft, ChevronRight, Hash, Tag, MoreHorizontal, ExternalLink, MessageSquare, List, CalendarDays, FileDown, Printer, User, Layers, Box, Wrench, Briefcase, CalendarRange, Wallet, RefreshCw, Square, CheckSquare, ListChecks, Settings2, ChevronDown, RotateCcw, Scissors, FileText, PenTool } from 'lucide-react';
import { ExpenseItem, Supplier, SettlementRecord, Employee } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { collection, getDocs, doc, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import { ModuleGuideButton } from '../ui/ModuleGuide';

interface AccountsPayableModuleProps {
    onClose: () => void;
}

// --- NEW ACCOUNTING STRUCTURE ---
const ACCOUNTING_CATEGORIES: Record<string, { label: string, options: {id: string, label: string}[] }> = {
    'COGS (销货成本 - 随销量浮动)': {
        label: 'COGS (Cost of Goods Sold)',
        options: [
            { id: 'INGREDIENT_MEAT', label: '食材-肉类 (Meat)' },
            { id: 'INGREDIENT_SEAFOOD', label: '食材-海鲜 (Seafood)' },
            { id: 'INGREDIENT_VEG', label: '食材-蔬果 (Veg/Fruit)' },
            { id: 'INGREDIENT_DRY', label: '食材-干货 (Dry Goods)' },
            { id: 'INGREDIENT_SAUCE', label: '食材-酱料 (Sauce)' },
            { id: 'INGREDIENT_NOODLE', label: '食材-面条 (Noodle/Rice)' },
            { id: 'INGREDIENT_OIL', label: '食材-油类 (Cooking Oil)' },
            { id: 'INGREDIENT_EGG', label: '食材-蛋类 (Eggs)' },
            { id: 'INGREDIENT_FROZEN', label: '食材-冷冻品 (Frozen)' },
            { id: 'BEVERAGE', label: '水吧原料 (Beverage)' },
            { id: 'PACKAGING', label: '包装材料 (Packaging)' },
            { id: 'GAS_COGS', label: '烹饪煤气 (Cooking Gas)' },
            { id: 'SUPPLIER', label: '一般进货 (General)' },
            { id: 'SUPPLIER_HQ', label: '总店进货 (HQ Supply)' }
        ]
    },
    'OPEX (营运开支 - 固定/半固定)': {
        label: 'OPEX (Operating Expenses)',
        options: [
            { id: 'SALARY', label: '薪资 (Salary)' },
            { id: 'STAFF_MEAL', label: '员工餐 (Staff Meal)' },
            { id: 'STAFF_ACCOMMODATION', label: '员工住宿 (Staff Housing)' },
            { id: 'MAINTENANCE', label: '维修保养 (Maintenance)' },
            { id: 'PEST_CONTROL', label: '虫害防治 (Pest Control)' },
            { id: 'CLEANING', label: '清洁服务 (Cleaning Service)' },
            { id: 'WASTE', label: '垃圾处理 (Waste Disposal)' },
            { id: 'MARKETING', label: '营销广告 (Marketing)' },
            { id: 'PROFESSIONAL', label: '专业服务/律师 (Professional/Legal)' },
            { id: 'ACCOUNTING', label: '会计服务 (Accounting)' },
            { id: 'BANK_FEE', label: '银行抽佣/手续费 (Bank & Merchant Fees)' }, // 🟢 新增：银行抽佣分类
            { id: 'INSURANCE', label: '保险 (Insurance)' },
            { id: 'SUPPLIES', label: '杂项耗材 (Supplies)' },
            { id: 'LOGISTICS', label: '物流运输 (Logistics)' },
            { id: 'TRANSPORT', label: '交通/油费 (Transport/Fuel)' },
            { id: 'PRINTING', label: '印刷品 (Printing)' },
            { id: 'MISC_OPEX', label: '其他杂费 (Miscellaneous)' }
        ]
    },
    'CAPEX (资本支出 - 资产增加)': {
        label: 'CAPEX (Capital Expenditure)',
        options: [
            { id: 'EQUIPMENT', label: '设备采购 (Equipment)' },
            { id: 'KITCHEN_EQUIPMENT', label: '厨房设备 (Kitchen Equipment)' },
            { id: 'FURNITURE', label: '家具/桌椅 (Furniture)' },
            { id: 'RENOVATION', label: '装修工程 (Renovation)' },
            { id: 'IT_SYSTEM', label: '电脑/系统 (IT/POS System)' },
            { id: 'DEPOSIT', label: '押金 (Deposit)' },
            { id: 'SIGNAGE', label: '招牌/装饰 (Signage/Décor)' }
        ]
    }
};

const FLAT_CATEGORIES = Object.values(ACCOUNTING_CATEGORIES).flatMap(g => g.options);

const TABS = [
    { id: 'UNPAID', label: '未付 (Unpaid)', color: 'text-red-600 border-red-600 bg-red-50' },
    { id: 'PARTIAL', label: '部分 (Partial)', color: 'text-orange-600 border-orange-600 bg-orange-50' },
    { id: 'PAID', label: '已付 (Paid)', color: 'text-green-600 border-green-600 bg-green-50' },
    { id: 'ALL', label: '全部 (All)', color: 'text-gray-800 border-gray-800 bg-gray-100' }
];

const getQuickDateRange = (type: 'TODAY' | 'YESTERDAY' | 'LAST_MONTH' | 'THIS_MONTH' | 'THIS_WEEK') => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (type === 'TODAY') {} 
    else if (type === 'YESTERDAY') { start.setDate(now.getDate() - 1); end.setDate(now.getDate() - 1); } 
    else if (type === 'THIS_WEEK') { const day = now.getDay() || 7; start.setDate(now.getDate() - day + 1); end.setDate(start.getDate() + 6); } 
    else if (type === 'THIS_MONTH') { start.setDate(1); end.setMonth(end.getMonth() + 1); end.setDate(0); } 
    else if (type === 'LAST_MONTH') { start.setDate(1); start.setMonth(start.getMonth() - 1); end.setDate(0); }
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
};

export const AccountsPayableModule: React.FC<AccountsPayableModuleProps> = ({ onClose }) => {
    const [allBills, setAllBills] = useState<ExpenseItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'LIST' | 'SUPPLIER_DETAIL'>('LIST');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'UNPAID' | 'PARTIAL' | 'PAID' | 'ALL'>('UNPAID');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });
    const [selectedTag, setSelectedTag] = useState<string>('ALL');
    const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());
    const [isBatchPayModalOpen, setIsBatchPayModalOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBill, setEditingBill] = useState<Partial<ExpenseItem>>({});
    const [newTagInput, setNewTagInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [displayLimit, setDisplayLimit] = useState(50);
    const [payModalData, setPayModalData] = useState<ExpenseItem | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
    const printRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [printData, setPrintData] = useState<ExpenseItem[]>([]);
    
    // Self-Issued Voucher State
    const [isVoucherMode, setIsVoucherMode] = useState(false);
    const [showVoucherConfirm, setShowVoucherConfirm] = useState(false);
    const voucherRef = useRef<HTMLDivElement>(null);
    const [printingVoucher, setPrintingVoucher] = useState<ExpenseItem | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sups, emps] = await Promise.all([DataManager.getSuppliers(), DataManager.getEmployees()]);
            setSuppliers(sups);
            setEmployees(emps);
            
            const settlements = await DataManager.getSettlements();
            let expenses: ExpenseItem[] = [];
            
            settlements.forEach(s => { 
                if (s.expenses) expenses.push(...s.expenses.map(e => ({...e, settlementId: s.id}))); 
            });
            
            const snap = await getDocs(collection(db, 'standalone_expenses'));
            snap.forEach(doc => { expenses.push(doc.data() as ExpenseItem); });
            
            const unique = Array.from(new Map(expenses.map(item => [item.id, item])).values());
            unique.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            
            setAllBills(unique);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const filteredBills = useMemo(() => {
        setDisplayLimit(50); 
        // 🟢 核心过滤：将所有 pay_xxx (子付款记录) 从 UI 中隐藏，防止列表双重污染
        let list = allBills.filter(b => !b.id.startsWith('pay_'));

        if (activeTab !== 'ALL') list = list.filter(b => b.paymentStatus === activeTab);
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(b => {
                const sup = suppliers.find(s => s.name === b.company);
                const supIdMatch = sup?.id.toLowerCase().includes(lower);
                return b.company.toLowerCase().includes(lower) || b.note?.toLowerCase().includes(lower) || b.id.toLowerCase().includes(lower) || supIdMatch;
            });
        }
        if (dateRange.start) list = list.filter(b => b.time >= dateRange.start);
        if (dateRange.end) list = list.filter(b => b.time <= dateRange.end + 'T23:59:59');
        if (selectedTag !== 'ALL') list = list.filter(b => b.tags?.includes(selectedTag));
        if (viewMode === 'SUPPLIER_DETAIL' && selectedSupplierId) {
            const sup = suppliers.find(s => s.id === selectedSupplierId);
            if (sup) list = list.filter(b => b.company === sup.name);
        }
        return list;
    }, [allBills, activeTab, searchTerm, dateRange, selectedTag, viewMode, selectedSupplierId, suppliers]);

    const unpaidFilteredBills = useMemo(() => filteredBills.filter(b => b.paymentStatus !== 'PAID'), [filteredBills]);

    const stats = useMemo(() => {
        const total = filteredBills.reduce((acc, b) => acc + (b.totalBillAmount || b.amount || 0), 0);
        const outstanding = filteredBills.reduce((acc, b) => acc + (b.outstandingAmount || 0), 0);
        const cn = filteredBills.reduce((acc, b) => acc + (b.creditNote || 0), 0);
        return { total, outstanding, cn, count: filteredBills.length };
    }, [filteredBills]);

    const availableTags = useMemo(() => {
        const tagSet = new Set<string>();
        allBills.forEach(b => b.tags?.forEach(t => tagSet.add(t)));
        return Array.from(tagSet).sort();
    }, [allBills]);

    const handleOpenForm = (bill?: ExpenseItem) => {
        setNewTagInput('');
        setShowDeleteConfirm(false);
        setIsVoucherMode(false);
        setShowVoucherConfirm(false);
        if (bill) {
            setEditingBill({ ...bill, tags: bill.tags || [], creditNote: bill.creditNote || 0 });
            if (bill.tags?.includes('SELF_ISSUED')) setIsVoucherMode(true);
        } else {
            setEditingBill({ id: '', company: '', category: 'SUPPLIES', amount: 0, totalBillAmount: 0, creditNote: 0, paymentStatus: 'UNPAID', time: new Date().toISOString(), tags: [], linkUrl: '', note: '', paymentMethod: 'BANK_TRANSFER', paidBy: 'COMPANY', isAdvancePayment: false });
        }
        setIsFormOpen(true);
    };

    const handleAddCustomTag = () => {
        if (!newTagInput.trim()) return;
        const current = editingBill.tags || [];
        const cleanTag = newTagInput.trim();
        if (!current.includes(cleanTag)) setEditingBill({ ...editingBill, tags: [...current, cleanTag] });
        setNewTagInput('');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        const current = editingBill.tags || [];
        setEditingBill({ ...editingBill, tags: current.filter(t => t !== tagToRemove) });
    };

    const handleSave = async () => {
        if (!editingBill.company || editingBill.totalBillAmount === undefined) return alert("Please fill required fields (Payee & Amount)");
        setIsSaving(true);
        try {
            const normalizedName = editingBill.company.trim();
            if (!isVoucherMode) {
                const existingSupplier = suppliers.find(s => s.name.toLowerCase() === normalizedName.toLowerCase());
                if (!existingSupplier) {
                    const numericIds = suppliers.map(s => parseInt(s.id)).filter(n => !isNaN(n));
                    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 8000;
                    const nextId = (maxId < 8000 ? 8001 : maxId + 1).toString();
                    const newSupplier: Supplier = { id: nextId, name: normalizedName, category: 'GENERAL', tags: editingBill.tags || [], contact: '', status: 'ACTIVE', paymentTerm: 'COD', note: 'Auto-created from Accounts Payable' };
                    await DataManager.saveSupplier(newSupplier);
                    setSuppliers(prev => [...prev, newSupplier]);
                }
            }

            const isPaid = editingBill.paymentStatus === 'PAID';
            const cn = Number(editingBill.creditNote) || 0;
            const fullTotal = Number(editingBill.totalBillAmount) || 0;
            // amount 始终代表实际发生的资金流出 (用于初始录入状态)
            const paidAmt = isPaid ? (fullTotal - cn) : (Number(editingBill.amount) || 0);
            
            const payDate = isPaid ? (editingBill.time || new Date().toISOString()) : undefined;

            let finalTags = editingBill.tags || [];
            if (isVoucherMode && !finalTags.includes('SELF_ISSUED')) finalTags = [...finalTags, 'SELF_ISSUED'];

            const rawBill: ExpenseItem = {
                ...editingBill as ExpenseItem,
                id: editingBill.id || `exp_${Date.now()}`,
                expenseType: 'GENERAL',
                category: editingBill.category || 'SUPPLIES',
                amount: paidAmt,
                creditNote: cn,
                outstandingAmount: isPaid ? 0 : Math.max(0, fullTotal - paidAmt - cn),
                time: editingBill.time || new Date().toISOString(),
                company: normalizedName,
                linkUrl: editingBill.linkUrl || '',
                paymentMethod: editingBill.paymentMethod || 'BANK_TRANSFER',
                paidBy: editingBill.paidBy || 'COMPANY',
                isAdvancePayment: editingBill.isAdvancePayment || false,
                tags: finalTags,
                paymentDate: payDate
            };
            
            const finalBill = JSON.parse(JSON.stringify(rawBill));

            if (finalBill.outstandingAmount! <= 0.1) finalBill.paymentStatus = 'PAID';
            else if (finalBill.outstandingAmount! < (fullTotal - cn)) finalBill.paymentStatus = 'PARTIAL';
            else finalBill.paymentStatus = 'UNPAID';

            await DataManager.saveStandaloneExpense(finalBill);
            if (finalBill.settlementId) await DataManager.updateExpenseInSettlement(finalBill.settlementId, finalBill);

            await loadData();
            setIsFormOpen(false);
        } catch (e) { console.error(e); alert("Error saving: " + e); } finally { setIsSaving(false); }
    };

    const handleDeleteBill = async () => {
        if (!editingBill.id) return;
        setIsSaving(true);
        try {
            // 🟢 核心防御：删除主单据前，必须连同其底下的所有分期付款子记录一并粉碎
            const linkedPayments = allBills.filter(b => b.id.startsWith(`pay_${editingBill.id}_`));
            for (const p of linkedPayments) {
                await deleteDoc(doc(db, 'standalone_expenses', p.id));
            }

            try { await deleteDoc(doc(db, 'standalone_expenses', editingBill.id)); } catch (err) {}

            if (editingBill.settlementId) {
                const ref = doc(db, 'settlements', editingBill.settlementId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data() as SettlementRecord;
                    const newExpenses = (data.expenses || []).filter(e => e.id !== editingBill.id);
                    await setDoc(ref, { ...data, expenses: newExpenses });
                }
            }

            await loadData();
            setIsFormOpen(false);
            setShowDeleteConfirm(false);
            alert("✅ 账单及其子付款记录已彻底删除 (Deleted)");
        } catch (e) { console.error("Delete failed", e); alert("Delete failed"); } finally { setIsSaving(false); }
    };

    const handlePasteLink = async () => {
        try { const text = await navigator.clipboard.readText(); if (text) setEditingBill(prev => ({ ...prev, linkUrl: text })); } catch (err) { alert("Clipboard permission denied"); }
    };

    // --- QUICK PAY LOGIC ---
    const handleQuickPay = async () => {
        if (!payModalData) return;
        if (!payMethod) return alert("Select Payment Method");

        const bill = payModalData;
        const currentOutstanding = bill.outstandingAmount !== undefined ? bill.outstandingAmount : (bill.totalBillAmount || 0);
        
        if (payAmount > currentOutstanding) return alert(`Amount exceeds outstanding balance (Max: ${currentOutstanding})`);

        const newOutstanding = currentOutstanding - payAmount;
        const newStatus = newOutstanding <= 0.1 ? 'PAID' : 'PARTIAL';
        const nowIso = new Date().toISOString();

        setIsSaving(true);
        try {
            if (bill.paymentStatus === 'UNPAID' || !bill.paymentStatus) {
                const updatedBill = {
                    ...bill,
                    amount: payAmount, // 记录首次支付现金流
                    outstandingAmount: newOutstanding,
                    paymentStatus: newStatus,
                    paymentMethod: payMethod,
                    paymentDate: nowIso,
                    note: (bill.note || '') + `\n[${nowIso.split('T')[0]}] Paid RM${payAmount} via ${payMethod}`
                };
                await DataManager.saveStandaloneExpense(updatedBill);
                if (updatedBill.settlementId) await DataManager.updateExpenseInSettlement(updatedBill.settlementId, updatedBill);

            } else {
                // 🟢 部分支付产生的尾款：单独开单，确保资金管理精准扣减
                const paymentRecord: ExpenseItem = {
                    id: `pay_${bill.id}_${Date.now()}`,
                    category: bill.category,
                    expenseType: 'GENERAL',
                    company: bill.company,
                    amount: payAmount,
                    totalBillAmount: 0, 
                    outstandingAmount: 0,
                    paymentStatus: 'PAID',
                    paymentMethod: payMethod,
                    time: nowIso,
                    note: `[Balance Pay] Ref: ${bill.company} (Inv #${bill.id.slice(-4)})`,
                    paidBy: 'COMPANY'
                };
                await DataManager.saveStandaloneExpense(paymentRecord);

                const updatedTracker = {
                    ...bill,
                    outstandingAmount: newOutstanding,
                    paymentStatus: newStatus,
                    note: (bill.note || '') + `\n[${nowIso.split('T')[0]}] Balance Paid RM${payAmount} via ${payMethod}`
                };
                await DataManager.saveStandaloneExpense(updatedTracker);
                if (updatedTracker.settlementId) await DataManager.updateExpenseInSettlement(updatedTracker.settlementId, updatedTracker);
            }

            setPayModalData(null);
            alert(`✅ Payment Recorded via ${payMethod === 'CASH' ? 'Cash' : 'Bank'}`);
            loadData();
        } catch (e) { console.error(e); alert("Payment Error"); } finally { setIsSaving(false); }
    };

    // 🟢 核心防御：撤销付款时，连同幽灵子账单一起清理
    const handleUndoPayment = async (bill: ExpenseItem) => {
        if (!confirm(`确定要撤销此账单的付款吗？状态将变回 "UNPAID"。\n(Undo Payment?)`)) return;
        setIsSaving(true);
        try {
            // 清理尾款单 (pay_xxx)
            const linkedPayments = allBills.filter(b => b.id.startsWith(`pay_${bill.id}_`));
            for (const p of linkedPayments) {
                await deleteDoc(doc(db, 'standalone_expenses', p.id));
            }

            const cn = bill.creditNote || 0;
            const originalTotal = bill.totalBillAmount !== undefined ? bill.totalBillAmount : (bill.amount || 0);
            
            // 使用正则清理之前自动加上去的 Paid 备注文本
            const cleanNote = (bill.note || '')
                .replace(/\[.*\] Paid.*via.*/g, '')
                .replace(/\[.*\] Balance Paid.*via.*/g, '')
                .replace(/\[.*\] Batch.*Paid.*via.*/g, '')
                .trim();

            const rawUpdated: ExpenseItem = {
                ...bill,
                amount: 0, // 钱收回，流出变0
                outstandingAmount: originalTotal - cn,
                totalBillAmount: originalTotal,
                paymentStatus: 'UNPAID',
                note: cleanNote + `\n[${new Date().toISOString().split('T')[0]}] Payment Reverted (Undo)`,
            };
            const updated = JSON.parse(JSON.stringify(rawUpdated));
            delete updated.paymentDate;

            await DataManager.saveStandaloneExpense(updated);
            if (updated.settlementId) await DataManager.updateExpenseInSettlement(updated.settlementId, updated);
            
            alert("✅ 付款已撤销 (Payment Undone)");
            loadData();
        } catch (e) { console.error(e); alert("Undo Failed"); } finally { setIsSaving(false); }
    };

    const handleBatchPay = async () => {
        if (!confirm(`Confirm pay ${selectedBillIds.size} bills via ${payMethod}?`)) return;
        setIsSaving(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const payTimestamp = new Date().toISOString();
            
            for (const id of selectedBillIds) {
                const bill = allBills.find(b => b.id === id);
                if (bill) {
                    const cn = bill.creditNote || 0;
                    
                    // 🟢 核心防御：智能区分 Partial 和 Unpaid 的批量支付动作
                    if (bill.paymentStatus === 'PARTIAL') {
                        // 创建子支付单以结清尾款
                        const paymentRecord: ExpenseItem = {
                            id: `pay_${bill.id}_${Date.now()}`,
                            category: bill.category,
                            expenseType: 'GENERAL',
                            company: bill.company,
                            amount: bill.outstandingAmount || 0,
                            totalBillAmount: 0, 
                            outstandingAmount: 0,
                            paymentStatus: 'PAID',
                            paymentMethod: payMethod,
                            time: payTimestamp,
                            note: `[Batch Balance Pay] Ref: ${bill.company} (Inv #${bill.id.slice(-4)})`,
                            paidBy: 'COMPANY'
                        };
                        await DataManager.saveStandaloneExpense(paymentRecord);

                        const updatedTracker = {
                            ...bill,
                            outstandingAmount: 0,
                            paymentStatus: 'PAID',
                            note: (bill.note || '') + `\n[${today}] Batch Balance Paid via ${payMethod}`
                        };
                        await DataManager.saveStandaloneExpense(updatedTracker);
                        if (updatedTracker.settlementId) await DataManager.updateExpenseInSettlement(updatedTracker.settlementId, updatedTracker);
                    } else {
                        // 正常的 UNPAID 直接写入 Amount
                        const rawUpdated: ExpenseItem = {
                            ...bill,
                            amount: (bill.totalBillAmount || bill.amount) - cn,
                            outstandingAmount: 0,
                            paymentStatus: 'PAID',
                            paymentMethod: payMethod,
                            note: (bill.note || '') + `\n[${today}] Batch Paid via ${payMethod}`,
                            paymentDate: payTimestamp 
                        };
                        const updated = JSON.parse(JSON.stringify(rawUpdated));
                        await DataManager.saveStandaloneExpense(updated);
                        if (updated.settlementId) await DataManager.updateExpenseInSettlement(updated.settlementId, updated);
                    }
                }
            }
            alert(`✅ 批量支付成功！共 ${selectedBillIds.size} 笔账单。`);
            setSelectedBillIds(new Set());
            setIsBatchPayModalOpen(false);
            await loadData();
        } catch (e) { console.error("Batch Pay Error", e); alert("批量支付出错，请检查网络或重试。"); } finally { setIsSaving(false); }
    };

    const handleCompanyClick = (companyName: string) => {
        const sup = suppliers.find(s => s.name === companyName);
        if (sup) { setSelectedSupplierId(sup.id); setViewMode('SUPPLIER_DETAIL'); setActiveTab('ALL'); } 
        else setSearchTerm(companyName);
    };

    const applyQuickDate = (type: 'TODAY' | 'YESTERDAY' | 'LAST_MONTH' | 'THIS_MONTH' | 'THIS_WEEK') => { setDateRange(getQuickDateRange(type)); };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedBillIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedBillIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedBillIds.size === unpaidFilteredBills.length && unpaidFilteredBills.length > 0) setSelectedBillIds(new Set());
        else setSelectedBillIds(new Set(unpaidFilteredBills.map(b => b.id)));
    };

    const batchTotalAmount = useMemo(() => {
        let total = 0;
        selectedBillIds.forEach(id => {
            const bill = allBills.find(b => b.id === id);
            if (bill) total += (bill.outstandingAmount || 0);
        });
        return total;
    }, [selectedBillIds, allBills]);

    // --- PDF EXPORT (LIST) ---
    const handleExportPDF = async (itemsToPrint?: ExpenseItem[]) => {
        if (!printRef.current) return;
        const data = itemsToPrint || filteredBills;
        if (data.length === 0) return alert("没有可导出的数据 (No data to export)");
        setPrintData(data);
        setIsGeneratingPdf(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`AP_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) { console.error("PDF Gen Error:", err); alert("PDF 生成失败，请重试。"); } finally { setIsGeneratingPdf(false); }
    };

    // --- GENERATE VOUCHER PDF (SINGLE) ---
    const handleExportVoucherPDF = async () => {
        const tempVoucher = { 
            ...editingBill, 
            id: editingBill.id || `PV_${Date.now()}` 
        } as ExpenseItem;
        setPrintingVoucher(tempVoucher);
        setIsGeneratingPdf(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 800)); 
            if (!voucherRef.current) throw new Error("Template failed to render");
            const canvas = await html2canvas(voucherRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('p', 'mm', 'a5');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`PaymentVoucher_${(tempVoucher.id || 'draft').slice(-6)}.pdf`);
        } catch (err) { console.error("Voucher PDF Error", err); alert("凭证生成失败 (Failed to generate PDF)"); } finally { setIsGeneratingPdf(false); setPrintingVoucher(null); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-[#F5F7FA] w-full h-full md:max-w-6xl md:h-[95vh] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl relative font-sans">
                
                {/* === HEADER === */}
                <div className="bg-[#1A1A1A] px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700]">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="bg-[#FFD700] text-black p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-lg"><CreditCard size={18} className="sm:hidden"/><CreditCard size={24} className="hidden sm:block"/></div>
                        <div>
                            <h3 className="font-serif font-black text-base sm:text-xl tracking-wide">应付账款中心</h3>
                            <p className="text-[8px] sm:text-[10px] text-gray-400 font-mono uppercase tracking-widest">ACCOUNTS PAYABLE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <ModuleGuideButton module="AP" />
                        <button onClick={() => handleExportPDF(filteredBills)} disabled={isGeneratingPdf} className="bg-white/10 hover:bg-white/20 text-white p-2 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                            {isGeneratingPdf ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} <span className="hidden sm:inline">导出 PDF</span>
                        </button>
                        <button onClick={() => handleOpenForm()} className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black flex items-center gap-1.5 shadow-lg transition-all active:scale-95">
                            <Plus size={14}/> <span className="hidden sm:inline">录入新账单</span><span className="sm:hidden">新增</span>
                        </button>
                        <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
                    </div>
                </div>

                {/* === CONTROLS & FILTERS === */}
                <div className="bg-white border-b border-gray-200 shrink-0 shadow-sm z-10">
                    {viewMode === 'SUPPLIER_DETAIL' && (
                        <div className="flex items-center gap-4 px-4 pt-3 pb-1">
                            <button onClick={() => { setViewMode('LIST'); setSelectedSupplierId(null); setSearchTerm(''); setSelectedBillIds(new Set()); }} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><ArrowLeft size={20}/></button>
                            <div>
                                <h2 className="text-lg font-black text-[#1A1A1A]">{suppliers.find(s => s.id === selectedSupplierId)?.name}</h2>
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Supplier Account (ID: {selectedSupplierId})</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Row 1: Search + Filter Toggle (always visible) */}
                    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                            <input type="text" placeholder="🔍 搜索公司 / ID / 备注..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#FFD700] transition-all outline-none"/>
                            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full"><X size={14}/></button>}
                        </div>
                        <button onClick={() => setShowMobileFilters(!showMobileFilters)} className={`sm:hidden p-2.5 rounded-xl border transition-all shrink-0 ${showMobileFilters ? 'bg-[#1A1A1A] text-[#FFD700] border-[#FFD700]' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                            <Filter size={16}/>
                        </button>
                    </div>

                    {/* Row 2: Quick dates + Date range (collapsible on mobile) */}
                    <div className={`${showMobileFilters ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row gap-2 px-4 pb-2`}>
                        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                            {[{ label: '今日', value: 'TODAY' }, { label: '昨日', value: 'YESTERDAY' }, { label: '本周', value: 'THIS_WEEK' }, { label: '本月', value: 'THIS_MONTH' }, { label: '上月', value: 'LAST_MONTH' }].map(item => (
                                <button key={item.value} onClick={() => applyQuickDate(item.value as any)} className="px-2.5 py-1.5 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-lg text-[10px] font-bold whitespace-nowrap text-gray-500 transition-all">{item.label}</button>
                            ))}
                        </div>
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                            <CalendarRange size={12} className="text-gray-400 mx-1.5 shrink-0"/>
                            <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="bg-transparent text-[10px] font-bold p-1 outline-none text-gray-700 w-24 cursor-pointer"/>
                            <span className="text-gray-300 text-[10px]">→</span>
                            <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="bg-transparent text-[10px] font-bold p-1 outline-none text-gray-700 w-24 cursor-pointer"/>
                            {(dateRange.start || dateRange.end) && <button onClick={() => setDateRange({start:'', end:''})} className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400"><X size={10}/></button>}
                        </div>
                    </div>

                    {/* Row 3: Status tabs + actions */}
                    <div className="flex items-center justify-between gap-2 px-4 pb-3">
                        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-grow">
                            {TABS.map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? tab.color : 'bg-white text-gray-400 border-transparent hover:bg-gray-50'}`}>
                                    {tab.label.split(' ')[0]}
                                    {activeTab === tab.id && <span className="ml-1 text-[9px] opacity-70">{filteredBills.length}</span>}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                            {unpaidFilteredBills.length > 0 && <button onClick={handleSelectAll} className={`p-2 rounded-lg text-[10px] font-bold transition-all ${selectedBillIds.size > 0 && selectedBillIds.size === unpaidFilteredBills.length ? 'bg-[#1A1A1A] text-[#FFD700]' : 'bg-gray-100 text-gray-500'}`} title="全选未付"><ListChecks size={14}/></button>}
                            <div className="relative">
                                <select value={selectedTag} onChange={e => setSelectedTag(e.target.value)} className="bg-gray-50 border-none rounded-lg pl-2 pr-6 py-2 text-[10px] font-bold outline-none appearance-none w-20">
                                    <option value="ALL">🔖 All</option>
                                    {availableTags.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* === MAIN CONTENT === */}
                <div className="flex-grow overflow-y-auto p-3 md:p-6 bg-[#F5F7FA] pb-32">
                    {loading ? (
                        <div className="flex items-center justify-center h-40"><Loader2 size={32} className="animate-spin text-gray-400"/></div>
                    ) : filteredBills.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-300"><Filter size={64} className="mb-4 opacity-20"/><p className="font-black text-sm">没有找到相关账单</p></div>
                    ) : (
                        <>
                            {/* MOBILE: Compact Row Layout */}
                            <div className="sm:hidden space-y-1.5">
                                {filteredBills.slice(0, displayLimit).map(bill => {
                                    const isPaid = bill.paymentStatus === 'PAID';
                                    const isOverdue = !isPaid && new Date() > new Date(bill.dueDate || '9999-12-31');
                                    const sup = suppliers.find(s => s.name === bill.company);
                                    const isSelected = selectedBillIds.has(bill.id);
                                    const amt = bill.totalBillAmount || bill.amount || 0;
                                    const outstanding = bill.outstandingAmount || 0;
                                    return (
                                        <div 
                                            key={bill.id}
                                            onClick={() => { if (!isPaid) toggleSelection(bill.id); }}
                                            className={`bg-white rounded-xl p-3 flex items-center gap-3 border-l-4 transition-all active:scale-[0.99] ${isPaid ? 'border-l-green-500' : isOverdue ? 'border-l-red-500' : 'border-l-orange-400'} ${isSelected ? 'ring-2 ring-[#FFD700] ring-offset-1' : ''}`}
                                        >
                                            {/* Checkbox */}
                                            {!isPaid && (
                                                <div className={`w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center ${isSelected ? 'bg-[#1A1A1A] border-[#1A1A1A] text-[#FFD700]' : 'border-gray-300'}`}>
                                                    {isSelected && <CheckSquare size={12} strokeWidth={3}/>}
                                                </div>
                                            )}
                                            {/* Company + Category */}
                                            <div className="flex-grow min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-sm text-[#1A1A1A] truncate">{bill.company}</span>
                                                    {sup && <span className="bg-[#FFD700] text-black text-[8px] font-mono px-1 py-0.5 rounded font-bold shrink-0">{sup.id}</span>}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[9px] text-gray-400 font-mono">{bill.time.split('T')[0]}</span>
                                                    {bill.category && <span className="text-[8px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded font-bold truncate max-w-[80px]">{FLAT_CATEGORIES.find(c => c.id === bill.category)?.label.split('(')[0] || bill.category}</span>}
                                                </div>
                                            </div>
                                            {/* Amount */}
                                            <div className="text-right shrink-0">
                                                <div className="text-xs font-black font-mono text-[#1A1A1A]">RM {amt.toFixed(2)}</div>
                                                {!isPaid && outstanding > 0 && (
                                                    <div className="text-[9px] font-bold text-red-500 font-mono">欠 {outstanding.toFixed(2)}</div>
                                                )}
                                                {isPaid && <div className="text-[9px] font-bold text-green-600">✓ Paid</div>}
                                            </div>
                                            {/* Action buttons */}
                                            <div className="flex flex-col gap-1 shrink-0">
                                                {!isPaid ? (
                                                    <button onClick={(e) => { e.stopPropagation(); setPayModalData(bill); setPayAmount(outstanding); }} className="bg-[#1A1A1A] text-[#FFD700] px-2 py-1 rounded-md text-[9px] font-black">Pay</button>
                                                ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); handleUndoPayment(bill); }} className="bg-yellow-50 text-yellow-600 border border-yellow-200 px-1.5 py-1 rounded-md text-[9px] font-bold"><RotateCcw size={10}/></button>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenForm(bill); }} className="bg-gray-100 text-gray-500 px-2 py-1 rounded-md text-[9px]"><Edit3 size={10}/></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* DESKTOP/TABLET: Card Layout */}
                            <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredBills.slice(0, displayLimit).map(bill => {
                                    const isPaid = bill.paymentStatus === 'PAID';
                                    const isOverdue = !isPaid && new Date() > new Date(bill.dueDate || '9999-12-31');
                                    const sup = suppliers.find(s => s.name === bill.company);
                                    const isSelected = selectedBillIds.has(bill.id);
                                    return (
                                    <div key={bill.id} className={`bg-white rounded-[1.5rem] p-5 shadow-sm border-l-[6px] transition-all hover:shadow-lg group relative ${isPaid ? 'border-l-green-500' : isOverdue ? 'border-l-red-500' : 'border-l-orange-400'} ${isSelected ? 'ring-2 ring-offset-2 ring-[#FFD700]' : ''}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                {!isPaid && <button onClick={(e) => { e.stopPropagation(); toggleSelection(bill.id); }} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#1A1A1A] border-[#1A1A1A] text-[#FFD700]' : 'border-gray-300 bg-white hover:border-gray-400'}`}>{isSelected ? <CheckSquare size={16} strokeWidth={3}/> : <Square size={16} className="text-transparent"/>}</button>}
                                                <div className="flex flex-col"><div className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1"><Calendar size={10}/> {bill.time.split('T')[0]}</div><div className="text-[9px] font-mono text-gray-300 mt-0.5">{bill.id}</div></div>
                                            </div>
                                            {bill.linkUrl && <a href={bill.linkUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-lg transition-colors" title="View Document"><ExternalLink size={14}/></a>}
                                        </div>
                                        <div className="mb-4 cursor-pointer" onClick={() => { if(!isPaid) toggleSelection(bill.id); else handleCompanyClick(bill.company); }}>
                                            <div className="flex items-center gap-2 mb-1"><h4 className="font-black text-lg text-blue-900 leading-tight group-hover:text-blue-700 transition-colors truncate">{bill.company}</h4>{sup && <span className="bg-[#FFD700] text-black text-[10px] font-mono px-2 py-0.5 rounded border border-[#FFD700] font-black shadow-sm">{sup.id}</span>}</div>
                                            {bill.paidBy && bill.paidBy !== 'COMPANY' && <div className="flex items-center gap-1 mb-1.5"><span className={`text-[10px] px-2 py-0.5 rounded border font-black flex items-center gap-1 ${bill.isAdvancePayment ? 'bg-purple-100 text-purple-700 border-purple-200 animate-pulse' : 'bg-gray-100 text-gray-600 border-gray-200'}`}><User size={10}/> {bill.paidBy} {bill.isAdvancePayment ? '垫付 (Adv)' : '付款'}</span></div>}
                                            <div className="flex flex-wrap gap-1 mt-1.5 items-center">{bill.category && <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-100">{FLAT_CATEGORIES.find(c => c.id === bill.category)?.label.split('(')[0] || bill.category}</span>}{bill.tags?.slice(0,3).map(t => <span key={t} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">#{t}</span>)}</div>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-3 border border-gray-100">
                                            <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                                                <div className="text-[9px] text-gray-400 font-bold uppercase">Bill Total</div>
                                                <div className="text-sm font-black text-[#1A1A1A]">RM {(bill.totalBillAmount || bill.amount || 0).toFixed(2)}</div>
                                            </div>
                                            {bill.creditNote && bill.creditNote > 0 && (
                                                <div className="flex justify-between items-center text-[10px] text-orange-600 font-bold">
                                                    <span>Credit Note / 折扣</span>
                                                    <span>- RM {bill.creditNote.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <div className="text-[9px] text-gray-400 font-bold uppercase">Balance Due</div>
                                                <div className={`text-base font-black ${isPaid ? 'text-green-600' : 'text-red-600'}`}>RM {(bill.outstandingAmount || 0).toFixed(2)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!isPaid ? <button onClick={() => { setPayModalData(bill); setPayAmount(bill.outstandingAmount || 0); }} className="flex-1 bg-[#1A1A1A] text-[#FFD700] py-2 rounded-lg text-xs font-black shadow-md hover:bg-black transition-all active:scale-95">Pay Now</button> : <button onClick={() => handleUndoPayment(bill)} className="flex-1 bg-yellow-50 text-yellow-600 border border-yellow-200 py-2 rounded-lg text-xs font-bold hover:bg-yellow-100 transition-colors flex items-center justify-center gap-1" title="撤销付款 (Undo Payment)"><RotateCcw size={14}/> Undo Pay</button>}
                                            <button onClick={() => handleOpenForm(bill)} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"><Edit3 size={14}/></button>
                                        </div>
                                    </div>
                                )
                                })}
                            </div>

                            {/* Load More Button */}
                            {filteredBills.length > displayLimit && (
                                <div className="flex justify-center mt-4 mb-8">
                                    <button 
                                        onClick={() => setDisplayLimit(prev => prev + 50)} 
                                        className="bg-white border border-gray-200 text-gray-600 px-6 py-3 rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <ChevronDown size={14}/> 加载更多 ({displayLimit} / {filteredBills.length})
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* === BATCH PAYMENT BAR === */}
                {selectedBillIds.size > 0 && (
                    <div className="absolute bottom-14 sm:bottom-20 left-2 right-2 sm:left-4 sm:right-4 md:left-1/2 md:-translate-x-1/2 md:w-[600px] z-30 animate-in slide-in-from-bottom-10 fade-in duration-300">
                        <div className="bg-[#1A1A1A] text-white px-3 py-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-4 border border-[#FFD700]/30">
                            {/* Count badge */}
                            <div className="bg-[#FFD700] text-black w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center font-black text-sm sm:text-base shrink-0">{selectedBillIds.size}</div>
                            {/* Amount */}
                            <div className="flex-grow min-w-0">
                                <p className="text-[8px] sm:text-[10px] text-gray-400 uppercase font-bold tracking-wider">Selected</p>
                                <p className="text-base sm:text-xl font-mono font-black text-[#FFD700] truncate">RM {batchTotalAmount.toFixed(2)}</p>
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                <button onClick={() => setSelectedBillIds(new Set())} className="text-[10px] sm:text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 font-bold">✕</button>
                                <button onClick={() => handleExportPDF(allBills.filter(b => selectedBillIds.has(b.id)))} disabled={isGeneratingPdf} className="bg-white/10 p-2 rounded-lg text-[#FFD700]" title="导出选中">
                                    {isGeneratingPdf ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>}
                                </button>
                                <button onClick={() => setIsBatchPayModalOpen(true)} className="bg-[#FFD700] text-black px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-black shadow-lg hover:bg-white transition-all active:scale-95 flex items-center gap-1.5">
                                    <CheckCircle2 size={14}/> <span className="hidden sm:inline">批量支付</span><span className="sm:hidden">支付</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* === FOOTER STATS === */}
                {selectedBillIds.size === 0 && (
                    <div className="bg-white border-t border-gray-200 p-3 sm:p-4 shrink-0 flex justify-between items-center safe-area-bottom">
                        <div className="text-[10px] sm:text-xs font-bold text-gray-500">
                            {filteredBills.length > displayLimit ? `显示 ${displayLimit} / ${filteredBills.length}` : `共 ${stats.count} 笔`}
                        </div>
                        <div className="flex gap-3 sm:gap-6 text-right">
                            {stats.cn > 0 && <div><div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-black">Credit</div><div className="text-xs sm:text-sm font-black text-orange-600 font-mono">RM {stats.cn.toLocaleString()}</div></div>}
                            <div><div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-black">Total</div><div className="text-xs sm:text-sm font-black text-[#1A1A1A] font-mono">RM {stats.total.toLocaleString()}</div></div>
                            <div><div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-black">Outstanding</div><div className="text-sm sm:text-lg font-black text-red-600 font-mono">RM {stats.outstanding.toLocaleString()}</div></div>
                        </div>
                    </div>
                )}

                {/* MODALS: BATCH, FORM, DELETE, PAY, PDF... */}
                {isBatchPayModalOpen && (
                    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95"><h3 className="font-black text-xl text-[#1A1A1A] mb-2">批量支付确认</h3><p className="text-sm text-gray-500 font-bold mb-6">即将支付 {selectedBillIds.size} 笔账单</p><div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 text-center"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Total Payment</p><p className="text-3xl font-black font-mono text-green-600">RM {batchTotalAmount.toFixed(2)}</p></div><div className="mb-6"><label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Payment Method (资金来源)</label><select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full p-4 bg-gray-50 rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-[#FFD700]"><option value="BANK_TRANSFER">Bank Transfer (银行转账)</option><option value="CASH">Cash (现金支付)</option><option value="CHEQUE">Cheque (支票)</option><option value="DUITNOW">DuitNow / QR</option></select></div><button onClick={handleBatchPay} disabled={isSaving} className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-lg shadow-lg hover:bg-black flex items-center justify-center gap-2">{isSaving ? <Loader2 size={20} className="animate-spin"/> : <CheckCircle2 size={20}/>} 确认支付 (Confirm)</button><button onClick={() => setIsBatchPayModalOpen(false)} className="w-full py-3 mt-2 text-gray-400 text-xs font-bold hover:text-black">取消 (Cancel)</button></div>
                    </div>
                )}

                {isFormOpen && (
                    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto relative">
                            <div className="flex justify-between items-center mb-6"><h3 className="font-black text-xl text-[#1A1A1A]">{editingBill.id ? '编辑账单' : '录入新账单'}</h3><button onClick={() => setIsFormOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button></div>
                            
                            {/* --- TYPE SWITCHER --- */}
                            <div className="bg-gray-100 p-1 rounded-xl flex mb-4">
                                <button onClick={() => setIsVoucherMode(false)} className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${!isVoucherMode ? 'bg-white shadow text-[#1A1A1A]' : 'text-gray-400 hover:text-gray-600'}`}>
                                    Supplier Invoice (外部账单)
                                </button>
                                <button onClick={() => setIsVoucherMode(true)} className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${isVoucherMode ? 'bg-[#1A1A1A] text-[#FFD700] shadow' : 'text-gray-400 hover:text-gray-600'}`}>
                                    Self-Issued Voucher (自行开单)
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                                        {isVoucherMode ? 'Pay To (支付给)' : 'Company / Supplier (自动创建供应商)'}
                                    </label>
                                    <input list="suppliers_list" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-[#FFD700]" value={editingBill.company} onChange={e => setEditingBill({ ...editingBill, company: e.target.value })} placeholder="Type name..." />
                                    <datalist id="suppliers_list">{suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(s => (<option key={s.id} value={s.name}>{s.id} - {s.name}</option>))}</datalist>
                                </div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Date</label><input type="date" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={editingBill.time?.split('T')[0]} onChange={e => setEditingBill({...editingBill, time: e.target.value})} /></div><div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Due Date</label><input type="date" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={editingBill.dueDate} onChange={e => setEditingBill({...editingBill, dueDate: e.target.value})} /></div></div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                                            {isVoucherMode ? 'Amount (金额)' : 'Invoice Total (RM)'}
                                        </label>
                                        <input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-black text-lg outline-none focus:bg-white focus:ring-2 focus:ring-[#FFD700]" value={editingBill.totalBillAmount || ''} onChange={e => setEditingBill({...editingBill, totalBillAmount: parseFloat(e.target.value)})} placeholder="0.00" />
                                    </div>
                                    <div className="bg-orange-50 p-2 rounded-xl border border-orange-100">
                                        <label className="text-[10px] font-black text-orange-600 uppercase mb-1 block flex items-center gap-1"><Scissors size={10}/> Credit Note / 折扣</label>
                                        <input type="number" className="w-full p-1 bg-white rounded-lg font-black text-base text-orange-700 outline-none" value={editingBill.creditNote || ''} onChange={e => setEditingBill({...editingBill, creditNote: parseFloat(e.target.value) || 0})} placeholder="0.00" />
                                    </div>
                                </div>
                                
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block flex items-center gap-1"><LinkIcon size={12}/> Document Link (Google Drive / Photo)</label><div className="flex gap-2"><input type="text" className="flex-grow p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none" value={editingBill.linkUrl || ''} onChange={e => setEditingBill({...editingBill, linkUrl: e.target.value})} placeholder="https://..." /><button onClick={handlePasteLink} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200"><Clipboard size={16}/></button></div></div>
                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 relative group-focus-within:border-blue-300 transition-colors"><label className="text-[10px] font-black text-blue-600 uppercase mb-2 block flex items-center gap-1"><Tag size={12}/> 标签管理 (Tags)</label><div className="flex flex-wrap gap-2 mb-3">{editingBill.tags?.map(tag => (<span key={tag} className="bg-white text-black px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-gray-200 shadow-sm">#{tag} <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-600 ml-1 bg-gray-100 rounded-full p-0.5"><X size={10}/></button></span>))}{(!editingBill.tags || editingBill.tags.length === 0) && <span className="text-xs text-gray-400 italic">暂无标签</span>}</div><div className="flex gap-2 mb-3"><input type="text" value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} className="flex-grow p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all" placeholder="输入新标签..." onKeyDown={e => { if(e.key === 'Enter') handleAddCustomTag(); }} /><button onClick={handleAddCustomTag} className="bg-blue-600 text-white px-3 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm transition-colors">添加 (Add)</button></div></div>
                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4"><div><label className="text-[10px] font-bold text-blue-600 uppercase mb-1 block flex items-center gap-1"><Layers size={12}/> Category (会计科目 - 必选)</label><select className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD700] text-[#1A1A1A]" value={editingBill.category || ''} onChange={e => setEditingBill({...editingBill, category: e.target.value})}><option value="">-- Select Category --</option>{Object.entries(ACCOUNTING_CATEGORIES).map(([group, { options }]) => (<optgroup key={group} label={group}>{options.map(opt => (<option key={opt.id} value={opt.id}>{opt.label}</option>))}</optgroup>))}</select></div><div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block flex items-center gap-1"><MessageSquare size={12}/> {isVoucherMode ? 'Description / Particulars' : 'Note'}</label><textarea className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none resize-none h-20" placeholder="Notes..." value={editingBill.note || ''} onChange={e => setEditingBill({...editingBill, note: e.target.value})}/></div></div>
                                
                                {isVoucherMode && (
                                    <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-200">
                                        <h4 className="text-xs font-black text-yellow-800 mb-2 flex items-center gap-2"><FileText size={14}/> 凭证模式 (Voucher Mode)</h4>
                                        
                                        {!showVoucherConfirm ? (
                                            <>
                                                <button 
                                                    onClick={() => setShowVoucherConfirm(true)}
                                                    disabled={isGeneratingPdf}
                                                    className="w-full py-3 bg-white border border-yellow-300 text-yellow-800 rounded-xl font-bold text-xs shadow-sm hover:bg-yellow-100 flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {isGeneratingPdf ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} 生成并下载 PDF (Download)
                                                </button>
                                                <p className="text-[9px] text-yellow-600 mt-2 text-center">生成后请保存记录以上传云端</p>
                                            </>
                                        ) : (
                                            <div className="bg-white/80 p-3 rounded-xl border border-yellow-300 animate-in fade-in slide-in-from-top-1 text-center">
                                                <p className="text-xs font-black text-yellow-900 mb-3 flex items-center justify-center gap-1"><AlertTriangle size={12}/> 确认生成 PDF?</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                     <button 
                                                        onClick={() => setShowVoucherConfirm(false)}
                                                        className="py-2 bg-white border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50"
                                                    >
                                                        取消 (Cancel)
                                                    </button>
                                                    <button 
                                                        onClick={() => { setShowVoucherConfirm(false); handleExportVoucherPDF(); }}
                                                        className="py-2 bg-yellow-400 text-black rounded-lg text-xs font-black shadow-md hover:bg-yellow-500 active:scale-95 transition-transform"
                                                    >
                                                        确认 (Confirm)
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 space-y-4"><h4 className="text-xs font-black text-orange-800 uppercase flex items-center gap-2"><DollarSign size={14}/> Payment Details</h4><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-orange-700 uppercase mb-1 block">Status</label><select className="w-full p-2 bg-white border border-orange-200 rounded-lg text-xs font-bold outline-none" value={editingBill.paymentStatus} onChange={e => setEditingBill({...editingBill, paymentStatus: e.target.value as any})}><option value="UNPAID">UNPAID (未付)</option><option value="PAID">PAID (已付)</option><option value="PARTIAL">PARTIAL (部分)</option></select></div>{editingBill.paymentStatus === 'PAID' && (<div><label className="text-[10px] font-bold text-orange-700 uppercase mb-1 block">Method</label><select className="w-full p-2 bg-white border border-orange-200 rounded-lg text-xs font-bold outline-none" value={editingBill.paymentMethod} onChange={e => setEditingBill({...editingBill, paymentMethod: e.target.value})}><option value="BANK_TRANSFER">Bank Transfer</option><option value="CASH">Cash</option><option value="CHEQUE">Cheque</option><option value="DUITNOW">DuitNow/QR</option></select></div>)}</div>{editingBill.paymentStatus === 'PAID' && (<div><label className="text-[10px] font-bold text-orange-700 uppercase mb-1 block">Paid By (Who?)</label><select className="w-full p-2 bg-white border border-orange-200 rounded-lg text-xs font-bold outline-none" value={editingBill.paidBy || 'COMPANY'} onChange={e => setEditingBill({...editingBill, paidBy: e.target.value})}><option value="COMPANY">Company (公款)</option>{employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}</select>{editingBill.paidBy !== 'COMPANY' && <label className="flex items-center gap-2 mt-2 text-xs font-bold text-orange-800 cursor-pointer"><input type="checkbox" checked={editingBill.isAdvancePayment} onChange={e => setEditingBill({...editingBill, isAdvancePayment: e.target.checked})} className="accent-orange-600"/>Mark as Staff Advance (垫付)</label>}</div>)}</div>
                                <div className="mt-6 flex gap-3">{editingBill.id && (<button onClick={() => setShowDeleteConfirm(true)} className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors"><Trash2 size={20}/></button>)}<button onClick={handleSave} disabled={isSaving} className="flex-grow bg-[#1A1A1A] text-[#FFD700] py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-black flex items-center justify-center gap-2">{isSaving ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>} 保存账单</button></div>
                            </div>
                        </div>
                    </div>
                )}

                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white w-full max-sm rounded-2xl p-6 shadow-2xl text-center border-t-4 border-red-500 animate-in zoom-in-95"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><Trash2 size={32}/></div><h3 className="font-black text-xl text-[#1A1A1A] mb-2">确认删除此账单?</h3><p className="text-xs text-gray-500 font-bold mb-6">此操作无法撤销。及其相关的部分付款记录将被永久删除！</p><div className="grid grid-cols-2 gap-3"><button onClick={() => setShowDeleteConfirm(false)} className="py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-200">取消</button><button onClick={handleDeleteBill} disabled={isSaving} className="py-3 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 shadow-lg">确认彻底删除</button></div></div></div>
                )}

                {payModalData && (
                    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95"><h3 className="font-black text-xl text-[#1A1A1A] mb-1">支付账单 (Pay Bill)</h3><p className="text-xs text-gray-500 font-bold mb-6">{payModalData.company} • Inv #{payModalData.id.slice(-6)}</p><div className="space-y-4"><div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center"><div className="text-[10px] text-red-400 uppercase font-black">Outstanding</div><div className="text-2xl font-black text-red-600">RM {payModalData.outstandingAmount?.toFixed(2)}</div></div><div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Payment Amount</label><input type="number" value={payAmount} onChange={e => setPayAmount(parseFloat(e.target.value))} className="w-full p-4 bg-gray-50 rounded-xl font-black text-xl outline-none focus:border-[#FFD700] border-2 border-transparent"/></div><div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Payment Method (资金来源)</label><select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none border border-gray-200 focus:border-[#FFD700]"><option value="BANK_TRANSFER">Bank Transfer (银行转账)</option><option value="CASH">Cash (现金支付)</option><option value="CHEQUE">Cheque (支票)</option><option value="DUITNOW">DuitNow / QR</option></select><p className="text-[9px] text-gray-400 mt-1 italic">{payMethod === 'CASH' ? 'Will deduct from Treasury CASH balance.' : 'Will deduct from Treasury BANK balance.'}</p></div><button onClick={handleQuickPay} className="w-full bg-[#1A1A1A] text-[#FFD700] py-4 rounded-xl font-black shadow-lg hover:bg-black flex items-center justify-center gap-2 mt-2"><DollarSign size={18}/> 确认支付 (Confirm)</button><button onClick={() => setPayModalData(null)} className="w-full py-3 text-gray-400 text-xs font-bold hover:text-gray-600">Cancel</button></div></div></div>
                )}

                {/* HIDDEN PRINT TEMPLATE */}
                <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                    <div ref={printRef} className="w-[794px] min-h-[1123px] bg-white p-12 text-black font-sans relative">
                        <div className="flex justify-between items-end border-b-4 border-black pb-4 mb-8">
                            <div><h1 className="text-4xl font-black uppercase tracking-widest mb-1">Accounts Payable</h1><p className="text-sm font-bold text-gray-500">Generated: {new Date().toLocaleDateString()}</p></div>
                            <div className="text-right"><p className="text-xl font-black">KIM LIAN KEE</p><p className="text-xs font-bold text-gray-400">Finance Department</p></div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mb-8 text-center bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Bills</p><p className="text-xl font-black">{printData.length}</p></div>
                            <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total</p><p className="text-xl font-black">RM {printData.reduce((acc,b)=>acc+(b.totalBillAmount || b.amount || 0),0).toFixed(2)}</p></div>
                            <div><p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Total CN</p><p className="text-xl font-black text-orange-600">RM {printData.reduce((acc,b)=>acc+(b.creditNote||0),0).toFixed(2)}</p></div>
                            <div><p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Balance Due</p><p className="text-xl font-black text-red-600">RM {printData.reduce((acc,b)=>acc+(b.outstandingAmount||0),0).toFixed(2)}</p></div>
                        </div>
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-black text-white">
                                <tr>
                                    <th className="p-2 uppercase font-bold">Date</th>
                                    <th className="p-2 uppercase font-bold">Supplier / Note</th>
                                    <th className="p-2 uppercase font-bold text-right">Invoice</th>
                                    <th className="p-2 uppercase font-bold text-right">CN</th>
                                    <th className="p-2 uppercase font-bold text-right">Due</th>
                                    <th className="p-2 uppercase font-bold text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {printData.map((bill, i) => (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="p-2 font-mono">{bill.time.split('T')[0]}</td>
                                        <td className="p-2">
                                            <div className="font-bold">{bill.company}</div>
                                            <div className="text-[8px] text-gray-400">{bill.note?.slice(0, 40) || '-'}</div>
                                        </td>
                                        <td className="p-2 text-right font-mono">{(bill.totalBillAmount || bill.amount || 0).toFixed(2)}</td>
                                        <td className="p-2 text-right font-mono text-orange-600">{(bill.creditNote || 0).toFixed(2)}</td>
                                        <td className="p-2 text-right font-mono font-bold">{(bill.outstandingAmount || 0).toFixed(2)}</td>
                                        <td className="p-2 text-center font-bold uppercase text-[8px]">{bill.paymentStatus}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between items-end">
                            <div><p className="text-[10px] font-bold uppercase">Prepared By</p><div className="w-48 h-px bg-gray-300 mt-8"></div></div>
                            <div><p className="text-[10px] font-bold uppercase">Approved By</p><div className="w-48 h-px bg-gray-300 mt-8"></div></div>
                        </div>
                    </div>
                </div>
                
                {/* HIDDEN VOUCHER TEMPLATE */}
                {printingVoucher && (
                    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                        <div ref={voucherRef} className="w-[794px] min-h-[560px] bg-white p-12 text-black font-sans relative border-4 border-double border-gray-300">
                            {/* Header */}
                            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                                <div>
                                    <h1 className="text-4xl font-black uppercase tracking-widest mb-1 text-black">PAYMENT VOUCHER</h1>
                                    <p className="text-lg font-bold text-gray-600">KIM LIAN KEE (KEPONG)</p>
                                    <p className="text-xs text-gray-500 mt-1">No. 52, Jalan Metro Perdana Barat 13, Kepong, 52100 Kuala Lumpur</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold uppercase text-gray-500">Voucher No.</p>
                                    <p className="text-xl font-mono font-black">{printingVoucher.id.slice(-8).toUpperCase()}</p>
                                    <p className="text-sm font-bold uppercase text-gray-500 mt-2">Date</p>
                                    <p className="text-lg font-mono">{new Date().toLocaleDateString()}</p>
                                </div>
                            </div>
                            
                            {/* Payee Info */}
                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div className="border p-4 rounded">
                                    <p className="text-xs font-bold uppercase text-gray-500 mb-1">Pay To (支付给)</p>
                                    <p className="text-xl font-bold">{printingVoucher.company}</p>
                                </div>
                                <div className="border p-4 rounded">
                                    <p className="text-xs font-bold uppercase text-gray-500 mb-1">Payment Method</p>
                                    <p className="text-xl font-bold">{printingVoucher.paymentMethod || 'CASH'}</p>
                                </div>
                            </div>

                            {/* Particulars Table */}
                            <table className="w-full text-left mb-8 border border-black">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-3 border-r border-black uppercase font-bold text-sm">Description (Particulars)</th>
                                        <th className="p-3 uppercase font-bold text-sm text-right w-48">Amount (RM)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="p-3 border-r border-black h-48 align-top">
                                            <div className="font-bold text-lg mb-2">{printingVoucher.note || 'Payment'}</div>
                                            <div className="text-sm text-gray-500 italic">Category: {printingVoucher.category}</div>
                                        </td>
                                        <td className="p-3 text-right font-mono text-xl align-top">
                                            {(printingVoucher.amount || 0).toFixed(2)}
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-gray-100">
                                    <tr>
                                        <td className="p-3 border-r border-black font-bold text-right uppercase">Total</td>
                                        <td className="p-3 text-right font-black font-mono text-xl">{(printingVoucher.amount || 0).toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Signatures */}
                            <div className="grid grid-cols-3 gap-8 mt-12">
                                <div className="text-center">
                                    <div className="border-b border-black mb-2 h-16"></div>
                                    <p className="text-xs font-bold uppercase">Prepared By</p>
                                </div>
                                <div className="text-center">
                                    <div className="border-b border-black mb-2 h-16"></div>
                                    <p className="text-xs font-bold uppercase">Approved By</p>
                                </div>
                                <div className="text-center">
                                    <div className="border-b border-black mb-2 h-16"></div>
                                    <p className="text-xs font-bold uppercase">Received By</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};