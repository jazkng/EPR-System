import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Building, Zap, Trash2, Plus, DollarSign, X, CheckCircle2, History, AlertTriangle, FileCheck, Home, Banknote, Droplets, Wifi, Gauge, CalendarDays, TrendingUp, ArrowRight, Clock, Edit3, Calculator, BadgeAlert, Layers, ShieldCheck, Copy, AlertOctagon, Link as LinkIcon, PiggyBank, Archive, ArchiveRestore, Loader2, Clipboard, ExternalLink, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';
import { RecurringBill, BillPaymentRecord, RecurringBillCategory, RecurringBillType, ExpenseItem } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';

interface RecurringBillsModuleProps {
    onClose: () => void;
}

// === CATEGORY MAP: RecurringBill → AP ExpenseItem ===
const BILL_TO_AP_CATEGORY: Record<RecurringBillCategory, string> = {
    'RENT': 'RENT',
    'ELECTRICITY': 'UTILITIES_ELECTRIC',
    'WATER': 'UTILITIES_WATER',
    'INTERNET': 'INTERNET',
    'WASTE': 'WASTE',
    'LICENSE': 'LICENSE',
    'SUBSCRIPTION': 'LICENSE',
    'OTHER': 'SUPPLIES',
};

const CATEGORY_CONFIG: Record<RecurringBillCategory, { label: string, icon: any, color: string, unit?: string, text: string }> = {
    'RENT': { label: '租金', text: 'RENT', icon: Building, color: 'bg-blue-50 text-blue-600 border-blue-200' },
    'ELECTRICITY': { label: '电费', text: 'ELECTRIC', icon: Zap, color: 'bg-yellow-50 text-yellow-600 border-yellow-200', unit: 'kWh' },
    'WATER': { label: '水费', text: 'WATER', icon: Droplets, color: 'bg-cyan-50 text-cyan-600 border-cyan-200', unit: 'm³' },
    'INTERNET': { label: '网络', text: 'WIFI', icon: Wifi, color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
    'WASTE': { label: '垃圾费', text: 'WASTE', icon: Trash2, color: 'bg-gray-50 text-gray-600 border-gray-200' },
    'LICENSE': { label: '执照/SST', text: 'LICENSE', icon: ShieldCheck, color: 'bg-orange-50 text-orange-600 border-orange-200' },
    'SUBSCRIPTION': { label: '系统订阅', text: 'SUB', icon: Layers, color: 'bg-purple-50 text-purple-600 border-purple-200' },
    'OTHER': { label: '其他', text: 'OTHER', icon: Banknote, color: 'bg-green-50 text-green-600 border-green-200' },
};

export const RecurringBillsModule: React.FC<RecurringBillsModuleProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'MONTHLY' | 'YEARLY' | 'HISTORY'>('MONTHLY');
    const [bills, setBills] = useState<RecurringBill[]>([]);
    const [payments, setPayments] = useState<BillPaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
    // View State
    const [isAddMode, setIsAddMode] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    
    // Form States
    const [billForm, setBillForm] = useState<Partial<RecurringBill>>({});
    
    // Pay Modal State
    const [payingBill, setPayingBill] = useState<RecurringBill | null>(null);
    const [payAmount, setPayAmount] = useState<number>(0);
    const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [payMethod, setPayMethod] = useState<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER');
    const [payRef, setPayRef] = useState('');
    const [payLink, setPayLink] = useState(''); // NEW: Link URL State
    const [meterReadings, setMeterReadings] = useState<{ prev: string, curr: string }>({ prev: '', curr: '' });
    const [payUsage, setPayUsage] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // EDIT MODE: editing an existing payment record
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
    
    // HISTORY FILTER: month filter + search + pagination
    const [historyMonth, setHistoryMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [historySearch, setHistorySearch] = useState('');
    const [historyLimit, setHistoryLimit] = useState(50);
    const [showAllHistory, setShowAllHistory] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    // Auto-calculate usage when readings change
    useEffect(() => {
        if (meterReadings.curr && meterReadings.prev) {
            const curr = parseFloat(meterReadings.curr);
            const prev = parseFloat(meterReadings.prev);
            if (!isNaN(curr) && !isNaN(prev)) {
                const diff = curr - prev;
                setPayUsage(diff > 0 ? diff.toFixed(2) : '0');
            }
        }
    }, [meterReadings]);

    const loadData = async () => {
        setLoading(true);
        const b = await DataManager.getRecurringBills();
        const p = await DataManager.getBillPayments();
        setBills(b);
        setPayments(p.sort((a,b) => b.date.localeCompare(a.date)));
        setLoading(false);
    };

    // --- QUICK ADD / EDIT ---
    const startAdd = (type: 'MONTHLY' | 'YEARLY') => {
        const defaultCat = type === 'MONTHLY' ? 'OTHER' : 'SUBSCRIPTION';
        setBillForm({ 
            category: defaultCat, 
            name: '',
            type: type,
            dueDay: 1,
            dueMonth: type === 'YEARLY' ? 1 : undefined,
            amount: 0,
            reminderDays: type === 'YEARLY' ? 30 : 3
        });
        setIsAddMode(true);
    };

    const startEdit = (bill: RecurringBill) => {
        setBillForm({ ...bill });
        setIsAddMode(true);
    };

    const handleSaveBill = async () => {
        if (!billForm.name) return alert("Please enter a name");
        
        const rawBill: RecurringBill = {
            id: billForm.id || `bill_${Date.now()}`,
            name: billForm.name,
            amount: Number(billForm.amount) || 0,
            type: billForm.type || 'MONTHLY',
            dueDay: Number(billForm.dueDay) || 1,
            dueMonth: billForm.type === 'YEARLY' ? Number(billForm.dueMonth) : undefined,
            category: billForm.category || 'OTHER',
            isActive: true,
            lastPaidDate: billForm.lastPaidDate,
            reminderDays: Number(billForm.reminderDays) || (billForm.type === 'YEARLY' ? 30 : 3),
            isArchived: false,
            
            accountNumber: billForm.accountNumber,
            payableTo: billForm.payableTo,
            paymentLink: billForm.paymentLink,
            contractStart: billForm.contractStart,
            contractEnd: billForm.contractEnd,
            depositAmount: Number(billForm.depositAmount) || 0,
            softLimit: Number(billForm.softLimit) || 0,
            hardLimit: Number(billForm.hardLimit) || 0
        };

        // Sanitize to remove undefined
        const newBill = JSON.parse(JSON.stringify(rawBill));

        await DataManager.saveRecurringBill(newBill);
        setBillForm({});
        setIsAddMode(false);
        loadData();
    };

    const handleDeleteBill = async (id: string) => {
        if (!confirm("Confirm delete?")) return;
        await DataManager.deleteRecurringBill(id);
        loadData();
    };

    // --- PAYMENT LOGIC ---
    const openPayModal = (bill: RecurringBill) => {
        setPayingBill(bill);
        setPayAmount(bill.amount || 0);
        setPayDate(new Date().toISOString().split('T')[0]);
        setPayRef('');
        setPayLink(''); // Reset Link
        setMeterReadings({ prev: '', curr: '' });
        setPayUsage('');
        setEditingPaymentId(null); // New payment mode
        setIsPayModalOpen(true);
    };

    // EDIT existing payment — prefill modal with existing data
    const openEditPayment = (payment: BillPaymentRecord) => {
        const bill = bills.find(b => b.id === payment.billId);
        setPayingBill(bill || { id: payment.billId, name: payment.name, amount: payment.amount, type: 'MONTHLY', dueDay: 1, category: payment.category, isActive: true, reminderDays: 3, isArchived: false } as RecurringBill);
        setPayAmount(payment.amount);
        setPayDate(payment.date);
        setPayMethod(payment.method as any);
        setPayRef(payment.referenceNo || '');
        setPayLink(payment.linkUrl || '');
        setPayUsage(payment.usage?.toString() || '');
        setMeterReadings({ prev: '', curr: '' }); // Can't restore meter readings
        setEditingPaymentId(payment.id); // Edit mode
        setIsPayModalOpen(true);
    };

    const handlePasteLink = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) setPayLink(text);
        } catch (err) {
            alert("Clipboard permission denied");
        }
    };

    const confirmPayment = async () => {
        if (!payingBill) return;
        
        setIsSubmitting(true);
        try {
            const paymentId = editingPaymentId || `pay_${Date.now()}`;
            
            const rawRecord: BillPaymentRecord = {
                id: paymentId,
                billId: payingBill.id,
                name: payingBill.name,
                amount: payAmount || 0,
                date: payDate,
                category: payingBill.category,
                method: payMethod,
                referenceNo: payRef,
                usage: payUsage ? parseFloat(payUsage) : undefined,
                usageUnit: CATEGORY_CONFIG[payingBill.category]?.unit,
                linkUrl: payLink
            };

            const record = JSON.parse(JSON.stringify(rawRecord));
            await DataManager.saveBillPayment(record);
            
            // === AP SYNC: Create/Update matching ExpenseItem in standalone_expenses ===
            const apId = `bill_sync_${paymentId}`;
            const apCategory = BILL_TO_AP_CATEGORY[payingBill.category] || 'SUPPLIES';
            const rawExpense: ExpenseItem = {
                id: apId,
                category: apCategory,
                expenseType: 'RECURRING',
                company: payingBill.payableTo || payingBill.name,
                amount: payAmount || 0,
                paymentStatus: 'PAID',
                paymentMethod: payMethod as any,
                time: payDate,
                note: `[固定支出] ${payingBill.name}${payRef ? ` | Ref: ${payRef}` : ''}${payUsage ? ` | Usage: ${payUsage} ${CATEGORY_CONFIG[payingBill.category]?.unit || ''}` : ''}`,
                paidBy: payMethod === 'CASH' ? 'SHOP_CASH' : 'COMPANY',
                linkUrl: payLink || undefined,
                tags: ['RECURRING_BILL'],
            };
            const expense = JSON.parse(JSON.stringify(rawExpense));
            await DataManager.saveStandaloneExpense(expense);
            
            // Update last paid date on the bill itself
            if (!editingPaymentId) {
                const rawUpdatedBill = { ...payingBill, lastPaidDate: payDate };
                const updatedBill = JSON.parse(JSON.stringify(rawUpdatedBill));
                await DataManager.saveRecurringBill(updatedBill);
            }
            
            setIsPayModalOpen(false);
            setPayingBill(null);
            setEditingPaymentId(null);
            alert(editingPaymentId ? "✅ 已更新支付记录 (Payment Updated)" : "✅ 支付已记录 (Payment Recorded)");
            loadData();
        } catch (error: any) {
            console.error("Payment failed", error);
            alert(`❌ 支付失败 (Failed): ${error.message || 'Data Error'}. Please try again.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePayment = async (id: string) => {
        if(!confirm("确认删除此支付记录？\n(AP同步记录也会一并删除)")) return;
        
        // Delete the payment record
        await DataManager.deleteBillPayment(id);
        
        // Also delete the synced AP expense
        try {
            const { deleteDoc: delDoc, doc: docRef } = await import('firebase/firestore');
            const { db: fireDb } = await import('../../firebaseConfig');
            await delDoc(docRef(fireDb, 'standalone_expenses', `bill_sync_${id}`));
        } catch (e) { console.warn("AP sync cleanup skipped", e); }
        
        loadData();
    };

    // --- HELPERS ---
    const checkStatus = (bill: RecurringBill) => {
        if (!bill.lastPaidDate) return 'UNPAID';
        const today = new Date();
        const lastPaid = new Date(bill.lastPaidDate);
        
        if (bill.type === 'MONTHLY') {
            const isSameMonth = lastPaid.getMonth() === today.getMonth() && lastPaid.getFullYear() === today.getFullYear();
            return isSameMonth ? 'PAID' : 'UNPAID';
        } else {
            const isSameYear = lastPaid.getFullYear() === today.getFullYear();
            // Check renewal logic (e.g. within 11 months for yearly is ok? assume same year payment covers it)
            return isSameYear ? 'PAID' : 'UNPAID';
        }
    };

    const filteredBills = bills.filter(b => b.type === activeTab);

    // HISTORY: Filtered + paginated payments
    const filteredPayments = useMemo(() => {
        let list = payments;
        
        // Month filter (unless showing all)
        if (!showAllHistory && historyMonth) {
            list = list.filter(p => p.date.startsWith(historyMonth));
        }
        
        // Search filter
        if (historySearch) {
            const q = historySearch.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q) || p.referenceNo?.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
        }
        
        return list;
    }, [payments, historyMonth, historySearch, showAllHistory]);
    
    const displayedPayments = filteredPayments.slice(0, historyLimit);
    const hasMorePayments = filteredPayments.length > historyLimit;
    
    // History month totals
    const historyMonthTotal = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const handleHistoryMonthChange = (delta: number) => {
        const [y, m] = historyMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setHistoryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        setHistoryLimit(50);
    };
    
    // Purge old records (archive)
    const handlePurgeOld = async () => {
        const cutoff = prompt("删除多久以前的记录？\n请输入月数 (例如: 12 = 一年前)", "12");
        if (!cutoff) return;
        const months = parseInt(cutoff);
        if (isNaN(months) || months < 3) return alert("最少保留3个月");
        
        const cutDate = new Date();
        cutDate.setMonth(cutDate.getMonth() - months);
        const cutStr = cutDate.toISOString().split('T')[0];
        
        const toDelete = payments.filter(p => p.date < cutStr);
        if (toDelete.length === 0) return alert("没有需要清理的旧记录");
        
        if (!confirm(`确认删除 ${toDelete.length} 条 ${cutStr} 之前的记录？\n\n⚠️ 此操作不可撤销！\n(已同步到应付账款的记录不受影响)`)) return;
        
        for (const p of toDelete) {
            await DataManager.deleteBillPayment(p.id);
        }
        alert(`✅ 已清理 ${toDelete.length} 条旧记录`);
        loadData();
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-[#F5F7FA] w-full h-full md:max-w-5xl md:h-[95vh] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl relative font-sans">
                
                {/* HEADER */}
                <div className="bg-[#1A1A1A] p-4 flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700]">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#FFD700] text-black p-2.5 rounded-xl shadow-lg"><Banknote size={24}/></div>
                        <div>
                            <h3 className="font-serif font-black text-xl tracking-wide">固定支出管理</h3>
                            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">RECURRING BILLS</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ModuleGuideButton module="BILLS" />
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
                    </div>
                </div>

                {/* TABS */}
                <div className="bg-white border-b border-gray-200 p-2 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
                    <button onClick={() => setActiveTab('MONTHLY')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'MONTHLY' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>月度账单 (Monthly)</button>
                    <button onClick={() => setActiveTab('YEARLY')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'YEARLY' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>年度执照 (Yearly)</button>
                    <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'HISTORY' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>支付记录 (History)</button>
                </div>

                {/* CONTENT */}
                <div className="flex-grow overflow-y-auto p-4 md:p-6 pb-32">
                    
                    {/* BILLS GRID */}
                    {(activeTab === 'MONTHLY' || activeTab === 'YEARLY') && (
                        <div className="space-y-6">
                            <button onClick={() => startAdd(activeTab)} className="w-full py-4 bg-white border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 font-bold text-sm flex items-center justify-center gap-2 hover:border-[#FFD700] hover:text-[#1A1A1A] transition-all">
                                <Plus size={18}/> 添加新项目 (Add New Bill)
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredBills.map(bill => {
                                    const status = checkStatus(bill);
                                    const conf = CATEGORY_CONFIG[bill.category];
                                    const Icon = conf.icon;
                                    
                                    return (
                                        <div key={bill.id} className={`bg-white p-5 rounded-2xl shadow-sm border-l-[6px] relative group transition-all hover:shadow-md ${status === 'PAID' ? 'border-l-green-500' : 'border-l-red-500'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className={`p-2 rounded-xl ${conf.color}`}>
                                                    <Icon size={20}/>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => startEdit(bill)} className="p-2 bg-gray-100 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"><Edit3 size={14}/></button>
                                                    <button onClick={() => handleDeleteBill(bill.id)} className="p-2 bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                            
                                            <h4 className="font-black text-lg text-[#1A1A1A] mb-1 truncate">{bill.name}</h4>
                                            <div className="text-xs font-bold text-gray-400 mb-4 flex items-center gap-2">
                                                <Calendar size={12}/> Due Day: {bill.dueDay} {bill.type === 'YEARLY' ? `(${bill.dueMonth}月)` : '日'}
                                            </div>

                                            <div className="flex items-center justify-between mt-auto">
                                                <div className="text-lg font-mono font-black text-[#1A1A1A]">
                                                    {bill.amount > 0 ? `RM ${bill.amount}` : <span className="text-sm text-gray-400">Variable</span>}
                                                </div>
                                                
                                                {status === 'UNPAID' ? (
                                                    <button onClick={() => openPayModal(bill)} className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-red-600 active:scale-95 transition-all flex items-center gap-2">
                                                        <DollarSign size={14}/> Pay Now
                                                    </button>
                                                ) : (
                                                    <div className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 border border-green-200">
                                                        <CheckCircle2 size={12}/> Paid
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {bill.lastPaidDate && (
                                                <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-1">
                                                    <History size={10}/> Last Paid: {bill.lastPaidDate}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* HISTORY LIST - ENHANCED */}
                    {activeTab === 'HISTORY' && (
                        <div className="space-y-4">
                            {/* History Controls */}
                            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {/* Month Navigator */}
                                    <button onClick={() => handleHistoryMonthChange(-1)} className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 active:scale-95"><ChevronLeft size={16}/></button>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200">
                                        <CalendarDays size={14} className="text-gray-400"/>
                                        <input type="month" value={historyMonth} onChange={e => { setHistoryMonth(e.target.value); setHistoryLimit(50); }} className="bg-transparent font-bold text-sm outline-none w-32 text-center"/>
                                    </div>
                                    <button onClick={() => handleHistoryMonthChange(1)} className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 active:scale-95"><ChevronRight size={16}/></button>
                                    <button onClick={() => setShowAllHistory(!showAllHistory)} className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${showAllHistory ? 'bg-[#1A1A1A] text-[#FFD700] border-black' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                                        {showAllHistory ? '全部' : '按月'}
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <div className="relative flex-grow sm:w-48">
                                        <Search className="absolute left-3 top-2.5 text-gray-400" size={14}/>
                                        <input type="text" placeholder="搜索..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-[#FFD700]"/>
                                    </div>
                                    <button onClick={handlePurgeOld} className="p-2 bg-red-50 text-red-500 rounded-lg border border-red-100 hover:bg-red-100 transition-colors" title="清理旧记录">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Month Summary */}
                            <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                                <div className="text-xs font-bold text-gray-400">{showAllHistory ? '全部记录' : `${historyMonth} 月度支出`}</div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-gray-400">{filteredPayments.length} 条</span>
                                    <span className="text-sm font-mono font-black text-[#1A1A1A]">RM {historyMonthTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                {/* Mobile: Card layout */}
                                <div className="md:hidden divide-y divide-gray-100">
                                    {displayedPayments.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 italic text-sm">本月暂无支付记录</div>
                                    ) : displayedPayments.map(p => (
                                        <div key={p.id} className="p-4 flex justify-between items-start gap-3">
                                            <div className="flex-grow min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-sm text-[#1A1A1A] truncate">{p.name}</span>
                                                    <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase shrink-0">{p.category}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono">{p.date} • {p.method?.replace('_', ' ')}</div>
                                                {p.referenceNo && <div className="text-[10px] text-gray-400 mt-0.5">Ref: {p.referenceNo}</div>}
                                                {p.usage && <div className="text-[10px] text-blue-500 mt-0.5">Usage: {p.usage} {p.usageUnit}</div>}
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <span className="font-mono font-black text-sm">RM {p.amount.toFixed(2)}</span>
                                                <div className="flex gap-1">
                                                    {p.linkUrl && <a href={p.linkUrl} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-50 text-blue-500 rounded hover:bg-blue-100"><ExternalLink size={12}/></a>}
                                                    <button onClick={() => openEditPayment(p)} className="p-1.5 bg-gray-50 text-gray-400 rounded hover:bg-gray-100 hover:text-blue-600"><Edit3 size={12}/></button>
                                                    <button onClick={() => handleDeletePayment(p.id)} className="p-1.5 bg-gray-50 text-gray-300 rounded hover:bg-red-50 hover:text-red-500"><Trash2 size={12}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Desktop: Table layout */}
                                <table className="w-full text-left hidden md:table">
                                    <thead className="bg-gray-50 text-xs text-gray-500 font-bold uppercase border-b border-gray-200">
                                        <tr>
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Bill Name</th>
                                            <th className="p-4 text-center">Method</th>
                                            <th className="p-4 text-right">Amount</th>
                                            <th className="p-4 text-center">Ref/Link</th>
                                            <th className="p-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm divide-y divide-gray-100">
                                        {displayedPayments.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">本月暂无支付记录</td></tr> : 
                                        displayedPayments.map(p => (
                                            <tr key={p.id} className="hover:bg-gray-50 group">
                                                <td className="p-4 font-mono text-xs text-gray-500">{p.date}</td>
                                                <td className="p-4">
                                                    <span className="font-bold text-[#1A1A1A]">{p.name}</span>
                                                    <span className="text-[10px] text-gray-400 font-normal uppercase bg-gray-100 px-1.5 py-0.5 rounded ml-2">{p.category}</span>
                                                    {p.usage && <span className="text-[10px] text-blue-500 ml-2">{p.usage} {p.usageUnit}</span>}
                                                </td>
                                                <td className="p-4 text-center text-[10px] font-bold text-gray-400 uppercase">{p.method?.replace('_', ' ')}</td>
                                                <td className="p-4 text-right font-mono font-bold">RM {p.amount.toFixed(2)}</td>
                                                <td className="p-4 text-center text-xs text-gray-500">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {p.referenceNo || '-'}
                                                        {p.linkUrl && (
                                                            <a href={p.linkUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1 rounded transition-colors" title="View Receipt">
                                                                <ExternalLink size={12}/>
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => openEditPayment(p)} className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑"><Edit3 size={14}/></button>
                                                        <button onClick={() => handleDeletePayment(p.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="删除"><Trash2 size={14}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Load More */}
                            {hasMorePayments && (
                                <button onClick={() => setHistoryLimit(prev => prev + 50)} className="w-full py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                                    加载更多 ({filteredPayments.length - historyLimit} remaining)
                                </button>
                            )}
                            
                            {/* AP Sync Indicator */}
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                                <CheckCircle2 size={16} className="text-green-600 shrink-0"/>
                                <p className="text-[10px] text-green-700 font-bold">支付记录已自动同步至应付账款 (AP) 模块，分类标记为 <span className="bg-green-100 px-1.5 py-0.5 rounded">RECURRING_BILL</span></p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ADD/EDIT MODAL */}
                {isAddMode && (
                    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-black text-xl text-[#1A1A1A]">{billForm.id ? '编辑账单' : '新增账单'}</h3>
                                <button onClick={() => setIsAddMode(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                            </div>
                            
                            <div className="space-y-4">
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Name</label><input className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-[#FFD700]" value={billForm.name} onChange={e => setBillForm({...billForm, name: e.target.value})} placeholder="e.g. TNB Electricity" /></div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Category</label><select className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={billForm.category} onChange={e => setBillForm({...billForm, category: e.target.value as any})}>{Object.entries(CATEGORY_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Amount (RM)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={billForm.amount || ''} onChange={e => setBillForm({...billForm, amount: parseFloat(e.target.value)})} placeholder="0 for variable" /></div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Type</label><select className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={billForm.type} onChange={e => setBillForm({...billForm, type: e.target.value as any})}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></div>
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Due Day</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={billForm.dueDay} onChange={e => setBillForm({...billForm, dueDay: parseInt(e.target.value)})} /></div>
                                    {billForm.type === 'YEARLY' && <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Due Month</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={billForm.dueMonth} onChange={e => setBillForm({...billForm, dueMonth: parseInt(e.target.value)})} placeholder="1-12" /></div>}
                                </div>

                                <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Pay To (Company)</label><input className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={billForm.payableTo || ''} onChange={e => setBillForm({...billForm, payableTo: e.target.value})} placeholder="e.g. TNB" /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Account Number</label><input className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none font-mono" value={billForm.accountNumber || ''} onChange={e => setBillForm({...billForm, accountNumber: e.target.value})} placeholder="Acc No." /></div>

                                <button onClick={handleSaveBill} className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-lg shadow-lg hover:bg-black mt-4">保存 (Save)</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* PAY MODAL */}
                {isPayModalOpen && payingBill && (
                    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                            <h3 className="font-black text-xl text-[#1A1A1A] mb-1">{editingPaymentId ? '编辑支付记录 (Edit Payment)' : '支付账单 (Pay Bill)'}</h3>
                            <p className="text-sm font-bold text-gray-500 mb-6">{payingBill.name}</p>
                            
                            <div className="space-y-4">
                                {/* Auto Meter Calc for Utilities */}
                                {['ELECTRICITY', 'WATER'].includes(payingBill.category) && (
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Meter Reading ({CATEGORY_CONFIG[payingBill.category].unit})</p>
                                        <div className="flex gap-2 items-center">
                                            <input type="number" placeholder="Prev" className="w-full p-2 bg-white rounded text-sm font-bold text-center" value={meterReadings.prev} onChange={e => setMeterReadings({...meterReadings, prev: e.target.value})} />
                                            <ArrowRight size={14} className="text-blue-400"/>
                                            <input type="number" placeholder="Curr" className="w-full p-2 bg-white rounded text-sm font-bold text-center" value={meterReadings.curr} onChange={e => setMeterReadings({...meterReadings, curr: e.target.value})} />
                                        </div>
                                        {payUsage && <p className="text-right text-xs font-black text-blue-800 mt-1">Usage: {payUsage}</p>}
                                    </div>
                                )}

                                <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Amount (RM)</label><input type="number" className="w-full p-4 bg-gray-50 rounded-xl font-black text-2xl outline-none focus:border-[#FFD700] border-2 border-transparent" value={payAmount || ''} onChange={e => setPayAmount(parseFloat(e.target.value) || 0)} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Date</label><input type="date" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Reference / Receipt No.</label><input className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Optional..." /></div>
                                
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Payment Method (资金来源)</label>
                                    <select 
                                        value={payMethod} 
                                        onChange={e => setPayMethod(e.target.value as any)} 
                                        className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none border border-gray-200 focus:border-[#FFD700]"
                                    >
                                        <option value="BANK_TRANSFER">Bank Transfer (银行转账)</option>
                                        <option value="CASH">Cash (现金支付)</option>
                                        <option value="CHEQUE">Cheque (支票)</option>
                                        <option value="DUITNOW">DuitNow / QR</option>
                                    </select>
                                    <p className="text-[9px] text-gray-400 mt-1 italic">
                                        {payMethod === 'CASH' ? 'Will deduct from Treasury CASH balance.' : 'Will deduct from Treasury BANK balance.'}
                                    </p>
                                </div>

                                {/* Link / Receipt URL Input */}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block flex items-center gap-1"><LinkIcon size={12}/> Receipt / Document Link (Google Drive)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            className="flex-grow p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none" 
                                            value={payLink} 
                                            onChange={e => setPayLink(e.target.value)} 
                                            placeholder="https://..." 
                                        />
                                        <button onClick={handlePasteLink} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors" title="Paste from Clipboard">
                                            <Clipboard size={16}/>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button onClick={() => setIsPayModalOpen(false)} className="py-3 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm" disabled={isSubmitting}>Cancel</button>
                                    <button 
                                        onClick={confirmPayment} 
                                        disabled={isSubmitting}
                                        className="py-3 bg-green-500 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : null}
                                        {isSubmitting ? 'Processing...' : editingPaymentId ? 'Update Payment' : 'Confirm Pay'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};