import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Heart, Package, AlertTriangle, TrendingUp, Plus, Save, Trash2, ArrowUpDown, X, ClipboardCheck, Map, BookOpen, Video, Link2, FileText, Award, Loader2 } from "lucide-react";

/**
 * P15 #5 — Módulo Kit de Primeiros Socorros (NR-07 item 7.5.1).
 * Múltiplos kits por unidade/setor, controle de estoque com movimentações,
 * alertas de validade e estoque mínimo, indicadores.
 */
export default function AdminFirstAid() {
  const [tab, setTab] = useState<"kits" | "alertas" | "movimentos" | "dashboard" | "aprendizagem" | "relatorio">("dashboard");
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Heart size={22} className="text-rose-500" /> Kit de Primeiros Socorros — NR-07</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de estoque, validade e movimentação dos materiais obrigatórios.</p>
        </header>
        <div className="flex gap-1 border-b">
          {([["dashboard", "Painel", TrendingUp], ["aprendizagem", "Aprendizagem", BookOpen], ["relatorio", "Relatório", FileText], ["kits", "Kits & Itens", Package], ["alertas", "Alertas", AlertTriangle], ["movimentos", "Movimentações", ArrowUpDown]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <span className="inline-flex items-center gap-1.5"><Icon size={14} /> {label}</span>
            </button>
          ))}
        </div>
        {tab === "dashboard" && <DashboardTab />}
        {tab === "aprendizagem" && <LearningTab />}
        {tab === "relatorio" && <ReportTab />}
        {tab === "kits" && <KitsTab />}
        {tab === "alertas" && <AlertsTab />}
        {tab === "movimentos" && <MovementsTab />}
      </div>
    </AppLayout>
  );
}

