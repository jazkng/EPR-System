import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Truck, Plus, Search, Phone, MapPin, Edit3, Trash2, X, Save, FileText, 
    Package, Link, CheckCircle2, Calendar, Send, ArrowLeft, Box, Calculator, 
    Grid, Globe, CreditCard, Building2, Mail, Clock, AlertCircle, Tag as TagIcon, 
    FileDown, MoreHorizontal, Receipt, UserCircle, ChevronUp, ChevronDown, Hash, 
    DollarSign, Layers, User, RefreshCw, TrendingUp, ClipboardCheck, ArrowDownToLine, 
    Link as LinkIcon, Unlink, ExternalLink, Loader2, MessageCircle, Info, 
    ShoppingBag, Zap, Scale, Star, CalendarOff 
} from 'lucide-react';
import { Supplier, CatalogItem, PurchaseOrder, StockItem, PurchaseOrderItem, UomOption, ExpenseItem, SettlementRecord } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { SUPPLIER_TAG_OPTIONS } from '../../constants/suppliers';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { ModuleGuideButton } from '../ui/ModuleGuide';

interface SupplierModuleProps {
    onClose?: () => void;
    isModal?: boolean;
    onNavigateToStock?: (stockId: string) => void;
}

const ITEMS_PER_PAGE = 20;

const DEFAULT_UOMS: UomOption[] = [
    { label: 'Base Unit', value: 'BASE', ratio: 1 },
];

const INVENTORY_CATEGORIES = [
    {
        label: 'Kitchen (厨房)',
        options: [
            { id: 'FRESH', label: '生鲜 (Fresh)' },
            { id: 'MEAT', label: '肉类 (Meat)' },
            { id: 'SEAFOOD', label: '海鲜 (Seafood)' },
            { id: 'VEG', label: '蔬果 (Veg)' },
            { id: 'NOODLE', label: '面食 (Noodle)' },
            { id: 'SAUCE', label: '酱料 (Sauce)' },
            { id: 'DRY', label: '干货 (Dry)' },
            { id: 'HQ', label: '总店 (HQ)' },
        ]
    },
    {
        label: 'Bar (水吧)',
        options: [
            { id: 'TEA', label: '茶叶 (Tea)' },
            { id: 'FRUIT', label: '水果 (Fruit)' },
            { id: 'RTD', label: '罐装 (Drinks)' },
            { id: 'MISC', label: '其他 (Misc)' },
            { id: 'DRINK', label: '饮品 (Drink)' }
        ]
    },
    {
        label: 'General (后勤)',
        options: [
            { id: 'PACKAGING', label: '包装 (Pack)' },
            { id: 'CLEANING', label: '清洁 (Clean)' },
            { id: 'TOOLS', label: '工具 (Tools)' },
            { id: 'WASTE', label: '耗材 (Waste)' },
            { id: 'GENERAL', label: '杂项 (General)' },
        ]
    }
];

const ACCOUNTING_CATEGORIES_OPTIONS = {
    'COGS (销货成本)': [
        { id: 'INGREDIENT_HQ', label: '食材-总店 (HQ Ingredients)' },
        { id: 'INGREDIENT_MEAT', label: '食材-肉类 (Meat)' },
        { id: 'INGREDIENT_SEAFOOD', label: '食材-海鲜 (Seafood)' },
        { id: 'INGREDIENT_VEG', label: '食材-蔬果 (Veg)' },
        { id: 'INGREDIENT_DRY', label: '食材-干货 (Dry)' },
        { id: 'INGREDIENT_SAUCE', label: '食材-酱料 (Sauce)' },
        { id: 'BEVERAGE', label: '水吧原料 (Beverage)' },
        { id: 'PACKAGING', label: '包装材料 (Packaging)' },
        { id: 'GAS_COGS', label: '烹饪煤气 (Cooking Gas)' },
        { id: 'SUPPLIER', label: '一般进货 (General)' }
    ],
    'OPEX (营运开支)': [
        { id: 'RENT', label: '租金 (Rent)' },
        { id: 'UTILITIES', label: '水电费 (Utilities)' },
        { id: 'SALARY', label: '薪资 (Salary)' },
        { id: 'STAFF_MEAL', label: '员工餐 (Staff Meal)' },
        { id: 'MAINTENANCE', label: '维修保养 (Maintenance)' },
        { id: 'MARKETING', label: '营销广告 (Marketing)' },
        { id: 'PROFESSIONAL', label: '专业服务/律师 (Professional/Legal)' },
        { id: 'SUPPLIES', label: '杂项耗材 (Supplies - Cleaning/Office)' },
        { id: 'LICENSE', label: '执照/订阅 (License/Sub)' },
        { id: 'LOGISTICS', label: '物流运输 (Logistics)' }
    ],
    'CAPEX (资产)': [
        { id: 'EQUIPMENT', label: '设备采购 (Equipment)' },
        { id: 'RENOVATION', label: '装修工程 (Renovation)' },
        { id: 'DEPOSIT', label: '押金 (Deposit)' }
    ]
};

// 样式：黑金体系下的现代输入框
const INPUT_STYLE = "w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-bold text-[#1A1A1A] outline-none focus:bg-white focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 transition-all placeholder:font-normal placeholder:text-gray-400";
const LABEL_STYLE = "text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block ml-1";

interface SupplierReceivedItem extends PurchaseOrderItem {
    receivedQty: number;
    finalCost: number;
    billByWeight?: boolean;
    receivedWeight?: number;
}

