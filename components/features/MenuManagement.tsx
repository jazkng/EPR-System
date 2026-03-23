import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Utensils, Plus, Search, Edit3, Trash2, X, Save, Image as ImageIcon, Box, Truck, RefreshCw, Grid, Camera, Loader2, Copy, Layers, AlertTriangle, Wrench, ArrowLeft, ArrowRight, Move, ChevronLeft, BookOpen, Check } from 'lucide-react';
import { MenuItem, MenuCategory, MenuVariant, StockItem, MenuIngredient } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { MENU_CATEGORIES, INITIAL_MENU_ITEMS } from '../../constants/menu';
import { ModuleGuideButton } from '../ui/ModuleGuide';
import { uploadToCloudinary } from '../utils';

interface MenuManagementProps {
    onClose?: () => void;
    isModal?: boolean;
}

const STOCK_CATEGORIES: Record<string, string> = {
    'FRESH': '生鲜 (Fresh)', 'MEAT': '肉类 (Meat)', 'SEAFOOD': '海鲜 (Seafood)',
    'VEG': '蔬果 (Veg)', 'NOODLE': '面类 (Noodles)', 'DRY': '干货 (Dry)',
    'SAUCE': '酱料 (Sauce)', 'HQ': '总店 (HQ)', 'TEA': '茶叶 (Tea)',
    'FRUIT': '水果 (Fruit)', 'RTD': '罐装 (Drinks)', 'OTHER': '其他 (Other)'
};

