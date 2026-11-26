// k.looks Entries, k.library: with `keel` first in each `exports` entry, the file `keel check` reads as a library's
// source is the file `keel build`'s bundler and `tokens.ts`'s evaluation load. The library's `default` targets name
// other files, which would give other values or no `Badge` at all: the check is clean over the `keel` sources, the
// build renders the `Badge` from `src/`, and its CSS holds the value `src/chartsTokens.ts` ships, not `tokens.js`'s.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { LIB, SLOW, cleanup, keel, library, materialize, project } from "../conformance/library-support.ts";

const SHIPPED =
  "import { defineTokens } from '@keel/ui'\nexport const chartsTokens = defineTokens({ space: { 'charts.2': '8px' } })\n";
const OTHER = "export const chartsTokens = { space: { 'charts.2': '99px' } };\n";
const BADGE =
  "import { Box } from '@keel/ui'\nexport default function Badge(props: { id: string }) {\n  return <Box id={`${props.id}.box`} p=\"charts.2\" />\n}\n";
const TOKENS =
  "import { defineTokens } from '@keel/ui'\nimport { brandTokens } from '@keel/ui/brand'\nimport { chartsTokens } from '@acme/charts/tokens'\nexport const tokens = defineTokens({ ...brandTokens, space: { ...brandTokens.space, ...chartsTokens.space } })\n";

test(
  "the file check judges as a library's source is the file the build loads, for `.` and for `./tokens`",
  () => {
    const lib = library({
      exports: { "./tokens": { keel: "./src/chartsTokens.ts", default: "./tokens.js" } },
      files: { "src/chartsTokens.ts": SHIPPED, "tokens.js": OTHER, "src/Badge.tsx": BADGE },
    });
    const dir = materialize({ ...project({ adapter: "static", home: true, libraries: [lib] }), "tokens.ts": TOKENS });
    try {
      const checked = keel(dir, ["check"]);
      expect(checked.records.filter((r) => r.kind === "diag")).toEqual([]);
      const built = keel(dir, ["build"]);
      expect(built.status).toBe(0);
      const html = readFileSync(join(dir, "dist", "site", "index.html"), "utf8");
      expect(html).toContain('id="shop.badge.box"');
      const assets = join(dir, "dist", "site", "assets");
      const css = readdirSync(assets)
        .filter((f) => f.endsWith(".css"))
        .map((f) => readFileSync(join(assets, f), "utf8"))
        .join("");
      expect(css.replace(/\s+/g, "")).toContain("--k-space-charts-2:8px");
      expect(css).not.toContain("99px");
      expect(readFileSync(join(dir, LIB, "tokens.js"), "utf8")).toBe(OTHER);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);
