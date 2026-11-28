// Shell replay for golden-1 where no WebDriver reaches the webview (WKWebView: the Tauri macOS binary and the
// Capacitor iOS app on the Simulator): a recorded session replayed inside the shell through the accessibility tree
// gives the server state its sim replay gives; with `--session outbox`, writes queued while the server is down drain
// after the app is killed and started again. The same proof as tooling/smoke/shell.mjs (Linux, WebDriver), with
// another driver. Run on macOS after `KEEL_ORIGIN=http://localhost:4182 keel build --target tauri` or
// `keel build --target capacitor --platform ios` in apps/golden-1.
//
// 1. Record: `apps/golden-1/test/shellSession.ts` (`--session replay`, the default) or `shellOutboxSession.ts`
//    (`--session outbox`) records a one-user session group under simulation and replays it with `replayGroup`; the
//    group is written to `.keel/sessions/golden-1-shell.group.json` in a temporary folder.
// 2. Serve: a SQLite file holding the group's starting board, the built `api` (`dist/api/server.mjs`) on a free port
//    over it, and a recording proxy at the build's `KEEL_ORIGIN` forwarding to the api.
// 3. Drive: once the app has read `GET /api/lists` through its native HTTP client, each input of the group file's
//    user is made in the page (`actionsOf`); after each the proxy must go quiet.
//    `--shell tauri`: `shell-drive/ax.swift`, compiled with `swiftc` into the temporary folder, makes each input
//    through the accessibility API, finding an element by its DOM id (WebKit's `AXDOMIdentifier`) and a link by its
//    URL: a press, or a field's value set. The binary runs with `HOME` in the temporary folder. The process that runs
//    this script needs the Accessibility permission, which the script checks and never asks for.
//    `--shell ios`: the UI test `shell-drive/ShellDrive.xcodeproj`, built with `xcodebuild build-for-testing` and run
//    with `test-without-building` on the simulator, starts the installed app by its bundle id and asks this script
//    for one command at a time over HTTP: a tap, or a field tapped, cleared and typed into. WebKit on iOS gives the
//    accessibility tree an element's role and label and not its DOM id, so each id is named by role and label
//    (`labelled` and `linkTo` in shellReplay.mjs, from the starting board's names and titles).
//    A `net` input going offline stops the api and closes the proxy, so `KEEL_ORIGIN` refuses connections; going
//    online waits until the shell's store holds the queued writes in `todos.outbox` (`keel.json` and `keel.b.json`
//    under `HOME`; on iOS the `keel` entry of the app's preferences file, which the simulator writes some seconds
//    after the app's write resolves), every write of the sim replay the server has not stored when it is the
//    session's last input, kills the app (SIGKILL, or the simulator's
//    force-stop), starts the api and the proxy again over the same SQLite file, and starts the app again, whose
//    layout drains the persisted outbox. `--drop-store` deletes the store before that start (the store files; on iOS
//    an uninstall and install): the planted failure, where nothing drains and step 4 must fail.
// 4. Compare: the stored `api.board` row and `replayGroup`'s `api.board`, both `normalized`, must be equal; after a
//    restart the stored outbox must also be empty.
// Passing prints one `ok` line. E0014: the shell could not be started or driven (the step, the requests the proxy saw
// and the last output lines follow on stderr). E0015: the boards differ, one line per difference, or the sim replay
// did not reproduce its recording. The app, the driver, the proxy and the api are stopped on every path; on iOS the
// app and the test's runner app are uninstalled, and a simulator this script booted is shut down.
// Usage: node tooling/smoke/shell-drive.mjs --shell tauri [--session replay|outbox] [--drop-store] [--binary <path>]
//        node tooling/smoke/shell-drive.mjs --shell ios [--session replay|outbox] [--drop-store] [--app <path>]
//          [--device <udid or name>]
//   (binary default: .cargo-target/debug/golden-1, else apps/golden-1/dist/web/tauri/target/debug/golden-1; app
//   default: apps/golden-1/dist/web/capacitor/ios/build/Build/Products/Debug-iphonesimulator/App.app; device default:
//   the booted iPhone, else the first available one; KEEL_ORIGIN default http://localhost:4182)
import { execFile, spawn } from "node:child_process";
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
import { actionsOf, boardDiff, labelled, linkTo, normalized, outboxIn, outboxInPairs } from "./shellReplay.mjs";

