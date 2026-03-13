import {
  LayoutDashboard, Home, Activity, MapPin, ArrowLeftRight,
  FileText, BookOpen, Map, Users, UserCheck, Handshake,
  ClipboardList, CalendarDays, Car, Megaphone, BarChart3,
  Globe, Search, Mail, Monitor, Settings, StickyNote,
  Bell, Moon, LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
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

const menuStructure = [
  {
    label: "Principal",
    items: [
      {
        title: "Painel",
        icon: LayoutDashboard,
        children: [
          { title: "Home", url: "/dashboard", icon: Home },
          { title: "Métricas", url: "/dashboard/metricas", icon: Activity },
          { title: "Abrangência", url: "/dashboard/abrangencia", icon: MapPin },
        ],
      },
      {
        title: "Transfer",
        icon: ArrowLeftRight,
        children: [
          { title: "Solicitações", url: "/dashboard/transfer/solicitacoes", icon: FileText },
          { title: "Reservas", url: "/dashboard/transfer/reservas", icon: BookOpen },
          { title: "Contrato", url: "/dashboard/transfer/contrato", icon: ClipboardList },
          { title: "Geolocalização", url: "/dashboard/transfer/geolocalizacao", icon: Map },
        ],
      },
      {
        title: "Grupos",
        icon: Users,
        children: [
          { title: "Solicitações", url: "/dashboard/grupos/solicitacoes", icon: FileText },
          { title: "Reservas", url: "/dashboard/grupos/reservas", icon: BookOpen },
          { title: "Contrato", url: "/dashboard/grupos/contrato", icon: ClipboardList },
        ],
      },
      {
        title: "Motoristas",
        icon: UserCheck,
        children: [
          { title: "Cadastros", url: "/dashboard/motoristas/cadastros", icon: UserCheck },
          { title: "Parcerias", url: "/dashboard/motoristas/parcerias", icon: Handshake },
          { title: "Solicitações", url: "/dashboard/motoristas/solicitacoes", icon: ClipboardList },
          { title: "Agendamentos", url: "/dashboard/motoristas/agendamentos", icon: CalendarDays },
        ],
      },
      { title: "Veículos", url: "/dashboard/veiculos", icon: Car },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        title: "Campanhas",
        icon: Megaphone,
        children: [
          { title: "Ativos", url: "/dashboard/campanhas/ativos", icon: Globe },
          { title: "Leads", url: "/dashboard/campanhas/leads", icon: UserCheck },
        ],
      },
      {
        title: "Marketing",
        icon: BarChart3,
        children: [
          { title: "Receptivos", url: "/dashboard/marketing/receptivos", icon: MapPin },
          { title: "QR Code", url: "/dashboard/marketing/qrcode", icon: Search },
        ],
      },
      { title: "Network", url: "/dashboard/network", icon: Globe },
      { title: "Google", url: "/dashboard/google", icon: Search },
      { title: "E-mail Business", url: "/dashboard/email-business", icon: Mail },
      { title: "Website", url: "/dashboard/website", icon: Monitor },
    ],
  },
  {
    label: "Configurações",
    items: [
      {
        title: "Sistema",
        icon: Settings,
        children: [],
      },
      { title: "Anotações", url: "/dashboard/anotacoes", icon: StickyNote },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (url: string) => location.pathname === url;
  const isGroupActive = (children: { url: string }[]) =>
    children.some((c) => location.pathname === c.url);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <Car className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-foreground">E-Transporte.pro</p>
            <p className="text-xs text-muted-foreground">Gestão de Frota</p>
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
                                <SidebarMenuSubItem key={child.url}>
                                  <SidebarMenuSubButton asChild>
                                    <NavLink
                                      to={child.url}
                                      end
                                      className="text-sm"
                                      activeClassName="text-primary font-medium"
                                    >
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
                    );
                  }

                  if ("children" in item && item.children && item.children.length === 0) {
                    return (
                      <Collapsible key={item.title}>
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton className="w-full justify-between">
                              <span className="flex items-center gap-2">
                                <item.icon className="h-4 w-4" />
                                {!collapsed && <span>{item.title}</span>}
                              </span>
                              {!collapsed && <ChevronDown className="h-4 w-4" />}
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  const url = (item as { url: string }).url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={url}
                          end
                          className="hover:bg-muted/50"
                          activeClassName="bg-muted text-primary font-medium"
                        >
                          <item.icon className="h-4 w-4 mr-2" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
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
