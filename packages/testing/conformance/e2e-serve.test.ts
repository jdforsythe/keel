// @vitest-environment node
// Spec: k.e2e, clause "`serve()` of a project with `node` deployables `api` and `web` starts both, each with its own free port, one `KEEL_SECRET`, and `KEEL_PEER_API` set in `web` to `api`'s origin, and `serverLog('api')` holds a `req` record for a `fetch('/')` of `api`."
// Spec: k.e2e, clause "`serve()` of a project whose only deployable is `static` starts no process, and a `fetch` of a path that is no file answers 404 with `404.html` and the `content-security-policy` header equal to `dist/<name>/csp.txt`."
// Spec: k.e2e, clause "`serve()` of a deployable whose served module's manifest names `env` `PAYMENTS_URL`, given no such `env`, rejects E1737 naming the deployable and `PAYMENTS_URL`, and leaves no process running."
// Spec: k.e2e, clause "Two `serve()` calls of one project in one test have different ports, data folders and `KEEL_SECRET`s, and a store saved through one is not in `state` of the other."
// Spec: k.e2e, clause "`until(board, (b) => b.lists.length === 1)` resolves once a page's add is committed, and rejects E1735 naming the store's id when no commit makes it true within the bound."
// Spec: k.e2e, clause "After `stop()` a `fetch` of the deployable's origin rejects; after `start()` it answers, and `state(store)` holds what was saved before `stop()`."
// Spec: k.e2e, clause "A page of a `serve` whose `origins` map `https://api.example.com` to an `answer` returning `Response.json({ ok: true })` receives that answer for a request the page's code makes there while the policy's `connect-src` lists the origin, and the request is refused, with the `answer`'s `requests()` empty, when it does not."
// Spec: k.e2e, clause "After a test that made a `serve` ends, passed or failed, none of its processes runs and its data folder is gone."
// k.e2e Rules (E1736 `page` outside a library's folder, E1737 a deployable that did not start by an exit or a missing `dist/<name>/`) are asserted by the two last cases.
// Seed: 1337 (the property inside the isolation fixture test, 3 runs). Method: each project below is a built-app fixture (fixtures/e2e/) whose e2e file holds the clause's test;
// `keel test --e2e` runs it once (e2e-support.ts) and each case reads the run's report. The cases need Chromium (e2e-support.ts says how they are provided); none skips.
// ASSUMED (the spec names no fixture): `Board` of `modules/a/Board.schema.ts` is the schema of the server store `a.board`; the test makes its `board` with `store(Board, { lists: [] }, { id: 'a.board' })`
// to hand to `state` and `until`. A form POST to `/` with `accept` html is the page's add (303); `GET /api/a/env` answers `{ results: { 'a.env': { value } } }` as app-data-support.ts reads an API entry.
// The `static` clause's header is read as `csp.txt`'s text with its ends trimmed; `ps` names a process by its command line, which holds the project's path.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Run, cleanup, keelE2e, outcome, project, suite } from "./e2e-support.ts";
import { PAGES, nodeApp } from "./fixtures/e2e/node-app.ts";
import { staticApp } from "./fixtures/e2e/static-app.ts";
import { twoNodeApp } from "./fixtures/e2e/two-node.ts";

const CONNECT = ", origins: { connect: { 'https://api.example.com': 'payments' } }";

/** `GET /api/<module>/env` of a deployable, read from the test process (the values the process holds). */
const ENV_HELPER = `import { serve } from '@keel/testing/e2e'
export type Served = Awaited<ReturnType<typeof serve>>
export async function envOf(app: Served, deployable: string, mod = 'a'): Promise<Record<string, string>> {
  const res = await app.fetch(\`/api/\${mod}/env\`, { deployable, headers: { accept: 'application/json' } })
  const body: unknown = await res.json()
  const results = typeof body === 'object' && body !== null ? Reflect.get(body, 'results') : undefined
  const entry = typeof results === 'object' && results !== null ? Reflect.get(results, \`\${mod}.env\`) : undefined
  const value = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'value') : undefined
  if (typeof value !== 'object' || value === null) throw new Error('no env answer')
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]))
}
export const alive = (needle: string): boolean => {
  const ps = spawnSync('ps', ['-A', '-o', 'command='], { encoding: 'utf8' })
  return ps.stdout.split('\\n').some((l) => l.includes(needle))
}
import { spawnSync } from 'node:child_process'
`;

