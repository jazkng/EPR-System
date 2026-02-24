
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ShoppingCart, Package, Truck, AlertTriangle, Plus, FileText, Send, Printer, CheckCircle2, X, RefreshCw, ChevronRight, Search, ClipboardCheck, ArrowDownToLine, Loader2, Info, ChevronDown, Filter, Utensils, Coffee, Box, Wrench, Minus, ChevronUp, History, Clock, Zap, Trash2, Fish, Beef, Wheat, Carrot, Soup, PaintBucket, Users, ArrowLeft, Percent, Bus, Scale, Calculator } from 'lucide-react';
import { StockItem, Supplier, PurchaseOrder, PurchaseOrderItem, ExpenseItem, CatalogItem, UomOption } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { ModuleGuideButton } from '../ui/ModuleGuide';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

interface ProcurementModuleProps {
    onClose?: () => void;
}

// --- CONFIGURATION ---
const MAIN_CATEGORIES = [
    { id: 'ALL', label: '全部 (All)', icon: Filter, color: 'bg-gray-100 text-gray-600' },
    { id: 'KITCHEN', label: '厨房 (Kitchen)', icon: Utensils, color: 'bg-orange-100 text-orange-700' },
    { id: 'BAR', label: '水吧 (Bar)', icon: Coffee, color: 'bg-blue-100 text-blue-700' },
    { id: 'GENERAL', label: '后勤 (General)', icon: Wrench, color: 'bg-gray-100 text-gray-700' },
    { id: 'PACKAGING', label: '打包 (Pack)', icon: Package, color: 'bg-yellow-100 text-yellow-700' },
];

const KITCHEN_SUB_CATEGORIES = [
    { id: 'ALL', label: '全部 All' },
    { id: 'MEAT', label: '肉类 Meat' },
    { id: 'SEAFOOD', label: '海鲜 Seafood' },
    { id: 'VEG', label: '蔬果 Veg' },
    { id: 'NOODLE', label: '面类 Noodle' },
    { id: 'DRY', label: '干货 Dry' },
    { id: 'SAUCE', label: '酱料 Sauce' },
    { id: 'HQ', label: '总店 HQ' },
];

// UPDATED: Reduced items per page to allow for larger fonts
const ITEMS_PER_PAGE = 14;

// --- INTERFACES ---
interface OrderDraftItem {
    stockId: string;
    qty: number;
    unit: string;
    price: number; // Unit Cost
    ratio: number;
}

interface ReceivedItem extends PurchaseOrderItem {
    receivedQty: number;
    finalCost: number;
    // New fields for Catch Weight (Bill by Weight)
    billByWeight?: boolean;
    receivedWeight?: number; // Total KG for billing
}

