import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Calendar, Image as ImageIcon, FileText, Video, Trophy, Mail, Bell, Settings, Plus, Save, Trash2, Sparkles, BookOpen, ClipboardList, Copy, Download, Pencil, X, Lock, Unlock, Users, Clock, PartyPopper, BarChart3, Award } from "lucide-react";

/**
 * Bruno R5-P5/Fase3 #8.1 — Módulo SIPAT: Semana Interna de Prevenção de Acidentes.
 *
 * Foundation MVP: tela de gestão da SIPAT anual com tema, identidade visual,
 * materiais, cronograma, integrações Meet/Teams, sorteios, notificações.
 * Backend usa `sipat_editions` + `sipat_materials` + `sipat_schedule`.
 */
export default function AdminSipat() {
  const editionsQ = trpc.sipat.listEditions.useQuery();
  const editions = (editionsQ.data ?? []) as any[];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = editions.find(e => e.id === selectedId) ?? editions[0];

  const upsertMut = trpc.sipat.upsertEdition.useMutation({
    onSuccess: () => { toast.success("SIPAT salva."); editionsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const [form, setForm] = useState({
    year: new Date().getFullYear() + 1,
    theme: "",
    color: "#0ea5e9",
    startsAt: "",
    endsAt: "",
    bannerUrl: "",
    meetingLinkTemplate: "",
    isActive: false,
  });

  function loadEdition(e: any) {
    if (!e) return;
    setSelectedId(e.id);
    setForm({
      year: e.year, theme: e.theme || "", color: e.color || "#0ea5e9",
      startsAt: e.starts_at ? String(e.starts_at).slice(0,10) : "",
      endsAt: e.ends_at ? String(e.ends_at).slice(0,10) : "",
      bannerUrl: e.banner_url || "", meetingLinkTemplate: e.meeting_link_template || "",
      isActive: !!e.is_active,
    });
  }

  function save() {
    upsertMut.mutate({ id: selectedId ?? undefined, ...form });
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <Trophy size={22} className="text-amber-500" /> SIPAT — Semana Interna de Prevenção de Acidentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie uma SIPAT digital, interativa e gamificada. Cada edição anual tem tema, identidade visual, cronograma,
            materiais, integrações de videoconferência e sorteios.
          </p>
        </header>

        <div className="flex gap-3 items-end">
          <select value={selectedId ?? ""} onChange={e => loadEdition(editions.find(x => x.id === Number(e.target.value)))}
            className="border rounded px-3 py-2 text-sm bg-white min-w-[260px]">
            <option value="">— selecione uma edição —</option>
            {editions.map(e => (
              <option key={e.id} value={e.id}>SIPAT {e.year}{e.is_active ? " (ATIVA)" : ""} — {e.theme || "sem tema"}</option>
            ))}
          </select>
          <button onClick={() => { setSelectedId(null); setForm({ year: new Date().getFullYear() + 1, theme: "", color: "#0ea5e9", startsAt: "", endsAt: "", bannerUrl: "", meetingLinkTemplate: "", isActive: false }); }}
            className="px-3 py-2 border border-amber-500 text-amber-600 hover:bg-amber-50 rounded text-sm flex items-center gap-1">
            <Plus size={14} /> Nova edição
          </button>
        </div>

        <section className="bg-white border-2 rounded-xl p-5 space-y-4" style={{ borderColor: form.color }}>
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: form.color }}>
            <Settings size={14} /> Identidade & Cronograma
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <L l="Ano"><input type="number" min={2024} max={2099} value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} className="w-full border rounded px-2 py-1.5"/></L>
            <L l="Tema anual"><input value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} placeholder="Ex.: Saúde Mental no Trabalho" className="w-full border rounded px-2 py-1.5"/></L>
            <L l="Cor primária"><input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-full h-10 border rounded"/></L>
            <L l="Banner (URL)"><input value={form.bannerUrl} onChange={e => setForm({ ...form, bannerUrl: e.target.value })} placeholder="https://..." className="w-full border rounded px-2 py-1.5"/></L>
            <L l="Início"><input type="date" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} className="w-full border rounded px-2 py-1.5"/></L>
            <L l="Encerramento"><input type="date" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} className="w-full border rounded px-2 py-1.5"/></L>
            <L l="Link permanente Meet/Teams (sala da SIPAT)">
              <input value={form.meetingLinkTemplate} onChange={e => setForm({ ...form, meetingLinkTemplate: e.target.value })} placeholder="https://meet.google.com/abc-def-ghi" className="w-full border rounded px-2 py-1.5"/>
            </L>
            <L l="Status">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}/>
                Edição ativa (visível pros colaboradores)
              </label>
            </L>
          </div>
          <div className="flex justify-end">
            <button onClick={save} disabled={upsertMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded font-semibold flex items-center gap-1">
              <Save size={14} /> {selectedId ? "Salvar edição" : "Criar edição"}
            </button>
          </div>
        </section>

        {selected && (
          <>
            <section className="bg-white border rounded-xl p-5">
              <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Calendar size={18} className="text-amber-500"/> Cronograma diário</h2>
              <SipatScheduleEditor editionId={selected.id} color={form.color} />
            </section>
            <section className="bg-white border rounded-xl p-5">
              <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><ImageIcon size={18} className="text-amber-500"/> Materiais (banners, vídeos, PDFs)</h2>
              <SipatMaterials editionId={selected.id} color={form.color} />
            </section>
            <section className="bg-white border rounded-xl p-5">
              <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Sparkles size={18} className="text-amber-500"/> Sorteios</h2>
              <SipatRaffles editionId={selected.id} color={form.color} />
            </section>
            <section className="bg-white border rounded-xl p-5">
              <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Bell size={18} className="text-amber-500"/> Notificações & Disparos</h2>
              <SipatBlast editionId={selected.id} />
            </section>
            <section className="bg-white border rounded-xl p-5">
              <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><BarChart3 size={18} className="text-amber-500"/> Indicadores Gerenciais</h2>
              <SipatIndicators editionId={selected.id} />
            </section>
            <section className="bg-white border rounded-xl p-5">
              <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Award size={18} className="text-amber-500"/> Relatório de Evidências & Ata de Participação</h2>
              <SipatEvidence editionId={selected.id} edition={selected} />
            </section>
          </>
        )}

        {!selected && (
          <p className="text-sm text-slate-500 text-center py-8">Selecione ou crie uma edição para gerenciar cronograma, materiais e sorteios.</p>
        )}
      </div>
    </AppLayout>
  );
}

