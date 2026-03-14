import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TaxiSidebar } from "@/components/TaxiSidebar";
import { Outlet } from "react-router-dom";
import { Car } from "lucide-react";

export default function TaxiDashboardLayout() {
  return (
    <SidebarProvider>
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
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
