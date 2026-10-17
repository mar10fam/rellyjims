import { requireUser } from "@/lib/session";
import { otherUsers, pendingSharesReceived, sentShares, sharableSplits } from "@/lib/shares";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { sendShare } from "./actions";
import { IncomingShares } from "./incoming-shares";

// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function Page() {
  const user = await requireUser();
  const [incoming, sent, splits, people] = await Promise.all([
    pendingSharesReceived(user.id),
    sentShares(user.id),
    sharableSplits(user.id),
    otherUsers(user.id),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader title="Shares" />

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Shared with you</h2>
        <IncomingShares shares={incoming} />
      </section>

      <Separator />

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Share a split</h2>
        {splits.length === 0 && <p className="text-sm text-muted-foreground">You don&apos;t have any splits to share yet.</p>}
        {people.length === 0 && <p className="text-sm text-muted-foreground">No other accounts to share with.</p>}
        {splits.length > 0 && people.length > 0 && (
          <form action={sendShare} className="grid gap-2">
            <Select name="splitId" required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Which split?" />
              </SelectTrigger>
              <SelectContent>
                {splits.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select name="toUserId" required>
              <SelectTrigger className="w-full">
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
              Send share
            </Button>
          </form>
        )}
        <p className="text-xs text-muted-foreground">
          Only the exercises themselves are shared — the person who accepts enters their own weights.
        </p>
      </section>

      {sent.length > 0 && (
        <>
          <Separator />
          <section className="grid gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Sent</h2>
            <ul className="grid gap-2">
              {sent.map((share) => (
                <li key={share.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {share.split.name} → @{share.toUser.username ?? share.toUser.name}
                  </span>
                  <Badge variant={statusVariant(share.status)}>{statusLabel(share.status)}</Badge>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function statusLabel(status: "PENDING" | "ACCEPTED" | "DECLINED") {
  return { PENDING: "Pending", ACCEPTED: "Accepted", DECLINED: "Declined" }[status];
}

function statusVariant(status: "PENDING" | "ACCEPTED" | "DECLINED") {
  return { PENDING: "secondary", ACCEPTED: "default", DECLINED: "outline" }[status] as "secondary" | "default" | "outline";
}
