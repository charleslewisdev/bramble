import { hash, verify } from "@node-rs/argon2";
import { randomBytes, createHash } from "crypto";

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return verify(passwordHash, password);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateInviteToken(): string {
  return randomBytes(16).toString("base64url");
}

/** Session duration: 30 days */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Invite duration: 7 days */
export const INVITE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Generate an API key with brk_ prefix */
export function generateApiKey(): string {
  return `brk_${randomBytes(32).toString("base64url")}`;
}

/** Hash an API key for storage (SHA-256, not Argon2 — fast lookup needed) */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Extract the display prefix from a key */
export function apiKeyPrefix(key: string): string {
  return key.slice(0, 12);
}
