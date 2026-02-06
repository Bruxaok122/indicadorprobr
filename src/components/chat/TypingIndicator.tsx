import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  className?: string;
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div className={cn("flex justify-end", className)}>
      <div className="bubble-outgoing bg-chat-outgoing px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-chat-outgoing-foreground/40 typing-dot" />
          <div className="h-2 w-2 rounded-full bg-chat-outgoing-foreground/40 typing-dot" />
          <div className="h-2 w-2 rounded-full bg-chat-outgoing-foreground/40 typing-dot" />
        </div>
      </div>
    </div>
  );
}
