import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Lock, ArrowRight, ChevronLeft, IdCard } from "lucide-react";
import { applyBrandVars, useWhiteLabelBranding } from "@/lib/whiteLabelBranding";

const LOGO_URL = "/plataforma/logo-horizontal.webp";
const PHOTO_URL =
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1400&q=80";

export default function Login() {
  const [, navigate] = useLocation();
  const { branding } = useWhiteLabelBranding();
  const [step, setStep] = useState<"email" | "password">("email");
  const [identifier, setIdentifier] = useState("");
  const [loginLabel, setLoginLabel] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [accessHint, setAccessHint] = useState("Identificador de acesso");
  const [loginMethod, setLoginMethod] = useState("email");
  const isWhiteLabel = branding.found && branding.hideSdtBrand;
  const brandName = branding.brandName || "Saúde do Trabalho";
  const logoUrl = branding.logoUrl || LOGO_URL;

  useEffect(() => {
    applyBrandVars(branding);
  }, [branding]);

  const checkEmail = trpc.auth.checkCorporateEmail.useMutation({
    onSuccess: (data) => {
      setEmployeeName(data.employeeName ?? null);
      const method = String((data as any).accessMethod || (data as any).method || "email").toLowerCase();
      const resolvedMethod = String((data as any).method || method).toLowerCase();
      setLoginMethod(resolvedMethod);
      const label = method === "cpf" ? "CPF" : method === "both" ? "e-mail corporativo ou CPF" : method === "whatsapp" ? "WhatsApp" : "e-mail corporativo";
      setAccessHint(`Metodo configurado pela empresa: ${label}`);
      if (!data.hasSetPassword) {
        navigate(`/primeiro-acesso?identifier=${encodeURIComponent(identifier)}`);
      } else {
        const internalEmail = String(data.email || "").includes("@sem-email.saudedotrabalho.local");
        const displayIdentifier = resolvedMethod === "cpf" || resolvedMethod === "whatsapp" || internalEmail
          ? identifier
          : data.email || identifier;
        setLoginLabel(displayIdentifier);
        setStep("password");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const login = trpc.auth.corporateLogin.useMutation({
    onSuccess: () => {
      // P18 #5 CRÍTICO (Bruno) — impersonatedCompanyId/delegatedRole ficavam no
      // localStorage entre sessões; um login novo herdava a empresa/perfil de uma
      // impersonação anterior (só aba anônima escapava). Todo login novo começa limpo.
      window.localStorage.removeItem("impersonatedCompanyId");
      window.localStorage.removeItem("delegatedRole");
      toast.success("Bem-vindo(a) de volta!");
      window.location.href = "/plataforma/dashboard";
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT: photo panel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] relative overflow-hidden">
        <img
          src={PHOTO_URL}
          alt="Profissional sorrindo usando smartphone"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Subtle gradient overlay — light on top, richer at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0E1F38]/10 via-transparent to-[#0E1F38]/75" />

        {/* Bottom branding */}
        <div className="absolute bottom-0 left-0 right-0 p-10 text-white">
          <img
            src={logoUrl}
            alt={brandName}
            className={`w-52 h-auto mb-5 ${isWhiteLabel ? "rounded-lg bg-white/95 p-3 shadow-sm" : "brightness-0 invert"}`}
          />
          <h2 className="text-2xl font-bold leading-snug mb-2">
            {isWhiteLabel ? brandName : "Cuidando de quem cuida"}<br />da sua empresa.
          </h2>
          <p className="text-white/75 text-sm leading-relaxed max-w-sm">
            Plataforma integrada de saúde mental, riscos psicossociais e conformidade NR-01.
          </p>

          {/* Trust badges */}
          <div className="flex gap-4 mt-6">
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-white/90">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              NR-01 Compliant
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-white/90">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
              ISO 45003
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-white/90">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
              LGPD
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: form panel ─────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-8 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <img src={logoUrl} alt={brandName} className="w-48 h-auto" />
        </div>

        <div className="w-full max-w-sm">
          {/* Step header */}
          {step === "password" && (
            <button
              type="button"
              onClick={() => setStep("email")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ChevronLeft size={16} />
              Voltar
            </button>
          )}

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {step === "email" ? "Acesse sua empresa" : `Olá${employeeName ? `, ${employeeName.split(" ")[0]}` : ""}!`}
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              {step === "email"
                ? "Use o identificador informado pelo RH. Por LGPD, a plataforma nao exibe uma lista publica de empresas."
                : "Digite sua senha para acessar a plataforma."}
            </p>
          </div>

          {/* ── STEP 1: Email ── */}
          {step === "email" ? (
            <form
              onSubmit={(e) => { e.preventDefault(); checkEmail.mutate({ identifier }); }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-sm font-medium">
                  {accessHint}
                </Label>
                <div className="relative">
                  <IdCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="E-mail, CPF ou WhatsApp"
                    className="pl-9 h-11"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-semibold text-sm"
                style={branding.found ? { backgroundColor: branding.primaryColor } : undefined}
                disabled={checkEmail.isPending}
              >
                {checkEmail.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verificando…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Continuar <ArrowRight size={15} />
                  </span>
                )}
              </Button>
            </form>

          ) : (
            /* ── STEP 2: Password ── */
            <form
              onSubmit={(e) => { e.preventDefault(); login.mutate({ identifier, password }); }}
              className="space-y-4"
            >
              {/* Email chip */}
              <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2.5 text-sm">
                {loginMethod === "cpf" || loginMethod === "whatsapp" ? (
                  <IdCard size={13} className="text-muted-foreground shrink-0" />
                ) : (
                  <Mail size={13} className="text-muted-foreground shrink-0" />
                )}
                <span className="text-foreground truncate flex-1">{loginLabel || identifier}</span>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-xs text-primary hover:underline font-medium shrink-0"
                >
                  Alterar
                </button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="pl-9 pr-10 h-11"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-semibold text-sm"
                style={branding.found ? { backgroundColor: branding.primaryColor } : undefined}
                disabled={login.isPending}
              >
                {login.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando…
                  </span>
                ) : "Entrar na plataforma"}
              </Button>
            </form>
          )}

          {/* Footer note */}
          <p className="text-center text-xs text-muted-foreground mt-8 leading-relaxed">
            Nao conseguiu acessar?<br />
            Confirme com o RH qual identificador sua empresa utiliza.
          </p>
        </div>

        {/* Bottom legal */}
        <p className="mt-auto pt-12 text-xs text-muted-foreground/50 text-center">
          © {new Date().getFullYear()} {isWhiteLabel ? brandName : "Saúde do Trabalho"} · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
