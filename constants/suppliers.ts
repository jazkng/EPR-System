
import { CatalogItem, Supplier } from '../types';

// ==========================================
// 1. UOM OPTIONS (通用备用单位)
// ==========================================
// 注意：只要产品里写了 uomOptions，这些默认值就会被完全忽略，不会出现重复。
export const UOM_CONVERSIONS = [
    { label: 'Base Unit (基础单位)', value: 'BASE', ratio: 1 },
    { label: '1 Box (x10)', value: 'BOX', ratio: 10 },
    { label: '1 Ctn (x12)', value: 'CTN12', ratio: 12 },
    { label: '1 Packet (x1)', value: 'PKT', ratio: 1 },
];

export const SUPPLIER_TAG_OPTIONS = [
    { id: 'PACKAGING', label: '包装 (Packaging)' },
    { id: 'HQ', label: '总店 (HQ)' },
    { id: 'DRINK', label: '水吧 (Drinks)' },
    { id: 'INGREDIENT', label: '食材 (Ingredients)' },
];

// ==========================================
// 2. CSK CATALOG (完全定制化目录)
// ==========================================
// 即使是 pkt, 也显式定义 uomOptions，以覆盖系统默认值
const CATALOG_CSK: CatalogItem[] = [
    // --- 1. 餐盒系列 (Food Containers) ---
    { 
        id: 'CSK_001', name: 'SQ1500 Box (单座饭盒) [50pcs]', unit: 'pkt', price: 28.81, category: 'CONTAINER',
        uomOptions: [
            { label: '1 PKT (50pcs)', value: 'BASE', ratio: 1 },
            { label: '1 BOX (3 PKTs)', value: 'BOX', ratio: 3 }
        ]
    },
    { 
        id: 'CSK_002', name: 'SQ5 Box (双座饭盒) [30pcs]', unit: 'pkt', price: 28.10, category: 'CONTAINER',
        uomOptions: [
            { label: '1 PKT (30pcs)', value: 'BASE', ratio: 1 },
            { label: '1 BOX (6 PKTs)', value: 'BOX', ratio: 6 }
        ]
    },
    { 
        id: 'CSK_003', name: 'SQ7 Box (三座饭盒) [30pcs]', unit: 'pkt', price: 29.10, category: 'CONTAINER',
        uomOptions: [
            { label: '1 PKT (30pcs)', value: 'BASE', ratio: 1 },
            { label: '1 BOX (6 PKTs)', value: 'BOX', ratio: 6 }
        ]
    },
    { 
        id: 'CSK_004', name: 'C.BIO(M) Brown Lunch Box [50pcs]', unit: 'pkt', price: 11.80, category: 'CONTAINER',
        uomOptions: [
            { label: '1 PKT (50pcs)', value: 'BASE', ratio: 1 },
            { label: '1 CTN (6 PKTs)', value: 'CTN', ratio: 6 }
        ]
    },

    // --- 2. 餐具系列 (Cutlery) ---
    { 
        id: 'CSK_005', name: 'C.W Bamboo Chopstick (竹筷子) [40pcs]', unit: 'pkt', price: 1.70, category: 'CUTLERY',
        uomOptions: [
            { label: '1 PKT (40pcs)', value: 'BASE', ratio: 1 },
            { label: '1 BDL (50 PKTs)', value: 'BDL', ratio: 50 }
        ]
    },
    { 
        id: 'CSK_006', name: 'C.W Chinese Spoon (短汤匙) [80pcs]', unit: 'pkt', price: 1.50, category: 'CUTLERY',
        uomOptions: [
            { label: '1 PKT (80pcs)', value: 'BASE', ratio: 1 },
            { label: '1 BDL (20 PKTs)', value: 'BDL', ratio: 20 }
        ]
    },
    { 
        id: 'CSK_007', name: 'WIZ 6.5 Spoon - Black (黑汤匙) [50pcs]', unit: 'pkt', price: 1.40, category: 'CUTLERY',
        uomOptions: [
            { label: '1 PKT (50pcs)', value: 'BASE', ratio: 1 },
            { label: '1 CTN (40 PKTs)', value: 'CTN', ratio: 40 }
        ]
    },
    { 
        id: 'CSK_008', name: 'WIZ 6.5 Fork - Black (黑叉) [50pcs]', unit: 'pkt', price: 1.40, category: 'CUTLERY',
        uomOptions: [
            { label: '1 PKT (50pcs)', value: 'BASE', ratio: 1 },
            { label: '1 CTN (40 PKTs)', value: 'CTN', ratio: 40 }
        ]
    },

    // --- 3. 杯子与吸管 (Cups & Straws) ---
    { 
        id: 'CSK_009', name: 'TOLI G-12 Cup (360ml) [100pcs]', unit: 'pkt', price: 7.60, category: 'CUP_STRAW',
        uomOptions: [
            { label: '1 PKT (100pcs)', value: 'BASE', ratio: 1 },
            { label: '1 CTN (20 PKTs)', value: 'CTN', ratio: 20 }
        ]
    },
    { 
        id: 'CSK_010', name: '6MM Black Straw (黑吸管) [100pcs]', unit: 'pkt', price: 2.60, category: 'CUP_STRAW',
        uomOptions: [
            { label: '1 PKT (100pcs)', value: 'BASE', ratio: 1 },
            { label: '1 BDL (50 PKTs)', value: 'BDL', ratio: 50 }
        ]
    },

    // --- 4. 透明纸袋系列 (Transparent Bags) ---
    { 
        id: 'CSK_011', name: 'TZ PPSB 12x15 (1饭盒袋) [500g]', unit: 'pkt', price: 6.40, category: 'BAG_TRANS',
        uomOptions: [
            { label: '1 PKT (500g)', value: 'BASE', ratio: 1 },
            { label: '1 BDL (60 PKTs)', value: 'BDL', ratio: 60 }
        ]
    },
    { 
        id: 'CSK_012', name: 'TZ PPSB 15x18 (2饭盒袋) [500g]', unit: 'pkt', price: 6.40, category: 'BAG_TRANS',
        uomOptions: [
            { label: '1 PKT (500g)', value: 'BASE', ratio: 1 },
            { label: '1 BDL (60 PKTs)', value: 'BDL', ratio: 60 }
        ]
    },
    { 
        id: 'CSK_013', name: 'TZ PPSB 18x20 (3饭盒袋) [500g]', unit: 'pkt', price: 6.40, category: 'BAG_TRANS',
        uomOptions: [
            { label: '1 PKT (500g)', value: 'BASE', ratio: 1 },
            { label: '1 BDL (60 PKTs)', value: 'BDL', ratio: 60 }
        ]
    },

    // --- 5. HD 塑料袋系列 (HD Bags) ---
    { 
        id: 'CSK_014', name: 'W HD 7x10 (Plastic Bag) [1kg/200pcs]', unit: 'pkt', price: 7.99, category: 'BAG_HD',
        uomOptions: [
            { label: '1 PKT (1kg)', value: 'BASE', ratio: 1 },
            { label: '1 BDL (30 PKTs)', value: 'BDL', ratio: 30 }
        ]
    },
    { 
        id: 'CSK_015', name: 'W HD 8x12 (Plastic Bag) [1kg/200pcs]', unit: 'pkt', price: 7.99, category: 'BAG_HD',
        uomOptions: [
            { label: '1 PKT (1kg)', value: 'BASE', ratio: 1 },
            { label: '1 BDL (30 PKTs)', value: 'BDL', ratio: 30 }
        ]
    },
    { 
        id: 'CSK_018', name: 'W HD 20x20 (Plastic Sheet) [150pcs]', unit: 'pkt', price: 8.90, category: 'BAG_HD',
        uomOptions: [
            { label: '1 PKT (150pcs)', value: 'BASE', ratio: 1 },
            { label: '1 BDL (20 PKTs)', value: 'BDL', ratio: 20 }
        ]
    },

    // --- 6. 其他包装 (Others) ---
    { 
        id: 'CSK_019', name: 'DGP HM 3x5 (辣椒纸袋) [480pcs]', unit: 'pkt', price: 3.50, category: 'OTHERS',
        uomOptions: [
            { label: '1 PKT (480pcs)', value: 'BASE', ratio: 1 },
            { label: '1 BDL (100 PKTs)', value: 'BDL', ratio: 100 }
        ]
    },
    { 
        id: 'CSK_020', name: 'ZIP BAG 2.5x3.5 [100pcs]', unit: 'pkt', price: 2.30, category: 'OTHERS',
        uomOptions: [
            { label: '1 PKT (100pcs)', value: 'BASE', ratio: 1 },
            { label: '1 BOX (100 PKTs)', value: 'BOX', ratio: 100 }
        ]
    },

    // --- 7. 配件 (Accessories) ---
    { 
        id: 'CSK_016', name: 'BX-04 Sauce Plate (酱料碟) [500pcs]', unit: 'pkt', price: 5.90, category: 'ACCESSORY',
        uomOptions: [
            { label: '1 PKT (500pcs)', value: 'BASE', ratio: 1 },
            { label: '1 CTN (20 PKTs)', value: 'CTN', ratio: 20 }
        ]
    },
    { 
        id: 'CSK_017', name: 'Brown Getah (Rubber Band) [1kg]', unit: 'pkt', price: 14.00, category: 'ACCESSORY',
        uomOptions: [
            { label: '1 PKT (1kg)', value: 'BASE', ratio: 1 },
            { label: '1 GUNI (30kg)', value: 'GUNI', ratio: 30 }
        ]
    },
];

