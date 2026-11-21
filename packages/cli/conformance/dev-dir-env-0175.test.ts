// Spec: k.data, Conformance "Under `keel dev`, a loader answering `process.env.KEEL_DEV_DIR` answers the absolute path of the app's `.keel-dev/`."
// Seed 1337 (no generated input: one scenario). Assumes: the variable is `KEEL_DEV_DIR`; the answer is `<project>/.keel-dev` with no trailing slash, the project path realpath'd.
// Pending: keel dev does not set it yet.
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { SLOW, cleanup, materialize } from "./boundary-support.ts";
import { appDataTree, withDirs } from "./app-data-support.ts";

test(
  "Under `keel dev`, a loader answering `process.env.KEEL_DEV_DIR` answers the absolute path of the app's `.keel-dev/`.",
  async () => {
    const dir = materialize(appDataTree());
    try {
      await withDirs("dev", dir, dir, {}, (a) => {
        expect(a?.dev).toBe(join(realpathSync(dir), ".keel-dev"));
      });
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);
