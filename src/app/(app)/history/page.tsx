import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

// TODO: Past sessions, newest first; per-exercise history across slots.
// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function Page() {
  await requireUser();
  return (
    <div className="grid gap-3">
      <PageHeader title="History" />
      <Badge variant="secondary">Coming soon</Badge>
    </div>
  );
}
