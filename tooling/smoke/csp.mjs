// The content security policy as a reader's browser gets it from built servers (k.security, k.origins).
// 1. A copy of golden-1 whose `web` client (served by the `api` node) declares an `img` and a `connect` origin and
//    whose `api` declares an `img` origin of its own: `keel build` writes `dist/web/csp.txt` with the client's origins
//    and not the host's; the built `api` answers `/` and a client path with exactly that policy; a JSON answer keeps
//    `default-src 'none'; frame-ancestors 'none'` and holds no declared origin.
// 2. A copy of examples/third-party-origin (one `node` deployable with a page) that also declares a `connect` origin:
//    its document carries k.security's policy with a fresh nonce, the declared origins in `img-src` and `connect-src`
//    in declaration order, and no origin it did not declare; two documents carry different nonces.
// Usage: node tooling/smoke/csp.mjs. Nothing is written inside the repo; every server is stopped in a `finally`.
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIn, copyApp, freePort, recorder, root, serve, stop, wait } from "./built.mjs";

const { step, finish } = recorder();
const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-csp-"));
const SECRET = "csp-smoke-secret-of-32-bytes-or-more-ok";
const WEB_IMG = "https://img.example";
const WEB_CONNECT = "https://events.example";
const API_IMG = "https://api-img.example";
const NODE_CONNECT = "https://telemetry.example";
const TILES = "https://tile.openstreetmap.org";
let api;
let node;

/** Poll `base+path` for an answer at most `ms`; resolves the response, or null. */
async function answer(base, path, accept, ms = 20_000) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(100)) {
    const res = await fetch(`${base}${path}`, { headers: { accept } }).catch(() => null);
    if (res !== null) return res;
  }
  return null;
}

/** Replace `from` in the file at `path`; true when it changed. */
async function plant(path, from, to) {
  const src = await readFile(path, "utf8");
  const next = src.replace(from, to);
  await writeFile(path, next);
  return next !== src;
}

const policyOf = (res) => res?.headers.get("content-security-policy") ?? "";

try {
  // 1. A client served by a node host.
  const g1 = join(tmp, "golden-1");
  await copyApp(g1);
  const planted = await plant(
    join(g1, "topology.ts"),
    'servedBy: "api",',
    `servedBy: "api",\n    origins: { img: { "${WEB_IMG}": "photos" }, connect: { "${WEB_CONNECT}": "analytics" } },`,
  );
  const plantedApi = await plant(
    join(g1, "topology.ts"),
    'adapter: "node", storage: "sqlite"',
    `adapter: "node", storage: "sqlite", origins: { img: { "${API_IMG}": "api images" } }`,
  );
  step("plant golden-1 origins", planted && plantedApi);
  const built = await buildIn(g1);
  step("build golden-1", built);
  if (!built) throw new Error("golden-1 build failed");
  const txt = (await readFile(join(g1, "dist", "web", "csp.txt"), "utf8")).trim();
  step(
    "csp.txt holds the client's origins",
    txt.includes(`img-src 'self' ${WEB_IMG}`) && txt.includes(`connect-src 'self' ${WEB_CONNECT}`),
  );
  step("csp.txt lacks the host's origin", !txt.includes(API_IMG));
  step("csp.txt has no nonce or report directive", txt.includes("script-src 'self'") && !/nonce|report-/.test(txt));

  const file = join(tmp, "data", "keel.sqlite");
  await mkdir(join(tmp, "data"));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  api = serve(g1, file, port);
  const root_ = await answer(base, "/", "text/html");
  step("host serves /", root_?.status === 200, String(root_?.status));
  step("/ carries csp.txt", policyOf(root_) === txt, policyOf(root_) === txt ? "" : policyOf(root_).slice(0, 160));
  const deep = await answer(base, "/lists/l1", "text/html");
  step("a client path carries csp.txt", deep?.status === 200 && policyOf(deep) === txt, String(deep?.status));
  const json = await answer(base, "/api/lists", "application/json");
  const jp = policyOf(json);
  step(
    "JSON keeps the closed policy",
    json?.status === 200 && jp === "default-src 'none'; frame-ancestors 'none'",
    jp.slice(0, 120),
  );

  // 2. A node deployable's own document.
  const ex = join(tmp, "third-party-origin");
  await copyApp(ex, join(root, "examples", "third-party-origin"));
  const plantedNode = await plant(
    join(ex, "topology.ts"),
    'origins: { img: { "https://tile.openstreetmap.org": "map tiles on the home page" } },',
    `origins: {\n      img: { "${TILES}": "map tiles on the home page" },\n      connect: { "${NODE_CONNECT}": "usage counts" },\n    },`,
  );
  step("plant node origins", plantedNode);
  const builtNode = await buildIn(ex);
  step("build node example", builtNode);
  if (!builtNode) throw new Error("example build failed");
  const nodePort = await freePort();
  const nodeBase = `http://127.0.0.1:${nodePort}`;
  const child = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", join(ex, "dist", "web", "server.mjs")],
    { cwd: ex, env: { ...process.env, PORT: String(nodePort), KEEL_SECRET: SECRET }, stdio: "ignore" },
  );
  const exited = new Promise((r) => child.once("exit", r));
  node = {
    async kill() {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await Promise.race([exited, wait(10_000)]);
    },
  };
  const doc = await answer(nodeBase, "/", "text/html");
  const p1 = policyOf(doc);
  const html = doc === null ? "" : await doc.text();
  const nonce = /'nonce-([^']+)'/.exec(p1)?.[1] ?? "";
  const expected = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self'",
    `img-src 'self' ${TILES}`,
    "font-src 'self'",
    `connect-src 'self' ${NODE_CONNECT}`,
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    "trusted-types keel",
    "report-uri /__keel/csp",
    "report-to keel-csp",
  ].join("; ");
  step("node document served", doc?.status === 200, String(doc?.status));
  step("node policy is k.security's with the declared origins", p1 === expected, p1 === expected ? "" : p1);
  step("the nonce is the module script's", nonce.length === 64 && html.includes(`nonce="${nonce}"`), `${nonce.length}`);
  step("no undeclared origin", ![WEB_IMG, WEB_CONNECT, API_IMG].some((o) => p1.includes(o)));
  const again = policyOf(await answer(nodeBase, "/", "text/html"));
  step(
    "a second document has a new nonce",
    again !== p1 && again.replace(/'nonce-[^']+'/, "") === p1.replace(/'nonce-[^']+'/, ""),
  );
} catch (e) {
  step("flow", false, String(e).split("\n")[0]);
} finally {
  await stop(api);
  await node?.kill();
  await rm(tmp, { recursive: true, force: true });
}
finish("csp");
