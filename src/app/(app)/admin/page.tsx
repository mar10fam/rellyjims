import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { removeUser } from "./actions";
import { CreateUserForm, ResetPinForm } from "./forms";

// Reads the session directly (not behind its own Suspense boundary); see
// (app)/layout.tsx for why this opts out of instant-navigation validation.
export const instant = false;

export default async function AdminPage() {
  const me = await requireAdmin();
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, name: true, role: true, lockedUntil: true },
  });

  return (
    <div className="grid gap-8">
      <PageHeader title="Admin" />

      <section className="grid gap-3">
        <h2 className="font-semibold text-neutral-400">New account</h2>
        <CreateUserForm />
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold text-neutral-400">Accounts</h2>
        <ul className="grid gap-3">
          {users.map((u) => (
            <li key={u.id} className="grid gap-2 rounded-xl bg-neutral-900/60 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {u.name} <span className="text-neutral-500">@{u.username}</span>
                </span>
                <span className="text-xs uppercase text-neutral-500">{u.role}</span>
              </div>
              {u.lockedUntil && u.lockedUntil > new Date() && (
                <p className="text-xs text-amber-400">Locked until {u.lockedUntil.toLocaleTimeString()}</p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ResetPinForm userId={u.id} />
                {u.id !== me.id && (
                  <form action={removeUser}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="text-sm text-red-400">Remove</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
