
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, Layers, AlertTriangle, ChevronUp, ChevronDown, 
    Plus, Edit3, Trash2, CheckCircle2, X, Calculator, Link as LinkIcon, Save, Package,
    Filter, Calendar, CalendarDays, Box, ArrowRightLeft, Minus, DollarSign, History, Clock, User, Scale, Loader2, Check, Flame, Send, ClipboardList, CheckSquare, PlayCircle, RefreshCw,
    FileDown, Printer, Square
} from 'lucide-react';
import { StockItem, Employee, AppModule, Supplier, UomOption, InventoryLog, InventoryLogItem, InventoryTask } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

interface InventoryModuleProps {
    allowedModules?: AppModule[];
    employee?: Employee;
    lockedMode?: 'CHECK' | 'MASTER';
    initialMode?: 'CHECK' | 'MASTER';
    initialSearchTerm?: string;
}

const CATEGORY_SECTIONS: Record<string, { id: string, label: string, color: string }[]> = {
    'KITCHEN': [
        { id: 'FRESH', label: '生鲜 (Fresh)', color: 'bg-red-50 text-red-700' },
        { id: 'MEAT', label: '肉类 (Meat)', color: 'bg-red-50 text-red-700' },
        { id: 'SEAFOOD', label: '海鲜 (Seafood)', color: 'bg-blue-50 text-blue-700' },
        { id: 'VEG', label: '蔬果 (Veg)', color: 'bg-green-50 text-green-700' },
        { id: 'NOODLE', label: '面食 (Noodle)', color: 'bg-yellow-50 text-yellow-700' },
        { id: 'SAUCE', label: '酱料 (Sauce)', color: 'bg-orange-50 text-orange-700' },
        { id: 'DRY', label: '干货 (Dry)', color: 'bg-amber-50 text-amber-700' },
        { id: 'HQ', label: '总店 (HQ)', color: 'bg-purple-50 text-purple-700' },
    ],
    'BAR': [
        { id: 'TEA', label: '茶叶 (Tea)', color: 'bg-green-50 text-green-700' },
        { id: 'FRUIT', label: '水果 (Fruit)', color: 'bg-orange-50 text-orange-700' },
        { id: 'RTD', label: '罐装 (Drinks)', color: 'bg-blue-50 text-blue-700' },
        { id: 'MISC', label: '其他 (Misc)', color: 'bg-gray-50 text-gray-700' },
        { id: 'DRINK', label: '饮品 (Drink)', color: 'bg-blue-50 text-blue-700' }
    ],
    'GENERAL': [
        { id: 'PACKAGING', label: '包装 (Pack)', color: 'bg-yellow-50 text-yellow-700' },
        { id: 'CLEANING', label: '清洁 (Clean)', color: 'bg-cyan-50 text-cyan-700' },
        { id: 'TOOLS', label: '工具 (Tools)', color: 'bg-gray-50 text-gray-700' },
        { id: 'WASTE', label: '耗材 (Waste)', color: 'bg-gray-50 text-gray-700' },
        { id: 'GENERAL', label: '杂项 (General)', color: 'bg-gray-50 text-gray-700' },
    ],
    'FUEL': [
        { id: 'GAS', label: '煤气 (Gas)', color: 'bg-indigo-50 text-indigo-700' },
        { id: 'CHARCOAL', label: '木炭 (Charcoal)', color: 'bg-slate-100 text-slate-700' },
        { id: 'OIL', label: '柴油/油 (Oil)', color: 'bg-orange-50 text-orange-700' }
    ]
};

// Helper to get Category Label safely
const getCategoryLabel = (catId: string): string => {
    for (const group of Object.values(CATEGORY_SECTIONS)) {
        const found = group.find(c => c.id === catId);
        if (found) return found.label;
    }
    return catId;
};

const INPUT_STYLE = "w-full p-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] transition-all placeholder:font-normal placeholder:text-gray-400";
const LABEL_STYLE = "text-[10px] font-bold text-gray-400 uppercase mb-1.5 block tracking-wide";

