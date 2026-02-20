import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  BarChart3,
  MessagesSquare,
  ContactRound,
  FileStack,
  FileUp,
  Radio,
  Phone,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Scale,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const userNavItems = [
  { title: "Painel", href: "/", icon: BarChart3, description: "Visão geral do sistema" },
  { title: "Conversas", href: "/conversas", icon: MessagesSquare, description: "Chat com clientes" },
];

const adminNavItems = [
  { title: "Painel", href: "/", icon: BarChart3, description: "Visão geral do sistema" },
  { title: "Conversas", href: "/conversas", icon: MessagesSquare, description: "Chat com clientes" },
  { title: "Contatos", href: "/contatos", icon: ContactRound, description: "Gerenciar clientes" },
  { title: "Importar", href: "/importar", icon: FileUp, description: "Importar lista jurídica" },
  { title: "Templates", href: "/templates", icon: FileStack, description: "Modelos de mensagem" },
  { title: "Números", href: "/whatsapp-api", icon: Phone, description: "Gerenciar números e perfil" },
  { title: "Webhook", href: "/webhook", icon: Radio, description: "Informações do webhook" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, isAdmin } = useAuthContext();
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = isAdmin ? adminNavItems : userNavItems;

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const SidebarContent = ({ inSheet = false }: { inSheet?: boolean }) => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 md:h-16 items-center justify-between border-b border-sidebar-border px-3">
        <div className={cn("flex items-center gap-3", !inSheet && isCollapsed && "hidden")}>
          <div className="flex h-10 md:h-12 w-10 md:w-12 items-center justify-center rounded-xl bg-sidebar-accent/30">
            <Scale className="h-6 md:h-7 w-6 md:w-7 text-primary-foreground" />
          </div>
          <span className="font-bold text-base md:text-lg">JurisZap</span>
        </div>
        {!inSheet && isCollapsed && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-accent/30 mx-auto">
            <Scale className="h-6 w-6 text-primary-foreground" />
          </div>
        )}
        {!inSheet && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 text-primary-foreground/70 hover:bg-sidebar-accent hover:text-primary-foreground",
              isCollapsed && "mx-auto"
            )}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}
        {inSheet && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-foreground/70 hover:bg-sidebar-accent hover:text-primary-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Tooltip key={item.href} delayDuration={300}>
              <TooltipTrigger asChild>
                <Link
                  to={item.href}
                  onClick={() => inSheet && setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    !inSheet && isCollapsed && "justify-center px-2",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-primary-foreground/80 hover:bg-sidebar-accent/50 hover:text-primary-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {(inSheet || !isCollapsed) && item.title}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className={cn("text-xs", (inSheet || !isCollapsed) && "hidden")}>
                {item.title}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* User Info & Actions */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {(inSheet || !isCollapsed) && profile && (
          <div className="rounded-lg bg-sidebar-accent/30 p-2">
            <p className="text-sm font-medium truncate">{profile.full_name}</p>
            <p className="text-xs text-primary-foreground/60 truncate">{profile.email}</p>
          </div>
        )}
        <div className={cn("flex items-center gap-2", !inSheet && isCollapsed && "flex-col")}>
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground/70 hover:bg-sidebar-accent hover:text-primary-foreground"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Footer */}
      <div className={cn("border-t border-sidebar-border p-3", !inSheet && isCollapsed && "hidden")}>
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-xs text-primary-foreground/70">Desenvolvido por</span>
          <span className="text-sm font-bold text-accent tracking-wide">LB013</span>
        </div>
      </div>
    </div>
  );

  // Mobile: use Sheet
  if (isMobile) {
    return (
      <>
        {/* Mobile hamburger button */}
        <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 bg-primary text-primary-foreground border-b border-sidebar-border">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-primary-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-primary text-primary-foreground border-r-0">
              <SidebarContent inSheet />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 ml-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent/30">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base">JurisZap</span>
          </div>
        </div>
        {/* Spacer for fixed header */}
        <div className="h-14 flex-shrink-0" />
      </>
    );
  }

  // Desktop: regular sidebar
  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-primary text-primary-foreground transition-all duration-300 flex-shrink-0",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarContent />
    </aside>
  );
}
