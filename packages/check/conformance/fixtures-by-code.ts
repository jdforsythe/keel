// Not a test file. One triggering fixture and one clean counterpart per kernel E code `check()` reports
// (`reportedCodes()`, RFC 0065), E1756 aside (a registered rule that throws). Public API only.
import { fileURLToPath } from "node:url";
import type { check } from "@keel/check";
import type { Files } from "./support.ts";

type Options = NonNullable<Parameters<typeof check>[1]>;

export interface CodeFixture {
  /** Options for both runs; `{ types: false }` skips the type pass for fixtures whose imports resolve only on disk. */
  opts?: Options;
  badOpts?: Options;
  cleanOpts?: Options;
  bad: Files;
  clean: Files;
}

const f = (path: string, source: string): Files[number] => ({ path, source });
const UI = "import { Box, Text, Button } from '@keel/ui'\n";
const SCHEMA = "import { s } from '@keel/schema'\n";
const SERVICES = "import { endpoints } from '@keel/services'\n";
const UNSAFE = "unsafe"; // built so this file's own lint does not read fixture text as a call
const manifest = (id: string, extra = ""): Files[number] =>
  f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] }${extra} })\n`,
  );
const mod = (
  id: string,
  deps: string[],
  exports: string[],
  routes: string[] = [],
  caps: string[] = [],
): Files[number] => {
  const q = (xs: string[]): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;
  return f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${q(deps)}, capabilities: ${q(caps)}, public: { exports: ${q(exports)}, routes: ${q(routes)} } })\n`,
  );
};
const routes = (id: string, ids: string[]): Files[number] =>
  f(
    `modules/${id}/routes.ts`,
    `import { manifest } from '@keel/router'\nconst Page = () => null\nexport const routes = manifest({\n${ids.map((r) => `  '${r}': { path: '/${r.replace(/\./g, "/")}', component: Page },`).join("\n")}\n})\n`,
  );
const exp = (id: string, name: string): Files[number] => f(`modules/${id}/${name}.ts`, `export const ${name} = 1\n`);
const use = (id: string, from: string, name: string): Files[number] =>
  f(`modules/${id}/Use.ts`, `import { ${name} } from '../${from}/${name}.ts'\nexport const Use = ${name}\n`);

const NO_TYPES: Options = { types: false };
const IMPORT = "import { serverState } from '@keel/store/internal'\nexport const x = serverState\n";
/** A root where `@keel/router` resolves, for fixtures whose rule reads real types (E1510). */
const ROUTER_ROOT = fileURLToPath(new URL("../../router/", import.meta.url));
const apiRoutes = (entries: string): Files[number] =>
  f(
    "modules/a/routes.ts",
    `import { manifest } from '@keel/router'\ndeclare const Page: () => Node\nexport const routes = manifest({ ${entries} })\n`,
  );
/** A union prop for E1402 (k.component: one `Case` per variant). */
const MATCH = `${SCHEMA}import { Match, Case } from '@keel/runtime-dom'\nexport const Props = s.object({ shape: s.union('kind', [s.object({ kind: s.literal('circle') }), s.object({ kind: s.literal('square') })]) })\n`;
/** Color tokens for E1804: `mid` on `white` is about 3:1, `ink` on `white` passes 4.5:1 in both schemes. */
const TOKENS = { color: { mid: "#949494", ink: "#111111", white: "#ffffff" }, fontSize: { sm: "14px" } };

/** A `.keel/surface.json` (k.compat) over `data`: canonical `{ data, hash }`, the hash the compiler's FNV-1a of it. */
const surfaceFile = (data: unknown): Files[number] => {
  const canon = (v: unknown): string =>
    JSON.stringify(v, (_k, x: unknown) =>
      x === null || typeof x !== "object" || Array.isArray(x)
        ? x
        : Object.fromEntries(
            Object.keys(x)
              .sort()
              .map((k) => [k, Reflect.get(x, k)]),
          ),
    );
  let h = 0x811c9dc5;
  for (const ch of canon(data))
    for (let i = 0; i < ch.length; i++) h = Math.imul(h ^ ch.charCodeAt(i), 0x01000193) >>> 0;
  return f(".keel/surface.json", `${canon({ data, hash: `fnv1a:${h.toString(16).padStart(8, "0")}` })}\n`);
};
const ANSWER = {
  type: "object",
  properties: { ok: { const: true }, value: { anyOf: [{ type: "string" }, { type: "null" }] } },
  required: ["ok", "value"],
  additionalProperties: false,
};
const fields = (...names: string[]) => ({
  type: "object",
  properties: Object.fromEntries(names.map((n) => [n, { type: "string" }])),
  required: names,
});
/** A surface with no routes or services and one store `m.s` of state `state` and transactions `txs`. */
const storesSurface = (state: unknown, txs: Record<string, unknown>) => ({
  routes: {},
  services: [],
  stores: { "m.s": { state, transactions: txs } },
});
/** Module `a` calls `POST /y/save` of module `y` with `body`; the route's action input is `input`. */
const surfaceOf = (input: unknown, body: unknown) => ({
  routes: {
    "y.save": {
      module: "y",
      path: "/y/save",
      file: "modules/y/routes.ts",
      params: null,
      search: null,
      get: {},
      actions: { POST: { input, answer: ANSWER } },
    },
  },
  services: [
    {
      file: "modules/a/api.ts",
      caller: "a",
      module: "y",
      endpoints: {
        save: { method: "POST", path: "/y/save", params: null, query: null, body, output: ANSWER, errors: {} },
      },
    },
  ],
  sources: {},
});
const SPLIT = {
  x: { modules: ["a"], adapter: "node" },
  y: { modules: ["y"], adapter: "node" },
} as const;

