// Spec: std.multi, clause "Inputs of different users apply in order of `at`, then user index, then event index."
// Seed 1337
// Assumption: the order of applied inputs is read from the replayed server's `log` store (`log.append` entries, one per
// `board.write` click). The expected order is computed from the group's own events: every `board.write` click, with the
// note its user last typed, sorted by `at`, then user index, then event index.
import { openGroup, replayGroup } from "@keel/std-sessions/group";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { GROUP_BOUND, ItemsState, SEED, USER, drive, groupOptions, serve } from "./group-fixtures.ts";

type Write = { readonly u: 0 | 1; readonly note: string; readonly gap: number };
const writeArb: fc.Arbitrary<Write> = fc.record({
  u: fc.constantFrom<0 | 1>(0, 1),
  note: fc.stringMatching(/^[a-z]{1,4}$/),
  // gap 0: the next write happens at the same `at`, so user index breaks the tie on replay
  gap: fc.constantFrom(0, 0, 25, 100),
});

/** Generated write lists the case runs: a group opened and replayed a run. */
const RUNS = 5;

describe("std.multi: replay order", () => {
  test(
    "Inputs of different users apply in order of `at`, then user index, then event index",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(writeArb, { minLength: 2, maxLength: 6 }), async (writes) => {
          const g = await openGroup(groupOptions(SEED));
          let n = 0;
          for (const w of writes) {
            const text = `${w.u}-${n++}-${w.note}`;
            await drive(g, [
              { u: w.u, do: "note", v: text },
              { u: w.u, do: "write" },
            ]);
            if (w.gap > 0) await drive(g, [{ advance: w.gap }]);
          }
          const group = await g.stop();

          const expected: { at: number; u: number; idx: number; text: string }[] = [];
          group.users.forEach((session, u) => {
            let note = "";
            session.events.forEach((e, idx) => {
              if (e.kind !== "fire") return;
              if (e.id === "board.note" && e.event.type === "input") note = e.event.value;
              if (e.id === "board.write") expected.push({ at: e.at, u, idx, text: note });
            });
          });
          expected.sort((a, b) => a.at - b.at || a.u - b.u || a.idx - b.idx);

          const r = await replayGroup(group, { user: USER, serve });
          const log = ItemsState.parse(r.server.log?.state);
          expect(log.ok && log.value.items).toEqual(expected.map((e) => e.text));
        }),
        { seed: 1337, numRuns: RUNS },
      );
    },
    RUNS * 2 * GROUP_BOUND,
  );
});
