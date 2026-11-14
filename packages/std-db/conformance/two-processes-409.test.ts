// Spec: std.db, Conformance "Two processes on one SQLite file, each serving `createApp` on its driver, with overlapping actions on one store: one saves, the other is 409, and the file holds the first's snapshot."
// Seed: 1337.
// Assumption: the children are `node --experimental-strip-types` on a script written to a temporary directory (fixtures.ts `appScript`);
// the action holds after its transaction until the parent sends `release`, so the overlap is made by messages and no timer.
// Assumption: the notes store's key is `keel.store.t.notes` (k.persist: `keel.store.<id>`).
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import {
  closeStorage,
  NOTES_KEY,
  SEED,
  appScript,
  field,
  removeDir,
  spawnNode,
  tempDir,
  writeScript,
} from "./fixtures.ts";
import { sqlite } from "@keel/std-db/sqlite";
import fc from "fast-check";
import { expect, test } from "vitest";

const word = fc.stringMatching(/^[a-z]{1,8}$/);

test.skip("Two processes on one SQLite file, each serving `createApp` on its driver, with overlapping actions on one store: one saves, the other is 409, and the file holds the first's snapshot.", async () => {
  await fc.assert(
    fc.asyncProperty(word, word, fc.boolean(), async (a, b, bFirst) => {
      const dir = tempDir();
      const procs: { stop(): Promise<unknown> }[] = [];
      const reader = await (async () => {
        const url = pathToFileURL(join(dir, "keel.sqlite"));
        return { url, storage: await sqlite(url) };
      })();
      try {
        const script = writeScript(dir, "app.mjs", appScript());
        const env = { KEEL_DATABASE_URL: reader.url.href, KEEL_HOLD: "1" };
        const p1 = spawnNode(script, env);
        const p2 = spawnNode(script, env);
        procs.push(p1, p2);
        await Promise.all([p1.waitLine("ready"), p2.waitLine("ready")]);
        p1.send(`post ${a}`);
        p2.send(`post ${b}`);
        await Promise.all([p1.waitLine("arrived"), p2.waitLine("arrived")]);
        const [first, second, firstText] = bFirst ? [p2, p1, b] : [p1, p2, a];
        first.send("release");
        expect(await first.waitLine("done")).toBe("200");
        const snapshot = await reader.storage.get(NOTES_KEY);
        expect(snapshot).not.toBeNull();
        expect(field(JSON.parse(snapshot ?? "null"), "state")).toEqual({ items: [firstText] });
        second.send("release");
        expect(await second.waitLine("done")).toBe("409");
        expect(await reader.storage.get(NOTES_KEY)).toBe(snapshot);
      } finally {
        for (const p of procs) await p.stop();
        await closeStorage(reader.storage);
        removeDir(dir);
      }
    }),
    { seed: SEED, numRuns: 3 },
  );
});
