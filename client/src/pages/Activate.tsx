import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from "lucide-react";

const LOGO_URL = "/logo.png";

export default function Activate() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const validate = trpc.auth.validateActivationToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const activate = trpc.auth.activateAccount.useMutation({
    onSuccess: () => {
      setDone(true);
      toast.success("Conta ativada com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!token) toast.error("Link de ativação inválido.");
  }, [token]);

  const rules = [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Letras e números", ok: /[a-zA-Z]/.test(password) && /[0-9]/.test(password) },
    { label: "Senhas coincidem", ok: password === confirm && confirm.length > 0 },
  ];

  if (done) {
    return (
      <div className="min-h-screen brand-gradient flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-secondary" />
          </div>
          <h2 className="text-xl font-bold text-primary mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Conta ativada!</h2>
          <p className="text-muted-foreground text-sm mb-6">Sua conta está pronta. Faça login para começar.</p>
          <Button onClick={() => navigate("/login")} className="bg-primary text-primary-foreground w-full">
            Ir para o Login
          </Button>
        </div>
      </div>
    );
  }

  const isInvalid = !token || validate.isError || (validate.data && !validate.data.valid);

  if (isInvalid) {
    return (
      <div className="min-h-screen brand-gradient flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-primary mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Link inválido ou expirado</h2>
          <p className="text-muted-foreground text-sm mb-6">Solicite ao seu RH um novo link de ativação.</p>
          <Button onClick={() => navigate("/login")} className="bg-primary text-primary-foreground w-full">
            Ir para o Login
          </Button>
        </div>
      </div>
    );
  }

  if (validate.isLoading || !validate.data) {
    return (
      <div className="min-h-screen brand-gradient flex items-center justify-center p-4">
        <div className="text-white">Validando link...</div>
      </div>
    );
  }

  const email = validate.data.email ?? "";
  const employeeName = validate.data.employeeName ?? "";

  return (
    <div className="min-h-screen brand-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 p-8">
          <div className="flex flex-col items-center mb-6">
            <img src={LOGO_URL} alt="Saúde do Trabalho" className="w-16 h-16 object-contain mb-3" />
            <h1 className="text-xl font-bold text-primary text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
              Ativar Conta
            </h1>
            <p className="text-muted-foreground text-sm text-center mt-1">
              {employeeName ? `Bem-vindo(a), ${employeeName}.` : "Defina sua senha para ativar sua conta"}
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg px-4 py-3 mb-6 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{email}</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (password !== confirm) { toast.error("As senhas não coincidem."); return; }
              if (password.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres."); return; }
              activate.mutate({ token, password });
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pl-10 pr-10 h-11"
                  required
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar Senha</Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              {rules.map((r) => (
                <div key={r.label} className={`flex items-center gap-2 text-xs transition-colors ${r.ok ? "text-secondary" : "text-muted-foreground"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${r.ok ? "bg-secondary" : "bg-muted-foreground/40"}`} />
                  {r.label}
                </div>
              ))}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={activate.isPending || !rules.every((r) => r.ok)}
            >
              {activate.isPending ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Ativando...</span>
              ) : "Ativar Conta"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
