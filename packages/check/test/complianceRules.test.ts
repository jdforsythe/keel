// k.privacy E1111, k.security E1570/E1571, k.a11y E1804/E1820: edges the conformance suites do not cover.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

type Files = Parameters<typeof check>[0];
const codes = (files: Files, code: string, tokens?: unknown) =>
  check(files, { types: false, ...(tokens === undefined ? {} : { artifacts: { tokens } }) }).diagnostics.filter(
    (d) => d.code === code,
  );
const C = (jsx: string): Files => [
  {
    path: "src/C.tsx",
    source: `import { Box, Text, Button } from '@keel/ui'\nexport default function C() { return ${jsx} }\n`,
  },
];

it("E1570 reads every srcset candidate, and `href` to another origin is fine", () => {
  expect(codes(C('<img srcset="/a.png 1x, https://x.example/b.png 2x" />'), "E1570")).toHaveLength(1);
  expect(codes(C('<img srcset="/a.png 1x, /b.png 2x" />'), "E1570")).toEqual([]);
  expect(codes(C('<a href="https://x.example/">x</a>'), "E1570")).toEqual([]);
});

it("E1571 follows a const URL into new URL(), and ignores a relative one", () => {
  const load = (url: string): Files => [
    {
      path: "src/load.ts",
      source: `const U = ${JSON.stringify(url)}\nexport const load = (ctx) => ctx.net.fetch(new URL(U))\n`,
    },
  ];
  expect(codes(load("https://api.example/x"), "E1571")).toHaveLength(1);
  expect(codes(load("/x"), "E1571")).toEqual([]);
});

it("E1111 follows a schema const nested in another schema file", () => {
  const files: Files = [
    {
      path: "src/Who.schema.ts",
      source: "import { s } from '@keel/schema'\nexport const Who = s.object({ ip: s.string().pii('network') })\n",
    },
    {
      path: "src/Q.schema.ts",
      source:
        "import { s } from '@keel/schema'\nimport { Who } from './Who.schema.ts'\nexport const Q = s.object({ who: Who.optional() })\n",
    },
    {
      path: "src/routes.ts",
      source:
        "import { manifest } from '@keel/router'\nimport { Q } from './Q.schema.ts'\nconst Page = () => null\nexport const routes = manifest({ 'a.b': { path: '/b', search: Q, component: Page } })\n",
    },
  ];
  const ds = codes(files, "E1111");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toContain("search");
});

it("E1804 leaves an element whose nearest ancestor bg is not a literal to the render check", () => {
  const tokens = { color: { low: "#949494", white: "#ffffff" } };
  expect(codes(C('<Box bg="white"><Box bg={x}><Text fg="low">t</Text></Box></Box>'), "E1804", tokens)).toEqual([]);
  expect(codes(C('<Box bg="white"><Box><Text fg="low">t</Text></Box></Box>'), "E1804", tokens)).toHaveLength(1);
});

it("E1820 counts focusable elements at any depth and reverses only the direct children", () => {
  const src = '<Box direction="column-reverse"><Box><Button>A</Button></Box> <Button>B</Button></Box>';
  const [d] = codes(C(src), "E1820");
  expect(d?.fix).toContain('direction="column"><Button>B</Button> <Box><Button>A</Button></Box></Box>');
});

it("E1571: the OpenAPI service in api.server.ts, called by a loader a route imports, is clean; in api.ts it is not", () => {
  const files = (service: string): Files => [
    {
      path: "modules/orders/OrdersApi.schema.ts",
      source:
        "import { s } from '@keel/schema'\nimport { endpoints } from '@keel/services'\nexport const OrdersApi = endpoints({ getOrder: { method: 'GET', path: '/orders/:id', params: s.object({ id: s.string() }), output: s.json() } })\n",
    },
    {
      path: `modules/orders/${service}`,
      source:
        "import { service } from '@keel/services'\nimport { OrdersApi } from './OrdersApi.schema.ts'\nexport const api = service({ base: 'https://api.example.com', schema: OrdersApi })\n",
    },
    {
      path: "modules/orders/loadOrder.server.ts",
      source: `import { loader } from '@keel/router'\nimport { s } from '@keel/schema'\nimport { api } from './${service}'\nexport const loadOrder = loader({ output: s.json() }, (_args, ctx) => api.getOrder({ params: { id: '1' } }, ctx))\n`,
    },
    {
      path: "modules/orders/routes.ts",
      source:
        "import { manifest } from '@keel/router'\nimport { loadOrder } from './loadOrder.server.ts'\nconst Page = () => null\nexport const routes = manifest({ 'orders.show': { path: '/orders', loader: loadOrder, component: Page } })\n",
    },
  ];
  const ran = (service: string) =>
    check(files(service), {
      types: false,
      topology: { web: { modules: ["orders"], adapter: "node" } },
    }).diagnostics.filter((d) => d.code === "E1571" || d.code === "E1004");
  expect(ran("api.server.ts")).toEqual([]);
  expect(ran("api.ts").map((d) => d.code)).toEqual(["E1571"]);
});

