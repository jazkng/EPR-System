import React, { useState, useEffect, useRef } from 'react';
import { Settings, Crown, Layout, Cloud, Lock, Save, X, Download, AlertTriangle, FileJson, Info, History, Database, RotateCcw, CheckCircle2, Loader2, Calendar, Upload } from 'lucide-react';
import { StoreConfig, Employee, SystemBackup } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { APP_VERSION, VERSION_HISTORY } from '../constants/versionHistory';

interface StoreConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const StoreConfigModal: React.FC<StoreConfigModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'RECOVERY'>('GENERAL');
    const [storeConfig, setStoreConfig] = useState<StoreConfig>({ 
        businessDayCutoff: 4, timeZoneOffset: 8,
        cloudinaryCloudName: '', cloudinaryUploadPreset: '', googleDriveUrl: ''
    });
    
    const [bossAccounts, setBossAccounts] = useState<Employee[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    
    // Recovery State
    const [backups, setBackups] = useState<SystemBackup[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    useEffect(() => {
        if (activeTab === 'RECOVERY') {
            loadBackups();
        }
    }, [activeTab]);

    const loadData = async () => {
        const cfg = await DataManager.getConfig();
        if(cfg) setStoreConfig(cfg);
        
        const emps = await DataManager.getEmployees();
        const bosses = emps.filter(e => ['001','002','003','004'].includes(e.id) || e.role.includes('Owner'));
        setBossAccounts(bosses);
    };

    const loadBackups = async () => {
        setLoadingBackups(true);
        try {
            const list = await DataManager.getAvailableBackups();
            setBackups(list);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingBackups(false);
        }
    };

    const handleSaveConfig = async () => {
        await DataManager.saveConfig(storeConfig);
        localStorage.setItem('kepong_erp_config', JSON.stringify(storeConfig));
        for (const boss of bossAccounts) {
            await DataManager.saveEmployee(boss);
        }
        alert('系统设置已更新 (System Config Updated)');
        onClose();
    };

    const handleBossChange = (id: string, field: 'name' | 'pin', value: string) => {
        setBossAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, [field]: value } : acc));
    };

    const handleResetData = async (type: 'INVENTORY' | 'SUPPLIERS' | 'STAFF') => {
      const confirmMsg = type === 'INVENTORY' ? "确定要重置所有库存数据吗？数量将清零。" : type === 'SUPPLIERS' ? "确定要恢复默认供应商列表吗？所有自定义更改将丢失。" : "确定要重置员工列表吗？除老板账号外，所有员工将被还原。";
      if (!confirm(confirmMsg)) return;
      const success = await DataManager.resetToDefaults(type);
      if (success) alert("✅ 重置成功 (Reset Successful)");
      else alert("❌ 重置失败 (Reset Failed)");
    };

    const handleExportData = async () => {
        if (!confirm("确定要导出全系统数据并下载到本地吗？(Export All Data)")) return;
        setIsExporting(true);
        try {
            const data = await DataManager.exportSystemData();
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            link.download = `KLK_ERP_BACKUP_V${APP_VERSION}_${dateStr}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            alert("✅ 备份文件下载成功！请妥善保管。");
        } catch (e) {
            console.error(e);
            alert("❌ 导出失败 (Export Failed)");
        } finally {
            setIsExporting(false);
        }
    };

    const performRestore = async (backupData: any, source: 'CLOUD' | 'FILE') => {
        const confirmStr = prompt(`⚠️ 严重警告：系统回滚 (SYSTEM RESTORE - ${source})\n\n您即将把系统恢复到备份状态。\n\n当前所有的数据（库存、账单、日志等）将被覆盖或清除！\n\n请输入 "RESTORE" 确认操作：`);
        if (confirmStr !== 'RESTORE') return;

        setIsRestoring(true);
        try {
            // Re-wrap if it's a raw backup object to match expected interface
            const backupObj: SystemBackup = {
                version: backupData.version || 'Unknown',
                timestamp: backupData.timestamp || new Date().toISOString(),
                data: backupData.data || backupData // Handle nested data if present
            };
            
            await DataManager.restoreSystem(backupObj);
            alert("✅ 系统已成功恢复！即将刷新页面...");
            window.location.reload();
        } catch (e) {
            console.error("Restore failed", e);
            alert("❌ 恢复失败，请联系技术支持。");
            setIsRestoring(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                performRestore(json, 'FILE');
            } catch (err) {
                alert("无效的备份文件 (Invalid JSON)");
            }
        };
        reader.readAsText(file);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full md:max-w-2xl rounded-t-3xl md:rounded-2xl px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] md:px-6 md:pb-6 md:pt-[max(env(safe-area-inset-top),1.5rem)] shadow-2xl h-[90vh] md:max-h-[90vh] overflow-y-auto mt-auto md:mt-0 flex flex-col relative">
                <div className="flex justify-between items-center mb-4 md:mb-6">
                    <h3 className="font-black text-lg md:text-xl flex items-center gap-2"><Settings size={20} className="md:w-6 md:h-6"/> 系统设置 (System Config)</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                </div>

                {/* Tab Switcher */}
                <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
                    <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${activeTab === 'GENERAL' ? 'bg-white shadow text-[#1A1A1A]' : 'text-gray-400'}`}>常规设置 (General)</button>
                    <button onClick={() => setActiveTab('RECOVERY')} className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${activeTab === 'RECOVERY' ? 'bg-[#1A1A1A] shadow text-[#FFD700]' : 'text-gray-400'}`}>数据与恢复 (Data & Recovery)</button>
                </div>
                
                {/* --- TAB 1: GENERAL --- */}
                {activeTab === 'GENERAL' && (
                    <div className="space-y-6 flex-grow overflow-y-auto pb-20">
                        {/* 0. SYSTEM INFO */}
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 flex justify-between items-center">
                            <div>
                                <h4 className="text-xs font-bold text-indigo-700 uppercase flex items-center gap-2 mb-1"><Info size={14}/> 系统版本 (Version)</h4>
                                <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2 py-0.5 rounded">v{APP_VERSION}</span>
                            </div>
                            <button onClick={() => setShowChangelog(true)} className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 flex items-center gap-2 transition-colors">
                                <History size={14}/> 更新日志
                            </button>
                        </div>

                        {/* 1. BOSS ACCOUNTS */}
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                            <h4 className="text-xs font-bold text-yellow-700 uppercase mb-3 flex items-center gap-2"><Crown size={14}/> 老板账号 (Owner Access)</h4>
                            <div className="space-y-2">
                                {bossAccounts.sort((a,b) => a.id.localeCompare(b.id)).map(boss => (
                                    <div key={boss.id} className="flex items-center gap-2">
                                        <div className="bg-yellow-100 text-yellow-800 text-[10px] font-mono font-bold px-2 py-2 rounded-lg w-12 text-center">{boss.id}</div>
                                        <input className="flex-1 p-2 border border-yellow-200 rounded-lg text-xs font-bold bg-white" value={boss.name} onChange={e => handleBossChange(boss.id, 'name', e.target.value)} placeholder="Name" />
                                        <div className="relative w-24">
                                            <Lock size={12} className="absolute left-2 top-2.5 text-gray-400"/>
                                            <input className="w-full p-2 pl-6 border border-yellow-200 rounded-lg text-xs font-bold text-center bg-white" value={boss.pin} onChange={e => handleBossChange(boss.id, 'pin', e.target.value)} placeholder="PIN" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. STORE SETTINGS */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Layout size={14}/> 结算设置 (Settlement Logic)</h4>
                            <div className="mt-3 grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">默认日期界限 (Cutoff)</label><div className="flex items-center gap-2"><input type="number" min="0" max="23" value={storeConfig.businessDayCutoff ?? 4} onChange={e => setStoreConfig({...storeConfig, businessDayCutoff: parseInt(e.target.value)})} className="w-full p-2 border border-gray-300 rounded-lg font-mono font-bold text-black bg-white text-center"/><span className="text-xs text-gray-500 font-bold">AM</span></div></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">UTC 时区</label><div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-500">UTC +</span><input type="number" min="-12" max="14" value={storeConfig.timeZoneOffset ?? 8} onChange={e => setStoreConfig({...storeConfig, timeZoneOffset: parseFloat(e.target.value)})} className="w-full p-2 border border-gray-300 rounded-lg font-mono font-bold text-black bg-white text-center"/></div></div>
                            </div>
                        </div>

                        {/* 3. CLOUD SERVICES */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                            <h4 className="text-xs font-bold text-blue-700 uppercase mb-3 flex items-center gap-2"><Cloud size={14}/> 云端服务 (Cloud Services)</h4>
                            <div className="space-y-3">
                                <div><label className="text-[10px] font-bold text-blue-400 uppercase mb-1 block">Cloudinary Name</label><input className="w-full p-2 border border-blue-200 rounded-lg text-xs font-bold text-blue-800" value={storeConfig.cloudinaryCloudName || ''} onChange={e => setStoreConfig({...storeConfig, cloudinaryCloudName: e.target.value})} placeholder="e.g. dp9vqajqu" /></div>
                                <div><label className="text-[10px] font-bold text-blue-400 uppercase mb-1 block">Upload Preset</label><input className="w-full p-2 border border-blue-200 rounded-lg text-xs font-bold text-blue-800" value={storeConfig.cloudinaryUploadPreset || ''} onChange={e => setStoreConfig({...storeConfig, cloudinaryUploadPreset: e.target.value})} placeholder="e.g. kepong_unsigned" /></div>
                            </div>
                        </div>

                        {/* 4. DANGER ZONE */}
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                            <h4 className="text-xs font-bold text-red-500 uppercase mb-3 flex items-center gap-2"><AlertTriangle size={14}/> 危险操作 (Reset Data)</h4>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => handleResetData('INVENTORY')} className="px-3 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50">Reset Inventory</button>
                                <button onClick={() => handleResetData('SUPPLIERS')} className="px-3 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50">Reset Suppliers</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB 2: RECOVERY --- */}
                {activeTab === 'RECOVERY' && (
                    <div className="flex-grow overflow-y-auto pb-20 space-y-4">
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                            <h4 className="text-sm font-black text-blue-800 flex items-center gap-2 mb-2"><Database size={16}/> 数据安全与备份机制 (Data Security)</h4>
                            <p className="text-xs text-blue-600 leading-relaxed font-medium">
                                为了保护您的账单免受高额读取费用，<strong>系统已关闭每日自动云备份</strong>。<br/>
                                建议您<strong>每周</strong>手动点击下方【下载系统备份】，将完整数据保存到本地电脑或 U 盘中。
                            </p>
                        </div>

                        {/* 🟢 LOCAL BACKUP & RESTORE ACTIONS (NEW LAYOUT) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {/* EXPORT BUTTON */}
                            <div className="bg-white border-2 border-indigo-100 p-5 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm">
                                <div className="bg-indigo-50 p-3 rounded-full shadow-inner mb-3 text-indigo-600">
                                    <Download size={24} />
                                </div>
                                <h4 className="text-sm font-black text-[#1A1A1A] mb-1">导出系统数据</h4>
                                <p className="text-[10px] text-gray-500 mb-4 h-8">打包全店所有数据并下载为 .json 文件，建议每周操作一次。</p>
                                <button onClick={handleExportData} disabled={isExporting} className="w-full py-3 bg-[#1A1A1A] text-[#FFD700] text-xs font-black rounded-xl hover:bg-black transition-all flex justify-center items-center gap-2 shadow-lg active:scale-95 disabled:opacity-70">
                                    {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>} 
                                    {isExporting ? '打包中...' : '下载备份 (Export)'}
                                </button>
                            </div>

                            {/* IMPORT BUTTON */}
                            <div 
                                className="bg-gray-50 border-2 border-dashed border-gray-300 p-5 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-gray-100 hover:border-gray-400 transition-colors cursor-pointer" 
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="bg-white p-3 rounded-full shadow-sm mb-3 text-gray-500">
                                    <Upload size={24}/>
                                </div>
                                <h4 className="text-sm font-black text-[#1A1A1A] mb-1">恢复本地数据</h4>
                                <p className="text-[10px] text-gray-500 mb-4 h-8">上传之前下载的 .json 备份文件，系统将回滚到该文件状态。</p>
                                <div className="w-full py-3 bg-white border border-gray-200 text-gray-600 text-xs font-black rounded-xl transition-all flex justify-center items-center gap-2 shadow-sm">
                                    <Upload size={16}/> 点击选择文件
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                            </div>
                        </div>

                        <div className="h-px bg-gray-200 my-6"></div>
                        
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Cloud size={14}/> 云端历史快照 (Cloud Snapshots)</h4>
                        {loadingBackups ? (
                            <div className="py-10 text-center text-gray-400 font-bold flex flex-col items-center">
                                <Loader2 size={24} className="animate-spin mb-2"/> 加载快照列表...
                            </div>
                        ) : backups.length === 0 ? (
                            <div className="py-10 text-center text-gray-400 font-bold bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                暂无云端快照
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {backups.map((bk, idx) => (
                                    <div key={idx} className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex justify-between items-center group hover:border-[#FFD700] transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 font-black text-sm border border-gray-200">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-[#1A1A1A] text-sm flex items-center gap-2">
                                                    <Calendar size={14} className="text-gray-400"/>
                                                    {new Date(bk.timestamp).toLocaleDateString()} 
                                                    <span className="text-xs font-medium text-gray-400">{new Date(bk.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </h4>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold border border-blue-100">v{bk.version}</span>
                                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold border border-gray-200">Snapshot</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => performRestore(bk, 'CLOUD')} 
                                            disabled={isRestoring}
                                            className="bg-white border-2 border-red-100 text-red-600 px-4 py-2 rounded-xl text-xs font-black shadow-sm hover:bg-red-600 hover:text-white hover:border-red-600 transition-all active:scale-95 flex items-center gap-2"
                                        >
                                            {isRestoring ? <Loader2 size={14} className="animate-spin"/> : <RotateCcw size={14}/>} 恢复 (Restore)
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'GENERAL' && (
                    <div className="flex gap-2 pt-4 border-t border-gray-100 mt-auto bg-white sticky bottom-0">
                        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl text-gray-500">取消</button>
                        <button onClick={handleSaveConfig} className="flex-[2] py-3 bg-[#1A1A1A] text-[#FFD700] font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"><Save size={16}/> 保存设置</button>
                    </div>
                )}
            </div>

            {/* CHANGELOG OVERLAY */}
            {showChangelog && (
                <div className="absolute inset-0 bg-white z-[110] flex flex-col p-6 animate-in slide-in-from-right w-full md:max-w-2xl ml-auto rounded-l-2xl shadow-2xl">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h3 className="font-black text-xl flex items-center gap-2 text-[#1A1A1A]"><History size={24}/> 版本更新记录 (Changelog)</h3>
                        <button onClick={() => setShowChangelog(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-6">
                        {VERSION_HISTORY.map((log, idx) => (
                            <div key={log.version} className="relative pl-6 border-l-2 border-gray-200">
                                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white ${idx === 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                <div className="mb-1 flex items-center gap-3">
                                    <span className={`text-lg font-black ${idx === 0 ? 'text-green-600' : 'text-gray-500'}`}>v{log.version}</span>
                                    <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{log.date}</span>
                                    {idx === 0 && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase">Current</span>}
                                </div>
                                <ul className="list-disc list-outside ml-4 space-y-1">
                                    {log.changes.map((c, i) => (
                                        <li key={i} className="text-sm font-bold text-gray-600">{c}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};