
import React, { useState, useEffect, useMemo } from 'react';
import { 
    TrendingUp, TrendingDown, Search, X, 
    ArrowUp, ArrowDown, CheckCircle2, Info, History,
    DollarSign, Truck, Calendar
} from 'lucide-react';
import { StockItem, InventoryLog } from '../../types';
import { DataManager } from '../../utils/dataManager';

interface PriceMonitorModuleProps {
    onClose: () => void;
}

interface PriceChangeItem {
    id: string;
    name: string;
    category: string;
    unit: string;
    currentCost: number;
    lastCost: number;
    diff: number;
    percent: number;
    lastDate: string;
    supplierName: string; // Added Supplier Name
    status: 'UP' | 'DOWN' | 'SAME';
}

const CATEGORY_LABELS: Record<string, string> = {
    'FRESH': '生鲜', 'MEAT': '肉类', 'SEAFOOD': '海鲜', 'VEG': '蔬果',
    'NOODLE': '面食', 'SAUCE': '酱料', 'DRY': '干货', 'HQ': '总店',
    'TEA': '茶叶', 'FRUIT': '水果', 'RTD': '罐装', 'GENERAL': '杂项'
};

export const PriceMonitorModule: React.FC<PriceMonitorModuleProps> = ({ onClose }) => {
    const [loading, setLoading] = useState(true);
    const [analysisData, setAnalysisData] = useState<PriceChangeItem[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadAndAnalyze();
    }, []);

    const loadAndAnalyze = async () => {
        setLoading(true);
        try {
            // 1. Fetch Data (Including Suppliers)
            const [kStock, bStock, gStock, logs, suppliers] = await Promise.all([
                DataManager.getStock('KITCHEN'),
                DataManager.getStock('BAR'),
                DataManager.getStock('GENERAL'),
                DataManager.getInventoryLogs(),
                DataManager.getSuppliers()
            ]);
            
            const allStock = [...kStock, ...bStock, ...gStock];
            
            // 2. Sort logs descending by date to get latest snapshot
            const sortedLogs = logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const results: PriceChangeItem[] = [];

            // 3. Analyze each stock item
            allStock.forEach(item => {
                // Find the LATEST log entry that contains this item
                let lastRecordCost = item.cost; 
                let lastRecordDate = 'N/A';

                for (const log of sortedLogs) {
                    const match = log.items.find(i => i.stockId === item.id);
                    if (match) {
                        // Found the last recorded instance
                        lastRecordCost = match.cost;
                        lastRecordDate = log.date;
                        break; // Stop after finding the most recent one
                    }
                }

                // Find Supplier
                const supplier = suppliers.find(s => s.catalog?.some(c => c.linkedStockId === item.id));
                const supplierName = supplier ? supplier.name : 'Unknown Supplier';

                const diff = item.cost - lastRecordCost;
                const percent = lastRecordCost > 0 ? (diff / lastRecordCost) * 100 : 0;
                
                let status: 'UP' | 'DOWN' | 'SAME' = 'SAME';
                if (diff > 0.001) status = 'UP';
                else if (diff < -0.001) status = 'DOWN';

                // Only add if there is a difference (or if we want to show all, but logic here focuses on changes)
                if (status !== 'SAME') {
                    results.push({
                        id: item.id,
                        name: item.name,
                        category: item.category,
                        unit: item.unit,
                        currentCost: item.cost,
                        lastCost: lastRecordCost,
                        diff,
                        percent,
                        lastDate: lastRecordDate,
                        supplierName,
                        status
                    });
                }
            });

            // Sort by absolute change magnitude
            setAnalysisData(results.sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff)));

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredList = analysisData.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              item.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
        if (filter === 'ALL') return matchesSearch;
        return matchesSearch && item.status === filter;
    });

    const stats = useMemo(() => {
        const up = analysisData.filter(i => i.status === 'UP');
        const down = analysisData.filter(i => i.status === 'DOWN');
        return {
            upCount: up.length,
            downCount: down.length,
        };
    }, [analysisData]);

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-[#F5F7FA] w-full h-full md:max-w-4xl md:h-[90vh] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl relative font-sans">
                
                {/* Header */}
                <div className="bg-[#1A1A1A] px-5 pb-5 pt-[max(env(safe-area-inset-top),1.25rem)] flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700]">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#FFD700] text-black p-3 rounded-2xl shadow-lg"><TrendingUp size={24}/></div>
                        <div>
                            <h3 className="font-serif font-black text-xl tracking-wide">库存成本监控</h3>
                            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">COST FLUCTUATION MONITOR</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-4 md:p-6 pb-32">
                    
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div onClick={() => setFilter('UP')} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${filter === 'UP' ? 'bg-red-50 border-red-300 ring-2 ring-red-200' : 'bg-white border-transparent hover:border-red-200 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-red-100 text-red-600 rounded-xl"><ArrowUp size={20}/></div>
                                <span className="text-2xl font-black text-red-700">{stats.upCount}</span>
                            </div>
                            <p className="text-xs font-bold text-gray-500 uppercase">Items Price Up (涨价)</p>
                        </div>
                        <div onClick={() => setFilter('DOWN')} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${filter === 'DOWN' ? 'bg-green-50 border-green-300 ring-2 ring-green-200' : 'bg-white border-transparent hover:border-green-200 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-green-100 text-green-600 rounded-xl"><ArrowDown size={20}/></div>
                                <span className="text-2xl font-black text-green-700">{stats.downCount}</span>
                            </div>
                            <p className="text-xs font-bold text-gray-500 uppercase">Items Price Down (降价)</p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6 sticky top-0 bg-[#F5F7FA] z-10 py-2">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Search Item / Supplier..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFD700]"
                            />
                        </div>
                        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                            <button onClick={() => setFilter('ALL')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'ALL' ? 'bg-[#1A1A1A] text-[#FFD700]' : 'text-gray-400 hover:bg-gray-50'}`}>All</button>
                            <button onClick={() => setFilter('UP')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${filter === 'UP' ? 'bg-red-500 text-white' : 'text-gray-400 hover:bg-gray-50'}`}><ArrowUp size={12}/> Price Up</button>
                            <button onClick={() => setFilter('DOWN')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${filter === 'DOWN' ? 'bg-green-500 text-white' : 'text-gray-400 hover:bg-gray-50'}`}><ArrowDown size={12}/> Price Down</button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        {loading ? (
                            <div className="py-20 text-center text-gray-400 italic">Analyzing historical logs...</div>
                        ) : filteredList.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center">
                                <div className="bg-white p-4 rounded-full shadow-sm mb-4"><CheckCircle2 size={32} className="text-green-500"/></div>
                                <p className="text-gray-400 font-bold text-sm">暂无价格波动 (No Price Changes Detected)</p>
                                <p className="text-xs text-gray-300 mt-1">Compared to last inventory log snapshot</p>
                            </div>
                        ) : (
                            filteredList.map(item => (
                                <div key={item.id} className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 md:gap-4 hover:shadow-md transition-shadow">
                                    {/* Icon */}
                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-black text-xs border shrink-0 ${item.status === 'UP' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                        {item.status === 'UP' ? <TrendingUp size={18}/> : <TrendingDown size={18}/>}
                                    </div>

                                    {/* Middle Content - Fluid width */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                                            <h4 className="font-black text-[#1A1A1A] text-sm truncate">{item.name}</h4>
                                            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase whitespace-nowrap">{CATEGORY_LABELS[item.category] || item.category}</span>
                                        </div>

                                        {/* Date and Supplier Info */}
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-gray-400 mb-1">
                                            <span className="flex items-center gap-1 font-bold bg-gray-50 px-1.5 py-0.5 rounded truncate max-w-[100px] md:max-w-[150px]" title={item.supplierName}>
                                                <Truck size={10}/> {item.supplierName}
                                            </span>
                                            <span className="flex items-center gap-1 font-mono whitespace-nowrap">
                                                <Calendar size={10}/> {item.lastDate}
                                            </span>
                                        </div>

                                        {/* Price Comparison */}
                                        <div className="flex items-center gap-2 md:gap-3 text-xs">
                                            <div className="flex items-center gap-1 text-gray-400">
                                                <span className="text-[9px]">Last:</span> <span className="font-mono line-through">RM{item.lastCost.toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-1 font-bold text-[#1A1A1A]">
                                                <span className="text-[9px]">Now:</span> <span className="font-mono">RM{item.currentCost.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Right: Difference - Fixed width or shrink-0 */}
                                    <div className="text-right shrink-0 pl-2">
                                        <p className={`text-base md:text-lg font-black font-mono ${item.status === 'UP' ? 'text-red-600' : 'text-green-600'}`}>
                                            {item.status === 'UP' ? '+' : ''}{item.diff.toFixed(2)}
                                        </p>
                                        <p className={`text-[9px] md:text-[10px] font-bold ${item.status === 'UP' ? 'text-red-400' : 'text-green-400'}`}>
                                            {item.status === 'UP' ? '+' : ''}{item.percent.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {!loading && (
                        <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                            <Info size={18} className="text-blue-600 shrink-0 mt-0.5"/>
                            <p className="text-xs text-blue-800 leading-relaxed">
                                <strong>说明:</strong> 此功能对比“当前系统设置的成本价”与“最近一次盘点日志记录的成本价”。<br/>
                                如果您刚修改了主档价格但尚未进行新的盘点，此处会显示该差异。
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
