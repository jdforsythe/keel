// @vitest-environment happy-dom
// Spec: k.prefix Rules, "E1509 (k.router block), thrown by `contract` and `routeTable` and from `keel check` over a deployable's route table (k.routes): a static first segment equal to a value of a prefix param; a route whose first segment is another param; a prefixed route whose second segment is a param (its value could read as a locale); a route whose path is a prefixed route's path without the prefix; two prefix params in one table; a `pathDefault` param that is not first in its path. Fix: prepend `/:<p>` to the route's `path` (its params then need the field, E1503)." Conformance: "Beside `x.show`, each of `/de-DE/about`, `/:slug`, `/:p/:slug` and `/items/:id` is E1509, the fix applied leaves no E1509, and without `pathDefault` none of them is E1509." (rfc:0079) Seed 1337.
// The `contract` and `routeTable` half. The `keel check` half and the fix are in packages/check/conformance/E1509-prefix-collision.test.ts.
import { routeTable, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { Locale, PlainLocale } from "./prefix-fixtures.ts";

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
});
const Slug = s.object({ slug: s.string() });
const Id = s.object({ id: s.string() });
const beside = (L: typeof Locale | typeof PlainLocale, extra: object) => contract("x", { "x.show": show(L), ...extra });

const siblings = (L: typeof Locale | typeof PlainLocale) => ({
  "x.de": { path: "/de-DE/about" },
  "x.slug": { path: "/:slug", params: Slug },
  "x.page": { path: "/:p/:slug", params: s.object({ p: L, slug: s.string() }) },
  "x.twin": { path: "/items/:id", params: Id },
});

describe("k.prefix E1509", () => {
  test("Beside `x.show`, each of `/de-DE/about`, `/:slug`, `/:p/:slug` and `/items/:id` is E1509 from contract", () => {
    for (const [name, def] of Object.entries(siblings(Locale))) {
      expect(codeOf(() => beside(Locale, { [name]: def }))).toBe("E1509");
    }
  });

  test("without `pathDefault` none of `/de-DE/about`, `/:slug`, `/:p/:slug` and `/items/:id` is E1509", () => {
    for (const [name, def] of Object.entries(siblings(PlainLocale))) {
      expect(codeOf(() => beside(PlainLocale, { [name]: def }))).not.toBe("E1509");
    }
  });

  test("two prefix params in one table (two modules, `routeTable`), and a pathDefault param that is not first in its path (`contract`), are E1509", () => {
    const Other = s.enum(["a", "b"], { pathDefault: "a" });
    const page = (): Node => document.createElement("div");
    const x = contract("x", { "x.show": show(Locale) });
    const y = contract("y", { "y.show": { path: "/:q/y", params: s.object({ q: Other }) } });
    expect(
      codeOf(() =>
        routeTable(manifest(x, { "x.show": { component: page } }), manifest(y, { "y.show": { component: page } })),
      ),
    ).toBe("E1509");
    expect(codeOf(() => contract("z", { "z.show": { path: "/items/:p", params: s.object({ p: Locale }) } }))).toBe(
      "E1509",
    );
  });

  test("a table with only prefixed routes is clean", () => {
    expect(codeOf(() => beside(Locale, {}))).toBeNull();
  });
});
