"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { findOrCreateExercise, nextOrder, ownedDay, ownedGroup, ownedSlot } from "@/lib/splits";

export type ActionState = { ok?: string; error?: string } | null;

function editPath(splitId: string, dayId: string) {
  return `/splits/${splitId}/days/${dayId}/edit`;
}

// ───────────────────────────── Groups ─────────────────────────────

const groupSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function createGroup(form: FormData) {
  const user = await requireUser();
  const dayId = String(form.get("dayId"));
  const day = await ownedDay(dayId, user.id);
  if (!day) return;
  const parsed = groupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;

  const max = await db.exerciseGroup.aggregate({ where: { dayId }, _max: { order: true } });
  await db.exerciseGroup.create({
    data: { dayId, order: nextOrder(max._max.order), label: parsed.data.label || null },
  });
  revalidatePath(editPath(day.splitId, dayId));
}

export async function deleteGroup(form: FormData) {
  const user = await requireUser();
  const groupId = String(form.get("groupId"));
  const group = await ownedGroup(groupId, user.id);
  if (!group) return;

  await db.exerciseGroup.delete({ where: { id: groupId } });
  revalidatePath(editPath(group.day.splitId, group.day.id));
}

/** Drag-and-drop reorder: `orderedIds` is the full new group sequence for this day. */
export async function reorderGroups(dayId: string, orderedIds: string[]) {
  const user = await requireUser();
  const day = await ownedDay(dayId, user.id);
  if (!day) return;

  const groups = await db.exerciseGroup.findMany({ where: { dayId }, select: { id: true } });
  const groupIds = new Set(groups.map((g) => g.id));
  if (orderedIds.length !== groups.length || !orderedIds.every((id) => groupIds.has(id))) return;

  await db.$transaction(orderedIds.map((id, i) => db.exerciseGroup.update({ where: { id }, data: { order: i + 1 } })));
  revalidatePath(editPath(day.splitId, dayId));
}

// ───────────────────────────── Slots ─────────────────────────────

const rulebookSchema = z
  .object({
    targetSets: z.coerce.number().int().min(1, "Required").max(10),
    repFloor: z.coerce.number().int().min(1, "Required").max(50),
    repCeiling: z.coerce.number().int().min(1, "Required").max(50),
    repStep: z.coerce.number().int().min(1, "Required").max(20),
    weightStep: z.coerce.number().min(0).max(500),
  })
  .refine((d) => d.repCeiling >= d.repFloor, { message: "Rep ceiling must be ≥ rep floor", path: ["repCeiling"] });

const manualSchema = z.object({
  targetSets: z.coerce.number().int().min(1, "Required").max(10),
  targetReps: z.coerce.number().int().min(1, "Required").max(100),
  targetWeight: z.coerce.number().min(0).max(1000),
});

const slotBaseSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1, "Exercise name is required").max(60),
  loadType: z.enum(["WEIGHTED", "ASSISTED", "BODYWEIGHT"]),
  perSide: z.string().optional(),
  trackingMode: z.enum(["PROGRESSIVE", "MANUAL"]),
  notes: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function createSlot(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const raw = Object.fromEntries(form);
  const base = slotBaseSchema.safeParse(raw);
  if (!base.success) return { error: base.error.issues[0].message };

  const group = await ownedGroup(base.data.groupId, user.id);
  if (!group) return { error: "Group not found" };

  let rulebook: z.infer<typeof rulebookSchema> | null = null;
  let manual: z.infer<typeof manualSchema> | null = null;
  if (base.data.trackingMode === "PROGRESSIVE") {
    const parsedRb = rulebookSchema.safeParse(raw);
    if (!parsedRb.success) return { error: parsedRb.error.issues[0].message };
    rulebook = parsedRb.data;
  } else {
    const parsedManual = manualSchema.safeParse(raw);
    if (!parsedManual.success) return { error: parsedManual.error.issues[0].message };
    manual = parsedManual.data;
  }

  const exercise = await findOrCreateExercise(user.id, base.data.name, base.data.loadType, base.data.perSide === "on");
  const max = await db.exerciseSlot.aggregate({ where: { groupId: group.id }, _max: { order: true } });

  await db.exerciseSlot.create({
    data: {
      groupId: group.id,
      exerciseId: exercise.id,
      order: nextOrder(max._max.order),
      trackingMode: base.data.trackingMode,
      notes: base.data.notes || null,
      ...(rulebook ?? {}),
      ...(manual ?? {}),
    },
  });
  revalidatePath(editPath(group.day.splitId, group.day.id));
  return { ok: "Added" };
}

const slotUpdateSchema = z.object({
  slotId: z.string().min(1),
  trackingMode: z.enum(["PROGRESSIVE", "MANUAL"]),
  notes: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function updateSlot(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const raw = Object.fromEntries(form);
  const base = slotUpdateSchema.safeParse(raw);
  if (!base.success) return { error: base.error.issues[0].message };

  const slot = await ownedSlot(base.data.slotId, user.id);
  if (!slot) return { error: "Exercise not found" };

  let rulebook: z.infer<typeof rulebookSchema> | null = null;
  let manual: z.infer<typeof manualSchema> | null = null;
  if (base.data.trackingMode === "PROGRESSIVE") {
    const parsedRb = rulebookSchema.safeParse(raw);
    if (!parsedRb.success) return { error: parsedRb.error.issues[0].message };
    rulebook = parsedRb.data;
  } else {
    const parsedManual = manualSchema.safeParse(raw);
    if (!parsedManual.success) return { error: parsedManual.error.issues[0].message };
    manual = parsedManual.data;
  }

  await db.exerciseSlot.update({
    where: { id: slot.id },
    data: {
      trackingMode: base.data.trackingMode,
      notes: base.data.notes || null,
      targetSets: rulebook?.targetSets ?? manual?.targetSets ?? null,
      repFloor: rulebook?.repFloor ?? null,
      repCeiling: rulebook?.repCeiling ?? null,
      repStep: rulebook?.repStep ?? null,
      weightStep: rulebook?.weightStep ?? null,
      targetReps: manual?.targetReps ?? null,
      targetWeight: manual?.targetWeight ?? null,
    },
  });
  revalidatePath(editPath(slot.group.day.splitId, slot.group.day.id));
  return { ok: "Saved" };
}

export async function deleteSlot(form: FormData) {
  const user = await requireUser();
  const slotId = String(form.get("slotId"));
  const slot = await ownedSlot(slotId, user.id);
  if (!slot) return;

  await db.exerciseSlot.delete({ where: { id: slotId } });
  revalidatePath(editPath(slot.group.day.splitId, slot.group.day.id));
}

/** Drag-and-drop reorder: `orderedIds` is the full new slot sequence for this group. */
export async function reorderSlots(groupId: string, orderedIds: string[]) {
  const user = await requireUser();
  const group = await ownedGroup(groupId, user.id);
  if (!group) return;

  const slots = await db.exerciseSlot.findMany({ where: { groupId }, select: { id: true } });
  const slotIds = new Set(slots.map((s) => s.id));
  if (orderedIds.length !== slots.length || !orderedIds.every((id) => slotIds.has(id))) return;

  await db.$transaction(orderedIds.map((id, i) => db.exerciseSlot.update({ where: { id }, data: { order: i + 1 } })));
  revalidatePath(editPath(group.day.splitId, group.day.id));
}
