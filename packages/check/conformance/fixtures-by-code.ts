// Not a test file. One triggering fixture and one clean counterpart per E code that `check()` can report, for the
// codes named in the Rules paragraphs of spec/kernel/*.md. Codes not here are in EXPLAIN_ONLY. Public API only.
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
  E1005: {
    bad: [
      f(".keel/ids.json", '{"data":{"C.0":{"col":1}},"hash":"fnv1a:00000000"}\n'),
      f(".keel/x.json", '{"hash":"abc"}'),
    ],
    clean: [],
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
        "import { transaction } from '@keel/store'\ndeclare const app: unknown\nexport const greet = transaction(app, 'greet', (s: string) => s + navigator.language)\n",
      ),
    ],
    clean: [
      f(
        "src/greet.ts",
        "import { transaction } from '@keel/store'\ndeclare const app: unknown\nexport const greet = transaction(app, 'greet', (s: string) => `${s}!`)\n",
      ),
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
  E1601: {
    bad: [f("src/id.ts", "export const id = () => crypto.randomUUID()\n")],
    clean: [
      f("src/id.ts", "export const id = (ctx: { random: { id(brand: string): string } }) => ctx.random.id('Order')\n"),
    ],
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
  E1802: {
    bad: [f("C.tsx", `${UI}export default function C() { return <Button /> }\n`)],
    clean: [f("C.tsx", `${UI}export default function C() { return <Button>Save</Button> }\n`)],
  },
  E1803: {
    opts: NO_TYPES,
    bad: [f("C.tsx", `${UI}export default function C() { return <Box style={{}}>x</Box> }\n`)],
    clean: [f("C.tsx", `${UI}export default function C() { return <Box p="2">x</Box> }\n`)],
  },
  E1805: {
    bad: [f("C.tsx", `${UI}export default function C() { return <Box><h2>Orders</h2></Box> }\n`)],
    clean: [f("C.tsx", `${UI}export default function C() { return <Box>Orders</Box> }\n`)],
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
