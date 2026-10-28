"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadTypeLabel, type LoadType } from "@/lib/progression";
import { removeExercise, submitOutcome } from "./actions";

export type SessionExercise = {
  id: string;
  slotId: string | null;
  exerciseName: string;
  trackingMode: "PROGRESSIVE" | "MANUAL";
  plannedSets: number | null;
  plannedReps: number | null;
  plannedWeight: number | null;
  actualSets: number | null;
  actualReps: number | null;
  actualWeight: number | null;
  nextSets: number | null;
  nextReps: number | null;
  nextWeight: number | null;
  outcome: "PENDING" | "FAILED" | "HELD" | "GRADUATED" | "LOGGED" | "SKIPPED";
  direction: number | null;
  exercise: { loadType: LoadType; perSide: boolean } | null;
  slot: { repFloor: number | null; repCeiling: number | null } | null;
};

export function ExerciseCard({
  exercise,
  onDone,
  onRemove,
}: {
  exercise: SessionExercise;
  onDone: (updates: Partial<SessionExercise>) => void;
  onRemove: () => void;
}) {
  const [ex, setEx] = useState(exercise);
  const [pending, startTransition] = useTransition();
  const [editingOutcome, setEditingOutcome] = useState<"FAILED" | "GRADUATED" | null>(null);
  const [deloadNote, setDeloadNote] = useState<string | null>(null);
  // The weight actually loaded on the bar today — defaults to the planned
  // weight but is editable right up until a quick Hold/Graduate tap, so
  // "the gym only had different plates" doesn't require the full edit panel.
  const [weight, setWeight] = useState(ex.plannedWeight ?? 0);
  const [sets, setSets] = useState(ex.plannedSets ?? 0);
  const [reps, setReps] = useState(ex.plannedReps ?? 0);
  const repRange =
    ex.slot?.repFloor != null && ex.slot?.repCeiling != null
      ? { floor: ex.slot.repFloor, ceiling: ex.slot.repCeiling }
      : undefined;
  const quickValid = sets >= 1 && (!repRange || (reps >= repRange.floor && reps <= repRange.ceiling));

  function submit(outcome: "HELD" | "GRADUATED" | "FAILED" | "LOGGED", actual?: { sets: number; reps: number; weight: number }) {
    startTransition(async () => {
      const res = await submitOutcome({
        sessionExerciseId: ex.id,
        outcome,
        weightOverride: actual ? undefined : weight,
        setsOverride: actual ? undefined : sets,
        repsOverride: actual ? undefined : reps,
        actualSets: actual?.sets,
        actualReps: actual?.reps,
        actualWeight: actual?.weight,
      });
      if (!res.ok) return;
      const updates: Partial<SessionExercise> = {
        outcome,
        actualSets: actual?.sets ?? sets,
        actualReps: actual?.reps ?? reps,
        actualWeight: actual?.weight ?? weight,
        nextSets: res.next?.sets ?? null,
        nextReps: res.next?.reps ?? null,
        nextWeight: res.next?.weight ?? null,
        direction: res.direction ?? null,
      };
      setEx((prev) => ({ ...prev, ...updates }));
      if (res.deloadSuggestion) {
        setDeloadNote(
          `3 fails in a row — consider ${res.deloadSuggestion.sets}×${res.deloadSuggestion.reps} @ ${res.deloadSuggestion.weight} next time.`,
        );
      }
      onDone(updates);
    });
  }

  function remove() {
    startTransition(async () => {
      await removeExercise(ex.id);
      onRemove();
    });
  }

  if (ex.outcome !== "PENDING") {
    return (
      <Card title={ex.exerciseName} exerciseMeta={ex.exercise}>
        <DoneSummary ex={ex} />
        {deloadNote && <p className="text-xs text-amber-400">{deloadNote}</p>}
      </Card>
    );
  }

  return (
    <Card title={ex.exerciseName} exerciseMeta={ex.exercise}>
      {ex.trackingMode === "PROGRESSIVE" ? (
        <>
          {!editingOutcome && (
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="Sets" value={sets} onChange={setSets} />
              <NumberField
                label="Reps"
                value={reps}
                onChange={setReps}
                min={repRange?.floor}
                max={repRange?.ceiling}
                invalid={!quickValid}
              />
              <NumberField label="Weight" value={weight} onChange={setWeight} step={0.5} />
            </div>
          )}

          {!editingOutcome ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant="destructive" disabled={pending} onClick={() => setEditingOutcome("FAILED")}>
                  Flunk
                </Button>
                <Button type="button" variant="secondary" disabled={pending || !quickValid} onClick={() => submit("HELD")}>
                  Hold
                </Button>
                <Button type="button" disabled={pending || !quickValid} onClick={() => submit("GRADUATED")}>
                  Graduate
                </Button>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditingOutcome("GRADUATED")}
                className="justify-self-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Graduate to a specific number
              </button>
            </>
          ) : (
            <ActualInput
              defaults={{ sets, reps, weight }}
              repRange={repRange}
              pending={pending}
              confirmLabel={editingOutcome === "FAILED" ? "Confirm Flunk" : "Confirm Graduate"}
              onCancel={() => setEditingOutcome(null)}
              onConfirm={(actual) => submit(editingOutcome, actual)}
            />
          )}
        </>
      ) : (
        <ActualInput
          defaults={{ sets: ex.plannedSets ?? 0, reps: ex.plannedReps ?? 0, weight: ex.plannedWeight ?? 0 }}
          pending={pending}
          confirmLabel="Complete"
          onConfirm={(actual) => submit("LOGGED", actual)}
        />
      )}

      <button type="button" onClick={remove} disabled={pending} className="justify-self-start text-sm text-muted-foreground">
        Remove
      </button>
    </Card>
  );
}

