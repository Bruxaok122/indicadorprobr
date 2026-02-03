import { cn } from "@/lib/utils";

type StatusType = "novo" | "aguardando" | "respondido" | "encerrado";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  novo: {
    label: "Novo",
    className: "bg-info/10 text-info border-info/20",
  },
  aguardando: {
    label: "Aguardando",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  respondido: {
    label: "Respondido",
    className: "bg-success/10 text-success border-success/20",
  },
  encerrado: {
    label: "Encerrado",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.novo;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
