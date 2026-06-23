/**
 * Sprint 2 / item 24 — Janela de acesso por empresa (Superadmin).
 *
 * Permite que o Super Admin defina horários autorizados de acesso à plataforma
 * por empresa cliente (por exemplo: MF Conexões, seg-sex 08-18; fora disso o
 * login é negado com mensagem clara). Super admins / admin_global sempre passam.
 *
 * Schema: company_access_hours
 *   - company_id INT      (FK lógica → companies.id)
 *   - weekday TINYINT     (0=Dom, 1=Seg, ..., 6=Sáb — padrão JS Date.getDay)
 *   - hour_start TINYINT  (0-23) — hora de abertura
 *   - hour_end TINYINT    (1-24) — hora de fechamento exclusiva
 *   - enabled TINYINT     (0 = dia fechado; 1 = aberto na janela)
 *   - PRIMARY KEY (company_id, weekday)
 *
 * Sem regras cadastradas → empresa SEM restrição (livre 24/7) — padrão atual.
 */
import { getDb } from "../db";
import { sql as drzSql } from "drizzle-orm";

export type AccessHourRule = {
  weekday: number;
  hourStart: number;
  hourEnd: number;
  enabled: boolean;
};

let _ddlDone = false;
export async function ensureBusinessHoursTable() {
  if (_ddlDone) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS company_access_hours (
      company_id INT NOT NULL,
      weekday TINYINT NOT NULL,
      hour_start TINYINT NOT NULL DEFAULT 8,
      hour_end TINYINT NOT NULL DEFAULT 18,
      enabled TINYINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (company_id, weekday)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    _ddlDone = true;
  } catch (err) {
    console.warn("[business_hours] DDL falhou:", (err as any)?.message);
  }
}

/**
 * Verifica se a empresa permite acesso AGORA (hora local America/Sao_Paulo).
 * Retorna { allowed: true } se:
 *   - empresa não tem regras cadastradas (libera tudo)
 *   - dia atual está habilitado E hora atual ∈ [hour_start, hour_end)
 * Caso contrário, { allowed: false, message: "..." }.
 */
export async function isCompanyAccessAllowed(companyId: number | null | undefined): Promise<{ allowed: boolean; message?: string }> {
  if (!companyId) return { allowed: true };
  const db = await getDb();
  if (!db) return { allowed: true };
  await ensureBusinessHoursTable();
  try {
    const cid = Number(companyId);
    const r: any = await db.execute(
      drzSql`SELECT weekday, hour_start, hour_end, enabled FROM company_access_hours WHERE company_id = ${cid}`
    );
    const rows: any[] = Array.isArray((r as any)[0]) ? (r as any)[0] : Array.isArray(r) ? r : [];
    if (rows.length === 0) return { allowed: true };

    // Hora local Sao Paulo (UTC-3, sem horário de verão atualmente)
    const now = new Date();
    const spOffsetMs = -3 * 60 * 60 * 1000;
    const spNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + spOffsetMs);
    const weekday = spNow.getUTCDay(); // 0..6
    const hour = spNow.getUTCHours();

    const rule = rows.find(r => Number(r.weekday) === weekday);
    if (!rule) {
      // Sem regra explícita pro dia → comporta como bloqueado se outras regras existem
      return { allowed: false, message: `Acesso indisponível neste dia da semana. Procure o administrador da sua empresa.` };
    }
    if (!Number(rule.enabled)) {
      return { allowed: false, message: `Acesso bloqueado para este dia da semana (configurado por sua empresa).` };
    }
    const hs = Number(rule.hour_start);
    const he = Number(rule.hour_end);
    if (hour < hs || hour >= he) {
      return {
        allowed: false,
        message: `Acesso permitido das ${String(hs).padStart(2, "0")}:00 às ${String(he).padStart(2, "0")}:00 (horário de Brasília). Tente novamente no expediente.`,
      };
    }
    return { allowed: true };
  } catch (err) {
    console.warn("[business_hours] check falhou:", (err as any)?.message);
    return { allowed: true }; // fail-open: nunca derruba login por falha de infra
  }
}

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
