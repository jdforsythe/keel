// k.library Rules E1162 and k.library-pack Ledger file: `readLibraryLedger`, `ledgerCount` and E1162 over `check()`
// files. Seed 1337.
import { check, ledgerCount, readLibraryLedger } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const NO_TYPES = { types: false } as const;
const KEYS = ["version", "unsafe", "hostElements", "exports"] as const;
const GOOD = { version: 1, unsafe: 0, hostElements: 0, exports: [] };
type File = { path: string; source: string };

const unsafeCalls = (n: number): string =>
  `declare function unsafe<T>(why: string, fn: () => T): T;\n${Array.from({ length: n }, (_, i) => `export const r${i} = unsafe("why it is safe here", () => ${i});`).join("\n")}\n`;

/** An app module listing `@acme/charts`, the library installed beside it with `ledger` and `files`. */
const project = (ledger: string | null, files: Record<string, string> = {}): File[] => [
  {
    path: "modules/shop/module.ts",
    source:
      "import { module } from '@keel/compiler'\nexport default module({ id: 'shop', deps: ['@acme/charts'], capabilities: [], public: { exports: [] } })\n",
  },
  {
    path: "node_modules/@acme/charts/package.json",
    source: JSON.stringify({ name: "@acme/charts", version: "1.0.0", type: "module", keel: "library" }),
  },
  {
    path: "node_modules/@acme/charts/module.ts",
    source:
      "import { module } from '@keel/compiler'\nexport default module({ id: 'charts', deps: [], capabilities: [], public: { exports: [] } })\n",
  },
  ...(ledger === null ? [] : [{ path: "node_modules/@acme/charts/.keel/ledger.json", source: ledger }]),
  ...Object.entries(files).map(([rel, source]) => ({ path: `node_modules/@acme/charts/${rel}`, source })),
];
const e1162 = (files: File[]): string[] =>
  check(files, NO_TYPES)
    .diagnostics.filter((d) => d.code === "E1162")
    .map((d) => d.message);

test("readLibraryLedger names the first failing key in File's order, whatever the others hold", () => {
  const bad = fc.constantFrom<unknown>("1", -0.5, null, {}, 2.5);
  fc.assert(
    fc.property(fc.subarray([...KEYS], { minLength: 1 }), bad, (broken, value) => {
      const file = { ...GOOD, ...Object.fromEntries(broken.map((k) => [k, k === "version" ? 2 : value])) };
      const read = readLibraryLedger(JSON.stringify(file));
      expect(read).toEqual({ ok: false, fault: "shape", key: KEYS.find((k) => broken.includes(k)) });
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("readLibraryLedger judges no key beyond the four, and reads no other JSON than an object", () => {
  fc.assert(
    fc.property(fc.dictionary(fc.stringMatching(/^[a-z]{6,10}$/), fc.jsonValue()), (extra) => {
      const rest = Object.fromEntries(Object.entries(extra).filter(([k]) => !KEYS.some((x) => x === k)));
      expect(readLibraryLedger(JSON.stringify({ ...rest, ...GOOD })).ok).toBe(true);
    }),
    { seed: SEED, numRuns: 100 },
  );
  for (const text of ["", "x", "[]", "null", "3", '"s"', "false"])
    expect(readLibraryLedger(text)).toEqual({ ok: false, fault: "object" });
  expect(readLibraryLedger(undefined)).toEqual({ ok: false, fault: "missing" });
});

test("ledgerCount counts each `unsafe(...)` call outside comments and strings, never the declaration", () => {
  fc.assert(
    fc.property(fc.nat({ max: 6 }), (n) => {
      const src = `${unsafeCalls(n)}// unsafe("in a comment", () => 0)\nconst s = 'unsafe(1)'\n`;
      expect(ledgerCount("u.ts", src)).toEqual({ unsafe: n, hostElements: 0 });
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("E1162 compares the shipped counts with the library's src/ and unsafe/ files only", () => {
  fc.assert(
    fc.property(fc.nat({ max: 3 }), fc.nat({ max: 3 }), fc.nat({ max: 3 }), (inUnsafe, inSrc, shipped) => {
      const files = {
        "unsafe/u.ts": unsafeCalls(inUnsafe),
        "src/v.ts": unsafeCalls(inSrc),
        "tools/w.ts": unsafeCalls(2),
      };
      const ledger = JSON.stringify({ ...GOOD, unsafe: shipped });
      const held = inUnsafe + inSrc;
      expect(e1162(project(ledger, files))).toEqual(
        held === shipped ? [] : [`@acme/charts ships unsafe ${shipped}, its files hold ${held}`],
      );
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("E1162 is one per entry for a missing file, and none for a package that is no library", () => {
  expect(e1162(project(null))).toEqual(["@acme/charts ships no .keel/ledger.json"]);
  const plain = project(null).map((f) =>
    f.path.endsWith("package.json") ? { ...f, source: JSON.stringify({ name: "@acme/charts", version: "1.0.0" }) } : f,
  );
  expect(e1162(plain)).toEqual([]);
});
