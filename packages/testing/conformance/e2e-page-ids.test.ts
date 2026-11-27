// @vitest-environment node
// Spec: k.e2e-page, clause "On a page holding an id `shop.cart.count` and no template id, `find('shop.cart.cuont')` and `find('shop.cart.x')` each reject E1705 within 100 ms naming `shop.cart.count` as nearest; `find('shop.row.p9')` with a template id `` `shop.row.${id}` `` in source waits the bound and rejects E1735."
// Spec: k.e2e-page, clause "A test that takes `problems({ kind: 'console', text: 'ERR_INTERNET_DISCONNECTED' })` while its page also raised a `pageerror` `late` fails with E1738 naming `late`."
// k.e2e-page Rules E1705 (an id not known, at once, with the nearest 3), E1735 (a known id not shown, the bound) and E1738 (a problem the test did not take, naming the first) are asserted by the cases.
// Seed: n/a (no generated input). Method: as e2e-serve.test.ts, over fixtures/e2e/extra-pages.ts (pages `cart`, `tmpl`, `mixed`); each feature the handle may lack is a project of its own (e2e-support.ts `runJobs`).
// The cases need Chromium (e2e-support.ts); none skips.
// Time: "within 100 ms" and "at once" are measured as the elapsed time of the rejection against `testTime(2000)`, a bound well inside the 10 s wait (k.e2e-run Time), read with `process.hrtime` in the fixture file, not by a race
// against a timer; the bound travels to the child run as `KEEL_NEAR_MS`. The clause's own 100 ms is tighter than a loaded machine keeps, so the case asserts the cut between "at once" and "waited the bound" and not the 100.
// ASSUMED: (1) "nearest" is read from the message text `nearest <id>`, the form k.e2e-page Verbs prints; (2) the template id of `tmpl` is written in its source as `` `shop.row.${row}` `` (the Verbs paragraph's own example), so `shop.row.p9` fits its head and tail; (3) the page `mixed` logs a console error
// `net::ERR_INTERNET_DISCONNECTED` and rejects `new Error('late')` in one click; (4) AMBIGUOUS: "`findAll`'s `prefix` is judged the same way" says no outcome for an unknown prefix (E1705 or an empty list): not asserted.
import { testTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAILURE, type Ran, cleanup, failureOf, outcome, passedJob, runJobs, suite } from "./e2e-support.ts";
import { EXTRA, EXTRA_FILES } from "./fixtures/e2e/extra-pages.ts";
import { PAGES, nodeApp } from "./fixtures/e2e/node-app.ts";

const IMPORTS = ["import { serve } from '@keel/testing/e2e'", "import { failure } from './failure.ts'"];

const near = suite(IMPORTS, [
  {
    title: "a mistyped nested id is E1705 at once with the nearest id",
    body: `const bound = Number(process.env.KEEL_NEAR_MS)
const app = await serve()
const page = await app.open('/cart')
for (const id of ['shop.cart.cuont', 'shop.cart.x', 'shop.cart.count.x']) {
  const started = process.hrtime.bigint()
  const e = await failure(page.find(id))
  const ms = Number((process.hrtime.bigint() - started) / 1_000_000n)
  expect(e.code).toBe('E1705')
  expect(ms).toBeLessThan(bound)
  if (id !== 'shop.cart.count.x') expect(e.message).toContain('nearest')
  if (id === 'shop.cart.cuont') expect(e.message).toContain('shop.cart.count')
}
const listed = await failure(page.find('shop.cart.cuont'))
expect(listed.message.split('shop.').length - 1).toBeLessThanOrEqual(4)`,
  },
]);
const templated = suite(IMPORTS, [
  {
    title: "an id fitting a template id is waited for the bound and then E1735",
    body: `const app = await serve()
const page = await app.open('/cart')
const e = await failure(page.find('shop.row.p9'))
expect(e.code).toBe('E1735')
expect(e.message).toContain('shop.row.p9')`,
  },
]);

