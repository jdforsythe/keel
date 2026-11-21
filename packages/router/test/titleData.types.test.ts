// Examples: a page's `title` receives `params` and `search` as the values of its entry's schemas and `data` as the value
// of its loader's `output` schema (k.head), so it reads them without parsing again; a page without a loader has no
// `data`. Asserted inside the title functions, which are called below with the props the router passes.
import { type Id, ok, s } from "@keel/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { contract } from "../src/contract/contract.ts";
import { bindingsOf } from "../src/internal/bindingsOf.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import type { RouteTable } from "../src/types/RouteTable.ts";

const List = s.object({ id: s.id("List"), name: s.string() });
const Shell = s.object({ user: s.string() });
const ListParams = s.object({ listId: s.id("List") });
const Locale = s.enum(["en-US", "de-DE"], { pathDefault: "en-US" });
const ItemParams = s.object({ locale: Locale, itemId: s.id("Item") });
const ItemSearch = s.object({ q: s.string().optional(), page: s.number().optional() });
const t = contract("t", {
  "t.shell": { layout: true },
  "t.about": { path: "/about" },
  "t.list": { path: "/lists/:listId", params: ListParams },
  "t.item": { path: "/:locale/items/:itemId", params: ItemParams, search: ItemSearch },
  "t.find": { path: "/find", search: ItemSearch },
  "t.api": { method: "GET", path: "/api/lists/:listId", params: ListParams, output: List },
});
const loadList = loader(t, "t.list", { output: List }, async ({ params }) =>
  ok({ id: params.listId, name: "Groceries" }),
);
const loadShell = loader(t, "t.shell", { output: Shell }, async () => ok({ user: "ada" }));
const loadItem = loader(t, "t.item", { output: Shell }, async () => ok({ user: "ada" }));
const loadApi = loader(t, "t.api", {}, async ({ params }) => ok({ id: params.listId, name: "Groceries" }));
const page = (): Node => document.createTextNode("");

/** The `title` bound at `id`, called with `props` as the router calls it. */
const titleOf = (routes: RouteTable, id: string, props: object): unknown => {
  const title = bindingsOf(routes).get(id)?.binding.title;
  if (typeof title !== "function") throw new Error(`no title at ${id}`);
  return Reflect.apply(title, undefined, [props]);
};

describe("route title data", () => {
  it("is the loader output's value: branded ids, no re-parse, the layout's loader not mixed in", () => {
    const routes = manifest(t, {
      "t.shell": { component: page, loader: loadShell },
      "t.about": { component: page },
      "t.list": {
        loader: loadList,
        component: page,
        layout: "t.shell",
        title: (p) => {
          expectTypeOf(p.data).toEqualTypeOf<{ id: Id<"List">; name: string }>();
          return p.data.name;
        },
      },
      "t.item": { component: page },
      "t.find": { component: page },
      "t.api": { loader: loadApi },
    });
    const loaded = List.parse({ id: "l1", name: "Groceries" });
    const params = ListParams.parse({ listId: "l1" });
    expect(loaded.ok && params.ok && titleOf(routes, "t.list", { params: params.value, data: loaded.value })).toBe(
      "Groceries",
    );
  });

  it("params and search are the values of the entry's params and search schemas, a prefix param included", () => {
    const routes = manifest(t, {
      "t.shell": { component: page },
      "t.about": { component: page },
      "t.list": { component: page, loader: loadList },
      "t.item": {
        loader: loadItem,
        component: page,
        title: (p) => {
          expectTypeOf(p.params).toEqualTypeOf<{ locale: "en-US" | "de-DE"; itemId: Id<"Item"> }>();
          expectTypeOf(p.search).toEqualTypeOf<{ q?: string | undefined; page?: number | undefined }>();
          expectTypeOf(p.data).toEqualTypeOf<{ user: string }>();
          return `${p.params.locale} ${p.search.q ?? ""} ${p.data.user}`;
        },
      },
      "t.find": { component: page },
      "t.api": { loader: loadApi },
    });
    const params = ItemParams.parse({ locale: "de-DE", itemId: "i1" });
    const search = ItemSearch.parse({ q: "tea" });
    const data = Shell.parse({ user: "ada" });
    expect(
      params.ok &&
        search.ok &&
        data.ok &&
        titleOf(routes, "t.item", { params: params.value, search: search.value, data: data.value }),
    ).toBe("de-DE tea ada");
  });

  it("a page without a loader gets its params and search typed from the entry", () => {
    const routes = manifest(t, {
      "t.shell": { component: page },
      "t.about": { component: page },
      "t.list": { component: page, loader: loadList },
      "t.item": { component: page },
      "t.find": {
        component: page,
        title: (p) => {
          expectTypeOf(p.search).toEqualTypeOf<{ q?: string | undefined; page?: number | undefined }>();
          return p.search.q ?? "";
        },
      },
      "t.api": { loader: loadApi },
    });
    expect(titleOf(routes, "t.find", { search: { q: "tea" } })).toBe("tea");
  });
});
