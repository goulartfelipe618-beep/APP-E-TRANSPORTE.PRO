import { useRef, useLayoutEffect } from "react";
import { syncPanelThemeForCurrentUser } from "@/lib/panelTheme";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useSlowScrollContainer } from "@/hooks/useSlowScrollContainer";
import { AdminSidebar } from "@/components/AdminSidebar";
import { ActivePageProvider, useActivePage } from "@/contexts/ActivePageContext";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";

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
import ComunicadorAdminMasterPage from "@/pages/dashboard/ComunicadorAdminMaster";
import AdminTicketsPage from "@/pages/admin/AdminTicketsPage";
import AdminMentoriaPage from "@/pages/admin/AdminMentoriaPage";
import AdminEmptyLegsPage from "@/pages/admin/AdminEmptyLegsPage";
import AdminCommunityPage from "@/pages/admin/AdminCommunityPage";
import DominiosPage from "@/pages/dashboard/DominiosPage";
import AdminAvisosPage from "@/pages/admin/AdminAvisosPage";

const PAGE_MAP: Record<string, React.ComponentType> = {
  metricas: AdminMetricasPage,
  abrangencia: AdminAbrangenciaPage,
  slides: AdminSlidesPage,
  comunidade: AdminCommunityPage,
  "contrato/transfer": AdminContratoTransferPage,
  "contrato/taxi": AdminContratoTaxiPage,
  "usuarios/cadastrados": AdminUsuariosCadastradosPage,
  "usuarios/solicitacoes": AdminUsuariosSolicitacoesPage,
  network: AdminNetworkPage,
  "solicitacoes-servicos": AdminSolicitacoesServicos,
  templates: AdminTemplatesPage,
  "sistema/configuracoes": SistemaConfiguracoesPage,
  "sistema/automacoes": AdminAutomacoesPage,
  "sistema/comunicador": ComunicadorAdminMasterPage,
  "sistema/avisos": AdminAvisosPage,
  "sistema/anotacoes": AnotacoesPage,
  tickets: AdminTicketsPage,
  mentoria: AdminMentoriaPage,
  "empty-legs": AdminEmptyLegsPage,
  dominios: DominiosPage,
};

function AdminContent() {
  const { activePage } = useActivePage();
  const { config } = useConfiguracoes();
  const mainRef = useRef<HTMLElement>(null);
  useSlowScrollContainer(mainRef, activePage === "templates");
  const PageComponent = PAGE_MAP[activePage] || AdminAbrangenciaPage;

  useLayoutEffect(() => {
    syncPanelThemeForCurrentUser("admin");
  }, []);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-12 flex items-center border-b border-border px-4">
          <SidebarTrigger />
          <span className="ml-3 text-sm font-semibold text-foreground">{config.nome_projeto || "Painel Admin Master"}</span>
        </header>
        <main
          ref={mainRef}
          className={cn(
            "flex-1 min-h-0 overflow-auto scroll-smooth",
            activePage === "comunidade" ? "px-0 pb-6 pt-0" : "p-6",
          )}
        >
          <PageComponent key={activePage} />
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <ActivePageProvider defaultPage="abrangencia" storageKey="etp_nav_admin">
      <SidebarProvider>
        <AdminContent />
      </SidebarProvider>
    </ActivePageProvider>
  );
}
