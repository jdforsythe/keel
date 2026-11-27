// @vitest-environment node
// Spec: k.e2e-page, clause "`fire('a.add', { type: 'click' })` on a button whose handler posts to an action resolves after the action's answer has reached the page, and `find` then shows the text the answer set."
// Spec: k.e2e-page, clause "`find('a.nope')` with `a.nope` absent from `.keel/ids.json` rejects E1705, and the browser receives no command for it."
// Spec: k.e2e-page, clause "`until('a.status', { text: 'Live' })` on an element whose text is `Connecting` for the 10 s bound rejects E1735 whose message holds `a.status`, `Connecting` and `10.0s`."
// Spec: k.e2e-page, clause "`until` with `within: 2000`, `fixed: 5000` under `KEEL_TEST_TIME_SCALE=0.5` waits 6 s before E1735."
// Spec: k.e2e-page, clause "`settle()` on a page holding an open event stream and nothing else in flight resolves."
// Spec: k.e2e-page, clause "`findAll('shop.row')` on a page with `shop.row.a`, `shop.row.b` and `shop.rows` returns `shop.row.a` and `shop.row.b`, in document order."
// Spec: k.e2e-page, clause "`open('/list', { hold: true })`, `fire('a.name', { type: 'input', value: 'Mi' })`, then `resume()` keeps the input's `value` `Mi`, its caret at 2 (a `press('x')` then makes it `Mix`) and its focus, and resolves; an island whose claim replaces the input makes `resume()` reject E1720."
// Spec: k.e2e-page, clause "After `offline(true)`, a click on a button whose handler fetches the page's origin leaves its `TypeError` among `problems()` and no entry for it in the server log; after `offline(false)` the same click is answered 200."
// Spec: k.e2e-page, clause "`cookies()` after a form POST, the page's first write, which sets the caller cookie `keel-caller` (`HttpOnly`, `SameSite=Lax`; k.user), holds its name with `httpOnly: true` and `sameSite: 'Lax'` and no value."
// Spec: k.e2e-page, clause "`documents()` of a page whose live update changed its text without a load holds one entry."
// Spec: k.e2e-page, clause "On a page whose only focusable element is `a.button`, styled `outline: 2px solid` when focused, `press('Tab')` then `style('a.button', ['outline-style', 'outline-width'])` returns `{ 'outline-style': 'solid', 'outline-width': '2px' }`."
// Spec: k.e2e-page, clause "`title()` of a page whose route's title is `Shopping list` (k.head) returns `Shopping list`, and after `navigate` to another route, that route's title."
// Spec: k.e2e-page, clause "`style(undefined, ['background-color', 'padding-top'])` on a page whose `body` is styled `background: #f9f9f9; padding-top: 4px` returns `{ 'background-color': 'rgb(249, 249, 249)', 'padding-top': '4px' }`."
// Spec: k.e2e-page, clause "On a held page whose served input `a.name` holds `Milk`, `fire('a.name', { type: 'focus' })`, `press('Home')`, `press('ArrowRight')` twice, then `resume()` resolves with the caret at 2; an island whose claim drops its `data-k-island` attribute makes `resume()` reject E1720."
// k.e2e-page Rules E1735 (a wait ran out) and E1705 (an id absent from ids.json) are asserted by the third, fourth and second cases.
// Seed: 1337 (the one property, the `findAll` prefixes). Method: as e2e-serve.test.ts: a built-app fixture (fixtures/e2e/node-app.ts), `keel test --e2e` once, the report read per case. The cases need Chromium
// (e2e-support.ts); none skips. The two time cases set `KEEL_TEST_TIME_SCALE` for the child run (1 and 0.5) whatever this run's scale is: their numbers are the clauses' own.
// ASSUMED: (1) a focus is read from `a11y('a.name')`'s `state.focused`; the caret by a `press('x')` after `resume()`: `Mix` means the caret was at 2 (from `Mi`), `Mixlk` at 2 (from `Milk`).
// (2) "a live update" is a client store transaction that changes a text with no load; "no command for it" is read as the tab's `requests()` and `documents()` being as before. A browser-side
// command count is not readable through the public API (UNTESTABLE beyond that). (3) The offline click's `TypeError`: app code may not `fetch` (E1601, E1651), so the page calls its own API through a service and
// rejects the network failure it gets back as `new TypeError(message)`: the pageerror holds `TypeError`. (4) "an island whose claim replaces the input" is a host element's code replacing it with a copy; "drops its
// `data-k-island` attribute" is a host element's code removing it from the island's root and nothing else (the spec names no other way an app makes a claim do so).
// (5) The focus ring of the outline case is the `base.focus` of the fixture's tokens.ts (k.ui Base: a 2px solid outline on `:focus-visible`), the one way app code styles a focus outline.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAILURE, type Run, SUPPORT_BOARD, cleanup, keelE2e, outcome, project, reasons, suite } from "./e2e-support.ts";
import { PAGES, nodeApp } from "./fixtures/e2e/node-app.ts";
import { fixedTime } from "@keel/tooling/test-time";

