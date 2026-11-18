// Seed 1337 (fast-check seed, recorded in each fc.assert below)
// Spec: k.check, clause "Every fix a diagnostic carries applies to its fixture with `git apply`, and re-checking reports no diagnostic of that code. Fixtures of E1003, E1005 (bytes only), E1151, E1152, E1154-E1157, E1401, E1403 (`&&`, `?:` with `If` imported), E1405, E1451, E1452 (`try`), E1601, E1652, E1653, E1757 (`!`, `any`, suppression), E1805, and E1808 carry one; RFC 0035 lists why the others cannot."
// Spec: k.module, Rules, "No fix edits a file under `node_modules/`."
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";
import { FIXTURES, type Files, SEED } from "./support.ts";

type Options = NonNullable<Parameters<typeof check>[1]>;
const NO_TYPES: Options = { types: false };

/** Write `files` to a fresh temp dir, `git apply` the fix there, and return the patched files. */
function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-fix-"));
  try {
    for (const f of files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((f) => ({
      path: f.path,
      source: readFileSync(join(dir, f.path), "utf8"),
    }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const f = (path: string, source: string): Files[number] => ({ path, source });
const UI = "import { Box, Text } from '@keel/ui'\n";
/** E1403 carries a fix only where `If` is already imported (rfc:0061). */
const IF = "import { If } from '@keel/runtime-dom'\n";
const SERVICES = "import { endpoints } from '@keel/services'\nimport { s } from '@keel/schema'\n";
const manifest = (id: string, deps: string[], exports: string[], routes: string[]): Files[number] => {
  const q = (xs: string[]): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;
  return f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${q(
      deps,
    )}, capabilities: [], public: { exports: ${q(exports)}, routes: ${q(routes)} } })\n`,
  );
};
const fixtureOf = (code: string) => {
  const fx = CODE_FIXTURES[code];
  if (fx === undefined) throw new Error(`no fixture for ${code}`);
  return { files: fx.bad, opts: fx.badOpts ?? fx.opts ?? {} };
};

/** Sorted-key JSON, the canonical form of a `.keel/*.json` file (k.compiler Artifacts). */
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (typeof v === "object" && v !== null) {
    return Object.fromEntries(
      Object.entries(v)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, sortKeys(x)]),
    );
  }
  return v;
}

/** A genuine `deps.json` produced by compile(), re-indented: data and hash intact, bytes differ from canonical. */
function reindentedArtifact(): { canonical: Files; edited: Files } {
  // The source travels with its artifact: E1005 compares the artifact with what the sources compile to (rfc:0050).
  const source = f("C.tsx", `${UI}export default function C(props) { return <Text>{props.a}</Text> }\n`);
  const r = compile([source]);
  const data = r.artifacts["deps.json"];
  const hash = r.hashes["deps.json"];
  const canonical = `${JSON.stringify({ data: sortKeys(data), hash })}\n`;
  const edited = `${JSON.stringify({ data: sortKeys(data), hash }, null, 2)}\n`;
  expect(edited).not.toBe(canonical);
  return {
    canonical: [f(".keel/deps.json", canonical), source],
    edited: [f(".keel/deps.json", edited), source],
  };
}

interface FixedCase {
  name: string;
  code: string;
  files: Files;
  opts: Options;
}

