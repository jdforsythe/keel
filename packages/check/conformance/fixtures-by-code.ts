// Not a test file. One triggering fixture and one clean counterpart per kernel E code `check()` reports
// (`reportedCodes()`, RFC 0065), E1756 aside (a registered rule that throws). Public API only.
import path from "node:path";
import type { check } from "@keel/check";
import { repoRoot } from "@keel/tooling/repo-root";
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
const HOST_HEAD = "import { Host } from '@keel/ui'\nimport { In } from './In.schema.ts'\n";
const UI = "import { Box, Text, Button } from '@keel/ui'\n";
const SCHEMA = "import { s } from '@keel/schema'\n";
const SERVICES = "import { endpoints } from '@keel/services'\n";
const UNSAFE = "unsafe"; // built so this file's own lint does not read fixture text as a call
const MOUNT_HEAD = "import { identityMount } from '@keel/router'\n";
const MOUNT_SERVER =
  "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n";
const MOUNT_USE = "import mount from '../../identity.ts'\nexport const signin = mount.href('/sign-in/email')\n";
const TOPO = (origins: string): string =>
  `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'node', origins: ${origins} } })\n`;
const manifest = (id: string, extra = ""): Files[number] =>
  f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] }${extra} })\n`,
  );
const mod = (id: string, deps: string[], exports: string[], caps: string[] = []): Files[number] => {
  const q = (xs: string[]): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;
  return f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${q(deps)}, capabilities: ${q(caps)}, public: { exports: ${q(exports)} } })\n`,
  );
};
/** A module's contract (k.contract) at `modules/<id>/<id>.contract.ts` over `entries`, source text of the entries object body. */
const contractFile = (id: string, entries: string): Files[number] =>
  f(
    `modules/${id}/${id}.contract.ts`,
    `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const ${id} = contract('${id}', { ${entries} })\n`,
  );
/** The module's `routes.ts` binding its contract; `binding` is the source text of the binding object body. */
const bindingFile = (id: string, binding: string): Files[number] =>
  f(
    `modules/${id}/routes.ts`,
    `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(${id}, { ${binding} })\n`,
  );
/** A module of page ids `ids`: its contract and its binding. */
const pages = (id: string, ids: string[]): Files[number][] => [
  contractFile(id, ids.map((r) => `'${r}': { path: '/${r.replace(/\./g, "/")}' },`).join(" ")),
  bindingFile(id, ids.map((r) => `'${r}': { component: Page },`).join(" ")),
];
const exp = (id: string, name: string): Files[number] => f(`modules/${id}/${name}.ts`, `export const ${name} = 1\n`);
const use = (id: string, from: string, name: string): Files[number] =>
  f(`modules/${id}/Use.ts`, `import { ${name} } from '../${from}/${name}.ts'\nexport const Use = ${name}\n`);

const NO_TYPES: Options = { types: false };
const IMPORT = "import { serverState } from '@keel/store/internal'\nexport const x = serverState\n";
/** A root where `@keel/router` resolves, for fixtures whose rule reads real types (E1510). */
const ROUTER_ROOT = path.join(repoRoot(import.meta.dirname), "packages", "router", path.sep);
/** A contract file of module `a` over `entries` (E1510, E1511). */
const apiRoutes = (entries: string): Files[number] => contractFile("a", entries);
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
/** A surface (k.compat, `version: 2`) with no contract and one store `m.s` of state `state` and transactions `txs`. */
const storesSurface = (state: unknown, txs: Record<string, unknown>) => ({
  version: 2,
  contracts: {},
  stores: { "m.s": { state, transactions: txs } },
});
/** A surface of contract `y`, imported by module `a`, whose API entry `y.save` is `POST /y/save` with `body`. */
const surfaceOf = (body: unknown) => ({
  version: 2,
  contracts: {
    y: {
      module: "y",
      callers: ["a"],
      entries: {
        "y.save": { method: "POST", path: "/y/save", params: null, query: null, body, output: ANSWER, errors: {} },
      },
    },
  },
  stores: {},
});
const SPLIT = {
  x: { modules: ["a"], adapter: "node" },
  y: { modules: ["y"], adapter: "node" },
} as const;

