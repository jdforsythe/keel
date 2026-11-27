// @vitest-environment node
// No spec clause states these rules (they are an app's: RFC 0244 The review's findings 1; `spec/` holds no section for `apps/inspector`), so no `Spec:` line is cited and the cases do not enter the ledger: reported as a gap.
// Rule: the inspector takes `?url=` only when that is an origin and builds `origin + '/__keel/inspect'` itself, so nothing of the caller's string survives; it answers only a request whose `Host` is a loopback name with a port and whose `Sec-Fetch-Site` is `same-origin` or `none`, any other is 403 `keel.denied` with nothing fetched;
// every fetch failure is one answer, `inspector.unreachable` `no inspect document at <origin>`.
// Seed: n/a (no generated input). Method: as e2e-serve.test.ts: the e2e file copies `apps/inspector` to a temp folder, builds it (`build(copy)`, RFC 0244 Migration) and serves it; a stand-in server of the test (`answer`) records what the inspector sent it. Requests go through `node:http` so `Host` and `Sec-Fetch-Site` are the test's.
// The cases need Chromium for the runner (e2e-support.ts); none skips. ASSUMED: (1) the page for `/?url=<origin>` is served at `/` and its body, text of the failure included, is in the response document; (2) a request with no `Sec-Fetch-Site` is not asserted either way: every allowed case sends `none`;
// (3) `build(dir)` resolves once `dist/` is written.
import { testTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REPO, type Ran, cleanup, passedJob, runJobs, suite } from "./e2e-support.ts";
import { PAGES, nodeApp } from "./fixtures/e2e/node-app.ts";

const IMPORTS = [
  "import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'",
  "import { request } from 'node:http'",
  "import { tmpdir } from 'node:os'",
  "import { join } from 'node:path'",
  "import { answer, build, serve } from '@keel/testing/e2e'",
];
const PRELUDE = `const source = process.env.KEEL_INSPECTOR_SRC ?? ''
const copyOf = (): string => {
  const to = join(tmpdir(), 'keel-inspector-copy-' + process.pid + '-' + String(process.hrtime.bigint()))
  cpSync(source, to, { recursive: true, filter: (p) => !p.includes('node_modules') && !p.includes('reports') && !p.includes('dist') })
  mkdirSync(join(to, 'node_modules'))
  for (const base of [join(source, 'node_modules'), join(source, '..', '..', 'node_modules')])
    for (const name of readdirSync(base))
      if (!name.startsWith('.') && !existsSync(join(to, 'node_modules', name))) symlinkSync(join(base, name), join(to, 'node_modules', name))
  return to
}
const ask = (port: number, path: string, headers: Record<string, string>): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.end()
  })`;

const inspector = suite(IMPORTS, [
  {
    title: "the inspector sends only the inspect path of an origin and refuses the other callers and targets",
    body: `${PRELUDE}
const copy = copyOf()
await build(copy)
const inspector = await serve({ project: copy })
const port = Number(new URL(inspector.origin()).port)
const stand = await answer(() => new Response('not an inspect document', { status: 404 }))
const good = { host: '127.0.0.1:' + port, 'sec-fetch-site': 'none' }
const url = (target: string): string => '/?url=' + encodeURIComponent(target)
const sent = (): string[] => stand.requests().map((r) => r.method + ' ' + new URL(r.url, stand.origin).pathname)

// the target is an origin: a path, a query or a user part is refused and nothing but the inspect path is ever requested
for (const target of [stand.origin + '/admin/delete-all%23', stand.origin + '/?q=x', stand.origin.replace('http://', 'http://user:pw@')]) {
  const r = await ask(port, url(target), good)
  expect(r.status).toBeLessThan(500)
  expect(sent().filter((s) => s !== 'GET /__keel/inspect')).toEqual([])
}
await ask(port, url(stand.origin), good)
expect(sent().filter((s) => s !== 'GET /__keel/inspect')).toEqual([])
expect(sent()).toContain('GET /__keel/inspect')

// another caller: a foreign Host, a cross-site navigation: 403 keel.denied and nothing fetched
const before = stand.requests().length
for (const headers of [
  { host: '192.168.1.5:' + port, 'sec-fetch-site': 'none' },
  { host: '127.0.0.1:' + port, 'sec-fetch-site': 'cross-site' },
]) {
  const r = await ask(port, url(stand.origin), headers)
  expect(r.status).toBe(403)
  expect(r.body).toContain('keel.denied')
}
expect(stand.requests().length).toBe(before)

// one failure text: a closed port, a redirect and a body that is no inspect document
const closed = await answer(() => new Response('x'))
const closedOrigin = closed.origin
await closed.dispose()
const redirecting = await answer(() => new Response(null, { status: 302, headers: { location: stand.origin + '/admin' } }))
const plain = await answer(() => new Response('hello', { status: 200 }))
const texts: string[] = []
// the origin appears as written and URL-encoded (the resume state holds the target): both forms are named
const named = (body: string, origin: string): string => body.replaceAll(origin, '<origin>').replaceAll(encodeURIComponent(origin), '<origin>')
for (const origin of [closedOrigin, redirecting.origin, plain.origin]) {
  const r = await ask(port, url(origin), good)
  expect(r.body).toContain('no inspect document at ' + origin)
  for (const leak of ['ECONNREFUSED', '302', 'hello', 'refused']) expect(named(r.body, origin).includes(leak)).toBe(false)
  texts.push(named(r.body, origin))
}
expect(sent().some((s) => s.includes('/admin'))).toBe(false)
expect(new Set(texts.map((t) => t.replace(/[0-9a-f]{16,}/g, '')))).toHaveProperty('size', 1)
rmSync(copy, { recursive: true, force: true })`,
  },
]);

const FILE = "test/inspector.e2e.ts";
let ran = new Map<string, Ran>();
beforeAll(() => {
  ran = runJobs([
    {
      key: "inspector",
      tree: nodeApp(Object.values(PAGES)),
      file: FILE,
      source: inspector.source,
      env: { KEEL_INSPECTOR_SRC: `${REPO}apps/inspector`, KEEL_TEST_TIME_SCALE: "1" },
    },
  ]);
}, testTime(3_000_000));
afterAll(cleanup);

describe("apps/inspector loader (RFC 0244 finding 1; no spec clause)", () => {
  it("the inspector asked for an origin plus a path or a query sends only GET /__keel/inspect, answers a foreign Host or a cross-site caller 403 keel.denied with nothing fetched, and gives one failure text", () => {
    passedJob(
      ran,
      "inspector",
      inspector.lines[
        "the inspector sends only the inspect path of an origin and refuses the other callers and targets"
      ],
    );
  });
});
