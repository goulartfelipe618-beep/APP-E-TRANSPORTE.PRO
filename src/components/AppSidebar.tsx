import { useState, useEffect } from "react";
import { usePanelTheme } from "@/hooks/usePanelTheme";
import {
  LayoutDashboard, Home, Activity, MapPin, ArrowLeftRight,
  FileText, BookOpen, Map, Users, UserCheck, Handshake,
  ClipboardList, CalendarDays, Car, Megaphone, BarChart3,
  Globe, Search, Mail, Monitor, Settings, StickyNote, Link2,
  Bell, Moon, Sun, LogOut, GraduationCap, Plane,
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

function readNetworkSpotlightHighlight() {
  if (typeof window === "undefined") return false;
  const aceito = localStorage.getItem("network_nacional_aceito") === "sim";
  const highlightShown = localStorage.getItem("network_highlight_shown") === "sim";
  return aceito && !highlightShown;
}

const getMenuStructure = (showNetwork: boolean, exibirComunicadorMotorista: boolean) => [
  {
    label: "Principal",
    items: [
      {
        title: "Painel",
        icon: LayoutDashboard,
        children: [
          { title: "Home", page: "home", icon: Home },
          { title: "Abrangência", page: "abrangencia", icon: MapPin },
          { title: "Atualizações", page: "atualizacoes", icon: Bell },
          { title: "Métricas", page: "metricas", icon: Activity },
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
        children: [
          { title: "Cadastros", page: "motoristas/cadastros", icon: UserCheck },
          { title: "Parcerias", page: "motoristas/parcerias", icon: Handshake },
          { title: "Solicitações", page: "motoristas/solicitacoes", icon: ClipboardList },
        ],
      },
      { title: "Veículos", page: "veiculos", icon: Car },
      { title: "Empty Legs", page: "empty-legs", icon: Plane },
      { title: "Mentoria", page: "mentoria", icon: GraduationCap },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      {
        title: "Campanhas",
        icon: Megaphone,
        children: [
          { title: "Ativos", page: "campanhas/ativos", icon: Globe },
          { title: "Leads", page: "campanhas/leads", icon: UserCheck },
        ],
      },
      { title: "Geolocalização", page: "transfer/geolocalizacao", icon: Map },
      { title: "Receptivos", page: "marketing/receptivos", icon: Globe },
      { title: "QR Codes", page: "marketing/qrcode", icon: Search },
      ...(showNetwork ? [{ title: "Network", page: "network", icon: Globe }] : []),
      { title: "Comunidade", page: "comunidade", icon: Users },
      { title: "E-mail Business", page: "email-business", icon: Mail },
      { title: "Website", page: "website", icon: Monitor },
      { title: "Domínios", page: "dominios", icon: Link2 },
      { title: "Google Maps", page: "google", icon: Search },
      { title: "Disparador", page: "disparador", icon: Megaphone },
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
  const handleNavigate = (page: string) => {
    setActivePage(page);
    if (isMobile) {
      setOpenMobile(false);
    }
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
          "p-4 flex items-center gap-3 border-b border-border",
          showNetworkHighlight && "relative z-30 opacity-40",
        )}
      >
        {config.logo_url ? (
          <img src={config.logo_url} alt="Logo" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <Car className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-foreground">{config.nome_projeto}</p>
            <p className="text-xs text-muted-foreground">Gestão de Frota</p>
          </div>
        )}
      </div>

      <SidebarContent className={cn(showNetworkHighlight && "relative z-30")}>
        {getMenuStructure(networkAceito, exibirComunicadorMotorista).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
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
                            <SidebarMenuButton className={cn("w-full justify-between", groupActive && "text-primary")}>
                              <span className="flex items-center gap-2">
                                <item.icon className="h-4 w-4" />
                                {!collapsed && <span>{item.title}</span>}
                              </span>
                              {!collapsed && <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />}
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.page}>
                                  <SidebarMenuSubButton
                                    onClick={() => handleNavigate(child.page)}
                                    className={cn(
                                      "text-sm cursor-pointer w-full",
                                      isActive(child.page) && "text-primary font-medium"
                                    )}
                                  >
                                    <child.icon className="h-3.5 w-3.5 mr-2" />
                                    {child.title}
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
                  const isBetaMenu = page === "google" || page === "disparador";
                  const dimFlat = showNetworkHighlight && !isNetworkItem;
                  return (
                    <SidebarMenuItem
                      key={item.title}
                      className={cn(
                        "relative",
                        dimFlat && "opacity-40",
                        isNetworkItem && showNetworkHighlight && "z-40 opacity-100",
                        isBetaMenu && collapsed && "pt-3",
                      )}
                    >
                      {isBetaMenu && collapsed && (
                        <span
                          className="absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded bg-amber-500 px-1 py-0.5 text-[7px] font-bold uppercase leading-none tracking-wide text-white shadow-sm"
                          aria-hidden
                        >
                          BETA
                        </span>
                      )}
                      <div className={cn("flex w-full flex-col", isBetaMenu && !collapsed && "gap-0.5")}>
                        {isBetaMenu && !collapsed && (
                          <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500">
                            BETA
                          </span>
                        )}
                        <SidebarMenuButton
                          onClick={() => handleNavigate(page)}
                          title={isBetaMenu ? `${item.title} (BETA)` : undefined}
                          className={cn(
                            "cursor-pointer",
                            isActive(page) && "bg-muted text-primary font-medium",
                            isNetworkItem &&
                              showNetworkHighlight &&
                              "bg-sidebar text-foreground ring-2 ring-primary shadow-md rounded-md",
                          )}
                        >
                          <item.icon className="h-4 w-4 mr-2" />
                          {!collapsed && <span>{item.title}</span>}
                        </SidebarMenuButton>
                      </div>
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
            "fixed z-[100] max-h-[min(24rem,calc(100vh-2rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 text-neutral-900 shadow-2xl animate-fade-in",
            collapsed ? "left-[3.75rem] top-[22%]" : "left-[calc(var(--sidebar-width)+0.75rem)] top-[22%]",
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
          "border-t border-border",
          showNetworkHighlight && "relative z-30 opacity-40",
        )}
      >
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-full">
              <Bell className="h-4 w-4 mr-2" />
              {!collapsed && <span>Notificações</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-full" onClick={() => void toggleTheme()}>
              {darkMode ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {!collapsed && <span>{darkMode ? "Modo Claro" : "Modo Escuro"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