export const MenuManagement: React.FC<MenuManagementProps> = ({ onClose, isModal = true }) => {
    // Data State
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<MenuCategory[]>(MENU_CATEGORIES);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [hasLegacyData, setHasLegacyData] = useState(false);
    
    // View State
    const [activeCategory, setActiveCategory] = useState<string>('ALL'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [priceMode, setPriceMode] = useState<'LOCAL' | 'DELIVERY'>('LOCAL');
    const [deliveryCommission, setDeliveryCommission] = useState<number>(27); 
    const [viewMode, setViewMode] = useState<'LIST' | 'EDIT'>('LIST');
    const [loading, setLoading] = useState(true);

    const [isReorderMode, setIsReorderMode] = useState(false);
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState('A_SERIES');
    const [newOptions, setNewOptions] = useState('');
    const [newImage, setNewImage] = useState('');
    const [newVariants, setNewVariants] = useState<MenuVariant[]>([]);
    const [activeVariantTab, setActiveVariantTab] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [showStockSelector, setShowStockSelector] = useState(false);
    const [stockSearch, setStockSearch] = useState('');
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [copySearch, setCopySearch] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            DataManager.getStock('KITCHEN').then(k => 
                DataManager.getStock('BAR').then(b => 
                    DataManager.getStock('GENERAL').then(g => 
                        setStockItems([...k, ...b, ...g])
                    )
                )
            ).catch(err => console.error("Stock load error", err));

            const items = await DataManager.getMenu();
            if (items && items.length > 0) {
                setMenuItems(items);
                const legacy = items.some(i => ['c2','c3','c4'].includes(i.id.toLowerCase()));
                setHasLegacyData(legacy);
            } else {
                setMenuItems(INITIAL_MENU_ITEMS);
            }
        } catch (error) {
            console.error("Failed to load menu data", error);
            setMenuItems(INITIAL_MENU_ITEMS);
        } finally {
            setLoading(false);
        }
    };

    // --- REORDER LOGIC ---
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        const newItems = [...menuItems];
        const draggedItem = newItems[draggedItemIndex];
        newItems.splice(draggedItemIndex, 1);
        newItems.splice(index, 0, draggedItem);
        setMenuItems(newItems);
        setDraggedItemIndex(index);
    };

    const handleDragEnd = () => setDraggedItemIndex(null);

    const handleMoveItem = (index: number, direction: 'UP' | 'DOWN') => {
        if (direction === 'UP' && index === 0) return;
        if (direction === 'DOWN' && index === menuItems.length - 1) return;
        const newItems = [...menuItems];
        const targetIndex = direction === 'UP' ? index - 1 : index + 1;
        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
        setMenuItems(newItems);
    };

    const saveReorderedList = async () => {
        if (!confirm("确认保存新的排序吗？(Confirm Save Order?)")) return;
        setLoading(true);
        await DataManager.saveMenu(menuItems);
        setLoading(false);
        setIsReorderMode(false);
        alert("✅ 排序已保存 (Order Saved)");
    };

    // --- 📸 直接上传图片 (Direct Image Upload) ---
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploading(true);
        try {
            const url = await uploadToCloudinary(file);
            setNewImage(url);
        } catch (error) {
            console.error("Image upload failed:", error);
            alert("图片上传失败，请重试");
        } finally {
            setIsUploading(false);
            if(fileInputRef.current) fileInputRef.current.value = ''; 
        }
    };

    const calculateDeliveryPrice = (localPrice: number) => {
        if (!localPrice) return 0;
        const factor = 1 - (deliveryCommission / 100);
        const safeFactor = factor > 0 ? factor : 1;
        const calculatedPrice = localPrice / safeFactor;
        const wholeNumber = Math.floor(calculatedPrice);
        const decimalPart = calculatedPrice - wholeNumber;
        return decimalPart >= 0.45 ? wholeNumber + 0.5 : wholeNumber;
    };

    const getDisplayPrice = (basePrice: number | undefined | null) => {
        const price = Number(basePrice) || 0;
        return priceMode === 'LOCAL' ? price : calculateDeliveryPrice(price);
    };

    const calculateMargin = (price: number, cost: number) => {
        const p = Number(price) || 0;
        const c = Number(cost) || 0;
        if (p <= 0) return 0;
        return ((p - c) / p) * 100;
    };

    const saveMenu = async (items: MenuItem[]) => {
        setMenuItems(items);
        await DataManager.saveMenu(items); 
    };

    const handleSaveItem = async () => {
        if (!newName) return alert("请填写菜品名称");
        const validVariants = newVariants.filter(v => v.price > 0);
        if(validVariants.length === 0) return alert("请至少填写一个规格的售价");

        const newItem: MenuItem = {
            id: editingId || `menu_${Date.now()}`,
            name: newName,
            category: newCategory,
            variants: newVariants,
            options: newOptions ? newOptions.split(',').map(s => s.trim()).filter(s => s) : [],
            image: newImage
        };

        if (editingId) {
            const updated = menuItems.map(i => i.id === editingId ? newItem : i);
            await saveMenu(updated);
        } else {
            await saveMenu([...menuItems, newItem]);
        }
        resetForm();
        setViewMode('LIST');
    };

    const handleEditItem = (item: MenuItem) => {
        if (isReorderMode) return;
        setNewName(item.name);
        setNewCategory(item.category);
        setNewOptions(item.options ? item.options.join(', ') : '');
        setNewImage(item.image || '');
        setNewVariants(item.variants && item.variants.length > 0 
            ? JSON.parse(JSON.stringify(item.variants)) 
            : [{ label: 'S (小)', price: 0, cost: 0, recipe: [] }, { label: 'M (中)', price: 0, cost: 0, recipe: [] }, { label: 'L (大)', price: 0, cost: 0, recipe: [] }]);
        setEditingId(item.id);
        setViewMode('EDIT');
        setActiveVariantTab(0);
    };

    const resetForm = () => {
        setNewName(''); setNewCategory('A_SERIES'); setNewOptions(''); setNewImage('');
        setNewVariants([
            { label: 'S (小)', price: 0, cost: 0, recipe: [] },
            { label: 'M (中)', price: 0, cost: 0, recipe: [] },
            { label: 'L (大)', price: 0, cost: 0, recipe: [] }
        ]);
        setEditingId(null);
    };

    const handleAddNew = () => { resetForm(); setViewMode('EDIT'); };
    const handleDeleteClick = (id: string) => { if (isReorderMode) return; setDeleteId(id); };
    
    const confirmDelete = async () => {
        if (deleteId) {
            await DataManager.deleteMenuItem(deleteId); 
            const updated = menuItems.filter(i => i.id !== deleteId); 
            setMenuItems(updated);
            setDeleteId(null);
        }
    };

    const handleResetToDefault = async () => {
        if(!confirm("⚠️ 确定重置菜谱到初始状态吗？\n所有自定义更改将丢失，恢复为金莲记标准菜单。")) return;
        setLoading(true);
        await DataManager.saveMenu(INITIAL_MENU_ITEMS);
        setMenuItems(INITIAL_MENU_ITEMS);
        setHasLegacyData(false);
        setLoading(false);
        alert("✅ 菜谱已恢复 (Menu Restored)");
    };

    const handleFixLegacyData = async () => {
        if(!confirm("⚠️ 发现旧数据 (C2, C3...)。确定要修复吗？\n这将删除错误的 ID 并恢复 A13/A14 等正确 ID。")) return;
        setLoading(true);
        try {
            await DataManager.deleteMenuItem('c2'); await DataManager.deleteMenuItem('C2');
            await DataManager.deleteMenuItem('c3'); await DataManager.deleteMenuItem('C3');
            await DataManager.deleteMenuItem('c4'); await DataManager.deleteMenuItem('C4');
            await DataManager.saveMenu(INITIAL_MENU_ITEMS);
            await loadData();
            alert("✅ 数据已修复 (Data Fixed)");
        } catch(e) {
            alert("修复失败");
        } finally {
            setLoading(false);
        }
    };

    // Recipe logic...
    const addIngredientToVariant = (stockItem: StockItem) => {
        const updatedVariants = [...newVariants];
        const currentVariant = updatedVariants[activeVariantTab];
        if (!currentVariant.recipe) currentVariant.recipe = [];
        if (currentVariant.recipe.find(r => r.stockId === stockItem.id)) return;
        currentVariant.recipe.push({ stockId: stockItem.id, stockName: stockItem.name, qty: 0, unit: stockItem.unit, costPerUnit: stockItem.cost });
        currentVariant.cost = currentVariant.recipe.reduce((sum, item) => sum + (item.qty * item.costPerUnit), 0);
        setNewVariants(updatedVariants);
        setShowStockSelector(false);
    };

    const updateIngredientQty = (idx: number, qty: number) => {
        const updatedVariants = [...newVariants];
        const currentVariant = updatedVariants[activeVariantTab];
        if (currentVariant.recipe && currentVariant.recipe[idx]) {
            currentVariant.recipe[idx].qty = qty;
            currentVariant.cost = currentVariant.recipe.reduce((sum, item) => sum + (item.qty * item.costPerUnit), 0);
        }
        setNewVariants(updatedVariants);
    };

    const removeIngredient = (idx: number) => {
        const updatedVariants = [...newVariants];
        const currentVariant = updatedVariants[activeVariantTab];
        if (currentVariant.recipe) {
            currentVariant.recipe.splice(idx, 1);
            currentVariant.cost = currentVariant.recipe.reduce((sum, item) => sum + (item.qty * item.costPerUnit), 0);
        }
        setNewVariants(updatedVariants);
    };

    const updateVariantField = (idx: number, field: keyof MenuVariant, val: any) => {
        const updated = [...newVariants];
        updated[idx] = { ...updated[idx], [field]: val };
        setNewVariants(updated);
    };

    const deleteVariant = (idx: number) => {
        if (newVariants.length <= 1) return alert("必须保留至少一个规格");
        if (!confirm("确定删除此规格吗？(Confirm delete variant?)")) return;
        const updated = newVariants.filter((_, i) => i !== idx);
        setNewVariants(updated);
        setActiveVariantTab(0);
    };

    const syncRecipeToAll = () => {
        if (!newVariants[activeVariantTab].recipe || newVariants[activeVariantTab].recipe?.length === 0) return alert("当前规格没有配方，无法同步。");
        if (!confirm(`确定将 [${newVariants[activeVariantTab].label}] 的配方同步到其他所有规格吗？\n其他规格现有的配方将被覆盖。`)) return;
        const baseRecipe = newVariants[activeVariantTab].recipe || [];
        const updatedVariants = newVariants.map((v, idx) => {
            if (idx === activeVariantTab) return v;
            const clonedRecipe = baseRecipe.map(ing => ({ ...ing }));
            const newCost = clonedRecipe.reduce((sum, item) => sum + (item.qty * item.costPerUnit), 0);
            return { ...v, recipe: clonedRecipe, cost: newCost };
        });
        setNewVariants(updatedVariants);
        alert("✅ 配方已同步！请检查其他规格的用量。");
    };

    const handleCopyRecipe = (sourceItem: MenuItem) => {
        if (!sourceItem.variants || sourceItem.variants.length === 0) return alert("Source item has no variants.");
        const sourceVariant = sourceItem.variants[activeVariantTab] || sourceItem.variants[0];
        if (!sourceVariant.recipe || sourceVariant.recipe.length === 0) return alert("该菜品暂无配方 (No recipe found in source).");
        const confirmMsg = `确认从 [${sourceItem.name} - ${sourceVariant.label}] 复制配方吗？\n当前规格 [${newVariants[activeVariantTab].label}] 的现有配方将被覆盖。`;
        if (!confirm(confirmMsg)) return;
        const updatedVariants = [...newVariants];
        updatedVariants[activeVariantTab].recipe = JSON.parse(JSON.stringify(sourceVariant.recipe));
        updatedVariants[activeVariantTab].cost = updatedVariants[activeVariantTab].recipe!.reduce((sum, item) => sum + (item.qty * item.costPerUnit), 0);
        setNewVariants(updatedVariants);
        setShowCopyModal(false);
        setCopySearch('');
    };

    const visibleGridItems = useMemo(() => {
        return menuItems.map((item, index) => ({ ...item, globalIndex: index })).filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [menuItems, activeCategory, searchTerm]);

    const containerClass = isModal 
        ? "fixed inset-0 z-[100] flex flex-col font-sans bg-[#F5F7FA]" 
        : "relative w-full h-[85vh] bg-[#F5F7FA] flex flex-col font-sans rounded-3xl overflow-hidden border border-gray-200 shadow-xl";

    const renderItemCard = (item: MenuItem & { globalIndex: number }, displayIndex: number) => (
        <div 
            key={item.id} 
            draggable={isReorderMode}
            onDragStart={(e) => handleDragStart(e, item.globalIndex)}
            onDragOver={(e) => handleDragOver(e, item.globalIndex)}
            onDragEnd={handleDragEnd}
            className={`
                bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col relative overflow-hidden h-full select-none
                ${isReorderMode 
                    ? 'cursor-move ring-2 ring-[#FFD700] ring-offset-2 scale-[0.98]' 
                    : 'border border-gray-100 hover:border-yellow-400 cursor-default'
                }
            `}
        >
            <div className="w-full aspect-square bg-gray-50 relative overflow-hidden shrink-0 border-b border-gray-100">
                {item.image ? (
                    <img src={item.image} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"/>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gradient-to-br from-gray-50 to-gray-100">
                        <Utensils size={36} className="mb-2 opacity-40"/>
                        <span className="text-[10px] tracking-widest font-bold opacity-40">NO IMAGE</span>
                    </div>
                )}
                
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-[10px] font-mono font-black px-2 py-1 rounded-lg shadow-sm">
                    {item.id}
                </div>

                {priceMode === 'DELIVERY' && !isReorderMode && (
                    <div className="absolute top-2 right-2 bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md">
                        <Truck size={12}/> 抽成 {deliveryCommission}%
                    </div>
                )}

                {!isReorderMode && (
                    <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                        <button onClick={() => handleEditItem(item)} className="p-2 text-[#1A1A1A] bg-white/95 backdrop-blur shadow-lg hover:bg-[#FFD700] rounded-xl transition-colors"><Edit3 size={14}/></button>
                        <button onClick={() => handleDeleteClick(item.id)} className="p-2 text-red-600 bg-white/95 backdrop-blur shadow-lg hover:bg-red-500 hover:text-white rounded-xl transition-colors"><Trash2 size={14}/></button>
                    </div>
                )}
            </div>

            <div className="p-3 md:p-4 flex flex-col flex-grow bg-white relative z-10">
                <h4 className="font-black text-sm md:text-base text-[#1A1A1A] line-clamp-2 leading-snug mb-3 group-hover:text-yellow-600 transition-colors">
                    {item.name}
                </h4>

                {isReorderMode && (
                    <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl mt-auto p-1.5 shadow-inner">
                        <button onClick={() => handleMoveItem(item.globalIndex, 'UP')} className="p-2 hover:bg-white rounded-lg text-yellow-700 active:scale-95 shadow-sm"><ArrowLeft size={14}/></button>
                        <Move size={16} className="text-yellow-500"/>
                        <button onClick={() => handleMoveItem(item.globalIndex, 'DOWN')} className="p-2 hover:bg-white rounded-lg text-yellow-700 active:scale-95 shadow-sm"><ArrowRight size={14}/></button>
                    </div>
                )}

                {!isReorderMode && (
                    <div className="mt-auto space-y-1.5 bg-gray-50/70 rounded-xl p-2.5 md:p-3 border border-gray-100">
                        {(item.variants || []).slice(0, 3).map((v, idx) => {
                            const dispPrice = getDisplayPrice(v.price);
                            return (
                                <div key={idx} className="flex justify-between items-end border-b border-dashed border-gray-200 last:border-0 pb-1.5 last:pb-0">
                                    <span className="font-bold text-xs text-gray-600 truncate pr-2">{v.label}</span>
                                    <div className={`font-mono font-black tabular-nums whitespace-nowrap leading-none ${priceMode === 'DELIVERY' ? 'text-blue-600' : 'text-[#1A1A1A]'}`}>
                                        <span className="text-[10px] mr-0.5 opacity-60">RM</span>
                                        <span className="text-sm">{dispPrice.toFixed(0)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!isReorderMode && item.options && item.options.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.options.slice(0, 3).map(opt => (
                            <span key={opt} className="text-[9px] bg-[#1A1A1A] text-[#FFD700] px-1.5 py-0.5 rounded flex items-center">{opt}</span>
                        ))}
                        {item.options.length > 3 && (
                            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">+{item.options.length - 3}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={containerClass}>
            <div className="bg-[#1A1A1A] px-3 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] md:px-4 md:pb-4 md:pt-[max(env(safe-area-inset-top),1rem)] flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700] z-30 relative shadow-md">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="bg-[#FFD700] text-black p-2 rounded-xl shadow-lg"><Utensils size={20} className="md:w-6 md:h-6"/></div>
                    <div>
                        <h3 className="font-serif font-black text-lg md:text-xl tracking-wide">智能菜谱系统</h3>
                        <p className="text-[9px] md:text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">SMART MENU</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <ModuleGuideButton module="MENU_MANAGEMENT" />
                    {onClose && <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>}
                </div>
            </div>

            {viewMode === 'LIST' && (
                <div className="flex-grow flex flex-col overflow-hidden bg-[#F5F7FA]">
                    <div className="bg-white border-b border-gray-200 p-2 md:p-3 space-y-2 shadow-sm z-20 shrink-0 sticky top-0">
                        {hasLegacyData && (
                            <div className="bg-yellow-50 border border-yellow-200 p-2 rounded-xl flex justify-between items-center animate-in slide-in-from-top-4">
                                <div className="flex items-center gap-2 text-yellow-800 font-bold text-xs">
                                    <AlertTriangle size={14}/>
                                    <span>发现旧数据 ID (C2, C3...)</span>
                                </div>
                                <button onClick={handleFixLegacyData} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm flex items-center gap-1">
                                    <Wrench size={10}/> 修复
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row justify-between items-center gap-2">
                            <div className="flex gap-2 w-full md:flex-1 md:w-0 overflow-x-auto scrollbar-hide pb-1 md:pb-0 px-1">
                                {categories.map(c => (
                                    <button key={c.id} onClick={() => setActiveCategory(c.id)} disabled={isReorderMode && c.id === 'ALL'} className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold whitespace-nowrap transition-all duration-200 border shrink-0 ${activeCategory === c.id ? 'bg-gradient-to-r from-[#1A1A1A] to-[#333] text-[#FFD700] shadow-md border-transparent scale-105' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'}`}>
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                            
                            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end overflow-x-auto px-1">
                                <button onClick={() => { if (isReorderMode) { saveReorderedList(); } else { setIsReorderMode(true); } }} className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm transition-all whitespace-nowrap border ${isReorderMode ? 'bg-green-50 text-green-700 border-green-200 animate-pulse' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    {isReorderMode ? <Save size={14}/> : <Move size={14}/>} 
                                    {isReorderMode ? '保存顺序 (Save)' : '排序 (Sort)'}
                                </button>

                                {!isReorderMode && (
                                    <>
                                        <div className="bg-gray-100 p-0.5 rounded-lg flex shrink-0 border border-gray-200 items-center">
                                            <button onClick={() => setPriceMode('LOCAL')} className={`px-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${priceMode === 'LOCAL' ? 'bg-white shadow-sm text-black ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}>堂食</button>
                                            <div className="flex items-center relative">
                                                <button onClick={() => setPriceMode('DELIVERY')} className={`px-2 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${priceMode === 'DELIVERY' ? 'bg-white shadow-sm text-blue-600 ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}>
                                                    <Truck size={10}/> 外卖
                                                </button>
                                                {priceMode === 'DELIVERY' && (
                                                    <div className="flex items-center ml-1 pr-1 bg-white border border-gray-200 rounded text-[10px] h-6 shadow-sm overflow-hidden">
                                                        <span className="text-gray-400 pl-1">抽成</span>
                                                        <input type="number" value={deliveryCommission} onChange={e => setDeliveryCommission(Number(e.target.value) || 0)} className="w-7 text-center font-bold outline-none text-blue-600 bg-transparent text-[10px]" onClick={e => e.stopPropagation()}/>
                                                        <span className="text-gray-400 font-mono">%</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={handleAddNew} className="bg-[#FFD700] hover:bg-[#E5C100] text-black px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 shadow-md active:scale-95 transition-all shrink-0 border border-yellow-400/20">
                                            <Plus size={14}/> <span className="hidden sm:inline">新增</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        
                        {!isReorderMode && (
                            <div className="relative flex gap-2">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-3 top-2 text-gray-400" size={14}/>
                                    <input type="text" placeholder="搜索菜名 (Search Menu)..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); }} className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent transition-all shadow-sm"/>
                                </div>
                                <button onClick={handleResetToDefault} className="px-3 bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:bg-red-50 hover:border-red-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm shrink-0" title="Reset">
                                    <RefreshCw size={12}/> 重置
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-grow overflow-hidden flex flex-col relative pb-[max(env(safe-area-inset-bottom,20px),1rem)]" id="menu-scroll-container">
                        {loading ? <div className="text-center py-20 text-gray-400 flex flex-col items-center"><RefreshCw className="animate-spin mb-2"/>Loading Menu...</div> : (
                            <div className="overflow-y-auto p-3 md:p-4 pb-32 h-full">
                                {visibleGridItems.length === 0 ? <div className="text-center py-20 text-gray-400 font-bold">暂无菜品 (No Items)</div> : (
                                    <div className="max-w-[1600px] mx-auto w-full">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
                                            {visibleGridItems.map((item, idx) => renderItemCard(item, idx))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* View Mode: Edit */}
            {viewMode === 'EDIT' && (
                <div className="flex-grow flex flex-col md:flex-row bg-[#F5F7FA] overflow-y-auto md:overflow-hidden h-full relative">
                    
                    <div className="w-full md:w-1/3 bg-white border-b md:border-r md:border-b-0 border-gray-200 p-6 flex flex-col shrink-0 z-20 md:h-full md:overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={() => setViewMode('LIST')} className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-black"><ChevronLeft size={16}/> 返回列表</button>
                            {editingId && (
                                <button onClick={() => handleDeleteClick(editingId)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors md:hidden">
                                    <Trash2 size={16}/>
                                </button>
                            )}
                        </div>
                        
                        <h3 className="font-black text-2xl text-[#1A1A1A] mb-6">{editingId ? '编辑菜品' : '新增菜品'}</h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Name (菜名)</label>
                                <input className="w-full p-3 bg-gray-50 rounded-xl text-base md:text-sm font-bold outline-none border-2 border-transparent focus:border-[#FFD700]" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Hokkien Mee" />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Category (分类)</label>
                                <select className="w-full p-3 bg-gray-50 rounded-xl text-base md:text-sm font-bold outline-none" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                                    {categories.filter(c=>c.id!=='ALL').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                            </div>

                            {/* --- 🖼️ 照片上传区 (直接上传) --- */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                                    Image (照片)
                                </label>
                                <div 
                                    className="relative w-full aspect-square bg-gray-50 rounded-xl overflow-hidden cursor-pointer group border-2 border-dashed border-gray-300 hover:border-[#FFD700] transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {newImage ? (
                                        <>
                                            <img src={newImage} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-xs gap-2">
                                                <Camera size={16}/> 更改照片
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                            {isUploading ? <Loader2 size={24} className="animate-spin text-[#FFD700]"/> : <ImageIcon size={24}/>}
                                            <span className="text-xs font-bold">{isUploading ? '处理中...' : '点击上传照片'}</span>
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Options (选项)</label>
                                <input className="w-full p-3 bg-gray-50 rounded-xl text-base md:text-sm font-bold outline-none border-2 border-transparent focus:border-[#FFD700]" value={newOptions} onChange={e => setNewOptions(e.target.value)} placeholder="e.g. 少辣, 加蛋, 走青 (Comma separated)" />
                            </div>
                        </div>
                        
                        <div className="mt-auto pt-6 hidden md:block pb-[env(safe-area-inset-bottom)]">
                            <button onClick={handleSaveItem} className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-lg shadow-lg hover:bg-black flex items-center justify-center gap-2">
                                <Save size={20}/> 保存菜品 (Save)
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow p-6 md:h-full md:overflow-y-auto pb-40 md:pb-6">
                        <div className="max-w-3xl mx-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="font-black text-lg text-[#1A1A1A]">规格与配方</h4>
                                <div className="flex items-center gap-2">
                                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 overflow-x-auto max-w-[200px] md:max-w-none scrollbar-hide">
                                        {newVariants.map((v, idx) => (
                                            <button 
                                                key={idx}
                                                onClick={() => setActiveVariantTab(idx)}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeVariantTab === idx ? 'bg-[#1A1A1A] text-[#FFD700]' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                {v.label || `Var ${idx+1}`}
                                            </button>
                                        ))}
                                        <button onClick={() => setNewVariants([...newVariants, { label: 'New', price: 0, cost: 0, recipe: [] }])} className="px-3 py-2 text-gray-400 hover:text-black"><Plus size={16}/></button>
                                    </div>
                                    <button onClick={() => deleteVariant(activeVariantTab)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors" title="Delete Variant">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-gray-100">
                                    <div>
                                        <label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">Label (规格名)</label>
                                        <input className="w-full p-2 bg-gray-50 rounded-lg text-base md:text-sm font-bold outline-none border focus:border-[#FFD700]" value={newVariants[activeVariantTab]?.label || ''} onChange={e => updateVariantField(activeVariantTab, 'label', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">Local Price</label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-[9px] text-gray-400 text-xs">RM</span>
                                            <input type="number" className="w-full p-2 pl-8 bg-gray-50 rounded-lg text-base md:text-sm font-bold outline-none border focus:border-[#FFD700]" value={newVariants[activeVariantTab]?.price || 0} onChange={e => updateVariantField(activeVariantTab, 'price', parseFloat(e.target.value))} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">Delivery Price (Auto)</label>
                                        <div className="w-full p-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-mono font-black">RM {calculateDeliveryPrice(newVariants[activeVariantTab]?.price || 0).toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">Margin (GP)</label>
                                        <div className={`w-full p-2 rounded-lg text-sm font-black ${calculateMargin(newVariants[activeVariantTab]?.price || 0, newVariants[activeVariantTab]?.cost || 0) >= 65 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {calculateMargin(newVariants[activeVariantTab]?.price || 0, newVariants[activeVariantTab]?.cost || 0).toFixed(0)}%
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <h5 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><Box size={16}/> 配方食材 (Ingredients)</h5>
                                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                            <button onClick={syncRecipeToAll} className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1 flex-1 sm:flex-none justify-center">
                                                <Layers size={12}/> 同步到所有规格
                                            </button>
                                            <button onClick={() => setShowCopyModal(true)} className="text-[10px] bg-orange-50 text-orange-600 px-3 py-2 rounded-lg font-bold hover:bg-orange-100 transition-colors flex items-center gap-1 flex-1 sm:flex-none justify-center">
                                                <BookOpen size={12}/> 从其他菜品复制
                                            </button>
                                            <button onClick={() => setShowStockSelector(true)} className="text-[10px] bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-bold hover:bg-blue-100 transition-colors flex items-center gap-1 flex-1 sm:flex-none justify-center">
                                                <Plus size={12}/> 添加原料
                                            </button>
                                        </div>
                                    </div>

                                    {(!newVariants[activeVariantTab]?.recipe || newVariants[activeVariantTab].recipe?.length === 0) ? (
                                        <div className="text-center py-8 text-gray-400 text-xs italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            暂无配方 (No Ingredients)
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {newVariants[activeVariantTab].recipe?.map((ing, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                    <div>
                                                        <div className="font-bold text-sm text-[#1A1A1A]">{ing.stockName}</div>
                                                        <div className="text-[10px] text-gray-400">Cost: RM {ing.costPerUnit}/{ing.unit}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
                                                            <input type="number" value={ing.qty} onChange={e => updateIngredientQty(i, parseFloat(e.target.value))} className="w-16 p-1.5 text-center font-bold text-base md:text-sm outline-none bg-white text-black" />
                                                            <span className="text-[10px] font-bold text-gray-500 px-2 border-l bg-gray-50 h-full flex items-center">{ing.unit}</span>
                                                        </div>
                                                        <div className="text-right w-16">
                                                            <div className="font-mono font-bold text-xs">RM {(ing.qty * ing.costPerUnit).toFixed(2)}</div>
                                                        </div>
                                                        <button onClick={() => removeIngredient(i)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-full"><X size={14}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="md:hidden fixed bottom-0 left-0 w-full px-4 pt-3 pb-[max(env(safe-area-inset-bottom,20px),1rem)] bg-white/95 backdrop-blur-md border-t border-gray-200 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                        <button onClick={handleSaveItem} className="w-full py-3.5 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-lg shadow-lg hover:bg-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                            <Save size={20}/> 保存菜品 (Save)
                        </button>
                    </div>
                </div>
            )}

            {deleteId && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in pb-[env(safe-area-inset-bottom)]">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
                        <Trash2 size={48} className="mx-auto text-red-500 mb-4"/>
                        <h3 className="font-black text-xl mb-2">确认删除?</h3>
                        <p className="text-sm text-gray-500 mb-6">此操作将永久删除该菜品。</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setDeleteId(null)} className="py-3 bg-gray-100 rounded-xl font-bold text-sm">取消</button>
                            <button onClick={confirmDelete} className="py-3 bg-red-600 text-white rounded-xl font-bold text-sm">删除</button>
                        </div>
                    </div>
                </div>
            )}

            {showStockSelector && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in pb-[env(safe-area-inset-bottom)]">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-black text-lg">选择库存原料</h3>
                            <button onClick={() => setShowStockSelector(false)}><X/></button>
                        </div>
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                                <input className="w-full pl-10 p-2 bg-gray-50 rounded-xl text-base md:text-sm font-bold outline-none" placeholder="Search stock..." value={stockSearch} onChange={e => setStockSearch(e.target.value)} autoFocus />
                            </div>
                        </div>
                        <div className="flex-grow overflow-y-auto p-2 pb-6">
                            {(() => {
                                const grouped: Record<string, StockItem[]> = {};
                                const kitchenOnly = stockItems.filter(s => {
                                    if (stockSearch) return s.name.toLowerCase().includes(stockSearch.toLowerCase());
                                    return ['FRESH', 'MEAT', 'SEAFOOD', 'VEG', 'NOODLE', 'DRY', 'SAUCE', 'HQ'].includes(s.category) || s.id.startsWith('K');
                                });
                                kitchenOnly.forEach(s => {
                                    const catLabel = STOCK_CATEGORIES[s.category] || '其他 (Other)';
                                    if (!grouped[catLabel]) grouped[catLabel] = [];
                                    grouped[catLabel].push(s);
                                });
                                const sortedGroups = Object.keys(grouped).sort();
                                if (sortedGroups.length === 0) return <div className="p-8 text-center text-gray-400 text-xs">No matching kitchen ingredients found.</div>;
                                return sortedGroups.map(group => (
                                    <div key={group} className="mb-4">
                                        <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs font-black text-gray-500 uppercase tracking-wider mb-1 sticky top-0 z-10 flex items-center gap-2">
                                            <Layers size={12}/> {group}
                                        </div>
                                        {grouped[group].map(s => (
                                            <button key={s.id} onClick={() => addIngredientToVariant(s)} className="w-full text-left p-3 hover:bg-gray-50 rounded-xl flex justify-between items-center group border-b border-gray-50 last:border-0">
                                                <div>
                                                    <div className="font-bold text-sm text-[#1A1A1A]">{s.name}</div>
                                                    <div className="text-[10px] text-gray-400">Unit: {s.unit} • Cost: RM {s.cost.toFixed(2)}</div>
                                                </div>
                                                <Plus size={16} className="text-gray-300 group-hover:text-blue-500"/>
                                            </button>
                                        ))}
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {showCopyModal && (
                <div className="fixed inset-0 bg-black/60 z-[210] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in pb-[env(safe-area-inset-bottom)]">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h3 className="font-black text-lg text-[#1A1A1A] flex items-center gap-2"><BookOpen size={18} className="text-orange-500"/> 复制配方</h3>
                                <p className="text-xs text-gray-500">Copy ingredients from another dish</p>
                            </div>
                            <button onClick={() => setShowCopyModal(false)}><X size={20}/></button>
                        </div>
                        
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                                <input 
                                    className="w-full pl-10 p-2 bg-white border-2 border-gray-200 rounded-xl text-base md:text-sm font-bold outline-none focus:border-orange-400 transition-colors" 
                                    placeholder="搜索菜品 (Search Menu)..." 
                                    value={copySearch} 
                                    onChange={e => setCopySearch(e.target.value)} 
                                    autoFocus 
                                />
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-2 space-y-1 pb-6">
                            {menuItems
                                .filter(m => m.id !== editingId)
                                .filter(m => m.name.toLowerCase().includes(copySearch.toLowerCase()))
                                .map(item => (
                                    <button 
                                        key={item.id} 
                                        onClick={() => handleCopyRecipe(item)}
                                        className="w-full text-left p-3 hover:bg-orange-50 rounded-xl flex items-center justify-between group transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 font-bold text-xs shrink-0">
                                                {item.image ? <img src={item.image} className="w-full h-full object-cover rounded-lg"/> : <Utensils size={14}/>}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm text-[#1A1A1A] truncate">{item.name}</div>
                                                <div className="text-[10px] text-gray-400 font-mono">ID: {item.id}</div>
                                            </div>
                                        </div>
                                        <Copy size={16} className="text-gray-300 group-hover:text-orange-500"/>
                                    </button>
                                ))
                            }
                            {menuItems.filter(m => m.name.toLowerCase().includes(copySearch.toLowerCase())).length === 0 && (
                                <div className="py-10 text-center text-gray-400 text-xs italic">没有找到匹配的菜品</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};