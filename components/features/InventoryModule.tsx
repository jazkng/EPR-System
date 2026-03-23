import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, Layers, AlertTriangle, ChevronUp, ChevronDown, 
    Plus, Edit3, Trash2, CheckCircle2, X, Calculator, Link as LinkIcon, Save, Package,
    Filter, Calendar, CalendarDays, Box, ArrowRightLeft, Minus, DollarSign, History, Clock, User, Scale, Loader2, Check, Flame, Send, ClipboardList, CheckSquare, PlayCircle, RefreshCw,
    FileDown, Printer, Square, UserCheck, PenLine, ChevronRight, Users, XCircle, AlertOctagon, RotateCcw, CalendarClock
} from 'lucide-react';
import { StockItem, Employee, AppModule, Supplier, UomOption, InventoryLog, InventoryLogItem, InventoryTask } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

// ============================================================
// NEW TYPES for recurring task system
// ============================================================
export interface TaskCompletion {
    id: string;
    taskId: string;
    assigneeId: string;
    assigneeName: string;
    date: string;
    completedAt: string;
    items: { stockId: string; stockName: string; countedQty?: number }[];
}

interface StaffAssignmentGroup {
    groupId: string; // 新增用于精确区分不同频率的组
    assigneeId: string;
    assigneeName: string;
    tasks: InventoryTask[];
    allItems: { stockId: string; stockName: string; category: string }[];
    todayCompletion?: TaskCompletion;
    lastCompletion?: TaskCompletion;
    needsMerge: boolean;
    checkFrequency: number;
    isDueToday: boolean;
}