const two = suite(
  ["import { serve } from '@keel/testing/e2e'", "import { envOf } from './support.ts'"],
  [
    {
      title: "starts api and web, one secret, peer wired, serverLog holds the req",
      body: `const app = await serve()
const api = await envOf(app, 'api')
const web = await envOf(app, 'web', 'b')
expect(app.origin('api')).not.toBe(app.origin('web'))
expect(new URL(app.origin('api')).port).not.toBe(new URL(app.origin('web')).port)
expect(api.origin).toBe(app.origin('api'))
expect(web.origin).toBe(app.origin('web'))
expect(api.secret).toMatch(/^[0-9a-f]{64}$/)
expect(web.secret).toBe(api.secret)
expect(web.peerApi).toBe(app.origin('api'))
await app.fetch('/', { deployable: 'api' })
expect(app.serverLog('api').some((r) => r.kind === 'req' && r.path === '/')).toBe(true)`,
    },
  ],
);

const stat = suite(
  [
    "import { readFileSync } from 'node:fs'",
    "import { serve } from '@keel/testing/e2e'",
    "import { alive } from './support.ts'",
  ],
  [
    {
      title: "static starts no process, a missing path is 404.html with csp.txt",
      body: `const app = await serve()
expect(alive('dist/site/server.mjs')).toBe(false)
expect(app.serverLog('site')).toEqual([])
const res = await app.fetch('/no/such/file')
expect(res.status).toBe(404)
expect(await res.text()).toBe(readFileSync('dist/site/404.html', 'utf8'))
expect(res.headers.get('content-security-policy')?.trim()).toBe(readFileSync('dist/site/csp.txt', 'utf8').trim())`,
    },
  ],
);

const envFile = suite(
  ["import { serve } from '@keel/testing/e2e'", "import { alive } from './support.ts'"],
  [
    {
      title: "E1737 names the deployable and PAYMENTS_URL and leaves no process",
      body: `const error: unknown = await serve().then(() => undefined, (e: unknown) => e)
expect(Reflect.get(Object(error), 'code')).toBe('E1737')
const message = String(Reflect.get(Object(error), 'message'))
expect(message).toContain('api')
expect(message).toContain('PAYMENTS_URL')
expect(alive(process.cwd() + '/dist/api/server.mjs')).toBe(false)`,
    },
  ],
);

