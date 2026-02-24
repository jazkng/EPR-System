
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc, query, where, writeBatch, updateDoc } from 'firebase/firestore';
import { 
    Employee, SettlementRecord, ExpenseItem, RecurringBill, 
    BillPaymentRecord, StockItem, Supplier, PurchaseOrder, 
    MenuItem, QueueTicket, LogEntry, RoleGuide, PayrollRecord, 
    StoreConfig, AttendanceRecord, SystemBackup, TreasuryConfig, FundTransfer,
    WarrantyRecord, InventoryLog, InventoryTask,
    Proposal, OKR, MarketingCampaign, StoreEvent,
    MisconductRecord, WarningRecord
} from "../types";
import { APP_VERSION } from "../components/constants/versionHistory";

export class DataManager {
    // EMPLOYEES
    static async getEmployees(): Promise<Employee[]> {
        const snap = await getDocs(collection(db, 'employees'));
        return snap.docs.map(d => d.data() as Employee);
    }
    static async saveEmployee(employee: Employee): Promise<void> {
        await setDoc(doc(db, 'employees', employee.id), employee);
    }
    static async deleteEmployee(id: string): Promise<void> {
        await deleteDoc(doc(db, 'employees', id));
    }

    // --- MISCONDUCT LOGIC ---
    static async updateEmployeeMisconduct(
        empId: string, 
        type: 'SMALL' | 'MEDIUM' | 'BIG', 
        issue: string, 
        fine?: number
    ): Promise<string> {
        // 1. Fetch Employee
        const empRef = doc(db, 'employees', empId);
        const empSnap = await getDoc(empRef);
        if (!empSnap.exists()) return 'Employee not found';
        
        const emp = empSnap.data() as Employee;
        const stats = emp.misconductStats || { smallCount: 0, mediumCount: 0, yellowCount: 0 };
        const warnings = emp.warningHistory || [];
        const attributes = emp.attributes || { efficiency: 60, service: 60, culinary: 60, leadership: 60, discipline: 60 };

        let resultMsg = '';
        let triggerYellow = false;
        let triggerRed = false;

        // 2. Logic: Counters
        if (type === 'SMALL') {
            stats.smallCount += 1;
            if (stats.smallCount >= 5) {
                stats.smallCount = 0; // Reset
                triggerYellow = true;
                resultMsg = '⚠️ 累计 5 小错 -> 触发黄色警告 (Yellow Warning)';
            } else {
                resultMsg = `⚠️ 记 1 小错 (当前: ${stats.smallCount}/5)`;
            }
        } else if (type === 'MEDIUM') {
            stats.mediumCount += 1;
            if (stats.mediumCount >= 3) {
                stats.mediumCount = 0; // Reset
                triggerYellow = true;
                resultMsg = '⚠️ 累计 3 中错 -> 触发黄色警告 (Yellow Warning)';
            } else {
                resultMsg = `⚠️ 记 1 中错 (当前: ${stats.mediumCount}/3)`;
            }
        } else if (type === 'BIG') {
            triggerYellow = true;
            resultMsg = '🛑 大错 -> 直接触发黄色警告 (Direct Yellow Warning)';
        }

        // 3. Logic: Warning & Score Deduction
        const today = new Date().toISOString().split('T')[0];

        if (triggerYellow) {
            stats.yellowCount += 1;
            // Add Written Warning (Yellow)
            warnings.unshift({
                id: `warn_${Date.now()}`,
                date: today,
                type: 'WRITTEN', // Yellow
                reason: `[System] ${resultMsg} - ${issue}`,
                issuer: 'System (Logbook)',
                fineAmount: fine
            });
            // Deduct Discipline Score
            attributes.discipline = Math.max(0, attributes.discipline - 10);
            
            // Check Red
            if (stats.yellowCount >= 3) {
                stats.yellowCount = 0;
                triggerRed = true;
                resultMsg += ' -> 累计 3 黄 -> 🔴 触发红色警告 (Red Warning)';
            }
        }

        if (triggerRed) {
            warnings.unshift({
                id: `warn_red_${Date.now()}`,
                date: today,
                type: 'FINAL', // Red
                reason: `[System] 3 Yellow Warnings Triggered Red Warning - ${issue}`,
                issuer: 'System (Logbook)',
                fineAmount: 0 // Fine usually attached to the mistake itself
            });
            attributes.discipline = Math.max(0, attributes.discipline - 20); // Big penalty
        }

        // 4. Handle Direct Fine if no warning triggered but fine exists
        // If warning triggered, fine is attached to warning. If not, we just add a record or attach to salary?
        // Current interface WarningRecord has fineAmount.
        // If not triggered yellow/red, we add a "VERBAL" (Record) warning to track the fine and mistake.
        if (!triggerYellow && !triggerRed) {
             warnings.unshift({
                id: `mistake_${Date.now()}`,
                date: today,
                type: 'VERBAL', // Minor Record
                reason: `[Mistake: ${type}] ${issue}`,
                issuer: 'System (Logbook)',
                fineAmount: fine
            });
            // Minor deduction for just a mistake
            attributes.discipline = Math.max(0, attributes.discipline - (type === 'MEDIUM' ? 3 : 1));
        }

        // 5. Save Employee
        await updateDoc(empRef, {
            misconductStats: stats,
            warningHistory: warnings,
            attributes: attributes
        });

        return resultMsg;
    }

