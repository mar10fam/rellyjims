import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { loadTypeLabel } from "@/lib/progression";
import { deleteSlot } from "./actions";
import { EditSlotForm } from "./slot-form";

export type Slot = {
  id: string;
  trackingMode: "PROGRESSIVE" | "MANUAL";
  notes: string | null;
  targetSets: number | null;
  repFloor: number | null;
  repCeiling: number | null;
  repStep: number | null;
  weightStep: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  exercise: { name: string; loadType: "WEIGHTED" | "ASSISTED" | "BODYWEIGHT"; perSide: boolean };
};

export function SlotRow({ slot }: { slot: Slot }) {
  return (
    <li className="grid gap-2 rounded-lg bg-neutral-900 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {slot.exercise.name}
            {slot.exercise.perSide && <span className="text-muted-foreground"> (each)</span>}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Badge variant="outline">{loadTypeLabel(slot.exercise.loadType)}</Badge>
            <Badge variant={slot.trackingMode === "PROGRESSIVE" ? "default" : "secondary"}>{rulebookSummary(slot)}</Badge>
          </div>
          {slot.notes && <p className="pt-1 text-xs text-muted-foreground">{slot.notes}</p>}
        </div>

        <form action={deleteSlot}>
          <input type="hidden" name="slotId" value={slot.id} />
          <button type="submit" aria-label="Delete exercise option" className="p-1.5 text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        </form>
      </div>

      <details className="group">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground">
          <Pencil className="size-3" /> Edit
        </summary>
        <div className="pt-2">
          <EditSlotForm slot={slot} />
        </div>
      </details>
    </li>
  );
}

function rulebookSummary(slot: Slot) {
  if (slot.trackingMode === "MANUAL") {
    return `${slot.targetSets}×${slot.targetReps}${slot.targetWeight ? ` @ ${slot.targetWeight}` : ""}`;
  }
  return `${slot.targetSets}×${slot.repFloor}–${slot.repCeiling}${slot.weightStep ? ` · +${slot.weightStep}` : ""}`;
}
