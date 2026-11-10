// @vitest-environment happy-dom
// Spec: k.prefix Rules, "E1509 (k.router block), from `manifest` ...: a static first segment equal to a value of a prefix param; a route whose first segment is another param; a route whose path is a prefixed route's path without the prefix; two prefix params in one table; a `pathDefault` param that is not first in its path." Conformance: "Beside `x.show`, each of `/de-DE/about`, `/:slug` and `/items/:id` is E1509 ... without `pathDefault` none of them is E1509." (rfc:0079) Seed 1337.
// The `manifest` half. The `keel check` half and the fix are in packages/check/conformance/E1509-prefix-collision.test.ts.
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { Locale, PlainLocale } from "./prefix-fixtures.ts";

const page = (): Node => document.createElement("div");
const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
  }
  return null;
};
const show = (L: typeof Locale | typeof PlainLocale) => ({
  path: "/:p/items/:id",
  params: s.object({ p: L, id: s.string() }),
  component: page,
});
const Slug = s.object({ slug: s.string() });
const Id = s.object({ id: s.string() });
const beside = (L: typeof Locale | typeof PlainLocale, extra: object) => manifest({ "x.show": show(L), ...extra });

const siblings = {
  "a.de": { path: "/de-DE/about", component: page },
  "a.slug": { path: "/:slug", params: Slug, component: page },
  "a.twin": { path: "/items/:id", params: Id, component: page },
};

describe("k.prefix E1509", () => {
  test("beside x.show, each of /de-DE/about, /:slug and /items/:id is E1509 from manifest", () => {
    for (const [name, def] of Object.entries(siblings)) {
      expect(codeOf(() => beside(Locale, { [name]: def }))).toBe("E1509");
    }
  });

  test("without pathDefault none of /de-DE/about, /:slug and /items/:id is E1509", () => {
    for (const [name, def] of Object.entries(siblings)) {
      expect(codeOf(() => beside(PlainLocale, { [name]: def }))).not.toBe("E1509");
    }
  });

  test("two prefix params in one table, and a pathDefault param that is not first in its path, are E1509", () => {
    const Other = s.enum(["a", "b"], { pathDefault: "a" });
    expect(
      codeOf(() =>
        manifest({
          "x.show": show(Locale),
          "y.show": { path: "/:q/y", params: s.object({ q: Other }), component: page },
        }),
      ),
    ).toBe("E1509");
    expect(
      codeOf(() =>
        manifest({
          "z.show": { path: "/items/:p", params: s.object({ p: Locale }), component: page },
        }),
      ),
    ).toBe("E1509");
  });

  test("a table with only prefixed routes is clean", () => {
    expect(codeOf(() => beside(Locale, {}))).toBeNull();
  });
});
