
import { StockItem } from '../types';

// ============================================================================
// NEW CODING SYSTEM:
// KITCHEN (K) -> RED LABEL
//   KF: Fresh (Meat, Seafood, Veg, Noodles) - 每日必查
//   KD: Dry (Rice, Flour, Dried Goods) - 每周普查
//   KS: Sauce (Oil, Seasoning) - 每周普查
//
// BAR (B) -> BLUE LABEL
//   BT: Tea (Leaves, Powder)
//   BC: Can/Bottle (RTD, Coke)
//   BF: Fruit (Fresh)
//
// SUPPLY (S) -> YELLOW LABEL
//   SP: Packaging (Plastic, Boxes)
//   SG: General (Gas, Cleaning)
// ============================================================================

export const DEFAULT_KITCHEN_STOCK: StockItem[] = [
    // --- KITCHEN FRESH (KF) - 红色标签/每日必查 ---
    { id: 'KF01', name: '猪油 (Pork Lard)', category: 'FRESH', unit: 'kg', maxQty: 20, minLevel: 5, currentQty: 0, cost: 18.00, isKeyItem: true },
    { id: 'KF02', name: '猪肉片 (Pork Slices)', category: 'FRESH', unit: 'kg', maxQty: 15, minLevel: 5, currentQty: 0, cost: 22.00, isKeyItem: true },
    { id: 'KF03', name: '虾 (Prawn)', category: 'FRESH', unit: 'kg', maxQty: 10, minLevel: 3, currentQty: 0, cost: 35.00, isKeyItem: true },
    { id: 'KF04', name: '大碌面 (Hokkien Mee)', category: 'FRESH', unit: 'kg', maxQty: 50, minLevel: 10, currentQty: 0, cost: 3.50, isKeyItem: true },
    { id: 'KF05', name: '河粉 (Hor Fun)', category: 'FRESH', unit: 'kg', maxQty: 40, minLevel: 10, currentQty: 0, cost: 3.50, isKeyItem: true },
    { id: 'KF06', name: '伊面 (Yee Mee)', category: 'FRESH', unit: 'pkt', maxQty: 30, minLevel: 5, currentQty: 0, cost: 2.80, isKeyItem: true },
    { id: 'KF07', name: '菜心 (Choy Sum)', category: 'FRESH', unit: 'kg', maxQty: 10, minLevel: 3, currentQty: 0, cost: 5.50, isKeyItem: true },
    { id: 'KF08', name: '包菜 (Cabbage)', category: 'FRESH', unit: 'kg', maxQty: 15, minLevel: 4, currentQty: 0, cost: 4.50, isKeyItem: true },
    { id: 'KF09', name: '鸡蛋 (Eggs)', category: 'FRESH', unit: 'tray', maxQty: 30, minLevel: 5, currentQty: 0, cost: 14.00, isKeyItem: true },
    { id: 'KF10', name: '蒜头 (Garlic)', category: 'FRESH', unit: 'kg', maxQty: 10, minLevel: 2, currentQty: 0, cost: 8.00, isKeyItem: true },

    // --- KITCHEN DRY (KD) - 红色标签/每周普查 ---
    { id: 'KD01', name: '米粉 (Bee Hoon)', category: 'DRY', unit: 'kg', maxQty: 30, minLevel: 5, currentQty: 0, cost: 4.50, isKeyItem: false },
    { id: 'KD02', name: '白米 (Rice)', category: 'DRY', unit: 'kg', maxQty: 100, minLevel: 20, currentQty: 0, cost: 3.80, isKeyItem: false },
    { id: 'KD03', name: '茨粉 (Tapioca Flour)', category: 'DRY', unit: 'kg', maxQty: 10, minLevel: 2, currentQty: 0, cost: 3.00, isKeyItem: false },
    { id: 'KD04', name: '面粉 (Wheat Flour)', category: 'DRY', unit: 'kg', maxQty: 10, minLevel: 2, currentQty: 0, cost: 3.50, isKeyItem: false },
    { id: 'KD05', name: '虾米 (Dried Shrimp)', category: 'DRY', unit: 'kg', maxQty: 5, minLevel: 1, currentQty: 0, cost: 40.00, isKeyItem: false },
    { id: 'KD06', name: '左口鱼粉 (Flounder Powder)', category: 'DRY', unit: 'pkt', maxQty: 5, minLevel: 1, currentQty: 0, cost: 80.00, isKeyItem: false },

    // --- KITCHEN SAUCE (KS) - 红色标签/每周普查 ---
    { id: 'KS01', name: '黑酱油 (Dark Soy Sauce)', category: 'SAUCE', unit: 'btl', maxQty: 12, minLevel: 3, currentQty: 0, cost: 12.50, isKeyItem: false },
    { id: 'KS02', name: '生抽 (Light Soy Sauce)', category: 'SAUCE', unit: 'btl', maxQty: 12, minLevel: 3, currentQty: 0, cost: 10.00, isKeyItem: false },
    { id: 'KS03', name: '蚝油 (Oyster Sauce)', category: 'SAUCE', unit: 'btl', maxQty: 12, minLevel: 3, currentQty: 0, cost: 14.00, isKeyItem: false },
    { id: 'KS04', name: '味精 (MSG)', category: 'SAUCE', unit: 'pkt', maxQty: 10, minLevel: 2, currentQty: 0, cost: 5.00, isKeyItem: false },
    { id: 'KS05', name: '食盐 (Salt)', category: 'SAUCE', unit: 'pkt', maxQty: 20, minLevel: 5, currentQty: 0, cost: 1.50, isKeyItem: false },
    { id: 'KS06', name: '白糖 (Sugar)', category: 'SAUCE', unit: 'kg', maxQty: 20, minLevel: 5, currentQty: 0, cost: 2.80, isKeyItem: false },
    { id: 'KS07', name: '辣椒酱 (Chili Sauce)', category: 'SAUCE', unit: 'btl', maxQty: 24, minLevel: 5, currentQty: 0, cost: 3.50, isKeyItem: false },
];

