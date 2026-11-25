// k.library the clause on `keel test` resolving a library with the `keel` condition, quoted whole
// Spec: k.library, clause "In that project, a test under `test/` that renders with `render` (k.testing) an app component rendering `<Badge id=\"shop.wrap\" />` finds `shop.wrap.box` under `keel test`; with no `keel` in the library's `exports`, `Badge` is not found and the test fails."
// In an app (compiler): "The compiler resolves imports with the `keel` condition on every surface (dev, build, test) and transforms a library's files as the app's, read at `modules/<id>/<f>`: JSX, element ids, and style props into the app's CSS file against the app's `tokens.ts`; the `.keel/` artifacts derive from a library's files at those paths as from the app's, and E1005 compares them over the same files, so a reader of an artifact (E1702, the inspector) judges a library's element as an app's. A linked library's imports resolve from its real folder, as Node's do, so the kernel packages it imports must resolve there to the app's (one workspace install)."
// Seed: 1337 (no generated input: two fixtures, one `keel test` each). Binary runs: 2.
// ASSUMPTIONS (spec silent): the test is `test/badge.test.ts` and builds `render`'s component by giving `modules/shop/Wrap.tsx`'s default export a `Props` (`s.object({})`), on a sim ctx;
// "the test fails" is a non-zero exit of `keel test` with a summary that is not ok. The library without a `keel` condition keeps `"."` at its `default` (`index.js`, which exports nothing).
import { afterAll, expect, test } from "vitest";
import { cleanup, keel, library, materialize, siteTree } from "./library-support.ts";

// The fixture test's environment line is joined from two parts so vitest does not read it as this file's own.
const ENV = ["// @vitest", "environment happy-dom"].join("-");
const TEST = `${ENV}
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { expect, it } from "vitest";
import Wrap from "../modules/shop/Wrap.tsx";

it("finds shop.wrap.box", () => {
  const t = render(Object.assign(Wrap, { Props: s.object({}) }), { props: {}, ctx: createCtx({ mode: "sim", seed: 1337 }) });
  expect(t.find("shop.wrap.box").id).toBe("shop.wrap.box");
  t.dispose();
});
`;
const WRAP =
  "import { Badge } from '@acme/charts'\nexport default function Wrap() {\n  return <Badge id=\"shop.wrap\" />\n}\n";

const NO_KEEL = JSON.stringify({
  name: "@acme/charts",
  version: "1.0.0",
  type: "module",
  keel: "library",
  exports: { ".": { default: "./index.js" } },
});

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
function testRun(withKeel: boolean) {
  const lib = library(withKeel ? {} : { files: { "package.json": NO_KEEL } });
  const dir = materialize({ ...siteTree([lib]), "modules/shop/Wrap.tsx": WRAP, "test/badge.test.ts": TEST });
  dirs.push(dir);
  return keel(dir, ["test"]);
}

test('In that project, a test under `test/` that renders with `render` (k.testing) an app component rendering `<Badge id="shop.wrap" />` finds `shop.wrap.box` under `keel test`', () => {
  const r = testRun(true);
  const summary = r.records.find((x) => x.kind === "summary");
  expect(summary?.ok, JSON.stringify(r.records).slice(0, 600)).toBe(true);
  expect(r.status).toBe(0);
}, 600_000);

test("In that project, with no `keel` in the library's `exports`, `Badge` is not found and the test fails", () => {
  const r = testRun(false);
  const summary = r.records.find((x) => x.kind === "summary");
  expect(summary?.ok).toBe(false);
  expect(r.status).not.toBe(0);
}, 600_000);
