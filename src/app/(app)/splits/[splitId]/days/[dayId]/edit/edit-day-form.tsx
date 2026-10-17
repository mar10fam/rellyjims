"use client";

import { useActionState } from "react";
import { updateDay, type ActionState } from "@/app/(app)/splits/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditDayForm({ day }: { day: { id: string; title: string } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateDay, null);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="dayId" value={day.id} />
      <div className="grid gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={day.title} required />
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
