import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  LifeBuoy, Plus, Send, Paperclip, ArrowLeft, Bot,
  UserCheck, Sparkles, Loader2, X, MessageSquare, CheckCircle2, Clock,
} from "lucide-react";

type TicketRow = {
  id: number;
  subject: string;
  category: string | null;
  status: string;
  priority?: string | null;
  last_message_at: string | null;
  created_at: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
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
  escalated: { label: "Encaminhado", bg: "#FFF4E5", fg: "#C77700" },
  open: { label: "Aberto", bg: "#FFF4E5", fg: "#C77700" },
  in_progress: { label: "Em atendimento", bg: "#EAF2FF", fg: "#3056d3" },
  waiting_user: { label: "Aguardando você", bg: "#FFF4E5", fg: "#C77700" },
  resolved: { label: "Resolvido", bg: "#E9F9F0", fg: "#1a9456" },
  closed: { label: "Encerrado", bg: "#F0F0F0", fg: "#6b7280" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, bg: "#F0F0F0", fg: "#6b7280" };
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
        background: m.bg, color: m.fg, whiteSpace: "nowrap",
      }}
    >
      {m.label}
    </span>
  );
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

export default function Suporte() {
  const { user } = useAuth();
  const listQuery = trpc.support.listMyTickets.useQuery();
  const tickets = (listQuery.data?.tickets ?? []) as TicketRow[];

  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <AppLayout>
        <NewTicketForm
          onCancel={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); setOpenId(id); listQuery.refetch(); }}
        />
      </AppLayout>
    );
  }

  if (openId != null) {
    return (
      <AppLayout>
        <TicketChat
          ticketId={openId}
          currentUserId={(user as any)?.id ?? null}
          onBack={() => { setOpenId(null); listQuery.refetch(); }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: 24, maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(67,194,133,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#43C285" }}>
              <LifeBuoy size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0E2C46", margin: 0 }}>Canal de Suporte</h1>
              <p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0" }}>Tire dúvidas com o assistente virtual ou fale com um analista.</p>
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#43C285", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            <Plus size={17} /> Novo chamado
          </button>
        </div>

        {listQuery.isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 className="animate-spin" size={28} color="#43C285" />
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e6eaef", borderRadius: 14, padding: 48, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(67,194,133,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#43C285", margin: "0 auto 14px" }}>
              <MessageSquare size={26} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#0E2C46", margin: "0 0 6px" }}>Nenhum chamado ainda</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 18px" }}>Abra um chamado e converse com nosso assistente virtual em instantes.</p>
            <button
              onClick={() => setCreating(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#43C285", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              <Plus size={17} /> Abrir meu primeiro chamado
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#94a3b8", margin: "4px 0" }}>Meus chamados</p>
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setOpenId(t.id)}
                style={{ textAlign: "left", background: "#fff", border: "1px solid #e6eaef", borderRadius: 12, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "border-color .15s, box-shadow .15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#43C285"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e6eaef"; }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(14,44,70,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0E2C46", flexShrink: 0 }}>
                  <MessageSquare size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0E2C46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>#{t.id}</span>
                    {t.category ? <><span>·</span><span>{t.category}</span></> : null}
                    <span>·</span>
                    <Clock size={11} /> {fmtTime(t.last_message_at)}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function NewTicketForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: number) => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [firstMessage, setFirstMessage] = useState("");

  const createMut = trpc.support.createTicket.useMutation({
    onSuccess: (r) => { onCreated(r.ticketId); },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!subject.trim() || !firstMessage.trim()) { toast.error("Preencha o assunto e a mensagem."); return; }
    createMut.mutate({ subject: subject.trim(), category: category.trim() || undefined, firstMessage: firstMessage.trim() });
  };

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <div style={{ background: "#fff", border: "1px solid #e6eaef", borderRadius: 14, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Sparkles size={18} color="#43C285" />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0E2C46", margin: 0 }}>Novo chamado</h2>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>Descreva sua dúvida. Nosso assistente virtual responde na hora; se precisar, encaminhamos para um analista.</p>

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0E2C46", marginBottom: 6 }}>Assunto *</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ex.: Não consigo acessar meu certificado"
          maxLength={255}
          style={inputStyle}
        />

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0E2C46", margin: "16px 0 6px" }}>Categoria (opcional)</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          <option value="">Selecione...</option>
          <option value="Acesso e Login">Acesso e Login</option>
          <option value="Cursos">Cursos</option>
          <option value="Certificados">Certificados</option>
          <option value="Pesquisas">Pesquisas</option>
          <option value="Financeiro">Financeiro</option>
          <option value="Outros">Outros</option>
        </select>

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0E2C46", margin: "16px 0 6px" }}>Mensagem *</label>
        <textarea
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          placeholder="Conte com detalhes o que está acontecendo..."
          rows={5}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ background: "transparent", border: "1px solid #d7dde5", color: "#475569", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button
            onClick={submit}
            disabled={createMut.isPending}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#43C285", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: createMut.isPending ? "default" : "pointer", opacity: createMut.isPending ? 0.7 : 1 }}
          >
            {createMut.isPending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            {createMut.isPending ? "Enviando..." : "Iniciar conversa"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d7dde5",
  fontSize: 14, color: "#0E2C46", outline: "none", fontFamily: "inherit", background: "#fff",
};

function TicketChat({ ticketId, currentUserId, onBack }: { ticketId: number; currentUserId: number | null; onBack: () => void }) {
  const ticketQuery = trpc.support.getTicket.useQuery(
    { ticketId },
    { refetchInterval: 10000 }
  );
  const ticket = ticketQuery.data?.ticket as any;
  const messages = (ticketQuery.data?.messages ?? []) as MessageRow[];

  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; base64: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMut = trpc.support.sendMessage.useMutation({
    onSuccess: () => { setBody(""); setAttachment(null); ticketQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const escalateMut = trpc.support.escalateToHuman.useMutation({
    onSuccess: () => { toast.success("Encaminhado para um analista."); ticketQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, sendMut.isPending]);

  const status = ticket?.status as string | undefined;
  const isAiHandling = status === "ai_handling";
  const isEscalated = status === "escalated";
  const isClosed = status === "resolved" || status === "closed";

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 8MB)."); return; }
    try {
      const b64 = await fileToBase64(f);
      setAttachment({ name: f.name, base64: b64 });
    } catch { toast.error("Falha ao ler o arquivo."); }
  };

  const send = () => {
    if (!body.trim() && !attachment) return;
    sendMut.mutate({ ticketId, body: body.trim() || "(anexo)", attachmentBase64: attachment?.base64 });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 860, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #e6eaef", display: "flex", alignItems: "center", gap: 14, background: "#fff" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "1px solid #e6eaef", background: "#fff", color: "#0E2C46", cursor: "pointer", flexShrink: 0 }}>
          <ArrowLeft size={17} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "#0E2C46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket?.subject ?? "Chamado"}</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>#{ticketId}{ticket?.category ? ` · ${ticket.category}` : ""}</div>
        </div>
        {status ? <StatusBadge status={status} /> : null}
      </div>

      {/* Hints */}
      {isAiHandling && (
        <div style={{ margin: "12px 24px 0", display: "flex", alignItems: "center", gap: 10, background: "#EAF6FF", border: "1px solid #cfe8fb", borderRadius: 10, padding: "10px 14px" }}>
          <Bot size={17} color="#1a7fc4" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: "#0c5a8a", flex: 1 }}>Você está conversando com o assistente virtual.</span>
          <button
            onClick={() => escalateMut.mutate({ ticketId })}
            disabled={escalateMut.isPending}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #1a7fc4", color: "#1a7fc4", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
          >
            {escalateMut.isPending ? <Loader2 className="animate-spin" size={13} /> : <UserCheck size={14} />}
            Falar com um analista
          </button>
        </div>
      )}
      {isEscalated && (
        <div style={{ margin: "12px 24px 0", display: "flex", alignItems: "center", gap: 10, background: "#FFF4E5", border: "1px solid #ffe1b8", borderRadius: 10, padding: "10px 14px" }}>
          <UserCheck size={17} color="#C77700" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: "#8a5200" }}>Sua conversa foi encaminhada para um analista. Você receberá uma resposta em breve.</span>
        </div>
      )}
      {isClosed && (
        <div style={{ margin: "12px 24px 0", display: "flex", alignItems: "center", gap: 10, background: "#E9F9F0", border: "1px solid #c5ecd5", borderRadius: 10, padding: "10px 14px" }}>
          <CheckCircle2 size={17} color="#1a9456" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: "#0f6e3f" }}>Este chamado foi encerrado. Abra um novo chamado se precisar de mais ajuda.</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {ticketQuery.isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 className="animate-spin" size={26} color="#43C285" /></div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} isMine={m.sender_type === "user" && (currentUserId == null || m.sender_user_id === currentUserId)} />)
        )}
        {sendMut.isPending && isAiHandling && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 12.5, paddingLeft: 4 }}>
            <Bot size={15} /> <Loader2 className="animate-spin" size={13} /> Assistente está digitando...
          </div>
        )}
      </div>

      {/* Composer */}
      {!isClosed && (
        <div style={{ borderTop: "1px solid #e6eaef", padding: "12px 24px 18px", background: "#fff" }}>
          {attachment && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f1f5f9", borderRadius: 8, padding: "5px 10px", marginBottom: 8, fontSize: 12.5, color: "#475569" }}>
              <Paperclip size={13} /> <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.name}</span>
              <button onClick={() => setAttachment(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}><X size={14} /></button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => onPickFile(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              title="Anexar arquivo"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 11, border: "1px solid #d7dde5", background: "#fff", color: "#64748b", cursor: "pointer", flexShrink: 0 }}
            >
              <Paperclip size={18} />
            </button>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={isEscalated ? "Escreva uma mensagem para o analista..." : "Escreva sua mensagem..."}
              rows={1}
              style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid #d7dde5", fontSize: 14, color: "#0E2C46", outline: "none", fontFamily: "inherit", resize: "none", maxHeight: 120, lineHeight: 1.4 }}
            />
            <button
              onClick={send}
              disabled={sendMut.isPending || (!body.trim() && !attachment)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 11, border: "none", background: "#43C285", color: "#fff", cursor: "pointer", flexShrink: 0, opacity: sendMut.isPending || (!body.trim() && !attachment) ? 0.55 : 1 }}
            >
              {sendMut.isPending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ m, isMine }: { m: MessageRow; isMine: boolean }) {
  if (m.sender_type === "system") {
    return (
      <div style={{ alignSelf: "center", fontSize: 12, color: "#94a3b8", background: "#f1f5f9", borderRadius: 20, padding: "5px 14px" }}>
        {m.body}
      </div>
    );
  }
  const isAi = m.sender_type === "ai";
  const isAgent = m.sender_type === "agent";
  const align = isMine ? "flex-end" : "flex-start";

  const avatar = isMine ? null : (
    <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", background: isAi ? "linear-gradient(135deg,#1a7fc4,#43C285)" : "linear-gradient(135deg,#0E2C46,#1a7fc4)" }}>
      {isAi ? <Bot size={16} /> : <UserCheck size={16} />}
    </div>
  );

  const bubbleBg = isMine ? "#43C285" : isAi ? "#EAF6FF" : "#fff";
  const bubbleColor = isMine ? "#fff" : "#0E2C46";
  const border = isMine ? "none" : isAi ? "1px solid #cfe8fb" : "1px solid #e6eaef";

  return (
    <div style={{ display: "flex", justifyContent: align, gap: 8, alignItems: "flex-end" }}>
      {!isMine && avatar}
      <div style={{ maxWidth: "76%" }}>
        {!isMine && (
          <div style={{ fontSize: 11, fontWeight: 700, color: isAi ? "#1a7fc4" : "#0E2C46", margin: "0 0 3px 4px" }}>
            {isAi ? "Assistente Virtual" : (m.sender_name || "Analista")}
          </div>
        )}
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
