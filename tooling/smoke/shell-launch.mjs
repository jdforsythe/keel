// Shell launch for golden-1 where no WebDriver reaches the webview (WKWebView: the Tauri macOS binary and the
// Capacitor iOS app on the Simulator): the app starts, its entry runs and reads the board through the shell's native
// HTTP client, and a cookie with a lifetime set through that client is sent again after the app is killed and started
// again. No input is made in the page, so no write, outbox or replay is checked here (tooling/smoke/shell.mjs, Linux).
// Run on macOS after `KEEL_ORIGIN=http://localhost:4182 keel build --target tauri` or
// `keel build --target capacitor --platform ios` in apps/golden-1.
//
// 1. Serve: the built `api` (`dist/api/server.mjs`) on a free port over a fresh SQLite file, and a recording proxy at
//    the build's `KEEL_ORIGIN` forwarding to it. The proxy adds one cookie, `keel-smoke=<random>; Max-Age=86400`, to
//    each answer to a request that did not carry it.
// 2. Launch: `--shell tauri` starts the binary with `HOME` in a temporary folder, so its store and cookie files stay
//    there; `--shell ios` boots the simulator when it is not booted, installs the app fresh and starts it with
//    `xcrun simctl launch`. The proxy must see `GET /api/lists` and then the layout's `GET /api/board/events` from the
//    native client (a `tauri-plugin-http` or `CFNetwork` agent), and a later request of that launch carrying the
//    cookie.
// 3. Kill and launch again: SIGKILL of the binary, or `simctl terminate` (a force-stop), `--hold` seconds after the
//    cookie was first sent: 0 for Tauri, 10 for iOS, whose `HTTPCookieStorage` writes to disk a moment after a
//    cookie arrives (on the Simulator a force-stop within about 2 s of it loses the cookie). Every request of the new
//    launch up to the event stream must carry the cookie. With `--shell ios --reboot` the simulator is then shut down
//    and booted and the app started a third time, under the same rule. `--drop-data` deletes the app's data before
//    the second launch (the temporary `HOME`, or an uninstall and install): the planted failure, where the cookie is
//    gone and this step must fail.
// Passing prints one `ok` line. E0014: the app could not be started or made no request (the step, the requests the
// proxy saw and the app's last output lines follow on stderr). E0015: a request after a relaunch came without the
// cookie. The app, the proxy and the api are stopped on every path; the app is uninstalled, and a simulator this
// script booted is shut down.
// Usage: node tooling/smoke/shell-launch.mjs --shell tauri [--binary <path>] [--hold <s>] [--drop-data]
//        node tooling/smoke/shell-launch.mjs --shell ios [--app <path>] [--device <udid or name>] [--reboot]
//          [--hold <s>] [--drop-data]
//   (binary default: .cargo-target/debug/golden-1, else apps/golden-1/dist/web/tauri/target/debug/golden-1; app
//   default: apps/golden-1/dist/web/capacitor/ios/build/Build/Products/Debug-iphonesimulator/App.app; device default:
//   the booted iPhone, else the first available one; KEEL_ORIGIN default http://localhost:4182)
import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "../output.ts";
import { app, freePort, root, wait } from "./built.mjs";

/** How long the built api has to answer. */
const LISTEN_MS = 20_000;
/** How long a launched app has to read the board and open its event stream. */
const LOAD_MS = 180_000;
/** How long a simulator has to boot, and one `simctl` command to end. */
const BOOT_MS = 300_000;
const SIMCTL_MS = 120_000;
/** How long a killed app has to be gone. */
const GONE_MS = 15_000;
/** The pause between two polls. */
const POLL_MS = 100;
/** The cookie the proxy sets, and its lifetime in seconds. */
const COOKIE = "keel-smoke";
const MAX_AGE = 86_400;
/** The app id of golden-1's shells (`topology.ts`). */
const APP_ID = "dev.keel.golden1";
/** The agents of the shells' native HTTP clients: tauri-plugin-http (reqwest) and URLSession. */
const NATIVE = /^tauri-plugin-http|CFNetwork/;

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const a = argv[i] ?? "";
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[i + 1];
};
const shellName = arg("shell");
const reboot = argv.includes("--reboot");
const dropData = argv.includes("--drop-data");
/** How long the first launch runs on after it first sent the cookie, before the kill (iOS writes its store late). */
const holdMs = Number(arg("hold") ?? (shellName === "ios" ? 10 : 0)) * 1000;
const binary = path.resolve(
  root,
  arg("binary") ??
    (fs.existsSync(path.join(root, ".cargo-target/debug/golden-1"))
      ? ".cargo-target/debug/golden-1"
      : "apps/golden-1/dist/web/tauri/target/debug/golden-1"),
);
const bundle = path.resolve(
  root,
  arg("app") ?? "apps/golden-1/dist/web/capacitor/ios/build/Build/Products/Debug-iphonesimulator/App.app",
);
const origin = new URL(process.env.KEEL_ORIGIN ?? "http://localhost:4182");
const tail = (s, n) => s.split("\n").filter(Boolean).slice(-n).join("\n");