/** How long recording and replaying the session under simulation may take. */
const SIM_MS = testTime(180_000);
/** How long the built api has to answer. */
const LISTEN_MS = testTime(20_000);
/** How long the shell has to start, load its entry and read the board. */
const LOAD_MS = testTime(180_000);
/** How long an element named by an action has to appear, and a followed link to change the route. */
const ELEMENT_MS = testTime(15_000);
/** How long the proxy must see no request in flight before an action counts as settled. */
const QUIET_MS = fixedTime(600);
/** How long one action has to settle. */
const SETTLE_MS = testTime(20_000);
/** How long the stored board must stay unchanged after the last action, and the most that may take. */
const STILL_MS = fixedTime(1_500);
const STORED_MS = testTime(15_000);
/** How long the queued writes have to reach the shell's store, a killed app to be gone, and a drained store to empty. */
const QUEUED_MS = testTime(30_000);
/** How long the driver has to build (`swiftc`, `xcodebuild build-for-testing`), and the UI test to start. */
const BUILD_MS = testTime(600_000);
const READY_MS = testTime(300_000);
/** How long a simulator has to boot, and one `simctl` command to end. */
const BOOT_MS = testTime(300_000);
const SIMCTL_MS = testTime(120_000);
/** How long one accessibility call has to end. */
const AX_MS = testTime(20_000);
/** The pause between two polls. */
const POLL_MS = fixedTime(100);
/** The app id of golden-1's shells (`topology.ts`). */
const APP_ID = "dev.keel.golden1";
/** The app `xcodebuild` installs to run the UI test (`ShellDrive.xcodeproj`'s bundle id and `.xctrunner`). */
const RUNNER_ID = "dev.keel.smoke.ShellDrive.xctrunner";
/** The agents of the shells' native HTTP clients: tauri-plugin-http (reqwest) and URLSession. */
const NATIVE = /^tauri-plugin-http|CFNetwork/;
/** The outbox golden-1's board writes wait in (`modules/todos/boardOutbox.ts`). */
const OUTBOX = "todos.outbox";
/** The entry `@capacitor/preferences` keeps the store's document under in the app's preferences file. */
const PREFERENCE = "CapacitorStorage.keel";
/** Each session: the module under apps/golden-1 that records it, and its export. */
const SESSIONS = {
  replay: ["./test/shellSession.ts", "shellSession"],
  outbox: ["./test/shellOutboxSession.ts", "shellOutboxSession"],
};
const drivers = path.join(root, "tooling/smoke/shell-drive");

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const a = argv[i] ?? "";
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[i + 1];
};
const shellName = arg("shell");
const sessionName = arg("session") ?? "replay";
const dropStore = argv.includes("--drop-store");
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
const firstLine = (s) =>
  String(s)
    .split("\n")
    .find((l) => l.trim() !== "") ?? "";

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

/** `cmd args` to its end: `{ ok, out, err }`, its stdout and stderr. */
const exec = (cmd, args, ms) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: ms, maxBuffer: 2 ** 26 }, (err, stdout, stderr) =>
      resolve({ ok: err === null, out: String(stdout), err: String(stderr) }),
    );
  });
const simctl = async (args, ms = SIMCTL_MS) => {
  const r = await exec("xcrun", ["simctl", ...args], ms);
  return { ok: r.ok, out: `${r.out}\n${r.err}` };
};

/**
 * Record and replay the session under simulation, in a child with tsx (the group's workers load TypeScript), its
 * module loaded through the app's compiler as the app's tests load it (`compiledImport`).
 */
function simulate(out, [file, name]) {
  const tsx = pathToFileURL(createRequire(path.join(root, "package.json")).resolve("tsx")).href;
  const loader = pathToFileURL(path.join(root, "tooling/smoke/compiledImport.mjs")).href;
  const code = [
    "import fs from 'node:fs';",
    `import { compiledImport } from ${JSON.stringify(loader)};`,
    `const { module: m, close } = await compiledImport(process.cwd(), ${JSON.stringify(file)});`,
    "try {",
    `  fs.writeFileSync(process.env.KEEL_SHELL_SESSION_OUT, JSON.stringify(await m[${JSON.stringify(name)}]()));`,
    "} finally {",
    "  await close();",
    "}",
  ].join("\n");
  const c = child(process.execPath, ["--import", tsx, "--input-type=module", "-e", code], {
    cwd: app,
    env: { ...process.env, NODE_ENV: "test", KEEL_SHELL_SESSION_OUT: out },
  });
  return { c, done: until(() => c.out.exited !== undefined, SIM_MS) };
}

