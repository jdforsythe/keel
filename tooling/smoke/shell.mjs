// Shell replay for golden-1: a recorded session replayed inside the Tauri shell gives the server state its sim replay
// gives; with `--session outbox`, writes queued while the server is down drain after the app is killed and started
// again. Run after `KEEL_ORIGIN=http://localhost:4182 keel build --target tauri` in apps/golden-1, under a display
// (`xvfb-run -a` in CI), on Linux with `tauri-driver` and WebKitWebDriver (`webkit2gtk-driver`) installed.
//
// 1. Record: `apps/golden-1/test/shellSession.ts` (`--session replay`, the default) or `shellOutboxSession.ts`
//    (`--session outbox`) records a one-user session group under simulation (std.multi `openGroup`, seed 11, the
//    stored board Home with Milk and Bread) and replays it with `replayGroup`; the group is written to
//    `.keel/sessions/golden-1-shell.group.json` in a temporary folder.
// 2. Serve: a SQLite file holding that same stored board, the built `api` (`dist/api/server.mjs`) on a free port over
//    it, and a recording proxy at the build's `KEEL_ORIGIN` forwarding to the api.
// 3. Drive: `tauri-driver` starts the binary through WebKitWebDriver; once the app has read `GET /api/lists` through
//    its native HTTP client, each input of the group file's user is applied as real input over WebDriver, by element
//    id (`actionsOf`: follow a link, click, clear and type); after each the proxy must go quiet. A `net` input going
//    offline stops the api and closes the proxy, so `KEEL_ORIGIN` refuses connections; going online waits until the
//    shell's store files (`keel.json`, `keel.b.json`) hold the queued writes in `todos.outbox`, kills the app with
//    SIGKILL, starts the api and the proxy again over the same SQLite file, and starts the app in a new WebDriver
//    session, whose layout drains the persisted outbox. `--drop-store` deletes the store files before that start: the
//    planted failure, where nothing drains and step 4 must fail.
// 4. Compare: the stored `api.board` row and `replayGroup`'s `api.board`, both `normalized`, must be equal; after a
//    restart the stored outbox must also be empty.
// Passing prints one `ok` line. E0014: the shell could not be started or driven (the step, the requests the proxy saw
// and the last output lines follow on stderr). E0015: the boards differ, one line per difference, or the sim replay
// did not reproduce its recording. The binary, the driver, the proxy and the api are stopped on every path.
// Usage: node tooling/smoke/shell.mjs --shell tauri [--session replay|outbox] [--drop-store] [--binary <path>]
//   (binary default: .cargo-target/debug/golden-1, else apps/golden-1/dist/web/tauri/target/debug/golden-1;
//   KEEL_ORIGIN default http://localhost:4182; TAURI_DRIVER default tauri-driver on PATH, else ~/.cargo/bin)
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { run } from "../output.ts";
import { fixedTime, testTime } from "../test-time.ts";
import { BOARD_KEY, app, freePort, root, row, wait } from "./built.mjs";
import { actionsOf, boardDiff, normalized, outboxIn } from "./shellReplay.mjs";
import { driverReady, openSession } from "./webdriver.mjs";

