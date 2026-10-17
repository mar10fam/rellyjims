import { describe, expect, it } from "vitest";
import { parseNotes } from "./import-notes";

const SAMPLE = `Day 1 - Upper Body (2 Chest 1 Shoulder || 1 Chest 2 Shoulder)

* 1 Bench Press: 65lbs | (45 (bar) + 12.5)
   * 3 x 8
* 2 Pull ups or Lat Pulldowns: 88lbs (Assisted Pull Ups: 40)
   * 3 x 10
* 3 Lever Row: 55lbs
   * 3 x 8
* 3 Landmine Row:
   * 3 x 10
* 3 Seated Cable Row
   * 3 x 8

Day 2 - Glutes + Hamstrings + Abs

* Hip Thrust: 230lbs | (45+45+25)
   * 3 x 6
* Seated Leg Curl:
* Hanging Knee Raise
   * 3x12-15

Day 4 - Glutes + Quadriceps

* 2 Bulgarians: 17.5lbs
   * 3 x 6
   * 2 x 6
* 4 Dumbbell Calf Raises: 20lbs each
* 4 Standing Calf Raises: 180lbs | (45+45+45+45)
   * 3 x 15
`;

describe("parseNotes", () => {
  const days = parseNotes(SAMPLE);

  it("reads days, titles and day notes", () => {
    expect(days.map((d) => d.title)).toEqual(["Upper Body", "Glutes + Hamstrings + Abs", "Glutes + Quadriceps"]);
    expect(days[0].notes).toBe("2 Chest 1 Shoulder || 1 Chest 2 Shoulder");
    expect(days[2].order).toBe(4);
  });

  it("groups numbered options together", () => {
    expect(days[0].groups).toHaveLength(3);
    expect(days[0].groups[2].slots.map((s) => s.name)).toEqual(["Lever Row", "Landmine Row", "Seated Cable Row"]);
  });

  it("parses weight, plate notes and sets x reps", () => {
    const bench = days[0].groups[0].slots[0];
    expect(bench).toMatchObject({ name: "Bench Press", weight: 65, sets: 3, repFloor: 8, notes: "(45 (bar) + 12.5)" });
  });

  it("gives unnumbered exercises their own group and reads rep ranges", () => {
    expect(days[1].groups).toHaveLength(3);
    expect(days[1].groups[2].slots[0]).toMatchObject({ sets: 3, repFloor: 12, repCeiling: 15 });
    expect(days[1].groups[1].slots[0].weight).toBeUndefined();
  });

  it("detects per-side weights and keeps extra set lines as notes", () => {
    expect(days[2].groups[1].slots[0]).toMatchObject({ name: "Dumbbell Calf Raises", weight: 20, perSide: true });
    expect(days[2].groups[0].slots[0]).toMatchObject({ sets: 3, repFloor: 6, notes: "2 x 6" });
  });
});
