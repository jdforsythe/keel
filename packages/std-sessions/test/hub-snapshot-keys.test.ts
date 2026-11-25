// k.sync Write key: a stored snapshot without `keys` takes its log entries' keys. The hub's `snapshots()` reads them as
// `restore` does (one function, `snapshotKeys` of `@keel/store/internal`). Seed 1337.
import { scope } from "@keel/reactive";
import { type JsonValue, s } from "@keel/schema";
import { store } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { USER } from "../conformance/group-fixtures.ts";
import { openHub } from "../src/group/internal/openHub.ts";

const keyArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,12}$/);

test("snapshots() gives a stored snapshot without keys the keys restore gives it", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.option(keyArb, { nil: undefined }), { maxLength: 5 }), async (keys) => {
      const log = keys.map((key, i) => ({
        id: i + 1,
        name: "t.add",
        payload: { n: i },
        at: i + 1,
        ...(key === undefined ? {} : { key }),
      }));
      const snap: JsonValue = { state: { n: keys.length }, log, initial: { n: 0 }, head: keys.length };
      const hub = await openHub({
        serve: () => ({ fetch: async () => new Response("") }),
        seed: 1337,
        origin: "http://hub.test",
        at: 0,
        server: { t: snap },
        count: 0,
        user: USER,
      });
      try {
        const viaHub = (await hub.snapshots()).t?.keys;
        let viaRestore: unknown;
        scope(() => {
          const st = store(s.object({ n: s.int() }), { n: 0 }, { id: "t", logLimit: 16 });
          expect(st.restore(snap).ok).toBe(true);
          viaRestore = st.snapshot().keys;
        }).dispose();
        expect(viaHub).toEqual(viaRestore);
        expect(viaHub).toEqual(log.flatMap((e) => ("key" in e ? [{ name: e.name, key: e.key }] : [])));
      } finally {
        await hub.close();
      }
    }),
    { seed: 1337, numRuns: 20 },
  );
});
