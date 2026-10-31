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

export async function updateGroupLabel(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const groupId = String(form.get("groupId"));
  const group = await ownedGroup(groupId, user.id);
  if (!group) return { error: "Group not found" };

  const parsed = groupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.exerciseGroup.update({ where: { id: groupId }, data: { label: parsed.data.label || null } });
  revalidatePath(editPath(group.day.splitId, group.day.id));
  return { ok: "Saved" };
}

export async function deleteGroup(form: FormData) {
  const user = await requireUser();
  const groupId = String(form.get("groupId"));
  const group = await ownedGroup(groupId, user.id);
  if (!group) return;

  // Close the gap so remaining groups stay numbered 1..n.
  const remaining = await db.exerciseGroup.findMany({
    where: { dayId: group.day.id, id: { not: groupId } },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  await db.$transaction([
    db.exerciseGroup.delete({ where: { id: groupId } }),
    ...remaining.map((g, i) => db.exerciseGroup.update({ where: { id: g.id }, data: { order: i + 1 } })),
  ]);
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
    startingWeight: z.coerce.number().min(0).max(1000).default(0),
  })
  .refine((d) => d.repCeiling >= d.repFloor, { message: "Rep ceiling must be ≥ rep floor", path: ["repCeiling"] });

// Every manual target is optional — leave any blank to set it during the workout (or never).
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().pipe(schema).optional());

const manualSchema = z
  .object({
    targetSets: optionalNumber(z.number().int().min(1).max(10)),
    targetReps: optionalNumber(z.number().int().min(1).max(100)),
    targetWeight: optionalNumber(z.number().min(0).max(1000)),
  })
  .transform((d) => ({
    targetSets: d.targetSets ?? null,
    targetReps: d.targetReps ?? null,
    targetWeight: d.targetWeight ?? null,
  }));

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
  loadType: z.enum(["WEIGHTED", "ASSISTED", "BODYWEIGHT"]),
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

  // Load type lives on the shared Exercise, not the slot — changing it affects
  // every split that uses this exercise. The old progression weight no longer
  // means anything under the new load type (e.g. assistance vs. added load),
  // so wipe it everywhere it's used; it reseeds from startingWeight next pick.
  const loadTypeChanged = base.data.loadType !== slot.exercise.loadType;

  await db.$transaction([
    db.exerciseSlot.update({
      where: { id: slot.id },
      data: {
        trackingMode: base.data.trackingMode,
        notes: base.data.notes || null,
        targetSets: rulebook?.targetSets ?? manual?.targetSets ?? null,
        repFloor: rulebook?.repFloor ?? null,
        repCeiling: rulebook?.repCeiling ?? null,
        repStep: rulebook?.repStep ?? null,
        weightStep: rulebook?.weightStep ?? null,
        startingWeight: rulebook?.startingWeight ?? null,
        targetReps: manual?.targetReps ?? null,
        targetWeight: manual?.targetWeight ?? null,
      },
    }),
    ...(loadTypeChanged
      ? [
          db.exercise.update({ where: { id: slot.exerciseId }, data: { loadType: base.data.loadType } }),
          db.slotProgress.deleteMany({ where: { slot: { exerciseId: slot.exerciseId } } }),
        ]
      : []),
  ]);
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
