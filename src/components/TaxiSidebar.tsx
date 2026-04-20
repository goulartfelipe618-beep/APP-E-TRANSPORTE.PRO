import {
  LayoutDashboard, Home, Activity, MapPin, Car,
  Phone, CheckCircle, Users, Settings, StickyNote,
  Bell, Moon, Sun, LogOut, Globe, ClipboardList,
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
import { usePanelTheme } from "@/hooks/usePanelTheme";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { useActivePage } from "@/contexts/ActivePageContext";

const menuStructure = [
  {
    label: "Principal",
    items: [
      {
        title: "Painel",
        icon: LayoutDashboard,
        children: [
          { title: "Home", page: "home", icon: Home },
          { title: "Métricas", page: "metricas", icon: Activity },
          { title: "Abrangência", page: "abrangencia", icon: MapPin },
        ],
      },
      {
        title: "Taxi",
        icon: Car,
        children: [
          { title: "Chamadas", page: "chamadas", icon: Phone },
          { title: "Atendimentos", page: "atendimentos", icon: CheckCircle },
          { title: "Clientes", page: "clientes", icon: Users },
        ],
      },
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
        ],
      },
      { title: "Comunidade", page: "comunidade", icon: Users },
      { title: "Anotações", page: "anotacoes", icon: StickyNote },
      { title: "Tickets", page: "tickets", icon: ClipboardList },
    ],
  },
];

export function TaxiSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { config } = useConfiguracoes();
  const { activePage, setActivePage } = useActivePage();
  const { darkMode, toggle: toggleTheme } = usePanelTheme("taxi");

  const goPage = (page: string) => {
    setActivePage(page);
    if (isMobile) setOpenMobile(false);
  };

  const isActive = (page: string) => activePage === page;
  const isGroupActive = (children: { page: string }[]) =>
    children.some((c) => activePage === c.page);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="flex shrink-0 items-center gap-3 border-b border-border p-3 sm:p-4">
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
            <p className="truncate text-xs text-muted-foreground">Gestão de Táxi</p>
          </div>
        )}
      </div>

      <SidebarContent>
        {menuStructure.map((group) => (
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
                            <SidebarMenuButton className={cn("w-full min-w-0 justify-between gap-1", groupActive && "text-primary")}>
                              <span className="flex min-w-0 flex-1 items-center gap-2">
                                <item.icon className="h-4 w-4 shrink-0" />
                                {!collapsed && <span className="truncate text-left">{item.title}</span>}
                              </span>
                              {!collapsed && (
                                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                              )}
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.page}>
                                  <SidebarMenuSubButton
                                    onClick={() => goPage(child.page)}
                                    className={cn(
                                      "w-full min-w-0 cursor-pointer text-sm",
                                      isActive(child.page) && "text-primary font-medium",
                                    )}
                                  >
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
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => goPage(page)}
                        className={cn(
                          "cursor-pointer",
                          isActive(page) && "bg-muted text-primary font-medium"
                        )}
                      >
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

      <SidebarFooter className="shrink-0 border-t border-border">
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
