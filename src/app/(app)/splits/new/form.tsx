"use client";

import { useActionState } from "react";
import { createSplit, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewSplitForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createSplit, null);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="Upper / Lower" required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" placeholder="4-day split, 2 upper 2 lower" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create split"}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
