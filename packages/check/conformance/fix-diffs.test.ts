// Seed 1337 (fast-check seed, recorded in each fc.assert below)
// RFC 0222: E1108 (a `@keel/std-*` package added to `deps`) and E1589 (`servedBy` added, one `node` deployable) carry a fix.
// Spec: k.check, clause "Every fix a diagnostic carries applies to its fixture with `git apply`, and re-checking reports no diagnostic of that code. Fixtures of E1003, E1005 (bytes only), E1151, E1152, E1154-E1156, E1401, E1403 (`&&`, `?:` with `If` imported), E1405, E1451, E1452 (`try`), E1601, E1652, E1653, E1757 (`!`, `any`, suppression), E1805, and E1808 carry one; RFC 0035 lists why the others cannot."
// RFC 0157 / 0162: E1157 is retired (no fixture); E1154-E1156 keep theirs; E1407, E1510 and E1515 each carry one (k.component, k.contract); E1513 and E1514 carry none. k.check's sentence still names E1157 and omits these: see the report.
// RFC 0219: E1730 carries one (k.guards Test files); its exact result is asserted in testing-E1730-identity-mount.test.ts.
// RFC 0231: E1016 carries one (k.boundary Ambient types; its fix deletes the reference line); E1015 carries none.
// RFC 0225: E1013 carries one (k.bundle Aliases); its exact diff is asserted in bundle-E1013-aliased-import.test.ts.
// RFC 0204: E1165 carries one (its fix removes the `deps` entry).
// Invariant (not a sentence of k.module now): no fix edits a file under `node_modules/`.
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
import { CHECK_CASE_BOUND } from "./check-time.ts";

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
const manifest = (id: string, deps: string[], exports: string[]): Files[number] => {
  const q = (xs: string[]): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;
  return f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${q(
      deps,
    )}, capabilities: [], public: { exports: ${q(exports)} } })\n`,
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
  { name: "E1730 (import mount, pass it)", code: "E1730", ...fixtureOf("E1730") },
  { name: "E1590", code: "E1590", ...fixtureOf("E1590") },
  { name: "E1591", code: "E1591", ...fixtureOf("E1591") },
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
      manifest("b", [], []),
      f("modules/b/Secret.ts", "export const Secret = 1\n"),
      manifest("a", ["b"], []),
      f("modules/a/Use.ts", "import { Secret } from '../b/Secret.ts'\nexport const Use = Secret\n"),
    ],
    opts: NO_TYPES,
  },
  { name: "E1152", code: "E1152", ...fixtureOf("E1152") },
  { name: "E1154", code: "E1154", ...fixtureOf("E1154") },
  { name: "E1165 (remove the deps entry)", code: "E1165", ...fixtureOf("E1165") },
  {
    name: "E1589 (add servedBy: 'api' to the client deployable beside one node deployable)",
    code: "E1589",
    files: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['a'], adapter: 'client' },\n  api: { modules: ['b'], adapter: 'node' },\n})\n",
      ),
      manifest("a", [], []),
      manifest("b", [], []),
      f("identity.ts", "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n"),
      f(
        "identity.server.ts",
        "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n",
      ),
    ],
    opts: NO_TYPES,
  },
  {
    name: "E1155 (route show in orders gets orders. prefix)",
    code: "E1155",
    files: [
      manifest("orders", [], []),
      f(
        "modules/orders/orders.contract.ts",
        "import { contract } from '@keel/router/contract'\nexport const orders = contract('orders', { 'show': { path: '/show' } })\n",
      ),
    ],
    opts: NO_TYPES,
  },
  { name: "E1156", code: "E1156", ...fixtureOf("E1156") },
  { name: "E1013 (the alias replaced by the relative specifier)", code: "E1013", ...fixtureOf("E1013") },
  { name: "E1016 (the reference line deleted)", code: "E1016", ...fixtureOf("E1016") },
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
  { name: "E1407 (parameter list rewritten to (props, ctx: Ctx))", code: "E1407", ...fixtureOf("E1407") },
  { name: "E1510 (the refused member removed)", code: "E1510", ...fixtureOf("E1510") },
  { name: "E1515 (the extra binding key removed)", code: "E1515", ...fixtureOf("E1515") },
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

test(
  "a genuine compiler artifact is clean, and its re-indented copy is the E1005 bytes-only fixture",
  () => {
    const { canonical, edited } = reindentedArtifact();
    expect(check(canonical, NO_TYPES).diagnostics.map((d) => d.code)).toEqual([]);
    expect(check(edited, NO_TYPES).diagnostics.map((d) => d.code)).toEqual(["E1005"]);
  },
  CHECK_CASE_BOUND,
);

for (const c of FIXED) {
  test(
    `${c.name}: its fix applies with git apply and re-checking reports no ${c.code}`,
    () => {
      const diags = check(c.files, c.opts).diagnostics.filter((d) => d.code === c.code);
      expect(diags.length).toBe(1);
      const fix = diags[0]?.fix;
      expect(typeof fix).toBe("string");
      if (fix === undefined) return;
      expect(fix.startsWith("--- a/")).toBe(true);
      const patched = applyFix(c.files, fix);
      expect(patched).not.toEqual(c.files);
      expect(check(patched, c.opts).diagnostics.map((d) => d.code)).not.toContain(c.code);
    },
    CHECK_CASE_BOUND,
  );
}

const FIX = [
  "E1108", // k.formats Rules: fix below, else none: adds the `@keel/std-*` package to `deps`; its fixture and diff are packages/cli/conformance/format-literal-e1108-fix.test.ts (in-process `check` has std-temporal registered, so only `keel check` reaches the unregistered form)
  "E1589", // k.mount Messages: adds `servedBy` when `topology.ts` has exactly one `node` deployable; its fixture and exact diff are mount-e1589-fix.test.ts, and it is a FIXED case here
  "E1730",
  "E1003",
  "E1590",
  "E1591",
  "E1572",
  "E1509",
  "E1510",
  "E1005",
  "E1107",
  "E1151",
  "E1152",
  "E1154",
  "E1165",
  "E1155",
  "E1156",
  "E1401",
  "E1403",
  "E1405",
  "E1451",
  "E1452",
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
  "E1809",
  "E1010",
  "E1013",
  "E1016",
  "E1407",
  "E1515",
];
const NO_FIX = [
  "E1000", // a syntax error has no unique repair
  "E1001", // the key field is a choice of the author
  "E1002", // the safe replacement depends on intent (text vs. markup)
  "E1004", // moving server code is a design change
  "E1015", // k.boundary Rules: fix none; the remedy is to make the code a package
  "E1009", // k.boundary Rules: fix none; moving the guard to a `*.guard.*` file is a file move
  "E1104", // renaming the file would break imports in other files
  "E1105", // moving to a .server file is a design change
  "E1106", // which stdlib format type to use is the author's choice
  "E1111", // carrying the value another way (an action input, a session) is a design change
  "E1112", // what to derive is the author's choice
  "E1153", // which dependency edge to cut is a design choice
  "E1158", // adding the dep or dropping the entry is the author's choice
  "E1161", // k.library Rules: fix none; the id a library element takes is the author's to build from `id`
  "E1162", // k.library Rules: fix none; shipping the file is the library author's act
  "E1163", // k.library Rules: no fix; a diagnostic in a library file carries none (k.library In an app)
  "E1166", // k.library Rules: no fix stated; which of the two ids to rename is the author's choice
  "E1167", // k.server-deps Rules: no fix stated; the name an `env` entry should hold is the author's
  "E1204", // the Case per resource state is the author's
  "E1207", // whether to drop the detached scope or own it differently is a design change
  "E1251", // the JSX that replaces an op is the author's
  "E1252", // the JSX or ctx replacement is the author's
  "E1302", // moving the effect out of the transaction is a design change
  "E1303", // removing the field or the reveal call is a design change
  "E1304", // k.store Rules: the fix is a hint (create the store with the data as `initial`, or move the call to a handler), a design change
  "E1402", // the content of the missing Case is the author's
  "E1404", // which id to rename is the author's choice
  "E1453", // how to handle the Result is the author's choice
  "E1454", // which code to rename is the author's choice
  "E1501", // the target route id is unknown to the checker
  "E1502", // which path to change is the author's choice
  "E1503", // the params field is the author's to write
  "E1504", // which field becomes optional is the author's choice
  "E1506", // which layout the entry renders in is the author's choice
  "E1508", // which route leaves the guarded layout is a design choice
  "E1511", // the module's deployable is the author's choice
  "E1552", // k.topology Rules: Fix none; the unknown key is the author's to remove or rename
  "E1566", // which deployable hosts the client is the author's choice
  "E1550", // k.server Rules: no fix; which factory to drop or which id to rename is the author's choice
  "E1551", // moving the declaration to a .server file is a design change
  "E1567", // the module and deps edits span files
  "E1570", // where the asset or form target lives is the author's choice
  "E1571", // moving the call to a server file spans files
  "E1578", // k.user Rules: Fix none; the caller days or the deployable is the author's choice
  "E1579", // k.user Rules: Fix none; the identity export, the mount path or the route is the author's choice
  "E1580", // k.mount Rules: Fix none; the mount path and the identity source are the author's
  "E1581", // k.mount Rules: Fix none; moving the module or hosting the deployable is the author's choice
  "E1582", // k.mount Rules: Fix none; the subpath is the author's
  "E1584", // k.mount Rules: Fix none; the links entry is the author's
  "E1593", // k.mount Rules: Fix none; moving a mount is the author's call
  "E1592", // k.user Rules: Fix none; serving the module with servedBy or moving it is the author's choice
  "E1586", // k.topology Rules: no fix; the package, not the app, is wrong
  "E1587", // k.topology Rules: no fix; which package export holds the stylesheet is the author's choice
  "E1576", // the public replacement is the author's
  "E1573", // the shell's adapter and app id are the author's
  "E1513", // k.contract Rules: no fix; the checker cannot choose the file
  "E1514", // k.contract Rules: no fix; which import to drop is the author's choice
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
  "E1760", // k.unsafe Rules: none carries a fix; the reason is the author's to write
  "E1761", // k.unsafe Rules: none carries a fix; where the negative type test lives is the author's choice
  "E1801", // a look name that no `look` declares has no nearest token; the author names the look or declares it
  "E1802", // the missing prop value is the author's choice
  "E1607", // which registered name to keep is the author's choice
  "E1803", // the replacement token is the author's choice
  "E1804", // which token pair to use is a design choice
  "E1823", // which literal to write is the author's choice
  "E1824", // the code prop is rewritten to the literal form by the author, who names the file and export
  "E1825", // moving the stylesheet import to the code file is a design change
  "E1901", // the form path to bind is the author's choice
  "W1608", // which static import replaces the load is the author's call
  "W1114", // s.secret also changes how the server reads the value (reveal), which the author writes
];

test(
  "fix-bearing codes and no-fix codes partition exactly the fixtured codes",
  () => {
    const fixtured = new Set([...Object.keys(CODE_FIXTURES), ...FIXTURES.map((x) => x.code)]);
    const all = [...FIX, ...NO_FIX];
    expect(new Set(all).size).toBe(all.length);
    expect(FIX.filter((c) => NO_FIX.includes(c))).toEqual([]);
    expect([...fixtured].filter((c) => !all.includes(c)).sort()).toEqual([]);
    expect(all.filter((c) => !fixtured.has(c)).sort()).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

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

test(
  "every fix on every bad fixture applies with git apply, reports strictly fewer of its code, and never names node_modules/",
  () => {
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
  },
  CHECK_CASE_BOUND,
);
