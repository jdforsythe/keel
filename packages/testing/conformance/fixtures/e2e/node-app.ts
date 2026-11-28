// Built-app fixtures for the k.e2e and k.e2e-page conformance files (not a test file): small projects as source text, in the form
// of packages/cli/conformance/static-support.ts (`Tree`: path -> source). Seed 1337 for every property. Every project here passes
// `keel check` and `keel build` (the fixture app is written to the skills' shape: one export per file named after it, schemas in
// `*.schema.ts`, no `try`, `throw` or `fetch` in app code, every effect through `ctx`).
// Module `a` of one `node` deployable holds a server store factory `boards` (store id `a.board`, schema `Board` `{ lists: string[] }`,
// transaction `a.addList`), a page `/` (`a.count`, a form whose button `a.add` posts the action `a.home`, 303 back to `/`), an API
// entry `a.env` (GET /api/a/env) answering the process values the serve clauses read, and one page per `Page` below.
// ASSUMED (spec names no fixture layout): `@keel/ui`'s `Text` takes `fg` and `bg` token names; `tokens.ts` names `low` (#777777),
// `white` and `page` colors and a `base` of `page` (a #f9f9f9 `body` with 4px padding) and `focus` (the 2px solid ring of k.ui Base).
export type Tree = Record<string, string>;
export type Page = { readonly name: string; readonly path: string; readonly source: string; readonly title?: string };

