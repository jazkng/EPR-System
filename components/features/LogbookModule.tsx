
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BookOpen, AlertCircle, CheckCircle2, Clock, Trash2, Shield, AlertTriangle, FileText, Camera, X, Image as ImageIcon, Upload, Loader2, ChevronDown, Filter, Zap, PenTool, Maximize2, ArrowRight, Eye, Lightbulb, Edit3, User, Gavel, Coins } from 'lucide-react';
import { LogEntry, LogCategory, LogPriority, Employee, MisconductRecord } from '../../types';
import { uploadToCloudinary } from '../utils';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';

interface LogbookModuleProps {
    viewOnly?: boolean;
    currentEmployee?: Employee;
}

const getCategoryLabel = (cat: LogCategory) => {
    switch(cat) {
        case 'VIP': return { label: 'VIP 接待', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Zap };
        case 'COMPLAINT': return { label: '客诉处理', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle };
        case 'REPAIR': return { label: '设备维修', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: PenTool };
        default: return { label: '日常记录', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: FileText };
    }
};

export const LogbookModule: React.FC<LogbookModuleProps> = ({ viewOnly = false, currentEmployee }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'HIGH_PRIORITY' | 'COMPLAINT'>('ALL');
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Form State
  const [form, setForm] = useState<{ issue: string; action: string; category: LogCategory; priority: LogPriority; image: string; }>({ 
      issue: '', 
      action: '', 
      category: 'OTHER', 
      priority: 'NORMAL', 
      image: '' 
  });
  
  // Misconduct Form State (Owner Only)
  const [showMisconduct, setShowMisconduct] = useState(false);
  const [misconductForm, setMisconductForm] = useState<{ empId: string; type: 'SMALL' | 'MEDIUM' | 'BIG'; fine: string }>({
      empId: '',
      type: 'SMALL',
      fine: ''
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal States
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);

  // Solution Edit State
  const [solutionModalOpen, setSolutionModalOpen] = useState(false);
  const [selectedLogForSolution, setSelectedLogForSolution] = useState<LogEntry | null>(null);
  const [solutionText, setSolutionText] = useState('');

  // Check Owner Permissions
  const isOwner = currentEmployee?.role?.includes('Owner') || currentEmployee?.role?.includes('老板');

  useEffect(() => {
    const loadData = async () => {
        const [l, e] = await Promise.all([
            DataManager.getLogs(),
            DataManager.getEmployees()
        ]);
        setLogs(l);
        setEmployees(e.filter(emp => !emp.isArchived && !emp.role.includes('Owner'))); // Active staff only
    };
    loadData();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      try {
          const url = await uploadToCloudinary(file);
          setForm(prev => ({ ...prev, image: url }));
      } catch (error) { 
          alert('Upload Failed'); 
      } finally { 
          setIsUploading(false); 
          if(fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const removeImage = () => {
      setForm(prev => ({ ...prev, image: '' }));
  };

  const handleAddLog = async () => {
      if (!form.issue.trim()) return alert("请填写发生事项 (Issue)");
      setIsSubmitting(true);
      
      try {
          let misconductData: MisconductRecord | undefined = undefined;

          // Handle Misconduct if enabled and valid
          if (showMisconduct && misconductForm.empId) {
              const emp = employees.find(e => e.id === misconductForm.empId);
              if (emp) {
                  misconductData = {
                      employeeId: emp.id,
                      employeeName: emp.name,
                      type: misconductForm.type,
                      fineAmount: misconductForm.fine ? parseFloat(misconductForm.fine) : 0
                  };
              }
          }
          
          const newEntry: LogEntry = {
              id: Date.now().toString(),
              date: new Date().toISOString().split('T')[0],
              time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
              issue: form.issue,
              action: form.action,
              category: form.category,
              priority: form.priority,
              status: 'PENDING',
              creatorName: currentEmployee?.name || 'Staff', 
              image: form.image || '',
              misconduct: misconductData
          };

          // Sanitize data to remove undefined fields (Firestore safety)
          const safeEntry = JSON.parse(JSON.stringify(newEntry));
          
          // DataManager now handles the misconduct logic inside addLog
          await DataManager.addLog(safeEntry);
          
          // Refresh to get potential result updates
          setLogs(await DataManager.getLogs());
          
          setForm({ issue: '', action: '', category: 'OTHER', priority: 'NORMAL', image: '' });
          setMisconductForm({ empId: '', type: 'SMALL', fine: '' });
          setShowMisconduct(false);
          alert("✅ 日志已提交 (已自动处理违规记录)");

      } catch (error: any) {
          console.error("Submit Log Error:", error);
          alert(`提交失败: ${error.message || "Unknown error"}`);
      } finally {
          setIsSubmitting(false);
      }
  };

  const confirmDelete = async () => {
      if (!deleteCandidateId) return;
      await DataManager.deleteLog(deleteCandidateId);
      setLogs(logs.filter(l => l.id !== deleteCandidateId));
      setDeleteCandidateId(null);
  };

  const handleAcknowledge = async (id: string) => {
      const viewerName = currentEmployee?.name || 'Manager';
      const now = new Date().toISOString();
      setLogs(prev => prev.map(log => log.id === id ? { ...log, acknowledgedBy: viewerName, acknowledgedAt: now } : log));
      await DataManager.acknowledgeLog(id, viewerName);
  };

  // --- SOLUTION EDITING ---
  const canEditSolution = useMemo(() => {
      if (!currentEmployee) return false;
      const role = currentEmployee.role.toUpperCase();
      return role.includes('OWNER') || role.includes('老板') || 
             role.includes('MANAGER') || role.includes('经理') ||
             role.includes('SUPERVISOR') || role.includes('主管');
  }, [currentEmployee]);

  const openSolutionModal = (log: LogEntry) => {
      setSelectedLogForSolution(log);
      setSolutionText(log.action || '');
      setSolutionModalOpen(true);
  };

  const handleSaveSolution = async () => {
      if (!selectedLogForSolution) return;
      const updatedLog = { ...selectedLogForSolution, action: solutionText };
      setLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
      await DataManager.addLog(updatedLog);
      setSolutionModalOpen(false);
      setSelectedLogForSolution(null);
      setSolutionText('');
  };

  const filteredLogs = logs.filter(log => {
      if (activeFilter === 'HIGH_PRIORITY') return log.priority === 'HIGH';
      if (activeFilter === 'COMPLAINT') return log.category === 'COMPLAINT';
      return true;
  });

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-24">
        
        {/* === ADD LOG FORM === */}
        {!viewOnly && (
            <div className="bg-white p-5 rounded-2xl shadow-lg border border-[#FFD700]/20 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FFD700] to-[#1A1A1A]"></div>
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-black text-[#1A1A1A] flex items-center gap-2">
                         <BookOpen size={20} className="text-[#FFD700] fill-current"/> 
                         新增日志 (New Log)
                     </h3>
                     <ModuleGuideButton module="LOGBOOK" dark />
                 </div>
                 
                 <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-3">
                         <select value={form.category} onChange={e => setForm({...form, category: e.target.value as LogCategory})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#FFD700]">
                             <option value="OTHER">📝 日常记录 (General)</option>
                             <option value="COMPLAINT">😡 客诉处理 (Complaint)</option>
                             <option value="REPAIR">🔧 设备维修 (Repair)</option>
                             <option value="VIP">👑 VIP 接待 (VIP)</option>
                         </select>
                         <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as LogPriority})} className={`w-full p-2.5 border rounded-xl text-xs font-bold outline-none focus:border-[#FFD700] ${form.priority === 'HIGH' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                             <option value="NORMAL">🟢 普通 (Normal)</option>
                             <option value="HIGH">🔴 紧急/重要 (High)</option>
                         </select>
                     </div>

                     <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block pl-1">发生了什么? (Issue)</label>
                        <textarea value={form.issue} onChange={e => setForm({...form, issue: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-[#FFD700] transition-colors resize-none h-20 placeholder:font-normal" placeholder="例如：2号桌客人投诉福建面太咸..."/>
                     </div>

                     <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block pl-1">采取了什么行动? (Action Taken)</label>
                        <textarea value={form.action} onChange={e => setForm({...form, action: e.target.value})} className="w-full p-3 bg-green-50/50 border border-green-100 rounded-xl text-sm font-bold outline-none focus:border-green-400 transition-colors resize-none h-16 placeholder:font-normal text-green-800" placeholder="例如：立即重做一份，并赠送凉茶致歉..."/>
                     </div>

                     {/* MISCONDUCT SECTION (OWNER ONLY) */}
                     {isOwner && (
                         <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                             <div className="flex justify-between items-center mb-3">
                                 <label className="flex items-center gap-2 text-xs font-black text-red-700 cursor-pointer select-none">
                                     <input type="checkbox" checked={showMisconduct} onChange={e => setShowMisconduct(e.target.checked)} className="accent-red-600"/>
                                     <Gavel size={14}/> 记录违规与处罚 (Discipline)
                                 </label>
                             </div>
                             
                             {showMisconduct && (
                                 <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                     <div>
                                         <label className="text-[10px] font-bold text-red-400 uppercase mb-1 block">Staff (责任人)</label>
                                         <select value={misconductForm.empId} onChange={e => setMisconductForm({...misconductForm, empId: e.target.value})} className="w-full p-2 bg-white border border-red-200 rounded-lg text-xs font-bold outline-none">
                                             <option value="">Select Staff...</option>
                                             {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role.split('(')[0]})</option>)}
                                         </select>
                                     </div>
                                     
                                     <div>
                                         <label className="text-[10px] font-bold text-red-400 uppercase mb-1 block">Severity (错误等级)</label>
                                         <div className="flex gap-2">
                                             {[{id:'SMALL', l:'小错 (5x)', c:'bg-blue-100 text-blue-700 border-blue-200'}, {id:'MEDIUM', l:'中错 (3x)', c:'bg-orange-100 text-orange-700 border-orange-200'}, {id:'BIG', l:'大错 (1x)', c:'bg-red-600 text-white border-red-600'}].map(opt => (
                                                 <button key={opt.id} onClick={() => setMisconductForm({...misconductForm, type: opt.id as any})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${misconductForm.type === opt.id ? opt.c : 'bg-white text-gray-500 border-gray-200'}`}>
                                                     {opt.l}
                                                 </button>
                                             ))}
                                         </div>
                                         <div className="mt-1 text-[9px] text-red-500 italic">
                                             {misconductForm.type === 'SMALL' && '累计 5 次触发黄色警告 (Yellow Warning)'}
                                             {misconductForm.type === 'MEDIUM' && '累计 3 次触发黄色警告 (Yellow Warning)'}
                                             {misconductForm.type === 'BIG' && '直接触发黄色警告 (Direct Warning)'}
                                         </div>
                                     </div>

                                     <div>
                                         <label className="text-[10px] font-bold text-red-400 uppercase mb-1 block flex items-center gap-1"><Coins size={10}/> Fine (罚款 - Optional)</label>
                                         <input type="number" value={misconductForm.fine} onChange={e => setMisconductForm({...misconductForm, fine: e.target.value})} className="w-full p-2 bg-white border border-red-200 rounded-lg text-xs font-bold outline-none" placeholder="0.00" />
                                     </div>
                                 </div>
                             )}
                         </div>
                     )}

                     <div className="flex items-center gap-3">
                         <div className="relative">
                             {form.image ? (
                                 <div className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden relative group cursor-pointer">
                                     <img src={form.image} className="w-full h-full object-cover" onClick={() => setViewImage(form.image)} />
                                     <button onClick={removeImage} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} className="text-white"/></button>
                                 </div>
                             ) : (
                                 <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-dashed border-gray-300 hover:bg-gray-200 transition-colors">
                                     {isUploading ? <Loader2 size={18} className="animate-spin text-gray-400"/> : <Camera size={20} className="text-gray-400"/>}
                                 </button>
                             )}
                             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                         </div>
                         <button onClick={handleAddLog} disabled={isUploading || isSubmitting} className="flex-grow bg-[#1A1A1A] text-[#FFD700] h-12 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-black">
                             {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : '提交记录 (Submit)'}
                         </button>
                     </div>
                 </div>
            </div>
        )}

        {/* === LOG LIST === */}
        <div className="space-y-4">
            {filteredLogs.map(log => {
                const catInfo = getCategoryLabel(log.category);
                const isAcknowledged = !!log.acknowledgedBy;
                
                return (
                    <div key={log.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all border-l-4 ${log.priority === 'HIGH' ? 'border-l-red-500' : 'border-l-gray-300'} ${isAcknowledged ? 'opacity-80' : 'opacity-100'}`}>
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border ${catInfo.color}`}>{React.createElement(catInfo.icon, { size: 10 })} {catInfo.label}</span>
                                    {log.priority === 'HIGH' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white animate-pulse">紧急</span>}
                                    <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1 ml-1"><Clock size={10}/> {log.date} {log.time}</span>
                                </div>
                                {!viewOnly && <button onClick={() => setDeleteCandidateId(log.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>}
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-grow space-y-2">
                                    <h5 className="font-bold text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">{log.issue}</h5>
                                    
                                    {/* Action Area */}
                                    {log.action ? (
                                        <div className="bg-green-50/50 p-2 rounded-lg border border-green-100/50 flex gap-2 items-start group/action relative">
                                            <CheckCircle2 size={14} className="text-green-600 shrink-0 mt-0.5"/>
                                            <p className="text-xs text-green-800 font-medium leading-relaxed flex-grow">{log.action}</p>
                                            {viewOnly && canEditSolution && <button onClick={() => openSolutionModal(log)} className="opacity-0 group-hover/action:opacity-100 transition-opacity text-[10px] text-green-600 absolute top-2 right-2 bg-white/80 px-2 py-0.5 rounded shadow-sm"><Edit3 size={10}/></button>}
                                        </div>
                                    ) : (
                                        viewOnly && canEditSolution && <button onClick={() => openSolutionModal(log)} className="w-full mt-2 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-xs font-bold flex items-center justify-center gap-2 hover:bg-yellow-100"><Lightbulb size={14}/> 💡 提出解决方案</button>
                                    )}

                                    {/* Misconduct Display */}
                                    {log.misconduct && (
                                        <div className="bg-red-50 p-2 rounded-lg border border-red-100 mt-2">
                                            <div className="flex justify-between items-center text-[10px] font-black text-red-700 uppercase mb-1">
                                                <span className="flex items-center gap-1"><Gavel size={10}/> 违规记录</span>
                                                <span>{log.misconduct.type}</span>
                                            </div>
                                            <p className="text-xs text-red-800 font-bold">{log.misconduct.employeeName}</p>
                                            {log.misconduct.fineAmount && <p className="text-[10px] text-red-600 mt-0.5">罚款: RM {log.misconduct.fineAmount}</p>}
                                            {log.misconduct.actionResult && <p className="text-[10px] text-red-500 mt-1 italic">{log.misconduct.actionResult}</p>}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] text-gray-400 font-bold bg-gray-50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-gray-100"><Shield size={10}/> {log.creatorName}</span>
                                    </div>
                                </div>
                                
                                {log.image && <div className="w-20 h-20 rounded-lg bg-gray-100 border border-gray-200 shrink-0 overflow-hidden cursor-zoom-in relative group" onClick={() => setViewImage(log.image)}><img src={log.image} className="w-full h-full object-cover transition-transform group-hover:scale-110"/><div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center"><Maximize2 size={16} className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md"/></div></div>}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>

        {/* ... (Keep existing Modals: Lightbox, Solution, Delete) ... */}
        {viewImage && (<div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4" onClick={() => setViewImage(null)}><img src={viewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}/></div>)}
        {solutionModalOpen && (<div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"><div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl"><textarea value={solutionText} onChange={e => setSolutionText(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none h-32 resize-none mb-4"/><div className="flex gap-2"><button onClick={() => setSolutionModalOpen(false)} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl text-sm">取消</button><button onClick={handleSaveSolution} className="flex-[2] py-3 bg-green-600 text-white font-bold rounded-xl text-sm">确认</button></div></div></div>)}
        {deleteCandidateId && (<div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center"><h4 className="text-xl font-black mb-2">确认删除?</h4><div className="grid grid-cols-2 gap-3"><button onClick={() => setDeleteCandidateId(null)} className="py-3 bg-gray-100 font-bold rounded-xl text-sm">取消</button><button onClick={confirmDelete} className="py-3 bg-red-600 text-white font-bold rounded-xl text-sm">确认</button></div></div></div>)}
    </div>
  );
};
