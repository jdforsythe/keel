// Built-app fixtures for the k.e2e and k.e2e-page conformance files (not a test file): small projects as source text, in the form
// of packages/cli/conformance/static-support.ts (`Tree`: path -> source). Seed 1337 for every property.
// ASSUMED (spec names no fixture layout, and no implementation was read): module `a` of one `node` deployable holds a server store
// factory `boards` (id `a.board`, schema `{ lists: string[] }`, transaction `a.addList`), a page `/` (`a.count`, a form whose button
// `a.add` posts the action `a.home`, 303 back to `/`), an API entry `a.env` (GET /api/a/env) answering the process values the
// serve clauses read, and one page per `Page` below. `@keel/ui`'s `Input` takes `id` and `label`, `Text` and `Link` take a `style` of
// `color`, `backgroundColor` and a `focus` state; a click handler's failure is an unhandled rejection because app code may not `throw` (E1451).
export type Tree = Record<string, string>;
export type Page = { readonly name: string; readonly path: string; readonly source: string };

export const manifest = (id: string, env: readonly string[] = []): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] }${env.length === 0 ? "" : `, env: [${env.map((e) => `'${e}'`).join(", ")}]`} })\n`;

const UI = "import { Box, Button, Input, Link, Text } from '@keel/ui'\n";
const STORE = "import { store, transaction, tx } from '@keel/store'\nimport { s } from '@keel/schema'\n";

/** Pages the k.e2e-page clauses open, each a default component at `path`. */
export const PAGES = {
  /** `a.status` says `Connecting` and never changes. */
  status: {
    name: "status",
    path: "/status",
    source: `${UI}export default function Page() {\n  return (\n    <Box as="main">\n      <Text id="a.status">Connecting</Text>\n    </Box>\n  )\n}\n`,
  },
  /** `shop.row.a`, then `shop.rows`, then `shop.row.b`, in document order. */
  rows: {
    name: "rows",
    path: "/rows",
    source: `${UI}export default function Page() {\n  return (\n    <Box as="main">\n      <Text id="shop.row.a">A</Text>\n      <Text id="shop.rows">Rows</Text>\n      <Text id="shop.row.b">B</Text>\n    </Box>\n  )\n}\n`,
  },
  /** A button that opens an event stream (`GET /api/a/ticks`, which never ends) and nothing else in flight. */
  stream: {
    name: "stream",
    path: "/stream",
    source: `${UI}export default function Page() {\n  return (\n    <Box as="main">\n      <Button id="a.stream.open" onClick={() => { new EventSource('/api/a/ticks') }}>Open</Button>\n    </Box>\n  )\n}\n`,
  },
  /** A button whose handler fetches the page's origin; its failure is the page's. */
  offline: {
    name: "offline",
    path: "/offline",
    source: `${UI}export default function Page() {\n  return (\n    <Box as="main">\n      <Button id="a.offline.go" onClick={async () => { await fetch('/api/a/env') }}>Go</Button>\n    </Box>\n  )\n}\n`,
  },
  /** A client store the button changes: the text changes with no document load. */
  live: {
    name: "live",
    path: "/live",
    source: `${UI}${STORE}const T = s.object({ text: s.string() })\nconst Set = s.object({ text: s.string() })\nexport default function Page() {\n  const t = store(T, { text: 'before' }, { id: 'a.live.t' })\n  const set = transaction(t, 'a.live.set', Set, (_st, p) => ({ text: p.text }))\n  return (\n    <Box as="main">\n      <Text id="a.live.text">{t.get('text')}</Text>\n      <Button id="a.live.go" onClick={() => tx(set, { text: 'after' })}>Go</Button>\n    </Box>\n  )\n}\n`,
  },
  /** A click handler that fails with `Error('boom')` and a page that never reads it. */
  boom: {
    name: "boom",
    path: "/boom",
    source: `${UI}export default function Page() {\n  return (\n    <Box as="main">\n      <Button id="a.boom.go" onClick={() => { void Promise.reject(new Error('boom')) }}>Go</Button>\n    </Box>\n  )\n}\n`,
  },
  /** A text input in an island (the button gives it a handler), for a held page. */
  list: {
    name: "list",
    path: "/list",
    source: `${UI}export default function Page() {\n  return (\n    <Box as="main">\n      <Input id="a.name" label="Name" />\n      <Button id="a.list.go" onClick={() => undefined}>Go</Button>\n    </Box>\n  )\n}\n`,
  },
  /** The same page whose client render differs from the server's (the server's DOM reports `HappyDOM`): the claim replaces the input. */
  replace: {
    name: "replace",
    path: "/replace",
    source: `${UI}export default function Page() {\n  const server = navigator.userAgent.includes('HappyDOM')\n  return (\n    <Box as="main">\n      {server ? <Input id="a.name" label="Name" /> : <Input id="a.name" label="Name again" />}\n      <Button id="a.list.go" onClick={() => undefined}>Go</Button>\n    </Box>\n  )\n}\n`,
  },
  /** A button whose handler fetches `https://api.example.com/x`: `a.connect.text` says `ok` for `{ ok: true }` and `blocked` when the browser refuses. */
  connect: {
    name: "connect",
    path: "/connect",
    source: `${UI}${STORE}const T = s.object({ text: s.string() })\nconst Set = s.object({ text: s.string() })\nexport default function Page() {\n  const t = store(T, { text: 'idle' }, { id: 'a.connect.t' })\n  const set = transaction(t, 'a.connect.set', Set, (_st, p) => ({ text: p.text }))\n  const go = async () => {\n    try {\n      const r = await fetch('https://api.example.com/x')\n      const j: unknown = await r.json()\n      tx(set, { text: typeof j === 'object' && j !== null && Reflect.get(j, 'ok') === true ? 'ok' : 'bad' })\n    } catch {\n      tx(set, { text: 'blocked' })\n    }\n  }\n  return (\n    <Box as="main">\n      <Text id="a.connect.text">{t.get('text')}</Text>\n      <Button id="a.connect.go" onClick={go}>Go</Button>\n    </Box>\n  )\n}\n`,
  },
  /** Text of `#777777` on `#ffffff`. */
  contrast: {
    name: "contrast",
    path: "/contrast",
    source: `${UI}export default function Page(props: { data: { fg: string } }) {\n  return (\n    <Box as="main">\n      <Text id="a.low" style={{ color: props.data.fg, backgroundColor: '#ffffff' }}>Low contrast</Text>\n    </Box>\n  )\n}\n`,
  },
  /** The only focusable element is `a.button`, outlined `2px solid` when focused. */
  focus: {
    name: "focus",
    path: "/focus",
    source: `${UI}export default function Page() {\n  return (\n    <Box as="main">\n      <Link id="a.button" to="/focus" style={{ focus: { outline: '2px solid #000000' } }}>Go</Link>\n    </Box>\n  )\n}\n`,
  },
} as const satisfies Record<string, Page>;

