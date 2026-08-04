import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowUpDown, BookOpen, FileText,
  HardHat, Layers, Loader2, Package, Plus, Printer, Save, Search, Shield,
  Sparkles, Undo2, Users, X,
} from "lucide-react";

type TabId = "painel" | "cadastro" | "aprendizagem" | "entregas" | "devolucoes" | "estoque" | "alertas" | "relatorios" | "documentos" | "movimentacoes";

const api = (trpc as any).epiEpc;

export default function AdminEpiEpcManagement() {
  const [tab, setTab] = useState<TabId>("painel");
  const tabs: Array<[TabId, string, any]> = [
    ["painel", "Painel", Shield],
    ["cadastro", "EPI / EPC", HardHat],
    ["aprendizagem", "Aprendizagem", BookOpen],
    ["entregas", "Entregas", Users],
    ["devolucoes", "Devoluções / Substituições", Undo2],
    ["estoque", "Estoque", Package],
    ["alertas", "Alertas", AlertTriangle],
    ["relatorios", "Relatórios", FileText],
    ["documentos", "Documentos", FileText],
    ["movimentacoes", "Movimentações", ArrowUpDown],
  ];
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        <style>{`.field{width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:7px 8px;background:#fff;min-height:36px}.field:focus{outline:2px solid rgba(14,44,70,.16);border-color:#0E2C46}`}</style>
        <header className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardHat size={24} className="text-amber-600" /> Gestão de EPI / EPC — NR-06
          </h1>
          <p className="text-sm text-muted-foreground">Gestão digital sem papel: cadastro, PGR/GSE, treinamento, entrega, assinatura, estoque, alertas, documentos e Anexo 8 do PGR.</p>
        </header>
        <div className="flex gap-1 border-b overflow-x-auto">
          {tabs.map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === k ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <span className="inline-flex items-center gap-1.5"><Icon size={14} /> {label}</span>
            </button>
          ))}
        </div>
        {tab === "painel" && <DashboardTab />}
        {tab === "cadastro" && <AssetsTab />}
        {tab === "aprendizagem" && <LearningTab />}
        {tab === "entregas" && <DeliveriesTab />}
        {tab === "devolucoes" && <ReturnsTab />}
        {tab === "estoque" && <StockTab />}
        {tab === "alertas" && <AlertsTab />}
        {tab === "relatorios" && <ReportsTab />}
        {tab === "documentos" && <DocumentsTab />}
        {tab === "movimentacoes" && <MovementsTab />}
      </div>
    </AppLayout>
  );
}

function DashboardTab() {
  const q = api.dashboard.useQuery();
  const d = q.data ?? {};
  const cards = [
    ["EPIs cadastrados", d.epis ?? 0, "bg-blue-50 text-blue-800 border-blue-200"],
    ["EPCs cadastrados", d.epcs ?? 0, "bg-slate-50 text-slate-800 border-slate-200"],
    ["Vinculados ao PGR", d.linkedToPgr ?? 0, "bg-emerald-50 text-emerald-800 border-emerald-200"],
    ["Não vinculados ao PGR", d.notLinkedToPgr ?? 0, "bg-amber-50 text-amber-800 border-amber-200"],
    ["CAs válidos", d.caValid ?? 0, "bg-emerald-50 text-emerald-800 border-emerald-200"],
    ["CAs próximos", d.caSoon ?? 0, "bg-yellow-50 text-yellow-800 border-yellow-200"],
    ["CAs vencidos", d.caExpired ?? 0, "bg-rose-50 text-rose-800 border-rose-200"],
    ["Produto próximo", d.productSoon ?? 0, "bg-yellow-50 text-yellow-800 border-yellow-200"],
    ["Produto vencido", d.productExpired ?? 0, "bg-rose-50 text-rose-800 border-rose-200"],
    ["Estoque crítico", d.stockCritical ?? 0, "bg-orange-50 text-orange-800 border-orange-200"],
    ["Entregas no mês", d.deliveriesMonth ?? 0, "bg-cyan-50 text-cyan-800 border-cyan-200"],
    ["Pendentes assinatura", d.pendingSignature ?? 0, "bg-amber-50 text-amber-800 border-amber-200"],
    ["Trabalhadores pendentes", d.workersWithPending ?? 0, "bg-orange-50 text-orange-800 border-orange-200"],
    ["Treinamentos pendentes", d.trainingPending ?? 0, "bg-purple-50 text-purple-800 border-purple-200"],
    ["Treinamentos vencidos", d.trainingExpired ?? 0, "bg-rose-50 text-rose-800 border-rose-200"],
  ];
  if (q.isLoading) return <Loading />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
      {cards.map(([label, value, cls]) => (
        <div key={label} className={`border rounded-xl p-4 ${cls}`}>
          <div className="text-xs uppercase tracking-wide font-semibold opacity-80">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
      ))}
    </div>
  );
}

