// @vitest-environment happy-dom
// Spec: k.router, clause "E1501-E1506 each have a triggering fixture and a clean one." (RFC 0020)
// E1501 has two halves. `navigate` with a string is type-only in this package (a TS error reported under E1501,
// k.check), asserted here with type-level checks. Literal URL attributes and `Link to` are diagnosed by the compiler
// (URL policy, k.compiler, RFC 0030), asserted through the public `compile`. Property seed: 1337.
// E1502-E1506: `manifest` throws an Error whose `code` is the rule; `<Form>` throws E1505 when rendered inside a router (RFC 0045; outside one it never does). E1506 means unknown
// layout name, a layout with a path, or a layout cycle (guards are values since RFC 0041, so no unknown guard name
// exists). Each trigger has a clean counterpart.
import { compile } from "@keel/compiler";
import { type Href, action, type createRouter, manifest } from "@keel/router";
import { s } from "@keel/schema";
import { ok } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { SEED, el, idOf, probeForm, probeLinks, routes } from "./fixtures.ts";

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

type CompileRoutes = NonNullable<Parameters<typeof compile>[1]>["routes"];
const showRoutes: CompileRoutes = {
  "orders.show": {
    path: "/orders/:id",
    params: {},
    search: {},
    actions: [],
    layout: null,
    guard: null,
    module: "orders",
  },
};
const LINK_IMPORT = `import { Link } from "@keel/ui"\n`;
const e1501 = (jsx: string, opts: { routes?: CompileRoutes; link?: boolean } = {}) =>
  compile(
    [
      {
        path: "C.tsx",
        source: `${opts.link === true ? LINK_IMPORT : ""}import { routes } from "./routes"\nexport default function C(p: { id: string }) { const id = p.id; return <div>${jsx}</div> }`,
      },
    ],
    opts.routes === undefined ? undefined : { routes: opts.routes },
  ).diagnostics.filter((d) => d.code === "E1501");

describe("k.router rules", () => {
  it("E1501 string path where an Href is required", () => {
    const clean: Navigate = routes.href("app.home");
    const asHref: Href = routes.href("app.home");
    expect(clean).toBe(asHref);
    expectTypeOf<string>().not.toMatchTypeOf<Href>();
    expectTypeOf<"/orders/1">().not.toMatchTypeOf<Href>();
    expectTypeOf<string>().not.toMatchTypeOf<Navigate>();
  });

  it("E1501 a literal path in href, action, formaction or Link to is exactly one diagnostic; a relative literal matching a route pattern too", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { jsx: `<a id="a" href="/orders">x</a>`, link: false },
          { jsx: `<form id="f" action="/orders"></form>`, link: false },
          { jsx: `<button id="b" formaction="/orders/7">x</button>`, link: false },
          { jsx: `<Link id="l" to="/orders">x</Link>`, link: true },
        ),
        (c) => {
          expect(e1501(c.jsx, { link: c.link })).toHaveLength(1);
          expect(e1501(c.jsx, { link: c.link, routes: showRoutes })).toHaveLength(1);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
    expect(e1501(`<a id="a" href="orders/7">x</a>`, { routes: showRoutes })).toHaveLength(1);
  });

  it("E1501 clean counterparts: routes.href() expressions, #frag, absolute URL, and a relative literal matching no pattern have zero diagnostics", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { jsx: `<a id="a" href={routes.href("orders.show", { id })}>x</a>`, link: false },
          { jsx: `<form id="f" action={routes.href("orders.show", { id })}></form>`, link: false },
          { jsx: `<button id="b" formaction={routes.href("orders.show", { id })}>x</button>`, link: false },
          { jsx: `<Link id="l" to={routes.href("orders.show", { id })}>x</Link>`, link: true },
          { jsx: `<a id="a" href="#frag">x</a>`, link: false },
          { jsx: `<a id="a" href="https://x.test/orders">x</a>`, link: false },
          { jsx: `<a id="a" href="docs/guide.pdf">x</a>`, link: false },
        ),
        (c) => {
          expect(e1501(c.jsx, { link: c.link })).toEqual([]);
          expect(e1501(c.jsx, { link: c.link, routes: showRoutes })).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
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
    const attach = (key: string) => {
      const m = manifest({ "f.one": { path: "/f", component: page } });
      return codeOf(() => Reflect.apply(m.actions, m, [{ "f.one": { [key]: post } }]));
    };
    expect(attach("GET")).toBe("E1505");
    expect(attach("post")).toBe("E1505");
    expect(attach("POST")).toBeNull();
    expect(attach("DELETE")).toBeNull();
  });

  it("E1505 actions in an entry (they attach with routes.actions)", () => {
    const entry = { "f.two": { path: "/f2", actions: { POST: post }, component: page } };
    expect(codeOf(() => Reflect.apply(manifest, undefined, [entry]))).toBe("E1505");
  });

  it("E1505 <Form method> outside POST/PUT/PATCH/DELETE", async () => {
    const href = probeLinks.href("link.show", { id: idOf("1") });
    expect(await probeForm("GET", href)).toBe("E1505");
    expect(await probeForm("post", href)).toBe("E1505");
    expect(await probeForm("POST", href)).toBeNull();
  });

  it("E1505 <Form method> not declared on the target route, or the action matches no route", async () => {
    const href = probeLinks.href("link.show", { id: idOf("1") });
    expect(await probeForm("DELETE", href)).toBe("E1505");
    expect(await probeForm("POST", href)).toBeNull();
    expect(await probeForm("POST", probeLinks.href("link.ghost"))).toBe("E1505");
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
});