    // SETTLEMENTS
    static async getSettlements(): Promise<SettlementRecord[]> {
        const snap = await getDocs(collection(db, 'settlements'));
        return snap.docs.map(d => d.data() as SettlementRecord).sort((a,b) => b.date.localeCompare(a.date));
    }
    static async saveSettlement(record: SettlementRecord): Promise<void> {
        await setDoc(doc(db, 'settlements', record.id), record);
    }
    static async deleteSettlement(id: string): Promise<void> {
        await deleteDoc(doc(db, 'settlements', id));
    }
    static async updateExpenseInSettlement(settlementId: string, expense: ExpenseItem): Promise<void> {
        const ref = doc(db, 'settlements', settlementId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() as SettlementRecord;
            const idx = data.expenses.findIndex(e => e.id === expense.id);
            if (idx >= 0) data.expenses[idx] = expense;
            else data.expenses.push(expense);
            await setDoc(ref, data);
        }
    }

    // RECURRING BILLS
    static async getRecurringBills(): Promise<RecurringBill[]> {
        const snap = await getDocs(collection(db, 'recurring_bills'));
        return snap.docs.map(d => d.data() as RecurringBill);
    }
    static async saveRecurringBill(bill: RecurringBill): Promise<void> {
        await setDoc(doc(db, 'recurring_bills', bill.id), bill);
    }
    static async deleteRecurringBill(id: string): Promise<void> {
        await deleteDoc(doc(db, 'recurring_bills', id));
    }

    // BILL PAYMENTS
    static async getBillPayments(): Promise<BillPaymentRecord[]> {
        const snap = await getDocs(collection(db, 'bill_payments'));
        return snap.docs.map(d => d.data() as BillPaymentRecord);
    }
    static async saveBillPayment(payment: BillPaymentRecord): Promise<void> {
        await setDoc(doc(db, 'bill_payments', payment.id), payment);
    }
    static async deleteBillPayment(id: string): Promise<void> {
        await deleteDoc(doc(db, 'bill_payments', id));
    }

    // WARRANTY
    static async getWarranties(): Promise<WarrantyRecord[]> {
        const snap = await getDocs(collection(db, 'warranties'));
        return snap.docs.map(d => d.data() as WarrantyRecord);
    }
    static async saveWarranty(record: WarrantyRecord): Promise<void> {
        await setDoc(doc(db, 'warranties', record.id), record);
    }
    static async deleteWarranty(id: string): Promise<void> {
        await deleteDoc(doc(db, 'warranties', id));
    }

