import React, { useState, useEffect } from 'react';
import { 
    Users, Settings, Crown, 
    BarChart3, Banknote, Coffee, 
    Truck, Armchair, CheckSquare, PenTool, BookOpen, CalendarOff, 
    ClipboardCheck, Layout, Box, Eye, FileBarChart, Calculator, Clock, CreditCard, Wallet, ShieldCheck,
    AlertTriangle, Bell, ChevronRight, ShoppingCart, Megaphone, Target, PartyPopper, Vote, TrendingUp, Award
} from 'lucide-react';
import { Employee, RecurringBill } from '../types';
import { HRSystem } from './features/HRSystem';
import { MenuManagement } from './features/MenuManagement';
import { RecurringBillsModule } from './features/RecurringBillsModule';
import { OrgChart } from './features/OrgChart';
import { FinancialReport } from './features/FinancialReport';
import { AttendanceConsole } from './features/AttendanceConsole';
import { AccountsPayableModule } from './features/AccountsPayableModule';
import { TreasuryModule } from './features/TreasuryModule'; 
import { WarrantyModule } from './features/WarrantyModule'; 
import { EventsPlanningModule } from './features/EventsPlanningModule';
import { PriceMonitorModule } from './features/PriceMonitorModule'; 
import { EmployeeAssessmentModule } from './features/EmployeeAssessmentModule'; // NEW IMPORT
import { TranslationManager } from './features/TranslationManager'; // TRANSLATION IMPORT
import { DataManager } from '../utils/dataManager'; 

interface BossDashboardProps {
    onNavigate: (tab: string) => void;
    currentEmployee?: Employee | null;
    onOpenConfig: () => void; 
}

