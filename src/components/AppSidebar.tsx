import { useState, useEffect } from "react";
import { usePanelTheme } from "@/hooks/usePanelTheme";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Home, Activity, MapPin, ArrowLeftRight,
  FileText, BookOpen, Map, Users, UserCheck,
  ClipboardList, Car, Megaphone, BarChart3,
  Globe, Search, Mail, Monitor, Settings, StickyNote, Link2,
  Bell, Moon, Sun, LogOut, GraduationCap, Plane, Calendar,
  Wallet2,
  List,
  Inbox,
  Banknote,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { useActivePage } from "@/contexts/ActivePageContext";
import { persistNetworkHighlightDismissed } from "@/lib/networkNacionalPrefs";
import { usePainelMotoristaEvolutionAtivo } from "@/hooks/usePainelMotoristaEvolutionAtivo";
import { useUserPlan } from "@/hooks/useUserPlan";
import { isFrotaFreePage } from "@/lib/frotaPlanFreePages";

function ProBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-amber-800 dark:text-amber-300">
      PRÓ
    </span>
  );
}

/** Páginas onde não exibimos o badge PRÓ ao lado do item (plano FREE). */
const PAGINAS_SEM_BADGE_PRO = new Set<string>([
  "transfer/geolocalizacao",
  "disparador",
  "sistema/comunicador",
  "network",
  "campanhas/ativos",
  "campanhas/leads",
]);

function readNetworkSpotlightHighlight() {
  if (typeof window === "undefined") return false;
  const aceito = localStorage.getItem("network_nacional_aceito") === "sim";
  const highlightShown = localStorage.getItem("network_highlight_shown") === "sim";
  return aceito && !highlightShown;
}

type MenuGroup = {
  label: string;
  /** Legenda em destaque amarelo (ex.: BETA), alinhada a Principal / Ferramentas. */
  labelTone?: "beta";
  items: Array<
    | { title: string; icon: LucideIcon; children: Array<{ title: string; page: string; icon: LucideIcon }> }
    | { title: string; page: string; icon: LucideIcon }
  >;
};

