import { useAuth } from "@/_core/hooks/useAuth";
import { useEntitlements } from "@/_core/hooks/useEntitlements";
import { APP_VERSION } from "@/version";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, BookOpen, Award, Leaf, LogOut,
  Users, Bell, ChevronRight, Menu, Building2,
  ShieldCheck, FileSearch, Home, Clock, IdCard, FileCheck, CalendarClock,
  Shield, Library, Settings2, Store, Wrench, ShieldQuestion, ClipboardList,
  Mail, ShieldAlert, CreditCard, FolderOpen, GraduationCap, Stethoscope,
  Link2, Layers, RotateCcw, Activity, Search, LineChart, Signature,
  LifeBuoy, Headphones, HeartHandshake, BarChart3, ListChecks, BookMarked,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { NotificationBell } from "./NotificationBell";
import { toast } from "sonner";

const LOGO_FULL = "/plataforma/logo-full.png";
const LOGO_MARK = "/plataforma/logo-mark.png";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  notRoles?: string[];
  highlight?: boolean;
  dotCount?: number;
  feature?: string;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const employeeNav: NavItem[] = [
  { label: "Inicio", href: "/inicio", icon: <Home size={16} /> },
  { label: "Meus Cursos", href: "/cursos", icon: <BookOpen size={16} />, feature: "courses" },
  { label: "Qualificacoes e Habilitacoes", href: "/qualificacoes", icon: <IdCard size={16} /> },
  { label: "Certificados", href: "/certificados", icon: <Award size={16} />, feature: "certificates" },
  { label: "Pesquisas", href: "/pesquisas", icon: <ClipboardList size={16} />, feature: "surveys" },
  { label: "Area de Descompressao", href: "/area-de-descompressao", icon: <Leaf size={16} />, feature: "decompression" },
  { label: "Canal de Denuncia", href: "/denuncia", icon: <ShieldAlert size={16} /> },
  { label: "Suporte", href: "/suporte", icon: <LifeBuoy size={16} /> },
];

