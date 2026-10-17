import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { ownedSplit } from "@/lib/splits";
import { PageHeader } from "@/components/page-header";
import { ImportForm } from "./import-form";

// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ splitId: string }> }) {
  const user = await requireUser();
  const { splitId } = await params;
  const split = await ownedSplit(splitId, user.id);
  if (!split) notFound();

  return (
    <div className="grid gap-6">
      <Link href={`/splits/${splitId}`} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> {split.name}
      </Link>
      <PageHeader title="Import from notes" />
      <ImportForm splitId={split.id} />
    </div>
  );
}
