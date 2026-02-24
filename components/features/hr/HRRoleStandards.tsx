
import React, { useState, useMemo } from 'react';
import { Briefcase, BookOpen, Sparkles, AlertOctagon, Save, RotateCcw, ChevronRight, Layers, ClipboardList, ShieldCheck, Target, ListChecks, Sun, Moon, Plus, Trash2, List, ArrowLeft, X, ChevronDown, ChevronUp, User } from 'lucide-react';
import { RoleDefinition, RoleGuide, Employee, SOPItem } from '../../../types';
import { DEFAULT_ROLE_GUIDES, ROLE_SOP_DETAILS } from '../../constants';
import { mapRoleToCode } from '../../utils';
import { DataManager } from '../../../utils/dataManager';

interface HRRoleStandardsProps {
    roleDefinitions: RoleDefinition[];
    roleGuides: Record<string, RoleGuide>;
    roleSops: Record<string, any>;
    employees: Employee[]; // Passed down to show individual options
    onSave: (guides: Record<string, RoleGuide>, sops: Record<string, any>) => void;
}

type SelectionType = 'ROLE' | 'EMPLOYEE';

export const HRRoleStandards: React.FC<HRRoleStandardsProps> = ({ roleDefinitions, roleGuides, roleSops, employees, onSave }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectionType, setSelectionType] = useState<SelectionType>('ROLE');
    
    // UI State for Accordion
    const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});

    const [draftGuide, setDraftGuide] = useState<RoleGuide | null>(null);
    const [draftSop, setDraftSop] = useState<any>(null);

    // Helpers to identify current selection
    const selectedRoleDef = selectionType === 'ROLE' ? roleDefinitions.find(r => r.id === selectedId) : null;
    const selectedEmployee = selectionType === 'EMPLOYEE' ? employees.find(e => e.id === selectedId) : null;
    
    const toggleRoleExpand = (roleId: string) => {
        setExpandedRoles(prev => ({ ...prev, [roleId]: !prev[roleId] }));
    };

    const handleSelectRole = (role: RoleDefinition) => {
        setSelectedId(role.id);
        setSelectionType('ROLE');
        
        // Load Global Config
        const guide = roleGuides[role.title] || DEFAULT_ROLE_GUIDES[role.title];
        const sanitizedGuide = {
            ...guide,
            employeeRules: guide.employeeRules || [],
            salaryRange: guide.salaryRange || { min: 1800, max: 2500 }
        };
        const srcCode = mapRoleToCode(role.title);
        const sop = roleSops[srcCode] || { start: { title: 'Opening', tasks: [] }, end: { title: 'Closing', tasks: [] } };
        
        setDraftGuide(JSON.parse(JSON.stringify(sanitizedGuide)));
        setDraftSop(JSON.parse(JSON.stringify(sop)));
    };

    const handleSelectEmployee = (emp: Employee, parentRole: RoleDefinition) => {
        setSelectedId(emp.id);
        setSelectionType('EMPLOYEE');

        // Logic: Try load Custom, else Fallback to Role Default
        let guide = emp.customGuide;
        let sop = emp.customSop;

        if (!guide) {
            guide = roleGuides[parentRole.title] || DEFAULT_ROLE_GUIDES[parentRole.title];
        }
        if (!sop) {
            const srcCode = mapRoleToCode(parentRole.title);
            sop = roleSops[srcCode] || { start: { title: 'Opening', tasks: [] }, end: { title: 'Closing', tasks: [] } };
        }

        // Sanitize
        const sanitizedGuide = {
            ...guide,
            employeeRules: guide?.employeeRules || [],
            salaryRange: guide?.salaryRange || { min: 0, max: 0 }
        };

        setDraftGuide(JSON.parse(JSON.stringify(sanitizedGuide)));
        setDraftSop(JSON.parse(JSON.stringify(sop)));
    };

    const handleSave = async () => {
        if (!draftGuide || !draftSop) return;

        if (selectionType === 'ROLE' && selectedRoleDef) {
            // Save Global
            const updatedGuides = { ...roleGuides, [selectedRoleDef.title]: draftGuide };
            const updatedSops = { ...roleSops, [mapRoleToCode(selectedRoleDef.title)]: draftSop };
            
            await DataManager.saveRoleConfig(updatedGuides, updatedSops);
            onSave(updatedGuides, updatedSops);
            alert(`✅ [${selectedRoleDef.title}] 全局标准已同步`);
        } 
        else if (selectionType === 'EMPLOYEE' && selectedEmployee) {
            // Save Individual
            const updatedEmployee: Employee = {
                ...selectedEmployee,
                customGuide: draftGuide,
                customSop: draftSop
            };
            await DataManager.saveEmployee(updatedEmployee);
            // We need to refresh local list? HRSystem parent handles refresh via onSave usually used for global config. 
            // Here we might need to alert user or rely on DataManager fetching fresh next time.
            alert(`✅ [${selectedEmployee.name}] 的个人标准已保存`);
        }
    };

    const handleResetIndividual = async () => {
        if (selectionType !== 'EMPLOYEE' || !selectedEmployee) return;
        if (!confirm(`确定要移除 ${selectedEmployee.name} 的个人定制，恢复为职位通用标准吗？`)) return;

        const updatedEmployee: Employee = {
            ...selectedEmployee,
            customGuide: undefined,
            customSop: undefined
        };
        await DataManager.saveEmployee(updatedEmployee);
        
        // Reload default from parent role (we need to find it)
        const parentRole = roleDefinitions.find(r => r.title === selectedEmployee.role);
        if (parentRole) {
            handleSelectEmployee(updatedEmployee, parentRole); // Reload with cleared data (which triggers fallback)
        }
        alert("✅ 已恢复为通用标准");
    };

    const handleResetGlobal = async () => {
        if (!confirm("确定要重置所有职位标准吗？\n注意：这不会影响已设置个人标准的员工。")) return;
        await DataManager.saveRoleConfig(DEFAULT_ROLE_GUIDES, ROLE_SOP_DETAILS);
        onSave(DEFAULT_ROLE_GUIDES, ROLE_SOP_DETAILS);
        setSelectedId(null);
    };

    // Helper to edit tasks in draft
    const addTask = (type: 'start' | 'end') => {
        const newTask = { label: '', standard: '', why: '' };
        setDraftSop({ ...draftSop, [type]: { ...draftSop[type], tasks: [...(draftSop[type]?.tasks || []), newTask] } });
    };
    const removeTask = (type: 'start' | 'end', index: number) => {
        const newTasks = [...draftSop[type].tasks];
        newTasks.splice(index, 1);
        setDraftSop({ ...draftSop, [type]: { ...draftSop[type], tasks: newTasks } });
    };
    const updateTask = (type: 'start' | 'end', index: number, field: string, val: string) => {
        const newTasks = [...draftSop[type].tasks];
        newTasks[index] = { ...newTasks[index], [field]: val };
        setDraftSop({ ...draftSop, [type]: { ...draftSop[type], tasks: newTasks } });
    };

    const getEmployeeMatches = (roleTitle: string) => {
        // Simple string matching, usually good enough. 
        // Can be improved with mapRoleToCode if needed but role title in DB usually matches definitions.
        return employees.filter(e => !e.isArchived && e.role === roleTitle);
    }

    return (
        <div className="flex h-full w-full overflow-hidden bg-gray-50 flex-col md:flex-row min-h-0">
            {/* Sidebar (List) */}
            <div className={`w-full md:w-80 bg-white border-r flex-col shrink-0 h-full min-h-0 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b flex justify-between items-center bg-white shrink-0">
                    <div>
                        <h3 className="font-black text-sm text-[#1A1A1A] uppercase tracking-widest">职位标准 (Standards)</h3>
                        <p className="text-[10px] text-gray-400 font-bold">可针对个人单独设置</p>
                    </div>
                    <button onClick={handleResetGlobal} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="重置全局"><RotateCcw size={16}/></button>
                </div>
                <div className="flex-grow overflow-y-auto p-2 space-y-2 pb-40">
                    {roleDefinitions.map(role => {
                        const roleStaff = getEmployeeMatches(role.title);
                        const isExpanded = expandedRoles[role.id];
                        const isSelectedRole = selectionType === 'ROLE' && selectedId === role.id;

                        return (
                            <div key={role.id} className="space-y-1">
                                {/* Role Header */}
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => toggleRoleExpand(role.id)} 
                                        className="p-2 text-gray-400 hover:text-black rounded"
                                    >
                                        {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                    </button>
                                    <button 
                                        onClick={() => handleSelectRole(role)} 
                                        className={`flex-grow text-left p-3 rounded-xl border transition-all active:scale-[0.98] ${isSelectedRole ? 'border-[#8B0000] bg-[#FFF5F5] text-[#8B0000] shadow-sm' : 'border-transparent hover:bg-gray-50 bg-white'}`}
                                    >
                                        <div className="font-black text-xs flex items-center justify-between">
                                            <span className="flex items-center gap-2"><Briefcase size={14}/> {role.title}</span>
                                            {roleStaff.length > 0 && <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[9px]">{roleStaff.length}</span>}
                                        </div>
                                    </button>
                                </div>

                                {/* Employee Children */}
                                {isExpanded && roleStaff.length > 0 && (
                                    <div className="pl-8 space-y-1 border-l-2 border-gray-100 ml-4">
                                        {roleStaff.map(emp => {
                                            const isSelectedEmp = selectionType === 'EMPLOYEE' && selectedId === emp.id;
                                            const hasCustom = !!emp.customSop;
                                            
                                            return (
                                                <button 
                                                    key={emp.id} 
                                                    onClick={() => handleSelectEmployee(emp, role)}
                                                    className={`w-full text-left p-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${isSelectedEmp ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                                >
                                                    <span className="flex items-center gap-2"><User size={12}/> {emp.name}</span>
                                                    {hasCustom && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" title="Has Custom Settings"></span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className={`flex-grow overflow-y-auto bg-gray-50 h-full min-h-0 ${!selectedId ? 'hidden md:block' : 'block'}`}>
                {selectedId && draftGuide && draftSop ? (
                    <div className="max-w-4xl mx-auto space-y-6 pb-40">
                        {/* Mobile Header */}
                        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 p-4 shadow-sm">
                             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setSelectedId(null)} className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            {selectionType === 'EMPLOYEE' ? <User size={18} className="text-blue-600"/> : <Briefcase size={18} className="text-[#8B0000]"/>}
                                            <h2 className="text-sm md:text-xl font-black text-[#1A1A1A] truncate max-w-[200px] md:max-w-none">
                                                {selectionType === 'EMPLOYEE' ? selectedEmployee?.name : selectedRoleDef?.title}
                                            </h2>
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-bold ml-7">
                                            {selectionType === 'EMPLOYEE' ? '个人专属标准 (Individual)' : '职位通用标准 (Global Role)'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    {selectionType === 'EMPLOYEE' && selectedEmployee?.customSop && (
                                        <button onClick={handleResetIndividual} className="flex-1 md:flex-none bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors">
                                            <RotateCcw size={14}/> 重置默认
                                        </button>
                                    )}
                                    <button onClick={handleSave} className="flex-1 md:flex-none bg-[#1A1A1A] text-[#FFD700] px-4 md:px-6 py-2 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 text-xs active:scale-95 transition-transform">
                                        <Save size={16}/> 保存设定
                                    </button>
                                </div>
                             </div>
                             
                             {selectionType === 'EMPLOYEE' && (
                                 <div className="mt-3 bg-blue-50 text-blue-800 px-3 py-2 rounded-lg text-xs font-bold border border-blue-100 flex items-center gap-2">
                                     <Sparkles size={14}/> 提示：您正在编辑该员工的个人标准。保存后将覆盖该职位的默认设置。
                                 </div>
                             )}
                        </div>
                        
                        <div className="px-4 space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                {/* Duty Description */}
                                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                                    <h3 className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-2 mb-4 tracking-widest"><BookOpen size={14}/> 岗位职责与守则</h3>
                                    <textarea className="w-full p-4 bg-gray-50 border-none rounded-2xl text-xs font-bold h-24 mb-4 focus:ring-1 focus:ring-primary/10 transition-shadow outline-none" value={draftGuide.description} onChange={e => setDraftGuide({...draftGuide, description: e.target.value})} placeholder="职责描述..." />
                                    <textarea className="w-full p-4 bg-gray-50 border-none rounded-2xl text-xs font-bold h-32 focus:ring-1 focus:ring-primary/10 transition-shadow outline-none" value={draftGuide.employeeRules?.join('\n') || ''} onChange={e => setDraftGuide({...draftGuide, employeeRules: e.target.value.split('\n')})} placeholder="每行一个员工守则..." />
                                </div>
                                
                                {/* Core Value & Red Line */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                                        <h3 className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-2 mb-4 tracking-widest"><Sparkles size={14}/> 核心价值</h3>
                                        <input className="w-full p-4 bg-gray-50 border-none rounded-2xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-gray-100 transition-all" value={draftGuide.coreValue} onChange={e => setDraftGuide({...draftGuide, coreValue: e.target.value})} />
                                    </div>
                                    <div className="bg-red-50 p-6 rounded-[2rem] shadow-sm border border-red-100">
                                        <h3 className="text-[10px] font-black uppercase text-red-400 flex items-center gap-2 mb-4 tracking-widest"><AlertOctagon size={14}/> 安全红线</h3>
                                        <input className="w-full p-4 bg-white border-none rounded-2xl text-xs font-bold text-red-700 outline-none focus:ring-2 focus:ring-red-200 transition-all" value={draftGuide.safetyRedLine} onChange={e => setDraftGuide({...draftGuide, safetyRedLine: e.target.value})} />
                                    </div>
                                </div>

                                {/* Opening SOP */}
                                <div className="bg-white p-6 rounded-[2rem] border border-orange-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black uppercase text-orange-500 flex items-center gap-2 tracking-widest"><Sun size={14}/> 开铺 SOP 任务</h3><button onClick={() => addTask('start')} className="p-2 bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100"><Plus size={16}/></button></div>
                                    <div className="space-y-3">
                                        {draftSop.start?.tasks?.map((task: any, idx: number) => (
                                            <div key={idx} className="bg-gray-50 p-3 rounded-2xl grid grid-cols-1 gap-2 relative group hover:shadow-md transition-all border border-transparent hover:border-orange-100">
                                                <input className="w-full bg-white p-2 rounded-xl text-xs font-black border-none outline-none" placeholder="任务名" value={task.label} onChange={e => updateTask('start', idx, 'label', e.target.value)} />
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input className="flex-1 bg-white p-2 rounded-xl text-[10px] border-none outline-none" placeholder="标准 (Standard)" value={task.standard} onChange={e => updateTask('start', idx, 'standard', e.target.value)} />
                                                    <input className="flex-1 bg-white p-2 rounded-xl text-[10px] border-none font-italic outline-none" placeholder="目的 (Why?)" value={task.why} onChange={e => updateTask('start', idx, 'why', e.target.value)} />
                                                </div>
                                                <button onClick={() => removeTask('start', idx)} className="absolute -right-2 -top-2 bg-white text-red-500 p-1 rounded-full shadow-sm border opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Closing SOP */}
                                <div className="bg-white p-6 rounded-[2rem] border border-blue-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black uppercase text-blue-500 flex items-center gap-2 tracking-widest"><Moon size={14}/> 打烊 SOP 任务</h3><button onClick={() => addTask('end')} className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"><Plus size={16}/></button></div>
                                    <div className="space-y-3">
                                        {draftSop.end?.tasks?.map((task: any, idx: number) => (
                                            <div key={idx} className="bg-gray-50 p-3 rounded-2xl grid grid-cols-1 gap-2 relative group hover:shadow-md transition-all border border-transparent hover:border-blue-100">
                                                <input className="w-full bg-white p-2 rounded-xl text-xs font-black border-none outline-none" placeholder="任务名" value={task.label} onChange={e => updateTask('end', idx, 'label', e.target.value)} />
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input className="flex-1 bg-white p-2 rounded-xl text-[10px] border-none outline-none" placeholder="标准 (Standard)" value={task.standard} onChange={e => updateTask('end', idx, 'standard', e.target.value)} />
                                                    <input className="flex-1 bg-white p-2 rounded-xl text-[10px] border-none font-italic outline-none" placeholder="目的 (Why?)" value={task.why} onChange={e => updateTask('end', idx, 'why', e.target.value)} />
                                                </div>
                                                <button onClick={() => removeTask('end', idx)} className="absolute -right-2 -top-2 bg-white text-red-500 p-1 rounded-full shadow-sm border opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-20">
                        <ClipboardList size={64}/>
                        <p className="font-bold mt-4 uppercase tracking-widest">请选择左侧的职位或员工</p>
                    </div>
                )}
            </div>
        </div>
    );
};