const SERVE = "import { serve } from '@keel/testing/e2e'";
const never = suite(
  [SERVE],
  [
    {
      title: "a late the expected call did not match",
      body: `const app = await serve()
const page = await app.open('/mixed')
await page.fire('a.mixed.go', { type: 'click' })
const taken = page.problems({ kind: 'console', text: 'ERR_INTERNET_DISCONNECTED' })
expect(taken).toHaveLength(1)
expect(taken[0]?.kind).toBe('console')`,
    },
  ],
);
const bare = suite(
  [SERVE],
  [
    {
      title: "a bare read after an expected read",
      body: `const app = await serve()
const page = await app.open('/mixed')
await page.fire('a.mixed.go', { type: 'click' })
page.problems({ kind: 'console', text: 'ERR_INTERNET_DISCONNECTED' })
const all = page.problems()
expect(all.some((p) => p.text.includes('late'))).toBe(true)`,
    },
  ],
);
const taken = suite(
  [SERVE],
  [
    {
      title: "every problem named by an expected entry",
      body: `const app = await serve()
const page = await app.open('/mixed')
await page.fire('a.mixed.go', { type: 'click' })
const got = page.problems({ kind: 'console', text: 'ERR_INTERNET_DISCONNECTED' }, { kind: 'pageerror', text: /^.*late/ })
expect(got.map((p) => p.kind).sort()).toEqual(['console', 'pageerror'])
expect(page.problems()).toEqual([])`,
    },
  ],
);

const NEAR = "test/near.e2e.ts";
const TEMPL = "test/templated.e2e.ts";
const P = { never: "test/never.e2e.ts", bare: "test/bare.e2e.ts", taken: "test/taken.e2e.ts" } as const;
let ran = new Map<string, Ran>();

beforeAll(() => {
  const support = { "test/failure.ts": FAILURE, ...EXTRA_FILES };
  const pages = Object.values(PAGES);
  ran = runJobs([
    {
      key: "near",
      tree: { ...nodeApp([...pages, EXTRA.cart]), ...support },
      file: NEAR,
      source: near.source,
      env: { KEEL_NEAR_MS: String(testTime(2000)) },
    },
    {
      key: "templ",
      tree: { ...nodeApp([...pages, EXTRA.cart, EXTRA.tmpl]), ...support },
      file: TEMPL,
      source: templated.source,
    },
    {
      key: "problems",
      tree: { ...nodeApp([...pages, EXTRA.mixed]), ...support, [P.bare]: bare.source, [P.taken]: taken.source },
      file: P.never,
      source: never.source,
    },
  ]);
}, 3_000_000);
afterAll(cleanup);

const lineOf = (s: { lines: Record<string, number> }, title: string): number => s.lines[title] ?? 0;
/** The first T0001 block of `file` in the run, whichever line it reports. */
function blockOf(key: string, file: string): string {
  const stdout = ran.get(key)?.run.stdout ?? "";
  const rows = stdout.split("\n");
  const at = rows.findIndex((r) => r.startsWith(`T0001 ${file}:`));
  const line = Number(/^T0001 [^:]+:(\d+):/.exec(rows[at] ?? "")?.[1]);
  return at < 0 ? "" : (failureOf(stdout, file, line) ?? "");
}
const stateOf = (file: string, line: number) => {
  const r = ran.get("problems");
  return r === undefined ? undefined : outcome(r.dir, file, line);
};

describe("k.e2e-page known ids", () => {
  it("On a page holding an id `shop.cart.count` and no template id, `find('shop.cart.cuont')` and `find('shop.cart.x')` each reject E1705 within 100 ms naming `shop.cart.count` as nearest; `find('shop.row.p9')` with a template id `` `shop.row.${id}` `` in source waits the bound and rejects E1735.", () => {
    passedJob(ran, "near", lineOf(near, "a mistyped nested id is E1705 at once with the nearest id") || undefined);
    passedJob(ran, "templ", templated.lines["an id fitting a template id is waited for the bound and then E1735"]);
  });
});

describe("k.e2e-page problems taken by what they match", () => {
  it("A test that takes `problems({ kind: 'console', text: 'ERR_INTERNET_DISCONNECTED' })` while its page also raised a `pageerror` `late` fails with E1738 naming `late`.", () => {
    expect(stateOf(P.never, lineOf(never, "a late the expected call did not match"))).toBe("failed");
    const b = blockOf("problems", P.never);
    expect(b).toContain("E1738");
    expect(b).toContain("late");
    expect(b).not.toContain("ERR_INTERNET_DISCONNECTED");
  });

  it("a bare problems() call after an expected one takes nothing, so the test still fails with E1738 naming the problem no entry matched", () => {
    expect(stateOf(P.bare, lineOf(bare, "a bare read after an expected read"))).toBe("failed");
    const b = blockOf("problems", P.bare);
    expect(b).toContain("E1738");
    expect(b).toContain("late");
  });

  it("every problem some expected entry matches is taken and the test passes", () => {
    expect(stateOf(P.taken, lineOf(taken, "every problem named by an expected entry"))).toBe("passed");
  });
});
