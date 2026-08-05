import { describe, expect, it } from "vitest";
import { comparePassword, hashPassword } from "./password.js";

describe("password hashing", () => {
  it("hashes a password and verifies the correct plaintext matches", async () => {
    const hash = await hashPassword("ChangeMe123!");
    expect(await comparePassword("ChangeMe123!", hash)).toBe(true);
  });

  it("rejects an incorrect plaintext", async () => {
    const hash = await hashPassword("ChangeMe123!");
    expect(await comparePassword("WrongPassword", hash)).toBe(false);
  });

  it("produces a different hash each time (salted)", async () => {
    const [a, b] = await Promise.all([hashPassword("SamePlaintext"), hashPassword("SamePlaintext")]);
    expect(a).not.toBe(b);
  });
});