function AssetsTab() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"todos" | "epi" | "epc">("todos");
  const q = api.listAssets.useQuery({ type, search });
  const assets = q.data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const del = api.removeAsset.useMutation({ onSuccess: () => { q.refetch(); toast.success("Cadastro removido."); } });
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <select value={type} onChange={e => setType(e.target.value as any)} className="border rounded px-2 py-1.5 text-sm">
            <option value="todos">Todos</option><option value="epi">EPI</option><option value="epc">EPC</option>
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar descrição, CA ou categoria" className="border rounded pl-7 pr-2 py-1.5 text-sm w-72" />
          </div>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-semibold flex items-center gap-1"><Plus size={13} /> Novo EPI/EPC</button>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr><th className="text-left p-2">Tipo</th><th className="text-left p-2">Descrição</th><th className="p-2">CA</th><th className="p-2">Val. CA</th><th className="p-2">Val. produto</th><th className="p-2">Estoque</th><th className="p-2">PGR/GSE</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {assets.map((a: any) => (
              <tr key={a.id} className="border-t">
                <td className="p-2"><Badge tone={a.type === "epi" ? "blue" : "slate"}>{String(a.type).toUpperCase()}</Badge></td>
                <td className="p-2"><b>{a.description}</b><div className="text-slate-400">{a.category || "Sem categoria"} · {a.branchName || "Sem filial"} · {a.sectorName || "Sem setor"}</div></td>
                <td className="p-2 text-center">{a.caNumber || (a.type === "epc" ? "Não se aplica" : "Pendente")}</td>
                <td className="p-2 text-center">{fmt(a.caValidUntil)}</td>
                <td className="p-2 text-center">{fmt(a.productValidUntil)}</td>
                <td className="p-2 text-center">{a.quantity} {a.unit || "un"}<div className="text-slate-400">mín. {a.minQuantity}</div></td>
                <td className="p-2 text-center">{a.pgrLinked ? <Badge tone="emerald">Vinculado</Badge> : <Badge tone="amber">Não vinculado</Badge>}<div className="text-slate-400">{a.gseName || ""}</div></td>
                <td className="p-2 text-right space-x-2"><button className="text-blue-600 hover:underline" onClick={() => { setEditing(a); setOpen(true); }}>Editar</button><button className="text-rose-600 hover:underline" onClick={() => confirm("Remover cadastro?") && del.mutate({ id: a.id })}>Remover</button></td>
              </tr>
            ))}
            {assets.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">Nenhum EPI/EPC cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <AssetForm initial={editing} onClose={() => { setOpen(false); setEditing(null); }} onSaved={() => { setOpen(false); setEditing(null); q.refetch(); }} />}
    </div>
  );
}

