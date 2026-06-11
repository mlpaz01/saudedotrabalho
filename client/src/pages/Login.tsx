import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Lock, ArrowRight, ChevronLeft } from "lucide-react";

const LOGO_URL = "/plataforma/logo-horizontal.webp";
const PHOTO_URL =
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1400&q=80";

export default function Login() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [employeeName, setEmployeeName] = useState<string | null>(null);

  const checkEmail = trpc.auth.checkCorporateEmail.useMutation({
    onSuccess: (data) => {
      setEmployeeName(data.employeeName ?? null);
      if (!data.hasSetPassword) {
        navigate(`/primeiro-acesso?email=${encodeURIComponent(email)}`);
      } else {
        setStep("password");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const login = trpc.auth.corporateLogin.useMutation({
    onSuccess: () => {
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
            src={LOGO_URL}
            alt="Saúde do Trabalho"
            className="w-52 h-auto mb-5 brightness-0 invert"
          />
          <h2 className="text-2xl font-bold leading-snug mb-2">
            Cuidando de quem cuida<br />da sua empresa.
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
          <img src={LOGO_URL} alt="Saúde do Trabalho" className="w-48 h-auto" />
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
              {step === "email" ? "Como você prefere entrar?" : `Olá${employeeName ? `, ${employeeName.split(" ")[0]}` : ""}!`}
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              {step === "email"
                ? "Digite o e-mail cadastrado pelo RH da sua empresa."
                : "Digite sua senha para acessar a plataforma."}
            </p>
          </div>

          {/* ── STEP 1: Email ── */}
          {step === "email" ? (
            <form
              onSubmit={(e) => { e.preventDefault(); checkEmail.mutate({ email }); }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  E-mail corporativo
                </Label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@empresa.com.br"
                    className="pl-9 h-11"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-semibold text-sm"
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
              onSubmit={(e) => { e.preventDefault(); login.mutate({ email, password }); }}
              className="space-y-4"
            >
              {/* Email chip */}
              <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2.5 text-sm">
                <Mail size={13} className="text-muted-foreground shrink-0" />
                <span className="text-foreground truncate flex-1">{email}</span>
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
            Não encontrou seu e-mail?<br />
            Entre em contato com o RH da sua empresa.
          </p>
        </div>

        {/* Bottom legal */}
        <p className="mt-auto pt-12 text-xs text-muted-foreground/50 text-center">
          © {new Date().getFullYear()} Saúde do Trabalho · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
