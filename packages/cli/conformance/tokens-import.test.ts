// Spec: k.cli, clause "With `design/color.light.tokens.json` `{\"color\":{\"$type\":\"color\",\"text\":{\"$value\":\"#1a191e\"},\"surface\":{\"$value\":\"#F9F9F9\"}},\"space\":{\"$type\":\"dimension\",\"2\":{\"$value\":{\"value\":8,\"unit\":\"px\"}}}}` and `design/color.dark.tokens.json` the same with `text` `#F3F3F3`, `keel tokens import design/color.light.tokens.json design/color.dark.tokens.json` writes `tokens.design.ts` whose `designTokens` deep-equals `{ color: { text: { light: '#1a191e', dark: '#F3F3F3' }, surface: '#F9F9F9' }, space: { 2: '8px' } }` and prints `ok tokens import 3 tokens, 0 looks, 0 themes`."
// Spec: k.cli, clause "Adding `design/brand.base.tokens.json` `{\"color\":{\"$type\":\"color\",\"accent\":{\"$value\":\"#b8420d\"}}}`, `design/brand.slate.tokens.json` with `accent` `#0B5CAD` and `design/brand.highContrast.tokens.json` with `accent` `#8B300A`, in that order, gives `color.accent` `'#b8420d'` and `themes` `{ slate: { color: { accent: '#0B5CAD' } }, highContrast: { when: 'contrast', color: { accent: '#8B300A' } } }`."
// Spec: k.cli, clause "A token `hero` of `$type` `gradient` is one W1072 at its `$value` with message `hero: gradient has no Keel group; skipped`; a `typography` token `type.heading` `{\"fontFamily\":\"Inter\",\"fontSize\":\"28px\",\"fontWeight\":600,\"lineHeight\":1.2}` gives `font.heading` `'Inter'`, `fontSize.heading` `'28px'`, `weight.heading` `'600'`, `look.heading` `{ font: 'heading', fontSize: 'heading', weight: 'heading' }` and one W1072 `type.heading lineHeight: dropped` at its `\"lineHeight\"` key; a file `{\"a\":1}` is one E1071 and writes no file."
// Spec: k.cli, clause "With `tokens.ts` `export const tokens = brandTokens;` and its import, the first case's import makes `tokens` `defineTokens({ ...brandTokens, color: { ...brandTokens.color, ...designTokens.color }, space: { ...brandTokens.space, ...designTokens.space } })` with `defineTokens` and `designTokens` imported, `keel check` then reports none of E1807 and E1801, and a second import leaves `tokens.ts` byte for byte as it was."
// Seed: 1337 (fixed projects; one property over the file order of a collection's modes). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// The design tokens files are written by the test into a temp project (`keelProject`, a11y-project-support.ts) and `keel tokens import` runs in process through `run` from `@keel/cli` with the real project directory as `cwd` (no `files`), the entry fixtures.ts documents; `keel check` runs through the real binary (`keel`, test-sim-project.ts). The generated `tokens.design.ts` is evaluated by importing it (its `designTokens` export) for the deep-equal clauses, and read as text, formatted with the repo's formatter (`biome format` under the repo's configuration, as packages/check/conformance/library-looks-support.ts `formatted` does), for the RFC's example.
// ASSUMPTIONS: a W1072 or E1071 record is `{ kind: "diag", code, path, line, col, message }` in json, and in compact a line `<code> <path>:<line>:<col> <message>` (docs/OUTPUT.md); "at its `$value`" is the 1-based line and column of the opening quote of the `"$value"` key of the token in the file that holds it and, for a dropped field, of that field's key (`"lineHeight"`); the printed order of the W1072 lines is not stated, so they are compared as a set; `ok tokens import <n> tokens, <m> looks, <k> themes` is the line `keel tokens import` prints in compact, last. The generated file is the RFC's example text after formatting (key order as the RFC writes it: palette colors in file order, then the mode pairs). "Hand edits go after the spreads" is asserted by a key added after `...designTokens.color` in the second case of #24.
// AMBIGUOUS (k.cli Tokens): "other spaces as `oklch()` at 4 decimals (W1072)" has the message `<token>: <space> as oklch` in Rules; the case for it asserts the code, the token and that the written value is an `oklch()` form with at most 4 decimals, not the converted numbers. The spec does not say the `ok` line's counts for a token that became a look's three tokens: the RFC's `14 tokens, 1 looks` is asserted for its example (11 colors, spaces and 3 typography tokens).
// Needs a real browser: nothing here.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "@keel/cli";
import fc from "fast-check";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { TOPOLOGY, keelProject } from "./a11y-project-support.ts";
import { keel, removeProject, root } from "./test-sim-project.ts";

