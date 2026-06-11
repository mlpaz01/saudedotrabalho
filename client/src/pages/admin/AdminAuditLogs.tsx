import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const actionLabels: Record<string, string> = {
  login: "Login", logout: "Logout",
  lesson_completed: "Aula concluída",
  module_completed: "Curso concluído",
  quiz_passed: "Quiz aprovado", quiz_failed: "Quiz reprovado",
  certificate_issued: "Certificado emitido",
  term_accepted: "Termo aceito",
};

const actionVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  login: "default", logout: "secondary",
  lesson_completed: "default", module_completed: "default",
  quiz_passed: "default",
  quiz_failed: "destructive", certificate_issued: "default",
  term_accepted: "default",
};

export default function AdminAuditLogs() {
  const [actionFilter, setActionFilter] = useState("");
  const { data: logs } = trpc.audit.listLogs.useQuery({
    action: actionFilter || undefined,
    limit: 500,
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Logs de Auditoria</h1>
            <p className="text-sm text-muted-foreground">Rastro completo de ações para fins legais e de fiscalização.</p>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-4 flex gap-3">
            <Input
              placeholder="Filtrar por ação (ex: login, quiz_passed)..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="max-w-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Data/Hora</th>
                  <th className="text-left p-3">Usuário</th>
                  <th className="text-left p-3">Ação</th>
                  <th className="text-left p-3">Detalhes</th>
                  <th className="text-left p-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {(logs ?? []).map((l: any) => (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground text-xs">
                      {l.createdAt ? new Date(l.createdAt).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="p-3">{l.userEmail ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={actionVariant[l.action] ?? "outline"}>
                        {actionLabels[l.action] ?? l.action}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {l.entityType && `${l.entityType}#${l.entityId}`}
                      {l.detailsJson && (
                        <div className="font-mono text-[10px] mt-1 max-w-xs truncate">
                          {String(l.detailsJson).slice(0, 100)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{l.ipAddress ?? "—"}</td>
                  </tr>
                ))}
                {(logs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-muted-foreground">
                      Nenhum registro encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
