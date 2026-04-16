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
    <div className="flex min-h-svh w-full max-w-[100vw] overflow-x-hidden bg-background">
      <AdminSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 min-h-12 shrink-0 items-center gap-2 border-b border-border px-2 sm:px-4">
          <SidebarTrigger className="shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground sm:ml-1">
            {config.nome_projeto || "Painel Admin Master"}
          </span>
        </header>
        <main
          ref={mainRef}
          className={cn(
            "min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth",
            activePage === "comunidade"
              ? "[--main-pad-x:0px] [--main-pad-y:0px] px-0 pb-6 pt-0"
              : "[--main-pad-x:1rem] [--main-pad-y:1rem] px-[var(--main-pad-x)] py-[var(--main-pad-y)] sm:[--main-pad-x:1.5rem] sm:[--main-pad-y:1.5rem]",
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
