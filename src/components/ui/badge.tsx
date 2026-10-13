import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-muted-foreground",
        primary: "bg-primary-soft text-primary-strong dark:text-primary",
        deal: "bg-deal text-deal-foreground",
        warning: "bg-warning-soft text-warning-foreground",
        info: "bg-info-soft text-info",
        danger: "bg-danger-soft text-danger",
        outline: "border border-border text-muted-foreground",
        demo: "bg-fuchsia-600 text-white tracking-wide",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
