// Examples: a path route's `title` receives the route component's props with `data` the value of its loader's
// `output` schema (k.head), so it reads the loaded value without parsing it again; a route without a loader keeps
// `RouteProps`. Asserted inside the title functions, which run when the router renders the page.
import { type Id, ok, s } from "@keel/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import type { RouteProps } from "../src/types/RouteProps.ts";

const List = s.object({ id: s.id("List"), name: s.string() });
const Shell = s.object({ user: s.string() });
const ListParams = s.object({ listId: s.id("List") });
const loadList = loader({ output: List, params: ListParams }, async ({ params }) =>
  ok({ id: params.listId, name: "Groceries" }),
);
const loadShell = loader({ output: Shell }, async () => ok({ user: "ada" }));
const page = (): Node => document.createTextNode("");

describe("route title data", () => {
  it("is the loader output's value: branded ids, no re-parse, the layout's loader not mixed in", () => {
    const routes = manifest({
      "t.shell": { component: page, loader: loadShell },
      "t.list": {
        path: "/lists/:listId",
        params: ListParams,
        loader: loadList,
        component: page,
        layout: "t.shell",
        title: (p) => {
          expectTypeOf(p.data).toEqualTypeOf<{ id: Id<"List">; name: string }>();
          return p.data.name;
        },
      },
      "t.api": { api: true, path: "/api/lists/:listId", params: ListParams, loader: loadList },
    });
    const title = routes.routes["t.list"].title;
    expectTypeOf(title).parameter(0).toHaveProperty("data").toEqualTypeOf<{ id: Id<"List">; name: string }>();
    const loaded = List.parse({ id: "l1", name: "Groceries" });
    expect(loaded.ok && title({ data: loaded.value })).toBe("Groceries");
  });

  it("is RouteProps for a route without a loader, whichever its neighbours declare", () => {
    const routes = manifest({
      "t.about": {
        path: "/about",
        component: page,
        title: (p) => {
          expectTypeOf(p).toEqualTypeOf<RouteProps>();
          return typeof p.data === "string" ? p.data : "About";
        },
      },
      "t.list": { path: "/lists/:listId", params: ListParams, loader: loadList, component: page, title: () => "List" },
    });
    expectTypeOf(routes.routes["t.about"].title).parameter(0).toEqualTypeOf<RouteProps>();
    expect(routes.routes["t.about"].title({})).toBe("About");
  });

  it("a title that declares its props keeps them, as a component does", () => {
    const routes = manifest({
      "t.list": {
        path: "/lists/:listId",
        params: ListParams,
        loader: loadList,
        component: page,
        title: (p: { readonly data: { readonly name: string } }) => p.data.name,
      },
    });
    expectTypeOf(routes.routes["t.list"].title)
      .parameter(0)
      .toEqualTypeOf<{ readonly data: { readonly name: string } }>();
  });
});
