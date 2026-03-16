import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import PageLoader from "@/components/PageLoader";
import { TaxiSidebar } from "@/components/TaxiSidebar";
import { Car } from "lucide-react";
import { ActivePageProvider, useActivePage } from "@/contexts/ActivePageContext";

import TaxiHome from "@/pages/taxi/TaxiHome";
import TaxiMetricas from "@/pages/taxi/TaxiMetricas";
import TaxiAbrangencia from "@/pages/taxi/TaxiAbrangencia";
import TaxiChamadas from "@/pages/taxi/TaxiChamadas";
import TaxiAtendimentos from "@/pages/taxi/TaxiAtendimentos";
import TaxiClientes from "@/pages/taxi/TaxiClientes";
import AnotacoesPage from "@/pages/dashboard/AnotacoesPage";
import SistemaConfiguracoesPage from "@/pages/dashboard/SistemaConfiguracoes";
import SistemaAutomacoesPage from "@/pages/dashboard/SistemaAutomacoes";
import SistemaComunicadorPage from "@/pages/dashboard/SistemaComunicador";
import TicketsPage from "@/pages/dashboard/TicketsPage";

const PAGE_MAP: Record<string, React.ComponentType> = {
  home: TaxiHome,
  metricas: TaxiMetricas,
  abrangencia: TaxiAbrangencia,
  chamadas: TaxiChamadas,
  atendimentos: TaxiAtendimentos,
  clientes: TaxiClientes,
  anotacoes: AnotacoesPage,
  "sistema/configuracoes": SistemaConfiguracoesPage,
  "sistema/automacoes": SistemaAutomacoesPage,
  "sistema/comunicador": SistemaComunicadorPage,
  tickets: TicketsPage,
};

function TaxiContent() {
  const { activePage } = useActivePage();
  const PageComponent = PAGE_MAP[activePage] || TaxiHome;

  return (
    <div className="min-h-screen flex w-full">
      <TaxiSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-12 flex items-center border-b border-border bg-card px-4 gap-3">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">E-Transporte.pro — Gestão de Táxi</span>
          </div>
        </header>
        <main className="flex-1 bg-background p-6 overflow-auto">
          <PageLoader pageKey={activePage}>
            <PageComponent key={activePage} />
          </PageLoader>
        </main>
      </div>
    </div>
  );
}

export default function TaxiDashboardLayout() {
  return (
    <ActivePageProvider defaultPage="home">
      <SidebarProvider>
        <TaxiContent />
      </SidebarProvider>
    </ActivePageProvider>
  );
}
