export { cn } from "cn"

/** "3×8 @ 65", "3 sets", "@ 65"… — any of sets/reps/weight may be unset (0 or null). Returns "" if all are. */
export function formatSetsRepsWeight(sets?: number | null, reps?: number | null, weight?: number | null) {
  const parts: string[] = [];
  if (sets && reps) parts.push(`${sets}×${reps}`);
  else if (sets) parts.push(`${sets} sets`);
  else if (reps) parts.push(`${reps} reps`);
  if (weight) parts.push(`@ ${weight}`);
  return parts.join(" ");
}
