import {
  SlidersHorizontal, LogOut, Shield, BarChart3, MapPin, FileText, ChevronDown, Users, ClipboardList, Building2, LayoutTemplate, Bell, Moon, Sun, Settings, StickyNote, MessageSquare, Zap, GraduationCap, Plane, Megaphone, Link2, ScrollText, Car,
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
import { cn } from "@/lib/utils";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { usePanelTheme } from "@/hooks/usePanelTheme";

const simpleItems = [
  { title: "Abrangência", page: "abrangencia", icon: MapPin },
  { title: "Métricas", page: "metricas", icon: BarChart3 },
  { title: "Comunidade", page: "comunidade", icon: Users },
  { title: "Slides", page: "slides", icon: SlidersHorizontal },
  { title: "Mentoria", page: "mentoria", icon: GraduationCap },
  { title: "Empty Legs", page: "empty-legs", icon: Plane },
  { title: "Domínios (motoristas)", page: "dominios", icon: Link2 },
  { title: "Veículos", page: "veiculos", icon: Car },
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
  { title: "Logs do painel", page: "logs", icon: ScrollText },
  { title: "Configurações", page: "sistema/configuracoes", icon: Settings },
  { title: "Automações", page: "sistema/automacoes", icon: Zap },
  { title: "Comunicador", page: "sistema/comunicador", icon: MessageSquare },
  { title: "Avisos", page: "sistema/avisos", icon: Megaphone },
  { title: "Anotações", page: "sistema/anotacoes", icon: StickyNote },
];

export function AdminSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { activePage, setActivePage } = useActivePage();

  const goPage = (page: string) => {
    setActivePage(page);
    if (isMobile) setOpenMobile(false);
  };
  const { config } = useConfiguracoes();
  const { darkMode, toggle: toggleTheme } = usePanelTheme("admin");

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
          <SidebarMenuButton className={cn("w-full min-w-0 justify-between gap-1", groupActive && "text-primary")}>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate text-left">{title}</span>}
            </span>
            {!collapsed && (
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
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

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="flex shrink-0 items-center gap-3 border-b border-border p-3 sm:p-4">
        {config.logo_url ? (
          <img src={config.logo_url} alt="Logo" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{config.nome_projeto || "Admin Master"}</p>
            <p className="truncate text-xs text-muted-foreground">Painel Administrativo</p>
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
                    onClick={() => goPage(item.page)}
                    className={cn(
                      "cursor-pointer",
                      isActive(item.page) && "bg-muted text-primary font-medium"
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4 shrink-0" />
                    {!collapsed && <span className="min-w-0 truncate">{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {renderCollapsible("Contrato", FileText, contratoChildren, contratoActive)}

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => goPage("network")}
                  className={cn("cursor-pointer", isActive("network") && "bg-muted text-primary font-medium")}
                >
                  <Building2 className="mr-2 h-4 w-4 shrink-0" />
                  {!collapsed && <span className="min-w-0 truncate">Network</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {renderCollapsible("Usuários", Users, usuariosChildren, usuariosActive)}

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => goPage("templates")}
                  className={cn("cursor-pointer", isActive("templates") && "bg-muted text-primary font-medium")}
                >
                  <LayoutTemplate className="mr-2 h-4 w-4 shrink-0" />
                  {!collapsed && <span className="min-w-0 truncate">Templates</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => goPage("solicitacoes-servicos")}
                  className={cn("cursor-pointer", isActive("solicitacoes-servicos") && "bg-muted text-primary font-medium")}
                >
                  <ClipboardList className="mr-2 h-4 w-4 shrink-0" />
                  {!collapsed && <span className="min-w-0 truncate">Solicitações Serviços</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => goPage("tickets")}
                  className={cn("cursor-pointer", isActive("tickets") && "bg-muted text-primary font-medium")}
                >
                  <ClipboardList className="mr-2 h-4 w-4 shrink-0" />
                  {!collapsed && <span className="min-w-0 truncate">Tickets</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {renderCollapsible("Sistema", Settings, sistemaChildren, sistemaActive)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
