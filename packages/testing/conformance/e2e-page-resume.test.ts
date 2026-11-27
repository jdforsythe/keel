// @vitest-environment node
// Spec: k.e2e-page, clause "On a held page whose island `recipes.list` holds three served `li` elements without ids, a claim that removes the third makes `resume()` reject E1720 naming `li 3 under recipes.list`, and a claim that adds an element under an island root rejects E1720."
// Spec: k.e2e-page, clause "`resume({ grows: ['app.events'] })` resolves when the claim appends elements inside `app.events`, and rejects E1720 when it removes one there or adds one outside it."
// k.e2e-page Rules: E1720 (k.testing) is the code of each rejection; E1705 for an id of `grows` not on the page is asserted by the second case.
// Seed: n/a (no generated input). Method: as e2e-serve.test.ts, over fixtures/e2e/extra-pages.ts: each page is an island whose host element's code, run by the claim, removes, adds or appends. The cases need Chromium (e2e-support.ts); none skips.
// `GROW` pages share the id `app.events` (E1404 otherwise), so each of them is a project of its own, as is every feature the handle may lack.
// ASSUMED: (1) a host element's `mount` runs during the claim; (2) the list ids `recipes.list` and `app.events` are on the served `ul`, and the island root is the page's own root, so "li 3 under recipes.list" depends on how the builder names that
// island: the case asserts `li 3 under ` and E1720 and leaves the island's name unasserted (AMBIGUOUS: the spec names no way a fixture names an island); (3) the elements under `app.events` are `li`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAILURE, type Ran, cleanup, passedJob, runJobs, suite } from "./e2e-support.ts";
import { EXTRA, EXTRA_FILES, GROW } from "./fixtures/e2e/extra-pages.ts";
import { PAGES, type Page, nodeApp } from "./fixtures/e2e/node-app.ts";
import { fixedTime } from "@keel/tooling/test-time";

const IMPORTS = ["import { serve } from '@keel/testing/e2e'", "import { failure } from './failure.ts'"];

const lost = suite(IMPORTS, [
  {
    title: "a claim that removes an element without an id and one that adds an element are E1720",
    body: `const app = await serve()
const removed = await app.open('/lremove', { hold: true })
const r = await failure(removed.resume())
expect(r.code).toBe('E1720')
expect(r.message).toContain('li 3 under ')
const added = await app.open('/ladd', { hold: true })
const a = await failure(added.resume())
expect(a.code).toBe('E1720')`,
  },
]);
const grows = suite(IMPORTS, [
  {
    title: "an addition inside a grows id is allowed and one outside any is not",
    body: `const app = await serve()
const plain = await app.open('/grow', { hold: true })
expect((await failure(plain.resume())).code).toBe('E1720')
const named = await app.open('/grow', { hold: true })
await named.resume({ grows: ['app.events'] })
const unknown = await app.open('/grow', { hold: true })
expect((await failure(unknown.resume({ grows: ['app.nope'] }))).code).toBe('E1705')`,
  },
]);
const cut = suite(IMPORTS, [
  {
    title: "a removal inside a grows id is still E1720",
    body: `const app = await serve()
const page = await app.open('/growcut', { hold: true })
const e = await failure(page.resume({ grows: ['app.events'] }))
expect(e.code).toBe('E1720')`,
  },
]);
const outside = suite(IMPORTS, [
  {
    title: "an addition outside the grows id is E1720 even when another is inside it",
    body: `const app = await serve()
const page = await app.open('/growout', { hold: true })
const e = await failure(page.resume({ grows: ['app.events'] }))
expect(e.code).toBe('E1720')`,
  },
]);

const FILE = "test/resume.e2e.ts";
let ran = new Map<string, Ran>();
beforeAll(() => {
  const support = { "test/failure.ts": FAILURE, ...EXTRA_FILES };
  const pages = Object.values(PAGES);
  const job = (key: string, extra: readonly Page[], s: { source: string }) => ({
    key,
    tree: { ...nodeApp([...pages, ...extra]), ...support },
    file: FILE,
    source: s.source,
  });
  ran = runJobs([
    job("lost", [EXTRA.lremove, EXTRA.ladd], lost),
    job("grows", [GROW.grow], grows),
    job("cut", [GROW.growcut], cut),
    job("outside", [GROW.growout], outside),
  ]);
}, fixedTime(3_000_000));
afterAll(cleanup);

describe("k.e2e-page resume claims", () => {
  it("On a held page whose island `recipes.list` holds three served `li` elements without ids, a claim that removes the third makes `resume()` reject E1720 naming `li 3 under recipes.list`, and a claim that adds an element under an island root rejects E1720.", () => {
    passedJob(
      ran,
      "lost",
      lost.lines["a claim that removes an element without an id and one that adds an element are E1720"],
    );
  });

  it("`resume({ grows: ['app.events'] })` resolves when the claim appends elements inside `app.events`, and rejects E1720 when it removes one there or adds one outside it.", () => {
    passedJob(ran, "grows", grows.lines["an addition inside a grows id is allowed and one outside any is not"]);
    passedJob(ran, "cut", cut.lines["a removal inside a grows id is still E1720"]);
    passedJob(
      ran,
      "outside",
      outside.lines["an addition outside the grows id is E1720 even when another is inside it"],
    );
  });
});
