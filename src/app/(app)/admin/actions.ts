"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pinSchema, placeholderEmail, usernameSchema } from "@/lib/pin";
import { requireAdmin } from "@/lib/session";

export type ActionState = { ok?: string; error?: string } | null;

const createSchema = z.object({
  username: usernameSchema,
  name: z.string().trim().min(1).max(40),
  pin: pinSchema,
  role: z.enum(["user", "admin"]),
});

export async function createUser(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { username, name, pin, role } = parsed.data;

  try {
    await auth.api.createUser({
      headers: await headers(),
      body: { email: placeholderEmail(username), name, password: pin, role, data: { username, displayUsername: username } },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create user" };
  }
  revalidatePath("/admin");
  return { ok: `Created ${username}` };
}

export async function resetPin(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const userId = String(form.get("userId"));
  const pin = pinSchema.safeParse(form.get("pin"));
  if (!pin.success) return { error: pin.error.issues[0].message };

  await auth.api.setUserPassword({ headers: await headers(), body: { userId, newPassword: pin.data } });
  revalidatePath("/admin");
  return { ok: "PIN updated" };
}

export async function removeUser(form: FormData) {
  const me = await requireAdmin();
  const userId = String(form.get("userId"));
  if (userId === me.id) return; // don't delete yourself
  await auth.api.removeUser({ headers: await headers(), body: { userId } });
  revalidatePath("/admin");
}
