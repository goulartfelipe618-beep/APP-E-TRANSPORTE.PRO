import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { ActivePageProvider, useActivePage } from "@/contexts/ActivePageContext";

import AdminSlidesPage from "@/pages/admin/SlidesPage";
import AdminMetricasPage from "@/pages/admin/AdminMetricas";
import AdminAbrangenciaPage from "@/pages/admin/AdminAbrangencia";
import AdminContratoTransferPage from "@/pages/admin/AdminContratoTransfer";
import AdminContratoTaxiPage from "@/pages/admin/AdminContratoTaxi";
import AdminUsuariosCadastradosPage from "@/pages/admin/AdminUsuariosCadastrados";
import AdminUsuariosSolicitacoesPage from "@/pages/admin/AdminUsuariosSolicitacoes";
import AdminNetworkPage from "@/pages/admin/AdminNetworkPage";
import AdminSolicitacoesServicos from "@/pages/admin/AdminSolicitacoesServicos";
import AdminTemplatesPage from "@/pages/admin/AdminTemplatesPage";
import AdminAutomacoesPage from "@/pages/admin/AdminAutomacoesPage";
import AnotacoesPage from "@/pages/dashboard/AnotacoesPage";
import SistemaConfiguracoesPage from "@/pages/dashboard/SistemaConfiguracoes";
import SistemaComunicadorPage from "@/pages/dashboard/SistemaComunicador";
import AdminTicketsPage from "@/pages/admin/AdminTicketsPage";
import AdminMentoriaPage from "@/pages/admin/AdminMentoriaPage";
import AdminEmptyLegsPage from "@/pages/admin/AdminEmptyLegsPage";

const PAGE_MAP: Record<string, React.ComponentType> = {
  metricas: AdminMetricasPage,
  abrangencia: AdminAbrangenciaPage,
  slides: AdminSlidesPage,
  "contrato/transfer": AdminContratoTransferPage,
  "contrato/taxi": AdminContratoTaxiPage,
  "usuarios/cadastrados": AdminUsuariosCadastradosPage,
  "usuarios/solicitacoes": AdminUsuariosSolicitacoesPage,
  network: AdminNetworkPage,
  "solicitacoes-servicos": AdminSolicitacoesServicos,
  templates: AdminTemplatesPage,
  "sistema/configuracoes": SistemaConfiguracoesPage,
  "sistema/automacoes": AdminAutomacoesPage,
  "sistema/comunicador": SistemaComunicadorPage,
  "sistema/anotacoes": AnotacoesPage,
  tickets: AdminTicketsPage,
  mentoria: AdminMentoriaPage,
  "empty-legs": AdminEmptyLegsPage,
};

function AdminContent() {
  const { activePage } = useActivePage();
  const PageComponent = PAGE_MAP[activePage] || AdminAbrangenciaPage;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-12 flex items-center border-b border-border px-4">
          <SidebarTrigger />
          <span className="ml-3 text-sm font-semibold text-foreground">Painel Admin Master</span>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <PageComponent key={activePage} />
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <ActivePageProvider defaultPage="abrangencia">
      <SidebarProvider>
        <AdminContent />
      </SidebarProvider>
    </ActivePageProvider>
  );
}
