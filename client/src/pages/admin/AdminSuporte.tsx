import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Headphones, Inbox, AlertTriangle, CheckCircle2, Clock, ArrowLeft,
  Send, Paperclip, Loader2, Bot, UserCheck, X, UserPlus, MessageSquare,
} from "lucide-react";

type TicketRow = {
  id: number;
  company_id: number | null;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  subject: string;
  category: string | null;
  status: string;
  priority?: string | null;
  assigned_to_user_id: number | null;
  escalated_at: string | null;
  resolved_at: string | null;
  last_message_at: string | null;
  created_at: string | null;
};

type MessageRow = {
  id: number;
  sender_type: "user" | "ai" | "agent" | "system";
  sender_user_id: number | null;
  sender_name: string | null;
  body: string;
  attachment_url: string | null;
  created_at: string | null;
};

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  ai_handling: { label: "Assistente Virtual", bg: "#EAF6FF", fg: "#1a7fc4" },
  escalated: { label: "Escalado", bg: "#FFF4E5", fg: "#C77700" },
  open: { label: "Aberto", bg: "#FFF4E5", fg: "#C77700" },
  in_progress: { label: "Em atendimento", bg: "#EAF2FF", fg: "#3056d3" },
  waiting_user: { label: "Aguardando usuário", bg: "#FFF4E5", fg: "#C77700" },
  resolved: { label: "Resolvido", bg: "#E9F9F0", fg: "#1a9456" },
  closed: { label: "Encerrado", bg: "#F0F0F0", fg: "#6b7280" },
};

const STATUS_OPTIONS = ["ai_handling", "escalated", "open", "in_progress", "waiting_user", "resolved", "closed"] as const;

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, bg: "#F0F0F0", fg: "#6b7280" };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: m.bg, color: m.fg, whiteSpace: "nowrap" }}>{m.label}</span>;
}

