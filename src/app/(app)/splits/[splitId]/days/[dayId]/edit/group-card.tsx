"use client";

import { useActionState, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteGroup, updateGroupLabel, type ActionState } from "./actions";
import { AddSlotForm } from "./slot-form";
import { SlotList } from "./slot-list";
import type { Slot } from "./slot-row";

export type Group = {
  id: string;
  order: number;
  label: string | null;
  slots: Slot[];
};

export function GroupCard({ group, exerciseNames }: { group: Group; exerciseNames: string[] }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(updateGroupLabel, null);

  // A fresh "ok" result means the save just landed — collapse back to the
  // display view. Adjusting state during render (not an effect) since this is
  // a result->state reset, not a side effect.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) setEditing(false);
  }

  return (
    <Card>
      <CardHeader>
        {editing ? (
          <form action={action} className="flex flex-1 items-center gap-2">
            <input type="hidden" name="groupId" value={group.id} />
            <span className="shrink-0 text-sm font-medium">Group {group.order} ·</span>
            <Input
              name="label"
              defaultValue={group.label ?? ""}
              placeholder="Label (optional)"
              autoFocus
              className="h-8"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
          </form>
        ) : (
          <CardTitle className="flex items-center gap-1.5">
            Group {group.order}
            {group.label && <span className="text-muted-foreground"> · {group.label}</span>}
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit group name"
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3" />
            </button>
          </CardTitle>
        )}
        <CardAction>
          <form action={deleteGroup}>
            <input type="hidden" name="groupId" value={group.id} />
            <button type="submit" aria-label="Delete group" className="p-1.5 text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" />
            </button>
          </form>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <SlotList groupId={group.id} slots={group.slots} />
        <AddSlotForm groupId={group.id} exerciseNames={exerciseNames} />
      </CardContent>
    </Card>
  );
}
