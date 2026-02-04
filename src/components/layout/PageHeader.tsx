import { cn } from "@/lib/utils";
import { forwardRef, ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, description, children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between border-b bg-card px-6 py-4",
          className
        )}
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
    );
  }
);

PageHeader.displayName = "PageHeader";