const adminSections: NavSection[] = [
  {
    section: "Principal",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={16} /> },
      { label: "Analises", href: "/admin/analises", notRoles: ["chefia", "sesmt", "psicologo"], icon: <LineChart size={16} />, feature: "analytics" },
      { label: "Visao 360", href: "/admin/visao-360", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Activity size={16} />, feature: "analytics" },
      { label: "Riscos Psicossociais", href: "/admin/riscos-psicossociais", notRoles: ["chefia", "sesmt", "psicologo"], icon: <ShieldAlert size={16} />, feature: "analytics" },
    ],
  },
  {
    section: "Conteudo",
    items: [
      { label: "Cursos", href: "/admin/cursos", notRoles: ["chefia", "sesmt", "psicologo"], icon: <BookOpen size={16} />, feature: "courses", dotCount: 3 },
      { label: "Pesquisas", href: "/admin/pesquisas", notRoles: ["chefia", "sesmt", "psicologo"], icon: <ClipboardList size={16} />, feature: "surveys" },
      { label: "Descompressao", href: "/admin/descompressao", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Leaf size={16} />, feature: "decompression" },
      { label: "Biblioteca", href: "/admin/biblioteca", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Library size={16} /> },
      { label: "Biblioteca Preventiva", href: "/admin/biblioteca-preventiva", notRoles: ["chefia", "sesmt", "psicologo"], icon: <BookMarked size={16} /> },
    ],
  },
  {
    // Comunicação: pessoas + canais de comunicação direta
    section: "Gestao de Pessoas",
    items: [
      { label: "Empresas", href: "/admin/empresas", icon: <Building2 size={16} />, roles: ["admin_global", "super_admin"] },
      { label: "Planos", href: "/admin/planos", icon: <CreditCard size={16} />, roles: ["admin_global", "super_admin"] },
      { label: "Filiais", href: "/admin/filiais", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Store size={16} /> },
      { label: "Setores", href: "/admin/setores", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Wrench size={16} /> },
      { label: "Colaboradores", href: "/admin/usuarios", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Users size={16} /> },
      { label: "Campanhas", href: "/admin/campanhas", notRoles: ["sesmt", "psicologo"], icon: <Mail size={16} />, feature: "campaigns" },
      { label: "Lembretes", href: "/admin/lembretes", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Bell size={16} /> },
      { label: "Agendamentos", href: "/admin/agenda", notRoles: ["sesmt"], icon: <CalendarClock size={16} /> },
    ],
  },
  {
    // GRO — identificação, classificação e controle de riscos ocupacionais
    section: "GRO Riscos",
    items: [
      { label: "Analise de Risco", href: "/admin/analise-risco", notRoles: ["chefia", "sesmt", "psicologo"], icon: <ShieldAlert size={16} />, feature: "risk_assessment" },
      { label: "13 Fatores NR-01", href: "/admin/fatores", notRoles: ["chefia", "sesmt", "psicologo"], icon: <ListChecks size={16} />, feature: "risk_assessment" },
      { label: "Acoes Vinculadas", href: "/admin/acoes-vinculadas", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Link2 size={16} />, feature: "risk_assessment" },
    ],
  },
  {
    // PGR — documentação e programa formal de gerenciamento
    section: "PGR Programa",
    items: [
      { label: "GHE / GSE", href: "/admin/ghe-gse", roles: ["sesmt", "admin_global", "super_admin"], icon: <Layers size={16} />, feature: "risk_assessment" },
      { label: "EPC / EPI", href: "/admin/epc-epi", roles: ["sesmt", "admin_global", "super_admin"], icon: <Shield size={16} />, feature: "risk_assessment" },
      { label: "Gerador de PGR", href: "/admin/pgr", roles: ["sesmt", "admin_global", "super_admin"], icon: <FileCheck size={16} />, feature: "pgr" },
      { label: "Dashboard PGR", href: "/admin/pgr/executivo", roles: ["sesmt", "admin_global", "super_admin"], icon: <BarChart3 size={16} />, feature: "pgr" },
      { label: "Auditoria PGR", href: "/admin/pgr/auditoria", roles: ["sesmt", "admin_global", "super_admin"], icon: <ShieldCheck size={16} />, feature: "pgr" },
      { label: "Revisoes PGR", href: "/admin/pgr-revisoes", roles: ["sesmt", "admin_global", "super_admin"], icon: <RotateCcw size={16} />, feature: "risk_assessment" },
      { label: "Arquivos SST", href: "/admin/arquivos", roles: ["sesmt", "admin_global", "super_admin"], icon: <FolderOpen size={16} /> },
      { label: "Responsaveis Tecnicos", href: "/admin/responsaveis-tecnicos", roles: ["sesmt", "admin_global", "super_admin"], icon: <Signature size={16} /> },
    ],
  },
  {
    // Saúde Ocupacional — PCMSO, exames, vencimentos médicos
    section: "Saude Ocupacional",
    items: [
      { label: "Referencia de Monitoramento", href: "/admin/pcmso", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Stethoscope size={16} /> },
      { label: "Vencimentos", href: "/admin/vencimentos", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Clock size={16} /> },
      { label: "Certificados", href: "/admin/certificados", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Award size={16} />, feature: "certificates" },
      { label: "Qualificacoes", href: "/admin/qualificacoes", notRoles: ["chefia", "sesmt", "psicologo"], icon: <IdCard size={16} /> },
    ],
  },
  {
    // Conformidade — indicadores, evidências e auditoria
    section: "Conformidade",
    items: [
      { label: "Dashboard SST", href: "/admin/sst-dashboard", notRoles: ["chefia"], icon: <Activity size={16} />, feature: "risk_assessment" },
      { label: "Central NR-01", href: "/admin/compliance", notRoles: ["chefia"], icon: <ShieldCheck size={16} /> },
      { label: "Canal de Denuncia", href: "/admin/denuncias", notRoles: ["chefia"], icon: <Shield size={16} /> },
      { label: "Central de Suporte", href: "/admin/suporte", roles: ["super_admin", "admin", "admin_global"], icon: <Headphones size={16} /> },
    ],
  },
  {
    section: "Gestao Avancada",
    items: [
      { label: "Configurador", href: "/admin/configurador", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Settings2 size={16} /> },
      { label: "E-mail / SMTP", href: "/admin/configuracoes/smtp", notRoles: ["chefia", "sesmt", "psicologo"], icon: <Mail size={16} /> },
    ],
  },
];

