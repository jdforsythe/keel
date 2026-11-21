// Crash safety as a property, over a stand-in of tauri-plugin-store 2.5.1's files: for random earlier and new states,
// a save cut at every byte offset of its two files leaves a new driver reading exactly the earlier or the new state;
// and a run of writes, each killed at a random offset and followed by a restart, always reads one of the two states
// around the killed write.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { storeStorage } from "../src/internal/storeStorage.ts";
import { pluginStoreFiles } from "./pluginStoreFiles.ts";

const KEYS = ["a", "b", "c", "keel.outbox"];
const value = fc.string({ maxLength: 12 });
const state = fc.dictionary(fc.constantFrom(...KEYS), value);
const readAll = async (f: ReturnType<typeof pluginStoreFiles>): Promise<(string | null)[]> =>
  storeStorage(f.open).read(KEYS);
const view = (m: Readonly<Record<string, string>>): (string | null)[] => KEYS.map((k) => m[k] ?? null);

describe("storeStorage crash safety", () => {
  test("a save cut at every byte offset reads as the earlier or the new state", async () => {
    await fc.assert(
      fc.asyncProperty(state, state, fc.boolean(), async (earlier, change, viaCommit) => {
        const setup = pluginStoreFiles();
        const first = storeStorage(setup.open);
        for (const [k, v] of Object.entries(earlier)) await first.set(k, v);
        const base = new Map(setup.files);
        const next = { ...earlier, ...change };
        const write = (st: ReturnType<typeof storeStorage>): Promise<unknown> =>
          viaCommit
            ? st.commit(Object.entries(change).map(([k, v]) => ({ key: k, expect: earlier[k] ?? null, value: v })))
            : Promise.all(
                Object.entries(change)
                  .slice(0, 1)
                  .map(([k, v]) => st.set(k, v)),
              );
        const target = viaCommit ? next : { ...earlier, ...Object.fromEntries(Object.entries(change).slice(0, 1)) };
        const whole = pluginStoreFiles();
        for (const [p, t] of base) whole.files.set(p, t);
        await write(storeStorage(whole.open));
        const total = [...whole.files.values()].reduce((n, t) => n + t.length, 0);
        for (let cut = 0; cut <= total; cut++) {
          const f = pluginStoreFiles();
          for (const [p, t] of base) f.files.set(p, t);
          f.cutAfter(cut);
          await write(storeStorage(f.open)).catch((e: unknown) => expect(e).toBe(f.killed));
          f.heal();
          expect([view(earlier), view(target)]).toContainEqual(await readAll(f));
        }
      }),
      { seed: 1337, numRuns: 60 },
    );
  });

  test("writes killed at random offsets, each followed by a restart, read as one of the two states", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(fc.constantFrom(...KEYS), value, fc.option(fc.nat(600), { nil: undefined })), {
          minLength: 1,
          maxLength: 15,
        }),
        async (steps) => {
          const f = pluginStoreFiles();
          let model: Record<string, string> = {};
          let st = storeStorage(f.open);
          for (const [k, v, cut] of steps) {
            const after = { ...model, [k]: v };
            if (cut === undefined) {
              await st.set(k, v);
              model = after;
              continue;
            }
            f.cutAfter(cut);
            await st.set(k, v).catch((e: unknown) => expect(e).toBe(f.killed));
            f.heal();
            st = storeStorage(f.open);
            const got = await st.read(KEYS);
            expect([view(model), view(after)]).toContainEqual(got);
            if (got[KEYS.indexOf(k)] === v) model = after;
          }
          expect(await readAll(f)).toEqual(view(model));
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  });
});
