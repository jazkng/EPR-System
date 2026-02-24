
// components/AdminDashboard.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, BookOpen, CalendarOff, ClipboardCheck, Package, ArrowLeft, Truck, Armchair, Eye, CheckSquare, Clock, ShoppingCart, Utensils, Award } from 'lucide-react';
import { StoreConfig, AppModule, Employee } from '../types';

// --- NEW GENERIC IMPORTS ---
import { SettlementModule } from './features/SettlementModule';
import { RosterModule } from './features/RosterModule';
import { LogbookModule } from './features/LogbookModule';
import { InventoryModule } from './features/InventoryModule';
import { SOPInspection } from './features/SOPInspection';
import { QueueManager } from './features/QueueManager';
import { SupplierModule } from './features/SupplierModule';
import { AttendanceConsole } from './features/AttendanceConsole';
import { ProcurementModule } from './features/ProcurementModule';
import { MenuManagement } from './features/MenuManagement'; 
import { EmployeeAssessmentModule } from './features/EmployeeAssessmentModule'; // NEW IMPORT

interface ManagerDashboardProps {
    onBack?: () => void; 
    allowedModules?: AppModule[]; 
    initialTab?: 'SETTLEMENT' | 'ROSTER' | 'LOGBOOK' | 'LOGBOOK_VIEW' | 'SOP_INSPECT' | 'INVENTORY_CHECK' | 'INVENTORY_VIEW' | 'SUPPLIER_CONTACTS' | 'QUEUE' | 'ATTENDANCE_CONSOLE' | 'PROCUREMENT' | 'MENU_MANAGEMENT' | 'ASSESSMENT';
    isSingleMode?: boolean;
    onOpenTV?: () => void;
    currentEmployee?: Employee; 
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ onBack, allowedModules, initialTab, isSingleMode = false, onOpenTV, currentEmployee }) => {
  const [activeTab, setActiveTab] = useState<'SETTLEMENT' | 'ROSTER' | 'LOGBOOK' | 'LOGBOOK_VIEW' | 'SOP_INSPECT' | 'INVENTORY_CHECK' | 'INVENTORY_VIEW' | 'SUPPLIER_CONTACTS' | 'QUEUE' | 'ATTENDANCE_CONSOLE' | 'PROCUREMENT' | 'MENU_MANAGEMENT' | 'ASSESSMENT'>('SETTLEMENT');
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({ 
      businessDayCutoff: 4,
      timeZoneOffset: 8,
      googleScriptUrl: 'https://script.google.com/macros/s/AKfycbzpnQGRmBV8y2HoL1AlguZhhsJCHxGLwMAB-lBHAm67FoFZE69Io_gGTK8GCHOzcwDXWA/exec' 
  });

  // State to hold a target stock ID for deep linking navigation
  const [targetStockId, setTargetStockId] = useState('');

  // Load Store Config
  useEffect(() => {
    const savedConfig = localStorage.getItem('kepong_erp_config');
    if (savedConfig) setStoreConfig(JSON.parse(savedConfig));
  }, []);

  // Determine available tabs
  const availableTabs = useMemo(() => {
     const tabs: { key: string, label: string, icon: React.ReactNode }[] = [];
     
     const showAll = !allowedModules || allowedModules.length === 0;

     if (showAll || allowedModules?.includes('QUEUE_MANAGER')) {
         tabs.push({ key: 'QUEUE', label: '排队取号', icon: <Armchair size={18} /> });
     }
     if (showAll || allowedModules?.includes('SETTLEMENT')) {
         tabs.push({ key: 'SETTLEMENT', label: '每日结算', icon: <Calculator size={18} /> });
     }
     if (showAll || allowedModules?.includes('ROSTER') || allowedModules?.includes('ROSTER_KITCHEN') || allowedModules?.includes('ROSTER_FLOOR')) {
         tabs.push({ key: 'ROSTER', label: '排班缺席', icon: <CalendarOff size={18} /> });
     }
     if (showAll || allowedModules?.includes('ATTENDANCE_CONSOLE')) {
         tabs.push({ key: 'ATTENDANCE_CONSOLE', label: '考勤总控', icon: <Clock size={18} /> });
     }
     if (showAll || allowedModules?.includes('ASSESSMENT')) {
         tabs.push({ key: 'ASSESSMENT', label: '能力评测', icon: <Award size={18} /> });
     }
     if (showAll || allowedModules?.includes('PROCUREMENT')) {
         tabs.push({ key: 'PROCUREMENT', label: '智能订货', icon: <ShoppingCart size={18} /> });
     }
     if (showAll || allowedModules?.includes('MENU_MANAGEMENT')) {
         tabs.push({ key: 'MENU_MANAGEMENT', label: '智能菜谱', icon: <Utensils size={18} /> });
     }
     if (showAll || allowedModules?.includes('LOGBOOK')) {
         tabs.push({ key: 'LOGBOOK', label: '运营日志', icon: <BookOpen size={18} /> });
     }
     if (showAll || allowedModules?.includes('SOP_INSPECT')) {
         tabs.push({ key: 'SOP_INSPECT', label: 'SOP 稽查', icon: <ClipboardCheck size={18} /> });
     }
     // INVENTORY LOGIC REFINED
     if (showAll || allowedModules?.some(m => m.startsWith('INVENTORY'))) {
         // Everyone with any inventory module sees Check
         tabs.push({ key: 'INVENTORY_CHECK', label: '库存盘点', icon: <CheckSquare size={18} /> });
         
         // Only Boss (showAll) sees View/Master. Staff with restricted modules CANNOT see View.
         if (showAll) {
             tabs.push({ key: 'INVENTORY_VIEW', label: '库存总览', icon: <Eye size={18} /> });
         }
     }
     if (showAll || allowedModules?.includes('SUPPLIER_CONTACTS')) {
         tabs.push({ key: 'SUPPLIER_CONTACTS', label: '供应商', icon: <Truck size={18} /> });
     }
     return tabs;
  }, [allowedModules]);

  useEffect(() => {
      // Force tab switch if initialTab is provided, regardless of allowedModules (Boss override)
      if (initialTab) {
          setActiveTab(initialTab);
      } else if (availableTabs.length > 0 && !availableTabs.find(t => t.key === activeTab)) {
          setActiveTab(availableTabs[0].key as any);
      }
  }, [availableTabs, initialTab]);

  // Dynamic Title based on Active Tab (for Single Mode)
  const getPageTitle = () => {
      switch(activeTab) {
          case 'SETTLEMENT': return '每日结算 (Settlement)';
          case 'ROSTER': return '排班管理 (Roster)';
          case 'LOGBOOK': return '运营日志 (操作模式)';
          case 'LOGBOOK_VIEW': return '运营日志 (查看模式)';
          case 'INVENTORY_CHECK': return '库存盘点 (Inventory Check)';
          case 'INVENTORY_VIEW': return '库存总览 (Inventory Master)';
          case 'SOP_INSPECT': return 'SOP 进度稽查 (Inspection)';
          case 'SUPPLIER_CONTACTS': return '供应商通讯录 (Suppliers)';
          case 'QUEUE': return '排队叫号系统 (Queue)';
          case 'ATTENDANCE_CONSOLE': return '考勤指挥台 (Attendance Console)';
          case 'PROCUREMENT': return '智能订货系统 (Procurement)';
          case 'MENU_MANAGEMENT': return '智能菜谱管理 (Menu)';
          case 'ASSESSMENT': return '员工能力评测 (Skill Matrix)';
          default: return '管理控制台';
      }
  }

  const handleOpenTVWrapper = () => {
      if (onOpenTV) onOpenTV();
      else {
          // If not provided, try to open in a new window with mode=tv
          const url = new URL(window.location.href);
          url.searchParams.set('mode', 'tv');
          window.open(url.toString(), '_blank');
      }
  }

  // --- NAVIGATION HANDLER ---
  const handleNavigateToStock = (stockId: string) => {
      setTargetStockId(stockId);
      // Prefer MASTER view if available, else CHECK view
      if (availableTabs.some(t => t.key === 'INVENTORY_VIEW')) {
          setActiveTab('INVENTORY_VIEW');
      } else if (availableTabs.some(t => t.key === 'INVENTORY_CHECK')) {
          setActiveTab('INVENTORY_CHECK');
      } else {
          alert("您没有权限查看库存模块");
      }
  };

  // --- GENERIC MODULE EXIT HANDLER ---
  // Fixes the issue where closing a module redirects to Settlement incorrectly
  const handleModuleExit = () => {
      if (onBack) {
          // If a parent back handler exists (e.g., return to Grid), use it
          onBack(); 
      } else {
          // Otherwise, stay in the dashboard but switch to a safe default tab
          // Prioritize Settlement if available, otherwise the first available tab
          const safeTab = availableTabs.find(t => t.key === 'SETTLEMENT') 
              ? 'SETTLEMENT' 
              : (availableTabs[0]?.key || 'SETTLEMENT');
          
          if (activeTab !== safeTab) setActiveTab(safeTab as any);
      }
  };

  return (
    <div className="max-w-5xl mx-auto pb-32">
      {/* HEADER */}
      <div className="bg-[#1A1A1A] text-white p-4 md:p-6 sticky top-[64px] md:top-[72px] z-30 shadow-lg border-b-4 border-[#FFD700]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-3">
            {onBack && (
                 <button onClick={onBack} className="p-1.5 md:p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">
                     <ArrowLeft size={18} className="md:w-5 md:h-5" />
                 </button>
            )}
            <div>
                <h2 className="text-lg md:text-xl font-serif font-bold text-[#FFD700] tracking-wide">
                    {isSingleMode ? getPageTitle() : '管理层控制台'}
                </h2>
                {!isSingleMode && <p className="text-[10px] md:text-xs text-gray-400 font-mono tracking-widest uppercase">MANAGEMENT CONSOLE</p>}
            </div>
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION - HIDDEN IN SINGLE MODE */}
      {!isSingleMode && availableTabs.length > 0 ? (
        <div className="flex p-3 md:p-4 gap-2 overflow-x-auto bg-[#F5F5F5] border-b border-gray-200 scrollbar-hide">
            {availableTabs.map(tab => (
                <button 
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)} 
                    className={`flex-none min-w-[80px] md:min-w-[100px] py-2.5 md:py-3 px-2 rounded-lg flex flex-col items-center justify-center gap-1 md:gap-1.5 font-bold transition-all active:scale-95 text-[10px] md:text-xs ${activeTab === tab.key ? 'bg-[#1A1A1A] text-[#FFD700] shadow-md border-b-4 border-[#C70000]' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                >
                    {tab.icon} <span className="truncate w-full text-center">{tab.label}</span>
                </button>
            ))}
        </div>
      ) : (
        // Spacer for Single Mode
        isSingleMode && <div className="h-6 bg-gray-50"></div>
      )}

      {/* Empty State if no modules */}
      {!isSingleMode && availableTabs.length === 0 && (
        <div className="p-8 text-center text-gray-400">没有可访问的功能模块</div>
      )}

      {/* TAB CONTENT (ROUTER) */}
      <div className="min-h-[50vh]">
         {activeTab === 'SETTLEMENT' && (
             <SettlementModule 
                storeConfig={storeConfig} 
                isStandalone={isSingleMode} // Embed if not single mode
                onClose={onBack} // Optional: Close button for Single Mode
             />
         )}
         {activeTab === 'ROSTER' && <RosterModule onClose={handleModuleExit} allowedModules={allowedModules} />}
         {activeTab === 'ATTENDANCE_CONSOLE' && <AttendanceConsole onClose={handleModuleExit} />}
         {activeTab === 'LOGBOOK' && <LogbookModule viewOnly={false} currentEmployee={currentEmployee} />}
         {activeTab === 'LOGBOOK_VIEW' && <LogbookModule viewOnly={true} currentEmployee={currentEmployee} />}
         {activeTab === 'PROCUREMENT' && (
             <ProcurementModule onClose={handleModuleExit} />
         )}
         {activeTab === 'MENU_MANAGEMENT' && (
             <MenuManagement onClose={handleModuleExit} isModal={false} />
         )}
         {activeTab === 'INVENTORY_CHECK' && (
             <InventoryModule 
                allowedModules={allowedModules} 
                employee={currentEmployee} 
                lockedMode="CHECK" 
                initialSearchTerm={targetStockId} 
             />
         )}
         {/* UNLOCK MASTER MODE FOR VIEW TAB */}
         {activeTab === 'INVENTORY_VIEW' && (
             <InventoryModule 
                allowedModules={allowedModules} 
                employee={currentEmployee} 
                initialMode="MASTER" 
                initialSearchTerm={targetStockId}
             />
         )}
         {activeTab === 'SOP_INSPECT' && <SOPInspection />}
         {activeTab === 'SUPPLIER_CONTACTS' && (
             <SupplierModule 
                isModal={false} 
                onNavigateToStock={handleNavigateToStock} 
             />
         )}
         {activeTab === 'QUEUE' && <QueueManager onOpenTV={handleOpenTVWrapper} />}
         {activeTab === 'ASSESSMENT' && <EmployeeAssessmentModule onClose={handleModuleExit} currentEmployee={currentEmployee} />}
      </div>
    </div>
  );
};
