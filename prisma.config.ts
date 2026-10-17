import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI (migrate, studio) uses Neon's DIRECT (non-pooled) connection.
// The app at runtime uses the pooled DATABASE_URL via the Neon driver adapter (src/lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Vercel's Neon integration names it DATABASE_URL_UNPOOLED. `prisma generate` doesn't need it.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