const main = suite(
  [
    "import { cpSync, existsSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'",
    "import { tmpdir } from 'node:os'",
    "import { join } from 'node:path'",
    "import fc from 'fast-check'",
    "import { store } from '@keel/store'",
    "import { answer, serve } from '@keel/testing/e2e'",
    "import { Board } from '../modules/a/Board.schema.ts'",
    "import { alive, envOf } from './support.ts'",
    "const board = store(Board, { lists: [] }, { id: 'a.board' })",
    "const post = { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html' }, body: '' }",
    "const copyOf = (): string => {",
    "  const to = join(tmpdir(), 'keel-e2e-copy-' + process.pid + '-' + Math.floor(performance.now()))",
    "  cpSync(process.cwd(), to, { recursive: true, filter: (p) => !p.includes('node_modules') && !p.includes('reports') })",
    "  symlinkSync(join(process.cwd(), 'node_modules'), join(to, 'node_modules'))",
    "  return to",
    "}",
  ],
  [
    {
      title: "two serves differ in port, data and secret and share no store",
      body: `await fc.assert(
  fc.asyncProperty(fc.integer({ min: 0, max: 2 }), async (n) => {
    const a = await serve()
    const b = await serve()
    expect(a.origin()).not.toBe(b.origin())
    const ea = await envOf(a, 'api')
    const eb = await envOf(b, 'api')
    expect(ea.secret).not.toBe(eb.secret)
    expect(ea.data).not.toBe(eb.data)
    for (let i = 0; i < n; i++) expect((await a.fetch('/', post)).status).toBe(303)
    expect((await a.state(board)).lists).toHaveLength(n)
    expect((await b.state(board)).lists).toHaveLength(0)
    await a.dispose()
    await b.dispose()
  }),
  { seed: 1337, numRuns: 3 },
)`,
    },
    {
      title: "until resolves once the add is committed and rejects E1735 naming the store",
      body: `const app = await serve()
const page = await app.open('/')
await page.fire('a.add', { type: 'click' })
const value = await app.until(board, (b) => b.lists.length === 1)
expect(value.lists).toHaveLength(1)
const error: unknown = await app.until(board, (b) => b.lists.length === 99, { within: 1000 }).then(() => undefined, (e: unknown) => e)
expect(Reflect.get(Object(error), 'code')).toBe('E1735')
expect(String(Reflect.get(Object(error), 'message'))).toContain('a.board')`,
    },
    {
      title: "stop rejects a fetch and start answers with the saved state",
      body: `const app = await serve()
expect((await app.fetch('/', post)).status).toBe(303)
const before = await app.state(board)
expect(before.lists).toHaveLength(1)
await app.stop()
await expect(app.fetch('/')).rejects.toThrow()
await app.start()
expect((await app.fetch('/')).status).toBe(200)
expect(await app.state(board)).toEqual(before)`,
    },
    {
      title: "the origin the policy lists receives the answer",
      body: `const payments = await answer(() => Response.json({ ok: true }))
const app = await serve({ origins: { 'https://api.example.com': payments } })
const page = await app.open('/connect')
await page.fire('a.connect.go', { type: 'click' })
await page.until('a.connect.text', { text: process.env.EXPECT_TEXT ?? '' })
expect(payments.requests()).toHaveLength(Number(process.env.EXPECT_REQUESTS))
const problems = page.problems()
expect(problems.some((p) => p.kind === 'csp')).toBe(process.env.EXPECT_TEXT === 'blocked')`,
    },
    {
      title: "made by a passing test",
      body: `const app = await serve()
const env = await envOf(app, 'api')
writeFileSync('made-pass.json', JSON.stringify({ origin: app.origin(), data: env.data }))`,
    },
    {
      title: "made by a failing test",
      body: `const app = await serve()
const env = await envOf(app, 'api')
writeFileSync('made-fail.json', JSON.stringify({ origin: app.origin(), data: env.data }))
expect(1).toBe(2)`,
    },
    {
      title: "after those tests none of their processes runs and their data is gone",
      body: `for (const name of ['made-pass.json', 'made-fail.json']) {
  const made: { origin: string; data: string } = JSON.parse(readFileSync(name, 'utf8'))
  await expect(fetch(made.origin)).rejects.toThrow()
  expect(existsSync(made.data.replace(/^file:/, '').replace(/\\/[^/]*$/, ''))).toBe(false)
}`,
    },
    {
      title: "a deployable that exits is E1737",
      body: `const copy = copyOf()
writeFileSync(join(copy, 'dist/api/server.mjs'), 'process.exit(3)\\n')
const error: unknown = await serve({ project: copy }).then(() => undefined, (e: unknown) => e)
expect(Reflect.get(Object(error), 'code')).toBe('E1737')
expect(String(Reflect.get(Object(error), 'message'))).toContain('api')
expect(alive(copy)).toBe(false)
rmSync(copy, { recursive: true, force: true })`,
    },
    {
      title: "a missing dist folder is E1737",
      body: `const copy = copyOf()
rmSync(join(copy, 'dist/api'), { recursive: true, force: true })
const error: unknown = await serve({ project: copy }).then(() => undefined, (e: unknown) => e)
expect(Reflect.get(Object(error), 'code')).toBe('E1737')
expect(String(Reflect.get(Object(error), 'message'))).toContain('api')
rmSync(copy, { recursive: true, force: true })`,
    },
    {
      title: "page outside a library's folder is E1736",
      body: `const error: unknown = await serve({ page: () => null }).then(() => undefined, (e: unknown) => e)
expect(Reflect.get(Object(error), 'code')).toBe('E1736')`,
    },
  ],
);

const MAIN_FILE = "test/serve.e2e.ts";
let twoDir = "";
let statDir = "";
let envDir = "";
let okDir = "";
let blockedDir = "";
const runs = new Map<string, Run>();

beforeAll(() => {
  const withSupport = (tree: Record<string, string>): Record<string, string> => ({
    ...tree,
    "test/support.ts": ENV_HELPER,
  });
  twoDir = project(withSupport({ ...twoNodeApp(), "test/two.e2e.ts": two.source }));
  statDir = project(withSupport({ ...staticApp(), "test/static.e2e.ts": stat.source }));
  envDir = project(withSupport({ ...nodeApp([], ["PAYMENTS_URL"]), "test/env.e2e.ts": envFile.source }));
  const pages = Object.values(PAGES);
  okDir = project(withSupport({ ...nodeApp(pages, [], CONNECT), [MAIN_FILE]: main.source }));
  blockedDir = project(withSupport({ ...nodeApp(pages), [MAIN_FILE]: main.source }));
  runs.set("two", keelE2e(twoDir));
  runs.set("static", keelE2e(statDir));
  runs.set("env", keelE2e(envDir));
  runs.set("ok", keelE2e(okDir, [], { env: { EXPECT_TEXT: "ok", EXPECT_REQUESTS: "1" } }));
  runs.set("blocked", keelE2e(blockedDir, [], { env: { EXPECT_TEXT: "blocked", EXPECT_REQUESTS: "0" } }));
}, 3_000_000);
afterAll(cleanup);

