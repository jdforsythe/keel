// Shared fixture for the k.derived conformance files (not a test file). Public surface only: the `keel` binary over copies of
// `examples/client-only-api` and `apps/household`. Seed 1337 for every property in this suite.
// Copies live under the git-ignored `<repo>/.fixtures/` (as check-budget-injected10.test.ts does): a project copied elsewhere cannot run `keel test`
// (vite refuses files outside its workspace). `node_modules` of a copy is a real folder of links to the original's entries, so its
// `node_modules/.cache/keel` is the copy's own.
// The child env drops vitest's variables, every KEEL_* and `CI`, so only a case sets them.
// A run is read in json: a `diag` record (`code`, `path`, `message`) per diagnostic and the `summary` record's `counts` (k.derived Refresh: `refreshed`, `evaluated`,
// `cached`). `--format=compact` gives the trailer, the last line that starts with `ok ` or `fail `, and a compact diagnostic line `CODE path[:line:col] message`.
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const SEED = 1337;
export const ROOT = realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));
export const BIN = join(ROOT, "packages", "cli", "src", "bin.ts");
/** A fixed past second: a file written after `age` has a later time. */
export const OLD = 1_700_000_000;

export type Diag = { code: string; path: string; message: string };
export type Out = {
  status: number | null;
  stdout: string;
  stderr: string;
  diags: Diag[];
  /** The compact trailer; empty in json. */
  trailer: string;
  /** The json summary's `counts` (the compact trailer's `<n> refreshed` when compact). */
  counts: Record<string, number>;
  /** `counts.refreshed`, -1 when the run printed none. */
  refreshed: number;
};

const LINE = /^([EWIT]\d{4}) (\S+?)(?::\d+:\d+)? (.*)$/;

export function parseOut(status: number | null, stdout: string, stderr: string): Out {
  const diags: Diag[] = [];
  const counts: Record<string, number> = {};
  let trailer = "";
  for (const line of stdout.split("\n")) {
    if (/^(ok|fail) /.test(line)) trailer = line;
    if (line.startsWith("{")) {
      const v: unknown = JSON.parse(line);
      if (typeof v !== "object" || v === null) continue;
      const kind: unknown = Reflect.get(v, "kind");
      if (kind === "diag") {
        const code: unknown = Reflect.get(v, "code");
        const path: unknown = Reflect.get(v, "path");
        const message: unknown = Reflect.get(v, "message");
        diags.push({ code: String(code), path: String(path), message: String(message) });
      } else if (kind === "summary") {
        const c: unknown = Reflect.get(v, "counts");
        if (typeof c === "object" && c !== null)
          for (const [k, n] of Object.entries(c)) if (typeof n === "number") counts[k] = n;
      }
      continue;
    }
    const m = LINE.exec(line);
    if (m !== null) diags.push({ code: m[1] ?? "", path: m[2] ?? "", message: m[3] ?? "" });
  }
  const r = /(\d+) refreshed/.exec(trailer);
  if (r !== null) counts.refreshed = Number(r[1]);
  else if (trailer !== "" && counts.refreshed === undefined) counts.refreshed = 0;
  return { status, stdout, stderr, diags, trailer, counts, refreshed: counts.refreshed ?? -1 };
}

export function childEnv(extra: Readonly<Record<string, string>>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_") || k === "CI") continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    if (k === "npm_config_user_agent") continue; // the printed command form follows it (k.cli Command form); a case that wants one passes it in `extra`
    env[k] = v;
  }
  return { ...env, ...extra };
}

const withFormat = (args: readonly string[]): string[] =>
  args.some((a) => a.startsWith("--format")) ? [...args] : [...args, "--format=json"];

/** `keel <args>` in `dir`. */
export function keel(dir: string, args: readonly string[], env: Readonly<Record<string, string>> = {}): Out {
  const r = spawnSync(process.execPath, [BIN, ...withFormat(args)], { cwd: dir, encoding: "utf8", env: childEnv(env) });
  return parseOut(r.status, r.stdout, r.stderr);
}

