import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ClipboardList, LogOut, Menu, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  applyDocumentClassDark,
  readPanelThemePref,
  writePanelThemePref,
  syncPanelThemeForCurrentUser,
} from "@/lib/panelTheme";
import { getPersistedSupabaseUserId } from "@/lib/supabaseSessionUser";
import FrotaAgendaPage from "@/pages/frota/FrotaAgendaPage";
import FrotaReservasPage from "@/pages/frota/FrotaReservasPage";

type FrotaPage = "agenda" | "reservas";

export default function FrotaMotoristaLayout() {
  const [active, setActive] = useState<FrotaPage>("agenda");
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [nomeProjeto, setNomeProjeto] = useState<string>("");
  const [dark, setDark] = useState(false);

  const uid = getPersistedSupabaseUserId();

  const loadBranding = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_frota_motorista_branding");
    if (error || !data?.length) {
      setLogoUrl(null);
      setNomeProjeto("");
      return;
    }
    const row = data[0] as { logo_url?: string; nome_projeto?: string; motorista_nome?: string };
    setLogoUrl(row.logo_url || null);
    setNomeProjeto(row.nome_projeto || "Frota");
  }, []);

  useEffect(() => {
    syncPanelThemeForCurrentUser("frota");
    if (uid) setDark(readPanelThemePref("frota", uid));
  }, [uid]);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  useEffect(() => {
    applyDocumentClassDark(dark);
    if (uid) writePanelThemePref("frota", uid, dark);
  }, [dark, uid]);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex, nofollow, noarchive");
    meta.setAttribute("data-frota-layout", "1");
    document.head.appendChild(meta);
    return () => {
      document.querySelector('meta[data-frota-layout="1"]')?.remove();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const go = (page: FrotaPage) => {
    setActive(page);
    setMenuOpen(false);
  };

  const BrandBlock = ({ compact }: { compact?: boolean }) => (
    <div className={cn("flex items-center gap-2 border-b border-border", compact ? "px-3 py-3" : "px-4 py-4")}>
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          M
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{nomeProjeto || "Motorista"}</p>
        <p className="truncate text-xs text-muted-foreground">Área do motorista</p>
      </div>
    </div>
  );

  const NavButtons = ({ onNavigate }: { onNavigate: (p: FrotaPage) => void }) => (
    <>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        <button
          type="button"
          onClick={() => onNavigate("agenda")}
          className={cn(
            "flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
            active === "agenda" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60",
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0" />
          Agenda
        </button>
        <button
          type="button"
          onClick={() => onNavigate("reservas")}
          className={cn(
            "flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
            active === "reservas" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60",
          )}
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
          Reservas
        </button>
      </nav>

      <div className="border-t border-border p-2 space-y-1">
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-start gap-2"
          onClick={() => setDark((d) => !d)}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? "Modo claro" : "Modo escuro"}
        </Button>
        <Button type="button" variant="ghost" className="h-11 w-full justify-start gap-2 text-destructive" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen min-h-[100dvh] w-full flex-col bg-background text-foreground md:flex-row">
      {/* Barra superior — telemóvel */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden">
        <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{nomeProjeto || "Motorista"}</p>
          <p className="truncate text-xs text-muted-foreground">{active === "agenda" ? "Agenda" : "Reservas"}</p>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-[min(100vw-1rem,280px)] flex-col gap-0 overflow-y-auto p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <BrandBlock compact />
          <NavButtons onNavigate={go} />
        </SheetContent>
      </Sheet>

      {/* Sidebar — desktop */}
      <aside className="hidden w-[min(100vw,260px)] shrink-0 flex-col border-r border-border bg-card md:flex lg:w-[280px]">
        <BrandBlock />
        <NavButtons onNavigate={go} />
      </aside>

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:p-6">
        {active === "agenda" ? <FrotaAgendaPage /> : <FrotaReservasPage />}
      </main>
    </div>
  );
}
