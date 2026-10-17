/**
 * Bootstrap the first admin account (signup is disabled, so this is the only way in).
 *
 *   npm run create-admin -- <username> <pin> "<Display Name>"
 */
import "dotenv/config";
import { auth } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { pinSchema, placeholderEmail, usernameSchema } from "../src/lib/pin";

async function main() {
  const [rawUsername, rawPin, name] = process.argv.slice(2);
  if (!rawUsername || !rawPin) {
    console.error('Usage: npm run create-admin -- <username> <pin> "<Display Name>"');
    process.exit(1);
  }
  const username = usernameSchema.parse(rawUsername);
  const pin = pinSchema.parse(rawPin);

  // No headers → server-side call, permitted without an admin session.
  const { user } = await auth.api.createUser({
    body: {
      email: placeholderEmail(username),
      name: name ?? username,
      password: pin,
      role: "admin",
      data: { username, displayUsername: username },
    },
  });
  console.log(`✔ Admin "${username}" created (${user.id}). Sign in at /login.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
