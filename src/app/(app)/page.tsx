import Link from "next/link";
import { ArrowRight, Plus, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getActiveSessionForUser } from "@/lib/workouts";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Home: favorited splits pinned to the top, then the rest. Tap a split to open it.
// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function HomePage() {
  const user = await requireUser();
  const [splits, activeSession] = await Promise.all([
    db.split.findMany({
      where: { ownerId: user.id, archived: false },
      orderBy: [{ favoritedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      include: { _count: { select: { days: true } } },
    }),
    getActiveSessionForUser(user.id),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Hey ${user.name.split(" ")[0]}`}
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/splits/new">
              <Plus /> New split
            </Link>
          </Button>
        }
      />

      {activeSession && (
        // Links through /workout/[id], whose own redirect sends a still-SELECTING
        // session back to its picker — one fallback path instead of two.
        <Link href={`/workout/${activeSession.id}`} className="block">
          <Card className="flex-row items-center justify-between border border-primary/40 px-4 active:bg-neutral-800">
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Workout in progress</span>
              <span className="block truncate font-semibold">
                {activeSession.dayTitle} · {activeSession.splitName}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Card>
        </Link>
      )}

      {splits.length === 0 && (
        <p className="text-neutral-400">No splits yet. Create one, or paste your notes to import a whole program.</p>
      )}

      <div className="grid gap-3">
        {splits.map((s) => (
          <Link key={s.id} href={`/splits/${s.id}`} className="block">
            <Card className="flex-row items-center justify-between px-4 active:bg-neutral-800">
              <span className="flex items-center gap-2 font-semibold">
                {s.favoritedAt && <Star className="size-4 shrink-0 fill-primary text-primary" />}
                {s.name}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {s._count.days} day{s._count.days === 1 ? "" : "s"}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
