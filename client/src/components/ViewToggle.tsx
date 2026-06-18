import { useEffect, useState } from "react";
import { LayoutList, LayoutGrid } from "lucide-react";

export type ViewMode = "list" | "grid";

/**
 * Hook que persiste a preferência de visualização em localStorage,
 * por chave (ex.: "cursos", "pesquisas", "descompressao").
 */
export function useViewMode(storageKey: string, fallback: ViewMode = "list"): [ViewMode, (m: ViewMode) => void] {
  const [view, setViewState] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem(`view:${storageKey}`);
      return v === "grid" || v === "list" ? v : fallback;
    } catch { return fallback; }
  });
  function setView(m: ViewMode) {
    setViewState(m);
    try { localStorage.setItem(`view:${storageKey}`, m); } catch {}
  }
  useEffect(() => {
    try { localStorage.setItem(`view:${storageKey}`, view); } catch {}
  }, [storageKey, view]);
  return [view, setView];
}

/**
 * Toggle visual entre Lista e Grid (Windows Explorer style).
 * Use com `useViewMode("cursos")` ou similar.
 */
export function ViewToggle({ value, onChange, listLabel = "Lista", gridLabel = "Cards" }: {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
  listLabel?: string;
  gridLabel?: string;
}) {
  const baseBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 11px",
    border: "1.5px solid #E0E6ED",
    background: "#fff",
    color: "#62707D",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all .15s",
    fontFamily: "inherit",
  };
  const activeBtn: React.CSSProperties = {
    ...baseBtn,
    background: "#0E2C46",
    color: "#fff",
    borderColor: "#0E2C46",
  };
  return (
    <div style={{ display: "inline-flex", borderRadius: 11, overflow: "hidden", border: "1.5px solid #E0E6ED" }}>
      <button
        type="button"
        onClick={() => onChange("list")}
        style={{
          ...(value === "list" ? activeBtn : baseBtn),
          border: "none",
          borderRadius: 0,
          borderRight: "1px solid #E0E6ED",
        }}
        aria-label={listLabel}
        title={listLabel}
      >
        <LayoutList size={14} />
        <span style={{ display: "inline" }}>{listLabel}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        style={{
          ...(value === "grid" ? activeBtn : baseBtn),
          border: "none",
          borderRadius: 0,
        }}
        aria-label={gridLabel}
        title={gridLabel}
      >
        <LayoutGrid size={14} />
        <span style={{ display: "inline" }}>{gridLabel}</span>
      </button>
    </div>
  );
}
