import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { syncPanelThemeForCurrentUser } from "@/lib/panelTheme";
import { useSlowScrollContainer } from "@/hooks/useSlowScrollContainer";
import PageLoader from "@/components/PageLoader";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Shield } from "lucide-react";
import { ActivePageProvider, useActivePage } from "@/contexts/ActivePageContext";
import FloatingSupportChat from "@/components/FloatingSupportChat";
import { NetworkSpotlightProvider } from "@/contexts/NetworkSpotlightContext";
import { hydrateNetworkNacionalFromDb, persistNetworkHighlightDismissed } from "@/lib/networkNacionalPrefs";
import { usePainelMotoristaEvolutionAtivo } from "@/hooks/usePainelMotoristaEvolutionAtivo";
import { useMotoristaOnboarding } from "@/hooks/useMotoristaOnboarding";
import { usePainelErrorReporter } from "@/hooks/usePainelErrorReporter";
import { useScrollPanelToTop } from "@/hooks/useScrollPanelToTop";

// Import all page components
import HomePage from "@/pages/dashboard/Home";
import MetricasPage from "@/pages/dashboard/Metricas";
import MotoristaAbrangenciaPage from "@/pages/dashboard/MotoristaAbrangencia";
import TransferSolicitacoesPage from "@/pages/dashboard/TransferSolicitacoes";
import TransferReservasPage from "@/pages/dashboard/TransferReservas";
import TransferContratoPage from "@/pages/dashboard/TransferContrato";
import TransferGeolocalizacaoPage from "@/pages/dashboard/TransferGeolocalizacao";
import GruposSolicitacoesPage from "@/pages/dashboard/GruposSolicitacoes";
import GruposReservasPage from "@/pages/dashboard/GruposReservas";
import GruposContratoPage from "@/pages/dashboard/GruposContrato";
import MotoristaCadastrosPage from "@/pages/dashboard/MotoristaCadastros";
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
import DominiosPage from "@/pages/dashboard/DominiosPage";
import AnotacoesPage from "@/pages/dashboard/AnotacoesPage";
import SistemaConfiguracoesPage from "@/pages/dashboard/SistemaConfiguracoes";
import SistemaAutomacoesPage from "@/pages/dashboard/SistemaAutomacoes";
import ComunicadorMotoristaExecutivoPage from "@/pages/dashboard/ComunicadorMotoristaExecutivo";
import TicketsPage from "@/pages/dashboard/TicketsPage";
import DisparadorPage from "@/pages/dashboard/DisparadorPage";
import MentoriaPage from "@/pages/dashboard/MentoriaPage";
import EmptyLegsPage from "@/pages/dashboard/EmptyLegsPage";
import AtualizacoesPage from "@/pages/dashboard/AtualizacoesPage";
import CatalogoPage from "@/pages/dashboard/Catalogo";
import CommunityPage from "@/pages/dashboard/CommunityPage";
import PainelAvisoBanner from "@/components/PainelAvisoBanner";
import FullscreenBannerOverlay from "@/components/FullscreenBannerOverlay";

const PAGE_MAP: Record<string, React.ComponentType> = {
  home: HomePage,
  atualizacoes: AtualizacoesPage,
  metricas: MetricasPage,
  abrangencia: MotoristaAbrangenciaPage,
  "transfer/solicitacoes": TransferSolicitacoesPage,
  "transfer/reservas": TransferReservasPage,
  "transfer/contrato": TransferContratoPage,
  "transfer/geolocalizacao": TransferGeolocalizacaoPage,
  "grupos/solicitacoes": GruposSolicitacoesPage,
  "grupos/reservas": GruposReservasPage,
  "grupos/contrato": GruposContratoPage,
  "motoristas/cadastros": MotoristaCadastrosPage,
  "motoristas/agendamentos": MotoristaAgendamentosPage,
  veiculos: VeiculosPage,
  "campanhas/ativos": CampanhasAtivosPage,
  "campanhas/leads": CampanhasLeadsPage,
  "marketing/receptivos": MarketingReceptivosPage,
  "marketing/qrcode": MarketingQRCodePage,
  network: NetworkPage,
  comunidade: CommunityPage,
  google: GooglePage,
  "email-business": EmailBusinessPage,
  website: WebsitePage,
  dominios: DominiosPage,
  anotacoes: AnotacoesPage,
  "sistema/configuracoes": SistemaConfiguracoesPage,
  "sistema/automacoes": SistemaAutomacoesPage,
  "sistema/comunicador": ComunicadorMotoristaExecutivoPage,
  tickets: TicketsPage,
  disparador: DisparadorPage,
  mentoria: MentoriaPage,
  "empty-legs": EmptyLegsPage,
  catalogo: CatalogoPage,
};