/** The Tauri shell's store files under `dir`: `keel.json`, then `keel.b.json`. */
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

/**
 * The simulator to run on, `{ udid, name, state }`: `want` (a udid or a name), else the booted iPhone, else the first
 * available iPhone of the newest iOS runtime.
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

/**
 * The macOS driver: the binary under `HOME` `home`, its page driven by `ax` (shell-drive/ax.swift, compiled into
 * `tmp`). A driver's methods: `prepare()` once, `start()` the app, `act(action)` one input, `kill()` the app without
 * letting it end by itself, `outbox()` the entries its store holds (undefined when it holds no copy), `drop()` the
 * store, `output()` the last lines the app or the driver wrote, and `close()`.
 */
function tauriDriver(tmp) {
  const tool = path.join(tmp, "ax");
  const home = path.join(tmp, "home");
  let shell;
  const ax = (...args) => exec(tool, [String(shell.p.pid), ...args], AX_MS);
  /** `ax` again until it finds its element: the page builds its accessibility tree on the first question. */
  const found = async (...args) => {
    let last = { ok: false, err: "" };
    const ok = await until(async () => {
      last = await ax(...args);
      return last.ok;
    }, ELEMENT_MS);
    if (!ok) throw new Error(`${firstLine(last.err) || `ax ${args[0]} did not end`} within ${ELEMENT_MS / 1000}s`);
    return last.out.trim();
  };
  return {
    async prepare() {
      const built = await exec("swiftc", ["-O", path.join(drivers, "ax.swift"), "-o", tool], BUILD_MS);
      if (!built.ok) throw new Error(`swiftc ax.swift: ${firstLine(built.err)}`);
      const trusted = await exec(tool, ["0", "trusted"], AX_MS);
      if (trusted.out.trim() !== "true")
        throw new Error(
          "this process may not use the accessibility API: allow its terminal under System Settings, Privacy & Security, Accessibility",
        );
      fs.mkdirSync(home, { recursive: true });
    },
    async start() {
      shell = child(binary, [], { env: { ...process.env, HOME: home } });
    },
    async act(a) {
      if (a.kind === "nav") {
        if ((await found("route")) === a.href) return;
        await found("nav", a.href);
        if (!(await until(async () => (await ax("route")).out.trim() === a.href, ELEMENT_MS)))
          throw new Error(`the route is not ${a.href} ${ELEMENT_MS / 1000}s after the link`);
      } else if (a.kind === "click") await found("click", a.id);
      else if (a.kind === "type") await found("type", a.id, a.value);
      else throw new Error(`the accessibility driver makes no ${a.kind} input`);
    },
    async kill() {
      if (shell.out.exited !== undefined) throw new Error(`the app ended by itself (exit ${shell.out.exited})`);
      signalGroup(shell, "SIGKILL");
      if (!(await until(() => shell.out.exited !== undefined, QUEUED_MS)))
        throw new Error(`the app still runs ${QUEUED_MS / 1000}s after SIGKILL`);
    },
    outbox: async () => outboxIn(storeFiles(home).map(readText), OUTBOX),
    async drop() {
      for (const f of storeFiles(home)) fs.rmSync(f);
    },
    output: () => (shell === undefined ? "" : tail(shell.out.text, 20)),
    close: () => stop(shell),
  };
}

/**
 * The iOS driver: the app installed on a simulator, its page driven by the UI test shell-drive/ShellDrive.xcodeproj,
 * which asks `POST /next` on a port of this script for each command and answers the one before. `state` is the
 * starting board's state, which names the elements (`labelled`).
 */
