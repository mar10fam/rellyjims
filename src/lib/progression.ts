/**
 * Progression engine — pure functions, no DB access.
 *
 * Double progression:
 *   reps climb from `repFloor` to `repCeiling` by `repStep`; once the ceiling is
 *   hit, the load moves by `weightStep` and reps drop back to the floor.
 *
 *   WEIGHTED    load goes UP   (3x8 @ 65 → … → 3x12 @ 65 → 3x8 @ 70)
 *   ASSISTED    load goes DOWN (less assistance = harder)
 *   BODYWEIGHT  no load; at the ceiling a set is added and reps reset
 */

export type LoadType = "WEIGHTED" | "ASSISTED" | "BODYWEIGHT";
export type ProgressOutcome = "FAILED" | "HELD" | "GRADUATED";

export interface Rulebook {
  loadType: LoadType;
  targetSets: number;
  repFloor: number;
  repCeiling: number;
  repStep: number;
  weightStep: number;
  deloadAfterFails: number;
  deloadPercent: number; // 0.1 = 10%
}

export interface Target {
  sets: number;
  reps: number;
  weight: number;
}

export interface ProgressState extends Target {
  failStreak: number;
}

export interface ProgressResult {
  next: ProgressState;
  /** -1 regressed, 0 same, 1 progressed — drives the ▼ ● ▲ report markers */
  direction: -1 | 0 | 1;
  /** Present when consecutive fails reach the rulebook threshold */
  deloadSuggestion?: Target;
}

export function initialState(rules: Rulebook, startingWeight = 0): ProgressState {
  return {
    sets: rules.targetSets,
    reps: rules.repFloor,
    weight: rules.loadType === "BODYWEIGHT" ? 0 : startingWeight,
    failStreak: 0,
  };
}

/** Next target if the user graduates (also used to preview "what's next" on the card). */
export function graduate(rules: Rulebook, cur: Target): Target {
  const nextReps = cur.reps + rules.repStep;
  if (nextReps <= rules.repCeiling) {
    return { ...cur, reps: nextReps };
  }
  switch (rules.loadType) {
    case "WEIGHTED":
      return { ...cur, reps: rules.repFloor, weight: round(cur.weight + rules.weightStep) };
    case "ASSISTED":
      return {
        ...cur,
        reps: rules.repFloor,
        weight: Math.max(0, round(cur.weight - rules.weightStep)),
      };
    case "BODYWEIGHT":
      return { ...cur, sets: cur.sets + 1, reps: rules.repFloor };
  }
}

export function applyOutcome(
  rules: Rulebook,
  cur: ProgressState,
  outcome: ProgressOutcome,
  /** Required for FAILED: what was actually done. Becomes the new baseline. */
  actual?: Target,
): ProgressResult {
  if (outcome === "HELD") {
    return { next: { ...cur, failStreak: 0 }, direction: 0 };
  }

  if (outcome === "GRADUATED") {
    return { next: { ...graduate(rules, cur), failStreak: 0 }, direction: 1 };
  }

  // FAILED — restart progression from whatever was actually done.
  if (!actual) throw new Error("A failed attempt needs the actual sets/reps/weight");
  const failStreak = cur.failStreak + 1;
  const next: ProgressState = { ...actual, failStreak };
  const direction = compare(rules.loadType, cur, actual);

  const result: ProgressResult = { next, direction };
  if (failStreak >= rules.deloadAfterFails && rules.loadType !== "BODYWEIGHT") {
    result.deloadSuggestion = deload(rules, actual);
  }
  return result;
}

/** Drop the load ~deloadPercent (rounded to the weight step) and restart at the rep floor. */
export function deload(rules: Rulebook, cur: Target): Target {
  const delta = cur.weight * rules.deloadPercent;
  const raw = rules.loadType === "ASSISTED" ? cur.weight + delta : cur.weight - delta;
  return {
    sets: rules.targetSets,
    reps: rules.repFloor,
    weight: Math.max(0, roundTo(raw, rules.weightStep || 2.5)),
  };
}

/** Rough "is b harder than a" — volume-weighted, respecting assisted direction. */
export function compare(loadType: LoadType, a: Target, b: Target): -1 | 0 | 1 {
  const effLoad = (t: Target) => (loadType === "ASSISTED" ? -t.weight : t.weight);
  if (effLoad(b) !== effLoad(a)) return effLoad(b) > effLoad(a) ? 1 : -1;
  const vol = (t: Target) => t.sets * t.reps;
  if (vol(b) !== vol(a)) return vol(b) > vol(a) ? 1 : -1;
  return 0;
}

export function loadTypeLabel(loadType: LoadType): string {
  return { WEIGHTED: "Weighted", ASSISTED: "Assisted", BODYWEIGHT: "Bodyweight" }[loadType];
}

export function isConfigured(slot: {
  targetSets: number | null;
  repFloor: number | null;
  repCeiling: number | null;
  repStep: number | null;
  weightStep: number | null;
}): boolean {
  return (
    slot.targetSets != null &&
    slot.repFloor != null &&
    slot.repCeiling != null &&
    slot.repStep != null &&
    slot.weightStep != null
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
const roundTo = (n: number, step: number) => round(Math.round(n / step) * step);

// ───────────────────────────── Presets ─────────────────────────────

export type PresetKey = "barbell" | "dumbbell" | "machine" | "isolation" | "assisted" | "bodyweight";

export const PRESETS: Record<
  PresetKey,
  { label: string } & Pick<Rulebook, "targetSets" | "repFloor" | "repCeiling" | "repStep" | "weightStep">
> = {
  barbell:    { label: "Barbell compound", targetSets: 3, repFloor: 6,  repCeiling: 10, repStep: 1, weightStep: 5 },
  dumbbell:   { label: "Dumbbell",         targetSets: 3, repFloor: 8,  repCeiling: 12, repStep: 1, weightStep: 5 },
  machine:    { label: "Machine / cable",  targetSets: 3, repFloor: 8,  repCeiling: 12, repStep: 1, weightStep: 10 },
  isolation:  { label: "Isolation / abs",  targetSets: 3, repFloor: 12, repCeiling: 15, repStep: 1, weightStep: 2.5 },
  assisted:   { label: "Assisted",         targetSets: 3, repFloor: 8,  repCeiling: 12, repStep: 1, weightStep: 10 },
  bodyweight: { label: "Bodyweight",       targetSets: 3, repFloor: 10, repCeiling: 15, repStep: 1, weightStep: 0 },
};
