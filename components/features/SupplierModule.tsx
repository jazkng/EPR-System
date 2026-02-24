
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Truck, Plus, Search, Phone, MapPin, Edit3, Trash2, X, Save, FileText, Package, Link, CheckCircle2, Calendar, Send, ArrowLeft, Box, Calculator, Grid, Globe, CreditCard, Building2, Mail, Clock, AlertCircle, Tag as TagIcon, FileDown, MoreHorizontal, Receipt, UserCircle, ChevronUp, ChevronDown, Hash, DollarSign, Layers, User, RefreshCw, TrendingUp, ClipboardCheck, ArrowDownToLine, Link as LinkIcon, Unlink, ExternalLink, Loader2, MessageCircle, Info, ShoppingBag, Zap, Scale, Star, CalendarOff } from 'lucide-react';
import { Supplier, CatalogItem, PurchaseOrder, StockItem, PurchaseOrderItem, UomOption, ExpenseItem, SettlementRecord } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { SUPPLIER_TAG_OPTIONS } from '../constants';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import { collection, getDocs, writeBatch, query, where } from "firebase/firestore";
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

// --- SYNCED WITH ACCOUNTS PAYABLE ---
const ACCOUNTING_CATEGORIES_OPTIONS = {
    'COGS (销货成本)': [
        { id: 'INGREDIENT_MEAT', label: '食材-肉类 (Meat)' },
        { id: 'INGREDIENT_SEAFOOD', label: '食材-海鲜 (Seafood)' },
        { id: 'INGREDIENT_VEG', label: '食材-蔬果 (Veg)' },
        { id: 'INGREDIENT_DRY', label: '食材-干货 (Dry)' },
        { id: 'INGREDIENT_SAUCE', label: '食材-酱料 (Sauce)' },
        { id: 'BEVERAGE', label: '水吧原料 (Beverage)' },
        { id: 'PACKAGING', label: '包装材料 (Packaging)' },
        { id: 'GAS_COGS', label: '烹饪煤气 (Gas)' },
        { id: 'SUPPLIER', label: '一般进货 (General)' }
    ],
    'OPEX (营运开支)': [
        { id: 'SUPPLIES', label: '杂项耗材 (Supplies)' },
        { id: 'MAINTENANCE', label: '维修保养 (Maintenance)' },
        { id: 'LOGISTICS', label: '物流运输 (Logistics)' },
        { id: 'MARKETING', label: '营销广告 (Marketing)' },
        { id: 'PROFESSIONAL', label: '专业服务 (Professional)' },
        { id: 'UTILITIES', label: '水电费 (Utilities)' },
        { id: 'RENT', label: '租金 (Rent)' }
    ],
    'CAPEX (资产)': [
        { id: 'EQUIPMENT', label: '设备采购 (Equipment)' },
        { id: 'RENOVATION', label: '装修工程 (Renovation)' }
    ]
};

// Modern Light Theme Input Style
const INPUT_STYLE = "w-full p-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-[#1A1A1A] outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]/20 transition-all placeholder:font-normal placeholder:text-gray-400";
const LABEL_STYLE = "text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block ml-1";

// Extended Interface for Catch Weight
interface SupplierReceivedItem extends PurchaseOrderItem {
    receivedQty: number;
    finalCost: number;
    billByWeight?: boolean;
    receivedWeight?: number;
}

