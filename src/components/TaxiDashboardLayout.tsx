import { useLayoutEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { syncPanelThemeForCurrentUser } from "@/lib/panelTheme";
import PageLoader from "@/components/PageLoader";
import { TaxiSidebar } from "@/components/TaxiSidebar";
import { Car } from "lucide-react";
import { ActivePageProvider, useActivePage } from "@/contexts/ActivePageContext";
import FloatingSupportChat from "@/components/FloatingSupportChat";

import TaxiHome from "@/pages/taxi/TaxiHome";
import TaxiMetricas from "@/pages/taxi/TaxiMetricas";
import TaxiAbrangencia from "@/pages/taxi/TaxiAbrangencia";
import TaxiChamadas from "@/pages/taxi/TaxiChamadas";
import TaxiAtendimentos from "@/pages/taxi/TaxiAtendimentos";
import TaxiClientes from "@/pages/taxi/TaxiClientes";
import AnotacoesPage from "@/pages/dashboard/AnotacoesPage";
import SistemaConfiguracoesPage from "@/pages/dashboard/SistemaConfiguracoes";
import SistemaAutomacoesPage from "@/pages/dashboard/SistemaAutomacoes";
import TicketsPage from "@/pages/dashboard/TicketsPage";
import TaxiCommunityPage from "@/pages/taxi/TaxiCommunityPage";
import PainelAvisoBanner from "@/components/PainelAvisoBanner";
import FullscreenBannerOverlay from "@/components/FullscreenBannerOverlay";

const PAGE_MAP: Record<string, React.ComponentType> = {
  home: TaxiHome,
  metricas: TaxiMetricas,
  abrangencia: TaxiAbrangencia,
  chamadas: TaxiChamadas,
  atendimentos: TaxiAtendimentos,
  clientes: TaxiClientes,
  comunidade: TaxiCommunityPage,
  anotacoes: AnotacoesPage,
  "sistema/configuracoes": SistemaConfiguracoesPage,
  "sistema/automacoes": SistemaAutomacoesPage,
  tickets: TicketsPage,
};

function TaxiContent() {
  const { activePage } = useActivePage();
  const PageComponent = PAGE_MAP[activePage] || TaxiHome;

  useLayoutEffect(() => {
    syncPanelThemeForCurrentUser("taxi");
  }, []);

  return (
    <div className="flex min-h-svh w-full max-w-[100vw] overflow-x-hidden">
      <TaxiSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 min-h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-2 sm:gap-3 sm:px-4">
          <SidebarTrigger className="shrink-0" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Car className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium text-foreground">E-Transporte.pro — Gestão de Táxi</span>
          </div>
        </header>
        <PainelAvisoBanner painel="taxi" activePage={activePage} />
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-background [--main-pad-x:1rem] [--main-pad-y:1rem] px-[var(--main-pad-x)] py-[var(--main-pad-y)] sm:[--main-pad-x:1.5rem] sm:[--main-pad-y:1.5rem]">
          <PageLoader>
            <PageComponent />
          </PageLoader>
        </main>
      </div>
      <FloatingSupportChat />
      <FullscreenBannerOverlay painel="taxi" activePage={activePage} />
    </div>
  );
}

export default function TaxiDashboardLayout() {
  return (
    <ActivePageProvider defaultPage="home" storageKey="etp_nav_taxi">
      <SidebarProvider>
        <TaxiContent />
      </SidebarProvider>
    </ActivePageProvider>
  );
}
