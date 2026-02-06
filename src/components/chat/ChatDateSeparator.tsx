import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatDateSeparatorProps {
  date: Date;
}

export function ChatDateSeparator({ date }: ChatDateSeparatorProps) {
  let label: string;
  if (isToday(date)) {
    label = "Hoje";
  } else if (isYesterday(date)) {
    label = "Ontem";
  } else {
    label = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  return (
    <div className="flex justify-center my-3">
      <span className="rounded-lg bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
        {label}
      </span>
    </div>
  );
}
