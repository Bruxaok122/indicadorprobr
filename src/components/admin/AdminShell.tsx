import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, LogOut, Menu, RefreshCw, Scale, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface AdminNavItem {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: string;
}

interface AdminShellProps {
  items: AdminNavItem[];
  active: string;
  onChange: (value: string) => void;
  onLogout: () => void;
  onRefresh?: () => Promise<void> | void;
  userName?: string;
  children: ReactNode;
}

function initials(name?: string) {
  if (!name) return "AD";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "AD";
}

function SidebarBody({ items, active, onSelect, onLogout, userName }: {
  items: AdminNavItem[]; active: string; onSelect: (v: string) => void; onLogout: () => void; userName?: string;
}) {
  const groups = Array.from(new Set(items.map((i) => i.group)));
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <Scale className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">JurisZap</p>
          <p className="truncate text-xs text-muted-foreground">Painel administrativo</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Menu administrativo">
        {groups.map((g) => (
          <div key={g} className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">{g}</p>
            <ul className="space-y-0.5">
              {items.filter((i) => i.group === g).map((item) => {
                const isActive = item.value === active;
                const Icon = item.icon;
                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.value)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive ? "text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="admin-nav-active"
                          className="absolute inset-0 rounded-lg bg-muted/70"
                          transition={{ type: "spring", stiffness: 400, damping: 34 }}
                        />
                      )}
                      {isActive && (
                        <motion.span layoutId="admin-nav-bar" className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />
                      )}
                      <Icon className={cn("relative h-4 w-4 shrink-0", isActive && "text-primary")} />
                      <span className="relative truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3">
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
            {initials(userName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{userName || "Administrador"}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Conectado
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Sair" className="h-8 w-8 shrink-0">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ items, active, onChange, onLogout, onRefresh, userName, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const current = items.find((i) => i.value === active) ?? items[0];

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  const select = (v: string) => { onChange(v); setMobileOpen(false); };

  return (
    <div className="dark admin-gradient flex h-[100dvh] w-full overflow-hidden text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-border/40 lg:block">
        <SidebarBody items={items} active={active} onSelect={select} onLogout={onLogout} userName={userName} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="dark admin-gradient w-72 border-border/40 p-0">
          <SidebarBody items={items} active={active} onSelect={select} onLogout={onLogout} userName={userName} />
        </SheetContent>
      </Sheet>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-violet/12 via-violet/4 to-transparent" />
        <header className="relative flex flex-col gap-4 px-4 pt-6 pb-4 md:flex-row md:items-end md:justify-between md:px-8 md:pt-8">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden -ml-2" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
            <AnimatePresence mode="wait">
              <motion.div
                key={current.value}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{current.label}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium sm:flex">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              Hoje · {format(new Date(), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
            </div>
            {onRefresh && (
              <Button size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-full">
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} /> Atualizar
              </Button>
            )}
          </div>
        </header>

        <main className="relative flex-1 px-4 pb-8 md:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.value}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
