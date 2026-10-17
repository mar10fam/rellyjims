"use client";

import { useActionState } from "react";
import { type ActionState, createUser, resetPin } from "./actions";

const input = "rounded-lg bg-neutral-900 px-3 py-2 ring-1 ring-neutral-800 focus:ring-lime-400 outline-none";

export function CreateUserForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createUser, null);
  return (
    <form action={action} className="grid gap-3">
      <input name="username" placeholder="username" autoCapitalize="none" className={input} required />
      <input name="name" placeholder="Display name" className={input} required />
      <input name="pin" placeholder="PIN (4–6 digits)" inputMode="numeric" pattern="\d{4,6}" className={input} required />
      <select name="role" className={input} defaultValue="user">
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <button disabled={pending} className="rounded-lg bg-lime-400 py-2 font-bold text-neutral-950 disabled:opacity-50">
        {pending ? "Creating…" : "Create account"}
      </button>
      <Status state={state} />
    </form>
  );
}

export function ResetPinForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(resetPin, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input name="pin" placeholder="New PIN" inputMode="numeric" pattern="\d{4,6}" className={`${input} w-28`} required />
      <button disabled={pending} className="rounded-lg bg-neutral-800 px-3 py-2 text-sm">
        Reset
      </button>
      <Status state={state} />
    </form>
  );
}

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return <p className={`text-sm ${state.error ? "text-red-400" : "text-lime-400"}`}>{state.error ?? state.ok}</p>;
}
