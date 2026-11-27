import { copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
// @vitest-environment node
// Spec: k.e2e-page, clause "A test whose page's click handler rejects with `new Error('boom')` (an unhandled rejection: app code may not `throw`, E1451), and that never calls `problems()`, fails with E1738 holding `boom`; calling `problems({ kind: 'pageerror', text: 'boom' })` after the click returns it, and the test passes; calling `problems()` with no argument returns it, and the test still fails with E1738."
// Spec: k.e2e-page, clause "A test that fails at `until` writes one `.png` and one `.zip` under `reports/e2e/` named after its file and its T0001's line, and its T0001 output lists the `server:` records of the requests made during that `until`; the same test passing writes nothing under `reports/e2e/`."
// Spec: k.e2e-page, clause "`a11y()` of a page whose text is `#777` on `#fff` rejects E1703 naming `color-contrast`."
// Spec: k.e2e-page, clause "A page whose click handler calls `console.warn('late')` fails its test with E1738 holding `warning late` when the test does not read `problems()`, and `problems({ kind: 'warning', text: 'late' })` after the click returns `{ kind: 'warning', text: 'late' }` and the test passes."
// k.e2e-page Rules E1735 (`<verb> <id>: <what was seen> after <s>s`) and E1738 (a browser problem the test did not read), and the Failure output paragraph (T0001 at the test's line, at most 10 `server:` lines,
// then `screenshot:` per open tab and `trace:` per context, `<file>-<line>-<n>`), are asserted by the cases after the three clauses.
// Seed: n/a (no generated input). Method: as e2e-serve.test.ts: fixtures/e2e/node-app.ts, `keel test --e2e` in compact format (the failure output is read as text), the report and `reports/e2e/` read per case.
// The cases need Chromium (e2e-support.ts); none skips. The child run's `KEEL_TEST_TIME_SCALE` is 1 so `1.0s` below is the bound the test names.
// ASSUMED: (1) the click handler rejects with `new Error('boom')` (app code may not `throw`, E1451), an unhandled rejection the browser reports as a `pageerror`; (2) `<file>` is the test file's name
// without `.ts` (`until.e2e`) and `<line>` the T0001's line (the failing verb's), as the clause now says; (3) "the requests made during that `until`" is a request the test sends while the `until` waits, so it is started right
// after the verb's call; (4) `E1703` names `color-contrast` in its message; (5) the `warning` page's click handler calls `console.warn('late')`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAILURE, type Run, cleanup, failureOf, keelE2e, listing, outcome, project, suite } from "./e2e-support.ts";
import { PAGES, nodeApp } from "./fixtures/e2e/node-app.ts";
import { fixedTime } from "@keel/tooling/test-time";

const SERVE = "import { serve } from '@keel/testing/e2e'";

const boom = suite(
  [SERVE],
  [
    {
      title: "a boom the test never reads",
      body: `const app = await serve()
const page = await app.open('/boom')
await page.fire('a.boom.go', { type: 'click' })`,
    },
  ],
);
const warned = suite(
  [SERVE],
  [
    {
      title: "a warning the test never reads",
      body: `const app = await serve()
const page = await app.open('/warn')
await page.fire('a.warn.go', { type: 'click' })`,
    },
  ],
);
const warnRead = suite(
  [SERVE],
  [
    {
      title: "a warning the test reads",
      body: `const app = await serve()
const page = await app.open('/warn')
await page.fire('a.warn.go', { type: 'click' })
expect(page.problems({ kind: 'warning', text: 'late' })).toEqual([{ kind: 'warning', text: 'late' }])
expect(page.problems()).toEqual([])`,
    },
  ],
);
const read = suite(
  [SERVE],
  [
    {
      title: "a boom the test reads",
      body: `const app = await serve()
const page = await app.open('/boom')
await page.fire('a.boom.go', { type: 'click' })
const problems = page.problems({ kind: 'pageerror', text: 'boom' })
expect(problems).toHaveLength(1)
expect(problems[0]?.kind).toBe('pageerror')
expect(problems[0]?.text).toContain('boom')
expect(page.problems()).toEqual([])`,
    },
  ],
);
// `problems()` with no argument returns the problem and takes none: the test still fails with E1738.
const readAll = suite(
  [SERVE],
  [
    {
      title: "a boom the test reads with no argument",
      body: `const app = await serve()
const page = await app.open('/boom')
await page.fire('a.boom.go', { type: 'click' })
const problems = page.problems()
expect(problems.some((p) => p.text.includes('boom'))).toBe(true)
expect(page.problems().some((p) => p.text.includes('boom'))).toBe(true)`,
    },
  ],
);
// The same test fails by default and passes with `E2E_PASS=1`: the until waits for Connecting then.
const until = suite(
  [SERVE],
  [
    {
      title: "an until that runs out",
      body: `const app = await serve()
const page = await app.open('/status')
const waiting = page.until('a.status', { text: process.env.E2E_PASS === '1' ? 'Connecting' : 'Live' }, { within: 1000 })
const pending = app.fetch('/api/a/env', { headers: { accept: 'application/json' } })
await pending
await waiting`,
    },
  ],
);
const tabs = suite(
  [SERVE],
  [
    {
      title: "an until that runs out with two tabs",
      body: `const app = await serve()
const first = await app.open('/status')
await first.open('/status')
await first.until('a.status', { text: 'Live' }, { within: 1000 })`,
    },
  ],
);
const contrast = suite(
  [SERVE, "import { failure } from './failure.ts'"],
  [
    {
      title: "a11y of low contrast text",
      body: `const app = await serve()
const page = await app.open('/contrast')
const e = await failure(page.a11y())
expect(e.code).toBe('E1703')
expect(e.message).toContain('color-contrast')`,
    },
  ],
);

const F = {
  boom: "test/boom.e2e.ts",
  warned: "test/warned.e2e.ts",
  warnRead: "test/warnread.e2e.ts",
  read: "test/read.e2e.ts",
  readAll: "test/readall.e2e.ts",
  until: "test/until.e2e.ts",
  tabs: "test/tabs.e2e.ts",
  contrast: "test/contrast.e2e.ts",
} as const;
let dir = "";
let dirArgs = "";
let second: Run = { status: null, stdout: "", stderr: "" };
let failing: Run = { status: null, stdout: "", stderr: "" };
let passing: Run = { status: null, stdout: "", stderr: "" };
let listedAfterPass: string[] = [];
let listedAfterFail: string[] = [];

beforeAll(() => {
  dir = project({
    ...nodeApp(Object.values(PAGES)),
    "test/failure.ts": FAILURE,
    [F.boom]: boom.source,
    [F.warned]: warned.source,
    [F.until]: until.source,
    [F.tabs]: tabs.source,
    [F.contrast]: contrast.source,
  });
  // `problems(...expected)` is a call the handle may lack: a project of its own, so its type error fails no other case here.
  dirArgs = project({
    ...nodeApp(Object.values(PAGES)),
    "test/failure.ts": FAILURE,
    [F.read]: read.source,
    [F.readAll]: readAll.source,
    [F.warnRead]: warnRead.source,
  });
  second = keelE2e(dirArgs, [], { env: { KEEL_TEST_TIME_SCALE: "1" } });
  failing = keelE2e(dir, [], { env: { KEEL_TEST_TIME_SCALE: "1" } });
  listedAfterFail = listing(dir, "reports/e2e");
  // the second run rewrites `e2e.json`: the first run's report is kept beside it
  copyFileSync(join(dir, "reports/tests/e2e.json"), join(dir, "reports/tests/first.json"));
  rmSync(join(dir, "reports/e2e"), { recursive: true, force: true });
  passing = keelE2e(dir, [F.until], { env: { KEEL_TEST_TIME_SCALE: "1", E2E_PASS: "1" } });
  listedAfterPass = listing(dir, "reports/e2e");
}, fixedTime(3_000_000));
afterAll(cleanup);

const lineOf = (s: { lines: Record<string, number> }, title: string): number => s.lines[title] ?? 0;
/** The T0001 block of the test at `title` of `file` in the failing run, wherever on its lines the failing verb is. */
function block(file: string, line: number, run: Run = failing): { text: string; line: number } {
  const rows = run.stdout.split("\n");
  const at = rows.findIndex((r) => r.startsWith(`T0001 ${file}:`));
  expect(at, `no T0001 in ${file}`).toBeGreaterThanOrEqual(0);
  const head = rows[at] ?? "";
  const reported = Number(/^T0001 [^:]+:(\d+):/.exec(head)?.[1]);
  expect(reported, head).toBeGreaterThanOrEqual(line);
  return { text: failureOf(run.stdout, file, reported) ?? "", line: reported };
}

describe("k.e2e-page failure output and problems", () => {
  it("A test whose page's click handler rejects with `new Error('boom')` (an unhandled rejection: app code may not `throw`, E1451), and that never calls `problems()`, fails with E1738 holding `boom`; calling `problems({ kind: 'pageerror', text: 'boom' })` after the click returns it, and the test passes; calling `problems()` with no argument returns it, and the test still fails with E1738.", () => {
    expect(outcome(dir, F.boom, lineOf(boom, "a boom the test never reads"), "first.json")).toBe("failed");
    const b = block(F.boom, lineOf(boom, "a boom the test never reads"));
    expect(b.text).toContain("E1738");
    expect(b.text).toContain("boom");
    expect(outcome(dirArgs, F.read, lineOf(read, "a boom the test reads")), second.stdout).toBe("passed");
    // `problems()` with no argument returns it and the test still fails with E1738
    expect(outcome(dirArgs, F.readAll, lineOf(readAll, "a boom the test reads with no argument"))).toBe("failed");
    const all = block(F.readAll, lineOf(readAll, "a boom the test reads with no argument"), second);
    expect(all.text).toContain("E1738");
    expect(all.text).toContain("boom");
  });

  it("A test that fails at `until` writes one `.png` and one `.zip` under `reports/e2e/` named after its file and its T0001's line, and its T0001 output lists the `server:` records of the requests made during that `until`; the same test passing writes nothing under `reports/e2e/`", () => {
    expect(outcome(dir, F.until, lineOf(until, "an until that runs out"), "first.json")).toBe("failed");
    const b = block(F.until, lineOf(until, "an until that runs out"));
    const mine = listedAfterFail.filter((n) => n.startsWith("until.e2e-"));
    expect(mine.filter((n) => n.endsWith(".png"))).toEqual([`until.e2e-${b.line}-1.png`]);
    expect(mine.filter((n) => n.endsWith(".zip"))).toEqual([`until.e2e-${b.line}-1.zip`]);
    expect(b.text).toMatch(/\n {2}server: .*\/api\/a\/env/);
    // the same test passing writes nothing
    expect(outcome(dir, F.until, lineOf(until, "an until that runs out"))).toBe("passed");
    expect(listedAfterPass).toEqual([]);
  });

  it("`a11y()` of a page whose text is `#777` on `#fff` rejects E1703 naming `color-contrast`", () => {
    expect(outcome(dir, F.contrast, lineOf(contrast, "a11y of low contrast text"), "first.json")).toBe("passed");
  });
});

describe("k.e2e-page warnings", () => {
  it("A page whose click handler calls `console.warn('late')` fails its test with E1738 holding `warning late` when the test does not read `problems()`, and `problems({ kind: 'warning', text: 'late' })` after the click returns `{ kind: 'warning', text: 'late' }` and the test passes.", () => {
    expect(outcome(dir, F.warned, lineOf(warned, "a warning the test never reads"), "first.json")).toBe("failed");
    const b = block(F.warned, lineOf(warned, "a warning the test never reads"));
    expect(b.text).toContain("E1738");
    expect(b.text).toContain("warning late");
    expect(outcome(dirArgs, F.warnRead, lineOf(warnRead, "a warning the test reads")), second.stdout).toBe("passed");
  });
});

describe("k.e2e-page rules and failure output", () => {
  it("E1735 a wait of a page that ran out: the T0001 message is the code and `<verb> <id>: <what was seen> after <s>s`", () => {
    const b = block(F.until, lineOf(until, "an until that runs out"));
    const first = b.text.split("\n")[0] ?? "";
    expect(first).toMatch(
      /^T0001 test\/until\.e2e\.ts:\d+:\d+ E1735 until a\.status: text was "Connecting", not "Live" after 1\.0s$/,
    );
  });

  it("a failed e2e test prints at most 10 `server:` lines, then `screenshot:` per open tab and `trace:` per context, under `reports/e2e/`", () => {
    const b = block(F.until, lineOf(until, "an until that runs out"));
    const rows = b.text.split("\n").slice(1);
    const server = rows.filter((r) => r.startsWith("  server: "));
    expect(server.length).toBeGreaterThan(0);
    expect(server.length).toBeLessThanOrEqual(10);
    expect(rows.slice(0, server.length)).toEqual(server);
    expect(rows.slice(server.length)).toEqual([
      `  screenshot: reports/e2e/until.e2e-${b.line}-1.png`,
      `  trace: reports/e2e/until.e2e-${b.line}-1.zip`,
    ]);
    // two tabs of one context: two screenshots, one trace
    const two = block(F.tabs, lineOf(tabs, "an until that runs out with two tabs"));
    const tail2 = two.text
      .split("\n")
      .slice(1)
      .filter((r) => !r.startsWith("  server: "));
    expect(tail2.filter((r) => r.startsWith("  screenshot: "))).toHaveLength(2);
    expect(tail2.filter((r) => r.startsWith("  trace: "))).toHaveLength(1);
  });
});
