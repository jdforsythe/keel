// @vitest-environment node
// Spec: k.e2e-page, clause "A test whose page throws `new Error('boom')` in a click handler, and that never calls `problems()`, fails with E1738 holding `boom`; calling `problems()` after the click returns it, and the test passes."
// Spec: k.e2e-page, clause "A test that fails at `until` writes one `.png` and one `.zip` under `reports/e2e/` named after its file and line, and its T0001 output lists the `server:` records of the requests made during that `until`; the same test passing writes nothing under `reports/e2e/`."
// Spec: k.e2e-page, clause "`a11y()` of a page whose text is `#777` on `#fff` rejects E1703 naming `color-contrast`."
// k.e2e-page Rules E1735 (`<verb> <id>: <what was seen> after <s>s`) and E1738 (a browser problem the test did not read), and the Failure output paragraph (T0001 at the test's line, at most 10 `server:` lines,
// then `screenshot:` per open tab and `trace:` per context, `<file>-<line>-<n>`), are asserted by the cases after the three clauses.
// Seed: n/a (no generated input). Method: as e2e-serve.test.ts: fixtures/e2e/node-app.ts, `keel test --e2e` in compact format (the failure output is read as text), the report and `reports/e2e/` read per case.
// The cases need Chromium (e2e-support.ts); none skips. The child run's `KEEL_TEST_TIME_SCALE` is 1 so `1.0s` below is the bound the test names.
// ASSUMED: (1) "page throws `new Error('boom')`": app code may not `throw` (E1451), so the click handler rejects a promise with it, an unhandled rejection the browser reports as a `pageerror`; (2) `<file>` is the test file's name
// without `.ts` (the RFC's `checkout.e2e-24-1.png`) and `<line>` is the line of the T0001 (the failing verb's), not the `it`'s: the cases read the line off the T0001, so either reading of "the test's line" passes only when it is the
// T0001's own; (3) "the requests made during that `until`" is a request the test sends while the `until` waits, so it is started right after the verb's call; (4) `E1703` names `color-contrast` in its message.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Run, cleanup, failureOf, keelE2e, listing, outcome, project, suite } from "./e2e-support.ts";
import { PAGES, nodeApp } from "./fixtures/e2e/node-app.ts";
import { rmSync } from "node:fs";
import { join } from "node:path";

const FAILURE = `const failure = async (p: Promise<unknown>): Promise<{ code: unknown; message: string }> => {
  const e: unknown = await p.then(() => undefined, (x: unknown) => x)
  return { code: Reflect.get(Object(e), 'code'), message: String(Reflect.get(Object(e), 'message')) }
}`;
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
const read = suite(
  [SERVE],
  [
    {
      title: "a boom the test reads",
      body: `const app = await serve()
const page = await app.open('/boom')
await page.fire('a.boom.go', { type: 'click' })
const problems = page.problems()
expect(problems.some((p) => p.text.includes('boom'))).toBe(true)
expect(page.problems()).toEqual([])`,
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
  [SERVE, FAILURE],
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
  read: "test/read.e2e.ts",
  until: "test/until.e2e.ts",
  tabs: "test/tabs.e2e.ts",
  contrast: "test/contrast.e2e.ts",
} as const;
let dir = "";
let failing: Run = { status: null, stdout: "", stderr: "" };
let passing: Run = { status: null, stdout: "", stderr: "" };
let listedAfterPass: string[] = [];
let listedAfterFail: string[] = [];

beforeAll(() => {
  dir = project({
    ...nodeApp(Object.values(PAGES)),
    [F.boom]: boom.source,
    [F.read]: read.source,
    [F.until]: until.source,
    [F.tabs]: tabs.source,
    [F.contrast]: contrast.source,
  });
  failing = keelE2e(dir, [], { env: { KEEL_TEST_TIME_SCALE: "1" } });
  listedAfterFail = listing(dir, "reports/e2e");
  rmSync(join(dir, "reports/e2e"), { recursive: true, force: true });
  passing = keelE2e(dir, [F.until], { env: { KEEL_TEST_TIME_SCALE: "1", E2E_PASS: "1" } });
  listedAfterPass = listing(dir, "reports/e2e");
}, 3_000_000);
afterAll(cleanup);

const tail = (r: Run): string => `${r.stdout}\n${r.stderr}`.slice(-3000);
const lineOf = (s: { lines: Record<string, number> }, title: string): number => s.lines[title] ?? 0;
/** The T0001 block of the test at `title` of `file` in the failing run, wherever on its lines the failing verb is. */
function block(file: string, line: number): { text: string; line: number } {
  const rows = failing.stdout.split("\n");
  const at = rows.findIndex((r) => r.startsWith(`T0001 ${file}:`));
  expect(at, `a T0001 in ${file}\n${tail(failing)}`).toBeGreaterThanOrEqual(0);
  const head = rows[at] ?? "";
  const reported = Number(/^T0001 [^:]+:(\d+):/.exec(head)?.[1]);
  expect(reported, head).toBeGreaterThanOrEqual(line);
  return { text: failureOf(failing.stdout, file, reported) ?? "", line: reported };
}

describe("k.e2e-page failure output and problems", () => {
  it("A test whose page throws `new Error('boom')` in a click handler, and that never calls `problems()`, fails with E1738 holding `boom`; calling `problems()` after the click returns it, and the test passes", () => {
    expect(outcome(dir, F.boom, lineOf(boom, "a boom the test never reads")), tail(failing)).toBe("failed");
    const b = block(F.boom, lineOf(boom, "a boom the test never reads"));
    expect(b.text).toContain("E1738");
    expect(b.text).toContain("boom");
    expect(outcome(dir, F.read, lineOf(read, "a boom the test reads")), tail(failing)).toBe("passed");
  });

  it("A test that fails at `until` writes one `.png` and one `.zip` under `reports/e2e/` named after its file and line, and its T0001 output lists the `server:` records of the requests made during that `until`; the same test passing writes nothing under `reports/e2e/`", () => {
    expect(outcome(dir, F.until, lineOf(until, "an until that runs out")), tail(failing)).toBe("failed");
    const b = block(F.until, lineOf(until, "an until that runs out"));
    const mine = listedAfterFail.filter((n) => n.startsWith("until.e2e-"));
    expect(mine.filter((n) => n.endsWith(".png"))).toEqual([`until.e2e-${b.line}-1.png`]);
    expect(mine.filter((n) => n.endsWith(".zip"))).toEqual([`until.e2e-${b.line}-1.zip`]);
    expect(b.text).toMatch(/\n {2}server: .*\/api\/a\/env/);
    // the same test passing writes nothing
    expect(outcome(dir, F.until, lineOf(until, "an until that runs out")), tail(passing)).toBe("passed");
    expect(listedAfterPass).toEqual([]);
  });

  it("`a11y()` of a page whose text is `#777` on `#fff` rejects E1703 naming `color-contrast`", () => {
    expect(outcome(dir, F.contrast, lineOf(contrast, "a11y of low contrast text")), tail(failing)).toBe("passed");
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
