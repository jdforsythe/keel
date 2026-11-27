// @vitest-environment node
// Spec: k.e2e, clause "Two files of one library calling `serve({ page: 'src/Card.ts' })` at once each serve their page, and after both end no `.keel/e2e-host-*` folder is left."
// Spec: k.e2e, clause "`serve({ page: 'src/Card.ts', wrap: 'test/Frame.ts' })` serves `Card` inside `Frame`'s `children`, and with `tokens: 'test/dark.ts'` the page's `style` reads the colours that file gives."
// Spec: k.e2e, clause "`serve({ page: '../other/src/Card.ts' })` and `serve({ page: 'test/Card.ts' })` in a library's folder reject E1736 naming the path."
// k.e2e Rules E1736 (a `page`, `wrap` or `tokens` path outside its folder) is asserted by the third clause's cases, which also read the path a second way (`wrap` and `tokens` outside `test/`).
// Seed: n/a (no generated input). Method: as e2e-library.test.ts (the library folder of e2e-library-support.ts) run under `keel test --e2e`; the cases need Chromium (e2e-support.ts); none skips.
// A job of its own holds each feature a handle may lack (`wrap`, `tokens`): an option the handle does not type is a type error (E1751) that fails its project's build and no other.
// ASSUMED: (1) `wrap` is a file under `test/` whose default export is a function of `{ children }`, `children` a `Box`'s `children` value; `tokens` is a file under `test/` exporting `tokens` from `defineTokens`, as `tokens.ts` does.
// (2) "serve their page" at once is shown by both files holding their own `.keel/e2e-host-<random>/` at one moment (each waits, by `settle()` frames, for the other's marker file, counts, then marks that it has counted and waits for the other's count mark before ending, so neither disposes before the other has counted); `keel test --e2e` runs at most 2 files at once (k.e2e Files).
// (3) "naming the path" is the message holding the path as written. (4) The Frame's id is `frame`; "inside" is read from `a11y('frame')`'s tree holding `card.title`.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { library } from "./e2e-library-support.ts";
import { type Ran, cleanup, outcome, passedJob, reasons, runJobs, suite } from "./e2e-support.ts";
import type { Tree } from "./fixtures/e2e/node-app.ts";
import { fixedTime } from "@keel/tooling/test-time";

const IMPORTS = [
  "import { existsSync, readdirSync, writeFileSync } from 'node:fs'",
  "import { serve } from '@keel/testing/e2e'",
  "import { failure } from './failure.ts'",
];
const hostsOf = "readdirSync('.keel').filter((n) => /^e2e-host-/.test(n))";

const FRAME =
  'import { Box, type Children } from "@keel/ui";\n\nexport default function Frame(props: { children: Children }) {\n  return Box({ as: "main", id: "frame", children: props.children });\n}\n';
const DARK =
  'import { defineTokens } from "@keel/ui";\n\nexport const tokens = defineTokens({\n  color: { ink: "#eeeeee", low: "#777777", white: "#ffffff", page: "#101010" },\n  space: { 1: "4px" },\n  base: { page: { bg: "page", fg: "ink", p: "1" }, focus: "ink" },\n});\n';
const OTHER = 'export { default } from "../src/Card.ts";\n';
const extra: Tree = { "test/Frame.ts": FRAME, "test/dark.ts": DARK, "test/Card.ts": OTHER };

// Two files at once: each serves its own page, waits (in frames) for the other's marker, and counts the host folders then.
const bothA = suite(IMPORTS, [
  {
    title: "file A serves its page while file B serves its own",
    body: `const app = await serve({ page: 'src/Card.ts', props: { id: 'card', title: 'A' } })
const page = await app.open('/')
expect((await page.find('card.title')).text).toBe('A')
writeFileSync('.keel/mark-A', '1')
for (let i = 0; i < 1200 && !existsSync('.keel/mark-B'); i++) await page.settle()
expect(existsSync('.keel/mark-B')).toBe(true)
const seen = ${hostsOf}
expect(new Set(seen).size).toBeGreaterThanOrEqual(2)
writeFileSync('.keel/seen-A', '1')
for (let i = 0; i < 1200 && !existsSync('.keel/seen-B'); i++) await page.settle()
expect(existsSync('.keel/seen-B')).toBe(true)
expect((await page.find('card.title')).text).toBe('A')`,
  },
]);
const bothB = suite(IMPORTS, [
  {
    title: "file B serves its page while file A serves its own",
    body: `const app = await serve({ page: 'src/Card.ts', props: { id: 'card', title: 'B' } })
const page = await app.open('/')
expect((await page.find('card.title')).text).toBe('B')
writeFileSync('.keel/mark-B', '1')
for (let i = 0; i < 1200 && !existsSync('.keel/mark-A'); i++) await page.settle()
expect(existsSync('.keel/mark-A')).toBe(true)
const seen = ${hostsOf}
expect(new Set(seen).size).toBeGreaterThanOrEqual(2)
writeFileSync('.keel/seen-B', '1')
for (let i = 0; i < 1200 && !existsSync('.keel/seen-A'); i++) await page.settle()
expect(existsSync('.keel/seen-A')).toBe(true)
expect((await page.find('card.title')).text).toBe('B')`,
  },
]);

