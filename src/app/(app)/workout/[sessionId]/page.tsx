import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDayForPicker, ownedSession } from "@/lib/workouts";
import { PageHeader } from "@/components/page-header";
import { WorkoutCarousel } from "./workout-carousel";
import { FinishButton } from "./finish-button";
import type { PoolSlot } from "./other-exercises";

// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser();
  const { sessionId } = await params;
  const session = await ownedSession(sessionId, user.id);
  if (!session) notFound();

  if (session.status === "SELECTING") {
    redirect(session.splitId && session.dayId ? `/splits/${session.splitId}/days/${session.dayId}` : "/");
  }
  if (session.status === "COMPLETED" || session.status === "ABANDONED") {
    redirect(`/workout/${sessionId}/report`);
  }

  const pickerHref = session.splitId && session.dayId ? `/splits/${session.splitId}/days/${session.dayId}` : null;

  const day = session.dayId ? await getDayForPicker(session.dayId, user.id) : null;
  const otherSlots: PoolSlot[] =
    day?.groups.flatMap((group) =>
      group.slots.map((slot) => ({
        id: slot.id,
        order: slot.order,
        groupOrder: group.order,
        exercise: { name: slot.exercise.name, loadType: slot.exercise.loadType, perSide: slot.exercise.perSide },
      })),
    ) ?? [];

  return (
    <div className="grid gap-4">
      <PageHeader
        title={session.dayTitle}
        action={
          <FinishButton sessionId={session.id} variant="ghost" size="sm">
            Finish
          </FinishButton>
        }
      />
      <p className="-mt-3 text-sm text-muted-foreground">{session.splitName}</p>
      <WorkoutCarousel
        sessionId={session.id}
        exercises={session.exercises}
        otherSlots={otherSlots}
        pickerHref={pickerHref}
      />
    </div>
  );
}
