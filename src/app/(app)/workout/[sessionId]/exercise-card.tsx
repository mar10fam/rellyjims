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
};

export function ExerciseCard({
  exercise,
  onDone,
  onRemove,
}: {
  exercise: SessionExercise;
  onDone: () => void;
  onRemove: () => void;
}) {
  const [ex, setEx] = useState(exercise);
  const [pending, startTransition] = useTransition();
  const [showActual, setShowActual] = useState(false);
  const [deloadNote, setDeloadNote] = useState<string | null>(null);

  function submit(outcome: "HELD" | "GRADUATED" | "FAILED" | "LOGGED", actual?: { sets: number; reps: number; weight: number }) {
    startTransition(async () => {
      const res = await submitOutcome({
        sessionExerciseId: ex.id,
        outcome,
        actualSets: actual?.sets,
        actualReps: actual?.reps,
        actualWeight: actual?.weight,
      });
      if (!res.ok) return;
      setEx((prev) => ({
        ...prev,
        outcome,
        actualSets: actual?.sets ?? prev.plannedSets,
        actualReps: actual?.reps ?? prev.plannedReps,
        actualWeight: actual?.weight ?? prev.plannedWeight,
        nextSets: res.next?.sets ?? null,
        nextReps: res.next?.reps ?? null,
        nextWeight: res.next?.weight ?? null,
        direction: res.direction ?? null,
      }));
      if (res.deloadSuggestion) {
        setDeloadNote(
          `3 fails in a row — consider ${res.deloadSuggestion.sets}×${res.deloadSuggestion.reps} @ ${res.deloadSuggestion.weight} next time.`,
        );
      }
      onDone();
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
          <p className="text-3xl font-black">
            {ex.plannedSets} × {ex.plannedReps}
            {!!ex.plannedWeight && <span className="text-muted-foreground text-xl"> @ {ex.plannedWeight}</span>}
          </p>

          {!showActual ? (
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="destructive" disabled={pending} onClick={() => setShowActual(true)}>
                Failed
              </Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={() => submit("HELD")}>
                Hold
              </Button>
              <Button type="button" disabled={pending} onClick={() => submit("GRADUATED")}>
                Graduate
              </Button>
            </div>
          ) : (
            <ActualInput
              defaults={{ sets: ex.plannedSets ?? 0, reps: ex.plannedReps ?? 0, weight: ex.plannedWeight ?? 0 }}
              pending={pending}
              confirmLabel="Confirm Failed"
              onCancel={() => setShowActual(false)}
              onConfirm={(actual) => submit("FAILED", actual)}
            />
          )}
        </>
      ) : (
        <ActualInput
          defaults={{ sets: ex.plannedSets ?? 0, reps: ex.plannedReps ?? 0, weight: ex.plannedWeight ?? 0 }}
          pending={pending}
          confirmLabel="Log"
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
  pending,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  defaults: { sets: number; reps: number; weight: number };
  pending: boolean;
  confirmLabel: string;
  onConfirm: (actual: { sets: number; reps: number; weight: number }) => void;
  onCancel?: () => void;
}) {
  const [sets, setSets] = useState(defaults.sets);
  const [reps, setReps] = useState(defaults.reps);
  const [weight, setWeight] = useState(defaults.weight);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Sets" value={sets} onChange={setSets} />
        <NumberField label="Reps" value={reps} onChange={setReps} />
        <NumberField label="Weight" value={weight} onChange={setWeight} step={0.5} />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" className="flex-1" disabled={pending} onClick={() => onConfirm({ sets, reps, weight })}>
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="grid gap-1 text-center text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full rounded-lg border border-input bg-transparent text-center text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
    </label>
  );
}
