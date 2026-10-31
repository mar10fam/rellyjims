"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CancelActiveWorkoutLink } from "./cancel-session-button";
import { ExerciseCard, type SessionExercise } from "./exercise-card";
import { FinishButton } from "./finish-button";
import { OtherExercises, type PoolSlot } from "./other-exercises";
import { formatSetsRepsWeight } from "@/lib/utils";

export function WorkoutCarousel({
  sessionId,
  exercises: initialExercises,
  otherSlots,
  pickerHref,
}: {
  sessionId: string;
  exercises: SessionExercise[];
  otherSlots: PoolSlot[];
  pickerHref: string | null;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "center" });
  const [selected, setSelected] = useState(0);
  const [exercises, setExercises] = useState(initialExercises);
  const [addOpen, setAddOpen] = useState(false);
  // Which slide is currently showing, tracked by identity rather than index —
  // an add/remove/complete (locally, or via a server refetch that re-sorts by
  // `order`) changes what sits at a given index, so the index alone isn't a
  // stable anchor.
  const [currentId, setCurrentId] = useState(
    () => initialExercises.find((e) => e.outcome === "PENDING")?.id ?? null,
  );

  // Re-sync when the server gives us fresh data — adjusting state during render
  // rather than in an effect, since this is a prop->state reset, not a side effect.
  const [prevInitial, setPrevInitial] = useState(initialExercises);
  if (initialExercises !== prevInitial) {
    setPrevInitial(initialExercises);
    setExercises(initialExercises);
  }

  // Completed/skipped exercises never show up as swipeable cards — only what's
  // still left to do today.
  const pending = useMemo(() => exercises.filter((e) => e.outcome === "PENDING"), [exercises]);
  const done = useMemo(() => exercises.filter((e) => e.outcome !== "PENDING"), [exercises]);
  const pendingRef = useRef(pending);
  const usedSlotIds = new Set(exercises.map((e) => e.slotId).filter((id): id is string => !!id));
  const addable = otherSlots.filter((s) => !usedSlotIds.has(s.id));

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      setSelected(idx);
      setCurrentId(pendingRef.current[idx]?.id ?? null);
    };
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // The list changed — either a local add/remove/complete, or a server refetch
  // that re-sorted everything by `order`. Re-measure and jump (no animation)
  // back to whichever item was showing, so the user doesn't land on a
  // different exercise.
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
    const idx = currentId ? pending.findIndex((e) => e.id === currentId) : -1;
    const target = idx === -1 ? Math.min(selected, Math.max(pending.length - 1, 0)) : idx;
    // Jump (no animation) back to the same item; this re-fires the "select"
    // listener above when the snap index actually moved, keeping `selected` in sync.
    emblaApi.scrollTo(target, true);
    // Only the list identity should re-anchor the view — `currentId`/`selected` are
    // tracked here, not reacted to, to avoid fighting the user's own swipes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, emblaApi]);

  const advance = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  function handleRemove(id: string) {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  function handleDone(id: string, updates: Partial<SessionExercise>) {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    advance();
  }

  function handleAdd(ex: SessionExercise) {
    setExercises((prev) => [...prev, ex]);
    setAddOpen(false);
  }

  return (
    <div className="grid gap-3">
      {addable.length > 0 && (
        <div className="flex justify-end">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Add an exercise">
                <Plus />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add an exercise</DialogTitle>
              </DialogHeader>
              <OtherExercises sessionId={sessionId} slots={addable} onAdd={handleAdd} />
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {pending.length > 0 ? (
            pending.map((ex) => (
              <div key={ex.id} className="min-w-0 flex-[0_0_100%] px-0.5">
                <ExerciseCard
                  exercise={ex}
                  onDone={(updates) => handleDone(ex.id, updates)}
                  onRemove={() => handleRemove(ex.id)}
                />
              </div>
            ))
          ) : (
            <div className="min-w-0 flex-[0_0_100%] px-0.5">
              <div className="grid h-40 place-items-center rounded-2xl bg-neutral-900 p-5 text-center text-muted-foreground">
                All done for today — tap Complete below.
              </div>
            </div>
          )}
        </div>
      </div>

      {pending.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {pending.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === selected ? "w-5 bg-primary" : "w-1.5 bg-neutral-700"}`}
            />
          ))}
        </div>
      )}

      {done.length > 0 && <DoneList exercises={done} />}

      <FinishButton sessionId={sessionId} className="h-12 w-full text-base font-semibold">
        Complete
      </FinishButton>

      {pickerHref && (
        <Link href={pickerHref} className="justify-self-center text-sm text-muted-foreground underline-offset-4 hover:underline">
          Change exercises
        </Link>
      )}

      <CancelActiveWorkoutLink sessionId={sessionId} />
    </div>
  );
}

function DoneList({ exercises }: { exercises: SessionExercise[] }) {
  return (
    <ul className="grid gap-1 text-sm">
      {exercises.map((ex) => (
        <li key={ex.id} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-900 px-3 py-2">
          <span className="min-w-0 truncate text-muted-foreground">{ex.exerciseName}</span>
          {ex.outcome === "SKIPPED" ? (
            <span className="shrink-0 text-muted-foreground">Skipped</span>
          ) : ex.outcome === "GRADUATED" ? (
            <span className="shrink-0 font-medium text-emerald-500">
              {formatTarget(ex.actualSets, ex.actualReps, ex.actualWeight)}
              <span className="mx-1 text-muted-foreground">→</span>
              {formatTarget(ex.nextSets, ex.nextReps, ex.nextWeight)}
            </span>
          ) : (
            <span className="shrink-0 font-medium">{formatTarget(ex.actualSets, ex.actualReps, ex.actualWeight)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function formatTarget(sets: number | null, reps: number | null, weight: number | null) {
  return formatSetsRepsWeight(sets, reps, weight) || "—";
}