function AssetForm({ initial, onClose, onSaved }: any) {
  const treeQ = trpc.lessons.hierarchyTree.useQuery();
  const branches = (treeQ.data ?? []).flatMap((c: any) => c.branches ?? []);
  const [f, setF] = useState<any>({
    id: initial?.id, type: initial?.type ?? "epi", category: initial?.category ?? "", description: initial?.description ?? "",
    manufacturer: initial?.manufacturer ?? "", model: initial?.model ?? "", caNumber: initial?.caNumber ?? "", caStatus: initial?.caStatus ?? "",
    caValidUntil: dateOnly(initial?.caValidUntil), caSource: initial?.caSource ?? "", acquisitionDate: dateOnly(initial?.acquisitionDate),
    manufactureDate: dateOnly(initial?.manufactureDate), productValidUntil: dateOnly(initial?.productValidUntil), lot: initial?.lot ?? "",
    serialNumber: initial?.serialNumber ?? "", size: initial?.size ?? "", unit: initial?.unit ?? "un", quantity: Number(initial?.quantity ?? 0),
    minQuantity: Number(initial?.minQuantity ?? 0), storageLocation: initial?.storageLocation ?? "", branchId: initial?.branchId ?? null,
    sectorId: initial?.sectorId ?? null, positionName: initial?.positionName ?? "", riskProtected: initial?.riskProtected ?? "",
    pgrId: initial?.pgrId ?? null, gseId: initial?.gseId ?? null, relatedHazard: initial?.relatedHazard ?? "", riskSource: initial?.riskSource ?? "",
    replacementPeriodicity: initial?.replacementPeriodicity ?? "", replacementCriteria: initial?.replacementCriteria ?? "", conservationInfo: initial?.conservationInfo ?? "",
    cleaningInfo: initial?.cleaningInfo ?? "", inspectionPeriodicity: initial?.inspectionPeriodicity ?? "", maintenancePeriodicity: initial?.maintenancePeriodicity ?? "",
    nextInspectionDate: dateOnly(initial?.nextInspectionDate), nextMaintenanceDate: dateOnly(initial?.nextMaintenanceDate), status: initial?.status ?? "ativo",
    photoUrl: initial?.photoUrl ?? "", documentUrl: initial?.documentUrl ?? "", manualUrl: initial?.manualUrl ?? "", pgrLinked: Boolean(initial?.pgrLinked),
  });
  const sectors = branches.find((b: any) => b.branch.id === f.branchId)?.sectors ?? [];
  const up = api.upsertAsset.useMutation({ onSuccess: () => { toast.success("EPI/EPC salvo."); onSaved(); }, onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar.") });
  const ai = api.aiSuggestAsset.useMutation({ onSuccess: (r: any) => { setF((x: any) => ({ ...x, ...r.suggestion })); toast.success("Sugestão aplicada. Revise antes de salvar."); } });
  const ca = api.searchCA.useMutation({ onSuccess: (r: any) => toast.message(r.message) });
  return (
    <Modal onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex justify-between items-start gap-3"><h3 className="text-lg font-semibold">{initial ? "Editar" : "Novo"} EPI/EPC</h3><button onClick={onClose}><X size={18} /></button></div>
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">A validade do CA e a validade/prazo de utilização do produto são controles independentes. A plataforma não trata CA vencido como produto automaticamente vencido.</div>
        <div className="grid md:grid-cols-4 gap-3 text-sm">
          <L l="Tipo"><select value={f.type} onChange={e => setF({ ...f, type: e.target.value, caNumber: e.target.value === "epc" ? "" : f.caNumber })} className="field"><option value="epi">EPI</option><option value="epc">EPC</option></select></L>
          <L l="Categoria"><input className="field" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} /></L>
          <div className="md:col-span-2"><L l="Descrição *"><input className="field" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Ex.: Protetor auricular tipo plug" /></L></div>
          <L l="Fabricante"><input className="field" value={f.manufacturer} onChange={e => setF({ ...f, manufacturer: e.target.value })} /></L>
          <L l="Modelo"><input className="field" value={f.model} onChange={e => setF({ ...f, model: e.target.value })} /></L>
          <L l="Lote"><input className="field" value={f.lot} onChange={e => setF({ ...f, lot: e.target.value })} /></L>
          <L l="Série"><input className="field" value={f.serialNumber} onChange={e => setF({ ...f, serialNumber: e.target.value })} /></L>
        </div>
        {f.type === "epi" && <Section title="Controle do CA">
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <L l="Número do CA"><input className="field" value={f.caNumber} onChange={e => setF({ ...f, caNumber: e.target.value })} /></L>
            <L l="Situação do CA"><input className="field" value={f.caStatus} onChange={e => setF({ ...f, caStatus: e.target.value })} placeholder="Válido, vencido, pendente..." /></L>
            <L l="Validade/registro do CA"><input type="date" className="field" value={f.caValidUntil} onChange={e => setF({ ...f, caValidUntil: e.target.value })} /></L>
            <L l="Fonte da informação"><input className="field" value={f.caSource} onChange={e => setF({ ...f, caSource: e.target.value })} /></L>
          </div>
          <button type="button" onClick={() => f.caNumber ? ca.mutate({ caNumber: f.caNumber }) : toast.error("Informe o CA.")} className="mt-2 px-2 py-1 border rounded text-xs flex items-center gap-1"><Search size={12} /> Pesquisar CA</button>
        </Section>}
        <Section title="Controle do equipamento">
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <L l="Aquisição"><input type="date" className="field" value={f.acquisitionDate} onChange={e => setF({ ...f, acquisitionDate: e.target.value })} /></L>
            <L l="Fabricação"><input type="date" className="field" value={f.manufactureDate} onChange={e => setF({ ...f, manufactureDate: e.target.value })} /></L>
            <L l="Validade do produto"><input type="date" className="field" value={f.productValidUntil} onChange={e => setF({ ...f, productValidUntil: e.target.value })} /></L>
            <L l="Substituição"><input className="field" value={f.replacementPeriodicity} onChange={e => setF({ ...f, replacementPeriodicity: e.target.value })} /></L>
            <L l="Qtd"><input type="number" className="field" value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value || 0) })} /></L>
            <L l="Estoque mínimo"><input type="number" className="field" value={f.minQuantity} onChange={e => setF({ ...f, minQuantity: Number(e.target.value || 0) })} /></L>
            <L l="Unidade"><input className="field" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} /></L>
            <L l="Tamanho"><input className="field" value={f.size} onChange={e => setF({ ...f, size: e.target.value })} /></L>
          </div>
        </Section>
        <Section title="Vínculo ao PGR / GSE e localização">
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <L l="Filial"><select className="field" value={f.branchId ?? ""} onChange={e => setF({ ...f, branchId: e.target.value ? Number(e.target.value) : null, sectorId: null })}><option value="">—</option>{branches.map((b: any) => <option key={b.branch.id} value={b.branch.id}>{b.branch.name}</option>)}</select></L>
            <L l="Setor"><select className="field" value={f.sectorId ?? ""} onChange={e => setF({ ...f, sectorId: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{sectors.map((s: any) => <option key={s.sector.id} value={s.sector.id}>{s.sector.name}</option>)}</select></L>
            <L l="PGR ID"><input type="number" className="field" value={f.pgrId ?? ""} onChange={e => setF({ ...f, pgrId: e.target.value ? Number(e.target.value) : null })} /></L>
            <L l="GSE/GHE ID"><input type="number" className="field" value={f.gseId ?? ""} onChange={e => setF({ ...f, gseId: e.target.value ? Number(e.target.value) : null })} /></L>
            <L l="Cargo/atividade"><input className="field" value={f.positionName} onChange={e => setF({ ...f, positionName: e.target.value })} /></L>
            <L l="Risco protegido"><input className="field" value={f.riskProtected} onChange={e => setF({ ...f, riskProtected: e.target.value })} /></L>
            <L l="Perigo relacionado"><input className="field" value={f.relatedHazard} onChange={e => setF({ ...f, relatedHazard: e.target.value })} /></L>
            <L l="Fonte do risco"><input className="field" value={f.riskSource} onChange={e => setF({ ...f, riskSource: e.target.value })} /></L>
          </div>
          <label className="mt-2 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pgrLinked} onChange={e => setF({ ...f, pgrLinked: e.target.checked })} /> Vinculado ao PGR</label>
        </Section>
        <Section title="Conservação, higienização e documentos">
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <L l="Critério de substituição"><textarea className="field" rows={2} value={f.replacementCriteria} onChange={e => setF({ ...f, replacementCriteria: e.target.value })} /></L>
            <L l="Conservação"><textarea className="field" rows={2} value={f.conservationInfo} onChange={e => setF({ ...f, conservationInfo: e.target.value })} /></L>
            <L l="Higienização"><textarea className="field" rows={2} value={f.cleaningInfo} onChange={e => setF({ ...f, cleaningInfo: e.target.value })} /></L>
            <L l="URL manual/ficha técnica"><input className="field" value={f.manualUrl} onChange={e => setF({ ...f, manualUrl: e.target.value })} /></L>
          </div>
        </Section>
        {f.type === "epc" && <Section title="Inspeção e manutenção do EPC">
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <L l="Periodicidade inspeção"><input className="field" value={f.inspectionPeriodicity} onChange={e => setF({ ...f, inspectionPeriodicity: e.target.value })} /></L>
            <L l="Próxima inspeção"><input type="date" className="field" value={f.nextInspectionDate} onChange={e => setF({ ...f, nextInspectionDate: e.target.value })} /></L>
            <L l="Periodicidade manutenção"><input className="field" value={f.maintenancePeriodicity} onChange={e => setF({ ...f, maintenancePeriodicity: e.target.value })} /></L>
            <L l="Próxima manutenção"><input type="date" className="field" value={f.nextMaintenanceDate} onChange={e => setF({ ...f, nextMaintenanceDate: e.target.value })} /></L>
          </div>
        </Section>}
        <div className="flex justify-between gap-2 pt-2 border-t">
          <button onClick={() => f.description.trim() ? ai.mutate({ prompt: f.description, type: f.type }) : toast.error("Descreva o equipamento antes de usar IA.")} className="px-3 py-1.5 border rounded text-sm flex items-center gap-1"><Sparkles size={13} /> Cadastrar com IA</button>
          <div className="flex gap-2"><button onClick={onClose} className="px-3 py-1.5 border rounded text-sm">Cancelar</button><button onClick={() => f.description.trim() ? up.mutate(f) : toast.error("Descrição obrigatória.")} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-semibold flex items-center gap-1"><Save size={13} /> Salvar</button></div>
        </div>
      </div>
    </Modal>
  );
}

function LearningTab() {
  const q = api.listLearning.useQuery();
  const assetsQ = api.listAssets.useQuery({ type: "todos" });
  const coursesQ = api.listCourseOptions.useQuery();
  const up = api.upsertLearning.useMutation({ onSuccess: () => { q.refetch(); toast.success("Treinamento salvo."); } });
  const del = api.removeLearning.useMutation({ onSuccess: () => { q.refetch(); toast.success("Treinamento removido."); } });
  const [f, setF] = useState<any>({ contentType: "course", title: "", moduleId: null, assetId: null, targetType: "geral", targetValue: "", isRequired: true, validityMonths: 12, orderIndex: 0 });
  return (
    <div className="mt-4 grid lg:grid-cols-[360px_1fr] gap-4">
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h3 className="font-semibold">Vincular capacitação</h3>
        <L l="Tipo"><select className="field" value={f.contentType} onChange={e => setF({ ...f, contentType: e.target.value })}><option value="course">Curso da plataforma</option><option value="material">PDF/material</option><option value="video">Vídeo</option><option value="link">Link</option></select></L>
        {f.contentType === "course" && <L l="Curso"><select className="field" value={f.moduleId ?? ""} onChange={e => { const id = e.target.value ? Number(e.target.value) : null; const c = (coursesQ.data ?? []).find((x: any) => x.id === id); setF({ ...f, moduleId: id, title: c?.title ?? f.title }); }}><option value="">Selecione</option>{(coursesQ.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></L>}
        <L l="Título"><input className="field" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></L>
        <L l="EPI/EPC relacionado"><select className="field" value={f.assetId ?? ""} onChange={e => setF({ ...f, assetId: e.target.value ? Number(e.target.value) : null })}><option value="">Geral</option>{(assetsQ.data ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.description}</option>)}</select></L>
        <div className="grid grid-cols-2 gap-2"><L l="Público"><select className="field" value={f.targetType} onChange={e => setF({ ...f, targetType: e.target.value })}><option value="geral">Geral</option><option value="epi">EPI</option><option value="epc">EPC</option><option value="cargo">Cargo</option><option value="setor">Setor</option><option value="filial">Filial</option><option value="gse">GSE</option><option value="colaborador">Colaborador</option></select></L><L l="Validade meses"><input type="number" className="field" value={f.validityMonths} onChange={e => setF({ ...f, validityMonths: Number(e.target.value || 0) })} /></L></div>
        <L l="URL externa"><input className="field" value={f.url ?? ""} onChange={e => setF({ ...f, url: e.target.value })} /></L>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isRequired} onChange={e => setF({ ...f, isRequired: e.target.checked })} /> Obrigatório</label>
        <button onClick={() => f.title.trim() ? up.mutate(f) : toast.error("Informe o título.")} className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold">Salvar capacitação</button>
      </div>
      <TablePanel title="Capacitações cadastradas" empty="Nenhuma capacitação vinculada.">
        {(q.data ?? []).map((r: any) => <tr key={r.id} className="border-t"><td className="p-2">{r.title}<div className="text-slate-400">{r.module_title || r.url || r.asset_description || "Geral"}</div></td><td className="p-2 text-center">{r.content_type}</td><td className="p-2 text-center">{r.target_type}</td><td className="p-2 text-center">{r.is_required ? "Sim" : "Não"}</td><td className="p-2 text-right"><button className="text-rose-600 hover:underline" onClick={() => del.mutate({ id: r.id })}>Remover</button></td></tr>)}
      </TablePanel>
    </div>
  );
}

function DeliveriesTab() {
  const q = api.listDeliveries.useQuery();
  const assetsQ = api.listAssets.useQuery({ type: "epi" });
  const usersQ = api.listCollaborators.useQuery();
  const [bulk, setBulk] = useState<number[]>([]);
  const [f, setF] = useState<any>({ assetId: 0, collaboratorId: 0, quantity: 1, deliveryDate: new Date().toISOString().slice(0,10), reason: "Primeira entrega", signatureMethod: "eletronica" });
  const one = api.registerDelivery.useMutation({ onSuccess: () => { q.refetch(); assetsQ.refetch(); toast.success("Entrega registrada."); } });
  const bulkMut = api.bulkDelivery.useMutation({ onSuccess: (r: any) => { q.refetch(); assetsQ.refetch(); setBulk([]); toast.success(`${r.count} entregas registradas.`); } });
  const sign = api.signDelivery.useMutation({ onSuccess: () => { q.refetch(); toast.success("Assinatura registrada."); } });
  const selectedAsset = (assetsQ.data ?? []).find((a: any) => a.id === Number(f.assetId));
  function printReceipt(r: any) {
    const html = `<html><head><title>Recibo EPI/EPC</title><style>body{font-family:Arial;padding:24px}td{padding:7px;border-bottom:1px solid #ddd}.sign{height:80px;border-bottom:1px solid #222;margin-top:40px}</style></head><body><h2>RECIBO DE ENTREGA DE EPI/EPC</h2><table><tr><td>Colaborador</td><td>${r.collaborator_name || "-"}</td></tr><tr><td>CPF</td><td>${r.collaborator_cpf || "-"}</td></tr><tr><td>Equipamento</td><td>${r.asset_description}</td></tr><tr><td>CA</td><td>${r.ca_number || "-"}</td></tr><tr><td>Lote</td><td>${r.lot || "-"}</td></tr><tr><td>Qtd</td><td>${r.quantity}</td></tr><tr><td>Data</td><td>${fmt(r.delivery_date)}</td></tr><tr><td>Motivo</td><td>${r.reason || "-"}</td></tr></table><div class="sign"></div><p>Assinatura do trabalhador</p><script>window.print()</script></body></html>`;
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
  }
  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white border rounded-xl p-4 grid lg:grid-cols-5 gap-3 text-sm">
        <L l="EPI"><select className="field" value={f.assetId} onChange={e => { const id = Number(e.target.value); const a = (assetsQ.data ?? []).find((x: any) => x.id === id); setF({ ...f, assetId: id, caNumber: a?.caNumber || "", lot: a?.lot || "", size: a?.size || "" }); }}><option value={0}>Selecione</option>{(assetsQ.data ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.description} · estoque {a.quantity}</option>)}</select></L>
        <L l="Colaborador"><select className="field" value={f.collaboratorId} onChange={e => { const id = Number(e.target.value); const u = (usersQ.data ?? []).find((x: any) => x.id === id); setF({ ...f, collaboratorId: id, collaboratorCpf: u?.cpf, collaboratorName: u?.name, branchId: u?.branch_id, sectorId: u?.sector_id, positionName: u?.position }); }}><option value={0}>Selecione</option>{(usersQ.data ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></L>
        <L l="Qtd"><input type="number" className="field" value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value || 1) })} /></L>
        <L l="Motivo"><select className="field" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })}>{["Admissão","Primeira entrega","Substituição","Dano","Extravio","Vencimento/expiração do produto","Troca periódica","Mudança de função","Reposição","Outro"].map(x => <option key={x}>{x}</option>)}</select></L>
        <button className="self-end px-3 py-1.5 bg-amber-600 text-white rounded font-semibold" onClick={() => f.assetId && f.collaboratorId ? one.mutate(f) : toast.error("Selecione EPI e colaborador.")}>Nova entrega</button>
        <div className="lg:col-span-5 text-xs text-slate-500">Entrega em lote: marque colaboradores abaixo e clique em registrar lote. EPI selecionado: <b>{selectedAsset?.description || "nenhum"}</b>.</div>
        <div className="lg:col-span-5 max-h-32 overflow-y-auto border rounded p-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-1">
          {(usersQ.data ?? []).map((u: any) => <label key={u.id} className="text-xs flex items-center gap-1"><input type="checkbox" checked={bulk.includes(u.id)} onChange={e => setBulk(e.target.checked ? [...bulk, u.id] : bulk.filter(id => id !== u.id))} /> {u.name}</label>)}
        </div>
        <button className="lg:col-span-5 px-3 py-1.5 border rounded text-sm font-semibold" onClick={() => f.assetId && bulk.length ? bulkMut.mutate({ collaboratorIds: bulk, delivery: { ...f, collaboratorId: undefined } }) : toast.error("Selecione EPI e colaboradores.")}>Registrar entrega em lote</button>
      </div>
      <TablePanel title="Histórico de entregas" empty="Nenhuma entrega registrada.">
        {(q.data ?? []).map((r: any) => <tr key={r.id} className="border-t"><td className="p-2">{fmt(r.delivery_date)}</td><td className="p-2">{r.collaborator_name}<div className="text-slate-400">{r.collaborator_cpf}</div></td><td className="p-2">{r.asset_description}</td><td className="p-2 text-center">{r.quantity}</td><td className="p-2 text-center">{r.signature_status === "assinado" ? <Badge tone="emerald">Assinado</Badge> : <Badge tone="amber">Pendente</Badge>}</td><td className="p-2 text-right space-x-2"><button className="text-blue-600 hover:underline" onClick={() => printReceipt(r)}>Recibo</button>{r.signature_status !== "assinado" && <button className="text-emerald-600 hover:underline" onClick={() => sign.mutate({ id: r.id, method: "eletronica", signatureData: "Assinatura eletrônica registrada pelo SESMT/RH" })}>Assinar</button>}</td></tr>)}
      </TablePanel>
    </div>
  );
}

