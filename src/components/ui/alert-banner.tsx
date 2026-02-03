import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type AlertType = "info" | "success" | "warning" | "error";

interface AlertBannerProps {
  type: AlertType;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

const alertConfig: Record<
  AlertType,
  { icon: typeof Info; bgClass: string; iconClass: string; borderClass: string }
> = {
  info: {
    icon: Info,
    bgClass: "bg-info/10",
    iconClass: "text-info",
    borderClass: "border-info/20",
  },
  success: {
    icon: CheckCircle,
    bgClass: "bg-success/10",
    iconClass: "text-success",
    borderClass: "border-success/20",
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-warning/10",
    iconClass: "text-warning",
    borderClass: "border-warning/20",
  },
  error: {
    icon: AlertCircle,
    bgClass: "bg-destructive/10",
    iconClass: "text-destructive",
    borderClass: "border-destructive/20",
  },
};

export function AlertBanner({ type, title, children, onClose, className }: AlertBannerProps) {
  const config = alertConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "relative flex gap-3 rounded-lg border p-4",
        config.bgClass,
        config.borderClass,
        className
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0", config.iconClass)} />
      <div className="flex-1">
        {title && <p className="font-medium text-foreground">{title}</p>}
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
