import { Contact } from "@/types/juriszap";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const filteredContacts = contacts.filter((contact) => {
    const q = search.toLowerCase();
    return contact.name.toLowerCase().includes(q) || contact.phone.includes(search);
  });

  return (
    <div
      
      className={cn(
        "flex flex-col border-r bg-card",
        isMobile
          ? cn("absolute inset-0 z-10 transition-transform duration-300", mobileShowChat && "-translate-x-full")
          : "w-80"
      )}
    >
      {/* Header */}
      <div className="border-b px-4 py-3">
        <h2 className="mb-2.5 text-base font-semibold">Conversas</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg bg-muted border-0 text-sm"
          />
        </div>
      </div>

      {/* Contact list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhum contato encontrado</p>
          </div>
        ) : (
          <div>
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectContact(contact.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors border-b border-border/50 hover:bg-muted/60",
                  selectedContactId === contact.id && "bg-muted"
                )}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {contact.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{contact.name}</p>
                    {contact.last_message_at && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {format(new Date(contact.last_message_at), "HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="truncate text-xs text-muted-foreground">{contact.phone}</p>
                    <StatusBadge status={contact.status} className="scale-75" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