function ReturnsTab() {
  const q = api.listReturns.useQuery();
  const assetsQ = api.listAssets.useQuery({ type: "todos" });
  const usersQ = api.listCollaborators.useQuery();
  const [f, setF] = useState<any>({ assetId: 0, collaboratorId: 0, quantity: 1, eventType: "devolucao", eventDate: new Date().toISOString().slice(0,10), destination: "retorna_estoque" });
  const mut = api.registerReturn.useMutation({ onSuccess: () => { q.refetch(); assetsQ.refetch(); toast.success("Registro salvo."); } });
  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white border rounded-xl p-4 grid md:grid-cols-6 gap-3 text-sm">
        <L l="Equipamento"><select className="field" value={f.assetId} onChange={e => setF({ ...f, assetId: Number(e.target.value) })}><option value={0}>Selecione</option>{(assetsQ.data ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.description}</option>)}</select></L>
        <L l="Colaborador"><select className="field" value={f.collaboratorId} onChange={e => setF({ ...f, collaboratorId: Number(e.target.value) })}><option value={0}>Selecione</option>{(usersQ.data ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></L>
        <L l="Tipo"><select className="field" value={f.eventType} onChange={e => setF({ ...f, eventType: e.target.value })}><option value="devolucao">Devolução</option><option value="substituicao">Substituição</option><option value="descarte">Descarte</option></select></L>
        <L l="Qtd"><input type="number" className="field" value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value || 1) })} /></L>
        <L l="Motivo"><input className="field" value={f.reason ?? ""} onChange={e => setF({ ...f, reason: e.target.value })} /></L>
        <button className="self-end px-3 py-1.5 bg-amber-600 text-white rounded font-semibold" onClick={() => f.assetId ? mut.mutate(f) : toast.error("Selecione o equipamento.")}>Salvar</button>
      </div>
      <TablePanel title="Devoluções e substituições" empty="Nenhum registro.">{(q.data ?? []).map((r: any) => <tr key={r.id} className="border-t"><td className="p-2">{fmt(r.event_date)}</td><td className="p-2">{r.asset_description}</td><td className="p-2">{r.collaborator_name || "-"}</td><td className="p-2 text-center">{r.event_type}</td><td className="p-2 text-center">{r.quantity}</td><td className="p-2">{r.reason || "-"}</td></tr>)}</TablePanel>
    </div>
  );
}

