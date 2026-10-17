"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createSlot, updateSlot, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RulebookFields } from "./rulebook-fields";

export function AddSlotForm({ groupId, exerciseNames }: { groupId: string; exerciseNames: string[] }) {
  const [open, setOpen] = useState(false);
  // Remounts the form (and its useActionState) fresh every time the dialog opens,
  // so a stale error/value from a previous attempt never lingers into the next one.
  const [resetKey, setResetKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setResetKey((k) => k + 1);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="w-full">
          <Plus /> Add exercise option
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add exercise option</DialogTitle>
        </DialogHeader>
        <AddSlotFields key={resetKey} groupId={groupId} exerciseNames={exerciseNames} onAdded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddSlotFields({
  groupId,
  exerciseNames,
  onAdded,
}: {
  groupId: string;
  exerciseNames: string[];
  onAdded: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createSlot, null);
  const listId = `exercises-${groupId}`;

  useEffect(() => {
    if (state?.ok) onAdded();
  }, [state, onAdded]);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`name-${groupId}`}>Exercise</Label>
        <Input id={`name-${groupId}`} name="name" list={listId} placeholder="Bench Press" required autoFocus />
        <datalist id={listId}>
          {exerciseNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`loadType-${groupId}`}>Load type</Label>
          <Select name="loadType" defaultValue="WEIGHTED">
            <SelectTrigger id={`loadType-${groupId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WEIGHTED">Weighted</SelectItem>
              <SelectItem value="ASSISTED">Assisted</SelectItem>
              <SelectItem value="BODYWEIGHT">Bodyweight</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-muted-foreground">
          <input type="checkbox" name="perSide" className="size-4 rounded border-input" />
          Per side
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Load type and per-side only apply the first time you add this exercise name.</p>

      <RulebookFields />

      <div className="grid gap-1.5">
        <Label htmlFor={`notes-${groupId}`}>Notes (optional)</Label>
        <Input id={`notes-${groupId}`} name="notes" placeholder="(45 bar + 12.5)" />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add exercise option"}
        </Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}

export function EditSlotForm({
  slot,
}: {
  slot: {
    id: string;
    trackingMode: "PROGRESSIVE" | "MANUAL";
    notes: string | null;
    targetSets: number | null;
    repFloor: number | null;
    repCeiling: number | null;
    repStep: number | null;
    weightStep: number | null;
  };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateSlot, null);

  return (
    <form action={action} className="grid gap-3 rounded-lg bg-neutral-950 p-3">
      <input type="hidden" name="slotId" value={slot.id} />
      <RulebookFields defaultTrackingMode={slot.trackingMode} defaults={slot} />
      <div className="grid gap-1.5">
        <Label htmlFor={`notes-${slot.id}`}>Notes (optional)</Label>
        <Input id={`notes-${slot.id}`} name="notes" defaultValue={slot.notes ?? ""} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state?.ok && <span className="text-sm text-muted-foreground">{state.ok}</span>}
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
