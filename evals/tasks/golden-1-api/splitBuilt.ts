// The built half of the golden-1 split proof: two copies of apps/golden-1 that differ
// only in topology.ts, each built with `keel build` and checked with `keel check`, served from their generated
// `dist/<name>/server.mjs` entries and driven by one HTTP script through `api`. Returns undefined when every step
// holds, else the failed steps on one line.
import { type ChildProcess, execFile, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";

const SKIP = new Set(["node_modules", "dist", "deploy", ".keel", ".turbo"]);
const SECRET = "golden-1-split-proof-secret-of-32-bytes-or-more";
const TOPOLOGY_B = `import { topology } from "@keel/server";

export default topology({
  web: { modules: ["todos"], adapter: "client" },
  api: { modules: ["api", "sessions"], adapter: "node" },
  digest: { modules: ["digest"], adapter: "node" },
});
`;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

type Run = { ok: boolean; stdout: string; stderr: string };
const sh = (cmd: string, args: string[], cwd: string, env: Record<string, string | undefined> = {}): Promise<Run> =>
  new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, KEEL_AGENT: "1", ...env } },
      (err, stdout, stderr) => resolve({ ok: err === null, stdout: String(stdout), stderr: String(stderr) }),
    );
  });

class Fail extends Error {}
const must = (cond: boolean, step: string): void => {
  if (!cond) throw new Fail(step);
};

/** Every file under `dir` but the generated and installed folders at its root: relative path -> bytes as text. */
async function sources(dir: string, rel = "", out = new Map<string, string>()): Promise<Map<string, string>> {
  for (const e of await readdir(join(dir, rel), { withFileTypes: true })) {
    const p = rel === "" ? e.name : `${rel}/${e.name}`;
    // Generated and installed folders are skipped at the app root only: a source folder of the same name deeper down counts.
    if (rel === "" && (SKIP.has(e.name) || e.name.startsWith(".api.storage"))) continue;
    if (e.isDirectory()) await sources(dir, p, out);
    else if (e.isFile()) out.set(p, await readFile(join(dir, p), "latin1"));
  }
  return out;
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a !== null ? a.port : 0;
      s.close(() => resolve(port));
    });
  });

type Proc = { child: ChildProcess; out: string[]; exited: Promise<number | null> };
function serve(copy: string, name: string, port: number, storage: string, env: Record<string, string>): Proc {
  const child = spawn(
    process.execPath,
    [
      "--experimental-webstorage",
      `--localstorage-file=${storage}`,
      "--disable-warning=ExperimentalWarning",
      join(copy, "dist", name, "server.mjs"),
    ],
    { cwd: copy, env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET, ...env }, stdio: "pipe" },
  );
  const out: string[] = [];
  child.stdout?.on("data", (b) => out.push(String(b)));
  child.stderr?.on("data", (b) => out.push(String(b)));
  const exited = new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));
  return { child, out, exited };
}

async function ready(url: string): Promise<boolean> {
  for (let i = 0; i < 100; i++) {
    const r = await fetch(url, { headers: { accept: "application/json" } }).then(
      (res) => res.status,
      () => 0,
    );
    if (r !== 0) return true;
    await sleep(100);
  }
  return false;
}

async function stop(p: Proc): Promise<number | null | "timeout"> {
  p.child.kill("SIGTERM");
  return Promise.race([p.exited, sleep(10_000).then((): "timeout" => "timeout")]);
}

const field = (v: unknown, ...keys: string[]): unknown =>
  keys.reduce<unknown>((o, k) => (typeof o === "object" && o !== null ? Reflect.get(o, k) : undefined), v);
const ids = (v: unknown, key: string): string[] => (Array.isArray(v) ? v.map((x) => String(field(x, key))) : []);

/**
 * The response headers that are meaningful and deterministic across topologies. Excluded: `date` (clock),
 * `content-length`, `etag`, `transfer-encoding`, `connection` and `keep-alive` (framing and body bytes that differ
 * with ids and with the forwarding hop), `x-powered-by`-style server noise. `set-cookie` is kept by shape: its name
 * and attributes, with the value (which carries the caller id) replaced.
 */
