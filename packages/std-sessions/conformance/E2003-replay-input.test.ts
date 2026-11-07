// Spec: std.sessions, clause "Each of E2001-E2005 has a fixture that triggers it and a clean counterpart."
// Seed 1337
import fc from "fast-check";
import { run } from "@keel/cli";
import { describe, expect, test } from "vitest";
import { cartRoutes, json, play } from "./fixtures.ts";

// E2003 replay cannot apply input event N (id absent from `ids.json`, href matches no route; message names N) (comes from `keel session`)
// Gap: the spec does not say whether N is zero-based, nor the stdout record shape; the test looks for the code and the decimal N in stdout. `ids.json` has to be supplied as a project file.
// TODO 0092: unskip
describe.skip("std.sessions: E2003 has a fixture that triggers it and a clean counterpart", () => {
  const replayOf = (source: string) =>
    run(["session", "replay", "s.json"], { cwd: ".", files: [{ path: "s.json", source }] });

  test("Each of E2001-E2005 has a fixture that triggers it: E2003 names event N when a fire id is absent from ids.json", async () => {
    const { session } = await play(1337, []);
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 5 }), async (n) => {
        const nav = { at: 0, kind: "nav" as const, href: cartRoutes().href("cart.show") };
        const events = [
          ...Array.from({ length: n }, () => nav),
          { at: 0, kind: "fire" as const, id: "no.such.id", event: { type: "click" as const } },
        ];
        const r = await replayOf(json({ ...session, events }));
        expect(r.stdout).toContain("E2003");
        expect(r.stdout).toContain(String(n));
      }),
      { seed: 1337, numRuns: 15 },
    );
  });

  test("Each of E2001-E2005 has a fixture that triggers it: E2003 when a nav href matches no route", async () => {
    const { session } = await play(1337, []);
    const events = [{ at: 0, kind: "nav" as const, href: cartRoutes().href("cart.show") }];
    const r = await replayOf(json({ ...session, events }).replace('"/cart"', '"/nowhere"'));
    expect(r.stdout).toContain("E2003");
  });

  test("Each of E2001-E2005 has a clean counterpart: E2003 absent when every input applies", async () => {
    const { session } = await play(1337, [{ id: "cart.add" }]);
    const r = await replayOf(json(session));
    expect(r.stdout).not.toContain("E2003");
  });
});
