// Spec: std.statecharts, clause "An event's transaction passes `properties` for a chart whose guards and actions are pure."
// Seed: 1337.
// Assumption: `properties(target, { runs, seed })` returns (or resolves to) a result and throws E1704 on failure, so passing is "does not reject".
import { properties } from "@keel/testing";
import { describe, expect, test } from "vitest";
import { EVENTS, editor } from "./fixtures.ts";

describe("std.statecharts: transactions are well-behaved", () => {
  test("An event's transaction passes `properties` for a chart whose guards and actions are pure", async () => {
    const c = editor("pure");
    for (const ev of EVENTS) {
      await expect(Promise.resolve(properties(c.events[ev], { runs: 100, seed: 1337 }))).resolves.not.toThrow();
    }
  });
});
