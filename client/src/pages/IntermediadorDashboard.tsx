import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Plus, Loader2, Save, Users as UsersIcon, TrendingUp } from "lucide-react";
import { PROSPECT_STAGES } from "@shared/const";

/**
 * P14 #5 — Perfil "Intermediador": CRM de prospecção própria (empresas, contatos,
 * histórico de interação, estágio, probabilidade), pipeline de 8 etapas, e — quando
 * há hierarquia (Intermediador Principal) — acompanhamento da equipe subordinada.
 */
export default function IntermediadorDashboard() {
  const profileQ = trpc.intermediador.myProfile.useQuery();
  const dashQ = trpc.intermediador.dashboard.useQuery();
  const [stageFilter, setStageFilter] = useState("");
  const listQ = trpc.intermediador.listProspects.useQuery(stageFilter ? { estagio: stageFilter } : {});
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detailOf, setDetailOf] = useState<any>(null);

  const upsertMut = trpc.intermediador.upsertProspect.useMutation({
    onSuccess: () => { toast.success("Prospect salvo."); listQ.refetch(); setOpenNew(false); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const changeStageMut = trpc.intermediador.changeStage.useMutation({
    onSuccess: () => { toast.success("Estágio atualizado."); listQ.refetch(); dashQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const profile = profileQ.data as any;
  const dash = dashQ.data as any;
  const list = (listQ.data ?? []) as any[];

  if (profileQ.isLoading) return <AppLayout><div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div></AppLayout>;

  if (!profileQ.isLoading && !profile) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
            Seu usuário tem o perfil Intermediador, mas ainda não há um cadastro comercial vinculado.
            Peça ao Super Admin para vincular seu usuário em <b>CRM Comercial → Parceiros</b>.
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase size={22} className="text-blue-600" />
            Minha Área Comercial — {profile?.nome}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            CRM de prospecção, pipeline comercial{profile?.isPrincipal ? " e acompanhamento da equipe" : ""}.
          </p>
        </header>

        {dash && (
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Clientes prospectados" value={dash.clientesProspectados} c="bg-blue-50 text-blue-800 border-blue-200" />
            <Kpi label="Clientes ativos" value={dash.clientesAtivos} c="bg-slate-50 text-slate-800 border-slate-200" />
            <Kpi label="Contratos fechados" value={dash.contratosFechados} c="bg-emerald-50 text-emerald-800 border-emerald-200" />
            <Kpi label="Comissão prevista" value={brl(dash.comissaoPrevista)} c="bg-amber-50 text-amber-800 border-amber-200" />
            <Kpi label="Comissão recebida" value={brl(dash.comissaoRecebida)} c="bg-purple-50 text-purple-800 border-purple-200" />
          </div>
        )}

        {dash?.proximosPagamentos?.length > 0 && (
          <div className="bg-white border rounded-xl p-4">
            <p className="text-sm font-semibold mb-2 flex items-center gap-1"><TrendingUp size={14} /> Próximos pagamentos previstos</p>
            <div className="space-y-1 text-xs">
              {dash.proximosPagamentos.map((p: any, i: number) => (
                <div key={i} className="flex justify-between border-b last:border-0 py-1">
                  <span>{p.partner_name} — {p.vencimento?.slice(0, 10) ?? "—"}</span>
                  <b>{brl(p.valor_comissao)}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile?.isPrincipal && dash?.ranking?.length > 0 && (
          <div className="bg-white border rounded-xl p-4">
            <p className="text-sm font-semibold mb-2 flex items-center gap-1"><UsersIcon size={14} /> Minha equipe — ranking por contratos fechados</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Intermediário</th><th className="py-1">Prospectados</th><th className="py-1">Contratos fechados</th></tr></thead>
              <tbody>
                {dash.ranking.map((r: any, i: number) => (
                  <tr key={i} className="border-t"><td className="py-1.5">{r.nome}</td><td>{r.prospectados}</td><td className="font-semibold">{r.contratosFechados}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-white border rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex gap-2 items-center flex-wrap">
              <button onClick={() => setStageFilter("")} className={`text-xs px-2 py-1 rounded-full ${!stageFilter ? "bg-primary text-white" : "bg-slate-100"}`}>Todos</button>
              {PROSPECT_STAGES.map(s => (
                <button key={s.key} onClick={() => setStageFilter(s.key)} className={`text-xs px-2 py-1 rounded-full ${stageFilter === s.key ? "bg-primary text-white" : "bg-slate-100"}`}>{s.label}</button>
              ))}
            </div>
            <Button size="sm" onClick={() => { setEditing(null); setOpenNew(true); }} className="gap-1"><Plus size={14} /> Novo prospect</Button>
          </div>

          {list.length === 0 && !listQ.isLoading && <p className="text-sm text-slate-500 py-8 text-center">Nenhum prospect ainda. Clique em "Novo prospect".</p>}

          <div className="grid gap-2">
            {list.map(p => {
              const stage = PROSPECT_STAGES.find(s => s.key === p.estagio);
              const mine = !profile?.isPrincipal || p.owner_name === profile?.nome;
              return (
                <div key={p.id} className="border rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailOf(p)}>
                    <div className="font-semibold">{p.empresa_nome}</div>
                    <div className="text-xs text-slate-500">
                      {p.contato_nome ?? "—"} · {p.probabilidade_pct}% probabilidade
                      {profile?.isPrincipal && <span> · dono: {p.owner_name}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{stage?.label ?? p.estagio}</span>
                  {mine && (
                    <select
                      value={p.estagio}
                      onChange={e => changeStageMut.mutate({ id: p.id, newStage: e.target.value })}
                      className="text-xs border rounded px-2 py-1"
                      onClick={e => e.stopPropagation()}
                    >
                      {PROSPECT_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setDetailOf(p)}>Histórico</Button>
                  {mine && <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpenNew(true); }}>Editar</Button>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {openNew && (
        <ProspectForm initial={editing} onClose={() => { setOpenNew(false); setEditing(null); }} onSubmit={(d: any) => upsertMut.mutate(d)} loading={upsertMut.isPending} />
      )}
      {detailOf && <ProspectDetail prospect={detailOf} onClose={() => setDetailOf(null)} />}
    </AppLayout>
  );
}

function Kpi({ label, value, c }: any) {
  return (
    <div className={`border rounded-xl p-4 ${c}`}>
      <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function ProspectForm({ initial, onClose, onSubmit, loading }: any) {
  const [f, setF] = useState({
    id: initial?.id,
    empresaNome: initial?.empresa_nome ?? "",
    cnpj: initial?.cnpj ?? "",
    contatoNome: initial?.contato_nome ?? "",
    contatoEmail: initial?.contato_email ?? "",
    contatoTelefone: initial?.contato_telefone ?? "",
    estagio: initial?.estagio ?? "lead_identificado",
    probabilidadePct: Number(initial?.probabilidade_pct ?? 10),
    observacoes: initial?.observacoes ?? "",
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{initial ? "Editar" : "Novo"} prospect</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2"><L l="Empresa *"><input value={f.empresaNome} onChange={e => setF({ ...f, empresaNome: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L></div>
          <L l="CNPJ"><input value={f.cnpj} onChange={e => setF({ ...f, cnpj: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Probabilidade (%)"><input type="number" min={0} max={100} value={f.probabilidadePct} onChange={e => setF({ ...f, probabilidadePct: Number(e.target.value || 0) })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Contato — nome"><input value={f.contatoNome} onChange={e => setF({ ...f, contatoNome: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Contato — telefone"><input value={f.contatoTelefone} onChange={e => setF({ ...f, contatoTelefone: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <div className="col-span-2"><L l="Contato — e-mail"><input value={f.contatoEmail} onChange={e => setF({ ...f, contatoEmail: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L></div>
          <div className="col-span-2">
            <L l="Estágio">
              <select value={f.estagio} onChange={e => setF({ ...f, estagio: e.target.value })} className="w-full border rounded px-2 py-1.5">
                {PROSPECT_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </L>
          </div>
          <div className="col-span-2"><L l="Observações"><Textarea value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} className="min-h-[60px]" /></L></div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSubmit(f)} disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar</Button>
        </div>
      </div>
    </div>
  );
}

function ProspectDetail({ prospect, onClose }: any) {
  const interQ = trpc.intermediador.listInteractions.useQuery({ prospectId: prospect.id });
  const [note, setNote] = useState("");
  const addMut = trpc.intermediador.addInteraction.useMutation({
    onSuccess: () => { setNote(""); interQ.refetch(); toast.success("Interação registrada."); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const interactions = (interQ.data ?? []) as any[];
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Histórico — {prospect.empresa_nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
            <label className="text-sm font-medium text-slate-700">Nova interação</label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Ex.: liguei para o contato, apresentei a proposta, aguardando retorno..." />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => addMut.mutate({ prospectId: prospect.id, descricao: note })} disabled={!note.trim() || addMut.isPending}>Registrar</Button>
            </div>
          </div>
          <div className="space-y-2">
            {interQ.isLoading && <p className="text-sm text-slate-400">Carregando…</p>}
            {!interQ.isLoading && interactions.length === 0 && <p className="text-sm text-slate-400">Nenhuma interação registrada ainda.</p>}
            {interactions.map((it: any) => (
              <div key={it.id} className="border rounded-lg p-2.5 text-sm">
                <div className="text-xs text-slate-400 mb-0.5">{it.created_at ? new Date(it.created_at).toLocaleString("pt-BR") : "—"}</div>
                <div>{it.descricao}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-1"><Button variant="outline" onClick={onClose}>Fechar</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function L({ l, children }: any) { return <div><label className="text-xs font-semibold text-slate-700 block mb-1">{l}</label>{children}</div>; }
function brl(v: any) { return `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
