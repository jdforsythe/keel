// k.privacy E1111, k.security E1570/E1571, k.a11y E1804/E1820: edges the conformance suites do not cover.
import { expect, it } from "vitest";
import { explain } from "../src/explain.ts";
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
        "import { contract } from '@keel/router/contract'\nimport { Q } from './Q.schema.ts'\nexport const a = contract('a', { 'a.b': { path: '/b', search: Q } })\n",
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
  const ran = (service: string, adapter: "node" | "client" = "node") =>
    check(
      [
        ...files(service),
        {
          path: "topology.ts",
          source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['orders'], adapter: '${adapter}' } })\n`,
        },
      ],
      { types: false },
    ).diagnostics.filter((d) => d.code === "E1571" || d.code === "E1004");
  expect(ran("api.server.ts")).toEqual([]);
  expect(ran("api.ts").map((d) => d.code)).toEqual(["E1571"]);
  expect(ran("api.server.ts", "client").map((d) => d.code)).toEqual(["E1571"]);
});

it("E1571's explanation sends the service to a module a node deployable lists, as a client module's *.server.ts file ships", () => {
  const text = explain("E1571");
  expect(text).toContain("a *.server.ts file of a module a node deployable lists");
  expect(text).toContain("in a module only client deployables list it ships");
});

it("E1111 reads anyOf members, spreads, namespace imports and re-exports in a schema; it reports what it cannot read, a const table too", () => {
  const S = "import { s } from '@keel/schema'\n";
  const lib: Files = [
    {
      path: "src/U.schema.ts",
      source: `${S}export const Email = s.string().pii('contact')\nexport const F = { e: Email }\n`,
    },
    { path: "src/index.ts", source: "export { Email as Mail } from './U.schema.ts'\n" },
  ];
  const table = (head: string, search: string, call = "contract('a', { 'a.b': { path: '/b', search: SEARCH } })") => [
    ...lib,
    {
      path: "src/routes.ts",
      source: `import { contract } from '@keel/router/contract'\n${S}${head}const SEARCH = ${search}\nexport const a = ${call}\n`,
    },
  ];
  const ran = (files: Files) => codes(files, "E1111").map((d) => d.message.split(";")[0]);
  const marked = "personal data or a secret in route search";
  expect(
    ran(table("import { Email } from './U.schema.ts'\n", "s.object({ q: s.union([s.string(), Email]) })")),
  ).toEqual([marked]);
  expect(ran(table("import { F } from './U.schema.ts'\n", "s.object({ ...F })"))).toEqual([marked]);
  expect(ran(table("import * as U from './U.schema.ts'\n", "s.object({ q: U.Email })"))).toEqual([marked]);
  expect(ran(table("import { Mail } from './index.ts'\n", "s.object({ q: Mail.optional() })"))).toEqual([marked]);
  expect(
    ran(
      table(
        "import { Email } from './U.schema.ts'\nconst TABLE = { 'a.b': { path: '/b', search: s.object({ q: Email }) } }\n",
        "s.object({})",
        "contract('a', TABLE)",
      ),
    ),
  ).toEqual(["route table not readable statically"]);
  expect(ran(table("declare function make(): unknown\n", "make()"))).toEqual(["route search not readable statically"]);
  expect(ran(table("", "s.object({ q: s.string() })"))).toEqual([]);
});

it("E1111: a search schema from std-tables' audited `tableSearch` is the package's, also through a namespace", () => {
  const routes = (head: string, search: string): Files => [
    {
      path: "src/catalog.ts",
      source: `import { s } from '@keel/schema'\nimport { columns } from '@keel/std-tables'\nexport const catalog = columns(s.object({ email: s.string().pii('contact') }), {})\n`,
    },
    {
      path: "src/routes.ts",
      source: `import { contract } from '@keel/router/contract'\nimport { catalog } from './catalog.ts'\n${head}export const a = contract('a', { 'a.b': { path: '/b', search: ${search} } })\n`,
    },
  ];
  expect(codes(routes("import { tableSearch } from '@keel/std-tables'\n", "tableSearch(catalog)"), "E1111")).toEqual(
    [],
  );
  expect(codes(routes("import * as tables from '@keel/std-tables'\n", "tables.tableSearch(catalog)"), "E1111")).toEqual(
    [],
  );
  expect(codes(routes("import { tableSearch } from './local.ts'\n", "tableSearch(catalog)"), "E1111")).toHaveLength(1);
  expect(codes(routes("import { other } from '@keel/schema'\n", "other(catalog)"), "E1111")).toHaveLength(1);
  // Only audited exports: another std-tables function that embeds the app's schema, and a look-alike package, are read.
  expect(codes(routes("import { tablePage } from '@keel/std-tables'\n", "tablePage(catalog)"), "E1111")).toHaveLength(
    1,
  );
  expect(codes(routes("import { tableSearch } from '@keel/std-evil'\n", "tableSearch(catalog)"), "E1111")).toHaveLength(
    1,
  );
  expect(codes(routes("import * as t from '@keel/std-tables'\n", "t.tablePage(catalog)"), "E1111")).toHaveLength(1);
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

it("E1111: a spread among a contract's entries is unread at it, a package's or a project's, and the entries beside it are read", () => {
  const S = "import { s } from '@keel/schema'\n";
  const files = (spread: string, head: string): Files => [
    { path: "src/P.schema.ts", source: `${S}export const P = s.object({ e: s.string().pii('contact') })\n` },
    {
      path: "src/other.ts",
      source: "import { P } from './P.schema.ts'\nexport const other = { 'o.x': { path: '/o/:e', params: P } }\n",
    },
    {
      path: "src/routes.ts",
      source: `import { contract } from '@keel/router/contract'\n${head}export const a = contract('a', {\n  ...${spread},\n  'a.b': { path: '/b' },\n})\n`,
    },
  ];
  const ran = (spread: string, head: string) =>
    codes(files(spread, head), "E1111")
      .filter((d) => d.path === "src/routes.ts")
      .map((d) => d.message.split(";")[0]);
  const unread = ["route entries not readable statically"];
  expect(ran("entries", "import { entries } from '@keel/std-sessions/contract'\n")).toEqual(unread);
  expect(ran("other", "import { other } from './other.ts'\n")).toEqual(unread);
  expect(ran("make()", "declare function make(): object\n")).toEqual(unread);
});

it("E1111 reports an s.secret node under wrappers and nesting, in params and search, and not in an action input", () => {
  const S = "import { s } from '@keel/schema'\n";
  const route = (def: string): Files => [
    {
      path: "src/routes.ts",
      source: `import { contract } from '@keel/router/contract'\n${S}export const a = contract('a', { 'a.b': { path: '/b/:t', ${def} } })\n`,
    },
  ];
  const ran = (def: string) => codes(route(def), "E1111").map((d) => d.message);
  const hit = (part: string) => [`personal data or a secret in route ${part}; a URL reaches history and logs`];
  expect(ran("params: s.object({ t: s.secret(s.string()).nullable() })")).toEqual(hit("params"));
  expect(ran("search: s.object({ t: s.secret(s.string()).optional().nullable() })")).toEqual(hit("search"));
  expect(ran("params: s.secret(s.object({ t: s.string() }))")).toEqual(hit("params"));
  expect(ran("params: s.object({ a: s.object({ t: s.secret(s.string()) }) })")).toEqual(hit("params"));
  expect(ran("search: s.object({ t: s.array(s.secret(s.string())) })")).toEqual(hit("search"));
  expect(ran("params: s.object({ t: s.string() })")).toEqual([]);
  const withAction: Files = [
    {
      path: "src/save.ts",
      source: `import { action } from '@keel/router'\n${S}import { a } from './routes.ts'\nexport const save = action(a, 'a.b', { input: s.object({ t: s.secret(s.string()) }) }, () => null)\n`,
    },
    {
      path: "src/routes.ts",
      source:
        "import { contract } from '@keel/router/contract'\nexport const a = contract('a', { 'a.b': { path: '/b' } })\n",
    },
  ];
  expect(codes(withAction, "E1111")).toEqual([]);
});

it("E1111 counts `secret` only on the @keel/schema namespace, not on any object with that member", () => {
  const ran = (head: string, search: string): string[] =>
    codes(
      [
        {
          path: "src/routes.ts",
          source: `import { contract } from '@keel/router/contract'\n${head}export const a = contract('a', { 'a.b': { path: '/b', search: ${search} } })\n`,
        },
      ],
      "E1111",
    ).map((d) => d.message.split(";")[0] ?? "");
  const marked = ["personal data or a secret in route search"];
  const schema = "import { s } from '@keel/schema'\n";
  const unread = ["route search not readable statically"];
  // A literal whose member is called is not held (k.privacy-reads Held): the call may change it.
  expect(ran(`${schema}const cfg = { secret: (x) => x }\n`, "s.object({ q: cfg.secret() })")).toEqual(unread);
  expect(ran(`${schema}const kit = { s }\n`, "s.object({ q: kit.s.secret(s.string()) })")).toEqual(marked);
  expect(ran(`${schema}const kit = { s: other }\n`, "s.object({ q: kit.s.secret(s.string()) })")).toEqual(unread);
  expect(ran(`${schema}const kit = { inner: { secret: () => 1 } }\n`, "s.object({ q: kit.inner.secret() })")).toEqual(
    unread,
  );
  expect(ran(`${schema}import { cfg } from 'elsewhere'\n`, "s.object({ q: cfg.secret() })")).toEqual(unread);
  expect(ran(schema, "s.object({ q: other.secret(s.string()) })")).toEqual(unread);
  expect(ran(schema, "s.object({ q: s.secret(s.string()) })")).toEqual(marked);
  expect(ran("import * as k from '@keel/schema'\n", "k.s.object({ q: k.s.secret(k.s.string()) })")).toEqual(marked);
  expect(ran("import * as k from '@keel/schema'\n", "k.secret(k.s.string())")).toEqual(marked);
  expect(ran("import { s as t } from '@keel/schema'\n", "t.secret(t.string())")).toEqual(marked);
  expect(ran(`${schema}const t = s\n`, "t.secret(s.string())")).toEqual(marked);
  expect(ran(`${schema}declare function make(): { secret(): unknown }\n`, "make().secret()")).toEqual([
    "route search not readable statically",
  ]);
});

it("E1111 reads a getter, setter or method in a schema's object literal as unreadable", () => {
  const ran = (params: string): string[] =>
    codes(
      [
        {
          path: "src/routes.ts",
          source: `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const a = contract('a', { 'a.b': { path: '/b/:token', params: ${params} } })\n`,
        },
      ],
      "E1111",
    ).map((d) => d.message.split(";")[0] ?? "");
  const unread = ["route params not readable statically"];
  expect(ran("s.object({ get token() { return s.secret(s.string()) } })")).toEqual(unread);
  expect(ran("s.object({ get token() { return s.string() } })")).toEqual(unread);
  expect(ran("s.object({ set token(v) {}, token: s.string() })")).toEqual(unread);
  expect(ran("s.object({ token() { return s.secret(s.string()) } })")).toEqual(unread);
  expect(ran("s.object({ token: s.string() })")).toEqual([]);
  expect(ran("s.object({ ['token']: s.string() })")).toEqual([]);
});

it("E1111 reads a literal binding that is not held as unread, in the route table and in a schema", () => {
  const ran = (head: string, search: string, tail = "") =>
    codes(
      [
        {
          path: "src/routes.ts",
          source: `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\n${head}\nexport const a = contract('a', { 'a.b': { path: '/b', search: ${search} } })\n${tail}`,
        },
      ],
      "E1111",
    ).map((d) => d.message.split(";")[0]);
  const unread = "route search not readable statically";
  const base = "const FIELDS = { q: s.string() }\n";
  expect(ran(base, "s.object(FIELDS)")).toEqual([]);
  for (const change of [
    "FIELDS.token = s.secret()",
    "FIELDS['token'] = s.string().pii('contact')",
    "Object.assign(FIELDS, { token: s.secret() })",
    "Object.defineProperty(FIELDS, 'token', { value: s.secret(), enumerable: true })",
    "Object.defineProperties(FIELDS, {})",
  ]) {
    expect(ran(`${base}${change}\n`, "s.object(FIELDS)")).toEqual([unread]);
    expect(ran(base, "s.object(FIELDS)", `${change}\n`)).toEqual([unread]);
  }
  // A schema value is frozen (k.schema Frozen), so a call given it changes nothing the read took.
  expect(ran("const S = s.object({ q: s.string() })\nObject.assign(S, {})\n", "S")).toEqual([]);
  expect(
    ran("const DEF = { path: '/c', search: s.object({}) }\nDEF.search = s.object({ t: s.secret() })\n", "DEF.search"),
  ).toEqual([unread]);
  // Changing another binding stays clean; passing the binding to any call but `s.<name>(…)` leaves it not held.
  expect(ran(`${base}const OTHER = {}\nOTHER.x = 1\n`, "s.object(FIELDS)")).toEqual([]);
  expect(ran(`${base}const OTHER = {}\nObject.assign(OTHER, FIELDS)\n`, "s.object(FIELDS)")).toEqual([unread]);
  expect(ran(`${base}console.log(FIELDS.q)\n`, "s.object(FIELDS)")).toEqual([unread]);
});

it("E1570 reads `/\\host` and `\\\\host` as the absolute URLs a browser makes of them, any slash mix", () => {
  const n = (src: string) => codes(C(`<img src="${src}" />`), "E1570").length;
  for (const src of ["/\\evil.example/x", "\\\\evil.example/x", "\\/evil.example/x", "https:\\\\evil.example/x"])
    expect(n(src), src).toBe(1);
  expect(n("/a.png")).toBe(0);
  expect(n("\\a.png")).toBe(0);
  const frame = (src: string) =>
    codes(
      [
        {
          path: "src/F.tsx",
          source: `import { Frame } from '@keel/ui'\nexport default function F() { return <Frame src="${src}" title="v" /> }\n`,
        },
      ],
      "E1570",
    ).length;
  expect(frame("/\\evil.example/e")).toBe(1);
});

it("E1805 on a raw <iframe> names Frame", () => {
  const d = check(
    [{ path: "src/F.tsx", source: 'export default function F() { return <iframe src="x" title="t" /> }\n' }],
    {
      types: false,
    },
  ).diagnostics.filter((x) => x.code === "E1805");
  expect(d.map((x) => x.message)).toEqual(["<iframe> in app code; use <Frame> from @keel/ui"]);
});
