"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { loadTypeLabel } from "@/lib/progression";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { syncSelection, startWorkout } from "./actions";
import { TodaysOrder } from "./today-order";

type Slot = {
  id: string;
  trackingMode: "PROGRESSIVE" | "MANUAL";
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  repFloor: number | null;
  repCeiling: number | null;
  progress: { sets: number; reps: number; weight: number } | null;
  exercise: { name: string; perSide: boolean; loadType: "WEIGHTED" | "ASSISTED" | "BODYWEIGHT" };
};

type Group = { id: string; order: number; label: string | null; slots: Slot[] };

type ExistingExercise = { id: string; slotId: string | null; outcome: string; exerciseName: string; order: number };

export function SlotPicker({
  sessionId,
  sessionStatus,
  groups,
  initialExercises,
}: {
  sessionId: string;
  sessionStatus: "SELECTING" | "ACTIVE";
  groups: Group[];
  initialExercises: ExistingExercise[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [starting, setStarting] = useState(false);

  // Locked entries (already completed mid-workout) aren't part of the local
  // toggle state at all — they're rendered straight from server data and can't
  // be un-picked here.
  const locked = new Map(
    initialExercises.filter((e) => e.outcome !== "PENDING" && e.slotId).map((e) => [e.slotId as string, e]),
  );

  const initialPendingSlotIds = initialExercises.filter((e) => e.outcome === "PENDING" && e.slotId).map((e) => e.slotId as string);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialPendingSlotIds));

  // The last-synced baseline, used to compute the add/remove diff when we flush.
  // Kept in a ref (not state) since it only needs to be read imperatively on flush.
  const baselineRef = useRef<Set<string>>(new Set(initialPendingSlotIds));
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  function diff() {
    const add = [...selectedRef.current].filter((id) => !baselineRef.current.has(id));
    const remove = [...baselineRef.current].filter((id) => !selectedRef.current.has(id));
    return { add, remove };
  }

  function flush() {
    const { add, remove } = diff();
    if (!add.length && !remove.length) return;
    baselineRef.current = new Set(selectedRef.current);
    syncSelection(sessionId, add, remove);
  }

  // Selection only lives on the client while picking — commit it the moment the
  // user navigates away from this page (any route change unmounts this
  // component), so it's never lost and never costs a round trip per tap.
  useEffect(() => {
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function toggle(slotId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }

  function handleStart() {
    setStarting(true);
    startTransition(async () => {
      const { add, remove } = diff();
      baselineRef.current = new Set(selectedRef.current);
      if (add.length || remove.length) {
        await syncSelection(sessionId, add, remove);
      }
      await startWorkout(sessionId);
    });
  }

  function handleContinue() {
    setStarting(true);
    startTransition(async () => {
      const { add, remove } = diff();
      baselineRef.current = new Set(selectedRef.current);
      if (add.length || remove.length) {
        await syncSelection(sessionId, add, remove);
      }
      router.push(`/workout/${sessionId}`);
    });
  }

  return (
    <>
      {initialExercises.length > 0 && <TodaysOrder sessionId={sessionId} exercises={initialExercises} />}

      <div className="grid gap-4">
        {groups.map((group, i) => (
          <section key={group.id} className="grid gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Group {i + 1}
              {group.label && ` · ${group.label}`}
            </h2>
            <ul className="grid gap-2">
              {group.slots.map((slot) => {
                const lockedEntry = locked.get(slot.id);
                const isSelected = !!lockedEntry || selected.has(slot.id);
                return (
                  <li key={slot.id}>
                    <button
                      type="button"
                      disabled={!!lockedEntry}
                      onClick={() => toggle(slot.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${
                        isSelected ? "bg-primary/15 ring-1 ring-primary/40" : "bg-neutral-900 active:bg-neutral-800"
                      } ${lockedEntry ? "opacity-70" : ""}`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-neutral-600"
                        }`}
                      >
                        {isSelected && <Check className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {slot.exercise.name}
                          {slot.exercise.perSide && <span className="text-muted-foreground"> (each)</span>}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline">{loadTypeLabel(slot.exercise.loadType)}</Badge>
                          <Badge variant={slot.trackingMode === "PROGRESSIVE" ? "default" : "secondary"}>
                            {plannedPreview(slot)}
                          </Badge>
                          {lockedEntry && <Badge variant="secondary">{outcomeLabel(lockedEntry.outcome)}</Badge>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md px-4 md:max-w-xl">
        {sessionStatus === "ACTIVE" ? (
          <Button className="w-full" size="lg" disabled={starting} onClick={handleContinue}>
            {starting ? "Saving…" : "Continue workout"}
          </Button>
        ) : (
          <Button className="w-full" size="lg" disabled={selected.size === 0 || starting} onClick={handleStart}>
            {starting ? "Starting…" : "Rellyjim"}
          </Button>
        )}
      </div>
    </>
  );
}

function plannedPreview(slot: {
  trackingMode: "PROGRESSIVE" | "MANUAL";
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  repFloor: number | null;
  repCeiling: number | null;
  progress: { sets: number; reps: number; weight: number } | null;
}) {
  if (slot.trackingMode === "MANUAL") {
    if (slot.targetSets == null || slot.targetReps == null) return "Manual";
    return `${slot.targetSets}×${slot.targetReps}${slot.targetWeight ? ` @ ${slot.targetWeight}` : ""}`;
  }
  if (slot.progress) return `${slot.progress.sets}×${slot.progress.reps}${slot.progress.weight ? ` @ ${slot.progress.weight}` : ""}`;
  return `${slot.targetSets}×${slot.repFloor}–${slot.repCeiling}`;
}

function outcomeLabel(outcome: string) {
  return { FAILED: "Flunk", HELD: "Held", GRADUATED: "Graduated", LOGGED: "Logged", SKIPPED: "Skipped" }[outcome] ?? outcome;
}
