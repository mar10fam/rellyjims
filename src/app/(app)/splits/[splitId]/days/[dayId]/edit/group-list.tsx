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
import { reorderGroups } from "./actions";
import { GroupCard, type Group } from "./group-card";

export function GroupList({ dayId, groups, exerciseNames }: { dayId: string; groups: Group[]; exerciseNames: string[] }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(groups);
  const [, startTransition] = useTransition();

  // Re-sync when the server gives us fresh data — adjusting state during render
  // rather than in an effect, since this is a prop->state reset, not a side effect.
  const [prevGroups, setPrevGroups] = useState(groups);
  if (groups !== prevGroups) {
    setPrevGroups(groups);
    setItems(groups);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((g) => g.id === active.id);
    const newIndex = items.findIndex((g) => g.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    startTransition(() => {
      reorderGroups(
        dayId,
        next.map((g) => g.id),
      );
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No exercise groups yet.</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
          <ListOrdered /> {editing ? "Done" : "Reorder groups"}
        </Button>
      </div>

      {editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <ol className="grid gap-2">
              {items.map((group, i) => (
                <DraggableGroupRow key={group.id} group={group} number={i + 1} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid gap-4">
          {items.map((group, i) => (
            <GroupCard key={group.id} group={group} number={i + 1} exerciseNames={exerciseNames} />
          ))}
        </div>
      )}
    </div>
  );
}

function DraggableGroupRow({ group, number }: { group: Group; number: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 ${isDragging ? "z-10 ring-1 ring-primary/50" : ""}`}
    >
      <span className="min-w-0 flex-1 font-medium">
        Group {number}
        {group.label && <span className="text-muted-foreground"> · {group.label}</span>}
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