    // STOCK
    static async getStock(type: 'KITCHEN' | 'BAR' | 'GENERAL' | 'FUEL'): Promise<StockItem[]> {
        let colName = 'stock_general'; // Default
        if (type === 'KITCHEN') colName = 'stock_kitchen';
        if (type === 'BAR') colName = 'stock_bar';
        if (type === 'FUEL') colName = 'stock_fuel'; // New collection

        const snap = await getDocs(collection(db, colName));
        return snap.docs.map(d => d.data() as StockItem);
    }
    static async saveStockItem(type: 'KITCHEN' | 'BAR' | 'GENERAL' | 'FUEL', item: StockItem): Promise<void> {
        let colName = 'stock_general';
        if (type === 'KITCHEN') colName = 'stock_kitchen';
        if (type === 'BAR') colName = 'stock_bar';
        if (type === 'FUEL') colName = 'stock_fuel';

        await setDoc(doc(db, colName, item.id), item);
    }
    static async deleteStockItem(type: 'KITCHEN' | 'BAR' | 'GENERAL' | 'FUEL', id: string): Promise<void> {
        let colName = 'stock_general';
        if (type === 'KITCHEN') colName = 'stock_kitchen';
        if (type === 'BAR') colName = 'stock_bar';
        if (type === 'FUEL') colName = 'stock_fuel';

        await deleteDoc(doc(db, colName, id));
    }
    static async batchUpdateStock(type: 'KITCHEN' | 'BAR' | 'GENERAL' | 'FUEL', items: StockItem[]): Promise<void> {
        let colName = 'stock_general';
        if (type === 'KITCHEN') colName = 'stock_kitchen';
        if (type === 'BAR') colName = 'stock_bar';
        if (type === 'FUEL') colName = 'stock_fuel';

        const batch = writeBatch(db);
        items.forEach(item => {
            const ref = doc(db, colName, item.id);
            batch.set(ref, item);
        });
        await batch.commit();
    }

    // INVENTORY TASKS (ASSIGNMENTS) - NEW
    static async getInventoryTasks(): Promise<InventoryTask[]> {
        const snap = await getDocs(collection(db, 'inventory_tasks'));
        return snap.docs.map(d => d.data() as InventoryTask).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    }
    static async saveInventoryTask(task: InventoryTask): Promise<void> {
        await setDoc(doc(db, 'inventory_tasks', task.id), task);
    }
    static async deleteInventoryTask(id: string): Promise<void> {
        await deleteDoc(doc(db, 'inventory_tasks', id));
    }

    // INVENTORY LOGS
    static async getInventoryLogs(): Promise<InventoryLog[]> {
        const snap = await getDocs(collection(db, 'inventory_logs'));
        return snap.docs.map(d => d.data() as InventoryLog).sort((a,b) => b.timestamp.localeCompare(a.timestamp));
    }
    static async saveInventoryLog(log: InventoryLog): Promise<void> {
        await setDoc(doc(db, 'inventory_logs', log.id), log);
    }

    // SUPPLIERS
    static async getSuppliers(): Promise<Supplier[]> {
        const snap = await getDocs(collection(db, 'suppliers'));
        return snap.docs.map(d => d.data() as Supplier);
    }
    static async saveSupplier(supplier: Supplier): Promise<void> {
        await setDoc(doc(db, 'suppliers', supplier.id), supplier);
    }
    static async deleteSupplier(id: string): Promise<void> {
        await deleteDoc(doc(db, 'suppliers', id));
    }

    // PURCHASE ORDERS
    static async getPurchaseOrders(): Promise<PurchaseOrder[]> {
        const snap = await getDocs(collection(db, 'purchase_orders'));
        return snap.docs.map(d => d.data() as PurchaseOrder);
    }
    static async savePurchaseOrder(po: PurchaseOrder): Promise<void> {
        await setDoc(doc(db, 'purchase_orders', po.id), po);
    }
    static async deletePurchaseOrder(id: string): Promise<void> {
        await deleteDoc(doc(db, 'purchase_orders', id));
    }

    // MENU
    static async getMenu(): Promise<MenuItem[]> {
        const snap = await getDocs(collection(db, 'menu'));
        return snap.docs.map(d => d.data() as MenuItem);
    }
    static async saveMenu(items: MenuItem[]): Promise<void> {
        const batch = writeBatch(db);
        items.forEach(item => {
            batch.set(doc(db, 'menu', item.id), item);
        });
        await batch.commit();
    }
    static async deleteMenuItem(id: string): Promise<void> {
        await deleteDoc(doc(db, 'menu', id));
    }

