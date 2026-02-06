import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  className?: string;
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div className={cn("flex justify-end", className)}>
      <div className="bg-primary rounded-lg px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary-foreground/70 typing-dot" />
          <div className="h-2 w-2 rounded-full bg-primary-foreground/70 typing-dot" />
          <div className="h-2 w-2 rounded-full bg-primary-foreground/70 typing-dot" />
        </div>
      </div>
    </div>
  );
}