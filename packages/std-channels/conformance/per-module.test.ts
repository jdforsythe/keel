// Spec: std.channels, clause "With two serving modules, each counts only the streams on its own channel routes against its `maxStreams` and `perCaller`: one at its `maxStreams` leaves the other's opens unaffected."
// Seed 1337
// Assumptions: two modules `a` and `b` served by one createApp (see twoModules.ts); a stream is cookieless unless a cookie is given.
import fc from "fast-check";
import { expect, test } from "vitest";
import { settle, waitFor } from "./fixtures.ts";
import { type ModuleId, type Opened, serveTwo } from "./twoModules.ts";

const CLAUSE =
  "With two serving modules, each counts only the streams on its own channel routes against its `maxStreams` and `perCaller`: one at its `maxStreams` leaves the other's opens unaffected.";

async function check(full: ModuleId, bound: number, other: number, perCaller: boolean): Promise<void> {
  const rest: ModuleId = full === "a" ? "b" : "a";
  const cfg = (m: ModuleId) => (m === full ? { maxStreams: bound } : { maxStreams: other });
  const h = await serveTwo(cfg("a"), cfg("b"));
  const opened: Opened[] = [];
  try {
    const cookie = perCaller ? await h.mint() : undefined;
    const held: Opened[] = [];
    for (let i = 0; i < bound; i++) held.push(await h.open(full, cookie));
    await waitFor(() => held.every((st) => st.events.length >= 1));
    opened.push(...held);
    const over = await h.open(full, cookie);
    opened.push(over);
    await waitFor(() => over.ended());
    await settle();
    expect(over.events).toEqual([{ kind: "closed", reason: "full" }]);
    const kept: Opened[] = [];
    for (let i = 0; i < other; i++) kept.push(await h.open(rest, cookie));
    opened.push(...kept);
    await waitFor(() => kept.every((st) => st.events.length >= 1));
    for (const st of kept) expect(st.events[0]).toEqual({ kind: "reset" });
    for (const st of [...held, ...kept]) expect(st.ended()).toBe(false);
    // the other module's own bound still applies
    const past = await h.open(rest, cookie);
    opened.push(past);
    await waitFor(() => past.ended());
    expect(past.events).toEqual([{ kind: "closed", reason: "full" }]);
  } finally {
    for (const st of opened) st.close();
    await h.dispose();
  }
}

test(`${CLAUSE} (cookieless opens)`, async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom<ModuleId>("a", "b"),
      fc.integer({ min: 1, max: 3 }),
      fc.integer({ min: 1, max: 3 }),
      (full, bound, other) => check(full, bound, other, false),
    ),
    { seed: 1337, numRuns: 4 },
  );
});

test(`${CLAUSE} (one caller's streams)`, async () => {
  await check("a", 2, 2, true);
});

test(`${CLAUSE} (\`perCaller\`: one caller's streams on a leave its opens on b unaffected)`, async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom<ModuleId>("a", "b"),
      fc.integer({ min: 1, max: 3 }),
      fc.integer({ min: 1, max: 3 }),
      async (full, bound, other) => {
        const rest: ModuleId = full === "a" ? "b" : "a";
        const cfg = (m: ModuleId) => ({ perCaller: m === full ? bound : other });
        const h = await serveTwo(cfg("a"), cfg("b"));
        const opened: Opened[] = [];
        try {
          const cookie = await h.mint();
          for (let i = 0; i < bound; i++) opened.push(await h.open(full, cookie));
          await waitFor(() => opened.every((st) => st.events.length >= 1));
          const over = await h.open(full, cookie);
          opened.push(over);
          await waitFor(() => over.ended());
          expect(over.events).toEqual([{ kind: "closed", reason: "full" }]);
          const kept: Opened[] = [];
          for (let i = 0; i < other; i++) kept.push(await h.open(rest, cookie));
          opened.push(...kept);
          await waitFor(() => kept.every((st) => st.events.length >= 1));
          for (const st of kept) expect(st.events[0]).toEqual({ kind: "reset" });
          const past = await h.open(rest, cookie);
          opened.push(past);
          await waitFor(() => past.ended());
          expect(past.events).toEqual([{ kind: "closed", reason: "full" }]);
          for (const st of opened.filter((x) => x !== over && x !== past)) expect(st.ended()).toBe(false);
        } finally {
          for (const st of opened) st.close();
          await h.dispose();
        }
      },
    ),
    { seed: 1337, numRuns: 4 },
  );
});