export const InventoryModule: React.FC<InventoryModuleProps> = ({ 
    allowedModules, 
    employee, 
    lockedMode, 
    initialMode = 'CHECK', 
    initialSearchTerm 
}) => {
    const [currentStockView, setCurrentStockView] = useState<'KITCHEN' | 'BAR' | 'GENERAL' | 'FUEL'>('KITCHEN');
    const [mode, setMode] = useState<'CHECK' | 'MASTER' | 'ASSIGN'>(lockedMode || initialMode);
    
    // View Switcher for Master Mode (List vs History vs Tasks)
    const [viewType, setViewType] = useState<'LIST' | 'HISTORY' | 'TASKS'>('LIST');
    const [logs, setLogs] = useState<InventoryLog[]>([]);
    
    // Check Frequency Filter
    const [checkFilter, setCheckFilter] = useState<'DAILY' | 'WEEKLY'>('DAILY');

    const [items, setItems] = useState<StockItem[]>([]);
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    
    // Check Mode State
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({}); // NEW: Track visually checked items
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Master Mode State
    const [editingItem, setEditingItem] = useState<Partial<StockItem> | null>(null);
    const [linkedSuppliers, setLinkedSuppliers] = useState<Supplier[]>([]);
    
    // Delete Confirmation State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Expand Log State
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // --- ASSIGNMENT & TASK STATE ---
    const [selectedForAssign, setSelectedForAssign] = useState<Set<string>>(new Set());
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [staffList, setStaffList] = useState<Employee[]>([]);
    const [selectedAssignee, setSelectedAssignee] = useState('');
    const [taskList, setTaskList] = useState<InventoryTask[]>([]); // List of tasks (Sent or Received)
    const [myTask, setMyTask] = useState<InventoryTask | null>(null); // Current user's active task execution
    const [pendingTasks, setPendingTasks] = useState<InventoryTask[]>([]); // Tasks waiting for ME to do

    // --- EXPORT STATE ---
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportConfig, setExportConfig] = useState({
        categories: { KITCHEN: true, BAR: false, GENERAL: false, FUEL: false },
        showCost: true,
        lowStockOnly: false
    });
    const [printChunks, setPrintChunks] = useState<StockItem[][]>([]);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // --- PERMISSION CHECK ---
    const isManagement = employee?.role.match(/Owner|Manager|Supervisor|Chef|Admin/i);
    // User has explicit access to specific categories?
    const hasCategoryAccess = allowedModules?.some(m => ['INVENTORY_KITCHEN', 'INVENTORY_BAR', 'INVENTORY_GENERAL', 'INVENTORY_FUEL', 'INVENTORY_VIEW'].includes(m));
    
    // If not management and no specific category access, they are restricted to tasks only
    const isRestrictedView = !isManagement && !hasCategoryAccess;

    useEffect(() => {
        // Only load stock if not restricted OR if we are inside a task (which handles its own filtering via startTaskExecution)
        // Actually, startTaskExecution calls loadStock then filters. 
        // We let loadStock run, but we hide the UI tabs if restricted.
        loadStock(currentStockView);
    }, [currentStockView]);

    // UPDATED: Poll Tasks every 5 seconds to ensure employees see new assignments instantly
    useEffect(() => {
        loadTasks();
        const interval = setInterval(loadTasks, 5000); // 5-second polling
        return () => clearInterval(interval);
    }, [viewType, employee?.id, mode]); // Reload when mode changes (e.g. exiting task)

    // History logs
    useEffect(() => {
        if (viewType === 'HISTORY') {
            loadLogs();
        }
    }, [viewType]);

    // If initial search term is provided
    useEffect(() => {
        if (initialSearchTerm) {
            setSearchTerm(initialSearchTerm);
            setCheckFilter('WEEKLY');
        }
    }, [initialSearchTerm]);

    // Fetch linked suppliers when opening edit modal
    useEffect(() => {
        if (editingItem && editingItem.id) {
            DataManager.getSuppliers().then(allSuppliers => {
                const linked = allSuppliers.filter(s => 
                    s.catalog?.some(c => c.linkedStockId === editingItem.id)
                );
                setLinkedSuppliers(linked);
            });
        } else {
            setLinkedSuppliers([]);
        }
    }, [editingItem?.id]);

    const loadStock = async (view: 'KITCHEN' | 'BAR' | 'GENERAL' | 'FUEL') => {
        const data = await DataManager.getStock(view);
        setItems(data);
        const initialCounts: Record<string, number> = {};
        data.forEach(item => {
            initialCounts[item.id] = item.currentQty;
        });
        setCounts(initialCounts);
        setCheckedItems({}); 
        setSelectedForAssign(new Set()); 
    };

    const loadLogs = async () => {
        const allLogs = await DataManager.getInventoryLogs();
        setLogs(allLogs);
    };

    const loadTasks = async () => {
        try {
            const allTasks = await DataManager.getInventoryTasks();
            
            // 1. Set Task List for Master View
            if (isManagement) {
                setTaskList(allTasks);
            } else {
                // Regular staff only see tasks assigned TO them or created BY them
                setTaskList(allTasks.filter(t => t.assigneeId === employee?.id || t.creatorId === employee?.id));
            }

            // 2. Set Pending Tasks for Current User
            if (employee) {
                const myPending = allTasks.filter(t => t.assigneeId === employee.id && t.status === 'PENDING');
                setPendingTasks(myPending);
            }
        } catch (e) {
            console.error("Error loading tasks", e);
        }
    };

    const handleViewChange = (view: 'KITCHEN' | 'BAR' | 'GENERAL' | 'FUEL') => {
        setCurrentStockView(view);
        setSearchTerm('');
    };

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
    };

    const handleCountChange = (id: string, val: number) => {
        setCounts(prev => ({ ...prev, [id]: val }));
    };

    // Toggle visual checkmark
    const toggleItemChecked = (id: string) => {
        setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSubmitCheck = async (taskRef?: InventoryTask) => {
        // Validation: If executing a specific task, ensure all items in that task are counted
        let targetItems = items;
        let logCategory = currentStockView;

        if (taskRef) {
             // We are submitting a specific task
             targetItems = items.filter(i => taskRef.items.some(ti => ti.stockId === i.id));
             // Infer category from first item or default
             logCategory = (taskRef.items[0]?.category as any) || currentStockView; 
        } else {
             if (!confirm("Confirm update stock quantities?")) return;
        }
        
        setIsSubmitting(true);
        try {
            const logItems: InventoryLogItem[] = [];
            let totalValueChange = 0;

            const updatedItems = targetItems.map(item => {
                const newQty = counts[item.id] !== undefined ? counts[item.id] : item.currentQty;
                const diff = newQty - item.currentQty;
                
                if (diff !== 0) {
                    const valChange = diff * item.cost;
                    totalValueChange += valChange;
                    logItems.push({
                        stockId: item.id,
                        stockName: item.name,
                        oldQty: item.currentQty,
                        newQty: newQty,
                        diff: diff,
                        unit: item.unit,
                        cost: item.cost,
                        valueChange: valChange
                    });
                }
                
                return { ...item, currentQty: newQty };
            });
            
            // 1. Update Stock Quantities 
            await DataManager.batchUpdateStock(logCategory, updatedItems);
            
            // 2. Save Log if there are changes
            if (logItems.length > 0) {
                const newLog: InventoryLog = {
                    id: `log_${Date.now()}`,
                    date: new Date().toISOString().split('T')[0],
                    timestamp: new Date().toISOString(),
                    staffName: employee?.name || 'Unknown',
                    totalValueChange: totalValueChange,
                    items: logItems,
                    category: logCategory
                };
                await DataManager.saveInventoryLog(newLog);
            }

            // 3. If Task, Mark as Completed
            if (taskRef) {
                const completedTask: InventoryTask = {
                    ...taskRef,
                    status: 'COMPLETED',
                    completedAt: new Date().toISOString(),
                    items: taskRef.items.map(ti => ({
                        ...ti,
                        countedQty: counts[ti.stockId]
                    }))
                };
                await DataManager.saveInventoryTask(completedTask);
                setMyTask(null);
                setMode('CHECK'); // Return to normal view
                alert("✅ 任务完成 (Task Completed)!");
                loadTasks(); // Refresh tasks
            } else {
                alert("✅ Stock updated & Log saved!");
            }

            setItems(prev => prev.map(i => {
                const u = updatedItems.find(ui => ui.id === i.id);
                return u || i;
            }));
            setCheckedItems({}); 

        } catch (e) {
            console.error(e);
            alert("Failed to update stock.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveMaster = async () => {
        if (!editingItem || !editingItem.name) return alert("请输入物品名称 (Name required)");
        
        setIsSubmitting(true);
        
        try {
            const safeNum = (v: any) => {
                const n = parseFloat(v);
                return isNaN(n) ? 0 : n;
            };

            const newItem = {
                ...editingItem,
                id: editingItem.id || `${currentStockView.charAt(0)}_${Date.now()}`,
                currentQty: safeNum(editingItem.currentQty),
                minLevel: safeNum(editingItem.minLevel),
                maxQty: safeNum(editingItem.maxQty),
                cost: safeNum(editingItem.cost),
                unit: editingItem.unit || 'unit',
                category: editingItem.category || (CATEGORY_SECTIONS[currentStockView][0].id),
                isKeyItem: editingItem.isKeyItem || false,
                uomOptions: editingItem.uomOptions || [],
                weightPerUnit: safeNum(editingItem.weightPerUnit), 
                conversionUnit: editingItem.conversionUnit || 'kg' 
            } as StockItem;

            await DataManager.saveStockItem(currentStockView, newItem);
            setEditingItem(null);
            await loadStock(currentStockView);
        } catch (error) {
            console.error(error);
            alert("保存失败 (Failed to save)");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- ASSIGNMENT HANDLERS ---
    const toggleAssignSelect = (id: string) => {
        const newSet = new Set(selectedForAssign);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedForAssign(newSet);
    };

    const initiateAssignment = async () => {
        if (selectedForAssign.size === 0) return alert("请先选择物品 (Select items first)");
        const staff = await DataManager.getEmployees();
        setStaffList(staff.filter(s => !s.isArchived));
        setIsAssignModalOpen(true);
    };

    const confirmAssignment = async () => {
        if (!selectedAssignee) return alert("Select staff");
        const assignee = staffList.find(s => s.id === selectedAssignee);
        if (!assignee) return;

        const taskItems = items
            .filter(i => selectedForAssign.has(i.id))
            .map(i => ({
                stockId: i.id,
                stockName: i.name,
                category: currentStockView,
                currentQty: i.currentQty
            }));

        const newTask: InventoryTask = {
            id: `task_${Date.now()}`,
            createdAt: new Date().toISOString(),
            creatorId: employee?.id || 'admin',
            creatorName: employee?.name || 'Admin',
            assigneeId: assignee.id,
            assigneeName: assignee.name,
            status: 'PENDING',
            items: taskItems
        };

        await DataManager.saveInventoryTask(newTask);
        setIsAssignModalOpen(false);
        setSelectedForAssign(new Set());
        setMode('CHECK'); // Exit assign mode
        loadTasks(); // Refresh list immediately
        alert(`✅ 任务已派发给 ${assignee.name}`);
    };

    const startTaskExecution = async (task: InventoryTask) => {
        // 1. Determine category from first item
        const cat = (task.items[0]?.category as any) || 'KITCHEN';
        setCurrentStockView(cat); // Switch tab
        
        // 2. Load stock to ensure we have latest data
        const stockData = await DataManager.getStock(cat);
        // Filter UI to ONLY items in the task
        setItems(stockData.filter(i => task.items.some(ti => ti.stockId === i.id)));
        
        // 3. Set Counts
        const initialCounts: Record<string, number> = {};
        stockData.forEach(item => { initialCounts[item.id] = item.currentQty; });
        setCounts(initialCounts);
        
        setMyTask(task);
        setMode('CHECK'); // Enter check mode
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const executeDelete = async () => {
        if (editingItem && editingItem.id) {
            await DataManager.deleteStockItem(currentStockView, editingItem.id);
            loadStock(currentStockView);
            setEditingItem(null);
            setShowDeleteConfirm(false);
        }
    };

    // UOM Handlers
    const addUomOption = () => { 
        const current = editingItem?.uomOptions || [];
        setEditingItem({ ...editingItem, uomOptions: [...current, { label: '', value: '', ratio: 1 }] }); 
    };
    const updateUomOption = (idx: number, field: keyof UomOption, value: any) => { 
        const current = [...(editingItem?.uomOptions || [])];
        current[idx] = { ...current[idx], [field]: value };
        setEditingItem({ ...editingItem, uomOptions: current });
    };
    const removeUomOption = (idx: number) => {
        const current = [...(editingItem?.uomOptions || [])];
        current.splice(idx, 1);
        setEditingItem({ ...editingItem, uomOptions: current });
    };

    // --- FILTER LOGIC ---
    const filteredItems = items.filter(i => {
        const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = searchTerm ? true : (checkFilter === 'DAILY' ? i.isKeyItem : true);
        return matchesSearch && matchesType;
    });

    const totalInventoryValue = useMemo(() => {
        return filteredItems.reduce((acc, item) => acc + (item.currentQty * item.cost), 0);
    }, [filteredItems]);

    // --- EXPORT LOGIC ---
    const handleCategoryToggle = (key: keyof typeof exportConfig.categories) => {
        setExportConfig(prev => ({
            ...prev,
            categories: { ...prev.categories, [key]: !prev.categories[key] }
        }));
    };

    const executeExport = async () => {
        setIsGeneratingPdf(true);
        setIsExportModalOpen(false);

        try {
            const promises = [];
            if (exportConfig.categories.KITCHEN) promises.push(DataManager.getStock('KITCHEN'));
            if (exportConfig.categories.BAR) promises.push(DataManager.getStock('BAR'));
            if (exportConfig.categories.GENERAL) promises.push(DataManager.getStock('GENERAL'));
            if (exportConfig.categories.FUEL) promises.push(DataManager.getStock('FUEL'));

            const results = await Promise.all(promises);
            let allItems = results.flat();

            if (exportConfig.lowStockOnly) {
                allItems = allItems.filter(i => i.currentQty <= i.minLevel);
            }

            // Sort by Category then Name
            allItems.sort((a, b) => {
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                return a.name.localeCompare(b.name);
            });

            // Chunking
            const chunkSize = 25;
            const chunks = [];
            for (let i = 0; i < allItems.length; i += chunkSize) {
                chunks.push(allItems.slice(i, i + chunkSize));
            }
            setPrintChunks(chunks);

            // Wait for render
            await new Promise(r => setTimeout(r, 1000));

            if (!printRef.current) throw new Error("Print ref not found");

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            
            for (let i = 0; i < chunks.length; i++) {
                const pageId = `print-page-${i}`;
                const element = document.getElementById(pageId);
                if (!element) continue;

                if (i > 0) pdf.addPage();

                const canvas = await html2canvas(element, { 
                    scale: 2, 
                    useCORS: true, 
                    backgroundColor: '#ffffff' 
                });
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const imgProps = pdf.getImageProperties(imgData);
                const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
            }

            pdf.save(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (e) {
            console.error(e);
            alert("Export failed");
        } finally {
            setIsGeneratingPdf(false);
            setPrintChunks([]);
        }
    };

    // --- ITEM CARD RENDERER ---
    const renderItemCard = (item: StockItem) => {
        const isOutOfStock = item.currentQty <= 0;
        const isLowStock = !isOutOfStock && item.currentQty <= item.minLevel;
        
        // ASSIGN MODE CARD
        if (mode === 'ASSIGN') {
            const isSelected = selectedForAssign.has(item.id);
            return (
                <div 
                    key={item.id} 
                    onClick={() => toggleAssignSelect(item.id)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${isSelected ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-200'}`}
                >
                    <div>
                        <div className="font-bold text-sm text-[#1A1A1A]">{item.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">#{item.id}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'}`}>
                        {isSelected && <Check size={14} strokeWidth={3}/>}
                    </div>
                </div>
            );
        }

        // CHECK MODE CARD
        if (mode === 'CHECK') {
            const isChecked = checkedItems[item.id];
            
            return (
                <div key={item.id} className={`p-3 rounded-xl border flex justify-between items-center transition-all ${isChecked ? 'bg-green-50 border-green-300 opacity-80' : isOutOfStock ? 'border-red-300 bg-red-50' : isLowStock ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
                    <div className={isChecked ? 'opacity-50' : ''}>
                        <div className="font-bold text-sm text-[#1A1A1A]">{item.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex gap-2">
                            <span className="bg-white/50 px-1 rounded">#{item.id}</span>
                            <span>Min: {item.minLevel} {item.unit}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleCountChange(item.id, (counts[item.id] || 0) - 1)} className="p-2 bg-white/50 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 shadow-sm text-gray-600"><Minus size={14}/></button>
                        <input 
                            type="number" 
                            className={`w-14 p-2 text-center rounded-lg font-bold outline-none border shadow-inner ${isChecked ? 'bg-green-100 border-green-200 text-green-800' : 'bg-white border-gray-200 focus:border-blue-500'}`}
                            value={counts[item.id] !== undefined ? counts[item.id] : ''}
                            onChange={(e) => handleCountChange(item.id, parseFloat(e.target.value))}
                        />
                        <button onClick={() => handleCountChange(item.id, (counts[item.id] || 0) + 1)} className="p-2 bg-white/50 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 shadow-sm text-gray-600"><Plus size={14}/></button>
                        
                        {/* CONFIRM CHECK BUTTON */}
                        <button 
                            onClick={() => toggleItemChecked(item.id)} 
                            className={`p-2 rounded-lg border transition-all active:scale-95 ${isChecked ? 'bg-green-500 border-green-600 text-white shadow-inner' : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-white hover:border-green-300 hover:text-green-500'}`}
                        >
                            <Check size={16} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            );
        } else {
            // MASTER MODE CARD
            return (
                <div 
                    key={item.id} 
                    onClick={() => setEditingItem(item)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer active:scale-95 hover:border-blue-300 ${isOutOfStock ? 'border-red-300 bg-red-50' : isLowStock ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-white'} shadow-sm hover:shadow-md`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="font-bold text-sm text-[#1A1A1A]">{item.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono font-bold bg-white/50 px-1.5 py-0.5 rounded w-fit mt-1 border border-black/5">#{item.id}</div>
                        </div>
                        <div className="p-1 bg-white/50 rounded-lg text-gray-400"><Edit3 size={14}/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                        <div>Qty: <span className={`font-bold ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-black'}`}>{item.currentQty}</span></div>
                        <div>Min: <span className="font-bold text-black">{item.minLevel}</span></div>
                        <div>Cost: <span className="font-bold text-black">RM {item.cost.toFixed(2)}</span></div>
                        <div>Unit: <span className="font-bold text-black uppercase">{item.unit}</span></div>
                    </div>
                </div>
            );
        }
    };

    const renderLogCard = (log: InventoryLog) => {
        const isExpanded = expandedLogId === log.id;
        const changeCount = log.items.length;
        const isPositive = log.totalValueChange >= 0;

        return (
            <div key={log.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-3 group">
                <div 
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs border-2 ${isPositive ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {isPositive ? '+' : '-'}{Math.abs(log.totalValueChange).toFixed(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-black text-[#1A1A1A]">{log.date}</span>
                                <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-bold">{new Date(log.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                            </div>
                            <div className="text-xs text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                                <User size={12}/> {log.staffName} • {changeCount} items changed
                            </div>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                </div>

                {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100 p-2">
                        <table className="w-full text-left text-xs">
                            <thead className="text-gray-400 font-bold uppercase border-b border-gray-200">
                                <tr>
                                    <th className="p-2">Item</th>
                                    <th className="p-2 text-center">Old ➔ New</th>
                                    <th className="p-2 text-right">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {log.items.map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 last:border-0">
                                        <td className="p-2 font-bold text-[#1A1A1A]">{item.stockName}</td>
                                        <td className="p-2 text-center text-gray-600">
                                            {item.oldQty} ➔ <span className="font-black">{item.newQty}</span>
                                        </td>
                                        <td className={`p-2 text-right font-mono font-bold ${item.valueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.valueChange > 0 ? '+' : ''}{item.valueChange.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 pb-32 flex flex-col bg-[#F5F7FA] min-h-screen">
            {/* Header - HIDDEN if restricted user to prevent navigating */}
            {!isRestrictedView && (
                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 shrink-0">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto overflow-x-auto">
                        <button onClick={() => handleViewChange('KITCHEN')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentStockView === 'KITCHEN' ? 'bg-[#1A1A1A] text-[#FFD700]' : 'text-gray-500 hover:bg-gray-50'}`}>Kitchen</button>
                        <button onClick={() => handleViewChange('BAR')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentStockView === 'BAR' ? 'bg-[#1A1A1A] text-[#FFD700]' : 'text-gray-500 hover:bg-gray-50'}`}>Bar</button>
                        <button onClick={() => handleViewChange('GENERAL')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentStockView === 'GENERAL' ? 'bg-[#1A1A1A] text-[#FFD700]' : 'text-gray-500 hover:bg-gray-50'}`}>General</button>
                        {/* NEW: FUEL TAB */}
                        <button onClick={() => handleViewChange('FUEL')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${currentStockView === 'FUEL' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}><Flame size={12}/> Fuel</button>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-grow md:flex-grow-0 md:w-64">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                            <input 
                                type="text" 
                                placeholder="Search item..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#FFD700]"
                            />
                        </div>
                        
                        <button 
                            onClick={() => loadTasks()} 
                            className="bg-gray-100 text-gray-500 p-2 rounded-xl shadow-sm hover:bg-gray-200 hover:text-black transition-colors"
                            title="Refresh Tasks"
                        >
                            <RefreshCw size={18}/>
                        </button>

                        {mode === 'MASTER' && (
                            <>
                                <button 
                                    onClick={() => setIsExportModalOpen(true)} 
                                    disabled={isGeneratingPdf}
                                    className="bg-white border border-gray-200 text-gray-600 p-2 rounded-xl shadow-sm hover:bg-gray-50 disabled:opacity-50"
                                    title="Export PDF"
                                >
                                    {isGeneratingPdf ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18}/>}
                                </button>
                                <button onClick={() => setEditingItem({ category: CATEGORY_SECTIONS[currentStockView][0].id, unit: 'unit' })} className="bg-[#1A1A1A] text-[#FFD700] p-2 rounded-xl shadow-sm hover:bg-black"><Plus size={18}/></button>
                            </>
                        )}
                        <ModuleGuideButton module="INVENTORY" dark />
                    </div>
                </div>
            )}

            {/* Sub-Header: Mode Switcher (Master Only) & Filters - HIDDEN if restricted */}
            {!isRestrictedView && (
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-4 px-1 gap-4">
                    <div className="flex gap-3 items-center flex-wrap">
                        {mode === 'MASTER' && (
                            <div className="flex bg-gray-200 p-1 rounded-lg">
                                <button onClick={() => setViewType('LIST')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewType === 'LIST' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}><Box size={12}/> List</button>
                                <button onClick={() => setViewType('HISTORY')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewType === 'HISTORY' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}><History size={12}/> History</button>
                                {/* NEW: Tasks Tab */}
                                <button onClick={() => setViewType('TASKS')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewType === 'TASKS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}><ClipboardList size={12}/> Tasks</button>
                            </div>
                        )}

                        {viewType === 'LIST' && (
                            <div className="flex bg-gray-200 p-1 rounded-lg">
                                <button onClick={() => setCheckFilter('DAILY')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${checkFilter === 'DAILY' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}><Calendar size={12}/> Daily</button>
                                <button onClick={() => setCheckFilter('WEEKLY')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${checkFilter === 'WEEKLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}><CalendarDays size={12}/> Weekly</button>
                            </div>
                        )}

                        {/* ASSIGN TOGGLE (MASTER ONLY) */}
                        {mode === 'MASTER' && viewType === 'LIST' && (
                            <button 
                                onClick={() => setMode(prev => prev === 'ASSIGN' ? 'MASTER' : 'ASSIGN')} 
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${mode === 'ASSIGN' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200'}`}
                            >
                                <Send size={12}/> {mode === 'ASSIGN' ? 'Exit Assignment' : 'Assign Task'}
                            </button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {mode === 'MASTER' && viewType === 'LIST' && (
                            <div className="text-right bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 flex items-center gap-3">
                                <div className="text-emerald-500 bg-white p-1 rounded-full"><DollarSign size={14}/></div>
                                <div className="text-right">
                                    <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Total Value</div>
                                    <div className="text-sm md:text-base font-black text-emerald-700 font-mono">RM {totalInventoryValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                </div>
                            </div>
                        )}
                        {viewType === 'LIST' && (
                            <div className="text-right px-2">
                                <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Items</div>
                                <div className="text-sm md:text-base font-black text-[#1A1A1A]">{filteredItems.length}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* RESTRICTED MODE HEADER (FOR ASSIGNED STAFF) */}
            {isRestrictedView && (
                <div className="mb-4 bg-blue-50 border border-blue-200 p-3 rounded-xl flex justify-between items-center animate-in fade-in">
                    <div className="flex items-center gap-2 text-blue-800">
                        <ClipboardList size={18}/>
                        <span className="font-black text-sm">我的任务 (My Tasks)</span>
                    </div>
                    <button onClick={loadTasks} className="p-2 bg-white rounded-lg text-blue-600 hover:bg-blue-100 shadow-sm"><RefreshCw size={14}/></button>
                </div>
            )}

            {/* Content Area */}
            <div className="space-y-4">
                
                {/* 0. PENDING TASKS ALERT (For Check Mode Users) - UPDATED VISIBILITY */}
                {mode === 'CHECK' && !myTask && (
                    <div className="mb-4">
                         {pendingTasks.length > 0 ? (
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl shadow-md flex flex-col gap-3 animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h4 className="font-black text-blue-900 text-sm flex items-center gap-2">
                                            <ClipboardList size={16}/> 待办任务 ({pendingTasks.length})
                                        </h4>
                                        <p className="text-[10px] text-blue-600 mt-1">您有新的盘点任务，请点击开始。</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {pendingTasks.map(t => (
                                        <div key={t.id} className="bg-white p-3 rounded-lg border border-blue-100 flex justify-between items-center shadow-sm">
                                            <div>
                                                <div className="text-xs font-bold text-gray-700">From: {t.creatorName}</div>
                                                <div className="text-[10px] text-gray-400">{new Date(t.createdAt).toLocaleString()} • {t.items.length} items</div>
                                            </div>
                                            <button 
                                                onClick={() => startTaskExecution(t)}
                                                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-700 shadow-sm transition-colors"
                                            >
                                                <PlayCircle size={14}/> 开始
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         ) : (
                            isRestrictedView && (
                                <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                    <CheckSquare size={48} className="mb-2 opacity-20"/>
                                    <p className="font-bold">暂无待办任务</p>
                                    <p className="text-xs text-gray-300 mt-1">No pending tasks assigned to you.</p>
                                </div>
                            )
                         )}
                    </div>
                )}

                {/* 1. TASK CENTER (New View) */}
                {viewType === 'TASKS' && mode === 'MASTER' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                        <div className="mb-4 flex justify-between items-center">
                            <h3 className="font-black text-lg text-[#1A1A1A]">任务派发记录 (Assignment Log)</h3>
                            <button onClick={loadTasks} className="text-xs bg-gray-100 p-2 rounded-lg hover:bg-gray-200"><History size={14}/></button>
                        </div>
                        {taskList.length === 0 ? <div className="text-center py-20 text-gray-400 font-bold">暂无任务记录</div> : taskList.map(task => (
                            <div key={task.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {task.status === 'COMPLETED' ? <CheckCircle2 size={16}/> : <Clock size={16}/>}
                                        </div>
                                        <div>
                                            <span className="font-bold text-sm text-[#1A1A1A]">To: {task.assigneeName}</span>
                                            <div className="text-[10px] text-gray-400">{new Date(task.createdAt).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${task.status === 'COMPLETED' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>{task.status}</span>
                                </div>
                                <div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-600">
                                    <p className="font-bold mb-1">Items ({task.items.length}):</p>
                                    <div className="flex flex-wrap gap-1">
                                        {task.items.map((i, idx) => (
                                            <span key={idx} className="bg-white border px-1.5 py-0.5 rounded text-[10px]">{i.stockName} {task.status === 'COMPLETED' ? `(${i.countedQty})` : ''}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 2. HISTORY LOGS */}
                {viewType === 'HISTORY' && mode === 'MASTER' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                        {logs.length === 0 ? <div className="text-center py-20 text-gray-400 font-bold">暂无盘点记录 (No History)</div> : logs.map(log => renderLogCard(log))}
                    </div>
                )}

                {/* 3. STOCK LIST (Standard) - Only show if NOT restricted view OR if active task is running (which uses same viewType but filters items) */}
                {viewType === 'LIST' && (!isRestrictedView || myTask) && (
                    CATEGORY_SECTIONS[currentStockView]?.map(section => {
                        const sectionItems = filteredItems.filter(i => i.category === section.id);
                        if (sectionItems.length === 0) return null;
                        
                        const isSearching = searchTerm.length > 0;
                        const isExpanded = expandedSections[section.id] || isSearching || mode === 'ASSIGN' || !!myTask; // Auto expand in task mode
                        const outOfStockCount = sectionItems.filter(i => i.currentQty <= 0).length;
                        const lowStockCount = sectionItems.filter(i => i.currentQty > 0 && i.currentQty <= i.minLevel).length;

                        return (
                            <div key={section.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500 bg-white/50 rounded-2xl p-1 md:p-2 border border-transparent">
                                <div onClick={() => toggleSection(section.id)} className={`px-3 md:px-4 py-3 md:py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-between cursor-pointer transition-all shadow-sm ${section.color} hover:brightness-95 select-none active:scale-[0.98]`}>
                                    <div className="flex items-center gap-2">
                                        <Layers size={16}/> 
                                        <span className="truncate max-w-[150px] md:max-w-[200px]">{section.label}</span>
                                        <span className="bg-white/30 px-2 py-0.5 rounded-full text-[9px] text-current">{sectionItems.length}</span>
                                        {outOfStockCount > 0 && <div className="flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-full shadow-sm ml-1 animate-pulse border border-red-400"><AlertTriangle size={10} fill="currentColor" /><span className="text-[10px] font-black">{outOfStockCount}</span></div>}
                                        {lowStockCount > 0 && <div className="flex items-center gap-1 bg-yellow-400 text-black px-2 py-0.5 rounded-full shadow-sm ml-1 border border-yellow-500"><AlertTriangle size={10} fill="currentColor" /><span className="text-[10px] font-black">{lowStockCount}</span></div>}
                                    </div>
                                    {isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                                </div>
                                {isExpanded && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 mt-2 md:mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {sectionItems.map(item => renderItemCard(item))}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* MY TASK OVERLAY (Active Execution) */}
            {myTask && (
                <div className="fixed bottom-20 left-4 right-4 bg-[#1A1A1A] text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between animate-in slide-in-from-bottom-4">
                    <div>
                        <p className="text-xs font-bold text-[#FFD700] uppercase mb-1">Active Task</p>
                        <p className="font-black text-sm">Counting {myTask.items.length} items...</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setMyTask(null); setMode(employee?.role.includes('Owner') ? 'MASTER' : 'CHECK'); }} className="px-3 py-2 rounded-lg bg-white/10 text-xs font-bold hover:bg-white/20">Cancel</button>
                        <button onClick={() => handleSubmitCheck(myTask)} disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-[#FFD700] text-black text-xs font-black hover:bg-yellow-400 shadow-md">
                            {isSubmitting ? 'Saving...' : 'Submit Task'}
                        </button>
                    </div>
                </div>
            )}

            {/* Footer Actions (Check Mode) */}
            {mode === 'CHECK' && !myTask && !isRestrictedView && (
                <div className="fixed bottom-0 left-0 w-full bg-white p-4 border-t border-gray-200 md:static md:bg-transparent md:border-0 md:p-0 mt-4">
                    <button onClick={() => handleSubmitCheck()} disabled={isSubmitting} className="w-full bg-[#1A1A1A] text-[#FFD700] py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2">
                        <CheckCircle2 size={20}/> {isSubmitting ? 'Saving...' : 'Submit Count'}
                    </button>
                </div>
            )}
            
            {/* Footer Actions (Assign Mode) */}
            {mode === 'ASSIGN' && (
                <div className="fixed bottom-0 left-0 w-full bg-indigo-50 p-4 border-t border-indigo-100 md:static md:bg-transparent md:border-0 md:p-0 mt-4">
                    <button onClick={initiateAssignment} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                        <Send size={20}/> 指派 {selectedForAssign.size} 个物品 (Assign)
                    </button>
                </div>
            )}

            {/* MASTER MODE EDIT MODAL */}
            {editingItem && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full h-full md:max-w-lg md:h-auto md:max-h-[90vh] md:rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col relative overflow-hidden">
                        
                        {/* Header */}
                        <div className="p-4 md:p-6 pb-2 shrink-0 border-b md:border-0 border-gray-100 bg-white z-10 sticky top-0">
                            <div className="flex justify-between items-center mb-4 md:mb-6">
                                <h3 className="font-black text-xl md:text-2xl text-[#1A1A1A] flex items-center gap-2">
                                    <Edit3 size={24}/> {editingItem.id ? '编辑物品 (Edit)' : '新增物品 (New)'}
                                </h3>
                                <button onClick={() => setEditingItem(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
                            </div>

                            {/* DAILY KEY ITEM TOGGLE */}
                            <div className={`p-4 rounded-2xl border-2 transition-all flex justify-between items-center ${editingItem.isKeyItem ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                                <div>
                                    <div className={`text-sm font-black uppercase flex items-center gap-2 ${editingItem.isKeyItem ? 'text-red-600' : 'text-gray-400'}`}>
                                        <AlertTriangle size={16} fill={editingItem.isKeyItem ? "currentColor" : "none"}/> 每日必盘 (DAILY KEY ITEM)
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-bold mt-1">Mark as high priority for daily check</div>
                                </div>
                                <div 
                                    onClick={() => setEditingItem({...editingItem, isKeyItem: !editingItem.isKeyItem})}
                                    className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${editingItem.isKeyItem ? 'bg-red-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${editingItem.isKeyItem ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>

                        {/* Form Content - Scrollable */}
                        <div className="p-4 md:p-6 space-y-6 overflow-y-auto flex-grow bg-[#F9FAFB] md:bg-white pb-24 md:pb-6">
                            {/* Basic Info */}
                            <div>
                                <label className={LABEL_STYLE}>Item Name</label>
                                <input className={INPUT_STYLE} value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="e.g. Pork Slices" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL_STYLE}>ID Code</label>
                                    <input className={`${INPUT_STYLE} font-mono`} value={editingItem.id || 'Auto'} readOnly={!!editingItem.id} placeholder="Auto" />
                                </div>
                                <div>
                                    <label className={LABEL_STYLE}>Base Unit (基础)</label>
                                    <input className={INPUT_STYLE} value={editingItem.unit || ''} onChange={e => setEditingItem({...editingItem, unit: e.target.value})} placeholder="kg/pkt" />
                                </div>
                            </div>

                            <div>
                                <label className={LABEL_STYLE}>Sub Category (分类)</label>
                                <select className={INPUT_STYLE} value={editingItem.category || CATEGORY_SECTIONS[currentStockView][0].id} onChange={e => setEditingItem({...editingItem, category: e.target.value})}>
                                    {CATEGORY_SECTIONS[currentStockView].map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={LABEL_STYLE}>Min Level</label><input type="number" className={`${INPUT_STYLE} text-center text-orange-600`} value={editingItem.minLevel ?? ''} onChange={e => setEditingItem({...editingItem, minLevel: parseFloat(e.target.value)})} placeholder="0" /></div>
                                <div><label className={LABEL_STYLE}>Current</label><input type="number" className={`${INPUT_STYLE} text-center`} value={editingItem.currentQty ?? ''} onChange={e => setEditingItem({...editingItem, currentQty: parseFloat(e.target.value)})} placeholder="0" /></div>
                                <div><label className={LABEL_STYLE}>Cost (RM)</label><input type="number" className={`${INPUT_STYLE} text-center`} value={editingItem.cost ?? ''} onChange={e => setEditingItem({...editingItem, cost: parseFloat(e.target.value)})} placeholder="0.00" /></div>
                            </div>

                            {/* Conversion Setup - Removed Condition to allow for all units including KG */}
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200">
                                <h4 className="text-xs font-black text-orange-800 uppercase flex items-center gap-2 mb-2">
                                    <Scale size={14}/> 基础换算设置 (Base Conversion)
                                </h4>
                                <p className="text-[10px] text-orange-600 mb-3 leading-tight">
                                    设置基础单位 (如: {editingItem.unit || 'Pkt'}) 对应的重量或数量，以便食谱计算成本。
                                </p>
                                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-orange-100 shadow-sm">
                                    <span className="text-xs font-bold text-gray-500 whitespace-nowrap">1 {editingItem.unit || 'UNIT'} = </span>
                                    <div className="relative flex-1 flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={editingItem.weightPerUnit ?? ''} 
                                            onChange={e => setEditingItem({...editingItem, weightPerUnit: parseFloat(e.target.value)})}
                                            className="flex-1 p-2 bg-transparent font-black text-center text-orange-900 outline-none placeholder-gray-300 border-b border-orange-100 focus:border-orange-300 transition-colors"
                                            placeholder="0.00"
                                        />
                                        <select
                                            value={editingItem.conversionUnit || 'kg'}
                                            onChange={e => setEditingItem({...editingItem, conversionUnit: e.target.value})}
                                            className="w-20 p-2 bg-orange-50 rounded-lg text-xs font-bold text-orange-800 outline-none border-none cursor-pointer"
                                        >
                                            <option value="kg">KG</option>
                                            <option value="g">GRAM</option>
                                            <option value="pcs">PCS (粒/只)</option>
                                            <option value="slice">SLICE (片)</option>
                                            <option value="portion">PORTION (份)</option>
                                            <option value="ml">ML</option>
                                            <option value="l">LITER</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Smart Unit Config - GREEN CARD STYLE (Fig 1) */}
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-xs font-black text-gray-600 uppercase flex items-center gap-2"><Calculator size={14}/> 多单位设置 (SMART UNIT CONFIG)</h4>
                                    <button onClick={addUomOption} className="text-[10px] bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 font-bold">+ Add Unit</button>
                                </div>
                                
                                <div className="space-y-3">
                                    {editingItem.uomOptions && editingItem.uomOptions.length > 0 ? (
                                        editingItem.uomOptions.map((uom, idx) => (
                                            <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group">
                                                {/* Row 1: Header Inputs */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="p-1.5 bg-green-100 text-green-700 rounded-lg"><Box size={14}/></div>
                                                    <input 
                                                        className="w-24 p-1.5 border border-gray-200 rounded text-xs font-black uppercase outline-none focus:border-green-500" 
                                                        placeholder="UNIT NAME" 
                                                        value={uom.value} 
                                                        onChange={e => updateUomOption(idx, 'value', e.target.value)} 
                                                    />
                                                    <div className="flex items-center border border-gray-200 rounded px-2 bg-gray-50">
                                                        <span className="text-[10px] text-gray-400 font-bold mr-1">RM</span>
                                                        <input 
                                                            type="number" 
                                                            className="w-16 bg-transparent text-xs font-bold outline-none py-1.5" 
                                                            placeholder="Auto"
                                                            value={uom.price || ''}
                                                            onChange={e => updateUomOption(idx, 'price', parseFloat(e.target.value))}
                                                        />
                                                    </div>
                                                    <button onClick={() => removeUomOption(idx)} className="ml-auto text-red-300 hover:text-red-500"><Trash2 size={14}/></button>
                                                </div>

                                                {/* Row 2: Logic Visualization */}
                                                <div className="flex items-center gap-2 bg-green-50 p-2 rounded-lg border border-green-100">
                                                    <span className="text-[9px] font-bold text-green-700 bg-white px-1.5 py-0.5 rounded border border-green-100">大单位 (Larger)</span>
                                                    <ArrowRightLeft size={10} className="text-green-400"/>
                                                    <span className="text-[9px] font-bold text-gray-400">小单位 (Smaller)</span>
                                                    
                                                    <div className="flex-grow flex justify-end items-center gap-2">
                                                        <span className="text-xs font-black text-green-800">1 {uom.value || 'UNIT'} = </span>
                                                        <input 
                                                            type="number" 
                                                            className="w-12 p-1 text-center font-black border-b-2 border-green-500 bg-transparent outline-none text-green-900"
                                                            value={uom.ratio} 
                                                            onChange={e => updateUomOption(idx, 'ratio', parseFloat(e.target.value))} 
                                                        />
                                                        <span className="text-xs font-black text-gray-500">{editingItem.unit || 'BASE'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-[10px] text-gray-400 italic text-center py-4 border-2 border-dashed border-gray-200 rounded-xl">
                                            暂无额外单位配置 (e.g. 1 箱 = 24 瓶)
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Supplier Links (Read Only / Display) */}
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                <h4 className="text-xs font-black text-gray-600 uppercase flex items-center gap-2 mb-3"><LinkIcon size={14}/> 供应商关联 (SUPPLIER LINKS)</h4>
                                {linkedSuppliers.length > 0 ? (
                                    <div className="space-y-2">
                                        {linkedSuppliers.map(s => (
                                            <div key={s.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200 text-xs">
                                                <div className="bg-blue-50 text-blue-600 p-1 rounded"><Package size={12}/></div>
                                                <span className="font-bold text-[#1A1A1A] truncate flex-1">{s.name}</span>
                                                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.id}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-gray-400 italic text-center py-2 bg-white rounded-xl border border-gray-100">
                                        暂无关联供应商 (No links)
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer - Fixed at bottom */}
                        <div className="p-4 border-t border-gray-100 bg-white rounded-b-3xl flex gap-3 shrink-0 fixed bottom-0 left-0 right-0 md:relative md:bottom-auto z-20">
                            {editingItem.id && (
                                <button onClick={handleDeleteClick} className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors">
                                    <Trash2 size={20}/>
                                </button>
                            )}
                            <button onClick={() => setEditingItem(null)} className="flex-1 py-4 bg-white border-2 border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-colors">
                                取消
                            </button>
                            <button 
                                onClick={handleSaveMaster} 
                                disabled={isSubmitting}
                                className="flex-[2] py-4 bg-[#1A1A1A] text-[#FFD700] font-black rounded-2xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} 
                                {isSubmitting ? '保存中...' : '保存更改'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center border-t-8 border-red-500 animate-in zoom-in-95">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                            <Trash2 size={32} className="text-red-600"/>
                        </div>
                        <h3 className="font-black text-2xl text-[#1A1A1A] mb-2">确认删除?</h3>
                        <p className="text-sm text-gray-500 font-bold mb-6">您确定要删除 <span className="text-red-600">{editingItem?.name}</span> 吗？<br/>此操作无法撤销。</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setShowDeleteConfirm(false)} className="py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">取消 (Cancel)</button>
                            <button onClick={executeDelete} className="py-3 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"><Trash2 size={16}/> 确认删除</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ASSIGNMENT MODAL */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-[#1A1A1A]">指派任务 (Assign Task)</h3>
                            <button onClick={() => setIsAssignModalOpen(false)}><X size={20}/></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4 font-bold">您已选择 {selectedForAssign.size} 个物品进行盘点指派。</p>
                        
                        <div className="mb-6">
                            <label className={LABEL_STYLE}>Assign To (指派给)</label>
                            <select 
                                value={selectedAssignee} 
                                onChange={e => setSelectedAssignee(e.target.value)} 
                                className={INPUT_STYLE}
                            >
                                <option value="">Select Staff...</option>
                                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role.split('(')[0]})</option>)}
                            </select>
                        </div>

                        <button onClick={confirmAssignment} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-lg shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
                            <Send size={18}/> 确认指派
                        </button>
                    </div>
                </div>
            )}

            {/* EXPORT CONFIG MODAL (OPTION A) */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 border-t-8 border-[#1A1A1A]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-[#1A1A1A] flex items-center gap-2">
                                <Printer size={20}/> 导出库存报表
                            </h3>
                            <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                        </div>

                        <div className="space-y-6 mb-6">
                            {/* Category Selection */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase mb-3 block">选择导出区域 (Categories)</label>
                                <div className="space-y-2">
                                    {Object.entries(exportConfig.categories).map(([key, checked]) => (
                                        <div 
                                            key={key} 
                                            onClick={() => handleCategoryToggle(key as keyof typeof exportConfig.categories)}
                                            className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300'}`}
                                        >
                                            <span className="font-bold text-sm text-[#1A1A1A]">{CATEGORY_SECTIONS[key] ? CATEGORY_SECTIONS[key][0].label.split('(')[0] : key} 区域</span>
                                            {checked ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20} className="text-gray-300"/>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Options */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase mb-1 block">高级选项 (Options)</label>
                                <div 
                                    onClick={() => setExportConfig(prev => ({...prev, showCost: !prev.showCost}))}
                                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${exportConfig.showCost ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-300'}`}
                                >
                                    <div>
                                        <span className="font-bold text-sm text-[#1A1A1A]">显示成本与价值 (Show Value)</span>
                                        <p className="text-[10px] text-gray-500 mt-0.5">适合财务/老板查阅</p>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${exportConfig.showCost ? 'bg-green-500' : 'bg-gray-300'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${exportConfig.showCost ? 'translate-x-4' : ''}`}></div>
                                    </div>
                                </div>
                                <div 
                                    onClick={() => setExportConfig(prev => ({...prev, lowStockOnly: !prev.lowStockOnly}))}
                                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${exportConfig.lowStockOnly ? 'border-red-500 bg-red-50' : 'border-gray-100 hover:border-gray-300'}`}
                                >
                                    <div>
                                        <span className="font-bold text-sm text-[#1A1A1A]">仅导出缺货 (Low Stock Only)</span>
                                        <p className="text-[10px] text-gray-500 mt-0.5">适合快速补货</p>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${exportConfig.lowStockOnly ? 'bg-red-500' : 'bg-gray-300'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${exportConfig.lowStockOnly ? 'translate-x-4' : ''}`}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={executeExport} 
                            disabled={!Object.values(exportConfig.categories).some(Boolean) || isGeneratingPdf}
                            className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-2xl font-black text-lg shadow-lg hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
                        >
                            {isGeneratingPdf ? <Loader2 size={20} className="animate-spin"/> : <FileDown size={20}/>} 
                            {isGeneratingPdf ? '生成中 (Generating)...' : '确认导出 PDF'}
                        </button>
                    </div>
                </div>
            )}

            {/* HIDDEN PRINT TEMPLATE FOR PDF */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                <div ref={printRef}>
                    {printChunks.map((chunk, pageIndex) => (
                        <div key={pageIndex} id={`print-page-${pageIndex}`} className="w-[210mm] min-h-[297mm] bg-white p-10 font-sans text-black relative flex flex-col">
                            {/* Header (Repeated on every page) */}
                            <div className="border-b-4 border-black pb-4 mb-6 flex justify-between items-end">
                                <div>
                                    <h1 className="text-3xl font-black uppercase tracking-widest mb-1">INVENTORY REPORT</h1>
                                    <p className="text-sm font-bold text-gray-500">KIM LIAN KEE (KEPONG)</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Generated On</p>
                                    <p className="text-lg font-mono font-black">{new Date().toLocaleDateString()}</p>
                                </div>
                            </div>

                            {/* Table */}
                            <table className="w-full text-left border-collapse mb-8">
                                <thead>
                                    <tr className="bg-black text-white text-[10px] uppercase tracking-wider">
                                        <th className="p-2 w-16 text-center border-r border-gray-600">ID</th>
                                        <th className="p-2 w-24 border-r border-gray-600">Category</th>
                                        <th className="p-2 border-r border-gray-600">Item Name</th>
                                        <th className="p-2 w-16 text-center border-r border-gray-600">Unit</th>
                                        <th className="p-2 w-16 text-center border-r border-gray-600">Min</th>
                                        <th className="p-2 w-20 text-center border-r border-gray-600">Current</th>
                                        <th className="p-2 w-20 border-r border-gray-600">Check</th>
                                        {exportConfig.showCost && (
                                            <>
                                                <th className="p-2 w-20 text-right border-r border-gray-600">Cost</th>
                                                <th className="p-2 w-24 text-right">Value</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {chunk.map((item, idx) => (
                                        <tr key={item.id} className="border-b border-gray-200 break-inside-avoid">
                                            <td className="p-2 text-center font-mono text-gray-500 bg-gray-50 border-r border-gray-200">{item.id}</td>
                                            <td className="p-2 font-bold text-gray-700 uppercase border-r border-gray-200">{getCategoryLabel(item.category)}</td>
                                            <td className="p-2 font-bold border-r border-gray-200">{item.name}</td>
                                            <td className="p-2 text-center uppercase font-mono text-gray-500 border-r border-gray-200">{item.unit}</td>
                                            <td className="p-2 text-center font-bold text-gray-400 border-r border-gray-200">{item.minLevel}</td>
                                            <td className="p-2 text-center font-black border-r border-gray-200 text-lg">{item.currentQty}</td>
                                            <td className="p-2 border-r border-gray-200">
                                                <div className="w-full h-6 border-b border-gray-300"></div> {/* Blank line for writing */}
                                            </td>
                                            {exportConfig.showCost && (
                                                <>
                                                    <td className="p-2 text-right font-mono border-r border-gray-200">{item.cost.toFixed(2)}</td>
                                                    <td className="p-2 text-right font-mono font-black">{(item.currentQty * item.cost).toFixed(2)}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Footer */}
                            <div className="mt-auto pt-4 border-t border-black flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <span>{exportConfig.lowStockOnly ? 'FILTER: LOW STOCK ONLY' : 'FULL REPORT'}</span>
                                <span>Page {pageIndex + 1} of {printChunks.length}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
