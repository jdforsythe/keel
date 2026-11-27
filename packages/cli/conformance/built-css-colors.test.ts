// Spec: k.gamut, clause "After `keel build` of a `static` project with color tokens `a` `color(display-p3 0 0.52 0.5)`, `b` `#000000`, `c` `oklch(70% 0.48 290)` and `d` `hsl(19deg 87% 39%)` and `overlay: { s: { value: 'color(display-p3 0 0.66 0 / 0.95)', over: ['b'] } }`, the hex colors and color functions in `dist`'s CSS files, each compared as a color (the same form and equal numbers, letter case and a 3-digit hex's expansion aside), are exactly `rgb(0 133 127)`, `color(display-p3 0 0.52 0.5)`, `#000000`, `rgb(160 131 255)`, `color(display-p3 0.6085 0.5055 1)`, `hsl(19deg 87% 39%)`, `rgb(0 167 4 / 0.95)` and `color(display-p3 0 0.66 0 / 0.95)`, and no CSS file holds `@supports`."
// The `@supports` assertion is stated for the default build target, as k.gamut says (a `build.cssTarget` older than `color()` guards the P3 blocks, built-output-verified.test.ts #11): both projects here set no `build.target` and no `cssTarget`.
// Seed: 1337 (no generated input: two spawned `keel build` runs).
// k.gamut #4, on a real `keel build` of a `static` project (compat-support's `staticTree`, adapter `static`, module `s`; its `tokens.ts` is written here). The first project is the clause's own; the second holds tokens inside sRGB, inside P3 and beyond P3, in two themes (`slate`, a `choice` theme, and `hc`, the `contrast` theme), a print theme `paper`, both schemes and an overlay, and the same law is asserted of it: every color value of `dist`'s CSS is one the forms of k.gamut give, nothing else ships.
// A color value is read from each declaration's value (a hex or a function form among `rgb`, `hsl`, `oklab`, `oklch`, `color`) and compared as a color: the same form (`rgb(...)` is not `#rrggbb`), the same numbers (`0.5` is `.5`; a unit such as `deg` or `%` is not part of the number), letter case and a 3-digit hex's expansion aside. A build that minified `rgb(0 133 127)` to `#00857f` would be a different form and fail.
// The forms expected for the second project were recomputed from k.gamut's definitions (CSS Color 4's OKLCH chroma search): `oklch(60% 0.3 150)` is `rgb(0 158 54)` and `color(display-p3 0 0.6376 0.1386)`; `color(display-p3 1 0 0)` is `rgb(255 11 12)` and itself; `color(display-p3 0 0.54 0.24)` is `rgb(0 137 60)` and itself; `color(display-p3 0.9 0.2 0.1)` is `rgb(250 5 0)` and itself; with the clause's own `rgb(0 133 127)`, `rgb(160 131 255)`, `color(display-p3 0.6085 0.5055 1)` and `rgb(0 167 4 / 0.95)`. The print theme `paper` holds `color(display-p3 0 0.54 0.24)`, whose P3 form ships nowhere (printing has sRGB forms only).
// ASSUMPTIONS: the CSS files are every `*.css` under `dist/`; the project builds with no diagnostic (an overlay and tokens with no use judge nothing). A P3 block is a rule `@media <the original conditions with screen once> and (color-gamut: p3)` that is the next sibling of the original block's outermost at-rule within its layer (or the top level), holding a style rule of the same selector; `screen` is read as appearing once in its prelude.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Run, type Tree, cleanup, keel, materialize } from "./compat-support.ts";
import { SLOW, staticTree } from "./static-support.ts";

type Rule = { prelude: string; decls: string[]; rules: Rule[] };
const squash = (css: string): string =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([:{};,()])\s*/g, "$1");
const parse = (css: string): Rule => {
  const src = squash(css);
  let i = 0;
  const body = (prelude: string): Rule => {
    const node: Rule = { prelude, decls: [], rules: [] };
    let buf = "";
    let depth = 0;
    while (i < src.length) {
      const ch = src.charAt(i++);
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (depth === 0 && ch === "{") {
        node.rules.push(body(buf.trim()));
        buf = "";
      } else if (depth === 0 && ch === "}") {
        if (buf.trim() !== "") node.decls.push(buf.trim());
        return node;
      } else if (depth === 0 && ch === ";") {
        if (buf.trim() !== "") node.decls.push(buf.trim());
        buf = "";
      } else buf += ch;
    }
    if (buf.trim() !== "") node.decls.push(buf.trim());
    return node;
  };
  return body("");
};
const cssFilesUnder = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...cssFilesUnder(p));
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
};

