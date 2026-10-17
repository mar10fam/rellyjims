import { z } from "zod";

export const PIN_REGEX = /^\d{4,6}$/;
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export const pinSchema = z.string().regex(PIN_REGEX, "PIN must be 4–6 digits");
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_REGEX, "3–20 characters: letters, numbers, underscore");

/** Better Auth requires an email; this one is never used to send anything. */
export const placeholderEmail = (username: string) => `${username.toLowerCase()}@rellyjims.local`;

export const LOCKOUT = {
  maxAttempts: 5,
  minutes: 15,
} as const;
