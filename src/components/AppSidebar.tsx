import { useState, useEffect } from "react";
import {
  LayoutDashboard, Home, Activity, MapPin, ArrowLeftRight,
  FileText, BookOpen, Map, Users, UserCheck, Handshake,
  ClipboardList, CalendarDays, Car, Megaphone, BarChart3,
  Globe, Search, Mail, Monitor, Settings, StickyNote,
  Bell, Moon, LogOut, GraduationCap, Plane,
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

const getMenuStructure = (showNetwork: boolean) => [
  {
    label: "Principal",
    items: [
      {
        title: "Painel",
        icon: LayoutDashboard,
        children: [
          { title: "Home", page: "home", icon: Home },
          { title: "Atualizações", page: "atualizacoes", icon: Bell },
          { title: "Métricas", page: "metricas", icon: Activity },
          { title: "Abrangência", page: "abrangencia", icon: MapPin },
        ],
      },
      {
        title: "Transfer",
        icon: ArrowLeftRight,
        children: [
          { title: "Solicitações", page: "transfer/solicitacoes", icon: FileText },
          { title: "Reservas", page: "transfer/reservas", icon: BookOpen },
          { title: "Contrato", page: "transfer/contrato", icon: ClipboardList },
          { title: "Geolocalização", page: "transfer/geolocalizacao", icon: Map },
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
    ],
  },
  {
    label: "Marketing",
    items: [
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
      { title: "Google", page: "google", icon: Search },
      { title: "E-mail Business", page: "email-business", icon: Mail },
      { title: "Website", page: "website", icon: Monitor },
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
          { title: "Comunicador", page: "sistema/comunicador", icon: Monitor },
        ],
      },
      { title: "Anotações", page: "anotacoes", icon: StickyNote },
      { title: "Tickets", page: "tickets", icon: ClipboardList },
    ],
  },
  {
    label: "Capacitação",
    items: [
      { title: "Mentoria", page: "mentoria", icon: GraduationCap },
    ],
  },
  {
    label: "Viagens Aéreas",
    items: [
      { title: "Empty Legs", page: "empty-legs", icon: Plane },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { config } = useConfiguracoes();
  const { activePage, setActivePage } = useActivePage();
  const [networkAceito, setNetworkAceito] = useState(() => localStorage.getItem("network_nacional_aceito") === "sim");
  const [showNetworkHighlight, setShowNetworkHighlight] = useState(false);

  useEffect(() => {
    const handler = () => {
      const aceito = localStorage.getItem("network_nacional_aceito") === "sim";
      const highlightShown = localStorage.getItem("network_highlight_shown") === "sim";
      setNetworkAceito(aceito);
      if (aceito && !highlightShown) setShowNetworkHighlight(true);
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

  const isActive = (page: string) => activePage === page;
  const isGroupActive = (children: { page: string }[]) =>
    children.some((c) => activePage === c.page);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="p-4 flex items-center gap-3 border-b border-border">
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

      <SidebarContent>
        {getMenuStructure(networkAceito).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  if ("children" in item && item.children && item.children.length > 0) {
                    const groupActive = isGroupActive(item.children);
                    return (
                      <Collapsible key={item.title} defaultOpen={groupActive}>
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
                                    onClick={() => setActivePage(child.page)}
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
                  return (
                    <SidebarMenuItem key={item.title} className="relative">
                      <SidebarMenuButton
                        onClick={() => setActivePage(page)}
                        className={cn(
                          "cursor-pointer",
                          isActive(page) && "bg-muted text-primary font-medium",
                          isNetworkItem && showNetworkHighlight && "relative z-[60] bg-primary/20 ring-2 ring-primary rounded-md animate-pulse"
                        )}
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        {!collapsed && <span>{item.title}</span>}
                      </SidebarMenuButton>
                      {isNetworkItem && showNetworkHighlight && !collapsed && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[70] animate-fade-in">
                          <div className="relative bg-card text-card-foreground border border-border rounded-xl shadow-2xl px-5 py-4 w-64">
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-border" />
                            <p className="text-sm font-bold mb-1">🎉 Menu Network Liberado!</p>
                            <p className="text-xs text-muted-foreground mb-3">
                              Agora você faz parte do Network Nacional. Acesse aqui para ver empresas atribuídas a você.
                            </p>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowNetworkHighlight(false);
                                localStorage.setItem("network_highlight_shown", "sim");
                                window.dispatchEvent(new Event("network-highlight-dismissed"));
                              }}
                              className="w-full bg-primary text-primary-foreground text-sm font-semibold py-2 rounded-lg hover:opacity-90 transition-opacity"
                            >
                              OK, Entendi!
                            </button>
                          </div>
                        </div>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-full">
              <Bell className="h-4 w-4 mr-2" />
              {!collapsed && <span>Notificações</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-full">
              <Moon className="h-4 w-4 mr-2" />
              {!collapsed && <span>Modo Escuro</span>}
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
