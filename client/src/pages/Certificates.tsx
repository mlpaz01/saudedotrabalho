import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Award, Download, Calendar, Hash, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

type Cert = {
  id: number;
  moduleId: number;
  moduleName: string;
  certificateCode: string;
  issuedAt: Date;
  pdfUrl?: string | null;
  certTitle?: string | null;
  certBody?: string | null;
  certSignerName?: string | null;
  certSignerRole?: string | null;
};

function printCertificate(cert: Cert, userName: string) {
  const title = cert.certTitle || "Certificado de Conclusão";
  const body = cert.certBody || "Este certificado atesta a participação e aprovação no curso indicado, demonstrando o comprometimento com o desenvolvimento profissional e com a saúde, segurança e qualidade de vida no trabalho.";
  const signerName = cert.certSignerName || "";
  const signerRole = cert.certSignerRole || "";
  const issuedDate = new Date(cert.issuedAt).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const logoUrl = `${window.location.origin}/logo.png`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${title} - ${cert.moduleName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4 landscape; margin: 0; }
    body {
      width: 297mm; height: 210mm;
      background: linear-gradient(135deg, #f5f3ff 0%, #f0f7f4 50%, #e8f4f8 100%);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Inter', sans-serif;
    }
    .cert {
      width: 270mm; height: 190mm;
      position: relative;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; padding: 30px;
      gap: 16px;
    }
    .outer-border {
      position: absolute; inset: 0;
      border: 3px solid #1e3a5f;
      border-radius: 12px;
    }
    .inner-border {
      position: absolute; inset: 8px;
      border: 1px solid #2d7a5f;
      border-radius: 8px;
    }
    .corner { position: absolute; width: 24px; height: 24px; }
    .corner.tl { top: 16px; left: 16px; border-top: 2px solid #2d7a5f; border-left: 2px solid #2d7a5f; }
    .corner.tr { top: 16px; right: 16px; border-top: 2px solid #2d7a5f; border-right: 2px solid #2d7a5f; }
    .corner.bl { bottom: 16px; left: 16px; border-bottom: 2px solid #2d7a5f; border-left: 2px solid #2d7a5f; }
    .corner.br { bottom: 16px; right: 16px; border-bottom: 2px solid #2d7a5f; border-right: 2px solid #2d7a5f; }
    .logo { width: 56px; height: 56px; object-fit: contain; }
    .org-name {
      font-family: 'Playfair Display', serif;
      font-size: 14px; font-weight: 700;
      color: #1e3a5f; letter-spacing: 3px; text-transform: uppercase;
    }
    .org-sub { font-size: 10px; color: #2d7a5f; letter-spacing: 1px; }
    .divider { width: 60px; height: 2px; background: linear-gradient(to right, #1e3a5f, #2d7a5f); border-radius: 2px; }
    .cert-title {
      font-family: 'Playfair Display', serif;
      font-size: 26px; font-weight: 700; color: #1e3a5f;
    }
    .cert-presents { font-size: 11px; color: #6b7280; letter-spacing: 2px; text-transform: uppercase; }
    .recipient-name {
      font-family: 'Playfair Display', serif;
      font-size: 24px; font-weight: 700; color: #1e3a5f;
      border-bottom: 2px solid #2d7a5f; padding-bottom: 4px;
    }
    .cert-body { font-size: 12px; color: #4b5563; line-height: 1.6; max-width: 520px; }
    .module-name {
      font-family: 'Playfair Display', serif;
      font-size: 15px; font-weight: 600; color: #2d7a5f;
    }
    .footer { display: flex; align-items: flex-end; justify-content: space-between; width: 100%; margin-top: 8px; }
    .date-block { text-align: left; }
    .date-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }
    .date-value { font-size: 11px; color: #1e3a5f; font-weight: 500; }
    .signer-block { text-align: center; }
    .signer-line { width: 140px; height: 1px; background: #1e3a5f; margin: 0 auto 4px; }
    .signer-name { font-size: 11px; color: #1e3a5f; font-weight: 600; }
    .signer-role { font-size: 9px; color: #6b7280; }
    .code-block { text-align: right; }
    .code-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }
    .code-value { font-size: 9px; color: #6b7280; font-family: monospace; }
  </style>
</head>
<body>
  <div class="cert">
    <div class="outer-border"></div>
    <div class="inner-border"></div>
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>

    <img src="${logoUrl}" alt="Logo" class="logo" />
    <p class="org-name">Saúde do Trabalho</p>
    <p class="org-sub">Plataforma de Saúde Mental e Bem-Estar Corporativo</p>
    <div class="divider"></div>
    <p class="cert-title">${title}</p>
    <p class="cert-presents">Certifica que</p>
    <p class="recipient-name">${userName}</p>
    <p class="cert-body">${body}</p>
    <p class="module-name">${cert.moduleName}</p>
    <div class="footer">
      <div class="date-block">
        <p class="date-label">Data de Emissão</p>
        <p class="date-value">${issuedDate}</p>
      </div>
      ${signerName ? `
      <div class="signer-block">
        <div class="signer-line"></div>
        <p class="signer-name">${signerName}</p>
        ${signerRole ? `<p class="signer-role">${signerRole}</p>` : ""}
      </div>` : ""}
      <div class="code-block">
        <p class="code-label">Código de Verificação</p>
        <p class="code-value">${cert.certificateCode}</p>
      </div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Permita pop-ups para imprimir o certificado.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

export default function Certificates() {
  const certsQuery = trpc.certificates.getUserCertificates.useQuery();
  const { user } = useAuth();
  const certs = certsQuery.data ?? [];
  const userName = user?.name || user?.email || "Participante";

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-400 to-transparent" />
          <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
            Meus Certificados
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {certs.length} certificado{certs.length !== 1 ? "s" : ""} emitido{certs.length !== 1 ? "s" : ""}
          </p>
        </div>

        {certsQuery.isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-border p-5 animate-pulse">
                <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : certs.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-10 text-center shadow-sm">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award size={28} className="text-amber-400" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Nenhum certificado ainda</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Conclua 100% de um curso para emitir seu certificado de conclusão.
            </p>
            <Link href="/modulos">
              <Button className="bg-primary text-primary-foreground">Ver Cursos</Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {certs.map((cert) => (
              <div
                key={cert.id}
                className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden"
              >
                {/* Certificate header */}
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 px-5 py-4 border-b border-amber-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Award size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-700 font-medium uppercase tracking-wider">
                        {cert.certTitle || "Certificado de Conclusão"}
                      </p>
                      <p className="text-xs text-amber-600/70">Saúde do Trabalho</p>
                    </div>
                  </div>
                </div>

                {/* Certificate body */}
                <div className="p-5 space-y-3">
                  <h3 className="font-semibold text-foreground leading-snug">{cert.moduleName}</h3>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar size={12} />
                      <span>
                        Emitido em{" "}
                        {new Date(cert.issuedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "long", year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Hash size={12} />
                      <span className="font-mono">{cert.certificateCode}</span>
                    </div>
                    {cert.certSignerName && (
                      <div className="text-xs text-muted-foreground">
                        Assinado por: <span className="font-medium text-foreground">{cert.certSignerName}</span>
                        {cert.certSignerRole && ` — ${cert.certSignerRole}`}
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    className="w-full mt-2 bg-amber-600 hover:bg-amber-700 text-white gap-2"
                    onClick={() => printCertificate(cert as Cert, userName)}
                  >
                    <Printer size={14} /> Imprimir / Salvar PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
