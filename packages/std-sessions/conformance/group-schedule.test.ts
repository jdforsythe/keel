// Spec: std.multi, Conformance "Under one `schedule`, two runs of one script on `openGroup` give byte-equal groups, and with a `lost` step on a user's write the server holds one entry for that write's key."
// Seed: 1337.
// Skipped until `openGroup({ schedule })` exists. A `Schedule` is passed as a plain object (k.sim: `net`, `storage`, `offline`, `plans`).
// Assumption: the shared fixture's write carries no `key`, so "the server holds one entry for that write's key" is read as
// "the server's `log` store holds exactly one entry for that write" (the route ran once, the response was lost).
// Delays are at most 50 ms and every step is followed by a 60 ms `advance`, so no request stays in flight at `settle()`.
import { openGroup, replayGroup } from "@keel/std-sessions/group";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { GROUP_BOUND, ItemsState, SEED, type Step, USER, groupOptions, serve, texts } from "./group-fixtures.ts";

type Fault = "none" | "drop" | "lost" | "unavailable";
type Schedule = {
  net: { delay: number; fault: Fault }[];
  storage: ("ok" | "fail")[];
  offline: { at: number; ms: number }[];
  plans: Record<string, never>;
};

const faultArb = fc.constantFrom<Fault>("none", "drop", "lost", "unavailable");
const scheduleArb: fc.Arbitrary<Schedule> = fc.record({
  net: fc.array(fc.record({ delay: fc.integer({ min: 0, max: 50 }), fault: faultArb }), { maxLength: 6 }),
  storage: fc.constant([]),
  offline: fc.array(fc.record({ at: fc.integer({ min: 0, max: 300 }), ms: fc.integer({ min: 1, max: 100 }) }), {
    maxLength: 2,
  }),
  plans: fc.constant({}),
});

const word = fc.stringMatching(/^[a-z]{1,6}$/);
const user = fc.constantFrom<0 | 1>(0, 1);
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.tuple(user, word).map(([u, v]): Step => ({ u, do: "note", v })),
  fc
    .tuple(user, fc.constantFrom<"refresh" | "write" | "rename">("refresh", "write", "rename"))
    .map(([u, d]): Step => ({ u, do: d })),
  fc.integer({ min: 1, max: 200 }).map((advance): Step => ({ advance })),
);

type OpenedGroup = Awaited<ReturnType<typeof openGroup>>;

/** One step of a script, then enough clock for every scheduled delay to elapse, then `settle()`. */
async function step(g: OpenedGroup, st: Step): Promise<void> {
  if ("advance" in st) await g.advance(st.advance);
  else if (st.do === "online") await g.setOnline(st.u, st.b);
  else if (st.do === "note") await g.user(st.u).fire("board.note", { type: "input", value: st.v });
  else await g.user(st.u).fire(`board.${st.do}`, { type: "click" });
  await g.advance(60);
  await g.settle();
}

async function play(schedule: Schedule, script: readonly Step[]): Promise<string> {
  const g = await openGroup({ ...groupOptions(SEED), schedule });
  for (const st of script) await step(g, st);
  return JSON.stringify(await g.stop());
}

const CLAUSE =
  "Under one `schedule`, two runs of one script on `openGroup` give byte-equal groups, and with a `lost` step on a user's write the server holds one entry for that write's key.";

describe("std.multi: group schedule", () => {
  test(
    `${CLAUSE} (byte-equal groups, and the group keeps the schedule)`,
    async () => {
      // Workers make runs slow: few runs, each a pair of full group recordings.
      await fc.assert(
        fc.asyncProperty(scheduleArb, fc.array(stepArb, { maxLength: 8 }), async (schedule, script) => {
          const a = await play(schedule, script);
          const b = await play(schedule, script);
          expect(a).toBe(b);
          expect(Reflect.get(Object(JSON.parse(a)), "schedule")).toEqual(schedule);
        }),
        { seed: 1337, numRuns: 5 },
      );
    },
    5 * 2 * GROUP_BOUND,
  );

  test(
    `${CLAUSE} (a lost write leaves one entry)`,
    async () => {
      // Two users: user i gets steps i, i + 2, ... of `net`, so `net[w]` is user w's first request, its write.
      await fc.assert(
        fc.asyncProperty(user, word, async (writer, note) => {
          const reader: 0 | 1 = writer === 0 ? 1 : 0;
          const net: Schedule["net"] = [
            { delay: 0, fault: writer === 0 ? "lost" : "none" },
            { delay: 0, fault: writer === 1 ? "lost" : "none" },
          ];
          const schedule: Schedule = { net, storage: [], offline: [], plans: {} };
          const g = await openGroup({ ...groupOptions(SEED), schedule });
          await step(g, { u: writer, do: "note", v: note });
          await step(g, { u: writer, do: "write" });
          // the writer's fetch rejected with a TypeError: its page shows the offline status
          expect((await g.user(writer).find("board.status")).text).toBe("offline");
          await step(g, { u: reader, do: "refresh" });
          // the route ran once: the other user reads exactly one entry
          const expected = ["", ""];
          expected[reader] = note;
          expect(await texts(g, "board.items")).toEqual(expected);
          const group = await g.stop();
          const r = await replayGroup(group, { user: USER, serve });
          const log = ItemsState.parse(r.server.log?.state);
          expect(log.ok && log.value.items).toEqual([note]);
        }),
        { seed: 1337, numRuns: 4 },
      );
    },
    4 * 2 * GROUP_BOUND,
  );
});
