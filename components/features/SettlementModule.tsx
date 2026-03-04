import React, { useState, useEffect, useMemo } from 'react';
import { 
    DollarSign, Plus, Trash2, Check, 
    AlertTriangle, Calculator, Play, Power, History, 
    ArrowRight, Receipt, Wallet, Banknote, CreditCard, 
    Coins, X, Calendar, ChevronRight, Truck, CheckCircle2, 
    RotateCcw, AlertCircle, MinusCircle, Loader2, User, FileText, UserMinus // 🟢 1. 把 UserMinus 加到这里
} from 'lucide-react';
import { SettlementRecord, ExpenseItem, StoreConfig, Employee, Supplier } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';

interface SettlementModuleProps {
    storeConfig: StoreConfig;
    onClose?: () => void;
    isStandalone?: boolean;
}

const DENOMINATIONS = [
    { label: 'RM 100', value: 100, color: 'border-purple-200 bg-purple-50 text-purple-700' },
    { label: 'RM 50', value: 50, color: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
    { label: 'RM 20', value: 20, color: 'border-orange-200 bg-orange-50 text-orange-700' },
    { label: 'RM 10', value: 10, color: 'border-red-200 bg-red-50 text-red-700' },
    { label: 'RM 5', value: 5, color: 'border-green-200 bg-green-50 text-green-700' },
    { label: 'RM 1', value: 1, color: 'border-blue-200 bg-blue-50 text-blue-700' },
];

const getBusinessDateStr = (cutoff: number) => {
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour < cutoff) {
        now.setDate(now.getDate() - 1);
    }
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getCalendarTodayStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- CASH OUT MODAL COMPONENT (ENHANCED) ---
const ExpenseModal = ({ 
    isOpen, 
    onClose, 
    onSave, 
    employees,
    suppliers 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    onSave: (exp: ExpenseItem) => void, 
    employees: Employee[],
    suppliers: Supplier[]
}) => {
    const [type, setType] = useState<'SUPPLIER' | 'STAFF_ADVANCE' | 'GENERAL'>('SUPPLIER');
    const [amount, setAmount] = useState<string>('');
    const [targetId, setTargetId] = useState<string>('');
    const [billRef, setBillRef] = useState<string>('');
    
    useEffect(() => {
        setTargetId('');
        setBillRef('');
    }, [type]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!amount || parseFloat(amount) <= 0) return alert("请输入金额 (Please enter amount)");

        let companyName = '';
        let noteText = '';
        let category = 'GENERAL';

        if (type === 'SUPPLIER') {
            if (!targetId) return alert("请选择供应商 (Select Supplier)");
            const sup = suppliers.find(s => s.id === targetId);
            companyName = sup ? sup.name : 'Unknown Supplier';
            noteText = billRef ? `Bill Ref: ${billRef}` : 'COD Payment';
            category = sup?.category || 'SUPPLIER';
        } else if (type === 'STAFF_ADVANCE') {
            if (!targetId) return alert("请选择员工 (Select Staff)");
            const emp = employees.find(e => e.id === targetId);
            companyName = emp ? emp.name : 'Unknown Staff';
            noteText = billRef ? `Note: ${billRef}` : 'Cash Advance';
            category = 'STAFF_ADVANCE';
        } else {
            if (!billRef) return alert("请输入用途/备注 (Enter Description)");
            companyName = billRef;
            noteText = 'Petty Cash Bill';
            category = 'GENERAL';
        }

        const expense: ExpenseItem = {
            id: `exp_${Date.now()}`,
            category: category as any,
            expenseType: 'CASH_OUT',
            company: companyName,
            amount: parseFloat(amount),
            paymentStatus: 'PAID',
            paymentMethod: 'CASH',
            time: new Date().toISOString(),
            note: noteText,
            paidBy: 'SHOP_CASH',
            isAdvancePayment: false 
        };
        onSave(expense);
        setAmount('');
        setTargetId('');
        setBillRef('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-xl text-[#1A1A1A] flex items-center gap-2">
                        <MinusCircle className="text-red-600" size={24}/>
                        记一笔支出 (Cash Out)
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                </div>

                <div className="space-y-6 overflow-y-auto pb-4">
                    <div className="grid grid-cols-3 gap-3">
                        <button onClick={() => setType('SUPPLIER')} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${type === 'SUPPLIER' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}>
                            <Truck size={24} strokeWidth={type === 'SUPPLIER' ? 2.5 : 2}/>
                            <span className="text-[10px] font-black uppercase text-center leading-tight">货款<br/>(Supplier)</span>
                        </button>
                        <button onClick={() => setType('STAFF_ADVANCE')} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${type === 'STAFF_ADVANCE' ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}>
                            <UserMinus size={24} strokeWidth={type === 'STAFF_ADVANCE' ? 2.5 : 2}/>
                            <span className="text-[10px] font-black uppercase text-center leading-tight">预支<br/>(Advance)</span>
                        </button>
                        <button onClick={() => setType('GENERAL')} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${type === 'GENERAL' ? 'bg-gray-100 border-gray-600 text-gray-800 shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}>
                            <Receipt size={24} strokeWidth={type === 'GENERAL' ? 2.5 : 2}/>
                            <span className="text-[10px] font-black uppercase text-center leading-tight">杂费<br/>(Petty)</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        {type === 'SUPPLIER' && (
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 animate-in slide-in-from-top-2">
                                <label className="text-[10px] font-black text-blue-800 uppercase mb-2 block flex items-center gap-1"><Truck size={12}/> 选择供应商 (Select Supplier)</label>
                                <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full p-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-blue-400">
                                    <option value="">-- 请选择 (Select) --</option>
                                    {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                                </select>
                            </div>
                        )}

                        {type === 'STAFF_ADVANCE' && (
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 animate-in slide-in-from-top-2">
                                <label className="text-[10px] font-black text-orange-800 uppercase mb-2 block flex items-center gap-1"><User size={12}/> 选择员工 (Select Staff)</label>
                                <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full p-3 bg-white border border-orange-200 rounded-xl text-sm font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-orange-400">
                                    <option value="">-- 请选择 (Select) --</option>
                                    {employees.map(e => (<option key={e.id} value={e.id}>{e.name}</option>))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block flex items-center gap-1">
                                <FileText size={12}/> {type === 'GENERAL' ? '用途 / 购买物品 (Description)' : '单据号码 / 备注 (Bill Ref / Note)'}
                            </label>
                            <input type="text" value={billRef} onChange={e => setBillRef(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#1A1A1A] transition-all" placeholder={type === 'GENERAL' ? 'e.g. Ice / Pen / Plastic Bag' : 'Optional (e.g. Inv #123)'} />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block flex items-center gap-1"><Coins size={12}/> 支付金额 (Cash Amount)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg">RM</span>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-xl font-mono text-3xl font-black text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FFD700] border-2 border-transparent focus:bg-white transition-all" placeholder="0.00" autoFocus />
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={handleSubmit} className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-lg shadow-lg hover:bg-black mt-auto active:scale-95 transition-transform flex items-center justify-center gap-2">
                    <CheckCircle2 size={20}/> 确认支出 (Confirm Payout)
                </button>
            </div>
        </div>
    );
};

const HistoryDetailModal = ({ record, onClose, onDelete }: { record: SettlementRecord | null, onClose: () => void, onDelete: (id: string) => void }) => {
    if (!record) return null;
    const deliveryBreakdown = record.sales.deliveryBreakdown || {} as any;
    const totalDelivery = (Number(deliveryBreakdown.grab) || 0) + 
                      (Number(deliveryBreakdown.panda) || 0) + 
                      (Number(deliveryBreakdown.shopee) || 0) + 
                      (Number(deliveryBreakdown.lalamove) || 0);
    const totalDebit = (record.sales.duitnow || 0);
    const totalCard = record.sales.card || 0;
    const totalCashOut = record.expenses ? record.expenses.reduce((sum, e) => sum + (e.amount || 0), 0) : 0;
    
    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col custom-scrollbar">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-[#1A1A1A] rounded-t-[2rem]">
                    <div>
                        <h3 className="font-black text-xl text-[#FFD700]">结算单详情 (Receipt Details)</h3>
                        <p className="text-xs text-gray-400 font-mono mt-1 font-bold tracking-widest">{record.date} • {new Date(record.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 hover:text-[#FFD700] transition-colors"><X size={20}/></button>
                </div>
                
                {/* Content */}
                <div className="p-6 space-y-6 bg-[#F8F9FA] flex-grow">
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Sales (总营业额)</span>
                            <span className="text-2xl font-black font-mono text-[#1A1A1A]">RM {record.sales.total.toFixed(2)}</span>
                        </div>
                        
                        {record.sales.refundTotal && record.sales.refundTotal > 0 ? (
                            <div className="flex justify-between items-center text-xs bg-red-50 p-3 rounded-xl border border-red-100 mb-2">
                                <span className="flex items-center gap-2 text-red-600 font-bold"><RotateCcw size={14}/> Refunds (退款)</span>
                                <span className="font-mono font-bold text-red-700">- RM {record.sales.refundTotal.toFixed(2)}</span>
                            </div>
                        ) : null}

                        <div className="flex justify-between items-center text-sm p-2">
                            <span className="flex items-center gap-2 text-gray-600 font-bold"><Banknote size={16}/> Cash (现金)</span>
                            <span className="font-mono font-bold text-[#1A1A1A] text-lg">RM {record.sales.cash.toFixed(2)}</span>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">POS Payments (系统支付)</p>
                            <div className="flex justify-between text-xs text-gray-600">
                                <span className="flex items-center gap-1"><Wallet size={12}/> TNG eWallet</span>
                                <span className="font-mono font-bold text-gray-800">RM {(record.sales.tng || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600">
                                <span className="flex items-center gap-1"><CreditCard size={12}/> Debit Card</span>
                                <span className="font-mono font-bold text-gray-800">RM {totalDebit.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600">
                                <span className="flex items-center gap-1"><CreditCard size={12}/> Credit Card</span>
                                <span className="font-mono font-bold text-gray-800">RM {totalCard.toFixed(2)}</span>
                            </div>
                            {(record.sales.amex || 0) > 0 && (
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span className="flex items-center gap-1"><CreditCard size={12}/> Amex</span>
                                    <span className="font-mono font-bold text-blue-700">RM {(record.sales.amex || 0).toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* 精美的外卖数据 UI (Delivery Breakdown) */}
                        {totalDelivery > 0 && (
                            <div className="bg-white p-4 rounded-xl space-y-3 border-2 border-orange-100 shadow-[0_4px_20px_rgba(251,146,60,0.05)] relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-orange-100 to-transparent opacity-50 rounded-bl-[100px] pointer-events-none"></div>
                                <div className="flex justify-between items-center text-sm font-black text-orange-800 border-b border-orange-100 pb-2">
                                    <span className="flex items-center gap-1"><Truck size={14} className="text-orange-500"/> Delivery (外卖收入)</span>
                                    <span className="font-mono">RM {totalDelivery.toFixed(2)}</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    {deliveryBreakdown.grab > 0 && (
                                        <div className="flex flex-col gap-1">
                                            <div className="bg-white p-2.5 rounded-xl border border-green-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                                                <span className="text-[10px] font-black text-green-700 bg-green-50 px-2.5 py-1 rounded-md">Grab</span>
                                                <span className="font-mono font-bold text-green-800 text-xs">RM {deliveryBreakdown.grab.toFixed(2)}</span>
                                            </div>
                                            {(deliveryBreakdown as any).grabGross > 0 && <div className="flex justify-between px-2.5 pb-1 text-[9px] text-gray-400"><span>Gross: RM {(deliveryBreakdown as any).grabGross.toFixed(2)}</span><span className="text-red-500 font-bold">-RM {((deliveryBreakdown as any).grabGross - deliveryBreakdown.grab).toFixed(2)}</span></div>}
                                        </div>
                                    )}
                                    {deliveryBreakdown.panda > 0 && (
                                        <div className="flex flex-col gap-1">
                                            <div className="bg-white p-2.5 rounded-xl border border-pink-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                                                <span className="text-[10px] font-black text-pink-700 bg-pink-50 px-2.5 py-1 rounded-md">Panda</span>
                                                <span className="font-mono font-bold text-pink-800 text-xs">RM {deliveryBreakdown.panda.toFixed(2)}</span>
                                            </div>
                                            {(deliveryBreakdown as any).pandaGross > 0 && <div className="flex justify-between px-2.5 pb-1 text-[9px] text-gray-400"><span>Gross: RM {(deliveryBreakdown as any).pandaGross.toFixed(2)}</span><span className="text-red-500 font-bold">-RM {((deliveryBreakdown as any).pandaGross - deliveryBreakdown.panda).toFixed(2)}</span></div>}
                                        </div>
                                    )}
                                    {deliveryBreakdown.shopee > 0 && (
                                        <div className="flex flex-col gap-1">
                                            <div className="bg-white p-2.5 rounded-xl border border-orange-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                                                <span className="text-[10px] font-black text-orange-700 bg-orange-50 px-2.5 py-1 rounded-md">Shopee</span>
                                                <span className="font-mono font-bold text-orange-800 text-xs">RM {deliveryBreakdown.shopee.toFixed(2)}</span>
                                            </div>
                                            {(deliveryBreakdown as any).shopeeGross > 0 && <div className="flex justify-between px-2.5 pb-1 text-[9px] text-gray-400"><span>Gross: RM {(deliveryBreakdown as any).shopeeGross.toFixed(2)}</span><span className="text-red-500 font-bold">-RM {((deliveryBreakdown as any).shopeeGross - deliveryBreakdown.shopee).toFixed(2)}</span></div>}
                                        </div>
                                    )}
                                    {deliveryBreakdown.lalamove > 0 && (
                                        <div className="bg-white p-2.5 rounded-xl border border-blue-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                                            <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">Lala</span>
                                            <span className="font-mono font-bold text-blue-800 text-xs">RM {deliveryBreakdown.lalamove.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {record.expenses && record.expenses.length > 0 && (
                        <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm">
                            <h4 className="text-xs font-black text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2"><MinusCircle size={14}/> 现金支出 (Cash Payouts)</h4>
                            <div className="space-y-2">
                                {record.expenses.map((exp, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs border-b border-red-100 pb-2 last:border-0 pt-1">
                                        <span className="font-bold text-red-800">{exp.company} <span className="text-[9px] font-normal text-red-500 bg-red-100 px-1 py-0.5 rounded ml-1">({exp.category})</span></span>
                                        <span className="font-mono font-bold text-red-700">- RM {exp.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                                <div className="pt-2 flex justify-between items-center font-black text-sm text-red-900 border-t border-red-200 mt-2">
                                    <span>Total Payout</span>
                                    <span>- RM {totalCashOut.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-[#1A1A1A] p-5 rounded-2xl shadow-lg text-white">
                        <h4 className="text-xs font-black text-[#FFD700] uppercase tracking-widest mb-4 flex items-center gap-2"><Calculator size={14}/> 现金对账 (Reconciliation)</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-white/60">Opening Float</span><span className="font-mono text-[#FFD700]">RM {record.openingCash.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-white/60">Cash Sales</span><span className="font-mono text-green-400">+ RM {record.sales.cash.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-white/60">Cash Payouts</span><span className="font-mono text-red-400">- RM {totalCashOut.toFixed(2)}</span></div>
                            <div className="h-px bg-white/20 my-2"></div>
                            <div className="flex justify-between text-base font-bold"><span className="text-white">Actual Closing</span><span className="font-mono">RM {record.closingCash.toFixed(2)}</span></div>
                            <div className="flex justify-between text-base font-bold"><span className="text-white">Variance</span><span className={`font-mono px-2 py-0.5 rounded ${record.variance >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{record.variance > 0 ? '+' : ''}{record.variance.toFixed(2)}</span></div>
                        </div>
                        {record.varianceReason && (
                            <div className="mt-4 p-3 bg-white/10 rounded-xl text-xs text-white/80 italic border border-white/10">
                                <span className="font-bold not-italic text-[#FFD700] mr-2">Note:</span>"{record.varianceReason}"
                            </div>
                        )}
                    </div>
                    
                    <button onClick={() => onDelete(record.id)} className="w-full py-4 bg-white border-2 border-red-100 text-red-600 rounded-2xl font-black text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2 shadow-sm">
                        <Trash2 size={18}/> 删除此结算记录 (Delete Record)
                    </button>
                </div>
            </div>
        </div>
    );
};

export const SettlementModule: React.FC<SettlementModuleProps> = ({ storeConfig, onClose, isStandalone = true }) => {
    const [activeTab, setActiveTab] = useState<'SHIFT' | 'HISTORY'>('SHIFT');
    const [isShiftOpen, setIsShiftOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Shift Data
    const [openingCounts, setOpeningCounts] = useState<Record<number, number>>({ 100:0, 50:0, 20:0, 10:0, 5:0, 1:0 });
    const [openingCoins, setOpeningCoins] = useState<number>(0);
    const [businessDate, setBusinessDate] = useState<string>(getBusinessDateStr(storeConfig.businessDayCutoff || 4));
    
    const [salesData, setSalesData] = useState({
        storeHubTotal: 0, refundTotal: 0, cash: 0, tng: 0, duitnow: 0, card: 0, amex: 0, grab: 0, panda: 0, shopee: 0, lalamove: 0, grabGross: 0, pandaGross: 0, shopeeGross: 0
    });
    
    const [shiftExpenses, setShiftExpenses] = useState<ExpenseItem[]>([]);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [staffList, setStaffList] = useState<Employee[]>([]);
    const [supplierList, setSupplierList] = useState<Supplier[]>([]); 
    
    const [closingCashInput, setClosingCashInput] = useState<number>(0);
    const [varianceReason, setVarianceReason] = useState<string>('');
    
    // History Data & Filters
    const [historyRecords, setHistoryRecords] = useState<SettlementRecord[]>([]);
    const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // ✅ 这里是重点！防错变量
    const [selectedRecord, setSelectedRecord] = useState<SettlementRecord | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => { loadData(); }, []);
    useEffect(() => { if (activeTab === 'HISTORY') loadHistory(); }, [activeTab, filterMonth]);
    
    const loadData = async () => {
        setIsLoading(true);
        try {
            const shift = await DataManager.getActiveShift();
            const emps = await DataManager.getEmployees();
            const sups = await DataManager.getSuppliers(); 
            
            setStaffList(emps.filter(e => !e.isArchived));
            setSupplierList(sups.filter(s => s.status === 'ACTIVE')); 

            if (shift) {
                setBusinessDate(shift.businessDate || getBusinessDateStr(storeConfig.businessDayCutoff || 4));
                setOpeningCounts(shift.openingCounts || { 100:0, 50:0, 20:0, 10:0, 5:0, 1:0 });
                setOpeningCoins(shift.openingCoins || 0);
                
                const savedSales = shift.salesData || {};
                setSalesData({
                    storeHubTotal: savedSales.storeHubTotal || 0, refundTotal: savedSales.refundTotal || 0, 
                    cash: savedSales.cash || 0, tng: savedSales.tng || 0, duitnow: savedSales.duitnow || 0, 
                    card: savedSales.card || 0, amex: savedSales.amex || 0, grab: savedSales.grab || 0, panda: savedSales.panda || 0,
                    shopee: savedSales.shopee || 0, lalamove: savedSales.lalamove || 0,
                    grabGross: savedSales.grabGross || 0, pandaGross: savedSales.pandaGross || 0, shopeeGross: savedSales.shopeeGross || 0
                });
                
                setShiftExpenses(shift.expenseList || []);
                setClosingCashInput(shift.closingCashInput || 0);
                setVarianceReason(shift.varianceReason || '');
                setIsShiftOpen(true);
            } else {
                setBusinessDate(getBusinessDateStr(storeConfig.businessDayCutoff || 4));
            }
        } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };

    const loadHistory = async () => {
        setIsLoading(true);
        const records = await DataManager.getSettlements(filterMonth);
        setHistoryRecords(records);
        setIsLoading(false);
    };

    useEffect(() => {
        if (isShiftOpen && !isLoading && !isSubmitting && activeTab === 'SHIFT') {
            const shiftData = {
                businessDate: businessDate || getBusinessDateStr(4),
                openingCounts, openingCoins, salesData, expenseList: shiftExpenses,
                closingCashInput, varianceReason: varianceReason || '', updatedAt: new Date().toISOString()
            };
            DataManager.saveActiveShift(shiftData);
        }
    }, [isShiftOpen, businessDate, openingCounts, openingCoins, salesData, closingCashInput, varianceReason, isLoading, activeTab, isSubmitting, shiftExpenses]);

    const openingTotal = useMemo(() => {
        const notesTotal = Object.entries(openingCounts).reduce((acc, [val, count]) => acc + (parseInt(val) * (Number(count) || 0)), 0);
        return Number(notesTotal) + Number(openingCoins);
    }, [openingCounts, openingCoins]);

    const totals = useMemo(() => {
        const s = salesData;
        const posSales = (Number(s.cash)||0) + (Number(s.tng)||0) + (Number(s.duitnow)||0) + (Number(s.card)||0) + (Number(s.amex)||0);
        const deliverySales = (Number(s.grab)||0) + (Number(s.panda)||0) + (Number(s.shopee)||0) + (Number(s.lalamove)||0);
        const totalRevenue = posSales + deliverySales;
        const totalCashOut = shiftExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const expectedCash = (Number(openingTotal) + Number(s.cash||0)) - totalCashOut;
        const variance = Number(closingCashInput) - expectedCash;
        const storeHubTotal = Number(s.storeHubTotal) || 0;
        const salesVariance = posSales - storeHubTotal;
        return { posSales, deliverySales, totalRevenue, totalCashOut, expectedCash, variance, storeHubTotal, salesVariance };
    }, [openingTotal, salesData, closingCashInput, shiftExpenses]);

    const handleStartShift = () => {
        if (openingTotal <= 0 && !confirm("点算总额为 RM 0，确定开班吗？")) return;
        setIsShiftOpen(true);
    };

    const handleDenomChange = (denom: number, count: string) => {
        const c = parseInt(count) || 0;
        setOpeningCounts(prev => ({ ...prev, [denom]: c }));
    };

    const handleAddExpense = (newExp: ExpenseItem) => {
        setShiftExpenses([...shiftExpenses, newExp]);
    };

    const handleRemoveExpense = (id: string) => {
        setShiftExpenses(shiftExpenses.filter(e => e.id !== id));
    };

    const handleDeleteClick = (id: string) => setShowDeleteConfirm(true);

    const executeDeleteRecord = async () => {
        if (!selectedRecord) return;
        setIsLoading(true);
        try {
            await DataManager.deleteSettlement(selectedRecord.id);
            const records = await DataManager.getSettlements(filterMonth);
            setHistoryRecords(records);
            setShowDeleteConfirm(false);
            setSelectedRecord(null); 
            alert("✅ 记录已删除");
        } catch(e) { console.error(e); alert("Delete Failed"); } finally { setIsLoading(false); }
    };

    const handleSubmitSettlement = async () => {
        setIsSubmitting(true);
        
        // 1. O(1) 极简查重，省钱又快
        const isDuplicate = await DataManager.checkSettlementExists(businessDate);
        if (isDuplicate) {
             alert(`📅 日期 ${businessDate} 已经结算过了！\n\n系统检测到重复记录。若需重新提交，请先在“历史”页面删除该日期的旧记录。`);
             setIsSubmitting(false);
             return;
        }
        
        if (!confirm(`⚠️ 确认提交结算？\n日期: ${businessDate}\n现金差异: RM ${totals.variance.toFixed(2)}`)) {
            setIsSubmitting(false);
            return;
        }
        
        const record: SettlementRecord = {
            id: `settle_${businessDate}_${Date.now()}`,
            date: businessDate,
            timestamp: new Date().toISOString(),
            openingCash: openingTotal,
            closingCash: closingCashInput,
            sales: {
                total: totals.totalRevenue,
                storeHubTotal: totals.storeHubTotal,
                refundTotal: salesData.refundTotal || 0,
                cash: salesData.cash || 0,
                tng: salesData.tng || 0,
                duitnow: salesData.duitnow || 0, 
                card: salesData.card || 0,
                amex: salesData.amex || 0,
                deliveryBreakdown: {
                    grab: salesData.grab || 0, panda: salesData.panda || 0, 
                    shopee: salesData.shopee || 0, lalamove: salesData.lalamove || 0,
                    grabGross: salesData.grabGross || 0, pandaGross: salesData.pandaGross || 0, shopeeGross: salesData.shopeeGross || 0
                }
            },
            expenses: shiftExpenses,
            variance: totals.variance,
            varianceReason: varianceReason,
            submittedBy: 'Manager',
            isClosed: true
        };
        
        try {
            // 2. 🟢 核心修复：调用你刚写的无敌事务方法，一键完成所有操作
            await DataManager.executeSettlementTransaction(record);

            // 3. 清理前端状态
            const nextDateStr = getBusinessDateStr(storeConfig.businessDayCutoff || 4);
            setBusinessDate(nextDateStr);
            setOpeningCounts({ 100:0, 50:0, 20:0, 10:0, 5:0, 1:0 });
            setOpeningCoins(0);
            setSalesData({ storeHubTotal: 0, refundTotal: 0, cash: 0, tng: 0, duitnow: 0, card: 0, amex: 0, grab: 0, panda: 0, shopee: 0, lalamove: 0, grabGross: 0, pandaGross: 0, shopeeGross: 0 });
            setClosingCashInput(0);
            setShiftExpenses([]);
            setVarianceReason('');
            setIsShiftOpen(false);
            
            alert("✅ 结算成功！数据已转入历史记录。");
            
            // 4. 刷新历史记录
            setActiveTab('HISTORY');
            const updatedHistory = await DataManager.getSettlements();
            setHistoryRecords(updatedHistory);
            
        } catch (error: any) { 
            console.error("Settlement Error", error); 
            // 拦截后端事务抛出的重复结算错误
            if (error.message.includes('DATE_ALREADY_SETTLED')) {
                alert("❌ 提交被拦截：该日期刚刚已被其他设备结算！");
            } else {
                alert("❌ 提交失败，请检查网络后重试"); 
            }
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const handleForceToday = () => {
        const todayStr = getCalendarTodayStr();
        if(businessDate !== todayStr && confirm(`确定将日期修改为今天 (${todayStr}) 吗？`)) setBusinessDate(todayStr);
    };

    const renderSummarySection = () => (
        <div className="bg-[#1A1A1A] p-6 text-white shadow-2xl flex flex-col justify-between shrink-0 rounded-[2rem] md:rounded-none md:rounded-l-[2rem] h-full">
            <div className="space-y-6">
                <h3 className="text-sm font-black text-[#FFD700] uppercase tracking-widest flex items-center gap-2"><Calculator size={18}/> 现金对账 (Reconciliation)</h3>
                <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Opening Float</span><span className="font-mono text-[#FFD700]">RM {openingTotal.toFixed(2)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Cash Sales</span><span className="font-mono text-green-400">+ RM {(salesData?.cash || 0).toFixed(2)}</span></div>
                    {totals.totalCashOut > 0 && (
                        <div className="pt-2 mt-2 border-t border-white/10 animate-in fade-in">
                            <div className="flex justify-between text-sm mb-1"><span className="text-red-400 font-bold">Cash Payouts (支出)</span><span className="font-mono text-red-400">- RM {totals.totalCashOut.toFixed(2)}</span></div>
                            <div className="pl-2 space-y-1">
                                {shiftExpenses.map((exp, i) => (
                                    <div key={i} className="flex justify-between text-[10px] text-gray-500">
                                        <span className="truncate max-w-[150px]">{exp.company}</span>
                                        <span>{exp.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="h-px bg-white/10 my-2"></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-black text-[#FFD700] uppercase">Expected Cash</span><span className="text-xl font-mono font-black text-white">RM {totals.expectedCash.toFixed(2)}</span></div>
                </div>
                <div className="bg-white/10 p-6 rounded-[2rem] border border-white/10 relative">
                    <label className="text-[10px] font-black text-[#FFD700] uppercase block mb-3 text-center tracking-widest">钱箱实际结余 (Actual Closing Cash)</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-black text-2xl">RM</span>
                        <input type="number" value={closingCashInput || ''} onChange={e => setClosingCashInput(parseFloat(e.target.value) || 0)} className="w-full p-4 pl-14 bg-black/40 border-2 border-[#FFD700]/30 rounded-2xl text-center font-black text-4xl text-white outline-none focus:border-[#FFD700] transition-all shadow-inner" placeholder="0.00" />
                    </div>
                    <div className={`mt-4 p-3 rounded-xl text-center border transition-all ${totals.variance >= 0 ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-red-500/20 border-red-500/30 text-red-400'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1">现金差异 (Variance)</p>
                        <p className="text-xl font-black font-mono">RM {totals.variance.toFixed(2)}</p>
                    </div>
                </div>
                {Math.abs(totals.variance) > 0.5 && (
                    <div className="animate-in slide-in-from-bottom-2">
                        <label className="text-[10px] font-black text-red-400 uppercase block mb-2 flex items-center gap-2"><AlertCircle size={12}/> 差异说明 (Reason)</label>
                        <textarea value={varianceReason} onChange={e => setVarianceReason(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/30 focus:border-red-400 outline-none h-20 resize-none" placeholder="请输入原因 (e.g. 找赎错误)..."/>
                    </div>
                )}
            </div>
            <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                <div className="flex justify-between items-end">
                    <div><p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Total Sales</p><p className="text-2xl font-black font-mono text-[#FFD700]">RM {totals.totalRevenue.toFixed(2)}</p></div>
                    <div><p className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-right">POS Sales Only</p><p className="text-lg font-black font-mono text-white text-right">RM {totals.posSales.toFixed(2)}</p></div>
                </div>
                <button onClick={handleSubmitSettlement} disabled={isSubmitting} className="w-full py-4 bg-[#FFD700] text-black rounded-2xl font-black text-lg shadow-[0_10px_30px_rgba(255,215,0,0.3)] hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    {isSubmitting ? <Loader2 size={24} className="animate-spin"/> : <Check size={24} strokeWidth={4}/>}
                    {isSubmitting ? '提交中...' : '完成结算 (Submit)'}
                </button>
            </div>
        </div>
    );

    return (
        <div className={isStandalone ? "fixed inset-0 bg-black/90 z-[90] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200" : "w-full h-full flex flex-col relative animate-in fade-in"}>
            <div className={isStandalone ? "bg-[#F5F7FA] w-full h-[100dvh] md:max-w-7xl md:h-[95vh] md:rounded-[2rem] flex flex-col overflow-hidden shadow-2xl font-sans relative" : "flex-grow flex flex-col overflow-hidden font-sans relative"}>
                {/* Header */}
                <div className="bg-[#1A1A1A] p-4 flex flex-col md:flex-row justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700] gap-4 md:gap-0">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="bg-[#FFD700] text-black p-2 md:p-2.5 rounded-xl shadow-lg shrink-0"><Calculator size={24}/></div>
                        <div><h3 className="font-serif font-black text-lg md:text-xl tracking-wide">每日结算中心</h3><p className="text-[9px] md:text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">SETTLEMENT & CASH CONTROL</p></div>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-auto gap-3">
                        <div className="flex bg-white/10 p-1 rounded-xl flex-1 md:flex-none justify-center">
                            <button onClick={() => setActiveTab('SHIFT')} className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap ${activeTab === 'SHIFT' ? 'bg-[#FFD700] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}>当班 (Shift)</button>
                            <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap ${activeTab === 'HISTORY' ? 'bg-[#FFD700] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}>历史 (History)</button>
                        </div>
                        <div className="flex gap-2"><ModuleGuideButton module="SETTLEMENT" />{onClose && (<button onClick={onClose} className="p-2 md:p-3 bg-white/10 hover:bg-red-600 rounded-xl transition-colors text-white" title="关闭/退出 (Exit)"><X size={20}/></button>)}</div>
                    </div>
                </div>

                <div className="flex-grow overflow-hidden bg-[#F5F7FA]">
                    {activeTab === 'SHIFT' ? (
                        !isShiftOpen ? (
                            <div className="h-full overflow-y-auto bg-[#F5F7FA]">
                                <div className="min-h-full p-6 flex flex-col items-center justify-center">
                                    <div className="max-w-md w-full bg-white p-6 md:p-8 rounded-3xl shadow-lg text-center border-t-8 border-[#FFD700]">
                                        <Power size={64} className="mx-auto text-gray-200 mb-6"/>
                                        <h2 className="text-2xl font-black text-[#1A1A1A] mb-2">准备开班?</h2>
                                        <div className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest flex items-center gap-2 justify-center"><Calendar size={14}/> 营业日期 (Business Date)</label>
                                            <div className="flex items-center gap-2">
                                                <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} className="w-full p-3 bg-white border-2 border-gray-200 rounded-xl font-black text-[#1A1A1A] outline-none focus:border-[#FFD700] text-center text-lg shadow-sm"/>
                                                <button onClick={handleForceToday} className="p-3 bg-white border-2 border-gray-200 rounded-xl hover:border-[#FFD700] hover:text-[#FFD700] transition-colors"><RotateCcw size={20}/></button>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 p-6 rounded-2xl mb-8 border border-gray-100 text-left">
                                            <label className="text-[10px] font-black text-gray-400 uppercase mb-4 block tracking-widest">开班现金点算 (Opening Float)</label>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                                                {DENOMINATIONS.map(denom => (<div key={denom.value} className={`flex items-center gap-2 p-2 rounded-xl border ${denom.color}`}><span className="text-[10px] font-black w-10 shrink-0">{denom.label}</span><input type="number" className="w-full bg-white/50 p-1 rounded text-center text-sm font-bold outline-none" placeholder="0" value={openingCounts[denom.value] || ''} onChange={e => handleDenomChange(denom.value, e.target.value)} /></div>))}
                                            </div>
                                            <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200"><Coins size={18} className="text-gray-400"/><input type="number" className="flex-grow outline-none text-sm font-bold" placeholder="硬币总额 (Coins)" value={openingCoins || ''} onChange={e => setOpeningCoins(parseFloat(e.target.value) || 0)} /></div>
                                        </div>
                                        <div className="flex justify-between items-center bg-[#1A1A1A] text-white p-4 rounded-xl mb-6"><span className="text-xs font-bold uppercase text-gray-400">Total Opening</span><span className="text-xl font-mono font-black text-[#FFD700]">RM {openingTotal.toFixed(2)}</span></div>
                                        <button onClick={handleStartShift} className="w-full bg-[#FFD700] text-black py-4 rounded-xl font-black text-lg shadow-lg hover:bg-yellow-400 active:scale-95 transition-all flex items-center justify-center gap-2"><Play size={20} fill="currentColor"/> 确认开班 (Start)</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col md:flex-row overflow-hidden animate-in fade-in">
                                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                                    <div className="flex justify-between items-end border-b pb-4 border-gray-200">
                                        <div><h2 className="text-2xl font-black text-[#1A1A1A]">{new Date(businessDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</h2><p className="text-xs font-bold text-gray-400">Business Date (Settlement Date)</p></div>
                                        <div className="text-right"><p className="text-[10px] font-bold text-gray-400 uppercase">Opening Float</p><p className="text-lg font-mono font-black text-blue-600">RM {openingTotal.toFixed(2)}</p></div>
                                    </div>
                                    
                                    <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 space-y-4">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div><label className="text-xs font-black text-blue-800 uppercase block">StoreHub Report Total</label><p className="text-[10px] text-blue-400 font-bold mt-1">请输入 POS 系统显示的今日总额 (POS Only)</p></div>
                                            <div className="relative w-full md:w-auto"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300 font-black text-lg">RM</span><input type="number" value={salesData.storeHubTotal || ''} onChange={e => setSalesData({...salesData, storeHubTotal: parseFloat(e.target.value)})} className="pl-12 pr-4 py-3 bg-white rounded-xl font-mono text-2xl font-black w-full md:w-48 text-right outline-none text-blue-900 shadow-sm focus:ring-2 focus:ring-blue-300 transition-all tabular-nums" placeholder="0.00"/></div>
                                        </div>
                                        <div className="pt-3 border-t border-blue-200/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                             <div><label className="text-xs font-black text-red-500 uppercase flex items-center gap-2"><RotateCcw size={14}/> Refunds (退款记录)</label><p className="text-[10px] text-red-400 font-bold mt-0.5">Record total refunds for today</p></div>
                                             <div className="relative w-full md:w-auto"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-300 font-black text-lg">- RM</span><input type="number" value={salesData.refundTotal || ''} onChange={e => setSalesData({...salesData, refundTotal: parseFloat(e.target.value)})} className="pl-14 pr-4 py-2 bg-red-50 border border-red-100 rounded-xl font-mono text-lg font-black w-full md:w-48 text-right outline-none text-red-600 focus:ring-2 focus:ring-red-200 transition-all tabular-nums" placeholder="0.00"/></div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                            <h4 className="text-xs font-bold text-[#1A1A1A] uppercase border-b pb-2 mb-2">POS Payment Methods (In-Store)</h4>
                                            
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><Banknote size={16}/></div>
                                                <span className="text-xs font-bold text-gray-600 w-32 shrink-0 whitespace-nowrap">Cash (现金)</span>
                                                <div className="relative flex-grow"><input type="number" className="w-full p-3 bg-gray-50 rounded-lg text-right font-mono font-bold text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#FFD700]" value={salesData.cash || ''} onChange={e => setSalesData({...salesData, cash: parseFloat(e.target.value)})} /></div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><Wallet size={16}/></div>
                                                <span className="text-xs font-bold text-gray-600 w-32 shrink-0 whitespace-nowrap">TNG eWallet</span>
                                                <div className="relative flex-grow"><input type="number" className="w-full p-3 bg-gray-50 rounded-lg text-right font-mono font-bold text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#FFD700]" value={salesData.tng || ''} onChange={e => setSalesData({...salesData, tng: parseFloat(e.target.value)})} /></div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><CreditCard size={16}/></div>
                                                <div className="w-32 shrink-0 flex flex-col justify-center"><span className="text-xs font-bold text-gray-600 whitespace-nowrap">Debit Card</span></div>
                                                <div className="relative flex-grow"><input type="number" className="w-full p-3 bg-gray-50 rounded-lg text-right font-mono font-bold text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#FFD700]" value={salesData.duitnow || ''} onChange={e => setSalesData({...salesData, duitnow: parseFloat(e.target.value)})} /></div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"><CreditCard size={16}/></div>
                                                <div className="w-32 shrink-0 flex flex-col justify-center"><span className="text-xs font-bold text-gray-600 whitespace-nowrap">Credit Card</span></div>
                                                <div className="relative flex-grow"><input type="number" className="w-full p-3 bg-gray-50 rounded-lg text-right font-mono font-bold text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#FFD700]" value={salesData.card || ''} onChange={e => setSalesData({...salesData, card: parseFloat(e.target.value)})} /></div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0"><CreditCard size={16}/></div>
                                                <div className="w-32 shrink-0 flex flex-col justify-center"><span className="text-xs font-bold text-blue-600 whitespace-nowrap">Amex</span></div>
                                                <div className="relative flex-grow"><input type="number" className="w-full p-3 bg-gray-50 rounded-lg text-right font-mono font-bold text-base outline-none focus:bg-white focus:ring-2 focus:ring-blue-300" value={salesData.amex || ''} onChange={e => setSalesData({...salesData, amex: parseFloat(e.target.value)})} /></div>
                                            </div>
                                            <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between items-center text-xs font-bold"><span>POS Total</span><span className="font-mono text-blue-600">RM {totals.posSales.toFixed(2)}</span></div>
                                        </div>
                                        
                                        <div className="space-y-3 bg-orange-50/50 p-4 rounded-2xl border border-orange-100 shadow-sm">
                                            <h4 className="text-xs font-bold text-orange-800 uppercase border-b border-orange-200 pb-2 mb-2">Delivery Platforms (Extra Income)</h4>
                                            <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400 uppercase mb-1 px-1">
                                                <span className="w-20 shrink-0"></span>
                                                <span className="flex-1 text-center">原价 (Gross)</span>
                                                <span className="flex-1 text-center">到手 (Net)</span>
                                                <span className="w-16 text-center shrink-0">佣金</span>
                                            </div>
                                            {[
                                                { key: 'grab', grossKey: 'grabGross', label: 'GrabFood', color: 'text-green-600', ring: 'focus:ring-green-300' },
                                                { key: 'panda', grossKey: 'pandaGross', label: 'FoodPanda', color: 'text-pink-600', ring: 'focus:ring-pink-300' },
                                                { key: 'shopee', grossKey: 'shopeeGross', label: 'ShopeeFood', color: 'text-orange-600', ring: 'focus:ring-orange-300' },
                                            ].map(item => {
                                                const gross = (salesData as any)[item.grossKey] || 0;
                                                const net = (salesData as any)[item.key] || 0;
                                                const commission = gross > 0 ? gross - net : 0;
                                                return (
                                                    <div key={item.key} className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-black w-20 shrink-0 whitespace-nowrap ${item.color}`}>{item.label}</span>
                                                        <input type="number" placeholder="原价" className={`flex-1 p-2.5 bg-white rounded-lg text-right font-mono font-bold text-sm outline-none focus:ring-2 ${item.ring} border border-orange-100 min-w-0`} value={(salesData as any)[item.grossKey] || ''} onChange={e => setSalesData({...salesData, [item.grossKey]: parseFloat(e.target.value) || 0})} />
                                                        <input type="number" placeholder="到手" className={`flex-1 p-2.5 bg-white rounded-lg text-right font-mono font-bold text-sm outline-none focus:ring-2 ${item.ring} border border-orange-100 min-w-0`} value={(salesData as any)[item.key] || ''} onChange={e => setSalesData({...salesData, [item.key]: parseFloat(e.target.value) || 0})} />
                                                        <span className={`w-16 text-right text-[10px] font-mono font-bold shrink-0 ${commission > 0 ? 'text-red-500' : 'text-gray-300'}`}>{commission > 0 ? `-${commission.toFixed(0)}` : '-'}</span>
                                                    </div>
                                                );
                                            })}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black w-20 shrink-0 whitespace-nowrap text-orange-500">Lalamove</span>
                                                <div className="flex-1"></div>
                                                <input type="number" placeholder="净额" className="flex-1 p-2.5 bg-white rounded-lg text-right font-mono font-bold text-sm outline-none focus:ring-2 focus:ring-orange-300 border border-orange-100 min-w-0" value={salesData.lalamove || ''} onChange={e => setSalesData({...salesData, lalamove: parseFloat(e.target.value) || 0})} />
                                                <span className="w-16 shrink-0"></span>
                                            </div>
                                            <div className="pt-2 mt-2 border-t border-orange-200 space-y-1">
                                                <div className="flex justify-between items-center text-xs font-bold"><span>Delivery Net</span><span className="font-mono text-orange-600">RM {totals.deliverySales.toFixed(2)}</span></div>
                                                {(() => { const tGross = (Number(salesData.grabGross)||0)+(Number(salesData.pandaGross)||0)+(Number(salesData.shopeeGross)||0); const tNet = (Number(salesData.grab)||0)+(Number(salesData.panda)||0)+(Number(salesData.shopee)||0); const tComm = tGross - tNet; return tGross > 0 ? (<div className="flex justify-between items-center text-[10px]"><span className="text-gray-400">Total Commission</span><span className="font-mono font-bold text-red-500">- RM {tComm.toFixed(2)} ({tGross > 0 ? ((tComm/tGross)*100).toFixed(1) : '0'}%)</span></div>) : null; })()}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-red-50 p-5 rounded-3xl border border-red-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-black text-red-700 uppercase flex items-center gap-2"><MinusCircle size={16}/> 现金支出 (Cash Payouts)</h4>
                                            <button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-red-700 shadow-md transition-all active:scale-95"><Plus size={14}/> 记一笔支出</button>
                                        </div>
                                        
                                        {shiftExpenses.length === 0 ? (
                                            <div className="text-center py-6 border-2 border-dashed border-red-200 rounded-2xl text-xs text-red-300 font-bold">暂无现金支出 (No Cash Out)</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {shiftExpenses.map(exp => (
                                                    <div key={exp.id} className="bg-white p-3 rounded-xl border border-red-100 flex justify-between items-center shadow-sm">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${exp.category === 'SUPPLIER' ? 'bg-blue-50 text-blue-700' : exp.category === 'STAFF_ADVANCE' ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                                                                    {exp.category === 'SUPPLIER' ? '货款' : exp.category === 'STAFF_ADVANCE' ? '预支' : '杂费'}
                                                                </span>
                                                                <span className="font-bold text-sm text-[#1A1A1A]">{exp.company}</span>
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 ml-1">{exp.note}</div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono font-black text-red-600">- RM {exp.amount.toFixed(2)}</span>
                                                            <button onClick={() => handleRemoveExpense(exp.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="pt-2 mt-2 border-t border-red-200 flex justify-end text-xs font-black text-red-800">Total Out: RM {totals.totalCashOut.toFixed(2)}</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`p-4 rounded-xl border flex justify-between items-center ${Math.abs(totals.salesVariance) < 1 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <div>
                                            <p className={`text-xs font-black uppercase ${Math.abs(totals.salesVariance) < 1 ? 'text-green-700' : 'text-red-700'}`}>{Math.abs(totals.salesVariance) < 1 ? 'POS Match (Perfect)' : 'POS Variance Detected'}</p>
                                            <p className="text-[10px] text-gray-500 font-bold mt-0.5">Calc POS: RM {totals.posSales.toFixed(2)} vs Report: RM {totals.storeHubTotal.toFixed(2)}</p>
                                        </div>
                                        <div className={`text-xl font-black font-mono ${Math.abs(totals.salesVariance) < 1 ? 'text-green-700' : 'text-red-700'}`}>{totals.salesVariance > 0 ? '+' : ''}{totals.salesVariance.toFixed(2)}</div>
                                    </div>
                                    
                                    <div className="md:hidden pb-10">{renderSummarySection()}</div>
                                </div>
                                
                                <div className="hidden md:block md:w-[350px] lg:w-[400px] h-full overflow-hidden">{renderSummarySection()}</div>
                            </div>
                        )
                    ) : (
                        <div className="h-full flex flex-col bg-[#F5F7FA]">
                            <div className="p-4 md:p-6 bg-white border-b border-gray-200 shadow-sm shrink-0">
                                <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-[#1A1A1A] p-2 rounded-xl text-[#FFD700] shadow-md"><Calendar size={20}/></div>
                                        <div><h4 className="font-black text-[#1A1A1A]">历史结算查询</h4><p className="text-[10px] text-gray-400 font-bold uppercase">Archive & Reconciliation History</p></div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-200 w-full md:w-auto">
                                        <span className="text-xs font-black text-gray-400 px-2">月份 (Month):</span>
                                        <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-white border-2 border-gray-100 focus:border-[#FFD700] rounded-xl px-4 py-2 font-black text-[#1A1A1A] outline-none transition-all flex-grow md:flex-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex-grow overflow-y-auto p-4 md:p-6 pb-32">
                                <div className="max-w-4xl mx-auto space-y-4">
                                    {isLoading ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                            <Loader2 size={48} className="animate-spin mb-4 text-[#FFD700]"/>
                                            <p className="font-bold">正在拉取 {filterMonth} 的账单...</p>
                                        </div>
                                    ) : historyRecords.length === 0 ? (
                                        <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
                                            <History size={64} className="mx-auto mb-4 opacity-10 text-[#1A1A1A]"/>
                                            <p className="font-black text-[#1A1A1A]">{filterMonth} 暂无历史数据</p>
                                        </div>
                                    ) : (
                                        historyRecords.map(record => {
    const debit = record.sales.duitnow || 0;
    const credit = record.sales.card || 0;
    const tng = record.sales.tng || 0;
    const cash = record.sales.cash || 0; // 提取 Cash
    // 计算外卖总额
    const deliveryBreakdown = record.sales.deliveryBreakdown || {};
    const totalDelivery = (deliveryBreakdown.grab || 0) + (deliveryBreakdown.panda || 0) + (deliveryBreakdown.shopee || 0) + (deliveryBreakdown.lalamove || 0);

    return (
        <div key={record.id} onClick={() => setSelectedRecord(record)} className="bg-white p-5 rounded-[2rem] border border-gray-100 hover:border-[#FFD700] hover:shadow-xl transition-all cursor-pointer group flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* 左侧：日期与总额 */}
            <div className="flex items-center justify-between md:justify-start gap-4 w-full md:w-48 shrink-0">
                <div className="w-14 h-14 bg-[#1A1A1A] rounded-2xl flex flex-col items-center justify-center text-[#FFD700] group-hover:scale-110 transition-transform shadow-lg shrink-0">
                    <span className="text-[10px] font-black leading-none opacity-60 uppercase">{new Date(record.date).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-xl font-black leading-none mt-1">{record.date.split('-')[2]}</span>
                </div>
                <div className="text-right md:text-left">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Sales</div>
                    <div className="text-xl font-black text-[#1A1A1A] whitespace-nowrap">RM {record.sales.total.toFixed(2)}</div>
                </div>
            </div>

            {/* 中间：5个支付渠道明细 (手机端网格，PC端一排) */}
            <div className="grid grid-cols-3 gap-y-3 gap-x-2 md:flex md:flex-1 md:items-center md:justify-center md:gap-4 w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase">Cash</span>
                    <span className="font-mono text-xs font-bold text-green-700">RM {cash.toFixed(2)}</span>
                </div>
                <div className="hidden md:block w-px h-6 bg-gray-200"></div>
                
                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase">Debit</span>
                    <span className="font-mono text-xs font-bold text-blue-600">RM {debit.toFixed(2)}</span>
                </div>
                <div className="hidden md:block w-px h-6 bg-gray-200"></div>
                
                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase">Credit</span>
                    <span className="font-mono text-xs font-bold text-purple-600">RM {credit.toFixed(2)}</span>
                </div>
                
                {/* 手机端换行时的分隔线隐藏 */}
                <div className="hidden md:block w-px h-6 bg-gray-200"></div>
                
                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase">TNG</span>
                    <span className="font-mono text-xs font-bold text-cyan-600">RM {tng.toFixed(2)}</span>
                </div>
                <div className="hidden md:block w-px h-6 bg-gray-200"></div>
                
                {/* Delivery 占满手机端网格剩下的位置 */}
                <div className="flex flex-col items-center col-span-2 md:col-span-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1">Delivery</span>
                    <span className="font-mono text-xs font-bold text-orange-600">RM {totalDelivery.toFixed(2)}</span>
                </div>
            </div>

            {/* 右侧：Variance 与箭头 */}
            <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-32 shrink-0 border-t pt-3 md:border-t-0 md:pt-0 border-gray-100">
                <div className="text-left md:text-right w-full">
                    <div className="text-[9px] font-black text-gray-400 uppercase">Variance</div>
                    <div className={`font-mono font-black ${record.variance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {record.variance > 0 ? '+' : ''}{record.variance.toFixed(2)}
                    </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-[#1A1A1A] group-hover:text-[#FFD700] transition-all shadow-sm shrink-0">
                    <ChevronRight size={20}/>
                </div>
            </div>
        </div>
    );
})
                                    )}
                                </div>
                            </div>
                            <HistoryDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} onDelete={handleDeleteClick} />
                        </div>
                    )}
                </div>
                {showDeleteConfirm && (<div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center border-t-8 border-red-600 animate-in zoom-in-95"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><Trash2 size={32} className="text-red-600"/></div><h3 className="font-black text-2xl text-[#1A1A1A] mb-2">严重警告</h3><p className="text-sm text-gray-500 font-bold mb-2">确定要删除 <span className="text-red-600">{selectedRecord?.date}</span> 的结算记录吗？</p><p className="text-xs text-red-500 bg-red-50 p-2 rounded-lg mb-6 border border-red-100"><AlertTriangle size={12} className="inline mr-1"/>此操作将永久清空当天的营业数据，且无法恢复。</p><div className="grid grid-cols-2 gap-4"><button onClick={() => setShowDeleteConfirm(false)} className="py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">取消 (Cancel)</button><button onClick={executeDeleteRecord} className="py-3 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"><Trash2 size={16}/> 确认删除</button></div></div></div>)}
            </div>
            
            <ExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} onSave={handleAddExpense} employees={staffList} suppliers={supplierList} />
        </div>
    );
};