export const SupplierModule: React.FC<SupplierModuleProps> = ({ onClose, isModal = false, onNavigateToStock }) => {
    // --- MAIN STATE ---
    const [mainTab, setMainTab] = useState<'SUPPLIERS' | 'POS'>('SUPPLIERS');
    const [view, setView] = useState<'LIST' | 'DETAIL'>('LIST');
    
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [allStockList, setAllStockList] = useState<StockItem[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // --- EXPENSES STATE ---
    const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
    const [activeDetailTab, setActiveDetailTab] = useState<'CATALOG' | 'BILLS'>('CATALOG');
    const [isBillFormOpen, setIsBillFormOpen] = useState(false);
    const [newBill, setNewBill] = useState<Partial<ExpenseItem>>({});

    // --- TAGS STATE ---
    const [availableTags, setAvailableTags] = useState(SUPPLIER_TAG_OPTIONS);
    const [newTagName, setNewTagName] = useState('');

    // --- FORMS STATE ---
    const [isEditingSupplier, setIsEditingSupplier] = useState(false);
    const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({});
    
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [productForm, setProductForm] = useState<Partial<CatalogItem>>({});
    const [productUoms, setProductUoms] = useState<UomOption[]>(DEFAULT_UOMS);
    const [stockSearchTerm, setStockSearchTerm] = useState('');

    // --- PO CART STATE ---
    const [isCreatingPO, setIsCreatingPO] = useState(false);
    const [cart, setCart] = useState<PurchaseOrderItem[]>([]);
    const [isCartExpanded, setIsCartExpanded] = useState(true);

    // --- RECEIVE PO STATE ---
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
    const [receivedItems, setReceivedItems] = useState<SupplierReceivedItem[]>([]); 
    const [isProcessingReceive, setIsProcessingReceive] = useState(false);

    // --- CONFIRMATION STATE ---
    const [deleteProductCandidate, setDeleteProductCandidate] = useState<Partial<CatalogItem> | null>(null);
    const [deletePOCandidate, setDeletePOCandidate] = useState<string | null>(null);
    const [deleteSupplierId, setDeleteSupplierId] = useState<string | null>(null);

    // --- PRINTING STATE ---
    const printRef = useRef<HTMLDivElement>(null);
    const [printingPO, setPrintingPO] = useState<PurchaseOrder | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSyncingName, setIsSyncingName] = useState(false);

    // --- INITIAL LOAD ---
    useEffect(() => {
        loadData();
    }, []);

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

            loadExpenses();
        } catch (error) {
            console.error("Failed to load supplier data", error);
        }
    };

    const loadExpenses = async () => {
        try {
            const settlements = await DataManager.getSettlements();
            let allExp: ExpenseItem[] = [];
            
            settlements.forEach(s => {
                if (s.expenses) allExp.push(...s.expenses.map(e => ({...e, settlementId: s.id})));
            });

            const snap = await getDocs(collection(db, 'standalone_expenses'));
            snap.forEach(doc => {
                allExp.push(doc.data() as ExpenseItem);
            });

            const unique = Array.from(new Map(allExp.map(item => [item.id, item])).values());
            unique.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            
            setExpenses(unique);
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
        return {
            total,
            outstanding,
            paid: total - outstanding
        };
    }, [supplierExpenses]);

    // --- ACTIONS ---

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
                restDayNote: supplierForm.restDayNote || '', // Save Rest Day Note
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
        
        // Optimistic update
        setSuppliers(prev => prev.map(s => s.id === sup.id ? updatedSup : s));
        
        try {
            await DataManager.saveSupplier(updatedSup);
        } catch (err) {
            console.error(err);
            // Revert on fail
            setSuppliers(prev => prev.map(s => s.id === sup.id ? sup : s));
        }
    };

    const handleEditSupplier = (sup: Supplier) => {
        setSupplierForm(sup);
        setIsEditingSupplier(true);
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
        await loadExpenses();
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

    // --- PO CART LOGIC ---
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
        alert(`✅ 采购单 ${newPO.id} 已生成 (Created)`);
        
        setCart([]);
        setIsCreatingPO(false);
        await loadData();
        setMainTab('POS');
    };

    const executeDeletePO = async () => {
        if (!deletePOCandidate) return;
        try {
            await DataManager.deletePurchaseOrder(deletePOCandidate);
            alert("✅ 采购单已删除");
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
        // Map to SupplierReceivedItem with defaults for Catch Weight
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
            // NEW CALCULATION LOGIC FOR CATCH WEIGHT
            const finalTotal = receivedItems.reduce((sum, item) => {
                if (item.billByWeight && item.receivedWeight) {
                    return sum + (item.receivedWeight * item.finalCost); // Price is per KG
                } else {
                    return sum + (item.receivedQty * item.finalCost); // Price is per Unit
                }
            }, 0);

            const stockUpdates = new Map<string, { qtyDelta: number, newCost: number }>();
            
            // 1. Get supplier to find Category
            const supplier = suppliers.find(s => s.id === receivingPO.supplierId);
            // Default to SUPPLIER but try to match AP Categories if available
            const billCategory = supplier?.category || 'SUPPLIER';

            receivedItems.forEach((item) => {
                const catalogItem = supplier?.catalog?.find(c => c.id === item.stockId);
                if (catalogItem && catalogItem.linkedStockId) {
                    const inventoryId = catalogItem.linkedStockId;
                    const baseQtyDelta = item.receivedQty * item.ratio;
                    
                    // COST RECALCULATION:
                    let baseUnitCost = 0;
                    if (item.billByWeight && item.receivedWeight && item.receivedQty > 0) {
                        const totalLineCost = item.receivedWeight * item.finalCost;
                        // Cost per unit = Total Cost / Total Units / Unit Ratio
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

            // Create Expense with Correct Category
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

            alert(`✅ 入库成功！应付账款: RM ${finalTotal.toFixed(2)}\n分类: ${billCategory}\n库存成本已根据实重调整。`);
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

    // --- UPDATED MULTI-PAGE PDF EXPORT ---
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
                        windowWidth: 794 // Fix to standard A4 pixel width approx
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
        po.items.forEach((item, i) => { text += `${i+1}. ${item.name} [${item.supplierCode || ''}]\n   Qty: ${item.orderQty} ${item.unit}\n`; });
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
        // Sort logic: Favorites first, then alphabetical
        .sort((a, b) => {
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;
            return a.name.localeCompare(b.name);
        });

    const MainContent = (
        <div className={`flex flex-col bg-[#F5F7FA] h-full ${isModal ? 'md:max-h-[95vh] md:rounded-[2rem] overflow-hidden shadow-2xl border border-gray-100' : ''} font-sans`}>
            {/* --- TOP BAR --- */}
            <div className="bg-[#1A1A1A] text-white shrink-0 border-b-4 border-[#FFD700] p-4 md:px-6 md:py-5 flex flex-col md:flex-row justify-between items-center z-10 shadow-md gap-4 md:gap-0">
                <div className="flex items-center justify-between w-full md:w-auto">
                    <div className="flex items-center gap-4">
                        {view !== 'LIST' && (
                            <button onClick={() => { setView('LIST'); setSelectedSupplier(null); setIsCreatingPO(false); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">
                                <ArrowLeft size={20}/>
                            </button>
                        )}
                        <div>
                            <h3 className="font-serif font-black text-lg md:text-xl tracking-wide flex items-center gap-2 text-white">
                                <Truck className="text-[#FFD700]" size={24}/> <span className="truncate">供应商管理</span>
                            </h3>
                            <p className="text-[9px] md:text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">Supplier Management</p>
                        </div>
                    </div>
                    
                    {/* Mobile Actions (Close/Help) */}
                    <div className="flex items-center gap-2 md:hidden">
                         <ModuleGuideButton module="SUPPLIER" />
                         {onClose && <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"><X size={20}/></button>}
                    </div>
                </div>

                {/* Desktop Actions */}
                <div className="hidden md:flex gap-3 items-center">
                     {/* Tab Switcher */}
                     <div className="flex bg-white/10 p-1 rounded-xl">
                        <button onClick={() => { setMainTab('SUPPLIERS'); setView('LIST'); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'SUPPLIERS' ? 'bg-[#FFD700] text-black shadow-sm' : 'text-gray-300 hover:text-white'}`}>
                            <UserCircle size={14}/> 供应商
                        </button>
                        <button onClick={() => { setMainTab('POS'); setView('LIST'); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'POS' ? 'bg-[#FFD700] text-black shadow-sm' : 'text-gray-300 hover:text-white'}`}>
                            <FileText size={14}/> 采购单
                        </button>
                    </div>
                    <div className="w-px h-8 bg-white/20 mx-2"></div>
                    <ModuleGuideButton module="SUPPLIER" />
                    {onClose && <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"><X size={20}/></button>}
                </div>
            </div>

            {/* MOBILE TAB SWITCHER (Visible only on mobile list view) */}
            <div className="md:hidden bg-white border-b border-gray-200 p-2 flex gap-2 shrink-0">
                <button onClick={() => { setMainTab('SUPPLIERS'); setView('LIST'); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${mainTab === 'SUPPLIERS' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                    <UserCircle size={14}/> 供应商列表
                </button>
                <button onClick={() => { setMainTab('POS'); setView('LIST'); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${mainTab === 'POS' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                    <FileText size={14}/> 采购单记录
                </button>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="flex-grow overflow-y-auto bg-[#F5F7FA] p-4 md:p-6 pb-32">
                
                {/* 1. SUPPLIER LIST VIEW */}
                {mainTab === 'SUPPLIERS' && view === 'LIST' && (
                    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        {/* Search & Actions Bar */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-4 top-3.5 text-gray-400" size={18}/>
                                <input 
                                    type="text" 
                                    placeholder="搜索供应商 / ID / 标签..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#FFD700] transition-all outline-none"
                                />
                            </div>
                            <button onClick={handleOpenAddSupplier} className="w-full md:w-auto bg-[#1A1A1A] text-[#FFD700] px-6 py-3 rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-transform active:scale-95">
                                <Plus size={16}/> 新增供应商 (New Supplier)
                            </button>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredSuppliers.map(sup => (
                                <div key={sup.id} onClick={() => { setSelectedSupplier(sup); setView('DETAIL'); setActiveDetailTab('CATALOG'); }} className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-gray-200 hover:border-[#FFD700] hover:shadow-md transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Truck size={80}/></div>
                                    
                                    {/* Favorite Toggle Button */}
                                    <button 
                                        onClick={(e) => handleToggleFavorite(e, sup)}
                                        className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm border border-gray-100 transition-all hover:scale-110 active:scale-95"
                                    >
                                        <Star size={18} className={sup.isFavorite ? "fill-[#FFD700] text-[#FFD700]" : "text-gray-300"} />
                                    </button>

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gray-100 text-[#1A1A1A] flex items-center justify-center font-black text-sm border border-gray-200 shadow-inner group-hover:bg-[#FFD700] group-hover:border-[#FFD700] transition-colors">
                                            {sup.id}
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border mr-8 ${sup.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                            {sup.status}
                                        </span>
                                    </div>
                                    
                                    <h4 className="font-black text-lg text-[#1A1A1A] mb-1 line-clamp-1 group-hover:text-blue-700 transition-colors pr-6">{sup.name}</h4>
                                    <p className="text-xs text-gray-500 font-bold mb-2 flex items-center gap-1"><User size={12}/> {sup.contactPerson || 'General'}</p>
                                    
                                    {/* Rest Day Indicator */}
                                    {sup.restDayNote && (
                                        <div className="mb-4 bg-orange-50 border border-orange-100 rounded-lg px-2 py-1.5 flex items-start gap-1.5">
                                            <CalendarOff size={12} className="text-orange-500 mt-0.5 shrink-0"/>
                                            <p className="text-[10px] font-bold text-orange-800 leading-tight">{sup.restDayNote}</p>
                                        </div>
                                    )}
                                    
                                    <div className="mt-auto space-y-3">
                                        <div className="flex gap-2 flex-wrap">
                                            {sup.category && <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-md border border-blue-100">{sup.category}</span>}
                                            {sup.tags?.slice(0,2).map(t => <span key={t} className="text-[9px] font-bold bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">#{t}</span>)}
                                        </div>
                                        <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs font-bold text-gray-400">
                                            <span>{sup.catalog?.length || 0} Products</span>
                                            <div className="flex items-center gap-1 text-[#1A1A1A] group-hover:translate-x-1 transition-transform">View <ArrowLeft size={12} className="rotate-180"/></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredSuppliers.length === 0 && (
                                <div className="col-span-full py-20 text-center text-gray-400 flex flex-col items-center">
                                    <div className="bg-gray-100 p-4 rounded-full mb-4"><Search size={32} className="opacity-50"/></div>
                                    <p className="font-bold">未找到相关供应商</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. DETAIL VIEW */}
                {view === 'DETAIL' && selectedSupplier && (
                    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-8">
                        {/* HERO HEADER */}
                        <div className="bg-white rounded-[2rem] p-5 md:p-8 border border-gray-200 shadow-lg relative overflow-hidden group">
                            {/* Decorative Background */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFD700] opacity-10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
                            
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                                <div className="flex gap-5 w-full">
                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center shadow-inner text-[#1A1A1A] shrink-0">
                                        <Truck size={36} className="text-[#8B0000]" />
                                    </div>
                                    
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-500 text-[10px] font-mono tracking-widest whitespace-nowrap">
                                                ID: {selectedSupplier.id}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap ${selectedSupplier.status === 'ACTIVE' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-0.5 ${selectedSupplier.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                {selectedSupplier.status}
                                            </span>
                                            {/* Rest Day Tag in Detail View */}
                                            {selectedSupplier.restDayNote && (
                                                <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-800 text-[10px] font-bold flex items-center gap-1">
                                                    <CalendarOff size={10}/> {selectedSupplier.restDayNote}
                                                </span>
                                            )}
                                        </div>
                                        <h1 className="text-2xl md:text-4xl font-black text-[#1A1A1A] tracking-tight mb-2 truncate">
                                            {selectedSupplier.name}
                                        </h1>
                                        
                                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <User size={14} />
                                                {selectedSupplier.contactPerson || 'N/A'}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Phone size={14} />
                                                {selectedSupplier.contact}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-px h-3 bg-gray-300"></div>
                                                <span className="text-blue-600 font-bold tracking-wider uppercase">{selectedSupplier.category || 'GENERAL'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <button 
                                        onClick={() => window.open(`https://wa.me/${selectedSupplier.contact.replace(/\D/g,'')}`, '_blank')}
                                        className="h-10 flex-1 md:flex-none px-6 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 group/btn"
                                    >
                                        <MessageCircle size={16} className="group-hover/btn:animate-bounce" />
                                        <span>WhatsApp</span>
                                    </button>
                                    <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>
                                    <button onClick={() => { setSupplierForm(selectedSupplier); setIsEditingSupplier(true); }} className="p-2.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-all border border-gray-200 md:border-0"><Edit3 size={18}/></button>
                                    <button onClick={() => setDeleteSupplierId(selectedSupplier.id)} className="md:hidden p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-gray-200"><Trash2 size={18}/></button>
                                </div>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
                                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 group/stat hover:border-[#FFD700] transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Payment Term</p>
                                    <p className="text-sm font-bold text-[#1A1A1A] flex items-center gap-2">
                                        <FileText size={14} className="text-gray-400" />
                                        {selectedSupplier.paymentTerm || 'COD'}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 group/stat hover:border-[#FFD700] transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Min Order</p>
                                    <p className="text-sm font-mono font-bold text-[#1A1A1A]">
                                        RM {selectedSupplier.minOrderValue || 0}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 group/stat hover:border-blue-300 transition-colors relative overflow-hidden">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Spent</p>
                                    <p className="text-lg font-mono font-black text-blue-600">
                                        RM {billStats.total.toFixed(2)}
                                    </p>
                                </div>

                                <div className={`p-4 rounded-xl border transition-all relative overflow-hidden ${billStats.outstanding > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${billStats.outstanding > 0 ? 'text-red-500' : 'text-green-600'}`}>Outstanding</p>
                                    <p className={`text-lg font-mono font-black ${billStats.outstanding > 0 ? 'text-red-600' : 'text-green-700'}`}>
                                        RM {billStats.outstanding.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-gray-500">
                                <div className="flex items-start gap-3">
                                    <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                                    <span className="leading-relaxed">{selectedSupplier.address || 'No Address Recorded'}</span>
                                </div>
                                {selectedSupplier.bankAccount && (
                                    <div className="flex items-center gap-3 md:justify-end">
                                        <CreditCard size={16} className="text-gray-400 shrink-0" />
                                        <span className="font-mono tracking-wide text-gray-700 break-all">{selectedSupplier.bankAccount}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CONTENT TABS */}
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
                            <div className="flex border-b border-gray-100 bg-gray-50/50 p-2 gap-2">
                                <button onClick={() => setActiveDetailTab('CATALOG')} className={`flex-1 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeDetailTab === 'CATALOG' ? 'bg-white text-[#1A1A1A] shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}>
                                    <Package size={16}/> 产品目录 (Catalog)
                                </button>
                                <button onClick={() => setActiveDetailTab('BILLS')} className={`flex-1 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeDetailTab === 'BILLS' ? 'bg-white text-[#1A1A1A] shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}>
                                    <Receipt size={16}/> 账单记录 (History)
                                </button>
                            </div>

                            {activeDetailTab === 'CATALOG' && (
                                <div className="p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-black text-lg text-[#1A1A1A] flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] text-[#FFD700] flex items-center justify-center">
                                                <ShoppingBag size={16}/>
                                            </div>
                                            供应目录 (Catalog)
                                        </h3>
                                        <button onClick={handleAddProduct} className="group relative px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-xs font-bold shadow-lg overflow-hidden">
                                            <div className="absolute inset-0 w-full h-full bg-[#FFD700] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-out"></div>
                                            <span className="relative flex items-center gap-2 group-hover:text-black transition-colors">
                                                <Plus size={14}/> Add Item
                                            </span>
                                        </button>
                                    </div>
                                    
                                    {(!selectedSupplier.catalog || selectedSupplier.catalog.length === 0) ? (
                                        <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                                            <Package size={48} className="mx-auto text-gray-200 mb-2"/>
                                            <p className="text-gray-400 font-bold text-sm">目录为空 (Empty Catalog)</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {selectedSupplier.catalog.map(item => (
                                                <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-blue-400 hover:shadow-md transition-all group relative flex flex-col">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-[10px] font-mono font-bold">{item.supplierCode || 'NO CODE'}</div>
                                                        <button onClick={() => { setProductForm(item); setProductUoms(item.uomOptions || DEFAULT_UOMS); setIsEditingProduct(true); }} className="p-1.5 bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"><Edit3 size={12}/></button>
                                                    </div>
                                                    <h4 className="font-bold text-sm text-[#1A1A1A] mb-1 line-clamp-2 min-h-[2.5em]">{item.name}</h4>
                                                    <div className="flex items-end gap-1 mb-4">
                                                        <span className="text-lg font-black font-mono text-blue-900">RM {item.price.toFixed(2)}</span>
                                                        <span className="text-xs text-gray-400 font-bold mb-0.5">/ {item.unit}</span>
                                                    </div>
                                                    
                                                    <div className="mt-auto pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                                                        <button onClick={() => addToCart(item)} className="flex-grow bg-[#1A1A1A] text-white py-2 rounded-lg text-xs font-bold hover:bg-black active:scale-95 transition-transform flex items-center justify-center gap-1 shadow-sm">
                                                            <Plus size={12}/> Add 1 {item.unit}
                                                        </button>
                                                        {item.uomOptions?.filter(u => u.ratio > 1).map((uom, idx) => (
                                                            <button key={idx} onClick={() => addToCart(item, uom)} className="flex-grow bg-white border border-gray-200 text-gray-600 py-2 rounded-lg text-[10px] font-bold hover:bg-gray-50 active:scale-95 transition-transform">
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
                                <div className="p-0">
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex gap-4 text-xs font-bold text-gray-500">
                                        <div className="flex-1">Date / ID</div>
                                        <div className="flex-1 text-center">Status</div>
                                        <div className="flex-1 text-right">Amount</div>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {supplierExpenses.length === 0 ? <div className="p-12 text-center text-gray-400 text-sm">暂无记录</div> : supplierExpenses.map(bill => (
                                            <div key={bill.id} className="px-6 py-4 flex items-center hover:bg-gray-50 transition-colors">
                                                <div className="flex-1">
                                                    <div className="font-bold text-[#1A1A1A]">{bill.time.split('T')[0]}</div>
                                                    <div className="text-[10px] font-mono text-gray-400">#{bill.id.slice(-6)}</div>
                                                </div>
                                                <div className="flex-1 text-center">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${bill.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {bill.paymentStatus}
                                                    </span>
                                                </div>
                                                <div className="flex-1 text-right">
                                                    <div className="font-mono font-black text-sm">RM {bill.amount.toFixed(2)}</div>
                                                    {bill.outstandingAmount && bill.outstandingAmount > 0 && <div className="text-[10px] text-red-500 font-bold">Due: {bill.outstandingAmount.toFixed(2)}</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. PO LIST VIEW */}
                {mainTab === 'POS' && view === 'LIST' && (
                    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
                         <div className="flex items-center justify-between">
                             <h3 className="font-black text-xl text-[#1A1A1A] flex items-center gap-2"><ClipboardCheck size={24}/> 采购单管理</h3>
                             <div className="text-xs font-bold text-gray-400 bg-white px-3 py-1 rounded-full border shadow-sm">{purchaseOrders.length} Orders</div>
                         </div>

                         {purchaseOrders.length === 0 ? (
                             <div className="bg-white rounded-[2rem] p-12 text-center border border-gray-200">
                                 <FileText size={48} className="mx-auto text-gray-200 mb-4"/>
                                 <p className="font-bold text-gray-400">暂无采购单</p>
                                 <p className="text-xs text-gray-300 mt-1">请在供应商目录中添加商品并下单</p>
                             </div>
                         ) : (
                             <div className="grid grid-cols-1 gap-4">
                                 {purchaseOrders.map(po => (
                                     <div key={po.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                                         <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                             <div className="flex items-center gap-4">
                                                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs border ${po.status === 'RECEIVED' ? 'bg-green-50 text-green-700 border-green-200' : po.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                                     {po.status === 'RECEIVED' ? 'RCV' : po.status === 'CANCELLED' ? 'CNL' : 'ORD'}
                                                 </div>
                                                 <div>
                                                     <div className="flex items-center gap-2">
                                                         <span className="font-mono font-black text-lg text-blue-900">{po.id}</span>
                                                         <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{po.date.split('T')[0]}</span>
                                                     </div>
                                                     <div className="font-bold text-[#1A1A1A] text-sm flex items-center gap-1"><Truck size={12} className="text-gray-400"/> {po.supplierName}</div>
                                                 </div>
                                             </div>
                                             
                                             <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 border-gray-50 pt-3 md:pt-0">
                                                 <div className="text-right">
                                                     <p className="text-[10px] font-bold text-gray-400 uppercase">Est. Amount</p>
                                                     <p className="font-mono font-black text-lg">RM {po.totalEstimated.toFixed(2)}</p>
                                                 </div>
                                                 <div className="flex gap-2">
                                                     {po.status === 'ORDERED' && (
                                                         <button onClick={() => initiateReceivePO(po)} className="bg-[#1A1A1A] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
                                                             <ClipboardCheck size={14}/> 入库 (Receive)
                                                         </button>
                                                     )}
                                                     <button onClick={() => sendWhatsappPO(po)} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors"><Send size={18}/></button>
                                                     <button onClick={() => handleExportPO_PDF(po)} disabled={isGeneratingPdf && printingPO?.id === po.id} className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">
                                                         {isGeneratingPdf && printingPO?.id === po.id ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18}/>}
                                                     </button>
                                                     <button onClick={() => setDeletePOCandidate(po.id)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"><Trash2 size={18}/></button>
                                                 </div>
                                             </div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                    </div>
                )}
            </div>

            {/* SUPPLIER EDIT MODAL */}
            {isEditingSupplier && (
                <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-[#1A1A1A] flex items-center gap-2">
                                {supplierForm.id && suppliers.find(s => s.id === supplierForm.id) ? '编辑供应商' : '新增供应商'}
                            </h3>
                            <button onClick={() => setIsEditingSupplier(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                        </div>
                        
                        <div className="space-y-5">
                            <div><label className={LABEL_STYLE}>Company Name</label><input className={INPUT_STYLE} value={supplierForm.name || ''} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} placeholder="Supplier Name" /></div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={LABEL_STYLE}>Supplier ID</label><input className={`${INPUT_STYLE} font-mono bg-gray-100 text-gray-500`} value={supplierForm.id || ''} readOnly /></div>
                                <div>
                                    <label className={LABEL_STYLE}>Status</label>
                                    <select className={INPUT_STYLE} value={supplierForm.status || 'ACTIVE'} onChange={e => setSupplierForm({...supplierForm, status: e.target.value as any})}>
                                        <option value="ACTIVE">Active</option>
                                        <option value="INACTIVE">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {/* NEW: Favorites Toggle */}
                            <div className="flex items-center gap-3 bg-yellow-50 p-3 rounded-xl border border-yellow-200">
                                <button 
                                    onClick={() => setSupplierForm({...supplierForm, isFavorite: !supplierForm.isFavorite})}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${supplierForm.isFavorite ? 'bg-yellow-400 text-white shadow-md' : 'bg-white border border-yellow-300 text-gray-300'}`}
                                >
                                    <Star size={20} className={supplierForm.isFavorite ? "fill-white" : ""} />
                                </button>
                                <div>
                                    <p className="text-sm font-bold text-yellow-800">设为常用供应商 (Favorite)</p>
                                    <p className="text-[10px] text-yellow-600">将在列表中置顶显示</p>
                                </div>
                            </div>

                            {/* NEW: Rest Day Input */}
                            <div>
                                <label className={LABEL_STYLE}>休息日 / 公假备注 (Rest Days)</label>
                                <input 
                                    className={INPUT_STYLE} 
                                    value={supplierForm.restDayNote || ''} 
                                    onChange={e => setSupplierForm({...supplierForm, restDayNote: e.target.value})} 
                                    placeholder="e.g. Sunday, CNY Day 1-3" 
                                />
                                <p className="text-[9px] text-gray-400 mt-1 italic">备注特定休息日，如: "周日休息", "年初一至初三休息"</p>
                            </div>

                            {/* NEW: Category Selector - Synced with Accounts Payable */}
                            <div>
                                <label className={LABEL_STYLE}>Category (Main Type)</label>
                                <select 
                                    className={INPUT_STYLE} 
                                    value={supplierForm.category || 'SUPPLIER'} 
                                    onChange={e => setSupplierForm({...supplierForm, category: e.target.value})}
                                >
                                    <option value="SUPPLIER">一般供应商 (General)</option>
                                    {Object.entries(ACCOUNTING_CATEGORIES_OPTIONS).map(([group, options]) => (
                                        <optgroup key={group} label={group}>
                                            {options.map(opt => (
                                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={LABEL_STYLE}>Contact Person</label><input className={INPUT_STYLE} value={supplierForm.contactPerson || ''} onChange={e => setSupplierForm({...supplierForm, contactPerson: e.target.value})} placeholder="Name" /></div>
                                <div><label className={LABEL_STYLE}>Phone</label><input className={INPUT_STYLE} value={supplierForm.contact || ''} onChange={e => setSupplierForm({...supplierForm, contact: e.target.value})} placeholder="012..." /></div>
                            </div>

                            <div><label className={LABEL_STYLE}>Address</label><textarea className={`${INPUT_STYLE} h-20 resize-none`} value={supplierForm.address || ''} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})} placeholder="Full Address" /></div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={LABEL_STYLE}>Bank Info</label><input className={INPUT_STYLE} value={supplierForm.bankAccount || ''} onChange={e => setSupplierForm({...supplierForm, bankAccount: e.target.value})} placeholder="Bank & Acc No." /></div>
                                <div><label className={LABEL_STYLE}>Min Order (RM)</label><input type="number" className={INPUT_STYLE} value={supplierForm.minOrderValue || ''} onChange={e => setSupplierForm({...supplierForm, minOrderValue: parseFloat(e.target.value)})} placeholder="0.00" /></div>
                            </div>

                            {/* Tags */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className={LABEL_STYLE}>Tags (Additional Labels)</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {supplierForm.tags?.map(t => (
                                        <span key={t} className="bg-white px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 flex items-center gap-1 shadow-sm">
                                            #{t} <button onClick={() => setSupplierForm({...supplierForm, tags: supplierForm.tags?.filter(tag => tag !== t)})} className="hover:text-red-500"><X size={10}/></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input className="flex-1 p-2 text-xs border border-gray-200 rounded-lg outline-none" placeholder="New Tag..." value={newTagName} onChange={e => setNewTagName(e.target.value)} />
                                    <button onClick={handleAddCustomTag} className="px-3 py-1 bg-[#1A1A1A] text-white rounded-lg text-xs font-bold">Add</button>
                                </div>
                            </div>

                            <button onClick={handleSaveSupplier} disabled={isSyncingName} className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-lg shadow-lg hover:bg-black mt-2 transition-all active:scale-95 flex items-center justify-center gap-2">
                                {isSyncingName ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>} 保存供应商资料
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* PRODUCT EDIT MODAL */}
            {isEditingProduct && (
               <div className="fixed inset-0 bg-black/80 z-[160] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] p-6 shadow-2xl h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black flex items-center gap-2 text-[#1A1A1A]">{productForm.id ? '编辑物品' : '新增物品'}</h3>
                            <button onClick={() => setIsEditingProduct(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                        </div>

                        <div className="space-y-6">
                            {/* Inventory Link */}
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                <h4 className="text-xs font-black text-blue-700 uppercase mb-3 flex items-center gap-2"><LinkIcon size={14}/> 关联库存 (Sync Inventory)</h4>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-blue-400" size={16}/>
                                    <input type="text" placeholder="搜索库存物品..." value={stockSearchTerm} onChange={e => setStockSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border-2 border-blue-100 rounded-xl text-xs font-bold text-blue-900 outline-none focus:border-blue-400"/>
                                    {stockSearchTerm && (
                                        <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl border border-gray-100 mt-2 max-h-40 overflow-y-auto z-50">
                                            {allStockList.filter(s => s.name.toLowerCase().includes(stockSearchTerm.toLowerCase())).map(s => (
                                                <button key={s.id} onClick={() => { 
                                                    setProductForm(prev => ({ 
                                                        ...prev, 
                                                        linkedStockId: s.id, 
                                                        name: s.name, 
                                                        unit: s.unit,
                                                        price: s.cost,
                                                        category: s.category
                                                    })); 
                                                    setStockSearchTerm(''); 
                                                }} className="w-full text-left px-4 py-3 hover:bg-blue-50 flex justify-between text-xs border-b border-gray-50">
                                                    <span className="font-bold">{s.name}</span><span className="text-gray-400 bg-gray-100 px-1 rounded">{s.id}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {productForm.linkedStockId && (
                                    <div className="mt-3 flex items-center gap-2 bg-white p-2 rounded-xl border border-blue-200 shadow-sm">
                                        <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg"><Box size={14}/></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] text-gray-400 font-bold uppercase">Linked To</div>
                                            <div className="text-xs font-black text-blue-900 truncate">{allStockList.find(s => s.id === productForm.linkedStockId)?.name || productForm.linkedStockId}</div>
                                        </div>
                                        <button onClick={() => setProductForm({...productForm, linkedStockId: undefined})} className="text-red-400 p-1"><X size={14}/></button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div><label className={LABEL_STYLE}>Item Name</label><input type="text" value={productForm.name || ''} onChange={e => setProductForm({...productForm, name: e.target.value})} className={INPUT_STYLE} placeholder="e.g. Pork Belly"/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className={LABEL_STYLE}>Supplier Code</label><input type="text" value={productForm.supplierCode || ''} onChange={e => setProductForm({...productForm, supplierCode: e.target.value})} className={INPUT_STYLE} placeholder="Optional"/></div>
                                    <div><label className={LABEL_STYLE}>Base Unit</label><input type="text" value={productForm.unit || ''} onChange={e => setProductForm({...productForm, unit: e.target.value})} className={INPUT_STYLE} placeholder="e.g. PKT"/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className={LABEL_STYLE}>Price (RM)</label><input type="number" value={productForm.price || ''} onChange={e => setProductForm({...productForm, price: parseFloat(e.target.value)})} className={INPUT_STYLE} placeholder="0.00"/></div>
                                    <div>
                                        <label className={LABEL_STYLE}>Category</label>
                                        <select className={INPUT_STYLE} value={productForm.category || ''} onChange={e => setProductForm({...productForm, category: e.target.value})}>
                                            <option value="">Select...</option>
                                            {INVENTORY_CATEGORIES.map(grp => (<optgroup key={grp.label} label={grp.label}>{grp.options.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</optgroup>))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Smart Units */}
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-xs font-black text-gray-700 uppercase flex items-center gap-2"><Calculator size={14}/> 多单位 (Smart Unit)</h4>
                                    <button onClick={addUomOption} className="text-[10px] bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 font-bold">+ Add</button>
                                </div>
                                <div className="space-y-3">
                                    {productUoms?.map((opt, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
                                            <input className="w-20 p-2 text-xs border rounded-lg font-bold bg-gray-50 outline-none" placeholder="Name" value={opt.value} onChange={e => updateUomOption(idx, 'value', e.target.value)} />
                                            <span className="text-xs font-bold">=</span>
                                            <input type="number" className="w-16 p-2 text-xs border rounded-lg font-bold bg-gray-50 outline-none text-center" value={opt.ratio} onChange={e => updateUomOption(idx, 'ratio', parseFloat(e.target.value))} />
                                            <span className="text-xs text-gray-400">{productForm.unit || 'Base'}</span>
                                            <button onClick={() => removeUomOption(idx)} className="ml-auto text-red-400 p-1"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100">
                            <button onClick={() => setIsEditingProduct(false)} className="flex-1 py-3 bg-white border border-gray-200 font-bold rounded-xl text-xs">取消</button>
                            <button onClick={handleSaveProduct} className="flex-[2] py-3 bg-[#1A1A1A] text-[#FFD700] font-bold rounded-xl shadow-lg text-xs flex items-center justify-center gap-2"><Save size={14}/> 保存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* BILL FORM MODAL */}
            {isBillFormOpen && (
                <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-[#1A1A1A]">录入新账单</h3>
                            <button onClick={() => setIsBillFormOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className={LABEL_STYLE}>Amount (RM)</label><input type="number" className={INPUT_STYLE} value={newBill.totalBillAmount || ''} onChange={e => setNewBill({...newBill, totalBillAmount: parseFloat(e.target.value)})} placeholder="0.00" /></div>
                            <div><label className={LABEL_STYLE}>Date</label><input type="date" className={INPUT_STYLE} value={newBill.time?.split('T')[0]} onChange={e => setNewBill({...newBill, time: e.target.value})} /></div>
                            <div>
                                <label className={LABEL_STYLE}>Status</label>
                                <select className={INPUT_STYLE} value={newBill.paymentStatus} onChange={e => setNewBill({...newBill, paymentStatus: e.target.value as any})}>
                                    <option value="UNPAID">UNPAID</option>
                                    <option value="PAID">PAID</option>
                                </select>
                            </div>
                            <div><label className={LABEL_STYLE}>Note</label><input className={INPUT_STYLE} value={newBill.note || ''} onChange={e => setNewBill({...newBill, note: e.target.value})} placeholder="Optional..." /></div>
                            <button onClick={handleSaveBill} className="w-full py-3 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-bold shadow-lg hover:bg-black mt-4">确认录入 (Confirm)</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATIONS */}
            {deleteProductCandidate && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center border-t-4 border-red-500 shadow-2xl"><h4 className="text-xl font-black text-[#1A1A1A] mb-2">确认删除?</h4><p className="text-sm font-bold text-gray-500 mb-6">此操作无法撤销。</p><div className="grid grid-cols-2 gap-3"><button onClick={() => setDeleteProductCandidate(null)} className="py-3 bg-gray-100 font-bold rounded-xl text-xs">取消</button><button onClick={executeDeleteProduct} className="py-3 bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg">删除</button></div></div></div>
            )}

            {deletePOCandidate && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center border-t-4 border-red-500 shadow-2xl">
                        <h4 className="text-xl font-black text-[#1A1A1A] mb-2">确认删除采购单?</h4>
                        <p className="text-sm font-bold text-gray-500 mb-6">
                            此操作无法撤销。
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setDeletePOCandidate(null)} className="py-3 bg-gray-100 font-bold rounded-xl text-xs hover:bg-gray-200">取消</button>
                            <button onClick={executeDeletePO} className="py-3 bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg hover:bg-red-700">确认删除</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteSupplierId && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center border-t-4 border-red-500 shadow-2xl">
                        <h4 className="text-xl font-black text-[#1A1A1A] mb-2">确认删除供应商?</h4>
                        <p className="text-sm font-bold text-gray-500 mb-6">
                            此操作将删除该供应商及其所有关联产品目录。
                            <br/>此操作无法撤销。
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setDeleteSupplierId(null)} className="py-3 bg-gray-100 font-bold rounded-xl text-xs hover:bg-gray-200">取消</button>
                            <button onClick={executeDeleteSupplier} className="py-3 bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg hover:bg-red-700">确认删除</button>
                        </div>
                    </div>
                </div>
            )}

            {/* HIDDEN PRINT */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                {printingPO && (() => {
                     const pages = [];
                     for (let i = 0; i < Math.ceil(printingPO.items.length / ITEMS_PER_PAGE); i++) {
                         pages.push(printingPO.items.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE));
                     }
                     return pages.map((pageItems, pageIndex) => (
                         <div key={pageIndex} ref={pageIndex === 0 ? printRef : undefined} id={`po-page-${pageIndex}`} className="w-[794px] bg-white p-12 text-black font-sans relative min-h-[1123px] flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6"><div><h1 className="text-4xl font-black tracking-widest mb-2">PURCHASE ORDER</h1><p className="text-sm font-bold text-gray-500">KIM LIAN KEE (KEPONG)</p></div><div className="text-right"><p className="text-xl font-mono font-black">{printingPO?.id}</p><p className="text-sm font-bold text-gray-500">{printingPO?.date.split('T')[0]}</p></div></div>
                                <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200"><p className="text-xs font-bold text-gray-400 uppercase mb-1">To Supplier:</p><h2 className="text-xl font-bold">{printingPO?.supplierName}</h2></div>
                                <table className="w-full text-left mb-8"><thead><tr className="border-b-2 border-black"><th className="py-2 text-xs font-black uppercase">Item Name</th><th className="py-2 text-xs font-black uppercase text-center">Qty</th><th className="py-2 text-xs font-black uppercase text-center">Unit</th></tr></thead><tbody>{pageItems.map((item, i) => (<tr key={i} className="border-b border-gray-100 break-inside-avoid"><td className="py-3 text-sm font-bold">{item.name}{item.supplierCode && <span className="text-xs text-gray-400 block">{item.supplierCode}</span>}</td><td className="py-3 text-sm font-mono text-center">{item.orderQty}</td><td className="py-3 text-sm font-mono text-center uppercase">{item.unit}</td></tr>))}</tbody></table>
                            </div>
                            <div className="mt-8">
                                {pageIndex === pages.length - 1 && <div className="pt-8 border-t border-black text-center text-xs font-bold text-gray-400">Authorized Signature</div>}
                                <div className="text-right text-xs text-gray-400 mt-4">Page {pageIndex + 1} of {pages.length}</div>
                            </div>
                         </div>
                     ));
                })()}
            </div>
        </div>
    );

    if (isModal) {
        return (
            <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-0 md:p-6 backdrop-blur-sm animate-in zoom-in duration-200">
                {MainContent}
            </div>
        );
    }

    return MainContent;
};