function iosDriver(tmp, state) {
  const derived = path.join(tmp, "derived");
  const project = ["-project", path.join(drivers, "ShellDrive.xcodeproj"), "-scheme", "ShellDrive"];
  let control;
  let test;
  /** The command waiting for the test to ask, the test's open question, and who waits for the answer. */
  let queued;
  let asking;
  let answered;
  const hand = () => {
    if (queued === undefined || asking === undefined) return;
    asking.end(JSON.stringify(queued));
    queued = undefined;
    asking = undefined;
  };
  /** Give the test `command` and wait for its answer's `value`; rejects with its `error`, or when the test ends. */
  const command = (c, ms) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`the UI test did not answer ${c.kind} within ${ms / 1000}s`)),
        ms,
      );
      answered = (a) => {
        clearTimeout(timer);
        if (a?.ok === true) resolve(a.value);
        else reject(new Error(String(a?.error ?? "the UI test ended")));
      };
      queued = c;
      hand();
    });
  const element = (id) => {
    const named = labelled(id, state);
    if (named === undefined) throw new Error(`no accessible name is known for ${id}`);
    return { ...named, seconds: ELEMENT_MS / 1000 };
  };
  /** The store's document: the `keel` entry of the app's preferences file. */
  const document = async () => {
    const data = await simctl(["get_app_container", sim.udid, APP_ID, "data"]);
    if (!data.ok) return undefined;
    const plist = path.join(firstLine(data.out).trim(), "Library/Preferences", `${APP_ID}.plist`);
    const r = await exec("/usr/libexec/PlistBuddy", ["-c", `Print :${PREFERENCE}`, plist], SIMCTL_MS);
    return r.ok ? r.out : undefined;
  };
  const install = async () => {
    await simctl(["uninstall", sim.udid, APP_ID]);
    sim.installed = true;
    const put = await simctl(["install", sim.udid, bundle]);
    if (!put.ok) throw new Error(`simctl install: ${tail(put.out, 1)}`);
  };
  return {
    async prepare() {
      const d = await device(arg("device"));
      if (d === undefined)
        throw new Error(`no available simulator${arg("device") ? ` ${arg("device")}` : " named iPhone"}`);
      sim.udid = d.udid;
      if (d.state !== "Booted") {
        sim.booted = true;
        await simctl(["boot", d.udid]);
        const up = await simctl(["bootstatus", d.udid, "-b"], BOOT_MS);
        if (!up.ok) throw new Error(`${d.name} did not boot within ${BOOT_MS / 1000}s: ${tail(up.out, 1)}`);
      }
      await install();
      const on = ["-destination", `platform=iOS Simulator,id=${d.udid}`, "-derivedDataPath", derived];
      const built = await exec("xcodebuild", ["build-for-testing", ...project, ...on, "-quiet"], BUILD_MS);
      if (!built.ok)
        throw new Error(
          `xcodebuild build-for-testing: ${firstLine(tail(`${built.out}\n${built.err}`, 40).replace(/^.*warning:.*$/gm, ""))}`,
        );
      control = http.createServer((req, res) => {
        let body = "";
        req.on("data", (c) => {
          body += c;
        });
        req.on("end", () => {
          let answer;
          try {
            answer = JSON.parse(body);
          } catch {}
          asking = res;
          const tell = answered;
          answered = undefined;
          tell?.(answer);
          hand();
        });
      });
      control.timeout = 0;
      await new Promise((resolve, reject) => {
        control.once("error", reject);
        control.listen(0, "127.0.0.1", resolve);
      });
      const ready = new Promise((resolve, reject) => {
        answered = (a) => (a?.ok === true ? resolve(undefined) : reject(new Error("the UI test did not start")));
      });
      test = child("xcodebuild", ["test-without-building", ...project, ...on, "-parallel-testing-enabled", "NO"], {
        env: {
          ...process.env,
          TEST_RUNNER_KEEL_DRIVE_URL: `http://127.0.0.1:${control.address().port}`,
          TEST_RUNNER_KEEL_DRIVE_APP: APP_ID,
        },
      });
      // A test that ends while a command waits answers it with nothing, which rejects the command.
      test.p.on("exit", () => answered?.(undefined));
      const gone = until(() => test.out.exited !== undefined, READY_MS).then((exited) => {
        throw new Error(
          exited
            ? `xcodebuild test-without-building ended (exit ${test.out.exited}) before the UI test asked for a command`
            : `the UI test asked for no command within ${READY_MS / 1000}s`,
        );
      });
      await Promise.race([ready, gone]);
    },
    start: () => command({ kind: "launch" }, LOAD_MS),
    async act(a) {
      if (a.kind === "nav") {
        const link = linkTo(a.href);
        if (link === undefined) throw new Error(`no link is known for ${a.href}`);
        await command({ kind: "click", ...element(link) }, ELEMENT_MS * 3);
      } else if (a.kind === "click") await command({ kind: "click", ...element(a.id) }, ELEMENT_MS * 3);
      else if (a.kind === "type") await command({ kind: "type", ...element(a.id), value: a.value }, ELEMENT_MS * 4);
      else throw new Error(`the UI test makes no ${a.kind} input`);
    },
    async kill() {
      const r = await simctl(["terminate", sim.udid, APP_ID]);
      if (!r.ok) throw new Error(`simctl terminate: ${tail(r.out, 1)}`);
    },
    outbox: async () => outboxInPairs(await document(), OUTBOX),
    drop: install,
    output: () =>
      test === undefined
        ? ""
        : tail(
            test.out.text
              .split("\n")
              .filter((l) => /error|failed|Test Case/i.test(l))
              .join("\n"),
            10,
          ),
    async close() {
      if (test !== undefined && test.out.exited === undefined) {
        // End the test by its own command, so xcodebuild stops the runner app; then the group, whatever it did.
        if (asking !== undefined) {
          queued = { kind: "end" };
          hand();
          await until(() => test.out.exited !== undefined, testTime(20_000));
        }
        await stop(test);
      }
      if (control !== undefined) {
        control.closeAllConnections();
        await new Promise((r) => control.close(() => r(undefined)));
      }
      if (sim.udid !== undefined) {
        if (sim.installed) {
          await simctl(["terminate", sim.udid, APP_ID]);
          await simctl(["uninstall", sim.udid, APP_ID]);
        }
        if (test !== undefined) {
          await simctl(["terminate", sim.udid, RUNNER_ID]);
          await simctl(["uninstall", sim.udid, RUNNER_ID]);
        }
        if (sim.booted) await simctl(["shutdown", sim.udid]);
      }
    },
  };
}

