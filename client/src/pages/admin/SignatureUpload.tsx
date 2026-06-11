import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  value: string;
  onChange: (url: string) => void;
  type?: "resp_tecnico" | "logo";
  label?: string;
  disabled?: boolean;
}

export default function SignatureUpload({ value, onChange, type = "resp_tecnico", label = "Assinatura (PNG)", disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMut = trpc.pgr.uploadSignature.useMutation({
    onSuccess: (r) => {
      onChange(r.url);
      toast.success("Imagem salva!");
      setIsUploading(false);
    },
    onError: (e) => {
      toast.error(e?.message ?? "Erro ao enviar imagem");
      setIsUploading(false);
    },
  });

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem PNG ou JPG");
      return;
    }
    if (file.size > 200_000) {
      toast.error("Imagem muito grande (max 200KB). Reduza e tente novamente.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPreview(base64);
      setIsUploading(true);
      uploadMut.mutate({ imageBase64: base64, type });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const displayUrl = preview ?? value;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      {displayUrl ? (
        <div className="relative border rounded-lg overflow-hidden inline-flex bg-slate-50">
          <img src={displayUrl} alt="Assinatura" className="max-h-24 max-w-[240px] object-contain p-2" />
          {!disabled && (
            <button
              className="absolute top-1 right-1 bg-white/80 rounded-full p-0.5 hover:bg-rose-50"
              onClick={() => { setPreview(null); onChange(""); }}>
              <X size={12} className="text-rose-500" />
            </button>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => !disabled && inputRef.current?.click()}>
          <ImageIcon size={20} className="mx-auto mb-1.5 text-slate-400" />
          <p className="text-xs text-muted-foreground">Arraste ou clique para enviar PNG/JPG</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Max 200KB · fundo transparente recomendado</p>
        </div>
      )}
      {isUploading && (
        <p className="text-xs text-muted-foreground animate-pulse">Enviando...</p>
      )}
      {!disabled && value && !isUploading && (
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => inputRef.current?.click()}>
          Trocar imagem
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      {value && (
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] text-muted-foreground truncate max-w-xs">URL: {value}</p>
          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5"
            onClick={() => { navigator.clipboard?.writeText(value); toast.success("Copiado!"); }}>
            Copiar
          </Button>
        </div>
      )}
    </div>
  );
}
