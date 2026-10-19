"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { abandonSession, cancelActiveWorkout } from "./actions";

const CONFIRM_MESSAGE = "Cancel this workout? Anything logged so far will be discarded.";

/** Icon-only cancel, for a session card you're not currently viewing (e.g. on home). */
export function CancelSessionIconButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Cancel workout"
      disabled={pending}
      onClick={() => {
        if (confirm(CONFIRM_MESSAGE)) startTransition(() => abandonSession(sessionId));
      }}
    >
      <X />
    </Button>
  );
}

/** Text link, for the workout screen itself — leaves for home once cancelled. */
export function CancelActiveWorkoutLink({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(CONFIRM_MESSAGE)) startTransition(() => cancelActiveWorkout(sessionId));
      }}
      className="justify-self-center text-sm text-muted-foreground hover:text-destructive"
    >
      {pending ? "Cancelling…" : "Cancel workout"}
    </button>
  );
}