export const DEFAULT_BAR_STOCK: StockItem[] = [
    // --- BAR TEA (BT) - 蓝色标签 ---
    { id: 'BT01', name: '茶王茶叶 (Tea King)', category: 'TEA', unit: 'pkt', maxQty: 10, minLevel: 2, currentQty: 0, cost: 20.00, isKeyItem: true },
    { id: 'BT02', name: '普洱茶饼 (Pu Er)', category: 'TEA', unit: 'pkt', maxQty: 10, minLevel: 2, currentQty: 0, cost: 15.00, isKeyItem: true },
    { id: 'BT03', name: '香片 (Jasmine)', category: 'TEA', unit: 'pkt', maxQty: 10, minLevel: 2, currentQty: 0, cost: 15.00, isKeyItem: true },
    { id: 'BT04', name: '菊花 (Chrysanthemum)', category: 'TEA', unit: 'pkt', maxQty: 10, minLevel: 2, currentQty: 0, cost: 12.00, isKeyItem: false },
    { id: 'BT05', name: '咖啡粉 (Coffee Powder)', category: 'TEA', unit: 'kg', maxQty: 10, minLevel: 2, currentQty: 0, cost: 18.00, isKeyItem: true },

    // --- BAR CAN/BOTTLE (BC) - 蓝色标签 ---
    { id: 'BC01', name: '可乐 (Coca Cola)', category: 'RTD', unit: 'ctn', maxQty: 10, minLevel: 2, currentQty: 0, cost: 38.00, isKeyItem: true },
    { id: 'BC02', name: '100 Plus', category: 'RTD', unit: 'ctn', maxQty: 10, minLevel: 2, currentQty: 0, cost: 38.00, isKeyItem: true },
    { id: 'BC03', name: '吉仔酸梅 (Limau Asam Boi)', category: 'RTD', unit: 'btl', maxQty: 10, minLevel: 2, currentQty: 0, cost: 12.00, isKeyItem: false },
    { id: 'BC04', name: '矿泉水 (Mineral Water)', category: 'RTD', unit: 'ctn', maxQty: 20, minLevel: 5, currentQty: 0, cost: 12.00, isKeyItem: true },

    // --- BAR FRUIT (BF) - 蓝色标签 ---
    { id: 'BF01', name: '青苹果 (Green Apple)', category: 'FRUIT', unit: 'kg', maxQty: 10, minLevel: 3, currentQty: 0, cost: 8.00, isKeyItem: true },
    { id: 'BF02', name: '橙子 (Orange)', category: 'FRUIT', unit: 'kg', maxQty: 10, minLevel: 3, currentQty: 0, cost: 7.00, isKeyItem: true },
    { id: 'BF03', name: '西瓜 (Watermelon)', category: 'FRUIT', unit: 'kg', maxQty: 20, minLevel: 5, currentQty: 0, cost: 4.00, isKeyItem: true },
    { id: 'BF04', name: '桔子 (Lime)', category: 'FRUIT', unit: 'kg', maxQty: 5, minLevel: 2, currentQty: 0, cost: 6.00, isKeyItem: true },
];

