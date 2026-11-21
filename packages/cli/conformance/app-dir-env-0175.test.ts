// Spec: k.data, Conformance "A loader answering `process.env.KEEL_APP_DIR`, from `node dist/<name>/server.mjs` started in another working directory, answers the absolute path of `dist/<name>`; with `KEEL_APP_DIR` set before start, that value."
// Seed 1337 (the explicit value is a generated folder name). Assumes: the env var is `KEEL_APP_DIR`; the answer is `<project>/dist/api` as an absolute path (the project path is realpath'd, as /tmp may be a symlink).
// Pending: server.mjs does not set it yet.
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, SLOW, built, cleanup, materialize } from "./boundary-support.ts";
import { appDataTree, withDirs } from "./app-data-support.ts";

test.skip(
  "A loader answering `process.env.KEEL_APP_DIR`, from `node dist/<name>/server.mjs` started in another working directory, answers the absolute path of `dist/<name>`; with `KEEL_APP_DIR` set before start, that value.",
  async () => {
    const dir = materialize(appDataTree());
    const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), "keel-appdir-cwd-")));
    try {
      expect(built(dir).status).toBe(0);
      await withDirs("server", dir, elsewhere, {}, (a) => {
        expect(a?.app).toBe(join(realpathSync(dir), "dist", "api"));
      });
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^[a-z]{3,10}$/), async (leaf) => {
          const chosen = join(elsewhere, `app-${leaf}`);
          await withDirs("server", dir, elsewhere, { KEEL_APP_DIR: chosen }, (a) => {
            expect(a?.app).toBe(chosen);
          });
        }),
        { seed: SEED, numRuns: 2 },
      );
    } finally {
      cleanup(dir);
      cleanup(elsewhere);
    }
  },
  SLOW,
);
