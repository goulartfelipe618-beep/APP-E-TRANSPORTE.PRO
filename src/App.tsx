import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";

/** Preserva `?code=` (PKCE) e `#...` ao ir da raiz para `/login` — necessário para links de recuperação de senha. */
function RootToLoginRedirect() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const to = `/login${search}${hash}`;
  return <Navigate to={to} replace />;
}
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedTaxiRoute from "./components/ProtectedTaxiRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedFrotaRoute from "./components/ProtectedFrotaRoute";
import { ConfiguracoesProvider } from "./contexts/ConfiguracoesContext";
import AuthExpiryGuard from "./components/AuthExpiryGuard";
import ClientSessionRevocationGuard from "./components/ClientSessionRevocationGuard";

const NotFound = lazy(() => import("./pages/NotFound"));
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const TaxiDashboardLayout = lazy(() => import("./components/TaxiDashboardLayout"));
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const MfaChallengePage = lazy(() => import("./pages/MfaChallenge"));
const RastreioPublico = lazy(() => import("./pages/RastreioPublico"));
const MotoristaFrotaAcessoPage = lazy(() => import("./pages/frota/MotoristaFrotaAcessoPage"));
const FrotaMotoristaLayout = lazy(() => import("./components/FrotaMotoristaLayout"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      A carregar…
    </div>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ConfiguracoesProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthExpiryGuard />
        <ClientSessionRevocationGuard />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<RootToLoginRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/mfa" element={<MfaChallengePage />} />
            <Route path="/rastreio/:token" element={<RastreioPublico />} />
            <Route path="/frota/acesso/:token" element={<MotoristaFrotaAcessoPage />} />
            <Route path="/frota" element={<ProtectedFrotaRoute><FrotaMotoristaLayout /></ProtectedFrotaRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
            <Route path="/taxi" element={<ProtectedTaxiRoute><TaxiDashboardLayout /></ProtectedTaxiRoute>} />
            <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
    </ConfiguracoesProvider>
  </QueryClientProvider>
);

export default App;
