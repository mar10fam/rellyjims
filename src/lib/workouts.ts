import "server-only";
import { db } from "./db";
import { initialState, type Rulebook } from "./progression";

// ───────────────────────────── Day picker ─────────────────────────────

export function getDayForPicker(dayId: string, ownerId: string) {
  return db.splitDay.findFirst({
    where: { id: dayId, split: { ownerId } },
    include: {
      split: { select: { id: true, name: true } },
      groups: {
        orderBy: { order: "asc" },
        include: {
          slots: {
            orderBy: { order: "asc" },
            include: { exercise: true, progress: true },
          },
        },
      },
    },
  });
}

/** Reuse an in-progress session for this day, or start a new one in SELECTING. */
export async function getOrCreateSession(
  userId: string,
  day: { id: string; splitId: string; title: string; split: { name: string } },
) {
  const existing = await db.workoutSession.findFirst({
    where: { userId, dayId: day.id, status: { in: ["SELECTING", "ACTIVE"] } },
    orderBy: { startedAt: "desc" },
    include: { exercises: true },
  });
  if (existing) return existing;

  return db.workoutSession.create({
    data: {
      userId,
      splitId: day.splitId,
      dayId: day.id,
      splitName: day.split.name,
      dayTitle: day.title,
      status: "SELECTING",
    },
    include: { exercises: true },
  });
}

/** Seed (or confirm) where progression currently stands for a slot, the first time it's picked. */
export async function ensureSlotProgress(slot: {
  id: string;
  targetSets: number | null;
  repFloor: number | null;
  repCeiling: number | null;
  repStep: number | null;
  weightStep: number | null;
  startingWeight: number | null;
  deloadAfterFails: number;
  deloadPercent: number;
  exercise: { loadType: "WEIGHTED" | "ASSISTED" | "BODYWEIGHT" };
}) {
  const existing = await db.slotProgress.findUnique({ where: { slotId: slot.id } });
  if (existing) return existing;

  const rules = slotRulebook(slot);
  const start = initialState(rules, slot.startingWeight ?? 0);
  return db.slotProgress.create({
    data: { slotId: slot.id, sets: start.sets, reps: start.reps, weight: start.weight },
  });
}

export function slotRulebook(slot: {
  targetSets: number | null;
  repFloor: number | null;
  repCeiling: number | null;
  repStep: number | null;
  weightStep: number | null;
  deloadAfterFails: number;
  deloadPercent: number;
  exercise: { loadType: "WEIGHTED" | "ASSISTED" | "BODYWEIGHT" };
}): Rulebook {
  return {
    loadType: slot.exercise.loadType,
    targetSets: slot.targetSets!,
    repFloor: slot.repFloor!,
    repCeiling: slot.repCeiling!,
    repStep: slot.repStep!,
    weightStep: slot.weightStep!,
    deloadAfterFails: slot.deloadAfterFails,
    deloadPercent: slot.deloadPercent,
  };
}

// ───────────────────────────── Active session / report ─────────────────────────────

/**
 * The account's one allowed non-terminal session, if any — SELECTING or ACTIVE,
 * regardless of which day it's for. Only one may exist at a time; callers use
 * this to block starting a second one and to link back to it from anywhere.
 */
export function getActiveSessionForUser(userId: string) {
  return db.workoutSession.findFirst({
    where: { userId, status: { in: ["SELECTING", "ACTIVE"] } },
    orderBy: { startedAt: "desc" },
  });
}

/** Where a SELECTING session's picker lives, or null if it's missing its split/day (deleted since). */
export function pickerHref(session: { splitId: string | null; dayId: string | null }) {
  return session.splitId && session.dayId ? `/splits/${session.splitId}/days/${session.dayId}` : null;
}

export function ownedSession(sessionId: string, userId: string) {
  return db.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: {
          exercise: { select: { loadType: true, perSide: true } },
          slot: { select: { repFloor: true, repCeiling: true } },
        },
      },
    },
  });
}

export function ownedSessionExercise(sessionExerciseId: string, userId: string) {
  return db.sessionExercise.findFirst({
    where: { id: sessionExerciseId, session: { userId } },
    include: { session: true, slot: { include: { exercise: true } } },
  });
}
