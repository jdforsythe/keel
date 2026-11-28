// Shared by the built-css-verified*.test.ts files: the fixture, its PostCSS plugins and the build helper.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { type Rec, type Run, type Tree, cleanup, diags, keel, materialize } from "./compat-support.ts";
import { staticTree } from "./static-support.ts";

const dirs: string[] = [];
/** Removes every project `build` made; each test file calls it in `afterAll`. */
export const cleanAll = (): void => {
  for (const d of dirs) cleanup(d);
};
// SEED 1337
export const SEED = 1337;
export const TOKENS_TS = `import { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens({\n  color: { a: "color(display-p3 0 0.52 0.5)", b: "#000000", c: "oklch(70% 0.48 290)", d: "hsl(19deg 87% 39%)" },\n  overlay: { s: { value: "color(display-p3 0 0.66 0 / 0.95)", over: ["b"] } },\n});\n`;
export const TOPOLOGY_STYLES = `import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['s'], adapter: 'static', styles: ['appcss/app.css'] } })\n`;

export const vite = (options: string, plugins = ""): string =>
  `import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\n${plugins}\nexport default defineConfig({ plugins: [keel()], ${options} });\n`;
export const postcss = (name: string): string => `css: { postcss: { plugins: [${name}] } }`;

/** `rgb(<r> <g> <b>)` as lowercase 6-digit hex, in the declarations whose property `only` names (any when empty). */
export const toHex = (only: string): string =>
  `const toHex = { postcssPlugin: "to-hex", Declaration(decl) {
  if (${only === "" ? "false" : `decl.prop !== ${JSON.stringify(only)}`}) return;
  decl.value = decl.value.replace(/rgb\\((\\d+) (\\d+) (\\d+)\\)/g, (_m, r, g, b) => "#" + [r, g, b].map((n) => Number(n).toString(16).padStart(2, "0")).join(""));
} };\n`;
export const toHexAll = `const toHex = { postcssPlugin: "to-hex", Declaration(decl) {
  decl.value = decl.value.replace(/rgb\\((\\d+) (\\d+) (\\d+)\\)/g, (_m, r, g, b) => "#" + [r, g, b].map((n) => Number(n).toString(16).padStart(2, "0")).join(""));
} };\n`;
/** Removes the sRGB form of `--k-color-a`. */
export const dropA = `const dropA = { postcssPlugin: "drop-a", Declaration(decl) {
  if (decl.prop === "--k-color-a" && decl.value.startsWith("rgb(")) decl.remove();
} };\n`;
/** Puts the rule holding `--k-color-b` under `@supports (display:grid)`. */
export const wrapB = `const wrapB = { postcssPlugin: "wrap-b", Once(root, { AtRule }) {
  const hits = [];
  root.walkDecls("--k-color-b", (d) => { hits.push(d); });
  const rule = hits[0]?.parent;
  if (rule === undefined || rule.type !== "rule") return;
  const wrapper = new AtRule({ name: "supports", params: "(display:grid)" });
  rule.replaceWith(wrapper);
  wrapper.append(rule);
} };\n`;
/** A non-Keel rule between the first P3 block and what precedes it. */
export const splitP3 = `const splitP3 = { postcssPlugin: "split-p3", Once(root) {
  const hits = [];
  root.walkAtRules("media", (r) => { if (/color-gamut/.test(r.params)) hits.push(r); });
  const p3 = hits[0];
  if (p3 === undefined) return;
  p3.parent.insertBefore(p3, { selector: ".zz", nodes: [{ prop: "color", value: "red" }] });
} };\n`;
/** The first P3 block moved to the start of its parent, before its sRGB block. */
export const hoistP3 = `const hoistP3 = { postcssPlugin: "hoist-p3", Once(root) {
  const hits = [];
  root.walkAtRules("media", (r) => { if (/color-gamut/.test(r.params)) hits.push(r); });
  const p3 = hits[0];
  if (p3 === undefined) return;
  p3.parent.prepend(p3);
} };\n`;
/** \`0.5\` as \`.5\` and spaces inside parentheses, in \`--k-color-a\` only (once per declaration). */
export const respell = `const respell = { postcssPlugin: "respell", Declaration(decl) {
  if (decl.prop !== "--k-color-a" || decl.value.includes("( ")) return;
  decl.value = decl.value.replace(/0\\.(\\d)/g, ".$1").replace(/\\(/g, "( ").replace(/\\)/g, " )");
} };\n`;
/** Rewrites only the app's own \`color\` declaration. */
export const appOnly = `const appOnly = { postcssPlugin: "app-only", Declaration(decl) {
  if (decl.prop === "color") decl.value = decl.value.replace("rgb(1 2 3)", "#010203");
} };\n`;

export type Built = { dir: string; run: Run };
export const build = (viteConfig: string, appCss?: string): Built => {
  const tree: Tree = {
    ...staticTree("none", appCss === undefined ? undefined : TOPOLOGY_STYLES),
    "tokens.ts": TOKENS_TS,
    "vite.config.ts": viteConfig,
    ...(appCss === undefined
      ? {}
      : {
          "node_modules/appcss/app.css": appCss,
          "node_modules/appcss/package.json": JSON.stringify({
            name: "appcss",
            version: "1.0.0",
            exports: { "./app.css": "./app.css" },
          }),
        }),
  };
  const dir = materialize(tree);
  dirs.push(dir);
  return { dir, run: keel(dir, ["build"]) };
};
export const message = (r: Rec | undefined): string => String(r?.message);
const wroteNoDist = (b: Built): boolean => !existsSync(join(b.dir, "dist", "site"));
/** The one E1819 line of a failing build: exit 1, one record, no position, a message within 89 units, no `dist/site/`. */
export const expectFails = (b: Built): Rec => {
  const d = diags(b.run, "E1819");
  expect(b.run.status).toBe(1);
  expect(d).toHaveLength(1);
  const first = d[0];
  expect(first?.line).toBeUndefined();
  expect(first?.col).toBeUndefined();
  expect(message(first).length).toBeLessThanOrEqual(89);
  expect(wroteNoDist(b)).toBe(true);
  return first ?? { kind: "diag" };
};
export const expectBuilds = (b: Built): void => {
  expect(b.run.status).toBe(0);
  expect(diags(b.run, "E1819")).toEqual([]);
  expect(existsSync(join(b.dir, "dist", "site"))).toBe(true);
};
export const FORMS = [
  /^--k-[a-z0-9-]+ is .+ in the built CSS, expected .+$/,
  /^--k-[a-z0-9-]+ is missing from the built CSS, expected .+$/,
  /^--k-[a-z0-9-]+ is .+ under @[a-z-]+ in the built CSS, expected none$/,
  /^--k-[a-z0-9-]+ is .+ in the built CSS where Keel declares none$/,
  /^--k-[a-z0-9-]+ is .+ in \S+; Keel's CSS ships in \.css files$/,
  /^--k-[a-z0-9-]+'s P3 block does not follow its sRGB block in the built CSS$/,
];
export const isAForm = (m: string): boolean => FORMS.some((f) => f.test(m));
