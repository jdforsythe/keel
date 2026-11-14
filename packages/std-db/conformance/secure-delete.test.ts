// Spec: std.db, Conformance "After a value is overwritten, its entry folded and the driver closed, the SQLite file's bytes do not hold it."
// Seed: 1337.
// Assumption: at the driver level "its entry folded" is a `commit` that overwrites the key: the store's `logLimit` folding (k.persist, k.server)
// ends in such a commit, and the spec names no way to fold through the driver alone. The driver's `close()` is read without a cast (fixtures.ts).
// The file is the main database file; after a clean close WAL mode has checkpointed into it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sqlite } from "@keel/std-db/sqlite";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, closeStorage, removeDir, tempDir } from "./fixtures.ts";

const marker = fc.stringMatching(/^[a-f0-9]{24}$/).map((hex) => `marker-${hex}`);

test.skip("After a value is overwritten, its entry folded and the driver closed, the SQLite file's bytes do not hold it.", async () => {
  await fc.assert(
    fc.asyncProperty(marker, marker, async (oldValue, newValue) => {
      fc.pre(oldValue !== newValue);
      const dir = tempDir();
      try {
        const file = join(dir, "keel.sqlite");
        const storage = await sqlite(pathToFileURL(file));
        await storage.set("keel.store.t.notes", oldValue);
        expect(await storage.commit([{ key: "keel.store.t.notes", expect: oldValue, value: newValue }])).toBe(true);
        await closeStorage(storage);
        const bytes = readFileSync(file);
        expect(bytes.includes(Buffer.from(oldValue))).toBe(false);
        expect(bytes.includes(Buffer.from(newValue))).toBe(true);
      } finally {
        removeDir(dir);
      }
    }),
    { seed: SEED, numRuns: 10 },
  );
});