const SLOW = fixedTime(180_000);
const SEED = 1337;
const created: string[] = [];
afterAll(() => {
  for (const d of created) removeProject(d);
});
const MODULE = `import { module } from "@keel/compiler";\nexport default module({ id: "m", deps: [], capabilities: [], public: { exports: [] } });\n`;
const BRAND_TOKENS = `import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`;
const project = (files: Record<string, string>): string => {
  const dir = keelProject("tokens-import", { "topology.ts": TOPOLOGY, "modules/m/module.ts": MODULE, ...files });
  created.push(dir);
  return dir;
};
const formatted = (source: string): string =>
  execFileSync("pnpm", ["exec", "biome", "format", "--stdin-file-path=tokens.design.ts"], {
    cwd: root,
    input: source,
    encoding: "utf8",
  });
const norm = (s: string): string =>
  s
    .replace(/\s+/g, " ")
    .replace(/,\s*([}\])])/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
const importCmd = (dir: string, files: string[], format: "compact" | "json" = "compact") =>
  run(["tokens", "import", ...files, `--format=${format}`], { cwd: dir, env: {}, tty: false });
const read = (dir: string, path: string): string => readFileSync(join(dir, path), "utf8");
let loads = 0;
const designTokens = async (dir: string): Promise<Record<string, unknown>> => {
  const mod: unknown = await import(`${pathToFileURL(join(dir, "tokens.design.ts")).href}?load=${loads++}`);
  const value = typeof mod === "object" && mod !== null ? Reflect.get(mod, "designTokens") : undefined;
  return typeof value === "object" && value !== null ? { ...value } : {};
};
const records = (stdout: string): Record<string, unknown>[] =>
  stdout
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l): Record<string, unknown> => {
      const v: unknown = JSON.parse(l);
      return typeof v === "object" && v !== null ? { ...v } : {};
    });
const where = (source: string, needle: string, from = 0): { line: number; col: number } => {
  const i = source.indexOf(needle, from);
  if (i < 0) throw new Error(`fixture: no ${needle}`);
  const before = source.slice(0, i);
  return { line: before.split("\n").length, col: i - before.lastIndexOf("\n") };
};

const LIGHT = `{"color":{"$type":"color","text":{"$value":"#1a191e"},"surface":{"$value":"#F9F9F9"}},"space":{"$type":"dimension","2":{"$value":{"value":8,"unit":"px"}}}}`;
const DARK = `{"color":{"$type":"color","text":{"$value":"#F3F3F3"},"surface":{"$value":"#F9F9F9"}},"space":{"$type":"dimension","2":{"$value":{"value":8,"unit":"px"}}}}`;
const FILES = ["design/color.light.tokens.json", "design/color.dark.tokens.json"];
const FIRST = { "design/color.light.tokens.json": LIGHT, "design/color.dark.tokens.json": DARK };

