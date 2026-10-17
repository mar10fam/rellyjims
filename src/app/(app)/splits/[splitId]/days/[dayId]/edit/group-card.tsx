import { Trash2 } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteGroup } from "./actions";
import { AddSlotForm } from "./slot-form";
import { SlotList } from "./slot-list";
import type { Slot } from "./slot-row";

export type Group = {
  id: string;
  order: number;
  label: string | null;
  slots: Slot[];
};

export function GroupCard({ group, exerciseNames }: { group: Group; exerciseNames: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Group {group.order}
          {group.label && <span className="text-muted-foreground"> · {group.label}</span>}
        </CardTitle>
        <CardAction>
          <form action={deleteGroup}>
            <input type="hidden" name="groupId" value={group.id} />
            <button type="submit" aria-label="Delete group" className="p-1.5 text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" />
            </button>
          </form>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <SlotList groupId={group.id} slots={group.slots} />
        <AddSlotForm groupId={group.id} exerciseNames={exerciseNames} />
      </CardContent>
    </Card>
  );
}
