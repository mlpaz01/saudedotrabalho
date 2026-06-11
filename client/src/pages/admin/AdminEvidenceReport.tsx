import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSearch, Printer } from "lucide-react";
import AppLayout from "@/components/AppLayout";

export default function AdminEvidenceReport() {
  const [userId, setUserId] = useState<number | null>(null);
  const usersQuery = trpc.audit.listAuditUsers.useQuery();
  const reportQuery = trpc.audit.evidenceReport.useQuery(
    { userId: userId ?? 0 },
    { enabled: !!userId },
  );

  const report = reportQuery.data;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto print:p-0 print:max-w-none">
        <div className="flex items-center gap-3 mb-6 print:hidden">
          <FileSearch className="w-7 h-7 text-primary" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Relatório de Evidências</h1>
            <p className="text-sm text-muted-foreground">
              Dossier completo para auditoria, fiscalização e defesa jurídica.
            </p>
          </div>
          {userId && (
            <Button onClick={() => window.print()} className="gap-2">
              <Printer size={16} /> Imprimir
            </Button>
          )}
        </div>

        <Card className="mb-4 print:hidden">
          <CardContent className="pt-4">
            <label className="text-sm font-medium mb-2 block">Selecione o usuário</label>
            <select
              className="w-full border border-border rounded-lg p-2 text-sm bg-background"
              value={userId ?? ""}
              onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— escolha um usuário —</option>
              {(usersQuery.data ?? []).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email ?? `Usuário #${u.id}`} ({u.email ?? "sem e-mail"})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {report && (
          <div className="space-y-6 bg-white">
            <Card>
              <CardContent className="pt-4">
                <h2 className="font-bold text-lg mb-3">Dados do usuário</h2>
                <div className="text-sm space-y-1">
                  <div><strong>Nome:</strong> {report.user?.name ?? "—"}</div>
                  <div><strong>E-mail:</strong> {report.user?.email ?? "—"}</div>
                  <div><strong>ID:</strong> {report.user?.id}</div>
                  <div><strong>Função:</strong> {report.user?.role}</div>
                  <div><strong>Cadastro:</strong> {report.user?.createdAt ? new Date(report.user.createdAt).toLocaleString("pt-BR") : "—"}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <h2 className="font-bold text-lg mb-3">Certificados emitidos ({report.certs.length})</h2>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50"><tr>
                    <th className="text-left p-2">Código</th>
                    <th className="text-left p-2">Curso</th>
                    <th className="text-left p-2">Emitido em</th>
                  </tr></thead>
                  <tbody>
                    {report.certs.map((c: any) => (
                      <tr key={c.id} className="border-t">
                        <td className="p-2 font-mono text-xs">{c.certificateCode}</td>
                        <td className="p-2">#{c.moduleId}</td>
                        <td className="p-2">{c.issuedAt ? new Date(c.issuedAt).toLocaleString("pt-BR") : "—"}</td>
                      </tr>
                    ))}
                    {report.certs.length === 0 && <tr><td colSpan={3} className="text-center p-4 text-muted-foreground">Nenhum certificado.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <h2 className="font-bold text-lg mb-3">Tentativas de quiz ({report.attempts.length})</h2>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50"><tr>
                    <th className="text-left p-2">Quiz</th>
                    <th className="text-left p-2">Aula</th>
                    <th className="text-left p-2">Pontuação</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">IP</th>
                  </tr></thead>
                  <tbody>
                    {report.attempts.map((a: any) => (
                      <tr key={a.id} className="border-t">
                        <td className="p-2">#{a.quizId}</td>
                        <td className="p-2">#{a.lessonId}</td>
                        <td className="p-2">{a.score}%</td>
                        <td className="p-2">{a.passed ? "Aprovado" : "Reprovado"}</td>
                        <td className="p-2 text-xs">{a.startedAt ? new Date(a.startedAt).toLocaleString("pt-BR") : "—"}</td>
                        <td className="p-2 font-mono text-xs">{a.ipAddress ?? "—"}</td>
                      </tr>
                    ))}
                    {report.attempts.length === 0 && <tr><td colSpan={6} className="text-center p-4 text-muted-foreground">Nenhuma tentativa.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <h2 className="font-bold text-lg mb-3">Termos de aceite ({report.acceptances.length})</h2>
                {report.acceptances.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum termo aceito.</p>
                ) : (
                  <div className="space-y-3">
                    {report.acceptances.map((a: any) => (
                      <div key={a.id} className="border border-border rounded-lg p-3 text-sm">
                        <div className="text-xs text-muted-foreground mb-1">
                          Curso #{a.moduleId} • {a.acceptedAt ? new Date(a.acceptedAt).toLocaleString("pt-BR") : "—"} • IP: {a.ipAddress ?? "—"}
                        </div>
                        <p className="text-foreground italic">"{a.termText}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <h2 className="font-bold text-lg mb-3">Trilha de auditoria (últimos 500 eventos)</h2>
                <table className="w-full text-xs">
                  <thead className="bg-muted/50"><tr>
                    <th className="text-left p-2">Quando</th>
                    <th className="text-left p-2">Ação</th>
                    <th className="text-left p-2">Entidade</th>
                    <th className="text-left p-2">IP</th>
                  </tr></thead>
                  <tbody>
                    {report.auditTrail.map((l: any) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2">{l.createdAt ? new Date(l.createdAt).toLocaleString("pt-BR") : "—"}</td>
                        <td className="p-2 font-mono">{l.action}</td>
                        <td className="p-2">{l.entityType ? `${l.entityType}#${l.entityId}` : "—"}</td>
                        <td className="p-2 font-mono">{l.ipAddress ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {reportQuery.isLoading && <p className="text-muted-foreground">Carregando relatório...</p>}
      </div>
    </AppLayout>
  );
}
