"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { findOrCreateExercise, nextOrder, ownedSplit } from "@/lib/splits";
import type { ParsedDay } from "@/lib/import-notes";

export type ImportResult = { error: string } | undefined;

// Sane rulebook defaults for fields the plain-text format never specifies.
const DEFAULT_REP_RANGE = 4; // repCeiling = repFloor + this, when no range was given
const DEFAULT_REP_STEP = 1;
const DEFAULT_WEIGHT_STEP = 5;

export async function createDaysFromImport(splitId: string, days: ParsedDay[]): Promise<ImportResult> {
  const user = await requireUser();
  if (days.length === 0) return { error: "Nothing to import" };
  const split = await ownedSplit(splitId, user.id);
  if (!split) return { error: "Split not found" };

  const maxDay = await db.splitDay.aggregate({ where: { splitId }, _max: { order: true } });
  let dayOrder = nextOrder(maxDay._max.order);

  for (const day of days) {
    const createdDay = await db.splitDay.create({
      data: { splitId, order: dayOrder++, title: day.title, notes: day.notes ?? null },
    });

    let groupOrder = 1;
    for (const group of day.groups) {
      const createdGroup = await db.exerciseGroup.create({
        data: { dayId: createdDay.id, order: groupOrder++, label: null },
      });

      let slotOrder = 1;
      for (const slot of group.slots) {
        const exercise = await findOrCreateExercise(user.id, slot.name, "WEIGHTED", slot.perSide);
        const hasRulebook = slot.sets != null && slot.repFloor != null;

        const createdSlot = await db.exerciseSlot.create({
          data: {
            groupId: createdGroup.id,
            exerciseId: exercise.id,
            order: slotOrder++,
            trackingMode: hasRulebook ? "PROGRESSIVE" : "MANUAL",
            notes: slot.notes ?? null,
            targetSets: hasRulebook ? slot.sets : null,
            repFloor: hasRulebook ? slot.repFloor : null,
            repCeiling: hasRulebook ? (slot.repCeiling ?? slot.repFloor! + DEFAULT_REP_RANGE) : null,
            repStep: hasRulebook ? DEFAULT_REP_STEP : null,
            weightStep: hasRulebook ? DEFAULT_WEIGHT_STEP : null,
          },
        });

        if (hasRulebook) {
          await db.slotProgress.create({
            data: { slotId: createdSlot.id, sets: slot.sets!, reps: slot.repFloor!, weight: slot.weight ?? 0 },
          });
        }
      }
    }
  }

  revalidatePath(`/splits/${splitId}`);
  redirect(`/splits/${splitId}`);
}
