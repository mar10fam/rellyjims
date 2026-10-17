"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { findOrCreateExercise, ownedSplit } from "@/lib/splits";
import { ownedShare } from "@/lib/shares";

export async function sendShare(form: FormData) {
  const user = await requireUser();
  const splitId = String(form.get("splitId"));
  const toUserId = String(form.get("toUserId"));
  if (!splitId || !toUserId || toUserId === user.id) return;

  const [split, toUser] = await Promise.all([
    ownedSplit(splitId, user.id),
    db.user.findUnique({ where: { id: toUserId }, select: { id: true } }),
  ]);
  if (!split || !toUser) return;

  const existing = await db.splitShare.findFirst({ where: { splitId, toUserId, status: "PENDING" } });
  if (existing) return;

  await db.splitShare.create({ data: { splitId, fromUserId: user.id, toUserId } });
  revalidatePath(`/splits/${splitId}`);
  revalidatePath("/shares");
}

// Accepting copies only the exercise structure (days, groups, which exercise
// fills each slot) into the recipient's own library/split. Every slot lands as
// MANUAL tracking with no rulebook and no progress, so the new owner logs their
// own weights from scratch rather than inheriting the sender's numbers.
export async function acceptShare(shareId: string) {
  const user = await requireUser();
  const share = await ownedShare(shareId, user.id);
  if (!share) return;

  const newSplit = await db.split.create({
    data: {
      ownerId: user.id,
      name: share.split.name,
      description: share.split.description,
      copiedFromSplitId: share.split.id,
    },
  });

  for (const day of share.split.days) {
    const newDay = await db.splitDay.create({
      data: { splitId: newSplit.id, order: day.order, title: day.title, notes: day.notes },
    });

    for (const group of day.groups) {
      const newGroup = await db.exerciseGroup.create({
        data: { dayId: newDay.id, order: group.order, label: group.label },
      });

      for (const slot of group.slots) {
        const exercise = await findOrCreateExercise(
          user.id,
          slot.exercise.name,
          slot.exercise.loadType,
          slot.exercise.perSide,
        );
        await db.exerciseSlot.create({
          data: {
            groupId: newGroup.id,
            exerciseId: exercise.id,
            order: slot.order,
            trackingMode: "MANUAL",
            notes: slot.notes,
          },
        });
      }
    }
  }

  await db.splitShare.update({ where: { id: shareId }, data: { status: "ACCEPTED", respondedAt: new Date() } });

  revalidatePath("/shares");
  revalidatePath("/");
}

export async function declineShare(shareId: string) {
  const user = await requireUser();
  const share = await db.splitShare.findFirst({ where: { id: shareId, toUserId: user.id, status: "PENDING" } });
  if (!share) return;

  await db.splitShare.update({ where: { id: shareId }, data: { status: "DECLINED", respondedAt: new Date() } });
  revalidatePath("/shares");
}