const IMPORTS = [
  "import fc from 'fast-check'",
  "import { serve } from '@keel/testing/e2e'",
  "import { board } from './board.ts'",
  "import { failure } from './failure.ts'",
];

const page = suite(IMPORTS, [
  {
    title: "fire resolves after the answer reached the page",
    body: `const app = await serve()
const page = await app.open('/')
expect((await page.find('a.count')).text).toBe('0')
await page.fire('a.add', { type: 'click' })
expect((await page.find('a.count')).text).toBe('1')
expect((await app.state(board())).lists).toHaveLength(1)`,
  },
  {
    title: "find of an absent id is E1705 and sends the browser nothing",
    body: `const app = await serve()
const page = await app.open('/')
const requests = page.requests().length
const documents = (await page.documents()).length
const e = await failure(page.find('a.nope'))
expect(e.code).toBe('E1705')
expect(page.requests().length).toBe(requests)
expect((await page.documents()).length).toBe(documents)`,
  },
  {
    title: "until of Live on Connecting is E1735 after 10.0s",
    body: `const app = await serve()
const page = await app.open('/status')
const e = await failure(page.until('a.status', { text: 'Live' }))
expect(e.code).toBe('E1735')
expect(e.message).toContain('a.status')
expect(e.message).toContain('Connecting')
expect(e.message).toContain('10.0s')`,
  },
  {
    title: "settle resolves on a page with an open event stream",
    body: `const app = await serve()
const page = await app.open('/stream')
await page.fire('a.stream.open', { type: 'click' })
await page.settle()
expect(page.requests().some((r) => r.url.includes('/api/a/ticks'))).toBe(true)`,
  },
  {
    title: "findAll returns the ids under the prefix in document order",
    body: `const app = await serve()
const page = await app.open('/rows')
expect((await page.findAll('shop.row')).map((f) => f.id)).toEqual(['shop.row.a', 'shop.row.b'])
const ids = ['shop.row.a', 'shop.rows', 'shop.row.b']
await fc.assert(
  fc.asyncProperty(fc.constantFrom('shop', 'shop.row', 'shop.rows', 'shop.ro', 'shop.row.a', 'nope'), async (prefix) => {
    const found = (await page.findAll(prefix)).map((f) => f.id)
    expect(found).toEqual(ids.filter((id) => id.startsWith(prefix + '.')))
  }),
  { seed: 1337, numRuns: 12 },
)`,
  },
  {
    title: "a held page keeps value caret and focus over resume, a replacing claim is E1720",
    body: `const app = await serve()
const held = await app.open('/list', { hold: true })
await held.fire('a.name', { type: 'input', value: 'Mi' })
await held.resume()
expect((await held.find('a.name')).value).toBe('Mi')
expect((await held.a11y('a.name')).state.focused).toBe(true)
await held.press('x')
expect((await held.find('a.name')).value).toBe('Mix')
const replaced = await app.open('/replace', { hold: true })
const e = await failure(replaced.resume())
expect(e.code).toBe('E1720')`,
  },
  {
    title: "offline leaves a TypeError in problems and nothing in the server log",
    body: `const app = await serve()
const page = await app.open('/offline')
const gets = () => app.serverLog().filter((r) => r.kind === 'req' && r.path === '/api/a/env')
await page.offline(true)
await page.fire('a.offline.go', { type: 'click' })
const taken = page.problems({ kind: 'pageerror', text: 'TypeError' }, { kind: 'console', text: 'ERR_INTERNET_DISCONNECTED' })
expect(taken.some((p) => p.text.includes('TypeError'))).toBe(true)
expect(gets()).toHaveLength(0)
await page.offline(false)
await page.fire('a.offline.go', { type: 'click' })
expect(gets().map((r) => (r.kind === 'req' ? r.status : 0))).toEqual([200])
expect(page.problems()).toEqual([])`,
  },
  {
    title: "cookies holds the caller cookie of a form POST with its flags and no value",
    body: `const app = await serve()
const page = await app.open('/')
await page.fire('a.add', { type: 'click' })
const cookie = (await page.cookies()).find((c) => c.name === 'keel-caller')
expect(cookie?.httpOnly).toBe(true)
expect(cookie?.sameSite).toBe('Lax')
expect(Object.keys(cookie ?? {})).not.toContain('value')`,
  },
  {
    title: "documents holds one entry after a live update",
    body: `const app = await serve()
const page = await app.open('/live')
await page.fire('a.live.go', { type: 'click' })
await page.until('a.live.text', { text: 'after' })
expect(await page.documents()).toHaveLength(1)`,
  },
  {
    title: "Tab then style gives the outline",
    body: `const app = await serve()
const page = await app.open('/focus')
await page.press('Tab')
expect(await page.style('a.button', ['outline-style', 'outline-width'])).toEqual({ 'outline-style': 'solid', 'outline-width': '2px' })`,
  },
  {
    title: "a caret placed by press on a held page survives resume, a claim dropping data-k-island is E1720",
    body: `const app = await serve()
const held = await app.open('/list', { hold: true })
await held.fire('a.name', { type: 'focus' })
await held.press('Home')
await held.press('ArrowRight')
await held.press('ArrowRight')
await held.resume()
await held.press('x')
expect((await held.find('a.name')).value).toBe('Mixlk')
const dropped = await app.open('/drop', { hold: true })
const e = await failure(dropped.resume())
expect(e.code).toBe('E1720')`,
  },
]);