const getMenuStructure = (showNetwork: boolean, exibirComunicadorMotorista: boolean): MenuGroup[] => [
  {
    label: "Principal",
    items: [
      {
        title: "Painel",
        icon: LayoutDashboard,
        children: [
          { title: "Home", page: "home", icon: Home },
          { title: "Abrangência", page: "abrangencia", icon: MapPin },
          { title: "Agenda", page: "agenda", icon: Calendar },
          { title: "Atualizações", page: "atualizacoes", icon: Bell },
          { title: "Métricas", page: "metricas", icon: Activity },
        ],
      },
      {
        title: "Financeiro",
        icon: Wallet2,
        children: [
          { title: "Dashboard", page: "financeiro", icon: Wallet2 },
          { title: "Lançamentos", page: "financeiro/lancamentos", icon: List },
          { title: "Contas a receber", page: "financeiro/receber", icon: Inbox },
          { title: "Contas a pagar", page: "financeiro/pagar", icon: Banknote },
          { title: "Relatórios", page: "financeiro/relatorios", icon: BarChart3 },
        ],
      },
      {
        title: "Transfer",
        icon: ArrowLeftRight,
        children: [
          { title: "Solicitações", page: "transfer/solicitacoes", icon: FileText },
          { title: "Reservas", page: "transfer/reservas", icon: BookOpen },
          { title: "Contrato", page: "transfer/contrato", icon: ClipboardList },
        ],
      },
      {
        title: "Grupos",
        icon: Users,
        children: [
          { title: "Solicitações", page: "grupos/solicitacoes", icon: FileText },
          { title: "Reservas", page: "grupos/reservas", icon: BookOpen },
          { title: "Contrato", page: "grupos/contrato", icon: ClipboardList },
        ],
      },
      {
        title: "Motoristas",
        icon: UserCheck,
        children: [{ title: "Cadastros", page: "motoristas/cadastros", icon: UserCheck }],
      },
      { title: "Veículos", page: "veiculos", icon: Car },
      { title: "Mentoria", page: "mentoria", icon: GraduationCap },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { title: "Geolocalização", page: "transfer/geolocalizacao", icon: Map },
      {
        title: "Campanhas",
        icon: Megaphone,
        children: [
          { title: "Ativos", page: "campanhas/ativos", icon: Globe },
          { title: "Leads", page: "campanhas/leads", icon: UserCheck },
        ],
      },
      { title: "Receptivos", page: "marketing/receptivos", icon: Globe },
      { title: "QR Codes", page: "marketing/qrcode", icon: Search },
      ...(showNetwork ? [{ title: "Network", page: "network", icon: Globe }] : []),
      { title: "Comunidade", page: "comunidade", icon: Users },
      { title: "E-mail Business", page: "email-business", icon: Mail },
      { title: "Website", page: "website", icon: Monitor },
      { title: "Domínios", page: "dominios", icon: Link2 },
    ],
  },
  {
    label: "Beta",
    labelTone: "beta",
    items: [
      { title: "Disparador", page: "disparador", icon: Megaphone },
      { title: "Catálogo", page: "catalogo", icon: BookOpen },
      { title: "Google Maps", page: "google", icon: MapPin },
      { title: "Empty Legs", page: "empty-legs", icon: Plane },
    ],
  },
  {
    label: "Configurações",
    items: [
      {
        title: "Sistema",
        icon: Settings,
        children: [
          { title: "Configurações", page: "sistema/configuracoes", icon: Settings },
          { title: "Automações", page: "sistema/automacoes", icon: Globe },
          ...(exibirComunicadorMotorista
            ? [{ title: "Comunicador", page: "sistema/comunicador", icon: Monitor }]
            : []),
        ],
      },
      { title: "Anotações", page: "anotacoes", icon: StickyNote },
      { title: "Tickets", page: "tickets", icon: ClipboardList },
    ],
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { config } = useConfiguracoes();
  const { activePage, setActivePage } = useActivePage();
  const { darkMode, toggle: toggleTheme } = usePanelTheme("frota");
  const [networkAceito, setNetworkAceito] = useState(() => localStorage.getItem("network_nacional_aceito") === "sim");
  const [showNetworkHighlight, setShowNetworkHighlight] = useState(readNetworkSpotlightHighlight);
  const { painelMotoristaEvolutionAtivo, ready: painelComunicadorReady } = usePainelMotoristaEvolutionAtivo();
  const exibirComunicadorMotorista = !painelComunicadorReady || painelMotoristaEvolutionAtivo;
  const { plano, loading: planLoading } = useUserPlan();
  const freeRestricted = !planLoading && plano === "free";
  const proOnly = (page: string) => !isFrotaFreePage(page);
  const mostrarBadgePro = (page: string) =>
    freeRestricted && proOnly(page) && !PAGINAS_SEM_BADGE_PRO.has(page);
  const groupHasProOnlyChild = (children: { page: string }[]) =>
    children.some((c) => proOnly(c.page) && !PAGINAS_SEM_BADGE_PRO.has(c.page));

  useEffect(() => {
    const handler = () => {
      const aceito = localStorage.getItem("network_nacional_aceito") === "sim";
      const highlightShown = localStorage.getItem("network_highlight_shown") === "sim";
      setNetworkAceito(aceito);
      setShowNetworkHighlight(aceito && !highlightShown);
    };
    const dismissHandler = () => setShowNetworkHighlight(false);
    window.addEventListener("network-status-changed", handler);
    window.addEventListener("network-highlight-dismissed", dismissHandler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("network-status-changed", handler);
      window.removeEventListener("network-highlight-dismissed", dismissHandler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const dismissNetworkSpotlight = () => {
    setShowNetworkHighlight(false);
    localStorage.setItem("network_highlight_shown", "sim");
    void persistNetworkHighlightDismissed();
    window.dispatchEvent(new Event("network-highlight-dismissed"));
  };

  const isActive = (page: string) => activePage === page;
  const isGroupActive = (children: { page: string }[]) =>
    children.some((c) => activePage === c.page);
  const goPage = (page: string) => {
    setActivePage(page);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const tryNavigate = (page: string) => {
    goPage(page);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <Sidebar
      collapsible="icon"
      className={cn("border-r border-border", showNetworkHighlight && "relative z-50")}
    >
      <div
        className={cn(
          "flex shrink-0 items-center gap-3 border-b border-border p-3 sm:p-4",
          showNetworkHighlight && "relative z-30 opacity-40",
        )}
      >
        {config.logo_url ? (
          <img src={config.logo_url} alt="Logo" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
            <Car className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{config.nome_projeto}</p>
            <p className="truncate text-xs text-muted-foreground">Gestão de Frota</p>
          </div>
        )}
      </div>

      <SidebarContent className={cn(showNetworkHighlight && "relative z-30")}>
        {getMenuStructure(networkAceito, exibirComunicadorMotorista).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel
              className={cn(
                group.labelTone === "beta" &&
                  "font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400",
              )}
            >
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  if ("children" in item && item.children && item.children.length > 0) {
                    const groupActive = isGroupActive(item.children);
                    return (
                      <Collapsible
                        key={item.title}
                        defaultOpen={groupActive}
                        className={cn(showNetworkHighlight && "opacity-40")}
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              className={cn("w-full", groupActive && "text-primary")}
                            >
                              <div className="flex w-full min-w-0 items-center justify-between gap-1">
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                  <item.icon className="h-4 w-4 shrink-0" />
                                  {freeRestricted && groupHasProOnlyChild(item.children) ? (
                                    <span className="shrink-0">
                                      <ProBadge />
                                    </span>
                                  ) : null}
                                  {!collapsed && (
                                    <span className="truncate text-left">{item.title}</span>
                                  )}
                                </span>
                                <span className="flex shrink-0 items-center gap-0.5">
                                  {!collapsed && (
                                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                  )}
                                </span>
                              </div>
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.page}>
                                  <SidebarMenuSubButton
                                    onClick={() => tryNavigate(child.page)}
                                    className={cn(
                                      "text-sm cursor-pointer w-full",
                                      isActive(child.page) && "text-primary font-medium"
                                    )}
                                  >
                                    {mostrarBadgePro(child.page) ? (
                                      <span className="mr-1.5 shrink-0">
                                        <ProBadge />
                                      </span>
                                    ) : null}
                                    <child.icon className="mr-2 h-3.5 w-3.5 shrink-0" />
                                    <span className="min-w-0 truncate">{child.title}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  const page = (item as { page: string }).page;
                  const isNetworkItem = item.title === "Network";
                  const dimFlat = showNetworkHighlight && !isNetworkItem;
                  return (
                    <SidebarMenuItem
                      key={item.title}
                      className={cn(
                        "relative",
                        dimFlat && "opacity-40",
                        isNetworkItem && showNetworkHighlight && "z-40 opacity-100",
                      )}
                    >
                      <SidebarMenuButton
                        onClick={() => tryNavigate(page)}
                        className={cn(
                          "cursor-pointer",
                          isActive(page) && "bg-muted text-primary font-medium",
                          isNetworkItem &&
                            showNetworkHighlight &&
                            "bg-sidebar text-foreground ring-2 ring-primary shadow-md rounded-md",
                        )}
                      >
                        {mostrarBadgePro(page) ? (
                          <span className="mr-1.5 shrink-0">
                            <ProBadge />
                          </span>
                        ) : null}
                        <item.icon className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span className="min-w-0 truncate">{item.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {showNetworkHighlight && (
        <div
          className={cn(
            "fixed z-[100] mx-auto max-h-[min(24rem,calc(100dvh-2rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-2xl animate-fade-in sm:p-5",
            "inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] max-w-lg lg:mx-0 lg:max-w-[min(22rem,calc(100vw-1.5rem))]",
            collapsed ? "lg:left-[3.75rem] lg:right-auto lg:top-[22%]" : "lg:left-[calc(var(--sidebar-width)+0.75rem)] lg:right-auto lg:top-[22%]",
          )}
          role="dialog"
          aria-labelledby="network-spotlight-title"
        >
          <p id="network-spotlight-title" className="text-base font-bold text-neutral-900 mb-2">
            Menu Network liberado
          </p>
          <p className="text-sm text-neutral-700 leading-relaxed mb-4">
            O item <strong className="text-neutral-900">Network</strong> foi adicionado ao seu painel porque você aceitou os termos do{" "}
            <strong className="text-neutral-900">Network Nacional E-Transporte.pro</strong>. Use este canal para publicar e acompanhar
            oportunidades de viagens compartilhadas com os outros motoristas da plataforma.
          </p>
          <button
            type="button"
            onClick={dismissNetworkSpotlight}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            OK, entendi
          </button>
        </div>
      )}

      <SidebarFooter
        className={cn(
          "shrink-0 border-t border-border",
          showNetworkHighlight && "relative z-30 opacity-40",
        )}
      >
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-full min-w-0">
              <Bell className="mr-2 h-4 w-4 shrink-0" />
              {!collapsed && <span className="min-w-0 truncate">Notificações</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-full min-w-0" onClick={() => void toggleTheme()}>
              {darkMode ? <Sun className="mr-2 h-4 w-4 shrink-0" /> : <Moon className="mr-2 h-4 w-4 shrink-0" />}
              {!collapsed && (
                <span className="min-w-0 truncate">{darkMode ? "Modo Claro" : "Modo Escuro"}</span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-full min-w-0" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4 shrink-0" />
              {!collapsed && <span className="min-w-0 truncate">Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
