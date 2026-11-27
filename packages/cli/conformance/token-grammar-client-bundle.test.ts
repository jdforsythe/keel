// Spec: k.values, clause "`keel build`'s client JavaScript for a project with `brandTokens`, one scheme and no library holds none of the strings `safe-area-inset`, `cqmin`, `revert-layer` and `[aria-pressed=\"true\"]`."
// Spec text (k.values): "**Stylesheet.** Each value a form admits gives a declaration the browser keeps and computes to a value other than the property's initial one, unless it is written as that value (`0`, `normal`). No part of the value forms ships in a client bundle: they run under Node, in `@keel/ui/tokens` and `@keel/ui/css` (k.themes Check-time entries)."
// Spec: k.ui, clause "`keel build`'s client JavaScript for a `static` and a `client` project whose `tokens.ts` calls `defineTokens` and whose page imports `Box` and `brandTokens` holds none of the string literal values of 6 or more units, at least 20, that `vite build` of that project (no `keel check`, so no E1818) puts in its client JavaScript with a page importing `Box` and rendering `Object.keys(defineTokens({})).length` and not with a page importing `Box` alone."
// Seed: 1337 (no generated input: spawned builds per adapter).
// The real binary builds staticTree's project (static-support.ts) once for a `static` and once for a `client` deployable. The k.values case uses `brandTokens` (one scheme) as `tokens.ts` and no library; every `.js` file under an `assets/` folder of `dist/` is the client JavaScript.
// The k.ui case: the control is `vite build` (no `keel check`) of the same project with the control page (`Box` and `defineTokens`, rendering `Object.keys(defineTokens({})).length`) and again with the `Box`-only page; the strings are the string literal values of 6 or more units (JSON-decoded literals of the minified JavaScript, double or single quoted) in the first and not in the second, and there are at least 20. `keel build` of the project whose `tokens.ts` calls `defineTokens` over `brandTokens` and whose page imports `Box` and `brandTokens` holds none of them. No name, number or identifier is written in the test.
// The cases are not vacuous: every build exits 0 and every client JavaScript is not empty.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Run, type Tree, cleanup, keel, materialize } from "./compat-support.ts";
import { SLOW, staticTree } from "./static-support.ts";
import { root } from "./test-sim-project.ts";

const TOKENS = `import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`;
const DEFINED = `import { brandTokens } from "@keel/ui/brand";\nimport { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens({ ...brandTokens });\n`;
const ADAPTERS = ["static", "client"] as const;
const PAGE_UNDER_TEST = `import { Box } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
export default function Page() {
  return <Box id="s.page">{Object.keys(brandTokens.color).length}</Box>;
}
`;
const PAGE_CONTROL = `import { Box } from "@keel/ui";
import { defineTokens } from "@keel/ui/tokens";
export default function Page() {
  return <Box id="s.page">{Object.keys(defineTokens({})).length}</Box>;
}
`;
const PAGE_BOX_ONLY = `import { Box } from "@keel/ui";
export default function Page() {
  return <Box id="s.page">x</Box>;
}
`;
const tree = (adapter: string, tokens = TOKENS, page?: string): Tree => ({
  ...staticTree("none", undefined, adapter),
  "tokens.ts": tokens,
  ...(page === undefined ? {} : { "modules/s/Page.tsx": page }),
});
const STRINGS = ["safe-area-inset", "cqmin", "revert-layer", '[aria-pressed="true"]'];

const dirs = new Map<string, string>();
const runs = new Map<string, Run>();
const vite = new Map<string, number | null>();
const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");
/** `vite build` of the project in `dir`, no `keel check`; the exit status. */
const viteBuild = (dir: string): number | null => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_") || k === "NODE_OPTIONS" || k === "TEST")
      continue;
    env[k] = v;
  }
  return spawnSync(process.execPath, [viteBin, "build"], { cwd: dir, env, encoding: "utf8" }).status;
};
beforeAll(() => {
  for (const a of ADAPTERS) {
    const dir = materialize(tree(a));
    dirs.set(a, dir);
    runs.set(a, keel(dir, ["build"]));
    const defined = materialize(tree(a, DEFINED, PAGE_UNDER_TEST));
    dirs.set(`${a}:defined`, defined);
    runs.set(`${a}:defined`, keel(defined, ["build"]));
  }
  const control = materialize(tree("client", DEFINED, PAGE_CONTROL));
  dirs.set("client:control", control);
  vite.set("client:control", viteBuild(control));
  const boxOnly = materialize(tree("client", DEFINED, PAGE_BOX_ONLY));
  dirs.set("client:box", boxOnly);
  vite.set("client:box", viteBuild(boxOnly));
}, SLOW * 6);
afterAll(() => {
  for (const d of dirs.values()) cleanup(d);
});

/** Every `.js` file under an `assets` folder anywhere in `dist/` of `dir`, joined. */
const clientJs = (dir: string): string => {
  const out: string[] = [];
  const walk = (at: string, inAssets: boolean): void => {
    if (!existsSync(at)) return;
    for (const n of readdirSync(at)) {
      const full = join(at, n);
      if (statSync(full).isDirectory()) walk(full, inAssets || n === "assets");
      else if (inAssets && n.endsWith(".js")) out.push(readFileSync(full, "utf8"));
    }
  };
  walk(join(dir, "dist"), false);
  return out.join("\n");
};
/** The values of the string literals of 6 or more units in `js`: string literals and the text of each template literal chunk, as the TypeScript parser reads them. */
const literals = (js: string): Set<string> => {
  const found = new Set<string>();
  const walk = (n: ts.Node): void => {
    const isText =
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n);
    if (isText && n.text.length >= 6) found.add(n.text);
    ts.forEachChild(n, walk);
  };
  walk(ts.createSourceFile("client.js", js, ts.ScriptTarget.ESNext, true));
  return found;
};
/** The literals of the control build and not of the `Box`-only build: the control's is `vite build` of the `client` project (a `static` project has no `index.html` for `vite build` alone). */
const controlOnly = (): string[] => {
  const control = literals(clientJs(dirs.get("client:control") ?? ""));
  const boxOnly = literals(clientJs(dirs.get("client:box") ?? ""));
  return [...control].filter((v) => !boxOnly.has(v));
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

test(
  "the string literal values of 6 or more units that `vite build` puts in the client JavaScript of a project with a page importing `Box` and rendering `Object.keys(defineTokens({})).length` and not with a page importing `Box` alone are at least 20",
  () => {
    expect(vite.get("client:control")).toBe(0);
    expect(vite.get("client:box")).toBe(0);
    expect(controlOnly().length).toBeGreaterThanOrEqual(20);
  },
  SLOW,
);

for (const adapter of ADAPTERS) {
  test(
    `\`keel build\`'s client JavaScript for a \`${adapter}\` project whose \`tokens.ts\` calls \`defineTokens\` and whose page imports \`Box\` and \`brandTokens\` holds none of those string literal values`,
    () => {
      const only = controlOnly();
      expect(only.length).toBeGreaterThanOrEqual(20);
      expect(runs.get(`${adapter}:defined`)?.status).toBe(0);
      const js = clientJs(dirs.get(`${adapter}:defined`) ?? "");
      expect(js.length).toBeGreaterThan(0);
      const present = literals(js);
      expect(only.filter((v) => present.has(v))).toEqual([]);
    },
    SLOW,
  );
}
