import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  Settings,
  Upload,
  Webhook,
  Scale,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  return (
    <aside className="flex h-screen w-64 flex-col bg-primary text-primary-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <Scale className="h-8 w-8 text-accent" />
        <div>
          <h1 className="text-xl font-bold">JurisZap</h1>
          <p className="text-xs text-primary-foreground/70">Sistema Jurídico</p>
        </div>
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
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-primary-foreground/80 hover:bg-sidebar-accent/50 hover:text-primary-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.title}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {item.description}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs text-primary-foreground/60">
          © 2024 JurisZap
        </p>
        <p className="text-xs text-primary-foreground/60">
          Sistema de Comunicação Jurídica
        </p>
      </div>
    </aside>
  );
}
