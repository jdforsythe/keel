// Seed 1337
// Spec: k.compiler, clause "A literal `src=\"logo.png\"` is not E1501; `href=\"/orders\"` is."
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { expect, test } from "vitest";

type Routes = NonNullable<Parameters<typeof compile>[1]>["routes"];

const component = (jsx: string) => `export default function C() { return <div>${jsx}</div> }`;
const e1501 = (jsx: string, routes?: Routes) =>
  compile(
    [{ path: "C.tsx", source: component(jsx) }],
    routes === undefined ? undefined : { routes },
  ).diagnostics.filter((d) => d.code === "E1501");

const orders: Routes = {
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

test("a literal src, poster, ping or xlink:href with a relative or absolute-path asset URL is not E1501", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(
        `<img id="i" src="logo.png" alt="Logo" />`,
        `<img id="i" src="./img/a.png" alt="A" />`,
        `<img id="i" src="/static/logo.png" alt="L" />`,
        `<video id="v" poster="p.jpg" />`,
        `<video id="v" poster="/static/p.jpg" />`,
        `<a id="a" ping="track.gif">x</a>`,
        `<use id="u" xlink:href="sprite.svg#a" />`,
      ),
      (jsx) => {
        expect(e1501(jsx)).toEqual([]);
        expect(e1501(jsx, orders)).toEqual([]);
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});

test("a literal href, action or formaction starting with / is E1501", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(
        `<a id="a" href="/orders">x</a>`,
        `<form id="f" action="/orders"></form>`,
        `<button id="b" formaction="/x">x</button>`,
      ),
      (jsx) => {
        expect(e1501(jsx).length).toBeGreaterThan(0);
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});

test("a relative literal href matching a routes.json path pattern is E1501, only when routes are supplied", () => {
  const jsx = `<a id="a" href="orders/7">x</a>`;
  expect(e1501(jsx, orders).length).toBeGreaterThan(0);
  expect(e1501(jsx)).toEqual([]);
});

test("a relative literal href matching no route is not E1501", () => {
  const jsx = `<a id="a" href="docs/guide.pdf">x</a>`;
  expect(e1501(jsx, orders)).toEqual([]);
  expect(e1501(jsx)).toEqual([]);
});