const CATALOG_SUNSONS: CatalogItem[] = [
    { 
        id: 'SUN_001', name: 'Honey Lime (酸柑蜜)', unit: 'btl', price: 12.50, category: 'DRINK',
        uomOptions: [ { label: '1 Bottle', value: 'BASE', ratio: 1 }, { label: '1 Ctn (12 Btls)', value: 'CTN', ratio: 12 } ]
    },
    { 
        id: 'SUN_002', name: 'Chrysanthemum Sugar (菊花糖)', unit: 'pkt', price: 8.50, category: 'DRINK',
        uomOptions: [ { label: '1 Packet', value: 'BASE', ratio: 1 }, { label: '1 Ctn (10 Pkts)', value: 'CTN', ratio: 10 } ]
    },
    { 
        id: 'SUN_003', name: 'Rock Sugar (冰糖)', unit: 'kg', price: 4.50, category: 'DRY',
        uomOptions: [ { label: '1 Kg', value: 'BASE', ratio: 1 }, { label: '1 Bag (5kg)', value: 'BAG', ratio: 5 } ]
    },
];

// ==========================================
// 3. SUPPLIER DEFINITIONS
// ==========================================
export const DEFAULT_SUPPLIERS: Supplier[] = [
    { 
        id: 'sup_csk', 
        name: 'CSK Food Packaging & Plastic Supplier', 
        category: 'PACKAGING', 
        tags: ['PACKAGING', 'HQ'], 
        contact: '+60 11-5406 5240', 
        contactPerson: 'Admin', 
        note: 'Lunch boxes, utensils, plastic bags', 
        paymentTerm: 'COD', 
        status: 'ACTIVE', 
        address: '52, Jalan Metro Perdana Barat 13, Kepong', 
        catalog: CATALOG_CSK
    },
    {
        id: 'sup_sunsons',
        name: 'Sunsons Sdn Bhd',
        category: 'DRINK',
        tags: ['DRINK', 'SUGAR'],
        contact: '012-2345467',
        contactPerson: 'Melvin',
        note: 'Honey Lime, Chrysanthemum Sugar',
        paymentTerm: 'CASH',
        status: 'ACTIVE',
        address: 'Kajang, Selangor',
        catalog: CATALOG_SUNSONS
    }
];
