import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { aplicativoEhDoMotorista, isCapacitorNative, rotaInicialAplicativoMotorista, tokenAplicativoMotoristaGuardado } from "./lib/capacitorFrota";

/** Preserva `?code=` (PKCE) e `#...` ao ir da raiz para `/login` — necessário para links de recuperação de senha. */
function RootToLoginRedirect() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const to = `/login${search}${hash}`;
  return <Navigate to={to} replace />;
}

function DestinoDoAplicativoMotorista() {
  return <Navigate to={rotaInicialAplicativoMotorista(tokenAplicativoMotoristaGuardado(), null)} replace />;
}

/** O aplicativo do motorista não abre o login nem o painel do admin. */
function SomentePainelAdmin({ children }: { children: React.ReactNode }) {
  if (aplicativoEhDoMotorista()) return <DestinoDoAplicativoMotorista />;
  return <>{children}</>;
}
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedFrotaRoute from "./components/ProtectedFrotaRoute";
import { ConfiguracoesProvider } from "./contexts/ConfiguracoesContext";
import AuthExpiryGuard from "./components/AuthExpiryGuard";
import ClientSessionRevocationGuard from "./components/ClientSessionRevocationGuard";
import CapacitorFrotaBridge from "./components/CapacitorFrotaBridge";
import AppLaunchAnimation from "./components/AppLaunchAnimation";

const NotFound = lazy(() => import("./pages/NotFound"));
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const MfaChallengePage = lazy(() => import("./pages/MfaChallenge"));
const RastreioPublico = lazy(() => import("./pages/RastreioPublico"));
const MotoristaFrotaAcessoPage = lazy(() => import("./pages/frota/MotoristaFrotaAcessoPage"));
const AplicativoMotoristaPage = lazy(() => import("./pages/frota/AplicativoMotoristaPage"));
const FrotaMotoristaLayout = lazy(() => import("./components/FrotaMotoristaLayout"));
const VerificarMotoristaPage = lazy(() => import("./pages/VerificarMotoristaPage"));
const MotoristaFrotaDocViewPage = lazy(() => import("./pages/MotoristaFrotaDocViewPage"));
const WebsiteEmbedPage = lazy(() => import("./pages/embed/WebsiteEmbedPage"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      A carregar…
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 60_000,
      retry: 1,
    },
  },
});

function MolduraDoAplicativo({ children }: { children: React.ReactNode }) {
  if (!isCapacitorNative()) return <>{children}</>;
  return (
    <div className="etp-native-frame">
      <div className="etp-native-frame-inner">{children}</div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ConfiguracoesProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <MolduraDoAplicativo>
      <BrowserRouter>
        <AppLaunchAnimation />
        <AuthExpiryGuard />
        <ClientSessionRevocationGuard />
        <CapacitorFrotaBridge />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={aplicativoEhDoMotorista() ? <DestinoDoAplicativoMotorista /> : <RootToLoginRedirect />} />
            <Route path="/login" element={<SomentePainelAdmin><Login /></SomentePainelAdmin>} />
            <Route path="/mfa" element={<SomentePainelAdmin><MfaChallengePage /></SomentePainelAdmin>} />
            <Route path="/aplicativo-motorista" element={<AplicativoMotoristaPage />} />
            <Route path="/motorista-frota-doc" element={<MotoristaFrotaDocViewPage />} />
            <Route path="/rastreio/:token" element={<RastreioPublico />} />
            <Route path="/frota/acesso/:token" element={<MotoristaFrotaAcessoPage />} />
            <Route path="/verificar-motorista/:token?" element={<VerificarMotoristaPage />} />
            <Route path="/embed/website" element={<WebsiteEmbedPage />} />
            <Route path="/frota" element={<ProtectedFrotaRoute><FrotaMotoristaLayout /></ProtectedFrotaRoute>} />
            <Route path="/dashboard" element={<SomentePainelAdmin><ProtectedRoute><DashboardLayout /></ProtectedRoute></SomentePainelAdmin>} />
            <Route path="/admin" element={<SomentePainelAdmin><ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute></SomentePainelAdmin>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </MolduraDoAplicativo>
    </TooltipProvider>
    </ConfiguracoesProvider>
  </QueryClientProvider>
);

export default App;
