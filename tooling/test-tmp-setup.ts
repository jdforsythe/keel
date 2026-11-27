// Setup file of every `keelConfig` run: removes the folders `tempDir` (test-tmp.ts) made, when a test file ends.
import { afterAll } from "vitest";
import { removeTempDirs } from "./test-tmp.ts";

afterAll(() => {
  removeTempDirs();
});
