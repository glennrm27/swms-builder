import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET ??= "test-secret-at-least-16-chars";

const { signAccessToken, verifyAccessToken } = await import("./jwt.js");

describe("jwt sign/verify", () => {
  it("round-trips a payload", () => {
    const token = signAccessToken({ sub: "user-1", role: "ADMIN", email: "admin@example.com" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("ADMIN");
    expect(payload.email).toBe("admin@example.com");
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken({ sub: "user-1", role: "WORKER", email: "w@example.com" });
    const tampered = token.slice(0, -2) + "xx";
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});
