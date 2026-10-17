"use client";

import Link from "next/link";
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
import { GripVertical, ListOrdered, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteDay, reorderDays } from "../actions";

type Day = { id: string; order: number; title: string };

export function DayList({ splitId, days }: { splitId: string; days: Day[] }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(days);
  const [, startTransition] = useTransition();

  // Re-sync when the server gives us fresh data — adjusting state during render
  // rather than in an effect, since this is a prop->state reset, not a side effect.
  const [prevDays, setPrevDays] = useState(days);
  if (days !== prevDays) {
    setPrevDays(days);
    setItems(days);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((d) => d.id === active.id);
    const newIndex = items.findIndex((d) => d.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    startTransition(() => {
      reorderDays(
        splitId,
        next.map((d) => d.id),
      );
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No days yet.</p>;
  }

  return (
    <div className="grid gap-2">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
          <ListOrdered /> {editing ? "Done" : "Edit order"}
        </Button>
      </div>

      {editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <ol className="grid gap-2">
              {items.map((day) => (
                <DraggableDayRow key={day.id} day={day} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <ol className="grid gap-2">
          {items.map((day) => (
            <li key={day.id} className="flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2">
              <Link href={`/splits/${splitId}/days/${day.id}`} className="min-w-0 flex-1 active:opacity-70">
                <span className="text-neutral-500">Day {day.order}</span> · {day.title}
              </Link>
              <Link
                href={`/splits/${splitId}/days/${day.id}/edit`}
                aria-label="Edit day"
                className="p-1.5 text-muted-foreground"
              >
                <Pencil className="size-4" />
              </Link>
              <form action={deleteDay}>
                <input type="hidden" name="dayId" value={day.id} />
                <button type="submit" aria-label="Delete day" className="p-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </form>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DraggableDayRow({ day }: { day: Day }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 ${isDragging ? "z-10 ring-1 ring-primary/50" : ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className="text-neutral-500">Day {day.order}</span> · {day.title}
      </span>
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