const FIXED: FixedCase[] = [
  { name: "E1003", code: "E1003", ...fixtureOf("E1003") },
  {
    name: "E1005 (bytes only)",
    code: "E1005",
    files: reindentedArtifact().edited,
    opts: NO_TYPES,
  },
  {
    name: "E1151 (add to public.exports)",
    code: "E1151",
    files: [
      manifest("b", [], [], []),
      f("modules/b/Secret.ts", "export const Secret = 1\n"),
      manifest("a", ["b"], [], []),
      f("modules/a/Use.ts", "import { Secret } from '../b/Secret.ts'\nexport const Use = Secret\n"),
    ],
    opts: NO_TYPES,
  },
  { name: "E1152", code: "E1152", ...fixtureOf("E1152") },
  { name: "E1154", code: "E1154", ...fixtureOf("E1154") },
  {
    name: "E1155 (route show in orders gets orders. prefix)",
    code: "E1155",
    files: [
      manifest("orders", [], [], []),
      f(
        "modules/orders/routes.ts",
        "import { manifest } from '@keel/router'\nconst Page = () => null\nexport const routes = manifest({\n  'show': { path: '/show', component: Page },\n})\n",
      ),
    ],
    opts: NO_TYPES,
  },
  { name: "E1156", code: "E1156", ...fixtureOf("E1156") },
  {
    name: "E1157 (add b.priv to public.routes)",
    code: "E1157",
    files: [
      manifest("b", [], ["routes"], ["b.pub"]),
      f(
        "modules/b/routes.ts",
        "import { manifest } from '@keel/router'\nconst Page = () => null\nexport const routes = manifest({\n  'b.pub': { path: '/b/pub', component: Page },\n  'b.priv': { path: '/b/priv', component: Page },\n})\n",
      ),
      manifest("a", ["b"], [], []),
      f("modules/a/Back.ts", "import { routes } from '../b/routes.ts'\nexport const Back = routes.href('b.priv')\n"),
    ],
    opts: NO_TYPES,
  },
  {
    name: "E1401",
    code: "E1401",
    files: [
      f(
        "C.tsx",
        `import { Text } from '@keel/ui'\nexport default function C({ name }) { return <Text>{name}</Text> }\n`,
      ),
    ],
    opts: {},
  },
  {
    name: "E1451",
    code: "E1451",
    files: [f("C.tsx", `export function f() { throw new Error("x") }\n`)],
    opts: {},
  },
  {
    name: "E1452 (try)",
    code: "E1452",
    files: [f("C.tsx", "export function f() { try { return 1 } catch (e) { return 2 } }\n")],
    opts: {},
  },
  { name: "E1507 (annotation removed)", code: "E1507", ...fixtureOf("E1507") },
  {
    name: "E1601",
    code: "E1601",
    files: [f("C.tsx", "export const stamp = () => Date.now()\n")],
    opts: {},
  },
  {
    name: "E1652 (missing :param field added)",
    code: "E1652",
    files: [
      f(
        "src/Api.ts",
        `${SERVICES}export const Api = endpoints({ getOrder: { method: 'GET', path: '/orders/:id', params: s.object({}), output: s.string() } })\n`,
      ),
    ],
    opts: NO_TYPES,
  },
  { name: "E1652 (extra field removed)", code: "E1652", ...fixtureOf("E1652") },
  { name: "E1653", code: "E1653", ...fixtureOf("E1653") },
  {
    name: "E1757 (non-null assertion)",
    code: "E1757",
    files: [f("src/x.ts", "declare const m: { a?: number }\nexport const x = m.a!\n")],
    opts: {},
  },
  {
    name: "E1757 (any)",
    code: "E1757",
    files: [f("src/x.ts", "export const x: any = 1\n")],
    opts: {},
  },
  {
    name: "E1757 (ts-ignore)",
    code: "E1757",
    files: [f("src/x.ts", "// @ts-ignore\nexport const x = 1\n")],
    opts: {},
  },
  { name: "E1806 (JSX element wrapped as a thunk)", code: "E1806", ...fixtureOf("E1806") },
  { name: "E1820 (plain direction, children reversed)", code: "E1820", ...fixtureOf("E1820") },
  {
    name: "E1403 (&&, rfc:0061)",
    code: "E1403",
    files: [
      f("C.tsx", `${UI}${IF}export default function C(props) { return <Box>{props.a && <Text>x</Text>}</Box> }\n`),
    ],
    opts: {},
  },
  {
    name: "E1403 (?: with element branches, rfc:0061)",
    code: "E1403",
    files: [
      f(
        "C.tsx",
        `${UI}${IF}export default function C(props) { return <Box>{props.a ? <Text>x</Text> : <Text>y</Text>}</Box> }\n`,
      ),
    ],
    opts: {},
  },
  {
    name: "E1405",
    code: "E1405",
    files: [
      f(
        "C.tsx",
        `import { Text } from '@keel/ui'\nexport default function C(props: { label: string }) { const label = props.label; return <Text>{label}</Text> }\n`,
      ),
    ],
    opts: NO_TYPES,
  },
  {
    name: "E1805",
    code: "E1805",
    files: [f("C.tsx", `${UI}export default function C() { return <Box><h2>Orders</h2></Box> }\n`)],
    opts: {},
  },
  {
    name: "E1258",
    code: "E1258",
    files: [
      f(
        "modules/app/Card.tsx",
        `${UI}export function Card(props: { icon?: unknown }) { return <Box>{props.icon}</Box> }\n`,
      ),
      f("modules/app/Icon.tsx", `${UI}export function Icon() { return <Box>i</Box> }\n`),
      f(
        "modules/app/Page.ts",
        `import { Card } from './Card.tsx'\nimport { Icon } from './Icon.tsx'\nexport default function Page() { return Card({ icon: Icon() }) }\n`,
      ),
    ],
    opts: NO_TYPES,
  },
  { name: "E1107", code: "E1107", ...fixtureOf("E1107") },
  { name: "E1406", code: "E1406", ...fixtureOf("E1406") },
  {
    name: "E1759",
    code: "E1759",
    files: fixtureOf("E1759").files,
    opts: NO_TYPES,
  },
  {
    name: "E1808",
    code: "E1808",
    files: [f("C.ts", `${UI}export default function C() { return Box({ children: Text({ children: "x" }) }) }\n`)],
    opts: {},
  },
];