/** Every child started, so a SIGINT or SIGTERM to this script stops them too. */
const children = new Set();
/** The simulator and whether this script booted it and installed the app, for the same signals. */
const sim = { udid: undefined, booted: false, installed: false };
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    for (const c of children)
      try {
        process.kill(-c.pid, "SIGKILL");
      } catch {}
    if (sim.udid !== undefined) {
      const quiet = { stdio: "ignore", detached: true };
      if (sim.installed) spawn("xcrun", ["simctl", "uninstall", sim.udid, APP_ID], quiet).unref();
      if (sim.booted) spawn("xcrun", ["simctl", "shutdown", sim.udid], quiet).unref();
    }
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
    children.delete(p);
  });
  p.on("error", (e) => {
    keep(`${e.message}\n`);
    out.exited = "spawn";
  });
  return { p, out };
}

/** Send `signal` to `c`'s process group. */
function signalGroup(c, signal) {
  try {
    process.kill(-c.p.pid, signal);
  } catch {}
}

/** SIGTERM `c`'s process group, then SIGKILL it after 3 s. */
async function stop(c) {
  if (c === undefined || c.p.pid === undefined) return;
  signalGroup(c, "SIGTERM");
  for (let i = 0; i < 30 && c.out.exited === undefined; i++) await wait(POLL_MS);
  signalGroup(c, "SIGKILL");
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

/** `xcrun simctl <args>` to its end: `{ ok, out }`, `out` its stdout and stderr. */
const simctl = (args, ms = SIMCTL_MS) =>
  new Promise((resolve) => {
    execFile("xcrun", ["simctl", ...args], { timeout: ms, maxBuffer: 2 ** 26 }, (err, stdout, stderr) =>
      resolve({ ok: err === null, out: `${stdout}\n${stderr}` }),
    );
  });

/**
 * The simulator to run on, `{ udid, name, state }`: `--device` (a udid or a name), else the booted iPhone, else the
 * first available iPhone of the newest iOS runtime.
 */
async function device(want) {
  const r = await simctl(["list", "devices", "available", "-j"]);
  let all = [];
  try {
    const runtimes = Object.entries(JSON.parse(r.out.slice(0, r.out.lastIndexOf("}") + 1)).devices);
    const version = ([k]) => (/iOS-(\d+)-(\d+)/.exec(k) ?? []).slice(1).map(Number);
    const newest = (a, b) => (version(b)[0] ?? 0) - (version(a)[0] ?? 0) || (version(b)[1] ?? 0) - (version(a)[1] ?? 0);
    all = runtimes
      .filter(([k]) => k.includes("iOS"))
      .sort(newest)
      .flatMap(([, list]) => list);
  } catch {}
  if (want !== undefined) return all.find((d) => d.udid === want) ?? all.find((d) => d.name === want);
  const phones = all.filter((d) => String(d.name).startsWith("iPhone"));
  return phones.find((d) => d.state === "Booted") ?? phones[0];
}

await run("shell-launch", async () => {
  const diags = [];
  const counts = {};
  const fail = (message) => {
    diags.push({ kind: "diag", code: "E0014", message });
    return { diags, counts };
  };
  if (shellName !== "tauri" && shellName !== "ios")
    return fail(`--shell ${shellName ?? "(none)"}: the shell launch runs --shell tauri or --shell ios`);
  if (process.platform !== "darwin")
    return fail("the shell launch runs on macOS; on Linux run tooling/smoke/shell.mjs");
  if (!Number.isFinite(holdMs) || holdMs < 0) return fail(`--hold ${arg("hold")}: a number of seconds`);
  if (reboot && shellName !== "ios") return fail("--reboot needs --shell ios (the simulator is what reboots)");
  if (shellName === "tauri" && !fs.existsSync(binary))
    return fail(`no shell binary at ${path.relative(root, binary)}: run keel build --target tauri first`);
  if (shellName === "ios" && !fs.existsSync(bundle))
    return fail(`no app at ${path.relative(root, bundle)}: run keel build --target capacitor --platform ios first`);
  const server = path.join(app, "dist/api/server.mjs");
  if (!fs.existsSync(server)) return fail("no apps/golden-1/dist/api/server.mjs: run keel build first");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-shell-launch-"));
  const value = randomBytes(12).toString("hex");
  const carries = (cookie) =>
    String(cookie ?? "")
      .split(/;\s*/)
      .includes(`${COOKIE}=${value}`);
  /** Every request the proxy saw: `{ launch, method, path, agent, cookie }`, `cookie` whether it carried the cookie. */
  const seen = [];
  const sockets = new Set();
  let launch = 0;
  let api;
  let proxy;
  let shell;
  let doing = "start";
  try {
    // 1. The built api over a fresh SQLite file, and the proxy at KEEL_ORIGIN.
    doing = "start the built api";
    const apiPort = await freePort();
    api = child(process.execPath, ["--disable-warning=ExperimentalWarning", server], {
      cwd: app,
      env: {
        ...process.env,
        PORT: String(apiPort),
        KEEL_ORIGIN: `http://localhost:${apiPort}`,
        KEEL_SECRET: randomBytes(24).toString("hex"),
        KEEL_DATABASE_URL: pathToFileURL(path.join(tmp, "api.sqlite")).href,
        KEEL_FORMAT: "json",
      },
    });
    const listening = await until(
      () =>
        fetch(`http://127.0.0.1:${apiPort}/api/lists`, { signal: AbortSignal.timeout(2_000) }).then(
          (r) => r.ok,
          () => false,
        ),
      LISTEN_MS,
    );
    if (!listening) return fail(`the built api did not answer on ${apiPort} within ${LISTEN_MS / 1000}s`);
    proxy = http.createServer((req, res) => {
      const carried = carries(req.headers.cookie);
      seen.push({
        launch,
        method: req.method ?? "",
        path: req.url ?? "",
        agent: String(req.headers["user-agent"] ?? "-"),
        cookie: carried,
      });
      const up = http.request(
        { host: "127.0.0.1", port: apiPort, method: req.method, path: req.url, headers: req.headers },
        (r) => {
          const headers = { ...r.headers };
          if (!carried)
            headers["set-cookie"] = [
              ...(r.headers["set-cookie"] ?? []),
              `${COOKIE}=${value}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; SameSite=Lax`,
            ];
          res.writeHead(r.statusCode ?? 502, headers);
          r.pipe(res);
        },
      );
      up.on("error", () => res.destroy());
      res.on("close", () => up.destroy());
      req.pipe(up);
    });
    proxy.on("connection", (s) => {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
    });
    doing = `listen at ${origin.host}`;
    await new Promise((resolve, reject) => {
      proxy.once("error", reject);
      // The simulator's `localhost` may resolve to ::1 first: listen on both loopbacks.
      proxy.listen(Number(origin.port || 80), "localhost", resolve);
    });

    // 2. and 3. Launch, kill, launch again.
    if (shellName === "ios") {
      doing = "find a simulator";
      const d = await device(arg("device"));
      if (d === undefined)
        return fail(`no available simulator${arg("device") ? ` ${arg("device")}` : " named iPhone"}`);
      sim.udid = d.udid;
      if (d.state !== "Booted") {
        doing = `boot ${d.name}`;
        sim.booted = true;
        await simctl(["boot", d.udid]);
        const up = await simctl(["bootstatus", d.udid, "-b"], BOOT_MS);
        if (!up.ok) return fail(`${d.name} did not boot within ${BOOT_MS / 1000}s: ${tail(up.out, 1)}`);
      }
      doing = "install the app";
      await simctl(["uninstall", d.udid, APP_ID]);
      sim.installed = true;
      const put = await simctl(["install", d.udid, bundle]);
      if (!put.ok) return fail(`simctl install: ${tail(put.out, 1)}`);
    }
    const home = path.join(tmp, "home");
    fs.mkdirSync(home, { recursive: true });
    /** Start the app; resolves once it runs. */
    const start = async () => {
      launch++;
      doing = `launch ${launch}`;
      if (shellName === "tauri") {
        shell = child(binary, [], { env: { ...process.env, HOME: home } });
        return;
      }
      const r = await simctl(["launch", sim.udid, APP_ID]);
      if (!r.ok) throw new Error(`simctl launch: ${tail(r.out, 1)}`);
    };
    /** Kill the app without letting it end by itself: SIGKILL, or the simulator's force-stop. */
    const kill = async () => {
      doing = `kill launch ${launch}`;
      if (shellName === "tauri") {
        if (shell.out.exited !== undefined) throw new Error(`the app ended by itself (exit ${shell.out.exited})`);
        signalGroup(shell, "SIGKILL");
        if (!(await until(() => shell.out.exited !== undefined, GONE_MS)))
          throw new Error(`the app still runs ${GONE_MS / 1000}s after SIGKILL`);
      } else {
        const r = await simctl(["terminate", sim.udid, APP_ID]);
        if (!r.ok) throw new Error(`simctl terminate: ${tail(r.out, 1)}`);
      }
      counts.killed = (counts.killed ?? 0) + 1;
    };
    const mine = () => seen.filter((r) => r.launch === launch && NATIVE.test(r.agent));
    const streamAt = () => mine().findIndex((r) => r.method === "GET" && r.path.startsWith("/api/board/events"));
    /** Wait until this launch read the board and opened its event stream through the native client. */
    const loaded = async () => {
      doing = `load launch ${launch}`;
      const ok = await until(() => {
        const reqs = mine();
        const read = reqs.findIndex((r) => r.method === "GET" && r.path.startsWith("/api/lists"));
        return read >= 0 && streamAt() > read;
      }, LOAD_MS);
      if (!ok)
        throw new Error(
          `no GET /api/lists and then GET /api/board/events from the shell at KEEL_ORIGIN within ${LOAD_MS / 1000}s`,
        );
      counts.launches = launch;
    };
    /** After a relaunch every request up to the event stream must carry the cookie. */
    const kept = (how) => {
      const bare = mine()
        .slice(0, streamAt() + 1)
        .filter((r) => !r.cookie);
      for (const r of bare)
        diags.push({
          kind: "diag",
          code: "E0015",
          message: `${r.method} ${r.path} came without the ${COOKIE} cookie after ${how} (launch ${launch})`,
        });
      return bare.length === 0;
    };

    await start();
    await loaded();
    doing = "wait for a request carrying the cookie";
    if (!(await until(() => mine().some((r) => r.cookie), LOAD_MS)))
      return fail(`no request of launch 1 carried the ${COOKIE} cookie within ${LOAD_MS / 1000}s of its being set`);
    doing = `hold launch 1 for ${holdMs / 1000}s`;
    await wait(holdMs);
    await kill();
    if (dropData) {
      doing = "drop the app's data";
      if (shellName === "tauri") fs.rmSync(home, { recursive: true, force: true });
      else {
        await simctl(["uninstall", sim.udid, APP_ID]);
        const put = await simctl(["install", sim.udid, bundle]);
        if (!put.ok) return fail(`simctl install: ${tail(put.out, 1)}`);
      }
      fs.mkdirSync(home, { recursive: true });
    }
    await start();
    await loaded();
    if (!kept(shellName === "tauri" ? "SIGKILL" : "a force-stop")) return { diags, counts };
    if (reboot) {
      await kill();
      doing = "reboot the simulator";
      const down = await simctl(["shutdown", sim.udid]);
      if (!down.ok) return fail(`simctl shutdown: ${tail(down.out, 1)}`);
      await simctl(["boot", sim.udid]);
      const up = await simctl(["bootstatus", sim.udid, "-b"], BOOT_MS);
      if (!up.ok) return fail(`the simulator did not boot again within ${BOOT_MS / 1000}s: ${tail(up.out, 1)}`);
      counts.reboots = 1;
      await start();
      await loaded();
      kept("a reboot");
    }
    return { diags, counts };
  } catch (e) {
    return fail(`${doing}: ${String(e?.message ?? e).split("\n")[0]}`);
  } finally {
    if (diags.length > 0) {
      for (const r of seen)
        process.stderr.write(
          `req launch ${r.launch} ${r.method} ${r.path} agent ${r.agent} cookie ${r.cookie ? "sent" : "-"}\n`,
        );
      if (api !== undefined) process.stderr.write(`api: ${tail(api.out.text, 10)}\n`);
      if (shell !== undefined) process.stderr.write(`shell: ${tail(shell.out.text, 20)}\n`);
    }
    await stop(shell);
    if (sim.udid !== undefined) {
      if (sim.installed) {
        await simctl(["terminate", sim.udid, APP_ID]);
        await simctl(["uninstall", sim.udid, APP_ID]);
      }
      if (sim.booted) await simctl(["shutdown", sim.udid]);
    }
    for (const s of sockets) s.destroy();
    if (proxy !== undefined) await new Promise((r) => proxy.close(() => r(undefined)));
    await stop(api);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
