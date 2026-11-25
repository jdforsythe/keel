// k.store Pure reads: `snapshotKeys` gives a snapshot's `keys`, else its log entries' keys in log order, as `restore`
// takes them. Seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { snapshotKeys, store } from "../src/index.ts";

test("snapshotKeys gives keys when present, else the log's, and restore takes the same", () => {
  const key = fc.stringMatching(/^[a-z0-9]{1,8}$/);
  fc.assert(
    fc.property(fc.array(fc.option(key, { nil: undefined }), { maxLength: 5 }), fc.boolean(), (keys, withKeys) => {
      const log = keys.map((k, i) => ({
        id: i + 1,
        name: "k.t",
        payload: {},
        at: i + 1,
        ...(k === undefined ? {} : { key: k }),
      }));
      const fromLog = log.flatMap((e) => ("key" in e ? [{ name: e.name, key: e.key }] : []));
      const given = [{ name: "k.other", key: "z" }];
      const snap = { state: { n: 0 }, log, initial: { n: 0 }, head: log.length, ...(withKeys ? { keys: given } : {}) };
      expect(snapshotKeys(snap)).toEqual(withKeys ? given : fromLog);
      scope(() => {
        const st = store(s.object({ n: s.int() }), { n: 0 }, { id: "k.keys" });
        expect(st.restore(snap).ok).toBe(true);
        expect(st.snapshot().keys).toEqual(snapshotKeys(snap));
      }).dispose();
    }),
    { seed: 1337, numRuns: 50 },
  );
});
