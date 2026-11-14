// Spec: std.db, Conformance "A process killed with SIGKILL after an action's response restarts on the same database and serves the same stored snapshot byte for byte; its next commit's head is one higher."
// Seed: 1337.
// Assumption: the snapshot JSON (`snapshot({ meta: true })`, k.persist) has a numeric top-level `head`; "one higher" is `head + 1`.
// The child is a real process and the signal is a real SIGKILL (POSIX); on a platform without it the test cannot run.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { SEED, appScript, field, removeDir, spawnNode, tempDir, writeScript } from "./fixtures.ts";
import fc from "fast-check";
import { expect, test } from "vitest";

const word = fc.stringMatching(/^[a-z]{1,8}$/);

test.skip("A process killed with SIGKILL after an action's response restarts on the same database and serves the same stored snapshot byte for byte; its next commit's head is one higher.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(word, { minLength: 1, maxLength: 3 }), word, async (before, next) => {
      const dir = tempDir();
      const procs: { stop(): Promise<unknown> }[] = [];
      try {
        const script = writeScript(dir, "app.mjs", appScript());
        const env = { KEEL_DATABASE_URL: pathToFileURL(join(dir, "keel.sqlite")).href };
        const first = spawnNode(script, env);
        procs.push(first);
        await first.waitLine("ready");
        for (const text of before) {
          first.send(`post ${text}`);
          expect(await first.waitLine("done")).toBe("200");
        }
        first.send("raw");
        const stored: unknown = JSON.parse(await first.waitLine("raw"));
        expect(typeof stored).toBe("string");
        const killed = await first.stop();
        expect(killed.signal).toBe("SIGKILL");

        const second = spawnNode(script, env);
        procs.push(second);
        await second.waitLine("ready");
        second.send("raw");
        expect(JSON.parse(await second.waitLine("raw"))).toBe(stored);
        second.send("get");
        expect(JSON.parse(await second.waitLine("items"))).toEqual(before);

        const head = field(JSON.parse(typeof stored === "string" ? stored : "null"), "head");
        expect(typeof head).toBe("number");
        second.send(`post ${next}`);
        expect(await second.waitLine("done")).toBe("200");
        second.send("raw");
        const after: unknown = JSON.parse(await second.waitLine("raw"));
        expect(field(JSON.parse(typeof after === "string" ? after : "null"), "head")).toBe(
          typeof head === "number" ? head + 1 : -1,
        );
      } finally {
        for (const p of procs) await p.stop();
        removeDir(dir);
      }
    }),
    { seed: SEED, numRuns: 3 },
  );
});
