import Image from "next/image";
import { createElement } from "react";
import { categoryIcon } from "@/components/icons";
import { storagePublicUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

export function ProductVisual({
  imagePath,
  categoryIconName,
  alt,
  className,
  size = "md",
  priority = false,
}: {
  imagePath: string | null;
  categoryIconName?: string;
  alt: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
}) {
  const url = storagePublicUrl("product-images", imagePath);
  const icon = categoryIcon(categoryIconName);
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden bg-[radial-gradient(120%_100%_at_30%_20%,var(--primary-soft),var(--surface-2))]",
        size === "sm" && "size-12 rounded-xl",
        size === "md" && "aspect-[5/4] w-full rounded-xl",
        size === "lg" && "aspect-square w-full rounded-3xl",
        className,
      )}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          sizes={size === "lg" ? "(min-width: 768px) 360px, 90vw" : size === "md" ? "(min-width: 768px) 200px, 45vw" : "48px"}
          className="object-contain p-2"
          priority={priority}
        />
      ) : (
        createElement(icon, {
          "aria-hidden": true,
          className: cn("text-primary/70", size === "sm" && "size-6", size === "md" && "size-10", size === "lg" && "size-20"),
          strokeWidth: 1.6,
        })
      )}
    </div>
  );
}
