"use client";

import { useTransition, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { finishWorkout } from "./actions";

export function FinishButton({
  sessionId,
  variant,
  size,
  children,
}: {
  sessionId: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant={variant} size={size} disabled={pending} onClick={() => startTransition(() => finishWorkout(sessionId))}>
      {pending ? "Finishing…" : children}
    </Button>
  );
}
