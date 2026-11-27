// Spec: k.cli, clause "On that `tokens.ts`, `keel tokens set color/accent/dark '#8AB8F0'` adds `accent: { light: '#b8420d', dark: '#8AB8F0' }` after `...designTokens.color`, `keel tokens set themes/slate/radius/none 4px` adds `themes: { slate: { radius: { none: '4px' } } }`, a comment in the file stays, and `keel tokens set color/accent red` is one E1071 with message `color/accent: red fails TokenSchema` and writes nothing."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// The project is the one the clause's fixture builds: `design/color.light.tokens.json`, `design/color.dark.tokens.json` (k.cli #21's files) and `design/brand.base.tokens.json` (`accent` `#b8420d`), imported by `keel tokens import` so `tokens.ts` spreads `designTokens.color` and `designTokens.space` and `designTokens.color.accent` is `'#b8420d'`: "that `tokens.ts`" is read as the one the first import writes (k.cli #24) for a collection of those three files, with a comment added by the test. `keel tokens set` runs in process through `run` from `@keel/cli` with the project as `cwd`; `keel check` through the real binary.
// ASSUMPTIONS: "adds `accent: { light: '#b8420d', dark: '#8AB8F0' }` after `...designTokens.color`" is read on the file's text with quotes and layout normalised (the writer's quoting is not stated); the light value of the pair is the string value the spread gave `accent`. A refused set prints one E1071 diag record in json and exits 1.
// AMBIGUOUS (k.cli Tokens): "a value that was one string becomes a pair keeping it in the other scheme": whether the string comes from a key in `tokens.ts` or from a spread (here the spread's) is not stated; the case asserts it for the spread's. The message for another form of path is `<path> is not a token path` (Rules).
// Needs a real browser: nothing here.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { run } from "@keel/cli";
import fc from "fast-check";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { TOPOLOGY, keelProject } from "./a11y-project-support.ts";
import { keel, removeProject } from "./test-sim-project.ts";

const SLOW = fixedTime(180_000);
const SEED = 1337;
const created: string[] = [];
afterAll(() => {
  for (const d of created) removeProject(d);
});
const MODULE = `import { module } from "@keel/compiler";\nexport default module({ id: "m", deps: [], capabilities: [], public: { exports: [] } });\n`;
const BRAND_TOKENS = `import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`;
const LIGHT = `{"color":{"$type":"color","text":{"$value":"#1a191e"},"surface":{"$value":"#F9F9F9"}},"space":{"$type":"dimension","2":{"$value":{"value":8,"unit":"px"}}}}`;
const DARK = `{"color":{"$type":"color","text":{"$value":"#F3F3F3"},"surface":{"$value":"#F9F9F9"}},"space":{"$type":"dimension","2":{"$value":{"value":8,"unit":"px"}}}}`;
const BASE = `{"color":{"$type":"color","accent":{"$value":"#b8420d"}}}`;
const FILES = ["design/color.light.tokens.json", "design/color.dark.tokens.json", "design/brand.base.tokens.json"];

const cmd = (dir: string, args: string[]) =>
  run(["tokens", ...args, "--format=json"], { cwd: dir, env: {}, tty: false });
const read = (dir: string, path = "tokens.ts"): string => readFileSync(join(dir, path), "utf8");
const norm = (s: string): string =>
  s
    .replace(/'/g, '"')
    .replace(/\s+/g, " ")
    .replace(/,\s*([}\])])/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
const diags = (stdout: string): Record<string, unknown>[] =>
  stdout
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l): Record<string, unknown> => {
      const v: unknown = JSON.parse(l);
      return typeof v === "object" && v !== null ? { ...v } : {};
    })
    .filter((r) => r.kind === "diag");
/** A project after `keel tokens import` of the three files, its `tokens.ts` holding a comment. */
const imported = async (): Promise<string> => {
  const dir = keelProject("tokens-set", {
    "topology.ts": TOPOLOGY,
    "modules/m/module.ts": MODULE,
    "tokens.ts": BRAND_TOKENS,
    "design/color.light.tokens.json": LIGHT,
    "design/color.dark.tokens.json": DARK,
    "design/brand.base.tokens.json": BASE,
  });
  created.push(dir);
  const r = await run(["tokens", "import", ...FILES, "--format=json"], { cwd: dir, env: {}, tty: false });
  if (r.code !== 0) throw new Error(`fixture: import exited ${r.code}`);
  writeFileSync(
    join(dir, "tokens.ts"),
    read(dir).replace("export const tokens", "// keep this comment\nexport const tokens"),
  );
  return dir;
};

