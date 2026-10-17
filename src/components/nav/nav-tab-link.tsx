import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Pure presentational tab: no hooks, so it's safe to render both from the
// pathname-aware client component and from its (non-active) Suspense fallback.
export function NavTabLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
