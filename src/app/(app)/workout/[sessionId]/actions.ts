"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { applyOutcome, type ProgressOutcome } from "@/lib/progression";
import { ensureSlotProgress, ownedSession, ownedSessionExercise, slotRulebook } from "@/lib/workouts";
import { ownedSlot } from "@/lib/splits";

export type SubmitResult =
  | {
      ok: true;
      next?: { sets: number; reps: number; weight: number };
      direction?: -1 | 0 | 1;
      deloadSuggestion?: { sets: number; reps: number; weight: number };
    }
  | { ok: false; error: string };

export async function submitOutcome(input: {
  sessionExerciseId: string;
  outcome: "HELD" | "GRADUATED" | "FAILED" | "LOGGED";
  actualSets?: number;
  actualReps?: number;
  actualWeight?: number;
}): Promise<SubmitResult> {
  const user = await requireUser();
  const ex = await ownedSessionExercise(input.sessionExerciseId, user.id);
  if (!ex) return { ok: false, error: "Not found" };
  if (ex.outcome !== "PENDING") return { ok: true };

  if (input.outcome === "LOGGED") {
    await db.sessionExercise.update({
      where: { id: ex.id },
      data: {
        outcome: "LOGGED",
        actualSets: input.actualSets ?? null,
        actualReps: input.actualReps ?? null,
        actualWeight: input.actualWeight ?? null,
        completedAt: new Date(),
      },
    });
    revalidatePath(`/workout/${ex.sessionId}`);
    return { ok: true };
  }

  if (!ex.slot) return { ok: false, error: "This exercise option was removed from the split" };

  const rules = slotRulebook(ex.slot);
  const progress = await ensureSlotProgress(ex.slot);
  const cur = { sets: progress.sets, reps: progress.reps, weight: progress.weight, failStreak: progress.failStreak };

  // Present whenever the client went through the editable confirm step — always
  // for FAILED, optionally for GRADUATED (a manual/partial graduation). A plain
  // tap on "Graduate" sends no actual values, leaving this undefined so
  // applyOutcome falls back to the mechanical rep/weight-step bump.
  const actual =
    input.actualSets !== undefined
      ? {
          sets: input.actualSets ?? cur.sets,
          reps: input.actualReps ?? cur.reps,
          weight: input.actualWeight ?? cur.weight,
        }
      : undefined;

  const result = applyOutcome(rules, cur, input.outcome as ProgressOutcome, actual);

  await db.$transaction([
    db.slotProgress.update({
      where: { slotId: ex.slot.id },
      data: {
        sets: result.next.sets,
        reps: result.next.reps,
        weight: result.next.weight,
        failStreak: result.next.failStreak,
      },
    }),
    db.sessionExercise.update({
      where: { id: ex.id },
      data: {
        outcome: input.outcome,
        actualSets: actual?.sets ?? cur.sets,
        actualReps: actual?.reps ?? cur.reps,
        actualWeight: actual?.weight ?? cur.weight,
        nextSets: result.next.sets,
        nextReps: result.next.reps,
        nextWeight: result.next.weight,
        direction: result.direction,
        completedAt: new Date(),
      },
    }),
  ]);

  revalidatePath(`/workout/${ex.sessionId}`);
  return { ok: true, next: result.next, direction: result.direction, deloadSuggestion: result.deloadSuggestion };
}

/** Take a still-pending exercise out of today's session entirely (not a soft "skipped" outcome). */
export async function removeExercise(sessionExerciseId: string) {
  const user = await requireUser();
  const ex = await ownedSessionExercise(sessionExerciseId, user.id);
  if (!ex || ex.outcome !== "PENDING") return;
  await db.sessionExercise.delete({ where: { id: ex.id } });
  revalidatePath(`/workout/${ex.sessionId}`);
}

/** Add one more exercise option mid-workout — the live-session counterpart of the picker's syncSelection. */
export async function addExerciseToSession(sessionId: string, slotId: string) {
  const user = await requireUser();
  const session = await db.workoutSession.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!session || session.status === "COMPLETED" || session.status === "ABANDONED") return null;

  const slot = await ownedSlot(slotId, user.id);
  if (!slot) return null;

  const existing = await db.sessionExercise.findFirst({ where: { sessionId, slotId } });
  if (existing) return null;

  let plannedSets: number | null = null;
  let plannedReps: number | null = null;
  let plannedWeight: number | null = null;
  if (slot.trackingMode === "PROGRESSIVE") {
    const progress = await ensureSlotProgress(slot);
    plannedSets = progress.sets;
    plannedReps = progress.reps;
    plannedWeight = progress.weight;
  } else {
    plannedSets = slot.targetSets;
    plannedReps = slot.targetReps;
    plannedWeight = slot.targetWeight;
  }

  const created = await db.sessionExercise.create({
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
    include: { exercise: { select: { loadType: true, perSide: true } } },
  });
  revalidatePath(`/workout/${sessionId}`);
  return created;
}

export async function finishWorkout(sessionId: string) {
  const user = await requireUser();
  const session = await ownedSession(sessionId, user.id);
  if (!session) return;

  await db.$transaction([
    db.sessionExercise.updateMany({
      where: { sessionId, outcome: "PENDING" },
      data: { outcome: "SKIPPED", completedAt: new Date() },
    }),
    db.workoutSession.update({ where: { id: sessionId }, data: { status: "COMPLETED", completedAt: new Date() } }),
  ]);
  redirect(`/workout/${sessionId}/report`);
}

/** Bail on a session with nothing logged yet — frees the account up to start a different day. */
export async function abandonSession(sessionId: string) {
  const user = await requireUser();
  const session = await db.workoutSession.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!session || session.status === "COMPLETED" || session.status === "ABANDONED") return;

  await db.workoutSession.update({ where: { id: sessionId }, data: { status: "ABANDONED", completedAt: new Date() } });
  revalidatePath("/");
  if (session.splitId && session.dayId) revalidatePath(`/splits/${session.splitId}/days/${session.dayId}`);
}
