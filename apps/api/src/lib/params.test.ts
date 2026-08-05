import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { HttpError } from "./httpError.js";
import { requireParam } from "./params.js";

function fakeRequest(params: Record<string, string | undefined>): Request {
  return { params } as unknown as Request;
}

describe("requireParam", () => {
  it("returns the param value when present", () => {
    expect(requireParam(fakeRequest({ id: "abc-123" }), "id")).toBe("abc-123");
  });

  it("throws a 400 HttpError when the param is missing", () => {
    expect(() => requireParam(fakeRequest({}), "id")).toThrow(HttpError);
    try {
      requireParam(fakeRequest({}), "id");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(400);
    }
  });
});
