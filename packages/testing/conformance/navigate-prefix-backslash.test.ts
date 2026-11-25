// @vitest-environment happy-dom
// Spec: k.prefix, Conformance "With `x.show` as above, `navigate('/en-US/\\x')` (one raw backslash) records one GET of `'/en-US/\\x'` in `documents()` and leaves `route()` unchanged; for every generated string `t`, `navigate(t)` rejects with E1501, or ends on a page of the table, or records one entry in `documents()` whose `url`, resolved against the page's URL, has the page's origin."
// Seed 1337 (fc.assert below; the sim ctx's seed is 1337). Lives in packages/testing/conformance, not packages/router/conformance, because `documents()` is a `renderRoute` handle member and @keel/router does not depend on @keel/testing.
// ASSUMPTIONS: "one raw backslash" is the string `/en-US/\x`; a raw string reaches `navigate` as an `Href` through a type predicate (as mount-router-scope-none.test.ts does); "ends on a page of the table" is `route().id` `x.show` with no entry in `documents()`; "the page's origin" is `location.origin`; a rejection is read through its `code`.
import { manifest } from "@keel/router";
import type { Href } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SEED, codeOf, simCtx, thrown } from "./fixtures.ts";

const Locale = s.enum(["en-US", "de-DE"], { pathDefault: "en-US" });
const xc = contract("x", { "x.show": { path: "/:p/items/:id", params: s.object({ p: Locale, id: s.string() }) } });
const routes = manifest(xc, { "x.show": { component: () => document.createElement("p") } });
const isHref = (t: string): t is Href => true;
const raw = (t: string): Href => {
  if (!isHref(t)) throw new Error("unreachable");
  return t;
};

const opened: { dispose(): void }[] = [];
afterEach(() => {
  for (const h of opened.splice(0)) h.dispose();
});
async function open() {
  const h = await renderRoute("x.show", { routes, params: { p: "en-US", id: "7" }, ctx: simCtx() });
  opened.push(h);
  return h;
}
type Handle = Awaited<ReturnType<typeof open>>;

/** One outcome of `navigate(t)` the clause allows: E1501, a page of the table, or one document entry on the page's origin. */
async function allowed(h: Handle, t: string): Promise<boolean> {
  const error = await thrown(() => h.navigate(raw(t)));
  if (error !== undefined) return codeOf(error) === "E1501";
  const docs = h.documents();
  if (docs.length === 0) return h.route().id === "x.show";
  const [only] = docs;
  return docs.length === 1 && only !== undefined && new URL(only.url, location.href).origin === location.origin;
}

describe("k.prefix: navigate to a prefixed target holding a backslash", () => {
  it("with x.show as above, navigate('/en-US/\\\\x') (one raw backslash) records one GET of '/en-US/\\\\x' in documents() and leaves route() unchanged", async () => {
    const h = await open();
    const before = h.route();
    await h.navigate(raw("/en-US/\\x"));
    expect(h.documents()).toEqual([{ method: "GET", url: "/en-US/\\x", body: null }]);
    expect(h.route()).toEqual(before);
  });

  it("for every string of backslash and slash mixes under a locale prefix, navigate rejects with E1501, or ends on a page of the table, or records one entry in documents() on the page's origin", async () => {
    const piece = fc.constantFrom("/", "\\", "x", "items", "7", ".", "%5C", "en-US");
    const prefix = fc.constantFrom("", "/", "/en-US", "/de-DE", "/fr-FR", "\\", "//");
    await fc.assert(
      fc.asyncProperty(prefix, fc.array(piece, { maxLength: 6 }), async (head, rest) => {
        const h = await open();
        const t = `${head}${rest.join("")}`;
        expect(await allowed(h, t), JSON.stringify(t)).toBe(true);
        h.dispose();
        opened.pop();
      }),
      { seed: SEED, numRuns: 80 },
    );
  });

  it("for every generated string t, navigate(t) rejects with E1501, or ends on a page of the table, or records one entry in documents() whose url, resolved against the page's URL, has the page's origin", async () => {
    const t = fc.oneof(
      fc.string({ maxLength: 20 }),
      fc.stringMatching(/^[/\\a-z0-9.%?#:@ -]{0,16}$/),
      fc.stringMatching(/^\/(en-US|de-DE)?[/\\a-z0-9.]{0,12}$/),
    );
    await fc.assert(
      fc.asyncProperty(t, async (value) => {
        const h = await open();
        expect(await allowed(h, value), JSON.stringify(value)).toBe(true);
        h.dispose();
        opened.pop();
      }),
      { seed: SEED, numRuns: 80 },
    );
  });
});
