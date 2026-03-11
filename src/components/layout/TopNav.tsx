import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  BarChart3,
  MessagesSquare,
  ContactRound,
  FileStack,
  FileUp,
  Radio,
  Phone,
  LogOut,
  Scale,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMemo } from "react";

const adminNavItems = [
  { title: "Painel", href: "/", icon: BarChart3 },
  { title: "Conversas", href: "/conversas", icon: MessagesSquare },
  { title: "Contatos", href: "/contatos", icon: ContactRound },
  { title: "Importar", href: "/importar", icon: FileUp },
  { title: "Templates", href: "/templates", icon: FileStack },
  { title: "Números", href: "/whatsapp-api", icon: Phone },
  { title: "Webhook", href: "/webhook", icon: Radio },
];

const baseUserNavItems = [
  { title: "Conversas", href: "/conversas", icon: MessagesSquare },
];

const numerosItem = { title: "Números", href: "/whatsapp-api", icon: Phone };
const disparosItem = { title: "Disparos", href: "/disparos", icon: Radio };

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, isAdmin } = useAuthContext();

  const navItems = useMemo(() => {
    if (isAdmin) return adminNavItems;
    const items = [...baseUserNavItems];
    if ((profile as any)?.can_dispatch) items.push(disparosItem);
    if ((profile as any)?.can_manage_numbers) items.push(numerosItem);
    return items;
  }, [isAdmin, profile]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex items-center justify-center h-14 bg-card/60 dark:bg-card/40 backdrop-blur-xl border-b border-violet/20 px-4 gap-3 shrink-0 sticky top-0 z-40">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 mr-2 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/20">
          <Scale className="h-4.5 w-4.5" />
        </div>
        <span className="font-bold text-sm text-foreground hidden md:block">JurisZap</span>
      </Link>

      {/* Nav Items — floating pills */}
      <nav data-onboarding="nav-bar" className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none justify-center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          // Map href to onboarding target name
          const onboardingMap: Record<string, string> = {
            "/conversas": "nav-conversas",
            "/disparos": "nav-disparos",
            "/templates": "nav-templates",
            "/whatsapp-api": "nav-numeros",
            "/configuracao": "nav-configuracao",
          };
          const onboardingId = onboardingMap[item.href];

          return (
            <Link
              key={item.href}
              to={item.href}
              data-onboarding={onboardingId}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                  : "bg-muted/60 dark:bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted hover:shadow-md hover:scale-[1.02]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right side: user info + actions */}
      <div className="flex items-center gap-2 ml-2 shrink-0">
        {profile && (
          <span className="text-xs text-muted-foreground hidden lg:block truncate max-w-[140px]">
            {profile.full_name}
          </span>
        )}
        <ThemeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sair</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
