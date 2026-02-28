import { Search, BarChart3, Settings, HelpCircle, List, Send, LogOut, Coins, GitBranch, Mail, Phone } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Buscar", url: "/search", icon: Search },
  { title: "Listas", url: "/lists", icon: List },
  { title: "Campanhas", url: "/campaigns", icon: Send },
  { title: "Workflows", url: "/workflows", icon: GitBranch },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const secondaryNav = [
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Ajuda", url: "/help", icon: HelpCircle },
];

export function AppSidebar() {
  const { signOut } = useAuth();
  const { leads, email, phone } = useCredits();

  return (
    <Sidebar className="border-r border-border">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          {/* 3 linhas convergindo = Email + LinkedIn + WhatsApp unificados */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4L9 9L15 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M3 9L9 9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M3 14L9 9L15 14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <span className="font-display text-sm font-bold tracking-tight text-foreground">ELEV</span>
          <span className="font-display text-sm font-semibold tracking-tight text-primary"> SALES</span>
        </div>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <div className="mx-3 mb-3 space-y-1.5">
            <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-1.5">
              <Coins className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Leads</span>
              <span className="ml-auto text-xs font-semibold text-foreground">{leads.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-1.5">
              <Mail className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Email</span>
              <span className="ml-auto text-xs font-semibold text-foreground">{email.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-1.5">
              <Phone className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Celular</span>
              <span className="ml-auto text-xs font-semibold text-foreground">{phone.toLocaleString("pt-BR")}</span>
            </div>
          </div>
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      activeClassName="bg-primary/8 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {secondaryNav.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  activeClassName="bg-primary/8 text-primary font-medium"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
