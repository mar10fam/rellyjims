import "server-only";
import { db } from "./db";

// ───────────────────────────── Ownership-scoped loaders ─────────────────────────────
// Every query here is filtered by ownerId so a signed-in user can only ever
// read or act on their own splits — the id alone is never enough.

export function getSplitWithDays(splitId: string, ownerId: string) {
  return db.split.findFirst({
    where: { id: splitId, ownerId },
    include: { days: { orderBy: { order: "asc" } } },
  });
}

export function getDayWithGroups(dayId: string, ownerId: string) {
  return db.splitDay.findFirst({
    where: { id: dayId, split: { ownerId } },
    include: {
      split: { select: { id: true, name: true } },
      groups: {
        orderBy: { order: "asc" },
        include: { slots: { orderBy: { order: "asc" }, include: { exercise: true } } },
      },
    },
  });
}

export function ownedSplit(splitId: string, ownerId: string) {
  return db.split.findFirst({ where: { id: splitId, ownerId } });
}

export function ownedDay(dayId: string, ownerId: string) {
  return db.splitDay.findFirst({ where: { id: dayId, split: { ownerId } } });
}

export function ownedGroup(groupId: string, ownerId: string) {
  return db.exerciseGroup.findFirst({
    where: { id: groupId, day: { split: { ownerId } } },
    include: { day: { select: { id: true, splitId: true } } },
  });
}

export function ownedSlot(slotId: string, ownerId: string) {
  return db.exerciseSlot.findFirst({
    where: { id: slotId, group: { day: { split: { ownerId } } } },
    include: {
      exercise: true,
      group: { include: { day: { select: { id: true, splitId: true } } } },
    },
  });
}

// ───────────────────────────── Exercise library ─────────────────────────────

/** Reuse an existing exercise by name (case-insensitive) or add a new one to the library. */
export async function findOrCreateExercise(
  ownerId: string,
  name: string,
  loadType: "WEIGHTED" | "ASSISTED" | "BODYWEIGHT",
  perSide: boolean,
) {
  const trimmed = name.trim();
  const existing = await db.exercise.findFirst({
    where: { ownerId, name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return existing;
  return db.exercise.create({ data: { ownerId, name: trimmed, loadType, perSide } });
}

// ───────────────────────────── Reordering ─────────────────────────────

/** Swap `order` between an item and its up/down neighbor in an already-sorted list. */
export async function swapOrder<T extends { id: string; order: number }>(
  items: T[],
  targetId: string,
  direction: "up" | "down",
  update: (id: string, order: number) => Promise<unknown>,
) {
  const idx = items.findIndex((i) => i.id === targetId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) return;
  const a = items[idx];
  const b = items[swapIdx];
  await Promise.all([update(a.id, b.order), update(b.id, a.order)]);
}

export function nextOrder(max: number | null | undefined) {
  return (max ?? 0) + 1;
}
