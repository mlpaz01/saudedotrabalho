import { useRoute } from "wouter";
import { CheckCircle2, XCircle, AlertCircle, Award, Calendar, Clock, User, Hash } from "lucide-react";
import { trpc } from "@/lib/trpc";

const LOGO_FULL = "/plataforma/logo-full.png";

export default function VerifyCertificate() {
  const [, params] = useRoute("/verificar/:code");
  const code = params?.code ?? "";
  const q = trpc.certificates.verifyByCode.useQuery({ code }, { enabled: code.length >= 4 });

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f5f3ff 0%, #f0f7f4 50%, #e8f4f8 100%)", padding: "40px 20px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(11,18,33,.10)", overflow: "hidden" }}>
        <div style={{ background: "#0E2C46", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <img src={LOGO_FULL} alt="Saúde do Trabalho" style={{ height: 32, filter: "brightness(0) invert(1)" }} />
        </div>

        <div style={{ padding: "32px 28px" }}>
          {q.isLoading && (
            <p style={{ textAlign: "center", color: "#789", fontSize: 14 }}>Verificando certificado…</p>
          )}

          {!q.isLoading && q.data && q.data.valid && !q.data.expired && (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 64, height: 64, margin: "0 auto", borderRadius: "50%", background: "rgba(46,165,106,.12)", color: "#2EA56A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 size={36} />
                </div>
                <h1 style={{ margin: "12px 0 4px", fontSize: 22, color: "#0E2C46", fontWeight: 800 }}>Certificado autêntico</h1>
                <p style={{ margin: 0, color: "#566", fontSize: 13 }}>Este certificado foi emitido pela plataforma Saúde do Trabalho.</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 14px", fontSize: 14, color: "#334", padding: "16px 18px", background: "#f8fafc", borderRadius: 10 }}>
                <span style={{ color: "#789", display: "flex", alignItems: "center", gap: 6 }}><User size={14} /> Titular</span>
                <strong>{q.data.userName}</strong>
                <span style={{ color: "#789", display: "flex", alignItems: "center", gap: 6 }}><Award size={14} /> Curso</span>
                <strong>{q.data.moduleName}</strong>
                {q.data.moduleDuration > 0 && (<>
                  <span style={{ color: "#789", display: "flex", alignItems: "center", gap: 6 }}><Clock size={14} /> Carga horária</span>
                  <strong>{q.data.moduleDuration} minutos</strong>
                </>)}
                {q.data.issuedAt && (<>
                  <span style={{ color: "#789", display: "flex", alignItems: "center", gap: 6 }}><Calendar size={14} /> Emitido em</span>
                  <strong>{new Date(q.data.issuedAt).toLocaleDateString("pt-BR")}</strong>
                </>)}
                <span style={{ color: "#789", display: "flex", alignItems: "center", gap: 6 }}><Hash size={14} /> Código</span>
                <code style={{ fontSize: 12, color: "#1A8A82" }}>{q.data.code}</code>
              </div>
            </>
          )}

          {!q.isLoading && q.data && q.data.valid && q.data.expired && (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, margin: "0 auto", borderRadius: "50%", background: "rgba(160,122,16,.12)", color: "#a07a10", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle size={36} />
              </div>
              <h1 style={{ margin: "12px 0 4px", fontSize: 22, color: "#0E2C46", fontWeight: 800 }}>Certificado vencido</h1>
              <p style={{ margin: 0, color: "#566", fontSize: 13 }}>O documento é autêntico, mas a validade expirou.</p>
            </div>
          )}

          {!q.isLoading && q.data && !q.data.valid && (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, margin: "0 auto", borderRadius: "50%", background: "rgba(184,50,37,.12)", color: "#b83225", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <XCircle size={36} />
              </div>
              <h1 style={{ margin: "12px 0 4px", fontSize: 22, color: "#0E2C46", fontWeight: 800 }}>Certificado não encontrado</h1>
              <p style={{ margin: 0, color: "#566", fontSize: 13 }}>O código informado não corresponde a nenhum certificado emitido pela plataforma.</p>
              <code style={{ display: "block", marginTop: 12, fontSize: 11, color: "#aaa" }}>{code || "(sem código)"}</code>
            </div>
          )}

          <p style={{ marginTop: 32, fontSize: 11, color: "#aaa", textAlign: "center" }}>
            Plataforma Saúde do Trabalho · saudedotrabalho.com
          </p>
        </div>
      </div>
    </div>
  );
}