export const DEFAULT_GENERAL_STOCK: StockItem[] = [
    // --- SUPPLY PACK (SP) - 黄色标签 ---
    { id: 'SP01', name: '打包盒 (Large Lunch Box)', category: 'PACKAGING', unit: 'pkt', maxQty: 20, minLevel: 5, currentQty: 0, cost: 28.81, isKeyItem: true },
    { id: 'SP02', name: '塑料袋 (Plastic Bag 7x10)', category: 'PACKAGING', unit: 'pkt', maxQty: 20, minLevel: 5, currentQty: 0, cost: 7.99, isKeyItem: true },
    { id: 'SP03', name: '塑料袋 (Plastic Bag 8x12)', category: 'PACKAGING', unit: 'pkt', maxQty: 20, minLevel: 5, currentQty: 0, cost: 7.99, isKeyItem: true },
    { id: 'SP04', name: '吸管 (Straws)', category: 'PACKAGING', unit: 'pkt', maxQty: 20, minLevel: 5, currentQty: 0, cost: 2.60, isKeyItem: false },
    { id: 'SP05', name: '一次性餐具 (Disp. Cutlery)', category: 'PACKAGING', unit: 'pkt', maxQty: 20, minLevel: 5, currentQty: 0, cost: 1.50, isKeyItem: false },
    { id: 'SP06', name: '酱料碟 (Sauce Plate)', category: 'PACKAGING', unit: 'pkt', maxQty: 10, minLevel: 2, currentQty: 0, cost: 5.90, isKeyItem: false },

    // --- SUPPLY GENERAL (SG) - 黄色标签 ---
    { id: 'SG01', name: '煤气桶 (Gas Cylinder)', category: 'GENERAL', unit: 'tank', maxQty: 10, minLevel: 2, currentQty: 0, cost: 30.00, isKeyItem: true },
    { id: 'SG02', name: '洗碗液 (Dish Soap)', category: 'GENERAL', unit: 'btl', maxQty: 10, minLevel: 2, currentQty: 0, cost: 12.00, isKeyItem: false },
    { id: 'SG03', name: '收银纸 (Receipt Paper)', category: 'GENERAL', unit: 'roll', maxQty: 20, minLevel: 5, currentQty: 0, cost: 2.50, isKeyItem: true },
    { id: 'SG04', name: '垃圾袋 (Garbage Bag XL)', category: 'GENERAL', unit: 'pkt', maxQty: 20, minLevel: 5, currentQty: 0, cost: 8.00, isKeyItem: false },
    { id: 'SG05', name: '圆珠笔 (Ball Pen)', category: 'GENERAL', unit: 'box', maxQty: 5, minLevel: 1, currentQty: 0, cost: 15.00, isKeyItem: false },
];