function ReportTab() {
  const q = (trpc.firstaid as any).report.useQuery();
  const pdfMut = (trpc.firstaid as any).generateReportPdf.useMutation({
    onSuccess: (r: any) => {
      if (r?.url) window.open(r.url, "_blank");
      toast.success("PDF do relatório gerado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF."),
  });
  const d = q.data as any;
  if (!d) return <p className="text-sm text-slate-400 mt-4">Carregando…</p>;
  const cards = [
    { label: "Kits ativos", value: d.summary?.kits ?? 0, c: "bg-blue-50 text-blue-800 border-blue-200" },
    { label: "Itens", value: d.summary?.items ?? 0, c: "bg-slate-50 text-slate-800 border-slate-200" },
    { label: "Vencidos", value: d.summary?.expired ?? 0, c: "bg-rose-50 text-rose-800 border-rose-200" },
    { label: "Vence em 30 dias", value: d.summary?.soon30 ?? 0, c: "bg-amber-50 text-amber-800 border-amber-200" },
    { label: "Faltantes", value: d.summary?.missing ?? 0, c: "bg-orange-50 text-orange-800 border-orange-200" },
    { label: "Estoque crítico", value: d.summary?.critical ?? 0, c: "bg-red-50 text-red-800 border-red-200" },
  ];
  const rows = (d.rows ?? []) as any[];
  const statusLabel: Record<string, string> = {
    ok: "Regular",
    vencido: "Vencido",
    vence_30d: "Vence em 30 dias",
    faltante: "Faltante",
    estoque_critico: "Estoque crítico",
    sem_itens: "Kit sem itens",
  };
  const statusClass = (status: string) => {
    if (status === "vencido" || status === "faltante") return "bg-rose-50 text-rose-700 border-rose-200";
    if (status === "vence_30d" || status === "estoque_critico") return "bg-amber-50 text-amber-700 border-amber-200";
    if (status === "sem_itens") return "bg-slate-50 text-slate-600 border-slate-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };
  const fmtDate = (d0: any) => d0 ? new Date(d0).toLocaleDateString("pt-BR") : "—";
  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <button onClick={() => pdfMut.mutate()} disabled={pdfMut.isPending} className="px-3 py-1.5 border rounded text-sm font-semibold flex items-center gap-1.5 bg-white hover:bg-slate-50 disabled:opacity-60">
          {pdfMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Imprimir PDF
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`border rounded-xl p-4 ${c.c}`}>
            <div className="text-xs uppercase tracking-wide font-semibold opacity-80">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
      {(d.byLocation ?? []).length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Map size={14} /> Visão por filial e setor</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left p-2">Filial</th><th className="text-left p-2">Setor</th><th className="p-2">Kits</th><th className="p-2">Itens</th><th className="p-2">Vencidos</th><th className="p-2">30 dias</th><th className="p-2">Faltantes</th><th className="p-2">Críticos</th></tr></thead>
              <tbody>
                {(d.byLocation ?? []).map((r: any, i: number) => (
                  <tr key={`${r.branchName}-${r.sectorName}-${i}`} className="border-t">
                    <td className="p-2">{r.branchName}</td><td className="p-2">{r.sectorName}</td><td className="p-2 text-center">{r.kits}</td><td className="p-2 text-center">{r.items}</td><td className="p-2 text-center">{r.expired}</td><td className="p-2 text-center">{r.soon30}</td><td className="p-2 text-center">{r.missing}</td><td className="p-2 text-center">{r.critical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="p-4 border-b">
          <p className="text-sm font-semibold">Inventário completo dos kits</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left p-2">Kit</th><th className="text-left p-2">Filial</th><th className="text-left p-2">Setor</th><th className="text-left p-2">Item</th><th className="p-2">Qtd</th><th className="p-2">Mín.</th><th className="p-2">Validade</th><th className="p-2">Status</th></tr></thead>
            <tbody>
              {rows.map((r: any, i: number) => (
                <tr key={`${r.kitId}-${r.itemId ?? "kit"}-${i}`} className="border-t">
                  <td className="p-2">{r.kitName}</td>
                  <td className="p-2">{r.branchName}</td>
                  <td className="p-2">{r.sectorName}</td>
                  <td className="p-2">{r.itemName ?? "—"}</td>
                  <td className="p-2 text-center">{r.itemId ? `${r.quantity} ${r.unit ?? "un"}` : "—"}</td>
                  <td className="p-2 text-center">{r.itemId ? r.minQuantity : "—"}</td>
                  <td className="p-2 text-center">{fmtDate(r.expiryDate)}</td>
                  <td className="p-2 text-center"><span className={`inline-flex rounded-full border px-2 py-0.5 ${statusClass(r.status)}`}>{statusLabel[r.status] ?? r.status}</span></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-sm text-slate-400">Nenhum kit cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DashboardTab() {
  const q = (trpc.firstaid as any).dashboard.useQuery();
  const d = q.data as any;
  if (!d) return <p className="text-sm text-slate-400 mt-4">Carregando…</p>;
  const cards = [
    { label: "Kits ativos", value: d.totalKits, c: "bg-blue-50 text-blue-800 border-blue-200" },
    { label: "Itens cadastrados", value: d.totalItens, c: "bg-slate-50 text-slate-800 border-slate-200" },
    { label: "Vencidos", value: d.vencidos, c: "bg-rose-50 text-rose-800 border-rose-200" },
    { label: "Próximos do vencimento (30d)", value: d.proximosVencimento, c: "bg-amber-50 text-amber-800 border-amber-200" },
    { label: "Estoque crítico", value: d.estoqueCritico, c: "bg-orange-50 text-orange-800 border-orange-200" },
    { label: "Movimentações este mês", value: d.movimentacoesMes, c: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  ];
  return (
    <div className="space-y-4 mt-4">
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`border rounded-xl p-4 ${c.c}`}>
            <div className="text-xs uppercase tracking-wide font-semibold opacity-80">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
      {d.porFilial?.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Map size={14} /> Mapa de calor por filial</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {d.porFilial.map((f: any) => {
              const severity = f.vencidos > 0 ? "critico" : f.proximos > 0 || f.criticos > 0 ? "atencao" : "ok";
              const cls = severity === "critico" ? "bg-rose-100 border-rose-300 text-rose-800"
                : severity === "atencao" ? "bg-amber-100 border-amber-300 text-amber-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800";
              return (
                <div key={f.branchId} className={`border rounded-lg p-3 ${cls}`}>
                  <div className="font-semibold text-sm truncate">{f.branchName}</div>
                  <div className="text-xs mt-1 opacity-80">{f.kits} kit(s)</div>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span>Vencidos: <b>{f.vencidos}</b></span>
                    <span>Próx. 30d: <b>{f.proximos}</b></span>
                    <span>Crít.: <b>{f.criticos}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {d.itensMaisUsados?.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm font-semibold mb-2">Itens mais utilizados</p>
          {d.itensMaisUsados.map((it: any, i: number) => (
            <div key={i} className="flex justify-between border-b py-1 text-sm"><span>{it.name}</span><b>{it.total} usos</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

function KitsTab() {
  const q = (trpc.firstaid as any).listKits.useQuery();
  const kits = (q.data ?? []) as any[];
  const upMut = (trpc.firstaid as any).upsertKit.useMutation({ onSuccess: () => { q.refetch(); toast.success("Kit salvo."); setEditing(null); setOpen(false); } });
  const delMut = (trpc.firstaid as any).removeKit.useMutation({ onSuccess: () => q.refetch() });
  const inspMut = (trpc.firstaid as any).registerInspection.useMutation({ onSuccess: () => { q.refetch(); toast.success("Inspeção registrada."); } });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  function handleInspect(kit: any) {
    const name = window.prompt("Nome de quem está registrando a inspeção:", "");
    if (!name?.trim()) return;
    inspMut.mutate({ kitId: kit.id, inspectedBy: name.trim() });
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setOpen(true); }} className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-sm font-semibold flex items-center gap-1"><Plus size={13} /> Novo kit</button>
      </div>
      {kits.map((k: any) => (
        <div key={k.id} className="bg-white border rounded-xl">
          <div className="p-3 flex justify-between items-center cursor-pointer" onClick={() => setExpanded(expanded === k.id ? null : k.id)}>
            <div>
              <b>{k.name}</b>
              {k.location && <span className="text-xs text-slate-500 ml-2">📍 {k.location}</span>}
              {k.responsible_name && <span className="text-xs text-slate-500 ml-2">👤 {k.responsible_name}</span>}
              {k.last_inspected_date
                ? <span className="text-xs text-emerald-600 ml-2">✓ Inspecionado em {k.last_inspected_date.slice(0, 10).split("-").reverse().join("/")}{k.last_inspected_by ? ` por ${k.last_inspected_by}` : ""}</span>
                : <span className="text-xs text-amber-600 ml-2">⚠ Nunca inspecionado</span>}
            </div>
            <div className="flex gap-1 items-center">
              <button onClick={(e) => { e.stopPropagation(); handleInspect(k); }} className="text-xs text-emerald-600 hover:underline flex items-center gap-0.5"><ClipboardCheck size={11} /> Registrar inspeção</button>
              <button onClick={(e) => { e.stopPropagation(); setEditing(k); setOpen(true); }} className="text-xs text-blue-600 hover:underline ml-2">Editar</button>
              <button onClick={(e) => { e.stopPropagation(); if (confirm("Remover kit?")) delMut.mutate({ id: k.id }); }} className="text-xs text-rose-500 hover:underline">Remover</button>
            </div>
          </div>
          {expanded === k.id && <ItemsPanel kitId={k.id} />}
        </div>
      ))}
      {kits.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhum kit cadastrado.</p>}
      {open && <KitForm initial={editing} onClose={() => { setOpen(false); setEditing(null); }} onSubmit={(d: any) => upMut.mutate(d)} />}
    </div>
  );
}

function KitForm({ initial, onClose, onSubmit }: any) {
  const treeQ = trpc.lessons.hierarchyTree.useQuery();
  const branches = (treeQ.data ?? []).flatMap((c: any) => c.branches ?? []);
  const [f, setF] = useState({
    id: initial?.id, name: initial?.name ?? "", location: initial?.location ?? "",
    responsibleName: initial?.responsible_name ?? "",
    branchId: initial?.branch_id ?? null, sectorId: initial?.sector_id ?? null,
    photoUrl: initial?.photo_url ?? "",
  });
  const sectors = branches.find((b: any) => b.branch.id === f.branchId)?.sectors ?? [];
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{initial ? "Editar" : "Novo"} kit</h3>
        <L l="Nome *"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex.: Kit Administrativo" className="w-full border rounded px-2 py-1.5" /></L>
        <L l="Localização"><input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="Sala/andar/veículo" className="w-full border rounded px-2 py-1.5" /></L>
        <div className="grid grid-cols-2 gap-3">
          <L l="Filial">
            <select value={f.branchId ?? ""} onChange={e => setF({ ...f, branchId: e.target.value ? Number(e.target.value) : null, sectorId: null })} className="w-full border rounded px-2 py-1.5">
              <option value="">—</option>
              {branches.map((b: any) => <option key={b.branch.id} value={b.branch.id}>{b.branch.name}</option>)}
            </select>
          </L>
          <L l="Setor">
            <select value={f.sectorId ?? ""} onChange={e => setF({ ...f, sectorId: e.target.value ? Number(e.target.value) : null })} className="w-full border rounded px-2 py-1.5" disabled={!f.branchId}>
              <option value="">—</option>
              {sectors.map((s: any) => <option key={s.sector.id} value={s.sector.id}>{s.sector.name}</option>)}
            </select>
          </L>
        </div>
        <L l="Responsável (nome da pessoa capacitada)"><input value={f.responsibleName} onChange={e => setF({ ...f, responsibleName: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
        <L l="URL da foto do kit (opcional)"><input value={f.photoUrl} onChange={e => setF({ ...f, photoUrl: e.target.value })} placeholder="https://..." className="w-full border rounded px-2 py-1.5" /></L>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-3 py-1.5 border rounded text-sm">Cancelar</button>
          <button onClick={() => { if (!f.name.trim()) return toast.error("Nome obrigatório"); onSubmit(f); }} className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-sm font-semibold flex items-center gap-1"><Save size={13} /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ItemsPanel({ kitId }: { kitId: number }) {
  const q = (trpc.firstaid as any).listItems.useQuery({ kitId });
  const items = (q.data ?? []) as any[];
  const upMut = (trpc.firstaid as any).upsertItem.useMutation({ onSuccess: () => { q.refetch(); toast.success("Item salvo."); setEditing(null); setOpen(false); } });
  const delMut = (trpc.firstaid as any).removeItem.useMutation({ onSuccess: () => q.refetch() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [movingItem, setMovingItem] = useState<any>(null);
  return (
    <div className="border-t p-3 bg-slate-50 space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-sm font-semibold text-slate-700">Itens do kit</p>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="text-xs px-2 py-1 bg-rose-500 text-white rounded flex items-center gap-1"><Plus size={11} /> Adicionar item</button>
      </div>
      <table className="w-full text-xs bg-white border rounded">
        <thead className="bg-slate-50"><tr><th className="text-left p-2">Nome</th><th className="p-2">Qtd</th><th className="p-2">Mín</th><th className="p-2">Validade</th><th className="p-2">Ação</th></tr></thead>
        <tbody>
          {items.map((it: any) => {
            const vencido = it.expiry_date && new Date(it.expiry_date) < new Date();
            const critico = it.min_quantity > 0 && it.quantity <= it.min_quantity;
            return (
              <tr key={it.id} className={`border-t ${vencido ? "bg-rose-50" : critico ? "bg-orange-50" : ""}`}>
                <td className="p-2">{it.name}{it.category && <span className="text-slate-400 text-[10px] ml-1">({it.category})</span>}</td>
                <td className="p-2 text-center">{it.quantity} {it.unit}</td>
                <td className="p-2 text-center">{it.min_quantity}</td>
                <td className="p-2 text-center">{it.expiry_date?.slice(0, 10) ?? "—"}{vencido && <span className="ml-1 text-rose-600">⚠</span>}</td>
                <td className="p-2 text-right space-x-2">
                  <button onClick={() => setMovingItem(it)} className="text-blue-600 hover:underline">Movimentar</button>
                  <button onClick={() => { setEditing(it); setOpen(true); }} className="text-slate-500 hover:underline">Editar</button>
                  <button onClick={() => { if (confirm("Remover item?")) delMut.mutate({ id: it.id }); }} className="text-rose-500 hover:underline">Remover</button>
                </td>
              </tr>
            );
          })}
          {items.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-slate-400">Nenhum item cadastrado.</td></tr>}
        </tbody>
      </table>
      {open && <ItemForm kitId={kitId} initial={editing} onClose={() => { setOpen(false); setEditing(null); }} onSubmit={(d: any) => upMut.mutate(d)} />}
      {movingItem && <MovementForm item={movingItem} onClose={() => setMovingItem(null)} onDone={() => { q.refetch(); setMovingItem(null); }} />}
    </div>
  );
}

function ItemForm({ kitId, initial, onClose, onSubmit }: any) {
  const [f, setF] = useState({
    id: initial?.id, kitId, name: initial?.name ?? "", category: initial?.category ?? "",
    quantity: Number(initial?.quantity ?? 0), minQuantity: Number(initial?.min_quantity ?? 0),
    unit: initial?.unit ?? "un", lot: initial?.lot ?? "", manufacturer: initial?.manufacturer ?? "", supplier: initial?.supplier ?? "",
    purchaseDate: initial?.purchase_date?.slice(0, 10) ?? "", expiryDate: initial?.expiry_date?.slice(0, 10) ?? "",
    notes: initial?.notes ?? "",
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{initial ? "Editar" : "Novo"} item</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2"><L l="Nome *"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex.: Gaze estéril" className="w-full border rounded px-2 py-1.5" /></L></div>
          <L l="Categoria"><select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className="w-full border rounded px-2 py-1.5"><option value="">—</option><option>Equipamento de Proteção</option><option>Assepsia</option><option>Curativos</option><option>Instrumentos</option><option>Outros</option></select></L>
          <L l="Unidade"><input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Quantidade atual"><input type="number" min={0} value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value || 0) })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Estoque mínimo"><input type="number" min={0} value={f.minQuantity} onChange={e => setF({ ...f, minQuantity: Number(e.target.value || 0) })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Lote"><input value={f.lot} onChange={e => setF({ ...f, lot: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Fabricante"><input value={f.manufacturer} onChange={e => setF({ ...f, manufacturer: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Fornecedor"><input value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Data compra"><input type="date" value={f.purchaseDate} onChange={e => setF({ ...f, purchaseDate: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Validade"><input type="date" value={f.expiryDate} onChange={e => setF({ ...f, expiryDate: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <div className="col-span-2"><L l="Observações"><textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} rows={2} className="w-full border rounded px-2 py-1.5" /></L></div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-3 py-1.5 border rounded text-sm">Cancelar</button>
          <button onClick={() => { if (!f.name.trim()) return toast.error("Nome obrigatório"); onSubmit(f); }} className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-sm font-semibold flex items-center gap-1"><Save size={13} /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

function MovementForm({ item, onClose, onDone }: { item: any; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ movementType: "uso", quantity: 1, justification: "", incidentLocation: "", collaboratorEmail: "" });
  const mut = (trpc.firstaid as any).registerMovement.useMutation({
    onSuccess: (r: any) => { toast.success(`Movimentação registrada. Novo estoque: ${r.newQuantity} ${item.unit}`); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold flex items-center gap-2"><ArrowUpDown size={16} /> Movimentar: {item.name}</h3>
        <p className="text-xs text-slate-500">Estoque atual: <b>{item.quantity} {item.unit}</b></p>
        <L l="Tipo de movimentação">
          <select value={f.movementType} onChange={e => setF({ ...f, movementType: e.target.value })} className="w-full border rounded px-2 py-1.5">
            <option value="uso">Utilização (atendimento)</option>
            <option value="entrada">Entrada / Reposição</option>
            <option value="perda">Perda</option>
            <option value="descarte_vencimento">Descarte por vencimento</option>
            <option value="ajuste">Ajuste de inventário</option>
          </select>
        </L>
        <L l="Quantidade"><input type="number" min={1} value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value || 1) })} className="w-full border rounded px-2 py-1.5" /></L>
        {f.movementType === "uso" && (
          <>
            <L l="Local da ocorrência"><input value={f.incidentLocation} onChange={e => setF({ ...f, incidentLocation: e.target.value })} placeholder="Ex.: Setor Produção" className="w-full border rounded px-2 py-1.5" /></L>
            <L l="E-mail do colaborador atendido (opcional)"><input value={f.collaboratorEmail} onChange={e => setF({ ...f, collaboratorEmail: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          </>
        )}
        <L l="Justificativa / observações"><textarea value={f.justification} onChange={e => setF({ ...f, justification: e.target.value })} rows={2} className="w-full border rounded px-2 py-1.5" /></L>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-3 py-1.5 border rounded text-sm">Cancelar</button>
          <button onClick={() => mut.mutate({ itemId: item.id, ...f })} disabled={mut.isPending} className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-sm font-semibold">Registrar</button>
        </div>
      </div>
    </div>
  );
}

function AlertsTab() {
  const q = (trpc.firstaid as any).alerts.useQuery();
  const d = q.data as any;
  if (!d) return <p className="text-sm text-slate-400 mt-4">Carregando…</p>;
  // P18 GRANDE — alertas escalonados (Bruno): vencido > 7d > 15d > 30d > 60d, severidade decrescente.
  const groups = [
    { title: "Vencidos", cls: "text-rose-700 bg-rose-50 border-rose-200", items: d.vencidos },
    { title: "Vencendo em até 7 dias", cls: "text-rose-700 bg-rose-50 border-rose-200", items: d.d7 },
    { title: "Vencendo em até 15 dias", cls: "text-amber-700 bg-amber-50 border-amber-200", items: d.d15 },
    { title: "Vencendo em até 30 dias", cls: "text-amber-700 bg-amber-50 border-amber-200", items: d.d30 },
    { title: "Vencendo em até 60 dias", cls: "text-sky-700 bg-sky-50 border-sky-200", items: d.d60 },
    { title: "Estoque crítico (abaixo do mínimo)", cls: "text-orange-700 bg-orange-50 border-orange-200", items: d.criticos },
  ];
  return (
    <div className="mt-4 space-y-4">
      {groups.map(g => (
        <div key={g.title} className={`border rounded-xl p-4 ${g.cls}`}>
          <p className="font-semibold mb-2">{g.title} — {g.items.length}</p>
          {g.items.length === 0 ? <p className="text-sm opacity-70">Nenhum item.</p> : (
            <div className="space-y-1">
              {g.items.map((it: any) => (
                <div key={it.id} className="flex justify-between text-sm bg-white/60 rounded px-2 py-1">
                  <span>{it.kit_name}{it.branch_name ? ` (${it.branch_name})` : ""} — <b>{it.name}</b></span>
                  <span className="text-xs">Qtd {it.quantity}{it.expiry_date ? ` · val ${it.expiry_date.slice(0, 10)}` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MovementsTab() {
  const kitsQ = (trpc.firstaid as any).listKits.useQuery();
  const [kitId, setKitId] = useState<number | null>(null);
  const q = (trpc.firstaid as any).listMovements.useQuery(kitId ? { kitId } : {});
  const items = (q.data ?? []) as any[];
  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        <select value={kitId ?? ""} onChange={e => setKitId(e.target.value ? Number(e.target.value) : null)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">Todos os kits</option>
          {(kitsQ.data ?? []).map((k: any) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </div>
      <table className="w-full text-xs bg-white border rounded">
        <thead className="bg-slate-50"><tr><th className="text-left p-2">Data</th><th className="text-left p-2">Item</th><th className="p-2">Tipo</th><th className="p-2">Qtd</th><th className="text-left p-2">Responsável</th><th className="text-left p-2">Obs.</th></tr></thead>
        <tbody>
          {items.map((m: any) => (
            <tr key={m.id} className="border-t">
              <td className="p-2">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
              <td className="p-2">{m.item_name}</td>
              <td className="p-2 text-center capitalize">{m.movement_type.replace("_", " ")}</td>
              <td className="p-2 text-center">{m.quantity}</td>
              <td className="p-2">{m.user_name}</td>
              <td className="p-2 text-slate-500">{m.justification ?? "—"}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-slate-400">Nenhuma movimentação registrada.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function LearningTab() {
  const q = (trpc.firstaid as any).listLearningAdmin.useQuery();
  const dashboardQ = (trpc.firstaid as any).learningDashboard.useQuery();
  const contents = (q.data ?? []) as any[];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const upMut = (trpc.firstaid as any).upsertLearningContent.useMutation({
    onSuccess: () => {
      q.refetch();
      dashboardQ.refetch();
      setOpen(false);
      setEditing(null);
      toast.success("Conteudo salvo.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar conteudo."),
  });
  const delMut = (trpc.firstaid as any).removeLearningContent.useMutation({
    onSuccess: () => {
      q.refetch();
      dashboardQ.refetch();
      toast.success("Conteudo removido.");
    },
  });
  return (
    <div className="mt-4 space-y-4">
      <LearningDashboard data={dashboardQ.data as any} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Noções de Primeiros Socorros</h2>
          <p className="text-sm text-slate-500">Cursos, materiais, vídeos e links exibidos na área do colaborador.</p>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold flex items-center gap-1">
          <Plus size={13} /> Novo conteúdo
        </button>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="text-left p-3">Conteúdo</th><th className="p-3">Tipo</th><th className="p-3">Obrig.</th><th className="p-3">Iniciados</th><th className="p-3">Concluídos</th><th className="p-3">Cert.</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {contents.map((c: any) => {
              const Icon = contentIcon(c.contentType);
              return (
                <tr key={c.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-50 text-emerald-700"><Icon size={15} /></span>
                      <div>
                        <div className="font-medium text-slate-900">{c.title}</div>
                        {c.description && <div className="text-xs text-slate-500 line-clamp-1">{c.description}</div>}
                        {c.moduleTitle && <div className="text-xs text-emerald-700">Curso: {c.moduleTitle}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center">{contentTypeLabel(c.contentType)}</td>
                  <td className="p-3 text-center">{c.isRequired ? "Sim" : "Não"}</td>
                  <td className="p-3 text-center">{c.startedCount}</td>
                  <td className="p-3 text-center">{c.completedCount}</td>
                  <td className="p-3 text-center">{c.certificatesCount}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => { setEditing(c); setOpen(true); }} className="text-xs text-blue-600 hover:underline mr-3">Editar</button>
                    <button onClick={() => { if (confirm("Remover conteúdo?")) delMut.mutate({ id: c.id }); }} className="text-xs text-rose-600 hover:underline">Remover</button>
                  </td>
                </tr>
              );
            })}
            {contents.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-sm text-slate-400">Nenhum conteúdo educativo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <LearningForm initial={editing} onClose={() => { setOpen(false); setEditing(null); }} onSubmit={(data: any) => upMut.mutate(data)} />}
    </div>
  );
}

function LearningDashboard({ data }: { data: any }) {
  const d = data ?? {};
  const cards = [
    { label: "Colaboradores treinados", value: d.trainedEmployees ?? 0, c: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    { label: "Pendentes", value: d.pendingEmployees ?? 0, c: "bg-amber-50 text-amber-800 border-amber-200" },
    { label: "Conclusão geral", value: `${d.completionRate ?? 0}%`, c: "bg-blue-50 text-blue-800 border-blue-200" },
    { label: "Certificados emitidos", value: d.certificatesIssued ?? 0, c: "bg-purple-50 text-purple-800 border-purple-200" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`border rounded-xl p-4 ${c.c}`}>
            <div className="text-xs uppercase tracking-wide font-semibold opacity-80">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
      {(d.byContent ?? []).length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Award size={14} /> Acompanhamento por conteúdo</p>
          <div className="space-y-2">
            {(d.byContent ?? []).slice(0, 8).map((r: any) => (
              <div key={r.id} className="grid grid-cols-[1fr_auto] gap-3 text-sm">
                <div>
                  <div className="font-medium text-slate-800">{r.title}</div>
                  <div className="h-2 rounded-full bg-slate-100 mt-1 overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${r.completionRate}%` }} /></div>
                </div>
                <div className="text-right text-xs text-slate-500">{r.completedCount}/{d.totalEmployees ?? 0}<br />{r.completionRate}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LearningForm({ initial, onClose, onSubmit }: any) {
  const coursesQ = (trpc.firstaid as any).listFirstAidCourseOptions.useQuery();
  const courses = (coursesQ.data ?? []) as any[];
  const [f, setF] = useState({
    id: initial?.id,
    contentType: initial?.contentType ?? "course",
    moduleId: initial?.moduleId ?? null,
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    url: initial?.url ?? "",
    fileUrl: initial?.fileUrl ?? "",
    fileName: initial?.fileName ?? "",
    mimeType: initial?.mimeType ?? "",
    provider: initial?.provider ?? "",
    isRequired: Boolean(initial?.isRequired),
    validityMonths: initial?.validityMonths ?? "",
    orderIndex: Number(initial?.orderIndex ?? 0),
  });
  function submit() {
    const selected = courses.find(c => c.id === Number(f.moduleId));
    const payload = {
      id: f.id,
      contentType: f.contentType,
      moduleId: f.contentType === "course" && f.moduleId ? Number(f.moduleId) : undefined,
      title: f.contentType === "course" && selected && !f.title.trim() ? selected.title : f.title.trim(),
      description: f.description.trim() || undefined,
      url: f.url.trim() || undefined,
      fileUrl: f.fileUrl.trim() || undefined,
      fileName: f.fileName.trim() || undefined,
      mimeType: f.mimeType.trim() || undefined,
      provider: f.provider.trim() || undefined,
      isRequired: Boolean(f.isRequired),
      validityMonths: f.validityMonths === "" ? undefined : Number(f.validityMonths),
      orderIndex: Number(f.orderIndex || 0),
    };
    if (!payload.title) return toast.error("Informe um título.");
    onSubmit(payload);
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{initial ? "Editar" : "Novo"} conteúdo de primeiros socorros</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <L l="Tipo">
            <select value={f.contentType} onChange={e => setF({ ...f, contentType: e.target.value, moduleId: null })} className="w-full border rounded px-2 py-1.5">
              <option value="course">Curso da plataforma</option>
              <option value="material">Material complementar</option>
              <option value="video">Vídeo externo</option>
              <option value="link">Link externo</option>
            </select>
          </L>
          <L l="Ordem">
            <input type="number" value={f.orderIndex} onChange={e => setF({ ...f, orderIndex: Number(e.target.value || 0) })} className="w-full border rounded px-2 py-1.5" />
          </L>
          {f.contentType === "course" && (
            <div className="sm:col-span-2">
              <L l="Curso da plataforma">
                <select value={f.moduleId ?? ""} onChange={e => {
                  const moduleId = e.target.value ? Number(e.target.value) : null;
                  const course = courses.find(c => c.id === moduleId);
                  setF({ ...f, moduleId, title: course?.title ?? f.title });
                }} className="w-full border rounded px-2 py-1.5">
                  <option value="">Selecione...</option>
                  {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </L>
            </div>
          )}
          <div className="sm:col-span-2"><L l="Título"><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L></div>
          <div className="sm:col-span-2"><L l="Descrição"><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2} className="w-full border rounded px-2 py-1.5" /></L></div>
          {f.contentType !== "course" && (
            <>
              <div className="sm:col-span-2"><L l={f.contentType === "material" ? "URL do arquivo/material" : "URL"}><input value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="https://..." className="w-full border rounded px-2 py-1.5" /></L></div>
              <L l="Nome do arquivo"><input value={f.fileName} onChange={e => setF({ ...f, fileName: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
              <L l="Provedor / tipo"><input value={f.provider} onChange={e => setF({ ...f, provider: e.target.value })} placeholder="YouTube, Vimeo, PDF..." className="w-full border rounded px-2 py-1.5" /></L>
            </>
          )}
          <L l="Obrigatório">
            <label className="inline-flex items-center gap-2 border rounded px-2 py-1.5 w-full">
              <input type="checkbox" checked={f.isRequired} onChange={e => setF({ ...f, isRequired: e.target.checked })} />
              <span>Exigir conclusão do colaborador</span>
            </label>
          </L>
          <L l="Validade do treinamento (meses)">
            <input type="number" min={0} value={f.validityMonths} onChange={e => setF({ ...f, validityMonths: e.target.value })} placeholder="Opcional" className="w-full border rounded px-2 py-1.5" />
          </L>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
          Cursos da plataforma mantêm vídeos, avaliações, certificado e histórico. Materiais, vídeos e links externos geram evidência de início/conclusão nesta aba.
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-3 py-1.5 border rounded text-sm">Cancelar</button>
          <button onClick={submit} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold flex items-center gap-1"><Save size={13} /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

function contentIcon(type: string) {
  if (type === "course") return BookOpen;
  if (type === "video") return Video;
  if (type === "link") return Link2;
  return FileText;
}

function contentTypeLabel(type: string) {
  if (type === "course") return "Curso";
  if (type === "video") return "Vídeo";
  if (type === "link") return "Link";
  return "Material";
}

function L({ l, children }: any) {
  return <div><label className="text-xs font-semibold text-slate-700 block mb-1">{l}</label>{children}</div>;
}
