import { useState } from "react";
import { Contact } from "@/types/juriszap";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, Inbox, Clock, CheckCircle2, XCircle, Phone, Scale, Moon, Sun, LogOut, User, Star, Trash2, Volume2, VolumeOff, Bot } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type TabFilter = "aguardando" | "respondido" | "ia_ativa";

const tabs: { id: TabFilter; label: string; icon: React.ElementType }[] = [
  { id: "aguardando", label: "Pendentes", icon: Clock },
  { id: "respondido", label: "Respondidos", icon: CheckCircle2 },
  { id: "ia_ativa", label: "IA Ativa", icon: Bot },
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
  operatorName?: string;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onLogout?: () => void;
  onClearAll?: () => void;
  isClearingAll?: boolean;
  notificationEnabled?: boolean;
  onToggleNotification?: () => void;
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
  operatorName,
  isDark,
  onToggleTheme,
  onLogout,
  onClearAll,
  isClearingAll,
  notificationEnabled,
  onToggleNotification,
}: ChatContactListProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>("aguardando");

  const filteredContacts = contacts
    .filter((contact) => {
      if (activeTab === "ia_ativa") return contact.ai_enabled;
      return contact.status === activeTab;
    })
    .filter((contact) => {
      const q = search.toLowerCase();
      return contact.name.toLowerCase().includes(q) || contact.phone.includes(search);
    })
    .sort((a, b) => {
      // Priority contacts always on top
      if (a.is_priority && !b.is_priority) return -1;
      if (!a.is_priority && b.is_priority) return 1;
      return 0;
    });

  const tabCounts = {
    aguardando: contacts.filter((c) => c.status === "aguardando").length,
    respondido: contacts.filter((c) => c.status === "respondido").length,
    ia_ativa: contacts.filter((c) => c.ai_enabled).length,
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
      {/* Operator header bar */}
      {(operatorName || operatorPhone || operatorLawyer) && (
        <div className="px-3 py-2.5 border-b border-border bg-primary/5 dark:bg-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <a href="/" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-primary/10 transition-colors" title="Voltar ao painel">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="m15 18-6-6 6-6"/></svg>
              </a>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 dark:bg-primary/30">
                <User className="h-4 w-4 text-primary dark:text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                {operatorName && (
                  <p className="text-sm font-semibold text-foreground truncate">{operatorName}</p>
                )}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {operatorPhone && (
                    <span className="flex items-center gap-0.5 truncate">
                      <Phone className="h-3 w-3" />
                      {operatorPhone}
                    </span>
                  )}
                  {operatorLawyer && (
                    <span className="flex items-center gap-0.5 truncate">
                      <Scale className="h-3 w-3" />
                      {operatorLawyer}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onToggleNotification && (
                <button
                  onClick={onToggleNotification}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                  title={notificationEnabled ? "Desativar som de notificação" : "Ativar som de notificação"}
                >
                  {notificationEnabled ? <Volume2 className="h-3.5 w-3.5 text-green-500" /> : <VolumeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              )}
              {onToggleTheme && (
                <button
                  onClick={onToggleTheme}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                >
                  {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              )}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
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

      {/* Search + Clear All */}
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
        {onClearAll && contacts.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors"
                title="Limpar toda a lista"
                disabled={isClearingAll}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar toda a lista?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso removerá <strong>todos os {contacts.length} contatos</strong> da sua lista de conversas, incluindo mensagens e conversas associadas. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onClearAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isClearingAll ? "Limpando..." : "Sim, limpar tudo"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Contact list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <motion.div
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
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => onSelectContact(contact.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-3 text-left transition-all overflow-hidden",
                    "hover:bg-gray-50 dark:hover:bg-gray-800/50 active:scale-[0.99]",
                    "border-b border-gray-100 dark:border-gray-800/50",
                    isSelected && "bg-green-50 dark:bg-green-900/10 border-l-[3px] border-l-green-500",
                    contact.is_priority && !isSelected && "bg-amber-50/60 dark:bg-amber-900/10 border-l-[3px] border-l-amber-400"
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm",
                      contact.is_priority ? "bg-amber-500 ring-2 ring-amber-400 ring-offset-1 ring-offset-background" : getAvatarColor(contact.name)
                    )}>
                      {contact.is_priority ? (
                        <Star className="h-5 w-5 fill-white text-white" />
                      ) : (
                        contact.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    {/* Status dot */}
                    <span className={cn(
                      "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900",
                      getStatusDot(contact.status)
                    )} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {contact.name}
                        </p>
                        {contact.whatsapp_profile_name && contact.whatsapp_profile_name !== contact.name && (
                          <p className="truncate text-[10px] text-muted-foreground/70 leading-tight">
                            ~{contact.whatsapp_profile_name}
                          </p>
                        )}
                      </div>
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground truncate min-w-0">
                        {contact.last_message_preview || contact.phone}
                      </p>
                      <span className={cn(
                        "shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
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
