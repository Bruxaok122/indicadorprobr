import { Contact } from "@/types/juriszap";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArrowLeft, Phone, FileText } from "lucide-react";

interface ChatHeaderProps {
  contact: Contact;
  isMobile: boolean;
  onBack: () => void;
}

export function ChatHeader({ contact, isMobile, onBack }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b bg-card px-3 md:px-5 py-2.5 md:py-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0 -ml-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate">{contact.name}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {contact.phone}
            </span>
            {contact.process_number && !isMobile && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {contact.process_number}
              </span>
            )}
          </div>
        </div>
      </div>
      <StatusBadge status={contact.status} />
    </div>
  );
}