/** `keel <args>` in `dir` as a child that runs beside the caller's other children. */
export function keelAsync(dir: string, args: readonly string[]): Promise<Out> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...withFormat(args)], { cwd: dir, env: childEnv({}) });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b: Buffer) => {
      stdout += b.toString("utf8");
    });
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(parseOut(code, stdout, stderr)));
  });
}

export const codes = (out: Out, code: string): Diag[] => out.diags.filter((d) => d.code === code);

// ---- the files of a tree ----

export type Snap = Map<string, { mtime: number; bytes: string }>;

/** Every file under `dir` (a link counts as its own entry), `skip` folder names left out. */
export function snapshot(dir: string, skip: readonly string[] = ["node_modules"]): Snap {
  const out: Snap = new Map();
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (skip.includes(name)) continue;
      const full = join(d, name);
      const st = lstatSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.set(relative(dir, full), { mtime: st.mtimeMs, bytes: readFileSync(full, "latin1") });
    }
  };
  walk(dir);
  return out;
}

/** The paths whose bytes or modification time differ, or that exist in one snapshot only. */
export function changed(a: Snap, b: Snap): string[] {
  const out: string[] = [];
  for (const [p, x] of a) {
    const y = b.get(p);
    if (y === undefined || y.bytes !== x.bytes || y.mtime !== x.mtime) out.push(p);
  }
  for (const p of b.keys()) if (!a.has(p)) out.push(p);
  return out.sort();
}

/** Sets the modification time of every file under `dir` (but `skip` folders) to OLD, so a later write shows. */
export function age(dir: string, skip: readonly string[] = ["node_modules"]): void {
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (skip.includes(name)) continue;
      const full = join(d, name);
      const st = lstatSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) utimesSync(full, OLD, OLD);
    }
  };
  walk(dir);
}

/** Every `*.tmp` file under `dir`, `node_modules` left out. */
export function tmpFiles(dir: string): string[] {
  return [...snapshot(dir).keys()].filter((p) => p.endsWith(".tmp"));
}

export const VIEWS = ["a11y", "deps", "ids", "routes", "std", "styles", "surface"].map((n) => `.keel/${n}.json`);

/** The bytes of each present view. */
export function views(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of VIEWS) if (existsSync(join(dir, v))) out[v] = readFileSync(join(dir, v), "utf8");
  return out;
}

export const read = (dir: string, rel: string): string => readFileSync(join(dir, rel), "utf8");

/** Writes `text` at `rel` (folders made, a read-only file replaced). */
export function put(dir: string, rel: string, text: string): void {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  rmSync(full, { force: true });
  writeFileSync(full, text);
}

/** `rel` with the first `from` replaced by `to`; throws when `from` is absent (the fixture and the edit disagree). */
export function sub(dir: string, rel: string, from: string, to: string): void {
  const text = read(dir, rel);
  if (!text.includes(from)) throw new Error(`fixture text missing in ${rel}: ${from}`);
  put(
    dir,
    rel,
    text.replace(from, () => to),
  );
}

// ---- trees ----

export type Tree = { base: string; dir: string };
const FIXTURES = join(ROOT, ".fixtures");

