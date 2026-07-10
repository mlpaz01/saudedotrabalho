import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: (User & {
    _isImpersonating?: boolean;
    _originalCompanyId?: number | null;
    // P15 #6 — Administração Delegada: SuperAdmin assumindo um role específico.
    _isDelegating?: boolean;
    _originalRole?: string;
  }) | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  let finalUser: TrpcContext["user"] = user;

  // Super admin impersonation: scope all queries to chosen company via header.
  if (user && (user as any).role === "super_admin") {
    const raw = opts.req.headers["x-impersonate-company-id"];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (header) {
      const impersonatedId = Number(header);
      if (!isNaN(impersonatedId) && impersonatedId > 0) {
        finalUser = {
          ...user,
          companyId: impersonatedId as any,
          _isImpersonating: true,
          _originalCompanyId: (user as any).companyId ?? null,
        } as any;
      }
    }
    // P15 #6 — Administração Delegada: SuperAdmin pode assumir role delegado (RH, SESMT, etc)
    // e ter as permissões daquele perfil. O role original fica guardado pra auditoria.
    const rawRole = opts.req.headers["x-delegated-role"];
    const roleHeader = Array.isArray(rawRole) ? rawRole[0] : rawRole;
    if (roleHeader && typeof roleHeader === "string") {
      const validRoles = ["admin", "rh", "sesmt", "psicologo", "chefia", "company_admin", "cipa"];
      if (validRoles.includes(roleHeader)) {
        finalUser = {
          ...(finalUser ?? user) as any,
          role: roleHeader,
          _isDelegating: true,
          _originalRole: "super_admin",
        } as any;
      }
    }
  }

  // Sliding-window session refresh: renew cookie on every authenticated request
  // so active users are never unexpectedly logged out.
  if (finalUser) {
    try {
      const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
      const newToken = await sdk.createSessionToken(
        (finalUser as any).openId,
        { name: (finalUser as any).name ?? (finalUser as any).email ?? "", expiresInMs: SESSION_DURATION_MS }
      );
      const cookieOpts = getSessionCookieOptions(opts.req);
      opts.res.cookie(COOKIE_NAME, newToken, { ...cookieOpts, maxAge: SESSION_DURATION_MS });
    } catch (_) { /* non-fatal */ }
  }

  return {
    req: opts.req,
    res: opts.res,
    user: finalUser,
  };
}
