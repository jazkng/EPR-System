
import React, { useState } from 'react';
import { HelpCircle, X, BookOpen, AlertTriangle } from 'lucide-react';

export type GuideModule = 
    | 'SETTLEMENT' 
    | 'TREASURY' 
    | 'AP' 
    | 'BILLS'
    | 'INVENTORY' 
    | 'HR' 
    | 'SUPPLIER' 
    | 'ROSTER' 
    | 'LOGBOOK' 
    | 'SOP' 
    | 'QUEUE'
    | 'REPORTS';

const GUIDE_CONTENT: Record<GuideModule, { title: string; steps: string[] }> = {
    SETTLEMENT: {
        title: '每日结算 & 现金管理 SOP',
        steps: [
            '💵 1. 开班 (Opening): 输入开店时钱箱里的备用金 (Float)。',
            '📈 2. 营业额 (Sales): 结束营业后，输入 POS 机 (StoreHub) 显示的 Sales Total。',
            '💸 3. 现金支出 (Cash Payouts) - 重点:',
            '   - 🛒 零用金 (Petty): 用钱箱现金买的小东西 (如: 冰块, 五金, 杂物)。',
            '   - 👷 员工预支 (Advance): 员工从钱箱预支现金。请务必选择 "员工预支" 类别并选人，系统会自动把这笔钱记入人事系统，月底发薪自动扣除。',
            '   - 🚛 货款 (Supplier): 如果用钱箱现金付了 Supplier 的 COD 货款，请录入此处。',
            '💰 4. 关班 (Closing): 点算钱箱里所有剩下的实际现金 (Actual Cash)。',
            '⚠️ 5. 差异 (Variance): 系统会自动计算 (开班+现金收入-现金支出)。若差异 > RM10，必须填写原因 (如: 找赎错误)。'
        ]
    },
    TREASURY: {
        title: '资金管理 & 股东权益',
        steps: [
            '📊 总览 (Overview): 实时查看 Cash (店面现金) 和 Bank (银行存款) 的余额。',
            '💸 转账 (Transfer): 记录 Cash -> Bank (存钱) 或 Bank -> Cash (提款) 的流向。',
            '💰 股东 (Equity): 记录股东注资 (Injection) 和 初始资金。',
            '🏗️ 开业支出 (Startup): 装修费、设备费和 **租金底金 (Rental Deposit)** 请在此处录入，选择 CAPEX 分类。'
        ]
    },
    AP: {
        title: '应付账款 (AP) 操作指南',
        steps: [
            '💡 核心概念: 此处管理所有基于“交易”的进货单据和杂费 (如买菜、维修、包装)。',
            '🛒 录入 (Add): 点击 "录入新账单"，输入供应商名称 (新名称会自动创建档案)。选择正确的财务科目 (COGS/OPEX)。',
            '⚡️ 批量支付 (Batch Pay):',
            '   1. 使用上方标签 (Tags) 或搜索框筛选特定账单 (如: #HQ, #GAS)。',
            '   2. 点击左侧 "全选未付" (Select All Unpaid)。',
            '   3. 点击底部出现的 "批量支付" 按钮，一次性结清多张单据。',
            '🏷️ 标签管理: 点击 "Manage Tags" 可修改或合并标签 (例如将 "gas" 改为 "GAS" 以修正重复)。',
            '⚠️ 注意: 固定月费 (房租/水电) 请去 Bills 模块，这里主要用于非固定的进货和杂项。'
        ]
    },
    BILLS: {
        title: '固定支出 (Bills) - 循环月费',
        steps: [
            '💡 定义: 基于“时间”的循环费用 (房租、水电、网费)。',
            '✅ 包含: 每月租金 (Monthly Rent)、TNB、Syabas、WiFi。',
            '❌ 不包含: **租金底金 (Rental Deposit)**！底金是一次性资产，不是每月花费，请去 AP 或 Treasury 录入。',
            '⚡️ 功能: 记录电表读数，追踪每月用量趋势。'
        ]
    },
    INVENTORY: {
        title: '库存管理 SOP',
        steps: [
            '📋 盘点 (Check): 员工每日只需关注 "每日必盘 (Daily)" 的红色标签物品 (如: 猪肉/面条)。',
            '⚙️ 管理 (Master): 老板/管理层可在此添加新物品、设定安全库存 (Min Level) 和 进货价 (Cost)。',
            '🚚 进货: 推荐使用 "采购单 (PO)" 或 "导入 PO" 功能，入库时会自动增加数量。',
            '⚠️ 单位: 支持多单位换算 (如: 1 Box = 10 Pkt)，请在编辑页面设置。'
        ]
    },
    HR: {
        title: '人事与薪资指南',
        steps: [
            '👤 档案: 录入员工资料、底薪和银行信息。离职员工请点击 "离职" 进行归档。',
            '💵 薪资 (Payroll): 每月点击 "薪资结算"。',
            '   - 系统会自动拉取考勤扣款 (Late Penalty)。',
            '   - EPF/SOCSO 会根据国籍自动计算 (可在档案中配置)。',
            '✅ 确认: 核对无误后点击 "Post Payroll" 归档。'
        ]
    },
    SUPPLIER: {
        title: '供应商采购 SOP',
        steps: [
            '📂 目录 (Catalog): 先完善供应商的 "产品目录" 和价格。',
            '🛒 采购 (PO): 像网购一样将物品加入购物车，生成采购单。',
            '📤 发送: 点击 "WhatsApp" 直接发单给供应商。',
            '📥 收货: 货到后，在采购单列表点击 "入库"，库存自动更新。'
        ]
    },
    ROSTER: {
        title: '排班管理指南',
        steps: [
            '📅 排班: 点击日期格子修改状态 (Work / Off / Leave)。',
            '🤒 病假/缺席: 选择 MC 或 Absent，系统会在算薪水时自动扣款。',
            '📝 备注: 长按或点击格子可添加备注 (如: 晚到1小时)。'
        ]
    },
    LOGBOOK: {
        title: '运营日志 SOP',
        steps: [
            '📝 记录: 发生客诉、设备故障或突发事件必须记录。',
            '🔴 优先级: 紧急事项请选 "HIGH"，老板会重点关注。',
            '📷 拍照: 尽量上传照片作为证据 (如: 菜品异物/收据)。',
            '✅ 闭环: 问题解决后，管理层应更新 Action Taken (采取措施)。'
        ]
    },
    SOP: {
        title: 'SOP 稽查指南',
        steps: [
            '🧐 检查: 监控员工是否完成了开铺 (Opening) 和 打烊 (Closing) 任务。',
            '📊 进度: 绿色代表已完成，黄色代表进行中。',
            '🔄 重置: 每日凌晨系统自动重置。如需手动开启新一天，点击右上角 "重置"。'
        ]
    },
    QUEUE: {
        title: '排队叫号使用指南',
        steps: [
            '1️⃣ 取号: 输入人数，系统自动分配 A(1-2人)/B(3-4人)/C(5人+) 号码。',
            '2️⃣ 电视: 点击 "启动电视大屏"，在电视或副屏上展示叫号界面。',
            '3️⃣ 呼叫: 点击 "呼叫"，电视会语音播报 "请 A001 号顾客..."。',
            '4️⃣ 入座: 客人进店后点击 "入座" 清除号码。'
        ]
    },
    REPORTS: {
        title: '财务分析报表指南',
        steps: [
            '📅 日期筛选: 点击左上角 "Date Range" 切换查看 今日、本周或本月的数据。',
            '📊 经营分析 (Analytics):',
            '   - 点击甜甜圈图 (Donut Chart) 的色块，可查看具体的 COGS/OPEX 明细。',
            '   - 每日清单卡片点击可展开，查看当天的每一笔支出详情。',
            '📄 损益表 (P&L): 标准会计格式报表，底部的 Net Cash Flow 是最终净现金流 (已扣除所有开支和底金)。',
            '⚠️ 债务 (Debt): 显示所有尚未结清 (Unpaid) 的账单。'
        ]
    }
};

