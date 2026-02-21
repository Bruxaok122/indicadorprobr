import { useState } from "react";
import { Contact } from "@/types/juriszap";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, Inbox, Clock, CheckCheck, XCircle } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type TabFilter = "todos" | "aguardando" | "respondido" | "encerrado";

const tabs: { id: TabFilter; label: string; icon: React.ElementType }[] = [
  { id: "todos", label: "Todos", icon: Inbox },
  { id: "aguardando", label: "Aguardando", icon: Clock },
  { id: "respondido", label: "Respondidos", icon: CheckCheck },
  { id: "encerrado", label: "Encerrados", icon: XCircle },
];

interface ChatContactListProps {
  contacts: Contact[];
  isLoading: boolean;
  search: string;
  setSearch: (s: string) => void;
  selectedContactId: string | null;
  onSelectContact: (id: string) => void;
  isMobile: boolean;
  mobileShowChat: boolean;
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm", { locale: ptBR });
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM", { locale: ptBR });
}

// Generate a consistent color from a name
function getAvatarColor(name: string): string {
  const colors = [
    "from-blue-500 to-blue-600",
    "from-emerald-500 to-emerald-600",
    "from-violet-500 to-violet-600",
    "from-amber-500 to-amber-600",
    "from-rose-500 to-rose-600",
    "from-cyan-500 to-cyan-600",
    "from-indigo-500 to-indigo-600",
    "from-teal-500 to-teal-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function ChatContactList({
  contacts,
  isLoading,
  search,
  setSearch,
  selectedContactId,
  onSelectContact,
  isMobile,
  mobileShowChat,
}: ChatContactListProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>("todos");

  const filteredContacts = contacts.filter((contact) => {
    // Tab filter
    if (activeTab !== "todos" && contact.status !== activeTab) return false;
    // Search filter
    const q = search.toLowerCase();
    return contact.name.toLowerCase().includes(q) || contact.phone.includes(search);
  });

  const tabCounts = {
    todos: contacts.length,
    aguardando: contacts.filter((c) => c.status === "aguardando").length,
    respondido: contacts.filter((c) => c.status === "respondido").length,
    encerrado: contacts.filter((c) => c.status === "encerrado").length,
  };

  return (
    <div
      className={cn(
        "flex flex-col border-r bg-card",
        isMobile
          ? cn("absolute inset-0 z-10 transition-transform duration-300 h-full", mobileShowChat && "-translate-x-full")
          : "w-80 h-full"
      )}
    >
      {/* Header */}
      <div className="border-b px-4 pt-3 pb-0">
        <h2 className="mb-2.5 text-base font-bold tracking-tight">Conversas</h2>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl bg-muted border-0 text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-0.5 -mx-1 overflow-x-auto scrollbar-thin pb-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id];
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all whitespace-nowrap",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-foreground/15 text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contact list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 text-center px-6"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-3">
              <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum contato encontrado</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Tente outro filtro ou termo de busca</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredContacts.map((contact, index) => (
              <motion.button
                key={contact.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: index * 0.03, duration: 0.2 }}
                onClick={() => onSelectContact(contact.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-3 text-left transition-all border-b border-border/30",
                  "hover:bg-muted/60 active:scale-[0.98]",
                  selectedContactId === contact.id && "bg-primary/5 border-l-2 border-l-primary"
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-sm",
                  getAvatarColor(contact.name)
                )}>
                  {contact.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{contact.name}</p>
                    {contact.last_message_at && (
                      <span className={cn(
                        "shrink-0 text-[11px] whitespace-nowrap",
                        contact.status === "aguardando" ? "text-primary font-semibold" : "text-muted-foreground"
                      )}>
                        {formatMessageTime(contact.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="truncate text-xs text-muted-foreground min-w-0">{contact.phone}</p>
                    <div className="shrink-0">
                      <StatusBadge status={contact.status} className="text-[10px] px-1.5 py-0" />
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </ScrollArea>
    </div>
  );
}