    // QUEUE
    static async getQueueTickets(): Promise<QueueTicket[]> {
        const snap = await getDocs(collection(db, 'queue_tickets'));
        return snap.docs.map(d => d.data() as QueueTicket);
    }
    static async saveQueueTicket(ticket: QueueTicket): Promise<void> {
        await setDoc(doc(db, 'queue_tickets', ticket.id), ticket);
    }
    static async clearQueue(): Promise<void> {
        const snap = await getDocs(collection(db, 'queue_tickets'));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }

    // LOGS
    static async getLogs(): Promise<LogEntry[]> {
        const snap = await getDocs(collection(db, 'logs'));
        return snap.docs.map(d => d.data() as LogEntry).sort((a,b) => b.id.localeCompare(a.id));
    }
    static async addLog(log: LogEntry): Promise<void> {
        // If Log has misconduct, handle it first
        if (log.misconduct) {
             const resultMsg = await this.updateEmployeeMisconduct(
                 log.misconduct.employeeId, 
                 log.misconduct.type, 
                 log.issue, 
                 log.misconduct.fineAmount
             );
             // Append result to log action or issue for visibility
             log.misconduct.actionResult = resultMsg;
        }
        await setDoc(doc(db, 'logs', log.id), log);
    }
    static async deleteLog(id: string): Promise<void> {
        await deleteDoc(doc(db, 'logs', id));
    }
    static async acknowledgeLog(id: string, name: string): Promise<void> {
        const ref = doc(db, 'logs', id);
        await updateDoc(ref, {
            acknowledgedBy: name,
            acknowledgedAt: new Date().toISOString()
        });
    }

    // PAYROLL
    static async getPayrollRecords(): Promise<PayrollRecord[]> {
        const snap = await getDocs(collection(db, 'payroll'));
        return snap.docs.map(d => d.data() as PayrollRecord);
    }
    static async savePayrollRecord(record: PayrollRecord): Promise<void> {
        await setDoc(doc(db, 'payroll', record.id), record);
    }

    // ACTIVE SHIFT
    static async getActiveShift(): Promise<any | null> {
        const d = await getDoc(doc(db, 'config', 'active_shift'));
        return d.exists() ? d.data() : null;
    }
    static async saveActiveShift(data: any): Promise<void> {
        await setDoc(doc(db, 'config', 'active_shift'), data);
    }
    static async clearActiveShift(): Promise<void> {
        await deleteDoc(doc(db, 'config', 'active_shift'));
    }

    // STANDALONE EXPENSES (AP)
    static async saveStandaloneExpense(expense: ExpenseItem): Promise<void> {
        await setDoc(doc(db, 'standalone_expenses', expense.id), expense);
    }

    // ROSTER
    static async getRosterData(): Promise<{ roster: any, notes: any }> {
        const r = await getDoc(doc(db, 'roster', 'main'));
        const n = await getDoc(doc(db, 'roster', 'notes'));
        return { 
            roster: r.exists() ? r.data() : {}, 
            notes: n.exists() ? n.data() : {} 
        };
    }
    static async saveRosterData(roster: any, notes: any): Promise<void> {
        await setDoc(doc(db, 'roster', 'main'), roster);
        await setDoc(doc(db, 'roster', 'notes'), notes);
    }