const why = (key: string): string => {
  const r = runs.get(key);
  return r === undefined ? "no run" : `${r.stdout}\n${r.stderr}`.slice(-3000);
};
const passed = (dir: string, file: string, line: number | undefined, key: string): void => {
  expect(line, "the fixture test exists").toBeDefined();
  expect(outcome(dir, file, line ?? 0), why(key)).toBe("passed");
};
const title = (t: string): number | undefined => main.lines[t];

describe("k.e2e serve", () => {
  it("`serve()` of a project with `node` deployables `api` and `web` starts both, each with its own free port, one `KEEL_SECRET`, and `KEEL_PEER_API` set in `web` to `api`'s origin, and `serverLog('api')` holds a `req` record for a `fetch('/')` of `api`", () => {
    passed(
      twoDir,
      "test/two.e2e.ts",
      two.lines["starts api and web, one secret, peer wired, serverLog holds the req"],
      "two",
    );
  });

  it("`serve()` of a project whose only deployable is `static` starts no process, and a `fetch` of a path that is no file answers 404 with `404.html` and the `content-security-policy` header equal to `dist/<name>/csp.txt`", () => {
    passed(
      statDir,
      "test/static.e2e.ts",
      stat.lines["static starts no process, a missing path is 404.html with csp.txt"],
      "static",
    );
  });

  it("`serve()` of a deployable whose served module's manifest names `env` `PAYMENTS_URL`, given no such `env`, rejects E1737 naming the deployable and `PAYMENTS_URL`, and leaves no process running", () => {
    passed(
      envDir,
      "test/env.e2e.ts",
      envFile.lines["E1737 names the deployable and PAYMENTS_URL and leaves no process"],
      "env",
    );
  });

  it("Two `serve()` calls of one project in one test have different ports, data folders and `KEEL_SECRET`s, and a store saved through one is not in `state` of the other", () => {
    passed(okDir, MAIN_FILE, title("two serves differ in port, data and secret and share no store"), "ok");
  });

  it("`until(board, (b) => b.lists.length === 1)` resolves once a page's add is committed, and rejects E1735 naming the store's id when no commit makes it true within the bound", () => {
    passed(
      okDir,
      MAIN_FILE,
      title("until resolves once the add is committed and rejects E1735 naming the store"),
      "ok",
    );
  });

  it("After `stop()` a `fetch` of the deployable's origin rejects; after `start()` it answers, and `state(store)` holds what was saved before `stop()`", () => {
    passed(okDir, MAIN_FILE, title("stop rejects a fetch and start answers with the saved state"), "ok");
  });

  it("A page of a `serve` whose `origins` map `https://api.example.com` to an `answer` returning `Response.json({ ok: true })` receives that answer for a request the page's code makes there while the policy's `connect-src` lists the origin, and the request is refused, with the `answer`'s `requests()` empty, when it does not", () => {
    const line = title("the origin the policy lists receives the answer");
    passed(okDir, MAIN_FILE, line, "ok");
    passed(blockedDir, MAIN_FILE, line, "blocked");
  });

  it("After a test that made a `serve` ends, passed or failed, none of its processes runs and its data folder is gone", () => {
    expect(outcome(okDir, MAIN_FILE, title("made by a passing test") ?? 0), why("ok")).toBe("passed");
    expect(outcome(okDir, MAIN_FILE, title("made by a failing test") ?? 0), why("ok")).toBe("failed");
    passed(okDir, MAIN_FILE, title("after those tests none of their processes runs and their data is gone"), "ok");
  });

  it("E1737 a deployable that did not start: a process that exits, a `dist/<name>/` missing", () => {
    passed(okDir, MAIN_FILE, title("a deployable that exits is E1737"), "ok");
    passed(okDir, MAIN_FILE, title("a missing dist folder is E1737"), "ok");
  });

  it("E1736 `page` outside a library's folder", () => {
    passed(okDir, MAIN_FILE, title("page outside a library's folder is E1736"), "ok");
  });
});