it("E1111 reads anyOf members, spreads, namespace imports, re-exports and a const table; it reports what it cannot read", () => {
  const S = "import { s } from '@keel/schema'\n";
  const lib: Files = [
    {
      path: "src/U.schema.ts",
      source: `${S}export const Email = s.string().pii('contact')\nexport const F = { e: Email }\n`,
    },
    { path: "src/index.ts", source: "export { Email as Mail } from './U.schema.ts'\n" },
  ];
  const table = (
    head: string,
    search: string,
    call = "manifest({ 'a.b': { path: '/b', search: SEARCH, component: Page } })",
  ) => [
    ...lib,
    {
      path: "src/routes.ts",
      source: `import { manifest } from '@keel/router'\n${S}${head}const Page = () => null\nconst SEARCH = ${search}\nexport const routes = ${call}\n`,
    },
  ];
  const ran = (files: Files) => codes(files, "E1111").map((d) => d.message.split(";")[0]);
  const marked = "personal data in route search";
  expect(
    ran(table("import { Email } from './U.schema.ts'\n", "s.object({ q: s.union([s.string(), Email]) })")),
  ).toEqual([marked]);
  expect(ran(table("import { F } from './U.schema.ts'\n", "s.object({ ...F })"))).toEqual([marked]);
  expect(ran(table("import * as U from './U.schema.ts'\n", "s.object({ q: U.Email })"))).toEqual([marked]);
  expect(ran(table("import { Mail } from './index.ts'\n", "s.object({ q: Mail.optional() })"))).toEqual([marked]);
  expect(
    ran(
      table(
        "import { Email } from './U.schema.ts'\nconst TABLE = { 'a.b': { path: '/b', search: s.object({ q: Email }), component: () => null } }\n",
        "s.object({})",
        "manifest(TABLE)",
      ),
    ),
  ).toEqual([marked]);
  expect(ran(table("declare function make(): unknown\n", "make()"))).toEqual(["route search not readable statically"]);
  expect(ran(table("", "s.object({ q: s.string() })"))).toEqual([]);
});

it("E1571 reads a const in a template, concatenation, new URL's base, protocol-relative URLs, { net } and a ctx alias", () => {
  const load = (body: string): Files => [
    { path: "src/load.ts", source: `const BASE = 'https://api.example'\nexport const load = (ctx) => {\n${body}\n}\n` },
  ];
  const n = (body: string) => codes(load(body), "E1571").length;
  expect(n("return ctx.net.fetch(`${BASE}/x`)")).toBe(1);
  expect(n("return ctx.net.fetch(BASE + '/x')")).toBe(1);
  expect(n("return ctx.net.fetch(new URL('/x', 'https://api.example'))")).toBe(1);
  expect(n("return ctx.net.fetch('//cdn.example/x')")).toBe(1);
  expect(n("const { net } = ctx\nreturn net.fetch(BASE)")).toBe(1);
  expect(n("const c = ctx\nreturn c.net.fetch(BASE)")).toBe(1);
  expect(n("return ctx.net.fetch(`/x/${BASE}`)")).toBe(0);
  expect(n("return ctx.net.fetch(new URL('/x', location.origin))")).toBe(0);
});

it("E1570 reads a const, a template head, a concatenation and a protocol-relative URL", () => {
  const img = (decl: string, src: string): Files => [
    {
      path: "src/C.tsx",
      source: `import { Image } from '@keel/ui'\n${decl}export default function C() { return <Image src={${src}} alt="x" /> }\n`,
    },
  ];
  const n = (decl: string, src: string) => codes(img(decl, src), "E1570").length;
  expect(n("const CDN = 'https://cdn.example'\n", "CDN")).toBe(1);
  expect(n("const CDN = 'https://cdn.example'\n", "`${CDN}/a.png`")).toBe(1);
  expect(n("const CDN = 'https://cdn.example'\n", "CDN + '/a.png'")).toBe(1);
  expect(n("", "'//cdn.example/a.png'")).toBe(1);
  expect(n("const P = '/a.png'\n", "P")).toBe(0);
});

it("E1111: a package's route table spread into an app manifest is the package's, and a project table's `.routes` is read", () => {
  const S = "import { s } from '@keel/schema'\n";
  const files = (spread: string, head: string): Files => [
    { path: "src/P.schema.ts", source: `${S}export const P = s.object({ e: s.string().pii('contact') })\n` },
    {
      path: "src/other.ts",
      source: `import { manifest } from '@keel/router'\nimport { P } from './P.schema.ts'\nexport const other = manifest({ 'o.x': { path: '/o/:e', params: P, component: () => null } })\n`,
    },
    {
      path: "src/routes.ts",
      source: `import { manifest } from '@keel/router'\n${head}export const routes = manifest({\n  ...${spread},\n  'a.b': { path: '/b', component: () => null },\n})\n`,
    },
  ];
  const ran = (spread: string, head: string) =>
    codes(files(spread, head), "E1111")
      .filter((d) => d.path === "src/routes.ts")
      .map((d) => d.message.split(";")[0]);
  expect(ran("monitorRoutes.routes", "import { monitorRoutes } from '@keel/std-sessions/monitor'\n")).toEqual([]);
  expect(ran("other.routes", "import { other } from './other.ts'\n")).toEqual(["personal data in route params"]);
  expect(ran("make().routes", "declare function make(): { routes: object }\n")).toEqual([
    "route table not readable statically",
  ]);
});