/** A color as a comparable string: the form and its numbers. */
const canon = (raw: string): string => {
  if (raw.startsWith("#")) {
    const h = raw.slice(1).toLowerCase();
    const full = h.length === 3 || h.length === 4 ? [...h].map((c) => c + c).join("") : h;
    return `#${full}`;
  }
  const m = /^([a-z]+)\((.*)\)$/i.exec(raw);
  const name = (m?.[1] ?? "").toLowerCase();
  const parts = (m?.[2] ?? "").split(/[\s,/]+/).filter((p) => p !== "");
  const norm = parts.map((p) => (/^-?[\d.]+(deg|%)?$/.test(p) ? String(Number.parseFloat(p)) : p.toLowerCase()));
  const slash = (m?.[2] ?? "").includes("/") ? "/" : "";
  return `${name}(${norm.join(" ")}${slash})`;
};
const COLOR = /#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])|\b(?:rgba?|hsla?|oklab|oklch|color)\([^()]*\)/g;
const colorsIn = (value: string): string[] => (value.match(COLOR) ?? []).map(canon);
type Decl = { prop: string; value: string; chain: string[]; selector: string };
const walk = (node: Rule, chain: string[], out: Decl[]): void => {
  for (const d of node.decls) {
    const at = d.indexOf(":");
    if (at > 0 && chain.length > 0)
      out.push({ prop: d.slice(0, at), value: d.slice(at + 1), chain, selector: chain[chain.length - 1] ?? "" });
  }
  for (const r of node.rules) walk(r, [...chain, r.prelude], out);
};
const declsOfCss = (css: string): Decl[] => {
  const out: Decl[] = [];
  walk(parse(css), [], out);
  return out;
};

const dirs: string[] = [];
const build = (tokensTs: string): { dir: string; run: Run; css: string; files: string[] } => {
  const tree: Tree = { ...staticTree("none"), "tokens.ts": tokensTs };
  const dir = materialize(tree);
  dirs.push(dir);
  const run = keel(dir, ["build"]);
  const files = existsSync(join(dir, "dist")) ? cssFilesUnder(join(dir, "dist")) : [];
  return { dir, run, files, css: files.map((f) => readFileSync(f, "utf8")).join("\n") };
};
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const set = (xs: string[]): string[] => [...new Set(xs)].sort();

describe("k.gamut #4: the built CSS holds only the forms Keel computed and judged", () => {
  const CLAUSE = `import { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens({\n  color: { a: "color(display-p3 0 0.52 0.5)", b: "#000000", c: "oklch(70% 0.48 290)", d: "hsl(19deg 87% 39%)" },\n  overlay: { s: { value: "color(display-p3 0 0.66 0 / 0.95)", over: ["b"] } },\n});\n`;
  let one: ReturnType<typeof build>;
  beforeAll(() => {
    one = build(CLAUSE);
  }, SLOW);

  it(
    "the project builds and writes CSS files to `dist/`",
    () => {
      expect(one.run.status).toBe(0);
      expect(one.files.length).toBeGreaterThan(0);
      expect(one.css).toContain("--k-color-a");
    },
    SLOW,
  );

  it(
    "the hex colors and color functions in `dist`'s CSS files, each compared as a color, are exactly `rgb(0 133 127)`, `color(display-p3 0 0.52 0.5)`, `#000000`, `rgb(160 131 255)`, `color(display-p3 0.6085 0.5055 1)`, `hsl(19deg 87% 39%)`, `rgb(0 167 4 / 0.95)` and `color(display-p3 0 0.66 0 / 0.95)`",
    () => {
      const found = set(declsOfCss(one.css).flatMap((d) => colorsIn(d.value)));
      const want = set(
        [
          "rgb(0 133 127)",
          "color(display-p3 0 0.52 0.5)",
          "#000000",
          "rgb(160 131 255)",
          "color(display-p3 0.6085 0.5055 1)",
          "hsl(19deg 87% 39%)",
          "rgb(0 167 4 / 0.95)",
          "color(display-p3 0 0.66 0 / 0.95)",
        ].map(canon),
      );
      expect(found).toEqual(want);
    },
    SLOW,
  );

  it(
    "and, at the default build target, no CSS file holds `@supports`",
    () => {
      expect(one.files.length).toBeGreaterThan(0);
      for (const f of one.files) expect(readFileSync(f, "utf8"), f).not.toContain("@supports");
    },
    SLOW,
  );

  it(
    "a color compared as a color: a dropped leading zero, a letter case and a 3-digit hex are equal, a different form is not",
    () => {
      expect(canon("color(display-p3 0 .52 .5)")).toBe(canon("color(display-p3 0 0.52 0.5)"));
      expect(canon("#ABC")).toBe(canon("#aabbcc"));
      expect(canon("rgb(0 133 127)")).not.toBe(canon("#00857f"));
      expect(canon("rgb(0 167 4/.95)")).toBe(canon("rgb(0 167 4 / 0.95)"));
    },
    SLOW,
  );
});