export const manifest = (id: string, env: readonly string[] = []): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] }${env.length === 0 ? "" : `, env: [${env.map((e) => `'${e}'`).join(", ")}]`} })\n`;

const SCHEMA = "import { type Infer, s } from '@keel/schema'\n";
const UI = "import { Box, Button, Input, Link, Text } from '@keel/ui'\n";
const STORE = "import { store, transaction, tx } from '@keel/store'\n";
const CTX = "import type { Ctx } from '@keel/ctx'\n";
const HOST = "import { Host } from '@keel/ui'\nimport { HostIn } from './HostIn.schema.ts'\n";
const hostTag = (id: string, code: string): string =>
  `<Host id="${id}" role="img" label="mark" input={HostIn} value={{}} code={() => import('./${code}.ts').then((m) => m.${code})} />`;
const EMPTY = "export const Props = s.object({})\n";

/** A page component file: `body` is the component's source after `export default function <Name>`. */
const comp = (imports: string, name: string, body: string, props = EMPTY, signature = "_props: Infer<typeof Props>") =>
  `${imports}${SCHEMA}${props}export default function ${name}(${signature}) {\n${body}}\n`;

/** Pages the k.e2e-page clauses open, each a default component at `path`, its file `<Name>.tsx` in module `a`. */
export const PAGES = {
  /** `a.status` says `Connecting` and never changes. */
  status: {
    name: "status",
    path: "/status",
    source: comp(
      UI,
      "Status",
      '  return (\n    <Box as="main">\n      <Text id="a.status">Connecting</Text>\n    </Box>\n  )\n',
    ),
  },
  /** `shop.row.a`, then `shop.rows`, then `shop.row.b`, in document order. */
  rows: {
    name: "rows",
    path: "/rows",
    source: comp(
      UI,
      "Rows",
      '  return (\n    <Box as="main">\n      <Text id="shop.row.a">A</Text>\n      <Text id="shop.rows">Rows</Text>\n      <Text id="shop.row.b">B</Text>\n    </Box>\n  )\n',
    ),
  },
  /** A button that opens an event stream (`GET /api/a/ticks`, which never ends) and nothing else in flight. */
  stream: {
    name: "stream",
    path: "/stream",
    source: comp(
      `${UI}${CTX}import { signal } from '@keel/reactive'\nimport { client } from './client.ts'\n`,
      "Stream",
      '  const last = signal(0)\n  const open = async () => {\n    for await (const tick of client.ticks({}, ctx)) {\n      if (tick.ok) last.set(tick.value)\n    }\n  }\n  return (\n    <Box as="main">\n      <Button id="a.stream.open" onClick={open}>Open</Button>\n      <Text id="a.stream.last">{String(last.get())}</Text>\n    </Box>\n  )\n',
      EMPTY,
      "_props: Infer<typeof Props>, ctx: Ctx",
    ),
  },
  /** A button whose handler calls the page's own API through a service (app code may not `fetch`); a network failure it gets back is rejected as a `TypeError`, the page's. */
  offline: {
    name: "offline",
    path: "/offline",
    source: comp(
      `${UI}${CTX}import { client } from './client.ts'\n`,
      "Offline",
      '  const go = async () => {\n    const got = await client.env({}, ctx)\n    if (!got.ok) void Promise.reject(new TypeError(got.error.message))\n  }\n  return (\n    <Box as="main">\n      <Button id="a.offline.go" onClick={go}>Go</Button>\n    </Box>\n  )\n',
      EMPTY,
      "_props: Infer<typeof Props>, ctx: Ctx",
    ),
  },
  /** A client store the button changes: the text changes with no document load. */
  live: {
    name: "live",
    path: "/live",
    source: comp(
      `${UI}${STORE}import { LiveSet } from './LiveSet.schema.ts'\nimport { LiveText } from './LiveText.schema.ts'\n`,
      "Live",
      "  const t = store(LiveText, { text: 'before' }, { id: 'a.liveText' })\n  const set = transaction(t, 'a.liveSet', LiveSet, (_st, p) => ({ text: p.text }))\n  const go = () => {\n    const r = tx(set, { text: 'after' })\n    if (!r.ok) return\n  }\n  return (\n    <Box as=\"main\">\n      <Text id=\"a.live.text\">{t.get('text')}</Text>\n      <Button id=\"a.live.go\" onClick={go}>Go</Button>\n    </Box>\n  )\n",
    ),
  },
  /** A click handler that rejects with `new Error('boom')` and a page that never reads it. */
  boom: {
    name: "boom",
    path: "/boom",
    source: comp(
      UI,
      "Boom",
      '  return (\n    <Box as="main">\n      <Button id="a.boom.go" onClick={() => { void Promise.reject(new Error(\'boom\')) }}>Go</Button>\n    </Box>\n  )\n',
    ),
  },
  /** A click handler that calls `console.warn('late')`. */
  warn: {
    name: "warn",
    path: "/warn",
    source: comp(
      UI,
      "Warn",
      '  return (\n    <Box as="main">\n      <Button id="a.warn.go" onClick={() => { console.warn(\'late\') }}>Go</Button>\n    </Box>\n  )\n',
    ),
  },
  /** A text input `a.name` the server sends holding `Milk` (a signal's first value is its default), in an island. */
  list: {
    name: "list",
    path: "/list",
    source: comp(
      `${UI}import { signal } from '@keel/reactive'\n`,
      "List",
      '  const name = signal(\'Milk\')\n  return (\n    <Box as="main">\n      <Input id="a.name" label="Name" value={name.get()} onInput={(v) => name.set(v)} />\n    </Box>\n  )\n',
    ),
  },
  /** An island whose claim replaces the input the server sent: a host element's code swaps `a.swap` for a copy of it. */
  replace: {
    name: "replace",
    path: "/replace",
    source: comp(
      `${UI}${HOST}import { signal } from '@keel/reactive'\n`,
      "Replace",
      `  const name = signal('Milk')\n  return (\n    <Box as="main">\n      <Input id="a.swap" label="Name" value={name.get()} onInput={(v) => name.set(v)} />\n      ${hostTag("a.swap.host", "swapMark")}\n    </Box>\n  )\n`,
    ),
  },
  /** An island whose claim drops its `data-k-island` attribute and keeps every element: a host element's code removes it. */
  drop: {
    name: "drop",
    path: "/drop",
    source: comp(
      `${UI}${HOST}import { signal } from '@keel/reactive'\n`,
      "Drop",
      `  const name = signal('Milk')\n  return (\n    <Box as="main">\n      <Input id="a.drop" label="Name" value={name.get()} onInput={(v) => name.set(v)} />\n      ${hostTag("a.drop.host", "dropMark")}\n    </Box>\n  )\n`,
    ),
  },
  /** A button whose handler fetches `https://api.example.com/x`: `a.connect.text` says `ok` for `{ ok: true }` and `blocked` when the browser refuses. */
  connect: {
    name: "connect",
    path: "/connect",
    source: comp(
      `${UI}${STORE}${CTX}import { LiveSet } from './LiveSet.schema.ts'\nimport { LiveText } from './LiveText.schema.ts'\nimport { geo } from './geo.ts'\n`,
      "Connect",
      "  const t = store(LiveText, { text: 'idle' }, { id: 'a.connectText' })\n  const set = transaction(t, 'a.connectSet', LiveSet, (_st, p) => ({ text: p.text }))\n  const go = async () => {\n    const got = await geo.x({}, ctx)\n    const r = tx(set, { text: got.ok && got.value.ok ? 'ok' : 'blocked' })\n    if (!r.ok) return\n  }\n  return (\n    <Box as=\"main\">\n      <Text id=\"a.connect.text\">{t.get('text')}</Text>\n      <Button id=\"a.connect.go\" onClick={go}>Go</Button>\n    </Box>\n  )\n",
      EMPTY,
      "_props: Infer<typeof Props>, ctx: Ctx",
    ),
  },
  /** A button whose handler posts a JSON body to `https://api.example.com/y` (a non-simple request: a preflight first): `a.pref.text` says `ok` or `blocked`. */
  pref: {
    name: "pref",
    path: "/pref",
    source: comp(
      `${UI}${STORE}${CTX}import { LiveSet } from './LiveSet.schema.ts'\nimport { LiveText } from './LiveText.schema.ts'\nimport { geo } from './geo.ts'\n`,
      "Pref",
      "  const t = store(LiveText, { text: 'idle' }, { id: 'a.prefText' })\n  const set = transaction(t, 'a.prefSet', LiveSet, (_st, p) => ({ text: p.text }))\n  const go = async () => {\n    const got = await geo.y({ body: {} }, ctx)\n    const r = tx(set, { text: got.ok && got.value.ok ? 'ok' : 'blocked' })\n    if (!r.ok) return\n  }\n  return (\n    <Box as=\"main\">\n      <Text id=\"a.pref.text\">{t.get('text')}</Text>\n      <Button id=\"a.pref.go\" onClick={go}>Go</Button>\n    </Box>\n  )\n",
      EMPTY,
      "_props: Infer<typeof Props>, ctx: Ctx",
    ),
  },
  /** Text of `#777777` on `#ffffff` (its `fg` comes from the loader, so `keel check` leaves the contrast to the browser; an empty `Box` writes the `low` rule the page's own class needs). */
  contrast: {
    name: "contrast",
    path: "/contrast",
    source: comp(
      `${UI}import { computed } from '@keel/reactive'\n`,
      "Contrast",
      '  const tone = computed(() => props.data.fg)\n  return (\n    <Box as="main">\n      <Text id="a.low" fg={tone} bg="white">Low contrast</Text>\n      <Box id="a.low.rule" fg="low" />\n    </Box>\n  )\n',
      "import { LowText } from './LowText.schema.ts'\nexport const Props = s.object({ data: LowText })\n",
      "props: Infer<typeof Props>",
    ),
  },
  /** The only focusable element is `a.button`; the focus ring is the base's `focus` (2px solid). */
  focus: {
    name: "focus",
    path: "/focus",
    source: comp(
      `${UI}import { a } from './a.contract.ts'\n`,
      "Focus",
      '  return (\n    <Box as="main">\n      <Link id="a.button" to={a.href(\'a.home\')}>Go</Link>\n    </Box>\n  )\n',
    ),
  },
  /** A route whose title is `Shopping list`. */
  shopping: {
    name: "shopping",
    path: "/shopping",
    title: "Shopping list",
    source: comp(
      UI,
      "Shopping",
      '  return (\n    <Box as="main">\n      <Text id="a.shopping.text">Milk</Text>\n    </Box>\n  )\n',
    ),
  },
  /** A route whose title is `Other list`. */
  other: {
    name: "other",
    path: "/other",
    title: "Other list",
    source: comp(
      UI,
      "Other",
      '  return (\n    <Box as="main">\n      <Text id="a.other.text">Eggs</Text>\n    </Box>\n  )\n',
    ),
  },
} as const satisfies Record<string, Page>;