function L({ l, children }: any) {
  return <div><label className="text-xs font-semibold text-slate-700 block mb-1">{l}</label>{children}</div>;
}

// P15 #3 — Indicadores gerenciais da edição (participação, conclusão, cursos mais acessados, por setor).
function SipatIndicators({ editionId }: { editionId: number }) {
  const q = (trpc.sipat as any).dashboardStats.useQuery({ editionId });
  const d = q.data as any;
  if (q.isLoading) return <p className="text-sm text-slate-400">Carregando indicadores…</p>;
  if (!d) return <p className="text-sm text-slate-400">Sem dados ainda.</p>;
  const cards = [
    { label: "Participação", value: `${d.pctParticipacao}%`, sub: `${d.totalParticipated}/${d.totalInvited} colaboradores` },
    { label: "Conclusão (certificados)", value: `${d.pctConclusao}%`, sub: `${d.certificadosEmitidos} emitidos` },
    { label: "Pendentes", value: d.pendentes, sub: "ainda sem acesso" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.label} className="border rounded-lg p-3 bg-slate-50">
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{c.label}</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{c.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>
      {d.cursosMaisAcessados?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Cursos mais acessados</p>
          <div className="space-y-1">
            {d.cursosMaisAcessados.map((c: any, i: number) => (
              <div key={i} className="flex justify-between text-sm border-b py-1"><span>{c.title}</span><b>{c.acessos} acessos</b></div>
            ))}
          </div>
        </div>
      )}
      {d.participacaoPorSetor?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Participação por setor</p>
          <div className="space-y-1">
            {d.participacaoPorSetor.map((s: any, i: number) => (
              <div key={i} className="flex justify-between text-sm border-b py-1"><span>{s.setor ?? "Sem setor"}</span><b>{s.participantes}</b></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// P15 #3 — Relatório de Evidências por colaborador + Ata de Participação consolidada (imprimível).
function SipatEvidence({ editionId, edition }: { editionId: number; edition: any }) {
  const q = (trpc.sipat as any).evidenceReport.useQuery({ editionId });
  const d = q.data as any;
  function imprimirAta() {
    if (!d) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const s = d.summary;
    win.document.write(`<html><head><title>Ata de Evidência de Participação — SIPAT ${edition.year}</title></head>
      <body style="font-family:sans-serif;padding:40px;color:#1f2937">
      <h2>Ata de Evidência de Participação — SIPAT ${edition.year}${edition.theme ? " — " + edition.theme : ""}</h2>
      <p><b>Período:</b> ${s.period}</p>
      <p><b>Total de colaboradores convidados:</b> ${s.totalInvited}</p>
      <p><b>Total de participantes:</b> ${s.totalParticipated}</p>
      <p><b>Percentual de adesão:</b> ${s.pctAdesao}%</p>
      <p><b>Total de certificados emitidos:</b> ${s.totalCertificates}</p>
      <p><b>Data de emissão deste relatório:</b> ${new Date(s.generatedAt).toLocaleString("pt-BR")}</p>
      <hr/>
      <h3>Detalhamento por colaborador</h3>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px">
        <thead><tr><th>Nome</th><th>Setor</th><th>Acessos</th><th>1º acesso</th><th>Cursos concluídos</th><th>Certificado</th></tr></thead>
        <tbody>
          ${d.collaborators.map((c: any) => `<tr>
            <td>${c.name}</td><td>${c.sector ?? "—"}</td><td>${c.accessCount}</td>
            <td>${c.firstAccess ? new Date(c.firstAccess).toLocaleDateString("pt-BR") : "—"}</td>
            <td>${c.coursesCompleted}/${c.coursesRequired}</td>
            <td>${c.certificateIssued ? "Emitido (" + c.certificateCode + ")" : "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <hr/>
      <p style="font-size:11px;color:#666">Documento gerado automaticamente pela plataforma Saúde do Trabalho — assinatura eletrônica da empresa.</p>
      <script>window.print()</script>
    </body></html>`);
    win.document.close();
  }
  if (q.isLoading) return <p className="text-sm text-slate-400">Carregando…</p>;
  if (!d) return <p className="text-sm text-slate-400">Sem dados ainda.</p>;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">{d.summary.totalParticipated}/{d.summary.totalInvited} participaram ({d.summary.pctAdesao}% de adesão) — {d.summary.totalCertificates} certificados emitidos.</p>
        <button onClick={imprimirAta} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-semibold flex items-center gap-1"><Download size={13}/> Gerar Ata / Relatório</button>
      </div>
      <div className="max-h-80 overflow-y-auto border rounded">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0"><tr><th className="text-left p-2">Nome</th><th className="text-left p-2">Setor</th><th className="p-2">Acessos</th><th className="p-2">Cursos</th><th className="p-2">Certificado</th></tr></thead>
          <tbody>
            {d.collaborators.map((c: any) => (
              <tr key={c.userId} className="border-t">
                <td className="p-2">{c.name}</td><td className="p-2">{c.sector ?? "—"}</td>
                <td className="p-2 text-center">{c.accessCount}</td>
                <td className="p-2 text-center">{c.coursesCompleted}/{c.coursesRequired}</td>
                <td className="p-2 text-center">{c.certificateIssued ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SipatScheduleEditor({ editionId, color }: { editionId: number; color: string }) {
  const q = trpc.sipat.listSchedule.useQuery({ editionId });
  const items = (q.data ?? []) as any[];
  const addMut = trpc.sipat.upsertScheduleItem.useMutation({ onSuccess: () => { q.refetch(); toast.success("Salvo"); } });
  const delMut = trpc.sipat.removeScheduleItem.useMutation({ onSuccess: () => { q.refetch(); toast.success("Removido"); } });
  const [form, setForm] = useState({ day: "", time: "", title: "", description: "", meetingUrl: "" });
  return (
    <div>
      <div className="space-y-2 mb-4">
        {items.length === 0 && <p className="text-xs text-slate-500">Nenhum evento cadastrado ainda.</p>}
        {items.map((it: any) => (
          <div key={it.id} className="flex items-center gap-2 border rounded p-2 text-sm bg-slate-50">
            <span className="font-mono text-xs px-2 py-1 rounded text-white" style={{ background: color }}>{String(it.day).slice(0,10)} {it.time?.slice(0,5)}</span>
            <span className="flex-1"><b>{it.title}</b>{it.description ? <> — <span className="text-slate-600">{it.description}</span></> : ""}</span>
            {it.meeting_url && <a href={it.meeting_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 hover:underline">🎥 link</a>}
            <button onClick={() => { if(confirm("Remover?")) delMut.mutate({ id: it.id }); }} className="text-rose-600 hover:opacity-70"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
        <input type="date" value={form.day} onChange={e=>setForm({...form,day:e.target.value})} className="border rounded px-2 py-1.5"/>
        <input type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})} className="border rounded px-2 py-1.5"/>
        <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Título (palestra, dinâmica)" className="border rounded px-2 py-1.5 col-span-2"/>
        <input value={form.meetingUrl} onChange={e=>setForm({...form,meetingUrl:e.target.value})} placeholder="Link Meet/Teams" className="border rounded px-2 py-1.5"/>
        <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição (opcional)" className="border rounded px-2 py-1.5 col-span-4 min-h-[40px]"/>
        <button onClick={() => { if(!form.day || !form.title) return toast.error("Dia + Título obrigatórios"); addMut.mutate({ editionId, ...form }); setForm({day:"",time:"",title:"",description:"",meetingUrl:""}); }}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded px-3 py-1.5 font-semibold">+ Adicionar</button>
      </div>
    </div>
  );
}

function SipatMaterials({ editionId, color }: { editionId: number; color: string }) {
  const q = trpc.sipat.listMaterials.useQuery({ editionId });
  const mats = (q.data ?? []) as any[];
  const upMut = trpc.sipat.upsertMaterial.useMutation({ onSuccess: () => { q.refetch(); toast.success("Salvo"); } });
  const delMut = trpc.sipat.removeMaterial.useMutation({ onSuccess: () => { q.refetch(); toast.success("Removido"); } });
  const [form, setForm] = useState({ kind: "banner", title: "", url: "" });

  // R5-P12 #4 — conteúdo do Estúdio (cursos e pesquisas) para inserir na SIPAT.
  const modulesQ = (trpc.emailCampaigns as any).getModules.useQuery(undefined);
  const surveysQ = (trpc.emailCampaigns as any).getSurveys.useQuery(undefined);
  const estCursos = (modulesQ.data ?? []) as any[];
  const estPesquisas = (surveysQ.data ?? []) as any[];
  const [estTipo, setEstTipo] = useState<"course" | "survey">("course");
  const [estId, setEstId] = useState<string>("");

  function addEstudio() {
    if (!estId) { toast.error("Selecione um conteúdo"); return; }
    if (estTipo === "course") {
      const c = estCursos.find((x: any) => String(x.id) === estId);
      if (!c) return;
      upMut.mutate({ editionId, kind: "course", title: c.title, url: `/cursos/${c.id}` });
    } else {
      const s = estPesquisas.find((x: any) => String(x.id) === estId);
      if (!s) return;
      upMut.mutate({ editionId, kind: "survey", title: s.title, url: `/pesquisas` });
    }
    setEstId("");
  }

  const iconFor = (k: string) =>
    k === "course" ? <BookOpen size={14}/> :
    k === "survey" ? <ClipboardList size={14}/> :
    (k === "banner" || k === "imagem") ? <ImageIcon size={14}/> :
    k === "video" ? <Video size={14}/> : <FileText size={14}/>;

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-2 mb-4">
        {mats.map((m: any) => (
          <div key={m.id} className="border rounded p-2 text-sm bg-slate-50">
            <div className="flex items-center gap-2">
              {iconFor(m.kind)}
              <span className="font-medium flex-1">{m.title}</span>
              {(m.kind === "course" || m.kind === "survey") && <span className="text-[10px] uppercase bg-emerald-100 text-emerald-700 px-1 rounded">Estúdio</span>}
              <button onClick={() => { if(confirm("Remover?")) delMut.mutate({ id: m.id }); }} className="text-rose-600 hover:opacity-70"><Trash2 size={14}/></button>
            </div>
            <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 hover:underline truncate block">{m.url}</a>
          </div>
        ))}
      </div>

      {/* R5-P12 #4 — inserir conteúdo do Estúdio (curso/pesquisa) na SIPAT */}
      <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 mb-4">
        <div className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-1"><Sparkles size={14}/> Conteúdo do Estúdio</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
          <select value={estTipo} onChange={e=>{setEstTipo(e.target.value as any); setEstId("");}} className="border rounded px-2 py-1.5">
            <option value="course">Curso</option>
            <option value="survey">Pesquisa</option>
          </select>
          <select value={estId} onChange={e=>setEstId(e.target.value)} className="border rounded px-2 py-1.5 md:col-span-2">
            <option value="">— Selecione —</option>
            {(estTipo === "course" ? estCursos : estPesquisas).map((c: any) => (
              <option key={c.id} value={String(c.id)}>{c.title}</option>
            ))}
          </select>
          <button onClick={addEstudio} className="rounded px-3 py-1.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700">+ Adicionar à SIPAT</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
        <select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})} className="border rounded px-2 py-1.5">
          <option value="banner">Banner</option>
          <option value="imagem">Imagem</option>
          <option value="video">Vídeo</option>
          <option value="pdf">PDF</option>
          <option value="link">Link</option>
        </select>
        <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Título" className="border rounded px-2 py-1.5"/>
        <input value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="URL pública" className="border rounded px-2 py-1.5 col-span-2"/>
        <button onClick={() => { if(!form.title || !form.url) return toast.error("Título + URL"); upMut.mutate({ editionId, ...form }); setForm({kind:"banner",title:"",url:""}); }}
          className="rounded px-3 py-1.5 font-semibold text-white" style={{background: color}}>+ Adicionar</button>
      </div>
    </div>
  );
}

/**
 * P13 #3 — Gestão completa de sorteios da SIPAT.
 * Editar/duplicar/excluir/encerrar, agendar data/hora, ver nº de inscritos,
 * sortear com animação + confirmação (evitando repetir vencedor quando configurado),
 * registro automático de responsável/data e histórico + exportação da relação.
 */
function fmtDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function toInputDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SipatRaffles({ editionId, color }: { editionId: number; color: string }) {
  const q = trpc.sipat.listRaffles.useQuery({ editionId });
  const partQ = (trpc.sipat as any).raffleParticipants.useQuery({ editionId });
  const raffles = (q.data ?? []) as any[];
  const participants = (partQ.data?.participants ?? []) as any[];
  const winners = (partQ.data?.winners ?? []) as any[];

  const refetchAll = () => { q.refetch(); partQ.refetch?.(); };

  const drawMut = (trpc.sipat as any).drawRaffle.useMutation({ onError: (e: any) => toast.error(e?.message ?? "Erro no sorteio") });
  const addMut = (trpc.sipat as any).upsertRaffle.useMutation({ onSuccess: () => { refetchAll(); toast.success("Sorteio criado"); }, onError: (e: any) => toast.error(e?.message ?? "Erro") });
  const updMut = (trpc.sipat as any).updateRaffle.useMutation({ onSuccess: () => { refetchAll(); toast.success("Sorteio atualizado"); setEditing(null); }, onError: (e: any) => toast.error(e?.message ?? "Erro") });
  const delMut = (trpc.sipat as any).removeRaffle.useMutation({ onSuccess: () => { refetchAll(); toast.success("Sorteio excluído"); }, onError: (e: any) => toast.error(e?.message ?? "Erro") });
  const dupMut = (trpc.sipat as any).duplicateRaffle.useMutation({ onSuccess: () => { refetchAll(); toast.success("Sorteio duplicado"); }, onError: (e: any) => toast.error(e?.message ?? "Erro") });
  const closeMut = (trpc.sipat as any).closeRaffle.useMutation({ onSuccess: () => { refetchAll(); toast.success("Sorteio encerrado"); }, onError: (e: any) => toast.error(e?.message ?? "Erro") });
  const reopenMut = (trpc.sipat as any).reopenRaffle.useMutation({ onSuccess: () => { refetchAll(); toast.success("Sorteio reaberto"); }, onError: (e: any) => toast.error(e?.message ?? "Erro") });

  const [form, setForm] = useState({ prize: "", scheduledAt: "", allowRepeat: false });
  const [editing, setEditing] = useState<any | null>(null);

  // Estado do modal de sorteio (animação + confirmação)
  const [drawModal, setDrawModal] = useState<{ raffle: any; phase: "confirm" | "spinning" | "result"; winner?: string; email?: string } | null>(null);
  const [spinName, setSpinName] = useState("");

  function abrirSorteio(raffle: any) {
    setDrawModal({ raffle, phase: "confirm" });
  }
  async function realizarSorteio() {
    if (!drawModal) return;
    const raffle = drawModal.raffle;
    setDrawModal({ raffle, phase: "spinning" });
    // Animação: alterna nomes de participantes por ~2s
    const names = participants.map((p) => p.name).filter(Boolean);
    let ticks = 0;
    const timer = setInterval(() => {
      if (names.length) setSpinName(names[Math.floor(Math.random() * names.length)]);
      ticks++;
    }, 90);
    try {
      const res: any = await drawMut.mutateAsync({ id: raffle.id });
      // deixa a animação rodar um pouco antes de revelar
      await new Promise((r) => setTimeout(r, Math.max(0, 1600 - ticks * 90)));
      clearInterval(timer);
      setDrawModal({ raffle, phase: "result", winner: res.winnerName, email: res.winnerEmail });
      refetchAll();
    } catch {
      clearInterval(timer);
      setDrawModal(null);
    }
  }

  function exportarCSV() {
    const linhas: string[] = [];
    linhas.push("Tipo;Nome;E-mail;Cargo;Premio;Data do sorteio;Responsavel");
    for (const w of winners) {
      linhas.push(`Vencedor;${w.winner_name ?? ""};${w.winner_email ?? ""};;${w.prize ?? ""};${fmtDateTime(w.drawn_at)};${w.drawn_by_name ?? ""}`);
    }
    for (const p of participants) {
      linhas.push(`Participante;${p.name ?? ""};${p.email ?? ""};${p.position ?? ""};;;`);
    }
    const csv = "﻿" + linhas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sipat_sorteios_edicao_${editionId}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  const statusBadge = (r: any) => {
    if (r.winner_name) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Realizado</span>;
    if (r.status === "encerrado") return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Encerrado</span>;
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Aberto</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <p className="text-xs text-slate-500 flex items-center gap-1"><Users size={13} /> {participants.length} colaborador(es) elegível(is) nesta edição</p>
        <button onClick={exportarCSV} className="text-xs inline-flex items-center gap-1 border rounded px-2 py-1 hover:bg-slate-50"><Download size={13} /> Exportar participantes/vencedores</button>
      </div>

      <div className="space-y-2 mb-3">
        {raffles.length === 0 && <p className="text-xs text-slate-500">Nenhum sorteio criado.</p>}
        {raffles.map((r: any) => (
          <div key={r.id} className="border rounded-lg p-3 text-sm bg-amber-50/60">
            {editing?.id === r.id ? (
              <div className="space-y-2">
                <input value={editing.prize} onChange={e => setEditing({ ...editing, prize: e.target.value })} className="border rounded px-2 py-1.5 w-full" placeholder="Prêmio" />
                <div className="flex gap-2 flex-wrap items-center">
                  <label className="text-xs text-slate-600 flex items-center gap-1"><Clock size={12} /> Data/hora:
                    <input type="datetime-local" value={editing.scheduledAt} onChange={e => setEditing({ ...editing, scheduledAt: e.target.value })} className="border rounded px-2 py-1 ml-1" />
                  </label>
                  <label className="text-xs text-slate-600 flex items-center gap-1">
                    <input type="checkbox" checked={editing.allowRepeat} onChange={e => setEditing({ ...editing, allowRepeat: e.target.checked })} /> permitir repetir vencedor
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updMut.mutate({ id: r.id, prize: editing.prize, scheduledAt: editing.scheduledAt || null, allowRepeatWinner: editing.allowRepeat })} className="text-xs bg-emerald-600 text-white px-3 py-1 rounded inline-flex items-center gap-1"><Save size={12} /> Salvar</button>
                  <button onClick={() => setEditing(null)} className="text-xs border px-3 py-1 rounded">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="text-xl">🎁</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2 flex-wrap">{r.prize} {statusBadge(r)}</div>
                  {r.winner_name ? (
                    <div className="text-xs text-emerald-700">🏆 {r.winner_name} ({r.winner_email})
                      {r.drawn_at && <span className="text-slate-400"> · {fmtDateTime(r.drawn_at)}{r.drawn_by_name ? ` · por ${r.drawn_by_name}` : ""}</span>}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      {r.scheduled_at ? <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmtDateTime(r.scheduled_at)}</span> : <span>Sem data definida</span>}
                      {!!r.allow_repeat_winner && <span className="text-amber-600">· permite repetir</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!r.winner_name && r.status !== "encerrado" && (
                    <button onClick={() => abrirSorteio(r)} className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded font-semibold">Sortear</button>
                  )}
                  {!r.winner_name && (
                    <button title="Editar" onClick={() => setEditing({ id: r.id, prize: r.prize, scheduledAt: toInputDateTime(r.scheduled_at), allowRepeat: !!r.allow_repeat_winner })} className="p-1.5 rounded hover:bg-white text-slate-500"><Pencil size={14} /></button>
                  )}
                  <button title="Duplicar" onClick={() => dupMut.mutate({ id: r.id })} className="p-1.5 rounded hover:bg-white text-slate-500"><Copy size={14} /></button>
                  {!r.winner_name && (r.status === "encerrado"
                    ? <button title="Reabrir" onClick={() => reopenMut.mutate({ id: r.id })} className="p-1.5 rounded hover:bg-white text-slate-500"><Unlock size={14} /></button>
                    : <button title="Encerrar" onClick={() => closeMut.mutate({ id: r.id })} className="p-1.5 rounded hover:bg-white text-slate-500"><Lock size={14} /></button>
                  )}
                  <button title="Excluir" onClick={() => { if (confirm(`Excluir o sorteio "${r.prize}"?`)) delMut.mutate({ id: r.id }); }} className="p-1.5 rounded hover:bg-white text-rose-500"><Trash2 size={14} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Criar sorteio */}
      <div className="border rounded-lg p-3 bg-white space-y-2">
        <div className="text-xs font-semibold text-slate-600">Novo sorteio</div>
        <div className="flex gap-2 flex-wrap items-center text-sm">
          <input value={form.prize} onChange={e => setForm({ ...form, prize: e.target.value })} placeholder="Prêmio (ex: Day Off, Kit Saúde)" className="border rounded px-2 py-1.5 flex-1 min-w-[200px]" />
          <label className="text-xs text-slate-600 flex items-center gap-1"><Clock size={12} /> agendar:
            <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} className="border rounded px-2 py-1 ml-1" />
          </label>
          <label className="text-xs text-slate-600 flex items-center gap-1">
            <input type="checkbox" checked={form.allowRepeat} onChange={e => setForm({ ...form, allowRepeat: e.target.checked })} /> permitir repetir vencedor
          </label>
          <button onClick={() => { if (!form.prize) return; addMut.mutate({ editionId, prize: form.prize, scheduledAt: form.scheduledAt || undefined, allowRepeatWinner: form.allowRepeat }); setForm({ prize: "", scheduledAt: "", allowRepeat: false }); }} className="rounded px-3 py-1.5 font-semibold text-white inline-flex items-center gap-1" style={{ background: color }}><Plus size={14} /> Criar</button>
        </div>
      </div>

      {/* Modal de sorteio: confirmação → animação → resultado */}
      {drawModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center relative">
            {drawModal.phase !== "spinning" && (
              <button onClick={() => setDrawModal(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            )}
            {drawModal.phase === "confirm" && (
              <>
                <Trophy size={40} className="mx-auto text-amber-500 mb-2" />
                <h3 className="text-lg font-bold mb-1">Sortear "{drawModal.raffle.prize}"</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Participantes elegíveis: <b>{participants.length}</b>.<br />
                  {drawModal.raffle.allow_repeat_winner ? "Vencedores anteriores também concorrem." : "Quem já venceu nesta edição fica de fora."}<br />
                  O resultado é definitivo. Deseja continuar?
                </p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setDrawModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                  <button onClick={realizarSorteio} disabled={participants.length === 0} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50">Realizar sorteio</button>
                </div>
              </>
            )}
            {drawModal.phase === "spinning" && (
              <>
                <div className="text-xs uppercase tracking-widest text-amber-600 font-bold mb-3">Sorteando…</div>
                <div className="h-16 flex items-center justify-center">
                  <span className="text-2xl font-extrabold text-slate-800 animate-pulse">{spinName || "..."}</span>
                </div>
                <div className="w-full h-1.5 bg-amber-100 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-amber-500 animate-[pulse_0.6s_ease-in-out_infinite] w-2/3" />
                </div>
              </>
            )}
            {drawModal.phase === "result" && (
              <>
                <PartyPopper size={44} className="mx-auto text-emerald-500 mb-2" />
                <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold">Vencedor</div>
                <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{drawModal.winner}</h3>
                {drawModal.email && <p className="text-sm text-slate-500">{drawModal.email}</p>}
                <p className="text-xs text-slate-400 mt-2">Prêmio: {drawModal.raffle.prize}</p>
                <button onClick={() => setDrawModal(null)} className="mt-4 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700">Concluir</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Histórico de sorteios realizados */}
      {winners.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-slate-600 mb-1">Histórico de sorteios</div>
          <div className="space-y-1">
            {winners.map((w: any, i: number) => (
              <div key={i} className="text-xs text-slate-600 flex items-center gap-2 border-b py-1">
                <Trophy size={12} className="text-amber-500 shrink-0" />
                <span className="font-medium">{w.prize}</span> → <span className="text-emerald-700">{w.winner_name}</span>
                <span className="text-slate-400 ml-auto">{fmtDateTime(w.drawn_at)}{w.drawn_by_name ? ` · ${w.drawn_by_name}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SipatBlast({ editionId }: { editionId: number }) {
  const blastMut = trpc.sipat.sendBlast.useMutation({
    onSuccess: (r: any) => toast.success(`Notificações: ${r.notified}, e-mails: ${r.emailsSent}`),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  return (
    <div className="flex gap-2 flex-wrap">
      <button onClick={() => blastMut.mutate({ editionId, method: "notification" })} className="px-3 py-2 border border-amber-500 text-amber-600 hover:bg-amber-50 rounded text-sm flex items-center gap-1"><Bell size={14}/> Notificar no sino</button>
      <button onClick={() => blastMut.mutate({ editionId, method: "email" })} className="px-3 py-2 border border-amber-500 text-amber-600 hover:bg-amber-50 rounded text-sm flex items-center gap-1"><Mail size={14}/> Disparar e-mail</button>
      <button onClick={() => blastMut.mutate({ editionId, method: "both" })} className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-semibold flex items-center gap-1">Disparar tudo</button>
    </div>
  );
}
