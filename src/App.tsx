import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./components/DashboardLayout";
import HomePage from "./pages/dashboard/Home";
import MetricasPage from "./pages/dashboard/Metricas";
import TransferSolicitacoesPage from "./pages/dashboard/TransferSolicitacoes";
import TransferReservasPage from "./pages/dashboard/TransferReservas";
import TransferContratoPage from "./pages/dashboard/TransferContrato";
import TransferGeolocalizacaoPage from "./pages/dashboard/TransferGeolocalizacao";
import GruposSolicitacoesPage from "./pages/dashboard/GruposSolicitacoes";
import GruposReservasPage from "./pages/dashboard/GruposReservas";
import GruposContratoPage from "./pages/dashboard/GruposContrato";
import VeiculosPage from "./pages/dashboard/Veiculos";
import PlaceholderPage from "./pages/dashboard/Placeholder";
import MotoristaCadastrosPage from "./pages/dashboard/MotoristaCadastros";
import MotoristaParceriasPage from "./pages/dashboard/MotoristaParcerias";
import MotoristaSolicitacoesPage from "./pages/dashboard/MotoristaSolicitacoes";
import MotoristaAgendamentosPage from "./pages/dashboard/MotoristaAgendamentos";
import CampanhasAtivosPage from "./pages/dashboard/CampanhasAtivos";
import CampanhasLeadsPage from "./pages/dashboard/CampanhasLeads";
import MarketingReceptivosPage from "./pages/dashboard/MarketingReceptivos";
import MarketingQRCodePage from "./pages/dashboard/MarketingQRCode";
import NetworkPage from "./pages/dashboard/NetworkPage";
import GooglePage from "./pages/dashboard/GooglePage";
import EmailBusinessPage from "./pages/dashboard/EmailBusinessPage";
import WebsitePage from "./pages/dashboard/WebsitePage";
import AnotacoesPage from "./pages/dashboard/AnotacoesPage";
import SistemaConfiguracoesPage from "./pages/dashboard/SistemaConfiguracoes";
import SistemaAutomacoesPage from "./pages/dashboard/SistemaAutomacoes";
import SistemaComunicadorPage from "./pages/dashboard/SistemaComunicador";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<HomePage />} />
            <Route path="metricas" element={<MetricasPage />} />
            <Route path="abrangencia" element={<PlaceholderPage />} />
            <Route path="transfer/solicitacoes" element={<TransferSolicitacoesPage />} />
            <Route path="transfer/reservas" element={<TransferReservasPage />} />
            <Route path="transfer/contrato" element={<TransferContratoPage />} />
            <Route path="transfer/geolocalizacao" element={<TransferGeolocalizacaoPage />} />
            <Route path="grupos/solicitacoes" element={<GruposSolicitacoesPage />} />
            <Route path="grupos/reservas" element={<GruposReservasPage />} />
            <Route path="grupos/contrato" element={<GruposContratoPage />} />
            <Route path="motoristas/cadastros" element={<MotoristaCadastrosPage />} />
            <Route path="motoristas/parcerias" element={<MotoristaParceriasPage />} />
            <Route path="motoristas/solicitacoes" element={<MotoristaSolicitacoesPage />} />
            <Route path="motoristas/agendamentos" element={<MotoristaAgendamentosPage />} />
            <Route path="veiculos" element={<VeiculosPage />} />
            <Route path="campanhas/ativos" element={<CampanhasAtivosPage />} />
            <Route path="campanhas/leads" element={<CampanhasLeadsPage />} />
            <Route path="marketing/receptivos" element={<MarketingReceptivosPage />} />
            <Route path="marketing/qrcode" element={<MarketingQRCodePage />} />
            <Route path="network" element={<NetworkPage />} />
            <Route path="google" element={<GooglePage />} />
            <Route path="email-business" element={<EmailBusinessPage />} />
            <Route path="website" element={<WebsitePage />} />
            <Route path="anotacoes" element={<AnotacoesPage />} />
            <Route path="sistema/configuracoes" element={<SistemaConfiguracoesPage />} />
            <Route path="sistema/automacoes" element={<SistemaAutomacoesPage />} />
            <Route path="sistema/comunicador" element={<SistemaComunicadorPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