function StockTab() {
  const assetsQ = api.listAssets.useQuery({ type: "todos" });
  const mut = api.registerMovement.useMutation({ onSuccess: () => { assetsQ.refetch(); toast.success("Movimentação registrada."); } });
  const [f, setF] = useState<any>({ assetId: 0, movementType: "entrada", quantity: 1, reason: "" });
  const critical = (assetsQ.data ?? []).filter((a: any) => a.minQuantity > 0 && a.quantity <= a.minQuantity);
  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white border rounded-xl p-4 grid md:grid-cols-5 gap-3 text-sm">
        <L l="Equipamento"><select className="field" value={f.assetId} onChange={e => setF({ ...f, assetId: Number(e.target.value) })}><option value={0}>Selecione</option>{(assetsQ.data ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.description} · {a.quantity} {a.unit}</option>)}</select></L>
        <L l="Movimento"><select className="field" value={f.movementType} onChange={e => setF({ ...f, movementType: e.target.value })}>{["entrada","descarte","transferencia","ajuste","manutencao"].map(x => <option key={x} value={x}>{x}</option>)}</select></L>
        <L l="Qtd"><input type="number" className="field" value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value || 1) })} /></L>
        <L l="Motivo"><input className="field" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></L>
        <button className="self-end px-3 py-1.5 bg-amber-600 text-white rounded font-semibold" onClick={() => f.assetId ? mut.mutate(f) : toast.error("Selecione o equipamento.")}>Registrar</button>
      </div>
      <TablePanel title="Estoque crítico" empty="Nenhum item em estoque crítico.">{critical.map((a: any) => <tr key={a.id} className="border-t bg-orange-50"><td className="p-2">{a.description}</td><td className="p-2">{a.branchName || "-"}</td><td className="p-2">{a.sectorName || "-"}</td><td className="p-2 text-center">{a.quantity}</td><td className="p-2 text-center">{a.minQuantity}</td></tr>)}</TablePanel>
    </div>
  );
}

