// k.library Rules E1162 and k.library-pack Ledger file: `readLibraryLedger`, `ledgerCount` and E1162 over `check()`
// files. Seed 1337.
import { LedgerFileSchema, check, ledgerCount, readLibraryLedger } from "@keel/check";
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

test("LedgerFileSchema reads version 1 with six rung names and optional libraries, and refuses another version or rung", () => {
  const file = {
    ...GOOD,
    negativeTypes: 0,
    libraries: { "@acme/charts": { version: "1.0.0", unsafe: 1, hostElements: 0 } },
  };
  expect(LedgerFileSchema.parse(file).ok).toBe(true);
  expect(LedgerFileSchema.parse({ ...file, version: 2 }).ok).toBe(false);
  const entry = { pkg: "a", name: "b", file: "src/b.ts", rung: "tested" };
  expect(LedgerFileSchema.parse({ ...file, exports: [entry] }).ok).toBe(false);
  expect(LedgerFileSchema.parse({ ...file, clauses: [{ item: "k.a#1", rung: "proven" }] }).ok).toBe(true);
});

test("readLibraryLedger reads at most 262,144 UTF-8 bytes, and takes the last of duplicate keys", () => {
  const body = JSON.stringify(GOOD);
  const pad = (n: number): string => `${body}${" ".repeat(n - body.length)}`;
  expect(readLibraryLedger(pad(262_144)).ok).toBe(true);
  expect(readLibraryLedger(pad(262_145))).toEqual({ ok: false, fault: "size" });
  // A two-byte character counts two bytes.
  expect(readLibraryLedger(`${pad(262_143)}é`)).toEqual({ ok: false, fault: "size" });
  const dup = readLibraryLedger('{"version":1,"unsafe":5,"unsafe":0,"hostElements":0,"exports":[]}');
  expect(dup.ok && dup.value.unsafe).toBe(0);
  // A count past six digits is an integer: it holds the shape (E1162 then compares it).
  expect(readLibraryLedger(JSON.stringify({ ...GOOD, unsafe: 1_234_567, hostElements: 1_000_000 })).ok).toBe(true);
});

test("E1162 over the byte bound is its own message, and the counts message reaches 87 units at six-digit counts", () => {
  const name = "@acme-charts-widgets/chart-library-xyz";
  const at = (files: File[]): string[] =>
    e1162(
      files.map((f) => ({
        ...f,
        path: f.path.replace("@acme/charts", name),
        source: f.source.replace("'@acme/charts'", `'${name}'`).replace('"@acme/charts"', `"${name}"`),
      })),
    );
  const big = at(project(" ".repeat(262_145)));
  expect(big).toEqual([`${name} .keel/ledger.json is over 262144 bytes`]);
  expect(big[0]?.length).toBe(77);
  const hosts = `import { Host } from '@keel/ui'\n${"Host({});".repeat(100_000)}\n`;
  const counts = at(project(JSON.stringify({ ...GOOD, hostElements: 999_999 }), { "src/h.ts": hosts }));
  expect(counts).toEqual([`${name} ships hostElements 999999, its files hold 100000`]);
  expect(counts[0]?.length).toBe(87);
}, 120_000);
