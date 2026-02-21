import { useState } from "react";
import { Contact } from "@/types/juriszap";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, Inbox, Clock, CheckCircle2, XCircle, Phone, Scale } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type TabFilter = "todos" | "aguardando" | "respondido" | "encerrado";

const tabs: { id: TabFilter; label: string; icon: React.ElementType }[] = [
  { id: "todos", label: "Inbox", icon: Inbox },
  { id: "aguardando", label: "Pendentes", icon: Clock },
  { id: "respondido", label: "Respondidos", icon: CheckCircle2 },
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
  operatorPhone?: string;
  operatorLawyer?: string;
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm", { locale: ptBR });
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM", { locale: ptBR });
}

const avatarColors = [
  "bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
  "bg-pink-500", "bg-orange-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getStatusDot(status: string) {
  switch (status) {
    case "aguardando": return "bg-yellow-400";
    case "respondido": return "bg-green-400";
    case "encerrado": return "bg-gray-400";
    default: return "bg-blue-400";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "aguardando": return "Aguardando";
    case "respondido": return "Respondido";
    case "encerrado": return "Encerrado";
    default: return "Novo";
  }
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
  operatorPhone,
  operatorLawyer,
}: ChatContactListProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>("todos");

  const filteredContacts = contacts.filter((contact) => {
    if (activeTab !== "todos" && contact.status !== activeTab) return false;
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
        "flex flex-col bg-card dark:bg-card border-r border-border contact-list-panel h-full",
        isMobile
          ? cn("absolute inset-0 z-10 transition-transform duration-300 h-full", mobileShowChat && "-translate-x-full")
          : "w-full"
      )}
    >
      {/* Operator info banner */}
      {(operatorPhone || operatorLawyer) && (
        <div className="px-3 py-2 border-b border-border bg-primary/5 dark:bg-primary/10">
          <div className="flex items-center gap-2 text-xs">
            {operatorPhone && (
              <span className="flex items-center gap-1 text-foreground/70">
                <Phone className="h-3 w-3" />
                <span className="font-medium truncate">{operatorPhone}</span>
              </span>
            )}
            {operatorLawyer && (
              <span className="flex items-center gap-1 text-foreground/70">
                <Scale className="h-3 w-3" />
                <span className="font-medium truncate">{operatorLawyer}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-all relative",
                isActive
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <div className="relative">
                <Icon className="h-4.5 w-4.5" />
                {count > 0 && (
                  <span className={cn(
                    "absolute -top-1.5 -right-2.5 inline-flex items-center justify-center h-3.5 min-w-[14px] px-0.5 rounded-full text-[9px] font-bold text-white",
                    isActive ? "bg-green-500" : "bg-gray-400"
                  )}>
                    {count}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="chatTab"
                  className="absolute bottom-0 left-2 right-2 h-[2px] bg-green-500 rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Search + Filter */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 border-0 text-sm focus-visible:ring-1 focus-visible:ring-green-400/50"
          />
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
            className="flex flex-col items-center justify-center py-16 text-center px-6"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
              <MessageSquare className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">Nenhum contato encontrado</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredContacts.map((contact, index) => {
              const isSelected = selectedContactId === contact.id;
              return (
                <motion.button
                  key={contact.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.15 }}
                  onClick={() => onSelectContact(contact.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-3 text-left transition-all",
                    "hover:bg-gray-50 dark:hover:bg-gray-800/50 active:scale-[0.99]",
                    "border-b border-gray-100 dark:border-gray-800/50",
                    isSelected && "bg-green-50 dark:bg-green-900/10 border-l-[3px] border-l-green-500"
                  )}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm",
                      getAvatarColor(contact.name)
                    )}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    {/* Status dot */}
                    <span className={cn(
                      "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900",
                      getStatusDot(contact.status)
                    )} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {contact.name}
                      </p>
                      {contact.last_message_at && (
                        <span className={cn(
                          "shrink-0 text-[11px] whitespace-nowrap",
                          contact.status === "aguardando"
                            ? "text-green-600 dark:text-green-400 font-semibold"
                            : "text-gray-400"
                        )}>
                          {formatMessageTime(contact.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400 min-w-0">
                        {contact.phone}
                      </p>
                      <span className={cn(
                        "shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[10px] font-medium",
                        contact.status === "aguardando" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                        contact.status === "respondido" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                        contact.status === "encerrado" && "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
                        contact.status === "novo" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                      )}>
                        {getStatusLabel(contact.status)}
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </ScrollArea>
    </div>
  );
}
