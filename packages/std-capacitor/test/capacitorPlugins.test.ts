// The plugins a Capacitor app lists (std.capacitor Plugins), at the versions this package's own package.json pins.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { capacitorPlugins } from "../src/tools/capacitorPlugins.ts";
import { capacitorTarget } from "../src/tools/capacitorTarget.ts";

const pkg: unknown = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"));
const pinned = (name: string): unknown => Reflect.get(Object(Reflect.get(Object(pkg), "dependencies")), name);
const app = (identity: boolean) => ({
  deployable: "web",
  id: "dev.keel.golden",
  name: "Golden",
  version: "1.0.0",
  pkg: "app",
  policy: undefined,
  identity,
});

describe("capacitorPlugins", () => {
  test("without identity: preferences and app at the pinned versions, and no browser", () => {
    expect(capacitorPlugins(app(false))).toEqual([
      { plugin: "@capacitor/preferences", version: pinned("@capacitor/preferences"), need: "storage" },
      { plugin: "@capacitor/app", version: pinned("@capacitor/app"), need: "launch and return links" },
    ]);
  });

  test("with identity the browser too; every version is an exact one and every need at most 60 characters", () => {
    const all = capacitorTarget.plugins(app(true));
    expect(all.map((p) => p.plugin)).toEqual(["@capacitor/preferences", "@capacitor/app", "@capacitor/browser"]);
    expect(all[2]).toEqual({
      plugin: "@capacitor/browser",
      version: pinned("@capacitor/browser"),
      need: "the external browser of identity.ts",
    });
    for (const p of all) {
      expect(p.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(p.need.length).toBeLessThanOrEqual(60);
    }
  });
});