describe("k.cli: tokens import", () => {
  test(
    "With `design/color.light.tokens.json` and `design/color.dark.tokens.json`, `keel tokens import` writes `tokens.design.ts` whose `designTokens` deep-equals `{ color: { text: { light: '#1a191e', dark: '#F3F3F3' }, surface: '#F9F9F9' }, space: { 2: '8px' } }` and prints `ok tokens import 3 tokens, 0 looks, 0 themes`",
    async () => {
      const dir = project({ "tokens.ts": BRAND_TOKENS, ...FIRST });
      const r = await importCmd(dir, FILES);
      expect(r.code).toBe(0);
      expect(
        r.stdout
          .split("\n")
          .filter((l) => l !== "")
          .at(-1),
      ).toBe("ok tokens import 3 tokens, 0 looks, 0 themes");
      const text = read(dir, "tokens.design.ts");
      expect(text.startsWith("// Written by keel tokens import; edit tokens.ts.\n")).toBe(true);
      expect(text).toContain("export const designTokens = defineTokens(");
      expect(await designTokens(dir)).toEqual({
        color: { text: { light: "#1a191e", dark: "#F3F3F3" }, surface: "#F9F9F9" },
        space: { 2: "8px" },
      });
    },
    SLOW,
  );

  test(
    "a file `<stem>.<mode>.tokens.json` is mode `<mode>` of collection `<stem>`, and the order the modes are given in does not change the pairs",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (swap) => {
          const dir = project({ "tokens.ts": BRAND_TOKENS, ...FIRST });
          const files = swap ? [...FILES].reverse() : FILES;
          expect((await importCmd(dir, files)).code).toBe(0);
          expect((await designTokens(dir)).color).toEqual({
            text: { light: "#1a191e", dark: "#F3F3F3" },
            surface: "#F9F9F9",
          });
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    SLOW,
  );

  test(
    'Adding `design/brand.base.tokens.json` `{"color":{"$type":"color","accent":{"$value":"#b8420d"}}}`, `design/brand.slate.tokens.json` with `accent` `#0B5CAD` and `design/brand.highContrast.tokens.json` with `accent` `#8B300A`, in that order, gives `color.accent` `\'#b8420d\'` and `themes` `{ slate: { color: { accent: \'#0B5CAD\' } }, highContrast: { when: \'contrast\', color: { accent: \'#8B300A\' } } }`',
    async () => {
      const accent = (v: string): string => `{"color":{"$type":"color","accent":{"$value":"${v}"}}}`;
      const dir = project({
        "tokens.ts": BRAND_TOKENS,
        ...FIRST,
        "design/brand.base.tokens.json": accent("#b8420d"),
        "design/brand.slate.tokens.json": accent("#0B5CAD"),
        "design/brand.highContrast.tokens.json": accent("#8B300A"),
      });
      const files = [
        ...FILES,
        "design/brand.base.tokens.json",
        "design/brand.slate.tokens.json",
        "design/brand.highContrast.tokens.json",
      ];
      const r = await importCmd(dir, files);
      expect(r.code).toBe(0);
      expect(
        r.stdout
          .split("\n")
          .filter((l) => l !== "")
          .at(-1),
      ).toMatch(/^ok tokens import \d+ tokens, 0 looks, 2 themes$/);
      const t = await designTokens(dir);
      expect(Reflect.get(Reflect.get(t, "color") ?? {}, "accent")).toBe("#b8420d");
      expect(Reflect.get(t, "themes")).toEqual({
        slate: { color: { accent: "#0B5CAD" } },
        highContrast: { when: "contrast", color: { accent: "#8B300A" } },
      });
    },
    SLOW,
  );

  test(
    "a further mode named `print` has `when` `print`, `contrast` `contrast`, any other name `choice`, named in lowerCamel",
    async () => {
      const accent = (v: string): string => `{"color":{"$type":"color","accent":{"$value":"${v}"}}}`;
      const names = { print: "print", contrast: "contrast", highContrast: "contrast", slate: "choice" } as const;
      for (const [mode, when] of Object.entries(names)) {
        const dir = project({
          "tokens.ts": BRAND_TOKENS,
          "design/brand.base.tokens.json": accent("#b8420d"),
          [`design/brand.${mode}.tokens.json`]: accent("#0B5CAD"),
        });
        expect(
          (await importCmd(dir, ["design/brand.base.tokens.json", `design/brand.${mode}.tokens.json`])).code,
          mode,
        ).toBe(0);
        const themes = Reflect.get(await designTokens(dir), "themes");
        expect(Reflect.get(themes ?? {}, mode), mode).toEqual({
          ...(when === "choice" ? {} : { when }),
          color: { accent: "#0B5CAD" },
        });
      }
    },
    SLOW,
  );
});

describe("k.cli: tokens import skips and drops what has no group", () => {
  const TYPE = `{"type":{"heading":{"$type":"typography","$value":{"fontFamily":"Inter","fontSize":"28px","fontWeight":600,"lineHeight":1.2}}},"hero":{"$type":"gradient","$value":[{"color":"#000000","position":0}]}}`;

  test(
    "A token `hero` of `$type` `gradient` is one W1072 at its `$value` with message `hero: gradient has no Keel group; skipped`; a `typography` token `type.heading` gives `font.heading` `'Inter'`, `fontSize.heading` `'28px'`, `weight.heading` `'600'`, `look.heading` `{ font: 'heading', fontSize: 'heading', weight: 'heading' }` and one W1072 `type.heading lineHeight: dropped`",
    async () => {
      const dir = project({ "tokens.ts": BRAND_TOKENS, "design/type.tokens.json": TYPE });
      const r = await importCmd(dir, ["design/type.tokens.json"], "json");
      const w = records(r.stdout).filter((x) => x.code === "W1072");
      expect(w.map((x) => x.message).sort()).toEqual([
        "hero: gradient has no Keel group; skipped",
        "type.heading lineHeight: dropped",
      ]);
      const hero = w.find((x) => String(x.message).startsWith("hero"));
      expect(hero).toMatchObject({
        kind: "diag",
        path: "design/type.tokens.json",
        ...where(TYPE, '"$value"', TYPE.indexOf('"hero"')),
      });
      const dropped = w.find((x) => String(x.message).startsWith("type.heading"));
      expect(dropped).toMatchObject({ path: "design/type.tokens.json", ...where(TYPE, '"lineHeight"') });
      expect(r.code).toBe(0);
      const t = await designTokens(dir);
      expect(Reflect.get(t, "font")).toEqual({ heading: "Inter" });
      expect(Reflect.get(t, "fontSize")).toEqual({ heading: "28px" });
      expect(Reflect.get(t, "weight")).toEqual({ heading: "600" });
      expect(Reflect.get(t, "look")).toEqual({ heading: { font: "heading", fontSize: "heading", weight: "heading" } });
    },
    SLOW,
  );

  test(
    'a file `{"a":1}` is one E1071 and writes no file, and so is a file that is not JSON',
    async () => {
      for (const body of ['{"a":1}', "not json"]) {
        const dir = project({ "tokens.ts": BRAND_TOKENS, "design/bad.tokens.json": body });
        const r = await importCmd(dir, ["design/bad.tokens.json"], "json");
        const e = records(r.stdout).filter((x) => x.code === "E1071");
        expect(e).toHaveLength(1);
        expect(e[0]?.message).toBe("design/bad.tokens.json is not a design tokens file");
        expect(e[0]?.fix).toBeUndefined();
        expect(r.code).toBe(1);
        expect(existsSync(join(dir, "tokens.design.ts"))).toBe(false);
        expect(read(dir, "tokens.ts")).toBe(BRAND_TOKENS);
      }
    },
    SLOW,
  );

  test(
    "each of a gradient, a number, a cubic bezier and a transition is one W1072 `<token>: <type> has no Keel group; skipped`, whatever its name",
    async () => {
      const kinds = {
        gradient: `[{"color":"#000000","position":0}]`,
        number: "0.5",
        cubicBezier: "[0.1,0.2,0.3,0.4]",
        transition: `{"duration":"1s","delay":"0s","timingFunction":[0,0,1,1]}`,
      } as const;
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.keys(kinds)),
          fc.stringMatching(/^[a-z]{2,6}$/),
          async (kind, name) => {
            const dir = project({
              "tokens.ts": BRAND_TOKENS,
              "design/x.tokens.json": `{"${name}":{"$type":"${kind}","$value":${Reflect.get(kinds, kind)}}}`,
            });
            const r = await importCmd(dir, ["design/x.tokens.json"], "json");
            expect(
              records(r.stdout)
                .filter((x) => x.code === "W1072")
                .map((x) => x.message),
            ).toEqual([`${name}: ${kind} has no Keel group; skipped`]);
            expect(r.code).toBe(0);
          },
        ),
        { seed: SEED, numRuns: 8 },
      );
    },
    SLOW,
  );

  test(
    "W1072 is a warning with no fix: its record carries no `fix`, and a run with only W1072 exits 0",
    async () => {
      const dir = project({ "tokens.ts": BRAND_TOKENS, "design/type.tokens.json": TYPE });
      const r = await importCmd(dir, ["design/type.tokens.json"], "json");
      for (const w of records(r.stdout).filter((x) => x.code === "W1072")) {
        expect(w.fix).toBeUndefined();
      }
      expect(r.code).toBe(0);
    },
    SLOW,
  );
});