const superAdminNav: NavItem[] = [
  { label: "Painel Super Admin", href: "/super-admin", notRoles: ["sesmt", "psicologo"], icon: <Shield size={16} /> },
  { label: "Clientes", href: "/super-admin/clientes", notRoles: ["sesmt", "psicologo"], icon: <Building2 size={16} /> },
  { label: "Catalogo Master", href: "/super-admin/catalogo", notRoles: ["sesmt", "psicologo"], icon: <Library size={16} /> },
];

const ITEM_LABELS: Record<string, string> = {
  "Suporte": "Suporte",
  "Central de Suporte": "Central de Suporte",
  "Canal de Denuncia": "Canal de Denúncia",
  "Inicio": "Início",
  "Meus Cursos": "Meus Cursos",
  "Qualificacoes e Habilitacoes": "Qualificações e Habilitações",
  "Certificados": "Certificados",
  "Pesquisas": "Pesquisas",
  "Area de Descompressao": "Área de Descompressão",
  "Dashboard": "Dashboard",
  "Analises": "Análises",
  "Visao 360": "Visão 360°",
  "Riscos Psicossociais": "Riscos Psicossociais",
  "Cursos": "Cursos",
  "Descompressao": "Descompressão",
  "Biblioteca": "Biblioteca",
  "Biblioteca Preventiva": "Biblioteca Preventiva",
  "Empresas": "Empresas",
  "Planos": "Planos",
  "Filiais": "Filiais",
  "Setores": "Setores",
  "Colaboradores": "Colaboradores",
  "Campanhas": "Campanhas",
  "Lembretes": "Lembretes",
  "Agendamentos": "Agendamentos",
  "Vencimentos": "Vencimentos",
  "Analise de Risco": "Análise de Risco",
  "13 Fatores NR-01": "13 Fatores NR-01",
  "Acoes Vinculadas": "Ações Vinculadas",
  "GHE / GSE": "GHE / GSE",
  "EPC / EPI": "EPC / EPI",
  "Revisoes PGR": "Revisões PGR",
  "Dashboard SST": "Dashboard SST",
  "Gerador de PGR": "Gerador de PGR",
  "Arquivos SST": "Arquivos SST",
  "Responsaveis Tecnicos": "Responsáveis Técnicos (Assinaturas)",
  "Referencia de Monitoramento": "Referência de Monitoramento/Exame",
  "Central NR-01": "Central de Conformidade NR-01",
  "Compliance": "Central de Conformidade NR-01",
  "Configurador": "Configurador",
  "Auditoria": "Auditoria",
  "Evidencias": "Evidências",
  "Painel Super Admin": "Painel Super Admin",
  "Clientes": "Clientes",
  "Catalogo Master": "Catálogo Master",
};

const SECTION_LABELS: Record<string, string> = {
  "Principal": "PRINCIPAL",
  "Conteudo": "CONTEÚDO",
  "Gestao de Pessoas": "GESTÃO DE PESSOAS",
  "GRO Riscos": "GRO — RISCOS",
  "PGR Programa": "PGR — PROGRAMA",
  "Saude Ocupacional": "SAÚDE OCUPACIONAL",
  "Conformidade": "CONFORMIDADE",
  "Gestao Avancada": "GESTÃO AVANÇADA",
  "Super Admin": "SUPER ADMIN",
  "Area do Colaborador": "ÁREA DO COLABORADOR",
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;0,700;1,400&display=swap');

:root {
  --bg: #F4F6F9;
  --surface: #FFFFFF;
  --navy: #0E2C46;
  --green: #43C285;
  --green-glow: rgba(67,194,133,.16);
  --green-bar: #43C285;
  --side: 250px;
  --topbar-h: 60px;
}

*,*::before,*::after { box-sizing: border-box; }

.sdt-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}

