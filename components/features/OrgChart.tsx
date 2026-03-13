import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    X, MousePointer2, GitMerge, Trash2, Save, RefreshCw,
    ChevronLeft, ChevronRight, Type, Square, Loader2, Layers,
    Plus, Copy, FileDown, Check, Users, Search, ZoomIn, ZoomOut,
    RotateCcw, RotateCw, Maximize2, User, BarChart2, Globe, DollarSign,
    Grid, Edit3, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Employee } from '../../types';
import { DataManager } from '../../utils/dataManager';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// ─── TYPES ───────────────────────────────────────────────
interface OrgChartProps { onClose: () => void; }
type ToolMode = 'select' | 'connect';
type HandleDir = 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 's' | 'n';

interface ONode {
    id: string;
    kind: 'dept' | 'employee' | 'role';
    x: number; y: number;
    cw?: number; ch?: number;
    label?: string; color?: string;
    memberEmpIds?: string[];
    empId?: string;
    selectedRoles?: string[];
    showRestDays?: boolean;
    showAccommodation?: boolean;
    // ── NEW: editable overrides (takes priority over HR data) ──
    overrideRestDays?: string;
    overrideAccommodation?: string;
    // ── NEW: dept display settings ──
    deptShowRoles?: boolean;
    deptShowRestDays?: boolean;
    deptShowAccommodation?: boolean;
    collapsed?: boolean;           // collapse dept member list
}
interface OEdge { id: string; from: string; to: string; color: string; }
interface Page  { id: string; name: string; nodes: ONode[]; edges: OEdge[]; }

// ─── CONSTANTS ───────────────────────────────────────────
const CANVAS_W  = 3200;
const CANVAS_H  = 2400;
const LS_KEY    = 'epr_orgchart_v5';
const SNAP_SIZE = 20;  // snap-to-grid
const DRAG_THRESHOLD = 5; // px before drag activates
const PALETTE   = ['#6366F1','#F59E0B','#10B981','#EF4444','#8B5CF6','#06B6D4','#EC4899','#64748B'];
const BASE_ROLES = [
    'Store Manager','Operations Supervisor','Head Chef','Asst Chef',
    'Captain','Waiter','Water Bar','Cleaner','Dishwasher',
    'Kitchen Cook','Kitchen Cutter','Commis / Runner','Kitchen PIC',
];

function uid() { return Math.random().toString(36).slice(2, 9); }
function snap(v: number) { return Math.round(v / SNAP_SIZE) * SNAP_SIZE; }

// ─── HR DATA HELPERS (synced with HRProfile fields) ──────
/** monthlyRestDays is a number (2/4/6/8) in Employee */
function getEmpRestDays(emp: Employee | undefined): string {
    if (!emp) return '';
    const days = (emp as any).monthlyRestDays;
    if (days !== undefined && days !== null) return `${days} 天/月`;
    return '';
}
/** hasHostel is a boolean in Employee */
function getEmpHostel(emp: Employee | undefined): string {
    if (!emp) return '';
    const h = (emp as any).hasHostel;
    if (h === true) return '有 (Yes)';
    if (h === false) return '无 (No)';
    return '';
}
/** Get primary role from Employee */
function getEmpRole(emp: Employee | undefined): string {
    if (!emp) return '';
    return emp.role?.split('(')[0]?.trim() || '';
}
/** Get secondary roles from Employee */
function getEmpSecondaryRoles(emp: Employee | undefined): string[] {
    if (!emp) return [];
    return ((emp as any).secondaryRoles || []) as string[];
}
/** Effective value: override → HR fallback */
function effectiveRestDays(node: ONode, emp: Employee | undefined): string {
    if (node.overrideRestDays !== undefined && node.overrideRestDays !== '') return node.overrideRestDays;
    return getEmpRestDays(emp) || 'N/A';
}
function effectiveHostel(node: ONode, emp: Employee | undefined): string {
    if (node.overrideAccommodation !== undefined && node.overrideAccommodation !== '') return node.overrideAccommodation;
    return getEmpHostel(emp) || 'N/A';
}

// ─── NODE SIZING ─────────────────────────────────────────
function autoW(n: ONode) { return n.kind === 'employee' ? 200 : n.kind === 'dept' ? 220 : 160; }
function autoH(n: ONode, empMap?: Record<string, Employee>) {
    if (n.kind === 'dept') {
        if (n.collapsed) return 52;
        const members = n.memberEmpIds?.length ?? 0;
        let perRow = 32;
        if (n.deptShowRoles) {
            perRow += 14;
            // extra row for secondary roles (approximate)
            if (empMap) {
                const hasAnySecondary = (n.memberEmpIds ?? []).some(eid => getEmpSecondaryRoles(empMap[eid]).length > 0);
                if (hasAnySecondary) perRow += 12;
            }
        }
        if (n.deptShowRestDays)      perRow += 14;
        if (n.deptShowAccommodation) perRow += 14;
        return 56 + Math.max(1, members) * perRow;
    }
    if (n.kind === 'employee') {
        let h = 74;
        // secondary roles from HR add height
        if (empMap && n.empId) {
            const emp = empMap[n.empId];
            if (getEmpSecondaryRoles(emp).length > 0) h += 18;
        }
        if ((n.selectedRoles?.length ?? 0) > 0) h += 24;
        if (n.showRestDays)      h += 28;
        if (n.showAccommodation) h += 28;
        return h;
    }
    return 38;
}
function nW(n: ONode) { return n.cw ?? autoW(n); }
function nH(n: ONode, empMap?: Record<string, Employee>) { return n.ch ?? autoH(n, empMap); }
function nCentre(n: ONode, empMap?: Record<string, Employee>) { return { cx: n.x + nW(n) / 2, cy: n.y + nH(n, empMap) / 2 }; }

function bBox(ns: ONode[], empMap?: Record<string, Employee>) {
    if (!ns.length) return { x: 0, y: 0, w: 800, h: 600 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of ns) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + nW(n)); y1 = Math.max(y1, n.y + nH(n, empMap)); }
    const p = 60;
    return { x: Math.max(0, x0 - p), y: Math.max(0, y0 - p), w: x1 - x0 + p*2, h: y1 - y0 + p*2 };
}

const newPage = (n = 1): Page => ({ id: uid(), name: `架构图 ${n}`, nodes: [], edges: [] });

// ─── HISTORY ──────────────────────────────────────────────
interface Snap { nodes: ONode[]; edges: OEdge[]; }

