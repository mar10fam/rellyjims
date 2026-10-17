"use client";

import { useActionState } from "react";
import { updateSplit, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function EditSplitForm({
  split,
}: {
  split: { id: string; name: string; description: string | null };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateSplit, null);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="splitId" value={split.id} />
      <div className="grid gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={split.name} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={split.description ?? ""} />
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
