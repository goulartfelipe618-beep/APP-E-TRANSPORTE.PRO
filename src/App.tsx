import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./components/DashboardLayout";
import TaxiDashboardLayout from "./components/TaxiDashboardLayout";
import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedTaxiRoute from "./components/ProtectedTaxiRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { ConfiguracoesProvider } from "./contexts/ConfiguracoesContext";
import MfaChallengePage from "./pages/MfaChallenge";
import AuthExpiryGuard from "./components/AuthExpiryGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ConfiguracoesProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthExpiryGuard />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/mfa" element={<MfaChallengePage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
          <Route path="/taxi" element={<ProtectedTaxiRoute><TaxiDashboardLayout /></ProtectedTaxiRoute>} />
          <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ConfiguracoesProvider>
  </QueryClientProvider>
);

export default App;
