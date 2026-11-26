// Spec: k.values, clause "`keel build`'s client JavaScript for a project with `brandTokens`, one scheme and no library holds none of the strings `safe-area-inset`, `cqmin`, `revert-layer` and `[aria-pressed=\"true\"]`."
// Spec: k.values, clause "**Stylesheet.** Each value a form admits gives a declaration the browser keeps and computes to a value other than the property's initial one, unless it is written as that value (`0`, `normal`). No part of the value forms ships in a client bundle: they run in `keel check`, `keel build`, `keel dev` and `defineTokens` under Node."
// Seed: 1337 (no generated input: one spawned `keel build` per adapter).
// The real binary builds staticTree's project (static-support.ts) with `brandTokens` (one scheme) as its `tokens.ts` and no library, once for a `static` and once for a `client` deployable; every `.js` file under `dist/site/assets/` is the client JavaScript.
// The case is not vacuous: the build exits 0 and the client JavaScript is not empty.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Run, type Tree, cleanup, keel, materialize } from "./compat-support.ts";
import { SLOW, staticTree } from "./static-support.ts";

const TOKENS = `import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`;
const ADAPTERS = ["static", "client"] as const;
const tree = (adapter: string): Tree => ({ ...staticTree("none", undefined, adapter), "tokens.ts": TOKENS });
const STRINGS = ["safe-area-inset", "cqmin", "revert-layer", '[aria-pressed="true"]'];

const dirs = new Map<string, string>();
const runs = new Map<string, Run>();
beforeAll(() => {
  for (const a of ADAPTERS) {
    const dir = materialize(tree(a));
    dirs.set(a, dir);
    runs.set(a, keel(dir, ["build"]));
  }
}, SLOW * 2);
afterAll(() => {
  for (const d of dirs.values()) cleanup(d);
});

const clientJs = (dir: string): string => {
  const assets = join(dir, "dist", "site", "assets");
  return readdirSync(assets)
    .filter((n) => n.endsWith(".js"))
    .map((n) => readFileSync(join(assets, n), "utf8"))
    .join("\n");
};

for (const adapter of ADAPTERS) {
  test(
    `\`keel build\`'s client JavaScript for a \`${adapter}\` project with \`brandTokens\`, one scheme and no library holds none of the strings \`safe-area-inset\`, \`cqmin\`, \`revert-layer\` and \`[aria-pressed="true"]\``,
    () => {
      const dir = dirs.get(adapter) ?? "";
      expect(runs.get(adapter)?.status).toBe(0);
      const js = clientJs(dir);
      expect(js.length).toBeGreaterThan(0);
      for (const s of STRINGS) expect(js, s).not.toContain(s);
    },
    SLOW,
  );
}
