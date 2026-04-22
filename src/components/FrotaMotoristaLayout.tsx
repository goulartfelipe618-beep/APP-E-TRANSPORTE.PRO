import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ClipboardList, LogOut, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
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

        <nav className="flex flex-1 flex-col gap-1 p-2">
          <button
            type="button"
            onClick={() => setActive("agenda")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
              active === "agenda" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            Agenda
          </button>
          <button
            type="button"
            onClick={() => setActive("reservas")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
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
            className="w-full justify-start gap-2"
            onClick={() => setDark((d) => !d)}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {dark ? "Modo claro" : "Modo escuro"}
          </Button>
          <Button type="button" variant="ghost" className="w-full justify-start gap-2 text-destructive" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="min-h-screen flex-1 overflow-auto p-4 sm:p-6">
        {active === "agenda" ? <FrotaAgendaPage /> : <FrotaReservasPage />}
      </main>
    </div>
  );
}