export const SupplierModule: React.FC<SupplierModuleProps> = ({ onClose, isModal = false, onNavigateToStock }) => {
    const [mainTab, setMainTab] = useState<'SUPPLIERS' | 'POS'>('SUPPLIERS');
    const [view, setView] = useState<'LIST' | 'DETAIL'>('LIST');
    
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [allStockList, setAllStockList] = useState<StockItem[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
    const [activeDetailTab, setActiveDetailTab] = useState<'CATALOG' | 'BILLS'>('CATALOG');
    const [isBillFormOpen, setIsBillFormOpen] = useState(false);
    const [newBill, setNewBill] = useState<Partial<ExpenseItem>>({});

    const [availableTags, setAvailableTags] = useState(SUPPLIER_TAG_OPTIONS);
    const [newTagName, setNewTagName] = useState('');

    const [isEditingSupplier, setIsEditingSupplier] = useState(false);
    const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({});
    
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [productForm, setProductForm] = useState<Partial<CatalogItem>>({});
    const [productUoms, setProductUoms] = useState<UomOption[]>(DEFAULT_UOMS);
    const [stockSearchTerm, setStockSearchTerm] = useState('');

    const [isCreatingPO, setIsCreatingPO] = useState(false);
    const [cart, setCart] = useState<PurchaseOrderItem[]>([]);
    const [isCartExpanded, setIsCartExpanded] = useState(true);

    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
    const [receivedItems, setReceivedItems] = useState<SupplierReceivedItem[]>([]); 
    const [isProcessingReceive, setIsProcessingReceive] = useState(false);

    const [deleteProductCandidate, setDeleteProductCandidate] = useState<Partial<CatalogItem> | null>(null);
    const [deletePOCandidate, setDeletePOCandidate] = useState<string | null>(null);
    const [deleteSupplierId, setDeleteSupplierId] = useState<string | null>(null);

    const printRef = useRef<HTMLDivElement>(null);
    const [printingPO, setPrintingPO] = useState<PurchaseOrder | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSyncingName, setIsSyncingName] = useState(false);

    useEffect(() => {
        loadData();
    }, []);
    useEffect(() => {
        if (selectedSupplier && activeDetailTab === 'BILLS') {
            loadExpenses(selectedSupplier.name);
        }
    }, [selectedSupplier, activeDetailTab]);

    const loadData = async () => {
        try {
            const supData = await DataManager.getSuppliers();
            setSuppliers(supData);

            const k = await DataManager.getStock('KITCHEN');
            const b = await DataManager.getStock('BAR');
            const g = await DataManager.getStock('GENERAL');
            setAllStockList([...k, ...b, ...g]);

            const poData = await DataManager.getPurchaseOrders();
            setPurchaseOrders(poData.sort((a,b) => b.id.localeCompare(a.id)));

            // 移除这里的 loadExpenses()，改为按需加载
        } catch (error) {
            console.error("Failed to load supplier data", error);
        }
    };

    const loadExpenses = async (supplierName?: string) => {
        if (!supplierName) return;
        try {
            // 👑 只查该供应商的账单，不全表扫描
            const q = query(
                collection(db, 'standalone_expenses'),
                where('company', '==', supplierName),
                limit(200)
            );
            const snap = await getDocs(q);
            const items: ExpenseItem[] = [];
            snap.forEach(doc => items.push(doc.data() as ExpenseItem));
            setExpenses(items);
        } catch (err) {
            console.error("Failed to load expenses", err);
        }
    };

    const supplierExpenses = useMemo(() => {
        if (!selectedSupplier) return [];
        return expenses.filter(e => e.company === selectedSupplier.name);
    }, [expenses, selectedSupplier]);

    const billStats = useMemo(() => {
        let total = 0;
        let outstanding = 0;
        supplierExpenses.forEach(b => {
            const billTotal = b.totalBillAmount || b.amount || 0;
            const billOutstanding = b.outstandingAmount || 0;
            total += billTotal;
            outstanding += billOutstanding;
        });
        return { total, outstanding, paid: total - outstanding };
    }, [supplierExpenses]);

    const handleAddCustomTag = () => {
        if (!newTagName.trim()) return;
        const newId = newTagName.toUpperCase().replace(/\s+/g, '_');
        if (!availableTags.find(t => t.id === newId)) {
            const newTagOption = { id: newId, label: newTagName };
            setAvailableTags([...availableTags, newTagOption]);
            const currentTags = supplierForm.tags || [];
            setSupplierForm({ ...supplierForm, tags: [...currentTags, newId] });
        }
        setNewTagName('');
    };

    const handleOpenAddSupplier = () => {
        const numericIds = suppliers.map(s => parseInt(s.id)).filter(n => !isNaN(n));
        const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 8000;
        const nextId = (maxId < 8000 ? 8001 : maxId + 1).toString();
        setSupplierForm({ id: nextId, status: 'ACTIVE', paymentTerm: 'COD', category: 'SUPPLIER' });
        setIsEditingSupplier(true);
    };

    const handleSaveSupplier = async () => {
        if (!supplierForm.name) return alert("Supplier Name is required");
        if (!supplierForm.id) return alert("Supplier ID is required");
        setIsSyncingName(true);
        try {
            const rawSup: Supplier = {
                ...supplierForm as Supplier,
                id: supplierForm.id,
                status: supplierForm.status || 'ACTIVE',
                catalog: supplierForm.catalog || (selectedSupplier?.id === supplierForm.id ? selectedSupplier.catalog : []), 
                tags: supplierForm.tags || [],
                contact: supplierForm.contact || '',
                category: supplierForm.category || 'SUPPLIER',
                restDayNote: supplierForm.restDayNote || '', 
                isFavorite: supplierForm.isFavorite || false
            };
            const newSup = JSON.parse(JSON.stringify(rawSup)); 
            await DataManager.saveSupplier(newSup);
            await loadData();
            setIsEditingSupplier(false);
            if (selectedSupplier && selectedSupplier.id === newSup.id) setSelectedSupplier(newSup); 
        } catch (e) {
            console.error("Save Supplier Error", e);
            alert("保存失败，请检查网络");
        } finally {
            setIsSyncingName(false);
        }
    };

    const handleToggleFavorite = async (e: React.MouseEvent, sup: Supplier) => {
        e.stopPropagation();
        const updatedSup = { ...sup, isFavorite: !sup.isFavorite };
        setSuppliers(prev => prev.map(s => s.id === sup.id ? updatedSup : s));
        try {
            await DataManager.saveSupplier(updatedSup);
        } catch (err) {
            console.error(err);
            setSuppliers(prev => prev.map(s => s.id === sup.id ? sup : s));
        }
    };

    const executeDeleteSupplier = async () => {
        if (!deleteSupplierId) return;
        try {
            await DataManager.deleteSupplier(deleteSupplierId);
            await loadData();
            if (selectedSupplier?.id === deleteSupplierId) {
                setSelectedSupplier(null);
                setView('LIST');
            }
            setDeleteSupplierId(null);
        } catch (e) {
            console.error(e);
            alert("删除失败");
        }
    };

    const handleOpenBillForm = () => {
        if (!selectedSupplier) return;
        setNewBill({
            company: selectedSupplier.name,
            category: selectedSupplier.category || 'SUPPLIER',
            amount: 0,
            totalBillAmount: 0,
            paymentStatus: 'UNPAID',
            time: new Date().toISOString(),
            paymentMethod: 'BANK_TRANSFER',
            paidBy: 'COMPANY'
        });
        setIsBillFormOpen(true);
    };

    const handleSaveBill = async () => {
        if (!newBill.totalBillAmount) return alert("Please enter amount");
        const isPaid = newBill.paymentStatus === 'PAID';
        const paidAmt = isPaid ? newBill.totalBillAmount : (newBill.amount || 0);
        const finalBill: ExpenseItem = {
            id: `exp_${Date.now()}`,
            category: newBill.category || 'SUPPLIER',
            expenseType: 'GENERAL',
            company: selectedSupplier?.name || newBill.company || 'Unknown',
            amount: paidAmt,
            outstandingAmount: (newBill.totalBillAmount || 0) - paidAmt,
            totalBillAmount: newBill.totalBillAmount,
            paymentStatus: newBill.paymentStatus,
            time: newBill.time || new Date().toISOString(),
            paymentMethod: newBill.paymentMethod || 'BANK_TRANSFER',
            note: newBill.note || '',
            paidBy: newBill.paidBy || 'COMPANY',
            dueDate: newBill.dueDate
        };
        if (finalBill.outstandingAmount! <= 0) finalBill.paymentStatus = 'PAID';
        else if (finalBill.outstandingAmount! < (finalBill.totalBillAmount || 0)) finalBill.paymentStatus = 'PARTIAL';
        else finalBill.paymentStatus = 'UNPAID';
        
        await DataManager.saveStandaloneExpense(finalBill);
        await loadExpenses(selectedSupplier?.name);
        setIsBillFormOpen(false);
        alert("✅ 账单已录入");
    };

    const handleAddProduct = () => {
        setProductForm({ unit: 'unit', price: 0 });
        setProductUoms(DEFAULT_UOMS);
        setIsEditingProduct(true);
    };

    const handleSaveProduct = async () => {
        if (!selectedSupplier || !productForm.name || !productForm.price) return alert("Name and Price required");
        
        const baseUnit = productForm.unit || 'unit';
        let validUoms = productForm.uomOptions || [];
        if (!validUoms.find(u => u.value === 'BASE' || u.ratio === 1)) {
            validUoms = [{ label: `1 ${baseUnit} (Base)`, value: 'BASE', ratio: 1 }, ...validUoms];
        }

        const rawItem: CatalogItem = {
            id: productForm.id || `cat_${Date.now()}`,
            name: productForm.name,
            unit: baseUnit,
            price: Number(productForm.price),
            category: productForm.category || 'GENERAL',
            uomOptions: productUoms, 
            linkedStockId: productForm.linkedStockId,
            supplierCode: productForm.supplierCode
        };
        
        const newItem = JSON.parse(JSON.stringify(rawItem));
        const updatedCatalog = selectedSupplier.catalog ? [...selectedSupplier.catalog] : [];
        const existIdx = updatedCatalog.findIndex(i => i.id === newItem.id);
        if (existIdx >= 0) updatedCatalog[existIdx] = newItem;
        else updatedCatalog.push(newItem);
        
        const updatedSupplier = { ...selectedSupplier, catalog: updatedCatalog };
        
        await DataManager.saveSupplier(updatedSupplier);

        if (newItem.linkedStockId) {
            const targetStock = allStockList.find(s => s.id === newItem.linkedStockId);
            if (targetStock) {
                let type: 'KITCHEN' | 'BAR' | 'GENERAL' = 'KITCHEN';
                if (targetStock.id.startsWith('K')) type = 'KITCHEN';
                else if (targetStock.id.startsWith('B')) type = 'BAR';
                else if (targetStock.id.startsWith('S') || targetStock.id.startsWith('G')) type = 'GENERAL';

                const updatedStock: StockItem = {
                    ...targetStock,
                    uomOptions: newItem.uomOptions, 
                    cost: newItem.price 
                };
                
                await DataManager.saveStockItem(type, updatedStock);
            }
        }

        setSelectedSupplier(updatedSupplier);
        setIsEditingProduct(false);
        setProductForm({});
        await loadData();
    };

    const executeDeleteProduct = async () => {
        if (!selectedSupplier || !deleteProductCandidate || !deleteProductCandidate.id) return;
        const updatedCatalog = selectedSupplier.catalog?.filter(i => i.id !== deleteProductCandidate.id) || [];
        const updatedSupplier = { ...selectedSupplier, catalog: updatedCatalog };
        await DataManager.saveSupplier(updatedSupplier);
        setSelectedSupplier(updatedSupplier);
        setDeleteProductCandidate(null);
        await loadData();
    };

    const addUomOption = () => { setProductUoms([...productUoms, { label: '', value: '', ratio: 10 }]); };
    const updateUomOption = (idx: number, field: keyof UomOption, value: any) => { const c = [...productUoms]; c[idx] = { ...c[idx], [field]: value }; setProductUoms(c); };
    const removeUomOption = (idx: number) => { const c = [...productUoms]; c.splice(idx, 1); setProductUoms(c); };

    const addToCart = (item: CatalogItem, selectedUom?: UomOption) => {
        const orderUnit = selectedUom ? selectedUom.value : item.unit;
        const orderRatio = selectedUom ? selectedUom.ratio : 1;
        const orderCost = selectedUom?.price ? selectedUom.price : item.price * orderRatio;
        setCart(prev => {
            const existing = prev.find(p => p.stockId === item.id && p.unit === orderUnit);
            if (existing) return prev.map(p => (p.stockId === item.id && p.unit === orderUnit) ? { ...p, orderQty: p.orderQty + 1 } : p);
            return [...prev, { stockId: item.id, name: item.name, orderQty: 1, unit: orderUnit, ratio: orderRatio, cost: orderCost, supplierCode: item.supplierCode }];
        });
        setIsCreatingPO(true);
        if(cart.length === 0) setIsCartExpanded(true);
    };

    const removeFromCart = (index: number) => { 
        const c = [...cart]; 
        c.splice(index, 1); 
        setCart(c); 
        if(c.length===0) setIsCreatingPO(false); 
    }

    const handleCreatePO = async () => {
        if (!selectedSupplier || cart.length === 0) return;
        
        const latestPOs = await DataManager.getPurchaseOrders();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayPrefix = `PO${year}${month}${day}`;
        
        const existingTodayPOs = latestPOs.filter(p => p.id.startsWith(todayPrefix));
        let maxSuffix = 0;
        existingTodayPOs.forEach(p => { 
            const suffixStr = p.id.replace(todayPrefix, '');
            const suffix = parseInt(suffixStr, 10); 
            if (!isNaN(suffix) && suffix > maxSuffix) maxSuffix = suffix; 
        });
        
        const nextId = `${todayPrefix}${String(maxSuffix + 1).padStart(3, '0')}`;
        const total = cart.reduce((sum, item) => sum + (item.orderQty * item.cost), 0);

        const newPO: PurchaseOrder = {
            id: nextId,
            supplierId: selectedSupplier.id,
            supplierName: selectedSupplier.name,
            date: new Date().toISOString(),
            status: 'ORDERED',
            items: cart,
            totalEstimated: total
        };

        await DataManager.savePurchaseOrder(newPO);
        alert(`✅ 采购单 ${newPO.id} 已生成`);
        
        setCart([]);
        setIsCreatingPO(false);
        await loadData();
        setMainTab('POS');
    };

    const executeDeletePO = async () => {
        if (!deletePOCandidate) return;
        try {
            await DataManager.deletePurchaseOrder(deletePOCandidate);
            await loadData();
        } catch (e) {
            console.error(e);
            alert("删除失败");
        } finally {
            setDeletePOCandidate(null);
        }
    };

    const initiateReceivePO = (po: PurchaseOrder) => {
        setReceivingPO(po);
        const itemsToCheck: SupplierReceivedItem[] = po.items.map(i => ({ 
            ...i, 
            receivedQty: i.orderQty, 
            finalCost: i.cost,
            billByWeight: false,
            receivedWeight: 0
        }));
        setReceivedItems(itemsToCheck);
        setIsReceiveModalOpen(true);
    };

    const updateReceivedItem = (idx: number, field: keyof SupplierReceivedItem, value: any) => {
        const updated = [...receivedItems];
        updated[idx] = { ...updated[idx], [field]: value };
        setReceivedItems(updated);
    };

    const confirmReceivePO = async () => {
        if (!receivingPO) return;
        setIsProcessingReceive(true);

        try {
            const finalTotal = receivedItems.reduce((sum, item) => {
                if (item.billByWeight && item.receivedWeight) {
                    return sum + (item.receivedWeight * item.finalCost);
                } else {
                    return sum + (item.receivedQty * item.finalCost);
                }
            }, 0);

            const stockUpdates = new Map<string, { qtyDelta: number, newCost: number }>();
            
            const supplier = suppliers.find(s => s.id === receivingPO.supplierId);
            const billCategory = supplier?.category || 'SUPPLIER';

            receivedItems.forEach((item) => {
                const catalogItem = supplier?.catalog?.find(c => c.id === item.stockId);
                if (catalogItem && catalogItem.linkedStockId) {
                    const inventoryId = catalogItem.linkedStockId;
                    const baseQtyDelta = item.receivedQty * item.ratio;
                    
                    let baseUnitCost = 0;
                    if (item.billByWeight && item.receivedWeight && item.receivedQty > 0) {
                        const totalLineCost = item.receivedWeight * item.finalCost;
                        baseUnitCost = (totalLineCost / item.receivedQty) / item.ratio;
                    } else {
                        baseUnitCost = item.finalCost / item.ratio;
                    }

                    const existing = stockUpdates.get(inventoryId) || { qtyDelta: 0, newCost: 0 };
                    stockUpdates.set(inventoryId, { qtyDelta: existing.qtyDelta + baseQtyDelta, newCost: baseUnitCost });
                }
            });

            const updatedStockList = allStockList.map(stockItem => {
                const update = stockUpdates.get(stockItem.id);
                if (update) {
                    return { ...stockItem, currentQty: (stockItem.currentQty || 0) + update.qtyDelta, cost: update.newCost };
                }
                return stockItem;
            });

            const kItems = updatedStockList.filter(i => ['FRESH','DRY','SAUCE','MEAT','VEG','SEAFOOD','NOODLE','HQ'].includes(i.category) || i.id.startsWith('K'));
            const bItems = updatedStockList.filter(i => ['TEA','RTD','FRUIT','MISC','DRINK'].includes(i.category) || i.id.startsWith('B'));
            const gItems = updatedStockList.filter(i => ['PACKAGING','GENERAL','TOOLS','CLEANING','WASTE'].includes(i.category) || i.id.startsWith('S') || i.id.startsWith('G'));

            await Promise.all([
                DataManager.batchUpdateStock('KITCHEN', kItems),
                DataManager.batchUpdateStock('BAR', bItems),
                DataManager.batchUpdateStock('GENERAL', gItems)
            ]);

            const updatedPO = { ...receivingPO, status: 'RECEIVED' as const };
            await DataManager.savePurchaseOrder(updatedPO);

            const newBill: ExpenseItem = {
                id: `exp_${Date.now()}`,
                category: billCategory, 
                expenseType: 'GENERAL',
                company: receivingPO.supplierName,
                amount: 0, 
                totalBillAmount: finalTotal,
                outstandingAmount: finalTotal,
                paymentStatus: 'UNPAID',
                time: new Date().toISOString(),
                note: `PO: ${receivingPO.id} (Auto-generated)`,
                paymentMethod: 'BANK_TRANSFER',
                paidBy: 'COMPANY'
            };
            await DataManager.saveStandaloneExpense(newBill);

            alert(`✅ 入库成功！应付: RM ${finalTotal.toFixed(2)}\n分类: ${billCategory}`);
            setIsReceiveModalOpen(false);
            setReceivingPO(null);
            loadData(); 
        } catch (error) {
            console.error("Receive Error:", error);
            alert("入库失败，请重试");
        } finally {
            setIsProcessingReceive(false);
        }
    };

    const handleExportPO_PDF = async (po: PurchaseOrder) => {
        setPrintingPO(po);
        setIsGeneratingPdf(true);
        setTimeout(async () => {
            if (!printRef.current) return;
            try {
                const pdf = new jsPDF('p', 'mm', 'a4');
                const totalPages = Math.ceil(po.items.length / ITEMS_PER_PAGE);

                for (let i = 0; i < totalPages; i++) {
                     const pageElement = document.getElementById(`po-print-page-${i}`);
                     if (!pageElement) continue;

                     if (i > 0) pdf.addPage();
                     
                     const canvas = await html2canvas(pageElement, { 
                        scale: 2, 
                        useCORS: true, 
                        backgroundColor: '#ffffff',
                        windowWidth: 794 
                    });

                    const imgData = canvas.toDataURL('image/jpeg', 1.0);
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                }

                pdf.save(`PO_${po.id}.pdf`);
            } catch (err) { 
                console.error(err);
                alert("PDF Error"); 
            } finally { 
                setIsGeneratingPdf(false); 
                setPrintingPO(null); 
            }
        }, 800);
    };

    const sendWhatsappPO = (po: PurchaseOrder) => {
        const targetSup = suppliers.find(s => s.id === po.supplierId);
        if (!targetSup) return alert("Unknown Supplier");
        const phone = targetSup.contact.replace(/\D/g, ''); 
        if (!phone) return alert("供应商无联系电话");
        let text = `*PURCHASE ORDER: ${po.id}*\nTo: ${po.supplierName}\nDate: ${po.date.split('T')[0]}\n\n*ITEMS:*\n`;
        po.items.forEach((item, i) => { text += `${i+1}. ${item.name} [${item.supplierCode || ''}]\n  Qty: ${item.orderQty} ${item.unit}\n`; });
        text += `\nPlease confirm delivery. Thanks!`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    };

    const filteredSuppliers = suppliers
        .filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
            s.id.includes(searchTerm)
        )
        .sort((a, b) => {
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;
            return a.name.localeCompare(b.name);
        });

    // 核心渲染区
    const MainContent = (
        <div className={`flex flex-col bg-[#F5F7FA] h-full ${isModal ? 'md:max-h-[92vh] md:rounded-[2rem] overflow-hidden shadow-2xl border border-gray-100' : ''} font-sans relative`}>
            
            {/* 顶部黑金毛玻璃导航栏 */}
            <div className="bg-[#1A1A1A]/95 backdrop-blur-md text-white shrink-0 border-b border-[#FFD700]/50 px-4 py-3 md:px-6 md:py-4 flex justify-between items-center z-20 sticky top-0 shadow-lg">
                <div className="flex items-center gap-3 md:gap-4">
                    {view !== 'LIST' && (
                        <button onClick={() => { setView('LIST'); setSelectedSupplier(null); setIsCreatingPO(false); }} className="p-2 bg-white/10 hover:bg-[#FFD700] hover:text-black rounded-xl transition-all shadow-sm">
                            <ArrowLeft size={18}/>
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="bg-[#FFD700] text-black p-2 rounded-lg shadow-sm hidden md:block">
                            <Truck size={20}/> 
                        </div>
                        <div>
                            <h3 className="font-serif font-black text-sm md:text-lg tracking-wide text-white flex items-center gap-2">
                                <Truck size={16} className="md:hidden text-[#FFD700]"/> 供应商与采购
                            </h3>
                            <p className="text-[9px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">Supplier Management</p>
                        </div>
                    </div>
                </div>

                {/* 桌面端 Tabs & Actions */}
                <div className="hidden md:flex gap-3 items-center">
                     <div className="flex bg-white/10 p-1 rounded-xl backdrop-blur-sm border border-white/5">
                        <button onClick={() => { setMainTab('SUPPLIERS'); setView('LIST'); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'SUPPLIERS' ? 'bg-[#FFD700] text-[#1A1A1A] shadow-md scale-100' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                            <UserCircle size={16}/> 供应商
                        </button>
                        <button onClick={() => { setMainTab('POS'); setView('LIST'); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'POS' ? 'bg-[#FFD700] text-[#1A1A1A] shadow-md scale-100' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                            <FileText size={16}/> 采购单
                        </button>
                    </div>
                    <div className="w-px h-8 bg-white/20 mx-2"></div>
                    <ModuleGuideButton module="SUPPLIER" />
                    {onClose && <button onClick={onClose} className="p-2 hover:bg-red-500 hover:text-white rounded-xl transition-colors text-gray-300"><X size={20}/></button>}
                </div>
                
                {/* 手机端 Close */}
                <div className="md:hidden flex items-center gap-2">
                     <ModuleGuideButton module="SUPPLIER" />
                     {onClose && <button onClick={onClose} className="p-1.5 hover:bg-red-500 hover:text-white rounded-lg transition-colors text-gray-300"><X size={18}/></button>}
                </div>
            </div>

            {/* 手机端标签切换 */}
            <div className="md:hidden bg-white border-b border-gray-200 p-2 flex gap-2 shrink-0 z-10 shadow-sm relative">
                <button onClick={() => { setMainTab('SUPPLIERS'); setView('LIST'); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${mainTab === 'SUPPLIERS' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                    <UserCircle size={14}/> 供应商列表
                </button>
                <button onClick={() => { setMainTab('POS'); setView('LIST'); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${mainTab === 'POS' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                    <FileText size={14}/> 采购单记录
                </button>
            </div>

            {/* 主内容区 */}
            <div className="flex-grow overflow-y-auto p-4 md:p-6 pb-24 md:pb-8 scroll-smooth relative z-0">
                
                {/* 1. 供应商列表（高定版网格） */}
                {mainTab === 'SUPPLIERS' && view === 'LIST' && (
                    <div className="max-w-7xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4">
                        
                        <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                                <input 
                                    type="text" 
                                    placeholder="搜索供应商名称 / 编号 / 标签..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50/80 border border-gray-200 rounded-xl text-sm font-bold focus:bg-white focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 transition-all outline-none"
                                />
                            </div>
                            <button onClick={handleOpenAddSupplier} className="w-full md:w-auto bg-[#1A1A1A] text-[#FFD700] px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95 min-h-[44px]">
                                <Plus size={16}/> 录入新供应商
                            </button>
                        </div>

                        {/* 自适应瀑布流网格 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredSuppliers.map(sup => (
                                <div 
                                    key={sup.id} 
                                    onClick={() => { setSelectedSupplier(sup); setView('DETAIL'); setActiveDetailTab('CATALOG'); }} 
                                    className="relative bg-white rounded-[1.5rem] p-4 border border-gray-100 shadow-sm hover:shadow-[0_8px_30px_rgba(255,215,0,0.15)] hover:border-[#FFD700]/60 transition-all duration-300 cursor-pointer group flex flex-col h-full overflow-hidden"
                                >
                                    <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 pointer-events-none"></div>
                                    <div className="absolute top-2 right-2 p-2 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none"><Truck size={48}/></div>
                                    
                                    <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#1A1A1A] to-gray-800 text-[#FFD700] flex items-center justify-center font-black text-[10px] shadow-md group-hover:shadow-[#FFD700]/20 transition-all shrink-0">
                                                {sup.id}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-black text-sm text-[#1A1A1A] leading-snug line-clamp-2 group-hover:text-[#8B0000] transition-colors" title={sup.name}>{sup.name}</h4>
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest mt-1 ${sup.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'}`}>
                                                    <span className={`w-1 h-1 rounded-full ${sup.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                    {sup.status}
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => handleToggleFavorite(e, sup)}
                                            className="p-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-gray-100 hover:bg-gray-50 transition-all hover:scale-110 active:scale-95 shrink-0 mt-0.5"
                                        >
                                            <Star size={14} className={sup.isFavorite ? "fill-[#FFD700] text-[#FFD700]" : "text-gray-200 drop-shadow-sm"} />
                                        </button>
                                    </div>
                                    
                                    {sup.restDayNote && (
                                        <div className="mb-3 bg-orange-50/80 border border-orange-100/50 rounded-lg px-2 py-1.5 flex items-start gap-1.5 relative z-10">
                                            <CalendarOff size={12} className="text-orange-500 mt-px shrink-0"/>
                                            <p className="text-[10px] font-bold text-orange-800 leading-tight line-clamp-1">{sup.restDayNote}</p>
                                        </div>
                                    )}
                                    
                                    <div className="space-y-2 mt-auto relative z-10">
                                        <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 truncate">
                                            <User size={12} className="text-gray-400 shrink-0"/> {sup.contactPerson || sup.name.slice(0, 12)}
                                        </p>
                                        {sup.contact && (
                                            <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${sup.contact.replace(/\D/g,'')}`, '_blank'); }} className="text-[10px] text-green-600 font-bold flex items-center gap-1 hover:text-green-700 transition-colors">
                                                <Phone size={10}/> {sup.contact.slice(-8)}
                                            </button>
                                        )}
                                        <div className="flex gap-1.5 flex-wrap">
                                            {sup.category && <span className="text-[9px] font-bold bg-[#1A1A1A]/5 text-gray-700 px-2 py-0.5 rounded-md border border-gray-200/50 truncate max-w-full">{sup.category}</span>}
                                            {sup.tags?.slice(0,2).map(t => <span key={t} className="text-[9px] font-bold bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md border border-gray-100 truncate">#{t}</span>)}
                                        </div>
                                        <div className="pt-3 mt-1 border-t border-gray-100/80 flex justify-between items-center text-[10px] font-bold text-gray-400">
                                            <span>{sup.catalog?.length || 0} Products</span>
                                            <div className="flex items-center gap-0.5 text-[#1A1A1A] group-hover:translate-x-1 transition-transform">Details <ArrowLeft size={10} className="rotate-180"/></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 空状态精美引导 */}
                        {filteredSuppliers.length === 0 && (
                            <div className="col-span-full py-20 text-center flex flex-col items-center justify-center bg-white rounded-[2rem] border border-gray-100 shadow-sm mt-4">
                                <div className="bg-gray-50 p-6 rounded-full mb-4 ring-8 ring-gray-50/50"><Truck size={48} className="text-gray-300"/></div>
                                <h3 className="font-black text-lg text-[#1A1A1A] mb-1">未找到相关供应商</h3>
                                <p className="text-sm text-gray-400 font-medium mb-6">您可以尝试更换搜索词，或立即新增一个。</p>
                                <button onClick={handleOpenAddSupplier} className="bg-[#1A1A1A] text-[#FFD700] px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-black transition-transform active:scale-95 flex items-center gap-2">
                                    <Plus size={16}/> 立即录入
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. 供应商详情页（完美防挤压 + 垃圾桶加回） */}
                {view === 'DETAIL' && selectedSupplier && (
                    <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in slide-in-from-right-8">
                        
                        <div className="bg-white rounded-[2rem] p-5 md:p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#FFD700]/10 to-transparent rounded-full blur-3xl pointer-events-none -translate-y-1/4 translate-x-1/4"></div>
                            
                            {/* 完美修复的 Header */}
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                <div className="flex gap-4 w-full md:flex-1 min-w-0 items-center">
                                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 shadow-inner flex items-center justify-center text-[#1A1A1A] shrink-0">
                                        <Truck size={28} className="text-[#8B0000]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-mono tracking-widest shrink-0 border border-gray-200/50">{selectedSupplier.id}</span>
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest shrink-0 ${selectedSupplier.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'}`}>
                                                <span className={`w-1 h-1 rounded-full ${selectedSupplier.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                {selectedSupplier.status}
                                            </span>
                                            {selectedSupplier.restDayNote && (
                                                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-800 text-[9px] font-bold shrink-0">
                                                    <CalendarOff size={10}/> {selectedSupplier.restDayNote}
                                                </span>
                                            )}
                                        </div>
                                        <h1 className="text-xl md:text-3xl font-black text-[#1A1A1A] truncate group-hover:text-[#8B0000] transition-colors" title={selectedSupplier.name}>{selectedSupplier.name}</h1>
                                        <div className="text-[11px] md:text-xs text-gray-500 flex items-center gap-4 truncate mt-1.5 font-medium">
                                            <span className="flex items-center gap-1.5 shrink-0"><User size={14} className="text-gray-400"/>{selectedSupplier.contactPerson || 'N/A'}</span>
                                            <span className="flex items-center gap-1.5 shrink-0"><Phone size={14} className="text-gray-400"/>{selectedSupplier.contact}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 操作按钮组 - shrink-0 绝对防挤压 */}
                                <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 mt-2 md:mt-0">
                                    <button onClick={() => window.open(`https://wa.me/${selectedSupplier.contact.replace(/\D/g,'')}`, '_blank')} className="flex-1 md:flex-none min-h-[44px] md:min-h-0 md:h-10 px-5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(22,163,74,0.3)] active:scale-95">
                                        <MessageCircle size={16} /> WhatsApp
                                    </button>
                                    <button onClick={() => { setSupplierForm(selectedSupplier); setIsEditingSupplier(true); }} className="min-h-[44px] w-[44px] md:min-h-0 md:h-10 md:w-10 flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-600 hover:shadow-md rounded-xl border border-gray-200 transition-all bg-gray-50/50" title="编辑供应商">
                                        <Edit3 size={16}/>
                                    </button>
                                    <button onClick={() => setDeleteSupplierId(selectedSupplier.id)} className="min-h-[44px] w-[44px] md:min-h-0 md:h-10 md:w-10 flex items-center justify-center text-red-400 hover:bg-rose-500 hover:text-white hover:shadow-md rounded-xl border border-rose-100 transition-all bg-rose-50/50" title="删除供应商">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
                                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100/50 hover:border-gray-200 transition-colors">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Payment</p>
                                    <p className="font-black text-sm text-[#1A1A1A]">{selectedSupplier.paymentTerm || 'COD'}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100/50 hover:border-gray-200 transition-colors">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Min Order</p>
                                    <p className="font-mono font-black text-sm text-[#1A1A1A]">RM {selectedSupplier.minOrderValue || 0}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/50 hover:border-blue-200 transition-colors">
                                    <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">Total Spent</p>
                                    <p className="font-mono font-black text-base text-blue-700">RM {billStats.total.toFixed(2)}</p>
                                </div>
                                <div className={`p-3 rounded-xl border transition-colors ${billStats.outstanding > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-emerald-50/50 border-emerald-200'}`}>
                                    <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${billStats.outstanding > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>Outstanding</p>
                                    <p className={`font-mono font-black text-base ${billStats.outstanding > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>RM {billStats.outstanding.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tabs 内容区 */}
                        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
                            <div className="flex border-b border-gray-100 bg-gray-50/80 p-1.5 gap-1.5">
                                <button onClick={() => setActiveDetailTab('CATALOG')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeDetailTab === 'CATALOG' ? 'bg-white text-[#1A1A1A] shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100/50'}`}>
                                    <Package size={16}/> 产品目录 (Catalog)
                                </button>
                                <button onClick={() => setActiveDetailTab('BILLS')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeDetailTab === 'BILLS' ? 'bg-white text-[#1A1A1A] shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100/50'}`}>
                                    <Receipt size={16}/> 历史账单 (Bills)
                                </button>
                            </div>

                            {activeDetailTab === 'CATALOG' && (
                                <div className="p-4 md:p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-black text-base md:text-lg text-[#1A1A1A] flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] text-[#FFD700] flex items-center justify-center shadow-md"><ShoppingBag size={16}/></div>
                                            供应目录
                                        </h3>
                                        <button onClick={handleAddProduct} className="px-4 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-black active:scale-95 transition-all">
                                            <Plus size={14}/> 添加商品
                                        </button>
                                    </div>
                                    
                                    {(!selectedSupplier.catalog || selectedSupplier.catalog.length === 0) ? (
                                        <div className="py-16 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                                            <Package size={40} className="mx-auto text-gray-300 mb-3"/>
                                            <p className="text-gray-400 font-bold text-sm">目录为空，暂无供应商品</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {selectedSupplier.catalog.map(item => (
                                                <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-[#FFD700] hover:shadow-md transition-all flex flex-col group relative">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="text-[10px] text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{item.supplierCode || 'NO-CODE'}</div>
                                                        <button onClick={() => { setProductForm(item); setProductUoms(item.uomOptions || DEFAULT_UOMS); setIsEditingProduct(true); }} className="text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"><Edit3 size={12}/></button>
                                                    </div>
                                                    <h4 className="font-bold text-sm text-[#1A1A1A] mb-1 line-clamp-2 min-h-[2.5em] leading-snug group-hover:text-blue-700 transition-colors">{item.name}</h4>
                                                    <div className="font-mono text-base font-black text-[#1A1A1A] mb-4">RM {item.price.toFixed(2)}<span className="text-[10px] text-gray-400 ml-1 font-bold">/{item.unit}</span></div>
                                                    
                                                    <div className="mt-auto pt-3 border-t border-gray-100 flex gap-2 flex-wrap">
                                                        <button onClick={() => addToCart(item)} className="flex-1 bg-[#1A1A1A] text-white py-2 rounded-xl text-xs font-bold hover:bg-[#FFD700] hover:text-black active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm min-h-[36px]">
                                                            <Plus size={12}/> 1 {item.unit}
                                                        </button>
                                                        {item.uomOptions?.filter(u => u.ratio > 1).map((uom, idx) => (
                                                            <button key={idx} onClick={() => addToCart(item, uom)} className="flex-1 bg-white border border-gray-200 text-gray-600 py-2 rounded-xl text-[10px] font-bold hover:bg-gray-50 active:scale-95 transition-all min-h-[36px]">
                                                                + 1 {uom.value}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {activeDetailTab === 'BILLS' && (
                                <div className="flex flex-col h-full">
                                    {/* 快速操作栏 */}
                                    <div className="bg-white px-6 py-3 border-b border-gray-100 flex items-center justify-between gap-3 sticky top-0 z-10">
                                        <div className="flex items-center gap-2">
                                            <button onClick={handleOpenBillForm} className="px-3 py-1.5 bg-[#1A1A1A] text-[#FFD700] rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm active:scale-95"><Plus size={12}/> 录入账单</button>
                                        </div>
                                        <div className="text-[10px] font-bold text-gray-400">
                                            共 {supplierExpenses.length} 笔 · 
                                            <span className="text-red-500 ml-1">欠款 RM {billStats.outstanding.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-6 py-2 border-b border-gray-100 flex gap-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                        <div className="flex-[2]">Date & ID</div>
                                        <div className="flex-1 text-center">Status</div>
                                        <div className="flex-1 text-right">Amount</div>
                                    </div>
                                    <div className="divide-y divide-gray-100 overflow-y-auto max-h-[500px]">
                                        {supplierExpenses.length === 0 ? <div className="p-16 text-center text-gray-400 text-sm font-medium">暂无历史账单记录</div> : supplierExpenses.map(bill => (
                                            <div key={bill.id} className="px-6 py-4 flex items-center hover:bg-blue-50/30 transition-colors">
                                                <div className="flex-[2]">
                                                    <div className="font-bold text-sm text-[#1A1A1A] mb-0.5">{bill.time.split('T')[0]}</div>
                                                    <div className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded w-fit">#{bill.id.slice(-8)}</div>
                                                </div>
                                                <div className="flex-1 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${bill.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'}`}>
                                                        {bill.paymentStatus}
                                                    </span>
                                                </div>
                                                <div className="flex-1 text-right">
                                                    <div className="font-mono font-black text-sm text-[#1A1A1A]">RM {bill.amount.toFixed(2)}</div>
                                                    {bill.outstandingAmount && bill.outstandingAmount > 0 && <div className="text-[10px] text-rose-500 font-bold mt-0.5">Due: RM {bill.outstandingAmount.toFixed(2)}</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. 采购单记录 */}
                {mainTab === 'POS' && view === 'LIST' && (
                    <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4">
                         <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                             <h3 className="font-black text-base text-[#1A1A1A] flex items-center gap-2">
                                 <div className="p-2 bg-[#FFD700] rounded-xl"><ClipboardCheck size={18}/></div> 
                                 采购单历史
                             </h3>
                             <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">Total: {purchaseOrders.length}</div>
                         </div>

                         {purchaseOrders.length === 0 ? (
                             <div className="bg-white rounded-[2rem] p-16 text-center border border-gray-100 shadow-sm">
                                 <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"><FileText size={32} className="text-gray-300"/></div>
                                 <p className="font-black text-gray-400 text-lg">暂无采购单</p>
                                 <p className="text-sm text-gray-400 mt-2">请在供应商产品目录中点击“添加商品”生成采购单。</p>
                             </div>
                         ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                 {purchaseOrders.map(po => (
                                     <div key={po.id} className="bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:border-[#FFD700]/50 transition-all flex flex-col group relative">
                                         <div className="flex justify-between items-start mb-3">
                                             <div className="flex items-center gap-3">
                                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] tracking-widest shadow-sm ${po.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : po.status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                                     {po.status === 'RECEIVED' ? 'RCV' : po.status === 'CANCELLED' ? 'CNL' : 'ORD'}
                                                 </div>
                                                 <div>
                                                     <div className="font-mono font-black text-sm text-[#1A1A1A]">{po.id}</div>
                                                     <div className="text-[10px] font-bold text-gray-400">{po.date.split('T')[0]}</div>
                                                 </div>
                                             </div>
                                         </div>
                                         <div className="font-bold text-[#1A1A1A] text-sm flex items-center gap-2 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                             <Truck size={14} className="text-gray-400 shrink-0"/> 
                                             <span className="truncate">{po.supplierName}</span>
                                         </div>
                                         
                                         <div className="flex justify-between items-end mt-auto pt-3 border-t border-gray-100">
                                             <div>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Est. Amount</p>
                                                <p className="font-mono font-black text-base text-blue-700">RM {po.totalEstimated.toFixed(2)}</p>
                                             </div>
                                             <div className="flex gap-1.5">
                                                 {po.status === 'ORDERED' && (
                                                     <button onClick={() => initiateReceivePO(po)} className="bg-[#1A1A1A] text-[#FFD700] px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-black transition-colors shadow-md active:scale-95">入库收货</button>
                                                 )}
                                                 <button onClick={() => sendWhatsappPO(po)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors" title="WhatsApp 发送"><Send size={14}/></button>
                                                 <button onClick={() => handleExportPO_PDF(po)} disabled={isGeneratingPdf && printingPO?.id === po.id} className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors" title="导出 PDF">
                                                     {isGeneratingPdf && printingPO?.id === po.id ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>}
                                                 </button>
                                                 <button onClick={() => setDeletePOCandidate(po.id)} className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors" title="删除"><Trash2 size={14}/></button>
                                             </div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                    </div>
                )}
            </div>

            {/* 所有 Modals 的设计也进行了黑金扁平化升级 */}
            
            {/* 新增/编辑供应商 Modal */}
            {isEditingSupplier && (
                <div className="fixed inset-0 bg-[#1A1A1A]/80 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] p-6 md:p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-[#1A1A1A] flex items-center gap-2">
                                <div className="p-2 bg-gray-100 rounded-xl text-gray-700"><Building2 size={20}/></div>
                                {supplierForm.id && suppliers.some(s => s.id === supplierForm.id) ? '编辑供应商' : '新增供应商'}
                            </h3>
                            <button onClick={() => setIsEditingSupplier(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className={LABEL_STYLE}>Company Name (公司名称)</label>
                                <input className={INPUT_STYLE} value={supplierForm.name || ''} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} placeholder="e.g. ABC Fresh Food" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {/* 核心修复：ID 在已有记录时锁死，新增时可自由编辑 */}
                                <div>
                                    <label className={LABEL_STYLE}>ID (Code)</label>
                                    <input 
                                        className={`${INPUT_STYLE} font-mono ${suppliers.some(s => s.id === supplierForm.id) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'text-blue-700 focus:ring-blue-500'}`} 
                                        value={supplierForm.id || ''} 
                                        onChange={e => setSupplierForm({...supplierForm, id: e.target.value.trim().toUpperCase()})} 
                                        placeholder="如: SUP-001" 
                                        readOnly={suppliers.some(s => s.id === supplierForm.id)} 
                                        title={suppliers.some(s => s.id === supplierForm.id) ? "已有供应商主键不可修改" : "可手动输入"}
                                    />
                                </div>
                                <div>
                                    <label className={LABEL_STYLE}>Status (状态)</label>
                                    <select className={INPUT_STYLE} value={supplierForm.status || 'ACTIVE'} onChange={e => setSupplierForm({...supplierForm, status: e.target.value as any})}>
                                        <option value="ACTIVE">🟢 Active 正常</option>
                                        <option value="INACTIVE">🔴 Inactive 停用</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between bg-yellow-50/50 p-4 rounded-2xl border border-yellow-200/60 cursor-pointer group" onClick={() => setSupplierForm({...supplierForm, isFavorite: !supplierForm.isFavorite})}>
                                <div>
                                    <p className="text-sm font-bold text-yellow-800">设为优先常用 (Favorite)</p>
                                    <p className="text-[10px] text-yellow-600/80 mt-0.5">点亮星星后将在列表顶部优先展示</p>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${supplierForm.isFavorite ? 'bg-[#FFD700] text-white shadow-md scale-110' : 'bg-white border border-yellow-200 text-gray-300 group-hover:bg-yellow-100'}`}>
                                    <Star size={20} className={supplierForm.isFavorite ? "fill-white" : ""} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL_STYLE}>Category (分类)</label>
                                    <select className={INPUT_STYLE} value={supplierForm.category || 'SUPPLIER'} onChange={e => setSupplierForm({...supplierForm, category: e.target.value})}>
                                        <option value="SUPPLIER">General</option>
                                        {Object.entries(ACCOUNTING_CATEGORIES_OPTIONS).map(([group, options]) => (
                                            <optgroup key={group} label={group}>{options.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</optgroup>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={LABEL_STYLE}>Rest Days (休息日)</label>
                                    <input className={INPUT_STYLE} value={supplierForm.restDayNote || ''} onChange={e => setSupplierForm({...supplierForm, restDayNote: e.target.value})} placeholder="e.g. Sunday" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL_STYLE}>Contact Person (联系人)</label>
                                    <input className={INPUT_STYLE} value={supplierForm.contactPerson || ''} onChange={e => setSupplierForm({...supplierForm, contactPerson: e.target.value})} placeholder="Name" />
                                </div>
                                <div>
                                    <label className={LABEL_STYLE}>Phone (电话 - 用于WA)</label>
                                    <input className={INPUT_STYLE} value={supplierForm.contact || ''} onChange={e => setSupplierForm({...supplierForm, contact: e.target.value})} placeholder="012345678" />
                                </div>
                            </div>
                            <div>
                                <label className={LABEL_STYLE}>Address (地址)</label>
                                <textarea className={`${INPUT_STYLE} h-20 resize-none`} value={supplierForm.address || ''} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})} placeholder="Full Address" />
                            </div>
                            <button onClick={handleSaveSupplier} disabled={isSyncingName} className="w-full py-3.5 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-sm mt-4 flex justify-center items-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-black active:scale-95 transition-all">
                                {isSyncingName ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} 保存供应商资料
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 新增/编辑商品 Modal */}
            {isEditingProduct && (
               <div className="fixed inset-0 bg-[#1A1A1A]/80 z-[160] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-md rounded-[2rem] p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black flex items-center gap-2 text-[#1A1A1A]">
                                <div className="p-2 bg-gray-100 rounded-xl text-gray-700"><Package size={20}/></div>
                                {productForm.id ? '编辑商品' : '新增供应商品'}
                            </h3>
                            <button onClick={() => setIsEditingProduct(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="space-y-5">
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                                <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-3 flex items-center gap-2"><LinkIcon size={14}/> 关联库存系统</h4>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-blue-400" size={14}/>
                                    <input type="text" placeholder="搜索现有库存物品名称..." value={stockSearchTerm} onChange={e => setStockSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"/>
                                </div>
                                {stockSearchTerm && (
                                    <div className="mt-2 max-h-32 overflow-y-auto bg-white border border-blue-100 rounded-xl shadow-lg absolute z-50 w-[calc(100%-3rem)] left-6">
                                        {allStockList.filter(s => s.name.toLowerCase().includes(stockSearchTerm.toLowerCase())).map(s => (
                                            <button key={s.id} onClick={() => { setProductForm(p => ({...p, linkedStockId: s.id, name: s.name, unit: s.unit, price: s.cost, category: s.category})); setStockSearchTerm(''); }} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-xs font-bold text-gray-700 border-b border-gray-50 flex justify-between">
                                                {s.name} <span className="text-[9px] font-mono text-gray-400 bg-gray-100 px-1 rounded">{s.id}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {productForm.linkedStockId && (
                                    <div className="mt-3 bg-white border border-blue-200 rounded-xl p-2.5 flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg"><Box size={14}/></div>
                                            <div>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase">Linked Item</p>
                                                <p className="text-xs font-black text-blue-900">{allStockList.find(s => s.id === productForm.linkedStockId)?.name || productForm.linkedStockId}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setProductForm({...productForm, linkedStockId: undefined})} className="text-red-400 p-1.5 hover:bg-red-50 rounded-lg"><X size={14}/></button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className={LABEL_STYLE}>Item Name (商品名称)</label>
                                <input type="text" value={productForm.name || ''} onChange={e => setProductForm({...productForm, name: e.target.value})} className={INPUT_STYLE} placeholder="e.g. Fresh Chicken Breast"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL_STYLE}>Base Unit (基础单位)</label>
                                    <input type="text" value={productForm.unit || ''} onChange={e => setProductForm({...productForm, unit: e.target.value})} className={INPUT_STYLE} placeholder="e.g. KG"/>
                                </div>
                                <div>
                                    <label className={LABEL_STYLE}>Price (价格 RM)</label>
                                    <input type="number" value={productForm.price || ''} onChange={e => setProductForm({...productForm, price: parseFloat(e.target.value)})} className={INPUT_STYLE} placeholder="0.00"/>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">多单位换算 (Smart Units)</h4>
                                    <button onClick={addUomOption} className="text-[10px] bg-white border border-gray-200 px-2.5 py-1 rounded-md font-bold text-[#1A1A1A] hover:bg-gray-100">+ Add</button>
                                </div>
                                <div className="space-y-2">
                                    {productUoms?.map((opt, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                                            <input className="w-20 p-2 text-xs border border-gray-200 rounded-lg font-bold outline-none focus:border-[#FFD700]" placeholder="Unit Name" value={opt.value} onChange={e => updateUomOption(idx, 'value', e.target.value)} />
                                            <span className="text-xs font-bold text-gray-400">=</span>
                                            <input type="number" className="w-16 p-2 text-xs border border-gray-200 rounded-lg font-bold text-center outline-none focus:border-[#FFD700]" value={opt.ratio} onChange={e => updateUomOption(idx, 'ratio', parseFloat(e.target.value))} />
                                            <span className="text-[10px] text-gray-500 font-bold">{productForm.unit || 'Base'}</span>
                                            <button onClick={() => removeUomOption(idx)} className="ml-auto text-red-400 p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleSaveProduct} className="w-full py-3.5 bg-[#1A1A1A] text-[#FFD700] font-black rounded-xl text-sm mt-4 shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-black active:scale-95 transition-all">保存商品 (Save Item)</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 底部悬浮购物车 Drawer (极致移动端体验) */}
            {isCreatingPO && cart.length > 0 && (
                <div className={`fixed bottom-0 left-0 right-0 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.15)] border-t border-gray-200 z-[120] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isCartExpanded ? 'h-[65vh] md:h-[50vh] rounded-t-[2rem]' : 'h-16 md:h-20'}`}>
                    <div className="max-w-7xl mx-auto h-full flex flex-col relative">
                        {/* 拖拽指示器 */}
                        {isCartExpanded && <div className="w-12 h-1.5 bg-gray-200 rounded-full absolute top-2 left-1/2 -translate-x-1/2 cursor-pointer" onClick={() => setIsCartExpanded(false)}></div>}
                        
                        <div className={`px-4 md:px-8 flex justify-between items-center bg-white cursor-pointer select-none shrink-0 ${isCartExpanded ? 'h-20 pt-4' : 'h-full'}`} onClick={() => setIsCartExpanded(!isCartExpanded)}>
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="relative">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#1A1A1A] to-gray-800 rounded-[14px] flex items-center justify-center text-[#FFD700] shadow-md">
                                        <ShoppingBag size={20} className="md:w-6 md:h-6"/>
                                    </div>
                                    <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] md:text-xs font-black w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm">{cart.length}</div>
                                </div>
                                <div>
                                    <h3 className="font-black text-sm md:text-lg text-[#1A1A1A]">采购车 (PO Cart)</h3>
                                    <p className="text-[10px] md:text-xs text-gray-500 font-bold truncate max-w-[120px] md:max-w-xs">To: {selectedSupplier?.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 md:gap-6">
                                <div className="text-right hidden sm:block">
                                    <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest">Est. Total</p>
                                    <p className="text-base md:text-xl font-mono font-black text-[#1A1A1A]">RM {cart.reduce((sum, item) => sum + (item.orderQty * item.cost), 0).toFixed(2)}</p>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handleCreatePO(); }} className="px-5 md:px-8 py-2.5 md:py-3 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-xs md:text-sm shadow-lg hover:bg-black transition-all active:scale-95">生成订单</button>
                                <div className="text-gray-300 hidden md:block">{isCartExpanded ? <ChevronDown size={24}/> : <ChevronUp size={24}/>}</div>
                            </div>
                        </div>
                        
                        {isCartExpanded && (
                            <div className="flex-grow overflow-y-auto p-4 md:p-8 bg-gray-50/80 border-t border-gray-100">
                                <div className="space-y-3 max-w-4xl mx-auto">
                                    {cart.map((item, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-[#FFD700]/50 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-sm text-[#1A1A1A] truncate">{item.name}</h4>
                                                <p className="text-[10px] font-mono text-gray-400 mt-0.5">{item.stockId}</p>
                                            </div>
                                            <div className="flex items-center justify-between md:justify-end gap-4">
                                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 shadow-inner">
                                                    <button onClick={() => { const c=[...cart]; if(c[idx].orderQty>1) c[idx].orderQty--; setCart(c); }} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 font-black active:scale-95 transition-transform">-</button>
                                                    <input type="number" className="w-12 bg-transparent text-center font-mono font-black text-sm outline-none" value={item.orderQty} onChange={(e)=>{ const c=[...cart]; c[idx].orderQty = Math.max(1, parseInt(e.target.value)||1); setCart(c); }}/>
                                                    <button onClick={() => { const c=[...cart]; c[idx].orderQty++; setCart(c); }} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 font-black active:scale-95 transition-transform">+</button>
                                                </div>
                                                <div className="flex flex-col items-end w-20">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">{item.unit}</span>
                                                    <span className="font-mono font-black text-sm text-blue-700">RM {(item.orderQty * item.cost).toFixed(2)}</span>
                                                </div>
                                                <button onClick={() => removeFromCart(idx)} className="p-2 text-red-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"><Trash2 size={18}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Mobile total row inside expanded view */}
                                    <div className="sm:hidden mt-6 p-4 bg-[#1A1A1A] text-white rounded-2xl flex justify-between items-center shadow-lg">
                                        <span className="text-xs font-bold uppercase tracking-widest text-[#FFD700]">Total</span>
                                        <span className="text-xl font-mono font-black">RM {cart.reduce((sum, item) => sum + (item.orderQty * item.cost), 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Delete Confirmations (保持黑金UI) */}
            {deleteProductCandidate && (
                <div className="fixed inset-0 bg-[#1A1A1A]/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-6 w-full max-w-xs text-center shadow-2xl">
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={32} className="text-rose-500"/></div>
                        <h4 className="text-lg font-black text-[#1A1A1A] mb-2">确认删除商品?</h4>
                        <p className="text-xs font-medium text-gray-500 mb-6">此操作将从供应目录中移除该商品，不可撤销。</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setDeleteProductCandidate(null)} className="py-3 bg-gray-50 font-bold rounded-xl text-xs text-gray-600 hover:bg-gray-100">取消</button>
                            <button onClick={executeDeleteProduct} className="py-3 bg-rose-600 text-white font-bold rounded-xl text-xs shadow-lg hover:bg-rose-700">确认删除</button>
                        </div>
                    </div>
                </div>
            )}

            {deletePOCandidate && (
                <div className="fixed inset-0 bg-[#1A1A1A]/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-6 w-full max-w-xs text-center shadow-2xl">
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={32} className="text-rose-500"/></div>
                        <h4 className="text-lg font-black text-[#1A1A1A] mb-2">删除采购单?</h4>
                        <p className="text-xs font-medium text-gray-500 mb-6">仅删除记录，不会撤销已入库的库存数据。</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setDeletePOCandidate(null)} className="py-3 bg-gray-50 font-bold rounded-xl text-xs text-gray-600 hover:bg-gray-100">取消</button>
                            <button onClick={executeDeletePO} className="py-3 bg-rose-600 text-white font-bold rounded-xl text-xs shadow-lg hover:bg-rose-700">确认删除</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteSupplierId && (
                <div className="fixed inset-0 bg-[#1A1A1A]/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-sm text-center shadow-2xl">
                        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={40} className="text-rose-500"/></div>
                        <h4 className="text-xl font-black text-[#1A1A1A] mb-2">彻底删除供应商?</h4>
                        <p className="text-sm font-medium text-gray-500 mb-6">
                            此操作将删除该供应商及其所有关联产品目录。<br/>历史采购单不受影响，但无法再向其下单。
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setDeleteSupplierId(null)} className="py-3.5 bg-gray-50 font-bold rounded-xl text-sm text-gray-600 hover:bg-gray-100">取消</button>
                            <button onClick={executeDeleteSupplier} className="py-3.5 bg-rose-600 text-white font-bold rounded-xl text-sm shadow-[0_4px_12px_rgba(225,29,72,0.3)] hover:bg-rose-700 active:scale-95">彻底删除</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Bill Input Modal */}
            {isBillFormOpen && (
                <div className="fixed inset-0 bg-[#1A1A1A]/80 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-lg text-[#1A1A1A] flex items-center gap-2"><Receipt size={20}/> 录入新账单</h3>
                            <button onClick={() => setIsBillFormOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={18}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className={LABEL_STYLE}>Amount (RM) 总金额</label>
                                <input type="number" className={INPUT_STYLE} value={newBill.totalBillAmount || ''} onChange={e => setNewBill({...newBill, totalBillAmount: parseFloat(e.target.value)})} placeholder="0.00" />
                            </div>
                            <div>
                                <label className={LABEL_STYLE}>Date (账单日期)</label>
                                <input type="date" className={INPUT_STYLE} value={newBill.time?.split('T')[0]} onChange={e => setNewBill({...newBill, time: e.target.value})} />
                            </div>
                            <div>
                                <label className={LABEL_STYLE}>Status (付款状态)</label>
                                <select className={INPUT_STYLE} value={newBill.paymentStatus} onChange={e => setNewBill({...newBill, paymentStatus: e.target.value as any})}>
                                    <option value="UNPAID">🔴 未付 (UNPAID)</option>
                                    <option value="PAID">🟢 已结清 (PAID)</option>
                                </select>
                            </div>
                            <div>
                                <label className={LABEL_STYLE}>Note (备注说明)</label>
                                <input className={INPUT_STYLE} value={newBill.note || ''} onChange={e => setNewBill({...newBill, note: e.target.value})} placeholder="Optional..." />
                            </div>
                            <button onClick={handleSaveBill} className="w-full py-3.5 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-sm shadow-lg hover:bg-black mt-2 active:scale-95 transition-all">确认生成账单</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Receive PO Modal */}
            {isReceiveModalOpen && receivingPO && (
                <div className="fixed inset-0 bg-[#1A1A1A]/80 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-5 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl"><ClipboardCheck size={24}/></div>
                                <div>
                                    <h3 className="font-black text-lg md:text-xl text-[#1A1A1A]">采购入库对账 (Receive PO)</h3>
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5 tracking-widest">ORDER REF: {receivingPO.id}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsReceiveModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto p-4 md:p-6">
                            <div className="bg-blue-50/80 border border-blue-200/50 p-4 rounded-2xl mb-6 text-xs font-bold text-blue-800 flex gap-3 items-start shadow-sm">
                                <Info size={18} className="shrink-0 mt-0.5 text-blue-600"/>
                                <p className="leading-relaxed">请核对实际收货数量与价格。如果供应商按<span className="text-red-600 font-black">实际重量(KG)</span>计费（如肉类/海鲜），请勾选「按重计费」并输入实重，系统会自动为您摊算每单位的真实库存成本。</p>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-50 text-gray-500 font-bold text-[10px] uppercase tracking-wider border-b border-gray-200">
                                        <tr>
                                            <th className="p-4">Item (商品)</th>
                                            <th className="p-4 w-24">Ordered</th>
                                            <th className="p-4 w-28">Cost(Unit)</th>
                                            <th className="p-4 w-28">Rcv Qty (包/件)</th>
                                            <th className="p-4 w-36 bg-blue-50/50 border-x border-blue-100/50">按重计费? (By KG)</th>
                                            <th className="p-4 w-28 text-right">Total (RM)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {receivedItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="p-4 font-bold text-xs text-[#1A1A1A]">
                                                    {item.name}
                                                    <div className="text-[9px] text-gray-400 font-mono mt-0.5">{item.supplierCode || 'NO-CODE'}</div>
                                                </td>
                                                <td className="p-4 text-xs font-mono font-medium">{item.orderQty} <span className="text-[10px] text-gray-400">{item.unit}</span></td>
                                                <td className="p-4">
                                                    <div className="relative">
                                                        <span className="absolute left-2.5 top-2 text-[10px] text-gray-400 font-bold">RM</span>
                                                        <input type="number" className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono font-bold focus:border-blue-500 outline-none" value={item.finalCost} onChange={e => updateReceivedItem(idx, 'finalCost', parseFloat(e.target.value))} />
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <input type="number" className="w-full p-1.5 border border-gray-200 rounded-lg text-xs font-mono font-black text-center focus:border-blue-500 outline-none bg-gray-50" value={item.receivedQty} onChange={e => updateReceivedItem(idx, 'receivedQty', parseInt(e.target.value))} />
                                                </td>
                                                <td className="p-4 bg-blue-50/30 border-x border-blue-50/50">
                                                    <div className="flex items-center gap-2">
                                                        <input type="checkbox" checked={item.billByWeight || false} onChange={e => updateReceivedItem(idx, 'billByWeight', e.target.checked)} className="w-4 h-4 accent-blue-600 rounded cursor-pointer" />
                                                        {item.billByWeight && (
                                                            <div className="flex items-center gap-1 relative">
                                                                <input type="number" className="w-16 p-1.5 border-2 border-blue-400 rounded-lg text-xs font-mono font-black text-blue-900 outline-none focus:ring-2 ring-blue-200 text-center" placeholder="0.0" value={item.receivedWeight || ''} onChange={e => updateReceivedItem(idx, 'receivedWeight', parseFloat(e.target.value))} />
                                                                <span className="text-[10px] text-blue-600 font-black absolute -right-4">KG</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-mono font-black text-blue-700 text-sm">
                                                    {((item.billByWeight && item.receivedWeight ? item.receivedWeight : item.receivedQty) * item.finalCost).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-5 md:p-6 border-t border-gray-200 bg-white flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10">
                            <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-6 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Final AP Total</p>
                                    <p className="text-2xl font-mono font-black text-red-600">
                                        RM {receivedItems.reduce((sum, item) => sum + ((item.billByWeight && item.receivedWeight ? item.receivedWeight : item.receivedQty) * item.finalCost), 0).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                            <button onClick={confirmReceivePO} disabled={isProcessingReceive} className="w-full md:w-auto px-8 py-4 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                                {isProcessingReceive ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} 确认入库并抛转账单
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    if (isModal) {
        return (
            <div className="fixed inset-0 bg-[#1A1A1A]/80 z-[80] flex items-center justify-center p-0 md:p-6 backdrop-blur-md animate-in zoom-in duration-300">
                {MainContent}
            </div>
        );
    }

    return MainContent;
};