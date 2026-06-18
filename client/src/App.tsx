import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Router as WouterRouter, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import SetPassword from "./pages/SetPassword";
import Activate from "./pages/Activate";
import Dashboard from "./pages/Dashboard";
import Modules from "./pages/Modules";
import ModulePlayer from "./pages/ModulePlayer";
import Certificates from "./pages/Certificates";
import Decompression from "./pages/Decompression";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCampaigns from "./pages/admin/AdminCampaigns";
import AdminModules from "./pages/admin/AdminModules";
import AdminReminders from "./pages/admin/AdminReminders";
import AdminReports from "./pages/admin/AdminReports";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminDecompression from "./pages/admin/AdminDecompression";
import SurveyStudio from "./pages/admin/SurveyStudio";
import DecompressionStudio from "./pages/admin/DecompressionStudio";
import AdminCertificates from "./pages/admin/AdminCertificates";
import AdminCompanies from "@/pages/admin/AdminCompanies";
import AdminPlans from "@/pages/admin/AdminPlans";
import AdminCompanyDetail from "@/pages/admin/AdminCompanyDetail";
import AdminAuditLogs from "@/pages/admin/AdminAuditLogs";
import AdminEvidenceReport from "@/pages/admin/AdminEvidenceReport";
import Denuncia from "@/pages/Denuncia";
import DenunciaTrack from "@/pages/DenunciaTrack";
import AdminDenuncias from "@/pages/admin/AdminDenuncias";
import AdminDenunciaDetail from "@/pages/admin/AdminDenunciaDetail";
import AdminDenunciaIndicadores from "@/pages/admin/AdminDenunciaIndicadores";
import AdminModuleWizard from "@/pages/admin/AdminModuleWizard";
import AdminTrails from "@/pages/admin/AdminTrails";
import AdminStudentHistory from "@/pages/admin/AdminStudentHistory";
import AdminColaborador360 from "@/pages/admin/AdminColaborador360";
import AdminRiscosPsicossociais from "@/pages/admin/AdminRiscosPsicossociais";
import AdminImportarASO from "@/pages/admin/AdminImportarASO";
import AdminImportarAbsenteismo from "@/pages/admin/AdminImportarAbsenteismo";
import AdminResponsaveisTecnicos from "@/pages/admin/AdminResponsaveisTecnicos";
import Trails from "@/pages/Trails";
import AdminCompanySettings from "@/pages/admin/AdminCompanySettings";
import AdminSmtpSettings from "@/pages/admin/AdminSmtpSettings";
import ManagerDashboard from "@/pages/ManagerDashboard";
import AdminChefia from "@/pages/admin/AdminChefia";
import AdminVisao360 from "@/pages/admin/AdminVisao360";
import EmployeeHome from "@/pages/EmployeeHome";
import AdminExpirations from "@/pages/AdminExpirations";
import MyLicenses from "@/pages/MyLicenses";
import Qualificacoes from "@/pages/Qualificacoes";
import AdminQualifications from "@/pages/admin/AdminQualifications";
import SuperAdminDashboard from "@/pages/superadmin/SuperAdminDashboard";
import SuperAdminClients from "@/pages/superadmin/SuperAdminClients";
import SuperAdminCatalog from "@/pages/superadmin/SuperAdminCatalog";
import Configurador from "@/pages/admin/Configurador";
import AdminBranches from "@/pages/admin/AdminBranches";
import AdminScheduling from "@/pages/admin/AdminScheduling";
import AgendarAcolhimento from "@/pages/AgendarAcolhimento";
import VerifyCertificate from "@/pages/VerifyCertificate";
import AdminPGRExecutive from "@/pages/admin/AdminPGRExecutive";
import AdminPGRAudit from "@/pages/admin/AdminPGRAudit";
import AdminDepartments from "@/pages/admin/AdminDepartments";
import AIStudio from "@/pages/admin/AIStudio";
import CourseEditor from "@/pages/admin/CourseEditor";
import ComplianceHub from "@/pages/admin/ComplianceHub";
import AdminSurveys from "@/pages/admin/AdminSurveys";
import AdminLibrary from "@/pages/admin/AdminLibrary";
import AdminGHEGSE from "@/pages/admin/AdminGHEGSE";
import AdminEPCEPI from "@/pages/admin/AdminEPCEPI";
import AdminPGRRevision from "@/pages/admin/AdminPGRRevision";
import AdminSSTDashboard from "@/pages/admin/AdminSSTDashboard";
import AdminAcoesVinculadas from "@/pages/admin/AdminAcoesVinculadas";
import AdminRiskAssessments from "@/pages/admin/AdminRiskAssessments";
import AdminRiskAssessmentDetail from "@/pages/admin/AdminRiskAssessmentDetail";
import AdminPGR from "@/pages/admin/AdminPGR";
import AdminFiles from "@/pages/admin/AdminFiles";
import AdminNRTraining from "@/pages/admin/AdminNRTraining";
import AdminPCMSO from "@/pages/admin/AdminPCMSO";
import AdminFatores from "@/pages/admin/AdminFatores";
import AdminPrograms from "@/pages/admin/AdminPrograms";
import AdminProgramas from "@/pages/admin/AdminProgramas";
import AdminBibliotecaPreventiva from "@/pages/admin/AdminBibliotecaPreventiva";
import AdminClientPlans from "@/pages/admin/AdminClientPlans";
import AdminHRImports from "@/pages/admin/AdminHRImports";
import AdminRiskConsolidated from "@/pages/admin/AdminRiskConsolidated";
import Suporte from "@/pages/Suporte";
import AdminSuporte from "@/pages/admin/AdminSuporte";
import SurveyBuilder from "@/pages/admin/SurveyBuilder";
import SurveyResults from "@/pages/admin/SurveyResults";
import EmployeeSurveys from "@/pages/EmployeeSurveys";
import SurveyAnswer from "@/pages/SurveyAnswer";
import { useAuth } from "./_core/hooks/useAuth";
import MissaoCourseMap from "@/pages/missao/MissaoCourseMap";
import MissaoLessonPlayer from "@/pages/missao/MissaoLessonPlayer";