test("a genuine compiler artifact is clean, and its re-indented copy is the E1005 bytes-only fixture", () => {
  const { canonical, edited } = reindentedArtifact();
  expect(check(canonical, NO_TYPES).diagnostics.map((d) => d.code)).toEqual([]);
  expect(check(edited, NO_TYPES).diagnostics.map((d) => d.code)).toEqual(["E1005"]);
});

for (const c of FIXED) {
  test(`${c.name}: its fix applies with git apply and re-checking reports no ${c.code}`, () => {
    const diags = check(c.files, c.opts).diagnostics.filter((d) => d.code === c.code);
    expect(diags.length).toBe(1);
    const fix = diags[0]?.fix;
    expect(typeof fix).toBe("string");
    if (fix === undefined) return;
    expect(fix.startsWith("--- a/")).toBe(true);
    const patched = applyFix(c.files, fix);
    expect(patched).not.toEqual(c.files);
    expect(check(patched, c.opts).diagnostics.map((d) => d.code)).not.toContain(c.code);
  });
}

const FIX = [
  "E1003",
  "E1572",
  "E1509",
  "E1510",
  "E1005",
  "E1107",
  "E1151",
  "E1152",
  "E1154",
  "E1155",
  "E1156",
  "E1157",
  "E1401",
  "E1403",
  "E1405",
  "E1451",
  "E1452",
  "E1507",
  "E1601",
  "E1652",
  "E1653",
  "E1757",
  "E1805",
  "E1806",
  "E1808",
  "E1258",
  "E1406",
  "E1759",
  "E1820",
];
const NO_FIX = [
  "E1000", // a syntax error has no unique repair
  "E1001", // the key field is a choice of the author
  "E1002", // the safe replacement depends on intent (text vs. markup)
  "E1004", // moving server code is a design change
  "E1104", // renaming the file would break imports in other files
  "E1105", // moving to a .server file is a design change
  "E1106", // which stdlib format type to use is the author's choice
  "E1111", // carrying the value another way (an action input, a session) is a design change
  "E1112", // what to derive is the author's choice
  "E1153", // which dependency edge to cut is a design choice
  "E1158", // adding the dep or dropping the entry is the author's choice
  "E1204", // the Case per resource state is the author's
  "E1207", // whether to drop the detached scope or own it differently is a design change
  "E1251", // the JSX that replaces an op is the author's
  "E1252", // the JSX or ctx replacement is the author's
  "E1302", // moving the effect out of the transaction is a design change
  "E1303", // removing the field or the reveal call is a design change
  "E1402", // the content of the missing Case is the author's
  "E1404", // which id to rename is the author's choice
  "E1453", // how to handle the Result is the author's choice
  "E1454", // which code to rename is the author's choice
  "E1501", // the target route id is unknown to the checker
  "E1508", // which route leaves the guarded layout is a design choice
  "E1511", // the module's deployable is the author's choice
  "E1512", // the fix is in the action's own file
  "E1566", // which deployable hosts the client is the author's choice
  "E1551", // moving the declaration to a .server file is a design change
  "E1567", // the module, deps and public.routes edits span files
  "E1570", // where the asset or form target lives is the author's choice
  "E1571", // moving the call to a server file spans files
  "E1578", // k.user Rules: Fix none; the caller days or the deployable is the author's choice
  "E1579", // k.user Rules: Fix none; the identity export, the mount path or the route is the author's choice
  "E1580", // k.mount Rules: Fix none; the mount path and the identity source are the author's
  "E1581", // k.mount Rules: Fix none; moving the module or hosting the deployable is the author's choice
  "E1582", // k.mount Rules: Fix none; the subpath is the author's
  "E1576", // the public replacement is the author's
  "E1573", // the shell's adapter and app id are the author's
  "E1561", // choosing between the caller's and the producer's schema is a judgment
  "E1562", // the fix edits the route's schema source and needs a rebuilt surface; its fixture is surface data alone
  "E1563", // as E1562: the fix edits the store's schema source; its fixture is surface data alone
  "E1603", // the code in the string is the author's
  "E1651", // the replacement endpoint is unknown
  "E1701", // the harness id is unknown
  "E1751", // a generic type error has no mechanical repair
  "E1752", // splitting a file is a design change
  "E1753", // which code to rename is the author's choice
  "E1754", // the justification must be written by the author
  "E1755", // a budget breach has no source edit
  "E1758", // the locale or time zone is an argument the caller holds
  "E1802", // the missing prop value is the author's choice
  "E1803", // the replacement token is the author's choice
  "E1804", // which token pair to use is a design choice
  "E1822", // which widget replaces the part is the author's choice
  "E1823", // which literal to write is the author's choice
  "E1901", // the form path to bind is the author's choice
];

