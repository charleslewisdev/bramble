import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, generateSessionToken, generateInviteToken } from "./auth.js";

describe("auth service", () => {
  describe("password hashing", () => {
    it("hashes and verifies a password", async () => {
      const hash = await hashPassword("test-password-123");
      expect(hash).not.toBe("test-password-123");
      expect(await verifyPassword("test-password-123", hash)).toBe(true);
    });

    it("rejects wrong password", async () => {
      const hash = await hashPassword("correct-password");
      expect(await verifyPassword("wrong-password", hash)).toBe(false);
    });
  });

  describe("token generation", () => {
    it("generates unique session tokens", () => {
      const a = generateSessionToken();
      const b = generateSessionToken();
      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThan(30);
    });

    it("generates URL-safe invite tokens", () => {
      const token = generateInviteToken();
      expect(token.length).toBeGreaterThan(15);
      expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
    });
  });
});