await run("shell-drive", async () => {
  const diags = [];
  const counts = {};
  const fail = (message) => {
    diags.push({ kind: "diag", code: "E0014", message });
    return { diags, counts };
  };
  if (shellName !== "tauri" && shellName !== "ios")
    return fail(`--shell ${shellName ?? "(none)"}: the shell drive runs --shell tauri or --shell ios`);
  if (process.platform !== "darwin") return fail("the shell drive runs on macOS; on Linux run tooling/smoke/shell.mjs");
  if (!Object.hasOwn(SESSIONS, sessionName))
    return fail(`--session ${sessionName}: the sessions are replay and outbox`);
  if (dropStore && sessionName !== "outbox")
    return fail("--drop-store needs --session outbox (the session that restarts)");
  if (shellName === "tauri" && !fs.existsSync(binary))
    return fail(`no shell binary at ${path.relative(root, binary)}: run keel build --target tauri first`);
  if (shellName === "ios" && !fs.existsSync(bundle))
    return fail(`no app at ${path.relative(root, bundle)}: run keel build --target capacitor --platform ios first`);
  const server = path.join(app, "dist/api/server.mjs");
  if (!fs.existsSync(server)) return fail("no apps/golden-1/dist/api/server.mjs: run keel build first");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-shell-drive-"));
  const seen = [];
  const sockets = new Set();
  let inFlight = 0;
  let lastBusy = Date.now();
  let recording;
  let api;
  let proxy;
  let driver;
  let doing = "start";
  const secret = randomBytes(24).toString("hex");
  try {
    // 1. Record and replay under simulation.
    doing = "record the session under simulation";
    const simOut = path.join(tmp, "sim.json");
    recording = simulate(simOut, SESSIONS[sessionName]);
    await recording.done;
    if (!fs.existsSync(simOut)) {
      process.stderr.write(`${tail(recording.c.out.text, 20)}\n`);
      return fail(`the sim session did not finish within ${SIM_MS / 1000}s (exit ${recording.c.out.exited ?? "none"})`);
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
        seen.push({ method: req.method ?? "", path: req.url ?? "", agent: String(req.headers["user-agent"] ?? "-") });
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
        res.on("close", () => up.destroy());
        req.pipe(up);
      });
      proxy.on("connection", (s) => {
        sockets.add(s);
        s.on("close", () => sockets.delete(s));
      });
      await new Promise((resolve, reject) => {
        proxy.once("error", reject);
        // The simulator's `localhost` may resolve to ::1 first: listen on both loopbacks.
        proxy.listen(Number(origin.port || 80), "localhost", resolve);
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
    doing = `prepare the ${shellName} driver`;
    driver = shellName === "tauri" ? tauriDriver(tmp) : iosDriver(tmp, JSON.parse(recorded.board).state);
    await driver.prepare();
    /** Start the app and wait until it reads the board through KEEL_ORIGIN. */
    const start = async () => {
      doing = "start the app";
      const from = seen.length;
      await driver.start();
      doing = "load the shell";
      const loaded = await until(
        () =>
          seen.slice(from).some((r) => r.method === "GET" && r.path.startsWith("/api/lists") && NATIVE.test(r.agent)),
        LOAD_MS,
      );
      if (!loaded) throw new Error(`the shell read no GET /api/lists through KEEL_ORIGIN within ${LOAD_MS / 1000}s`);
    };
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
    const logged = (board) => (Array.isArray(board?.log) ? board.log.length : 0);
    /**
     * Kill the app once its store holds the queued writes, bring the server back, and start the app again. `last`
     * says no input follows: the store must then hold every write of the sim replay the server has not stored, else
     * at least one.
     */
    const restart = async (last) => {
      doing = "wait for the queued writes in the shell's store";
      const need = last ? Math.max(1, logged(replayed) - logged(JSON.parse(row(file, BOARD_KEY) ?? "null"))) : 1;
      let text = "";
      let still = Date.now();
      let held = [];
      const persisted = await until(async () => {
        held = (await driver.outbox()) ?? [];
        const now = JSON.stringify(held);
        if (now !== text) {
          text = now;
          still = Date.now();
        }
        return held.length >= need && Date.now() - still >= STILL_MS;
      }, QUEUED_MS);
      if (!persisted)
        throw new Error(
          `the shell's store holds ${held.length} of ${need} writes in ${OUTBOX} after ${QUEUED_MS / 1000}s`,
        );
      counts.queued = held.length;
      doing = "kill the app";
      await driver.kill();
      counts.killed = (counts.killed ?? 0) + 1;
      if (dropStore) {
        doing = "drop the shell's store";
        await driver.drop();
      }
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
    for (const [i, a] of actions.entries()) {
      doing = `action ${i + 1} of ${actions.length} ${a.kind} ${a.id ?? a.href ?? (a.online ? "online" : "offline")}`;
      if (a.kind === "net") await (a.online ? restart(i === actions.length - 1) : offline());
      else await driver.act(a);
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
    if (counts.restarts !== undefined && diags.length === 0) {
      doing = "read the shell's store";
      let left = [];
      // The store empties after the server has the writes: give the last store write its time.
      await until(async () => {
        left = (await driver.outbox()) ?? [];
        return left.length === 0;
      }, QUEUED_MS);
      if (left.length > 0)
        diags.push({
          kind: "diag",
          code: "E0015",
          message: `${OUTBOX} still holds ${left.length} writes in the shell's store: ${left.map((e) => `${e.endpoint} ${e.state}`).join(", ")}`,
        });
    }
    return { diags, counts };
  } catch (e) {
    return fail(`${doing}: ${String(e?.message ?? e).split("\n")[0]}`);
  } finally {
    if (diags.length > 0) {
      for (const r of seen) process.stderr.write(`req ${r.method} ${r.path} agent ${r.agent}\n`);
      if (api !== undefined) process.stderr.write(`api: ${tail(api.out.text, 10)}\n`);
      if (driver !== undefined) process.stderr.write(`shell: ${driver.output()}\n`);
    }
    await driver?.close().catch(() => undefined);
    for (const s of sockets) s.destroy();
    if (proxy !== undefined) await new Promise((r) => proxy.close(() => r(undefined)));
    await stop(api);
    await stop(recording?.c);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