export const ProcurementModule: React.FC<ProcurementModuleProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'REPLENISH' | 'ORDERS'>('REPLENISH');
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filtering State
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [activeSubCategory, setActiveSubCategory] = useState<string>('ALL');
    const [filterLowStock, setFilterLowStock] = useState(false); 
    const [searchTerm, setSearchTerm] = useState('');
    
    // NEW: Supplier Filter State
    const [activeSupplierFilter, setActiveSupplierFilter] = useState<string | null>(null);
    const [supplierMenuSearch, setSupplierMenuSearch] = useState('');

    // Replenish State (Drafts)
    const [orderDrafts, setOrderDrafts] = useState<Record<string, OrderDraftItem>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [showCartDetail, setShowCartDetail] = useState(false);
    
    // Smart Fill Modal State
    const [isSmartFillMenuOpen, setIsSmartFillMenuOpen] = useState(false);

    // Receiving State
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
    const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
    const [receiveTax, setReceiveTax] = useState<number>(0);
    const [receiveDelivery, setReceiveDelivery] = useState<number>(0);
    const [isProcessingReceive, setIsProcessingReceive] = useState(false);

    // PDF State
    const [printingPO, setPrintingPO] = useState<PurchaseOrder | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Delete State
    const [deletePOCandidate, setDeletePOCandidate] = useState<string | null>(null);

    // Pagination State
    const [visibleOrderCount, setVisibleOrderCount] = useState(15);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [k, b, g, sup, pos] = await Promise.all([
                DataManager.getStock('KITCHEN'),
                DataManager.getStock('BAR'),
                DataManager.getStock('GENERAL'),
                DataManager.getSuppliers(),
                DataManager.getPurchaseOrders()
            ]);
            
            // Sort: Low stock ratio first
            const allStock = [...k, ...b, ...g].sort((a,b) => {
                const ratioA = a.currentQty / (a.minLevel || 1);
                const ratioB = b.currentQty / (b.minLevel || 1);
                return ratioA - ratioB;
            });

            setStockItems(allStock);
            setSuppliers(sup);
            setPurchaseOrders(pos.sort((a,b) => b.id.localeCompare(a.id)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- HELPER: FIND SUPPLIER ---
    const findSupplierForStock = (stockId: string) => {
        for (const sup of suppliers) {
            if (sup.catalog) {
                const match = sup.catalog.find(c => c.linkedStockId === stockId);
                if (match) return { supplier: sup, catalogItem: match };
            }
        }
        return null;
    };

    // --- CALCULATE SUPPLIER LOW STOCK COUNTS ---
    const supplierLowStockCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        suppliers.forEach(s => counts[s.id] = 0);
        
        stockItems.forEach(item => {
            if (item.currentQty <= item.minLevel) {
                const match = findSupplierForStock(item.id);
                if (match) {
                    counts[match.supplier.id] = (counts[match.supplier.id] || 0) + 1;
                }
            }
        });
        return counts;
    }, [stockItems, suppliers]);

    // --- MENU SUPPLIER LIST (Filtered) ---
    const menuSuppliers = useMemo(() => {
        return suppliers.filter(s => {
            // 1. Must be synchronized (have linked items)
            const isSynced = s.catalog?.some(c => c.linkedStockId);
            if (!isSynced) return false;

            // 2. Search Filter
            if (!supplierMenuSearch) return true;
            const term = supplierMenuSearch.toLowerCase();
            return s.name.toLowerCase().includes(term) || s.id.toLowerCase().includes(term);
        });
    }, [suppliers, supplierMenuSearch]);

    // --- FILTER LOGIC ---
    const filteredStock = useMemo(() => {
        let list = stockItems;

        // 0. Supplier Filter (Highest Priority)
        if (activeSupplierFilter) {
            list = list.filter(i => {
                const match = findSupplierForStock(i.id);
                return match && match.supplier.id === activeSupplierFilter;
            });
        } else {
            // 1. Main Category Filter (Only if no supplier filter)
            if (activeCategory === 'KITCHEN') {
                list = list.filter(i => i.id.startsWith('K') || ['MEAT','SEAFOOD','VEG','NOODLE','DRY','SAUCE','HQ','FRESH'].includes(i.category));
                if (activeSubCategory !== 'ALL') {
                    list = list.filter(i => i.category === activeSubCategory);
                }
            } else if (activeCategory === 'BAR') {
                list = list.filter(i => i.id.startsWith('B') || ['TEA','FRUIT','RTD','MISC','DRINK'].includes(i.category));
            } else if (activeCategory === 'GENERAL') {
                list = list.filter(i => (i.id.startsWith('S') || i.id.startsWith('G')) && i.category !== 'PACKAGING');
            } else if (activeCategory === 'PACKAGING') {
                list = list.filter(i => i.category === 'PACKAGING');
            }
        }

        // 2. Low Stock Filter
        if (filterLowStock) {
            list = list.filter(i => i.currentQty <= i.minLevel);
        }

        // 3. Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(i => i.name.toLowerCase().includes(lower) || i.id.toLowerCase().includes(lower));
        }
        return list;
    }, [stockItems, activeCategory, activeSubCategory, filterLowStock, searchTerm, activeSupplierFilter]);

    // --- DRAFT HANDLERS ---
    const updateDraft = (stockId: string, field: keyof OrderDraftItem, value: any, baseItem: StockItem) => {
        setOrderDrafts(prev => {
            const current = prev[stockId] || { stockId, qty: 0, unit: baseItem.unit, price: baseItem.cost, ratio: 1 };
            const updated = { ...current, [field]: value };

            // Logic: Unit Change triggers Price & Ratio update
            if (field === 'unit') {
                const selectedUom = baseItem.uomOptions?.find(u => u.value === value);
                if (selectedUom) {
                    updated.ratio = selectedUom.ratio;
                    updated.price = selectedUom.price || (baseItem.cost * selectedUom.ratio);
                } else {
                    updated.ratio = 1;
                    updated.price = baseItem.cost;
                }
            }

            // Ensure Qty not negative
            if (field === 'qty' && value < 0) updated.qty = 0;

            return { ...prev, [stockId]: updated };
        });
    };

    const handleQuickAdd = (item: StockItem, delta: number) => {
        const currentQty = orderDrafts[item.id]?.qty || 0;
        const newQty = Math.max(0, currentQty + delta);
        updateDraft(item.id, 'qty', newQty, item);
    };

    // --- SMART FILL V2: Granular Auto-fill (Updated to include Supplier logic) ---
    const executeSmartFill = (type: 'CATEGORY' | 'SUPPLIER', targetId: string, subTarget?: string) => {
        let targetItems = [];

        // STRATEGY 1: BY CATEGORY
        if (type === 'CATEGORY') {
            setActiveSupplierFilter(null); // Clear supplier filter
            if (targetId === 'ALL') {
                targetItems = stockItems;
            } else if (targetId === 'KITCHEN') {
                targetItems = stockItems.filter(i => i.id.startsWith('K') || ['MEAT','SEAFOOD','VEG','NOODLE','DRY','SAUCE','HQ','FRESH'].includes(i.category));
                if (subTarget) targetItems = targetItems.filter(i => i.category === subTarget);
            } else if (targetId === 'BAR') {
                targetItems = stockItems.filter(i => i.id.startsWith('B') || ['TEA','FRUIT','RTD','MISC','DRINK'].includes(i.category));
            } else if (targetId === 'GENERAL') {
                targetItems = stockItems.filter(i => i.id.startsWith('S') || i.id.startsWith('G') || i.category === 'PACKAGING');
            }
        } 
        // STRATEGY 2: BY SUPPLIER
        else if (type === 'SUPPLIER') {
            const supplier = suppliers.find(s => s.id === targetId);
            if (!supplier) return;
            
            // Find all items linked to this supplier
            targetItems = stockItems.filter(i => {
                const match = findSupplierForStock(i.id);
                return match && match.supplier.id === targetId;
            });
        }

        // Filter ONLY Low Stock items to auto-add
        const lowItems = targetItems.filter(i => i.currentQty <= i.minLevel);

        if (lowItems.length === 0) {
            setIsSmartFillMenuOpen(false);
            // Non-blocking info
            alert(`✅ ${type === 'SUPPLIER' ? '该供应商' : '该区域'} 暂无缺货商品。\n(No low stock items found)`);
            
            // Still switch view to help user manual add
            if (type === 'SUPPLIER') {
                setFilterLowStock(false);
                setActiveSupplierFilter(targetId);
                setSearchTerm('');
            }
            return;
        }
        
        const newDrafts = { ...orderDrafts };
        let addedCount = 0;

        lowItems.forEach(item => {
            const targetQty = item.maxQty > 0 ? (item.maxQty - item.currentQty) : (item.minLevel - item.currentQty + 2);
            const fillQty = Math.max(1, Math.ceil(targetQty));
            
            if (!newDrafts[item.id] || newDrafts[item.id].qty === 0) {
                newDrafts[item.id] = {
                    stockId: item.id,
                    qty: fillQty,
                    unit: item.unit,
                    price: item.cost, // Use base cost
                    ratio: 1
                };
                addedCount++;
            }
        });

        setOrderDrafts(newDrafts);
        setIsSmartFillMenuOpen(false);

        // View Adjustment Logic
        if (type === 'CATEGORY') {
            setFilterLowStock(true); // Auto enable "Low Stock Only" for categories
            if (targetId !== 'ALL') {
                setActiveCategory(targetId);
                if (subTarget && targetId === 'KITCHEN') setActiveSubCategory(subTarget);
            }
        } else if (type === 'SUPPLIER') {
            setFilterLowStock(false); // Disable "Low Stock Only" so user sees ALL items from this supplier
            setActiveSupplierFilter(targetId); // Enter Supplier View Mode
            setSearchTerm('');
        }

        const targetName = type === 'SUPPLIER' 
            ? suppliers.find(s => s.id === targetId)?.name 
            : `${targetId} ${subTarget ? `(${subTarget})` : ''}`;

        alert(`⚡️ 已为 [${targetName}] 自动添加 ${addedCount} 个缺货物品！`);
    };

    // --- GENERATE POs (REFACTORED FOR ROBUSTNESS) ---
    const handleGeneratePOs = async () => {
        const entries = (Object.values(orderDrafts) as OrderDraftItem[]).filter(draft => draft.qty > 0);
        if (entries.length === 0) return alert("请先选择商品 (Please select items)");

        setIsGenerating(true);
        
        // Use a Map to hold grouped orders to prevent lookup errors later
        // Map<SupplierID, { supplier: Supplier, items: POItem[] }>
        const supplierGroups = new Map<string, { supplier: Supplier, items: PurchaseOrderItem[] }>();
        const adhocItems: PurchaseOrderItem[] = [];
        
        // 1. Group items
        for (const draft of entries) {
            const match = findSupplierForStock(draft.stockId);
            const stockItem = stockItems.find(s => s.id === draft.stockId);
            
            if (match) {
                const { supplier, catalogItem } = match;
                
                if (!supplierGroups.has(supplier.id)) {
                    supplierGroups.set(supplier.id, { supplier, items: [] });
                }
                
                supplierGroups.get(supplier.id)!.items.push({
                    stockId: catalogItem.id, // Use Supplier Catalog ID for PO
                    name: catalogItem.name,
                    orderQty: draft.qty,
                    unit: draft.unit,
                    ratio: draft.ratio || 1, // Ensure ratio is defined
                    cost: draft.price || 0, // Ensure cost is defined
                    supplierCode: catalogItem.supplierCode || '' // FIX: Ensure not undefined
                });
            } else {
                // UNLINKED ITEMS -> Group into "ADHOC"
                adhocItems.push({
                    stockId: draft.stockId, // Use direct Inventory ID for adhoc
                    name: stockItem?.name || draft.stockId,
                    orderQty: draft.qty,
                    unit: draft.unit,
                    ratio: draft.ratio || 1,
                    cost: draft.price || 0,
                    supplierCode: 'N/A'
                });
            }
        }

        if (supplierGroups.size === 0 && adhocItems.length === 0) {
            setIsGenerating(false);
            return;
        }

        // 2. Refresh PO list to avoid ID clash
        const latestPOs = await DataManager.getPurchaseOrders();
        
        // Generate PO ID Logic
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

        let currentSuffix = maxSuffix + 1;
        const newPOs: PurchaseOrder[] = [];

        // GET CREATOR NAME FROM LOCALSTORAGE
        const savedSession = localStorage.getItem('kepong_erp_session_employee');
        const currentCreator = savedSession ? JSON.parse(savedSession).name : 'Admin';

        // 3. Create Supplier POs (Using direct object reference from Map)
        for (const { supplier, items } of supplierGroups.values()) {
            const nextId = `${todayPrefix}${String(currentSuffix).padStart(3, '0')}`;
            const total = items.reduce((sum, i) => sum + (i.orderQty * i.cost), 0);

            const newPO: PurchaseOrder = {
                id: nextId,
                supplierId: supplier.id,
                supplierName: supplier.name,
                date: now.toISOString(),
                status: 'ORDERED',
                items: items,
                totalEstimated: total,
                createdBy: currentCreator // Added field
            };
            
            // Serialize to remove any lingering undefineds (deep sanitization)
            const cleanPO = JSON.parse(JSON.stringify(newPO));

            await DataManager.savePurchaseOrder(cleanPO);
            newPOs.push(cleanPO);
            currentSuffix++;
        }

        // 4. Create Adhoc PO
        if (adhocItems.length > 0) {
            const nextId = `${todayPrefix}${String(currentSuffix).padStart(3, '0')}`;
            const total = adhocItems.reduce((sum, i) => sum + (i.orderQty * i.cost), 0);

            const newPO: PurchaseOrder = {
                id: nextId,
                supplierId: 'ADHOC_MARKET',
                supplierName: '通用采购 / 自购 (General Market)',
                date: now.toISOString(),
                status: 'ORDERED',
                items: adhocItems,
                totalEstimated: total,
                createdBy: currentCreator // Added field
            };
            
            const cleanPO = JSON.parse(JSON.stringify(newPO));

            await DataManager.savePurchaseOrder(cleanPO);
            newPOs.push(cleanPO);
            currentSuffix++;
        }

        setPurchaseOrders([...newPOs, ...latestPOs]); // Update local state with new + refreshed
        setOrderDrafts({});
        setIsGenerating(false);
        setActiveTab('ORDERS');
        setVisibleOrderCount(15); // Reset pagination for new view
        setActiveSupplierFilter(null); // Reset filters
        setFilterLowStock(false);
        alert(`✅ 成功生成 ${newPOs.length} 张采购单！`);
    };

    // --- SHARED ACTIONS ---
    const sendWhatsapp = (po: PurchaseOrder) => {
        const supplier = suppliers.find(s => s.id === po.supplierId);
        if (!supplier || !supplier.contact) return alert("供应商无电话号码 (或为自购单)");
        const phone = supplier.contact.replace(/\D/g, '');
        let text = `*PURCHASE ORDER: ${po.id}*\nTo: ${po.supplierName}\nDate: ${po.date.split('T')[0]}\n\n*ITEMS:*\n`;
        po.items.forEach((item, i) => { text += `${i+1}. ${item.name} ${item.supplierCode ? `[${item.supplierCode}]` : ''}\n   Qty: ${item.orderQty} ${item.unit}\n`; });
        text += `\nPlease confirm delivery. Thank you!\n- Kim Lian Kee`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    };

    // --- MULTI-PAGE PDF GENERATION (FIXED) ---
    const handlePrintPDF = async (po: PurchaseOrder) => {
        setPrintingPO(po);
        setIsGeneratingPdf(true);
        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 800));

        const pdf = new jsPDF('p', 'mm', 'a4');
        const totalPages = Math.ceil(po.items.length / ITEMS_PER_PAGE);

        try {
            for (let i = 0; i < totalPages; i++) {
                const element = document.getElementById(`po-page-${i}`);
                if (!element) continue;

                if (i > 0) pdf.addPage();
                
                const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794 });
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }
            pdf.save(`PO_${po.id}.pdf`);
        } catch (err) {
            console.error(err);
            alert("PDF Generation Error");
        } finally {
            setIsGeneratingPdf(false);
            setPrintingPO(null);
        }
    };

    const executeDeletePO = async () => {
        if (!deletePOCandidate) return;
        try {
            await DataManager.deletePurchaseOrder(deletePOCandidate);
            setPurchaseOrders(prev => prev.filter(p => p.id !== deletePOCandidate));
            alert("✅ 采购单已删除");
        } catch (e) {
            console.error(e);
            alert("删除失败");
        } finally {
            setDeletePOCandidate(null);
        }
    };

    const initiateReceive = (po: PurchaseOrder) => {
        setReceivingPO(po);
        setReceivedItems(po.items.map(i => ({ 
            ...i, 
            receivedQty: i.orderQty, 
            finalCost: i.cost,
            billByWeight: false, // Default off
            receivedWeight: 0 // Default 0
        })));
        setReceiveTax(0); // Reset
        setReceiveDelivery(0); // Reset
        setIsReceiveModalOpen(true);
    };

    const confirmReceive = async () => {
        if (!receivingPO) return;
        setIsProcessingReceive(true);
        try {
            // NEW CALCULATION LOGIC FOR CATCH WEIGHT
            const itemsTotal = receivedItems.reduce((sum: number, item) => {
                if (item.billByWeight && item.receivedWeight) {
                    return sum + (item.receivedWeight * item.finalCost); // Price is per KG
                } else {
                    return sum + (item.receivedQty * item.finalCost); // Price is per Unit
                }
            }, 0);

            const finalTotal = itemsTotal + (receiveTax || 0) + (receiveDelivery || 0);
            
            // Try find supplier for Category, if ADHOC use default
            const supplier = suppliers.find(s => s.id === receivingPO.supplierId);
            const billCategory = supplier?.category || 'SUPPLIER';
            
            const stockUpdates = new Map<string, { qtyDelta: number, newCost: number }>();
            
            receivedItems.forEach((item) => {
                let inventoryId: string | null = null;
                let ratio = item.ratio || 1;

                // 1. Try finding via Supplier Catalog (Standard Path)
                if (supplier && supplier.catalog) {
                    const catalogItem = supplier.catalog.find(c => c.id === item.stockId);
                    if (catalogItem && catalogItem.linkedStockId) {
                        inventoryId = catalogItem.linkedStockId;
                    }
                }

                // 2. If not found (Adhoc / Unlinked), try direct match in Stock
                if (!inventoryId) {
                    const directStock = stockItems.find(s => s.id === item.stockId);
                    if (directStock) {
                        inventoryId = directStock.id;
                    }
                }

                // 3. Apply Update
                if (inventoryId) {
                    const baseQtyDelta = item.receivedQty * ratio;
                    
                    // COST RECALCULATION:
                    // If Bill by Weight, calculate effective cost per unit
                    let baseUnitCost = 0;
                    if (item.billByWeight && item.receivedWeight && item.receivedQty > 0) {
                        const totalLineCost = item.receivedWeight * item.finalCost;
                        baseUnitCost = (totalLineCost / item.receivedQty) / ratio;
                    } else {
                        baseUnitCost = item.finalCost / ratio; 
                    }
                    
                    const existing = stockUpdates.get(inventoryId) || { qtyDelta: 0, newCost: 0 };
                    stockUpdates.set(inventoryId, { qtyDelta: existing.qtyDelta + baseQtyDelta, newCost: baseUnitCost });
                }
            });

            const updatedStockList = stockItems.map(stockItem => {
                const update = stockUpdates.get(stockItem.id);
                if (update) {
                    // Update Qty and Cost (Moving Average could be better but sticking to latest for simplicity)
                    return { ...stockItem, currentQty: (stockItem.currentQty || 0) + update.qtyDelta, cost: update.newCost };
                }
                return stockItem;
            });

            // Categorize for batch update
            const kItems = updatedStockList.filter(i => i.id.startsWith('K') || ['FRESH','MEAT','SEAFOOD','VEG','NOODLE','DRY','SAUCE','HQ'].includes(i.category));
            const bItems = updatedStockList.filter(i => i.id.startsWith('B') || ['TEA','FRUIT','RTD','MISC','DRINK'].includes(i.category));
            const gItems = updatedStockList.filter(i => i.id.startsWith('S') || i.id.startsWith('G') || ['PACKAGING','CLEANING','TOOLS','WASTE','GENERAL'].includes(i.category));

            await Promise.all([
                DataManager.batchUpdateStock('KITCHEN', kItems),
                DataManager.batchUpdateStock('BAR', bItems),
                DataManager.batchUpdateStock('GENERAL', gItems)
            ]);

            const updatedPO = { ...receivingPO, status: 'RECEIVED' as const };
            await DataManager.savePurchaseOrder(updatedPO);

            // Generate AP Bill
            const noteParts = [`PO: ${receivingPO.id} (Received)`];
            if (receiveTax > 0) noteParts.push(`Tax: ${receiveTax.toFixed(2)}`);
            if (receiveDelivery > 0) noteParts.push(`Del: ${receiveDelivery.toFixed(2)}`);

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
                note: noteParts.join(' | '),
                paymentMethod: 'BANK_TRANSFER',
                paidBy: 'COMPANY'
            };
            await DataManager.saveStandaloneExpense(newBill);

            alert("✅ 入库成功！库存已更新 (按实收)，成本已更新 (按重量计价)。");
            setIsReceiveModalOpen(false);
            setReceivingPO(null);
            loadData(); 
        } catch (error) {
            console.error("Receive Error", error);
            alert("入库失败，请重试");
        } finally {
            setIsProcessingReceive(false);
        }
    };

    const updateReceivedItem = (idx: number, field: keyof ReceivedItem, value: any) => {
        setReceivedItems(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [field]: value };
            return updated;
        });
    };

    // --- CART TOTALS ---
    const cartItemsList = (Object.values(orderDrafts) as OrderDraftItem[]).filter(d => d.qty > 0);
    const cartTotalCount = cartItemsList.length;
    const cartTotalVal = cartItemsList.reduce((sum: number, d) => sum + (d.qty * d.price), 0);

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-[#F5F7FA] w-full h-full md:max-w-7xl md:h-[95vh] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl relative font-sans">
                
                {/* === HEADER === */}
                <div className="bg-[#1A1A1A] p-4 flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700] shadow-md z-20">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#FFD700] text-black p-2.5 rounded-2xl shadow-lg"><ShoppingCart size={24}/></div>
                        <div>
                            <h3 className="font-serif font-black text-xl tracking-wide">智能采购</h3>
                            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">PROCUREMENT</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <ModuleGuideButton module="SUPPLIER" />
                        {onClose && <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>}
                    </div>
                </div>

                {/* === TAB SWITCHER (TOP) === */}
                <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-3 shrink-0 z-10 shadow-sm">
                    <button onClick={() => setActiveTab('REPLENISH')} className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${activeTab === 'REPLENISH' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        <RefreshCw size={16}/> 智能补货 (Replenish)
                    </button>
                    <button onClick={() => { setActiveTab('ORDERS'); setVisibleOrderCount(15); }} className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${activeTab === 'ORDERS' ? 'bg-[#1A1A1A] text-[#FFD700] shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        <History size={16}/> 采购记录 (Orders)
                    </button>
                </div>

                {/* === MAIN CONTENT === */}
                <div className="flex-grow overflow-hidden flex flex-col relative">
                    {loading ? (
                        <div className="flex items-center justify-center h-full"><Loader2 size={40} className="animate-spin text-gray-400"/></div>
                    ) : (
                        <>
                            {/* --- TAB 1: REPLENISH --- */}
                            {activeTab === 'REPLENISH' && (
                                <div className="flex flex-col h-full relative">
                                    
                                    {/* CATEGORY & SEARCH BAR (STICKY) */}
                                    <div className="bg-white p-3 border-b border-gray-200 flex flex-col gap-3 shadow-sm z-10">
                                        
                                        {/* Main Categories OR Active Supplier Banner */}
                                        {activeSupplierFilter ? (
                                            <div className="flex items-center gap-3 p-2 bg-indigo-50 border border-indigo-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                                                <button onClick={() => { setActiveSupplierFilter(null); setFilterLowStock(false); setActiveCategory('ALL'); }} className="p-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm"><ArrowLeft size={16}/></button>
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">Current Filter</p>
                                                    <p className="text-sm font-black text-indigo-900 flex items-center gap-2"><Truck size={14}/> {suppliers.find(s => s.id === activeSupplierFilter)?.name || 'Unknown Supplier'}</p>
                                                </div>
                                                <button onClick={() => { setActiveSupplierFilter(null); setFilterLowStock(false); setActiveCategory('ALL'); }} className="px-3 py-1.5 bg-indigo-200 text-indigo-800 text-xs font-bold rounded-lg hover:bg-indigo-300">Clear</button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                                                {MAIN_CATEGORIES.map(cat => (
                                                    <button 
                                                        key={cat.id} 
                                                        onClick={() => { setActiveCategory(cat.id); setActiveSubCategory('ALL'); }} 
                                                        className={`px-4 py-3 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-2 transition-all shadow-sm ${activeCategory === cat.id ? 'bg-[#1A1A1A] text-[#FFD700] ring-2 ring-[#FFD700] ring-offset-1' : `${cat.color} hover:bg-opacity-80`}`}
                                                    >
                                                        <cat.icon size={14}/> {cat.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Sub Categories (Kitchen Only) - Hide if supplier filtered */}
                                        {activeCategory === 'KITCHEN' && !activeSupplierFilter && (
                                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 animate-in slide-in-from-left duration-300">
                                                {KITCHEN_SUB_CATEGORIES.map(sub => (
                                                    <button 
                                                        key={sub.id}
                                                        onClick={() => setActiveSubCategory(sub.id)}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all ${activeSubCategory === sub.id ? 'bg-orange-100 border-orange-300 text-orange-800 shadow-inner' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                                    >
                                                        {sub.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Search & Smart Fill Controls */}
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex-grow">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                                <input type="text" placeholder="搜索物品..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#1A1A1A] transition-all"/>
                                            </div>
                                            <button 
                                                onClick={() => setFilterLowStock(!filterLowStock)} 
                                                className={`px-3 py-2.5 rounded-xl border flex items-center gap-2 text-[10px] font-black transition-all ${filterLowStock ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-400'}`}
                                            >
                                                <AlertTriangle size={14}/> 仅看缺货
                                            </button>
                                            
                                            {/* SMART FILL BUTTON & POPUP */}
                                            <div className="relative">
                                                <button 
                                                    onClick={() => setIsSmartFillMenuOpen(!isSmartFillMenuOpen)}
                                                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm active:scale-95 whitespace-nowrap"
                                                >
                                                    <Zap size={14} fill="currentColor"/> 智能补货 (Auto)
                                                </button>

                                                {/* Smart Fill Dropdown Menu */}
                                                {isSmartFillMenuOpen && (
                                                    <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50 animate-in slide-in-from-top-2 origin-top-right overflow-hidden flex flex-col max-h-[80vh]">
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase px-3 py-2 shrink-0">按区域补货 (By Category)</div>
                                                        
                                                        <div className="shrink-0">
                                                            <button onClick={() => executeSmartFill('CATEGORY', 'ALL')} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-xl text-xs font-bold flex items-center gap-2 mb-1">
                                                                <div className="bg-[#1A1A1A] text-[#FFD700] p-1.5 rounded"><Zap size={12}/></div>
                                                                全店补货 (All Low Stock)
                                                            </button>
                                                            
                                                            <div className="grid grid-cols-2 gap-1 mb-2">
                                                                <button onClick={() => executeSmartFill('CATEGORY', 'KITCHEN')} className="text-left px-3 py-2 hover:bg-orange-50 text-orange-700 rounded-xl text-[10px] font-bold flex items-center gap-1 col-span-2">
                                                                    <Utensils size={12}/> 整个厨房 (All Kitchen)
                                                                </button>
                                                                {/* Sub Kitchen Items */}
                                                                <button onClick={() => executeSmartFill('CATEGORY', 'KITCHEN', 'MEAT')} className="text-left px-3 py-2 hover:bg-red-50 text-red-700 rounded-xl text-[10px] font-bold flex items-center gap-1"><Beef size={12}/> 肉类</button>
                                                                <button onClick={() => executeSmartFill('CATEGORY', 'KITCHEN', 'SEAFOOD')} className="text-left px-3 py-2 hover:bg-blue-50 text-blue-700 rounded-xl text-[10px] font-bold flex items-center gap-1"><Fish size={12}/> 海鲜</button>
                                                                <button onClick={() => executeSmartFill('CATEGORY', 'KITCHEN', 'VEG')} className="text-left px-3 py-2 hover:bg-green-50 text-green-700 rounded-xl text-[10px] font-bold flex items-center gap-1"><Carrot size={12}/> 蔬果</button>
                                                                <button onClick={() => executeSmartFill('CATEGORY', 'KITCHEN', 'DRY')} className="text-left px-3 py-2 hover:bg-yellow-50 text-yellow-700 rounded-xl text-[10px] font-bold flex items-center gap-1"><Wheat size={12}/> 干货</button>
                                                            </div>

                                                            <button onClick={() => executeSmartFill('CATEGORY', 'BAR')} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-800 rounded-xl text-[10px] font-bold flex items-center gap-2 mb-1">
                                                                <Coffee size={12}/> 水吧 (Bar)
                                                            </button>
                                                            <button onClick={() => executeSmartFill('CATEGORY', 'GENERAL')} className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-700 rounded-xl text-[10px] font-bold flex items-center gap-2 mb-2">
                                                                <Wrench size={12}/> 后勤/打包 (General)
                                                            </button>
                                                        </div>

                                                        <div className="h-px bg-gray-100 my-1 shrink-0"></div>
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase px-3 py-2 shrink-0">按供应商补货 (By Supplier)</div>
                                                        
                                                        {/* Search Supplier Input */}
                                                        <div className="px-3 pb-2 shrink-0">
                                                            <div className="relative">
                                                                <Search size={12} className="absolute left-2.5 top-2 text-gray-400"/>
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Search ID / Name..." 
                                                                    value={supplierMenuSearch}
                                                                    onChange={e => setSupplierMenuSearch(e.target.value)}
                                                                    className="w-full pl-7 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 text-gray-700"
                                                                    onClick={e => e.stopPropagation()}
                                                                    autoFocus
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="overflow-y-auto pr-1 flex-grow max-h-48">
                                                            {menuSuppliers.map(s => {
                                                                const count = supplierLowStockCounts[s.id] || 0;
                                                                return (
                                                                    <button 
                                                                        key={s.id}
                                                                        onClick={() => executeSmartFill('SUPPLIER', s.id)}
                                                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-indigo-900 rounded-xl text-[10px] font-bold flex justify-between items-center transition-colors"
                                                                    >
                                                                        <div className="flex flex-col truncate flex-1 mr-2">
                                                                            <span className="flex items-center gap-2 truncate"><Truck size={12}/> {s.name}</span>
                                                                            <span className="text-[9px] text-gray-400 font-mono ml-5">ID: {s.id}</span>
                                                                        </div>
                                                                        {count > 0 && <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full text-[9px] border border-red-100 whitespace-nowrap">{count} 缺货</span>}
                                                                    </button>
                                                                );
                                                            })}
                                                            {menuSuppliers.length === 0 && (
                                                                <div className="px-3 py-4 text-[10px] text-gray-400 italic text-center">
                                                                    {supplierMenuSearch ? '未找到匹配供应商' : '暂无已关联供应商'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Backdrop to close menu */}
                                                {isSmartFillMenuOpen && (
                                                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSmartFillMenuOpen(false)}></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ITEM GRID */}
                                    <div className="flex-grow overflow-y-auto p-4 bg-[#F5F7FA] pb-40">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {filteredStock.map(item => {
                                                const match = findSupplierForStock(item.id);
                                                const isLow = item.currentQty <= item.minLevel;
                                                const draft = orderDrafts[item.id] || { stockId: item.id, qty: 0, unit: item.unit, price: item.cost, ratio: 1 };
                                                const unitOptions = [{ label: item.unit, value: item.unit, ratio: 1 }, ...(item.uomOptions || [])];
                                                const hasDraft = draft.qty > 0;
                                                
                                                // Dynamic max ensures slider never gets stuck if user wants more
                                                const sliderMax = Math.max(item.maxQty || 30, (draft.qty || 0) + 5);

                                                return (
                                                    <div key={item.id} className={`bg-white p-4 rounded-2xl shadow-sm border-2 transition-all flex flex-col justify-between relative group ${hasDraft ? 'border-[#1A1A1A] ring-1 ring-[#1A1A1A]' : isLow ? 'border-red-100' : 'border-transparent hover:border-gray-200'}`}>
                                                        {/* Status Badge */}
                                                        <div className="absolute top-4 right-4 flex flex-col items-end">
                                                            <div className={`text-xs font-black px-2 py-1 rounded-lg mb-1 ${isLow ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                                                Qty: {item.currentQty}
                                                            </div>
                                                            <div className="text-[9px] text-gray-400 font-bold">Min: {item.minLevel}</div>
                                                        </div>

                                                        {/* Item Info */}
                                                        <div className="mb-4 pr-16">
                                                            <h4 className="font-black text-sm text-[#1A1A1A] line-clamp-2 leading-tight mb-1">{item.name}</h4>
                                                            <div className="flex flex-wrap gap-1">
                                                                <span className="text-[9px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-bold">{item.id}</span>
                                                                {match ? 
                                                                    <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Truck size={10}/> {match.supplier.name.slice(0, 10)}...</span> : 
                                                                    <span className="text-[9px] font-bold bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded">No Supplier</span>
                                                                }
                                                            </div>
                                                        </div>

                                                        {/* Controls - REDESIGNED */}
                                                        <div className="mt-auto pt-2">
                                                            {/* Top Row: Unit Selector & Price */}
                                                            <div className="flex justify-between items-center mb-2 px-1">
                                                                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1">
                                                                     <span className="text-[10px] font-bold text-gray-400 uppercase">UNIT</span>
                                                                     <select 
                                                                        value={draft.unit} 
                                                                        onChange={e => updateDraft(item.id, 'unit', e.target.value, item)} 
                                                                        className="bg-transparent text-xs font-black text-[#1A1A1A] outline-none cursor-pointer appearance-none pr-1"
                                                                     >
                                                                         {unitOptions.map((u, idx) => (
                                                                             <option key={idx} value={u.value}>{u.value}</option>
                                                                         ))}
                                                                     </select>
                                                                </div>
                                                                <div className="text-[10px] font-mono text-gray-400">
                                                                     RM {draft.price.toFixed(2)}
                                                                </div>
                                                            </div>

                                                            {/* Stepper Control - Slider Based */}
                                                            <div className="flex items-center gap-2 mt-3 select-none">
                                                                <button onClick={() => handleQuickAdd(item, -1)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-90 flex items-center justify-center transition-all shrink-0">
                                                                    <Minus size={16} strokeWidth={2.5}/>
                                                                </button>
                                                                
                                                                <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1 border border-gray-100">
                                                                    <span className="font-black text-base text-[#1A1A1A] w-6 text-center">{draft.qty || 0}</span>
                                                                    <input 
                                                                        type="range" 
                                                                        min="0" 
                                                                        max={sliderMax}
                                                                        value={draft.qty || 0} 
                                                                        onChange={(e) => updateDraft(item.id, 'qty', parseInt(e.target.value), item)}
                                                                        className="flex-grow h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1A1A1A]"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-gray-400 w-5 text-right">{item.maxQty || 30}</span>
                                                                </div>

                                                                <button onClick={() => handleQuickAdd(item, 1)} className="w-8 h-8 rounded-full bg-[#1A1A1A] text-[#FFD700] hover:bg-black active:scale-90 flex items-center justify-center transition-all shadow-md shrink-0">
                                                                    <Plus size={16} strokeWidth={2.5}/>
                                                                </button>
                                                            </div>
                                                            
                                                            {/* Target Label - Simplified */}
                                                            <div className="text-center mt-1">
                                                                <span className="text-[9px] font-bold text-gray-400">
                                                                    目标库存 (Target): {item.maxQty || 30}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {filteredStock.length === 0 && (
                                                <div className="col-span-full py-20 text-center text-gray-400 font-bold flex flex-col items-center">
                                                    <Package size={48} className="mb-2 opacity-20"/>
                                                    没有符合条件的物品
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* FLOATING CART BAR */}
                                    {cartTotalCount > 0 && (
                                        <div className="absolute bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[600px] z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                                            <div className="bg-[#1A1A1A] rounded-2xl shadow-2xl p-4 flex items-center justify-between border border-[#FFD700]/30 relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FFD700] to-transparent"></div>
                                                
                                                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setShowCartDetail(!showCartDetail)}>
                                                    <div className="relative">
                                                        <div className="bg-[#FFD700] text-black w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-lg">
                                                            {cartTotalCount}
                                                        </div>
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Estimated Cost</p>
                                                        <p className="text-xl font-mono font-black text-white">RM {cartTotalVal.toFixed(2)}</p>
                                                    </div>
                                                    <div className="ml-2 text-gray-500">
                                                        {showCartDetail ? <ChevronDown size={20}/> : <ChevronUp size={20}/>}
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={handleGeneratePOs} 
                                                    disabled={isGenerating}
                                                    className="bg-[#FFD700] hover:bg-white text-black px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95"
                                                >
                                                    {isGenerating ? <Loader2 size={18} className="animate-spin"/> : <FileText size={18}/>}
                                                    <span className="hidden sm:inline">生成采购单</span>
                                                    <span className="sm:hidden">下单</span>
                                                </button>
                                            </div>

                                            {/* Cart Details Dropdown */}
                                            {showCartDetail && (
                                                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden max-h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-5">
                                                    <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                                        <h4 className="font-black text-sm text-[#1A1A1A]">已选物品 (Selected Items)</h4>
                                                        <button onClick={() => setOrderDrafts({})} className="text-xs text-red-500 font-bold hover:underline flex items-center gap-1"><Trash2 size={12}/> 清空 (Clear All)</button>
                                                    </div>
                                                    <div className="p-2 space-y-1">
                                                        {(Object.entries(orderDrafts) as [string, OrderDraftItem][])
                                                            .filter(([_, d]) => d.qty > 0)
                                                            .map(([id, d]) => {
                                                            const item = stockItems.find(s => s.id === id);
                                                            return (
                                                                <div key={id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors border-b border-gray-50 last:border-0">
                                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                                        <div className="font-bold text-sm text-[#1A1A1A] truncate max-w-[150px]">{item?.name}</div>
                                                                        <div className="text-xs text-gray-400 font-mono">x{d.qty} {d.unit}</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="font-mono font-bold text-sm text-[#1A1A1A]">RM {(d.qty * d.price).toFixed(2)}</div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: ORDERS (Same Logic, updated UI) */}
                            {activeTab === 'ORDERS' && (
                                <div className="flex-grow overflow-y-auto p-4 md:p-6 pb-32">
                                    <div className="max-w-4xl mx-auto space-y-4">
                                        {purchaseOrders.length === 0 ? (
                                            <div className="bg-white rounded-[2rem] p-12 text-center border border-gray-200 shadow-sm flex flex-col items-center">
                                                <Package size={64} className="text-gray-200 mb-4"/>
                                                <p className="font-black text-gray-400 text-lg">暂无采购记录</p>
                                                <button onClick={() => setActiveTab('REPLENISH')} className="mt-4 px-6 py-2 bg-gray-100 rounded-full text-xs font-bold text-gray-500 hover:bg-gray-200">去补货</button>
                                            </div>
                                        ) : (
                                            <>
                                                {purchaseOrders.slice(0, visibleOrderCount).map(po => (
                                                    <div key={po.id} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all group relative">
                                                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xs border-2 shadow-sm ${po.status === 'RECEIVED' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-yellow-50 border-yellow-100 text-yellow-600'}`}>
                                                                    {po.status === 'RECEIVED' ? <CheckCircle2 size={24}/> : <Clock size={24}/>}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono font-black text-lg text-[#1A1A1A] tracking-tight">{po.id}</span>
                                                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{po.date.split('T')[0]}</span>
                                                                    </div>
                                                                    <div className="font-bold text-gray-500 text-sm flex items-center gap-1 mt-0.5"><Truck size={14}/> {po.supplierName}</div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-3 justify-end mt-2 md:mt-0">
                                                                {po.status === 'ORDERED' && (
                                                                    <button onClick={() => initiateReceive(po)} className="bg-[#1A1A1A] text-[#FFD700] px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg hover:bg-black transition-all active:scale-95 flex items-center gap-2">
                                                                        <ClipboardCheck size={16}/> 收货入库 (Receive)
                                                                    </button>
                                                                )}
                                                                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                                                                    <button onClick={() => sendWhatsapp(po)} className="p-2.5 bg-white text-green-600 rounded-lg hover:bg-green-50 shadow-sm transition-colors border border-gray-200"><Send size={18}/></button>
                                                                    <button onClick={() => handlePrintPDF(po)} className="p-2.5 bg-white text-blue-600 rounded-lg hover:bg-blue-50 shadow-sm transition-colors border border-gray-200">
                                                                        {isGeneratingPdf && printingPO?.id === po.id ? <Loader2 size={18} className="animate-spin"/> : <Printer size={18}/>}
                                                                    </button>
                                                                    <button onClick={() => setDeletePOCandidate(po.id)} className="p-2.5 bg-white text-red-600 rounded-lg hover:bg-red-50 shadow-sm transition-colors border border-gray-200"><Trash2 size={18}/></button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Items Preview (Collapsible or just summary) */}
                                                        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-4 overflow-x-auto scrollbar-hide">
                                                            {po.items.map((item, idx) => (
                                                                <div key={idx} className="flex-shrink-0 bg-gray-50 px-3 py-2 rounded-lg text-xs border border-gray-100">
                                                                    <span className="font-bold text-[#1A1A1A]">{item.name}</span> <span className="text-gray-500">x{item.orderQty}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Load More Button */}
                                                {visibleOrderCount < purchaseOrders.length && (
                                                    <button 
                                                        onClick={() => setVisibleOrderCount(prev => prev + 15)}
                                                        className="w-full py-4 bg-white border border-gray-200 rounded-2xl text-gray-500 font-bold text-xs hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm mt-4 active:scale-95"
                                                    >
                                                        <ChevronDown size={16} /> 加载更多 (Load More) - 还有 {purchaseOrders.length - visibleOrderCount} 条
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* RECEIVE MODAL (UNCHANGED LOGIC, STYLED) */}
                {isReceiveModalOpen && receivingPO && (
                    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="font-black text-xl text-[#1A1A1A] flex items-center gap-2"><ArrowDownToLine className="text-blue-600"/> 收货点算 (Check-in)</h3>
                                    <p className="text-xs text-gray-500 font-bold mt-1 font-mono">PO: {receivingPO.id}</p>
                                </div>
                                <button onClick={() => setIsReceiveModalOpen(false)} className="p-2 bg-white shadow-sm rounded-full hover:bg-gray-100"><X size={20}/></button>
                            </div>

                            <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-[#F9FAFB]">
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start text-xs text-blue-800 font-bold">
                                    <Info size={16} className="shrink-0 mt-0.5"/>
                                    <p>请核对实收数量。确认入库后，系统将自动增加库存并生成应付账款 (AP) 记录。</p>
                                </div>

                                <div className="space-y-3">
                                    {receivedItems.map((item, idx) => {
                                        const isShort = item.receivedQty < item.orderQty;
                                        
                                        // Calculate Unit Price Display for Catch Weight items
                                        const displayUnitCost = item.billByWeight && item.receivedWeight && item.receivedQty > 0
                                            ? ((item.receivedWeight * item.finalCost) / item.receivedQty).toFixed(2)
                                            : item.finalCost.toFixed(2);

                                        return (
                                            <div key={idx} className={`bg-white border-2 rounded-2xl p-4 flex flex-col justify-between shadow-sm gap-4 ${isShort ? 'border-red-100 bg-red-50/30' : 'border-gray-100'}`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="font-black text-sm text-[#1A1A1A] mb-1 flex items-center gap-2">
                                                            {item.name}
                                                            {/* CATCH WEIGHT TOGGLE */}
                                                            <button 
                                                                onClick={() => {
                                                                    const updated = [...receivedItems];
                                                                    updated[idx].billByWeight = !updated[idx].billByWeight;
                                                                    setReceivedItems(updated);
                                                                }}
                                                                className={`text-[9px] px-2 py-0.5 rounded border transition-all flex items-center gap-1 ${item.billByWeight ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                                                            >
                                                                <Scale size={10}/> 按重量 (By Weight)
                                                            </button>
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded w-fit">Ordered: {item.orderQty} {item.unit}</div>
                                                        {item.billByWeight && item.receivedWeight && (
                                                            <div className="mt-1 text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded w-fit flex items-center gap-1">
                                                                <Calculator size={10}/> Avg Cost: RM {displayUnitCost} / {item.unit}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex gap-2 items-end flex-wrap">
                                                    <div>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">实收 ({item.unit})</label>
                                                        <div className="flex items-center">
                                                            <button onClick={() => {
                                                                const newVal = Math.max(0, item.receivedQty - 1);
                                                                setReceivedItems(prev => { const n = [...prev]; n[idx].receivedQty = newVal; return n; });
                                                            }} className="w-8 h-10 bg-gray-100 rounded-l-lg border border-r-0 border-gray-300 flex items-center justify-center font-bold hover:bg-gray-200">-</button>
                                                            <input 
                                                                type="number" 
                                                                value={item.receivedQty} 
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    setReceivedItems(prev => { const n = [...prev]; n[idx].receivedQty = val; return n; });
                                                                }}
                                                                className={`w-14 h-10 border-y border-gray-300 text-center font-black outline-none ${isShort ? 'text-red-600 bg-red-50' : 'bg-white'}`}
                                                            />
                                                            <button onClick={() => {
                                                                const newVal = item.receivedQty + 1;
                                                                setReceivedItems(prev => { const n = [...prev]; n[idx].receivedQty = newVal; return n; });
                                                            }} className="w-8 h-10 bg-gray-100 rounded-r-lg border border-l-0 border-gray-300 flex items-center justify-center font-bold hover:bg-gray-200">+</button>
                                                        </div>
                                                    </div>

                                                    {/* WEIGHT INPUT IF ACTIVE */}
                                                    {item.billByWeight && (
                                                        <div className="animate-in fade-in slide-in-from-left-2">
                                                            <label className="text-[9px] font-bold text-orange-500 uppercase mb-1 block">计费重量 (KG)</label>
                                                            <input 
                                                                type="number" 
                                                                value={item.receivedWeight || ''}
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    setReceivedItems(prev => { const n = [...prev]; n[idx].receivedWeight = val; return n; });
                                                                }}
                                                                className="w-20 h-10 px-2 bg-orange-50 border border-orange-200 text-orange-800 rounded-lg text-center font-bold outline-none focus:border-orange-400"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">
                                                            单价 (RM/{item.billByWeight ? 'KG' : item.unit})
                                                        </label>
                                                        <input 
                                                            type="number" 
                                                            value={item.finalCost} 
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                setReceivedItems(prev => { const n = [...prev]; n[idx].finalCost = val; return n; });
                                                            }}
                                                            className="w-20 h-10 px-2 bg-white border border-gray-300 rounded-lg text-center font-bold outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-white">
                                {/* Extra Charges Input */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block flex items-center gap-1"><Percent size={10}/> Tax (SST)</label>
                                        <input 
                                            type="number" 
                                            value={receiveTax || ''} 
                                            onChange={e => setReceiveTax(parseFloat(e.target.value) || 0)}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none text-right"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block flex items-center gap-1"><Bus size={10}/> Transport</label>
                                        <input 
                                            type="number" 
                                            value={receiveDelivery || ''} 
                                            onChange={e => setReceiveDelivery(parseFloat(e.target.value) || 0)}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none text-right"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mb-4 px-2 pt-2 border-t border-dashed border-gray-200">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Payable</span>
                                    <span className="text-3xl font-black font-mono text-[#1A1A1A]">
                                        RM {(receivedItems.reduce((sum, i) => {
                                            if (i.billByWeight && i.receivedWeight) {
                                                return sum + (i.receivedWeight * i.finalCost);
                                            }
                                            return sum + (i.receivedQty * i.finalCost);
                                        }, 0) + (receiveTax || 0) + (receiveDelivery || 0)).toFixed(2)}
                                    </span>
                                </div>
                                <button onClick={confirmReceive} disabled={isProcessingReceive} className="w-full py-4 bg-[#1A1A1A] text-[#FFD700] rounded-xl font-black text-lg shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95">
                                    {isProcessingReceive ? <Loader2 size={24} className="animate-spin"/> : <CheckCircle2 size={24}/>} 确认入库 (Confirm)
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* DELETE PO CONFIRMATION MODAL */}
                {deletePOCandidate && (
                    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center border-t-4 border-red-500 animate-in zoom-in-95">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <Trash2 size={32} className="text-red-600"/>
                            </div>
                            <h4 className="text-xl font-black text-[#1A1A1A] mb-2">确认删除采购单?</h4>
                            <p className="text-sm font-bold text-gray-500 mb-6">
                                PO ID: <span className="font-mono text-black">{deletePOCandidate}</span>
                                <br/>此操作无法撤销。
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setDeletePOCandidate(null)} className="py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-200">取消</button>
                                <button onClick={executeDeletePO} className="hidden"></button> {/* Dummy for linter, logic moved to executeDeletePO */}
                                <button onClick={async () => {
                                    if (!deletePOCandidate) return;
                                    try {
                                        await DataManager.deletePurchaseOrder(deletePOCandidate);
                                        setPurchaseOrders(prev => prev.filter(p => p.id !== deletePOCandidate));
                                        alert("✅ 采购单已删除");
                                    } catch (e) {
                                        console.error(e);
                                        alert("删除失败");
                                    } finally {
                                        setDeletePOCandidate(null);
                                    }
                                }} className="py-3 bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg hover:bg-red-700">确认删除</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* HIDDEN PRINT */}
                <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                    {printingPO && (() => {
                         const itemsPerPage = ITEMS_PER_PAGE;
                         const pages = [];
                         for (let i = 0; i < Math.ceil(printingPO.items.length / itemsPerPage); i++) {
                             pages.push(printingPO.items.slice(i * itemsPerPage, (i + 1) * itemsPerPage));
                         }
                         return pages.map((pageItems, pageIndex) => (
                             <div key={pageIndex} id={`po-page-${pageIndex}`} className="w-[794px] min-h-[1123px] bg-white p-10 text-black font-sans relative flex flex-col justify-between">
                                 <div>
                                    <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-8">
                                        <div>
                                            <h1 className="text-5xl font-black tracking-widest mb-2">PURCHASE ORDER</h1>
                                            <p className="text-lg font-bold text-gray-500">KIM LIAN KEE (KEPONG)</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-3xl font-mono font-black">{printingPO?.id}</p>
                                            <p className="text-lg font-bold text-gray-500">{printingPO?.date.split('T')[0]}</p>
                                            {printingPO?.createdBy && <p className="text-sm font-bold text-gray-400 mt-1">Ordered By: {printingPO.createdBy}</p>}
                                        </div>
                                    </div>
                                    <div className="mb-8 p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
                                        <p className="text-sm font-bold text-gray-400 uppercase mb-1">To Supplier:</p>
                                        <h2 className="text-3xl font-bold">{printingPO?.supplierName}</h2>
                                    </div>
                                    <table className="w-full text-left mb-8">
                                        <thead>
                                            <tr className="border-b-4 border-black">
                                                <th className="py-3 text-sm font-black uppercase">Item Name</th>
                                                <th className="py-3 text-sm font-black uppercase text-center">Qty</th>
                                                <th className="py-3 text-sm font-black uppercase text-center">Unit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageItems.map((item, i) => (
                                                <tr key={i} className="border-b-2 border-gray-100">
                                                    <td className="py-4 text-lg font-bold leading-tight">
                                                        {item.name}
                                                        {item.supplierCode && <span className="text-sm text-gray-400 block font-normal">{item.supplierCode}</span>}
                                                    </td>
                                                    <td className="py-4 text-lg font-mono text-center font-bold">{item.orderQty}</td>
                                                    <td className="py-4 text-lg font-mono text-center uppercase text-gray-600">{item.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                 </div>
                                 <div className="mt-12">
                                    {pageIndex === pages.length - 1 && <div className="mt-4 pt-8 border-t-2 border-black text-center text-sm font-bold text-gray-400 uppercase tracking-widest">Authorized Signature</div>}
                                    <div className="text-right text-xs text-gray-400 mt-4">Page {pageIndex + 1} of {pages.length}</div>
                                 </div>
                             </div>
                         ));
                    })()}
                </div>

            </div>
        </div>
    );
};