function meaningful(h: Headers): Record<string, string | string[] | null> {
  return {
    "content-type": h.get("content-type"),
    location: h.get("location"),
    "cache-control": h.get("cache-control"),
    vary: h.get("vary"),
    "set-cookie": h.getSetCookie().map((c) => c.replace(/^([^=;]+)=[^;]*/, "$1=#value")),
  };
}

/** The HTTP script of the in-process proof against `base`, with polling in place of clock control. */
async function script(base: string): Promise<{ transcript: unknown[]; digest: unknown }> {
  const t: unknown[] = [];
  const headers = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };
  const send = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: method === "GET" ? { accept: "application/json" } : headers,
      ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
    });
    const parsed: unknown = await res.json().catch(() => null);
    t.push({ req: `${method} ${path}`, status: res.status, headers: meaningful(res.headers), body: parsed });
    return parsed;
  };
  const digest = async (): Promise<unknown> =>
    field(
      await fetch(`${base}/digest`, { headers: { accept: "application/json" } })
        .then((r) => r.json())
        .catch(() => null),
      "results",
      "digest.show",
      "value",
    );
  const until = async (pred: (d: unknown) => boolean): Promise<unknown> => {
    for (let i = 0; i < 50; i++) {
      const d = await digest();
      if (pred(d)) return d;
      await sleep(100);
    }
    return digest();
  };

  // Each write carries its own key; base 0 is stale after the first, so the rebasing writes record it.
  let keys = 0;
  const write = () => ({ key: `w${++keys}`, base: 0 });
  await send("POST", "/api/lists", { name: "Home", write: write() });
  const listId = ids(field(await send("GET", "/api/lists"), "results", "api.lists", "value", "lists"), "id")[0] ?? "";
  for (const title of ["Milk", "Eggs", "Tea"])
    await send("POST", `/api/lists/${listId}/todos`, { title, priority: "normal", write: write() });
  const board = await send("GET", "/api/lists");
  const [milk = "", eggs = ""] = ids(field(board, "results", "api.lists", "value", "todos"), "id");
  await send("POST", `/api/todos/${eggs}/toggle`, { write: write() });
  await send("POST", "/digest/refresh");
  t.push({ polled: await until((d) => field(d, "done") === 1) });
  await send("GET", "/digest");

  const abort = new AbortController();
  const feed = await fetch(`${base}/digest/feed`, { headers: { accept: "text/event-stream" }, signal: abort.signal });
  t.push({ req: "GET /digest/feed", status: feed.status, type: feed.headers.get("content-type") });
  const reader = feed.body?.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const next = async (): Promise<unknown> => {
    for (;;) {
      const line = /^data: (.*)$/m.exec(buf);
      if (line !== null) {
        buf = buf.slice(line.index + line[0].length);
        return JSON.parse(line[1] ?? "null");
      }
      const r = await Promise.race([reader?.read(), sleep(5000).then(() => undefined)]);
      if (r === undefined || r.done) return undefined;
      buf += dec.decode(r.value);
    }
  };
  t.push({ event: await next() });
  await send("POST", `/api/todos/${milk}/toggle`, { write: write() });
  await send("POST", "/digest/refresh");
  t.push({ event: await next() });
  abort.abort();
  const last = await until((d) => field(d, "done") === 2);
  await send("GET", "/digest");
  return { transcript: t, digest: last };
}

/** JSON with ids replaced by their first-appearance index and each `at` time by `#at`. */
function normalized(t: unknown): string {
  const seen = new Map<string, number>();
  return JSON.stringify(t)
    .replace(/"at":\d+(\.\d+)?/g, '"at":"#at"')
    .replace(UUID, (id) => {
      const n = seen.get(id) ?? seen.size;
      seen.set(id, n);
      return `#${n}`;
    });
}

/** The first step where two normalized transcripts differ: `#<index> <request>`, with both statuses when they differ, else `headers or body`. */
function firstDifference(a: string, b: string): string {
  const list = (t: string): unknown[] => {
    const v: unknown = JSON.parse(t);
    return Array.isArray(v) ? v : [];
  };
  const [ea, eb] = [list(a), list(b)];
  const i = ea.findIndex((e, n) => JSON.stringify(e) !== JSON.stringify(eb[n]));
  const at = i === -1 ? ea.length : i;
  const step = String(field(ea[at], "req") ?? field(eb[at], "req") ?? "event");
  const [sa, sb] = [field(ea[at], "status"), field(eb[at], "status")];
  return `#${at} ${step}${sa === sb ? " headers or body" : `: A ${String(sa)}, B ${String(sb)}`}`;
}

