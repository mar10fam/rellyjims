import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { ownedSession } from "@/lib/workouts";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser();
  const { sessionId } = await params;
  const session = await ownedSession(sessionId, user.id);
  if (!session) notFound();

  const done = session.exercises.filter((e) => e.outcome !== "SKIPPED" && e.outcome !== "PENDING");
  const pending = session.exercises.filter((e) => e.outcome === "PENDING");
  const skipped = session.exercises.filter((e) => e.outcome === "SKIPPED");

  return (
    <div className="grid gap-6">
      <PageHeader title={session.dayTitle} />
      <p className="-mt-4 text-sm text-muted-foreground">
        {session.splitName}
        {session.completedAt && ` · ${new Date(session.completedAt).toLocaleDateString()}`}
      </p>

      {session.exercises.length === 0 && <p className="text-sm text-muted-foreground">No exercises in this session.</p>}

      {done.length > 0 && (
        <ul className="grid gap-2">
          {done.map((ex) => (
            <li key={ex.id} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-900 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{ex.exerciseName}</p>
                {ex.plannedSets != null && (
                  <p className="text-xs text-muted-foreground">
                    Planned {ex.plannedSets}×{ex.plannedReps}
                    {ex.plannedWeight ? ` @ ${ex.plannedWeight}` : ""}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-semibold">
                  {marker(ex.direction)} {ex.actualSets}×{ex.actualReps}
                  {ex.actualWeight ? ` @ ${ex.actualWeight}` : ""}
                </p>
                <Badge variant="secondary">{outcomeLabel(ex.outcome)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Still pending</h2>
          <ul className="grid gap-2">
            {pending.map((ex) => (
              <li key={ex.id} className="rounded-xl bg-neutral-900 px-4 py-3 text-muted-foreground">
                {ex.exerciseName}
              </li>
            ))}
          </ul>
        </section>
      )}

      {skipped.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Skipped</h2>
          <ul className="grid gap-2">
            {skipped.map((ex) => (
              <li key={ex.id} className="rounded-xl bg-neutral-900 px-4 py-3 text-muted-foreground">
                {ex.exerciseName}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function marker(direction: number | null) {
  if (direction === 1) return "▲";
  if (direction === -1) return "▼";
  if (direction === 0) return "●";
  return "";
}

function outcomeLabel(outcome: string) {
  return { FAILED: "Failed", HELD: "Held", GRADUATED: "Graduated", LOGGED: "Logged" }[outcome] ?? outcome;
}
