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
  /**
   * Weight actually used this time, for a quick Hold/Graduate tap (no full
   * actual-input panel involved) — e.g. the gym didn't have the planned
   * plates. Becomes the new progression baseline, same as a custom actual
   * weight would, but leaves sets/reps to follow the outcome's normal rules.
   */
  weightOverride?: number;
  /** Same idea as weightOverride, for sets/reps changed mid-workout. */
  setsOverride?: number;
  repsOverride?: number;
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
  if (input.weightOverride !== undefined && input.weightOverride < 0) {
    return { ok: false, error: "Weight can't be negative" };
  }
  if (
    (input.setsOverride !== undefined && (!Number.isInteger(input.setsOverride) || input.setsOverride < 1)) ||
    (input.repsOverride !== undefined &&
      (!Number.isInteger(input.repsOverride) ||
        input.repsOverride < rules.repFloor ||
        input.repsOverride > rules.repCeiling))
  ) {
    return { ok: false, error: "Invalid sets or reps" };
  }
  const cur = {
    sets: input.setsOverride ?? progress.sets,
    reps: input.repsOverride ?? progress.reps,
    weight: input.weightOverride ?? progress.weight,
    failStreak: progress.failStreak,
  };

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

  // Weight is free-form, but reps must stay inside the rulebook's range — a
  // mirror of the client-side check in ActualInput, enforced again here since
  // this action can be called directly.
  if (actual && (actual.reps < rules.repFloor || actual.reps > rules.repCeiling)) {
    return { ok: false, error: `Reps must be between ${rules.repFloor} and ${rules.repCeiling}` };
  }

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
    include: {
      exercise: { select: { loadType: true, perSide: true } },
      slot: { select: { repFloor: true, repCeiling: true } },
    },
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

/** Bail on a session, logged progress and all — frees the account up to start a different day. */
export async function abandonSession(sessionId: string) {
  const user = await requireUser();
  const session = await db.workoutSession.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!session || session.status === "COMPLETED" || session.status === "ABANDONED") return;

  await db.workoutSession.update({ where: { id: sessionId }, data: { status: "ABANDONED", completedAt: new Date() } });
  revalidatePath("/");
  if (session.splitId && session.dayId) revalidatePath(`/splits/${session.splitId}/days/${session.dayId}`);
}

/** Same as abandonSession, but leaves the (now-dead) workout screen for home instead of re-rendering in place. */
export async function cancelActiveWorkout(sessionId: string) {
  await abandonSession(sessionId);
  redirect("/");
}