function Card({
  title,
  exerciseMeta,
  children,
}: {
  title: string;
  exerciseMeta: SessionExercise["exercise"];
  children: React.ReactNode;
}) {
  return (
    <div className="grid h-full content-start gap-4 rounded-2xl bg-neutral-900 p-5">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {exerciseMeta && (
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="outline">{loadTypeLabel(exerciseMeta.loadType)}</Badge>
            {exerciseMeta.perSide && <Badge variant="outline">Each side</Badge>}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function DoneSummary({ ex }: { ex: SessionExercise }) {
  if (ex.outcome === "SKIPPED") return <p className="text-muted-foreground">Skipped</p>;

  const marker = ex.direction === 1 ? "▲" : ex.direction === -1 ? "▼" : ex.direction === 0 ? "●" : null;
  return (
    <div className="grid gap-1">
      <p className="text-2xl font-bold">
        {marker && <span className="mr-1 text-primary">{marker}</span>}
        {ex.actualSets} × {ex.actualReps}
        {!!ex.actualWeight && <span className="text-muted-foreground text-xl"> @ {ex.actualWeight}</span>}
      </p>
      {ex.nextSets != null && (
        <p className="text-sm text-muted-foreground">
          Next: {ex.nextSets} × {ex.nextReps}
          {!!ex.nextWeight && ` @ ${ex.nextWeight}`}
        </p>
      )}
    </div>
  );
}

function ActualInput({
  defaults,
  repRange,
  pending,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  defaults: { sets: number; reps: number; weight: number };
  /** Reps must fall inclusively within this range — weight is unrestricted. */
  repRange?: { floor: number; ceiling: number };
  pending: boolean;
  confirmLabel: string;
  onConfirm: (actual: { sets: number; reps: number; weight: number }) => void;
  onCancel?: () => void;
}) {
  const [sets, setSets] = useState(defaults.sets);
  const [reps, setReps] = useState(defaults.reps);
  const [weight, setWeight] = useState(defaults.weight);

  const repsValid = !repRange || (reps >= repRange.floor && reps <= repRange.ceiling);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Sets" value={sets} onChange={setSets} />
        <NumberField
          label="Reps"
          value={reps}
          onChange={setReps}
          min={repRange?.floor}
          max={repRange?.ceiling}
          invalid={!repsValid}
        />
        <NumberField label="Weight" value={weight} onChange={setWeight} step={0.5} />
      </div>
      {repRange && !repsValid && (
        <p className="text-center text-xs text-destructive">
          Reps must be between {repRange.floor} and {repRange.ceiling}
        </p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          className="flex-1"
          disabled={pending || !repsValid}
          onClick={() => onConfirm({ sets, reps, weight })}
        >
          {pending ? "Saving…" : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
  invalid,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  invalid?: boolean;
}) {
  // Text draft so typing "150" over "0" never shows "0150", and the field can
  // be cleared while typing; the numeric value is reported on every keystroke.
  const [draft, setDraft] = useState(String(value));
  const allowDecimal = (step ?? 1) < 1;

  function handleChange(raw: string) {
    let v = raw.replace(allowDecimal ? /[^\d.]/g : /\D/g, "");
    if (allowDecimal) {
      const [whole, ...rest] = v.split(".");
      v = rest.length ? `${whole}.${rest.join("")}` : whole;
    }
    v = v.replace(/^0+(?=\d)/, "");
    setDraft(v);
    const n = Number(v);
    onChange(Number.isFinite(n) ? n : 0);
  }

  return (
    <label className="grid gap-1 text-center text-xs text-muted-foreground">
      {label}
      {min != null && max != null && (
        <span className="text-[10px] text-muted-foreground/70">
          {min}–{max}
        </span>
      )}
      <input
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={draft}
        onFocus={(e) => e.target.select()}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setDraft(String(value))}
        className={`h-11 w-full rounded-lg border bg-transparent text-center text-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 ${
          invalid ? "border-destructive focus-visible:border-destructive" : "border-input focus-visible:border-ring"
        }`}
      />
    </label>
  );
}
