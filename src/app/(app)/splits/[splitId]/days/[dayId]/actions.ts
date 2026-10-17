"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ensureSlotProgress } from "@/lib/workouts";

/**
 * Commit a whole batch of slot picks at once. The picker keeps selection purely
 * client-side (instant checkbox taps, no round trip per tap) and only calls this
 * — once, with the full diff — when the user navigates away or starts the workout,
 * so the UI never waits on the network while picking.
 */
export async function syncSelection(sessionId: string, addSlotIds: string[], removeSlotIds: string[]) {
  const user = await requireUser();
  const session = await db.workoutSession.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!session || session.status === "COMPLETED" || session.status === "ABANDONED") return;

  if (removeSlotIds.length) {
    await db.sessionExercise.deleteMany({
      where: { sessionId, slotId: { in: removeSlotIds }, outcome: "PENDING" },
    });
  }

  if (addSlotIds.length) {
    const already = await db.sessionExercise.findMany({
      where: { sessionId, slotId: { in: addSlotIds } },
      select: { slotId: true },
    });
    const skip = new Set(already.map((e) => e.slotId));
    const toCreate = addSlotIds.filter((id) => !skip.has(id));

    const slots = await db.exerciseSlot.findMany({
      where: { id: { in: toCreate }, group: { day: { split: { ownerId: user.id } } } },
      include: { exercise: true, group: true },
    });

    for (const slot of slots) {
      let plannedSets: number | null = null;
      let plannedReps: number | null = null;
      let plannedWeight: number | null = null;
      if (slot.trackingMode === "PROGRESSIVE") {
        const progress = await ensureSlotProgress(slot);
        plannedSets = progress.sets;
        plannedReps = progress.reps;
        plannedWeight = progress.weight;
      }

      // Default order follows the day's own group/slot layout, not pick order —
      // reordering afterward (reorderSessionExercises, below) is what's for "switch it up."
      await db.sessionExercise.create({
        data: {
          sessionId,
          slotId: slot.id,
          exerciseId: slot.exerciseId,
          exerciseName: slot.exercise.name,
          order: slot.group.order * 1000 + slot.order,
          trackingMode: slot.trackingMode,
          plannedSets,
          plannedReps,
          plannedWeight,
        },
      });
    }
  }

  revalidatePath(`/splits/${session.splitId}/days/${session.dayId}`);
  if (session.status === "ACTIVE") revalidatePath(`/workout/${sessionId}`);
}

/**
 * Drag-and-drop reorder of today's still-pending picks. `orderedIds` is the
 * full new sequence of pending sessionExercise ids; completed ones keep their
 * spot. Reuses the pending set's existing `order` values (sorted) so the
 * interleaving with any already-completed entries doesn't shift around.
 */
export async function reorderSessionExercises(sessionId: string, orderedIds: string[]) {
  const user = await requireUser();
  const session = await db.workoutSession.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!session) return;

  const pending = await db.sessionExercise.findMany({
    where: { sessionId, outcome: "PENDING" },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const pendingIds = new Set(pending.map((p) => p.id));
  const newSequence = orderedIds.filter((id) => pendingIds.has(id));
  if (newSequence.length !== pending.length) return; // stale client state — ignore

  const slots = pending.map((p) => p.order);
  await db.$transaction(newSequence.map((id, i) => db.sessionExercise.update({ where: { id }, data: { order: slots[i] } })));
  revalidatePath(`/splits/${session.splitId}/days/${session.dayId}`);
}

export async function startWorkout(sessionId: string) {
  const user = await requireUser();
  const session = await db.workoutSession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { exercises: true },
  });
  if (!session || session.exercises.length === 0) return;

  if (session.status === "SELECTING") {
    await db.workoutSession.update({ where: { id: sessionId }, data: { status: "ACTIVE", startedAt: new Date() } });
  }
  redirect(`/workout/${sessionId}`);
}
