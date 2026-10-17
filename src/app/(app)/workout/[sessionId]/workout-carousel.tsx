"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { ExerciseCard, type SessionExercise } from "./exercise-card";
import { FinishButton } from "./finish-button";
import { OtherExercises, type PoolSlot } from "./other-exercises";

const TRAILING = "__trailing__";

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
  // Which slide is currently showing, tracked by identity rather than index —
  // an add/remove (locally, or via a server refetch that re-sorts by `order`)
  // changes what sits at a given index, so the index alone isn't a stable anchor.
  const [currentId, setCurrentId] = useState(initialExercises[0]?.id ?? TRAILING);
  const exercisesRef = useRef(exercises);

  // Re-sync when the server gives us fresh data — adjusting state during render
  // rather than in an effect, since this is a prop->state reset, not a side effect.
  const [prevInitial, setPrevInitial] = useState(initialExercises);
  if (initialExercises !== prevInitial) {
    setPrevInitial(initialExercises);
    setExercises(initialExercises);
  }

  const slideCount = exercises.length + 1; // + the trailing "add more / finish" slide
  const usedSlotIds = new Set(exercises.map((e) => e.slotId).filter((id): id is string => !!id));
  const addable = otherSlots.filter((s) => !usedSlotIds.has(s.id));

  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      setSelected(idx);
      setCurrentId(idx < exercisesRef.current.length ? exercisesRef.current[idx].id : TRAILING);
    };
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // The list changed — either a local add/remove, or a server refetch that
  // re-sorted everything by `order`. Re-measure and jump (no animation) back to
  // whichever item was showing, so the user doesn't land on a different exercise.
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
    const idx = currentId === TRAILING ? exercises.length : exercises.findIndex((e) => e.id === currentId);
    const target = idx === -1 ? Math.min(selected, exercises.length) : idx;
    // Jump (no animation) back to the same item; this re-fires the "select"
    // listener above when the snap index actually moved, keeping `selected` in sync.
    emblaApi.scrollTo(target, true);
    // Only the list identity should re-anchor the view — `currentId`/`selected` are
    // tracked here, not reacted to, to avoid fighting the user's own swipes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, emblaApi]);

  const advance = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  function handleRemove(id: string) {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  function handleAdd(ex: SessionExercise) {
    setExercises((prev) => [...prev, ex]);
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {exercises.map((ex) => (
            <div key={ex.id} className="min-w-0 flex-[0_0_100%] px-0.5">
              <ExerciseCard exercise={ex} onDone={advance} onRemove={() => handleRemove(ex.id)} />
            </div>
          ))}
          <div className="min-w-0 flex-[0_0_100%] px-0.5">
            <div className="grid h-full content-start gap-4 overflow-y-auto rounded-2xl bg-neutral-900 p-5">
              <div>
                <p className="text-lg font-semibold">Add more?</p>
                <p className="text-sm text-muted-foreground">Tap to add it to today&apos;s workout.</p>
              </div>
              <OtherExercises sessionId={sessionId} slots={addable} onAdd={handleAdd} />
              <div className="mt-2 grid justify-items-center gap-2">
                <FinishButton sessionId={sessionId}>Finish &amp; see report</FinishButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: slideCount }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === selected ? "w-5 bg-primary" : "w-1.5 bg-neutral-700"}`}
          />
        ))}
      </div>

      {pickerHref && (
        <Link href={pickerHref} className="justify-self-center text-sm text-muted-foreground underline-offset-4 hover:underline">
          Change exercises
        </Link>
      )}
    </div>
  );
}
