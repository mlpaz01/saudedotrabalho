import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  moduleId: number;
  moduleTitle: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAccepted: () => void;
}

export default function AcceptanceTermDialog({ moduleId, moduleTitle, open, onOpenChange, onAccepted }: Props) {
  const [checked, setChecked] = useState(false);
  const termText = `Declaro que assisti pessoalmente a todos os conteúdos do curso "${moduleTitle}", respondi os questionários por conta própria, e me comprometo a aplicar os conhecimentos adquiridos no ambiente de trabalho. Reconheço que este aceite tem validade jurídica como evidência de conclusão, registrando data, hora e endereço IP.`;

  const acceptMutation = trpc.audit.acceptTerm.useMutation({
    onSuccess: () => {
      toast.success("Termo aceito. Gerando certificado…");
      onOpenChange(false);
      onAccepted();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleAccept() {
    if (!checked) {
      toast.error("Marque o aceite antes de continuar.");
      return;
    }
    acceptMutation.mutate({ moduleId, termText });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary" /> Termo de Aceite
          </DialogTitle>
          <DialogDescription>
            Antes de emitir seu certificado, leia e aceite o termo abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-foreground bg-muted/40 border border-border rounded-lg p-3 leading-relaxed">
          {termText}
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>Li, compreendi e aceito os termos acima.</span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!checked || acceptMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {acceptMutation.isPending ? "Registrando..." : "Aceitar e Emitir Certificado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