const titled = suite(IMPORTS, [
  {
    title: "title is the route title, and the other route title after navigate",
    body: `const app = await serve()
const page = await app.open('/shopping')
expect(await page.title()).toBe('Shopping list')
await page.navigate('/other')
expect(await page.title()).toBe('Other list')`,
  },
]);

const styled = suite(IMPORTS, [
  {
    title: "style of undefined reads the body",
    body: `const app = await serve()
const page = await app.open('/status')
expect(await page.style(undefined, ['background-color', 'padding-top'])).toEqual({ 'background-color': 'rgb(249, 249, 249)', 'padding-top': '4px' })`,
  },
]);

const scaled = suite(IMPORTS, [
  {
    title: "until with within and fixed waits 6 s under scale 0.5",
    body: `const app = await serve()
const page = await app.open('/status')
const started = process.hrtime.bigint()
const e = await failure(page.until('a.status', { text: 'Live' }, { within: 2000, fixed: 5000 }))
const waited = Number((process.hrtime.bigint() - started) / 1_000_000n)
expect(e.code).toBe('E1735')
expect(e.message).toContain('after 6.0s')
expect(waited).toBeGreaterThanOrEqual(5900)
expect(waited).toBeLessThan(9000)`,
  },
]);

const FILE = "test/page.e2e.ts";
const SCALED = "test/scaled.e2e.ts";
const TITLED = "test/titled.e2e.ts";
const STYLED = "test/styled.e2e.ts";
let styledDir = "";
let titledDir = "";
let dir = "";
let scaledDir = "";
const runs = new Map<string, Run>();

beforeAll(() => {
  const tree = {
    ...nodeApp(Object.values(PAGES)),
    "test/board.ts": SUPPORT_BOARD,
    "test/failure.ts": FAILURE,
  };
  dir = project({ ...tree, [FILE]: page.source });
  scaledDir = project({ ...tree, [SCALED]: scaled.source });
  titledDir = project({ ...tree, [TITLED]: titled.source });
  styledDir = project({ ...tree, [STYLED]: styled.source });
  runs.set("page", keelE2e(dir, [], { env: { KEEL_TEST_TIME_SCALE: "1" } }));
  runs.set("scaled", keelE2e(scaledDir, [], { env: { KEEL_TEST_TIME_SCALE: "0.5" } }));
  // `title()` is a verb of its own project: a case on a verb the handle lacks is a type error (E1751) that fails its build, and no other case with it.
  runs.set("titled", keelE2e(titledDir, [], { env: { KEEL_TEST_TIME_SCALE: "1" } }));
  // `style(undefined, names)` likewise: its id parameter is typed `string` until the body form is built.
  runs.set("styled", keelE2e(styledDir, [], { env: { KEEL_TEST_TIME_SCALE: "1" } }));
}, fixedTime(3_000_000));
afterAll(cleanup);

