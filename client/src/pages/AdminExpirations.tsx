import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Clock } from "lucide-react";

function daysUntil(dt: any): number {
  if (!dt) return Infinity;
  return Math.ceil((new Date(dt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmtDate(dt: any) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("pt-BR");
}

function StatusBadge({ status, days }: { status: string; days: number }) {
  if (status === "expired") return <Badge className="bg-red-500 text-white">🔴 Vencido</Badge>;
  if (status === "expiring_soon") return <Badge className="bg-yellow-500 text-white">🟡 Vence em {days}d</Badge>;
  if (status === "valid") return <Badge className="bg-green-500 text-white">🟢 Válido</Badge>;
  return <Badge variant="secondary">Sem vencimento</Badge>;
}

type Filter = "all" | "expired" | "30d" | "90d" | "valid";

export default function AdminExpirations() {
  const { data, isLoading } = trpc.dashboard.companyExpirations.useQuery();
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const list: any[] = [];
    (Array.isArray(data) ? data : []).forEach((l: any) => list.push({ ...l, kind: "Licença", itemName: `${l.licenseType}${l.licenseNumber ? " · " + l.licenseNumber : ""}`, userName: l.userName, userEmail: l.userEmail }));
    return list.sort((a, b) => {
      const ax = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bx = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      return ax - bx;
    });
  }, [data]);

  const filtered = rows.filter(r => {
    const d = daysUntil(r.expiresAt);
    if (filter === "all") return true;
    if (filter === "expired") return r.status === "expired";
    if (filter === "30d") return r.status === "expiring_soon" && d <= 30 && d >= 0;
    if (filter === "90d") return d <= 90 && d > 30;
    if (filter === "valid") return r.status === "valid";
    return true;
  });

  const counts = useMemo(() => {
    const c = { all: rows.length, expired: 0, "30d": 0, "90d": 0, valid: 0 } as any;
    rows.forEach(r => {
      const d = daysUntil(r.expiresAt);
      if (r.status === "expired") c.expired++;
      else if (r.status === "expiring_soon" && d <= 30 && d >= 0) c["30d"]++;
      else if (d <= 90 && d > 30) c["90d"]++;
      else if (r.status === "valid") c.valid++;
    });
    return c;
  }, [rows]);

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Clock className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Vencimentos</h1>
            <p className="text-sm text-muted-foreground">Acompanhe certificados e licenças prestes a vencer</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ["all", "Todos"],
            ["expired", "Vencidos"],
            ["30d", "Vencendo (30d)"],
            ["90d", "Vencendo (90d)"],
            ["valid", "Válidos"],
          ] as [Filter, string][]).map(([key, label]) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(key)}
              className="gap-2"
            >
              {label}
              <Badge variant="secondary" className="ml-1">{counts[key] ?? 0}</Badge>
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Emitido em</th>
                    <th className="py-3 px-4">Vence em</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Carregando...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum item encontrado</td></tr>
                  ) : (
                    filtered.map((r, i) => {
                      const d = daysUntil(r.expiresAt);
                      return (
                        <tr key={`${r.kind}-${r.certId ?? r.id}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-3 px-4">
                            <p className="font-medium">{r.userName ?? r.userEmail}</p>
                            <p className="text-xs text-muted-foreground">{r.userEmail}</p>
                          </td>
                          <td className="py-3 px-4">{r.itemName}</td>
                          <td className="py-3 px-4">{r.kind}</td>
                          <td className="py-3 px-4">{fmtDate(r.issuedAt)}</td>
                          <td className="py-3 px-4">{fmtDate(r.expiresAt)}</td>
                          <td className="py-3 px-4"><StatusBadge status={r.status} days={Math.max(0, d)} /></td>
                          <td className="py-3 px-4">
                            {r.userId && (
                              <Link href={`/admin/usuarios/${r.userId}/historico`}>
                                <Button variant="ghost" size="sm">Ver histórico</Button>
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
