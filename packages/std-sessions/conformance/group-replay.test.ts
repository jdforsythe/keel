// Spec: std.multi, clause "`replayGroup` of a recorded group ends with every server store equal to the live group's final store and each user's `state()` equal to its live final state; two replays are byte-equal."
// Seed 1337
// Assumption: the live group's final store is read the way a user reads it, through `board.refresh` (title, items).
import { openGroup, replayGroup } from "@keel/std-sessions/group";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { GROUP_BOUND, ItemsState, SEED, type Step, TitleState, USER, drive, groupOptions, serve } from "./group-fixtures.ts";

const word = fc.stringMatching(/^[a-z]{1,6}$/);
const user = fc.constantFrom<0 | 1>(0, 1);
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.tuple(user, word).map(([u, v]): Step => ({ u, do: "note", v })),
  fc
    .tuple(user, fc.constantFrom<"write" | "rename" | "probe">("write", "rename", "probe"))
    .map(([u, d]): Step => ({ u, do: d })),
  fc.tuple(user, fc.boolean()).map(([u, b]): Step => ({ u, do: "online", b })),
  fc.integer({ min: 1, max: 400 }).map((advance): Step => ({ advance })),
);

const seeded = {
  board: { state: { title: "Seeded" }, log: [], initial: { title: "Seeded" }, head: 0 },
};

async function record(script: readonly Step[]) {
  const g = await openGroup(groupOptions(SEED, 2, seeded));
  // Replay orders inputs by `at`, then user index (std.multi), so live inputs of different users get distinct `at`s.
  await drive(
    g,
    script.flatMap((st): Step[] => [st, { advance: 1 }]),
  );
  await drive(g, [{ u: 0, do: "refresh" }, { advance: 1 }, { u: 1, do: "refresh" }]);
  const liveState = [await g.user(0).state(), await g.user(1).state()];
  const liveTitle = (await g.user(0).find("board.title")).text;
  const liveItems = (await g.user(0).find("board.items")).text;
  return { group: await g.stop(), liveState, liveTitle, liveItems };
}

/** Generated scripts each case runs: a group recorded and replayed once a run, or twice in the byte-equal case. */
const RUNS = 4;

describe("std.multi: replayGroup", () => {
  test("`replayGroup` of a recorded group ends with every server store equal to the live group's final store", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 8 }), async (script) => {
        const live = await record(script);
        const r = await replayGroup(live.group, { user: USER, serve });
        // `server` holds the stores stored under `keel.store.<id>`: `board` was seeded, `log` is stored once saved.
        const board = TitleState.parse(r.server.board?.state);
        expect(board.ok && board.value.title).toBe(live.liveTitle);
        const log = ItemsState.parse(r.server.log?.state);
        if (log.ok) expect(log.value.items.join(",")).toBe(live.liveItems);
        else expect(live.liveItems).toBe("");
      }),
      { seed: 1337, numRuns: RUNS },
    );
  }, RUNS * 2 * GROUP_BOUND);

  test("`replayGroup` of a recorded group ends with each user's `state()` equal to its live final state", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 8 }), async (script) => {
        const live = await record(script);
        const r = await replayGroup(live.group, { user: USER, serve });
        expect(r.users.map((u) => u.state)).toEqual(live.liveState);
        expect(r.reproduced).toBe(true);
      }),
      { seed: 1337, numRuns: RUNS },
    );
  }, RUNS * 2 * GROUP_BOUND);

  test("two replays of one group are byte-equal", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 8 }), async (script) => {
        const { group } = await record(script);
        const a = await replayGroup(group, { user: USER, serve });
        const b = await replayGroup(group, { user: USER, serve });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }),
      { seed: 1337, numRuns: RUNS },
    );
  }, RUNS * 3 * GROUP_BOUND);
});
