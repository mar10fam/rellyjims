import { describe, expect, it } from "vitest";
import { applyOutcome, graduate, initialState, type Rulebook } from "./progression";

const bench: Rulebook = {
  loadType: "WEIGHTED",
  targetSets: 3,
  repFloor: 8,
  repCeiling: 12,
  repStep: 1,
  weightStep: 5,
  deloadAfterFails: 3,
  deloadPercent: 0.1,
};

describe("double progression", () => {
  it("adds reps until the ceiling, then adds weight and resets reps", () => {
    let t = { sets: 3, reps: 11, weight: 65 };
    t = graduate(bench, t);
    expect(t).toEqual({ sets: 3, reps: 12, weight: 65 });
    t = graduate(bench, t);
    expect(t).toEqual({ sets: 3, reps: 8, weight: 70 });
  });

  it("assisted exercises reduce assistance at the ceiling", () => {
    const rules: Rulebook = { ...bench, loadType: "ASSISTED", weightStep: 10 };
    expect(graduate(rules, { sets: 3, reps: 12, weight: 40 })).toEqual({ sets: 3, reps: 8, weight: 30 });
  });

  it("bodyweight exercises add a set at the ceiling", () => {
    const rules: Rulebook = { ...bench, loadType: "BODYWEIGHT", weightStep: 0 };
    expect(graduate(rules, { sets: 3, reps: 12, weight: 0 })).toEqual({ sets: 4, reps: 8, weight: 0 });
  });

  it("hold keeps the target and clears the fail streak", () => {
    const r = applyOutcome(bench, { sets: 3, reps: 9, weight: 65, failStreak: 2 }, "HELD");
    expect(r.next).toEqual({ sets: 3, reps: 9, weight: 65, failStreak: 0 });
    expect(r.direction).toBe(0);
  });

  it("fail restarts from what was actually done", () => {
    const r = applyOutcome(bench, { ...initialState(bench, 65) }, "FAILED", { sets: 3, reps: 6, weight: 65 });
    expect(r.next).toEqual({ sets: 3, reps: 6, weight: 65, failStreak: 1 });
    expect(r.direction).toBe(-1);
    expect(r.deloadSuggestion).toBeUndefined();
  });

  it("suggests a deload after repeated fails", () => {
    const r = applyOutcome(bench, { sets: 3, reps: 8, weight: 100, failStreak: 2 }, "FAILED", {
      sets: 3,
      reps: 6,
      weight: 100,
    });
    expect(r.deloadSuggestion).toEqual({ sets: 3, reps: 8, weight: 90 });
  });
});