export const BossDashboard: React.FC<BossDashboardProps> = ({ onNavigate, currentEmployee, onOpenConfig }) => {
    // Modal State
    const [activeModal, setActiveModal] = useState<'NONE' | 'HR' | 'MENU' | 'BILLS' | 'ORG' | 'REPORTS' | 'ATTENDANCE' | 'AP' | 'TREASURY' | 'WARRANTY' | 'PLANNING' | 'PRICE_MONITOR' | 'ASSESSMENT' | 'TRANSLATION'>('NONE');
    
    // Alert States
    const [billAlertCount, setBillAlertCount] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [todayLogCount, setTodayLogCount] = useState(0);
    const [absentCount, setAbsentCount] = useState(0);
    const [loadingAlerts, setLoadingAlerts] = useState(true);

    // SYSTEM HEALTH CHECK
    useEffect(() => {
        const runHealthCheck = async () => {
            setLoadingAlerts(true);
            try {
                // 1. BILL ALERTS (Existing)
                const bills = await DataManager.getRecurringBills();
                let bAlerts = 0;
                const today = new Date();
                const currentYear = today.getFullYear();
                bills.forEach(bill => {
                    if (bill.type === 'YEARLY') {
                        const dueDate = new Date(currentYear, (bill.dueMonth || 1) - 1, bill.dueDay);
                        const diffTime = dueDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const lastPaidYear = bill.lastPaidDate ? new Date(bill.lastPaidDate).getFullYear() : 0;
                        const isPaid = lastPaidYear >= currentYear;
                        if (!isPaid && diffDays <= (bill.reminderDays || 30)) bAlerts++;
                    } 
                });
                setBillAlertCount(bAlerts);

                // 2. LOW STOCK ALERT
                const [kStock, bStock, gStock] = await Promise.all([
                    DataManager.getStock('KITCHEN'),
                    DataManager.getStock('BAR'),
                    DataManager.getStock('GENERAL')
                ]);
                const allStock = [...kStock, ...bStock, ...gStock];
                const lowItems = allStock.filter(i => i.currentQty <= i.minLevel).length;
                setLowStockCount(lowItems);

                // 3. TODAY'S LOGBOOK ALERT (UNACKNOWLEDGED)
                const logs = await DataManager.getLogs();
                const dateStr = today.toISOString().split('T')[0];
                // Only count logs that are from today AND haven't been acknowledged
                const newLogs = logs.filter(l => l.date === dateStr && !l.acknowledgedBy).length;
                setTodayLogCount(newLogs);

                // 4. STAFF ABSENCE ALERT
                const { roster } = await DataManager.getRosterData();
                const todayRoster = roster[dateStr] || {};
                // Count MC or ABSENT
                const absentStaff = Object.values(todayRoster).filter(status => status === 'MC' || status === 'ABSENT').length;
                setAbsentCount(absentStaff);

            } catch (e) {
                console.error("Alert Check Failed", e);
            } finally {
                setLoadingAlerts(false);
            }
        };
        runHealthCheck();
    }, []);

    const totalAlerts = billAlertCount + lowStockCount + todayLogCount + absentCount;

    // --- UI COMPONENTS ---
    const DashboardCard = ({ title, sub, icon: Icon, colorClass, onClick, iconColor, alertCount, alertColor = "bg-red-500" }: any) => (
        <button onClick={onClick} className="bg-white p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all text-left group h-full flex flex-col justify-between relative overflow-visible active:scale-[0.98]">
            {alertCount > 0 && (
                <div className={`absolute -top-2 -right-2 ${alertColor} text-white text-[10px] font-black min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center shadow-md animate-pulse z-10 border-2 border-white`}>
                    {alertCount}
                </div>
            )}
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-4 ${colorClass}`}>
                <Icon size={20} className={`md:w-6 md:h-6 ${iconColor}`} />
            </div>
            <div>
                <h4 className="font-bold text-[#1A1A1A] text-xs md:text-sm mb-0.5 md:mb-1 group-hover:text-black transition-colors leading-tight">{title}</h4>
                <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-tight line-clamp-1">{sub}</p>
            </div>
        </button>
    );

    return (
        <div className="p-3 md:p-8 max-w-7xl mx-auto pb-32 space-y-4 md:space-y-8 bg-[#FAFAFA] min-h-screen">
            
            {/* ALERT BANNER (Only shows if issues exist) */}
            {!loadingAlerts && totalAlerts > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-3xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top-4 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-100 text-red-600 p-3 rounded-2xl animate-pulse">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-[#1A1A1A] text-lg">今日异常汇报 (Daily Alert)</h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {lowStockCount > 0 && <span className="text-xs font-bold text-red-600 bg-white px-2 py-1 rounded-lg border border-red-100">📉 {lowStockCount} 库存不足</span>}
                                {todayLogCount > 0 && <span className="text-xs font-bold text-blue-600 bg-white px-2 py-1 rounded-lg border border-blue-100">📝 {todayLogCount} 条未读日志</span>}
                                {absentCount > 0 && <span className="text-xs font-bold text-orange-600 bg-white px-2 py-1 rounded-lg border border-orange-100">🤒 {absentCount} 人缺席</span>}
                                {billAlertCount > 0 && <span className="text-xs font-bold text-purple-600 bg-white px-2 py-1 rounded-lg border border-purple-100">💸 {billAlertCount} 账单到期</span>}
                            </div>
                        </div>
                    </div>
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">System Status</p>
                        <p className="text-red-500 font-black text-sm">Action Required</p>
                    </div>
                </div>
            )}

            {/* 1. CORE MANAGEMENT (OWNER'S OFFICE) */}
            <div className="bg-[#F3F4F6] rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-8 border border-gray-200/60 space-y-5 md:space-y-8">
                <div className="flex justify-between items-center px-1">
                    <h3 className="font-black text-[#8B0000] text-sm md:text-base flex items-center gap-2 uppercase tracking-widest">
                        <Crown size={18} className="fill-current" /> 核心管理 (Owner's Office)
                    </h3>
                </div>

                {/* ROW 1: FINANCE & CAPITAL */}
                <div>
                    <h4 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">财务与资金 (Finance & Capital)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                        <DashboardCard 
                            title="资金管理" 
                            sub="CASH & BANK" 
                            icon={Wallet} 
                            colorClass="bg-emerald-50" 
                            iconColor="text-emerald-600"
                            onClick={() => setActiveModal('TREASURY')}
                        />
                        <DashboardCard 
                            title="财务报表" 
                            sub="P&L REPORT" 
                            icon={FileBarChart} 
                            colorClass="bg-green-50" 
                            iconColor="text-green-600"
                            onClick={() => setActiveModal('REPORTS')}
                        />
                        <DashboardCard 
                            title="固定支出" 
                            sub="SUBSCRIPTIONS" 
                            icon={Banknote} 
                            colorClass="bg-orange-50" 
                            iconColor="text-orange-600"
                            onClick={() => setActiveModal('BILLS')}
                            alertCount={billAlertCount}
                        />
                        <DashboardCard 
                            title="应付账款" 
                            sub="ACCOUNTS PAYABLE" 
                            icon={CreditCard} 
                            colorClass="bg-rose-50" 
                            iconColor="text-rose-600"
                            onClick={() => setActiveModal('AP')}
                        />
                        <DashboardCard 
                            title="成本监控" 
                            sub="PRICE MONITOR" 
                            icon={TrendingUp} 
                            colorClass="bg-red-50" 
                            iconColor="text-red-600"
                            onClick={() => setActiveModal('PRICE_MONITOR')}
                        />
                    </div>
                </div>

                {/* ROW 2: HR & WORKFORCE */}
                <div>
                    <h4 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">人事与考勤 (HR & Workforce)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                        <DashboardCard 
                            title="HR 指挥中心" 
                            sub="人员档案 / 薪资" 
                            icon={Users} 
                            colorClass="bg-red-50" 
                            iconColor="text-red-600"
                            onClick={() => setActiveModal('HR')}
                        />
                        <DashboardCard 
                            title="考勤总控台" 
                            sub="Attendance Control" 
                            icon={Clock} 
                            colorClass="bg-indigo-50" 
                            iconColor="text-indigo-600"
                            onClick={() => setActiveModal('ATTENDANCE')}
                        />
                        <DashboardCard 
                            title="能力评测" 
                            sub="SKILL MATRIX" 
                            icon={Award} 
                            colorClass="bg-purple-50" 
                            iconColor="text-purple-600"
                            onClick={() => setActiveModal('ASSESSMENT')}
                        />
                        <DashboardCard 
                            title="排班缺席" 
                            sub="ROSTER" 
                            icon={CalendarOff} 
                            colorClass="bg-rose-50" 
                            iconColor="text-rose-500"
                            onClick={() => onNavigate('ROSTER')}
                            alertCount={absentCount}
                            alertColor="bg-orange-500"
                        />
                        <DashboardCard 
                            title="组织结构" 
                            sub="ORG STRUCTURE" 
                            icon={Layout} 
                            colorClass="bg-teal-50" 
                            iconColor="text-teal-600"
                            onClick={() => setActiveModal('ORG')}
                        />
                    </div>
                </div>

                {/* ROW 3: SUPPLY CHAIN & PRODUCT */}
                <div>
                    <h4 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">供应链与产品 (Supply & Product)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                        <DashboardCard 
                            title="智能订货" 
                            sub="SMART ORDER" 
                            icon={ShoppingCart} 
                            colorClass="bg-lime-50" 
                            iconColor="text-lime-600"
                            onClick={() => onNavigate('PROCUREMENT')}
                        />
                        <DashboardCard 
                            title="供应商" 
                            sub="PURCHASING" 
                            icon={Truck} 
                            colorClass="bg-blue-50" 
                            iconColor="text-blue-600"
                            onClick={() => onNavigate('SUPPLIER_CONTACTS')}
                        />
                        <DashboardCard 
                            title="库存总览" 
                            sub="STOCK VALUE" 
                            icon={Eye} 
                            colorClass="bg-purple-50" 
                            iconColor="text-purple-600"
                            onClick={() => onNavigate('INVENTORY_VIEW')}
                            alertCount={lowStockCount}
                        />
                        <DashboardCard 
                            title="翻译管理" 
                            sub="TRANSLATION" 
                            icon={Layout} 
                            colorClass="bg-orange-50" 
                            iconColor="text-orange-600"
                            onClick={() => setActiveModal('TRANSLATION')}
                        />
                        <DashboardCard 
                            title="智能菜谱" 
                            sub="SMART RECIPE" 
                            icon={Coffee} 
                            colorClass="bg-amber-50" 
                            iconColor="text-amber-600"
                            onClick={() => setActiveModal('MENU')}
                        />
                        <DashboardCard 
                            title="保修记录" 
                            sub="WARRANTY" 
                            icon={ShieldCheck} 
                            colorClass="bg-cyan-50" 
                            iconColor="text-cyan-600"
                            onClick={() => setActiveModal('WARRANTY')}
                        />
                    </div>
                </div>

                {/* ROW 4: EVENTS & PLANNING (MODERN UPGRADE) */}
                <div>
                    <h4 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">活动与计划 (Strategy & Planning)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                        <DashboardCard
                            title="决策投票"
                            sub="BOARDROOM VOTE"
                            icon={Vote}
                            colorClass="bg-black text-white"
                            iconColor="text-[#FFD700]"
                            onClick={() => setActiveModal('PLANNING')}
                        />
                        <DashboardCard
                            title="目标规划"
                            sub="OKRs & KPI"
                            icon={Target}
                            colorClass="bg-indigo-50"
                            iconColor="text-indigo-600"
                            onClick={() => setActiveModal('PLANNING')}
                        />
                        <DashboardCard
                            title="营销推广"
                            sub="CAMPAIGNS (ROI)"
                            icon={Megaphone}
                            colorClass="bg-pink-50"
                            iconColor="text-pink-600"
                            onClick={() => setActiveModal('PLANNING')}
                        />
                        <DashboardCard
                            title="节日活动"
                            sub="EVENTS CALENDAR"
                            icon={PartyPopper}
                            colorClass="bg-rose-50"
                            iconColor="text-rose-600"
                            onClick={() => setActiveModal('PLANNING')}
                        />
                    </div>
                </div>
            </div>

            {/* 2. DAILY OPERATIONS */}
            <div className="bg-[#F3F4F6] rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-8 border border-gray-200/60">
                <h3 className="font-black text-gray-500 text-sm mb-6 flex items-center gap-2 uppercase tracking-widest px-1">
                    <Box size={18} /> 日常运营 (Store Operations)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    <DashboardCard 
                        title="排队叫号" 
                        sub="QUEUE TV" 
                        icon={Armchair} 
                        colorClass="bg-white border-2 border-gray-100" 
                        iconColor="text-gray-600"
                        onClick={() => onNavigate('QUEUE')}
                    />
                    <DashboardCard 
                        title="库存盘点" 
                        sub="CHECK" 
                        icon={CheckSquare} 
                        colorClass="bg-blue-50" 
                        iconColor="text-blue-500"
                        onClick={() => onNavigate('INVENTORY_CHECK')}
                    />
                    <DashboardCard 
                        title="运营日志 (写)" 
                        sub="ADD LOG" 
                        icon={PenTool} 
                        colorClass="bg-orange-50" 
                        iconColor="text-orange-500"
                        onClick={() => onNavigate('LOGBOOK')}
                    />
                    <DashboardCard 
                        title="运营日志 (查)" 
                        sub="VIEW LOGS" 
                        icon={BookOpen} 
                        colorClass="bg-emerald-50" 
                        iconColor="text-emerald-500"
                        onClick={() => onNavigate('LOGBOOK_VIEW')}
                        alertCount={todayLogCount}
                        alertColor="bg-blue-500"
                    />
                    <DashboardCard 
                        title="SOP 稽查" 
                        sub="INSPECT" 
                        icon={ClipboardCheck} 
                        colorClass="bg-violet-50" 
                        iconColor="text-violet-500"
                        onClick={() => onNavigate('SOP_INSPECT')}
                    />
                </div>
            </div>

            {/* MODALS */}
            {activeModal === 'HR' && <HRSystem onClose={() => setActiveModal('NONE')} currentEmployee={currentEmployee} />}
            {activeModal === 'MENU' && <MenuManagement onClose={() => setActiveModal('NONE')} />}
            {activeModal === 'BILLS' && <RecurringBillsModule onClose={() => setActiveModal('NONE')} />}
            {activeModal === 'ORG' && <OrgChart onClose={() => setActiveModal('NONE')} />}
            {activeModal === 'REPORTS' && <FinancialReport onClose={() => setActiveModal('NONE')} />}
            {activeModal === 'ATTENDANCE' && <AttendanceConsole onClose={() => setActiveModal('NONE')} />}
            {activeModal === 'AP' && <AccountsPayableModule onClose={() => setActiveModal('NONE')} />}
            {activeModal === 'TREASURY' && <TreasuryModule onClose={() => setActiveModal('NONE')} />}
            {activeModal === 'WARRANTY' && <WarrantyModule onClose={() => setActiveModal('NONE')} />}
            {activeModal === 'PLANNING' && <EventsPlanningModule onClose={() => setActiveModal('NONE')} currentEmployee={currentEmployee} />}
            {activeModal === 'PRICE_MONITOR' && <PriceMonitorModule onClose={() => setActiveModal('NONE')} />}
            {activeModal === 'ASSESSMENT' && <EmployeeAssessmentModule onClose={() => setActiveModal('NONE')} currentEmployee={currentEmployee} />}
            {activeModal === 'TRANSLATION' && <TranslationManager onClose={() => setActiveModal('NONE')} />}
        </div>
    );
};