/** A copy of `rel` (`examples/...` or `apps/...`) without `node_modules`, `dist`, `.keel` and `reports`, its `node_modules` a folder of links. */
export function newTree(rel: string): Tree {
  mkdirSync(FIXTURES, { recursive: true });
  const base = realpathSync(mkdtempSync(join(FIXTURES, "derived-")));
  const from = join(ROOT, rel);
  const dir = join(base, "proj");
  cpSync(from, dir, {
    recursive: true,
    filter: (src) => !/(^|\/)(node_modules|dist|\.keel|reports)(\/|$)/.test(relative(from, src)),
  });
  mkdirSync(join(dir, "node_modules"), { recursive: true });
  const nm = join(from, "node_modules");
  for (const name of readdirSync(nm)) {
    if (name === ".cache") continue;
    const src = join(nm, name);
    if (name.startsWith("@")) {
      mkdirSync(join(dir, "node_modules", name), { recursive: true });
      for (const m of readdirSync(src)) symlinkSync(realpathSync(join(src, m)), join(dir, "node_modules", name, m));
    } else symlinkSync(realpathSync(src), join(dir, "node_modules", name));
  }
  for (const name of ["vitest", "typescript", "fast-check", "vite", "happy-dom"]) {
    if (!existsSync(join(dir, "node_modules", name)))
      symlinkSync(realpathSync(join(ROOT, "node_modules", name)), join(dir, "node_modules", name));
  }
  return { base, dir };
}

/** A copy of a tree (its `std-text` link, when it has one, pointing into the copy). */
export function cloneTree(t: Tree): Tree {
  mkdirSync(FIXTURES, { recursive: true });
  const base = realpathSync(mkdtempSync(join(FIXTURES, "derived-")));
  cpSync(t.base, base, { recursive: true, verbatimSymlinks: true });
  const linked = join(base, "std-text");
  if (existsSync(linked)) {
    const at = join(base, "proj", "node_modules", "@keel", "std-text");
    rmSync(at, { force: true });
    symlinkSync(linked, at);
  }
  return { base, dir: join(base, "proj") };
}

/** Removes a tree, its `.keel` folder made writable first. */
export function dropTree(t: Tree): void {
  try {
    chmodSync(join(t.dir, ".keel"), 0o755);
  } catch {
    // no .keel folder
  }
  rmSync(t.base, { recursive: true, force: true });
}

/** `@keel/std-text` as a linked copy outside `node_modules`: `node_modules/@keel/std-text` is a link to `<base>/std-text`. */
export function linkStdText(t: Tree): void {
  const from = join(ROOT, "packages", "std-text");
  const to = join(t.base, "std-text");
  cpSync(from, to, { recursive: true, filter: (src) => !/(^|\/)(node_modules|dist)(\/|$)/.test(relative(from, src)) });
  for (const name of readdirSync(to)) {
    if (!/^tsconfig.*\.json$/.test(name)) continue;
    const file = join(to, name);
    writeFileSync(
      file,
      readFileSync(file, "utf8").replaceAll("../../tsconfig.base.json", join(ROOT, "tsconfig.base.json")),
    );
  }
  const own = join(from, "node_modules");
  if (existsSync(own)) symlinkSync(realpathSync(own), join(to, "node_modules"));
  const at = join(t.dir, "node_modules", "@keel", "std-text");
  rmSync(at, { force: true });
  symlinkSync(to, at);
}

/** Replaces `from` by `to` in `line.ts` of the linked copy (the file of `line`; `para` has the same default text and is left alone); `keepTime` gives each file its old modification time. Returns the files. */
export function editStdText(t: Tree, from: string, to: string, keepTime: boolean): string[] {
  const hit: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (name === "node_modules") continue;
      const full = join(d, name);
      const st = lstatSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile() && name === "line.ts") {
        const text = readFileSync(full, "utf8");
        if (!text.includes(from)) continue;
        const before = statSync(full);
        writeFileSync(full, text.replaceAll(from, to));
        if (keepTime) utimesSync(full, before.atime, before.mtime);
        hit.push(relative(t.base, full));
      }
    }
  };
  walk(join(t.base, "std-text"));
  if (hit.length === 0) throw new Error(`no file of the linked @keel/std-text holds: ${from}`);
  return hit;
}

/** `keel build` must succeed. */
export function build(dir: string): void {
  const r = keel(dir, ["build"]);
  if (r.status !== 0)
    throw new Error(`keel build exited ${String(r.status)}: ${r.stdout.slice(-600)} ${r.stderr.slice(-300)}`);
}

// ---- the client-only-api fixture ----

