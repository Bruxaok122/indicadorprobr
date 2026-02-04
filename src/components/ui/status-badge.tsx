import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type StatusType = "novo" | "aguardando" | "respondido" | "encerrado" | string | null;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
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

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, className }, ref) => {
    const config = statusConfig[status || "novo"] || statusConfig.novo;

    return (
      <span
        ref={ref}
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
);

StatusBadge.displayName = "StatusBadge";
