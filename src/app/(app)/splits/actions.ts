"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { nextOrder, ownedDay, ownedSplit } from "@/lib/splits";

export type ActionState = { ok?: string; error?: string } | null;

const splitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function createSplit(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = splitSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const split = await db.split.create({
    data: { ownerId: user.id, name: parsed.data.name, description: parsed.data.description || null },
  });
  redirect(`/splits/${split.id}`);
}

export async function updateSplit(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const splitId = String(form.get("splitId"));
  const parsed = splitSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await ownedSplit(splitId, user.id))) return { error: "Split not found" };

  await db.split.update({
    where: { id: splitId },
    data: { name: parsed.data.name, description: parsed.data.description || null },
  });
  revalidatePath(`/splits/${splitId}`);
  revalidatePath("/");
  return { ok: "Saved" };
}

export async function toggleFavorite(form: FormData) {
  const user = await requireUser();
  const splitId = String(form.get("splitId"));
  const split = await ownedSplit(splitId, user.id);
  if (!split) return;

  await db.split.update({
    where: { id: splitId },
    data: { favoritedAt: split.favoritedAt ? null : new Date() },
  });
  revalidatePath(`/splits/${splitId}`);
  revalidatePath("/");
}

export async function archiveSplit(form: FormData) {
  const user = await requireUser();
  const splitId = String(form.get("splitId"));
  if (!(await ownedSplit(splitId, user.id))) return;

  await db.split.update({ where: { id: splitId }, data: { archived: true } });
  revalidatePath("/");
  redirect("/");
}

// ───────────────────────────── Days ─────────────────────────────

const daySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(60),
});

export async function createDay(form: FormData) {
  const user = await requireUser();
  const splitId = String(form.get("splitId"));
  if (!(await ownedSplit(splitId, user.id))) return;
  const parsed = daySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;

  const max = await db.splitDay.aggregate({ where: { splitId }, _max: { order: true } });
  await db.splitDay.create({
    data: {
      splitId,
      order: nextOrder(max._max.order),
      title: parsed.data.title,
    },
  });
  revalidatePath(`/splits/${splitId}`);
}

export async function updateDay(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const dayId = String(form.get("dayId"));
  const day = await ownedDay(dayId, user.id);
  if (!day) return { error: "Day not found" };
  const parsed = daySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.splitDay.update({
    where: { id: dayId },
    data: { title: parsed.data.title },
  });
  revalidatePath(`/splits/${day.splitId}`);
  revalidatePath(`/splits/${day.splitId}/days/${dayId}/edit`);
  return { ok: "Saved" };
}

export async function deleteDay(form: FormData) {
  const user = await requireUser();
  const dayId = String(form.get("dayId"));
  const day = await ownedDay(dayId, user.id);
  if (!day) return;

  await db.splitDay.delete({ where: { id: dayId } });
  revalidatePath(`/splits/${day.splitId}`);
}

/** Drag-and-drop reorder: `orderedIds` is the full new day sequence for this split. */
export async function reorderDays(splitId: string, orderedIds: string[]) {
  const user = await requireUser();
  if (!(await ownedSplit(splitId, user.id))) return;

  const days = await db.splitDay.findMany({ where: { splitId }, select: { id: true } });
  const dayIds = new Set(days.map((d) => d.id));
  if (orderedIds.length !== days.length || !orderedIds.every((id) => dayIds.has(id))) return; // stale client state — ignore

  await db.$transaction(orderedIds.map((id, i) => db.splitDay.update({ where: { id }, data: { order: i + 1 } })));
  revalidatePath(`/splits/${splitId}`);
}
