import {
  LayoutDashboard, Home, Activity, MapPin, Car,
  Phone, CheckCircle, Users, Settings, StickyNote,
  Bell, Moon, LogOut, Globe, Monitor,
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
          { title: "Comunicador", page: "sistema/comunicador", icon: Monitor },
        ],
      },
      { title: "Anotações", page: "anotacoes", icon: StickyNote },
      { title: "Tickets", page: "tickets", icon: ClipboardList },
    ],
  },
];

export function TaxiSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { config } = useConfiguracoes();
  const { activePage, setActivePage } = useActivePage();

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
            <p className="text-xs text-muted-foreground">Gestão de Táxi</p>
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
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => setActivePage(page)}
                        className={cn(
                          "cursor-pointer",
                          isActive(page) && "bg-muted text-primary font-medium"
                        )}
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        {!collapsed && <span>{item.title}</span>}
                      </SidebarMenuButton>
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