/** The files of module `id`: its contract, an `<id>.env` API entry, the pages, and (with `home`) the store, the loader and the action. */
export function moduleFiles(
  id: string,
  pages: readonly Page[],
  opts: { home?: boolean; env?: readonly string[] } = {},
): Tree {
  const m = `modules/${id}`;
  const tick = pages.some((p) => p.name === "stream");
  const entries = [
    ...(opts.home === true ? [`'${id}.home': { path: '/' }`] : []),
    ...pages.map((p) => `'${id}.${p.name}': { path: '${p.path}' }`),
    `'${id}.env': { method: 'GET', path: '/api/${id}/env', output: EnvOut }`,
    ...(tick ? [`'${id}.ticks': { method: 'GET', path: '/api/${id}/ticks', output: s.int(), events: true }`] : []),
  ].join(",\n  ");
  const routes = [
    ...(opts.home === true ? [`'${id}.home': { component: Home, loader: home, POST: add }`] : []),
    ...pages.map((p) => {
      const parts = [`component: ${cap(p.name)}`];
      if (p.name === "contrast") parts.push("loader: lowText");
      if ("title" in p && typeof p.title === "string") parts.push(`title: () => '${p.title}'`);
      return `'${id}.${p.name}': { ${parts.join(", ")} }`;
    }),
    `'${id}.env': { loader: env }`,
    ...(tick ? [`'${id}.ticks': { loader: ticks }`] : []),
  ].join(",\n  ");
  const imports = [
    ...(opts.home === true
      ? [
          `import Home from './Home.tsx'`,
          `import { home } from './home.server.ts'`,
          `import { add } from './add.server.ts'`,
        ]
      : []),
    ...pages.map((p) => `import ${cap(p.name)} from './${cap(p.name)}.tsx'`),
    ...(pages.some((p) => p.name === "contrast") ? [`import { lowText } from './lowText.server.ts'`] : []),
    `import { ${id} } from './${id}.contract.ts'`,
    `import { env } from './env.server.ts'`,
    ...(tick ? [`import { ticks } from './ticks.server.ts'`] : []),
  ];
  const tree: Tree = {
    [`${m}/module.ts`]: manifest(id, opts.env),
    [`${m}/EnvOut.schema.ts`]:
      "import { s } from '@keel/schema'\nexport const EnvOut = s.object({ secret: s.string(), peerApi: s.string(), peerWeb: s.string(), origin: s.string(), data: s.string() })\n",
    [`${m}/${id}.contract.ts`]: `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nimport { EnvOut } from './EnvOut.schema.ts'\nexport const ${id} = contract('${id}', {\n  ${entries},\n})\n`,
    [`${m}/env.server.ts`]: `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { ${id} } from './${id}.contract.ts'\nexport const env = loader(${id}, '${id}.env', {}, async () => ok({ secret: process.env.KEEL_SECRET ?? '', peerApi: process.env.KEEL_PEER_API ?? '', peerWeb: process.env.KEEL_PEER_WEB ?? '', origin: process.env.KEEL_ORIGIN ?? '', data: process.env.KEEL_DATABASE_URL ?? '' }))\n`,
    [`${m}/routes.ts`]: `import { manifest } from '@keel/router'\n${imports.join("\n")}\nexport const routes = manifest(${id}, {\n  ${routes},\n})\n`,
  };
  for (const p of pages) tree[`${m}/${cap(p.name)}.tsx`] = p.source;
  if (pages.some((p) => p.name === "connect" || p.name === "pref")) {
    tree[`${m}/Answer.schema.ts`] =
      "import { s } from '@keel/schema'\nexport const Answer = s.object({ ok: s.boolean() })\n";
    // The origin is built, not written, so `keel check` (E1571) leaves the CSP's `connect` list to the topology under test.
    tree[`${m}/geo.ts`] =
      "import { s } from '@keel/schema'\nimport { endpoints, service } from '@keel/services'\nimport { Answer } from './Answer.schema.ts'\nconst Geo = endpoints({\n  x: { method: 'GET', path: '/x', output: Answer },\n  y: { method: 'POST', path: '/y', body: s.object({}), output: Answer },\n})\nexport const geo = service({ base: ['https:/', 'api.example.com'].join('/'), schema: Geo })\n";
  }
  if (tick) {
    tree[`${m}/ticks.server.ts`] =
      `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { ${id} } from './${id}.contract.ts'\nexport const ticks = loader(${id}, '${id}.ticks', {}, async function* ({ signal }) {\n  yield ok(1)\n  await new Promise<void>((done) => signal.addEventListener('abort', () => done()))\n})\n`;
  }
  if (tick || pages.some((p) => p.name === "offline"))
    tree[`${m}/client.ts`] =
      `import { service } from '@keel/services'\nimport { ${id} } from './${id}.contract.ts'\nexport const client = service({ contract: ${id} })\n`;
  if (pages.some((p) => p.name === "contrast")) {
    tree[`${m}/LowText.schema.ts`] =
      "import { s } from '@keel/schema'\nexport const LowText = s.object({ fg: s.string() })\n";
    tree[`${m}/lowText.server.ts`] =
      `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { ${id} } from './${id}.contract.ts'\nimport { LowText } from './LowText.schema.ts'\nexport const lowText = loader(${id}, '${id}.contrast', { output: LowText }, async () => ok({ fg: 'low' }))\n`;
  }
  if (pages.some((p) => p.name === "replace" || p.name === "drop")) {
    tree[`${m}/HostIn.schema.ts`] = "import { s } from '@keel/schema'\nexport const HostIn = s.object({})\n";
    const host = (name: string, body: string): string =>
      `import type { Infer } from '@keel/schema'\nimport { hostCode } from '@keel/ui'\nimport type { HostIn } from './HostIn.schema.ts'\nexport const ${name} = hostCode<Infer<typeof HostIn>, never, undefined>({\n  mount(node) {\n    ${body}\n    return undefined\n  },\n})\n`;
    tree[`${m}/swapMark.ts`] = host(
      "swapMark",
      "const input = node.ownerDocument.getElementById('a.swap')\n    if (input !== null) input.replaceWith(input.cloneNode(true))",
    );
    tree[`${m}/dropMark.ts`] = host("dropMark", "node.closest('[data-k-island]')?.removeAttribute('data-k-island')");
  }
  if (pages.some((p) => ["live", "connect", "pref"].includes(p.name))) {
    tree[`${m}/LiveText.schema.ts`] =
      "import { s } from '@keel/schema'\nexport const LiveText = s.object({ text: s.string() })\n";
    tree[`${m}/LiveSet.schema.ts`] =
      "import { s } from '@keel/schema'\nexport const LiveSet = s.object({ text: s.string() })\n";
  }
  if (opts.home === true) Object.assign(tree, homeFiles(id));
  return tree;
}

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;

