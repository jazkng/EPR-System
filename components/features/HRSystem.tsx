
import React, { useState, useEffect } from 'react';
import { Users, User, DollarSign, Briefcase, X } from 'lucide-react';
import { Employee, RoleDefinition, RoleGuide } from '../../types';
import { DEFAULT_ROLE_GUIDES, DEFAULT_ROLES, ROLE_SOP_DETAILS } from '../constants';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';

// 引入拆分后的模块
import { HRProfiles } from './hr/HRProfiles';
import { HRPayroll } from './hr/HRPayroll';
import { HRRoleStandards } from './hr/HRRoleStandards';

interface HRSystemProps {
    onClose: () => void;
    currentEmployee?: Employee | null;
}

export const HRSystem: React.FC<HRSystemProps> = ({ onClose, currentEmployee }) => {
    const [activeTab, setActiveTab] = useState<'PROFILES' | 'PAYROLL' | 'ROLES'>('PROFILES');
    
    // 全局数据状态
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
    const [roleGuides, setRoleGuides] = useState<Record<string, RoleGuide>>(DEFAULT_ROLE_GUIDES);
    const [roleSops, setRoleSops] = useState<Record<string, any>>(ROLE_SOP_DETAILS);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        // 1. Load Employees from Cloud
        const cloudStaff = await DataManager.getEmployees();
        setEmployees(cloudStaff);

        // 2. Load Configs (Local is fine for configs, or could be cloud too)
        const savedRoles = localStorage.getItem('kepong_erp_roles');
        if (savedRoles) setRoleDefinitions(JSON.parse(savedRoles));
        else setRoleDefinitions(DEFAULT_ROLES);

        const savedGuides = localStorage.getItem('kepong_erp_role_guides');
        if (savedGuides) setRoleGuides(JSON.parse(savedGuides));

        const savedSops = localStorage.getItem('kepong_erp_sop_templates');
        if (savedSops) setRoleSops(JSON.parse(savedSops));
    };

    const handleSaveEmployees = (newList: Employee[]) => {
        setEmployees(newList);
        // Note: Individual saving is handled inside HRProfiles via DataManager
    };

    const handleSaveRoleConfig = (guides: Record<string, RoleGuide>, sops: Record<string, any>) => {
        setRoleGuides(guides);
        setRoleSops(sops);
        localStorage.setItem('kepong_erp_role_guides', JSON.stringify(guides));
        localStorage.setItem('kepong_erp_sop_templates', JSON.stringify(sops));
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            {/* Mobile Optimization: Full width/height, no rounded corners on mobile */}
            <div className="bg-white w-full h-full md:max-w-7xl md:h-[95vh] md:rounded-[2rem] flex flex-col overflow-hidden shadow-2xl relative">
                {/* 顶栏 */}
                <div className="bg-[#1A1A1A] p-4 text-white flex justify-between items-center shrink-0 border-b-4 border-[#FFD700] safe-area-top">
                    <div>
                        <h3 className="font-black text-lg flex items-center gap-2">
                            <Users className="text-[#FFD700]"/> <span className="hidden md:inline">御膳智控 · </span>人事中心
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <ModuleGuideButton module="HR" />
                        <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={20}/></button>
                    </div>
                </div>

                {/* 导航 */}
                <div className="flex bg-gray-100 border-b shrink-0 overflow-x-auto scrollbar-hide">
                    <button 
                        onClick={() => setActiveTab('PROFILES')} 
                        className={`flex-1 py-3 md:py-4 px-2 text-xs md:text-sm font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'PROFILES' ? 'bg-white text-black border-b-4 border-[#8B0000]' : 'text-gray-500'}`}
                    >
                        <User size={16}/> 员工档案
                    </button>
                    <button 
                        onClick={() => setActiveTab('PAYROLL')} 
                        className={`flex-1 py-3 md:py-4 px-2 text-xs md:text-sm font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'PAYROLL' ? 'bg-white text-black border-b-4 border-[#8B0000]' : 'text-gray-500'}`}
                    >
                        <DollarSign size={16}/> 薪资结算
                    </button>
                    <button 
                        onClick={() => setActiveTab('ROLES')} 
                        className={`flex-1 py-3 md:py-4 px-2 text-xs md:text-sm font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'ROLES' ? 'bg-white text-black border-b-4 border-[#8B0000]' : 'text-gray-500'}`}
                    >
                        <Briefcase size={16}/> 职位标准
                    </button>
                </div>

                {/* 内容区域 */}
                <div className="flex-grow overflow-hidden relative bg-[#F5F7FA]">
                    {activeTab === 'PROFILES' && (
                        <HRProfiles employees={employees} onSave={handleSaveEmployees} currentBossId={currentEmployee?.id} />
                    )}
                    {activeTab === 'PAYROLL' && (
                        <HRPayroll employees={employees} />
                    )}
                    {activeTab === 'ROLES' && (
                        <HRRoleStandards 
                            roleDefinitions={roleDefinitions} 
                            roleGuides={roleGuides} 
                            roleSops={roleSops}
                            employees={employees} // Passed employees here
                            onSave={handleSaveRoleConfig}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
