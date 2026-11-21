// @vitest-environment happy-dom
// Spec: std.sessions, clause "E2001-E2005 each fire on a fixture, not on its clean twin." (E2003)
// Seed 1337
import { run } from "@keel/cli";
import { replay } from "@keel/std-sessions/replay";
import "@keel/std-sessions/tools";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { buggySession, cartContract, cartRoutes, diskFixture, play, sessionFile } from "./fixtures.ts";

// E2003 replay cannot apply input event N (0-based; message names N) (comes from `keel session`)
describe("std.sessions: E2003 fires on a fixture, not on its clean twin", () => {
  test("E2003 fires on a fixture: replay stops at the unapplicable input N", async () => {
    const { session } = await play(1337, []);
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 5 }), async (n) => {
        const nav = { at: 0, kind: "nav" as const, href: cartContract.href("cart.show") };
        const events = [
          ...Array.from({ length: n }, () => nav),
          { at: 0, kind: "fire" as const, id: "no.such.id", event: { type: "click" as const } },
        ];
        const r = await replay({ ...session, events }, { routes: cartRoutes() });
        expect(r.unapplied).toBe(n);
      }),
      { seed: 1337, numRuns: 100 },
    );
  }, 60_000);

  test("E2003 fires on a fixture: a nav href matching no route is unapplied at index 0", async () => {
    const { session } = await play(1337, []);
    const events = [{ at: 0, kind: "nav" as const, href: "/nowhere" }];
    const r = await replay({ ...session, events }, { routes: cartRoutes() });
    expect(r.unapplied).toBe(0);
  }, 60_000);

  test("E2003 does not fire on its clean twin: every input applies", async () => {
    const { session } = await play(1337, [{ id: "cart.add" }]);
    const r = await replay(session, { routes: cartRoutes() });
    expect(r.unapplied).toBeNull();
  }, 60_000);

  describe("keel session replay", () => {
    const fx = diskFixture();
    afterAll(() => fx.dispose());

    test("E2003 fires on a fixture: keel session replay names input event 3", async () => {
      const good = await buggySession();
      const at = good.events[3]?.at ?? 0;
      const events = good.events.map((e, i) =>
        i === 3 ? { at, kind: "fire" as const, id: "no.such.id", event: { type: "click" as const } } : e,
      );
      fx.write("sessions/s.json", sessionFile({ ...good, events }));
      const r = await run(["session", "replay", "sessions/s.json"], { cwd: fx.dir, files: fx.files() });
      expect(r.stdout).toContain("E2003");
      expect(r.stdout).toContain("input event 3");
    }, 120_000);

    test("E2003 does not fire on its clean twin: keel session replay of the unmodified session", async () => {
      fx.write("sessions/s.json", sessionFile(await buggySession()));
      const r = await run(["session", "replay", "sessions/s.json"], { cwd: fx.dir, files: fx.files() });
      expect(r.stdout).not.toContain("E2003");
    }, 120_000);
  });
});