const wrapped = suite(IMPORTS, [
  {
    title: "wrap renders the page inside the frame",
    body: `const app = await serve({ page: 'src/Card.ts', props: { id: 'card', title: 'Hi' }, wrap: 'test/Frame.ts' })
const page = await app.open('/')
expect((await page.find('frame')).role).not.toBe('')
expect(JSON.stringify(await page.a11y('frame'))).toContain('card.title')
expect((await page.find('card.title')).text).toBe('Hi')`,
  },
]);
const tokened = suite(IMPORTS, [
  {
    title: "tokens give the page the colours of that file",
    body: `const plain = await serve({ page: 'src/Card.ts', props: { id: 'card', title: 'Hi' } })
const before = await (await plain.open('/')).style(undefined, ['background-color'])
expect(before['background-color']).not.toBe('rgb(16, 16, 16)')
const app = await serve({ page: 'src/Card.ts', props: { id: 'card', title: 'Hi' }, tokens: 'test/dark.ts' })
const page = await app.open('/')
expect(await page.style(undefined, ['background-color'])).toEqual({ 'background-color': 'rgb(16, 16, 16)' })`,
  },
]);
const paths = suite(IMPORTS, [
  {
    title: "page outside the folder or outside src is E1736 naming the path",
    body: `for (const page of ['../other/src/Card.ts', 'test/Card.ts']) {
  const e = await failure(serve({ page }))
  expect(e.code).toBe('E1736')
  expect(e.message).toContain(page)
}`,
  },
]);
const outsideTest = suite(IMPORTS, [
  {
    title: "wrap and tokens outside test are E1736 naming the path",
    body: `const w = await failure(serve({ page: 'src/Card.ts', props: { id: 'card', title: 'Hi' }, wrap: 'src/Card.ts' }))
expect(w.code).toBe('E1736')
expect(w.message).toContain('src/Card.ts')
const t = await failure(serve({ page: 'src/Card.ts', props: { id: 'card', title: 'Hi' }, tokens: 'tokens.ts' }))
expect(t.code).toBe('E1736')
expect(t.message).toContain('tokens.ts')`,
  },
]);

let ran = new Map<string, Ran>();
let libDirs: string[] = [];

beforeAll(() => {
  const base: Tree = { ...library(undefined), ...extra };
  ran = runJobs([
    { key: "bothA", tree: { ...base, "test/b.e2e.ts": bothB.source }, file: "test/a.e2e.ts", source: bothA.source },
    { key: "wrap", tree: base, file: "test/wrap.e2e.ts", source: wrapped.source },
    { key: "tokens", tree: base, file: "test/tokens.e2e.ts", source: tokened.source },
    { key: "paths", tree: base, file: "test/paths.e2e.ts", source: paths.source },
    { key: "outside", tree: base, file: "test/outside.e2e.ts", source: outsideTest.source },
  ]);
  libDirs = [...ran.values()].map((r) => r.dir);
}, fixedTime(3_000_000));
afterAll(cleanup);

const hostsLeft = (dir: string): string[] =>
  existsSync(join(dir, ".keel")) ? readdirSync(join(dir, ".keel")).filter((n) => n.startsWith("e2e-host-")) : [];

describe("k.e2e library hosts", () => {
  it("Two files of one library calling `serve({ page: 'src/Card.ts' })` at once each serve their page, and after both end no `.keel/e2e-host-*` folder is left.", () => {
    passedJob(ran, "bothA", bothA.lines["file A serves its page while file B serves its own"]);
    const both = ran.get("bothA");
    expect(both, "the run exists").toBeDefined();
    if (both === undefined) return;
    expect(
      outcome(both.dir, "test/b.e2e.ts", bothB.lines["file B serves its page while file A serves its own"] ?? 0),
      reasons(both.run),
    ).toBe("passed");
    expect(hostsLeft(both.dir)).toEqual([]);
  });

  it("`serve({ page: 'src/Card.ts', wrap: 'test/Frame.ts' })` serves `Card` inside `Frame`'s `children`, and with `tokens: 'test/dark.ts'` the page's `style` reads the colours that file gives.", () => {
    passedJob(ran, "wrap", wrapped.lines["wrap renders the page inside the frame"]);
    passedJob(ran, "tokens", tokened.lines["tokens give the page the colours of that file"]);
  });

  it("`serve({ page: '../other/src/Card.ts' })` and `serve({ page: 'test/Card.ts' })` in a library's folder reject E1736 naming the path.", () => {
    passedJob(ran, "paths", paths.lines["page outside the folder or outside src is E1736 naming the path"]);
    passedJob(ran, "outside", outsideTest.lines["wrap and tokens outside test are E1736 naming the path"]);
    for (const d of libDirs) expect(hostsLeft(d)).toEqual([]);
  });
});
