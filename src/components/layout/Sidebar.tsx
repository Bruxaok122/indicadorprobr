import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import logoJuriszap from "@/assets/logo-juriszap.png";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  Settings,
  Upload,
  Webhook,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    title: "Painel",
    href: "/",
    icon: LayoutDashboard,
    description: "Visão geral do sistema",
  },
  {
    title: "Conversas",
    href: "/conversas",
    icon: MessageSquare,
    description: "Chat com clientes",
  },
  {
    title: "Contatos",
    href: "/contatos",
    icon: Users,
    description: "Gerenciar clientes",
  },
  {
    title: "Importar",
    href: "/importar",
    icon: Upload,
    description: "Importar lista jurídica",
  },
  {
    title: "Templates",
    href: "/templates",
    icon: FileText,
    description: "Modelos de mensagem",
  },
  {
    title: "Configuração",
    href: "/configuracao",
    icon: Settings,
    description: "WhatsApp API",
  },
  {
    title: "Webhook",
    href: "/webhook",
    icon: Webhook,
    description: "Informações do webhook",
  },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuthContext();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-primary text-primary-foreground transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-3">
        <div className={cn("flex items-center gap-2", isCollapsed && "hidden")}>
          <img src={logoJuriszap} alt="JurisZap" className="h-10 w-auto" />
        </div>
        {isCollapsed && <img src={logoJuriszap} alt="JurisZap" className="h-8 w-auto mx-auto" />}
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
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isCollapsed && "justify-center px-2",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-primary-foreground/80 hover:bg-sidebar-accent/50 hover:text-primary-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {!isCollapsed && item.title}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className={cn("text-xs", !isCollapsed && "hidden")}>
                {item.title}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* User Info & Actions */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {!isCollapsed && profile && (
          <div className="rounded-lg bg-sidebar-accent/30 p-2">
            <p className="text-sm font-medium truncate">{profile.full_name}</p>
            <p className="text-xs text-primary-foreground/60 truncate">{profile.email}</p>
          </div>
        )}
        <div className={cn("flex items-center gap-2", isCollapsed && "flex-col")}>
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
      <div className={cn("border-t border-sidebar-border p-3", isCollapsed && "hidden")}>
        <p className="text-xs text-primary-foreground/60 text-center">
          Desenvolvido por <span className="font-semibold text-accent">LB013</span>
        </p>
      </div>
    </aside>
  );
}
