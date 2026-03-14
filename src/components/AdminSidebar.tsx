import {
  Home, SlidersHorizontal, LogOut, Shield, BarChart3, MapPin, FileText, ChevronDown, Users, ClipboardList, Building2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
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

const simpleItems = [
  { title: "Home", url: "/admin", icon: Home },
  { title: "Métricas", url: "/admin/metricas", icon: BarChart3 },
  { title: "Abrangência", url: "/admin/abrangencia", icon: MapPin },
  { title: "Slides", url: "/admin/slides", icon: SlidersHorizontal },
];

const contratoChildren = [
  { title: "Transfer", url: "/admin/contrato/transfer", icon: FileText },
  { title: "Táxi", url: "/admin/contrato/taxi", icon: FileText },
];

const usuariosChildren = [
  { title: "Cadastrados", url: "/admin/usuarios/cadastrados", icon: Users },
  { title: "Solicitações", url: "/admin/usuarios/solicitacoes", icon: ClipboardList },
];

const networkItem = { title: "Network", url: "/admin/network", icon: Building2 };

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (url: string) => location.pathname === url;
  const contratoActive = contratoChildren.some((c) => isActive(c.url));
  const usuariosActive = usuariosChildren.some((c) => isActive(c.url));
  const networkActive = isActive(networkItem.url);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

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
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
                      <item.icon className="h-4 w-4 mr-2" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Contrato collapsible */}
              <Collapsible defaultOpen={contratoActive}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className={cn("w-full justify-between", contratoActive && "text-primary")}>
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {!collapsed && <span>Contrato</span>}
                      </span>
                      {!collapsed && <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {contratoChildren.map((child) => (
                        <SidebarMenuSubItem key={child.url}>
                          <SidebarMenuSubButton asChild>
                            <NavLink to={child.url} end className="text-sm" activeClassName="text-primary font-medium">
                              <child.icon className="h-3.5 w-3.5 mr-2" />
                              {child.title}
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Network */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={networkItem.url} end className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
                    <networkItem.icon className="h-4 w-4 mr-2" />
                    {!collapsed && <span>{networkItem.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Usuários collapsible */}
              <Collapsible defaultOpen={usuariosActive}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className={cn("w-full justify-between", usuariosActive && "text-primary")}>
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {!collapsed && <span>Usuários</span>}
                      </span>
                      {!collapsed && <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {usuariosChildren.map((child) => (
                        <SidebarMenuSubItem key={child.url}>
                          <SidebarMenuSubButton asChild>
                            <NavLink to={child.url} end className="text-sm" activeClassName="text-primary font-medium">
                              <child.icon className="h-3.5 w-3.5 mr-2" />
                              {child.title}
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border">
        <SidebarMenu>
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