describe("k.cli: tokens set", () => {
  test(
    "On that `tokens.ts`, `keel tokens set color/accent/dark '#8AB8F0'` adds `accent: { light: '#b8420d', dark: '#8AB8F0' }` after `...designTokens.color`",
    async () => {
      const dir = await imported();
      expect((await cmd(dir, ["set", "color/accent/dark", "#8AB8F0"])).code).toBe(0);
      const text = norm(read(dir));
      expect(text).toContain(
        'color: { ...brandTokens.color, ...designTokens.color, accent: { light: "#b8420d", dark: "#8AB8F0" } }',
      );
    },
    SLOW,
  );

  test(
    "`keel tokens set themes/slate/radius/none 4px` adds `themes: { slate: { radius: { none: '4px' } } }`",
    async () => {
      const dir = await imported();
      expect((await cmd(dir, ["set", "themes/slate/radius/none", "4px"])).code).toBe(0);
      expect(norm(read(dir))).toContain('themes: { slate: { radius: { none: "4px" } } }');
    },
    SLOW,
  );

  test(
    "a comment in the file stays, and every other property stays, after each set",
    async () => {
      const dir = await imported();
      await cmd(dir, ["set", "color/accent/dark", "#8AB8F0"]);
      await cmd(dir, ["set", "themes/slate/radius/none", "4px"]);
      const after = read(dir);
      expect(after).toContain("// keep this comment");
      expect(norm(after)).toContain("space: { ...brandTokens.space, ...designTokens.space");
      expect(
        keel(dir, ["check"]).records.filter((r) => r.kind === "diag" && (r.code === "E1807" || r.code === "E1801")),
      ).toEqual([]);
    },
    SLOW,
  );

  test(
    "`keel tokens set color/accent red` is one E1071 with message `color/accent: red fails TokenSchema` and writes nothing",
    async () => {
      const dir = await imported();
      const before = read(dir);
      const r = await cmd(dir, ["set", "color/accent", "red"]);
      const d = diags(r.stdout).filter((x) => x.code === "E1071");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe("color/accent: red fails TokenSchema");
      expect(d[0]?.fix).toBeUndefined();
      expect(r.code).toBe(1);
      expect(read(dir)).toBe(before);
      expect(existsSync(join(dir, "tokens.ts"))).toBe(true);
    },
    SLOW,
  );

  test(
    "whatever the value, `set color/<name> <value>` replaces the key after the last spread once, and a value that fails `TokenSchema` writes nothing",
    async () => {
      const dir = await imported();
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`),
            fc.constantFrom("red", "#12345", "rgb(1,2,3)", "url(x)", "1px !important"),
          ),
          async (value) => {
            const before = read(dir);
            const r = await cmd(dir, ["set", "color/accent", value]);
            const valid = /^#[0-9a-f]{6}$/.test(value);
            if (valid) {
              expect(r.code).toBe(0);
              const text = norm(read(dir));
              expect(text.split(`accent: "${value}"`).length - 1).toBe(1);
              expect(text.split("accent:").length - 1).toBe(1);
              expect(text.indexOf(`accent: "${value}"`)).toBeGreaterThan(text.indexOf("...designTokens.color"));
              await cmd(dir, ["set", "color/accent", value]);
              expect(norm(read(dir))).toBe(text);
            } else {
              expect(r.code).toBe(1);
              expect(diags(r.stdout).map((d) => d.code)).toEqual(["E1071"]);
              expect(read(dir)).toBe(before);
            }
          },
        ),
        { seed: SEED, numRuns: 12 },
      );
    },
    SLOW,
  );

  test(
    "a path of another form is one E1071 `<path> is not a token path` and writes nothing, whatever the path",
    async () => {
      const dir = await imported();
      await fc.assert(
        fc.asyncProperty(fc.constantFrom("color", "nope", "color/a/b/c/d", "/color/a", "color//a"), async (path) => {
          const before = read(dir);
          const r = await cmd(dir, ["set", path, "#000000"]);
          const d = diags(r.stdout).filter((x) => x.code === "E1071");
          expect(
            d.map((x) => x.message),
            path,
          ).toEqual([`${path} is not a token path`]);
          expect(r.code).toBe(1);
          expect(read(dir)).toBe(before);
        }),
        { seed: SEED, numRuns: 5 },
      );
    },
    SLOW,
  );
});