// ═══════════════════════════════════════════════════════
export const OrgChart: React.FC<OrgChartProps> = ({ onClose }) => {

    const [employees,    setEmployees]    = useState<Employee[]>([]);
    const [pages,        setPages]        = useState<Page[]>([newPage()]);
    const [pageIdx,      setPageIdx]      = useState(0);
    const [mode,         setMode]         = useState<ToolMode>('select');
    const [selected,     setSelected]     = useState<string | null>(null);
    const [connectFrom,  setConnectFrom]  = useState<string | null>(null);
    const [lineColor,    setLineColor]    = useState(PALETTE[0]);
    const [leftOpen,     setLeftOpen]     = useState(true);
    const [showExport,   setShowExport]   = useState(false);
    const [exportIds,    setExportIds]    = useState<Set<string>>(new Set());
    const [isExporting,  setIsExporting]  = useState(false);
    const [isDirty,      setIsDirty]      = useState(false);
    const [saving,       setSaving]       = useState(false);
    const [mousePos,     setMousePos]     = useState({ x: 0, y: 0 });
    const [renamingPg,   setRenamingPg]   = useState<string | null>(null);
    const [empSearch,    setEmpSearch]    = useState('');
    const [zoom,         setZoom]         = useState(1);
    const [flashId,      setFlashId]      = useState<string | null>(null);
    const [showTips,     setShowTips]     = useState(false);
    const [view,         setView]         = useState<'canvas' | 'analytics'>('canvas');
    const [snapEnabled,  setSnapEnabled]  = useState(true);
    const [editingField, setEditingField] = useState<{ nodeId: string; field: 'restDays' | 'accommodation' } | null>(null);

    // history
    const historyRef  = useRef<Snap[]>([]);
    const futureRef   = useRef<Snap[]>([]);

    // drag refs — NEW: added drag threshold tracking
    const dragRef   = useRef<{
        nodeId: string; msx: number; msy: number; nsx: number; nsy: number;
        activated: boolean;  // true once past threshold
    } | null>(null);
    const resizeRef = useRef<{
        nodeId: string; dir: HandleDir;
        msx: number; msy: number;
        ox: number; oy: number; ow: number; oh: number;
    } | null>(null);

    const pageIdxRef   = useRef(0);
    const canvasScroll = useRef<HTMLDivElement>(null);
    const canvasEl     = useRef<HTMLDivElement>(null);

    pageIdxRef.current = pageIdx;

    // ── page helpers ───────────────────────────────────
    const currentPage = pages[pageIdx] ?? pages[0];
    const nodes       = currentPage?.nodes ?? [];
    const edges       = currentPage?.edges ?? [];

    const pushHistory = useCallback(() => {
        const pg = pages[pageIdxRef.current];
        if (!pg) return;
        historyRef.current = [...historyRef.current.slice(-30), { nodes: pg.nodes, edges: pg.edges }];
        futureRef.current  = [];
    }, [pages]);

    const mutate = useCallback((field: 'nodes' | 'edges', fn: (a: any[]) => any[], pushH = true) => {
        if (pushH) pushHistory();
        setPages(prev => prev.map((p, i) => i === pageIdxRef.current
            ? { ...p, [field]: fn(p[field]) } : p));
        setIsDirty(true);
    }, [pushHistory]);

    const setNodes = useCallback((fn: (a: ONode[]) => ONode[], ph = true) => mutate('nodes', fn as any, ph), [mutate]);
    const setEdges = useCallback((fn: (a: OEdge[]) => OEdge[], ph = true) => mutate('edges', fn as any, ph), [mutate]);
    const updateNode = useCallback((id: string, patch: Partial<ONode>) =>
        setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n)), [setNodes]);

    // ── undo / redo ───────────────────────────────────
    const undo = useCallback(() => {
        if (!historyRef.current.length) return;
        const pg = pages[pageIdx];
        futureRef.current = [{ nodes: pg.nodes, edges: pg.edges }, ...futureRef.current.slice(0, 30)];
        const s = historyRef.current[historyRef.current.length - 1];
        historyRef.current = historyRef.current.slice(0, -1);
        setPages(prev => prev.map((p, i) => i === pageIdx ? { ...p, ...s } : p));
        setIsDirty(true);
    }, [pages, pageIdx]);

    const redo = useCallback(() => {
        if (!futureRef.current.length) return;
        const pg = pages[pageIdx];
        historyRef.current = [...historyRef.current.slice(-30), { nodes: pg.nodes, edges: pg.edges }];
        const s = futureRef.current[0];
        futureRef.current = futureRef.current.slice(1);
        setPages(prev => prev.map((p, i) => i === pageIdx ? { ...p, ...s } : p));
        setIsDirty(true);
    }, [pages, pageIdx]);

    // ── load ──────────────────────────────────────────
    useEffect(() => {
        DataManager.getEmployees().then(d => setEmployees(d.filter(e => !e.isArchived)));
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) { const s = JSON.parse(raw); if (s.pages?.length) setPages(s.pages); }
        } catch {}
    }, []);

    // ── save ──────────────────────────────────────────
    const handleSave = useCallback(async () => {
        setSaving(true);
        try { localStorage.setItem(LS_KEY, JSON.stringify({ pages })); } catch {}
        await new Promise(r => setTimeout(r, 400));
        setSaving(false); setIsDirty(false);
    }, [pages]);

    // ── derived ───────────────────────────────────────
    const empMap = useMemo(() => {
        const m: Record<string, Employee> = {};
        employees.forEach(e => { m[e.id] = e; });
        return m;
    }, [employees]);

    // NEW: track which empIds are already on the current page canvas
    const empIdsOnCanvas = useMemo(() => {
        const s = new Set<string>();
        nodes.forEach(n => {
            if (n.kind === 'employee' && n.empId) s.add(n.empId);
            if (n.kind === 'dept' && n.memberEmpIds) n.memberEmpIds.forEach(id => s.add(id));
        });
        return s;
    }, [nodes]);

    const allRoles = useMemo(() => {
        const s = new Set(BASE_ROLES);
        employees.forEach(e => s.add(e.role.split('(')[0].trim()));
        return Array.from(s);
    }, [employees]);

    const filteredEmps = useMemo(() => {
        const q = empSearch.toLowerCase();
        return q ? employees.filter(e => e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q)) : employees;
    }, [employees, empSearch]);

    // ── canvas coords ─────────────────────────────────
    const toCanvas = useCallback((cx: number, cy: number) => {
        const w = canvasScroll.current;
        if (!w) return { x: cx, y: cy };
        const r = w.getBoundingClientRect();
        return { x: (cx - r.left + w.scrollLeft) / zoom, y: (cy - r.top + w.scrollTop) / zoom };
    }, [zoom]);

    const centreOfScroll = useCallback(() => {
        const w = canvasScroll.current;
        if (!w) return { x: 600, y: 400 };
        return { x: (w.scrollLeft + w.clientWidth / 2) / zoom, y: (w.scrollTop + w.clientHeight / 2) / zoom };
    }, [zoom]);

    // ── actions ───────────────────────────────────────
    const addEmployee = useCallback((emp: Employee) => {
        pushHistory();
        const { x, y } = centreOfScroll();
        const id = uid();
        setNodes(prev => [...prev, {
            id, kind: 'employee', empId: emp.id,
            x: snap(x - 100 + (Math.random() - 0.5) * 80),
            y: snap(y - 37 + (Math.random() - 0.5) * 60),
            // auto-sync HR data as initial overrides
            overrideRestDays: getEmpRestDays(emp) || '',
            overrideAccommodation: getEmpHostel(emp) || '',
        }], false);
        setFlashId(id);
        setTimeout(() => setFlashId(null), 1400);
        setSelected(id);
        setTimeout(() => {
            const w = canvasScroll.current;
            if (!w) return;
            w.scrollTo({ left: x * zoom - w.clientWidth / 2, top: y * zoom - w.clientHeight / 2, behavior: 'smooth' });
        }, 80);
    }, [setNodes, centreOfScroll, pushHistory, zoom]);

    const addBox = useCallback((kind: 'dept' | 'role') => {
        pushHistory();
        const { x, y } = centreOfScroll();
        const id = uid();
        const w = kind === 'dept' ? 220 : 160;
        const h = kind === 'dept' ? 80 : 38;
        setNodes(prev => [...prev, {
            id, kind, label: kind === 'dept' ? '新部门' : '职位名称',
            color: PALETTE[0], memberEmpIds: kind === 'dept' ? [] : undefined,
            x: snap(x - w / 2), y: snap(y - h / 2),
            // NEW: dept display defaults
            ...(kind === 'dept' ? { deptShowRoles: true, deptShowRestDays: false, deptShowAccommodation: false } : {}),
        }], false);
        setFlashId(id);
        setTimeout(() => setFlashId(null), 1400);
        setSelected(id);
    }, [setNodes, centreOfScroll, pushHistory]);

    const deleteSelected = useCallback(() => {
        if (!selected) return;
        pushHistory();
        setNodes(prev => prev.filter(n => n.id !== selected), false);
        setEdges(prev => prev.filter(e => e.from !== selected && e.to !== selected), false);
        setSelected(null);
        setIsDirty(true);
    }, [selected, setNodes, setEdges, pushHistory]);

    const deleteEdge = useCallback((eid: string, ev: React.MouseEvent) => {
        ev.stopPropagation();
        pushHistory();
        setEdges(prev => prev.filter(e => e.id !== eid), false);
    }, [setEdges, pushHistory]);

    // ── node click — NEW: drag threshold means click only fires if not dragged ──
    const handleNodeClick = useCallback((ev: React.MouseEvent, nodeId: string) => {
        ev.stopPropagation();
        if (mode === 'connect') {
            if (!connectFrom) { setConnectFrom(nodeId); return; }
            if (connectFrom === nodeId) { setConnectFrom(null); return; }
            setEdges(prev => {
                if (prev.find(e => (e.from === connectFrom && e.to === nodeId) || (e.from === nodeId && e.to === connectFrom)))
                    return (setConnectFrom(null), prev);
                pushHistory();
                return [...prev, { id: uid(), from: connectFrom, to: nodeId, color: lineColor }];
            }, false);
            setConnectFrom(null);
        } else {
            setSelected(p => p === nodeId ? null : nodeId);
        }
    }, [mode, connectFrom, lineColor, setEdges, pushHistory]);

    // ── drag node — NEW: threshold-based ──────────────
    const handleNodeDown = useCallback((ev: React.MouseEvent, nodeId: string) => {
        if (mode !== 'select') return;
        ev.stopPropagation(); ev.preventDefault();
        const n = nodes.find(x => x.id === nodeId);
        if (!n) return;
        dragRef.current = { nodeId, msx: ev.clientX, msy: ev.clientY, nsx: n.x, nsy: n.y, activated: false };
    }, [mode, nodes]);

    // ── resize ────────────────────────────────────────
    const handleResizeDown = useCallback((ev: React.MouseEvent, nodeId: string, dir: HandleDir) => {
        ev.stopPropagation(); ev.preventDefault();
        const n = nodes.find(x => x.id === nodeId);
        if (!n) return;
        pushHistory();
        resizeRef.current = {
            nodeId, dir,
            msx: ev.clientX, msy: ev.clientY,
            ox: n.x, oy: n.y,
            ow: nW(n), oh: nH(n, empMap),
        };
    }, [nodes, pushHistory, empMap]);

    // ── mouse move ────────────────────────────────────
    const handleMouseMove = useCallback((ev: React.MouseEvent) => {
        if (mode === 'connect' && connectFrom) setMousePos(toCanvas(ev.clientX, ev.clientY));

        // node drag with threshold
        if (dragRef.current) {
            const d = dragRef.current;
            const dx = (ev.clientX - d.msx) / zoom;
            const dy = (ev.clientY - d.msy) / zoom;

            // check threshold
            if (!d.activated) {
                const dist = Math.sqrt((ev.clientX - d.msx) ** 2 + (ev.clientY - d.msy) ** 2);
                if (dist < DRAG_THRESHOLD) return; // not yet dragging
                d.activated = true;
                pushHistory();
            }

            let nx = Math.max(0, d.nsx + dx);
            let ny = Math.max(0, d.nsy + dy);
            if (snapEnabled) { nx = snap(nx); ny = snap(ny); }

            setNodes(prev => prev.map(n =>
                n.id === d.nodeId ? { ...n, x: nx, y: ny } : n
            ), false);
            return;
        }

        // resize
        if (resizeRef.current) {
            const r = resizeRef.current;
            const dx = (ev.clientX - r.msx) / zoom;
            const dy = (ev.clientY - r.msy) / zoom;
            const MIN = 80;
            let nx = r.ox, ny = r.oy, nw = r.ow, nh = r.oh;

            if (r.dir.includes('e'))  nw = Math.max(MIN, r.ow + dx);
            if (r.dir.includes('s'))  nh = Math.max(MIN, r.oh + dy);
            if (r.dir.includes('w')) { nw = Math.max(MIN, r.ow - dx); if (nw > MIN) nx = r.ox + dx; }
            if (r.dir.includes('n')) { nh = Math.max(MIN, r.oh - dy); if (nh > MIN) ny = r.oy + dy; }

            if (snapEnabled) { nx = snap(nx); ny = snap(ny); nw = snap(nw); nh = snap(nh); }

            setNodes(prev => prev.map(n =>
                n.id === r.nodeId ? { ...n, x: nx, y: ny, cw: nw, ch: nh } : n
            ), false);
        }
    }, [mode, connectFrom, zoom, toCanvas, setNodes, pushHistory, snapEnabled]);

    const handleMouseUp = useCallback(() => {
        // if drag never activated (< threshold), treat as click — already handled by onClick
        dragRef.current   = null;
        resizeRef.current = null;
    }, []);

    const handleCanvasCk = useCallback(() => {
        if (mode === 'connect') { setConnectFrom(null); return; }
        setSelected(null);
        setEditingField(null);
    }, [mode]);

    // ── sync HR data for a node ───────────────────────
    const syncHRData = useCallback(async (nodeId: string, empId: string) => {
        try {
            // Try fetching fresh employee data
            const allEmps = await DataManager.getEmployees();
            const emp = allEmps.find(e => e.id === empId);
            if (!emp) return;
            updateNode(nodeId, {
                overrideRestDays: getEmpRestDays(emp) || '',
                overrideAccommodation: getEmpHostel(emp) || '',
            });
        } catch {}
    }, [updateNode]);

    // ── pages ─────────────────────────────────────────
    const addPage = useCallback(() => {
        const p = newPage(pages.length + 1);
        setPages(prev => [...prev, p]);
        setPageIdx(pages.length);
        setSelected(null); setConnectFrom(null); setIsDirty(true);
    }, [pages.length]);

    const copyPage = useCallback(() => {
        const src = pages[pageIdx];
        const idMap: Record<string, string> = {};
        const newNodes = src.nodes.map(n => { const nid = uid(); idMap[n.id] = nid; return { ...n, id: nid }; });
        const newEdges = src.edges.filter(e => idMap[e.from] && idMap[e.to]).map(e => ({ ...e, id: uid(), from: idMap[e.from], to: idMap[e.to] }));
        const pg: Page = { id: uid(), name: `${src.name} (复制)`, nodes: newNodes, edges: newEdges };
        setPages(prev => [...prev, pg]);
        setPageIdx(pages.length);
        setSelected(null); setIsDirty(true);
    }, [pages, pageIdx]);

    const deletePage = useCallback(() => {
        if (pages.length <= 1) return;
        if (!window.confirm(`删除「${currentPage.name}」?`)) return;
        setPages(prev => prev.filter((_, i) => i !== pageIdx));
        setPageIdx(Math.max(0, pageIdx - 1));
        setIsDirty(true);
    }, [pages, pageIdx, currentPage]);

    // ── export ────────────────────────────────────────
    const handleExport = useCallback(async () => {
        if (!exportIds.size) return;
        setIsExporting(true); setShowExport(false);
        const savedIdx = pageIdxRef.current;
        try {
            const pdf = new jsPDF('l', 'mm', 'a4');
            const toExport = pages.filter(p => exportIds.has(p.id));
            for (let i = 0; i < toExport.length; i++) {
                const pg   = toExport[i];
                const pIdx = pages.findIndex(p => p.id === pg.id);
                setPageIdx(pIdx);
                await new Promise(r => setTimeout(r, 900));
                if (!canvasEl.current) continue;
                const bb = bBox(pg.nodes, empMap);
                const canvas = await html2canvas(canvasEl.current, {
                    scale: 2, useCORS: true, backgroundColor: '#ECEEF2', logging: false,
                    x: bb.x * zoom, y: bb.y * zoom, width: bb.w * zoom, height: bb.h * zoom,
                });
                if (i > 0) pdf.addPage();
                const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
                const ratio = Math.min((pw - 16) / canvas.width, (ph - 16) / canvas.height);
                const w = canvas.width * ratio, h = canvas.height * ratio;
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h);
                pdf.setFontSize(7); pdf.setTextColor(180); pdf.text(pg.name, 5, ph - 3);
            }
            pdf.save(`OrgChart_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) { console.error(err); alert('导出失败'); }
        setPageIdx(savedIdx);
        setIsExporting(false);
    }, [exportIds, pages, zoom, empMap]);

    // ── keyboard ──────────────────────────────────────
    useEffect(() => {
        const h = (ev: KeyboardEvent) => {
            if (['INPUT','TEXTAREA'].includes((ev.target as HTMLElement)?.tagName)) return;
            if ((ev.key === 'Delete' || ev.key === 'Backspace') && selected) { deleteSelected(); return; }
            if (ev.key === 'Escape') { setSelected(null); setConnectFrom(null); setMode('select'); setEditingField(null); return; }
            if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z') { ev.shiftKey ? redo() : undo(); return; }
            if ((ev.ctrlKey || ev.metaKey) && ev.key === 'y') { redo(); return; }
            if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') { ev.preventDefault(); handleSave(); return; }
            // quick mode toggles
            if (ev.key === 'v' || ev.key === 'V') { setMode('select'); setConnectFrom(null); return; }
            if (ev.key === 'c' && !ev.ctrlKey && !ev.metaKey) { setMode('connect'); setSelected(null); return; }
            if (ev.key === 'g' || ev.key === 'G') { setSnapEnabled(p => !p); return; }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [deleteSelected, undo, redo, handleSave, selected]);

    // ── Ctrl+scroll zoom ──────────────────────────────
    useEffect(() => {
        const el = canvasScroll.current;
        if (!el) return;
        const h = (ev: WheelEvent) => {
            if (!ev.ctrlKey && !ev.metaKey) return;
            ev.preventDefault();
            setZoom(z => {
                const nz = Math.max(0.3, Math.min(2, z - ev.deltaY * 0.002));
                return +nz.toFixed(2);
            });
        };
        el.addEventListener('wheel', h, { passive: false });
        return () => el.removeEventListener('wheel', h);
    }, []);

    const selectedNode = nodes.find(n => n.id === selected);

    // ── RESIZE HANDLES ────────────────────────────────
    const ResizeHandles = ({ node }: { node: ONode }) => {
        const w = nW(node), h = nH(node, empMap);
        const handles: { dir: HandleDir; x: number; y: number; cursor: string }[] = [
            { dir: 'se', x: w - 6, y: h - 6, cursor: 'se-resize' },
            { dir: 'sw', x: -6,   y: h - 6, cursor: 'sw-resize' },
            { dir: 'ne', x: w - 6, y: -6,   cursor: 'ne-resize' },
            { dir: 'nw', x: -6,   y: -6,    cursor: 'nw-resize' },
            { dir: 'e',  x: w - 5, y: h/2-5, cursor: 'e-resize' },
            { dir: 'w',  x: -5,   y: h/2-5, cursor: 'w-resize' },
            { dir: 's',  x: w/2-5, y: h-5,  cursor: 's-resize' },
            { dir: 'n',  x: w/2-5, y: -5,   cursor: 'n-resize' },
        ];
        return (
            <>
                {handles.map(hd => (
                    <div key={hd.dir}
                        style={{
                            position: 'absolute', left: hd.x, top: hd.y,
                            width: 12, height: 12,
                            backgroundColor: 'white',
                            border: '2px solid #6366F1',
                            borderRadius: 3,
                            cursor: hd.cursor,
                            zIndex: 30,
                        }}
                        onMouseDown={ev => handleResizeDown(ev, node.id, hd.dir)} />
                ))}
            </>
        );
    };

    // ── INLINE EDITABLE FIELD (for rest days / accommodation on canvas) ──
    const InlineEdit = ({ nodeId, field, value, placeholder, icon }: {
        nodeId: string; field: 'restDays' | 'accommodation'; value: string; placeholder: string; icon: string;
    }) => {
        const isEditing = editingField?.nodeId === nodeId && editingField?.field === field;
        const propKey: keyof ONode = field === 'restDays' ? 'overrideRestDays' : 'overrideAccommodation';

        if (isEditing) {
            return (
                <div className="px-2.5 pb-1 flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                    <span className="text-[8px] shrink-0">{icon}</span>
                    <input
                        autoFocus
                        className="flex-1 text-[9px] font-bold text-gray-700 bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 focus:outline-none focus:border-indigo-400 min-w-0"
                        defaultValue={value === 'N/A' ? '' : value}
                        placeholder={placeholder}
                        onBlur={ev => { updateNode(nodeId, { [propKey]: ev.target.value } as Partial<ONode>); setEditingField(null); }}
                        onKeyDown={ev => {
                            if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                            if (ev.key === 'Escape') setEditingField(null);
                        }}
                    />
                </div>
            );
        }

        return (
            <div
                className="px-2.5 pb-1 flex items-center gap-1 shrink-0 cursor-pointer group/edit hover:bg-gray-50 rounded mx-1"
                onClick={e => { e.stopPropagation(); setEditingField({ nodeId, field }); }}
                onMouseDown={e => e.stopPropagation()}
                title="点击编辑">
                <span className="text-[8px] shrink-0">{icon}</span>
                <span className="text-[8px] text-gray-600 font-bold truncate flex-1">{value}</span>
                <Edit3 size={7} className="text-gray-200 group-hover/edit:text-indigo-400 shrink-0" />
            </div>
        );
    };

    // ─────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-[#F0F2F5] w-full h-full md:max-w-7xl md:h-[95vh] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl font-sans">

                {/* Header */}
                <div className="bg-[#1A1A1A] px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] flex justify-between items-center text-white shrink-0 border-b-4 border-[#FFD700] z-20">
                    <Layers size={13} className="text-[#FFD700] shrink-0" />
                    <span className="font-black text-sm text-[#FFD700] mr-auto">组织结构图</span>

                    {/* View Toggle */}
                    <div className="flex gap-0.5 bg-white/10 p-0.5 rounded-xl shrink-0">
                        <TBtn active={view === 'canvas'} onClick={() => setView('canvas')} title="画布视图">
                            <Layers size={12} />
                        </TBtn>
                        <TBtn active={view === 'analytics'} onClick={() => setView('analytics')} title="分析视图">
                            <BarChart2 size={12} />
                        </TBtn>
                    </div>

                    {/* Undo / Redo */}
                    <button onClick={undo}  title="Undo (Ctrl+Z)" className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg"><RotateCcw size={12} /></button>
                    <button onClick={redo}  title="Redo (Ctrl+Y)" className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg"><RotateCw  size={12} /></button>

                    {/* Mode */}
                    <div className="flex gap-0.5 bg-white/10 p-0.5 rounded-xl shrink-0">
                        <TBtn active={mode === 'select'} onClick={() => { setMode('select'); setConnectFrom(null); }} title="选择/移动 (V)">
                            <MousePointer2 size={12} />
                        </TBtn>
                        <TBtn active={mode === 'connect'} onClick={() => { setMode('connect'); setSelected(null); }} title="连线 (C)">
                            <GitMerge size={12} />
                        </TBtn>
                    </div>

                    {mode === 'connect' && (
                        <div className="flex items-center gap-0.5 bg-white/10 px-1.5 py-1 rounded-xl shrink-0">
                            {PALETTE.map(c => (
                                <button key={c} onClick={() => setLineColor(c)}
                                    className={`w-3.5 h-3.5 rounded-full border-2 transition-transform ${lineColor === c ? 'border-white scale-125' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    )}

                    <button onClick={() => addBox('dept')}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <Square size={10} /> 部门
                    </button>
                    <button onClick={() => addBox('role')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <Type size={10} /> 职位
                    </button>

                    {selected && (
                        <button onClick={deleteSelected}
                            className="bg-red-500 hover:bg-red-400 text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0">
                            <Trash2 size={10} /> 删除
                        </button>
                    )}

                    {/* Snap toggle */}
                    <button onClick={() => setSnapEnabled(p => !p)} title={`网格吸附 (G) ${snapEnabled ? 'ON' : 'OFF'}`}
                        className={`p-1.5 rounded-lg transition-all shrink-0 ${snapEnabled ? 'bg-[#FFD700] text-black' : 'text-white/30 hover:text-white hover:bg-white/10'}`}>
                        <Grid size={12} />
                    </button>

                    {/* Zoom */}
                    <div className="flex items-center gap-0.5 bg-white/10 rounded-xl p-0.5 shrink-0">
                        <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))} className="p-1.5 text-white/60 hover:text-white rounded-lg"><ZoomOut size={11} /></button>
                        <span className="text-[10px] font-bold text-white/50 w-8 text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))} className="p-1.5 text-white/60 hover:text-white rounded-lg"><ZoomIn  size={11} /></button>
                        <button onClick={() => setZoom(1)} className="p-1 text-white/30 hover:text-white rounded-lg text-[8px] font-bold">1:1</button>
                    </div>

                    <button onClick={() => { setShowExport(true); setExportIds(new Set([currentPage.id])); }}
                        disabled={isExporting}
                        className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 disabled:opacity-50">
                        {isExporting ? <Loader2 size={10} className="animate-spin" /> : <FileDown size={10} />} 导出
                    </button>

                    <button onClick={handleSave} disabled={saving}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all ${isDirty ? 'bg-[#FFD700] text-black' : 'bg-white/10 text-white/40'}`}>
                        {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                        {saving ? '…' : isDirty ? '保存*' : '已存'}
                    </button>

                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full ml-0.5 shrink-0"><X size={14} /></button>
                </div>

                {/* ── BODY ──────────────────────────── */}
                <div className="flex flex-1 overflow-hidden">

                    {view === 'analytics' && <AnalyticsPanel employees={employees} />}

                    {view === 'canvas' && (<>

                    {/* LEFT panel */}
                    <div className={`bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-200 z-20 ${leftOpen ? 'w-48' : 'w-8'}`}>
                        <button onClick={() => setLeftOpen(p => !p)}
                            className="flex items-center justify-between px-2 py-2 border-b border-gray-100 hover:bg-gray-50 text-[10px] font-black text-gray-400 shrink-0">
                            {leftOpen && <span className="flex items-center gap-1"><User size={10} /> 员工列表</span>}
                            {leftOpen ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
                        </button>

                        {leftOpen && (
                            <>
                                <div className="px-2 pt-2 pb-1 flex items-center gap-1.5">
                                    <div className="flex-1 flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                                        <Search size={9} className="text-gray-300 shrink-0" />
                                        <input
                                            className="flex-1 bg-transparent text-[10px] font-bold text-gray-700 focus:outline-none placeholder:text-gray-300 w-full"
                                            placeholder="搜索员工..."
                                            value={empSearch}
                                            onChange={e => setEmpSearch(e.target.value)} />
                                    </div>
                                    <button onClick={() => DataManager.getEmployees().then(d => setEmployees(d.filter(e => !e.isArchived)))}
                                        title="刷新" className="text-gray-300 hover:text-indigo-400 p-1">
                                        <RefreshCw size={10} />
                                    </button>
                                </div>
                                <p className="px-2 text-[8px] text-gray-300 font-bold mb-1">👆 点击放置到画布 · <span className="text-indigo-300">V</span>=选择 <span className="text-indigo-300">C</span>=连线 <span className="text-indigo-300">G</span>=吸附</p>
                                <div className="overflow-y-auto flex-1 px-1.5 pb-2 space-y-1">
                                    {filteredEmps.map(emp => {
                                        const onCanvas = empIdsOnCanvas.has(emp.id);
                                        return (
                                            <button key={emp.id} onClick={() => addEmployee(emp)}
                                                className={`w-full flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer active:scale-95 text-left transition-all group
                                                    ${onCanvas
                                                        ? 'bg-gray-50 border-gray-100 opacity-50'
                                                        : 'bg-white border-gray-200 hover:border-indigo-400 hover:bg-indigo-50'
                                                    }`}>
                                                <div className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-[8px] font-black text-gray-500 border border-gray-200">
                                                    {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover" alt={emp.name} /> : emp.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[10px] font-bold text-gray-800 truncate">{emp.name}</div>
                                                    <div className="text-[8px] text-gray-400 truncate">{emp.role.split('(')[0]}</div>
                                                </div>
                                                {onCanvas
                                                    ? <Check size={9} className="text-emerald-400 shrink-0" />
                                                    : <Plus size={9} className="text-gray-200 group-hover:text-indigo-400 shrink-0" />
                                                }
                                            </button>
                                        );
                                    })}
                                    {!filteredEmps.length && (
                                        <p className="text-[10px] text-gray-300 text-center py-4 font-bold">
                                            {empSearch ? '无结果' : '暂无员工'}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* CANVAS AREA */}
                    <div className="flex-1 flex flex-col overflow-hidden">

                        {mode === 'connect' && (
                            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                                <div className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                                    <GitMerge size={10} />
                                    {connectFrom ? '点第二个节点完成连线 · ESC取消' : '点第一个节点开始连线'}
                                </div>
                            </div>
                        )}

                        <div ref={canvasScroll}
                            className="flex-1 overflow-auto relative"
                            style={{ background: '#ECEEF2', backgroundImage: 'radial-gradient(circle,#cbd5e1 1px,transparent 1px)', backgroundSize: `${SNAP_SIZE}px ${SNAP_SIZE}px` }}>

                            <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom, position: 'relative' }}>
                                <div ref={canvasEl}
                                    style={{
                                        width: CANVAS_W, height: CANVAS_H,
                                        position: 'absolute', top: 0, left: 0,
                                        transformOrigin: 'top left',
                                        transform: `scale(${zoom})`,
                                        userSelect: 'none',
                                    }}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                    onClick={handleCanvasCk}>

                                    {/* SVG EDGES */}
                                    <svg style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', overflow: 'visible' }}>
                                        <defs>
                                            {PALETTE.map(c => (
                                                <marker key={c} id={`arr5-${c.replace('#','')}`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                                                    <path d="M0,0 L7,3.5 L0,7 Z" fill={c} />
                                                </marker>
                                            ))}
                                        </defs>
                                        {edges.map(edge => {
                                            const fn = nodes.find(n => n.id === edge.from);
                                            const tn = nodes.find(n => n.id === edge.to);
                                            if (!fn || !tn) return null;
                                            const fc = nCentre(fn, empMap), tc = nCentre(tn, empMap);
                                            const mx = (fc.cx + tc.cx) / 2, my = (fc.cy + tc.cy) / 2;
                                            return (
                                                <g key={edge.id} style={{ pointerEvents: 'all' }}>
                                                    <line x1={fc.cx} y1={fc.cy} x2={tc.cx} y2={tc.cy}
                                                        stroke="transparent" strokeWidth={16}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={ev => deleteEdge(edge.id, ev)} />
                                                    <line x1={fc.cx} y1={fc.cy} x2={tc.cx} y2={tc.cy}
                                                        stroke={edge.color} strokeWidth={2}
                                                        markerEnd={`url(#arr5-${edge.color.replace('#','')})`}
                                                        style={{ pointerEvents: 'none' }} />
                                                    <g style={{ cursor: 'pointer' }} onClick={ev => deleteEdge(edge.id, ev)}>
                                                        <circle cx={mx} cy={my} r={7} fill="white" stroke={edge.color} strokeWidth={1.5} />
                                                        <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="9" fontWeight="bold" fill={edge.color}>×</text>
                                                    </g>
                                                </g>
                                            );
                                        })}
                                        {mode === 'connect' && connectFrom && (() => {
                                            const fn = nodes.find(n => n.id === connectFrom);
                                            if (!fn) return null;
                                            const fc = nCentre(fn, empMap);
                                            return <line x1={fc.cx} y1={fc.cy} x2={mousePos.x} y2={mousePos.y}
                                                stroke={lineColor} strokeWidth={2} strokeDasharray="6 4" opacity={0.7}
                                                style={{ pointerEvents: 'none' }} />;
                                        })()}
                                    </svg>

                                    {/* NODES */}
                                    {nodes.map(node => {
                                        const w = nW(node), h = nH(node, empMap);
                                        const isSel   = selected    === node.id;
                                        const isConn  = connectFrom === node.id;
                                        const isFlash = flashId     === node.id;
                                        const shadow  = isSel
                                            ? '0 0 0 2.5px #FFD700, 0 6px 24px rgba(255,215,0,0.28)'
                                            : isConn
                                            ? `0 0 0 2.5px ${lineColor}`
                                            : isFlash
                                            ? '0 0 0 3px #6366F1, 0 6px 24px rgba(99,102,241,0.4)'
                                            : '0 2px 8px rgba(0,0,0,0.08)';

                                        return (
                                            <div key={node.id}
                                                style={{
                                                    position: 'absolute', left: node.x, top: node.y,
                                                    width: w, minHeight: h,
                                                    cursor: mode === 'select' ? 'grab' : 'pointer',
                                                    zIndex: isSel || isConn ? 20 : 10,
                                                    boxShadow: shadow,
                                                    borderRadius: node.kind === 'role' ? 10 : 16,
                                                    transition: 'box-shadow 0.15s',
                                                }}
                                                onClick={e => handleNodeClick(e, node.id)}
                                                onMouseDown={e => handleNodeDown(e, node.id)}>

                                                {/* ─ DEPT (ENHANCED) ─ */}
                                                {node.kind === 'dept' && (
                                                    <div className="rounded-[16px] overflow-hidden border border-gray-200 bg-white h-full flex flex-col">
                                                        <div className="flex items-center justify-between px-3 py-2.5 shrink-0" style={{ backgroundColor: node.color ?? '#6366F1' }}>
                                                            <span className="font-black text-xs text-white truncate">{node.label}</span>
                                                            <div className="flex items-center gap-1 shrink-0 ml-1">
                                                                <span className="text-[9px] text-white/60 font-bold">{node.memberEmpIds?.length ?? 0}</span>
                                                                <Users size={11} className="text-white/60" />
                                                                {/* collapse toggle */}
                                                                <button
                                                                    className="text-white/40 hover:text-white p-0.5"
                                                                    onMouseDown={e => e.stopPropagation()}
                                                                    onClick={e => { e.stopPropagation(); updateNode(node.id, { collapsed: !node.collapsed }); }}>
                                                                    {node.collapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {!node.collapsed && (
                                                            <>
                                                                <div className="h-px shrink-0" style={{ backgroundColor: `${node.color ?? '#6366F1'}30` }} />
                                                                <div className="px-2.5 py-1.5 space-y-1.5 overflow-hidden flex-1">
                                                                    {!(node.memberEmpIds?.length) && (
                                                                        <p className="text-[9px] text-gray-300 italic font-bold text-center py-1">选中 → 右侧添加员工</p>
                                                                    )}
                                                                    {(node.memberEmpIds ?? []).map(eid => {
                                                                        const e = empMap[eid];
                                                                        const secRoles = getEmpSecondaryRoles(e);
                                                                        return (
                                                                            <div key={eid} className="flex flex-col gap-0.5 pb-1 border-b border-gray-50 last:border-0">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <div className="w-4 h-4 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-[7px] font-black text-gray-500 border border-gray-200">
                                                                                        {e?.avatar ? <img src={e.avatar} className="w-full h-full object-cover" alt="" /> : (e?.name.charAt(0) ?? '?')}
                                                                                    </div>
                                                                                    <span className="text-[10px] font-bold text-gray-700 truncate flex-1">{e?.name ?? eid}</span>
                                                                                    {/* show role inline */}
                                                                                    {node.deptShowRoles && e && (
                                                                                        <span className="text-[7px] font-bold text-indigo-400 truncate max-w-[60px]">{getEmpRole(e)}</span>
                                                                                    )}
                                                                                    <button className="text-gray-200 hover:text-red-400 text-[11px] leading-none shrink-0 px-0.5"
                                                                                        onMouseDown={ev => ev.stopPropagation()}
                                                                                        onClick={ev => { ev.stopPropagation(); updateNode(node.id, { memberEmpIds: (node.memberEmpIds ?? []).filter(i => i !== eid) }); }}>
                                                                                        ×
                                                                                    </button>
                                                                                </div>
                                                                                {/* secondary roles */}
                                                                                {node.deptShowRoles && secRoles.length > 0 && (
                                                                                    <div className="flex flex-wrap gap-0.5 pl-6">
                                                                                        {secRoles.map(sr => (
                                                                                            <span key={sr} className="text-[6px] font-bold bg-blue-50 text-blue-400 px-1 py-0.5 rounded">{sr.split('(')[0].trim()}</span>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                                {/* rest days from HR */}
                                                                                {node.deptShowRestDays && (
                                                                                    <div className="flex items-center gap-1 pl-6">
                                                                                        <span className="text-[7px] text-gray-300">🌙</span>
                                                                                        <span className="text-[7px] text-gray-500 font-bold truncate">{getEmpRestDays(e) || 'N/A'}</span>
                                                                                    </div>
                                                                                )}
                                                                                {/* hostel from HR */}
                                                                                {node.deptShowAccommodation && (
                                                                                    <div className="flex items-center gap-1 pl-6">
                                                                                        <span className="text-[7px] text-gray-300">🏠</span>
                                                                                        <span className="text-[7px] text-gray-500 font-bold truncate">{getEmpHostel(e) || 'N/A'}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ─ EMPLOYEE (EDITABLE FIELDS) ─ */}
                                                {node.kind === 'employee' && (() => {
                                                    const emp = empMap[node.empId!];
                                                    if (!emp) return (
                                                        <div className="bg-white rounded-[16px] border border-dashed border-gray-200 flex items-center justify-center p-3 h-full">
                                                            <span className="text-[9px] text-gray-300 font-bold">员工已移除</span>
                                                        </div>
                                                    );
                                                    return (
                                                        <div className="bg-white rounded-[16px] border border-gray-200 overflow-hidden h-full flex flex-col">
                                                            <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-2 shrink-0">
                                                                <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-[11px] font-black text-gray-500 border border-gray-200">
                                                                    {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover" alt={emp.name} /> : emp.name.charAt(0)}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-[11px] font-black text-[#1A1A1A] truncate">{emp.name}</div>
                                                                    <div className="text-[9px] text-gray-400 font-bold truncate">{getEmpRole(emp)}</div>
                                                                    {/* secondary roles from HR */}
                                                                    {getEmpSecondaryRoles(emp).length > 0 && (
                                                                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                                                                            {getEmpSecondaryRoles(emp).map(sr => (
                                                                                <span key={sr} className="text-[6px] font-bold bg-blue-50 text-blue-400 px-1 py-0.5 rounded">{sr.split('(')[0].trim()}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {emp.rank && emp.rank !== 'CREW' && (
                                                                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded mt-0.5 inline-block uppercase ${emp.rank === 'TOP' ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-500'}`}>
                                                                            {emp.rank}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {(node.selectedRoles?.length ?? 0) > 0 && (
                                                                <div className="px-2.5 pb-1 flex flex-wrap gap-1 shrink-0">
                                                                    {node.selectedRoles!.map(r => (
                                                                        <span key={r} className="text-[7px] font-black bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-wide">{r}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {/* EDITABLE rest days */}
                                                            {node.showRestDays && (
                                                                <InlineEdit
                                                                    nodeId={node.id}
                                                                    field="restDays"
                                                                    value={effectiveRestDays(node, emp)}
                                                                    placeholder="如: 4 天/月"
                                                                    icon="🌙"
                                                                />
                                                            )}
                                                            {/* EDITABLE hostel */}
                                                            {node.showAccommodation && (
                                                                <InlineEdit
                                                                    nodeId={node.id}
                                                                    field="accommodation"
                                                                    value={effectiveHostel(node, emp)}
                                                                    placeholder="有/无宿舍"
                                                                    icon="🏠"
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                {/* ─ ROLE ─ */}
                                                {node.kind === 'role' && (
                                                    <div className="h-full flex items-center justify-center rounded-[10px] border-2 font-bold text-[11px] px-3"
                                                        style={{ borderColor: node.color ?? '#6366F1', color: node.color ?? '#6366F1', backgroundColor: `${node.color ?? '#6366F1'}18` }}>
                                                        <span className="truncate">{node.label}</span>
                                                    </div>
                                                )}

                                                {isSel && mode === 'select' && <ResizeHandles node={node} />}
                                            </div>
                                        );
                                    })}

                                    {!nodes.length && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="bg-white/80 rounded-3xl px-8 py-6 text-center border border-gray-200 shadow-sm">
                                                <p className="text-2xl mb-2">🗂️</p>
                                                <p className="text-sm font-black text-gray-400">从左侧添加员工 · 或点击顶栏「部门/职位」</p>
                                                <p className="text-xs text-gray-300 font-bold mt-1">快捷键: V=选择 C=连线 G=吸附 Del=删除 Ctrl+Z=撤销</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* PAGE TABS */}
                        <div className="bg-[#1A1A1A] px-3 py-1.5 flex items-center gap-1 shrink-0 overflow-x-auto border-t-2 border-[#FFD700]/30">
                            {pages.map((pg, i) => (
                                renamingPg === pg.id
                                    ? <input key={pg.id} autoFocus
                                        className="text-[10px] font-bold bg-[#FFD700] text-black rounded px-2 py-0.5 w-24 focus:outline-none shrink-0"
                                        defaultValue={pg.name}
                                        onBlur={ev => {
                                            setPages(prev => prev.map((p, j) => j === i ? { ...p, name: ev.target.value || pg.name } : p));
                                            setRenamingPg(null); setIsDirty(true);
                                        }}
                                        onKeyDown={ev => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); if (ev.key === 'Escape') setRenamingPg(null); }} />
                                    : <button key={pg.id}
                                        onClick={() => { setPageIdx(i); setSelected(null); setConnectFrom(null); }}
                                        onDoubleClick={() => setRenamingPg(pg.id)}
                                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all truncate max-w-[120px] shrink-0 ${i === pageIdx ? 'bg-[#FFD700] text-black' : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white'}`}>
                                        {pg.name}
                                    </button>
                            ))}
                            <button onClick={addPage}  title="新建界面" className="text-white/40 hover:text-white p-1 rounded"><Plus size={11} /></button>
                            <button onClick={copyPage} title="复制界面" className="text-white/40 hover:text-white p-1 rounded"><Copy size={11} /></button>
                            {pages.length > 1 && (
                                <button onClick={deletePage} title="删除此界面" className="text-white/20 hover:text-red-400 p-1 rounded"><Trash2 size={10} /></button>
                            )}

                            <button onClick={() => setShowTips(p => !p)} className="ml-auto text-white/20 hover:text-[#FFD700] text-[9px] font-bold px-2 py-0.5 rounded shrink-0">
                                💡 建议
                            </button>
                            <span className="text-[8px] text-white/15 font-bold shrink-0 hidden md:block">双击标签重命名 · Ctrl+滚轮缩放</span>
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    {selectedNode && mode === 'select' && (
                        <div className="bg-white border-l border-gray-200 w-52 flex flex-col shrink-0 overflow-y-auto z-20 animate-in slide-in-from-right-4 fade-in duration-150">
                            <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                                    {selectedNode.kind === 'dept' ? '部门' : selectedNode.kind === 'employee' ? '员工节点' : '职位'}
                                </span>
                                <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500"><X size={11} /></button>
                            </div>

                            {/* DEPT */}
                            {selectedNode.kind === 'dept' && (
                                <div className="p-3 space-y-3 overflow-y-auto flex-1">
                                    <div>
                                        <Label>部门名称</Label>
                                        <input autoFocus
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 mt-1"
                                            value={selectedNode.label ?? ''}
                                            onChange={e => updateNode(selectedNode.id, { label: e.target.value })} />
                                    </div>
                                    <div>
                                        <Label>颜色</Label>
                                        <div className="grid grid-cols-4 gap-1.5 mt-1">
                                            {PALETTE.map(c => (
                                                <button key={c} onClick={() => updateNode(selectedNode.id, { color: c })}
                                                    className={`w-8 h-8 rounded-lg border-2 transition-all ${selectedNode.color === c ? 'border-gray-700 scale-110 shadow-sm' : 'border-transparent'}`}
                                                    style={{ backgroundColor: c }} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* NEW: dept display toggles */}
                                    <div>
                                        <Label>显示字段</Label>
                                        <div className="space-y-1.5 mt-1">
                                            <Toggle active={!!selectedNode.deptShowRoles}
                                                onClick={() => updateNode(selectedNode.id, { deptShowRoles: !selectedNode.deptShowRoles })}
                                                label="👤 显示职位" />
                                            <Toggle active={!!selectedNode.deptShowRestDays}
                                                onClick={() => updateNode(selectedNode.id, { deptShowRestDays: !selectedNode.deptShowRestDays })}
                                                label="🌙 显示休息天" />
                                            <Toggle active={!!selectedNode.deptShowAccommodation}
                                                onClick={() => updateNode(selectedNode.id, { deptShowAccommodation: !selectedNode.deptShowAccommodation })}
                                                label="🏠 显示宿舍" />
                                        </div>
                                    </div>

                                    <div>
                                        <Label>员工成员</Label>
                                        <div className="space-y-1 mt-1 max-h-52 overflow-y-auto">
                                            {employees.map(emp => {
                                                const inDept = (selectedNode.memberEmpIds ?? []).includes(emp.id);
                                                return (
                                                    <button key={emp.id}
                                                        onClick={() => {
                                                            const cur = selectedNode.memberEmpIds ?? [];
                                                            updateNode(selectedNode.id, { memberEmpIds: inDept ? cur.filter(i => i !== emp.id) : [...cur, emp.id] });
                                                        }}
                                                        className={`w-full flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${inDept ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40'}`}>
                                                        <div className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-[8px] font-black text-gray-500 border border-gray-200">
                                                            {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover" alt={emp.name} /> : emp.name.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <span className="text-[10px] font-bold text-gray-700 truncate block">{emp.name}</span>
                                                            <span className="text-[8px] text-gray-400 truncate block">{emp.role.split('(')[0]}</span>
                                                        </div>
                                                        {inDept && <Check size={10} className="text-indigo-500 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <DelBtn onClick={deleteSelected} />
                                </div>
                            )}

                            {/* EMPLOYEE */}
                            {selectedNode.kind === 'employee' && (() => {
                                const emp = empMap[selectedNode.empId!];
                                return (
                                    <div className="p-3 space-y-3 overflow-y-auto flex-1">
                                        {emp && (
                                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-black text-gray-500">
                                                    {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover" alt={emp.name} /> : emp.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-[11px] font-black text-gray-800 truncate">{emp.name}</div>
                                                    <div className="text-[8px] text-gray-400 truncate">{emp.role.split('(')[0]}</div>
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <Label>职位标签 (多选)</Label>
                                            <div className="space-y-1 mt-1 max-h-44 overflow-y-auto">
                                                {allRoles.map(role => {
                                                    const on = (selectedNode.selectedRoles ?? []).includes(role);
                                                    return (
                                                        <button key={role}
                                                            onClick={() => {
                                                                const cur = selectedNode.selectedRoles ?? [];
                                                                updateNode(selectedNode.id, { selectedRoles: on ? cur.filter(r => r !== role) : [...cur, role] });
                                                            }}
                                                            className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg border text-left text-[10px] font-bold transition-all ${on ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200'}`}>
                                                            <Checkbox checked={on} />
                                                            <span className="truncate">{role}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div>
                                            <Label>额外信息</Label>
                                            <div className="space-y-1.5 mt-1">
                                                <Toggle active={!!selectedNode.showRestDays}
                                                    onClick={() => updateNode(selectedNode.id, { showRestDays: !selectedNode.showRestDays })}
                                                    label="🌙 休息天数" />
                                                <Toggle active={!!selectedNode.showAccommodation}
                                                    onClick={() => updateNode(selectedNode.id, { showAccommodation: !selectedNode.showAccommodation })}
                                                    label="🏠 宿舍 (Hostel)" />
                                            </div>
                                        </div>

                                        {/* NEW: editable fields in right panel too */}
                                        {(selectedNode.showRestDays || selectedNode.showAccommodation) && (
                                            <div>
                                                <Label>编辑字段</Label>
                                                <div className="space-y-2 mt-1">
                                                    {selectedNode.showRestDays && (
                                                        <div>
                                                            <span className="text-[8px] text-gray-400 font-bold block mb-0.5">🌙 休息天数 (Rest Days)</span>
                                                            <input
                                                                className="w-full border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:border-indigo-400"
                                                                value={selectedNode.overrideRestDays ?? getEmpRestDays(emp)}
                                                                placeholder="如: 4 天/月"
                                                                onChange={e => updateNode(selectedNode.id, { overrideRestDays: e.target.value })}
                                                            />
                                                            <span className="text-[7px] text-gray-300">HR默认: {getEmpRestDays(emp) || '无'}</span>
                                                        </div>
                                                    )}
                                                    {selectedNode.showAccommodation && (
                                                        <div>
                                                            <span className="text-[8px] text-gray-400 font-bold block mb-0.5">🏠 宿舍 (Hostel)</span>
                                                            <input
                                                                className="w-full border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:border-indigo-400"
                                                                value={selectedNode.overrideAccommodation ?? getEmpHostel(emp)}
                                                                placeholder="有/无宿舍"
                                                                onChange={e => updateNode(selectedNode.id, { overrideAccommodation: e.target.value })}
                                                            />
                                                            <span className="text-[7px] text-gray-300">HR默认: {getEmpHostel(emp) || '无'}</span>
                                                        </div>
                                                    )}
                                                    {/* Sync from HR button */}
                                                    {selectedNode.empId && (
                                                        <button
                                                            onClick={() => syncHRData(selectedNode.id, selectedNode.empId!)}
                                                            className="w-full text-[9px] font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg py-1.5 flex items-center justify-center gap-1 transition-all">
                                                            <RefreshCw size={9} /> 从 HR Profile 同步
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <Label>大小</Label>
                                            <button onClick={() => updateNode(selectedNode.id, { cw: undefined, ch: undefined })}
                                                className="mt-1 text-[9px] text-gray-400 hover:text-indigo-500 font-bold flex items-center gap-1">
                                                <Maximize2 size={9} /> 重置为自动大小
                                            </button>
                                        </div>
                                        <DelBtn onClick={deleteSelected} />
                                    </div>
                                );
                            })()}

                            {/* ROLE */}
                            {selectedNode.kind === 'role' && (
                                <div className="p-3 space-y-3">
                                    <div>
                                        <Label>职位名称</Label>
                                        <input autoFocus
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:outline-none focus:border-emerald-400 mt-1"
                                            value={selectedNode.label ?? ''}
                                            onChange={e => updateNode(selectedNode.id, { label: e.target.value })} />
                                    </div>
                                    <div>
                                        <Label>颜色</Label>
                                        <div className="grid grid-cols-4 gap-1.5 mt-1">
                                            {PALETTE.map(c => (
                                                <button key={c} onClick={() => updateNode(selectedNode.id, { color: c })}
                                                    className={`w-8 h-8 rounded-lg border-2 transition-all ${selectedNode.color === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                                                    style={{ backgroundColor: c }} />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <Label>大小</Label>
                                        <button onClick={() => updateNode(selectedNode.id, { cw: undefined, ch: undefined })}
                                            className="mt-1 text-[9px] text-gray-400 hover:text-emerald-500 font-bold flex items-center gap-1">
                                            <Maximize2 size={9} /> 重置为自动大小
                                        </button>
                                    </div>
                                    <DelBtn onClick={deleteSelected} />
                                </div>
                            )}
                        </div>
                    )}

                    </>) /* end canvas view */}

                </div>

                {/* EXPORT MODAL */}
                {showExport && (
                    <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm" onClick={() => setShowExport(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl p-5 w-72 animate-in zoom-in-95 fade-in" onClick={e => e.stopPropagation()}>
                            <h4 className="font-black text-sm text-gray-800 mb-1 flex items-center gap-2">
                                <FileDown size={14} className="text-indigo-500" /> 选择导出的界面
                            </h4>
                            <p className="text-[9px] text-gray-400 font-bold mb-3">每个界面 = PDF 一页</p>
                            <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
                                {pages.map(pg => (
                                    <button key={pg.id}
                                        onClick={() => setExportIds(prev => { const s = new Set(prev); s.has(pg.id) ? s.delete(pg.id) : s.add(pg.id); return s; })}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${exportIds.has(pg.id) ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50 border-gray-200 hover:border-indigo-200'}`}>
                                        <Checkbox checked={exportIds.has(pg.id)} />
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-bold text-gray-700 truncate">{pg.name}</div>
                                            <div className="text-[9px] text-gray-400">{pg.nodes.length} 节点 · {pg.edges.length} 连线</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowExport(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-xl text-[11px] font-bold">取消</button>
                                <button onClick={handleExport} disabled={!exportIds.size}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5">
                                    <FileDown size={11} /> 导出 ({exportIds.size})
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TIPS MODAL */}
                {showTips && (
                    <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm" onClick={() => setShowTips(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl p-5 w-80 animate-in zoom-in-95 fade-in" onClick={e => e.stopPropagation()}>
                            <h4 className="font-black text-sm text-gray-800 mb-3 flex items-center gap-2">💡 功能建议 (可继续开发)</h4>
                            <div className="space-y-2 text-[11px] text-gray-600 font-bold">
                                {[
                                    ['🖼', '图片背景 / 公司 Logo 水印'],
                                    ['📌', '节点备注 / 注释气泡'],
                                    ['🎨', '自定义节点边框样式 (虚线、粗线)'],
                                    ['📎', '员工节点 → 显示电话 / 入职日期'],
                                    ['📐', '对齐辅助线 (靠近自动吸附)'],
                                    ['📤', '导出为 PNG 图片'],
                                    ['🔒', '节点锁定 (防止误移)'],
                                    ['🌙', '深色模式'],
                                    ['👥', '多人实时协作 (Firebase)'],
                                ].map(([icon, text]) => (
                                    <div key={text as string} className="flex items-start gap-2 p-2 bg-gray-50 rounded-xl">
                                        <span>{icon}</span><span>{text}</span>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setShowTips(false)} className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-xl text-[11px] font-bold">关闭</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── ANALYTICS PANEL ─────────────────────────────────────
const AnalyticsPanel: React.FC<{ employees: Employee[] }> = ({ employees }) => {
    const active = employees.filter(e => !e.isArchived && !e.role.includes('Owner'));

    const totalCost   = active.reduce((s, e) => s + (e.basicSalary || 0), 0);
    const localCount  = active.filter(e => (e.nationality ?? '').toLowerCase().includes('malaysian')).length;
    const foreignCount = active.length - localCount;

    const roleMap: Record<string, { count: number; total: number; names: { name: string; salary: number }[] }> = {};
    active.forEach(e => {
        const role = e.role.split('(')[0].trim();
        if (!roleMap[role]) roleMap[role] = { count: 0, total: 0, names: [] };
        roleMap[role].count++;
        roleMap[role].total += e.basicSalary || 0;
        roleMap[role].names.push({ name: e.name, salary: e.basicSalary || 0 });
    });
    const roles = Object.entries(roleMap).sort((a, b) => b[1].total - a[1].total);

    const natMap: Record<string, number> = {};
    active.forEach(e => { const n = e.nationality || 'Unknown'; natMap[n] = (natMap[n] || 0) + 1; });
    const natList = Object.entries(natMap).sort((a, b) => b[1] - a[1]);

    const StatCard = ({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) => (
        <div className={`rounded-2xl p-5 border ${accent ? 'bg-white border-gray-200' : 'bg-white border-gray-200'}`}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-black ${accent ? 'text-emerald-600' : 'text-[#1A1A1A]'}`}>{value}</p>
            {sub && <p className="text-[10px] text-gray-400 font-bold mt-1">{sub}</p>}
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto bg-[#F0F2F5] p-5 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="总人数" value={active.length.toString()} sub="Active staff" />
                <StatCard label="月薪总成本" value={`RM ${totalCost.toLocaleString()}`} sub="Monthly payroll" accent />
                <StatCard label="本地员工" value={localCount.toString()} sub={`${Math.round(localCount / Math.max(active.length, 1) * 100)}% of total`} />
                <StatCard label="外籍员工" value={foreignCount.toString()} sub={`${Math.round(foreignCount / Math.max(active.length, 1) * 100)}% of total`} />
            </div>

            <div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BarChart2 size={13} /> 职位详情
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {roles.map(([role, data]) => (
                        <div key={role} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <div>
                                    <p className="text-sm font-black text-[#1A1A1A]">{role}</p>
                                    <p className="text-[10px] text-gray-400 font-bold">RM {data.total.toLocaleString()}/mo</p>
                                </div>
                                <div className="w-7 h-7 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0">{data.count}</div>
                            </div>
                            <div className="px-4 py-2 space-y-1.5">
                                {data.names.map((n, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                            <span className="text-[11px] font-bold text-gray-600 truncate">{n.name}</span>
                                        </div>
                                        <span className="text-[11px] font-mono font-bold text-gray-500 shrink-0 ml-2">RM {n.salary.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Globe size={13} /> 国籍分布
                </h3>
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {natList.map(([nat, cnt], i) => {
                        const pct = Math.round(cnt / Math.max(active.length, 1) * 100);
                        return (
                            <div key={nat} className={`flex items-center gap-3 px-4 py-3 ${i < natList.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                <span className="text-sm font-bold text-gray-700 w-40 shrink-0 truncate">{nat}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div className="h-2 rounded-full bg-[#1A1A1A]" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-black text-gray-500 w-12 text-right shrink-0">{cnt} <span className="text-gray-300">({pct}%)</span></span>
                            </div>
                        );
                    })}
                    {!natList.length && <p className="text-xs text-gray-300 italic text-center py-6">暂无数据</p>}
                </div>
            </div>

            <div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <DollarSign size={13} /> 薪资区间分布
                </h3>
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {[
                        { label: '≥ RM 4,000', filter: (s: number) => s >= 4000, color: 'bg-purple-500' },
                        { label: 'RM 3,000 – 3,999', filter: (s: number) => s >= 3000 && s < 4000, color: 'bg-indigo-500' },
                        { label: 'RM 2,000 – 2,999', filter: (s: number) => s >= 2000 && s < 3000, color: 'bg-blue-400' },
                        { label: 'RM 1,000 – 1,999', filter: (s: number) => s >= 1000 && s < 2000, color: 'bg-emerald-400' },
                        { label: '< RM 1,000 / Hourly', filter: (s: number) => s < 1000, color: 'bg-gray-300' },
                    ].map((band, i, arr) => {
                        const cnt = active.filter(e => band.filter(e.basicSalary || 0)).length;
                        const pct = Math.round(cnt / Math.max(active.length, 1) * 100);
                        return (
                            <div key={band.label} className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                <div className={`w-2.5 h-2.5 rounded-full ${band.color} shrink-0`} />
                                <span className="text-[11px] font-bold text-gray-600 w-44 shrink-0">{band.label}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div className={`h-2 rounded-full ${band.color}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-black text-gray-500 w-14 text-right shrink-0">{cnt} 人 <span className="text-gray-300">({pct}%)</span></span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─── HELPERS ─────────────────────────────────────────────
const TBtn: React.FC<{ active: boolean; onClick: () => void; title: string; children: React.ReactNode }> = ({ active, onClick, title, children }) => (
    <button onClick={onClick} title={title}
        className={`p-1.5 rounded-lg transition-all ${active ? 'bg-[#FFD700] text-black' : 'text-white hover:bg-white/10'}`}>
        {children}
    </button>
);
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">{children}</span>
);
const DelBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button onClick={onClick} className="w-full bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 rounded-xl py-1.5 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all">
        <Trash2 size={10} /> 删除节点
    </button>
);
const Checkbox: React.FC<{ checked: boolean }> = ({ checked }) => (
    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 bg-white'}`}>
        {checked && <Check size={9} className="text-white" />}
    </div>
);
const Toggle: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
    <button onClick={onClick}
        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl border transition-all ${active ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200 hover:border-emerald-200'}`}>
        <span className={`text-[10px] font-bold ${active ? 'text-emerald-700' : 'text-gray-500'}`}>{label}</span>
        <div className={`w-8 h-4 rounded-full transition-all flex items-center ${active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-all mx-0.5 ${active ? 'translate-x-4' : ''}`} />
        </div>
    </button>
);