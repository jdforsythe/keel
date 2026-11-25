// @vitest-environment happy-dom
// Spec: std.multi, clause "A `net` event that `record` captured is applied by `replay` and `replayGroup` as a `setOnline` call and recorded again."
// Seed 1337
// Assumptions: `ctx.net.setOnline(b)` is the sim switch (k.sync); `replay`'s `observed` is the array of events it
// observed during replay (std.sessions: "others are observations"), so a re-recorded `net` event appears in it.
import { createCtx } from "@keel/ctx";
import { record } from "@keel/std-sessions";
import { replay } from "@keel/std-sessions/replay";
import { openGroup, replayGroup } from "@keel/std-sessions/group";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { EMPTY_VIEW, GROUP_BOUND, SEED, USER, base, clientView, drive, groupOptions, routes, serve } from "./group-fixtures.ts";

const netOf = (events: readonly { readonly kind: string }[]): boolean[] =>
  events.flatMap((e) => ("online" in e && typeof e.online === "boolean" && e.kind === "net" ? [e.online] : []));

// The sim net starts online and reports only changes (k.sync).
const changes = (switches: readonly boolean[]): boolean[] => {
  let now = true;
  const out: boolean[] = [];
  for (const b of switches) {
    if (b !== now) out.push(b);
    now = b;
  }
  return out;
};

describe("std.multi: net events", () => {
  test("A `net` event that `record` captured is applied by `replay` as a `setOnline` call and recorded again", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }), async (switches) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const rec = record(ctx);
        const h = await renderRoute(base.id, { routes, ctx, state: [[clientView, EMPTY_VIEW]] });
        for (const b of switches) {
          ctx.net.setOnline(b);
          await h.fire("board.probe", { type: "click" });
        }
        const live = h.state();
        const session = rec.stop();
        h.dispose();
        expect(netOf(session.events)).toEqual(changes(switches));

        const r = await replay(session, { routes });
        // the probe reads `ctx.net.online()`: the replayed state matches only if each `net` event was applied
        expect(r.state).toEqual(live);
        expect(r.unapplied).toBeNull();
        expect(netOf(r.observed)).toEqual(netOf(session.events));
      }),
      { seed: 1337, numRuns: 10 },
    );
  }, 60_000);

  test("A `net` event that `record` captured is applied by `replayGroup` as a `setOnline` call and recorded again", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 4 }), async (switches) => {
        const g = await openGroup(groupOptions(SEED));
        for (const b of switches) {
          await drive(g, [
            { u: 1, do: "online", b },
            { u: 1, do: "probe" },
          ]);
        }
        const live = [await g.user(0).state(), await g.user(1).state()];
        const group = await g.stop();
        expect(netOf(group.users[1]?.events ?? [])).toEqual(changes(switches));
        expect(netOf(group.users[0]?.events ?? [])).toEqual([]);

        const r = await replayGroup(group, { user: USER, serve });
        expect(r.users.map((u) => u.state)).toEqual(live);
        expect(netOf(r.users[1]?.observed ?? [])).toEqual(changes(switches));
        expect(netOf(r.users[0]?.observed ?? [])).toEqual([]);
      }),
      { seed: 1337, numRuns: 4 },
    );
  }, 4 * 2 * GROUP_BOUND);
});