/** The server store `a.board`, its factory, the loader and the action of `/`, and the page. */
function homeFiles(id: string): Tree {
  const m = `modules/${id}`;
  return {
    [`${m}/Board.schema.ts`]:
      "import { s } from '@keel/schema'\nexport const Board = s.object({ lists: s.array(s.string()) })\n",
    [`${m}/AddList.schema.ts`]:
      "import { s } from '@keel/schema'\nexport const AddList = s.object({ name: s.string() })\n",
    [`${m}/HomeData.schema.ts`]:
      "import { s } from '@keel/schema'\nexport const HomeData = s.object({ count: s.int() })\n",
    [`${m}/boards.ts`]: `import { store, transaction } from '@keel/store'\nimport { AddList } from './AddList.schema.ts'\nimport { Board } from './Board.schema.ts'\nexport const boards = () => {\n  const board = store(Board, { lists: [] }, { id: '${id}.board' })\n  const addList = transaction(board, '${id}.addList', AddList, (st, p) => ({ lists: [...st.lists, p.name] }))\n  return { board, addList }\n}\n`,
    [`${m}/home.server.ts`]: `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { ${id} } from './${id}.contract.ts'\nimport { HomeData } from './HomeData.schema.ts'\nimport { boards } from './boards.ts'\nexport const home = loader(${id}, '${id}.home', { output: HomeData, stores: boards }, async ({ stores }) => ok({ count: stores.board.get('lists').length }))\n`,
    [`${m}/add.server.ts`]: `import { action } from '@keel/router'\nimport { err, ok, s } from '@keel/schema'\nimport { tx } from '@keel/store'\nimport { ${id} } from './${id}.contract.ts'\nimport { boards } from './boards.ts'\nexport const add = action(${id}, '${id}.home', { input: s.object({}), stores: boards }, async (_input, { caller, stores }) => {\n  const r = tx(stores.addList, { name: 'list' }, { meta: { caller } })\n  return r.ok ? ok(null) : err(r.error)\n})\n`,
    [`${m}/Home.tsx`]: `import { Form } from '@keel/router'\nimport { type Infer, s } from '@keel/schema'\nimport { Box, Button, Text } from '@keel/ui'\nimport { ${id} } from './${id}.contract.ts'\nimport { HomeData } from './HomeData.schema.ts'\nexport const Props = s.object({ data: HomeData })\nexport default function Home(props: Infer<typeof Props>) {\n  return (\n    <Box as="main">\n      <Text id="a.count">{String(props.data.count)}</Text>\n      <Form method="POST" action={${id}.href('${id}.home')}>\n        <Button id="a.add" type="submit">Add</Button>\n      </Form>\n    </Box>\n  )\n}\n`,
  };
}

