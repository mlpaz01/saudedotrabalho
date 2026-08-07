const IMPORTABLE_USER_ROLES = [
  "user",
  "cipa",
  "chefia",
  "sesmt",
  "medico",
  "rh",
  "admin",
] as const;
const IMPORT_ROLE_PRIORITY: Record<string, number> = {
  user: 0,
  cipa: 1,
  chefia: 2,
  sesmt: 3,
  medico: 4,
  rh: 5,
  admin: 6,
};

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mapRole(value: unknown): string {
  const aliases: Record<string, string> = {
    colaborador: "user",
    colaboradora: "user",
    usuario: "user",
    usuaria: "user",
    user: "user",
    funcionario: "user",
    funcionaria: "user",
    cipa: "cipa",
    cipeiro: "cipa",
    cipeira: "cipa",
    "integrante da cipa": "cipa",
    chefia: "chefia",
    gestor: "chefia",
    gestora: "chefia",
    gerente: "chefia",
    lider: "chefia",
    coordenador: "chefia",
    coordenadora: "chefia",
    supervisor: "chefia",
    supervisora: "chefia",
    encarregado: "chefia",
    encarregada: "chefia",
    sesmt: "sesmt",
    sst: "sesmt",
    "profissional sesmt": "sesmt",
    medico: "medico",
    medica: "medico",
    "medico do trabalho": "medico",
    "medica do trabalho": "medico",
    "medicina do trabalho": "medico",
    rh: "rh",
    "recursos humanos": "rh",
    "perfil rh": "rh",
    admin: "admin",
    administrador: "admin",
    administradora: "admin",
    "administrador local": "admin",
    "administradora local": "admin",
  };
  return aliases[normalize(value)] || "user";
}

export function resolveImportedRoles(
  value: unknown,
  canAssignAdmin: boolean
): { primary: string; roles: string[] } {
  const raw = String(value ?? "");
  const pieces = raw
    .split(/[,;|/]+|\s+\+\s+|\s+e\s+/i)
    .map(piece => piece.trim())
    .filter(Boolean);
  const mapped = (pieces.length ? pieces : [raw])
    .map(mapRole)
    .map(role => (role === "admin" && !canAssignAdmin ? "rh" : role))
    .filter((role): role is (typeof IMPORTABLE_USER_ROLES)[number] =>
      (IMPORTABLE_USER_ROLES as readonly string[]).includes(role)
    );
  const unique = Array.from(new Set(mapped.length ? mapped : ["user"]));
  unique.sort(
    (a, b) => (IMPORT_ROLE_PRIORITY[b] ?? 0) - (IMPORT_ROLE_PRIORITY[a] ?? 0)
  );
  return { primary: unique[0] ?? "user", roles: unique };
}
