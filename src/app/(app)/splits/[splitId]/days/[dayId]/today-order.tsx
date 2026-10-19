"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ListOrdered } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reorderSessionExercises } from "./actions";

type Exercise = { id: string; exerciseName: string; outcome: string };

export function TodaysOrder({ sessionId, exercises }: { sessionId: string; exercises: Exercise[] }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(exercises);
  const [, startTransition] = useTransition();

  // Re-sync when the server gives us fresh data (e.g. an exercise was added/removed
  // below) — adjusting state during render rather than in an effect, per React's
  // guidance, since this is a prop->state reset, not a side effect.
  const [prevExercises, setPrevExercises] = useState(exercises);
  if (exercises !== prevExercises) {
    setPrevExercises(exercises);
    setItems(exercises);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    const pendingIds = next.filter((e) => e.outcome === "PENDING").map((e) => e.id);
    startTransition(() => {
      reorderSessionExercises(sessionId, pendingIds);
    });
  }

  const pendingIds = items.filter((e) => e.outcome === "PENDING").map((e) => e.id);

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Today&apos;s order</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
          <ListOrdered /> {editing ? "Done" : "Edit order"}
        </Button>
      </div>

      {editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pendingIds} strategy={verticalListSortingStrategy}>
            <ol className="grid gap-2">
              {items.map((ex, i) =>
                ex.outcome === "PENDING" ? (
                  <DraggableRow key={ex.id} id={ex.id} index={i} name={ex.exerciseName} />
                ) : (
                  <LockedRow key={ex.id} index={i} name={ex.exerciseName} outcome={ex.outcome} />
                ),
              )}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <ol className="grid gap-2">
          {items.map((ex, i) =>
            ex.outcome === "PENDING" ? (
              <li key={ex.id} className="flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2">
                <span className="w-4 shrink-0 text-center text-xs text-neutral-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{ex.exerciseName}</span>
              </li>
            ) : (
              <LockedRow key={ex.id} index={i} name={ex.exerciseName} outcome={ex.outcome} />
            ),
          )}
        </ol>
      )}
    </section>
  );
}

function DraggableRow({ id, index, name }: { id: string; index: number; name: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 ${isDragging ? "z-10 ring-1 ring-primary/50" : ""}`}
    >
      <span className="w-4 shrink-0 text-center text-xs text-neutral-500">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="touch-none p-1.5 text-muted-foreground active:text-foreground"
      >
        <GripVertical className="size-4" />
      </button>
    </li>
  );
}

function LockedRow({ index, name, outcome }: { index: number; name: string; outcome: string }) {
  return (
    <li className="flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 opacity-70">
      <span className="w-4 shrink-0 text-center text-xs text-neutral-500">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <Badge variant="secondary">{outcomeLabel(outcome)}</Badge>
    </li>
  );
}

function outcomeLabel(outcome: string) {
  return { FAILED: "Flunk", HELD: "Held", GRADUATED: "Graduated", LOGGED: "Logged", SKIPPED: "Skipped" }[outcome] ?? outcome;
}