function readNetworkSpotlightActive() {
  if (typeof window === "undefined") return false;
  const aceito = localStorage.getItem("network_nacional_aceito") === "sim";
  const highlightShown = localStorage.getItem("network_highlight_shown") === "sim";
  return aceito && !highlightShown;
}

function DashboardContent() {
  usePainelErrorReporter("motorista_executivo", "etp_nav_dashboard");
  const { activePage, setActivePage } = useActivePage();
  const onboarding = useMotoristaOnboarding();
  const { painelMotoristaEvolutionAtivo, ready: painelComunicadorReady } = usePainelMotoristaEvolutionAtivo();
  const mainRef = useRef<HTMLElement>(null);
  useScrollPanelToTop(activePage, mainRef);
  useSlowScrollContainer(mainRef, activePage === "website");
  const [showOverlay, setShowOverlay] = useState(readNetworkSpotlightActive);

  useLayoutEffect(() => {
    syncPanelThemeForCurrentUser("frota");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateNetworkNacionalFromDb();
      if (cancelled) return;
      setShowOverlay(readNetworkSpotlightActive());
      window.dispatchEvent(new Event("network-status-changed"));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      const aceito = localStorage.getItem("network_nacional_aceito") === "sim";
      const highlightShown = localStorage.getItem("network_highlight_shown") === "sim";
      if (aceito && !highlightShown) setShowOverlay(true);
      else setShowOverlay(false);
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

  useEffect(() => {
    if (!painelComunicadorReady) return;
    if (activePage === "sistema/comunicador" && !painelMotoristaEvolutionAtivo) {
      setActivePage("sistema/configuracoes");
    }
  }, [painelComunicadorReady, activePage, painelMotoristaEvolutionAtivo, setActivePage]);

  /** Primeiro acesso: obriga concluir Sistema > Configurações; depois escolher Network na Home. */
  useEffect(() => {
    if (onboarding.loading) return;
    if (!onboarding.phase1Complete && activePage !== "sistema/configuracoes") {
      setActivePage("sistema/configuracoes");
      return;
    }
    if (
      onboarding.phase1Complete &&
      !onboarding.networkChosen &&
      activePage !== "home" &&
      activePage !== "sistema/configuracoes"
    ) {
      setActivePage("home");
    }
  }, [onboarding.loading, onboarding.phase1Complete, onboarding.networkChosen, activePage, setActivePage]);

  const dismissSpotlight = () => {
    setShowOverlay(false);
    localStorage.setItem("network_highlight_shown", "sim");
    void persistNetworkHighlightDismissed();
    window.dispatchEvent(new Event("network-highlight-dismissed"));
  };

  const PageComponent = PAGE_MAP[activePage] || HomePage;

  return (
    <NetworkSpotlightProvider active={showOverlay}>
      <div className="flex min-h-svh w-full max-w-[100vw] overflow-x-hidden">
        <AppSidebar />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {showOverlay && (
            <button
              type="button"
              aria-label="Fechar destaque do menu Network"
              className="absolute inset-0 z-40 animate-fade-in cursor-default border-0 bg-black/60 p-0"
              onClick={dismissSpotlight}
            />
          )}
          <header className="relative z-0 flex h-12 min-h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-2 sm:gap-3 sm:px-4">
            <SidebarTrigger className="shrink-0" />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Shield className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium text-foreground">
                E-Transporte.pro — Gestão de Frota
              </span>
            </div>
          </header>
          <PainelAvisoBanner painel="motorista" activePage={activePage} />
          <main
            ref={mainRef}
            className="relative z-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth bg-background [--main-pad-x:1rem] [--main-pad-y:1rem] px-[var(--main-pad-x)] py-[var(--main-pad-y)] sm:[--main-pad-x:1.5rem] sm:[--main-pad-y:1.5rem]"
          >
            <PageLoader>
              <PageComponent />
            </PageLoader>
          </main>
        </div>
        <FloatingSupportChat />
        <FullscreenBannerOverlay painel="motorista" activePage={activePage} />
      </div>
    </NetworkSpotlightProvider>
  );
}

export default function DashboardLayout() {
  return (
    <ActivePageProvider defaultPage="home" storageKey="etp_nav_dashboard">
      <SidebarProvider>
        <DashboardContent />
      </SidebarProvider>
    </ActivePageProvider>
  );
}
