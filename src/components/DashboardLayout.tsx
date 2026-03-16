import { useState, useEffect, lazy, Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Shield } from "lucide-react";
import { ActivePageProvider, useActivePage } from "@/contexts/ActivePageContext";

// Import all page components
import HomePage from "@/pages/dashboard/Home";
import MetricasPage from "@/pages/dashboard/Metricas";
import PlaceholderPage from "@/pages/dashboard/Placeholder";
import TransferSolicitacoesPage from "@/pages/dashboard/TransferSolicitacoes";
import TransferReservasPage from "@/pages/dashboard/TransferReservas";
import TransferContratoPage from "@/pages/dashboard/TransferContrato";
import TransferGeolocalizacaoPage from "@/pages/dashboard/TransferGeolocalizacao";
import GruposSolicitacoesPage from "@/pages/dashboard/GruposSolicitacoes";
import GruposReservasPage from "@/pages/dashboard/GruposReservas";
import GruposContratoPage from "@/pages/dashboard/GruposContrato";
import MotoristaCadastrosPage from "@/pages/dashboard/MotoristaCadastros";
import MotoristaParceriasPage from "@/pages/dashboard/MotoristaParcerias";
import MotoristaSolicitacoesPage from "@/pages/dashboard/MotoristaSolicitacoes";
import MotoristaAgendamentosPage from "@/pages/dashboard/MotoristaAgendamentos";
import VeiculosPage from "@/pages/dashboard/Veiculos";
import CampanhasAtivosPage from "@/pages/dashboard/CampanhasAtivos";
import CampanhasLeadsPage from "@/pages/dashboard/CampanhasLeads";
import MarketingReceptivosPage from "@/pages/dashboard/MarketingReceptivos";
import MarketingQRCodePage from "@/pages/dashboard/MarketingQRCode";
import NetworkPage from "@/pages/dashboard/NetworkPage";
import GooglePage from "@/pages/dashboard/GooglePage";
import EmailBusinessPage from "@/pages/dashboard/EmailBusinessPage";
import WebsitePage from "@/pages/dashboard/WebsitePage";
import AnotacoesPage from "@/pages/dashboard/AnotacoesPage";
import SistemaConfiguracoesPage from "@/pages/dashboard/SistemaConfiguracoes";
import SistemaAutomacoesPage from "@/pages/dashboard/SistemaAutomacoes";
import SistemaComunicadorPage from "@/pages/dashboard/SistemaComunicador";
import TicketsPage from "@/pages/dashboard/TicketsPage";

const PAGE_MAP: Record<string, React.ComponentType> = {
  home: HomePage,
  metricas: MetricasPage,
  abrangencia: PlaceholderPage,
  "transfer/solicitacoes": TransferSolicitacoesPage,
  "transfer/reservas": TransferReservasPage,
  "transfer/contrato": TransferContratoPage,
  "transfer/geolocalizacao": TransferGeolocalizacaoPage,
  "grupos/solicitacoes": GruposSolicitacoesPage,
  "grupos/reservas": GruposReservasPage,
  "grupos/contrato": GruposContratoPage,
  "motoristas/cadastros": MotoristaCadastrosPage,
  "motoristas/parcerias": MotoristaParceriasPage,
  "motoristas/solicitacoes": MotoristaSolicitacoesPage,
  "motoristas/agendamentos": MotoristaAgendamentosPage,
  veiculos: VeiculosPage,
  "campanhas/ativos": CampanhasAtivosPage,
  "campanhas/leads": CampanhasLeadsPage,
  "marketing/receptivos": MarketingReceptivosPage,
  "marketing/qrcode": MarketingQRCodePage,
  network: NetworkPage,
  google: GooglePage,
  "email-business": EmailBusinessPage,
  website: WebsitePage,
  anotacoes: AnotacoesPage,
  "sistema/configuracoes": SistemaConfiguracoesPage,
  "sistema/automacoes": SistemaAutomacoesPage,
  "sistema/comunicador": SistemaComunicadorPage,
  tickets: TicketsPage,
};

function DashboardContent() {
  const { activePage } = useActivePage();
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    const handler = () => {
      const aceito = localStorage.getItem("network_nacional_aceito") === "sim";
      const highlightShown = localStorage.getItem("network_highlight_shown") === "sim";
      if (aceito && !highlightShown) setShowOverlay(true);
    };
    window.addEventListener("network-status-changed", handler);
    return () => window.removeEventListener("network-status-changed", handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setShowOverlay(false);
      localStorage.setItem("network_highlight_shown", "sim");
    };
    window.addEventListener("network-highlight-dismissed", handler);
    return () => window.removeEventListener("network-highlight-dismissed", handler);
  }, []);

  const PageComponent = PAGE_MAP[activePage] || HomePage;

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-12 flex items-center border-b border-border bg-card px-4 gap-3">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">E-Transporte.pro — Gestão de Frota</span>
          </div>
        </header>
        <main className="flex-1 bg-background p-6 overflow-auto">
          <PageComponent key={activePage} />
        </main>
      </div>
      {showOverlay && (
        <div
          className="fixed inset-0 bg-black/60 z-50 animate-fade-in"
          onClick={() => {
            setShowOverlay(false);
            localStorage.setItem("network_highlight_shown", "sim");
            window.dispatchEvent(new Event("network-highlight-dismissed"));
          }}
        />
      )}
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <ActivePageProvider defaultPage="home">
      <SidebarProvider>
        <DashboardContent />
      </SidebarProvider>
    </ActivePageProvider>
  );
}