describe("k.cli: tokens import colors in other spaces", () => {
  test(
    "a color in a space with no form of its own is written as `oklch()` at 4 decimals with one W1072 `<token>: <space> as oklch`",
    async () => {
      const lab = `{"color":{"$type":"color","x":{"$value":{"colorSpace":"lab","components":[50,20,30]}}}}`;
      const dir = project({ "tokens.ts": BRAND_TOKENS, "design/lab.tokens.json": lab });
      const r = await importCmd(dir, ["design/lab.tokens.json"], "json");
      expect(
        records(r.stdout)
          .filter((x) => x.code === "W1072")
          .map((x) => x.message),
      ).toEqual(["color.x: lab as oklch"]);
      const color = Reflect.get(await designTokens(dir), "color");
      expect(String(Reflect.get(color ?? {}, "x"))).toMatch(
        /^oklch\(-?\d+(\.\d{1,4})? -?\d+(\.\d{1,4})? -?\d+(\.\d{1,4})?\)$/,
      );
      expect(r.code).toBe(0);
    },
    SLOW,
  );
});

describe("k.cli: tokens import and tokens.ts", () => {
  test(
    "With `tokens.ts` `export const tokens = brandTokens;` and its import, the first case's import makes `tokens` `defineTokens({ ...brandTokens, color: { ...brandTokens.color, ...designTokens.color }, space: { ...brandTokens.space, ...designTokens.space } })` with `defineTokens` and `designTokens` imported, `keel check` then reports none of E1807 and E1801, and a second import leaves `tokens.ts` byte for byte as it was",
    async () => {
      const dir = project({ "tokens.ts": BRAND_TOKENS, ...FIRST });
      expect((await importCmd(dir, FILES)).code).toBe(0);
      const after = norm(read(dir, "tokens.ts"));
      expect(after).toContain('import { defineTokens } from "@keel/ui";');
      expect(after).toContain('import { designTokens } from "./tokens.design.ts";');
      expect(after).toContain('import { brandTokens } from "@keel/ui/brand";');
      expect(after).toContain(
        "export const tokens = defineTokens({ ...brandTokens, color: { ...brandTokens.color, ...designTokens.color }, space: { ...brandTokens.space, ...designTokens.space } });",
      );
      const c = keel(dir, ["check"]);
      expect(c.records.filter((r) => r.kind === "diag" && (r.code === "E1807" || r.code === "E1801"))).toEqual([]);
      const before = read(dir, "tokens.ts");
      expect((await importCmd(dir, FILES)).code).toBe(0);
      expect(read(dir, "tokens.ts")).toBe(before);
    },
    SLOW,
  );

  test(
    "a hand edit after the spreads in `tokens.ts` and a comment survive a second import, which rewrites `tokens.design.ts` whole",
    async () => {
      const dir = project({ "tokens.ts": BRAND_TOKENS, ...FIRST });
      await importCmd(dir, FILES);
      const edited = read(dir, "tokens.ts")
        .replace("...designTokens.color", '...designTokens.color, accent: "#123456"')
        .replace("export const tokens", "// hand edit\nexport const tokens");
      writeFileSync(join(dir, "tokens.ts"), edited);
      writeFileSync(join(dir, "design/color.dark.tokens.json"), DARK.replace("#F3F3F3", "#EEEEEE"));
      writeFileSync(join(dir, "tokens.design.ts"), "// stale\n");
      expect((await importCmd(dir, FILES)).code).toBe(0);
      expect(read(dir, "tokens.ts")).toBe(edited);
      expect(read(dir, "tokens.design.ts")).not.toContain("stale");
      expect(read(dir, "tokens.design.ts")).toContain("#EEEEEE");
    },
    SLOW,
  );

  test(
    "with no `tokens.ts`, the import writes `export const tokens = designTokens;`",
    async () => {
      const dir = project({ ...FIRST });
      expect((await importCmd(dir, FILES)).code).toBe(0);
      const text = norm(read(dir, "tokens.ts"));
      expect(text).toContain("export const tokens = designTokens;");
      expect(text).toContain('import { designTokens } from "./tokens.design.ts";');
    },
    SLOW,
  );

  test(
    "the RFC's three-file example writes `tokens.design.ts` as the RFC prints it (after formatting) and prints its two W1072 and `ok tokens import 14 tokens, 1 looks, 0 themes`",
    async () => {
      const palette = `{
  "palette": {
    "$type": "color",
    "ink": { "$value": { "colorSpace": "srgb", "components": [0.102, 0.098, 0.118], "hex": "#1a191e" } },
    "chalk": { "$value": "#F3F3F3" },
    "paper": { "$value": "#F9F9F9" },
    "night": { "$value": "#141317" },
    "ochre": { "$value": "#b8420d" },
    "ember": { "$value": { "colorSpace": "oklch", "components": [0.72, 0.14, 45] } }
  },
  "spacing": {
    "$type": "dimension",
    "1": { "$value": { "value": 4, "unit": "px" } },
    "2": { "$value": { "value": 8, "unit": "px" } }
  },
  "type": {
    "heading": {
      "$type": "typography",
      "$value": {
        "fontFamily": ["Source Serif 4", "Georgia", "serif"],
        "fontSize": { "value": 28, "unit": "px" },
        "fontWeight": "semi-bold",
        "lineHeight": 1.2
      }
    }
  },
  "hero": {
    "$type": "gradient",
    "$value": [{ "color": "{palette.ochre}", "position": 0 }, { "color": "{palette.ink}", "position": 1 }]
  }
}
`;
      const light = `{ "color": { "$type": "color", "text": { "$value": "{palette.ink}" }, "surface": { "$value": "{palette.paper}" }, "accent": { "$value": "{palette.ochre}" } } }\n`;
      const dark = `{ "color": { "$type": "color", "text": { "$value": "{palette.chalk}" }, "surface": { "$value": "{palette.night}" }, "accent": { "$value": "{palette.ember}" } } }\n`;
      const dir = project({
        "tokens.ts": BRAND_TOKENS,
        "design/palette.tokens.json": palette,
        "design/theme.light.tokens.json": light,
        "design/theme.dark.tokens.json": dark,
      });
      const files = ["design/palette.tokens.json", "design/theme.light.tokens.json", "design/theme.dark.tokens.json"];
      const r = await importCmd(dir, files);
      const lines = r.stdout.split("\n").filter((l) => l !== "");
      const hero = where(palette, '"$value"', palette.indexOf('"hero"'));
      const heading = where(palette, '"lineHeight"');
      expect(lines.slice(0, -1).sort()).toEqual(
        [
          `W1072 design/palette.tokens.json:${hero.line}:${hero.col} hero: gradient has no Keel group; skipped`,
          `W1072 design/palette.tokens.json:${heading.line}:${heading.col} type.heading lineHeight: dropped`,
        ].sort(),
      );
      expect(lines.at(-1)).toBe("ok tokens import 14 tokens, 1 looks, 0 themes");
      const expected = `// Written by keel tokens import; edit tokens.ts.
import { defineTokens } from "@keel/ui";

export const designTokens = defineTokens({
  color: {
    paletteInk: "#1a191e",
    paletteChalk: "#F3F3F3",
    palettePaper: "#F9F9F9",
    paletteNight: "#141317",
    paletteOchre: "#b8420d",
    paletteEmber: "oklch(0.72 0.14 45)",
    text: { light: "#1a191e", dark: "#F3F3F3" },
    surface: { light: "#F9F9F9", dark: "#141317" },
    accent: { light: "#b8420d", dark: "oklch(0.72 0.14 45)" },
  },
  space: { 1: "4px", 2: "8px" },
  font: { heading: '"Source Serif 4", Georgia, serif' },
  fontSize: { heading: "28px" },
  weight: { heading: "600" },
  look: { heading: { font: "heading", fontSize: "heading", weight: "heading" } },
});
`;
      expect(formatted(read(dir, "tokens.design.ts"))).toBe(formatted(expected));
    },
    SLOW,
  );
});