const PKG = `${JSON.stringify(
  {
    name: "fx",
    private: true,
    type: "module",
    version: "1.0.0",
    dependencies: Object.fromEntries(
      [
        "compiler",
        "ctx",
        "reactive",
        "router",
        "runtime-dom",
        "schema",
        "server",
        "services",
        "std-db",
        "store",
        "ui",
      ].map((n) => [`@keel/${n}`, "*"]),
    ),
    devDependencies: { "@keel/cli": "*", "@keel/testing": "*", "@types/node": "*" },
  },
  null,
  2,
)}\n`;
const VITE =
  'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vitest/config";\nexport default defineConfig({ plugins: [keel()], test: { environment: "happy-dom" } });\n';
const TSCONFIG = `${JSON.stringify(
  {
    extends: "@keel/compiler/tsconfig.strict.json",
    compilerOptions: { jsxImportSource: "@keel/runtime-dom", types: ["node", "@keel/compiler/client"] },
    include: ["tokens.ts", "topology.ts", "vite.config.ts", "modules", "test"],
  },
  null,
  2,
)}\n`;
const TOKENS =
  "import { defineTokens } from '@keel/ui/tokens'\nexport const tokens = defineTokens({\n  color: { ink: '#111111', low: '#777777', white: '#ffffff', page: '#f9f9f9' },\n  space: { 1: '4px' },\n  base: { page: { bg: 'page', fg: 'ink', p: '1' }, focus: 'ink' },\n})\n";
