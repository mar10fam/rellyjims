import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { db } from "./db";
import { LOCKOUT, PIN_REGEX, USERNAME_REGEX } from "./pin";

const SIGN_IN_PATH = "/sign-in/username";

export const auth = betterAuth({
  appName: "rellyjims",
  database: prismaAdapter(db, { provider: "postgresql" }),

  // The PIN *is* the password: hashed and verified by Better Auth like any password.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // accounts are created by an admin only
    minPasswordLength: 4,
    maxPasswordLength: 6,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 60, // stay signed in for 60 days on your phone
    updateAge: 60 * 60 * 24,
  },

  // IP-based limiter. Stored in Postgres because serverless instances don't share memory.
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      [SIGN_IN_PATH]: { window: 60, max: 5 },
    },
  },

  // Per-account lockout on top of the IP limiter: 5 wrong PINs → locked 15 minutes.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return;
      const body = ctx.body as { username?: string; password?: string } | undefined;
      if (!body?.password || !PIN_REGEX.test(body.password)) {
        throw new APIError("BAD_REQUEST", { message: "PIN must be 4–6 digits" });
      }
      const user = await findByUsername(body.username);
      if (user?.lockedUntil && user.lockedUntil > new Date()) {
        throw new APIError("TOO_MANY_REQUESTS", {
          message: "Too many wrong PINs. Try again in a few minutes.",
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return;
      const user = await findByUsername((ctx.body as { username?: string })?.username);
      if (!user) return;

      if (isAPIError(ctx.context.returned)) {
        if (ctx.context.returned.statusCode !== 401) return;
        const attempts = user.failedPinAttempts + 1;
        await db.user.update({
          where: { id: user.id },
          data:
            attempts >= LOCKOUT.maxAttempts
              ? { failedPinAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT.minutes * 60_000) }
              : { failedPinAttempts: attempts },
        });
      } else if (user.failedPinAttempts > 0 || user.lockedUntil) {
        await db.user.update({ where: { id: user.id }, data: { failedPinAttempts: 0, lockedUntil: null } });
      }
    }),
  },

  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 20,
      usernameValidator: (name) => USERNAME_REGEX.test(name.toLowerCase()),
    }),
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(), // must be last
  ],
});

async function findByUsername(name?: string) {
  if (!name) return null;
  return db.user.findUnique({
    where: { username: name.trim().toLowerCase() },
    select: { id: true, failedPinAttempts: true, lockedUntil: true },
  });
}

export type Session = typeof auth.$Infer.Session;
