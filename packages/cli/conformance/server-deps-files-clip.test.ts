// k.server-deps Rules "A clipped `<name>` (28 units), `<f>` (40), `<other>` (36), `<export>` or `<id>` (20) ends in `...`, by k.check Diagnostics' clip at that width, and every message is within 89. E1167 an `env` entry that is not a string literal matching `[A-Z][A-Z0-9_]*`, or that is a key `DeployEnv` parses (`PORT`, `KEEL_SECRET`, `KEEL_ORIGIN`, `KEEL_DATABASE_URL`, `KEEL_ALLOW_ORIGINS`) or begins with `KEEL_PEER_`, at the entry: its line and the column of its first character, a string literal's opening quote (an `env` that is no array literal: at its value); messages `env entry is not a string literal` (an entry or an `env` that is no string literal), `env name "<name>" does not match [A-Z][A-Z0-9_]*`, and `env name "<name>" is a key DeployEnv reads` (a `DeployEnv` key, or a name in the pattern beginning with `KEEL_PEER_`); no fix · E1014 `keel build`: a bundled package file's `new URL(<a>, import.meta.url)` whose `<a>` is of no form Files a bundled package reads copies or leaves alone, names a missing path, or names a path another bundled package file names for a file of other bytes; located at the package file (a library's at `node_modules/<name>/<f>`, any other by its path from its last `node_modules/` folder); messages `reads <f>, which is missing`, `reads <f>, outside its own folder`, `reads <f>, as <other> reads another file`, `reads new URL(x, import.meta.url) with x no string literal`, `<f>` the first argument as written, a leading `./` kept, `<other>` the other package file as located; the build fails and writes no `dist/<name>/`."
// Seed: 1337 (no generated input: each width is built at its edge). Binary runs: 3 `keel build`, each failing with E1014.
// Covers the clip widths of `<f>` (40 units) and `<other>` (36 units), at one unit under, at, and one unit over the width: "A clipped `<name>` (28 units), `<f>` (40), `<other>` (36), `<export>` or `<id>` (20) ends in `...`, by k.check Diagnostics' clip at that width".
// The fixture is two unscoped plain packages whose names have one length, so the location of either file clips alike: `node_modules/<p>/index.js` is 22 units plus the name, so names of 13, 14 and 15 units give 35, 36 and 37.
// ASSUMPTIONS (spec silent): `<other>` is the other package file "as located" (`node_modules/<name>/<f>`), and the E1014 for the pair is at either one of the two files; `<f>` is the text of `<a>` as written.
import { afterEach, describe, expect, test } from "vitest";
import { SLOW, built, cleanup, materialize, serverDepsProject, loaderModule, type Tree } from "./library-support.ts";

/** k.check's clip rule at `width` units: a longer value keeps `width - 3` units (one fewer before the first half of a pair), then `...`. */
const clipTo = (n: string, width: number): string => {
  if (n.length <= width) return n;
  const code = n.charCodeAt(width - 4);
  return `${n.slice(0, code >= 0xd800 && code <= 0xdbff ? width - 4 : width - 3)}...`;
};
const pkgJson = (name: string): string =>
  JSON.stringify({ name, version: "1.0.0", type: "module", exports: "./index.js", types: "./index.d.ts" });

function fixture(a: string, b: string, gone: string): Tree {
  const data = `import { ra } from '${a}'\nimport { rb } from '${b}'\nexport const data = (_ctx: unknown): string => \`\${ra()}-\${rb()}\`\n`;
  const idx = (fn: string, extra: string): string =>
    `import { readFileSync } from 'node:fs'\nexport const ${fn} = () => readFileSync(new URL('zap.bin', import.meta.url)).length${extra}\n`;
  const decl = (fn: string): string => `export declare function ${fn}(): number\n`;
  return {
    ...serverDepsProject({
      deployables: { api: ["a"] },
      modules: [{ id: "a", deps: [], extra: loaderModule("a", data) }],
      dependencies: { [a]: "1.0.0", [b]: "1.0.0" },
    }),
    [`node_modules/${a}/package.json`]: pkgJson(a),
    [`node_modules/${a}/index.js`]: idx("ra", ` + [new URL('${gone}', import.meta.url)].length`),
    [`node_modules/${a}/index.d.ts`]: decl("ra"),
    [`node_modules/${a}/zap.bin`]: "one\n",
    [`node_modules/${b}/package.json`]: pkgJson(b),
    [`node_modules/${b}/index.js`]: idx("rb", ""),
    [`node_modules/${b}/index.d.ts`]: decl("rb"),
    [`node_modules/${b}/zap.bin`]: "other bytes\n",
  };
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) cleanup(d);
});