function fmtTime(s: string | null) {
  if (!s) return "";
  try {
    const d = new Date(s.includes("T") || s.includes("Z") ? s : s.replace(" ", "T") + "Z");
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function AdminSuporte() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [openId, setOpenId] = useState<number | null>(null);

  const dashQuery = trpc.support.supportDashboard.useQuery();
  const listQuery = trpc.support.listAllTickets.useQuery({
    status: statusFilter || undefined,
    companyId: companyFilter ? Number(companyFilter) : undefined,
  });
  const tickets = (listQuery.data?.tickets ?? []) as TicketRow[];
  const dash = dashQuery.data;

  if (openId != null) {
    return (
      <AppLayout>
        <AdminTicketChat
          ticketId={openId}
          onBack={() => { setOpenId(null); listQuery.refetch(); dashQuery.refetch(); }}
        />
      </AppLayout>
    );
  }

  const companyOptions = Array.from(new Set(tickets.map((t) => t.company_id).filter((c): c is number => c != null)));

  const kpis = [
    { label: "Abertos", value: dash?.open ?? 0, icon: <Inbox size={18} />, color: "#1a7fc4", bg: "rgba(26,127,196,0.1)" },
    { label: "Escalados", value: dash?.byStatus?.["escalated"] ?? 0, icon: <AlertTriangle size={18} />, color: "#C77700", bg: "rgba(199,119,0,0.1)" },
    { label: "Resolvidos", value: dash?.resolved ?? 0, icon: <CheckCircle2 size={18} />, color: "#1a9456", bg: "rgba(26,148,86,0.1)" },
    { label: "Tempo médio (h)", value: dash ? Math.round((dash.avgResolutionHours ?? 0) * 10) / 10 : 0, icon: <Clock size={18} />, color: "#6b46c1", bg: "rgba(107,70,193,0.1)" },
  ];

  return (
    <AppLayout>
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(67,194,133,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#43C285" }}>
            <Headphones size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0E2C46", margin: 0 }}>Central de Suporte</h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0" }}>Atenda chamados, responda usuários e acompanhe os indicadores.</p>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 22 }}>
          {kpis.map((k) => (
            <div key={k.label} style={{ background: "#fff", border: "1px solid #e6eaef", borderRadius: 14, padding: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{k.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0E2C46" }}>{dashQuery.isLoading ? "—" : k.value}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selStyle}>
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>)}
          </select>
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} style={selStyle}>
            <option value="">Todas as empresas</option>
            {companyOptions.map((c) => <option key={c} value={String(c)}>Empresa #{c}</option>)}
          </select>
          {(statusFilter || companyFilter) && (
            <button onClick={() => { setStatusFilter(""); setCompanyFilter(""); }} style={{ background: "transparent", border: "1px solid #d7dde5", borderRadius: 10, padding: "8px 14px", fontSize: 13, color: "#475569", cursor: "pointer", fontWeight: 600 }}>Limpar</button>
          )}
        </div>

        {/* List */}
        {listQuery.isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 50 }}><Loader2 className="animate-spin" size={28} color="#43C285" /></div>
        ) : tickets.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e6eaef", borderRadius: 14, padding: 48, textAlign: "center", color: "#94a3b8" }}>
            <MessageSquare size={28} style={{ margin: "0 auto 10px", display: "block" }} />
            Nenhum chamado encontrado.
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e6eaef", borderRadius: 14, overflow: "hidden" }}>
            {tickets.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setOpenId(t.id)}
                style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", background: "#fff", border: "none", borderTop: i === 0 ? "none" : "1px solid #f0f3f6", cursor: "pointer" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0E2C46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    #{t.id} · {t.user_name || t.user_email || "Usuário"}{t.company_id ? ` · Empresa #${t.company_id}` : ""} · {fmtTime(t.last_message_at)}
                  </div>
                </div>
                {t.assigned_to_user_id ? <span style={{ fontSize: 11, color: "#475569", background: "#eef2f6", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>Atribuído</span> : null}
                <StatusBadge status={t.status} />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

const selStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10, border: "1px solid #d7dde5", fontSize: 13.5,
  color: "#0E2C46", background: "#fff", outline: "none", fontFamily: "inherit", cursor: "pointer",
};

function AdminTicketChat({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const { user } = useAuth();
  const myId = (user as any)?.id ?? null;
  const ticketQuery = trpc.support.getTicket.useQuery({ ticketId }, { refetchInterval: 10000 });
  const ticket = ticketQuery.data?.ticket as any;
  const messages = (ticketQuery.data?.messages ?? []) as MessageRow[];

  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; base64: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const replyMut = trpc.support.agentReply.useMutation({
    onSuccess: () => { setBody(""); setAttachment(null); ticketQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const assignMut = trpc.support.assignTicket.useMutation({
    onSuccess: () => { toast.success("Chamado atribuído a você."); ticketQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const statusMut = trpc.support.updateTicketStatus.useMutation({
    onSuccess: () => { toast.success("Status atualizado."); ticketQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, replyMut.isPending]);

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 8MB)."); return; }
    try { setAttachment({ name: f.name, base64: await fileToBase64(f) }); }
    catch { toast.error("Falha ao ler o arquivo."); }
  };

  const send = () => {
    if (!body.trim() && !attachment) return;
    replyMut.mutate({ ticketId, body: body.trim() || "(anexo)", attachmentBase64: attachment?.base64 });
  };

  const assignedToMe = ticket?.assigned_to_user_id != null && myId != null && ticket.assigned_to_user_id === myId;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 920, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid #e6eaef", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "1px solid #e6eaef", background: "#fff", color: "#0E2C46", cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={17} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: "#0E2C46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket?.subject ?? "Chamado"}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              #{ticketId}{ticket?.user_name ? ` · ${ticket.user_name}` : ""}{ticket?.user_email ? ` (${ticket.user_email})` : ""}{ticket?.company_id ? ` · Empresa #${ticket.company_id}` : ""}
            </div>
          </div>
          {ticket?.status ? <StatusBadge status={ticket.status} /> : null}
        </div>

        {/* Action bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => myId != null && assignMut.mutate({ ticketId, agentUserId: myId })}
            disabled={assignMut.isPending || assignedToMe || myId == null}
            style={{ display: "flex", alignItems: "center", gap: 7, background: assignedToMe ? "#eef2f6" : "#fff", border: "1px solid #d7dde5", color: assignedToMe ? "#1a9456" : "#0E2C46", borderRadius: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: assignedToMe ? "default" : "pointer", opacity: assignMut.isPending ? 0.6 : 1 }}
          >
            {assignedToMe ? <CheckCircle2 size={14} /> : <UserPlus size={14} />}
            {assignedToMe ? "Atribuído a você" : "Assumir chamado"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 600 }}>Status:</span>
            <select
              value={ticket?.status ?? ""}
              onChange={(e) => statusMut.mutate({ ticketId, status: e.target.value as any })}
              disabled={statusMut.isPending || !ticket}
              style={selStyle}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14, background: "#fafbfc" }}>
        {ticketQuery.isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 className="animate-spin" size={26} color="#43C285" /></div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} isMine={m.sender_type === "agent" && (myId == null || m.sender_user_id === myId)} />)
        )}
      </div>

      {/* Composer */}
      <div style={{ borderTop: "1px solid #e6eaef", padding: "12px 24px 18px", background: "#fff" }}>
        {attachment && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f1f5f9", borderRadius: 8, padding: "5px 10px", marginBottom: 8, fontSize: 12.5, color: "#475569" }}>
            <Paperclip size={13} /> <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.name}</span>
            <button onClick={() => setAttachment(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}><X size={14} /></button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => onPickFile(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} title="Anexar arquivo" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 11, border: "1px solid #d7dde5", background: "#fff", color: "#64748b", cursor: "pointer", flexShrink: 0 }}>
            <Paperclip size={18} />
          </button>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Responder ao usuário como analista..."
            rows={1}
            style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid #d7dde5", fontSize: 14, color: "#0E2C46", outline: "none", fontFamily: "inherit", resize: "none", maxHeight: 120, lineHeight: 1.4 }}
          />
          <button
            onClick={send}
            disabled={replyMut.isPending || (!body.trim() && !attachment)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 11, border: "none", background: "#43C285", color: "#fff", cursor: "pointer", flexShrink: 0, opacity: replyMut.isPending || (!body.trim() && !attachment) ? 0.55 : 1 }}
          >
            {replyMut.isPending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m, isMine }: { m: MessageRow; isMine: boolean }) {
  if (m.sender_type === "system") {
    return <div style={{ alignSelf: "center", fontSize: 12, color: "#94a3b8", background: "#eef2f6", borderRadius: 20, padding: "5px 14px" }}>{m.body}</div>;
  }
  const isAi = m.sender_type === "ai";
  const isUser = m.sender_type === "user";
  const align = isMine ? "flex-end" : "flex-start";

  const avatar = isMine ? null : (
    <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", background: isAi ? "linear-gradient(135deg,#1a7fc4,#43C285)" : isUser ? "linear-gradient(135deg,#0E2C46,#1a7fc4)" : "linear-gradient(135deg,#6b46c1,#43C285)" }}>
      {isAi ? <Bot size={16} /> : isUser ? (m.sender_name || "U")[0].toUpperCase() : <UserCheck size={16} />}
    </div>
  );

  const bubbleBg = isMine ? "#43C285" : isAi ? "#EAF6FF" : "#fff";
  const bubbleColor = isMine ? "#fff" : "#0E2C46";
  const border = isMine ? "none" : isAi ? "1px solid #cfe8fb" : "1px solid #e6eaef";
  const label = isAi ? "Assistente Virtual" : isUser ? (m.sender_name || "Usuário") : (m.sender_name || "Analista");

  return (
    <div style={{ display: "flex", justifyContent: align, gap: 8, alignItems: "flex-end" }}>
      {!isMine && avatar}
      <div style={{ maxWidth: "76%" }}>
        {!isMine && <div style={{ fontSize: 11, fontWeight: 700, color: isAi ? "#1a7fc4" : isUser ? "#0E2C46" : "#6b46c1", margin: "0 0 3px 4px" }}>{label}</div>}
        <div style={{ background: bubbleBg, color: bubbleColor, border, borderRadius: 14, padding: "10px 14px", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {m.body}
          {m.attachment_url && (
            <div style={{ marginTop: 8 }}>
              <a href={m.attachment_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: isMine ? "#fff" : "#1a7fc4", textDecoration: "underline" }}>
                <Paperclip size={13} /> Ver anexo
              </a>
            </div>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: "#b0bcc9", margin: "3px 4px 0", textAlign: isMine ? "right" : "left" }}>{fmtTime(m.created_at)}</div>
      </div>
    </div>
  );
}
