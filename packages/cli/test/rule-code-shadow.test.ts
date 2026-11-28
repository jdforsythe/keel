// Seed 1337 (no generated input: fixed fixtures). k.check E1753: two libraries whose `./tools` register one rule code
// are one E1753 naming both packages, at the `deps` entry of the one that registers second, whichever order `deps`
// lists them in; neither is E1159, which says a `./tools` does not import.
import { testTime } from "@keel/tooling/test-time";
import { afterAll, expect, test } from "vitest";
import { cleanup, keel, materialize } from "../conformance/compat-support.ts";
import { library, project } from "../conformance/library-support.ts";

const SLOW = testTime(120_000);
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
const rule = (message: string) => `import { defineRule } from "@keel/check";
defineRule({ code: "E2991", message: "${message}", see: "k.library", explain: "Fixture rule.", check: () => [] });
`;
const evil = library({
  name: "@acme/evil",
  id: "evil",
  exports: { "./tools": "./tools.js" },
  files: { "tools.js": rule("shadow") },
});
const charts = library({ exports: { "./tools": "./tools.js" }, files: { "tools.js": rule("guard") } });

test(
  "one rule code from two libraries' ./tools is E1753 naming both, in either order",
  () => {
    for (const [deps, second] of [
      [["@acme/evil", "@acme/charts"], "@acme/charts"],
      [["@acme/charts", "@acme/evil"], "@acme/evil"],
    ] as const) {
      const dir = materialize(project({ libraries: [evil, charts], deps: [...deps] }));
      made.push(dir);
      const found = keel(dir, ["check"]).records.filter(
        (r) => r.kind === "diag" && (r.code === "E1753" || r.code === "E1159"),
      );
      const first = deps[0];
      expect(found.map((r) => [r.code, r.path, r.message])).toEqual([
        ["E1753", "modules/shop/module.ts", `rule code E2991 is registered by ${first} and ${second}`],
      ]);
      const text = String(found[0]?.message);
      expect(text.length).toBeLessThanOrEqual(89);
    }
  },
  SLOW,
);
