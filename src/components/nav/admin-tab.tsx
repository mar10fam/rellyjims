import { Shield } from "lucide-react";
import { requireUser } from "@/lib/session";
import { NavTab } from "./nav-tab";

// Reads the session, so it must sit behind a <Suspense> boundary in the layout.
export async function AdminTab() {
  const user = await requireUser();
  return user.role === "admin" ? <NavTab href="/admin" label="Admin" icon={<Shield className="size-5" />} /> : null;
}