/** A copy of `examples/client-only-api`, built. */
export function apiTree(): Tree {
  const t = newTree("examples/client-only-api");
  build(t.dir);
  return t;
}

/** Clause 1's edit: the page route `app.about` at `/about` in the contract, bound to `HomePage`. */
export function addRoute(dir: string): void {
  sub(
    dir,
    "modules/app/app.contract.ts",
    '  "app.releases": {\n    path: "/releases",\n  },\n',
    '  "app.releases": {\n    path: "/releases",\n  },\n  "app.about": { path: "/about" },\n',
  );
  sub(
    dir,
    "modules/app/routes.ts",
    '  "app.releases": {\n    component: ReleasesPage,\n    title: () => "Releases",\n  },\n',
    '  "app.releases": {\n    component: ReleasesPage,\n    title: () => "Releases",\n  },\n  "app.about": { component: HomePage, title: () => "About" },\n',
  );
}

/** Clause 2's edit: an element id renamed in a page component. */
export const renameId = (dir: string): void =>
  sub(dir, "modules/app/HomePage.tsx", 'id="app.home.title"', 'id="app.home.heading"');

/** The household copy: `@keel/std-text` linked outside `node_modules`, built. */
export function householdTree(): Tree {
  const t = newTree("apps/household");
  linkStdText(t);
  build(t.dir);
  return t;
}

/** The compact line `<n> ok`/`fail` trailer of a run, for messages. */
export const brief = (o: Out): string =>
  `${o.trailer} ${JSON.stringify(o.counts)} | ${o.diags.map((d) => `${d.code} ${d.path}`).join(", ")} | ${o.stderr.slice(-200)}`;

/** A pause the test's own loop takes between two looks at something a child does (not a timer the code under test sees). */
export function nap(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** The `a11y:` items `keel ledger` emits in `dir` with their rungs (`<item>=<rung>`), sorted. */
export function a11yItems(dir: string): string[] {
  const r = spawnSync(process.execPath, [BIN, "ledger", "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env: childEnv({}),
  });
  const items: string[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    const v: unknown = JSON.parse(line);
    if (typeof v !== "object" || v === null) continue;
    const item: unknown = Reflect.get(v, "item");
    if (Reflect.get(v, "kind") === "ledger" && typeof item === "string" && item.startsWith("a11y:"))
      items.push(`${item}=${String(Reflect.get(v, "rung"))}`);
  }
  return items.sort();
}

/** Milliseconds on the monotonic clock. */
export const nowMs = (): number => Number(process.hrtime.bigint() / 1_000n) / 1000;

/** A port nothing listens on. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

export function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect(port, "127.0.0.1");
    sock.on("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
  });
}

/** True once `ok()` holds, looking again every 25 ms (a sleep of the test's own loop) until `ms` of the monotonic clock have passed. */
export async function until(ok: () => boolean | Promise<boolean>, ms: number): Promise<boolean> {
  const end = nowMs() + ms;
  while (nowMs() < end) {
    if (await ok()) return true;
    nap(25);
    await new Promise<void>((r) => setImmediate(r));
  }
  return ok();
}

/** The `setup.household` store's state gains a required field `size` (the factory and its reader follow). */
export const addSize = (dir: string): void => {
  sub(
    dir,
    "modules/setup/Household.schema.ts",
    "name: line({ max: 40 }).nullable() }",
    "name: line({ max: 40 }).nullable(), size: s.number() }",
  );
  sub(dir, "modules/setup/householdStores.server.ts", "{ name: null }", "{ name: null, size: 0 }");
  sub(
    dir,
    "modules/setup/householdStores.server.ts",
    "(_state, p) => ({ name: p.name })",
    "(state, p) => ({ ...state, name: p.name })",
  );
  sub(
    dir,
    "modules/setup/getHousehold.server.ts",
    'ok({ name: stores.household.get("name") })',
    'ok({ name: stores.household.get("name"), size: stores.household.get("size") })',
  );
};