.sdt-sidebar {
  width: var(--side);
  flex-shrink: 0;
  background: linear-gradient(177deg, #123451, #0A2138);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  transition: width 0.22s ease;
  position: relative;
  z-index: 10;
}
.sdt-sidebar.collapsed { width: 78px; }

.sdt-burger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  background: transparent;
  border: none;
  color: #A9B8C6;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
  padding: 0;
}
.sdt-burger:hover { background: rgba(255,255,255,0.09); color: #fff; }

.sdt-logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 14px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
  min-height: 64px;
}
.sdt-sidebar.collapsed .sdt-logo-area { flex-direction: column; align-items: center; justify-content: center; padding: 14px 0 12px; gap: 10px; }
/* burger always visible even when collapsed */

.sdt-logo-full { height: 40px; max-width: 160px; object-fit: contain; display: block; cursor: pointer; filter: brightness(0) invert(1); }
.sdt-logo-mark { width: 36px; height: 36px; object-fit: contain; display: none; cursor: pointer; filter: brightness(0) invert(1); }
.sdt-sidebar.collapsed .sdt-logo-full { display: none; }
.sdt-sidebar.collapsed .sdt-logo-mark { display: block; }

.sdt-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}
.sdt-nav::-webkit-scrollbar { width: 4px; }
.sdt-nav::-webkit-scrollbar-track { background: transparent; }
.sdt-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

.sdt-sl {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(169,184,198,0.45);
  padding: 0 6px;
  margin: 12px 0 4px;
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.15s, height 0.15s;
}
.sdt-sidebar.collapsed .sdt-sl { opacity: 0; height: 0; margin: 4px 0 0; padding: 0; }

.sdt-ni {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: 7px;
  cursor: pointer;
  text-decoration: none;
  color: #A9B8C6;
  font-size: 13.5px;
  font-weight: 500;
  position: relative;
  border-left: 3px solid transparent;
  margin-bottom: 2px;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
  overflow: hidden;
}
.sdt-ni:hover { background: rgba(255,255,255,0.06); color: #fff; text-decoration: none; }
.sdt-ni.on { background: var(--green-glow); color: #fff; border-left-color: var(--green-bar); }
.sdt-sidebar.collapsed .sdt-ni { justify-content: center; padding: 9px 0; border-left-color: transparent !important; }
.sdt-sidebar.collapsed .sdt-ni.on { background: var(--green-glow); }
.sdt-ni-icon { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 18px; }
.sdt-ni-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.sdt-sidebar.collapsed .sdt-ni-label,
.sdt-sidebar.collapsed .sdt-badge,
.sdt-sidebar.collapsed .sdt-chev { display: none; }

.sdt-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 20px;
  background: rgba(67,194,133,0.18);
  color: #43C285;
  flex-shrink: 0;
}

.sdt-helpcard {
  margin: 0 10px 10px;
  padding: 12px 13px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px;
  flex-shrink: 0;
}
.sdt-sidebar.collapsed .sdt-helpcard { display: none; }
.sdt-helpcard-title { font-size: 11.5px; font-weight: 700; color: #fff; margin-bottom: 3px; }
.sdt-helpcard-sub { font-size: 10.5px; color: rgba(169,184,198,0.65); line-height: 1.4; }

.sdt-logout {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  margin: 0 10px 14px;
  border-radius: 8px;
  width: calc(100% - 20px);
  background: transparent;
  border: none;
  color: rgba(169,184,198,0.65);
  cursor: pointer;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
}
.sdt-logout:hover { background: rgba(255,80,60,0.10); color: #ff6b5b; }
.sdt-sidebar.collapsed .sdt-logout { justify-content: center; padding: 9px 0; }
.sdt-sidebar.collapsed .sdt-logout-label { display: none; }

.sdt-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

.sdt-topbar {
  height: var(--topbar-h);
  background: rgba(255,255,255,0.80);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(14,44,70,0.09);
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 16px;
  flex-shrink: 0;
}
.sdt-search-center { flex: 1; display: flex; justify-content: center; }
.sdt-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(14,44,70,0.05);
  border: 1px solid rgba(14,44,70,0.12);
  border-radius: 22px;
  padding: 7px 16px;
  width: 100%;
  max-width: 440px;
  transition: border-color 0.15s, background 0.15s;
}
.sdt-search:focus-within { border-color: var(--green); background: rgba(67,194,133,0.04); }
.sdt-search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--navy);
  font-size: 13px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.sdt-search input::placeholder { color: rgba(14,44,70,0.35); }
.sdt-topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.sdt-bell {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: rgba(14,44,70,0.05);
  border: 1px solid rgba(14,44,70,0.10);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(14,44,70,0.5);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.sdt-bell:hover { background: rgba(14,44,70,0.10); color: var(--navy); }
.sdt-bell-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #E74C3C;
  border: 1.5px solid rgba(255,255,255,0.9);
}
.sdt-user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border-radius: 22px;
  background: rgba(14,44,70,0.05);
  border: 1px solid rgba(14,44,70,0.10);
  cursor: pointer;
  transition: background 0.15s;
}
.sdt-user-chip:hover { background: rgba(14,44,70,0.09); }
.sdt-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #43C285, #1a7fc4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.sdt-uname { font-size: 13px; font-weight: 600; color: var(--navy); white-space: nowrap; }