export const ModuleGuideButton: React.FC<{ module: GuideModule, dark?: boolean }> = ({ module, dark = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const content = GUIDE_CONTENT[module];

    if (!content) return null;

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)} 
                className={`p-2 rounded-full transition-colors flex items-center justify-center shrink-0 ${dark ? 'text-gray-400 hover:text-black hover:bg-gray-100' : 'text-white/60 hover:text-white hover:bg-white/10'}`} 
                title="操作说明 (Help)"
            >
                <HelpCircle size={20} />
            </button>
            {isOpen && (
                <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 relative">
                        <div className="bg-[#1A1A1A] p-5 flex justify-between items-center text-white border-b-4 border-[#FFD700]">
                            <h3 className="font-black text-lg flex items-center gap-2"><BookOpen size={20} className="text-[#FFD700]"/> {content.title}</h3>
                            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-5 bg-[#F9FAFB]">
                            {content.steps.map((step, idx) => (
                                <div key={idx} className="flex gap-4 items-start text-sm text-gray-700">
                                    <div className={`mt-1.5 min-w-[8px] h-2 rounded-full shrink-0 shadow-sm ${step.includes('⚠️') || step.includes('🚫') || step.includes('❌') ? 'bg-red-500' : 'bg-[#1A1A1A]'}`}></div>
                                    <p className={`leading-relaxed font-medium ${step.includes('⚠️') || step.includes('🚫') || step.includes('❌') ? 'text-red-600 font-bold' : ''}`}>{step}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-white border-t border-gray-100 text-center">
                            <button onClick={() => setIsOpen(false)} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-black text-xs transition-colors">我知道了 (Got it)</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
