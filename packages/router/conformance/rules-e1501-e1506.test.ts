// @vitest-environment happy-dom
// Spec: k.router, clause "E1501-E1506 each have a triggering fixture and a clean one." (RFC 0020; E1502-E1504 and E1506 read the contract, k.contract)
// E1501 has two halves. `navigate` with a string is type-only in this package (a TS error reported under E1501,
// k.check), asserted here with type-level checks. Literal URL attributes and `Link to` are diagnosed by the compiler
// (URL policy, k.compiler, RFC 0030), asserted through the public `compile`. Property seed: 1337.
// E1502-E1506: `contract` or `manifest` throws an Error whose `code` is the rule (which of the two is not stated, so each case builds both: `built` below);
// `<Form>` throws E1505 when rendered inside a router (RFC 0045; outside one it never does). E1506 means unknown
// layout id or a layout cycle. E1505's "actions key that is no verb" is a binding member its page refuses (E1510, k.contract), asserted in contract-kinds-e1510.test.ts.
import { compile } from "@keel/compiler";
import { type Href, type createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { SEED, appContract, el, idOf, probeForm, probeLinks } from "./fixtures.ts";
import { bindingOf, thrown } from "./contract-support.ts";

type Navigate = Parameters<ReturnType<typeof createRouter>["navigate"]>[0];

const Id = s.object({ id: s.id("Order") });
const Q = s.object({ q: s.string().optional() });
const Out = s.object({ n: s.int() });

/** The `code` thrown building a contract of `entries` and its valid binding, or null. */
const built = (entries: Record<string, unknown>, override: Record<string, unknown> = {}): unknown => {
  const mod = Object.keys(entries)[0]?.split(".")[0] ?? "z";
  return (
    thrown(() => {
      const c = Reflect.apply(contract, undefined, [mod, entries]);
      return Reflect.apply(manifest, undefined, [c, bindingOf(c, override)]);
    })?.code ?? null
  );
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
        source: `${opts.link === true ? LINK_IMPORT : ""}import { orders } from "./orders.contract"\nexport default function C(p: { id: string }) { const id = p.id; return <div>${jsx}</div> }`,
      },
    ],
    opts.routes === undefined ? undefined : { routes: opts.routes },
  ).diagnostics.filter((d) => d.code === "E1501");

describe("k.router rules", () => {
  it("E1501 string path where an Href is required", () => {
    const clean: Navigate = appContract.href("app.home");
    const asHref: Href = appContract.href("app.home");
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

  it("E1501 clean counterparts: orders.href() expressions, #frag, absolute URL, and a relative literal matching no pattern have zero diagnostics", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { jsx: `<a id="a" href={orders.href("orders.show", { id })}>x</a>`, link: false },
          { jsx: `<form id="f" action={orders.href("orders.show", { id })}></form>`, link: false },
          { jsx: `<button id="b" formaction={orders.href("orders.show", { id })}>x</button>`, link: false },
          { jsx: `<Link id="l" to={orders.href("orders.show", { id })}>x</Link>`, link: true },
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

  it("E1502 two entries with the same path pattern (param names do not distinguish them)", () => {
    expect(built({ "a.one": { path: "/x" }, "a.two": { path: "/x" } })).toBe("E1502");
    expect(built({ "b.one": { path: "/o/:id", params: Id }, "b.two": { path: "/o/:id", params: Id } })).toBe("E1502");
    expect(built({ "c.one": { path: "/x" }, "c.two": { path: "/y" } })).toBeNull();
    // two API entries at different methods of one path are clean; at one method, E1502
    const api = (m: string) => ({ method: m, path: "/api/x", output: Out });
    expect(built({ "d.box": api("GET"), "d.add": { ...api("POST"), body: Out } })).toBeNull();
    expect(built({ "e.one": api("GET"), "e.two": api("GET") })).toBe("E1502");
  });

  it("E1503 :name in path without a params field, or the reverse", () => {
    expect(built({ "d.one": { path: "/o/:id" } })).toBe("E1503");
    expect(built({ "d.two": { path: "/o", params: Id } })).toBe("E1503");
    expect(built({ "d.three": { path: "/o/:id", params: Id } })).toBeNull();
    expect(built({ "d.four": { path: "/o" } })).toBeNull();
  });

  it("E1504 required field in a page's search schema; an API entry's query may require one", () => {
    expect(built({ "e.one": { path: "/e", search: s.object({ q: s.string() }) } })).toBe("E1504");
    expect(built({ "e.two": { path: "/e2", search: Q } })).toBeNull();
    expect(
      built({ "e.three": { method: "GET", path: "/api/e", query: s.object({ q: s.string() }), output: Out } }),
    ).toBeNull();
  });

  it("E1505 <Form method> outside POST/PUT/PATCH/DELETE", async () => {
    const href = probeLinks.href("link.show", { id: idOf("1") });
    expect(await probeForm("GET", href)).toBe("E1505");
    expect(await probeForm("post", href)).toBe("E1505");
    expect(await probeForm("POST", href)).toBeNull();
  });

  it("E1505 <Form method> not bound on the target page; an action that matches no route is not E1505", async () => {
    const href = probeLinks.href("link.show", { id: idOf("1") });
    expect(await probeForm("DELETE", href)).toBe("E1505");
    expect(await probeForm("POST", href)).toBeNull();
    expect(await probeForm("POST", probeLinks.href("link.ghost"))).toBeNull();
  });

  it("E1506 unknown layout id, or a layout cycle", () => {
    expect(
      built(
        { "h.one": { path: "/h" }, "h.shell": { layout: true } },
        { "h.one": { component: () => null, layout: "h.ghost" } },
      ),
    ).toBe("E1506");
    expect(
      built(
        { "j.a": { layout: true }, "j.b": { layout: true }, "j.page": { path: "/j" } },
        {
          "j.a": { component: () => null, layout: "j.b" },
          "j.b": { component: () => null, layout: "j.a" },
          "j.page": { component: () => null, layout: "j.a" },
        },
      ),
    ).toBe("E1506");
    expect(
      built(
        { "k.shell": { layout: true }, "k.one": { path: "/k" } },
        { "k.one": { component: () => null, layout: "k.shell" } },
      ),
    ).toBeNull();
  });
});