/** How long recording and replaying the session under simulation may take. */
const SIM_MS = testTime(180_000);
/** How long the built api, and the driver, have to answer. */
const LISTEN_MS = testTime(20_000);
/** How long the shell has to start, load its entry and read the board. */
const LOAD_MS = testTime(90_000);
/** How long an element named by an action has to appear, and a followed link to change the route. */
const ELEMENT_MS = testTime(15_000);
/** How long the proxy must see no request in flight before an action counts as settled. */
const QUIET_MS = fixedTime(600);
/** How long one action has to settle. */
const SETTLE_MS = testTime(20_000);
/** How long the stored board must stay unchanged after the last action, and the most that may take. */
const STILL_MS = fixedTime(1_500);
const STORED_MS = testTime(15_000);
/** How long the queued writes have to reach the shell's store files, and a killed app to be gone. */
const QUEUED_MS = testTime(15_000);
/** The pause between two polls. */
const POLL_MS = fixedTime(100);

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const a = argv[i] ?? "";
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[i + 1];
};
const shellName = arg("shell");
/** Each session: the module under apps/golden-1 that records it, and its export. */
const SESSIONS = {
  replay: ["./test/shellSession.ts", "shellSession"],
  outbox: ["./test/shellOutboxSession.ts", "shellOutboxSession"],
};
const sessionName = arg("session") ?? "replay";
const dropStore = argv.includes("--drop-store");
/** The outbox golden-1's board writes wait in (`modules/todos/boardOutbox.ts`). */
const OUTBOX = "todos.outbox";
const binary = path.resolve(
  root,
  arg("binary") ??
    (fs.existsSync(path.join(root, ".cargo-target/debug/golden-1"))
      ? ".cargo-target/debug/golden-1"
      : "apps/golden-1/dist/web/tauri/target/debug/golden-1"),
);
const origin = new URL(process.env.KEEL_ORIGIN ?? "http://localhost:4182");
const tail = (s, n) => s.split("\n").filter(Boolean).slice(-n).join("\n");
const cssId = (id) => `[id="${id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;

/** The driver: `TAURI_DRIVER`, else `tauri-driver` on PATH, else Cargo's bin folder. */
function driverPath() {
  if (process.env.TAURI_DRIVER) return process.env.TAURI_DRIVER;
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const p = path.join(dir, "tauri-driver");
    if (dir !== "" && fs.existsSync(p)) return p;
  }
  const cargo = path.join(os.homedir(), ".cargo", "bin", "tauri-driver");
  return fs.existsSync(cargo) ? cargo : undefined;
}

/** Every child started, so a SIGINT or SIGTERM to this script stops them too. */
const children = new Set();
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    for (const c of children)
      try {
        process.kill(-c.pid, "SIGKILL");
      } catch {}
    process.exit(130);
  });

/** A child in its own process group (so its children stop with it), its output kept and its exit recorded. */
function child(cmd, args, opts) {
  const p = spawn(cmd, args, { ...opts, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  children.add(p);
  const out = { text: "", exited: undefined };
  const keep = (d) => {
    out.text = (out.text + d).slice(-64_000);
  };
  p.stdout.on("data", keep);
  p.stderr.on("data", keep);
  p.on("exit", (code, signal) => {
    out.exited = signal ?? String(code);
  });
  p.on("error", (e) => {
    keep(`${e.message}\n`);
    out.exited = "spawn";
  });
  return { p, out };
}

/** SIGTERM `c`'s process group, then SIGKILL it after 3 s. */
async function stop(c) {
  if (c === undefined || c.p.pid === undefined) return;
  const group = (signal) => {
    try {
      process.kill(-c.p.pid, signal);
    } catch {}
  };
  group("SIGTERM");
  for (let i = 0; i < 30 && c.out.exited === undefined; i++) await wait(POLL_MS);
  group("SIGKILL");
}

/** Poll `pred` every POLL_MS for at most `ms`; resolves to its last value. */
async function until(pred, ms) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await pred();
    if (v || Date.now() >= end) return v;
    await wait(POLL_MS);
  }
}

/** Record and replay the session under simulation, in a child with tsx (the group's workers load TypeScript). */
function simulate(out, [file, name]) {
  const tsx = pathToFileURL(createRequire(path.join(root, "package.json")).resolve("tsx")).href;
  const code = [
    "import fs from 'node:fs';",
    `const m = await import(${JSON.stringify(file)});`,
    `fs.writeFileSync(process.env.KEEL_SHELL_SESSION_OUT, JSON.stringify(await m[${JSON.stringify(name)}]()));`,
  ].join("\n");
  const c = child(process.execPath, ["--import", tsx, "--input-type=module", "-e", code], {
    cwd: app,
    env: { ...process.env, NODE_ENV: "test", KEEL_SHELL_SESSION_OUT: out },
  });
  return { c, done: until(() => c.out.exited !== undefined, SIM_MS) };
}

/** The pids of the running shell app: every process whose executable is `binary`. Linux only (`/proc`). */
function appPids() {
  const real = fs.realpathSync(binary);
  const pids = [];
  for (const d of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(d)) continue;
    try {
      if (fs.readlinkSync(`/proc/${d}/exe`) === real) pids.push(Number(d));
    } catch {}
  }
  return pids;
}

/** The shell's store files under `dir` (the app's data folder): `keel.json`, then `keel.b.json`. */
const storeFiles = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { recursive: true })
        .map(String)
        .filter((f) => path.basename(f) === "keel.json" || path.basename(f) === "keel.b.json")
        .sort((a, b) => path.basename(a).length - path.basename(b).length)
        .map((f) => path.join(dir, f))
    : [];
const readText = (f) => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return undefined;
  }
};

await run("shell", async () => {
  const diags = [];
  const counts = {};
  const fail = (message) => {
    diags.push({ kind: "diag", code: "E0014", message });
    return { diags, counts };
  };
  if (shellName !== "tauri") return fail(`--shell ${shellName ?? "(none)"}: the shell replay runs --shell tauri`);
  if (!Object.hasOwn(SESSIONS, sessionName))
    return fail(`--session ${sessionName}: the sessions are replay and outbox`);
  if (dropStore && sessionName !== "outbox")
    return fail("--drop-store needs --session outbox (the session that restarts)");
  if (!fs.existsSync(binary))
    return fail(`no shell binary at ${path.relative(root, binary)}: run keel build --target tauri first`);
  const server = path.join(app, "dist/api/server.mjs");
  if (!fs.existsSync(server)) return fail("no apps/golden-1/dist/api/server.mjs: run keel build first");
  const driver = driverPath();
  if (driver === undefined) return fail("no tauri-driver: cargo install tauri-driver --locked");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-shell-replay-"));
  const seen = [];
  const sockets = new Set();
  let inFlight = 0;
  let lastBusy = Date.now();
  let sim;
  let api;
  let proxy;
  let wd;
  let session;
  let doing = "start";
  const secret = randomBytes(24).toString("hex");
  try {
    // 1. Record and replay under simulation.
    doing = "record the session under simulation";
    const simOut = path.join(tmp, "sim.json");
    sim = simulate(simOut, SESSIONS[sessionName]);
    await sim.done;
    if (!fs.existsSync(simOut)) {
      process.stderr.write(`${tail(sim.c.out.text, 20)}\n`);
      return fail(`the sim session did not finish within ${SIM_MS / 1000}s (exit ${sim.c.out.exited ?? "none"})`);
    }
    const recorded = JSON.parse(fs.readFileSync(simOut, "utf8"));
    const groupFile = path.join(tmp, ".keel/sessions/golden-1-shell.group.json");
    fs.mkdirSync(path.dirname(groupFile), { recursive: true });
    fs.writeFileSync(groupFile, JSON.stringify(recorded.group));
    const replayed = normalized(recorded.replayed);
    if (!recorded.reproduced || JSON.stringify(normalized(recorded.live)) !== JSON.stringify(replayed)) {
      diags.push({ kind: "diag", code: "E0015", message: "replayGroup did not reproduce the recorded group" });
      return { diags, counts };
    }
    const actions = actionsOf(JSON.parse(fs.readFileSync(groupFile, "utf8")).users?.[0]);
    counts.actions = actions.length;
    const unsupported = actions.filter((a) => a.kind === "unsupported");
    if (unsupported.length > 0)
      return fail(`the session holds inputs no page input makes: ${JSON.stringify(unsupported[0].event)}`);

    // 2. The stored board, the built api over it, and the proxy at KEEL_ORIGIN.
    doing = "start the built api";
    const file = path.join(tmp, "api.sqlite");
    const db = new DatabaseSync(file);
    db.exec("create table keel_kv (key text primary key, value text not null)");
    db.prepare("insert into keel_kv (key, value) values (?, ?)").run(BOARD_KEY, recorded.board);
    db.close();
    const serve = async () => {
      const apiPort = await freePort();
      api = child(process.execPath, ["--disable-warning=ExperimentalWarning", server], {
        cwd: app,
        env: {
          ...process.env,
          PORT: String(apiPort),
          KEEL_ORIGIN: `http://localhost:${apiPort}`,
          KEEL_SECRET: secret,
          KEEL_DATABASE_URL: pathToFileURL(file).href,
          KEEL_FORMAT: "json",
        },
      });
      const listening = await until(
        () =>
          fetch(`http://127.0.0.1:${apiPort}/api/lists`, { signal: AbortSignal.timeout(testTime(2_000)) }).then(
            (r) => r.ok,
            () => false,
          ),
        LISTEN_MS,
      );
      if (!listening) {
        process.stderr.write(`${tail(api.out.text, 20)}\n`);
        throw new Error(`the built api did not answer on ${apiPort} within ${LISTEN_MS / 1000}s`);
      }
      proxy = http.createServer((req, res) => {
        seen.push({ method: req.method ?? "", path: req.url ?? "", agent: req.headers["user-agent"] ?? "-" });
        inFlight++;
        let open = true;
        const done = () => {
          if (!open) return;
          open = false;
          inFlight--;
          lastBusy = Date.now();
        };
        res.on("close", done);
        const up = http.request(
          { host: "127.0.0.1", port: apiPort, method: req.method, path: req.url, headers: req.headers },
          (r) => {
            // An event stream stays open for the app's life: it is no request in flight.
            if (String(r.headers["content-type"] ?? "").includes("text/event-stream")) done();
            res.writeHead(r.statusCode ?? 502, r.headers);
            r.pipe(res);
          },
        );
        up.on("error", () => res.destroy());
        req.pipe(up);
      });
      proxy.on("connection", (s) => {
        sockets.add(s);
        s.on("close", () => sockets.delete(s));
      });
      await new Promise((resolve, reject) => {
        proxy.once("error", reject);
        proxy.listen(Number(origin.port || 80), "127.0.0.1", resolve);
      });
    };
    /** Stop the api and close the proxy, so KEEL_ORIGIN refuses connections. */
    const unserve = async () => {
      if (proxy !== undefined) {
        const closing = new Promise((r) => proxy.close(() => r(undefined)));
        for (const s of sockets) s.destroy();
        await closing;
        proxy = undefined;
      }
      await stop(api);
    };
    await serve();

    // 3. The driver, the shell, and the session's inputs.
    doing = "start tauri-driver";
    const [port, nativePort] = [await freePort(), await freePort()];
    const base = `http://127.0.0.1:${port}`;
    wd = child(driver, ["--port", String(port), "--native-port", String(nativePort)], {
      env: {
        ...process.env,
        // WebKitGTK under Xvfb has no GPU: render in software.
        WEBKIT_DISABLE_DMABUF_RENDERER: "1",
        LIBGL_ALWAYS_SOFTWARE: "1",
        // The shell's store file and caches stay in the throwaway folder.
        XDG_DATA_HOME: path.join(tmp, "data"),
        XDG_CACHE_HOME: path.join(tmp, "cache"),
        XDG_CONFIG_HOME: path.join(tmp, "config"),
      },
    });
    if (!(await until(() => wd.out.exited === undefined && driverReady(base), LISTEN_MS)))
      return fail(
        `tauri-driver did not answer on ${port} within ${LISTEN_MS / 1000}s (exit ${wd.out.exited ?? "none"})`,
      );
    /** Start the app in a new WebDriver session and wait until it reads the board through KEEL_ORIGIN. */
    const start = async () => {
      doing = "open a WebDriver session on the shell";
      const from = seen.length;
      session = await openSession(base, { "tauri:options": { application: binary } });
      doing = "load the shell";
      const loaded = await until(
        () =>
          seen
            .slice(from)
            .some(
              (r) => r.method === "GET" && r.path.startsWith("/api/lists") && r.agent.startsWith("tauri-plugin-http"),
            ),
        LOAD_MS,
      );
      if (!loaded) throw new Error(`the shell read no GET /api/lists through KEEL_ORIGIN within ${LOAD_MS / 1000}s`);
    };
    const data = path.join(tmp, "data");
    const outbox = () => outboxIn(storeFiles(data).map(readText), OUTBOX);
    /** Take the server away: the api stops and KEEL_ORIGIN refuses connections. */
    const offline = async () => {
      doing = "stop the server";
      await unserve();
      const refused = await fetch(new URL("/api/lists", origin), { signal: AbortSignal.timeout(testTime(2_000)) }).then(
        () => false,
        () => true,
      );
      if (!refused) throw new Error(`${origin.origin} still answers with the api stopped`);
    };
    /** Kill the app once its store files hold the queued writes, bring the server back, and start the app again. */
    const restart = async () => {
      doing = "wait for the queued writes in the shell's store files";
      let texts = "";
      let still = Date.now();
      const persisted = await until(() => {
        const now = JSON.stringify(storeFiles(data).map(readText));
        if (now !== texts) {
          texts = now;
          still = Date.now();
        }
        return (outbox()?.length ?? 0) > 0 && Date.now() - still >= STILL_MS;
      }, QUEUED_MS);
      if (!persisted) throw new Error(`the shell's store files hold no write in ${OUTBOX} after ${QUEUED_MS / 1000}s`);
      counts.queued = outbox()?.length ?? 0;
      doing = "kill the app";
      const pids = appPids();
      if (pids.length === 0) throw new Error(`no running process of ${path.relative(root, binary)}`);
      for (const pid of pids) process.kill(pid, "SIGKILL");
      if (!(await until(() => appPids().length === 0, QUEUED_MS)))
        throw new Error(`the app still runs ${QUEUED_MS / 1000}s after SIGKILL`);
      counts.killed = (counts.killed ?? 0) + pids.length;
      await session.quit().catch(() => undefined);
      session = undefined;
      if (dropStore) for (const f of storeFiles(data)) fs.rmSync(f);
      doing = "start the built api again";
      await serve();
      await start();
      counts.restarts = (counts.restarts ?? 0) + 1;
    };
    await start();
    const settle = async () =>
      until(() => inFlight === 0 && Date.now() - lastBusy >= QUIET_MS, SETTLE_MS).then((ok) => {
        if (!ok) throw new Error(`${inFlight} requests still in flight after ${SETTLE_MS / 1000}s`);
      });
    await settle();
    const element = async (css) => {
      let last;
      const found = await until(
        () =>
          session.find(css).then(
            (h) => h,
            (e) => {
              last = e;
              return undefined;
            },
          ),
        ELEMENT_MS,
      );
      if (found === undefined) throw new Error(`no element ${css} within ${ELEMENT_MS / 1000}s (${last?.code ?? ""})`);
      return found;
    };
    const route = async () => new URL(String(await session.url())).pathname;
    for (const [i, a] of actions.entries()) {
      doing = `action ${i + 1} of ${actions.length} ${a.kind} ${a.id ?? a.href}`;
      if (a.kind === "nav") {
        if ((await route()) !== a.href) {
          await session.click(await element(`a[href="${a.href}"]`));
          if (!(await until(async () => (await route()) === a.href, ELEMENT_MS)))
            throw new Error(`the route is ${await route()}, not ${a.href}, ${ELEMENT_MS / 1000}s after the link`);
        }
      } else if (a.kind === "click") await session.click(await element(cssId(a.id)));
      else if (a.kind === "type") {
        const h = await element(cssId(a.id));
        await session.clear(h);
        await session.type(h, a.value);
      } else if (a.kind === "keys") await session.type(await element(cssId(a.id)), a.keys);
      else if (a.kind === "net") await (a.online ? restart() : offline());
      await settle();
    }

    // 4. The stored board, once it holds still, against replayGroup's.
    doing = "read the stored board";
    const same = () => {
      const now = row(file, BOARD_KEY);
      return now !== undefined && JSON.stringify(normalized(JSON.parse(now))) === JSON.stringify(replayed);
    };
    await until(same, STORED_MS);
    let before = row(file, BOARD_KEY);
    let still = Date.now();
    await until(() => {
      const now = row(file, BOARD_KEY);
      if (now !== before) {
        before = now;
        still = Date.now();
      }
      return Date.now() - still >= STILL_MS;
    }, STORED_MS);
    const stored = before === undefined ? null : JSON.parse(before);
    counts.head = Number(stored?.head ?? 0);
    for (const line of boardDiff(normalized(stored), replayed))
      diags.push({ kind: "diag", code: "E0015", message: `api.board ${line}` });
    const left = counts.restarts === undefined ? [] : (outbox() ?? []);
    if (left.length > 0)
      diags.push({
        kind: "diag",
        code: "E0015",
        message: `${OUTBOX} still holds ${left.length} writes in the shell's store: ${left.map((e) => `${e.endpoint} ${e.state}`).join(", ")}`,
      });
    return { diags, counts };
  } catch (e) {
    return fail(`${doing}: ${String(e?.message ?? e).split("\n")[0]}`);
  } finally {
    if (diags.length > 0) {
      for (const r of seen) process.stderr.write(`req ${r.method} ${r.path} agent ${r.agent}\n`);
      if (api !== undefined) process.stderr.write(`api: ${tail(api.out.text, 10)}\n`);
      if (wd !== undefined) process.stderr.write(`shell: ${tail(wd.out.text, 20)}\n`);
    }
    if (session !== undefined) await session.quit().catch(() => undefined);
    await stop(wd);
    for (const s of sockets) s.destroy();
    if (proxy !== undefined) await new Promise((r) => proxy.close(() => r(undefined)));
    await stop(api);
    await stop(sim?.c);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