/** The root files every fixture project holds. */
export const rootFiles = (topology: string): Tree => ({
  "package.json": PKG,
  "vite.config.ts": VITE,
  "tsconfig.json": TSCONFIG,
  "tokens.ts": TOKENS,
  "topology.ts": `import { topology } from '@keel/server'\nexport default topology(${topology})\n`,
});

/** One `node` deployable `api` (storage `sqlite`) over module `a` with the store, the action and `pages`; `env` are the module's `env` names, `deployableExtra` more deployable options (`, origins: {...}`). */
export function nodeApp(
  pages: readonly Page[] = Object.values(PAGES),
  env: readonly string[] = [],
  deployableExtra = "",
): Tree {
  return {
    ...rootFiles(`{ api: { modules: ['a'], adapter: 'node', storage: 'sqlite'${deployableExtra} } }`),
    ...moduleFiles("a", pages, { home: true, env }),
  };
}

/** `nodeApp` whose action `a.home` commits `{ title: 'Milk' }` (a payload whose JSON is `{"title":"Milk"}`) in place of `{ name: 'list' }`. */
export function milkApp(pages: readonly Page[] = Object.values(PAGES)): Tree {
  const base = nodeApp(pages);
  const board = base["modules/a/boards.ts"] ?? "";
  const add = base["modules/a/add.server.ts"] ?? "";
  return {
    ...base,
    "modules/a/AddList.schema.ts":
      "import { s } from '@keel/schema'\nexport const AddList = s.object({ title: s.string() })\n",
    "modules/a/boards.ts": board.replace("p.name", "p.title"),
    "modules/a/add.server.ts": add.replace("{ name: 'list' }", "{ title: 'Milk' }"),
  };
}

/**
 * `nodeApp` whose `a.env` answer also holds `aws` (`process.env.AWS_SECRET_ACCESS_KEY ?? 'none'`), `home` and `tmp` (the served process's `HOME` and
 * `TMPDIR`), the route the k.e2e-run Environment clause reads.
 */
export function awsApp(pages: readonly Page[] = []): Tree {
  const base = nodeApp(pages);
  const out = base["modules/a/EnvOut.schema.ts"] ?? "";
  const env = base["modules/a/env.server.ts"] ?? "";
  return {
    ...base,
    "modules/a/EnvOut.schema.ts": out.replace(
      "s.object({",
      "s.object({ aws: s.string(), home: s.string(), tmp: s.string(),",
    ),
    "modules/a/env.server.ts": env.replace(
      "ok({",
      "ok({ aws: process.env.AWS_SECRET_ACCESS_KEY ?? 'none', home: process.env.HOME ?? '', tmp: process.env.TMPDIR ?? '',",
    ),
  };
}