test("fix-bearing codes and no-fix codes partition exactly the fixtured codes", () => {
  const fixtured = new Set([...Object.keys(CODE_FIXTURES), ...FIXTURES.map((x) => x.code)]);
  const all = [...FIX, ...NO_FIX];
  expect(new Set(all).size).toBe(all.length);
  expect(FIX.filter((c) => NO_FIX.includes(c))).toEqual([]);
  expect([...fixtured].filter((c) => !all.includes(c)).sort()).toEqual([]);
  expect(all.filter((c) => !fixtured.has(c)).sort()).toEqual([]);
});

interface Bad {
  code: string;
  files: Files;
  opts: Options;
}
const BAD: Bad[] = [
  ...Object.entries(CODE_FIXTURES).map(([code, fx]) => ({
    code,
    files: fx.bad,
    opts: fx.badOpts ?? fx.opts ?? {},
  })),
  ...FIXTURES.map((x) => ({
    code: x.code,
    files: [f("C.tsx", x.bad)],
    opts: {},
  })),
];

test("every fix on every bad fixture applies with git apply, reports strictly fewer of its code, and never names node_modules/", () => {
  fc.assert(
    fc.property(fc.constantFrom(...BAD), (bad) => {
      const before = check(bad.files, bad.opts).diagnostics;
      for (const d of before) {
        if (d.fix === undefined) continue;
        for (const line of d.fix.split("\n")) {
          if (line.startsWith("--- a/") || line.startsWith("+++ b/")) expect(line).not.toContain("node_modules/");
        }
        const patched = applyFix(bad.files, d.fix);
        const after = check(patched, bad.opts).diagnostics;
        expect(after.filter((x) => x.code === d.code).length).toBeLessThan(
          before.filter((x) => x.code === d.code).length,
        );
      }
    }),
    { seed: SEED, numRuns: BAD.length * 2 },
  );
});
