import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { NewSplitForm } from "./form";

// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function Page() {
  await requireUser();
  return (
    <div className="grid gap-6">
      <PageHeader title="New split" />
      <NewSplitForm />
    </div>
  );
}
