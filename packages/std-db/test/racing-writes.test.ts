// Spec: k.server "An action's `ok` saves the changed stores in one commit ... another request's save since this one began is 409 `keel.conflict`."
// Spec: std.db, API "`commit` and `set` are one read committed transaction that takes `pg_advisory_xact_lock(hashtextextended(key, 0))` for each key in key order, compares, then writes."
// Two replicas (two `createApp`, each on its own driver over one database) race actions on one store row. The overlap is
// made by holding each action until the test releases it, so the order is chosen by a seeded property and no timer.
// Both drivers: SQLite on one file, Postgres on PGlite in-process or on the server `KEEL_TEST_POSTGRES_URL` names.
// Seed: 1337.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { KINDS, NOTES_KEY, SEED, field, makeRig } from "./support.ts";

const Notes = s.object({ items: s.array(s.string()) });
const Add = s.object({ text: s.string() });
const factory = () => {
  const notes = store(Notes, { items: [] }, { id: "t.notes" });
  const add = transaction(notes, "t.add", Add, (state, { text }) => ({ items: [...state.items, text] }));
  return { notes, add };
};
const t = contract("t", { "t.page": { path: "/notes" } });

/** Actions waiting for the test: each holds after its transaction until released. */
type Held = { text: string; release: () => void };
const held: Held[] = [];
let arrivals: ((h: Held) => void)[] = [];
const arrived = (): Promise<Held> => new Promise((r) => arrivals.push(r));

const write = action(t, "t.page", { input: Add, stores: factory }, async ({ text }, { stores }) => {
  void tx(stores.add, { text });
  await new Promise<void>((release) => {
    const h = { text, release };
    held.push(h);
    const next = arrivals.shift();
    if (next !== undefined) next(h);
  });
  return ok(null);
});
const read = loader(t, "t.page", { output: Notes, stores: factory }, async ({ stores }) =>
  ok({ items: [...stores.notes.get("items")] }),
);
const routes = manifest(t, {
  "t.page": { loader: read, component: () => document.createElement("main"), POST: write },
});
const headers = { accept: "application/json", "content-type": "application/json", origin: "http://localhost" };

async function replica(options: Parameters<typeof createCtx>[0]) {
  return createApp({
    topology: topology({ web: { modules: ["t"], adapter: "node" } }),
    routes,
    ctx: createCtx(options),
    mode: "production",
  });
}

const word = fc.stringMatching(/^[a-z]{1,8}$/);
/** Generated races the overlapping case runs on each driver. */
const RUNS = 5;
/**
 * What the overlapping case bounds on each driver: per run, a fresh database, two replicas made on it and two actions.
 * On Postgres without `KEEL_TEST_POSTGRES_URL` the database is a PGlite engine started and closed, about 400 ms a run
 * here on a quiet machine and up to 1 s beside the suite's other PGlite files; the first run also loads the engine's
 * WebAssembly, about 1.5 s. The bound is 12,000 ms a run and 15,000 ms for the load, so a runner ten times slower
 * (scale 0.1) still has 1.2 s a run and 1.5 s to load. SQLite takes the same bound and a small part of it.
 */
const RACE_BOUND = RUNS * 12_000 + 15_000;

for (const kind of KINDS) {
  describe(`${kind} driver`, () => {
    test(
      "overlapping actions on two replicas: the first released saves, the other is 409 keel.conflict and saves nothing",
      async () => {
        await fc.assert(
          fc.asyncProperty(word, word, fc.boolean(), async (a, b, bFirst) => {
            const rig = await makeRig(kind);
            try {
              const [sa, sb] = [await rig.open(), await rig.open()];
              const apps = [
                await replica({ mode: "real", drivers: { storage: sa } }),
                await replica({ mode: "real", drivers: { storage: sb } }),
              ];
              const [appA, appB] = apps;
              if (appA === undefined || appB === undefined) throw new Error("no replica");
              arrivals = [];
              held.length = 0;
              const post = (app: typeof appA, text: string) =>
                app.fetch(
                  new Request("http://localhost/notes", { method: "POST", body: JSON.stringify({ text }), headers }),
                );
              const hA = arrived();
              const resA = post(appA, a);
              await hA;
              const hB = arrived();
              const resB = post(appB, b);
              await hB;
              const [first, second] = bFirst ? [held[1], held[0]] : [held[0], held[1]];
              const [firstRes, secondRes] = bFirst ? [resB, resA] : [resA, resB];
              if (first === undefined || second === undefined) throw new Error("an action did not arrive");
              first.release();
              expect((await firstRes).status).toBe(200);
              const snapshot = await sa.get(NOTES_KEY);
              expect(field(JSON.parse(snapshot ?? "null"), "state")).toEqual({ items: [first.text] });
              second.release();
              const lost = await secondRes;
              expect(lost.status).toBe(409);
              expect(JSON.stringify(await lost.json())).toContain("keel.conflict");
              expect(await sb.get(NOTES_KEY)).toBe(snapshot);
              for (const app of apps) await app.close();
            } finally {
              await rig.stop();
            }
          }),
          { seed: SEED, numRuns: RUNS },
        );
      },
      RACE_BOUND,
    );

    test("actions that do not overlap on two replicas both save, in order", async () => {
      const rig = await makeRig(kind);
      try {
        const [sa, sb] = [await rig.open(), await rig.open()];
        const appA = await replica({ mode: "real", drivers: { storage: sa } });
        const appB = await replica({ mode: "real", drivers: { storage: sb } });
        arrivals = [];
        held.length = 0;
        for (const [app, text] of [
          [appA, "one"],
          [appB, "two"],
        ] as const) {
          const h = arrived();
          const res = app.fetch(
            new Request("http://localhost/notes", { method: "POST", body: JSON.stringify({ text }), headers }),
          );
          (await h).release();
          expect((await res).status).toBe(200);
        }
        expect(field(JSON.parse((await sb.get(NOTES_KEY)) ?? "null"), "state")).toEqual({ items: ["one", "two"] });
        await appA.close();
        await appB.close();
      } finally {
        await rig.stop();
      }
    });
  });
}
