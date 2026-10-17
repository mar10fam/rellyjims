"use client";

import { useMemo, useState, useTransition } from "react";
import { parseNotes } from "@/lib/import-notes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createDaysFromImport } from "./actions";

const PLACEHOLDER = `Day 1 - Upper Body (2 Chest 1 Shoulder || 1 Chest 2 Shoulder)
* 1 Bench Press: 65lbs | (45 (bar) + 12.5)
   * 3 x 8
* 3 Lever Row: 55lbs
* 3 Landmine Row:
* Hip Thrust: 230lbs
   * 3x12-15`;

export function ImportForm({ splitId }: { splitId: string }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const days = useMemo(() => (text.trim() ? parseNotes(text) : []), [text]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createDaysFromImport(splitId, days);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={10}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          One or more &quot;Day N - Title&quot; blocks. A leading number groups interchangeable options; a sub-bullet sets sets×reps.
        </p>
      </div>

      {days.length > 0 && (
        <div className="grid gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Preview — {days.length} day{days.length === 1 ? "" : "s"}
          </h2>
          {days.map((day, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-neutral-900 p-4">
              <p className="font-semibold">
                Day {day.order} · {day.title}
              </p>
              <ul className="grid gap-1.5">
                {day.groups.flatMap((group) => group.slots).map((slot, si) => (
                  <li key={si} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {slot.name}
                      {slot.perSide && <span className="text-muted-foreground"> (each)</span>}
                    </span>
                    <Badge variant={slot.sets != null ? "default" : "secondary"}>
                      {slot.sets != null
                        ? `${slot.sets}×${slot.repFloor}${slot.repCeiling ? `–${slot.repCeiling}` : ""}${slot.weight ? ` @ ${slot.weight}` : ""}`
                        : "Manual"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {text.trim() && days.length === 0 && (
        <p className="text-sm text-muted-foreground">Couldn&apos;t find a &quot;Day N - Title&quot; line in that text.</p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={days.length === 0 || pending}>
          {pending ? "Importing…" : `Import ${days.length || ""} day${days.length === 1 ? "" : "s"}`}
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
