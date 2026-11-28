// The shell smokes load golden-1's session through the app's compiler (k.reactive Module roots): a chart made at a
// module's top level finds that module's root there, while the same module imported uncompiled has no owner (E1203).
// Seed 7 (no random inputs)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { fixedTime } from "../test-time.ts";
import { compiledImport } from "../smoke/compiledImport.mjs";

const app = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "apps", "golden-1");
const CHART = "./modules/api/removalChart.ts";

test(
  "a chart at a module's top level is made in its module root when the app's compiler loads it",
  async () => {
    const { module, close } = await compiledImport(app, CHART);
    try {
      expect(Reflect.get(Object(Reflect.get(Object(module), "removalChart")), "initial")).toBe("hidden");
    } finally {
      await close();
    }
  },
  fixedTime(60_000),
);

test("the same module imported uncompiled raises E1203", async () => {
  await expect(import(path.join(app, CHART))).rejects.toMatchObject({ code: "E1203" });
});