/** The files of module `id`: its contract, an `a.env`-style entry `<id>.env`, the pages, and (with `home`) the store, the loader and the action. */
export function moduleFiles(
  id: string,
  pages: readonly Page[],
  opts: { home?: boolean; env?: readonly string[] } = {},
): Tree {
  const m = `modules/${id}`;
  const entries = [
    ...(opts.home === true ? [`'${id}.home': { path: '/' }`] : []),
    ...pages.map((p) => `'${id}.${p.name}': { path: '${p.path}' }`),
  ].join(",\n  ");
  const routes = [
    ...(opts.home === true ? [`'${id}.home': { component: Home, loader: home, POST: add }`] : []),
    ...pages.map(
      (p) =>
        `'${id}.${p.name}': { component: ${p.name === "contrast" ? "Contrast" : cap(p.name)}${p.name === "contrast" ? ", loader: lowText" : ""} }`,
    ),
  ].join(",\n  ");
  const imports = [
    ...(opts.home === true
      ? [
          `import Home from './Home.tsx'`,
          `import { home } from './home.server.ts'`,
          `import { add } from './add.server.ts'`,
        ]
      : []),
    ...pages.map((p) => `import ${p.name === "contrast" ? "Contrast" : cap(p.name)} from './${cap(p.name)}.tsx'`),
    ...(pages.some((p) => p.name === "contrast") ? [`import { lowText } from './lowText.server.ts'`] : []),
    `import { ${id} } from './${id}.contract.ts'`,
    `import { env } from './env.server.ts'`,
    ...(pages.some((p) => p.name === "stream") ? [`import { ticks } from './ticks.server.ts'`] : []),
  ];
  const tick = pages.some((p) => p.name === "stream");
  const tree: Tree = {
    [`${m}/module.ts`]: manifest(id, opts.env),
    [`${m}/${id}.contract.ts`]: `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const ${id} = contract('${id}', {\n  ${entries === "" ? "" : `${entries},\n  `}'${id}.env': { method: 'GET', path: '/api/${id}/env', output: s.object({ secret: s.string(), peerApi: s.string(), peerWeb: s.string(), origin: s.string(), data: s.string() }) },\n${tick ? `  '${id}.ticks': { method: 'GET', path: '/api/${id}/ticks', output: s.number(), events: true },\n` : ""}})\n`,
    [`${m}/env.server.ts`]: `import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { ${id} } from './${id}.contract.ts'\nconst Out = s.object({ secret: s.string(), peerApi: s.string(), peerWeb: s.string(), origin: s.string(), data: s.string() })\nexport const env = loader(${id}, '${id}.env', { output: Out }, async () => ok({ secret: process.env.KEEL_SECRET ?? '', peerApi: process.env.KEEL_PEER_API ?? '', peerWeb: process.env.KEEL_PEER_WEB ?? '', origin: process.env.KEEL_ORIGIN ?? '', data: process.env.KEEL_DATABASE_URL ?? '' }))\n`,
    [`${m}/routes.ts`]: `import { manifest } from '@keel/router'\n${imports.join("\n")}\nexport const routes = manifest(${id}, {\n  ${routes === "" ? "" : `${routes},\n  `}'${id}.env': { loader: env },\n${tick ? `  '${id}.ticks': { loader: ticks },\n` : ""}})\n`,
  };
  for (const p of pages) tree[`${m}/${cap(p.name)}.tsx`] = p.source;
  if (tick)
    tree[`${m}/ticks.server.ts`] =
      `import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { ${id} } from './${id}.contract.ts'\nexport const ticks = loader(${id}, '${id}.ticks', { output: s.number() }, async function* ({ signal }) {\n  yield ok(1)\n  await new Promise<void>((done) => signal.addEventListener('abort', () => done()))\n})\n`;
  if (pages.some((p) => p.name === "contrast"))
    tree[`${m}/lowText.server.ts`] =
      `import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { ${id} } from './${id}.contract.ts'\nexport const lowText = loader(${id}, '${id}.contrast', { output: s.object({ fg: s.string() }) }, async () => ok({ fg: '#777777' }))\n`;
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
    [`${m}/boards.ts`]: `import { store, transaction } from '@keel/store'\nimport { s } from '@keel/schema'\nimport { Board } from './Board.schema.ts'\nexport const boards = () => {\n  const board = store(Board, { lists: [] }, { id: '${id}.board' })\n  const addList = transaction(board, '${id}.addList', s.object({ name: s.string() }), (st, p) => ({ lists: [...st.lists, p.name] }))\n  return { board, addList }\n}\n`,
    [`${m}/home.server.ts`]: `import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { ${id} } from './${id}.contract.ts'\nimport { boards } from './boards.ts'\nexport const home = loader(${id}, '${id}.home', { output: s.object({ count: s.int() }), stores: boards }, async ({ stores }) => ok({ count: stores.board.get('lists').length }))\n`,
    [`${m}/add.server.ts`]: `import { action } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { tx } from '@keel/store'\nimport { ${id} } from './${id}.contract.ts'\nimport { boards } from './boards.ts'\nexport const add = action(${id}, '${id}.home', { input: s.object({}), stores: boards }, async (_input, { stores }) => {\n  tx(stores.addList, { name: 'list' })\n  return ok(null)\n})\n`,
    [`${m}/Home.tsx`]: `import { Form } from '@keel/router'\nimport { Box, Button, Text } from '@keel/ui'\nimport { ${id} } from './${id}.contract.ts'\nexport default function Home(props: { data: { count: number } }) {\n  return (\n    <Box as="main">\n      <Text id="a.count">{String(props.data.count)}</Text>\n      <Form method="POST" action={${id}.href('${id}.home')}>\n        <Button id="a.add">Add</Button>\n      </Form>\n    </Box>\n  )\n}\n`,
  };
}

const PKG = `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`;
const VITE =
  'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n';
const TSCONFIG = JSON.stringify({
  compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
});
/** The root files every fixture project holds. */
export const rootFiles = (topology: string): Tree => ({
  "package.json": PKG,
  "vite.config.ts": VITE,
  "tsconfig.json": TSCONFIG,
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
