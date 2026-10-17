"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptShare, declineShare } from "./actions";

export type IncomingShare = {
  id: string;
  split: { name: string; description: string | null };
  fromUser: { username: string | null; name: string };
};

// Calling a server action directly (not through a <form action>) doesn't make
// Next.js refresh this route's server-rendered data on its own, so the
// accepted/declined row is removed from local state here instead of waiting
// on a page refresh — same pattern as the workout carousel's remove/add.
export function IncomingShares({ shares: initial }: { shares: IncomingShare[] }) {
  const [shares, setShares] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setShares(initial);
  }

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function respond(id: string, action: (shareId: string) => Promise<void>) {
    setPendingId(id);
    startTransition(async () => {
      await action(id);
      setShares((prev) => prev.filter((s) => s.id !== id));
      setPendingId(null);
    });
  }

  if (shares.length === 0) return <p className="text-sm text-muted-foreground">Nothing pending.</p>;

  return (
    <ul className="grid gap-2">
      {shares.map((share) => (
        <li key={share.id}>
          <Card className="gap-2 px-4">
            <div>
              <p className="font-semibold">{share.split.name}</p>
              <p className="text-sm text-muted-foreground">from @{share.fromUser.username ?? share.fromUser.name}</p>
              {share.split.description && <p className="mt-1 text-sm text-muted-foreground">{share.split.description}</p>}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                size="sm"
                disabled={pendingId === share.id}
                onClick={() => respond(share.id, acceptShare)}
              >
                Accept
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                size="sm"
                disabled={pendingId === share.id}
                onClick={() => respond(share.id, declineShare)}
              >
                Decline
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