import { Redirect } from "wouter";

function isSuperAdmin(role?: string) {
  return role === "super_admin";
}

function isManagerRole(role?: string) {
  return role === "admin" || role === "rh" || role === "admin_global" || role === "company_admin" || role === "super_admin"
    || role === "chefia" || role === "sesmt" || role === "psicologo";
}

function SuperAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen brand-gradient flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  if (!isSuperAdmin(user.role)) return <Redirect to="/inicio" />;
  return <Component />;
}

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen brand-gradient flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  if (adminOnly && !isManagerRole(user.role)) return <Redirect to="/inicio" />;
  return <Component />;
}

function RoleAwareDashboard() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen brand-gradient flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  if (isSuperAdmin(user.role)) return <Redirect to="/super-admin" />;
  if (user.role === "chefia") return <Redirect to="/admin/chefia" />;
  if (isManagerRole(user.role)) return <ManagerDashboard />;
  return <Redirect to="/inicio" />;
}

function Router() {
  return (
    <WouterRouter base="/plataforma">
      <Switch>
      <Route path="/" component={() => <Redirect to="/login" />} />
      <Route path="/login" component={Login} />
      <Route path="/primeiro-acesso" component={SetPassword} />
      <Route path="/ativar" component={Activate} />
      <Route path="/dashboard" component={RoleAwareDashboard} />
      <Route path="/admin/chefia" component={() => <ProtectedRoute component={AdminChefia} adminOnly />} />
      <Route path="/admin/visao-360" component={() => <ProtectedRoute component={AdminVisao360} adminOnly />} />
      <Route path="/inicio" component={() => <ProtectedRoute component={EmployeeHome} />} />
      <Route path="/modulos" component={() => <ProtectedRoute component={Modules} />} />
      <Route path="/cursos" component={() => <ProtectedRoute component={Modules} />} />
      <Route path="/modulos/:id" component={() => <ProtectedRoute component={ModulePlayer} />} />
      <Route path="/cursos/:id" component={() => <ProtectedRoute component={ModulePlayer} />} />
      <Route path="/certificados" component={() => <ProtectedRoute component={Certificates} />} />
      <Route path="/minhas-licencas" component={() => <ProtectedRoute component={MyLicenses} />} />
      <Route path="/qualificacoes" component={() => <ProtectedRoute component={Qualificacoes} />} />
      <Route path="/admin/qualificacoes" component={() => <ProtectedRoute component={AdminQualifications} adminOnly />} />
      <Route path="/area-de-descompressao" component={() => <ProtectedRoute component={Decompression} />} />
      <Route path="/dashboard-classic" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} adminOnly />} />
      <Route path="/admin/vencimentos" component={() => <ProtectedRoute component={AdminExpirations} adminOnly />} />
      <Route path="/admin/usuarios" component={() => <ProtectedRoute component={AdminUsers} adminOnly />} />
      <Route path="/admin/campanhas" component={() => <ProtectedRoute component={AdminCampaigns} adminOnly />} />
      <Route path="/admin/modulos" component={() => <ProtectedRoute component={AdminModules} adminOnly />} />
      <Route path="/admin/cursos" component={() => <ProtectedRoute component={AdminModules} adminOnly />} />
      <Route path="/admin/lembretes" component={() => <ProtectedRoute component={AdminReminders} adminOnly />} />
      <Route path="/admin/analises" component={() => <ProtectedRoute component={AdminAnalytics} adminOnly />} />
      <Route path="/admin/riscos-psicossociais" component={() => <ProtectedRoute component={AdminRiscosPsicossociais} adminOnly />} />
      <Route path="/admin/relatorios" component={() => <ProtectedRoute component={AdminAnalytics} adminOnly />} />
      <Route path="/admin/descompressao" component={() => <ProtectedRoute component={AdminDecompression} adminOnly />} />
      <Route path="/admin/certificados" component={() => <ProtectedRoute component={AdminCertificates} adminOnly />} />
            <Route path="/trilhas" component={() => <ProtectedRoute component={Trails} />} />
      <Route path="/admin/responsaveis-tecnicos" component={() => <ProtectedRoute component={AdminResponsaveisTecnicos} adminOnly />} />
      <Route path="/admin/usuarios/:id/historico" component={() => <ProtectedRoute component={AdminStudentHistory} adminOnly />} />
      <Route path="/admin/importar-aso" component={() => <ProtectedRoute component={AdminImportarASO} adminOnly />} />
      <Route path="/admin/importar-absenteismo" component={() => <ProtectedRoute component={AdminImportarAbsenteismo} adminOnly />} />
      <Route path="/admin/colaboradores/:id" component={(p: any) => <ProtectedRoute component={() => <AdminColaborador360 id={Number(p.params?.id)} />} adminOnly />} />
            <Route path="/admin/trilhas" component={() => <ProtectedRoute component={AdminTrails} adminOnly />} />
            <Route path="/admin/modulos/novo" component={() => <ProtectedRoute component={AdminModuleWizard} adminOnly />} />
            <Route path="/admin/cursos/novo" component={() => <ProtectedRoute component={AdminModuleWizard} adminOnly />} />
      <Route path="/admin/empresas/:id/configuracoes" component={() => <ProtectedRoute component={AdminCompanySettings} adminOnly />} />
      <Route path="/admin/empresas" component={() => <ProtectedRoute component={AdminCompanies} adminOnly />} />
      <Route path="/admin/planos" component={() => <ProtectedRoute component={AdminPlans} adminOnly />} />
      <Route path="/admin/empresas/:id" component={() => <ProtectedRoute component={AdminCompanyDetail} adminOnly />} />
      <Route path="/admin/auditoria" component={() => <ProtectedRoute component={AdminAuditLogs} adminOnly />} />
      <Route path="/admin/evidencias" component={() => <ProtectedRoute component={AdminEvidenceReport} adminOnly />} />
      <Route path="/admin/configurador" component={() => <ProtectedRoute component={Configurador} adminOnly />} />
      <Route path="/admin/configuracoes/smtp" component={() => <ProtectedRoute component={AdminSmtpSettings} adminOnly />} />
      <Route path="/admin/filiais" component={() => <ProtectedRoute component={AdminBranches} adminOnly />} />
      <Route path="/admin/agenda" component={() => <ProtectedRoute component={AdminScheduling} adminOnly />} />
      <Route path="/admin/setores" component={() => <ProtectedRoute component={AdminDepartments} adminOnly />} />
            <Route path="/admin/ai-studio" component={() => <ProtectedRoute component={AIStudio} adminOnly />} />
      <Route path="/admin/modulos/:id/editar" component={() => <ProtectedRoute component={CourseEditor} adminOnly />} />
      <Route path="/admin/cursos/:id/editar" component={() => <ProtectedRoute component={CourseEditor} adminOnly />} />
      <Route path="/admin/compliance" component={() => <ProtectedRoute component={ComplianceHub} adminOnly />} />
      <Route path="/admin/pesquisas" component={() => <ProtectedRoute component={AdminSurveys} adminOnly />} />
      <Route path="/admin/pesquisas/estudio" component={() => <ProtectedRoute component={SurveyStudio} adminOnly />} />
      <Route path="/admin/biblioteca" component={() => <ProtectedRoute component={AdminLibrary} adminOnly />} />
      <Route path="/admin/ghe-gse" component={() => <ProtectedRoute component={AdminGHEGSE} adminOnly />} />
      <Route path="/admin/epc-epi" component={() => <ProtectedRoute component={AdminEPCEPI} adminOnly />} />
      <Route path="/admin/pgr-revisoes" component={() => <ProtectedRoute component={AdminPGRRevision} adminOnly />} />
      <Route path="/admin/sst-dashboard" component={() => <ProtectedRoute component={AdminSSTDashboard} adminOnly />} />
      <Route path="/admin/acoes-vinculadas" component={() => <ProtectedRoute component={AdminAcoesVinculadas} adminOnly />} />
      <Route path="/admin/analise-risco" component={() => <ProtectedRoute component={AdminRiskAssessments} adminOnly />} />
      <Route path="/admin/analise-risco/:id" component={(p: any) => <ProtectedRoute component={() => <AdminRiskAssessmentDetail id={Number(p.params?.id)} />} adminOnly />} />
      <Route path="/admin/pgr" component={() => <ProtectedRoute component={AdminPGR} adminOnly />} />
      <Route path="/admin/pgr/executivo" component={() => <ProtectedRoute component={AdminPGRExecutive} adminOnly />} />
      <Route path="/admin/pgr/auditoria" component={() => <ProtectedRoute component={AdminPGRAudit} adminOnly />} />
      <Route path="/admin/arquivos" component={() => <ProtectedRoute component={AdminFiles} adminOnly />} />
      <Route path="/admin/treinamentos-nr" component={() => <ProtectedRoute component={AdminNRTraining} adminOnly />} />
        <Route path="/admin/pcmso" component={() => <ProtectedRoute component={AdminPCMSO} adminOnly />} />
      <Route path="/admin/fatores" component={() => <ProtectedRoute component={AdminFatores} adminOnly />} />
      <Route path="/admin/programs" component={() => <ProtectedRoute component={AdminPrograms} adminOnly />} />
      <Route path="/admin/programas" component={() => <ProtectedRoute component={AdminProgramas} adminOnly />} />
      <Route path="/admin/biblioteca-preventiva" component={() => <ProtectedRoute component={AdminBibliotecaPreventiva} adminOnly />} />
      <Route path="/admin/planos-clientes" component={() => <ProtectedRoute component={AdminClientPlans} adminOnly />} />
      <Route path="/admin/importar-rh" component={() => <ProtectedRoute component={AdminHRImports} adminOnly />} />
      <Route path="/admin/risco-consolidado" component={() => <ProtectedRoute component={AdminRiskConsolidated} adminOnly />} />
      <Route path="/admin/descompressao/estudio" component={() => <ProtectedRoute component={DecompressionStudio} adminOnly />} />
      <Route path="/admin/pesquisas/:id/editar" component={() => <ProtectedRoute component={SurveyBuilder} adminOnly />} />
      <Route path="/admin/pesquisas/:id/resultados" component={() => <ProtectedRoute component={SurveyResults} adminOnly />} />
      <Route path="/suporte" component={() => <ProtectedRoute component={Suporte} />} />
      <Route path="/admin/suporte" component={() => <ProtectedRoute component={AdminSuporte} adminOnly />} />
      <Route path="/pesquisas" component={() => <ProtectedRoute component={EmployeeSurveys} />} />
      <Route path="/pesquisas/:id/responder" component={() => <ProtectedRoute component={SurveyAnswer} />} />
      <Route path="/super-admin" component={() => <SuperAdminRoute component={SuperAdminDashboard} />} />
      <Route path="/super-admin/clientes" component={() => <SuperAdminRoute component={SuperAdminClients} />} />
      <Route path="/super-admin/catalogo" component={() => <SuperAdminRoute component={SuperAdminCatalog} />} />
      <Route path="/missao" component={() => <Redirect to="/modulos" />} />
      <Route path="/missao/curso/:moduleId" component={() => <ProtectedRoute component={MissaoCourseMap} />} />
      <Route path="/missao/aula/:lessonId" component={() => <ProtectedRoute component={MissaoLessonPlayer} />} />
      <Route path="/denuncia" component={Denuncia} />
      <Route path="/verificar/:code" component={VerifyCertificate} />
      <Route path="/acolhimento" component={() => <ProtectedRoute component={AgendarAcolhimento} />} />
      <Route path="/denuncia/acompanhar" component={DenunciaTrack} />
      <Route path="/admin/denuncias" component={() => <ProtectedRoute component={AdminDenuncias} adminOnly />} />
      <Route path="/admin/denuncias/indicadores" component={() => <ProtectedRoute component={AdminDenunciaIndicadores} adminOnly />} />
      <Route path="/admin/denuncias/:id" component={() => <ProtectedRoute component={AdminDenunciaDetail} adminOnly />} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;