function AlertsTab() {
  const q = api.alerts.useQuery();
  if (q.isLoading) return <Loading />;
  const groups = [
    ["Vencidos", q.data?.vencidos ?? [], "bg-rose-50 border-rose-200 text-rose-800"],
    ["Vencendo em 7 dias", q.data?.d7 ?? [], "bg-orange-50 border-orange-200 text-orange-800"],
    ["Vencendo em 15 dias", q.data?.d15 ?? [], "bg-amber-50 border-amber-200 text-amber-800"],
    ["Vencendo em 30 dias", q.data?.d30 ?? [], "bg-yellow-50 border-yellow-200 text-yellow-800"],
    ["Estoque crítico", q.data?.estoqueCritico ?? [], "bg-orange-50 border-orange-200 text-orange-800"],
    ["Entrega sem assinatura", q.data?.assinaturaPendente ?? [], "bg-blue-50 border-blue-200 text-blue-800"],
    ["Equipamento sem vínculo ao PGR", q.data?.semPgr ?? [], "bg-slate-50 border-slate-200 text-slate-800"],
  ];
  return <div className="mt-4 grid lg:grid-cols-2 gap-3">{groups.map(([title, items, cls]: any) => <div key={title} className={`border rounded-xl p-4 ${cls}`}><p className="font-semibold mb-2">{title} — {items.length}</p>{items.length === 0 ? <p className="text-sm opacity-70">Nenhum item.</p> : <div className="space-y-1">{items.slice(0, 20).map((it: any, i: number) => <div key={`${it.id}-${i}`} className="bg-white/70 rounded px-2 py-1 text-sm flex justify-between"><span>{it.description || it.asset_description || it.collaborator_name}</span><span className="text-xs">{it.alertKind || it.ca_number || ""}</span></div>)}</div>}</div>)}</div>;
}