interface InventoryModuleProps {
    allowedModules?: AppModule[];
    employee?: Employee;
    lockedMode?: 'CHECK' | 'MASTER';
    initialMode?: 'CHECK' | 'MASTER';
    initialSearchTerm?: string;
    isManagementStaff?: boolean;
    lang?: 'zh' | 'my';
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

const getCategoryLabel = (catId: string): string => {
    for (const group of Object.values(CATEGORY_SECTIONS)) {
        const found = group.find(c => c.id === catId);
        if (found) return found.label;
    }
    return catId;
};

const getCategoryColor = (catId: string): string => {
    for (const group of Object.values(CATEGORY_SECTIONS)) {
        const found = group.find(c => c.id === catId);
        if (found) return found.color;
    }
    return 'bg-gray-50 text-gray-700';
};

const getToday = () => new Date().toISOString().split('T')[0];
const getYesterday = () => new Date(Date.now() - 86400000).toISOString().split('T')[0];
const daysBetween = (d1: string, d2: string) => Math.floor((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);

const FREQ_OPTIONS = [
    { value: 1, label: '每天', desc: 'Daily' },
    { value: 2, label: '每2天', desc: 'Every 2 days' },
    { value: 3, label: '每3天', desc: 'Every 3 days' },
    { value: 7, label: '每周', desc: 'Weekly' },
    { value: 14, label: '每2周', desc: 'Bi-weekly' },
    { value: 30, label: '每月', desc: 'Monthly' },
];

const INPUT_STYLE = "w-full p-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] transition-all placeholder:font-normal placeholder:text-gray-400";
const LABEL_STYLE = "text-[10px] font-bold text-gray-400 uppercase mb-1.5 block tracking-wide";

export const InventoryModule: React.FC<InventoryModuleProps> = ({ 
    allowedModules, 
    employee, 
    lockedMode, 
    initialMode = 'CHECK', 
    initialSearchTerm,
    isManagementStaff = false,
    lang = 'zh'
}) => {
    const [currentStockView, setCurrentStockView] = useState<'KITCHEN' | 'BAR' | 'GENERAL' | 'FUEL'>('KITCHEN');
    const [mode, setMode] = useState<'CHECK' | 'MASTER' | 'ASSIGN'>(lockedMode || initialMode);
    
    const [fbTranslations, setFbTranslations] = useState<Record<string, Record<string, string>>>({ items: {}, categories: {}, units: {}, ui: {} });
    
    const FALLBACK_MY: Record<string, Record<string, string>> = {
        ui: {
            '厨房': 'မီးဖိုချောင်', '水吧': 'အချိုရည်ဆိုင်', '后勤': 'ထောက်ပံ့ရေး', '燃料': 'လောင်စာ',
            '库存盘点': 'ကုန်ပစ္စည်းစစ်ဆေး', '库存总览': 'ကုန်ပစ္စည်းအနှစ်ချုပ်',
            '搜索': 'ရှာဖွေရန်', '保存': 'သိမ်းဆည်းရန်', '当前': 'လက်ရှိ', '最低': 'အနိမ့်ဆုံး', '最高': 'အမြင့်ဆုံး',
            '单位': 'ယူနစ်', '品名': 'ပစ္စည်းအမည်', '数量': 'အရေအတွက်',
            '不足': 'မလုံလောက်', '正常': 'ပုံမှန်', '充足': 'လုံလောက်',
        },
        categories: {
            'FRESH': 'လတ်ဆတ် (Fresh)', 'MEAT': 'အသား (Meat)', 'SEAFOOD': 'ပင်လယ်စာ (Seafood)',
            'VEG': 'ဟင်းသီးဟင်းရွက် (Veg)', 'NOODLE': 'ခေါက်ဆွဲ (Noodle)', 'SAUCE': 'ဆီ/ငံပြာရည် (Sauce)',
            'DRY': 'ခြောက်သွေ့ (Dry)', 'HQ': 'ရုံးချုပ် (HQ)',
            'TEA': 'လက်ဖက်ရည် (Tea)', 'FRUIT': 'သစ်သီး (Fruit)', 'RTD': 'ဗူးသွတ် (Drinks)',
            'MISC': 'အခြား (Misc)', 'DRINK': 'အချိုရည် (Drink)',
            'PACKAGING': 'ထုပ်ပိုး (Pack)', 'CLEANING': 'သန့်ရှင်းရေး (Clean)',
            'TOOLS': 'ကိရိယာ (Tools)', 'WASTE': 'စားသုံးကုန် (Waste)', 'GENERAL': 'အထွေထွေ (General)',
            'GAS': 'ဓာတ်ငွေ့ (Gas)', 'CHARCOAL': 'မီးသွေး (Charcoal)', 'OIL': 'ဆီ (Oil)',
        },
        units: {
            'kg': 'ကီလို', 'pkt': 'ထုပ်', 'btl': 'ပုလင်း', 'ctn': 'ပုံး',
            'roll': 'လိပ်', 'box': 'သေတ္တာ', 'tank': 'တိုင်ကီ', 'tray': 'ခွက်', 'bag': 'အိတ်', 'pc': 'ခု',
        },
    };
    
    const translations = {
        items: { ...fbTranslations.items },
        categories: { ...(lang === 'my' ? FALLBACK_MY.categories : {}), ...fbTranslations.categories },
        units: { ...(lang === 'my' ? FALLBACK_MY.units : {}), ...fbTranslations.units },
        ui: { ...(lang === 'my' ? FALLBACK_MY.ui : {}), ...fbTranslations.ui },
    };
    
    useEffect(() => {
        if (lang !== 'zh') {
            DataManager.getTranslations(lang).then(setFbTranslations);
        }
    }, [lang]);
    
    const t = (zh: string): string => {
        if (lang === 'zh') return zh;
        return translations.ui?.[zh] || zh;
    };
    const tCat = (catId: string): string => {
        if (lang === 'zh') return getCategoryLabel(catId);
        const translated = translations.categories?.[catId];
        return translated ? `${translated}` : getCategoryLabel(catId);
    };
    const tItem = (item: StockItem): string => {
        if (lang === 'zh') return item.name;
        const translated = translations.items?.[item.id];
        if (!translated) return item.name;
        const engPart = item.name.match(/\(([^)]+)\)/)?.[1];
        return engPart ? `${translated} (${engPart})` : translated;
    };
    const tUnit = (unit: string): string => {
        if (lang === 'zh') return unit;
        return translations.units?.[unit] || unit;
    };
    
    const [viewType, setViewType] = useState<'LIST' | 'HISTORY' | 'TASKS'>('LIST');
    const [logs, setLogs] = useState<InventoryLog[]>([]);
    const [items, setItems] = useState<StockItem[]>([]);
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [editingItem, setEditingItem] = useState<Partial<StockItem> | null>(null);
    const [linkedSuppliers, setLinkedSuppliers] = useState<Supplier[]>([]);
    
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    const [selectedForAssign, setSelectedForAssign] = useState<Set<string>>(new Set());
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [staffList, setStaffList] = useState<Employee[]>([]);
    const [selectedAssignee, setSelectedAssignee] = useState('');
    const [assignFrequency, setAssignFrequency] = useState(1);
    const [taskList, setTaskList] = useState<InventoryTask[]>([]);
    const [myTask, setMyTask] = useState<InventoryTask | null>(null);

    const [allRecentCompletions, setAllRecentCompletions] = useState<TaskCompletion[]>([]);

    const [editingTask, setEditingTask] = useState<InventoryTask | null>(null);
    const [editTaskItems, setEditTaskItems] = useState<Set<string>>(new Set());
    const [editTaskStockData, setEditTaskStockData] = useState<StockItem[]>([]);
    const [editTaskSearchTerm, setEditTaskSearchTerm] = useState('');
    const [editTaskFrequency, setEditTaskFrequency] = useState(1);

    const [taskDateFilter, setTaskDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'ALL'>('TODAY');
    const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
    const [taskSubView, setTaskSubView] = useState<'ASSIGNMENTS' | 'LOG'>('ASSIGNMENTS');
    const [completionLog, setCompletionLog] = useState<TaskCompletion[]>([]);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportConfig, setExportConfig] = useState({
        categories: { KITCHEN: true, BAR: false, GENERAL: false, FUEL: false },
        showCost: true,
        lowStockOnly: false
    });
    const [printChunks, setPrintChunks] = useState<StockItem[][]>([]);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const isManagement = employee?.role.match(/Owner|Manager|Supervisor|Chef|Admin/i);
    const hasCategoryAccess = allowedModules?.some(m => ['INVENTORY_KITCHEN', 'INVENTORY_BAR', 'INVENTORY_GENERAL', 'INVENTORY_FUEL', 'INVENTORY_VIEW'].includes(m));
    const isRestrictedView = !isManagement && !hasCategoryAccess;

    const activeTasks = useMemo(() => taskList.filter(t => t.status === 'PENDING'), [taskList]);

    const assignedItemMap = useMemo(() => {
        const map: Record<string, { assigneeName: string, taskId: string }[]> = {};
        activeTasks.forEach(task => {
            task.items.forEach(ti => {
                if (!map[ti.stockId]) map[ti.stockId] = [];
                if (!map[ti.stockId].some(e => e.taskId === task.id)) {
                    map[ti.stockId].push({ assigneeName: task.assigneeName, taskId: task.id });
                }
            });
        });
        return map;
    }, [activeTasks]);

    const completionsByTask = useMemo(() => {
        const map: Record<string, TaskCompletion> = {};
        allRecentCompletions.forEach(c => {
            if (!map[c.taskId] || c.date > map[c.taskId].date) map[c.taskId] = c;
        });
        return map;
    }, [allRecentCompletions]);

    const todayCompletions = useMemo(() => {
        const today = getToday();
        const map: Record<string, TaskCompletion> = {};
        allRecentCompletions.filter(c => c.date === today).forEach(c => { map[c.taskId] = c; });
        return map;
    }, [allRecentCompletions]);

    // 🌟 修复: 区分同一个员工但不同频率的任务组 🌟
    const staffGroups: StaffAssignmentGroup[] = useMemo(() => {
        const groups: Record<string, StaffAssignmentGroup> = {};
        const today = getToday();
        
        activeTasks.forEach(task => {
            const freq = (task as any).checkFrequency || 1;
            const key = `${task.assigneeId}_${freq}`; // 用 员工ID + 频率 作为唯一分组Key
            
            if (!groups[key]) {
                groups[key] = {
                    groupId: key,
                    assigneeId: task.assigneeId, assigneeName: task.assigneeName,
                    tasks: [], allItems: [], needsMerge: false,
                    checkFrequency: freq, isDueToday: false
                };
            }
            groups[key].tasks.push(task);
        });

        Object.values(groups).forEach(g => {
            const itemMap = new Map<string, any>();
            g.tasks.forEach(task => task.items.forEach(item => {
                if (!itemMap.has(item.stockId)) itemMap.set(item.stockId, { stockId: item.stockId, stockName: item.stockName, category: item.category || 'KITCHEN' });
            }));
            g.allItems = Array.from(itemMap.values());
            g.needsMerge = g.tasks.length > 1;
            
            for (const task of g.tasks) {
                if (todayCompletions[task.id]) g.todayCompletion = todayCompletions[task.id];
                if (completionsByTask[task.id]) {
                    if (!g.lastCompletion || completionsByTask[task.id].date > g.lastCompletion.date) g.lastCompletion = completionsByTask[task.id];
                }
            }
            
            if (g.todayCompletion) { g.isDueToday = false; }
            else if (!g.lastCompletion) { g.isDueToday = true; }
            else { g.isDueToday = daysBetween(g.lastCompletion.date, today) >= g.checkFrequency; }
        });
        return Object.values(groups);
    }, [activeTasks, todayCompletions, completionsByTask]);

    const myDueTasks = useMemo(() => {
        if (!employee) return [];
        const today = getToday();
        return activeTasks.filter(task => {
            if (task.assigneeId !== employee.id) return false;
            if (todayCompletions[task.id]) return false;
            const freq = (task as any).checkFrequency || 1;
            const last = completionsByTask[task.id];
            if (!last) return true;
            return daysBetween(last.date, today) >= freq;
        });
    }, [activeTasks, employee, todayCompletions, completionsByTask]);

    const myDoneToday = useMemo(() => {
        if (!employee) return [];
        return activeTasks.filter(t => t.assigneeId === employee.id && !!todayCompletions[t.id]);
    }, [activeTasks, employee, todayCompletions]);

    useEffect(() => {
        loadStock(currentStockView);
    }, [currentStockView]);

    useEffect(() => {
        loadTasks();
        loadCompletions();
    }, [employee?.id, mode]);

    useEffect(() => {
        if (viewType === 'HISTORY') loadLogs();
    }, [viewType]);

    useEffect(() => {
        if (viewType === 'TASKS' && taskSubView === 'LOG') loadCompletionLog();
    }, [viewType, taskSubView, taskDateFilter]);

    useEffect(() => {
        if (initialSearchTerm) {
            setSearchTerm(initialSearchTerm);
        }
    }, [initialSearchTerm]);

    useEffect(() => {
        if (editingItem && editingItem.id) {
            const CACHE_KEY = 'inventory_suppliers_cache';
            const cached = sessionStorage.getItem(CACHE_KEY);
            
            const processSuppliers = (allSuppliers: Supplier[]) => {
                const linked = allSuppliers.filter(s => 
                    s.catalog?.some(c => c.linkedStockId === editingItem.id)
                );
                setLinkedSuppliers(linked);
            };

            if (cached) {
                processSuppliers(JSON.parse(cached));
            } else {
                DataManager.getSuppliers().then(allSuppliers => {
                    sessionStorage.setItem(CACHE_KEY, JSON.stringify(allSuppliers));
                    processSuppliers(allSuppliers);
                });
            }
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
            if (isManagement) {
                setTaskList(allTasks);
            } else {
                setTaskList(allTasks.filter(t => t.assigneeId === employee?.id || t.creatorId === employee?.id));
            }
        } catch (e) {
            console.error("Error loading tasks", e);
        }
    };

    const loadCompletions = async () => {
        try {
            const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
            const data = await DataManager.getTaskCompletionsByRange(start, getToday());
            setAllRecentCompletions(data as TaskCompletion[]);
        } catch (e) { console.error("Error loading completions", e); }
    };

    const loadCompletionLog = async () => {
        try {
            const now = new Date(); const today = getToday(); const yesterday = getYesterday();
            const sow = new Date(now); sow.setDate(sow.getDate() - sow.getDay());
            let sd = today, ed = today;
            if (taskDateFilter === 'YESTERDAY') { sd = yesterday; ed = yesterday; }
            else if (taskDateFilter === 'WEEK') { sd = sow.toISOString().split('T')[0]; }
            else if (taskDateFilter === 'ALL') { sd = '2020-01-01'; }
            setCompletionLog(await DataManager.getTaskCompletionsByRange(sd, ed) as TaskCompletion[]);
        } catch (e) { console.error(e); }
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

    const toggleItemChecked = (id: string) => {
        setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // 🌟 修复：重构库存提交，支持跨分类（KITCHEN/FUEL等） 🌟
    const handleSubmitCheck = async (taskRef?: InventoryTask) => {
        let targetItems = items;

        if (taskRef) {
             // 任务包含的所有分类数据现在都在 items 里，直接过滤出这个任务要做的
             targetItems = items.filter(i => taskRef.items.some(ti => ti.stockId === i.id));
        } else {
             if (!confirm("确认更新库存？")) return;
        }
        
        setIsSubmitting(true);
        try {
            const logItems: any[] = [];
            
            // 计算更新后的数量与差额
            const updatedItems = targetItems.map(item => {
                const newQty = counts[item.id] !== undefined ? counts[item.id] : item.currentQty;
                const diff = newQty - item.currentQty;
                
                if (diff !== 0) {
                    const valChange = diff * item.cost;
                    logItems.push({
                        stockId: item.id, stockName: item.name,
                        oldQty: item.currentQty, newQty: newQty, diff: diff,
                        unit: item.unit, cost: item.cost, valueChange: valChange,
                        _category: item.category // 暂存分类以便后续分组
                    });
                }
                
                return { ...item, currentQty: newQty };
            });
            
            // 按分类把物品拆开，防止全部被存到 KITCHEN 导致数据错乱
            const itemsByCategory: Record<string, StockItem[]> = {};
            updatedItems.forEach(item => {
                const cat = item.category || currentStockView;
                // 自动识别所属的大分类 (KITCHEN, FUEL 等)
                let mainCategory = currentStockView;
                for (const [groupKey, sections] of Object.entries(CATEGORY_SECTIONS)) {
                    if (sections.some(s => s.id === cat)) {
                        mainCategory = groupKey as any;
                        break;
                    }
                }
                if (!itemsByCategory[mainCategory]) itemsByCategory[mainCategory] = [];
                itemsByCategory[mainCategory].push(item);
            });

            // 按分类把日志拆开
            const logItemsByCategory: Record<string, InventoryLogItem[]> = {};
            logItems.forEach((li) => {
                let mainCategory = currentStockView;
                for (const [groupKey, sections] of Object.entries(CATEGORY_SECTIONS)) {
                    if (sections.some(s => s.id === li._category)) {
                        mainCategory = groupKey as any;
                        break;
                    }
                }
                if (!logItemsByCategory[mainCategory]) logItemsByCategory[mainCategory] = [];
                const { _category, ...cleanLog } = li;
                logItemsByCategory[mainCategory].push(cleanLog);
            });

            // 分别提交不同分类的库存和日志
            for (const cat of Object.keys(itemsByCategory)) {
                await DataManager.batchUpdateStock(cat as any, itemsByCategory[cat]);
                
                if (logItemsByCategory[cat] && logItemsByCategory[cat].length > 0) {
                    const totalVal = logItemsByCategory[cat].reduce((sum, item) => sum + item.valueChange, 0);
                    const newLog: InventoryLog = {
                        id: `log_${cat}_${Date.now()}`,
                        date: new Date().toISOString().split('T')[0],
                        timestamp: new Date().toISOString(),
                        staffName: employee?.name || 'Unknown',
                        totalValueChange: totalVal,
                        items: logItemsByCategory[cat],
                        category: cat as any
                    };
                    await DataManager.saveInventoryLog(newLog);
                }
            }

            // 完成任务后记录 Completion
            if (taskRef) {
                const completion: TaskCompletion = {
                    id: `tc_${taskRef.id}_${getToday()}`,
                    taskId: taskRef.id,
                    assigneeId: taskRef.assigneeId,
                    assigneeName: taskRef.assigneeName,
                    date: getToday(),
                    completedAt: new Date().toISOString(),
                    items: taskRef.items.map(ti => ({
                        stockId: ti.stockId,
                        stockName: ti.stockName,
                        countedQty: counts[ti.stockId]
                    }))
                };
                await DataManager.saveTaskCompletion(completion);
                setMyTask(null);
                setMode(employee?.role.includes('Owner') ? 'MASTER' : 'CHECK');
                await loadStock(currentStockView); // 重新拉取以刷新本地
                await loadCompletions();
                alert("✅ 盘点已完成！");
                loadTasks();
            } else {
                alert("✅ 库存已更新！");
                // 局部更新 UI 避免重新加载
                setItems(prev => prev.map(i => {
                    const u = updatedItems.find(ui => ui.id === i.id);
                    return u || i;
                }));
            }

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
                isKeyItem: false, 
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
        setAssignFrequency(1);
        setIsAssignModalOpen(true);
    };

    // 🌟 修复：指派任务时只合并同等频率的任务 🌟
    const confirmAssignment = async () => {
        if (!selectedAssignee) return alert("Select staff");
        const assignee = staffList.find(s => s.id === selectedAssignee);
        if (!assignee) return;

        // 【关键修复】只查找该员工相同盘点频率的任务进行合并
        const existing = activeTasks.filter(t => t.assigneeId === assignee.id && t.checkFrequency === assignFrequency);

        const newTaskItems = items
            .filter(i => selectedForAssign.has(i.id))
            .map(i => ({
                stockId: i.id, stockName: i.name,
                category: currentStockView, currentQty: i.currentQty
            }));

        if (existing.length > 0) {
            const allExisting = existing.flatMap(t => t.items);
            const existingIds = new Set(allExisting.map(i => i.stockId));
            const itemsToAdd = newTaskItems.filter(ni => !existingIds.has(ni.stockId));
            
            if (itemsToAdd.length === 0) {
                alert(`⚠️ ${assignee.name} 的任务已包含所有选中物品。`);
                setIsAssignModalOpen(false);
                return;
            }

            const deduped = new Map<string, any>();
            [...allExisting, ...itemsToAdd].forEach(i => { if (!deduped.has(i.stockId)) deduped.set(i.stockId, i); });

            await DataManager.saveInventoryTask({ ...existing[0], items: Array.from(deduped.values()), checkFrequency: assignFrequency } as any);

            for (let i = 1; i < existing.length; i++) {
                await DataManager.deleteInventoryTask(existing[i].id);
            }

            setIsAssignModalOpen(false);
            setSelectedForAssign(new Set());
            setMode('CHECK');
            loadTasks();
            alert(`✅ 已追加 ${itemsToAdd.length} 个物品到 ${assignee.name} 的${assignFrequency}天任务中`);
        } else {
            const newTask: InventoryTask = {
                id: `task_${Date.now()}`,
                createdAt: new Date().toISOString(),
                creatorId: employee?.id || 'admin',
                creatorName: employee?.name || 'Admin',
                assigneeId: assignee.id,
                assigneeName: assignee.name,
                status: 'PENDING',
                items: newTaskItems,
                checkFrequency: assignFrequency
            } as any;

            await DataManager.saveInventoryTask(newTask);
            setIsAssignModalOpen(false);
            setSelectedForAssign(new Set());
            setMode('CHECK');
            loadTasks();
            alert(`✅ 常驻任务已派发给 ${assignee.name}（每${assignFrequency === 1 ? '天' : assignFrequency + '天'}）`);
        }
    };

    const mergeStaffTasks = async (assigneeId: string, frequency: number) => {
        const st = activeTasks.filter(t => t.assigneeId === assigneeId && t.checkFrequency === frequency);
        if (st.length <= 1) return;
        const im = new Map<string, any>();
        st.forEach(task => task.items.forEach(item => { if (!im.has(item.stockId)) im.set(item.stockId, item); }));
        await DataManager.saveInventoryTask({ ...st[0], items: Array.from(im.values()) });
        for (let i = 1; i < st.length; i++) await DataManager.deleteInventoryTask(st[i].id);
        loadTasks();
        alert(`✅ 已合并该员工的 ${st.length} 个同频率任务`);
    };

    const cancelStaffAssignment = async (assigneeId: string, frequency: number) => {
        const st = activeTasks.filter(t => t.assigneeId === assigneeId && t.checkFrequency === frequency);
        if (!confirm(`确定取消该员工（每${frequency}天）的所有盘点任务？(${st.length} 个任务)`)) return;
        for (const task of st) await DataManager.saveInventoryTask({ ...task, status: 'COMPLETED' });
        loadTasks();
        alert("✅ 已取消指定任务");
    };

    const openTaskEditor = async (task: InventoryTask) => {
        if (task.status !== 'PENDING') return;
        setEditingTask(task);
        setEditTaskSearchTerm('');
        setEditTaskFrequency((task as any).checkFrequency || 1);
        
        const results = await Promise.all(['KITCHEN', 'BAR', 'GENERAL', 'FUEL'].map(c => DataManager.getStock(c as any)));
        setEditTaskStockData(results.flat());
        setEditTaskItems(new Set(task.items.map(i => i.stockId)));
    };

    const toggleEditTaskItem = (stockId: string) => {
        const newSet = new Set(editTaskItems);
        if (newSet.has(stockId)) newSet.delete(stockId);
        else newSet.add(stockId);
        setEditTaskItems(newSet);
    };

    const saveTaskEdits = async () => {
        if (!editingTask) return;
        if (editTaskItems.size === 0) {
            if (confirm("没有选中任何物品，是否取消此任务？")) {
                await DataManager.saveInventoryTask({ ...editingTask, status: 'COMPLETED' });
                setEditingTask(null);
                loadTasks();
                return;
            }
            return;
        }

        const updatedItems = Array.from(editTaskItems).map(stockId => {
            const existing = editingTask.items.find(i => i.stockId === stockId);
            if (existing) return existing;
            
            const stockItem = editTaskStockData.find(s => s.id === stockId);
            if (!stockItem) return null;
            
            let itemCategory = 'KITCHEN';
            for (const [groupKey, sections] of Object.entries(CATEGORY_SECTIONS)) {
                if (sections.some(s => s.id === stockItem.category)) {
                    itemCategory = groupKey;
                    break;
                }
            }
            
            return {
                stockId: stockItem.id, stockName: stockItem.name,
                category: itemCategory, currentQty: stockItem.currentQty
            };
        }).filter(Boolean);

        await DataManager.saveInventoryTask({
            ...editingTask,
            items: updatedItems as any,
            checkFrequency: editTaskFrequency
        } as any);
        setEditingTask(null);
        loadTasks();
        alert("✅ 任务已更新");
    };

    // 🌟 修复：执行任务时加载该任务跨越的所有分类 🌟
    const startTaskExecution = async (task: InventoryTask) => {
        // 提取任务中包含的所有主分类 (e.g. ['KITCHEN', 'FUEL'])
        const categoriesInTask = Array.from(new Set(task.items.map(ti => {
            let cat = 'KITCHEN';
            for (const [groupKey, sections] of Object.entries(CATEGORY_SECTIONS)) {
                if (sections.some(s => s.id === ti.category)) {
                    cat = groupKey; break;
                }
            }
            return cat;
        })));
        
        // 如果数据异常，至少保证拉一个 KITCHEN
        if (categoriesInTask.length === 0) categoriesInTask.push('KITCHEN');

        // 拉取所需所有分类的数据并平铺
        const promises = categoriesInTask.map(c => DataManager.getStock(c as any));
        const results = await Promise.all(promises);
        const allRelevantStock = results.flat();
        
        // 过滤出本次任务的物品
        const taskItemsData = allRelevantStock.filter(i => task.items.some(ti => ti.stockId === i.id));
        setItems(taskItemsData);
        
        const initialCounts: Record<string, number> = {};
        taskItemsData.forEach(item => { initialCounts[item.id] = item.currentQty; });
        setCounts(initialCounts);
        
        setMyTask(task);
        setMode('CHECK');
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

    const filteredItems = items.filter(i => {
        if (!searchTerm) return true;
        return i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.id.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const totalInventoryValue = useMemo(() => {
        return filteredItems.reduce((acc, item) => acc + (item.currentQty * item.cost), 0);
    }, [filteredItems]);

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

            allItems.sort((a, b) => {
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                return a.name.localeCompare(b.name);
            });

            const chunkSize = 25;
            const chunks = [];
            for (let i = 0; i < allItems.length; i += chunkSize) {
                chunks.push(allItems.slice(i, i + chunkSize));
            }
            setPrintChunks(chunks);

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

    const groupItemsByCategory = (taskItems: { stockId: string; stockName: string; category: string }[]) => {
        const grouped: Record<string, typeof taskItems> = {};
        taskItems.forEach(item => {
            const cat = item.category || 'UNKNOWN';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });
        return grouped;
    };

    const renderItemCard = (item: StockItem) => {
        const isOutOfStock = item.currentQty <= 0;
        const isLowStock = !isOutOfStock && item.currentQty <= item.minLevel;
        const assignedTo = assignedItemMap[item.id];
        
        if (mode === 'ASSIGN') {
            const isSelected = selectedForAssign.has(item.id);
            return (
                <div 
                    key={item.id} 
                    onClick={() => toggleAssignSelect(item.id)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${isSelected ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-200'}`}
                >
                    <div>
                        <div className="font-bold text-sm text-[#1A1A1A]">{tItem(item)}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">#{item.id}</div>
                        {assignedTo && assignedTo.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                                <UserCheck size={10} className="text-blue-400"/>
                                <span className="text-[9px] text-blue-500 font-bold">
                                    已指派: {[...new Set(assignedTo.map(a => a.assigneeName))].join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'}`}>
                        {isSelected && <Check size={14} strokeWidth={3}/>}
                    </div>
                </div>
            );
        }

        // ★ CHECK MODE CARD — Mobile-optimized with perfect UX & Smart Colors
        if (mode === 'CHECK') {
            const isChecked = checkedItems[item.id];
            
            // 实时获取当前输入的数量
            const currentCount = counts[item.id] !== undefined ? counts[item.id] : item.currentQty;
            
            // 判断库存状态
            const isOut = currentCount <= 0;
            const isLow = !isOut && currentCount <= item.minLevel;

            // 动态分配颜色
            let cardColor = 'bg-white border-gray-100';
            let checkBtnColor = 'bg-white border-gray-200 text-gray-300 hover:bg-gray-50';

            if (isChecked) {
                if (isOut) {
                    cardColor = 'bg-red-50 border-red-500';
                    checkBtnColor = 'bg-red-500 border-red-700 text-white shadow-red-200';
                } else if (isLow) {
                    cardColor = 'bg-yellow-50 border-yellow-500';
                    checkBtnColor = 'bg-yellow-500 border-yellow-700 text-white shadow-yellow-200';
                } else {
                    cardColor = 'bg-green-50 border-green-500';
                    checkBtnColor = 'bg-green-500 border-green-700 text-white shadow-green-200';
                }
            } else {
                if (isOut) cardColor = 'bg-red-50/50 border-red-200';
                else if (isLow) cardColor = 'bg-yellow-50/50 border-yellow-200';
            }

            return (
                <div key={item.id} className={`rounded-2xl border-2 transition-all p-3 flex flex-col gap-3 shadow-sm ${cardColor}`}>
                    <div className={`flex justify-between items-start ${isChecked ? 'opacity-70' : ''}`}>
                        <div>
                            <div className="font-black text-sm md:text-base text-[#1A1A1A]">{tItem(item)}</div>
                            <div className="text-[10px] text-gray-400 font-mono mt-1 flex gap-2 items-center">
                                <span className="bg-black/5 px-1.5 py-0.5 rounded font-bold">#{item.id}</span>
                                <span>Min: {item.minLevel}</span>
                            </div>
                        </div>
                        {isOut && <span className="text-[9px] bg-red-500 text-white px-2 py-1 rounded-lg font-black tracking-wider shadow-sm">没货 (OUT)</span>}
                        {isLow && <span className="text-[9px] bg-yellow-400 text-yellow-900 px-2 py-1 rounded-lg font-black tracking-wider shadow-sm">警告 (LOW)</span>}
                    </div>

                    <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 p-1 shadow-inner">
                            <button onClick={() => handleCountChange(item.id, Math.max(0, currentCount - 1))} className="w-11 h-11 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm border border-gray-100 hover:bg-gray-100 active:scale-90 active:bg-gray-200 transition-all">
                                <Minus size={22} strokeWidth={3}/>
                            </button>
                            <div className="w-16 flex flex-col items-center justify-center">
                                <input type="number" className="w-full text-center font-black text-xl outline-none bg-transparent text-[#1A1A1A] leading-none" value={counts[item.id] !== undefined ? counts[item.id] : ''} onChange={(e) => handleCountChange(item.id, parseFloat(e.target.value) || 0)} />
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1 w-full text-center truncate">{tUnit(item.unit)}</span>
                            </div>
                            <button onClick={() => handleCountChange(item.id, currentCount + 1)} className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#1A1A1A] text-[#FFD700] shadow-md hover:bg-black active:scale-90 active:bg-gray-800 transition-all">
                                <Plus size={22} strokeWidth={3}/>
                            </button>
                        </div>
                        <button onClick={() => toggleItemChecked(item.id)} className={`w-14 h-12 flex items-center justify-center rounded-xl shadow-md transition-all active:scale-90 border-b-4 ${checkBtnColor}`}>
                            <Check size={26} strokeWidth={isChecked ? 4 : 3} />
                        </button>
                    </div>
                </div>
            );
        } else {
            return (
                <div 
                    key={item.id} 
                    onClick={() => setEditingItem(item)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer active:scale-95 hover:border-blue-300 ${isOutOfStock ? 'border-red-300 bg-red-50' : isLowStock ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-white'} shadow-sm hover:shadow-md`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="font-bold text-sm text-[#1A1A1A]">{tItem(item)}</div>
                            <div className="text-[10px] text-gray-400 font-mono font-bold bg-white/50 px-1.5 py-0.5 rounded w-fit mt-1 border border-black/5">#{item.id}</div>
                            {assignedTo && assignedTo.length > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                    <UserCheck size={9} className="text-blue-400"/>
                                    <span className="text-[9px] text-blue-500 font-medium">
                                        → {[...new Set(assignedTo.map(a => a.assigneeName))].join(', ')}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="p-1 bg-white/50 rounded-lg text-gray-400"><Edit3 size={14}/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                        <div>Qty: <span className={`font-bold ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-black'}`}>{item.currentQty}</span></div>
                        <div>Min: <span className="font-bold text-black">{item.minLevel}</span></div>
                        <div>Cost: <span className="font-bold text-black">RM {item.cost.toFixed(2)}</span></div>
                        <div>Unit: <span className="font-bold text-black uppercase">{tUnit(item.unit)}</span></div>
                    </div>
                </div>
            );
        }
    };

    const renderStaffCard = (group: StaffAssignmentGroup) => {
        const isExpanded = expandedStaffId === group.groupId;
        const grouped = groupItemsByCategory(group.allItems);
        const freqLabel = FREQ_OPTIONS.find(f => f.value === group.checkFrequency)?.label || `每${group.checkFrequency}天`;

        return (
            <div key={group.groupId} className={`bg-white rounded-2xl border shadow-sm mb-3 overflow-hidden ${group.isDueToday && !group.todayCompletion ? 'border-yellow-300' : 'border-gray-200'}`}>
                <div onClick={() => setExpandedStaffId(isExpanded ? null : group.groupId)}
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-md">
                                {group.assigneeName.charAt(0)}
                            </div>
                            <div>
                                <div className="font-black text-[#1A1A1A] text-sm flex items-center gap-2 flex-wrap">
                                    {group.assigneeName}
                                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{group.allItems.length} items</span>
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><CalendarClock size={9}/> {freqLabel}</span>
                                    {group.needsMerge && (
                                        <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">{group.tasks.length} 个任务</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {group.todayCompletion ? (
                                        <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-green-50 text-green-600">
                                            <CheckCircle2 size={10}/> 今日 {new Date(group.todayCompletion.completedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                        </div>
                                    ) : group.isDueToday ? (
                                        <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-yellow-50 text-yellow-600">
                                            <Clock size={10}/> 今日待完成
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-50 text-gray-400">
                                            <Check size={10}/> 未到期
                                        </div>
                                    )}
                                    {group.lastCompletion && (
                                        <div className="text-[9px] text-gray-400 font-medium">上次: {group.lastCompletion.date}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {group.needsMerge && (
                                <button onClick={(e) => { e.stopPropagation(); mergeStaffTasks(group.assigneeId, group.checkFrequency); }}
                                    className="p-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100" title="合并任务">
                                    <RotateCcw size={14}/>
                                </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); openTaskEditor(group.tasks[0]); }}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="编辑任务">
                                <PenLine size={14}/>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); cancelStaffAssignment(group.assigneeId, group.checkFrequency); }}
                                className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-600" title="取消任务">
                                <XCircle size={14}/>
                            </button>
                            {isExpanded ? <ChevronUp size={18} className="text-gray-400 ml-1"/> : <ChevronDown size={18} className="text-gray-400 ml-1"/>}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                        {Object.entries(grouped).map(([catKey, catItems]) => {
                            let groupLabel = CATEGORY_SECTIONS[catKey] ? catKey : (getCategoryLabel(catKey) || catKey);
                            return (
                                <div key={catKey}>
                                    <div className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg mb-1.5 inline-block ${getCategoryColor(catKey)}`}>
                                        {groupLabel} ({catItems.length})
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {catItems.map((item, idx) => (
                                            <span key={idx} className="bg-white border border-gray-200 px-2 py-1 rounded-lg text-[11px] font-medium text-gray-700">
                                                {item.stockName}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
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
        <div className="p-3 md:p-6 pb-32 flex flex-col bg-[#F5F7FA] min-h-screen">
            
            {myTask && (
                <div className="fixed inset-0 z-[100] bg-[#F5F7FA] flex flex-col">
                    <div className="bg-[#1A1A1A] text-white p-4 pb-5">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-wider">盘点任务</p>
                                <p className="font-black text-lg mt-0.5">{myTask.items.length} 个物品</p>
                            </div>
                            <button onClick={() => { setMyTask(null); setMode(employee?.role.includes('Owner') ? 'MASTER' : 'CHECK'); loadStock(currentStockView); }} className="px-4 py-2 rounded-xl bg-white/10 text-sm font-bold active:bg-white/20">取消</button>
                        </div>
                        <div className="mt-3 bg-white/10 rounded-full h-2 overflow-hidden">
                            <div className="bg-[#FFD700] h-full rounded-full transition-all" style={{ width: `${(Object.keys(checkedItems).filter(k => checkedItems[k]).length / myTask.items.length) * 100}%` }}/>
                        </div>
                        <div className="text-[10px] text-white/60 mt-1 text-right">{Object.keys(checkedItems).filter(k => checkedItems[k]).length} / {myTask.items.length} 已确认</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {items.map(item => renderItemCard(item))}
                    </div>
                    <div className="p-4 bg-white border-t border-gray-200">
                        <button onClick={() => handleSubmitCheck(myTask)} disabled={isSubmitting} className="w-full bg-[#1A1A1A] text-[#FFD700] py-4 rounded-2xl font-black text-lg shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70">
                            {isSubmitting ? <Loader2 size={20} className="animate-spin"/> : <CheckCircle2 size={20}/>} {isSubmitting ? '提交中...' : '提交盘点'}
                        </button>
                    </div>
                </div>
            )}

            {!myTask && !isRestrictedView && (
                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 shrink-0">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto overflow-x-auto">
                        <button onClick={() => handleViewChange('KITCHEN')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentStockView === 'KITCHEN' ? 'bg-[#1A1A1A] text-[#FFD700]' : 'text-gray-500 hover:bg-gray-50'}`}>{t('厨房')}</button>
                        <button onClick={() => handleViewChange('BAR')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentStockView === 'BAR' ? 'bg-[#1A1A1A] text-[#FFD700]' : 'text-gray-500 hover:bg-gray-50'}`}>{t('水吧')}</button>
                        <button onClick={() => handleViewChange('GENERAL')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentStockView === 'GENERAL' ? 'bg-[#1A1A1A] text-[#FFD700]' : 'text-gray-500 hover:bg-gray-50'}`}>{t('后勤')}</button>
                        <button onClick={() => handleViewChange('FUEL')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${currentStockView === 'FUEL' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}><Flame size={12}/> {t('燃料')}</button>
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
                            onClick={() => { loadTasks(); loadCompletions(); }} 
                            className="bg-gray-100 text-gray-500 p-2 rounded-xl shadow-sm hover:bg-gray-200 hover:text-black transition-colors"
                            title="Refresh"
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

            {!myTask && !isRestrictedView && (
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-4 px-1 gap-4">
                    <div className="flex gap-3 items-center flex-wrap">
                        
                        <div className="flex bg-gray-200 p-1 rounded-lg border border-gray-300">
                            <button onClick={() => {setMode('CHECK'); setViewType('LIST');}} className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${mode === 'CHECK' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>✅ 盘点模式</button>
                            <button onClick={() => {setMode('MASTER'); setViewType('LIST');}} className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${mode === 'MASTER' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>⚙️ 管理模式</button>
                        </div>

                        {mode === 'MASTER' && (
                            <div className="flex bg-gray-200 p-1 rounded-lg">
                                <button onClick={() => setViewType('LIST')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewType === 'LIST' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}><Box size={12}/> 列表 (List)</button>
                                <button onClick={() => setViewType('HISTORY')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewType === 'HISTORY' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}><History size={12}/> 记录 (History)</button>
                                <button onClick={() => setViewType('TASKS')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewType === 'TASKS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}><ClipboardList size={12}/> 任务 (Tasks)</button>
                            </div>
                        )}

                        {mode === 'MASTER' && viewType === 'LIST' && (
                            <button 
                                onClick={() => setMode(prev => prev === 'ASSIGN' ? 'MASTER' : 'ASSIGN')} 
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${mode === 'ASSIGN' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200'}`}
                            >
                                <Send size={12}/> {mode === 'ASSIGN' ? '退出指派 (Exit)' : '指派任务 (Assign)'}
                            </button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {mode === 'MASTER' && viewType === 'LIST' && (
                            <div className="text-right bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 flex items-center gap-3">
                                <div className="text-emerald-500 bg-white p-1 rounded-full"><DollarSign size={14}/></div>
                                <div className="text-right">
                                    <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">总价值 (Total Value)</div>
                                    <div className="text-sm md:text-base font-black text-emerald-700 font-mono">RM {totalInventoryValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                </div>
                            </div>
                        )}
                        {viewType === 'LIST' && (
                            <div className="text-right px-2">
                                <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">物品数 (Items)</div>
                                <div className="text-sm md:text-base font-black text-[#1A1A1A]">{filteredItems.length}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!myTask && isRestrictedView && (
                <div className="mb-3 bg-gradient-to-r from-blue-600 to-indigo-700 p-4 rounded-2xl flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-2 text-white">
                        <ClipboardList size={20}/>
                        <span className="font-black text-base">我的盘点任务</span>
                    </div>
                    <button onClick={() => { loadTasks(); loadCompletions(); }} className="p-2.5 bg-white/20 rounded-xl text-white active:bg-white/30"><RefreshCw size={16}/></button>
                </div>
            )}

            {!myTask && (
            <div className="space-y-4">
                
                {mode === 'CHECK' && (
                    <div className="mb-4">
                        {myDueTasks.length > 0 && (
                            <div className="space-y-2 mb-3">
                                <h4 className="font-black text-sm text-[#1A1A1A] flex items-center gap-2 px-1"><Clock size={14} className="text-yellow-600"/> 待完成盘点</h4>
                                {myDueTasks.map(task => {
                                    const freq = (task as any).checkFrequency || 1;
                                    const freqLabel = FREQ_OPTIONS.find(f => f.value === freq)?.label || `每${freq}天`;
                                    return (
                                        <div key={task.id} className="bg-white p-4 rounded-2xl border-2 border-yellow-200 shadow-sm">
                                            <div className="flex justify-between items-center mb-3">
                                                <div>
                                                    <div className="text-[10px] text-gray-400 font-bold">指派人: {task.creatorName}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                                        <span className="font-bold">{task.items.length} 个物品</span>
                                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1"><CalendarClock size={9}/> {freqLabel}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => startTaskExecution(task)}
                                                className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-base flex items-center justify-center gap-2 active:scale-[0.98] shadow-md">
                                                <PlayCircle size={20}/> 开始盘点
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {myDoneToday.length > 0 && (
                            <div className="bg-green-50 border border-green-200 p-3 rounded-xl mb-3">
                                <h4 className="font-bold text-green-700 text-xs flex items-center gap-2 mb-2"><CheckCircle2 size={14}/> 今日已完成</h4>
                                {myDoneToday.map(task => {
                                    const c = todayCompletions[task.id];
                                    return (
                                        <div key={task.id} className="text-xs text-green-600 flex items-center gap-2 py-1">
                                            <Check size={12}/>
                                            <span className="font-bold">{task.items.length} items</span>
                                            {c && <span className="text-green-400">✓ {new Date(c.completedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {isRestrictedView && myDueTasks.length === 0 && myDoneToday.length === 0 && (
                            <div className="text-center py-16 text-gray-400 flex flex-col items-center">
                                <CheckSquare size={48} className="mb-3 opacity-20"/>
                                <p className="font-bold text-base">暂无待办任务</p>
                                <p className="text-xs text-gray-300 mt-1">所有盘点任务已完成或未到期</p>
                            </div>
                        )}
                    </div>
                )}

                {viewType === 'TASKS' && mode === 'MASTER' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex bg-gray-200 p-1 rounded-lg">
                                <button onClick={() => setTaskSubView('ASSIGNMENTS')}
                                    className={`flex items-center gap-1 px-4 py-2 rounded-md text-xs font-bold transition-all ${taskSubView === 'ASSIGNMENTS' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500'}`}>
                                    <Users size={14}/> 常驻指派
                                </button>
                                <button onClick={() => setTaskSubView('LOG')}
                                    className={`flex items-center gap-1 px-4 py-2 rounded-md text-xs font-bold transition-all ${taskSubView === 'LOG' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}>
                                    <History size={14}/> 完成记录
                                </button>
                            </div>
                            <button onClick={() => { loadTasks(); loadCompletions(); loadCompletionLog(); }} className="text-xs bg-gray-100 p-2 rounded-lg hover:bg-gray-200"><RefreshCw size={14}/></button>
                        </div>

                        {taskSubView === 'ASSIGNMENTS' && (
                            <>
                                <div className="flex gap-2 mb-4 flex-wrap">
                                    <div className="bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-xl flex items-center gap-2">
                                        <Users size={14} className="text-indigo-600"/>
                                        <span className="text-xs font-black text-indigo-700">{staffGroups.length} 人</span>
                                    </div>
                                    <div className="bg-green-50 border border-green-200 px-3 py-2 rounded-xl flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-green-600"/>
                                        <span className="text-xs font-black text-green-700">{staffGroups.filter(g => g.todayCompletion).length} 今日完成</span>
                                    </div>
                                    <div className="bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-xl flex items-center gap-2">
                                        <Clock size={14} className="text-yellow-600"/>
                                        <span className="text-xs font-black text-yellow-700">{staffGroups.filter(g => g.isDueToday && !g.todayCompletion).length} 待完成</span>
                                    </div>
                                </div>
                                {staffGroups.length === 0 ? (
                                    <div className="text-center py-20 text-gray-400 font-bold">
                                        <Users size={48} className="mx-auto mb-2 opacity-20"/>
                                        <p>暂无常驻指派</p>
                                        <p className="text-xs text-gray-300 mt-1">在 列表 (List) 页面使用 指派任务 (Assign) 开始指派</p>
                                    </div>
                                ) : (
                                    staffGroups.map(group => renderStaffCard(group))
                                )}
                            </>
                        )}

                        {taskSubView === 'LOG' && (
                            <>
                                <div className="flex bg-gray-200 p-0.5 rounded-lg mb-4 w-fit">
                                    {(['TODAY', 'YESTERDAY', 'WEEK', 'ALL'] as const).map(f => (
                                        <button key={f} onClick={() => setTaskDateFilter(f)}
                                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${taskDateFilter === f ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                            {f === 'TODAY' ? '今日' : f === 'YESTERDAY' ? '昨日' : f === 'WEEK' ? '本周' : '全部'}
                                        </button>
                                    ))}
                                </div>
                                {completionLog.length === 0 ? (
                                    <div className="text-center py-20 text-gray-400 font-bold">
                                        <History size={48} className="mx-auto mb-2 opacity-20"/>
                                        <p>暂无完成记录</p>
                                    </div>
                                ) : (
                                    completionLog.map(c => (
                                        <div key={c.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-green-100 text-green-700 rounded-xl"><CheckCircle2 size={16}/></div>
                                                <div>
                                                    <div className="font-bold text-sm text-[#1A1A1A]">{c.assigneeName}</div>
                                                    <div className="text-[10px] text-gray-400">
                                                        {c.date} · {new Date(c.completedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · {c.items.length} items
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {c.items.map((item, idx) => (
                                                    <span key={idx} className="bg-gray-50 border px-1.5 py-0.5 rounded text-[10px] font-medium">
                                                        {item.stockName} {item.countedQty !== undefined && <span className="font-black text-green-600">({item.countedQty})</span>}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}
                    </div>
                )}

                {viewType === 'HISTORY' && mode === 'MASTER' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                        {logs.length === 0 ? <div className="text-center py-20 text-gray-400 font-bold">暂无盘点记录 (No History)</div> : logs.map(log => renderLogCard(log))}
                    </div>
                )}

                {viewType === 'LIST' && (!isRestrictedView) && (
                    <div className="space-y-4 pb-6">
                        {CATEGORY_SECTIONS[currentStockView]?.map(section => {
                            const sectionItems = filteredItems.filter(i => i.category === section.id);
                            if (sectionItems.length === 0) return null;
                            
                            const isSearching = searchTerm.length > 0;
                            const isExpanded = expandedSections[section.id] || isSearching || mode === 'ASSIGN';
                            const outOfStockCount = sectionItems.filter(i => i.currentQty <= 0).length;
                            const lowStockCount = sectionItems.filter(i => i.currentQty > 0 && i.currentQty <= i.minLevel).length;

                            return (
                                <div key={section.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500 bg-white/50 rounded-2xl p-1 md:p-2 border border-transparent">
                                    <div onClick={() => toggleSection(section.id)} className={`px-3 md:px-4 py-3 md:py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-between cursor-pointer transition-all shadow-sm ${section.color} hover:brightness-95 select-none active:scale-[0.98]`}>
                                        <div className="flex items-center gap-2">
                                            <Layers size={16}/> 
                                            <span className="truncate max-w-[150px] md:max-w-[200px]">{tCat(section.id)}</span>
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
                        })}

                        {/* 🌟 捕获未分类 / 遗失分类的物品 (把不见的每周物品找出来) 🌟 */}
                        {(() => {
                            const validCategoryIds = new Set(CATEGORY_SECTIONS[currentStockView]?.map(s => s.id) || []);
                            const orphanedItems = filteredItems.filter(i => !validCategoryIds.has(i.category));
                            if (orphanedItems.length === 0) return null;
                            
                            const isSearching = searchTerm.length > 0;
                            const isExpanded = expandedSections['UNCATEGORIZED'] || isSearching || mode === 'ASSIGN';
                            const outOfStockCount = orphanedItems.filter(i => i.currentQty <= 0).length;
                            const lowStockCount = orphanedItems.filter(i => i.currentQty > 0 && i.currentQty <= i.minLevel).length;

                            return (
                                <div key="UNCATEGORIZED" className="animate-in fade-in slide-in-from-bottom-2 duration-500 bg-gray-100 rounded-2xl p-1 md:p-2 border border-dashed border-gray-300 mt-6 shadow-inner">
                                    <div onClick={() => toggleSection('UNCATEGORIZED')} className="px-3 md:px-4 py-3 md:py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-between cursor-pointer transition-all shadow-sm bg-gray-200 text-gray-600 hover:brightness-95 select-none active:scale-[0.98]">
                                        <div className="flex items-center gap-2">
                                            <AlertOctagon size={16} className="text-red-500 animate-pulse"/> 
                                            <span className="truncate max-w-[150px] md:max-w-[200px] text-gray-700">未分类 / 遗失区</span>
                                            <span className="bg-gray-300 px-2 py-0.5 rounded-full text-[9px] text-gray-700">{orphanedItems.length}</span>
                                            {outOfStockCount > 0 && <div className="flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-full shadow-sm ml-1"><AlertTriangle size={10} fill="currentColor" /></div>}
                                            {lowStockCount > 0 && <div className="flex items-center gap-1 bg-yellow-400 text-black px-2 py-0.5 rounded-full shadow-sm ml-1"><AlertTriangle size={10} fill="currentColor" /></div>}
                                        </div>
                                        {isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                                    </div>
                                    <div className="px-3 pt-2 text-[10px] font-bold text-gray-400">💡 提示：请点击这些物品编辑，赋予它们正确的分类，它们就会回到正常的列表里。</div>
                                    {isExpanded && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 mt-2 md:mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {orphanedItems.map(item => renderItemCard(item))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
            )}

            {!myTask && mode === 'CHECK' && !isRestrictedView && (
                <div className="fixed bottom-0 left-0 w-full bg-white p-4 border-t border-gray-200 md:static md:bg-transparent md:border-0 md:p-0 mt-4">
                    <button onClick={() => handleSubmitCheck()} disabled={isSubmitting} className="w-full bg-[#1A1A1A] text-[#FFD700] py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2">
                        <CheckCircle2 size={20}/> {isSubmitting ? 'Saving...' : '提交盘点'}
                    </button>
                </div>
            )}
            
            {!myTask && mode === 'ASSIGN' && (
                <div className="fixed bottom-0 left-0 w-full bg-indigo-50 p-4 border-t border-indigo-100 md:static md:bg-transparent md:border-0 md:p-0 mt-4">
                    <button onClick={initiateAssignment} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                        <Send size={20}/> 指派 {selectedForAssign.size} 个物品 (Assign)
                    </button>
                </div>
            )}

            {editingItem && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full h-full md:max-w-lg md:h-auto md:max-h-[90vh] md:rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col relative overflow-hidden">
                        
                        <div className="p-4 md:p-6 pb-2 shrink-0 border-b md:border-0 border-gray-100 bg-white z-10 sticky top-0">
                            <div className="flex justify-between items-center mb-4 md:mb-6">
                                <h3 className="font-black text-xl md:text-2xl text-[#1A1A1A] flex items-center gap-2">
                                    <Edit3 size={24}/> {editingItem.id ? '编辑物品 (Edit)' : '新增物品 (New)'}
                                </h3>
                                <button onClick={() => setEditingItem(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
                            </div>
                        </div>

                        <div className="p-4 md:p-6 space-y-6 overflow-y-auto flex-grow bg-[#F9FAFB] md:bg-white pb-24 md:pb-6">
                            <div>
                                <label className={LABEL_STYLE}>Item Name (品名)</label>
                                <input className={INPUT_STYLE} value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="e.g. 肉片 (Pork Slices)" />
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

                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={LABEL_STYLE}>Min Level</label><input type="number" className={`${INPUT_STYLE} text-center text-orange-600`} value={editingItem.minLevel ?? ''} onChange={e => setEditingItem({...editingItem, minLevel: parseFloat(e.target.value)})} placeholder="0" /></div>
                                <div><label className={LABEL_STYLE}>Current</label><input type="number" className={`${INPUT_STYLE} text-center`} value={editingItem.currentQty ?? ''} onChange={e => setEditingItem({...editingItem, currentQty: parseFloat(e.target.value)})} placeholder="0" /></div>
                                <div><label className={LABEL_STYLE}>Cost (RM)</label><input type="number" className={`${INPUT_STYLE} text-center`} value={editingItem.cost ?? ''} onChange={e => setEditingItem({...editingItem, cost: parseFloat(e.target.value)})} placeholder="0.00" /></div>
                            </div>

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
                                        <input type="number" value={editingItem.weightPerUnit ?? ''} onChange={e => setEditingItem({...editingItem, weightPerUnit: parseFloat(e.target.value)})}
                                            className="flex-1 p-2 bg-transparent font-black text-center text-orange-900 outline-none placeholder-gray-300 border-b border-orange-100 focus:border-orange-300 transition-colors" placeholder="0.00"/>
                                        <select value={editingItem.conversionUnit || 'kg'} onChange={e => setEditingItem({...editingItem, conversionUnit: e.target.value})}
                                            className="w-20 p-2 bg-orange-50 rounded-lg text-xs font-bold text-orange-800 outline-none border-none cursor-pointer">
                                            <option value="kg">KG</option><option value="g">GRAM</option><option value="pcs">PCS (粒/只)</option><option value="slice">SLICE (片)</option><option value="portion">PORTION (份)</option><option value="ml">ML</option><option value="l">LITER</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-xs font-black text-gray-600 uppercase flex items-center gap-2"><Calculator size={14}/> 多单位设置 (SMART UNIT CONFIG)</h4>
                                    <button onClick={addUomOption} className="text-[10px] bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 font-bold">+ Add Unit</button>
                                </div>
                                
                                <div className="space-y-3">
                                    {editingItem.uomOptions && editingItem.uomOptions.length > 0 ? (
                                        editingItem.uomOptions.map((uom, idx) => (
                                            <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="p-1.5 bg-green-100 text-green-700 rounded-lg"><Box size={14}/></div>
                                                    <input className="w-24 p-1.5 border border-gray-200 rounded text-xs font-black uppercase outline-none focus:border-green-500" placeholder="UNIT NAME" value={uom.value} onChange={e => updateUomOption(idx, 'value', e.target.value)} />
                                                    <div className="flex items-center border border-gray-200 rounded px-2 bg-gray-50">
                                                        <span className="text-[10px] text-gray-400 font-bold mr-1">RM</span>
                                                        <input type="number" className="w-16 bg-transparent text-xs font-bold outline-none py-1.5" placeholder="Auto" value={uom.price || ''} onChange={e => updateUomOption(idx, 'price', parseFloat(e.target.value))}/>
                                                    </div>
                                                    <button onClick={() => removeUomOption(idx)} className="ml-auto text-red-300 hover:text-red-500"><Trash2 size={14}/></button>
                                                </div>
                                                <div className="flex items-center gap-2 bg-green-50 p-2 rounded-lg border border-green-100">
                                                    <span className="text-[9px] font-bold text-green-700 bg-white px-1.5 py-0.5 rounded border border-green-100">大单位 (Larger)</span>
                                                    <ArrowRightLeft size={10} className="text-green-400"/>
                                                    <span className="text-[9px] font-bold text-gray-400">小单位 (Smaller)</span>
                                                    <div className="flex-grow flex justify-end items-center gap-2">
                                                        <span className="text-xs font-black text-green-800">1 {uom.value || 'UNIT'} = </span>
                                                        <input type="number" className="w-12 p-1 text-center font-black border-b-2 border-green-500 bg-transparent outline-none text-green-900" value={uom.ratio} onChange={e => updateUomOption(idx, 'ratio', parseFloat(e.target.value))} />
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

                        <div className="p-4 border-t border-gray-100 bg-white rounded-b-3xl flex gap-3 shrink-0 fixed bottom-0 left-0 right-0 md:relative md:bottom-auto z-20">
                            {editingItem.id && (
                                <button onClick={handleDeleteClick} className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors">
                                    <Trash2 size={20}/>
                                </button>
                            )}
                            <button onClick={() => setEditingItem(null)} className="flex-1 py-4 bg-white border-2 border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-colors">
                                取消
                            </button>
                            <button onClick={handleSaveMaster} disabled={isSubmitting}
                                className="flex-[2] py-4 bg-[#1A1A1A] text-[#FFD700] font-black rounded-2xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                                {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} 
                                {isSubmitting ? '保存中...' : '保存更改'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {isAssignModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-end md:items-center justify-center backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-black text-xl text-[#1A1A1A]">指派常驻任务</h3>
                            <button onClick={() => setIsAssignModalOpen(false)}><X size={20}/></button>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl mb-4 text-xs text-indigo-700">
                            <span className="font-bold">💡 常驻模式：</span> 指派后按设定频率重复，直到您手动取消。
                        </div>
                        <p className="text-sm text-gray-500 mb-4 font-bold">已选 {selectedForAssign.size} 个物品</p>
                        
                        <div className="mb-4">
                            <label className={LABEL_STYLE}>Assign To (指派给)</label>
                            <select value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)} className={INPUT_STYLE}>
                                <option value="">Select Staff...</option>
                                {staffList.map(s => {
                                    const hasPending = activeTasks.some(t => t.assigneeId === s.id);
                                    return (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.role.split('(')[0]}) {hasPending ? '📋 已有任务' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className={LABEL_STYLE}>盘点频率</label>
                            <div className="grid grid-cols-3 gap-2">
                                {FREQ_OPTIONS.map(opt => (
                                    <button key={opt.value} onClick={() => setAssignFrequency(opt.value)}
                                        className={`p-3 rounded-xl border-2 text-center transition-all ${assignFrequency === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                        <div className="font-black text-sm text-[#1A1A1A]">{opt.label}</div>
                                        <div className="text-[10px] text-gray-400">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedAssignee && activeTasks.some(t => t.assigneeId === selectedAssignee && t.checkFrequency === assignFrequency) && (
                            <div className="mb-4 bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-700">
                                <div className="flex items-center gap-2 font-bold">
                                    <UserCheck size={14}/>
                                    <span>该员工已有同频率的任务，将自动合并</span>
                                </div>
                                <p className="text-[10px] mt-1 text-blue-500">新选物品将自动追加到现有任务中。</p>
                            </div>
                        )}

                        <button onClick={confirmAssignment} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-lg shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2 active:scale-[0.98]">
                            <Send size={18}/> 确认指派
                        </button>
                    </div>
                </div>
            )}

            {editingTask && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full h-full md:max-w-lg md:h-auto md:max-h-[90vh] md:rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col relative overflow-hidden">
                        <div className="p-4 md:p-6 pb-3 shrink-0 border-b border-gray-100 bg-white z-10">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-black text-xl text-[#1A1A1A] flex items-center gap-2"><PenLine size={20}/> 编辑常驻任务</h3>
                                <button onClick={() => setEditingTask(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
                            </div>
                            <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-xl border border-indigo-100 mb-3">
                                <UserCheck size={16} className="text-indigo-600"/>
                                <div>
                                    <div className="font-bold text-sm text-indigo-800">{editingTask.assigneeName}</div>
                                    <div className="text-[10px] text-indigo-400">{editTaskItems.size} items selected</div>
                                </div>
                            </div>
                            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                                {FREQ_OPTIONS.map(opt => (
                                    <button key={opt.value} onClick={() => setEditTaskFrequency(opt.value)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all ${editTaskFrequency === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={14}/>
                                <input type="text" placeholder="搜索物品..." value={editTaskSearchTerm} onChange={(e) => setEditTaskSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400"/>
                            </div>
                        </div>

                        <div className="p-4 overflow-y-auto flex-grow space-y-2 bg-[#F9FAFB]">
                            {editTaskStockData
                                .filter(s => !editTaskSearchTerm || s.name.toLowerCase().includes(editTaskSearchTerm.toLowerCase()))
                                .map(stockItem => {
                                    const isSelected = editTaskItems.has(stockItem.id);
                                    return (
                                        <div key={stockItem.id} onClick={() => toggleEditTaskItem(stockItem.id)}
                                            className={`p-3 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all ${isSelected ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                                            <div>
                                                <div className="font-bold text-sm text-[#1A1A1A]">{stockItem.name}</div>
                                                <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getCategoryColor(stockItem.category)}`}>{getCategoryLabel(stockItem.category)}</span>
                                                    <span>Qty: {stockItem.currentQty} {stockItem.unit}</span>
                                                </div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'}`}>
                                                {isSelected && <Check size={14} strokeWidth={3}/>}
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-white flex gap-3 shrink-0">
                            <button onClick={() => setEditingTask(null)} className="flex-1 py-3 bg-white border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50">取消</button>
                            <button onClick={saveTaskEdits}
                                className="flex-[2] py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
                                <Save size={16}/> 保存更改 ({editTaskItems.size} items)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isExportModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-end md:items-center justify-center backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 border-t-8 border-[#1A1A1A]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-[#1A1A1A] flex items-center gap-2"><Printer size={20}/> 导出库存报表</h3>
                            <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                        </div>

                        <div className="space-y-6 mb-6">
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase mb-3 block">选择导出区域 (Categories)</label>
                                <div className="space-y-2">
                                    {Object.entries(exportConfig.categories).map(([key, checked]) => (
                                        <div key={key} onClick={() => handleCategoryToggle(key as keyof typeof exportConfig.categories)}
                                            className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300'}`}>
                                            <span className="font-bold text-sm text-[#1A1A1A]">{CATEGORY_SECTIONS[key] ? CATEGORY_SECTIONS[key][0].label.split('(')[0] : key} 区域</span>
                                            {checked ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20} className="text-gray-300"/>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase mb-1 block">高级选项 (Options)</label>
                                <div onClick={() => setExportConfig(prev => ({...prev, showCost: !prev.showCost}))}
                                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${exportConfig.showCost ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-300'}`}>
                                    <div>
                                        <span className="font-bold text-sm text-[#1A1A1A]">显示成本与价值 (Show Value)</span>
                                        <p className="text-[10px] text-gray-500 mt-0.5">适合财务/老板查阅</p>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${exportConfig.showCost ? 'bg-green-500' : 'bg-gray-300'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${exportConfig.showCost ? 'translate-x-4' : ''}`}></div>
                                    </div>
                                </div>
                                <div onClick={() => setExportConfig(prev => ({...prev, lowStockOnly: !prev.lowStockOnly}))}
                                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${exportConfig.lowStockOnly ? 'border-red-500 bg-red-50' : 'border-gray-100 hover:border-gray-300'}`}>
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

                        <button onClick={executeExport} disabled={!Object.values(exportConfig.categories).some(Boolean) || isGeneratingPdf}
                            className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-2xl font-black text-lg shadow-lg hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100">
                            {isGeneratingPdf ? <Loader2 size={20} className="animate-spin"/> : <FileDown size={20}/>} 
                            {isGeneratingPdf ? '生成中 (Generating)...' : '确认导出 PDF'}
                        </button>
                    </div>
                </div>
            )}

            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                <div ref={printRef}>
                    {printChunks.map((chunk, pageIndex) => (
                        <div key={pageIndex} id={`print-page-${pageIndex}`} className="w-[210mm] min-h-[297mm] bg-white p-10 font-sans text-black relative flex flex-col">
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
                                    {chunk.map((item) => (
                                        <tr key={item.id} className="border-b border-gray-200 break-inside-avoid">
                                            <td className="p-2 text-center font-mono text-gray-500 bg-gray-50 border-r border-gray-200">{item.id}</td>
                                            <td className="p-2 font-bold text-gray-700 uppercase border-r border-gray-200">{getCategoryLabel(item.category)}</td>
                                            <td className="p-2 font-bold border-r border-gray-200">{item.name}</td>
                                            <td className="p-2 text-center uppercase font-mono text-gray-500 border-r border-gray-200">{item.unit}</td>
                                            <td className="p-2 text-center font-bold text-gray-400 border-r border-gray-200">{item.minLevel}</td>
                                            <td className="p-2 text-center font-black border-r border-gray-200 text-lg">{item.currentQty}</td>
                                            <td className="p-2 border-r border-gray-200">
                                                <div className="w-full h-6 border-b border-gray-300"></div>
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