.sdt-imp {
  background: #F2A24A;
  color: #1a0e00;
  padding: 7px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid rgba(0,0,0,.12);
  flex-shrink: 0;
}

.sdt-content { flex: 1; overflow-y: auto; overflow-x: hidden; background: var(--bg); }

.sdt-mob-header { display: none; }

@media (max-width: 768px) {
  .sdt-sidebar { position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; transform: translateX(-100%); transition: transform 0.22s ease; width: 260px !important; }
  .sdt-sidebar.mobile-open { transform: translateX(0); }
  .sdt-sidebar.collapsed { width: 260px !important; }
  .sdt-sidebar.collapsed .sdt-logo-full { display: block; }
  .sdt-sidebar.collapsed .sdt-logo-mark { display: none; }
  .sdt-sidebar.collapsed .sdt-ni-label,
  .sdt-sidebar.collapsed .sdt-badge,
  .sdt-sidebar.collapsed .sdt-chev { display: flex; }
  .sdt-sidebar.collapsed .sdt-sl { opacity: 1; height: auto; margin: 12px 0 4px; padding: 0 6px; }
  .sdt-sidebar.collapsed .sdt-ni { justify-content: flex-start; padding: 7px 8px; border-left: 3px solid transparent; }
  .sdt-sidebar.collapsed .sdt-ni.on { border-left-color: var(--green-bar); }
  .sdt-sidebar.collapsed .sdt-logout { justify-content: flex-start; padding: 8px 10px; }
  .sdt-sidebar.collapsed .sdt-logout-label { display: block; }
  .sdt-sidebar.collapsed .sdt-helpcard { display: block; }
  .sdt-sidebar.collapsed .sdt-burger-wrap { display: flex; }
  .sdt-sidebar.collapsed .sdt-logo-area { justify-content: flex-start; padding: 18px 14px 14px; gap: 10px; }
  .sdt-mob-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 49; }
  .sdt-topbar { display: none; }
  .sdt-mob-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(14,44,70,0.09);
    flex-shrink: 0;
  }
}
`;

function ImpersonationBanner() {
  const impersonatedId = typeof window !== "undefined" ? window.localStorage.getItem("impersonatedCompanyId") : null;
  const companyIdNum = impersonatedId ? Number(impersonatedId) : 0;
  const nameQ = trpc.superAdmin.getImpersonatedCompanyName.useQuery(
    { companyId: companyIdNum },
    { enabled: !!companyIdNum }
  );
  if (!impersonatedId) return null;
  const stop = () => {
    window.localStorage.removeItem("impersonatedCompanyId");
    window.location.reload();
  };
  return (
    <div className="sdt-imp">
      <span>Visualizando como <strong>{nameQ.data ?? `Empresa #${impersonatedId}`}</strong></span>
      <button
        onClick={stop}
        style={{ padding: "3px 10px", borderRadius: "6px", background: "rgba(0,0,0,0.18)", color: "#1a0e00", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, fontFamily: "inherit" }}
      >
        Sair da impersonação
      </button>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { has } = useEntitlements();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("sdt-sidebar-collapsed") === "1"; } catch { return false; }
  });
  // Persist sidebar state across navigation/reload
  if (typeof window !== "undefined") {
    try { localStorage.setItem("sdt-sidebar-collapsed", collapsed ? "1" : "0"); } catch {}
  }
  const [mobileOpen, setMobileOpen] = useState(false);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/plataforma/login"; },
    onError: () => toast.error("Erro ao sair"),
  });

  const isImpersonating = typeof window !== "undefined" && !!window.localStorage.getItem("impersonatedCompanyId");
  const isSuperAdmin = user?.role === "super_admin" && !isImpersonating;
  const isAdmin =
    isSuperAdmin ||
    user?.role === "admin" ||
    user?.role === "rh" ||
    user?.role === "admin_global" ||
    user?.role === "company_admin" ||
    user?.role === "sesmt" ||
    user?.role === "chefia";

  function isRouteActive(href: string): boolean {
    if (location === href) return true;
    if (href === "/admin/cursos" && (location === "/admin/modulos" || location.startsWith("/admin/modulos/"))) return true;
    if (href === "/cursos" && (location === "/modulos" || location.startsWith("/modulos/"))) return true;
    return false;
  }

  const navAllowed = (item: NavItem): boolean => {
    if (item.roles && !item.roles.includes(user?.role ?? "")) return false;
    if (item.notRoles && item.notRoles.includes(user?.role ?? "")) return false;
    if (item.feature && !has(item.feature)) return false;
    return true;
  };

  const filteredAdminSections: NavSection[] = adminSections
    .map((sec) => ({ section: sec.section, items: sec.items.filter(navAllowed) }))
    .filter((sec) => sec.items.length > 0);

  const filteredEmployeeNav: NavItem[] = employeeNav.filter(navAllowed);
  // B3 — Programa de Acolhimento: visible only when eligible (non-managers).
  const elig = trpc.scheduling.myEligibility.useQuery(undefined, { enabled: !!user });
  const isManagerForAcolhimento = user && ["admin","rh","admin_global","company_admin","super_admin","psicologo","chefia"].includes(String((user as any)?.role));
  if (!isManagerForAcolhimento && elig.data?.eligible) {
    filteredEmployeeNav.push({ label: "Agendar Acolhimento", href: "/acolhimento", icon: <HeartHandshake size={16} /> });
  }
  const homeHref = user?.role === "chefia" ? "/admin/chefia" : isAdmin ? "/dashboard" : "/inicio";

  const renderNavItem = (item: NavItem) => {
    const active = isRouteActive(item.href);
    const label = ITEM_LABELS[item.label] ?? item.label;
    const cls = ["sdt-ni", active ? "on" : ""].filter(Boolean).join(" ");
    return (
      <Link key={item.href} href={item.href}>
        <div className={cls} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined}>
          <span className="sdt-ni-icon">{item.icon}</span>
          <span className="sdt-ni-label">{label}</span>
          {item.dotCount && !active && (
            <span className="sdt-badge">{item.dotCount}</span>
          )}
          {active && (
            <ChevronRight size={11} className="sdt-chev" style={{ flexShrink: 0, opacity: 0.5, marginLeft: "auto" }} />
          )}
        </div>
      </Link>
    );
  };

  const sidebarCls = ["sdt-sidebar", collapsed ? "collapsed" : "", mobileOpen ? "mobile-open" : ""].filter(Boolean).join(" ");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <div className="sdt-layout">
        <aside className={sidebarCls}>
          <div className="sdt-logo-area">
            <div className="sdt-burger-wrap">
              <button
                className="sdt-burger"
                onClick={() => setCollapsed((c) => !c)}
                aria-label="Recolher menu"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                  <rect width="16" height="2" rx="1" fill="currentColor"/>
                  <rect y="6" width="16" height="2" rx="1" fill="currentColor"/>
                  <rect y="12" width="16" height="2" rx="1" fill="currentColor"/>
                </svg>
              </button>
            </div>
            <Link href={homeHref} onClick={() => setMobileOpen(false)}>
              <img src={LOGO_FULL} alt="Saude do Trabalho" className="sdt-logo-full" />
              <img src={LOGO_MARK} alt="SDT" className="sdt-logo-mark" />
            </Link>
          </div>

          <nav className="sdt-nav">
            {isAdmin ? (
              <>
                {isSuperAdmin && (
                  <div>
                    <div className="sdt-sl">{SECTION_LABELS["Super Admin"]}</div>
                    {superAdminNav.map((i) => renderNavItem(i))}
                  </div>
                )}
                {filteredAdminSections.map((sec) => (
                  <div key={sec.section}>
                    <div className="sdt-sl">{SECTION_LABELS[sec.section] ?? sec.section.toUpperCase()}</div>
                    {sec.items.map((i) => renderNavItem(i))}
                  </div>
                ))}
                {filteredEmployeeNav.length > 0 && (
                  <div>
                    <div className="sdt-sl">{SECTION_LABELS["Area do Colaborador"]}</div>
                    {filteredEmployeeNav.map((i) => renderNavItem(i))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="sdt-sl">{SECTION_LABELS["Area do Colaborador"]}</div>
                {filteredEmployeeNav.map((i) => renderNavItem(i))}
              </>
            )}
          </nav>

          <Link href="/suporte" onClick={() => setMobileOpen(false)}>
            <div className="sdt-helpcard" style={{ cursor: "pointer" }}>
              <div className="sdt-helpcard-title">Precisa de ajuda?</div>
              <div className="sdt-helpcard-sub">Acesse a central de suporte ou fale com nossa equipe.</div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, color: "#43C285", fontSize: 11.5, fontWeight: 700 }}><LifeBuoy size={13} /> Abrir chamado</div>
            </div>
          </Link>

          <button
            className="sdt-logout"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut size={15} style={{ flexShrink: 0 }} />
            <span className="sdt-logout-label">Sair</span>
          </button>
        </aside>

        {mobileOpen && (
          <div className="sdt-mob-overlay" onClick={() => setMobileOpen(false)} />
        )}

        <div className="sdt-main">
          <header className="sdt-mob-header">
            <button
              onClick={() => setMobileOpen(true)}
              style={{ padding: "6px", borderRadius: "8px", background: "rgba(14,44,70,0.07)", border: "none", color: "#0E2C46", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <Menu size={20} />
            </button>
            <img src={LOGO_MARK} alt="SDT" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <span style={{ fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#0E2C46" }}>Saúde do Trabalho</span>
          </header>

          <header className="sdt-topbar">
            <div className="sdt-search-center">
              <div className="sdt-search">
                <Search size={14} style={{ color: "rgba(14,44,70,0.38)", flexShrink: 0 }} />
                <input placeholder="Buscar..." aria-label="Buscar" />
              </div>
            </div>
            <div className="sdt-topbar-right">
              <NotificationBell />
              <div className="sdt-user-chip">
                <div className="sdt-avatar">
                  {(user?.name ?? user?.email ?? "U")[0].toUpperCase()}
                </div>
                <span className="sdt-uname">{user?.name ?? user?.email ?? "Usuário"}</span>
              </div>
            </div>
          </header>

          <ImpersonationBanner />

          <main className="sdt-content">{children}</main>
          <footer style={{ textAlign: "center", padding: "12px 0 16px", fontSize: 11, color: "#9aa0a6" }}>
            Saúde do Trabalho · v{APP_VERSION}
          </footer>
        </div>
      </div>
    </>
  );
}


