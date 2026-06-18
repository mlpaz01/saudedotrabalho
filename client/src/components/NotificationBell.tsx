import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Bell, Check, CheckCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

const PRIO: Record<string, { color: string; bg: string; label: string }> = {
  alta: { color: "#b83225", bg: "rgba(184,50,37,.10)", label: "Alta" },
  media: { color: "#a07a10", bg: "rgba(160,122,16,.10)", label: "Média" },
  baixa: { color: "#1A8A82", bg: "rgba(26,138,130,.10)", label: "Baixa" },
};

function fmtTime(s: string): string {
  try {
    const d = new Date(s);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "agora";
    if (diff < 3600) return Math.floor(diff / 60) + " min atrás";
    if (diff < 86400) return Math.floor(diff / 3600) + " h atrás";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  const unread = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 45000,
    refetchOnWindowFocus: true,
  });
  const refresh = trpc.notifications.refresh.useMutation();
  const list = trpc.notifications.list.useQuery({ limit: 30 }, { enabled: open });
  const markRead = trpc.notifications.markRead.useMutation();
  const markAll = trpc.notifications.markAllRead.useMutation();

  // Recompute standing aggregate notifications on first mount.
  useEffect(() => {
    refresh.mutate(undefined, { onSuccess: () => unread.refetch() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute + load list when the panel opens.
  useEffect(() => {
    if (open) {
      refresh.mutate(undefined, {
        onSuccess: () => {
          unread.refetch();
          list.refetch();
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const count = unread.data?.count ?? 0;
  const items: any[] = list.data?.items ?? [];

  function openItem(it: any) {
    if (!it.readAt) {
      markRead.mutate({ id: it.id }, { onSuccess: () => { unread.refetch(); list.refetch(); } });
    }
    if (it.link) {
      setOpen(false);
      navigate(it.link);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="sdt-bell" title="Notificações" onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer" }}>
        {count > 0 && <div className="sdt-bell-dot" />}
        <Bell size={15} />
        {count > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 9, background: "#b83225", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 380, maxWidth: "90vw", background: "#fff", border: "1px solid rgba(14,44,70,.12)", borderRadius: 14, boxShadow: "0 12px 40px rgba(11,18,33,.18)", zIndex: 1000, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid rgba(14,44,70,.08)" }}>
            <strong style={{ fontSize: 14, color: "#0E2C46" }}>Notificações</strong>
            <button onClick={() => markAll.mutate(undefined, { onSuccess: () => { unread.refetch(); list.refetch(); } })} style={{ fontSize: 12, color: "#1A8A82", fontWeight: 700, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCheck size={13} /> Marcar todas
            </button>
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {list.isLoading && <div style={{ padding: 20, textAlign: "center", color: "#789", fontSize: 13 }}>Carregando…</div>}
            {!list.isLoading && items.length === 0 && (
              <div style={{ padding: 28, textAlign: "center", color: "#789", fontSize: 13 }}>Nenhuma notificação no momento.</div>
            )}
            {items.map((it) => {
              const p = PRIO[it.priority] ?? PRIO.media;
              return (
                <div key={it.id} onClick={() => openItem(it)} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: "1px solid rgba(14,44,70,.05)", cursor: it.link ? "pointer" : "default", background: it.readAt ? "#fff" : "rgba(26,138,130,.04)" }}>
                  <span style={{ marginTop: 5, width: 8, height: 8, borderRadius: 8, background: p.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: it.readAt ? 600 : 800, color: "#0E2C46" }}>{it.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: p.color, background: p.bg, padding: "1px 6px", borderRadius: 6, whiteSpace: "nowrap", height: "fit-content" }}>{p.label}</span>
                    </div>
                    {it.body && <p style={{ fontSize: 12, color: "#566", margin: "2px 0 0", lineHeight: 1.4 }}>{it.body}</p>}
                    <span style={{ fontSize: 10.5, color: "#9aa" }}>{fmtTime(it.createdAt)}</span>
                  </div>
                  {!it.readAt && (
                    <button onClick={(e) => { e.stopPropagation(); markRead.mutate({ id: it.id }, { onSuccess: () => { unread.refetch(); list.refetch(); } }); }} title="Marcar como lida" style={{ background: "none", border: "none", cursor: "pointer", color: "#1A8A82", flexShrink: 0, alignSelf: "flex-start" }}>
                      <Check size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
