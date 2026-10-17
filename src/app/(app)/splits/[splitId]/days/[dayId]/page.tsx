import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getActiveSessionForUser, getDayForPicker, getOrCreateSession } from "@/lib/workouts";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { abandonSession } from "@/app/(app)/workout/[sessionId]/actions";
import { SlotPicker } from "./slot-picker";

// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ splitId: string; dayId: string }> }) {
  const user = await requireUser();
  const { splitId, dayId } = await params;
  const day = await getDayForPicker(dayId, user.id);
  if (!day || day.splitId !== splitId) notFound();

  // Only one non-terminal workout allowed per account. If one's already going
  // for a different day, send the user there instead of starting a second.
  const activeElsewhere = await getActiveSessionForUser(user.id);
  if (activeElsewhere && activeElsewhere.dayId !== dayId) {
    return (
      <div className="grid gap-6">
        <Link href={`/splits/${splitId}`} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> {day.split.name}
        </Link>
        <PageHeader title={day.title} />
        <div className="grid gap-3 rounded-xl bg-neutral-900 p-4">
          <p className="font-medium">You have a workout in progress</p>
          <p className="text-sm text-muted-foreground">
            {activeElsewhere.dayTitle} · {activeElsewhere.splitName}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="sm">
              <Link href={`/workout/${activeElsewhere.id}`}>Continue that workout</Link>
            </Button>
            {activeElsewhere.status === "SELECTING" && (
              <form action={abandonSession.bind(null, activeElsewhere.id)}>
                <button type="submit" className="text-sm text-muted-foreground hover:text-destructive">
                  Cancel it instead
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  const session = await getOrCreateSession(user.id, day);

  return (
    <div className="grid gap-6 pb-20">
      <Link href={`/splits/${splitId}`} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> {day.split.name}
      </Link>
      <PageHeader
        title={day.title}
        action={
          <Button asChild variant="ghost" size="icon" aria-label="Edit day">
            <Link href={`/splits/${splitId}/days/${dayId}/edit`}>
              <Pencil />
            </Link>
          </Button>
        }
      />

      {day.groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          This day has no exercises yet.{" "}
          <Link href={`/splits/${splitId}/days/${dayId}/edit`} className="underline underline-offset-4">
            Add some
          </Link>
          .
        </p>
      )}

      <SlotPicker
        sessionId={session.id}
        sessionStatus={session.status === "ACTIVE" ? "ACTIVE" : "SELECTING"}
        groups={day.groups}
        initialExercises={session.exercises}
      />
    </div>
  );
}
