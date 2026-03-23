import React, { useState, useEffect } from 'react';
import { isFirebaseInitialized } from './firebaseConfig';
import { UserRole, StaffRole, Employee } from './types';
import { Login } from './components/Login';
import { BossDashboard } from './components/BossDashboard';
import { ManagerDashboard } from './components/AdminDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { QueueDisplay } from './components/QueueDisplay';
import { LogOut, Menu, Settings, Calculator } from 'lucide-react';
import { StoreConfigModal } from './components/features/StoreConfigModal';
import { WhatsNewModal } from './components/ui/WhatsNewModal';
import { DataManager } from './utils/dataManager'; 
import { APP_VERSION } from './constants/versionHistory';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserRole | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [bossTab, setBossTab] = useState<string | null>(null);
  const [isTVMode, setIsTVMode] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [portalMode, setPortalMode] = useState<'STAFF' | 'BOSS'>('STAFF');
  
  // New State for Version Modal
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  if (!isFirebaseInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F8] p-4 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border-2 border-[#8B0000]/10">
          <div className="w-20 h-20 bg-[#8B0000]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Settings className="text-[#8B0000] w-10 h-10 animate-spin-slow" />
          </div>
          <h1 className="text-2xl font-black text-[#8B0000] mb-4 font-serif">配置未完成 (Config Required)</h1>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Firebase 数据库配置未找到。请在 AI Studio 的 <span className="font-bold text-[#8B0000]">Settings</span> 菜单中设置以下环境变量：
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left font-mono text-xs text-gray-500 mb-6 border border-gray-200 overflow-x-auto">
            <ul className="space-y-1">
              <li>• VITE_FIREBASE_API_KEY</li>
              <li>• VITE_FIREBASE_AUTH_DOMAIN</li>
              <li>• VITE_FIREBASE_PROJECT_ID</li>
              <li>• VITE_FIREBASE_STORAGE_BUCKET</li>
              <li>• VITE_FIREBASE_MESSAGING_SENDER_ID</li>
              <li>• VITE_FIREBASE_APP_ID</li>
            </ul>
          </div>
          <p className="text-sm text-gray-400 italic">
            设置完成后，请刷新页面。
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('portal') === 'boss') {
          setPortalMode('BOSS');
      } else if (params.get('mode') === 'tv') {
          setIsTVMode(true);
      }

      const savedRole = localStorage.getItem('kepong_erp_session_role');
      const savedEmployee = localStorage.getItem('kepong_erp_session_employee');

      if (savedRole) {
          setCurrentUser(savedRole as UserRole);
          if (savedEmployee) {
              try {
                  const parsedEmp = JSON.parse(savedEmployee);
                  setCurrentEmployee(parsedEmp);

                  DataManager.getEmployees().then(employees => {
                      const freshData = employees.find(e => e.id === parsedEmp.id);
                      if (freshData) {
                          const modulesChanged = JSON.stringify(freshData.allowedModules) !== JSON.stringify(parsedEmp.allowedModules);
                          const roleChanged = freshData.role !== parsedEmp.role;
                          if (modulesChanged || roleChanged) {
                              console.log("🔄 Permissions updated from cloud. Syncing...");
                              setCurrentEmployee(freshData);
                              localStorage.setItem('kepong_erp_session_employee', JSON.stringify(freshData));
                          }
                      }
                  }).catch(err => console.error("Background sync failed", err));
              } catch (e) {
                  console.error("Failed to restore employee session", e);
              }
          }
          // Check Version after restoring session
          checkVersion();
      }
  }, []);

  const checkVersion = () => {
      const lastSeenVersion = localStorage.getItem('klk_last_seen_version');
      if (lastSeenVersion !== APP_VERSION) {
          setTimeout(() => setShowWhatsNew(true), 1000);
      }
  };

  const handleCloseWhatsNew = () => {
      setShowWhatsNew(false);
      localStorage.setItem('klk_last_seen_version', APP_VERSION);
  };

  const handleSwitchPortal = (mode: 'STAFF' | 'BOSS') => {
      setPortalMode(mode);
      const url = new URL(window.location.href);
      if (mode === 'BOSS') {
          url.searchParams.set('portal', 'boss');
      } else {
          url.searchParams.delete('portal');
      }
      window.history.pushState({}, '', url);
  };

  if (isTVMode) {
      return <QueueDisplay />;
  }

  const handleLogin = (role: UserRole, employee?: Employee) => {
    setCurrentUser(role);
    localStorage.setItem('kepong_erp_session_role', role);
    if (employee) {
      setCurrentEmployee(employee);
      localStorage.setItem('kepong_erp_session_employee', JSON.stringify(employee));
    } else {
      setCurrentEmployee(null);
      localStorage.removeItem('kepong_erp_session_employee');
    }
    setBossTab(null);
    checkVersion();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentEmployee(null);
    setBossTab(null);
    localStorage.removeItem('kepong_erp_session_role');
    localStorage.removeItem('kepong_erp_session_employee');
  };

  const getRoleName = (role: UserRole) => {
    switch (role) {
      case UserRole.BOSS: 
        return currentEmployee ? `${currentEmployee.name} (Owner)` : '老板 (Owner)';
      case UserRole.MANAGEMENT: return '管理层 (Management)';
      case UserRole.STAFF: 
        return currentEmployee ? `${currentEmployee.name} (ID: ${currentEmployee.id})` : '员工 (Staff)';
      default: return '';
    }
  };

  const handleOpenTV = () => {
      setIsTVMode(true);
  };

  return (
    <div className="min-h-screen flex flex-col relative font-sans bg-[#FFF8F8]">
      {currentUser && (
        <header className="bg-gradient-to-r from-[#8B0000] via-[#A00000] to-[#8B0000] text-[#FFD700] px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] md:px-6 md:pb-4 md:pt-[max(env(safe-area-inset-top),1rem)] flex justify-between items-center shadow-[0_4px_14px_0_rgba(139,0,0,0.3)] z-50 sticky top-0 border-b border-[#FFD700]/30 relative">
          {/* ✅ 背景纹理层：确保 pointer-events-none 生效，不遮挡按钮 */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }}></div>
          
          <div className="flex items-center gap-3 md:gap-4 relative z-10">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-[#8B0000] rounded-full p-1 shadow-lg border-2 border-[#FFD700] flex items-center justify-center overflow-hidden shrink-0">
               <img src="https://i.imgur.com/ex06Jva.png" alt="Logo" className="w-full h-full object-contain hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col justify-center">
               <h1 className="font-black text-lg md:text-2xl tracking-widest text-[#FFD700] font-serif drop-shadow-md leading-tight">御膳智控 <span className="text-[10px] md:text-sm opacity-80 font-sans tracking-normal font-normal text-white">ERP</span></h1>
               <span className="text-[10px] md:text-xs text-white/80 font-bold tracking-widest uppercase block truncate max-w-[120px] md:max-w-none">{getRoleName(currentUser)}</span>
            </div>
          </div>
          
          <div className="relative z-10 flex items-center gap-1.5 md:gap-2">
            {currentUser === UserRole.BOSS && (
                <>
                    <button onClick={() => setBossTab('SETTLEMENT')} className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold text-[#FFD700] hover:text-white bg-black/20 hover:bg-black/40 px-3 py-2 md:px-4 md:py-2 rounded-full transition-all active:scale-95 border border-white/10">
                        <Calculator size={14} className="md:w-4 md:h-4" />
                        <span className="hidden md:inline">每日结算 (Settlement)</span>
                        <span className="md:hidden">结算</span>
                    </button>
                    <button onClick={() => setIsConfigOpen(true)} className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 text-white/80 hover:text-[#FFD700] bg-black/20 hover:bg-black/40 rounded-full transition-all active:scale-95 border border-white/10" title="系统设置 (Config)">
                        <Settings size={16} className="md:w-[18px] md:h-[18px]" />
                    </button>
                    <div className="h-5 md:h-6 w-px bg-white/20 mx-0.5 md:mx-1"></div>
                </>
            )}

            <button onClick={handleLogout} className="flex items-center justify-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold text-white/80 hover:text-[#FFD700] bg-black/20 hover:bg-black/40 px-3 py-2 md:px-4 md:py-2 rounded-full transition-all active:scale-95 border border-white/10">
                <span className="hidden sm:inline">退出 (Logout)</span>
                <LogOut size={14} className="md:w-4 md:h-4" />
            </button>
          </div>
        </header>
      )}

      <main className="flex-grow">
        {!currentUser && <Login onLogin={handleLogin} portalMode={portalMode} onSwitchPortal={handleSwitchPortal} />}
        
        {currentUser === UserRole.BOSS && (
           <>
               {!bossTab 
                 ? <BossDashboard onNavigate={(tab) => setBossTab(tab)} currentEmployee={currentEmployee} onOpenConfig={() => setIsConfigOpen(true)} />
                 : <ManagerDashboard initialTab={bossTab as any} onBack={() => setBossTab(null)} isSingleMode={true} onOpenTV={handleOpenTV} currentEmployee={currentEmployee} />
               }
               <StoreConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
           </>
        )}

        {currentUser === UserRole.MANAGEMENT && currentEmployee && (
          <StaffDashboard employee={currentEmployee} />
        )}
        
        {currentUser === UserRole.STAFF && currentEmployee && (
          <StaffDashboard employee={currentEmployee} />
        )}

        {/* Global What's New Modal */}
        <WhatsNewModal isOpen={showWhatsNew} onClose={handleCloseWhatsNew} />
      </main>
    </div>
  );
}