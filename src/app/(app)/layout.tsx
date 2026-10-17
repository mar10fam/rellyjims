import Link from "next/link";
import { Suspense } from "react";
import { BottomNav } from "@/components/nav/bottom-nav";
import { AdminTab } from "@/components/nav/admin-tab";
import { SignOutButton } from "./sign-out-button";

// Cache Components: the header and bottom nav shell are static; anything that
// reads the session (the admin tab) streams in behind a Suspense boundary
// (pages themselves are wrapped by ./loading.tsx).
//
// Every page under here calls requireUser() directly (not behind its own
// Suspense boundary), which the instant-navigation validator flags on every
// route. Restructuring every page to defer that read is a real but separate
// chunk of work with little payoff for a single/two-user app — opt the whole
// tree out instead. Dev-only diagnostic; doesn't affect production behavior.
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col md:max-w-xl">
      <header className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-black tracking-tight">
          rellyjims
        </Link>
        <SignOutButton />
      </header>
      <main className="flex-1 px-4 pb-24">{children}</main>
      <BottomNav>
        <Suspense>
          <AdminTab />
        </Suspense>
      </BottomNav>
    </div>
  );
}