const ok = (title: string): void => {
  const line = page.lines[title];
  expect(line, "the fixture test exists").toBeDefined();
  const r = runs.get("page");
  expect(outcome(dir, FILE, line ?? 0), reasons(r)).toBe("passed");
};

describe("k.e2e-page verbs and waits", () => {
  it("`fire('a.add', { type: 'click' })` on a button whose handler posts to an action resolves after the action's answer has reached the page, and `find` then shows the text the answer set", () => {
    ok("fire resolves after the answer reached the page");
  });

  it("`find('a.nope')` with `a.nope` absent from `.keel/ids.json` rejects E1705, and the browser receives no command for it", () => {
    ok("find of an absent id is E1705 and sends the browser nothing");
  });

  it("`until('a.status', { text: 'Live' })` on an element whose text is `Connecting` for the 10 s bound rejects E1735 whose message holds `a.status`, `Connecting` and `10.0s`", () => {
    ok("until of Live on Connecting is E1735 after 10.0s");
  });

  it("`until` with `within: 2000`, `fixed: 5000` under `KEEL_TEST_TIME_SCALE=0.5` waits 6 s before E1735", () => {
    const line = scaled.lines["until with within and fixed waits 6 s under scale 0.5"];
    const r = runs.get("scaled");
    expect(outcome(scaledDir, SCALED, line ?? 0), reasons(r)).toBe("passed");
  });

  it("`settle()` on a page holding an open event stream and nothing else in flight resolves", () => {
    ok("settle resolves on a page with an open event stream");
  });

  it("`findAll('shop.row')` on a page with `shop.row.a`, `shop.row.b` and `shop.rows` returns `shop.row.a` and `shop.row.b`, in document order", () => {
    ok("findAll returns the ids under the prefix in document order");
  });

  it("`open('/list', { hold: true })`, `fire('a.name', { type: 'input', value: 'Mi' })`, then `resume()` keeps the input's `value` `Mi`, its caret at 2 (a `press('x')` then makes it `Mix`) and its focus, and resolves; an island whose claim replaces the input makes `resume()` reject E1720", () => {
    ok("a held page keeps value caret and focus over resume, a replacing claim is E1720");
  });

  it("After `offline(true)`, a click on a button whose handler fetches the page's origin leaves its `TypeError` among `problems()` and no entry for it in the server log; after `offline(false)` the same click is answered 200", () => {
    ok("offline leaves a TypeError in problems and nothing in the server log");
  });

  it("`cookies()` after a form POST, the page's first write, which sets the caller cookie `keel-caller` (`HttpOnly`, `SameSite=Lax`; k.user), holds its name with `httpOnly: true` and `sameSite: 'Lax'` and no value", () => {
    ok("cookies holds the caller cookie of a form POST with its flags and no value");
  });

  it("`documents()` of a page whose live update changed its text without a load holds one entry", () => {
    ok("documents holds one entry after a live update");
  });

  it("On a page whose only focusable element is `a.button`, styled `outline: 2px solid` when focused, `press('Tab')` then `style('a.button', ['outline-style', 'outline-width'])` returns `{ 'outline-style': 'solid', 'outline-width': '2px' }`", () => {
    ok("Tab then style gives the outline");
  });

  it("`title()` of a page whose route's title is `Shopping list` (k.head) returns `Shopping list`, and after `navigate` to another route, that route's title", () => {
    const line = titled.lines["title is the route title, and the other route title after navigate"];
    const r = runs.get("titled");
    expect(outcome(titledDir, TITLED, line ?? 0), reasons(r)).toBe("passed");
  });

  it("`style(undefined, ['background-color', 'padding-top'])` on a page whose `body` is styled `background: #f9f9f9; padding-top: 4px` returns `{ 'background-color': 'rgb(249, 249, 249)', 'padding-top': '4px' }`", () => {
    const line = styled.lines["style of undefined reads the body"];
    const r = runs.get("styled");
    expect(outcome(styledDir, STYLED, line ?? 0), reasons(r)).toBe("passed");
  });

  it("On a held page whose served input `a.name` holds `Milk`, `fire('a.name', { type: 'focus' })`, `press('Home')`, `press('ArrowRight')` twice, then `resume()` resolves with the caret at 2; an island whose claim drops its `data-k-island` attribute makes `resume()` reject E1720", () => {
    ok("a caret placed by press on a held page survives resume, a claim dropping data-k-island is E1720");
  });
});
