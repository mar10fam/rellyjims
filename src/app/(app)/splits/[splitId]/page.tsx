import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getSplitWithDays } from "@/lib/splits";
import { otherUsers } from "@/lib/shares";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { archiveSplit, createDay, toggleFavorite } from "../actions";
import { sendShare } from "@/app/(app)/shares/actions";
import { DayList } from "./day-list";
import { EditSplitForm } from "./edit-split-form";

// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ splitId: string }> }) {
  const user = await requireUser();
  const { splitId } = await params;
  const split = await getSplitWithDays(splitId, user.id);
  if (!split) notFound();
  const people = await otherUsers(user.id);

  return (
    <div className="grid gap-6">
      <PageHeader title={split.name} action={<FavoriteButton splitId={split.id} favorited={!!split.favoritedAt} />} />
      {split.description && <p className="text-sm text-muted-foreground">{split.description}</p>}

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Days</h2>
        <DayList splitId={split.id} days={split.days} />
        <form action={createDay} className="flex gap-2">
          <input type="hidden" name="splitId" value={split.id} />
          <input
            name="title"
            placeholder="New day title"
            required
            className="h-9 w-full min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <Button type="submit" variant="secondary">
            Add day
          </Button>
        </form>
        <Link href={`/splits/${split.id}/import`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Or paste notes to import a whole day
        </Link>
      </section>

      <Separator />

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Edit split</h2>
        <EditSplitForm split={split} />
      </section>

      {people.length > 0 && (
        <>
          <Separator />
          <section className="grid gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Share this split</h2>
            <form action={sendShare} className="flex gap-2">
              <input type="hidden" name="splitId" value={split.id} />
              <Select name="toUserId" required>
                <SelectTrigger className="w-full min-w-0 flex-1">
                  <SelectValue placeholder="Share with…" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (@{p.username ?? p.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="secondary">
                Send
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Only the exercises are shared — they&apos;ll enter their own weights.
            </p>
          </section>
        </>
      )}

      <Separator />

      <form action={archiveSplit}>
        <input type="hidden" name="splitId" value={split.id} />
        <button type="submit" className="text-sm text-muted-foreground hover:text-destructive">
          Archive split
        </button>
      </form>
    </div>
  );
}

function FavoriteButton({ splitId, favorited }: { splitId: string; favorited: boolean }) {
  return (
    <form action={toggleFavorite}>
      <input type="hidden" name="splitId" value={splitId} />
      <Button type="submit" variant="ghost" size="icon" aria-label={favorited ? "Unfavorite" : "Favorite"}>
        <Star className={favorited ? "fill-primary text-primary" : "text-muted-foreground"} />
      </Button>
    </form>
  );
}
