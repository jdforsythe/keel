// @vitest-environment happy-dom
// Spec: k.router, clause "Each of E1501-E1506 has a fixture that triggers it and a clean counterpart." (RFC 0020)
// E1501 is a type-level rule (a string for Href is a TS error reported under E1501, k.check), checked here by tsc.
// E1502-E1506: `manifest` throws an Error whose `code` is the rule; `<Form>` throws E1505; an unknown guard name
// fails the route at navigation with a message naming E1506. Each trigger has a clean counterpart.
import { createCtx } from "@keel/ctx";
import { Form, type Href, action, createRouter, guard, href, loader, manifest } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { ok } from "@keel/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { SEED, el, idOf, memoryHistory, settle } from "./fixtures.ts";

type Navigate = Parameters<ReturnType<typeof createRouter>["navigate"]>[0];

const page = (): Node => el("section", {}, "page");
const Id = s.object({ id: s.id("Order") });
const Q = s.object({ q: s.string().optional() });
const Edit = s.object({ note: s.string() });
const post = action({ input: Edit }, async () => ok(null));

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
  }
  return null;
};

describe("k.router rules", () => {
  it("E1501 string path where an Href is required", () => {
    const clean: Navigate = href("app.home");
    const asHref: Href = href("app.home");
    expect(clean).toBe(asHref);
    expectTypeOf<string>().not.toMatchTypeOf<Href>();
    expectTypeOf<"/orders/1">().not.toMatchTypeOf<Href>();
    expectTypeOf<string>().not.toMatchTypeOf<Navigate>();
  });

  it("E1502 two routes with the same path pattern (param names do not distinguish them)", () => {
    expect(
      codeOf(() => manifest({ "a.one": { path: "/x", component: page }, "a.two": { path: "/x", component: page } })),
    ).toBe("E1502");
    expect(
      codeOf(() =>
        manifest({
          "b.one": { path: "/o/:id", params: Id, component: page },
          "b.two": { path: "/o/:id", params: Id, component: page },
        }),
      ),
    ).toBe("E1502");
    expect(
      codeOf(() => manifest({ "c.one": { path: "/x", component: page }, "c.two": { path: "/y", component: page } })),
    ).toBeNull();
  });

  it("E1503 :name in path without a params field, or the reverse", () => {
    expect(codeOf(() => manifest({ "d.one": { path: "/o/:id", component: page } }))).toBe("E1503");
    expect(codeOf(() => manifest({ "d.two": { path: "/o", params: Id, component: page } }))).toBe("E1503");
    expect(codeOf(() => manifest({ "d.three": { path: "/o/:id", params: Id, component: page } }))).toBeNull();
    expect(codeOf(() => manifest({ "d.four": { path: "/o", component: page } }))).toBeNull();
  });

  it("E1504 required field in a search schema", () => {
    expect(
      codeOf(() => manifest({ "e.one": { path: "/e", search: s.object({ q: s.string() }), component: page } })),
    ).toBe("E1504");
    expect(codeOf(() => manifest({ "e.two": { path: "/e2", search: Q, component: page } }))).toBeNull();
  });

  it("E1505 actions key that is not POST/PUT/PATCH/DELETE", () => {
    const bad = (key: string) => ({ "f.one": { path: "/f", actions: { [key]: post }, component: page } });
    expect(codeOf(() => manifest(bad("GET")))).toBe("E1505");
    expect(codeOf(() => manifest(bad("post")))).toBe("E1505");
    expect(codeOf(() => manifest(bad("POST")))).toBeNull();
    expect(codeOf(() => manifest(bad("DELETE")))).toBeNull();
  });

  it("E1505 <Form method> not declared on the target route", () => {
    manifest({ "g.show": { path: "/g/:id", params: Id, actions: { POST: post }, component: page } });
    const id = idOf("1");
    expect(codeOf(() => Form({ method: "DELETE", action: "g.show", params: { id }, children: () => [] }))).toBe(
      "E1505",
    );
    expect(codeOf(() => Form({ method: "POST", action: "g.show", params: { id }, children: () => [] }))).toBeNull();
    expect(codeOf(() => Form({ method: "POST", action: "g.nope", children: () => [] }))).toBe("E1505");
  });

  it("E1506 unknown layout name, a layout with a path, or a layout cycle", () => {
    expect(codeOf(() => manifest({ "h.one": { path: "/h", layout: "h.ghost", component: page } }))).toBe("E1506");
    expect(
      codeOf(() =>
        manifest({
          "i.shell": { path: "/shell", component: page },
          "i.one": { path: "/i", layout: "i.shell", component: page },
        }),
      ),
    ).toBe("E1506");
    expect(
      codeOf(() =>
        manifest({
          "j.a": { layout: "j.b", component: page },
          "j.b": { layout: "j.a", component: page },
          "j.page": { path: "/j", layout: "j.a", component: page },
        }),
      ),
    ).toBe("E1506");
    expect(
      codeOf(() =>
        manifest({ "k.shell": { component: page }, "k.one": { path: "/k", layout: "k.shell", component: page } }),
      ),
    ).toBeNull();
  });

  it("E1506 unknown guard name: the route fails with an error naming E1506; a registered guard passes", async () => {
    const shown = (p: { error: { message: string } }): Node => el("p", { "data-error": "1" }, p.error.message);
    guard("l.known", { redirect: "l.home" }, async () => ok(null));
    const run = async (name: string): Promise<{ text: string; page: boolean }> => {
      const routes = manifest({
        "l.home": { path: "/", component: page },
        "l.page": {
          path: "/guarded",
          guard: name,
          loader: loader({ output: s.object({}) }, async () => ok({})),
          component: () => el("section", { "data-ok": "1" }, "page"),
          errorElement: shown,
        },
      });
      const history = memoryHistory("/guarded");
      const router = createRouter(routes, { ctx: createCtx({ mode: "sim", seed: SEED }), history });
      const host = document.createElement("div");
      document.body.append(host);
      const unmount = mount(router.App, host);
      await settle();
      const out = {
        text: host.querySelector("[data-error]")?.textContent ?? "",
        page: host.querySelector("[data-ok]") !== null,
      };
      unmount();
      router.dispose();
      host.remove();
      return out;
    };
    const unknown = await run("l.ghost");
    expect(unknown.text).toContain("E1506");
    expect(unknown.page).toBe(false);
    const known = await run("l.known");
    expect(known).toEqual({ text: "", page: true });
  });
});
