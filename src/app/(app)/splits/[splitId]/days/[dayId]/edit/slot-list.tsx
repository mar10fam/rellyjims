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
import { Button } from "@/components/ui/button";
import { reorderSlots } from "./actions";
import { SlotRow, type Slot } from "./slot-row";

export function SlotList({ groupId, slots }: { groupId: string; slots: Slot[] }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(slots);
  const [, startTransition] = useTransition();

  // Re-sync when the server gives us fresh data — adjusting state during render
  // rather than in an effect, since this is a prop->state reset, not a side effect.
  const [prevSlots, setPrevSlots] = useState(slots);
  if (slots !== prevSlots) {
    setPrevSlots(slots);
    setItems(slots);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    startTransition(() => {
      reorderSlots(
        groupId,
        next.map((s) => s.id),
      );
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="grid gap-2">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
          <ListOrdered /> {editing ? "Done" : "Reorder"}
        </Button>
      </div>

      {editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="grid gap-2">
              {items.map((slot) => (
                <DraggableSlotRow key={slot.id} slot={slot} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <ol className="grid gap-2">
          {items.map((slot) => (
            <SlotRow key={slot.id} slot={slot} />
          ))}
        </ol>
      )}
    </div>
  );
}

function DraggableSlotRow({ slot }: { slot: Slot }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg bg-neutral-900 p-3 ${isDragging ? "z-10 ring-1 ring-primary/50" : ""}`}
    >
      <span className="min-w-0 flex-1 font-medium">
        {slot.exercise.name}
        {slot.exercise.perSide && <span className="text-muted-foreground"> (each)</span>}
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
