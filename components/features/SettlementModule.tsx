import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    DollarSign, Plus, Trash2, Check, 
    AlertTriangle, Calculator, Play, Power, History, 
    ArrowRight, Receipt, Wallet, Banknote, CreditCard, 
    Coins, X, Calendar, ChevronRight, Truck, CheckCircle2, 
    RotateCcw, AlertCircle, Loader2, User, FileText, UserMinus,
    FileDown, Printer, Edit3, ShieldCheck, Zap, MinusCircle
} from 'lucide-react';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import { SettlementRecord, StoreConfig, Employee, Supplier, ExpenseItem } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';

interface SettlementModuleProps {
    storeConfig: StoreConfig;
    onClose?: () => void;
    isStandalone?: boolean;
}

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

const isChannelReconciled = (reconStatus: any, key: string): boolean => {
    const val = reconStatus?.[key];
    return val === true || (typeof val === 'number');
};

const getReconActual = (reconStatus: any, key: string): number | null => {
    const val = reconStatus?.[key];
    if (typeof val === 'number') return val;
    return null;
};

// 🟢 改版：单个对账条目组件 (UI 移动端防走位优化 + iOS 字体防缩放自适应)
const ReconItem = ({ 
    label, 
    gross, 
    isReconciled,
    actualAmount,
    onReconcile 
}: { 
    label: string, 
    gross: number, 
    isReconciled: boolean,
    actualAmount: number | null,
    onReconcile: () => void 
}) => {
    if (gross <= 0) return null;
    const displayActual = actualAmount !== null ? actualAmount : (isReconciled ? gross : null);
    const fee = displayActual !== null ? Number((gross - displayActual).toFixed(2)) : null;
    
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm mt-2 gap-3 sm:gap-2">
            <div className="flex-1 min-w-0">
                <div className="flex justify-between sm:block items-center mb-1 sm:mb-0">
                    <p className="text-xs font-black text-gray-800 truncate pr-2">{label}</p>
                    <p className="text-[10px] text-gray-500 font-mono whitespace-nowrap">Gross: RM {gross.toFixed(2)}</p>
                </div>
                {isReconciled && displayActual !== null && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 whitespace-nowrap">
                            实收: RM {displayActual.toFixed(2)}
                        </span>
                        {fee !== null && fee > 0 && (
                            <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 whitespace-nowrap flex items-center gap-1">
                                手续费: RM {fee.toFixed(2)} 
                                <span className="font-black opacity-80">
                                    ({(fee / gross * 100).toFixed(1)}%)
                                </span>
                            </span>
                        )}
                        {fee === 0 && actualAmount === null && (
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded whitespace-nowrap">(旧记录)</span>
                        )}
                    </div>
                )}
            </div>
            
            <div className="flex justify-end shrink-0 w-full sm:w-auto">
                {isReconciled ? (
                    <span className="flex items-center justify-center w-full sm:w-auto gap-1 text-[10px] font-black text-green-700 bg-green-100 px-3 py-1.5 rounded-lg border border-green-200">
                        <CheckCircle2 size={14}/> 已过账
                    </span>
                ) : (
                    <button 
                        onClick={onReconcile}
                        className="flex items-center justify-center w-full sm:w-auto gap-1 text-[11px] font-black text-[#FFD700] bg-[#1A1A1A] hover:bg-black px-4 py-2 rounded-lg shadow-md active:scale-95 transition-all"
                    >
                        <ShieldCheck size={14}/> 核销对账
                    </button>
                )}
            </div>
        </div>
    );
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
            category: category,
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
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                        {type === 'STAFF_ADVANCE' && (
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 animate-in slide-in-from-top-2">
                                <label className="text-[10px] font-black text-orange-800 uppercase mb-2 block flex items-center gap-1"><User size={12}/> 选择员工 (Select Staff)</label>
                                <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full p-3 bg-white border border-orange-200 rounded-xl text-sm font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-orange-400">
                                    <option value="">-- 请选择 (Select) --</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block flex items-center gap-1">
                                <FileText size={12}/> 
                                {type === 'GENERAL' ? '用途 / 购买物品 (Description)' : '单据号码 / 备注 (Bill Ref / Note)'}
                            </label>
                            <input type="text" value={billRef} onChange={e => setBillRef(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#1A1A1A] transition-all" placeholder={type === 'GENERAL' ? 'e.g. Ice / Pen / Plastic Bag' : 'Optional (e.g. Inv #123)'} />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block flex items-center gap-1"><Coins size={12}/> 支付金额 (Cash Amount)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg">RM</span>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-xl font-mono text-3xl font-black text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FFD700] border-2 border-transparent focus:bg-white transition-all" placeholder="0.00" />
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

// 🌟 HistoryDetailModal - 移动端自适应黑金重构版 (含 iOS Safe Area 适配) 🌟
const HistoryDetailModal = ({ record, onClose, onDelete, onRefresh, onUndoEdit }: { record: SettlementRecord | null, onClose: () => void, onDelete: (id: string) => void, onRefresh: () => void, onUndoEdit: (record: SettlementRecord) => void }) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [localRecord, setLocalRecord] = useState<SettlementRecord | null>(record);
    
    useEffect(() => {
        setLocalRecord(record);
    }, [record]);

    const [reconTarget, setReconTarget] = useState<{key: string, label: string, gross: number} | null>(null);
    const [reconActual, setReconActual] = useState<string>('');
    const [isProcessingRecon, setIsProcessingRecon] = useState(false);

    if (!localRecord) return null;
    const deliveryBreakdown = localRecord.sales.deliveryBreakdown || {} as any;
    const totalDelivery = (Number(deliveryBreakdown.grabGross) || Number(deliveryBreakdown.grab) || 0) + 
                        (Number(deliveryBreakdown.pandaGross) || Number(deliveryBreakdown.panda) || 0) + 
                        (Number(deliveryBreakdown.shopeeGross) || Number(deliveryBreakdown.shopee) || 0) + 
                        (Number(deliveryBreakdown.lalamove) || 0);
    const totalDebit = (localRecord.sales.duitnow || 0);
    const totalCard = localRecord.sales.card || 0;
    const totalBank = (localRecord.sales.tng || 0) + totalDebit + totalCard + (localRecord.sales.amex || 0);
    
    const reconStatus = (localRecord as any).reconStatus || {};

    const handleDownloadPDF = async () => {
        if (!printRef.current) return;
        setIsGenerating(true);
        setTimeout(async () => {
            try {
                const canvas = await html2canvas(printRef.current!, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const pdf = new jsPDF('p', 'mm', 'a5'); 
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`Settlement_${localRecord.date}.pdf`);
            } catch (error) {
                console.error('PDF Generation Failed:', error);
                alert("生成 PDF 失败，请重试。");
            } finally {
                setIsGenerating(false);
            }
        }, 300);
    };

    const executeReconciliation = async (perfectMatch: boolean = false) => {
        if (!reconTarget) return;
        const actualNum = perfectMatch ? reconTarget.gross : (parseFloat(reconActual) || 0);
        
        if (actualNum > reconTarget.gross) {
            return alert("❌ 实收金额不能大于营业总额！");
        }

        const diff = Number((reconTarget.gross - actualNum).toFixed(2));
        setIsProcessingRecon(true);

        try {
            if (diff > 0) {
                // 🔑 核心修复：按渠道类型自动归类
                const PLATFORM_KEYS: Record<string, string> = {
                    grab: 'PLATFORM_FEE_GRAB',
                    panda: 'PLATFORM_FEE_PANDA',
                    shopee: 'PLATFORM_FEE_SHOPEE',
                };
                const feeCategory = PLATFORM_KEYS[reconTarget.key] || 'BANK_FEE';
                const feeLabel = PLATFORM_KEYS[reconTarget.key] ? '平台抽佣' : '银行手续费';

                const expense: ExpenseItem = {
                    id: `recon_fee_${localRecord.id}_${reconTarget.key}_${Date.now()}`,
                    category: feeCategory, 
                    expenseType: 'GENERAL',
                    company: reconTarget.label,
                    amount: diff,
                    totalBillAmount: diff,
                    outstandingAmount: 0,
                    paymentStatus: 'PAID',
                    paymentMethod: 'BANK_TRANSFER', 
                    time: `${localRecord.date}T12:00:00.000Z`, 
                    createdAt: new Date().toISOString(), 
                    note: `[自动核销${feeLabel}] 营业额: ${reconTarget.gross} | 实收: ${actualNum} | ${reconTarget.label}`,
                    paidBy: 'COMPANY'
                };
                await DataManager.saveStandaloneExpense(expense);
            }

            const updatedReconStatus = { ...reconStatus, [reconTarget.key]: actualNum };
            const updatedRecord = { ...localRecord, reconStatus: updatedReconStatus };
            
            await DataManager.updateSettlementReconStatus(localRecord.id, updatedReconStatus);
            
            setLocalRecord(updatedRecord as SettlementRecord);
            
            const matchText = perfectMatch ? '(完美对账)' : '';
            alert(`✅ ${reconTarget.label} 核销成功！${matchText}\n实收 RM ${actualNum.toFixed(2)}${diff > 0 ? `\n自动计入手续费 RM ${diff.toFixed(2)}` : ''}`);
            setReconTarget(null);
            setReconActual('');
            onRefresh(); 
        } catch (e) {
            console.error(e);
            alert("核销失败，请重试");
        } finally {
            setIsProcessingRecon(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in"
            style={{ WebkitOverflowScrolling: 'touch' }}
        >
            <div className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col custom-scrollbar relative">
                
                {reconTarget && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-50 rounded-t-[2rem] sm:rounded-[2rem] p-6 flex flex-col items-center justify-center animate-in zoom-in-95">
                        <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-200 w-full max-w-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-black text-lg text-blue-900 flex items-center gap-2"><ShieldCheck size={20}/> 数字核销</h4>
                                <button onClick={() => { setReconTarget(null); setReconActual(''); }} className="p-1 hover:bg-gray-100 rounded-full"><X size={16}/></button>
                            </div>
                            <p className="text-xs text-gray-500 font-bold mb-4">当前核销: <span className="text-[#1A1A1A]">{reconTarget.label}</span></p>
                            
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                                <div className="flex justify-between text-xs font-bold text-gray-400 mb-1"><span>System Gross (系统总额)</span><span className="whitespace-nowrap">RM {reconTarget.gross.toFixed(2)}</span></div>
                            </div>

                            <button 
                                onClick={() => executeReconciliation(true)}
                                disabled={isProcessingRecon}
                                className="w-full py-3 mb-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black shadow-md hover:from-green-600 hover:to-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isProcessingRecon ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16}/>}
                                完美对账
                                <span className="text-[10px] font-bold opacity-80 ml-1 whitespace-nowrap">= RM {reconTarget.gross.toFixed(2)}</span>
                            </button>

                            <div className="relative flex items-center justify-center mb-4">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                                <span className="relative bg-white px-3 text-[10px] font-bold text-gray-400 uppercase">或手动输入实收金额</span>
                            </div>

                            <div className="mb-6">
                                <label className="text-[10px] font-black text-blue-600 uppercase mb-2 block">Bank Received (银行实际到账金额)</label>
                                <input 
                                    type="number" 
                                    value={reconActual} 
                                    onChange={e => setReconActual(e.target.value)} 
                                    className="w-full p-4 bg-white border-2 border-blue-200 focus:border-blue-500 rounded-xl text-xl font-black font-mono outline-none shadow-inner"
                                    placeholder="0.00"
                                />
                                {reconActual && parseFloat(reconActual) < reconTarget.gross && (
                                    <div className="mt-2 p-2 bg-orange-50 border border-orange-100 rounded-lg">
                                        <p className="text-[10px] text-orange-600 font-bold leading-relaxed">
                                            ⚠️ 差额 <span className="whitespace-nowrap">RM {(reconTarget.gross - parseFloat(reconActual)).toFixed(2)}</span>
                                            <span className="bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-black mx-1 inline-block shadow-sm">
                                                抽佣率: {((reconTarget.gross - parseFloat(reconActual)) / reconTarget.gross * 100).toFixed(1)}%
                                            </span>
                                            <br/>{['grab','panda','shopee'].includes(reconTarget.key) ? '将自动归入「平台抽佣」(PLATFORM_FEE)' : '将自动归入「银行手续费」(BANK_FEE)'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => executeReconciliation(false)}
                                disabled={!reconActual || isProcessingRecon}
                                className="w-full py-3 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black shadow-md hover:bg-black disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {isProcessingRecon ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
                                确认实收并记账
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-[#1A1A1A] rounded-t-[2rem] sm:rounded-t-[2rem] sticky top-0 z-10">
                    <div>
                        <h3 className="font-black text-lg sm:text-xl text-[#FFD700]">结算单详情 (Receipt Details)</h3>
                        <p className="text-[10px] sm:text-xs text-gray-400 font-mono mt-1 font-bold tracking-widest">{localRecord.date} • {new Date(localRecord.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleDownloadPDF} 
                            disabled={isGenerating}
                            className="p-2 bg-[#FFD700] text-black rounded-full hover:bg-white hover:text-black transition-colors shadow-lg disabled:opacity-50"
                            title="导出为 PDF"
                        >
                            {isGenerating ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18}/>}
                        </button>
                        <button onClick={onClose} className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 hover:text-[#FFD700] transition-colors"><X size={18}/></button>
                    </div>
                </div>
                
                {/* 🛡️ pb-[calc(1rem+env(safe-area-inset-bottom))] 彻底解决 iOS 小白条遮挡底部按钮的问题 */}
                <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 bg-[#F8F9FA] flex-grow pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6">
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                        
                        <div className="flex flex-col sm:flex-row justify-between sm:items-end pb-4 border-b border-gray-100 gap-2">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest leading-tight">
                                Total Sales<span className="hidden sm:inline"><br/></span><span className="sm:hidden"> </span>(总营业额)
                            </span>
                            <div className="flex items-baseline gap-1 text-[#1A1A1A] shrink-0 self-end sm:self-auto">
                                <span className="text-sm font-bold">RM</span>
                                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tighter whitespace-nowrap">{localRecord.sales.total.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        {localRecord.sales.refundTotal && localRecord.sales.refundTotal > 0 ? (
                            <div className="flex justify-between items-center text-xs bg-red-50 p-3 rounded-xl border border-red-100 mb-2 gap-2">
                                <span className="flex items-center gap-2 text-red-600 font-bold shrink-0"><RotateCcw size={14}/> Refunds</span>
                                <span className="font-mono font-bold text-red-700 whitespace-nowrap shrink-0">- RM {localRecord.sales.refundTotal.toFixed(2)}</span>
                            </div>
                        ) : null}

                        <div className="flex justify-between items-center text-sm p-2 gap-2">
                            <span className="flex items-center gap-2 text-gray-600 font-bold shrink-0"><Banknote size={16} className="text-green-600"/> Cash (现金)</span>
                            <span className="font-mono font-bold text-[#1A1A1A] text-base sm:text-lg whitespace-nowrap shrink-0">RM {localRecord.sales.cash.toFixed(2)}</span>
                        </div>
                        
                        <div className="bg-blue-50/50 p-3 sm:p-4 rounded-xl space-y-2 border border-blue-100 overflow-hidden">
                            <p className="text-[10px] font-black text-blue-800 uppercase flex items-center gap-1.5"><CreditCard size={12}/> Digital & POS Payments</p>
                            
                            <ReconItem label="TNG eWallet" gross={localRecord.sales.tng || 0} isReconciled={isChannelReconciled(reconStatus, 'tng')} actualAmount={getReconActual(reconStatus, 'tng')} onReconcile={() => setReconTarget({key: 'tng', label: 'TNG eWallet', gross: localRecord.sales.tng || 0})} />
                            <ReconItem label="Debit / DuitNow" gross={totalDebit} isReconciled={isChannelReconciled(reconStatus, 'debit')} actualAmount={getReconActual(reconStatus, 'debit')} onReconcile={() => setReconTarget({key: 'debit', label: 'Debit / DuitNow', gross: totalDebit})} />
                            <ReconItem label="Credit Card" gross={totalCard} isReconciled={isChannelReconciled(reconStatus, 'credit')} actualAmount={getReconActual(reconStatus, 'credit')} onReconcile={() => setReconTarget({key: 'credit', label: 'Credit Card', gross: totalCard})} />
                            <ReconItem label="Amex" gross={localRecord.sales.amex || 0} isReconciled={isChannelReconciled(reconStatus, 'amex')} actualAmount={getReconActual(reconStatus, 'amex')} onReconcile={() => setReconTarget({key: 'amex', label: 'Amex', gross: localRecord.sales.amex || 0})} />
                        </div>

                        {totalDelivery > 0 && (
                            <div className="bg-orange-50/50 p-3 sm:p-4 rounded-xl space-y-2 border border-orange-100 overflow-hidden">
                                <div className="flex flex-wrap justify-between items-center border-b border-orange-100 pb-2 gap-1">
                                    <p className="text-[10px] font-black text-orange-800 uppercase flex items-center gap-1.5"><Truck size={12}/> Delivery Platforms</p>
                                    <span className="font-mono text-[10px] sm:text-xs font-black text-orange-800 whitespace-nowrap bg-orange-100/50 px-2 py-0.5 rounded">Total: RM {totalDelivery.toFixed(2)}</span>
                                </div>
                                
                                <ReconItem label="GrabFood" gross={(deliveryBreakdown as any).grabGross || deliveryBreakdown.grab || 0} isReconciled={isChannelReconciled(reconStatus, 'grab')} actualAmount={getReconActual(reconStatus, 'grab')} onReconcile={() => setReconTarget({key: 'grab', label: 'GrabFood', gross: (deliveryBreakdown as any).grabGross || deliveryBreakdown.grab || 0})} />
                                <ReconItem label="FoodPanda" gross={(deliveryBreakdown as any).pandaGross || deliveryBreakdown.panda || 0} isReconciled={isChannelReconciled(reconStatus, 'panda')} actualAmount={getReconActual(reconStatus, 'panda')} onReconcile={() => setReconTarget({key: 'panda', label: 'FoodPanda', gross: (deliveryBreakdown as any).pandaGross || deliveryBreakdown.panda || 0})} />
                                <ReconItem label="ShopeeFood" gross={(deliveryBreakdown as any).shopeeGross || deliveryBreakdown.shopee || 0} isReconciled={isChannelReconciled(reconStatus, 'shopee')} actualAmount={getReconActual(reconStatus, 'shopee')} onReconcile={() => setReconTarget({key: 'shopee', label: 'ShopeeFood', gross: (deliveryBreakdown as any).shopeeGross || deliveryBreakdown.shopee || 0})} />
                            </div>
                        )}
                    </div>
                    
                    <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-xl border-2 gap-2 ${localRecord.variance >= 0 ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                        <div>
                            <span className="font-black uppercase tracking-widest text-xs block mb-1">Cash Variance</span>
                            {localRecord.varianceReason && <span className="text-[10px] text-gray-600 font-bold block sm:inline">{localRecord.varianceReason}</span>}
                        </div>
                        <span className="font-mono font-black text-2xl self-end sm:self-auto whitespace-nowrap">{localRecord.variance > 0 ? '+' : ''}{localRecord.variance.toFixed(2)}</span>
                    </div>
                    
                    {/* 🌟 NEW BUTTONS FOR UNDO & DELETE 🌟 */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={() => onUndoEdit(localRecord)} className="flex-[2] py-3.5 sm:py-4 bg-[#1A1A1A] border-2 border-[#1A1A1A] text-[#FFD700] rounded-2xl font-black text-sm hover:bg-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                            <RotateCcw size={18}/> 撤销并重新编辑 (Undo & Edit)
                        </button>
                        <button onClick={() => onDelete(localRecord.id)} className="flex-[1] py-3.5 sm:py-4 bg-white border-2 border-red-100 text-red-600 rounded-2xl font-black text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2 shadow-sm">
                            <Trash2 size={18}/> 仅删除
                        </button>
                    </div>

                </div>

                <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                    <div ref={printRef} className="w-[148mm] min-h-[210mm] bg-white p-5 font-sans text-black border box-border flex flex-col">
                        
                        <div className="text-center border-b border-black pb-3 mb-4 shrink-0">
                            <h1 className="text-xl font-black tracking-widest uppercase mb-0.5">KIM LIAN KEE</h1>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Daily Settlement Report</p>
                            <p className="text-[10px] text-gray-500 mt-1.5 font-mono">{localRecord.date} • {new Date(localRecord.timestamp).toLocaleTimeString()}</p>
                            <p className="text-[8px] text-gray-400 font-mono mt-0.5">Ref: {localRecord.id.slice(-8).toUpperCase()}</p>
                        </div>

                        <div className="space-y-3 flex-grow">
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center bg-gray-100 p-3 rounded-xl">
                                    <span className="font-bold uppercase tracking-widest text-xs">Opening Float</span>
                                    <span className="font-mono font-black text-lg">RM {localRecord.openingCash.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-black text-white p-3 rounded-xl shadow-md">
                                    <span className="font-bold uppercase tracking-widest text-xs">Total Sales (今日总和)</span>
                                    <span className="font-mono font-black text-xl text-[#FFD700]">RM {localRecord.sales.total.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-xl p-3 space-y-3">
                                <h3 className="font-black border-b border-gray-200 pb-1.5 uppercase text-[10px] tracking-widest text-gray-500">Sales Breakdown</h3>
                                
                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                                    <span className="font-black text-gray-800 uppercase tracking-wide text-xs">Cash (现金)</span>
                                    <span className="font-mono font-black text-gray-900 text-xs">RM {localRecord.sales.cash.toFixed(2)}</span>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                                        <span className="font-black text-gray-800 uppercase tracking-wide text-xs">Bank (银行)</span>
                                        <span className="font-mono font-black text-gray-900 text-xs">RM {totalBank.toFixed(2)}</span>
                                    </div>
                                    <div className="pl-4 pr-2 space-y-1 text-xs text-gray-600 border-l-2 border-gray-100 ml-2">
                                        <div className="flex justify-between items-center"><span>TNG eWallet</span><span className="font-mono font-bold text-black">RM {(localRecord.sales.tng || 0).toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center"><span>Debit Card</span><span className="font-mono font-bold text-black">RM {totalDebit.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center"><span>Credit Card</span><span className="font-mono font-bold text-black">RM {totalCard.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center"><span>Amex</span><span className="font-mono font-bold text-black">RM {(localRecord.sales.amex || 0).toFixed(2)}</span></div>
                                    </div>
                                </div>

                                {totalDelivery > 0 && (
                                    <div className="space-y-2 pt-1.5 border-t border-dashed border-gray-200">
                                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                                            <span className="font-black text-gray-800 uppercase tracking-wide text-xs">Delivery (外卖)</span>
                                            <span className="font-mono font-black text-gray-900 text-xs">RM {totalDelivery.toFixed(2)}</span>
                                        </div>
                                        <div className="pl-4 pr-2 space-y-2 border-l-2 border-gray-100 ml-2">
                                            {[
                                                { label: 'Grab', net: deliveryBreakdown.grab, gross: (deliveryBreakdown as any).grabGross },
                                                { label: 'FoodPanda', net: deliveryBreakdown.panda, gross: (deliveryBreakdown as any).pandaGross },
                                                { label: 'Shopee', net: deliveryBreakdown.shopee, gross: (deliveryBreakdown as any).shopeeGross },
                                                { label: 'Lalamove', net: deliveryBreakdown.lalamove, gross: 0 }
                                            ].map(platform => {
                                                if (!platform.net && !platform.gross) return null;
                                                return (
                                                    <div key={platform.label} className="flex justify-between items-center text-xs">
                                                        <span className="font-bold text-gray-800">{platform.label}</span>
                                                        <span className="font-mono text-black font-bold">RM {(platform.gross || platform.net || 0).toFixed(2)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className={`flex justify-between items-center p-3 rounded-xl border ${localRecord.variance >= 0 ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                                <span className="font-bold uppercase tracking-widest text-[11px]">Cash Variance</span>
                                <span className="font-mono font-black text-lg">{localRecord.variance > 0 ? '+' : ''}{localRecord.variance.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mt-auto pt-3 text-center border-t border-black">
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5">System Generated Report</p>
                            <p className="text-[7px] text-gray-400">EPR System • For Internal Use Only</p>
                        </div>
                    </div>
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
    
    // 简化版开班点算 - 直接输入总数
    const [openingTotal, setOpeningTotal] = useState<number>(0);
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
    
    const [historyRecords, setHistoryRecords] = useState<SettlementRecord[]>([]);
    const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7)); 
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
                
                // 处理历史遗留数据，兼容旧版 denominations
                const savedCounts = shift.openingCounts || {};
                const savedCoins = shift.openingCoins || 0;
                const calcTotal = Object.entries(savedCounts).reduce((acc, [val, count]) => acc + (parseInt(val) * (Number(count) || 0)), 0) + Number(savedCoins);
                setOpeningTotal(shift.openingTotal ?? calcTotal);
                
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
        records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistoryRecords(records);
        setIsLoading(false);
    };

    useEffect(() => {
        if (isShiftOpen && !isLoading && !isSubmitting && activeTab === 'SHIFT') {
            const shiftData = {
                businessDate: businessDate || getBusinessDateStr(4),
                openingTotal, salesData, 
                expenseList: shiftExpenses,
                closingCashInput, varianceReason: varianceReason || '', updatedAt: new Date().toISOString()
            };
            DataManager.saveActiveShift(shiftData);
        }
    }, [isShiftOpen, businessDate, openingTotal, salesData, closingCashInput, varianceReason, isLoading, activeTab, isSubmitting, shiftExpenses]);

    const totals = useMemo(() => {
        const s = salesData;
        const posSales = (Number(s.cash)||0) + (Number(s.tng)||0) + (Number(s.duitnow)||0) + (Number(s.card)||0) + (Number(s.amex)||0);
        
        const grabVal = Number(s.grabGross) || Number(s.grab) || 0;
        const pandaVal = Number(s.pandaGross) || Number(s.panda) || 0;
        const shopeeVal = Number(s.shopeeGross) || Number(s.shopee) || 0;
        const deliverySales = grabVal + pandaVal + shopeeVal + (Number(s.lalamove)||0);
        
        const totalRevenue = posSales + deliverySales;
        const totalCashOut = shiftExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const expectedCash = Number(openingTotal) + Number(s.cash||0) - totalCashOut; 
        const variance = Number(closingCashInput) - expectedCash;
        const storeHubTotal = Number(s.storeHubTotal) || 0;
        const salesVariance = posSales - storeHubTotal;
        return { posSales, deliverySales, totalRevenue, totalCashOut, expectedCash, variance, storeHubTotal, salesVariance };
    }, [openingTotal, salesData, closingCashInput, shiftExpenses]);

    const handleStartShift = () => {
        if (openingTotal <= 0 && !confirm("点算总额为 RM 0，确定开班吗？")) return;
        setIsShiftOpen(true);
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

    // 🌟 THE UNDO & EDIT LOGIC 🌟
    const handleUndoAndEdit = async (record: SettlementRecord) => {
        if (!confirm(`⚠️ 确定要撤销并重新编辑 ${record.date} 的结算吗？\n\n系统将删除该历史记录，并把所有数据反填恢复到当班表单中供您修改。`)) return;
        
        setIsLoading(true);
        try {
            await DataManager.deleteSettlement(record.id);
            
            setBusinessDate(record.date);
            setOpeningTotal(record.openingCash); 
            
            // 🛡️ 防御性映射：应对旧版数据没有保存 xxxGross 的情况，如果缺失则回退到基础字段
            const bd = record.sales.deliveryBreakdown as any || {};
            setSalesData({
                storeHubTotal: record.sales.storeHubTotal || 0,
                refundTotal: record.sales.refundTotal || 0,
                cash: record.sales.cash || 0,
                tng: record.sales.tng || 0,
                duitnow: record.sales.duitnow || 0,
                card: record.sales.card || 0,
                amex: record.sales.amex || 0,
                grab: bd.grabGross || bd.grab || 0,
                panda: bd.pandaGross || bd.panda || 0,
                shopee: bd.shopeeGross || bd.shopee || 0,
                lalamove: bd.lalamove || 0,
                grabGross: bd.grabGross || bd.grab || 0,
                pandaGross: bd.pandaGross || bd.panda || 0,
                shopeeGross: bd.shopeeGross || bd.shopee || 0
            });
            
            setShiftExpenses(record.expenses || []);
            setClosingCashInput(record.closingCash || 0);
            setVarianceReason(record.varianceReason || '');
            
            setIsShiftOpen(true);
            setActiveTab('SHIFT');
            setSelectedRecord(null);
            
            const updatedHistory = await DataManager.getSettlements(filterMonth);
            setHistoryRecords(updatedHistory);
            
            alert("✅ 撤销成功！数据已完全恢复，请直接修改您需要调整的金额。");
        } catch(e) {
            console.error(e);
            alert("撤销失败，请检查网络 (Undo Failed)");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitSettlement = async () => {
        setIsSubmitting(true);
        
        const isDuplicate = await DataManager.checkSettlementExists(businessDate);
        if (isDuplicate) {
             alert(`📅 日期 ${businessDate} 已经结算过了！\n\n系统检测到重复记录。若需重新提交，请先在"历史"页面撤销该日期的旧记录。`);
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
                        grab: salesData.grabGross || salesData.grab || 0,       
                        panda: salesData.pandaGross || salesData.panda || 0,     
                        shopee: salesData.shopeeGross || salesData.shopee || 0,  
                        lalamove: salesData.lalamove || 0,
                        grabGross: salesData.grabGross || 0, pandaGross: salesData.pandaGross || 0, shopeeGross: salesData.shopeeGross || 0
                    }
            },
            expenses: shiftExpenses, 
            variance: totals.variance,
            varianceReason: varianceReason,
            submittedBy: 'Manager',
            isClosed: true,
            reconStatus: {
                tng: false, debit: false, credit: false, amex: false, grab: false, panda: false, shopee: false
            } as any
        };
        
        try {
            await DataManager.executeSettlementTransaction(record);

            const nextDateStr = getBusinessDateStr(storeConfig.businessDayCutoff || 4);
            setBusinessDate(nextDateStr);
            setOpeningTotal(0);
            setSalesData({ storeHubTotal: 0, refundTotal: 0, cash: 0, tng: 0, duitnow: 0, card: 0, amex: 0, grab: 0, panda: 0, shopee: 0, lalamove: 0, grabGross: 0, pandaGross: 0, shopeeGross: 0 });
            setClosingCashInput(0);
            setShiftExpenses([]);
            setVarianceReason('');
            setIsShiftOpen(false);
            
            alert("✅ 结算成功！数据已转入历史记录，请移步历史列表进行数字对账。");
            
            setActiveTab('HISTORY');
            loadHistory();
            
        } catch (error: any) { 
            console.error("Settlement Error", error); 
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
                <div className="bg-[#1A1A1A] px-4 pb-4 pt-[max(env(safe-area-inset-top,16px),16px)] flex flex-col md:flex-row justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700] gap-4 md:gap-0 relative z-50 shadow-md">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="bg-[#FFD700] text-black p-2 md:p-2.5 rounded-xl shadow-lg shrink-0"><Calculator size={24}/></div>
                        <div><h3 className="font-serif font-black text-lg md:text-xl tracking-wide">每日结算中心</h3><p className="text-[9px] md:text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">SETTLEMENT & CASH CONTROL</p></div>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-auto gap-3 relative z-50">
                        <div className="flex bg-white/10 p-1 rounded-xl flex-1 md:flex-none justify-center cursor-pointer relative z-50">
                            <button onClick={() => setActiveTab('SHIFT')} className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap relative z-50 ${activeTab === 'SHIFT' ? 'bg-[#FFD700] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}>当班 (Shift)</button>
                            <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap relative z-50 ${activeTab === 'HISTORY' ? 'bg-[#FFD700] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}>历史 (History)</button>
                        </div>
                        <div className="flex gap-2 relative z-50">
                            <ModuleGuideButton module="SETTLEMENT" />
                            {onClose && (<button onClick={onClose} className="p-2 md:p-3 bg-white/10 hover:bg-red-600 rounded-xl transition-colors text-white relative z-50 cursor-pointer" title="关闭/退出 (Exit)"><X size={20}/></button>)}
                        </div>
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
                                            <label className="text-[10px] font-black text-gray-400 uppercase mb-4 block tracking-widest">开班现金金额 (Opening Float)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-2xl">RM</span>
                                                <input 
                                                    type="number" 
                                                    value={openingTotal || ''} 
                                                    onChange={e => setOpeningTotal(parseFloat(e.target.value) || 0)} 
                                                    className="w-full pl-14 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl font-mono text-3xl font-black text-[#1A1A1A] outline-none focus:border-[#FFD700] transition-all shadow-sm" 
                                                    placeholder="0.00" 
                                                />
                                            </div>
                                        </div>
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
                                        <div className="space-y-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                                            <h4 className="text-xs font-bold text-[#1A1A1A] uppercase border-b pb-3 mb-3">POS Payment Methods (In-Store)</h4>
                                            
                                            <div className="flex items-center gap-3 mb-3 group">
                                                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600 shrink-0 shadow-sm border border-green-100 group-hover:scale-105 transition-transform"><Banknote size={18}/></div>
                                                <span className="text-xs font-bold text-gray-600 w-24 shrink-0 whitespace-nowrap">Cash (现金)</span>
                                                <div className="relative flex-grow"><input type="number" className="w-full p-3 bg-gray-50 rounded-xl text-right font-mono font-bold text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#FFD700] transition-colors tabular-nums shadow-inner" value={salesData.cash || ''} onChange={e => setSalesData({...salesData, cash: parseFloat(e.target.value)})} /></div>
                                            </div>

                                            <div className="flex items-center gap-3 mb-3 group">
                                                <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600 shrink-0 shadow-sm border border-cyan-100 group-hover:scale-105 transition-transform"><Wallet size={18}/></div>
                                                <span className="text-xs font-bold text-gray-600 w-24 shrink-0 whitespace-nowrap">TNG eWallet</span>
                                                <div className="relative flex-grow"><input type="number" className="w-full p-3 bg-gray-50 rounded-xl text-right font-mono font-bold text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#FFD700] transition-colors tabular-nums shadow-inner" value={salesData.tng || ''} onChange={e => setSalesData({...salesData, tng: parseFloat(e.target.value)})} /></div>
                                            </div>

                                            <div className="flex items-center gap-3 mb-3 group">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm border border-indigo-100 group-hover:scale-105 transition-transform"><CreditCard size={18}/></div>
                                                <span className="text-xs font-bold text-gray-600 w-24 shrink-0 whitespace-nowrap">Debit Card</span>
                                                <div className="relative flex-grow"><input type="number" className="w-full p-3 bg-gray-50 rounded-xl text-right font-mono font-bold text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#FFD700] transition-colors tabular-nums shadow-inner" value={salesData.duitnow || ''} onChange={e => setSalesData({...salesData, duitnow: parseFloat(e.target.value)})} /></div>
                                            </div>

                                            <div className="flex items-center gap-3 mb-3 group">
                                                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0 shadow-sm border border-purple-100 group-hover:scale-105 transition-transform"><CreditCard size={18}/></div>
                                                <span className="text-xs font-bold text-gray-600 w-24 shrink-0 whitespace-nowrap">Credit Card</span>
                                                <div className="relative flex-grow"><input type="number" className="w-full p-3 bg-gray-50 rounded-xl text-right font-mono font-bold text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#FFD700] transition-colors tabular-nums shadow-inner" value={salesData.card || ''} onChange={e => setSalesData({...salesData, card: parseFloat(e.target.value)})} /></div>
                                            </div>

                                            <div className="flex items-center gap-3 mb-3 group">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 shadow-sm border border-blue-100 group-hover:scale-105 transition-transform"><CreditCard size={18}/></div>
                                                <span className="text-xs font-bold text-blue-600 w-24 shrink-0 whitespace-nowrap">Amex</span>
                                                <div className="relative flex-grow"><input type="number" className="w-full p-3 bg-gray-50 rounded-xl text-right font-mono font-bold text-base outline-none focus:bg-white focus:ring-2 focus:ring-blue-300 transition-colors tabular-nums shadow-inner" value={salesData.amex || ''} onChange={e => setSalesData({...salesData, amex: parseFloat(e.target.value)})} /></div>
                                            </div>
                                            
                                            <div className="pt-3 mt-3 border-t border-gray-100 flex justify-between items-center text-xs font-bold"><span>POS Total</span><span className="font-mono text-blue-600 text-base">RM {totals.posSales.toFixed(2)}</span></div>
                                        </div>
                                        
                                        <div className="space-y-3 bg-orange-50/50 p-5 rounded-3xl border border-orange-100 shadow-sm">
                                            <div className="flex justify-between items-center border-b border-orange-200 pb-3 mb-3">
                                                <h4 className="text-xs font-bold text-orange-800 uppercase">Delivery Platforms</h4>
                                                <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">⚠️ 日后对账自动扣手续费</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-3 px-1">
                                                <span className="w-[72px] shrink-0"></span>
                                                <span className="flex-1 text-center bg-white/50 rounded py-1 shadow-sm">原价 Gross (必填)</span>
                                            </div>
                                            
                                            {[
                                                { key: 'grabGross', label: 'Grab', color: 'text-green-600 bg-green-50 border-green-100', ring: 'focus:ring-green-400' },
                                                { key: 'pandaGross', label: 'Panda', color: 'text-pink-600 bg-pink-50 border-pink-100', ring: 'focus:ring-pink-400' },
                                                { key: 'shopeeGross', label: 'Shopee', color: 'text-orange-600 bg-orange-50 border-orange-100', ring: 'focus:ring-orange-400' },
                                            ].map(item => (
                                                <div key={item.key} className="flex items-center gap-2 mb-3">
                                                    <div className={`w-[72px] shrink-0 border rounded-xl py-2 flex items-center justify-center shadow-sm ${item.color}`}>
                                                        <span className="text-[11px] font-black">{item.label}</span>
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <input 
                                                            type="number" 
                                                            placeholder="0.00" 
                                                            className={`w-full px-2 py-2.5 bg-white rounded-xl text-center font-mono font-bold text-sm outline-none focus:ring-2 ${item.ring} border border-orange-100 shadow-inner transition-all tabular-nums`} 
                                                            value={(salesData as any)[item.key] || ''} 
                                                            onChange={e => setSalesData({...salesData, [item.key]: parseFloat(e.target.value) || 0})} 
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            <div className="flex items-center gap-2 pt-1 border-t border-orange-100/50 mt-2">
                                                <div className="w-[72px] shrink-0 border rounded-xl py-2 flex items-center justify-center shadow-sm text-blue-600 bg-blue-50 border-blue-100">
                                                    <span className="text-[11px] font-black">Lala</span>
                                                </div>
                                                <div className="flex-1 relative">
                                                    <input type="number" placeholder="Net Only" className="w-full px-2 py-2.5 bg-white rounded-xl text-center font-mono font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400 border border-orange-100 shadow-inner transition-all tabular-nums" value={salesData.lalamove || ''} onChange={e => setSalesData({...salesData, lalamove: parseFloat(e.target.value) || 0})} />
                                                </div>
                                            </div>

                                            <div className="pt-3 mt-3 border-t border-orange-200 space-y-1">
                                                <div className="flex justify-between items-center text-xs font-bold">
                                                    <span>Delivery Gross Total</span>
                                                    <span className="font-mono text-orange-600 text-base">RM {totals.deliverySales.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-red-50 p-5 rounded-3xl border border-red-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-black text-red-700 uppercase flex items-center gap-2"><MinusCircle size={16}/> 现金支出 (Cash Payouts)</h4>
                                            <button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-red-700 shadow-md transition-all active:scale-95">
                                                <Plus size={14}/> 记一笔支出 (Add)
                                            </button>
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
                                                <div className="pt-2 mt-2 border-t border-red-200 flex justify-end text-xs font-black text-red-800">
                                                    Total Out: RM {totals.totalCashOut.toFixed(2)}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`p-5 rounded-2xl border flex justify-between items-center shadow-sm ${Math.abs(totals.salesVariance) < 1 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
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
                            <div className="p-3 sm:p-6 bg-white border-b border-gray-200 shadow-sm shrink-0">
                                <div className="max-w-4xl mx-auto flex justify-between items-center gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="bg-[#1A1A1A] p-1.5 sm:p-2 rounded-xl text-[#FFD700] shadow-md"><Calendar className="w-5 h-5 sm:w-5 sm:h-5"/></div>
                                        <div>
                                            <h4 className="font-black text-[#1A1A1A] text-base sm:text-lg">历史账单</h4>
                                            {/* 手机端隐藏这段英文废话 */}
                                            <p className="hidden sm:block text-[10px] text-gray-400 font-bold uppercase mt-0.5">Archive & Reconciliation History</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 p-1.5 sm:p-2 rounded-xl border border-gray-200">
                                        <span className="hidden sm:inline text-xs font-black text-gray-400 px-2">月份:</span>
                                        <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-transparent font-black text-[#1A1A1A] text-sm sm:text-base outline-none w-[110px] sm:w-auto" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex-grow overflow-y-auto p-4 md:p-6 pb-32">
                                {/* 🌟 优化1：PC端启用大宽屏 grid-cols-2 (一行两天)，手机端保持 grid-cols-1 🌟 */}
                                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                    {isLoading ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 lg:col-span-2">
                                            <Loader2 size={48} className="animate-spin mb-4 text-[#FFD700]"/>
                                            <p className="font-bold">正在拉取 {filterMonth} 的账单...</p>
                                        </div>
                                    ) : historyRecords.length === 0 ? (
                                        <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-gray-200 lg:col-span-2">
                                            <History size={64} className="mx-auto mb-4 opacity-10 text-[#1A1A1A]"/>
                                            <p className="font-black text-[#1A1A1A]">{filterMonth} 暂无历史数据</p>
                                        </div>
                                    ) : (
                                        historyRecords.map(record => {
                                            const debit = record.sales.duitnow || 0;
                                            const credit = record.sales.card || 0;
                                            const tng = record.sales.tng || 0;
                                            const amex = record.sales.amex || 0;
                                            const cash = record.sales.cash || 0;
                                            
                                            const rs = (record as any).reconStatus || {};
                                            const deliveryBreakdown = record.sales.deliveryBreakdown || {} as any;
                                            
                                            const grabGross = deliveryBreakdown.grabGross || deliveryBreakdown.grab || 0;
                                            const pandaGross = deliveryBreakdown.pandaGross || deliveryBreakdown.panda || 0;
                                            const shopeeGross = deliveryBreakdown.shopeeGross || deliveryBreakdown.shopee || 0;
                                            const lalamoveVal = deliveryBreakdown.lalamove || 0;
                                            const totalDeliveryVal = grabGross + pandaGross + shopeeGross + lalamoveVal;
                                            
                                            const totalCardVal = debit + credit + amex;

                                            let hasPending = false;
                                            if (tng > 0 && !isChannelReconciled(rs, 'tng')) hasPending = true;
                                            if (debit > 0 && !isChannelReconciled(rs, 'debit')) hasPending = true;
                                            if (credit > 0 && !isChannelReconciled(rs, 'credit')) hasPending = true;
                                            if (amex > 0 && !isChannelReconciled(rs, 'amex')) hasPending = true;
                                            if (grabGross > 0 && !isChannelReconciled(rs, 'grab')) hasPending = true;
                                            if (pandaGross > 0 && !isChannelReconciled(rs, 'panda')) hasPending = true;
                                            if (shopeeGross > 0 && !isChannelReconciled(rs, 'shopee')) hasPending = true;

                                            return (
                                                <div key={record.id} onClick={() => setSelectedRecord(record)} className={`bg-white p-4 sm:p-5 rounded-[1.5rem] border ${hasPending ? 'border-orange-300 shadow-md' : 'border-gray-100 hover:border-[#FFD700] hover:shadow-xl'} active:scale-[0.98] transition-all cursor-pointer group relative flex flex-col`}>
                                                    
                                                    {/* 待对账红点提示（改得更精致，像系统通知标签） */}
                                                    {hasPending && (
                                                        <div className="absolute top-0 right-5 bg-orange-500 text-white text-[9px] font-black px-2.5 py-1 rounded-b-lg shadow-sm z-10 animate-pulse">
                                                            ⏳ 待对账
                                                        </div>
                                                    )}

                                                    {/* 顶部核心：日期 + 总额 + 差异 */}
                                                    <div className="flex items-center justify-between mb-3 mt-1">
                                                        <div className="flex items-center gap-3.5">
                                                            <div className="w-12 h-12 bg-[#1A1A1A] rounded-2xl flex flex-col items-center justify-center text-[#FFD700] shadow-md shrink-0">
                                                                <span className="text-[9px] font-black leading-none opacity-80 uppercase tracking-wider">{new Date(record.date).toLocaleString('default', { month: 'short' })}</span>
                                                                <span className="text-xl font-black leading-none mt-1">{record.date.split('-')[2]}</span>
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Sales</div>
                                                                <div className="text-xl sm:text-2xl font-black text-[#1A1A1A] tracking-tight">RM {record.sales.total.toFixed(2)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[9px] font-black text-gray-400 uppercase mb-1">Variance</div>
                                                            <div className={`font-mono font-black text-sm sm:text-base px-2 py-0.5 rounded-lg ${record.variance >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                                {record.variance > 0 ? '+' : ''}{record.variance.toFixed(2)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 优雅的渐变分割线 */}
                                                    <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent my-2"></div>

                                                    {/* 中部明细：去除格子边框，改为左右双列财务账单对齐法 */}
                                                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-1 mt-2">
                                                        <div className="flex justify-between items-center text-[11px] sm:text-xs">
                                                            <span className="text-gray-500 font-bold">Cash</span>
                                                            <span className="font-mono font-black text-[#1A1A1A]">{cash.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[11px] sm:text-xs">
                                                            <span className="text-gray-500 font-bold">TNG</span>
                                                            <span className="font-mono font-black text-[#1A1A1A]">{tng.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[11px] sm:text-xs">
                                                            <span className="text-gray-500 font-bold">Card</span>
                                                            <span className="font-mono font-black text-[#1A1A1A]">{totalCardVal.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[11px] sm:text-xs">
                                                            <span className="text-gray-500 font-bold">Delivery</span>
                                                            <span className="font-mono font-black text-orange-600">{totalDeliveryVal.toFixed(2)}</span>
                                                        </div>
                                                    </div>

                                                    {/* 底部微胶囊：只有存在外卖数据时才显示，去掉冗杂的粗边框和冗余的 Truck Icon */}
                                                    {totalDeliveryVal > 0 && (
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-dashed border-gray-100 px-1">
                                                            {grabGross > 0 && <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md">Grab {grabGross.toFixed(0)}</span>}
                                                            {pandaGross > 0 && <span className="text-[9px] font-bold text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded-md">Panda {pandaGross.toFixed(0)}</span>}
                                                            {shopeeGross > 0 && <span className="text-[9px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-md">Shopee {shopeeGross.toFixed(0)}</span>}
                                                            {lalamoveVal > 0 && <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">Lala {lalamoveVal.toFixed(0)}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            <HistoryDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} onDelete={handleDeleteClick} onRefresh={loadHistory} onUndoEdit={handleUndoAndEdit} />
                        </div>
                    )}
                </div>

                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center border-t-8 border-red-600 animate-in zoom-in-95">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <Trash2 size={32} className="text-red-600"/>
                            </div>
                            <h3 className="font-black text-2xl text-[#1A1A1A] mb-2">严重警告</h3>
                            <p className="text-sm text-gray-500 font-bold mb-2">确定要仅删除 <span className="text-red-600">{selectedRecord?.date}</span> 的结算记录吗？</p>
                            <p className="text-xs text-red-500 bg-red-50 p-2 rounded-lg mb-6 border border-red-100">
                                <AlertTriangle size={12} className="inline mr-1"/>
                                如果你想修改数据，请使用“撤销并重新编辑”按钮。此操作将永久清空记录。
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setShowDeleteConfirm(false)} className="py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">取消</button>
                                <button onClick={executeDeleteRecord} className="py-3 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2">
                                    <Trash2 size={16}/> 确认删除
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <ExpenseModal 
                isOpen={isExpenseModalOpen} 
                onClose={() => setIsExpenseModalOpen(false)} 
                onSave={handleAddExpense}
                employees={staffList}
                suppliers={supplierList}
            />
        </div>
    );
};