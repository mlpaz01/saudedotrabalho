import React from "react";

const PROB_LABELS: Record<string, { label: string; val: number }> = {
  improvavel:  { label: "Improvável",  val: 1 },
  possivel:    { label: "Possível",    val: 2 },
  provavel:    { label: "Provável",    val: 3 },
  certo:       { label: "Certo",       val: 4 },
};
const SEV_LABELS: Record<string, { label: string; val: number }> = {
  insignificante: { label: "Insignificante", val: 1 },
  menor:          { label: "Menor",          val: 2 },
  moderada:       { label: "Moderada",       val: 3 },
  maior:          { label: "Maior",          val: 4 },
  catastrofica:   { label: "Catastrófica",   val: 5 },
};
const PROBS = ["certo", "provavel", "possivel", "improvavel"] as const;
const SEVS  = ["insignificante", "menor", "moderada", "maior", "catastrofica"] as const;

function riskLevel(prob: number, sev: number): "baixo" | "medio" | "alto" | "critico" {
  const n = prob * sev;
  if (n >= 15) return "critico";
  if (n >= 9)  return "alto";
  if (n >= 5)  return "medio";
  return "baixo";
}

const LEVEL_COLORS = {
  critico: "bg-rose-600 text-white",
  alto:    "bg-orange-400 text-white",
  medio:   "bg-yellow-300 text-slate-800",
  baixo:   "bg-green-200 text-slate-700",
};
const LEVEL_LABELS = {
  critico: "Crítico",
  alto:    "Alto",
  medio:   "Médio",
  baixo:   "Baixo",
};

const TIPO_COLORS: Record<string, string> = {
  "Físico":      "bg-orange-500",
  "Químico":     "bg-yellow-500",
  "Biológico":   "bg-green-600",
  "Ergonômico":  "bg-blue-500",
  "Acidente":    "bg-red-500",
  "Psicossocial":"bg-purple-500",
  "Outro":       "bg-slate-400",
};

type InvItem = { probabilidade?: string; severidade?: string; tipoRisco?: string; fator?: string };

type CellData = { count: number; items: InvItem[]; types: Set<string> };

export default function RiskMatrix({ inventory }: { inventory: InvItem[] }) {
  // Build grid: [prob][sev] → CellData
  const grid: Record<string, Record<string, CellData>> = {};
  for (const p of PROBS) {
    grid[p] = {};
    for (const s of SEVS) grid[p][s] = { count: 0, items: [], types: new Set() };
  }

  let unmapped = 0;
  const totals = { baixo: 0, medio: 0, alto: 0, critico: 0 };

  for (const item of inventory) {
    const p = (item.probabilidade ?? "").toLowerCase().trim();
    const s = (item.severidade ?? "").toLowerCase().trim();
    // Normalize typos / pt variants
    const pKey = p === "improvavel" || p === "improvável" ? "improvavel"
               : p === "possivel" || p === "possível" ? "possivel"
               : p === "provavel" || p === "provável" ? "provavel"
               : p === "certo" ? "certo" : null;
    const sKey = s === "insignificante" ? "insignificante"
               : s === "menor" ? "menor"
               : s === "moderada" || s === "moderado" ? "moderada"
               : s === "maior" ? "maior"
               : s === "catastrofica" || s === "catastrófica" ? "catastrofica" : null;

    if (!pKey || !sKey) { unmapped++; continue; }
    grid[pKey][sKey].count++;
    grid[pKey][sKey].items.push(item);
    grid[pKey][sKey].types.add(item.tipoRisco || "Outro");

    const lv = riskLevel(PROB_LABELS[pKey].val, SEV_LABELS[sKey].val);
    totals[lv]++;
  }

  const total = inventory.length;

  return (
    <div className="space-y-4">
      {/* Legend + totals */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(["critico","alto","medio","baixo"] as const).map(lv => (
          <div key={lv} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${LEVEL_COLORS[lv].split(" ")[0]}`}/>
            <span className="font-medium">{LEVEL_LABELS[lv]}</span>
            <span className="text-muted-foreground">({totals[lv]})</span>
          </div>
        ))}
        {unmapped > 0 && <span className="text-muted-foreground">{unmapped} sem mapeamento</span>}
      </div>

      {total === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Adicione fatores de risco com Probabilidade e Severidade para visualizar a matriz.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs w-full min-w-[480px]">
            <thead>
              <tr>
                <th className="p-2 text-left text-muted-foreground w-28">Prob ↓ / Sev →</th>
                {SEVS.map(s => (
                  <th key={s} className="p-2 text-center font-medium text-muted-foreground">
                    {SEV_LABELS[s].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROBS.map(p => (
                <tr key={p}>
                  <td className="p-2 font-medium text-muted-foreground border-r">{PROB_LABELS[p].label}</td>
                  {SEVS.map(s => {
                    const cell = grid[p][s];
                    const lv = riskLevel(PROB_LABELS[p].val, SEV_LABELS[s].val);
                    const cls = LEVEL_COLORS[lv];
                    return (
                      <td key={s} className={`border p-1 text-center align-middle min-w-[70px] ${cell.count > 0 ? cls : "bg-slate-50 text-slate-300"}`}>
                        {cell.count > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-base font-bold leading-none">{cell.count}</span>
                            <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                              {Array.from(cell.types).map(t => (
                                <span key={t} className={`w-2 h-2 rounded-full ${TIPO_COLORS[t] ?? TIPO_COLORS["Outro"]}`} title={t}/>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Risk type legend */}
      <div className="flex flex-wrap gap-3 text-xs border-t pt-3">
        {Object.entries(TIPO_COLORS).map(([tipo, cls]) => (
          <div key={tipo} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${cls}`}/>
            <span className="text-muted-foreground">{tipo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