/** Module `b` serves `GET /b/pub` through its contract; module `a` calls `/b/pub` through `service({ base: <base> })`. */
const sameAppService = (base: string): Files => [
  mod("b", [], []),
  contractFile("b", "'b.pub': { method: 'GET', path: '/b/pub', output: s.json() },"),
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
  E1107: {
    opts: NO_TYPES,
    bad: [
      manifest("app"),
      f(
        "modules/app/Card.tsx",
        `${SCHEMA}import { store } from '@keel/store'\nexport const Card = store(s.object({ email: s.string().pii('contact') }), { email: '' })\n`,
      ),
    ],
    clean: [
      manifest("app", ", clientPii: ['contact']"),
      f(
        "modules/app/Card.tsx",
        `${SCHEMA}import { store } from '@keel/store'\nexport const Card = store(s.object({ email: s.string().pii('contact') }), { email: '' })\n`,
      ),
    ],
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
        "modules/app/app.contract.ts",
        "import { contract } from '@keel/router/contract'\nimport { Params } from './Params.schema.ts'\nexport const app = contract('app', { 'app.show': { path: '/show/:email', params: Params } })\n",
      ),
    ],
    clean: [
      manifest("app"),
      f("modules/app/Params.schema.ts", `${SCHEMA}export const Params = s.object({ email: s.string() })\n`),
      f(
        "modules/app/app.contract.ts",
        "import { contract } from '@keel/router/contract'\nimport { Params } from './Params.schema.ts'\nexport const app = contract('app', { 'app.show': { path: '/show/:email', params: Params } })\n",
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
    bad: [manifest("orders"), ...pages("orders", ["show"])],
    clean: [manifest("orders"), ...pages("orders", ["orders.show"])],
  },
  E1156: {
    bad: [
      mod("a", [], []),
      f("modules/a/Run.ts", "import type { Ctx } from '@keel/ctx'\nexport const Run = (ctx: Ctx) => ctx.clock.now()\n"),
    ],
    clean: [
      mod("a", [], [], ["clock"]),
      f("modules/a/Run.ts", "import type { Ctx } from '@keel/ctx'\nexport const Run = (ctx: Ctx) => ctx.clock.now()\n"),
    ],
  },
  E1158: {
    opts: NO_TYPES,
    bad: [
      f(
        "modules/a/module.ts",
        "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] }, std: { '@keel/std-fixture': { limit: 1 } } })\n",
      ),
    ],
    clean: [
      f(
        "modules/a/module.ts",
        "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: ['@keel/std-fixture'], capabilities: [], public: { exports: [] }, std: { '@keel/std-fixture': { limit: 1 } } })\n",
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
      mod("orders", [], []),
      contractFile("orders", "'orders.list': { path: '/orders' }"),
      f(
        "modules/orders/C.tsx",
        `${UI}import { Link } from '@keel/ui'\nimport { orders } from './orders.contract.ts'\nexport default function C() { return <Link to={orders.href('orders.list')}>x</Link> }\n`,
      ),
    ],
  },
  // E1510 over a contract literal (k.contract): an API entry carrying `search`, a member its kind refuses; the fix removes it.
  E1510: {
    opts: { root: ROUTER_ROOT },
    bad: [apiRoutes("'a.list': { method: 'GET', path: '/api/list', output: s.object({}), search: s.object({}) }")],
    clean: [apiRoutes("'a.list': { method: 'GET', path: '/api/list', output: s.object({}) }, 'a.home': { path: '/' }")],
  },
  E1511: {
    badOpts: { ...NO_TYPES, topology: { web: { modules: ["a"], adapter: "client" } } },
    cleanOpts: { ...NO_TYPES, topology: { api: { modules: ["a"], adapter: "node" } } },
    bad: [apiRoutes("'a.list': { method: 'GET', path: '/api/list', output: s.object({}) }")],
    clean: [apiRoutes("'a.list': { method: 'GET', path: '/api/list', output: s.object({}) }")],
  },
  // k.contract Rules. E1513: a `contract()` call outside `<id>.contract.ts` (here in `a.ts`); no fix.
  E1513: {
    opts: NO_TYPES,
    bad: [
      mod("a", [], []),
      f(
        "modules/a/a.ts",
        "import { contract } from '@keel/router/contract'\nexport const a = contract('a', { 'a.home': { path: '/' } })\n",
      ),
    ],
    clean: [mod("a", [], []), contractFile("a", "'a.home': { path: '/' }")],
  },
  // E1514: a contract file importing a file that is no `*.schema.ts`; at the import, no fix.
  E1514: {
    opts: NO_TYPES,
    bad: [
      mod("a", [], []),
      f("modules/a/helper.ts", "export const helper = 1\n"),
      f(
        "modules/a/a.contract.ts",
        "import { contract } from '@keel/router/contract'\nimport { helper } from './helper.ts'\nexport const a = contract('a', { 'a.home': { path: '/' } })\n",
      ),
    ],
    clean: [
      mod("a", [], []),
      f("modules/a/Home.schema.ts", "export const home = '/'\n"),
      f(
        "modules/a/a.contract.ts",
        "import { contract } from '@keel/router/contract'\nimport { home } from './Home.schema.ts'\nexport const a = contract('a', { 'a.home': { path: home } })\n",
      ),
    ],
  },
  // E1515: a binding with a key the contract lacks (a type error); the fix removes the extra key.
  E1515: {
    opts: { root: ROUTER_ROOT },
    bad: [
      mod("a", [], []),
      contractFile("a", "'a.home': { path: '/' }"),
      bindingFile("a", "'a.home': { component: Page }, 'a.extra': { component: Page }"),
    ],
    clean: [
      mod("a", [], []),
      contractFile("a", "'a.home': { path: '/' }"),
      bindingFile("a", "'a.home': { component: Page }"),
    ],
  },
  // k.routes Where rules fire. E1502: two pages of one contract on one path pattern; no fix.
  E1502: {
    opts: NO_TYPES,
    bad: [mod("a", [], []), contractFile("a", "'a.one': { path: '/x' }, 'a.two': { path: '/x' }")],
    clean: [mod("a", [], []), contractFile("a", "'a.one': { path: '/x' }, 'a.two': { path: '/y' }")],
  },
  // E1503: a `:name` in an entry's `path` without a `params` field; no fix.
  E1503: {
    opts: NO_TYPES,
    bad: [mod("a", [], []), contractFile("a", "'a.show': { path: '/s/:id' }")],
    clean: [mod("a", [], []), contractFile("a", "'a.show': { path: '/s/:id', params: s.object({ id: s.string() }) }")],
  },
  // E1504: a required field in a page's `search` schema; no fix.
  E1504: {
    opts: NO_TYPES,
    bad: [mod("a", [], []), contractFile("a", "'a.list': { path: '/l', search: s.object({ q: s.string() }) }")],
    clean: [
      mod("a", [], []),
      contractFile("a", "'a.list': { path: '/l', search: s.object({ q: s.string().optional() }) }"),
    ],
  },
  // E1506: a binding's `layout` naming no layout of the contract (a type error read at `layout`); no fix.
  E1506: {
    opts: { root: ROUTER_ROOT },
    bad: [
      mod("a", [], []),
      contractFile("a", "'a.shell': { layout: true }, 'a.home': { path: '/' }"),
      bindingFile("a", "'a.shell': { component: Page }, 'a.home': { component: Page, layout: 'a.ghost' }"),
    ],
    clean: [
      mod("a", [], []),
      contractFile("a", "'a.shell': { layout: true }, 'a.home': { path: '/' }"),
      bindingFile("a", "'a.shell': { component: Page }, 'a.home': { component: Page, layout: 'a.shell' }"),
    ],
  },
  // E1407 (rfc:0162): a component's second parameter optional (or a middle `slots` parameter before it); the fix is `(props, ctx: Ctx)`.
  E1407: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `${UI}import type { Ctx } from '@keel/ctx'\nexport default function C(props: { a: string }, _slots?: undefined, ctx?: Ctx) { return <Text>{props.a}</Text> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `${UI}import type { Ctx } from '@keel/ctx'\nexport default function C(props: { a: string }, ctx: Ctx) { return <Text>{props.a}</Text> }\n`,
      ),
    ],
  },
  E1552: {
    opts: NO_TYPES,
    bad: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['a'], adapter: 'node' }, web: { modules: ['w'], adapter: 'client', host: 'api' } })\n",
      ),
      manifest("a"),
      manifest("w"),
    ],
    clean: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['a'], adapter: 'node' }, web: { modules: ['w'], adapter: 'client', servedBy: 'api' } })\n",
      ),
      manifest("a"),
      manifest("w"),
    ],
  },
  E1566: {
    badOpts: {
      ...NO_TYPES,
      topology: {
        api: { modules: ["a"], adapter: "node" },
        web: { modules: ["w"], adapter: "client", servedBy: "web" },
      },
    },
    cleanOpts: {
      ...NO_TYPES,
      topology: {
        api: { modules: ["a"], adapter: "node" },
        web: { modules: ["w"], adapter: "client", servedBy: "api" },
      },
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
  E1562: {
    badOpts: { base: surfaceOf(fields("name")), topology: SPLIT },
    cleanOpts: {
      base: surfaceOf(fields("name")),
      topology: { x: { modules: ["a", "y"], adapter: "node" } },
    },
    bad: [surfaceFile(surfaceOf(fields("name", "note")))],
    clean: [surfaceFile(surfaceOf(fields("name", "note")))],
  },
  E1563: {
    badOpts: { base: storesSurface(fields("a"), {}) },
    cleanOpts: { base: storesSurface(fields("a"), {}) },
    bad: [surfaceFile(storesSurface(fields("a", "b"), {}))],
    clean: [surfaceFile(storesSurface(fields("a"), {}))],
  },
  // E1567 (rfc:0092 B6): module `b` serves GET `/b/pub` (a contract entry and its loader); module `a` calls it through `service({ base })`.
  // Assumption: `a` lists `b` in `deps` so no other code reports; the callers' `schema` is a sibling `*.schema.ts` of literals, as in module-service-E1152-E1157.test.ts; the rule matches the endpoint's method and `samePath` to a route literal (the RFC does not say the route needs a loader).
  E1567: {
    opts: NO_TYPES,
    bad: sameAppService("origin"),
    clean: sameAppService("'https://api.example.com'"),
  },
  E1508: {
    opts: NO_TYPES,
    bad: [
      mod("app", [], []),
      contractFile("app", "'app.shell': { layout: true }, 'app.login': { path: '/login' }"),
      f(
        "modules/app/auth.guard.ts",
        "import { guard } from '@keel/router'\nimport { ok } from '@keel/schema'\nexport const auth = guard({ redirect: 'app.login' }, async () => ok(null))\n",
      ),
      f(
        "modules/app/routes.ts",
        "import { manifest } from '@keel/router'\nimport { app } from './app.contract.ts'\nimport { auth } from './auth.guard.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(app, {\n  'app.shell': { component: Page, guard: auth },\n  'app.login': { component: Page, layout: 'app.shell' },\n})\n",
      ),
    ],
    clean: [
      mod("app", [], []),
      contractFile("app", "'app.shell': { layout: true }, 'app.home': { path: '/' }, 'app.login': { path: '/login' }"),
      f(
        "modules/app/auth.guard.ts",
        "import { guard } from '@keel/router'\nimport { ok } from '@keel/schema'\nexport const auth = guard({ redirect: 'app.login' }, async () => ok(null))\n",
      ),
      f(
        "modules/app/routes.ts",
        "import { manifest } from '@keel/router'\nimport { app } from './app.contract.ts'\nimport { auth } from './auth.guard.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(app, {\n  'app.shell': { component: Page, guard: auth },\n  'app.home': { component: Page, layout: 'app.shell' },\n  'app.login': { component: Page },\n})\n",
      ),
    ],
  },
  E1509: {
    opts: NO_TYPES,
    bad: [
      mod("app", [], []),
      f(
        "modules/app/Locale.schema.ts",
        `${SCHEMA}export const Locale = s.enum(['en-US', 'de-DE'], { pathDefault: 'en-US' })\n`,
      ),
      f(
        "modules/app/app.contract.ts",
        `import { contract } from '@keel/router/contract'\n${SCHEMA}import { Locale } from './Locale.schema.ts'\nexport const app = contract('app', {\n  'app.home': { path: '/:locale', params: s.object({ locale: Locale }) },\n  'app.about': { path: '/about' },\n  'app.de': { path: '/de-DE/x' },\n})\n`,
      ),
    ],
    clean: [
      mod("app", [], []),
      f(
        "modules/app/Locale.schema.ts",
        `${SCHEMA}export const Locale = s.enum(['en-US', 'de-DE'], { pathDefault: 'en-US' })\n`,
      ),
      f(
        "modules/app/app.contract.ts",
        `import { contract } from '@keel/router/contract'\n${SCHEMA}import { Locale } from './Locale.schema.ts'\nexport const app = contract('app', {\n  'app.home': { path: '/:locale', params: s.object({ locale: Locale }) },\n  'app.about': { path: '/:locale/about', params: s.object({ locale: Locale }) },\n})\n`,
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
  E1009: {
    opts: NO_TYPES,
    bad: [
      f(
        "src/auth.ts",
        "import { guard } from '@keel/router'\nexport const auth = guard({ redirect: 'app.home' }, async () => null)\n",
      ),
    ],
    clean: [
      f(
        "src/auth.guard.ts",
        "import { guard } from '@keel/router'\nexport const auth = guard({ redirect: 'app.home' }, async () => null)\n",
      ),
    ],
  },
  E1010: {
    opts: NO_TYPES,
    bad: [
      f("lib/notes.server.ts", "export const notes = 1\n"),
      f("api.server.ts", "import { notes } from './lib/notes.Server.ts'\nexport const api = notes\n"),
    ],
    clean: [
      f("lib/notes.server.ts", "export const notes = 1\n"),
      f("api.server.ts", "import { notes } from './lib/notes.server.ts'\nexport const api = notes\n"),
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
  E1578: {
    opts: NO_TYPES,
    bad: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'node', caller: { days: 0 } } })\n",
      ),
      manifest("a"),
    ],
    clean: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'node', caller: { days: 30 } } })\n",
      ),
      manifest("a"),
    ],
  },
  E1579: {
    opts: NO_TYPES,
    bad: [f("identity.server.ts", "export const identity = async () => ''\n")],
    clean: [
      f(
        "identity.server.ts",
        "import { identity } from '@keel/server'\nexport default identity({ identify: async () => '' })\n",
      ),
    ],
  },
  E1580: {
    opts: NO_TYPES,
    bad: [
      f("identity.ts", `${MOUNT_HEAD}const p = '/api/auth'\nexport default identityMount(p)\n`),
      f("identity.server.ts", MOUNT_SERVER),
    ],
    clean: [
      f("identity.ts", `${MOUNT_HEAD}export default identityMount('/api/auth')\n`),
      f("identity.server.ts", MOUNT_SERVER),
    ],
  },
  E1581: {
    opts: NO_TYPES,
    bad: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'static' } })\n",
      ),
      manifest("a"),
      f("identity.ts", `${MOUNT_HEAD}export default identityMount('/api/auth')\n`),
      f("identity.server.ts", MOUNT_SERVER),
      f("modules/a/signin.ts", MOUNT_USE),
    ],
    clean: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'node' } })\n",
      ),
      manifest("a"),
      f("identity.ts", `${MOUNT_HEAD}export default identityMount('/api/auth')\n`),
      f("identity.server.ts", MOUNT_SERVER),
      f("modules/a/signin.ts", MOUNT_USE),
    ],
  },
  E1582: {
    opts: NO_TYPES,
    bad: [
      f("identity.ts", `${MOUNT_HEAD}export default identityMount('/api/auth')\n`),
      f("identity.server.ts", MOUNT_SERVER),
      f("src/signin.ts", "import mount from '../identity.ts'\nexport const signin = mount.href('//x.example')\n"),
    ],
    clean: [
      f("identity.ts", `${MOUNT_HEAD}export default identityMount('/api/auth')\n`),
      f("identity.server.ts", MOUNT_SERVER),
      f("src/signin.ts", "import mount from '../identity.ts'\nexport const signin = mount.href('/sign-in/email')\n"),
    ],
  },
  E1584: {
    opts: NO_TYPES,
    bad: [
      f("identity.ts", `${MOUNT_HEAD}export default identityMount('/api/auth', { links: [''] })\n`),
      f("identity.server.ts", MOUNT_SERVER),
    ],
    clean: [
      f("identity.ts", `${MOUNT_HEAD}export default identityMount('/api/auth', { links: ['/verify'] })\n`),
      f("identity.server.ts", MOUNT_SERVER),
    ],
  },
  E1590: {
    opts: NO_TYPES,
    bad: [manifest("a"), f("topology.ts", TOPO("{ img: { 'https://cdn.example/': 'r' } }"))],
    clean: [manifest("a"), f("topology.ts", TOPO("{ img: { 'https://cdn.example': 'r' } }"))],
  },
  E1591: {
    opts: NO_TYPES,
    bad: [
      manifest("a"),
      f("topology.ts", TOPO("{ img: { 'https://cdn.example': 'one', 'https://cdn.example': 'two' } }")),
    ],
    clean: [manifest("a"), f("topology.ts", TOPO("{ img: { 'https://cdn.example': 'one' } }"))],
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
  E1406: {
    bad: [
      f(
        "modules/app/Card.tsx",
        `${UI}export function Card(props: { icon: () => Node }) { return <Box>{props.icon}</Box> }\n`,
      ),
    ],
    clean: [
      f(
        "modules/app/Card.tsx",
        `${UI}export function Card(props: { icon: () => Node }) { return <Box>{props.icon()}</Box> }\n`,
      ),
    ],
  },
  E1759: {
    opts: NO_TYPES,
    bad: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['shop'], adapter: 'node' } })\n",
      ),
      manifest("shop"),
      f("modules/shop/paths.server.ts", "export const paths = __dirname\n"),
    ],
    clean: [
      f(
        "topology.ts",
        "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['shop'], adapter: 'node' } })\n",
      ),
      manifest("shop"),
      f("modules/shop/paths.server.ts", "export const paths = import.meta.dirname\n"),
    ],
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
  E1258: {
    opts: NO_TYPES,
    bad: [
      f(
        "modules/app/Card.tsx",
        `${UI}export function Card(props: { icon?: unknown }) { return <Box>{props.icon}</Box> }\n`,
      ),
      f("modules/app/Icon.tsx", `${UI}export function Icon() { return <Box>i</Box> }\n`),
      f(
        "modules/app/Page.ts",
        `import { Card } from './Card.tsx'\nimport { Icon } from './Icon.tsx'\nexport default function Page() { return Card({ icon: Icon() }) }\n`,
      ),
    ],
    clean: [
      f(
        "modules/app/Card.tsx",
        `${UI}export function Card(props: { icon?: unknown }) { return <Box>{props.icon}</Box> }\n`,
      ),
      f("modules/app/Icon.tsx", `${UI}export function Icon() { return <Box>i</Box> }\n`),
      f(
        "modules/app/Page.ts",
        `import { Card } from './Card.tsx'\nimport { Icon } from './Icon.tsx'\nexport default function Page() { return Card({ icon: () => Icon() }) }\n`,
      ),
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
  E1824: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `${HOST_HEAD}const load = () => import('./chart.ts').then((m) => m.chart)\nexport default function C() { return <Host id="c.h" role="img" label="L" input={In} value={{ n: 1 }} code={load} /> }\n`,
      ),
    ],
    clean: [
      f(
        "C.tsx",
        `${HOST_HEAD}export default function C() { return <Host id="c.h" role="img" label="L" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} /> }\n`,
      ),
    ],
  },
  E1825: {
    opts: NO_TYPES,
    bad: [
      f(
        "C.tsx",
        `import 'x/a.css'\n${HOST_HEAD}export default function C() { return <Host id="c.h" role="img" label="L" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} /> }\n`,
      ),
      f("chart.ts", "export const chart = undefined\n"),
    ],
    clean: [
      f(
        "C.tsx",
        `${HOST_HEAD}export default function C() { return <Host id="c.h" role="img" label="L" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} /> }\n`,
      ),
      f("chart.ts", "import 'x/a.css'\nexport const chart = undefined\n"),
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
