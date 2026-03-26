import {
  Home, SlidersHorizontal, LogOut, Shield, BarChart3, MapPin, FileText, ChevronDown, Users, ClipboardList, Building2, LayoutTemplate, Bell, Moon, Sun, Settings, StickyNote, MessageSquare, Zap, GraduationCap, Plane,
} from "lucide-react";
import { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils";
import { useActivePage } from "@/contexts/ActivePageContext";

const simpleItems = [
  { title: "Home", page: "home", icon: Home },
  { title: "Métricas", page: "metricas", icon: BarChart3 },
  { title: "Abrangência", page: "abrangencia", icon: MapPin },
  { title: "Landing Page", page: "landing-page", icon: ClipboardList },
  { title: "Slides", page: "slides", icon: SlidersHorizontal },
  { title: "Mentoria", page: "mentoria", icon: GraduationCap },
  { title: "Empty Legs", page: "empty-legs", icon: Plane },
];

const contratoChildren = [
  { title: "Transfer", page: "contrato/transfer", icon: FileText },
  { title: "Táxi", page: "contrato/taxi", icon: FileText },
];

const usuariosChildren = [
  { title: "Cadastrados", page: "usuarios/cadastrados", icon: Users },
  { title: "Solicitações", page: "usuarios/solicitacoes", icon: ClipboardList },
];

const sistemaChildren = [
  { title: "Configurações", page: "sistema/configuracoes", icon: Settings },
  { title: "Automações", page: "sistema/automacoes", icon: Zap },
  { title: "Comunicador", page: "sistema/comunicador", icon: MessageSquare },
  { title: "Anotações", page: "sistema/anotacoes", icon: StickyNote },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { activePage, setActivePage } = useActivePage();

  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const isActive = (page: string) => activePage === page;
  const contratoActive = contratoChildren.some((c) => isActive(c.page));
  const usuariosActive = usuariosChildren.some((c) => isActive(c.page));
  const sistemaActive = sistemaChildren.some((c) => isActive(c.page));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const renderCollapsible = (title: string, Icon: any, children: { title: string; page: string; icon: any }[], groupActive: boolean) => (
    <Collapsible key={title} defaultOpen={groupActive}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className={cn("w-full justify-between", groupActive && "text-primary")}>
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{title}</span>}
            </span>
            {!collapsed && <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
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

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-foreground">Admin Master</p>
            <p className="text-xs text-muted-foreground">Painel Administrativo</p>
          </div>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {simpleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => setActivePage(item.page)}
                    className={cn(
                      "cursor-pointer",
                      isActive(item.page) && "bg-muted text-primary font-medium"
                    )}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {renderCollapsible("Contrato", FileText, contratoChildren, contratoActive)}

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActivePage("network")}
                  className={cn("cursor-pointer", isActive("network") && "bg-muted text-primary font-medium")}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  {!collapsed && <span>Network</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {renderCollapsible("Usuários", Users, usuariosChildren, usuariosActive)}

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActivePage("templates")}
                  className={cn("cursor-pointer", isActive("templates") && "bg-muted text-primary font-medium")}
                >
                  <LayoutTemplate className="h-4 w-4 mr-2" />
                  {!collapsed && <span>Templates</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActivePage("solicitacoes-servicos")}
                  className={cn("cursor-pointer", isActive("solicitacoes-servicos") && "bg-muted text-primary font-medium")}
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  {!collapsed && <span>Solicitações Serviços</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActivePage("tickets")}
                  className={cn("cursor-pointer", isActive("tickets") && "bg-muted text-primary font-medium")}
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  {!collapsed && <span>Tickets</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {renderCollapsible("Sistema", Settings, sistemaChildren, sistemaActive)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
            <SidebarMenuButton className="w-full" onClick={() => setDarkMode(!darkMode)}>
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
