import { Suspense, type ReactNode } from "react";
import { History, House, Users } from "lucide-react";
import { NavTab } from "./nav-tab";
import { NavTabLink } from "./nav-tab-link";

// Fixed to the bottom on every breakpoint — thumb-reachable on mobile, and still
// the primary nav on md+ since the app renders as a centered column there too.
export function BottomNav({ children }: { children?: ReactNode }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
      <div
        className="mx-auto flex max-w-md items-stretch justify-between md:max-w-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <SuspendedTab href="/" label="Home" icon={<House className="size-5" />} />
        <SuspendedTab href="/history" label="History" icon={<History className="size-5" />} />
        <SuspendedTab href="/shares" label="Shares" icon={<Users className="size-5" />} />
        {children}
      </div>
    </nav>
  );
}

// usePathname() can't resolve at prerender time, so the active-tab read is
// isolated behind Suspense; the fallback renders the same tab without the
// active highlight and swaps in the moment the client hook resolves.
function SuspendedTab({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Suspense fallback={<NavTabLink href={href} label={label} icon={icon} active={false} />}>
      <NavTab href={href} label={label} icon={icon} />
    </Suspense>
  );
}
