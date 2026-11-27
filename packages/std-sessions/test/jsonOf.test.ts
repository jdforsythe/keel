// std.sessions: `jsonOf` with a schema is total over values the schema refuses (null), keeps declared keys only, and
// passes on what the value itself throws while it is read, a defect unchanged. Seed 1337 (no generated input).
import { defect, isDefect, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { jsonOf } from "../src/internal/jsonOf.ts";

const A = s.object({ a: s.int() });

describe("jsonOf", () => {
  it("encodes a value the schema accepts, declared keys only", () => {
    expect(jsonOf({ a: 1, b: "x" }, A)).toEqual({ a: 1 });
  });

  it("is null for a value the schema refuses, and never throws for one", () => {
    for (const v of [{ a: "1" }, null, 3, "x", [], { a: 1.5 }]) expect(jsonOf(v, A)).toBeNull();
  });

  it("passes on a defect or any other value the value's own read throws", () => {
    for (const thrown of ["text", new TypeError("t")]) {
      const v = new Proxy(
        { a: 1 },
        {
          get: () => {
            throw thrown;
          },
        },
      );
      expect(() => jsonOf(v, A)).toThrow();
    }
    const raises = new Proxy({ a: 1 }, { get: () => defect("read refused") });
    let caught: unknown;
    try {
      jsonOf(raises, A);
    } catch (e) {
      caught = e;
    }
    expect(isDefect(caught)).toBe(true);
  });
});
