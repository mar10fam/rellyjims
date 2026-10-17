"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NavTabLink } from "./nav-tab-link";

// `icon` takes a rendered element, not a component reference — a component
// reference (e.g. a Lucide icon) is a function and can't cross the Server →
// Client boundary as a prop, only an already-rendered element can.
export function NavTab({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return <NavTabLink href={href} label={label} icon={icon} active={active} />;
}