function ReportsTab() {
  const q = api.report.useQuery();
  const pdf = api.generateReportPdf.useMutation({ onSuccess: (r: any) => { if (r.url) window.open(r.url, "_blank"); toast.success("PDF gerado."); }, onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF.") });
  function csv() {
    const rows = q.data?.assets ?? [];
    const header = ["Tipo","Descricao","CA","Validade CA","Validade Produto","Estoque","Filial","Setor","PGR"];
    const body = rows.map((a: any) => [a.type, a.description, a.ca_number || "", dateOnly(a.ca_valid_until), dateOnly(a.product_valid_until), a.quantity, a.branch_name || "", a.sector_name || "", a.pgr_linked ? "sim" : "nao"]);
    const content = [header, ...body].map(r => r.map((c: any) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "gestao_epi_epc.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white border rounded-xl p-4 flex flex-wrap justify-between gap-3">
        <div><h3 className="font-semibold">Relatórios de Gestão de EPI/EPC</h3><p className="text-sm text-slate-500">Gera evidência dinâmica para auditorias, Central de Conformidade e Anexo 8 do PGR.</p></div>
        <div className="flex gap-2"><button onClick={() => pdf.mutate()} className="px-3 py-1.5 bg-primary text-white rounded text-sm flex items-center gap-1">{pdf.isPending ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} PDF</button><button onClick={csv} className="px-3 py-1.5 border rounded text-sm">Excel/CSV</button></div>
      </div>
      <DashboardTab />
    </div>
  );
}

function DocumentsTab() {
  const q = api.documents.useQuery();
  return <div className="mt-4"><TablePanel title="Documentos SST — EPI/EPC" empty="Nenhum documento arquivado.">{(q.data ?? []).map((d: any) => <tr key={d.id} className="border-t"><td className="p-2">{d.document_type}</td><td className="p-2">{d.title}</td><td className="p-2">{d.asset_description || "-"}</td><td className="p-2">{d.collaborator_name || "-"}</td><td className="p-2 text-center">{fmt(d.created_at)}</td></tr>)}</TablePanel></div>;
}

function MovementsTab() {
  const q = api.listMovements.useQuery();
  return <div className="mt-4"><TablePanel title="Trilha de movimentações" empty="Nenhuma movimentação registrada.">{(q.data ?? []).map((m: any) => <tr key={m.id} className="border-t"><td className="p-2">{fmt(m.created_at, true)}</td><td className="p-2">{m.asset_description}</td><td className="p-2 text-center">{m.movement_type}</td><td className="p-2 text-center">{m.quantity}</td><td className="p-2 text-center">{m.previous_quantity ?? "-"} → {m.new_quantity ?? "-"}</td><td className="p-2">{m.user_name || "-"}</td><td className="p-2">{m.reason || "-"}</td></tr>)}</TablePanel></div>;
}

function TablePanel({ title, empty, children }: any) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="p-3 border-b bg-slate-50 font-semibold text-sm">{title}</div>
      <div className="overflow-x-auto"><table className="w-full text-xs"><tbody>{hasRows ? children : <tr><td className="p-6 text-center text-slate-400">{empty}</td></tr>}</tbody></table></div>
    </div>
  );
}

function Modal({ children, onClose, wide }: any) {
  return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}><div className={`bg-white rounded-lg shadow-xl ${wide ? "max-w-5xl" : "max-w-lg"} w-full p-5 max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>{children}</div></div>;
}

function Section({ title, children }: any) {
  return <section className="border rounded-lg p-3 space-y-2"><h4 className="font-semibold text-sm flex items-center gap-1"><Layers size={13} /> {title}</h4>{children}</section>;
}

function L({ l, children }: any) {
  return <label className="block"><span className="text-xs font-semibold text-slate-700 block mb-1">{l}</span>{children}</label>;
}

function Badge({ tone, children }: any) {
  const cls: any = { blue: "bg-blue-50 text-blue-700 border-blue-200", slate: "bg-slate-50 text-slate-700 border-slate-200", emerald: "bg-emerald-50 text-emerald-700 border-emerald-200", amber: "bg-amber-50 text-amber-700 border-amber-200" };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls[tone] ?? cls.slate}`}>{children}</span>;
}

function Loading() {
  return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>;
}

function fmt(d: any, time = false) {
  if (!d) return "—";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString("pt-BR") + (time ? ` ${x.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "");
}

function dateOnly(d: any) {
  if (!d) return "";
  return String(d).slice(0, 10);
}
