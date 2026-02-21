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
    <div className="flex justify-center my-2">
      <span className="rounded-lg bg-white/90 dark:bg-gray-800/90 px-3 py-1 text-[11px] text-gray-600 dark:text-gray-400 shadow-sm font-medium">
        {label}
      </span>
    </div>
  );
}
