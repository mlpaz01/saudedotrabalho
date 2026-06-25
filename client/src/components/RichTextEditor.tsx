import { useRef, useEffect } from "react";
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Image as ImageIcon, Table as TableIcon, Eraser } from "lucide-react";

/**
 * SP4 #8 — Rich text editor leve sem dependência externa.
 *
 * Usa contentEditable + document.execCommand. Suporta:
 *  - negrito / itálico / sublinhado
 *  - lista ordenada / não ordenada
 *  - alinhamento (esquerda / centro / direita)
 *  - inserir imagem por URL
 *  - inserir tabela (HTML simples)
 *  - limpar formatação
 *
 * O HTML gerado é simples e seguro pra renderizar no PDF do PGR via pdf_pdf.ts.
 */
export function RichTextEditor({
  value,
  onChange,
  minHeight = 200,
  placeholder = "Digite aqui...",
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Carrega valor inicial uma vez. Re-renderizar com `value` quebraria cursor.
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    pushChange();
  }

  function pushChange() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function insertImage() {
    const url = prompt("URL da imagem (https://...)");
    if (!url) return;
    exec("insertImage", url);
  }

  function insertTable() {
    const cols = Number(prompt("Quantas colunas?", "3") || "3");
    const rows = Number(prompt("Quantas linhas?", "3") || "3");
    if (!cols || !rows) return;
    let html = `<table style="border-collapse:collapse;width:100%;margin:8px 0;">`;
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? "th" : "td";
        html += `<${tag} style="border:1px solid #94a3b8;padding:6px 8px;text-align:left;${r === 0 ? "background:#f1f5f9;font-weight:600;" : ""}">${r === 0 ? `Coluna ${c + 1}` : "&nbsp;"}</${tag}>`;
      }
      html += "</tr>";
    }
    html += "</table><p></p>";
    exec("insertHTML", html);
  }

  const Btn = ({ onClick, title, children }: any) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="p-1.5 rounded hover:bg-slate-200 text-slate-700"
    >
      {children}
    </button>
  );

  return (
    <div className="border rounded-md bg-white">
      <div className="flex flex-wrap gap-0.5 border-b bg-slate-50 px-2 py-1.5">
        <Btn onClick={() => exec("bold")} title="Negrito (Ctrl+B)"><Bold size={14} /></Btn>
        <Btn onClick={() => exec("italic")} title="Itálico (Ctrl+I)"><Italic size={14} /></Btn>
        <Btn onClick={() => exec("underline")} title="Sublinhado (Ctrl+U)"><Underline size={14} /></Btn>
        <span className="w-px bg-slate-300 mx-1" />
        <Btn onClick={() => exec("insertUnorderedList")} title="Lista com marcadores"><List size={14} /></Btn>
        <Btn onClick={() => exec("insertOrderedList")} title="Lista numerada"><ListOrdered size={14} /></Btn>
        <span className="w-px bg-slate-300 mx-1" />
        <Btn onClick={() => exec("justifyLeft")} title="Alinhar à esquerda"><AlignLeft size={14} /></Btn>
        <Btn onClick={() => exec("justifyCenter")} title="Centralizar"><AlignCenter size={14} /></Btn>
        <Btn onClick={() => exec("justifyRight")} title="Alinhar à direita"><AlignRight size={14} /></Btn>
        <span className="w-px bg-slate-300 mx-1" />
        <Btn onClick={insertImage} title="Inserir imagem por URL"><ImageIcon size={14} /></Btn>
        <Btn onClick={insertTable} title="Inserir tabela (defina colunas × linhas)"><TableIcon size={14} /></Btn>
        <span className="w-px bg-slate-300 mx-1" />
        <Btn onClick={() => exec("removeFormat")} title="Limpar formatação"><Eraser size={14} /></Btn>
        <span className="ml-auto text-[10px] text-slate-500 self-center">use Ctrl+B / Ctrl+I / Ctrl+U</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={pushChange}
        onBlur={pushChange}
        data-placeholder={placeholder}
        className="px-3 py-2 text-sm prose prose-sm max-w-none focus:outline-none [&_table]:border [&_th]:bg-slate-100 [&_th]:border [&_td]:border [&_th]:p-1 [&_td]:p-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_img]:max-w-full [&_img]:my-2 [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-slate-400"
        style={{ minHeight }}
      />
    </div>
  );
}