/** Module `b` serves `GET /b/pub` with a loader; module `a` calls `/b/pub` through `service({ base: <base> })`. */
const sameAppService = (base: string): Files => [
  mod("b", [], ["routes"], ["b.pub"]),
  f(
    "modules/b/routes.ts",
    "import { manifest } from '@keel/router'\nexport const routes = manifest({ 'b.pub': { api: true, path: '/b/pub' } })\n",
  ),
  mod("a", ["b"], []),
  f(
    "modules/a/BApi.schema.ts",
    `${SERVICES}${SCHEMA}export const BApi = endpoints({ get: { method: 'GET', path: '/b/pub', output: s.json() } })\n`,
  ),
  f(
    "modules/a/api.ts",
    `import { service } from '@keel/services'\nimport { BApi } from './BApi.schema.ts'\ndeclare const origin: string\nexport const api = service({ base: ${base}, schema: BApi })\n`,
  ),
];

export const CODE_FIXTURES: Readonly<Record<string, CodeFixture>> = {
  E1000: { bad: [f("a.ts", "export const = ;\n")], clean: [f("a.ts", "export const a = 1\n")] },
  E1001: {
    bad: [
      f(
        "C.tsx",
        `${UI}import { For } from '@keel/runtime-dom'\nexport default function C(props: { items: { id: string }[] }) { return <Box as="ul"><For each={props.items}>{(i) => <Box as="li">{i.id}</Box>}</For></Box> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `${UI}import { For } from '@keel/runtime-dom'\nexport default function C(props: { items: { id: string }[] }) { return <Box as="ul"><For each={props.items} key="id">{(i) => <Box as="li">{i.id}</Box>}</For></Box> }\n`,
      ),
    ],
  },
  E1002: {
    opts: NO_TYPES,
    bad: [f("src/put.ts", "export const put = (el: { innerHTML: string }) => { el.innerHTML = 'x' }\n")],
    clean: [f("src/put.ts", "export const put = (el: { textContent: string }) => { el.textContent = 'x' }\n")],
  },
  E1003: {
    bad: [
      f(
        "C.tsx",
        `${UI}import { Image } from '@keel/ui'\nexport default function C() { return <Image src="javascript:alert(1)" alt="x" /> }\n`,
      ),
    ],
    clean: [
      f("C.tsx", `${UI}import { Image } from '@keel/ui'\nexport default function C() { return <Image alt="x" /> }\n`),
    ],
  },
  E1004: {
    opts: NO_TYPES,
    bad: [
      f("db.server.ts", "export const db = 1\n"),
      f(
        "C.tsx",
        `import { Text } from '@keel/ui'\nimport { db } from './db.server'\nexport default function C() { return <Text>{db}</Text> }\n`,
      ),
    ],
    clean: [
      f("db.server.ts", "export const db = 1\n"),
      f("api.server.ts", `import { db } from './db.server'\nexport const api = db\n`),
    ],
  },
  E1104: {
    bad: [f("src/User.ts", `${SCHEMA}export const User = s.object({ name: s.string() })\n`)],
    clean: [f("src/User.schema.ts", `${SCHEMA}export const User = s.object({ name: s.string() })\n`)],
  },
  E1105: {
    opts: NO_TYPES,
    bad: [manifest("app"), f("modules/app/x.ts", `import { reveal } from '@keel/schema'\nexport const x = reveal\n`)],
    clean: [
      manifest("app"),
      f("modules/app/x.server.ts", `import { reveal } from '@keel/schema'\nexport const x = reveal\n`),
    ],
  },
  E1106: {
    opts: NO_TYPES,
    bad: [
      f(
        "modules/app/Even.schema.ts",
        `${SCHEMA}export const Even = s.format('even', s.int(), { check: (v) => v % 2 === 0, gen: { from: s.int(), map: (n) => n * 2 } })\n`,
      ),
    ],
    clean: [f("modules/app/Count.schema.ts", `${SCHEMA}export const Count = s.int({ min: 0 })\n`)],
  },
  E1005: {
    bad: [
      f(".keel/ids.json", '{"data":{"C.0":{"col":1}},"hash":"fnv1a:00000000"}\n'),
      f(".keel/x.json", '{"hash":"abc"}'),
    ],
    clean: [],
  },
  E1111: {
    opts: NO_TYPES,
    bad: [
      manifest("app"),
      f(
        "modules/app/Params.schema.ts",
        `${SCHEMA}export const Params = s.object({ email: s.string().pii('contact') })\n`,
      ),
      f(
        "modules/app/routes.ts",
        "import { manifest } from '@keel/router'\nimport { Params } from './Params.schema.ts'\nconst Page = () => null\nexport const routes = manifest({ 'app.show': { path: '/show/:email', params: Params, component: Page } })\n",
      ),
    ],
    clean: [
      manifest("app"),
      f("modules/app/Params.schema.ts", `${SCHEMA}export const Params = s.object({ email: s.string() })\n`),
      f(
        "modules/app/routes.ts",
        "import { manifest } from '@keel/router'\nimport { Params } from './Params.schema.ts'\nconst Page = () => null\nexport const routes = manifest({ 'app.show': { path: '/show/:email', params: Params, component: Page } })\n",
      ),
    ],
  },
  E1112: {
    opts: NO_TYPES,
    bad: [
      manifest("app"),
      f(
        "modules/app/x.server.ts",
        "import { reveal } from '@keel/schema'\nimport { tx } from '@keel/store'\nconst copy = {}\nexport function action(p) {\n  tx(copy, { t: reveal(p.k) })\n}\n",
      ),
    ],
    clean: [
      manifest("app"),
      f(
        "modules/app/x.server.ts",
        "import { reveal } from '@keel/schema'\nimport { tx } from '@keel/store'\nconst copy = {}\nconst hash = (x) => x.length\nexport function action(p) {\n  tx(copy, { t: hash(reveal(p.k)) })\n}\n",
      ),
    ],
  },
  E1151: {
    opts: NO_TYPES,
    bad: [mod("b", [], []), exp("b", "Secret"), mod("a", ["b"], []), use("a", "b", "Secret")],
    clean: [mod("b", [], ["Secret"]), exp("b", "Secret"), mod("a", ["b"], []), use("a", "b", "Secret")],
  },
  E1152: {
    opts: NO_TYPES,
    bad: [mod("b", [], ["Pub"]), exp("b", "Pub"), mod("a", [], []), use("a", "b", "Pub")],
    clean: [mod("b", [], ["Pub"]), exp("b", "Pub"), mod("a", ["b"], []), use("a", "b", "Pub")],
  },
  E1153: { bad: [mod("a", ["b"], []), mod("b", ["a"], [])], clean: [mod("a", ["b"], []), mod("b", [], [])] },
  E1154: { bad: [mod("a", [], ["Ghost"])], clean: [mod("a", [], ["Ghost"]), exp("a", "Ghost")] },
  E1155: {
    opts: NO_TYPES,
    bad: [manifest("orders"), routes("orders", ["show"])],
    clean: [manifest("orders"), routes("orders", ["orders.show"])],
  },
  E1156: {
    bad: [
      mod("a", [], []),
      f("modules/a/Run.ts", "import type { Ctx } from '@keel/ctx'\nexport const Run = (ctx: Ctx) => ctx.clock.now()\n"),
    ],
    clean: [
      mod("a", [], [], [], ["clock"]),
      f("modules/a/Run.ts", "import type { Ctx } from '@keel/ctx'\nexport const Run = (ctx: Ctx) => ctx.clock.now()\n"),
    ],
  },
  E1157: {
    opts: NO_TYPES,
    bad: [
      mod("b", [], ["routes"], ["b.pub"]),
      routes("b", ["b.pub", "b.priv"]),
      mod("a", ["b"], []),
      f("modules/a/Back.ts", "import { routes } from '../b/routes.ts'\nexport const Back = routes.href('b.priv')\n"),
    ],
    clean: [
      mod("b", [], ["routes"], ["b.pub"]),
      routes("b", ["b.pub", "b.priv"]),
      mod("a", ["b"], []),
      f("modules/a/Back.ts", "import { routes } from '../b/routes.ts'\nexport const Back = routes.href('b.pub')\n"),
    ],
  },
  E1158: {
    opts: NO_TYPES,
    bad: [
      f(
        "modules/a/module.ts",
        "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [], routes: [] }, std: { '@keel/std-fixture': { limit: 1 } } })\n",
      ),
    ],
    clean: [
      f(
        "modules/a/module.ts",
        "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: ['@keel/std-fixture'], capabilities: [], public: { exports: [], routes: [] }, std: { '@keel/std-fixture': { limit: 1 } } })\n",
      ),
    ],
  },
  E1204: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `${UI}import { resource } from '@keel/reactive'\nexport default function C() { const r = resource(() => Promise.resolve(1)); return <Text>{r.get().state}</Text> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `${UI}import { resource } from '@keel/reactive'\nimport { Case, Match } from '@keel/runtime-dom'\nexport default function C() { const r = resource(() => Promise.resolve(1)); return <Match on={r.get()}><Case tag="ready">{() => <Text>ok</Text>}</Case></Match> }\n`,
      ),
    ],
  },
  E1207: {
    opts: NO_TYPES,
    bad: [
      manifest("app"),
      f(
        "modules/app/Work.ts",
        "import { scope } from '@keel/reactive'\nexport const Work = scope(() => {}, { detached: true })\n",
      ),
    ],
    clean: [
      manifest("app"),
      f(
        "modules/app/Work.ts",
        "import { scope } from '@keel/reactive'\nexport const Work = scope(() => {}, { onError: () => {} })\n",
      ),
    ],
  },
  E1251: {
    opts: NO_TYPES,
    bad: [f("src/x.ts", "import { template } from '@keel/runtime-dom/ops'\nexport const x = template\n")],
    clean: [f("src/x.ts", "import { For } from '@keel/runtime-dom'\nexport const x = For\n")],
  },
  E1252: {
    opts: NO_TYPES,
    bad: [f("src/title.ts", "export const title = (): string => document.title\n")],
    clean: [f("src/title.ts", "export const title = (page: { title: string }): string => page.title\n")],
  },
  E1302: {
    opts: NO_TYPES,
    bad: [
      f(
        "src/greet.ts",
        "import { transaction } from '@keel/store'\ndeclare const app: unknown\nexport const greet = transaction(app, 'greet', (s: string) => s + navigator.userAgent)\n",
      ),
    ],
    clean: [
      f(
        "src/greet.ts",
        "import { transaction } from '@keel/store'\ndeclare const app: unknown\nexport const greet = transaction(app, 'greet', (s: string) => `${s}!`)\n",
      ),
    ],
  },
  E1303: {
    opts: NO_TYPES,
    bad: [
      manifest("app"),
      f(
        "modules/app/State.schema.ts",
        `${SCHEMA}export const State = s.object({ creds: s.object({ token: s.secret(s.string()) }) })\n`,
      ),
      f(
        "modules/app/cart.ts",
        "import { store } from '@keel/store'\nimport { State } from './State.schema.ts'\nexport const cart = store(State, { creds: { token: '' } })\n",
      ),
    ],
    clean: [
      manifest("app"),
      f(
        "modules/app/State.schema.ts",
        `${SCHEMA}export const State = s.object({ creds: s.object({ token: s.string() }) })\n`,
      ),
      f(
        "modules/app/cart.ts",
        "import { store } from '@keel/store'\nimport { State } from './State.schema.ts'\nexport const cart = store(State, { creds: { token: '' } })\n",
      ),
    ],
  },
  E1401: {
    opts: NO_TYPES,
    bad: [f("C.tsx", `${UI}export default function C({ name }: { name: string }) { return <Text>{name}</Text> }\n`)],
    clean: [
      f("C.tsx", `${UI}export default function C(props: { name: string }) { return <Text>{props.name}</Text> }\n`),
    ],
  },
  E1402: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `${UI}${MATCH}export default function C(props) { return <Match on={props.shape}><Case tag="circle"><Text>c</Text></Case></Match> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `${UI}${MATCH}export default function C(props) { return <Match on={props.shape}><Case tag="circle"><Text>c</Text></Case><Case tag="square"><Text>s</Text></Case></Match> }\n`,
      ),
    ],
  },
  E1403: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `${UI}export default function C(props: { a: boolean }) { return <Box>{props.a && <Text>x</Text>}</Box> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `${UI}import { If } from '@keel/runtime-dom'\nexport default function C(props: { a: boolean }) { return <Box><If when={props.a}><Text>x</Text></If></Box> }\n`,
      ),
    ],
  },
  E1404: {
    opts: NO_TYPES,
    bad: [
      f("C.tsx", `${UI}export default function C() { return <Box><Box id="x">1</Box><Box id="x">2</Box></Box> }\n`),
    ],
    clean: [
      f("C.tsx", `${UI}export default function C() { return <Box><Box id="x">1</Box><Box id="y">2</Box></Box> }\n`),
    ],
  },
  E1405: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `${UI}export default function C(props: { label: string }) { const label = props.label; return <Text>{label}</Text> }\n`,
      ),
    ],
    clean: [
      f("C.tsx", `${UI}export default function C(props: { label: string }) { return <Text>{props.label}</Text> }\n`),
    ],
  },
  E1451: {
    bad: [f("src/f.ts", "export function f(n: number) {\n  if (n < 0) throw new Error('neg')\n  return n\n}\n")],
    clean: [f("src/f.ts", "export function f(n: number) {\n  return n\n}\n")],
  },
  E1452: {
    bad: [f("src/f.ts", "export const f = (p: Promise<number>) => p.catch(() => 0)\n")],
    clean: [f("src/f.ts", "export const f = (p: Promise<number>) => p\n")],
  },
  E1453: {
    bad: [
      f(
        "src/f.ts",
        "import { ok, type Result } from '@keel/schema'\nconst save = (): Result<number, string> => ok(1)\nsave()\n",
      ),
    ],
    clean: [
      f(
        "src/f.ts",
        "import { ok, type Result } from '@keel/schema'\nconst save = (): Result<number, string> => ok(1)\nconst r = save()\nvoid r\n",
      ),
    ],
  },
  E1454: {
    bad: [
      f("src/a.schema.ts", `${SCHEMA}export const a = s.error('orders.locked', s.object({}))\n`),
      f("src/b.schema.ts", `${SCHEMA}export const b = s.error('orders.locked', s.object({}))\n`),
    ],
    clean: [
      f("src/a.schema.ts", `${SCHEMA}export const a = s.error('orders.locked', s.object({}))\n`),
      f("src/b.schema.ts", `${SCHEMA}export const b = s.error('orders.closed', s.object({}))\n`),
    ],
  },
  E1501: {
    bad: [
      f(
        "C.tsx",
        `${UI}import { Link } from '@keel/ui'\nexport default function C() { return <Link to="/orders">x</Link> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `${UI}import { Link } from '@keel/ui'\nimport { manifest } from '@keel/router'\nconst Page = () => null\nconst routes = manifest({ 'orders.list': { path: '/orders', component: Page } })\nexport default function C() { return <Link to={routes.href('orders.list')}>x</Link> }\n`,
      ),
    ],
  },
  E1507: {
    opts: NO_TYPES,
    bad: [
      f(
        "src/load.server.ts",
        "import { loader } from '@keel/router'\ndeclare const Out: unknown\nexport const load = loader({ output: Out }, async ({ params }: { params: unknown }) => params)\n",
      ),
    ],
    clean: [
      f(
        "src/load.server.ts",
        "import { loader } from '@keel/router'\ndeclare const Out: unknown\nexport const load = loader({ output: Out }, async ({ params }) => params)\n",
      ),
    ],
  },
  E1510: {
    opts: { root: ROUTER_ROOT },
    bad: [apiRoutes("'a.list': { api: true, path: '/api/list', component: Page }")],
    clean: [apiRoutes("'a.list': { api: true, path: '/api/list' }, 'a.home': { path: '/', component: Page }")],
  },
  E1511: {
    badOpts: { ...NO_TYPES, topology: { web: { modules: ["a"], adapter: "client" } } },
    cleanOpts: { ...NO_TYPES, topology: { api: { modules: ["a"], adapter: "node" } } },
    bad: [apiRoutes("'a.list': { api: true, path: '/api/list' }")],
    clean: [apiRoutes("'a.list': { api: true, path: '/api/list' }")],
  },
  E1566: {
    badOpts: {
      ...NO_TYPES,
      topology: { api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client", host: "web" } },
    },
    cleanOpts: {
      ...NO_TYPES,
      topology: { api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client", host: "api" } },
    },
    bad: [f("modules/w/x.ts", "export const x = 1;\n")],
    clean: [f("modules/w/x.ts", "export const x = 1;\n")],
  },
  E1572: {
    opts: NO_TYPES,
    bad: [
      f(
        "package.json",
        `${JSON.stringify({ name: "fx", private: true, dependencies: { "@keel/server": "*" } }, null, 2)}\n`,
      ),
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['app'], adapter: 'node', storage: 'sqlite' } })\n",
      ),
      manifest("app"),
    ],
    clean: [
      f(
        "package.json",
        `${JSON.stringify({ name: "fx", private: true, dependencies: { "@keel/server": "*", "@keel/std-db": "*" } }, null, 2)}\n`,
      ),
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['app'], adapter: 'node', storage: 'sqlite' } })\n",
      ),
      manifest("app"),
    ],
  },
  E1573: {
    opts: NO_TYPES,
    bad: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['app'], adapter: 'client', shells: { tauri: { id: 'golden', name: 'Golden' } } } })\n",
      ),
      manifest("app"),
    ],
    clean: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['app'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } } })\n",
      ),
      manifest("app"),
    ],
  },
  E1561: {
    bad: [surfaceFile(surfaceOf(fields("name", "note"), fields("name")))],
    clean: [surfaceFile(surfaceOf(fields("name", "note"), fields("name", "note")))],
  },
  E1562: {
    badOpts: { base: surfaceOf(fields("name"), fields("name")), topology: SPLIT },
    cleanOpts: {
      base: surfaceOf(fields("name"), fields("name")),
      topology: { x: { modules: ["a", "y"], adapter: "node" } },
    },
    bad: [surfaceFile(surfaceOf(fields("name", "note"), fields("name", "note")))],
    clean: [surfaceFile(surfaceOf(fields("name", "note"), fields("name", "note")))],
  },
  E1563: {
    badOpts: { base: storesSurface(fields("a"), {}) },
    cleanOpts: { base: storesSurface(fields("a"), {}) },
    bad: [surfaceFile(storesSurface(fields("a", "b"), {}))],
    clean: [surfaceFile(storesSurface(fields("a"), {}))],
  },
  // E1567 (rfc:0092 B6): module `b` serves GET `/b/pub` (loader, `public.routes`); module `a` calls it through `service({ base })`.
  // Assumption: `a` lists `b` in `deps` so no other code reports; the callers' `schema` is a sibling `*.schema.ts` of literals, as in module-service-E1152-E1157.test.ts; the rule matches the endpoint's method and `samePath` to a route literal (the RFC does not say the route needs a loader).
  E1567: {
    opts: NO_TYPES,
    bad: sameAppService("origin"),
    clean: sameAppService("'https://api.example.com'"),
  },
  E1508: {
    opts: NO_TYPES,
    bad: [
      f(
        "src/auth.guard.ts",
        "import { guard } from '@keel/router'\nimport { ok } from '@keel/schema'\nexport const auth = guard({ redirect: 'app.login' }, async () => ok(null))\n",
      ),
      f(
        "src/routes.ts",
        "import { manifest } from '@keel/router'\nimport { auth } from './auth.guard.ts'\nconst Page = () => null\nexport const routes = manifest({\n  'app.shell': { component: Page, guard: auth },\n  'app.login': { path: '/login', component: Page, layout: 'app.shell' },\n})\n",
      ),
    ],
    clean: [
      f(
        "src/auth.guard.ts",
        "import { guard } from '@keel/router'\nimport { ok } from '@keel/schema'\nexport const auth = guard({ redirect: 'app.login' }, async () => ok(null))\n",
      ),
      f(
        "src/routes.ts",
        "import { manifest } from '@keel/router'\nimport { auth } from './auth.guard.ts'\nconst Page = () => null\nexport const routes = manifest({\n  'app.shell': { component: Page, guard: auth },\n  'app.home': { path: '/', component: Page, layout: 'app.shell' },\n  'app.login': { path: '/login', component: Page },\n})\n",
      ),
    ],
  },
  E1509: {
    opts: NO_TYPES,
    bad: [
      f(
        "src/Locale.schema.ts",
        `${SCHEMA}export const Locale = s.enum(['en-US', 'de-DE'], { pathDefault: 'en-US' })\n`,
      ),
      f(
        "src/routes.ts",
        `import { manifest } from '@keel/router'\n${SCHEMA}import { Locale } from './Locale.schema.ts'\nconst Page = () => null\nexport const routes = manifest({\n  'app.home': { path: '/:locale', params: s.object({ locale: Locale }), component: Page },\n  'app.about': { path: '/about', component: Page },\n  'app.de': { path: '/de-DE/x', component: Page },\n})\n`,
      ),
    ],
    clean: [
      f(
        "src/Locale.schema.ts",
        `${SCHEMA}export const Locale = s.enum(['en-US', 'de-DE'], { pathDefault: 'en-US' })\n`,
      ),
      f(
        "src/routes.ts",
        `import { manifest } from '@keel/router'\n${SCHEMA}import { Locale } from './Locale.schema.ts'\nconst Page = () => null\nexport const routes = manifest({\n  'app.home': { path: '/:locale', params: s.object({ locale: Locale }), component: Page },\n  'app.about': { path: '/:locale/about', params: s.object({ locale: Locale }), component: Page },\n})\n`,
      ),
    ],
  },
  E1551: {
    opts: NO_TYPES,
    bad: [
      f(
        "src/load.ts",
        "import { loader } from '@keel/router'\ndeclare const Out: unknown\nexport const load = loader({ output: Out }, async () => 1)\n",
      ),
    ],
    clean: [
      f(
        "src/load.server.ts",
        "import { loader } from '@keel/router'\ndeclare const Out: unknown\nexport const load = loader({ output: Out }, async () => 1)\n",
      ),
    ],
  },
  E1570: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `import { Image } from '@keel/ui'\nexport default function C() { return <Image src="https://cdn.example/a.png" alt="x" /> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `import { Image } from '@keel/ui'\nexport default function C() { return <Image src="/a.png" alt="x" /> }\n`,
      ),
    ],
  },
  E1571: {
    opts: NO_TYPES,
    bad: [
      f(
        "modules/a/Api.schema.ts",
        `${SERVICES}${SCHEMA}export const Api = endpoints({ get: { method: 'GET', path: '/x', output: s.json() } })\n`,
      ),
      f(
        "modules/a/api.ts",
        "import { service } from '@keel/services'\nimport { Api } from './Api.schema.ts'\nexport const api = service({ base: 'https://api.example.com', schema: Api })\n",
      ),
    ],
    clean: [
      f(
        "modules/a/Api.schema.ts",
        `${SERVICES}${SCHEMA}export const Api = endpoints({ get: { method: 'GET', path: '/x', output: s.json() } })\n`,
      ),
      f(
        "modules/a/api.server.ts",
        "import { service } from '@keel/services'\nimport { Api } from './Api.schema.ts'\nexport const api = service({ base: 'https://api.example.com', schema: Api })\n",
      ),
    ],
  },
  E1576: {
    opts: NO_TYPES,
    bad: [f("modules/a/x.ts", IMPORT)],
    clean: [f("packages/std-x/src/a.ts", IMPORT)],
  },
  E1601: {
    bad: [f("src/id.ts", "export const id = () => crypto.randomUUID()\n")],
    clean: [
      f("src/id.ts", "export const id = (ctx: { random: { id(brand: string): string } }) => ctx.random.id('Order')\n"),
    ],
  },
  E1603: {
    opts: NO_TYPES,
    bad: [f("src/run.ts", "export const run = (s: string) => eval(s)\n")],
    clean: [f("src/run.ts", "export const run = (s: string) => s\n")],
  },
  E1701: {
    bad: [f("test/cart.test.ts", "const el = document.querySelector('#total')\nvoid el\n")],
    clean: [f("test/cart.test.ts", "const t = { find: (id: string) => id }\nvoid t.find('cart.total')\n")],
  },
  E1651: {
    opts: NO_TYPES,
    bad: [
      f(
        "src/load.ts",
        "export const load = (ctx: { net: { fetch: (u: string) => unknown } }) => ctx.net.fetch('/orders')\n",
      ),
    ],
    clean: [f("src/load.ts", "export const load = (api: { list: () => unknown }) => api.list()\n")],
  },
  E1652: {
    opts: NO_TYPES,
    bad: [
      f(
        "src/Api.ts",
        `${SERVICES}${SCHEMA}export const Api = endpoints({ getOrder: { method: 'GET', path: '/orders/:id', params: s.object({ id: s.string(), extra: s.string() }), output: s.string() } })\n`,
      ),
    ],
    clean: [
      f(
        "src/Api.ts",
        `${SERVICES}${SCHEMA}export const Api = endpoints({ getOrder: { method: 'GET', path: '/orders/:id', params: s.object({ id: s.string() }), output: s.string() } })\n`,
      ),
    ],
  },
  E1653: {
    opts: NO_TYPES,
    bad: [
      f(
        "src/Api.ts",
        `${SERVICES}${SCHEMA}export const Api = endpoints({ list: { method: 'GET', path: '/orders', body: s.string(), output: s.string() } })\n`,
      ),
    ],
    clean: [
      f(
        "src/Api.ts",
        `${SERVICES}${SCHEMA}export const Api = endpoints({ add: { method: 'POST', path: '/orders', body: s.string(), output: s.string() } })\n`,
      ),
    ],
  },
  E1751: {
    bad: [f("src/a.ts", 'export const a: number = "text"\n')],
    clean: [f("src/a.ts", "export const a: number = 1\n")],
  },
  E1752: {
    bad: [f("src/a.ts", "export const a = 1\nexport const b = 2\n")],
    clean: [f("src/a.ts", "export const a = 1\n")],
  },
  E1753: {
    opts: NO_TYPES,
    bad: [f("src/rule.ts", "defineRule({ code: 'E1999', message: 'm', explain: 'e', check: () => [] })\n")],
    clean: [f("src/rule.ts", "defineRule({ code: 'E2001', message: 'm', explain: 'e', check: () => [] })\n")],
  },
  E1754: {
    opts: NO_TYPES,
    bad: [f("src/x.ts", `export const x = ${UNSAFE}(() => 1)\n`)],
    clean: [f("src/x.ts", `export const x = ${UNSAFE}('reason', () => 1)\n`)],
  },
  E1755: {
    bad: [],
    clean: [],
    badOpts: { budgets: [{ id: "check.injected10", limit: 600, actual: 640, unit: "tokens" }] },
    cleanOpts: { budgets: [{ id: "check.injected10", limit: 600, actual: 500, unit: "tokens" }] },
  },
  E1757: {
    bad: [f("src/x.ts", "declare const m: { a?: number }\nexport const x: any = m.a!\n")],
    clean: [f("src/x.ts", "declare const m: { a?: number }\nexport const x: unknown = m.a\n")],
  },
  E1758: {
    opts: NO_TYPES,
    bad: [f("src/x.ts", "export const x = (n: number) => n.toLocaleString()\n")],
    clean: [f("src/x.ts", "export const x = (n: number, l: string) => n.toLocaleString(l)\n")],
  },
  E1802: {
    bad: [f("C.tsx", `${UI}export default function C() { return <Button /> }\n`)],
    clean: [f("C.tsx", `${UI}export default function C() { return <Button>Save</Button> }\n`)],
  },
  E1803: {
    opts: NO_TYPES,
    bad: [f("C.tsx", `${UI}export default function C() { return <Box style={{}}>x</Box> }\n`)],
    clean: [f("C.tsx", `${UI}export default function C() { return <Box p="2">x</Box> }\n`)],
  },
  E1804: {
    opts: { types: false, artifacts: { tokens: TOKENS } },
    bad: [f("C.tsx", `${UI}export default function C() { return <Box fg="mid" bg="white">x</Box> }\n`)],
    clean: [f("C.tsx", `${UI}export default function C() { return <Box fg="ink" bg="white">x</Box> }\n`)],
  },
  E1805: {
    bad: [f("C.tsx", `${UI}export default function C() { return <Box><h2>Orders</h2></Box> }\n`)],
    clean: [f("C.tsx", `${UI}export default function C() { return <Box>Orders</Box> }\n`)],
  },
  E1808: {
    bad: [f("C.ts", `${UI}export default function C() { return Box({ children: Text({ children: "x" }) }) }\n`)],
    clean: [
      f("C.ts", `${UI}export default function C() { return Box({ children: () => Text({ children: "x" }) }) }\n`),
    ],
  },
  E1806: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `${UI}import { For } from '@keel/runtime-dom'\nexport default function C(props: { xs: { id: string }[] }) { return <For each={props.xs} key="id" empty={<Text>none</Text>}>{(x) => <Text>{x.id}</Text>}</For> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `${UI}import { For } from '@keel/runtime-dom'\nexport default function C(props: { xs: { id: string }[] }) { return <For each={props.xs} key="id" empty={() => <Text>none</Text>}>{(x) => <Text>{x.id}</Text>}</For> }\n`,
      ),
    ],
  },
  E1820: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `${UI}export default function C() { return <Box direction="row-reverse"><Button onClick={() => {}}>A</Button><Button onClick={() => {}}>B</Button></Box> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `${UI}export default function C() { return <Box direction="row"><Button onClick={() => {}}>B</Button><Button onClick={() => {}}>A</Button></Box> }\n`,
      ),
    ],
  },
  E1822: {
    opts: NO_TYPES,
    bad: [f("modules/a/x.ts", "import { Part } from '@keel/ui/aria'\nexport const x = Part\n")],
    clean: [f("packages/std-x/src/a.ts", "import { Part } from '@keel/ui/aria'\nexport const a = Part\n")],
  },
  E1823: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        "import { DataTable } from '@keel/std-tables'\nconst shared = { table: { p: '2' } }\nexport default function C() { return <DataTable styles={shared} /> }\n",
      ),
    ],
    clean: [
      f(
        "C.tsx",
        "import { DataTable } from '@keel/std-tables'\nexport default function C() { return <DataTable styles={{ table: { p: '2' } }} /> }\n",
      ),
    ],
  },
  E1901: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `import { Form } from '@keel/router'\nimport { Input } from '@keel/ui'\nexport default function C() { return <Form method="POST" action="orders.show"><Input label="Note" /></Form> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `import { Form } from '@keel/router'\nimport { Input } from '@keel/ui'\nexport default function C(props: { note: never }) { return <Form method="POST" action="orders.show"><Input label="Note" field={props.note} /></Form> }\n`,
      ),
    ],
  },
};