describe("k.gamut #4: tokens inside sRGB, inside P3 and beyond P3, in two themes and a print theme, with an overlay", () => {
  const TOKENS = `import { defineTokens } from "@keel/ui/tokens";
export const tokens = defineTokens({
  color: {
    plain: "#112233",
    warm: "oklch(54% 0.16 40)",
    teal: "color(display-p3 0 0.52 0.5)",
    violet: "oklch(70% 0.48 290)",
    pair: { light: "#ffffff", dark: "color(display-p3 0.9 0.2 0.1)" },
  },
  overlay: { scrim: { value: "color(display-p3 0 0.66 0 / 0.95)", over: ["plain"] } },
  schemes: ["light", "dark"],
  themes: {
    slate: { color: { teal: "oklch(60% 0.3 150)" } },
    hc: { when: "contrast", color: { violet: "color(display-p3 1 0 0)" } },
    paper: { when: "print", color: { teal: "color(display-p3 0 0.54 0.24)" } },
  },
});
`;
  const SRGB_OUTSIDE = [
    "rgb(0 133 127)",
    "rgb(160 131 255)",
    "rgb(0 158 54)",
    "rgb(255 11 12)",
    "rgb(250 5 0)",
    "rgb(0 167 4 / 0.95)",
  ];
  const ALLOWED = [
    "#112233",
    "oklch(54% 0.16 40)",
    "#ffffff",
    "rgb(0 133 127)",
    "color(display-p3 0 0.52 0.5)",
    "rgb(160 131 255)",
    "color(display-p3 0.6085 0.5055 1)",
    "rgb(250 5 0)",
    "color(display-p3 0.9 0.2 0.1)",
    "rgb(0 167 4 / 0.95)",
    "color(display-p3 0 0.66 0 / 0.95)",
    "rgb(0 158 54)",
    "color(display-p3 0 0.6376 0.1386)",
    "rgb(255 11 12)",
    "color(display-p3 1 0 0)",
    "rgb(0 137 60)",
  ].map(canon);
  let b: ReturnType<typeof build>;
  let decls: Decl[];
  beforeAll(() => {
    b = build(TOKENS);
    decls = declsOfCss(b.css);
  }, SLOW);
  const inP3 = (d: Decl): boolean => d.chain.some((c) => c.includes("(color-gamut:p3)"));
  const inPrint = (d: Decl): boolean => d.chain.includes("@layer keel.print");
  const isP3Form = (v: string): boolean => canon(v).startsWith("color(display-p3");

  it(
    "the project builds and writes CSS files",
    () => {
      expect(b.run.status).toBe(0);
      expect(b.files.length).toBeGreaterThan(0);
    },
    SLOW,
  );

  it(
    "every color value of `dist`'s CSS is one of the forms k.gamut gives, compared as numbers, and every form of the tokens ships but a print-only color's P3 form",
    () => {
      const found = set(decls.flatMap((d) => colorsIn(d.value)));
      for (const c of found) expect(ALLOWED, c).toContain(c);
      expect(found).toEqual(set(ALLOWED));
      expect(found).not.toContain(canon("color(display-p3 0 0.54 0.24)"));
    },
    SLOW,
  );

  it(
    "at the default build target, no CSS file holds `@supports`",
    () => {
      expect(b.files.length).toBeGreaterThan(0);
      for (const f of b.files) expect(readFileSync(f, "utf8"), f).not.toContain("@supports");
    },
    SLOW,
  );

  it(
    "a declaration writes a P3 form only under a block of `screen and (color-gamut: p3)`, and a declaration under it writes P3 forms only",
    () => {
      for (const d of decls) {
        const colors = d.prop.startsWith("--k-") ? colorsIn(d.value) : [];
        // an inside-sRGB color is never written as a P3 form in these tokens, so a P3 form is always a P3 block's
        if (colors.some((c) => c.startsWith("color(display-p3"))) expect(inP3(d), `${d.prop}:${d.value}`).toBe(true);
        if (inP3(d) && d.prop.startsWith("--k-"))
          for (const c of colors) expect(c.startsWith("color(display-p3"), `${d.prop}:${d.value}`).toBe(true);
      }
    },
    SLOW,
  );

  it(
    "each P3 block follows its sRGB block with the same selector, under the same conditions with `screen` once and `(color-gamut: p3)`",
    () => {
      const sRGB = new Set(SRGB_OUTSIDE.map(canon));
      let checked = 0;
      const visit = (container: Rule[], layerPrint: boolean): void => {
        container.forEach((unit, k) => {
          if (unit.prelude.startsWith("@layer ") && unit.rules.length > 0) {
            visit(unit.rules, unit.prelude === "@layer keel.print");
            return;
          }
          const styleRules: { rule: Rule; conds: string[] }[] = [];
          const collect = (r: Rule, conds: string[]): void => {
            if (r.prelude.startsWith("@")) for (const c of r.rules) collect(c, [...conds, r.prelude]);
            else styleRules.push({ rule: r, conds });
          };
          collect(unit, []);
          for (const { rule, conds } of styleRules) {
            const outside = rule.decls.filter(
              (d) => d.startsWith("--k-") && colorsIn(d.slice(d.indexOf(":") + 1)).some((c) => sRGB.has(c)),
            );
            if (outside.length === 0 || conds.some((c) => c.includes("(color-gamut:p3)")) || layerPrint) continue;
            checked++;
            const next = container[k + 1];
            expect(next?.prelude.startsWith("@media"), `after ${rule.prelude}`).toBe(true);
            const prelude = next?.prelude ?? "";
            expect(prelude.split("screen").length - 1, prelude).toBe(1);
            expect(prelude).toContain("(color-gamut:p3)");
            for (const cond of conds) {
              for (const word of cond
                .replace("@media", "")
                .split(/\band\b/)
                .map((w) => w.trim())
                .filter((w) => w !== "" && w !== "screen"))
                expect(prelude, `${cond} -> ${prelude}`).toContain(word);
            }
            const again: Rule[] = [];
            const gather = (r: Rule): void => {
              if (r.prelude.startsWith("@")) for (const c of r.rules) gather(c);
              else again.push(r);
            };
            for (const r of next?.rules ?? []) gather(r);
            const twin = again.find((r) => r.prelude === rule.prelude);
            expect(twin, `a ${rule.prelude} block in ${prelude}`).toBeDefined();
            for (const d of outside) {
              const prop = d.slice(0, d.indexOf(":"));
              const p3 = twin?.decls.find((x) => x.startsWith(`${prop}:`));
              expect(p3, `${prop} in the P3 block`).toBeDefined();
              expect(isP3Form((p3 ?? "").slice(prop.length + 1))).toBe(true);
            }
          }
        });
      };
      visit(parse(b.css).rules, false);
      expect(checked).toBeGreaterThan(3);
    },
    SLOW,
  );

  it(
    "the `print` layer holds no block under `(color-gamut: p3)` and no P3 form, and declares `paper`'s `teal` as `rgb(0 137 60)`",
    () => {
      const print = decls.filter(inPrint);
      expect(print.length).toBeGreaterThan(0);
      expect(print.some(inP3)).toBe(false);
      for (const d of print)
        for (const c of colorsIn(d.value)) expect(c.startsWith("color(display-p3"), `${d.prop}:${d.value}`).toBe(false);
      expect(print.filter((d) => d.prop === "--k-color-teal").map((d) => canon(d.value))).toEqual([
        canon("rgb(0 137 60)"),
      ]);
    },
    SLOW,
  );
});
