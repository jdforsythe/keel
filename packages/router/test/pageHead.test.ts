// k.head: the head of a page as a server render and the client router read it: the matched route's title, or the
// fallback (null) without one, on a failure, when it throws or gives no string; `lang` from the route's prefix param.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contract } from "../src/contract/contract.ts";
import { compileRoutes, matchUrl, pageHead } from "../src/internal/index.ts";
import type { Located } from "../src/internal/index.ts";
import { manifest } from "../src/manifest.ts";

const SEED = 1337;
/** A component for a table that renders no page. */
const view = (): Node => {
  throw new Error("no page renders here");
};
const Locale = s.object({ locale: s.enum(["en", "de", "fr"], { pathDefault: "en" }) });
const c = contract("h", {
  "h.titled": { path: "/:locale/titled", params: Locale },
  "h.plain": { path: "/:locale/plain", params: Locale },
  "h.throws": { path: "/:locale/throws", params: Locale },
});
const table = compileRoutes(
  manifest(c, {
    "h.titled": { component: view, title: (p) => `Titled ${String(Reflect.get(Object(p.params), "locale"))}` },
    "h.plain": { component: view },
    "h.throws": {
      component: view,
      title: () => {
        throw new Error("title");
      },
    },
  }),
).located;
const flat = contract("f", { "f.page": { path: "/f/:locale", params: s.object({ locale: s.string() }) } });
const flatTable = compileRoutes(
  Reflect.apply(manifest, undefined, [flat, { "f.page": { component: view, title: () => 7 } }]),
).located;

const at = (list: readonly Located[], url: string): Located => {
  const m = matchUrl(list, url);
  if (m.route === null) throw new Error(`no route at ${url}`);
  return m.route;
};
const props = (locale: string) => ({ params: { locale }, search: {}, data: undefined });

describe("pageHead", () => {
  it("the title is the route's title of the props, the lang its prefix param's value", () => {
    fc.assert(
      fc.property(fc.constantFrom("en", "de", "fr"), (locale) => {
        expect(pageHead(at(table, "/titled"), { locale }, props(locale), false)).toEqual({
          title: `Titled ${locale}`,
          lang: locale,
        });
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("the title is null on a failure, without a title, when it throws and when it gives no string", () => {
    expect(pageHead(at(table, "/titled"), { locale: "de" }, props("de"), true)).toEqual({ title: null, lang: "de" });
    expect(pageHead(at(table, "/plain"), { locale: "fr" }, props("fr"), false)).toEqual({ title: null, lang: "fr" });
    expect(pageHead(at(table, "/plain"), { locale: "fr" }, props("fr"), true)).toEqual({ title: null, lang: "fr" });
    expect(pageHead(at(table, "/throws"), { locale: "en" }, props("en"), false)).toEqual({ title: null, lang: "en" });
    expect(pageHead(at(flatTable, "/f/de"), { locale: "de" }, props("de"), false)).toEqual({ title: null, lang: "en" });
  });

  it("the lang is en for no route, a route without a prefix param and a value that is no string", () => {
    expect(pageHead(null, {}, props("de"), false)).toEqual({ title: null, lang: "en" });
    expect(pageHead(null, { locale: "de" }, props("de"), true)).toEqual({ title: null, lang: "en" });
    expect(pageHead(at(flatTable, "/f/de"), { locale: "de" }, props("de"), true).lang).toBe("en");
    expect(pageHead(at(table, "/titled"), { locale: 5 }, props("de"), false).lang).toBe("en");
    expect(pageHead(at(table, "/titled"), {}, props("de"), false).lang).toBe("en");
  });
});
