// @vitest-environment node
// Spec: k.e2e-page, clause "`upload('a.file', [{ name: 'r.csv', type: 'text/csv', text: 'a,b' }])` makes the page's `change` handler read one file `r.csv` of 3 bytes, and `upload` on a button rejects E1726."
// Spec: k.e2e-page, clause "`download('a.export')` on a link to a `text/csv` answer `x,y` resolves `{ name, type: 'text/csv', bytes }` whose bytes are `x,y`."
// Spec: k.e2e-page, clause "A page whose click calls `alert('hi')` leaves `{ kind: 'dialog', text: 'hi' }` among `problems()` and the dialog dismissed; a `target=\"_blank\"` link's click makes `opened()` hold one `Page` at its path."
// Spec: k.e2e-page, clause "`find` of an id shown only inside a same-origin `<iframe>` of the page rejects E1705 `<id> is inside a frame: serve that app`."
// k.e2e-page Rules E1726 (`upload` on an element that is no file input, k.testing) and E1705 (an id shown only inside a frame) are asserted by the cases; E1735 for a `download` with no download is not asserted here (no fixture clause).
// Seed: n/a (no generated input). Method: as e2e-serve.test.ts, over fixtures/e2e/extra-pages.ts: the controls are made by a host element's code (`@keel/ui` has no element for a file input, an alert, a `target="_blank"` link or a frame, and app code may not write a lowercase element).
// Each verb is a project of its own: a verb the handle lacks is a type error (E1751) that fails that project's build alone. The cases need Chromium (e2e-support.ts); none skips.
// ASSUMED: (1) the file input's `change` handler writes `<count> <name> <bytes>` into `a.file.out` (`1 r.csv 3`); (2) the download is a link with the `download` attribute to a mapped origin whose answer is `text/csv` with `content-disposition: attachment`; the `name` the file gets is not asserted (the spec
// names none); (3) `hover` is read from a `mouseover` handler writing `hovered`; (4) `opened()` is awaited (the spec does not say whether it is sync); a popup's `location().path` is `/status`; (5) the dismissed dialog is read from the next verb resolving: the click that raised it returned and `a.hover.out` is still found.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAILURE, type Ran, cleanup, passedJob, runJobs, suite } from "./e2e-support.ts";
import { EXTRA, EXTRA_FILES } from "./fixtures/e2e/extra-pages.ts";
import { PAGES, nodeApp } from "./fixtures/e2e/node-app.ts";

const IMPORTS = ["import { answer, serve } from '@keel/testing/e2e'", "import { failure } from './failure.ts'"];
const MAP = ", origins: { connect: { 'https://api.example.com': 'files' } }";

const up = suite(IMPORTS, [
  {
    title: "upload picks a file the change handler reads and a button is E1726",
    body: `const app = await serve()
const page = await app.open('/upload')
await page.upload('a.file', [{ name: 'r.csv', type: 'text/csv', text: 'a,b' }])
expect((await page.find('a.file.out')).text).toBe('1 r.csv 3')
const e = await failure(page.upload('a.upload.btn', [{ name: 'r.csv', type: 'text/csv', text: 'a,b' }]))
expect(e.code).toBe('E1726')`,
  },
]);
const down = suite(IMPORTS, [
  {
    title: "download resolves the file of a text/csv link",
    body: `const csv = await answer(() => new Response('x,y', { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="x.csv"', 'access-control-allow-origin': '*' } }))
const app = await serve({ origins: { 'https://api.example.com': csv } })
const page = await app.open('/download')
const file = await page.download('a.export')
expect(file.type).toBe('text/csv')
expect(new TextDecoder().decode(file.bytes)).toBe('x,y')`,
  },
]);
const hov = suite(IMPORTS, [
  {
    title: "hover moves the mouse to the element",
    body: `const app = await serve()
const page = await app.open('/walls')
expect((await page.find('a.hover.out')).text).toBe('idle')
await page.hover('a.hover')
await page.until('a.hover.out', { text: 'hovered' })`,
  },
]);
const dlg = suite(IMPORTS, [
  {
    title: "an alert is a dialog problem and is dismissed",
    body: `const app = await serve()
const page = await app.open('/walls')
await page.fire('a.alert', { type: 'click' })
expect(page.problems({ kind: 'dialog', text: 'hi' })).toEqual([{ kind: 'dialog', text: 'hi' }])
expect((await page.find('a.hover.out')).text).toBe('idle')`,
  },
]);
const pop = suite(IMPORTS, [
  {
    title: "a target blank link opens a tab opened() holds",
    body: `const app = await serve()
const page = await app.open('/walls')
await page.fire('a.blank', { type: 'click' })
const tabs = await page.opened()
expect(tabs).toHaveLength(1)
expect((await tabs[0]?.location())?.path).toBe('/status')`,
  },
]);
const frame = suite(IMPORTS, [
  {
    title: "an id shown only inside a frame is E1705 naming the frame",
    body: `const app = await serve()
const page = await app.open('/framed')
const e = await failure(page.find('a.inframe'))
expect(e.code).toBe('E1705')
expect(e.message).toContain('a.inframe is inside a frame: serve that app')`,
  },
]);

const FILE = "test/verbs.e2e.ts";
let ran = new Map<string, Ran>();
beforeAll(() => {
  const support = { "test/failure.ts": FAILURE, ...EXTRA_FILES };
  const pages = Object.values(PAGES);
  const job = (key: string, extra: (typeof EXTRA)[keyof typeof EXTRA], s: { source: string }, deployable = "") => ({
    key,
    tree: { ...nodeApp([...pages, extra], [], deployable), ...support },
    file: FILE,
    source: s.source,
  });
  ran = runJobs([
    job("up", EXTRA.upload, up),
    job("down", EXTRA.download, down, MAP),
    job("hover", EXTRA.walls, hov),
    job("dialog", EXTRA.walls, dlg),
    job("opened", EXTRA.walls, pop),
    job("frame", EXTRA.framed, frame),
  ]);
}, 3_000_000);
afterAll(cleanup);

describe("k.e2e-page walls and new verbs", () => {
  it("`upload('a.file', [{ name: 'r.csv', type: 'text/csv', text: 'a,b' }])` makes the page's `change` handler read one file `r.csv` of 3 bytes, and `upload` on a button rejects E1726.", () => {
    passedJob(ran, "up", up.lines["upload picks a file the change handler reads and a button is E1726"]);
  });
  it("`download('a.export')` on a link to a `text/csv` answer `x,y` resolves `{ name, type: 'text/csv', bytes }` whose bytes are `x,y`.", () => {
    passedJob(ran, "down", down.lines["download resolves the file of a text/csv link"]);
  });
  it("A page whose click calls `alert('hi')` leaves `{ kind: 'dialog', text: 'hi' }` among `problems()` and the dialog dismissed; a `target=\"_blank\"` link's click makes `opened()` hold one `Page` at its path.", () => {
    passedJob(ran, "dialog", dlg.lines["an alert is a dialog problem and is dismissed"]);
    passedJob(ran, "opened", pop.lines["a target blank link opens a tab opened() holds"]);
  });
  it("`hover(id)`: the mouse moved to the element's centre", () => {
    passedJob(ran, "hover", hov.lines["hover moves the mouse to the element"]);
  });
  it("`find` of an id shown only inside a same-origin `<iframe>` of the page rejects E1705 `<id> is inside a frame: serve that app`.", () => {
    passedJob(ran, "frame", frame.lines["an id shown only inside a frame is E1705 naming the frame"]);
  });
});
