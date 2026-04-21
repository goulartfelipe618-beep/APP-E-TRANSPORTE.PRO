import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedTaxiRoute from "./components/ProtectedTaxiRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { ConfiguracoesProvider } from "./contexts/ConfiguracoesContext";
import AuthExpiryGuard from "./components/AuthExpiryGuard";
import ClientSessionRevocationGuard from "./components/ClientSessionRevocationGuard";

const NotFound = lazy(() => import("./pages/NotFound"));
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const TaxiDashboardLayout = lazy(() => import("./components/TaxiDashboardLayout"));
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const MfaChallengePage = lazy(() => import("./pages/MfaChallenge"));
const RastreioPublico = lazy(() => import("./pages/RastreioPublico"));

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
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/mfa" element={<MfaChallengePage />} />
            <Route path="/rastreio/:token" element={<RastreioPublico />} />
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
