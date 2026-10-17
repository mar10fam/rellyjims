import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getDayWithGroups } from "@/lib/splits";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { createGroup } from "./actions";
import { EditDayForm } from "./edit-day-form";
import { GroupList } from "./group-list";

// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ splitId: string; dayId: string }> }) {
  const user = await requireUser();
  const { splitId, dayId } = await params;
  const day = await getDayWithGroups(dayId, user.id);
  if (!day || day.splitId !== splitId) notFound();

  const exercises = await db.exercise.findMany({
    where: { ownerId: user.id },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const exerciseNames = exercises.map((e) => e.name);

  return (
    <div className="grid gap-6">
      <Link
        href={`/splits/${splitId}/days/${dayId}`}
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Back to {day.title}
      </Link>
      <PageHeader title={day.title} />

      <EditDayForm day={day} />

      <section className="grid gap-4">
        <GroupList dayId={day.id} groups={day.groups} exerciseNames={exerciseNames} />
        <form action={createGroup}>
          <input type="hidden" name="dayId" value={day.id} />
          <input
            name="label"
            placeholder="New group label (optional)"
            className="mb-2 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-neutral-800 py-2 text-sm font-medium text-neutral-100"
          >
            + Add group
          </button>
        </form>
      </section>
    </div>
  );
}
