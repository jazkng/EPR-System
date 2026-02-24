
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Building, Zap, Trash2, Plus, DollarSign, X, CheckCircle2, History, AlertTriangle, FileCheck, Home, Banknote, Droplets, Wifi, Gauge, CalendarDays, TrendingUp, ArrowRight, Clock, Edit3, Calculator, BadgeAlert, Layers, ShieldCheck, Copy, AlertOctagon, Link as LinkIcon, PiggyBank, Archive, ArchiveRestore, Loader2, Clipboard, ExternalLink } from 'lucide-react';
import { RecurringBill, BillPaymentRecord, RecurringBillCategory, RecurringBillType } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';

interface RecurringBillsModuleProps {
    onClose: () => void;
}

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
            const rawRecord: BillPaymentRecord = {
                id: `pay_${Date.now()}`,
                billId: payingBill.id,
                name: payingBill.name,
                amount: payAmount || 0,
                date: payDate,
                category: payingBill.category,
                method: payMethod,
                referenceNo: payRef,
                usage: payUsage ? parseFloat(payUsage) : undefined,
                usageUnit: CATEGORY_CONFIG[payingBill.category]?.unit,
                linkUrl: payLink // Save Link
            };

            // Firestore hates undefined values. We strip them out using JSON parse/stringify.
            const record = JSON.parse(JSON.stringify(rawRecord));

            await DataManager.saveBillPayment(record);
            
            // Update last paid date
            const rawUpdatedBill = { ...payingBill, lastPaidDate: payDate };
            const updatedBill = JSON.parse(JSON.stringify(rawUpdatedBill));
            
            await DataManager.saveRecurringBill(updatedBill);
            
            setIsPayModalOpen(false);
            setPayingBill(null);
            alert("✅ 支付已记录 (Payment Recorded)");
            loadData();
        } catch (error: any) {
            console.error("Payment failed", error);
            alert(`❌ 支付失败 (Failed): ${error.message || 'Data Error'}. Please try again.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePayment = async (id: string) => {
        if(!confirm("Delete payment record?")) return;
        await DataManager.deleteBillPayment(id);
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

                    {/* HISTORY LIST */}
                    {activeTab === 'HISTORY' && (
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-xs text-gray-500 font-bold uppercase border-b border-gray-200">
                                    <tr>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Bill Name</th>
                                        <th className="p-4 text-right">Amount</th>
                                        <th className="p-4 text-center">Ref/Link</th>
                                        <th className="p-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-100">
                                    {payments.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">No records</td></tr> : 
                                    payments.map(p => (
                                        <tr key={p.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-mono text-xs">{p.date}</td>
                                            <td className="p-4 font-bold text-[#1A1A1A]">{p.name} <span className="text-[10px] text-gray-400 font-normal uppercase bg-gray-100 px-1.5 py-0.5 rounded ml-2">{p.category}</span></td>
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
                                                <button onClick={() => handleDeletePayment(p.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                            <h3 className="font-black text-xl text-[#1A1A1A] mb-1">支付账单 (Pay Bill)</h3>
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
                                        {isSubmitting ? 'Processing...' : 'Confirm Pay'}
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
