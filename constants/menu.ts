
import { MenuCategory, MenuItem } from '../types';

// ==========================================
// MENU CATEGORIES
// ==========================================
export const MENU_CATEGORIES: MenuCategory[] = [
    { id: 'ALL', label: '全部 (All)' },
    { id: 'NOODLE_RICE', label: '面食/饭类 (Noodles & Rice)' },
    { id: 'FISH', label: '鱼类 (Fish)' },
    { id: 'SEAFOOD_SNACK', label: '海鲜/小吃 (Seafood & Snacks)' },
    { id: 'VEG', label: '蔬菜 (Vegetables)' },
    { id: 'BEVERAGE', label: '饮料/酒水 (Beverages)' },
];

// ==========================================
// MENU ITEMS (INITIAL DATA)
// ==========================================
export const INITIAL_MENU_ITEMS: MenuItem[] = [
    // --- NOODLES & RICE ---
    {
        id: 'm1',
        name: '招牌福建面 (Hokkien Mee)',
        category: 'NOODLE_RICE',
        variants: [
            { label: 'S (小)', price: 12.90, cost: 4.50 },
            { label: 'M (中)', price: 22.90, cost: 8.00 },
            { label: 'L (大)', price: 32.90, cost: 12.00 }
        ],
        options: ['少油', '多猪油渣', '加蛋 (+1.50)', '米粉面']
    },
    {
        id: 'm2',
        name: '广府鸳鸯 (Yin Yong)',
        category: 'NOODLE_RICE',
        variants: [
            { label: 'S (小)', price: 12.90, cost: 4.50 },
            { label: 'M (中)', price: 22.90, cost: 8.00 },
            { label: 'L (大)', price: 32.90, cost: 12.00 }
        ],
        options: ['少芡', '多蛋', '加底 (+2.00)']
    },
    {
        id: 'm3',
        name: '月光河 (Moonlight Hor Fun)',
        category: 'NOODLE_RICE',
        variants: [
            { label: 'S (小)', price: 13.90, cost: 4.80 },
            { label: 'M (中)', price: 24.90, cost: 9.00 },
            { label: 'L (大)', price: 34.90, cost: 13.50 }
        ],
        options: ['生蛋另上', '熟蛋']
    },
    {
        id: 'm4',
        name: '罗面 (Loh Mee)',
        category: 'NOODLE_RICE',
        variants: [
            { label: 'S (小)', price: 12.90, cost: 4.50 },
            { label: 'M (中)', price: 22.90, cost: 8.00 },
            { label: 'L (大)', price: 32.90, cost: 12.00 }
        ],
        options: ['多醋', '少醋']
    },
    {
        id: 'm5',
        name: '扬州炒饭 (Yang Zhou Fried Rice)',
        category: 'NOODLE_RICE',
        variants: [
            { label: 'S (小)', price: 11.90, cost: 3.50 },
            { label: 'M (中)', price: 20.90, cost: 6.50 },
            { label: 'L (大)', price: 29.90, cost: 9.00 }
        ],
        options: ['加煎蛋 (+1.50)', '不辣']
    },
    {
        id: 'm6',
        name: '滑蛋河 (Wat Tan Hor)',
        category: 'NOODLE_RICE',
        variants: [
            { label: 'S (小)', price: 12.90, cost: 4.50 },
            { label: 'M (中)', price: 22.90, cost: 8.00 },
            { label: 'L (大)', price: 32.90, cost: 12.00 }
        ],
        options: ['少芡']
    },

    // --- SEAFOOD & SNACKS ---
    {
        id: 's1',
        name: '宫保田鸡 (Kung Pao Frog) [2只]',
        category: 'SEAFOOD_SNACK',
        variants: [
            { label: '份 (Portion)', price: 45.00, cost: 22.00 }
        ],
        options: ['加辣', '少辣', '配白粥']
    },
    {
        id: 's2',
        name: '姜葱田鸡 (Ginger Onion Frog) [2只]',
        category: 'SEAFOOD_SNACK',
        variants: [
            { label: '份 (Portion)', price: 45.00, cost: 22.00 }
        ],
        options: ['配白粥']
    },
    {
        id: 's3',
        name: '炸鸡翅 (Fried Chicken Wings) [2只]',
        category: 'SEAFOOD_SNACK',
        variants: [
            { label: '份 (Set)', price: 8.50, cost: 3.50 }
        ],
        options: []
    },
    {
        id: 's4',
        name: '啦啦 (Lala - Kam Heong)',
        category: 'SEAFOOD_SNACK',
        variants: [
            { label: 'S (小)', price: 25.00, cost: 10.00 },
            { label: 'L (大)', price: 45.00, cost: 18.00 }
        ],
        options: ['金香', '上汤']
    },

    // --- VEG ---
    {
        id: 'v1',
        name: '马来风光 (Kangkung Belacan)',
        category: 'VEG',
        variants: [
            { label: 'S (小)', price: 12.00, cost: 3.00 },
            { label: 'L (大)', price: 20.00, cost: 5.00 }
        ],
        options: ['不辣', '少油']
    },
    {
        id: 'v2',
        name: '清炒油麦 (Stir-fried Romaine)',
        category: 'VEG',
        variants: [
            { label: 'S (小)', price: 13.00, cost: 3.50 },
            { label: 'L (大)', price: 22.00, cost: 6.00 }
        ],
        options: ['蒜蓉', '腐乳']
    },

    // --- BEVERAGES ---
    {
        id: 'b1',
        name: '金莲记凉茶 (Herbal Tea)',
        category: 'BEVERAGE',
        variants: [
            { label: '杯 (Cup)', price: 3.50, cost: 0.80 },
            { label: '壶 (Jug)', price: 10.90, cost: 2.50 }
        ],
        options: ['少冰', '去冰', '温', '热']
    },
    {
        id: 'b2',
        name: '薏米水 (Barley)',
        category: 'BEVERAGE',
        variants: [
            { label: '杯 (Cup)', price: 3.50, cost: 0.70 },
            { label: '壶 (Jug)', price: 10.90, cost: 2.20 }
        ],
        options: ['少冰', '去冰', '温', '热']
    },
    {
        id: 'b3',
        name: '吉仔酸梅 (Limau Asam Boi)',
        category: 'BEVERAGE',
        variants: [
            { label: '杯 (Cup)', price: 4.50, cost: 1.20 }
        ],
        options: ['少冰', '少甜']
    },
    {
        id: 'b4',
        name: '中国茶 (Chinese Tea)',
        category: 'BEVERAGE',
        variants: [
            { label: '杯 (Cup)', price: 1.50, cost: 0.20 },
            { label: '壶 (Pot)', price: 5.00, cost: 0.50 }
        ],
        options: ['普洱', '香片', '铁观音', '热', '冰']
    },
    {
        id: 'b5',
        name: '100 Plus',
        category: 'BEVERAGE',
        variants: [
            { label: '罐 (Can)', price: 4.50, cost: 2.00 }
        ],
        options: ['加冰杯']
    },
    {
        id: 'b6',
        name: 'Coca Cola',
        category: 'BEVERAGE',
        variants: [
            { label: '罐 (Can)', price: 4.50, cost: 2.00 }
        ],
        options: ['加冰杯']
    }
];
