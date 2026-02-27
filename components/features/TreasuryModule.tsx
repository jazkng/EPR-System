import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Wallet, Landmark, ArrowRightLeft, History, Settings, X, Plus, 
    ArrowDownLeft, ArrowUpRight, Banknote, CreditCard, Calendar, 
    Save, Trash2, TrendingUp, TrendingDown, DollarSign, ArrowRight, 
    UserPlus, Users, Briefcase, Wrench, PiggyBank, FileText, 
    MinusCircle, Info, Calculator, Download, Zap, Droplets, Home, Coins, Recycle,
    FileDown, Loader2, ScrollText, Table2, ChevronDown, ChevronUp, Clock, Circle, LayoutList, Archive, Gem, Printer
} from 'lucide-react';
import { TreasuryConfig, FundTransfer, SettlementRecord, ExpenseItem, BillPaymentRecord, Shareholder } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { ModuleGuideButton } from '../ui/ModuleGuide';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

interface TreasuryModuleProps {
    onClose: () => void;
}

// --- HELPER ---
const formatMoney = (n: number) => `RM ${n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

const DEFAULT_INCOME_SOURCES = ['隔壁店铺 (Neighbor)', '废品回收 (Recycle)', '租金分摊 (Sub-rent)'];

// --- LEDGER INTERFACES ---
interface LedgerItem {
    id: string;
    date: string;
    desc: string;
    amount: number;
    type: 'IN' | 'OUT';
    category: string;
    tag?: string;
    balance?: number;
}

const LedgerModal = ({ isOpen, type, onClose, items }: { isOpen: boolean; type: 'CASH' | 'BANK'; onClose: () => void; items: LedgerItem[] | undefined }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-white w-full h-full md:max-w-4xl md:h-[85vh] md:rounded-[2rem] flex flex-col overflow-hidden shadow-2xl relative font-sans">
                <div className="bg-[#1A1A1A] p-4 flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700]">
                    <div className="flex items-center gap-3">
                         <div className="bg-[#FFD700] text-black p-2 rounded-xl shadow-lg"><ScrollText size={20}/></div>
                         <div>
                             <h3 className="font-serif font-black text-lg tracking-wide">{type} LEDGER (流水账)</h3>
                             <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">Transaction History</p>
                         </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="flex-grow overflow-auto bg-[#F5F7FA]">
                    {!items || items.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-400">
                             <ScrollText size={48} className="opacity-20 mb-4"/>
                             <p className="text-sm font-bold">No records found</p>
                         </div>
                    ) : (
                        <div className="min-w-[600px] md:min-w-full">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-100 text-gray-500 font-bold uppercase sticky top-0 z-10 border-b border-gray-200">
                                    <tr>
                                        <th className="p-4 w-32">Date</th>
                                        <th className="p-4 w-24">Type</th>
                                        <th className="p-4">Description</th>
                                        <th className="p-4 w-32 text-right">Amount</th>
                                        <th className="p-4 w-32 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-mono text-gray-600">{item.date}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${item.type === 'IN' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-[#1A1A1A]">{item.desc}</div>
                                                <div className="flex gap-2 mt-0.5">
                                                    {item.category && <span className="text-[9px] bg-gray-100 px-1.5 rounded text-gray-500 font-bold">{item.category}</span>}
                                                    {item.tag && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 rounded font-bold border border-blue-100">#{item.tag}</span>}
                                                </div>
                                            </td>
                                            <td className={`p-4 text-right font-mono font-bold ${item.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                                {item.type === 'IN' ? '+' : '-'} {item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-gray-700 bg-gray-50/50">
                                                {item.balance !== undefined ? `RM ${item.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const TreasuryModule: React.FC<TreasuryModuleProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TRANSFERS' | 'EXTRA_INCOME' | 'EQUITY' | 'SETTINGS'>('OVERVIEW');
    const [config, setConfig] = useState<TreasuryConfig>({ initialDate: new Date().toISOString().split('T')[0], initialCash: 0, initialBank: 0, shareholders: [] });
    const [transfers, setTransfers] = useState<FundTransfer[]>([]);
    
    const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
    const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
    const [billPayments, setBillPayments] = useState<BillPaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [viewLedger, setViewLedger] = useState<'CASH' | 'BANK' | null>(null);

    const printRef = useRef<HTMLDivElement>(null);
    const [printingRecord, setPrintingRecord] = useState<FundTransfer | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferForm, setTransferForm] = useState<Partial<FundTransfer>>({
        amount: 0,
        fromAccount: 'CASH',
        toAccount: 'BANK',
        type: 'DEPOSIT',
        date: new Date().toISOString().split('T')[0]
    });

    const [isShareholderFormOpen, setIsShareholderFormOpen] = useState(false);
    const [shareholderForm, setShareholderForm] = useState<Partial<Shareholder>>({ name: '', investmentAmount: 0, equityPercentage: 0 });

    const [isInjectionModalOpen, setIsInjectionModalOpen] = useState(false);
    const [injectionForm, setInjectionForm] = useState({
        shareholderName: '',
        amount: '',
        toAccount: 'BANK',
        date: new Date().toISOString().split('T')[0],
        note: ''
    });

    const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
    const [dividendForm, setDividendForm] = useState({
        shareholderId: '',
        amount: '',
        paymentMethod: 'BANK_TRANSFER',
        date: new Date().toISOString().split('T')[0],
        note: ''
    });

    const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
    const [incomeForm, setIncomeForm] = useState({
        source: '',
        category: 'ELECTRICITY',
        amount: '',
        toAccount: 'CASH',
        date: new Date().toISOString().split('T')[0],
        note: ''
    });

    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseForm, setExpenseForm] = useState<Partial<ExpenseItem>>({
        category: 'RENOVATION',
        amount: 0,
        company: '',
        note: '',
        paymentStatus: 'PAID',
        paymentMethod: 'BANK_TRANSFER',
        time: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const cfg = await DataManager.getTreasuryConfig();
            if (cfg) setConfig(cfg);
            
            const startDateStr = cfg ? cfg.initialDate : '2020-01-01';

            const [trf, bills] = await Promise.all([
                DataManager.getFundTransfers(),
                DataManager.getBillPayments()
            ]);

            const qSettlements = query(collection(db, 'settlements'), where('date', '>=', startDateStr));
            const stlSnap = await getDocs(qSettlements);
            const stl = stlSnap.docs.map(d => d.data() as SettlementRecord);

            setTransfers(trf);
            setSettlements(stl);
            setBillPayments(bills);

            loadExpenses(stl);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadExpenses = async (fullSettlements: SettlementRecord[] = settlements) => {
        try {
            const allExp: ExpenseItem[] = [];
            fullSettlements.forEach(s => {
                if (s.expenses) allExp.push(...s.expenses);
            });
            
            const snap = await getDocs(collection(db, 'standalone_expenses'));
            snap.forEach(doc => allExp.push(doc.data() as ExpenseItem));
            
            const uniqueExp = Array.from(new Map(allExp.map(item => [item.id, item])).values());

            const bills = await DataManager.getBillPayments();
            const billExpenses: ExpenseItem[] = bills.map(b => ({
                id: b.id,
                category: b.category,
                expenseType: 'RECURRING',
                company: b.name, 
                amount: Number(b.amount) || 0, 
                note: b.referenceNo ? `[Bill] ${b.referenceNo}` : '[Bill Payment]',
                time: `${b.date}T12:00:00`, 
                paymentMethod: b.method,
                paymentStatus: 'PAID'
            }));

            const combined = [...uniqueExp, ...billExpenses];
            combined.sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            setExpenses(combined);
        } catch (e) {
            console.error("Expense load error", e);
        }
    };

    const totalCapital = useMemo(() => {
        return (config.shareholders || []).reduce((acc, s) => acc + s.investmentAmount, 0);
    }, [config.shareholders]);

    const totalInjections = useMemo(() => {
        return transfers
            .filter(t => t.fromAccount === 'SHAREHOLDER' as any)
            .reduce((sum, t) => sum + t.amount, 0);
    }, [transfers]);

    const dividendHistory = useMemo(() => {
        return expenses.filter(e => e.category === 'DIVIDEND');
    }, [expenses]);

    const incomeSourceHistory = useMemo(() => {
        const historySet = new Set(DEFAULT_INCOME_SOURCES);
        transfers.forEach(t => {
            if (t.fromAccount === 'OTHER' as any && t.note?.startsWith('[代收]')) {
                const withoutPrefix = t.note.substring(5);
                const parts = withoutPrefix.split(' - ');
                if (parts.length > 0 && parts[0].trim()) historySet.add(parts[0].trim());
            }
        });
        return Array.from(historySet).sort();
    }, [transfers]);

    const extraIncomeStats = useMemo(() => {
        const records = transfers.filter(t => t.fromAccount === 'OTHER' as any);
        const total = records.reduce((sum, t) => sum + t.amount, 0);
        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const thisMonthTotal = records.filter(t => t.date.startsWith(currentMonthPrefix)).reduce((sum, t) => sum + t.amount, 0);
        const breakdown = {
            electricity: records.filter(t => t.note?.toUpperCase().includes('ELECTRICITY') || t.note?.includes('电')).reduce((s, t) => s + t.amount, 0),
            water: records.filter(t => t.note?.toUpperCase().includes('WATER') || t.note?.includes('水')).reduce((s, t) => s + t.amount, 0),
            rent: records.filter(t => t.note?.toUpperCase().includes('RENT') || t.note?.includes('租')).reduce((s, t) => s + t.amount, 0),
            other: records.filter(t => !t.note?.match(/ELECTRICITY|电|WATER|水|RENT|租/i)).reduce((s, t) => s + t.amount, 0),
        };
        return { total, thisMonthTotal, breakdown, records };
    }, [transfers]);

    const balances = useMemo(() => {
        let cash = Number(config.initialCash) || 0;
        let bank = Number(config.initialBank) || 0;
        const startDate = new Date(config.initialDate);
        
        settlements.forEach(s => {
            if (new Date(s.date) >= startDate) {
                const actualCashIncome = Number(s.sales.cash || 0) + Number(s.variance || 0);
                cash += actualCashIncome;
                
                const bankIncome = Number(s.sales.tng || 0) + Number(s.sales.duitnow || 0) + Number(s.sales.card || 0);
                const deliveryIncome = s.sales.deliveryBreakdown ? Object.values(s.sales.deliveryBreakdown).reduce((a:number, b:any) => a + (Number(b)||0), 0) : 0;
                
                const debitFee = Number(s.sales.duitnow || 0) * 0.0045;
                const creditFee = Number(s.sales.card || 0) * 0.01;
                bank += ((bankIncome + deliveryIncome) - (debitFee + creditFee));
            }
        });
        
        expenses.forEach(e => {
            if (e.expenseType === 'RECURRING') return;
            if (e.paymentStatus === 'PAID' || e.paymentStatus === 'PARTIAL') {
                const payDate = new Date(e.time.split('T')[0]);
                if (payDate >= startDate) {
                    const amt = Number(e.amount) || 0;
                    const method = e.paymentMethod ? e.paymentMethod.toUpperCase() : 'BANK_TRANSFER';
                    if (method.includes('CASH')) cash -= amt; else bank -= amt;
                }
            }
        });
        
        billPayments.forEach(b => {
            if (new Date(b.date) >= startDate) {
                const amt = Number(b.amount) || 0;
                const method = b.method ? b.method.toUpperCase() : 'BANK_TRANSFER';
                if (method.includes('CASH')) cash -= amt; else bank -= amt;
            }
        });
        
        transfers.forEach(t => {
            if (new Date(t.date.split('T')[0]) >= startDate) {
                const amt = Number(t.amount) || 0;
                if (t.fromAccount === 'CASH') cash -= amt; else if (t.fromAccount === 'BANK') bank -= amt;
                
                if (t.fromAccount === 'SHAREHOLDER' as any || t.fromAccount === 'OTHER' as any) { 
                    if (t.toAccount === 'CASH') cash += amt; else bank += amt; 
                } else { 
                    if (t.toAccount === 'CASH') cash += amt; else if (t.toAccount === 'BANK') bank += amt; 
                }
            }
        });
        
        return { cash, bank, total: cash + bank };
    }, [config, settlements, expenses, billPayments, transfers]);

    const getLedgerData = (type: 'CASH' | 'BANK') => {
        const items: LedgerItem[] = [];
        const startDate = new Date(config.initialDate);
        const initialAmt = type === 'CASH' ? config.initialCash : config.initialBank;
        items.push({ id: 'init', date: config.initialDate, desc: 'Initial Balance (初始资金)', amount: initialAmt, type: 'IN', category: 'INIT', tag: 'SETUP' });
        settlements.forEach(s => {
            if (new Date(s.date) < startDate) return;
            if (type === 'CASH') {
                if ((s.sales.cash || 0) > 0) items.push({ id: `sale_${s.id}`, date: s.date, desc: 'System Cash Sales (系统记录)', amount: s.sales.cash, type: 'IN', category: 'SALES', tag: 'STOREHUB' });
                if (s.variance && s.variance !== 0) items.push({ id: `var_${s.id}`, date: s.date, desc: `Cash Variance (现金误差调整) ${s.varianceReason ? `[${s.varianceReason}]` : ''}`, amount: Math.abs(s.variance), type: s.variance > 0 ? 'IN' : 'OUT', category: 'ADJUSTMENT', tag: 'VARIANCE' });
            } else {
                const bankIncome = (s.sales.tng || 0) + (s.sales.duitnow || 0) + (s.sales.card || 0);
                const deliveryIncome = s.sales.deliveryBreakdown ? Object.values(s.sales.deliveryBreakdown).reduce((a:number, b:any) => a + (Number(b)||0), 0) : 0;
                const total = bankIncome + deliveryIncome;
                if (total > 0) {
                    items.push({ id: `sale_${s.id}`, date: s.date, desc: 'Digital Sales (电子/外卖营收)', amount: total, type: 'IN', category: 'SALES', tag: 'REVENUE' });
                    const debitFee = (s.sales.duitnow || 0) * 0.0045;
                    const creditFee = (s.sales.card || 0) * 0.01;
                    const totalFee = debitFee + creditFee;
                    if (totalFee > 0) items.push({ id: `fee_${s.id}`, date: s.date, desc: 'Mbb Merchant Fee (银行抽佣)', amount: totalFee, type: 'OUT', category: 'FEE', tag: 'COMMISSION' });
                }
            }
        });
        expenses.forEach(e => {
            const dateStr = e.time.split('T')[0];
            if (new Date(dateStr) < startDate) return;
            if (e.expenseType === 'RECURRING') return;
            const method = (e.paymentMethod || 'BANK_TRANSFER').toUpperCase();
            const isCashExp = method.includes('CASH');
            const isPaid = e.paymentStatus === 'PAID' || e.paymentStatus === 'PARTIAL';
            if (!isPaid) return;
            const amt = e.amount || 0; 
            if (amt > 0) {
                // FIX: 给 DIVIDEND 专属 tag，区分普通支出
                const tag = e.category === 'DIVIDEND' ? 'DIVIDEND' : 'EXPENSE';
                if (type === 'CASH' && isCashExp) items.push({ id: e.id, date: dateStr, desc: e.company + (e.note ? ` - ${e.note}` : ''), amount: amt, type: 'OUT', category: e.category, tag });
                else if (type === 'BANK' && !isCashExp) items.push({ id: e.id, date: dateStr, desc: e.company + (e.note ? ` - ${e.note}` : ''), amount: amt, type: 'OUT', category: e.category, tag });
            }
        });
        billPayments.forEach(b => {
            if (new Date(b.date) < startDate) return;
            const method = (b.method || 'BANK_TRANSFER').toUpperCase();
            const isCashBill = method.includes('CASH');
            if (type === 'CASH' && isCashBill) items.push({ id: b.id, date: b.date, desc: b.name, amount: b.amount, type: 'OUT', category: b.category, tag: 'BILL' });
            else if (type === 'BANK' && !isCashBill) items.push({ id: b.id, date: b.date, desc: b.name, amount: b.amount, type: 'OUT', category: b.category, tag: 'BILL' });
        });
        transfers.forEach(t => {
            const dateStr = t.date.split('T')[0];
            if (new Date(dateStr) < startDate) return;
            if (t.toAccount === type) {
                let desc = 'Transfer In'; let tag = 'TRANSFER';
                if (t.fromAccount === 'SHAREHOLDER' as any) { desc = 'Shareholder Injection'; tag = 'EQUITY'; }
                else if (t.fromAccount === 'OTHER' as any) { desc = 'Extra Income'; tag = 'INCOME'; }
                else if (t.fromAccount === 'CASH') { desc = 'Deposit from Cash'; }
                else if (t.fromAccount === 'BANK') { desc = 'Withdrawal from Bank'; }
                if (t.note) desc += ` (${t.note})`;
                items.push({ id: t.id, date: dateStr, desc, amount: t.amount, type: 'IN', category: 'TRANSFER', tag });
            }
            if (t.fromAccount === type) {
                let desc = 'Transfer Out'; let tag = 'TRANSFER';
                if (t.toAccount === 'CASH') { desc = 'Withdrawal to Cash'; }
                else if (t.toAccount === 'BANK') { desc = 'Deposit to Bank'; }
                if (t.note) desc += ` (${t.note})`;
                items.push({ id: t.id, date: dateStr, desc, amount: t.amount, type: 'OUT', category: 'TRANSFER', tag });
            }
        });
        items.sort((a,b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB; 
            if (a.category === 'INIT') return -1; if (b.category === 'INIT') return 1;
            if (a.type === 'IN' && b.type === 'OUT') return -1; if (a.type === 'OUT' && b.type === 'IN') return 1;
            return 0;
        });
        let currentBalance = 0;
        const processedItems = items.map(item => {
            if (item.id === 'init') { currentBalance = item.amount; return { ...item, balance: currentBalance }; }
            if (item.type === 'IN') currentBalance += item.amount; else currentBalance -= item.amount;
            return { ...item, balance: currentBalance };
        });
        return processedItems.sort((a,b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateB - dateA;
            if (a.type === 'IN' && b.type === 'OUT') return -1; if (a.type === 'OUT' && b.type === 'IN') return 1;
            return 0;
        });
    };

    // --- HANDLERS ---
    const handleSaveConfig = async () => { await DataManager.saveTreasuryConfig(config); alert("✅ 设置已保存 (Settings Saved)"); loadData(); };
    
    const handleSaveShareholder = async () => {
        if (!shareholderForm.name || !shareholderForm.investmentAmount) return alert("Name & Investment Required");
        const newShareholder: Shareholder = { id: shareholderForm.id || `sh_${Date.now()}`, name: shareholderForm.name, investmentAmount: Number(shareholderForm.investmentAmount), equityPercentage: Number(shareholderForm.equityPercentage), role: shareholderForm.role };
        const currentList = config.shareholders || [];
        const updatedList = shareholderForm.id ? currentList.map(s => s.id === newShareholder.id ? newShareholder : s) : [...currentList, newShareholder];
        const newConfig = { ...config, shareholders: updatedList };
        setConfig(newConfig); await DataManager.saveTreasuryConfig(newConfig); setIsShareholderFormOpen(false); setShareholderForm({ name: '', investmentAmount: 0, equityPercentage: 0 });
    };
    
    const handleDeleteShareholder = async (id: string) => { if(!confirm("Delete Shareholder?")) return; const newConfig = { ...config, shareholders: config.shareholders?.filter(s => s.id !== id) }; setConfig(newConfig); await DataManager.saveTreasuryConfig(newConfig); };
    
    const handleSaveExpense = async () => { if (!expenseForm.amount || !expenseForm.company) return alert("Please fill amount and details"); const newExpense: ExpenseItem = { id: `exp_${Date.now()}`, category: expenseForm.category || 'OTHER', expenseType: 'GENERAL', company: expenseForm.company, amount: Number(expenseForm.amount), note: expenseForm.note || 'Manual Entry', time: expenseForm.time ? `${expenseForm.time}T12:00:00` : new Date().toISOString(), paymentMethod: expenseForm.paymentMethod || 'BANK_TRANSFER', paymentStatus: 'PAID', totalBillAmount: Number(expenseForm.amount), outstandingAmount: 0 }; await DataManager.saveStandaloneExpense(newExpense); setIsExpenseModalOpen(false); setExpenseForm({ category: 'RENOVATION', amount: 0, company: '', note: '', paymentMethod: 'BANK_TRANSFER', time: new Date().toISOString().split('T')[0] }); alert("✅ 支出已补录 (Expense Recorded)"); loadExpenses(); };
    
    const handleSaveTransfer = async () => { if (!transferForm.amount || transferForm.amount <= 0) return alert("Enter valid amount"); const newTransfer: FundTransfer = { id: `trf_${Date.now()}`, date: transferForm.date || new Date().toISOString(), amount: Number(transferForm.amount), fromAccount: transferForm.fromAccount as any, toAccount: transferForm.toAccount as any, type: transferForm.type as any, note: transferForm.note }; await DataManager.saveFundTransfer(newTransfer); setTransfers([newTransfer, ...transfers]); setIsTransferModalOpen(false); alert("✅ 转账记录已保存"); loadData(); };
    
    const handleSaveInjection = async () => { if (!injectionForm.shareholderName || !injectionForm.amount) return alert("请填写完整信息"); const newTransfer: FundTransfer = { id: `inj_${Date.now()}`, date: injectionForm.date, amount: parseFloat(injectionForm.amount), fromAccount: 'SHAREHOLDER' as any, toAccount: injectionForm.toAccount as any, type: 'DEPOSIT', note: `[股东注资] ${injectionForm.shareholderName}: ${injectionForm.note || '额外资金'}` }; await DataManager.saveFundTransfer(newTransfer); setTransfers([newTransfer, ...transfers]); setIsInjectionModalOpen(false); setInjectionForm({ shareholderName: '', amount: '', toAccount: 'BANK', date: new Date().toISOString().split('T')[0], note: '' }); alert("✅ 资金注入已记录 (Injection Recorded)"); loadData(); };
    
    const handleSaveIncome = async () => { if (!incomeForm.amount) return alert("请输入金额"); const newTransfer: FundTransfer = { id: `inc_${Date.now()}`, date: incomeForm.date, amount: parseFloat(incomeForm.amount), fromAccount: 'OTHER' as any, toAccount: incomeForm.toAccount as any, type: 'DEPOSIT', note: `[代收] ${incomeForm.source} - ${incomeForm.category}${incomeForm.note ? ` (${incomeForm.note})` : ''}` }; await DataManager.saveFundTransfer(newTransfer); setTransfers([newTransfer, ...transfers]); setIsIncomeModalOpen(false); setIncomeForm({ source: '', category: 'ELECTRICITY', amount: '', toAccount: 'CASH', date: new Date().toISOString().split('T')[0], note: '' }); alert("✅ 代收收入已记录 (Income Recorded)"); loadData(); };
    
    const handleDeleteTransfer = async (id: string) => { if(!confirm("Delete record?")) return; await DataManager.deleteFundTransfer(id); setTransfers(transfers.filter(t => t.id !== id)); loadData(); };
    
    const handleGenerateReceipt = async (record: FundTransfer) => {
        // FIX: 防止并发，已在生成中则直接返回
        if (isGeneratingPdf) return;
        setPrintingRecord(record);
        setIsGeneratingPdf(true);
        setTimeout(async () => {
            if (!printRef.current) return;
            try {
                const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const pdf = new jsPDF('p', 'mm', 'a5');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`Receipt_${record.date}_${record.id.slice(-4)}.pdf`);
            } catch (err) {
                console.error("PDF Gen Error:", err);
                alert("生成收据失败 (Failed to generate PDF)");
            } finally {
                setIsGeneratingPdf(false);
                setPrintingRecord(null);
            }
        }, 800);
    };
    
    // FIX: Dividend time 字段改为完整 ISO 格式，确保 split('T')[0] 能正确解析
    const handleSaveDividend = async () => {
        if (!dividendForm.shareholderId || !dividendForm.amount) return alert("Please fill all fields");
        const sh = config.shareholders?.find(s => s.id === dividendForm.shareholderId);
        const companyName = sh ? sh.name : 'Unknown';

        const newExpense: ExpenseItem = {
            id: `div_${Date.now()}`,
            category: 'DIVIDEND',
            expenseType: 'GENERAL',
            company: companyName,
            amount: parseFloat(dividendForm.amount),
            paymentStatus: 'PAID',
            paymentMethod: dividendForm.paymentMethod as any,
            // FIX: 统一使用带时间的 ISO 格式，防止 split('T')[0] 解析失败
            time: `${dividendForm.date}T12:00:00`,
            note: `[股东分红] ${dividendForm.note || 'Dividend Payout'}`,
            paidBy: 'COMPANY'
        };

        await DataManager.saveStandaloneExpense(newExpense);
        setIsDividendModalOpen(false);
        setDividendForm({ shareholderId: '', amount: '', paymentMethod: 'BANK_TRANSFER', date: new Date().toISOString().split('T')[0], note: '' });
        alert("✅ 分红已记录并扣除 (Dividend Recorded)");
        loadExpenses();
    };

    const handleDeleteExpense = async (id: string) => {
        if(!confirm("Delete this payout record?")) return;
        try {
            await deleteDoc(doc(db, 'standalone_expenses', id));
            loadExpenses();
        } catch(e) {
            console.error(e);
            alert("Delete failed");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-[#F5F7FA] w-full h-full md:max-w-5xl md:h-[90vh] md:rounded-[2rem] flex flex-col overflow-hidden shadow-2xl relative font-sans">
                
                {/* Header */}
                <div className="bg-[#1A1A1A] p-4 md:p-5 flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700]">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="bg-[#FFD700] text-black p-2 md:p-2.5 rounded-xl shadow-lg"><Wallet size={20} className="md:w-6 md:h-6"/></div>
                        <div>
                            <h3 className="font-serif font-black text-lg md:text-xl tracking-wide">资金管理 (Treasury)</h3>
                            <p className="text-[9px] md:text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">CASH FLOW & ASSETS</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ModuleGuideButton module="TREASURY" />
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-3 md:px-6 pt-4 pb-2 bg-[#F5F7FA] shrink-0">
                    <div className="flex p-1.5 bg-gray-200/60 rounded-2xl overflow-x-auto scrollbar-hide shadow-inner gap-1 border border-gray-200">
                        {[
                            { id: 'OVERVIEW', label: '资产总览 (Overview)', icon: Landmark },
                            { id: 'TRANSFERS', label: '转账/存入 (Transfers)', icon: ArrowRightLeft },
                            { id: 'EXTRA_INCOME', label: '额外收入 (Income)', icon: TrendingUp },
                            { id: 'EQUITY', label: '股权 (Equity)', icon: Briefcase },
                            { id: 'SETTINGS', label: '设置 (Settings)', icon: Settings },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 min-w-[110px] py-2.5 md:py-3 rounded-xl text-[10px] md:text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-[#1A1A1A] shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-black/5 transform scale-[1.02]' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`}><tab.icon size={14} className={`transition-colors ${activeTab === tab.id ? 'text-[#C70000]' : 'text-gray-400'}`}/> {tab.label}</button>
                        ))}
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-4 md:p-8 pb-32 md:pb-8">
                    {activeTab === 'OVERVIEW' && (
                        <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">
                            <div className="bg-[#1A1A1A] rounded-3xl p-5 md:p-8 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFD700] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
                                <div className="relative z-10 text-center md:text-left"><p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-1 md:mb-2">Total Assets (总资金)</p><h2 className="text-3xl md:text-6xl font-black text-[#FFD700] font-mono tracking-tight">{formatMoney(balances.total)}</h2><p className="text-[9px] md:text-[10px] text-gray-500 mt-1 md:mt-2 italic">Calculated from {config.initialDate}</p></div>
                                <div className="relative z-10 flex flex-col gap-2 w-full md:w-auto"><button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 md:py-3 rounded-2xl shadow-xl flex items-center gap-3 font-black text-xs md:text-sm transition-transform active:scale-95 border border-red-500 w-full justify-center"><MinusCircle size={16}/> 补录支出 (Expense)</button></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                <div onClick={() => setViewLedger('CASH')} className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between min-h-32 md:min-h-40 relative overflow-hidden group cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"><div className="absolute right-0 top-0 p-4 md:p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Banknote size={80} className="text-green-600 md:w-[120px] md:h-[120px]"/></div><div className="flex justify-between items-start mb-3 md:mb-4"><div className="p-2 md:p-3 bg-green-50 rounded-2xl text-green-600 inline-block"><Banknote size={20} className="md:w-6 md:h-6"/></div><div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); setTransferForm({ type: 'DEPOSIT', fromAccount: 'CASH', toAccount: 'BANK', date: new Date().toISOString().split('T')[0] }); setIsTransferModalOpen(true); }} className="text-[10px] bg-black text-white px-3 py-1.5 rounded-lg font-bold hover:bg-gray-800 transition-colors shadow-lg whitespace-nowrap">存入 (Bank In)</button></div></div><div><p className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Cash on Hand (现金)</p><h3 className="text-xl md:text-3xl font-black text-[#1A1A1A] font-mono">{formatMoney(balances.cash)}</h3></div></div>
                                <div onClick={() => setViewLedger('BANK')} className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between min-h-32 md:min-h-40 relative overflow-hidden group cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"><div className="absolute right-0 top-0 p-4 md:p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Landmark size={80} className="text-blue-600 md:w-[120px] md:h-[120px]"/></div><div className="flex justify-between items-start mb-3 md:mb-4"><div className="p-2 md:p-3 bg-blue-50 rounded-2xl text-blue-600 inline-block"><Landmark size={20} className="md:w-6 md:h-6"/></div><div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); setTransferForm({ type: 'WITHDRAWAL', fromAccount: 'BANK', toAccount: 'CASH', date: new Date().toISOString().split('T')[0] }); setIsTransferModalOpen(true); }} className="text-[10px] bg-black text-white px-3 py-1.5 rounded-lg font-bold hover:bg-gray-800 transition-colors shadow-lg whitespace-nowrap">提款 (Withdraw)</button></div></div><div><p className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Bank & Digital (银行)</p><h3 className="text-xl md:text-3xl font-black text-[#1A1A1A] font-mono">{formatMoney(balances.bank)}</h3></div></div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'EXTRA_INCOME' && (
                        <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[2.5rem] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 border border-emerald-500/30"><div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div><div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none"></div><div className="relative z-10 text-center md:text-left space-y-2"><div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-emerald-100 text-[10px] font-black uppercase tracking-widest border border-white/10"><TrendingUp size={12}/> Non-Business Revenue</div><h2 className="text-4xl md:text-6xl font-black text-white font-mono tracking-tighter drop-shadow-sm">{formatMoney(extraIncomeStats.total)}</h2><div className="flex items-center justify-center md:justify-start gap-4 text-emerald-100 text-xs font-bold"><span className="flex items-center gap-1"><Calendar size={14}/> 本月收入 (This Month): {formatMoney(extraIncomeStats.thisMonthTotal)}</span></div></div><button onClick={() => setIsIncomeModalOpen(true)} className="relative z-10 bg-white text-emerald-800 px-8 py-4 rounded-2xl shadow-[0_10px_20px_rgba(0,0,0,0.2)] flex items-center gap-3 font-black text-sm transition-all hover:scale-105 active:scale-95 hover:bg-emerald-50"><div className="bg-emerald-100 p-1.5 rounded-full"><Plus size={16} className="text-emerald-700"/></div><span>记录新收入 (Record)</span></button></div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[{l:'Electricity',v:extraIncomeStats.breakdown.electricity,c:'text-yellow-600',b:'bg-yellow-50',i:Zap},{l:'Water',v:extraIncomeStats.breakdown.water,c:'text-cyan-600',b:'bg-cyan-50',i:Droplets},{l:'Rent',v:extraIncomeStats.breakdown.rent,c:'text-indigo-600',b:'bg-indigo-50',i:Home},{l:'Other',v:extraIncomeStats.breakdown.other,c:'text-emerald-600',b:'bg-emerald-50',i:Coins}].map(c => (<div key={c.l} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between h-32 relative group overflow-hidden"><div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><c.i size={64}/></div><div className="relative z-10"><div className={`w-10 h-10 rounded-2xl ${c.b} ${c.c} flex items-center justify-center mb-3 shadow-inner`}><c.i size={20} fill="currentColor"/></div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{c.l}</p><p className="text-lg md:text-xl font-black text-[#1A1A1A]">{formatMoney(c.v)}</p></div></div>))}</div>
                            <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden"><div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center"><h3 className="font-black text-lg text-[#1A1A1A] flex items-center gap-2"><History size={20} className="text-gray-400"/> 收入记录 (History)</h3><span className="text-xs font-bold text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">{extraIncomeStats.records.length} Records</span></div><div className="divide-y divide-gray-100">{extraIncomeStats.records.length === 0 ? (<div className="p-12 text-center text-gray-400 text-sm font-bold flex flex-col items-center"><div className="bg-gray-100 p-4 rounded-full mb-3"><Archive size={24} className="opacity-50"/></div>暂无收入记录</div>) : (extraIncomeStats.records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (<div key={t.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors group"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-100 text-gray-600"><Recycle size={20} fill="currentColor" className="opacity-80"/></div><div><div className="font-bold text-sm text-[#1A1A1A]">{t.note?.replace('[代收] ', '') || 'Income'}</div><div className="text-[10px] text-gray-400 font-bold mt-0.5 flex items-center gap-2"><span className="bg-gray-100 px-1.5 py-0.5 rounded">{t.date}</span><span>•</span><span className="uppercase">{t.toAccount}</span></div></div></div><div className="flex items-center gap-4"><span className="font-mono font-black text-base text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">+{formatMoney(t.amount)}</span><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleGenerateReceipt(t)} disabled={isGeneratingPdf} className="p-2 bg-white border border-gray-200 text-gray-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm" title="打印收据 (Print Receipt)">{isGeneratingPdf && printingRecord?.id === t.id ? <Loader2 size={14} className="animate-spin"/> : <Printer size={14}/>}</button><button onClick={() => handleDeleteTransfer(t.id)} className="p-2 bg-white border border-gray-200 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"><Trash2 size={14}/></button></div></div></div>)))}</div></div>
                        </div>
                    )}
                    {activeTab === 'EQUITY' && (
                        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-200">
                                <div className="flex justify-between items-center mb-4 md:mb-6">
                                    <div><h3 className="font-black text-base md:text-lg text-[#1A1A1A] flex items-center gap-2"><Users size={18} className="md:w-5 md:h-5"/> 股东与股本</h3><p className="text-[10px] md:text-xs text-gray-400 font-bold mt-1">Paid-up Capital: {formatMoney(totalCapital)}</p></div>
                                    <button onClick={() => { setShareholderForm({ name:'', investmentAmount:0, equityPercentage:0 }); setIsShareholderFormOpen(true); }} className="bg-[#1A1A1A] text-[#FFD700] px-3 md:px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-black flex items-center gap-2 whitespace-nowrap"><UserPlus size={14}/> 添加股东</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                    {(config.shareholders || []).map(s => (
                                        <div key={s.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center group relative">
                                            <div>
                                                <h4 className="font-black text-sm text-[#1A1A1A]">{s.name} <span className="text-[10px] text-gray-400 font-normal">({s.role || 'Investor'})</span></h4>
                                                <div className="flex items-center gap-3 mt-1"><span className="text-xs font-mono font-bold text-blue-600">{formatMoney(s.investmentAmount)}</span><span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black">{s.equityPercentage}%</span></div>
                                            </div>
                                            <div className="flex gap-2"><button onClick={() => { setShareholderForm(s); setIsShareholderFormOpen(true); }} className="p-2 bg-white rounded-lg text-gray-400 hover:text-black shadow-sm"><Settings size={14}/></button><button onClick={() => handleDeleteShareholder(s.id)} className="p-2 bg-white rounded-lg text-gray-400 hover:text-red-600 shadow-sm"><Trash2 size={14}/></button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-200">
                                <div className="flex justify-between items-center mb-4">
                                    <div><h3 className="font-black text-base md:text-lg text-[#1A1A1A] flex items-center gap-2"><PiggyBank size={18} className="md:w-5 md:h-5"/> 股东注资/垫资</h3><p className="text-[10px] md:text-xs text-gray-400 font-bold mt-1">Capital Injection</p></div>
                                    <button onClick={() => setIsInjectionModalOpen(true)} className="bg-green-50 text-green-700 border border-green-100 px-3 md:px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-100 flex items-center gap-2 whitespace-nowrap"><Plus size={14}/> 股东注资</button>
                                </div>
                                <div className="space-y-3">
                                    {transfers.filter(t => t.fromAccount === 'SHAREHOLDER' as any).length === 0 ? (<div className="text-center py-6 text-gray-400 text-xs italic">暂无记录</div>) : (transfers.filter(t => t.fromAccount === 'SHAREHOLDER' as any).slice(0, 5).map(t => (<div key={t.id} className="flex justify-between items-center p-3 bg-green-50/50 rounded-xl border border-green-100"><div><div className="font-bold text-xs text-[#1A1A1A]">{t.note?.replace('[股东注资] ', '') || 'Injection'}</div><div className="text-[10px] text-gray-400 mt-0.5">{t.date} • Into {t.toAccount}</div></div><div className="flex items-center gap-3"><span className="font-mono font-black text-green-600 text-sm">+{formatMoney(t.amount)}</span><button onClick={() => handleDeleteTransfer(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button></div></div>)))}
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-200">
                                <div className="flex justify-between items-center mb-4">
                                    <div><h3 className="font-black text-base md:text-lg text-[#1A1A1A] flex items-center gap-2"><Gem size={18} className="md:w-5 md:h-5"/> 股东分红 / 提款</h3><p className="text-[10px] md:text-xs text-gray-400 font-bold mt-1">Dividend Payouts (Wages)</p></div>
                                    <button onClick={() => setIsDividendModalOpen(true)} className="bg-red-50 text-red-700 border border-red-100 px-3 md:px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 flex items-center gap-2 whitespace-nowrap"><MinusCircle size={14}/> 分发分红</button>
                                </div>
                                <div className="space-y-3">
                                    {dividendHistory.length === 0 ? (<div className="text-center py-6 text-gray-400 text-xs italic">暂无分红记录</div>) : (dividendHistory.slice(0, 5).map(t => (
                                        <div key={t.id} className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100">
                                            <div>
                                                <div className="font-bold text-xs text-[#1A1A1A]">{t.note}</div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">{t.time.split('T')[0]} • Via {t.paymentMethod}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono font-black text-red-600 text-sm">-{formatMoney(t.amount)}</span>
                                                <button onClick={() => handleDeleteExpense(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    )))}
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'TRANSFERS' && (<div className="max-w-4xl mx-auto space-y-6"><div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-200"><h3 className="font-black text-lg text-[#1A1A1A] flex items-center gap-2"><History size={20}/> 转账记录 (History)</h3><button onClick={() => { setTransferForm({ type: 'DEPOSIT', fromAccount: 'CASH', toAccount: 'BANK', date: new Date().toISOString().split('T')[0] }); setIsTransferModalOpen(true); }} className="bg-[#1A1A1A] text-[#FFD700] px-4 py-2 rounded-xl font-bold text-xs shadow-lg hover:bg-black flex items-center gap-2"><Plus size={16}/> 新增记录</button></div><div className="space-y-3">{transfers.length === 0 ? <div className="text-center py-12 text-gray-400 font-bold text-sm">暂无转账记录</div> : transfers.map(t => { if (t.fromAccount === 'OTHER' as any || t.fromAccount === 'SHAREHOLDER' as any) return null; return (<div key={t.id} className="bg-white p-3 md:p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm"><div className="flex items-center gap-3 md:gap-4"><div className={`p-2 md:p-3 rounded-xl ${t.type === 'DEPOSIT' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>{t.type === 'DEPOSIT' ? <ArrowUpRight size={18} className="md:w-5 md:h-5"/> : <ArrowDownLeft size={18} className="md:w-5 md:h-5"/>}</div><div><h4 className="font-black text-xs md:text-sm text-[#1A1A1A]">{t.type === 'DEPOSIT' ? 'Cash Bank In (存入)' : 'Withdrawal (提款)'}</h4><div className="text-[10px] md:text-xs text-gray-500 font-mono mt-0.5">{t.date.split('T')[0]} • {t.fromAccount} ➔ {t.toAccount}</div>{t.note && <div className="text-[9px] md:text-[10px] text-gray-400 mt-1 italic max-w-[150px] truncate">"{t.note}"</div>}</div></div><div className="flex items-center gap-3 md:gap-4"><span className="font-mono font-black text-sm md:text-lg">RM {t.amount.toLocaleString()}</span><button onClick={() => handleDeleteTransfer(t.id)} className="p-2 text-gray-300 hover:text-red-500 rounded-full transition-colors"><Trash2 size={16}/></button></div></div>); })}</div></div>)}
                    {activeTab === 'SETTINGS' && (<div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-[2rem] shadow-lg border border-gray-200"><h3 className="font-black text-xl text-[#1A1A1A] mb-6 flex items-center gap-2"><Settings size={24}/> 初始资金设置</h3><div className="space-y-6"><div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-xs text-yellow-800 font-bold flex items-start gap-2"><Info size={16} className="mt-0.5 shrink-0"/><div>⚠️ 注意：修改此设置会重置资金计算的起点。<br/>请确保输入的金额是 <strong>{config.initialDate}</strong> 当天的实际结余。</div></div><div><label className="text-xs font-black text-gray-400 uppercase mb-2 block">生效日期 (Start Date)</label><input type="date" value={config.initialDate} onChange={e => setConfig({...config, initialDate: e.target.value})} className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:border-[#FFD700] outline-none" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"><div><label className="text-xs font-black text-gray-400 uppercase mb-2 block">Initial Cash (现金)</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">RM</span><input type="number" value={config.initialCash} onChange={e => setConfig({...config, initialCash: parseFloat(e.target.value)})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-xl font-mono font-black text-lg border-2 border-transparent focus:border-[#FFD700] outline-none" /></div></div><div><label className="text-xs font-black text-gray-400 uppercase mb-2 block">Initial Bank (银行)</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">RM</span><input type="number" value={config.initialBank} onChange={e => setConfig({...config, initialBank: parseFloat(e.target.value)})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-xl font-mono font-black text-lg border-2 border-transparent focus:border-[#FFD700] outline-none" /></div></div></div><button onClick={handleSaveConfig} className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black shadow-lg hover:bg-black transition-colors flex items-center justify-center gap-2"><Save size={18}/> 保存并重新计算</button></div></div>)}
                </div>

                {/* MODALS */}
                {isTransferModalOpen && (<div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"><div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95"><h3 className="font-black text-xl text-[#1A1A1A] mb-6">新增资金记录</h3><div className="space-y-4"><div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl"><button onClick={() => setTransferForm({...transferForm, type: 'DEPOSIT', fromAccount: 'CASH', toAccount: 'BANK'})} className={`py-2 rounded-lg text-xs font-bold transition-all ${transferForm.type === 'DEPOSIT' ? 'bg-white shadow-sm text-green-700' : 'text-gray-400'}`}>存入 (Bank In)</button><button onClick={() => setTransferForm({...transferForm, type: 'WITHDRAWAL', fromAccount: 'BANK', toAccount: 'CASH'})} className={`py-2 rounded-lg text-xs font-bold transition-all ${transferForm.type === 'WITHDRAWAL' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-400'}`}>提款 (Withdraw)</button></div><div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Date</label><input type="date" value={transferForm.date} onChange={e => setTransferForm({...transferForm, date: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold outline-none" /></div><div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Amount (RM)</label><input type="number" value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: parseFloat(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-xl font-mono font-black text-xl outline-none focus:border-[#FFD700] border-2 border-transparent" /></div><div><label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Note</label><input type="text" value={transferForm.note || ''} onChange={e => setTransferForm({...transferForm, note: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold outline-none" placeholder="e.g. ATM Deposit" /></div><div className="flex gap-3 mt-4"><button onClick={() => setIsTransferModalOpen(false)} className="flex-1 py-3 bg-white border border-gray-200 text-gray-500 font-bold rounded-xl text-sm">Cancel</button><button onClick={handleSaveTransfer} className="flex-[2] py-3 bg-[#1A1A1A] text-[#FFD700] font-bold rounded-xl text-sm shadow-lg hover:bg-black">Confirm</button></div></div></div></div>)}
                {isShareholderFormOpen && (<div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95"><h3 className="font-black text-xl text-[#1A1A1A] mb-4">股东资料 (Shareholder)</h3><div className="space-y-3"><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Name</label><input className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={shareholderForm.name} onChange={e => setShareholderForm({...shareholderForm, name: e.target.value})} /></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Role (Title)</label><input className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={shareholderForm.role || ''} onChange={e => setShareholderForm({...shareholderForm, role: e.target.value})} /></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Capital (RM)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={shareholderForm.investmentAmount} onChange={e => setShareholderForm({...shareholderForm, investmentAmount: parseFloat(e.target.value)})} /></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Equity (%)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={shareholderForm.equityPercentage} onChange={e => setShareholderForm({...shareholderForm, equityPercentage: parseFloat(e.target.value)})} /></div></div><button onClick={handleSaveShareholder} className="w-full py-3 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-bold mt-2">Save</button><button onClick={() => setIsShareholderFormOpen(false)} className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-bold">Cancel</button></div></div></div>)}
                {isInjectionModalOpen && (<div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95"><h3 className="font-black text-xl text-[#1A1A1A] mb-4">股东注资 (Injection)</h3><div className="space-y-4"><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Shareholder (股东)</label><select className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={injectionForm.shareholderName} onChange={e => setInjectionForm({...injectionForm, shareholderName: e.target.value})}><option value="">Select Shareholder...</option>{config.shareholders?.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Amount (金额)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-black text-lg outline-none border-2 border-transparent focus:border-[#FFD700]" value={injectionForm.amount} onChange={e => setInjectionForm({...injectionForm, amount: e.target.value})} placeholder="0.00" /></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Into Account (存入账户)</label><div className="flex gap-2"><button onClick={() => setInjectionForm({...injectionForm, toAccount: 'BANK'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${injectionForm.toAccount === 'BANK' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>BANK</button><button onClick={() => setInjectionForm({...injectionForm, toAccount: 'CASH'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${injectionForm.toAccount === 'CASH' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-500'}`}>CASH</button></div></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Date (日期)</label><input type="date" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={injectionForm.date} onChange={e => setInjectionForm({...injectionForm, date: e.target.value})} /></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Note (备注)</label><input type="text" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={injectionForm.note} onChange={e => setInjectionForm({...injectionForm, note: e.target.value})} placeholder="e.g. Working Capital" /></div><button onClick={handleSaveInjection} className="w-full py-3 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-bold mt-2 shadow-lg">确认注资 (Confirm)</button><button onClick={() => setIsInjectionModalOpen(false)} className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-bold">Cancel</button></div></div></div>)}
                {isIncomeModalOpen && (<div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95"><h3 className="font-black text-xl text-[#1A1A1A] mb-4">代收/杂项收入 (Extra Income)</h3><div className="space-y-4"><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Source (来源)</label><input list="income_sources" type="text" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={incomeForm.source} onChange={e => setIncomeForm({...incomeForm, source: e.target.value})} placeholder="e.g. 隔壁店铺" /><datalist id="income_sources">{incomeSourceHistory.map((src, idx) => (<option key={idx} value={src} />))}</datalist></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Category (类别)</label><select className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={incomeForm.category} onChange={e => setIncomeForm({...incomeForm, category: e.target.value})}><option value="ELECTRICITY">电费 (Electricity)</option><option value="WATER">水费 (Water)</option><option value="RENT">租金 (Rent)</option><option value="OTHER">其他 (Other)</option></select></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Amount (金额)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-black text-lg outline-none border-2 border-transparent focus:border-[#FFD700]" value={incomeForm.amount} onChange={e => setIncomeForm({...incomeForm, amount: e.target.value})} placeholder="0.00" /></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Into Account (存入账户)</label><div className="flex gap-2"><button onClick={() => setIncomeForm({...incomeForm, toAccount: 'CASH'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${incomeForm.toAccount === 'CASH' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-500'}`}>CASH</button><button onClick={() => setIncomeForm({...incomeForm, toAccount: 'BANK'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${incomeForm.toAccount === 'BANK' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>BANK</button></div></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Date (日期)</label><input type="date" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={incomeForm.date} onChange={e => setIncomeForm({...incomeForm, date: e.target.value})} /></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Note (备注)</label><input type="text" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={incomeForm.note} onChange={e => setIncomeForm({...incomeForm, note: e.target.value})} placeholder="Optional..." /></div><button onClick={handleSaveIncome} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold mt-2 shadow-lg hover:bg-green-700">确认收入 (Confirm)</button><button onClick={() => setIsIncomeModalOpen(false)} className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-bold">Cancel</button></div></div></div>)}
                {isExpenseModalOpen && (<div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95"><h3 className="font-black text-xl text-[#1A1A1A] mb-2">补录/记录支出</h3><div className="space-y-3"><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Category</label><select className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}><option value="RENOVATION">装修工程 (Renovation)</option><option value="EQUIPMENT">设备采购 (Equipment)</option><option value="RENT">租金 (Rent)</option><option value="UTILITIES">水电 (Utilities)</option><option value="SALARY">薪资 (Salary)</option><option value="SUPPLIES">杂项 (Supplies)</option><option value="LICENSE">执照 (License)</option><option value="OTHER">其他 (Other)</option></select></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Description / Item</label><input className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={expenseForm.company} onChange={e => setExpenseForm({...expenseForm, company: e.target.value})} placeholder="e.g. Renovation Contractor" /></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Amount (RM)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: parseFloat(e.target.value)})} /></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Payment Source</label><div className="flex gap-2"><button onClick={() => setExpenseForm({...expenseForm, paymentMethod: 'BANK_TRANSFER'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${expenseForm.paymentMethod === 'BANK_TRANSFER' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>BANK</button><button onClick={() => setExpenseForm({...expenseForm, paymentMethod: 'CASH'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${expenseForm.paymentMethod === 'CASH' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-500'}`}>CASH</button></div></div><div><label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Date (Backdate Allowed)</label><input type="date" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={expenseForm.time?.split('T')[0]} onChange={e => setExpenseForm({...expenseForm, time: e.target.value})} /></div><button onClick={handleSaveExpense} className="w-full py-3 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-bold mt-2 shadow-lg">确认支出 (Confirm)</button><button onClick={() => setIsExpenseModalOpen(false)} className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-bold">Cancel</button></div></div></div>)}

                {isDividendModalOpen && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 border-t-8 border-red-500">
                            <h3 className="font-black text-xl text-[#1A1A1A] mb-4">分发分红 (Payout)</h3>
                            <p className="text-xs text-gray-500 mb-4 font-bold">当作工钱发放，将从公司资金中扣除。</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Shareholder (股东)</label>
                                    <select className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={dividendForm.shareholderId} onChange={e => setDividendForm({...dividendForm, shareholderId: e.target.value})}>
                                        <option value="">Select Shareholder...</option>
                                        {config.shareholders?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Amount (金额)</label>
                                    <input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-black text-lg outline-none border-2 border-transparent focus:border-[#FFD700]" value={dividendForm.amount} onChange={e => setDividendForm({...dividendForm, amount: e.target.value})} placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Payment Method (资金来源)</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => setDividendForm({...dividendForm, paymentMethod: 'BANK_TRANSFER'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${dividendForm.paymentMethod === 'BANK_TRANSFER' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>BANK</button>
                                        <button onClick={() => setDividendForm({...dividendForm, paymentMethod: 'CASH'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${dividendForm.paymentMethod === 'CASH' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-500'}`}>CASH</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Date (日期)</label>
                                    <input type="date" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={dividendForm.date} onChange={e => setDividendForm({...dividendForm, date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Note (备注)</label>
                                    <input type="text" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none" value={dividendForm.note} onChange={e => setDividendForm({...dividendForm, note: e.target.value})} placeholder="e.g. June Dividend" />
                                </div>
                                <button onClick={handleSaveDividend} className="w-full py-3 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-bold mt-2 shadow-lg hover:bg-black">确认分发 (Confirm)</button>
                                <button onClick={() => setIsDividendModalOpen(false)} className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-bold">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* HIDDEN PRINT */}
                <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                    <div ref={printRef} className="w-[148mm] min-h-[210mm] bg-white p-8 font-sans text-black relative border">
                        <div className="flex justify-between items-start border-b-4 border-black pb-4 mb-6">
                            <div><h1 className="text-3xl font-black uppercase tracking-widest mb-1">OFFICIAL RECEIPT</h1><p className="text-xs font-bold text-gray-500">KIM LIAN KEE (KEPONG)</p><p className="text-[10px] text-gray-400 mt-1">No. 52, Jalan Metro Perdana Barat 13<br/>Kepong, 52100 Kuala Lumpur</p></div>
                            <div className="text-right"><p className="text-xl font-mono font-black">{printingRecord?.id.slice(-6)}</p><p className="text-sm font-bold text-gray-500">{printingRecord?.date}</p></div>
                        </div>
                        {printingRecord && (() => {
                            const cleanNote = printingRecord.note?.replace('[代收] ', '') || '';
                            const dashIndex = cleanNote.indexOf(' - ');
                            // FIX: 更安全的 note 解析，有 fallback
                            const sourceName = dashIndex > -1 ? cleanNote.substring(0, dashIndex) : cleanNote || 'N/A';
                            const description = dashIndex > -1 ? cleanNote.substring(dashIndex + 3) : 'Payment';
                            return (<div className="space-y-6"><div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Received From (收到):</p><h2 className="text-xl font-bold">{sourceName}</h2></div><div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Payment For (款项用途):</p><h2 className="text-lg font-bold">{description}</h2></div><div className="flex justify-between items-center bg-black text-white p-6 rounded-xl"><p className="text-sm font-bold uppercase tracking-widest">Amount Received</p><p className="text-3xl font-mono font-black">RM {printingRecord.amount.toFixed(2)}</p></div><div className="flex justify-between text-xs font-bold text-gray-500 mt-4 px-2"><span>Payment Mode: {printingRecord.toAccount}</span><span>Status: PAID</span></div></div>);
                        })()}
                        <div className="absolute bottom-8 left-8 right-8"><div className="grid grid-cols-2 gap-12"><div className="border-t border-black pt-2"><p className="text-[10px] font-bold uppercase">Received By</p><p className="text-xs">Kim Lian Kee</p></div><div className="border-t border-black pt-2"><p className="text-[10px] font-bold uppercase">Authorized Signature</p></div></div><p className="text-[8px] text-center text-gray-400 mt-8 uppercase tracking-widest">System Generated Receipt • No Signature Required</p></div>
                    </div>
                </div>

                {viewLedger && (
                    <LedgerModal isOpen={!!viewLedger} type={viewLedger} onClose={() => setViewLedger(null)} items={getLedgerData(viewLedger)}/>
                )}

            </div>
        </div>
    );
};