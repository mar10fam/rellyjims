"use client";

import { useRef, useState, type RefObject } from "react";
import { PRESETS, type PresetKey } from "@/lib/progression";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const numberClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type RulebookDefaults = {
  targetSets?: number | null;
  repFloor?: number | null;
  repCeiling?: number | null;
  repStep?: number | null;
  weightStep?: number | null;
};

// Shared by the "add exercise option" and "edit exercise option" forms: a
// tracking-mode select that shows/hides the double-progression rulebook
// fields, plus a preset picker that fills them (still plain, editable inputs).
export function RulebookFields({
  defaultTrackingMode = "PROGRESSIVE",
  defaults,
}: {
  defaultTrackingMode?: "PROGRESSIVE" | "MANUAL";
  defaults?: RulebookDefaults;
}) {
  const [trackingMode, setTrackingMode] = useState(defaultTrackingMode);
  const targetSets = useRef<HTMLInputElement>(null);
  const repFloor = useRef<HTMLInputElement>(null);
  const repCeiling = useRef<HTMLInputElement>(null);
  const repStep = useRef<HTMLInputElement>(null);
  const weightStep = useRef<HTMLInputElement>(null);

  function applyPreset(key: string) {
    if (!(key in PRESETS)) return;
    const preset = PRESETS[key as PresetKey];
    if (targetSets.current) targetSets.current.value = String(preset.targetSets);
    if (repFloor.current) repFloor.current.value = String(preset.repFloor);
    if (repCeiling.current) repCeiling.current.value = String(preset.repCeiling);
    if (repStep.current) repStep.current.value = String(preset.repStep);
    if (weightStep.current) weightStep.current.value = String(preset.weightStep);
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="trackingMode">Tracking</Label>
        <Select
          name="trackingMode"
          defaultValue={defaultTrackingMode}
          onValueChange={(v) => setTrackingMode(v as "PROGRESSIVE" | "MANUAL")}
        >
          <SelectTrigger id="trackingMode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PROGRESSIVE">Progressive (Failed / Hold / Graduate)</SelectItem>
            <SelectItem value="MANUAL">Manual (just log it)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {trackingMode === "PROGRESSIVE" && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="preset">Preset</Label>
            <Select onValueChange={applyPreset}>
              <SelectTrigger id="preset" className="w-full">
                <SelectValue placeholder="Fill from a preset…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESETS).map(([key, p]) => (
                  <SelectItem key={key} value={key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sets" name="targetSets" inputRef={targetSets} defaultValue={defaults?.targetSets} />
            <Field label="Weight step" name="weightStep" inputRef={weightStep} defaultValue={defaults?.weightStep} step="0.5" />
            <Field label="Rep floor" name="repFloor" inputRef={repFloor} defaultValue={defaults?.repFloor} />
            <Field label="Rep ceiling" name="repCeiling" inputRef={repCeiling} defaultValue={defaults?.repCeiling} />
            <Field label="Rep step" name="repStep" inputRef={repStep} defaultValue={defaults?.repStep} />
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  step,
  inputRef,
}: {
  label: string;
  name: string;
  defaultValue?: number | null;
  step?: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={name} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <input
        ref={inputRef}
        id={name}
        name={name}
        type="number"
        inputMode="decimal"
        step={step ?? "1"}
        min={0}
        defaultValue={defaultValue ?? undefined}
        required
        className={numberClass}
      />
    </div>
  );
}