    // ATTENDANCE
    static async getAttendanceByDate(date: string): Promise<AttendanceRecord[]> {
        const q = query(collection(db, 'attendance'), where('date', '==', date));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as AttendanceRecord);
    }
    static async getAttendanceByMonth(month: string): Promise<AttendanceRecord[]> {
        const q = query(collection(db, 'attendance'), where('date', '>=', `${month}-01`), where('date', '<=', `${month}-31`));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as AttendanceRecord);
    }
    static async saveAttendance(record: AttendanceRecord): Promise<void> {
        await setDoc(doc(db, 'attendance', record.id), record);
    }
    static async deleteAttendance(id: string): Promise<void> {
        await deleteDoc(doc(db, 'attendance', id));
    }

    // CONFIG
    static async getConfig(): Promise<StoreConfig | null> {
        const d = await getDoc(doc(db, 'config', 'store'));
        return d.exists() ? d.data() as StoreConfig : null;
    }
    static async saveConfig(config: StoreConfig): Promise<void> {
        await setDoc(doc(db, 'config', 'store'), config);
    }
    static async getRoleConfig(): Promise<{ guides?: Record<string, RoleGuide>, sops?: Record<string, any> } | null> {
        const d = await getDoc(doc(db, 'config', 'roles'));
        return d.exists() ? d.data() : null;
    }
    static async saveRoleConfig(guides: Record<string, RoleGuide>, sops: Record<string, any>): Promise<void> {
        await setDoc(doc(db, 'config', 'roles'), { guides, sops });
    }

    // SOP PROGRESS
    static async getSOPProgress(date: string, empId: string): Promise<any[]> {
        const d = await getDoc(doc(db, 'sop_progress', `${date}_${empId}`));
        return d.exists() ? d.data().items : null;
    }
    static async saveSOPProgress(date: string, empId: string, items: any[]): Promise<void> {
        await setDoc(doc(db, 'sop_progress', `${date}_${empId}`), { items });
    }

    // TREASURY
    static async getTreasuryConfig(): Promise<TreasuryConfig | null> {
        const d = await getDoc(doc(db, 'config', 'treasury'));
        return d.exists() ? d.data() as TreasuryConfig : null;
    }
    static async saveTreasuryConfig(config: TreasuryConfig): Promise<void> {
        await setDoc(doc(db, 'config', 'treasury'), config);
    }
    static async getFundTransfers(): Promise<FundTransfer[]> {
        const snapshot = await getDocs(collection(db, 'fund_transfers'));
        return snapshot.docs.map(d => d.data() as FundTransfer).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    static async saveFundTransfer(transfer: FundTransfer): Promise<void> {
        await setDoc(doc(db, 'fund_transfers', transfer.id), transfer);
    }
    static async deleteFundTransfer(id: string): Promise<void> {
        await deleteDoc(doc(db, 'fund_transfers', id));
    }

    // --- STRATEGY & PLANNING ---
    static async getProposals(): Promise<Proposal[]> {
        const snap = await getDocs(collection(db, 'strategy_proposals'));
        return snap.docs.map(d => d.data() as Proposal).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    static async saveProposal(proposal: Proposal): Promise<void> {
        await setDoc(doc(db, 'strategy_proposals', proposal.id), proposal);
    }
    static async deleteProposal(id: string): Promise<void> {
        await deleteDoc(doc(db, 'strategy_proposals', id));
    }

    static async getOKRs(): Promise<OKR[]> {
        const snap = await getDocs(collection(db, 'strategy_okrs'));
        return snap.docs.map(d => d.data() as OKR);
    }
    static async saveOKR(okr: OKR): Promise<void> {
        await setDoc(doc(db, 'strategy_okrs', okr.id), okr);
    }
    static async deleteOKR(id: string): Promise<void> {
        await deleteDoc(doc(db, 'strategy_okrs', id));
    }

    static async getCampaigns(): Promise<MarketingCampaign[]> {
        const snap = await getDocs(collection(db, 'strategy_campaigns'));
        return snap.docs.map(d => d.data() as MarketingCampaign).sort((a, b) => b.startDate.localeCompare(a.startDate));
    }
    static async saveCampaign(campaign: MarketingCampaign): Promise<void> {
        await setDoc(doc(db, 'strategy_campaigns', campaign.id), campaign);
    }
    static async deleteCampaign(id: string): Promise<void> {
        await deleteDoc(doc(db, 'strategy_campaigns', id));
    }

    static async getEvents(): Promise<StoreEvent[]> {
        const snap = await getDocs(collection(db, 'strategy_events'));
        return snap.docs.map(d => d.data() as StoreEvent).sort((a, b) => a.date.localeCompare(b.date));
    }
    static async saveEvent(event: StoreEvent): Promise<void> {
        await setDoc(doc(db, 'strategy_events', event.id), event);
    }
    static async deleteEvent(id: string): Promise<void> {
        await deleteDoc(doc(db, 'strategy_events', id));
    }

    // MISC
    static async syncLocalToCloud(data: any): Promise<void> {
        if(data && Array.isArray(data)) {
            const batch = writeBatch(db);
            data.forEach((emp: Employee) => {
                const ref = doc(db, 'employees', emp.id);
                batch.set(ref, emp);
            });
            await batch.commit();
        }
    }
    static async resetToDefaults(type: string): Promise<boolean> {
        // Simple Reset implementation: Delete All in collection
        let col = '';
        if (type === 'INVENTORY') col = 'stock_kitchen'; // Just resetting main stock for example
        if (type === 'SUPPLIERS') col = 'suppliers';
        if (col) {
            const snap = await getDocs(collection(db, col));
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            return true;
        }
        return false;
    }

    // --- AUTO BACKUP & EXPORT ---
    static async exportSystemData(): Promise<SystemBackup> {
        const [
            employees, settlements, recurringBills, billPayments,
            stockKitchen, stockBar, stockGeneral, stockFuel,
            suppliers, purchaseOrders, menu, queue, logs,
            payroll, attendance, roster, config,
            treasuryConfig, fundTransfers, warranties,
            standaloneExpenses, proposals, okrs, campaigns, events
        ] = await Promise.all([
            this.getEmployees(),
            this.getSettlements(),
            this.getRecurringBills(),
            this.getBillPayments(),
            this.getStock('KITCHEN'),
            this.getStock('BAR'),
            this.getStock('GENERAL'),
            this.getStock('FUEL'),
            this.getSuppliers(),
            this.getPurchaseOrders(),
            this.getMenu(),
            this.getQueueTickets(),
            this.getLogs(),
            this.getPayrollRecords(),
            getDocs(collection(db, 'attendance')).then(s => s.docs.map(d => d.data() as AttendanceRecord)),
            this.getRosterData(),
            this.getConfig(),
            this.getTreasuryConfig(),
            this.getFundTransfers(),
            this.getWarranties(),
            getDocs(collection(db, 'standalone_expenses')).then(s => s.docs.map(d => d.data() as ExpenseItem)),
            this.getProposals(),
            this.getOKRs(),
            this.getCampaigns(),
            this.getEvents()
        ]);

        return {
            version: APP_VERSION,
            timestamp: new Date().toISOString(),
            data: {
                employees,
                settlements,
                recurringBills,
                billPayments,
                stockKitchen,
                stockBar,
                stockGeneral,
                stockFuel,
                suppliers,
                purchaseOrders,
                menu,
                queue,
                logs,
                payroll,
                attendance,
                roster,
                config,
                treasuryConfig: treasuryConfig || undefined,
                fundTransfers: fundTransfers || undefined,
                warranties: warranties || undefined,
                standaloneExpenses: standaloneExpenses || [],
                strategy: { proposals, okrs, campaigns, events }
            }
        };
    }

    // 1. Run Auto Backup (Silent)
    static async runAutoBackupCheck(): Promise<void> {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayId = `backup_${year}-${month}-${day}`;

            // Check if backup already exists
            const docRef = doc(db, 'system_backups', todayId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("✅ Auto-backup for today already exists.");
                return;
            }

            // Only run if current time is >= 4 AM
            if (now.getHours() < 4) {
                console.log("⏳ Too early for auto-backup.");
                return;
            }

            console.log("🔄 Starting Auto Backup...");
            const backupData = await this.exportSystemData();
            backupData.autoGenerated = true;
            
            await setDoc(docRef, backupData);
            console.log("✅ Auto Backup Saved:", todayId);

            await this.cleanupOldBackups();

        } catch (e) {
            console.error("Auto Backup Failed:", e);
        }
    }

    // 2. Cleanup Old Backups (Keep latest 7)
    static async cleanupOldBackups(): Promise<void> {
        try {
            const snap = await getDocs(collection(db, 'system_backups'));
            const backups = snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemBackup));
            
            backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            if (backups.length > 7) {
                const toDelete = backups.slice(7);
                const batch = writeBatch(db);
                toDelete.forEach(bk => {
                    if (bk.id) {
                        const ref = doc(db, 'system_backups', bk.id);
                        batch.delete(ref);
                    }
                });
                await batch.commit();
                console.log(`🧹 Cleaned up ${toDelete.length} old backups.`);
            }
        } catch (e) {
            console.error("Cleanup Failed:", e);
        }
    }

    // 3. Get List for UI
    static async getAvailableBackups(): Promise<SystemBackup[]> {
        const snap = await getDocs(collection(db, 'system_backups'));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemBackup))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    // 4. Restore System (The Time Machine)
    static async restoreSystem(backup: SystemBackup): Promise<void> {
        const data = backup.data;
        if (!data) throw new Error("Invalid Backup Data");

        // Helper to clear a collection
        const clearCol = async (path: string) => {
            const ref = collection(db, path);
            const snap = await getDocs(ref);
            const promises = snap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(promises);
        };

        // Helper to restore a collection using Batch
        const restoreCol = async (path: string, items: any[]) => {
            if (!items || items.length === 0) return;
            const chunks = [];
            for (let i = 0; i < items.length; i += 400) {
                chunks.push(items.slice(i, i + 400));
            }
            
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(item => {
                     if(item.id) {
                         const ref = doc(db, path, item.id);
                         batch.set(ref, item);
                     }
                });
                await batch.commit();
            }
        };

        // 1. Clear Critical Collections
        await Promise.all([
            clearCol('employees'),
            clearCol('settlements'),
            clearCol('recurring_bills'),
            clearCol('bill_payments'),
            clearCol('stock_kitchen'),
            clearCol('stock_bar'),
            clearCol('stock_general'),
            clearCol('stock_fuel'),
            clearCol('suppliers'),
            clearCol('purchase_orders'),
            clearCol('menu'),
            clearCol('queue_tickets'),
            clearCol('logs'),
            clearCol('payroll'),
            clearCol('attendance'),
            clearCol('fund_transfers'),
            clearCol('standalone_expenses'),
            clearCol('warranties'),
            clearCol('strategy_proposals'),
            clearCol('strategy_okrs'),
            clearCol('strategy_campaigns'),
            clearCol('strategy_events')
        ]);

        // 2. Restore Data
        await Promise.all([
            restoreCol('employees', data.employees),
            restoreCol('settlements', data.settlements),
            restoreCol('recurring_bills', data.recurringBills),
            restoreCol('bill_payments', data.billPayments),
            restoreCol('stock_kitchen', data.stockKitchen),
            restoreCol('stock_bar', data.stockBar),
            restoreCol('stock_general', data.stockGeneral),
            restoreCol('stock_fuel', data.stockFuel || []),
            restoreCol('suppliers', data.suppliers),
            restoreCol('purchase_orders', data.purchaseOrders),
            restoreCol('menu', data.menu),
            restoreCol('queue_tickets', data.queue),
            restoreCol('logs', data.logs),
            restoreCol('payroll', data.payroll),
            restoreCol('attendance', data.attendance),
            
            // Single Docs
            setDoc(doc(db, 'roster', 'main'), data.roster?.roster || {}),
            setDoc(doc(db, 'roster', 'notes'), data.roster?.notes || {}),
            setDoc(doc(db, 'config', 'store'), data.config || {}),
            data.treasuryConfig ? setDoc(doc(db, 'config', 'treasury'), data.treasuryConfig) : Promise.resolve(),

            restoreCol('fund_transfers', data.fundTransfers || []),
            restoreCol('standalone_expenses', data.standaloneExpenses || []),
            restoreCol('warranties', data.warranties || []),
            
            // Strategy
            data.strategy ? Promise.all([
                restoreCol('strategy_proposals', data.strategy.proposals || []),
                restoreCol('strategy_okrs', data.strategy.okrs || []),
                restoreCol('strategy_campaigns', data.strategy.campaigns || []),
                restoreCol('strategy_events', data.strategy.events || [])
            ]) : Promise.resolve()
        ]);
    }
}
