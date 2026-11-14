// A SIGKILL while a child process commits in a loop leaves the SQLite file at one commit's state: both keys equal.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sqlite } from "@keel/std-db/sqlite";
import { expect, test } from "vitest";
import { closeStorage, removeDir, spawnNode, tempDir, writeScript } from "../conformance/fixtures.ts";

const driver = new URL("../src/sqlite/index.ts", import.meta.url).href;
const loop = `import { sqlite } from "${driver}";
const storage = await sqlite(new URL(process.env.KEEL_DATABASE_URL));
for (let n = 0; ; n++) {
  const [a] = await storage.read(["a"]);
  const big = String(n).padEnd(20000, "x");
  await storage.commit([{ key: "a", expect: a, value: big }, { key: "b", expect: a, value: big }]);
  if (n % 10 === 0) console.log("tick " + n);
}
`;

test("a SIGKILL mid-commit leaves the old or the new state, never a mix", async () => {
  const dir = tempDir();
  const url = pathToFileURL(join(dir, "keel.sqlite"));
  const procs: { stop(): Promise<unknown> }[] = [];
  try {
    const script = writeScript(dir, "loop.mjs", loop);
    for (const at of ["tick 10", "tick 30", "tick 50"]) {
      const p = spawnNode(script, { KEEL_DATABASE_URL: url.href });
      procs.push(p);
      await p.waitLine(at);
      expect((await p.stop()).signal).toBe("SIGKILL");
      const storage = await sqlite(url);
      const [a, b] = await storage.read(["a", "b"]);
      await closeStorage(storage);
      expect(a).not.toBeNull();
      expect(a).toBe(b);
    }
  } finally {
    for (const p of procs) await p.stop();
    removeDir(dir);
  }
});
