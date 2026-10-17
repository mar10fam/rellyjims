"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { loadTypeLabel, type LoadType } from "@/lib/progression";
import { addExerciseToSession } from "./actions";
import type { SessionExercise } from "./exercise-card";

export type PoolSlot = {
  id: string;
  order: number;
  groupOrder: number;
  exercise: { name: string; loadType: LoadType; perSide: boolean };
};

export function OtherExercises({
  sessionId,
  slots,
  onAdd,
}: {
  sessionId: string;
  slots: PoolSlot[];
  onAdd: (ex: SessionExercise) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing else left for today.</p>;
  }

  function add(slotId: string) {
    setPendingId(slotId);
    startTransition(async () => {
      const created = await addExerciseToSession(sessionId, slotId);
      setPendingId(null);
      if (created) onAdd(created);
    });
  }

  return (
    <ul className="grid gap-2">
      {slots.map((slot) => (
        <li key={slot.id}>
          <button
            type="button"
            disabled={pendingId === slot.id}
            onClick={() => add(slot.id)}
            className="flex w-full items-center gap-3 rounded-xl bg-neutral-800 px-4 py-3 text-left active:bg-neutral-700 disabled:opacity-60"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {slot.exercise.name}
                {slot.exercise.perSide && <span className="text-muted-foreground"> (each)</span>}
              </span>
              <Badge variant="outline" className="mt-1">
                {loadTypeLabel(slot.exercise.loadType)}
              </Badge>
            </span>
            <Plus className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}
