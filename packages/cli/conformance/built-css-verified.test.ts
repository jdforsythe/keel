// Spec: k.gamut, clause "`keel build` of that project with `build: { cssMinify: 'lightningcss' }` in `vite.config.ts` exits 1 with one E1819 line and no `dist/<name>/`; with a `css.postcss` plugin writing each `rgb(<r> <g> <b>)` as lowercase 6-digit hex, it prints `E1819 --k-color-a is #00857f in the built CSS, expected rgb(0 133 127)`; with `build: { cssMinify: false }`, or none, it exits 0."
// Spec: k.gamut, clause "In that project, a `styles` stylesheet holding `.x{--k-color-b:#000000}` makes `keel build` print `E1819 --k-color-b is #000000 in the built CSS where Keel declares none`; one holding `.x{color:#123ABC}` and `@supports (display:grid){.g{display:grid}}` builds."
// k.bundle Rules E1819 "E1819 built output holding Keel's CSS other than as compiled, or outside `.css` files (k.gamut CSS)."
// Seed: 1337 (fc.sample below picks the colors of the `declares none` builds); every other input is fixed.
// k.gamut #5 and #6 on a real `keel build` of #4's `static` project (compat-support's `staticTree`, adapter `static`, deployable `site`, module `s`), its `tokens.ts` the clause's own. The `vite.config.ts` and the `styles` stylesheet (a package export that is a .css file, as E1587 requires: `appcss/app.css`, a package the fixture writes under `node_modules/`) vary; the PostCSS plugins are plain objects written in the fixture (no `postcss` import).
// What the spec's CSS paragraph says and these cases assert: each browser build reads its emitted `.css` files after every plugin has run; each `--k-*` declaration is verified (a `--k-color-*` or `--k-overlay-*` one, or one holding a hex color or a color function, against its compiled value; any other `--k-*` one, refused when Keel declares none at that place); the first difference fails the build with E1819, one line, no position, `see` k.gamut, no `dist/<name>/`, a message of one of seven forms within 89 units; a declaration of a property not starting `--k-` is not read.
// ASSUMPTIONS: the E1819 line is a `diag` record whose `message` is the text after the code (as every other file here reads E1818); "no position" is `line` and `col` absent; which declaration is first when a plugin changes many (lightningcss, a plugin hitting `:root` as a whole) is not fixed beyond file and declaration order, so those cases assert the form of the message, not its property; the P3 block is found as an `@media` rule whose conditions hold `color-gamut`.
// The sentence "Fix (`keel explain E1819`): unset the `build.cssMinify` (Lightning CSS rewrites colors and adds `@supports`), `css.transformer` or PostCSS plugin that rewrote it, or the plugin that moved Keel's CSS out of its file." has its carrier in `keel explain E1819`, asserted below to name each cause (a diag record's `fix` is a unified diff hunk, docs/OUTPUT.md, and prose has none).
// UNTESTABLE: Also: "each value cut to an equal share" when both a found and an expected value are long (no plugin can make the expected value long); only the one-value form is cut here.
import { existsSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { type Rec, type Run, type Tree, cleanup, diags, keel, materialize } from "./compat-support.ts";
import { SLOW, staticTree } from "./static-support.ts";

// SEED 1337
const SEED = 1337;
const TOKENS_TS = `import { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens({\n  color: { a: "color(display-p3 0 0.52 0.5)", b: "#000000", c: "oklch(70% 0.48 290)", d: "hsl(19deg 87% 39%)" },\n  overlay: { s: { value: "color(display-p3 0 0.66 0 / 0.95)", over: ["b"] } },\n});\n`;
const TOPOLOGY_STYLES = `import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['s'], adapter: 'static', styles: ['appcss/app.css'] } })\n`;

const vite = (options: string, plugins = ""): string =>
  `import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\n${plugins}\nexport default defineConfig({ plugins: [keel()], ${options} });\n`;
const postcss = (name: string): string => `css: { postcss: { plugins: [${name}] } }`;

/** `rgb(<r> <g> <b>)` as lowercase 6-digit hex, in the declarations whose property `only` names (any when empty). */
const toHex = (only: string): string =>
  `const toHex = { postcssPlugin: "to-hex", Declaration(decl) {
  if (${only === "" ? "false" : `decl.prop !== ${JSON.stringify(only)}`}) return;
  decl.value = decl.value.replace(/rgb\\((\\d+) (\\d+) (\\d+)\\)/g, (_m, r, g, b) => "#" + [r, g, b].map((n) => Number(n).toString(16).padStart(2, "0")).join(""));
} };\n`;
const toHexAll = `const toHex = { postcssPlugin: "to-hex", Declaration(decl) {
  decl.value = decl.value.replace(/rgb\\((\\d+) (\\d+) (\\d+)\\)/g, (_m, r, g, b) => "#" + [r, g, b].map((n) => Number(n).toString(16).padStart(2, "0")).join(""));
} };\n`;
/** Removes the sRGB form of `--k-color-a`. */
const dropA = `const dropA = { postcssPlugin: "drop-a", Declaration(decl) {
  if (decl.prop === "--k-color-a" && decl.value.startsWith("rgb(")) decl.remove();
} };\n`;
/** Puts the rule holding `--k-color-b` under `@supports (display:grid)`. */
const wrapB = `const wrapB = { postcssPlugin: "wrap-b", Once(root, { AtRule }) {
  const hits = [];
  root.walkDecls("--k-color-b", (d) => { hits.push(d); });
  const rule = hits[0]?.parent;
  if (rule === undefined || rule.type !== "rule") return;
  const wrapper = new AtRule({ name: "supports", params: "(display:grid)" });
  rule.replaceWith(wrapper);
  wrapper.append(rule);
} };\n`;
/** A non-Keel rule between the first P3 block and what precedes it. */
const splitP3 = `const splitP3 = { postcssPlugin: "split-p3", Once(root) {
  const hits = [];
  root.walkAtRules("media", (r) => { if (/color-gamut/.test(r.params)) hits.push(r); });
  const p3 = hits[0];
  if (p3 === undefined) return;
  p3.parent.insertBefore(p3, { selector: ".zz", nodes: [{ prop: "color", value: "red" }] });
} };\n`;
/** The first P3 block moved to the start of its parent, before its sRGB block. */
const hoistP3 = `const hoistP3 = { postcssPlugin: "hoist-p3", Once(root) {
  const hits = [];
  root.walkAtRules("media", (r) => { if (/color-gamut/.test(r.params)) hits.push(r); });
  const p3 = hits[0];
  if (p3 === undefined) return;
  p3.parent.prepend(p3);
} };\n`;
/** \`0.5\` as \`.5\` and spaces inside parentheses, in \`--k-color-a\` only (once per declaration). */
const respell = `const respell = { postcssPlugin: "respell", Declaration(decl) {
  if (decl.prop !== "--k-color-a" || decl.value.includes("( ")) return;
  decl.value = decl.value.replace(/0\\.(\\d)/g, ".$1").replace(/\\(/g, "( ").replace(/\\)/g, " )");
} };\n`;
/** Rewrites only the app's own \`color\` declaration. */
const appOnly = `const appOnly = { postcssPlugin: "app-only", Declaration(decl) {
  if (decl.prop === "color") decl.value = decl.value.replace("rgb(1 2 3)", "#010203");
} };\n`;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
type Built = { dir: string; run: Run };
const build = (viteConfig: string, appCss?: string): Built => {
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
const message = (r: Rec | undefined): string => String(r?.message);
const wroteNoDist = (b: Built): boolean => !existsSync(join(b.dir, "dist", "site"));
/** The one E1819 line of a failing build: exit 1, one record, no position, a message within 89 units, no `dist/site/`. */
const expectFails = (b: Built): Rec => {
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
const expectBuilds = (b: Built): void => {
  expect(b.run.status).toBe(0);
  expect(diags(b.run, "E1819")).toEqual([]);
  expect(existsSync(join(b.dir, "dist", "site"))).toBe(true);
};
const FORMS = [
  /^--k-[a-z0-9-]+ is .+ in the built CSS, expected .+$/,
  /^--k-[a-z0-9-]+ is missing from the built CSS, expected .+$/,
  /^--k-[a-z0-9-]+ is .+ under @[a-z-]+ in the built CSS, expected none$/,
  /^--k-[a-z0-9-]+ is .+ in the built CSS where Keel declares none$/,
  /^--k-[a-z0-9-]+ is .+ in \S+; Keel's CSS ships in \.css files$/,
  /^--k-[a-z0-9-]+'s P3 block does not follow its sRGB block in the built CSS$/,
];
const isAForm = (m: string): boolean => FORMS.some((f) => f.test(m));

describe("k.gamut #5: `keel build` of the project verifies its emitted CSS", () => {
  const lightning = build(vite("build: { cssMinify: 'lightningcss' }"));
  it(
    "`keel build` of that project with `build: { cssMinify: 'lightningcss' }` in `vite.config.ts` exits 1 with one E1819 line and no `dist/<name>/`",
    () => {
      const d = expectFails(lightning);
      expect(isAForm(message(d)), message(d)).toBe(true);
    },
    SLOW,
  );

  const hex = build(vite(postcss("toHex"), toHexAll));
  it(
    "with a `css.postcss` plugin writing each `rgb(<r> <g> <b>)` as lowercase 6-digit hex, it prints `E1819 --k-color-a is #00857f in the built CSS, expected rgb(0 133 127)`",
    () => {
      const d = expectFails(hex);
      expect(message(d)).toBe("--k-color-a is #00857f in the built CSS, expected rgb(0 133 127)");
    },
    SLOW,
  );

  const off = build(vite("build: { cssMinify: false }"));
  it(
    "with `build: { cssMinify: false }` it exits 0",
    () => {
      expectBuilds(off);
    },
    SLOW,
  );

  const plain = build(vite(""));
  it(
    "with no `cssMinify` it exits 0",
    () => {
      expectBuilds(plain);
    },
    SLOW,
  );

  for (const [prop, found, expected] of [
    ["--k-color-a", "#00857f", "rgb(0 133 127)"],
    ["--k-color-c", "#a083ff", "rgb(160 131 255)"],
  ] as const) {
    const one = build(vite(postcss("toHex"), toHex(prop)));
    it(
      `a plugin writing only \`${prop}\`'s \`${expected}\` as \`${found}\` fails as \`${prop} is ${found} in the built CSS, expected ${expected}\` (a value found against the value expected)`,
      () => {
        const d = expectFails(one);
        expect(message(d)).toBe(`${prop} is ${found} in the built CSS, expected ${expected}`);
      },
      SLOW,
    );
  }

  const missing = build(vite(postcss("dropA"), dropA));
  it(
    "a plugin removing the declaration of `--k-color-a` fails as `--k-color-a is missing from the built CSS, expected rgb(0 133 127)` (a declaration missing)",
    () => {
      const d = expectFails(missing);
      expect(message(d)).toBe("--k-color-a is missing from the built CSS, expected rgb(0 133 127)");
    },
    SLOW,
  );

  const supports = build(vite(postcss("wrapB"), wrapB));
  it(
    "a plugin putting a rule that declares a Keel color under `@supports` fails as `<property> is <found> under @supports in the built CSS, expected none`",
    () => {
      const d = expectFails(supports);
      expect(message(d)).toMatch(/^--k-[a-z0-9-]+ is .+ under @supports in the built CSS, expected none$/);
    },
    SLOW,
  );

  const split = build(vite(postcss("splitP3"), splitP3));
  it(
    "a plugin putting a rule between a P3 block and its sRGB block fails as `<property>'s P3 block does not follow its sRGB block in the built CSS`",
    () => {
      const d = expectFails(split);
      expect(message(d)).toMatch(/^--k-[a-z0-9-]+'s P3 block does not follow its sRGB block in the built CSS$/);
    },
    SLOW,
  );

  const hoist = build(vite(postcss("hoistP3"), hoistP3));
  it(
    "a plugin moving a P3 block before its sRGB block fails as `<property>'s P3 block does not follow its sRGB block in the built CSS`",
    () => {
      const d = expectFails(hoist);
      expect(message(d)).toMatch(/^--k-[a-z0-9-]+'s P3 block does not follow its sRGB block in the built CSS$/);
    },
    SLOW,
  );

  const respelled = build(vite(postcss("respell"), respell));
  it(
    "numbers are compared as numbers (`.5` is `0.5`) and spaces beside parentheses are ignored: a plugin respelling `--k-color-a` so is no difference and the build exits 0",
    () => {
      expectBuilds(respelled);
    },
    SLOW,
  );
});

describe("k.gamut #6: a `styles` stylesheet", () => {
  const b = build(vite(""), ".x{--k-color-b:#000000}");
  it(
    "a `styles` stylesheet holding `.x{--k-color-b:#000000}` makes `keel build` print `E1819 --k-color-b is #000000 in the built CSS where Keel declares none`",
    () => {
      const d = expectFails(b);
      expect(message(d)).toBe("--k-color-b is #000000 in the built CSS where Keel declares none");
    },
    SLOW,
  );

  const ok = build(vite(""), ".x{color:#123ABC}\n@supports (display:grid){.g{display:grid}}");
  it(
    "one holding `.x{color:#123ABC}` and `@supports (display:grid){.g{display:grid}}` builds",
    () => {
      expectBuilds(ok);
    },
    SLOW,
  );

  const app = build(vite(postcss("appOnly"), appOnly), ".x{color:rgb(1 2 3)}");
  it(
    "the app's own CSS is not judged: a plugin rewriting only an app rule's color builds",
    () => {
      expectBuilds(app);
    },
    SLOW,
  );

  const hexColors = fc.sample(
    fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`),
    { seed: SEED, numRuns: 3 },
  );
  const CLASSES = ["--k-color-zz", "--k-overlay-zz", "--k-zz"] as const;
  CLASSES.forEach((prop, i) => {
    const value = hexColors[i] ?? "#000000";
    const x = build(vite(""), `.x{${prop}:${value}}`);
    it(
      `a \`${prop}\` declaration holding the hex color \`${value}\` that Keel declares nowhere fails as \`${prop} is ${value} in the built CSS where Keel declares none\``,
      () => {
        const d = expectFails(x);
        expect(message(d)).toBe(`${prop} is ${value} in the built CSS where Keel declares none`);
      },
      SLOW,
    );
  });

  for (const prop of ["--k-color-zz", "--k-overlay-zz"] as const) {
    const x = build(vite(""), `.x{${prop}:5px}`);
    it(
      `every declaration of a \`${prop.slice(0, prop.lastIndexOf("-"))}-*\` property is read, whatever its value: \`.x{${prop}:5px}\` fails as \`${prop} is 5px in the built CSS where Keel declares none\``,
      () => {
        const d = expectFails(x);
        expect(message(d)).toBe(`${prop} is 5px in the built CSS where Keel declares none`);
      },
      SLOW,
    );
  }

  const other = build(vite(""), ".x{--k-zz:5px;--k-yy:calc(1px + 2px);margin:0}");
  it(
    "any `--k-*` declaration Keel did not write is refused: `.x{--k-zz:5px;--k-yy:calc(1px + 2px);margin:0}` fails as `E1819 --k-zz is 5px in the built CSS where Keel declares none`; `margin:0` is not read",
    () => {
      const d = expectFails(other);
      expect(message(d)).toBe("--k-zz is 5px in the built CSS where Keel declares none");
    },
    SLOW,
  );

  const notK = build(vite(""), ".x{margin:0;color:#123ABC;--q-zz:5px}");
  it(
    "a declaration of a property not starting `--k-` is not read",
    () => {
      expectBuilds(notK);
    },
    SLOW,
  );

  it(
    "`keel explain E1819` names the causes: `build.cssMinify`, `css.transformer`, a PostCSS plugin, and a plugin that moved Keel's CSS out of its file",
    () => {
      const r = keel(b.dir, ["explain", "E1819"]);
      const text = `${r.stdout ?? ""}${r.stderr ?? ""}`;
      expect(r.status).toBe(0);
      for (const word of ["cssMinify", "css.transformer", "PostCSS"]) expect(text, word).toContain(word);
    },
    SLOW,
  );

  const long = `rgb(1 2 3) ${"rgb(4 5 6) ".repeat(20)}`.trim();
  const cut = build(vite(""), `.x{--k-color-b:${long}}`);
  it(
    "a value too long for the message is cut ending `...` to keep the message within 89 units",
    () => {
      const d = expectFails(cut);
      const m = message(d);
      expect(m.startsWith("--k-color-b is rgb(1 2 3)")).toBe(true);
      expect(m).toContain("...");
      expect(m.endsWith(" in the built CSS where Keel declares none")).toBe(true);
      expect(m.length).toBeLessThanOrEqual(89);
    },
    SLOW,
  );
});