/** Copy `app` to `<tmp>/<name>` without its installed or generated folders, sharing its node_modules. */
async function copyApp(app: string, tmp: string, name: string): Promise<string> {
  const to = join(tmp, name);
  await cp(app, to, {
    recursive: true,
    filter: (src) => !/[/\\](node_modules|dist|\.turbo)$/.test(src) && !/\.api\.storage/.test(src),
  });
  await symlink(join(app, "node_modules"), join(to, "node_modules"), "dir");
  return to;
}

export async function splitBuilt(root: string): Promise<string | undefined> {
  const app = join(root, "apps", "golden-1");
  const cli = join(root, "packages", "cli", "src", "bin.ts");
  // Under the git-ignored top-level .fixtures/ (no workspace glob matches it), so the copies resolve the workspace's
  // root dev dependencies (vitest types) as the app does.
  await mkdir(join(root, ".fixtures"), { recursive: true });
  const tmp = await mkdtemp(join(root, ".fixtures", "golden-1-split-"));
  const procs: Proc[] = [];
  // Steps after the servers start are each recorded, so one run reports every one that fails.
  const failed: string[] = [];
  const note = (cond: boolean, step: string): void => {
    if (!cond) failed.push(step);
  };
  try {
    // 1. Two copies; B differs in topology.ts alone.
    const a = await copyApp(app, tmp, "a");
    const b = await copyApp(app, tmp, "b");
    await writeFile(join(b, "topology.ts"), TOPOLOGY_B);
    const [sa, sb] = [await sources(a), await sources(b)];
    const differ = [...new Set([...sa.keys(), ...sb.keys()])].filter((p) => sa.get(p) !== sb.get(p));
    must(
      differ.length === 1 && differ[0] === "topology.ts",
      `source diff is not topology.ts alone: ${differ.join(" ")}`,
    );

    // 2. Build and check each; the deploy files follow the topology.
    for (const { label, dir } of [
      { label: "A", dir: a },
      { label: "B", dir: b },
    ]) {
      const built = await sh(process.execPath, [cli, "build"], dir);
      must(built.ok, `keel build ${label} failed`);
      const checked = await sh(process.execPath, [cli, "check", "--quiet"], dir);
      must(checked.ok, `keel check ${label}: ${checked.stdout.trim().split("\n")[0] ?? ""}`);
    }
    const dockerfiles = async (dir: string) =>
      (await readdir(join(dir, "deploy"), { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    must((await dockerfiles(a)).join() === "api", "A deploy/ holds a Dockerfile other than api");
    must((await dockerfiles(b)).join() === "api,digest", "B deploy/ lacks api and digest Dockerfiles");
    const composeA = await readFile(join(a, "deploy", "compose.yaml"), "utf8");
    const composeB = await readFile(join(b, "deploy", "compose.yaml"), "utf8");
    must(!composeA.includes("KEEL_PEER_"), "A compose.yaml names a peer");
    must(
      composeB.includes("KEEL_PEER_API") && composeB.includes("KEEL_PEER_DIGEST"),
      "B compose.yaml lacks KEEL_PEER_API and KEEL_PEER_DIGEST",
    );

    // 3. Serve each copy's node deployables and run the script through api.
    const pa = await freePort();
    const one = serve(a, "api", pa, join(tmp, "a-api.storage"), { KEEL_ORIGIN: `http://127.0.0.1:${pa}` });
    procs.push(one);
    const [pb, pd] = [await freePort(), await freePort()];
    const origin = `http://127.0.0.1:${pb}`;
    const peers = { KEEL_PEER_API: origin, KEEL_PEER_DIGEST: `http://127.0.0.1:${pd}`, KEEL_ORIGIN: origin };
    const api = serve(b, "api", pb, join(tmp, "b-api.storage"), peers);
    const digestStorage = join(tmp, "b-digest.storage");
    const dig = serve(b, "digest", pd, digestStorage, peers);
    procs.push(api, dig);
    for (const { p, port } of [
      { p: one, port: pa },
      { p: api, port: pb },
      { p: dig, port: pd },
    ])
      must(
        await ready(`http://127.0.0.1:${port}/digest`),
        `server did not answer: ${p.out.join("").trim().split("\n")[0] ?? ""}`,
      );
    const runA = await script(`http://127.0.0.1:${pa}`);
    const runB = await script(origin);
    note(field(runA.digest, "open") === 1 && field(runA.digest, "done") === 2, "A digest is not { open: 1, done: 2 }");
    const events = runA.transcript.filter((e) => field(e, "event") !== undefined).map((e) => field(e, "event", "ok"));
    note(events.length === 2 && events.every((ok) => ok === true), "A feed did not stream two digests");
    const [na, nb] = [normalized(runA.transcript), normalized(runB.transcript)];
    note(na === nb, `transcripts differ: ${firstDifference(na, nb)}`);

    // 4. SIGTERM stops every process with code 0; B's digest restarted on its storage answers the same digest.
    const before = await fetch(`http://127.0.0.1:${pd}/digest`, { headers: { accept: "application/json" } })
      .then((r) => r.text())
      .catch(() => "");
    const counts = (text: string): unknown => {
      try {
        const v: unknown = JSON.parse(text);
        return field(v, "results", "digest.show", "value");
      } catch {
        return undefined;
      }
    };
    const was = counts(before);
    note(
      field(was, "open") === 1 && field(was, "done") === 2 && Number(field(was, "at")) > 0,
      `B digest before restart is not { open: 1, done: 2, at > 0 }: ${before.slice(0, 120)}`,
    );
    // B's forwarded hops: the api process logs a /digest request with no matched route only when it forwarded it, and
    // the digest process logs the refreshes it then served by route.
    const hops = api.out
      .join("")
      .split("\n")
      .filter((l) => /^(GET|POST) \/digest\S* \d{3} \d+ms$/.test(l)).length;
    const served = dig.out
      .join("")
      .split("\n")
      .filter((l) => /^POST \/digest\/refresh digest\.refresh 200 /.test(l)).length;
    note(hops > 0 && served > 0, `B forwarded ${hops} /digest requests, digest process served ${served} refreshes`);
    for (const p of procs.splice(0)) {
      const code = await stop(p);
      note(code === 0, `SIGTERM exit ${String(code)}`);
    }
    // Web storage keeps keys as UTF-16 blobs. The count is written by the digest module into the storage of the process that runs it.
    const holds = (file: string): boolean => {
      const db = new DatabaseSync(file);
      try {
        return (
          db.prepare("SELECT 1 FROM nodejs_webstorage WHERE key = ?").get(Buffer.from("digest.latest", "utf16le")) !==
          undefined
        );
      } finally {
        db.close();
      }
    };
    note(holds(join(tmp, "a-api.storage")), "A storage lacks digest.latest");
    note(holds(digestStorage), "B digest storage lacks digest.latest");
    note(!holds(join(tmp, "b-api.storage")), "B api storage holds digest.latest");
    const again = serve(b, "digest", pd, digestStorage, peers);
    procs.push(again);
    must(await ready(`http://127.0.0.1:${pd}/digest`), "B digest did not restart");
    const after = await fetch(`http://127.0.0.1:${pd}/digest`, { headers: { accept: "application/json" } })
      .then((r) => r.text())
      .catch(() => "");
    note(after !== "" && after === before, "restarted digest answers another GET /digest");
    note((await stop(again)) === 0, "restarted digest did not exit 0 on SIGTERM");
    procs.splice(0);

    // 5. No KEEL_SECRET: exit 1 with one E1560 line naming it.
    const bare = await sh(
      process.execPath,
      ["--experimental-webstorage", `--localstorage-file=${join(tmp, "bare.storage")}`, "dist/api/server.mjs"],
      a,
      { KEEL_SECRET: undefined },
    );
    const lines = bare.stdout.trim().split("\n");
    note(
      !bare.ok && lines.length === 1 && /^E1560 KEEL_SECRET\b/.test(lines[0] ?? ""),
      "unset KEEL_SECRET is not one E1560",
    );
    return failed.length === 0 ? undefined : failed.join("; ");
  } catch (e) {
    return e instanceof Fail ? e.message : `split proof threw: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    for (const p of procs) p.child.kill("SIGKILL");
    await rm(tmp, { recursive: true, force: true });
  }
}