function records(out: string): { path: string; message: string }[] {
  const found: { path: string; message: string }[] = [];
  for (const line of out.split("\n")) {
    if (!line.startsWith("{")) continue;
    let o: unknown;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof o !== "object" || o === null || Reflect.get(o, "code") !== "E1014") continue;
    const path = Reflect.get(o, "path");
    const message = Reflect.get(o, "message");
    if (typeof path === "string" && typeof message === "string") found.push({ path, message });
  }
  return found;
}

describe("k.server-deps Rules: `<f>` clipped to 40 units and `<other>` to 36 units, each ending in `...` (just under, at and just over the width)", () => {
  // [`<f>` length, package name length, whether `<f>` clips, whether `<other>` clips]
  const edges: [number, number, boolean, boolean][] = [
    [39, 13, false, false],
    [40, 14, false, false],
    [41, 15, true, true],
  ];
  for (const [fLen, pLen, clipsF, clipsOther] of edges) {
    test(
      `\`<f>\` of ${fLen} units and \`<other>\` of ${22 + pLen} units: ${clipsF ? "both end in `...`" : "neither is clipped"}`,
      () => {
        const a = `pk${"a".repeat(pLen - 2)}`;
        const b = `pk${"b".repeat(pLen - 2)}`;
        const gone = `${"g".repeat(fLen - 4)}.bin`;
        expect(gone.length).toBe(fLen);
        const dir = materialize(fixture(a, b, gone));
        dirs.push(dir);
        const r = built(dir);
        expect(r.status, r.out).toBe(1);
        const found = records(r.out);
        expect(r.out.includes('"code":"E1014"'), "E1014").toBe(true);
        expect(found, r.out).toHaveLength(2);
        const missing = found.find((f) => f.message.startsWith("reads ") && f.message.endsWith(", which is missing"));
        expect(missing?.message).toBe(`reads ${clipTo(gone, 40)}, which is missing`);
        expect(missing?.message.includes("...")).toBe(clipsF);
        const pair = found.find((f) => f !== missing);
        const here = pair?.path ?? "";
        expect([`node_modules/${a}/index.js`, `node_modules/${b}/index.js`]).toContain(here);
        const other =
          here === `node_modules/${a}/index.js` ? `node_modules/${b}/index.js` : `node_modules/${a}/index.js`;
        expect(other.length).toBe(22 + pLen);
        expect(pair?.message).toBe(`reads zap.bin, as ${clipTo(other, 36)} reads another file`);
        expect(pair?.message.includes("...")).toBe(clipsOther);
        for (const f of found) expect(f.message.length).toBeLessThanOrEqual(89);
      },
      SLOW,
    );
  }

  test(
    "`<f>` keeps its leading `./`: `new URL('./gone.bin', import.meta.url)` of a missing file is `reads ./gone.bin, which is missing`",
    () => {
      const dir = materialize(fixture("pkaaaaaaaaaaa", "pkbbbbbbbbbbb", "./gone.bin"));
      dirs.push(dir);
      const r = built(dir);
      expect(r.status, r.out).toBe(1);
      expect(r.out.includes('"code":"E1014"'), "E1014").toBe(true);
      const missing = records(r.out).filter((f) => f.message.endsWith(", which is missing"));
      expect(missing, r.out).toHaveLength(1);
      expect(missing[0]?.message).toBe("reads ./gone.bin, which is missing");
      expect(missing[0]?.path).toBe("node_modules/pkaaaaaaaaaaa/index.js");
    },
    SLOW,
  );
});
