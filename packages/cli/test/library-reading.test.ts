// k.library Guarantees: a component a library ships is judged by `keel check` and by `keel test`'s render checks exactly
// as the same component in the app's own module: a contrast pair that fails, an unnamed control, a host element with no
// text alternative. Each case runs in two temporary projects, the component in `@acme/charts` and in `modules/shop/`.
import { readFileSync, readdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  LIB,
  NAME,
  SLOW,
  type Tree,
  cleanup,
  keel,
  library,
  materialize,
  project,
} from "../conformance/library-support.ts";

const PNPM = fileURLToPath(new URL("../../../node_modules/.pnpm/", import.meta.url));

const UI = "import { Box, Button, Host, Text } from '@keel/ui'\nimport { s } from '@keel/schema'\n";
const CASES: ReadonlyArray<readonly [string, string]> = [
  [
    "a text and background token pair that fails contrast",
    '<Box id={`${props.id}.box`} fg="divider" bg="card"><Text id={`${props.id}.t`}>Low</Text></Box>',
  ],
  ["an unnamed control", "<Box id={`${props.id}.box`}><Button id={`${props.id}.go`} /></Box>"],
  [
    "a host element with no text alternative",
    "<Host id={`${props.id}.chart`} role=\"img\" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} />",
  ],
];

const badge = (body: string): string =>
  `${UI}const In = s.object({ n: s.number() })\nexport default function Badge(props: { id: string }) {\n  return ${body}\n}\n`;
const CHART =
  "import { hostCode } from '@keel/ui'\nexport const chart = hostCode<{ n: number }>({ mount: () => undefined })\n";

/** The test `keel test` runs: render the app's `Wrap` with the app's tokens, write the render check's failure, if any. */
const WRAP_TEST = `import { writeFileSync } from "node:fs";
import { render } from "@keel/testing";
import { test } from "vitest";
import Wrap from "../modules/shop/Wrap.tsx";
import { tokens } from "../tokens.ts";

test("wrap", () => {
  let out = "none";
  try {
    render(Wrap, { props: {}, artifacts: { tokens } }).dispose();
  } catch (e) {
    out = e instanceof Error ? e.message : String(e);
  }
  writeFileSync("render.txt", out);
});
`;

const wrap = (importLine: string): string =>
  `import { s } from '@keel/schema'\n${importLine}\nexport const Props = s.object({})\nexport default function Wrap() {\n  return <Badge id="shop.wrap" />\n}\n`;

/** The project with the component at `where`: the library's `src/Badge.tsx`, or the app's `modules/shop/Badge.tsx`. */
function tree(body: string, where: "library" | "app"): Tree {
  const base = {
    "tokens.ts": "import { brandTokens } from '@keel/ui/brand'\nexport const tokens = brandTokens\n",
    "vitest.config.ts":
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vitest/config";\nexport default defineConfig({ plugins: [keel()], test: { include: ["test/**/*.test.ts"], environment: "happy-dom" } });\n',
    "test/wrap.test.ts": WRAP_TEST,
  };
  if (where === "library")
    return {
      ...project({
        page: false,
        libraries: [library({ files: { "src/Badge.tsx": badge(body), "src/chart.ts": CHART } })],
      }),
      ...base,
      "modules/shop/Wrap.tsx": wrap(`import { Badge } from '${NAME}'`),
    };
  return {
    ...project({ page: false, deps: [], libraries: [] }),
    ...base,
    "modules/shop/Badge.tsx": badge(body),
    "modules/shop/chart.ts": CHART,
    "modules/shop/Wrap.tsx": wrap("import Badge from './Badge.tsx'"),
  };
}

/** `keel check`'s findings in the component's file (code, line, col) and the render check's failure under `keel test`. */
function judged(body: string, where: "library" | "app"): { check: string[]; render: string } {
  const dir = materialize(tree(body, where));
  try {
    const happy = readdirSync(PNPM).find((n) => n.startsWith("happy-dom@"));
    if (happy !== undefined)
      symlinkSync(join(PNPM, happy, "node_modules", "happy-dom"), join(dir, "node_modules", "happy-dom"));
    const file = where === "library" ? `${LIB}/src/Badge.tsx` : "modules/shop/Badge.tsx";
    const check = keel(dir, ["check"])
      .records.filter((r) => r.kind === "diag" && r.path === file)
      .map((r) => `${String(r.code)}:${String(r.line)}:${String(r.col)}`)
      .sort();
    keel(dir, ["test"]);
    return { check, render: readFileSync(join(dir, "render.txt"), "utf8") };
  } finally {
    cleanup(dir);
  }
}

for (const [what, body] of CASES)
  test(
    `${what} in a library component is reported by keel check and keel test as in the app's own module`,
    () => {
      const app = judged(body, "app");
      const lib = judged(body, "library");
      expect(app.check.length + (app.render === "none" ? 0 : 1)).toBeGreaterThan(0);
      expect(lib).toEqual(app);
    },
    SLOW,
  );

test(
  "the .keel/ artifacts hold a library's files, and keel check after keel build finds them fresh (no E1005)",
  () => {
    const dir = materialize({
      ...project({ adapter: "static", home: true }),
      "tokens.ts": "import { brandTokens } from '@keel/ui/brand'\nexport const tokens = brandTokens\n",
    });
    try {
      expect(keel(dir, ["build"]).status).toBe(0);
      const styles = readFileSync(join(dir, ".keel/styles.json"), "utf8");
      expect(styles).toContain('"p":"2"');
      const after = keel(dir, ["check"]);
      expect(after.records.filter((r) => r.kind === "diag")).toEqual([]);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);
