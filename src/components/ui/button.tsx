import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform",
  {
    variants: {
      variant: {
        default:
          "overflow-hidden bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.6),inset_0_1px_0_hsl(0_0%_100%/0.18)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-6px_hsl(var(--primary)/0.75),inset_0_1px_0_hsl(0_0%_100%/0.25)] hover:brightness-110 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full",
        destructive:
          "bg-gradient-to-br from-destructive to-destructive/75 text-destructive-foreground shadow-[0_6px_20px_-6px_hsl(var(--destructive)/0.55)] hover:-translate-y-0.5 hover:brightness-110",
        outline:
          "border border-border/70 bg-card/40 backdrop-blur-sm hover:border-primary/50 hover:bg-primary/10 hover:text-foreground hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]",
        secondary: "border border-border/50 bg-secondary/70 text-secondary-foreground backdrop-blur-sm hover:bg-secondary hover:border-primary/30",
        ghost: "hover:bg-primary/10 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
