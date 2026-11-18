// CI's Tauri shell run (the `shell-tauri` job of tooling/ci.source.json), after
// `KEEL_ORIGIN=http://localhost:4182 keel build --target tauri` in apps/golden-1. It starts golden-1's built `api`
// (`dist/api/server.mjs`, port 4181, a throwaway secret and SQLite file), a recording proxy at the build's
// `KEEL_ORIGIN` (port 4182) that forwards to it, and the debug binary of the `web` shell. It passes when, within
// LOAD_MS, the app's native HTTP client (user agent `tauri-plugin-http`) reads `GET /api/lists` through the proxy, so
// the shell loaded its entry, ran it and reached the server, and the app is still running STAY_MS later. Then it stops
// all three. A failure is E0014 with the app's last output lines. Run it under a display (`xvfb-run -a` in CI).
// Usage: node tooling/ci-shell.mjs [binary]   (default apps/golden-1/dist/web/tauri/target/debug/golden-1)
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { run } from "./output.ts";

const root = new URL("..", import.meta.url).pathname;
const app = path.join(root, "apps/golden-1");
const binary = path.resolve(root, process.argv[2] ?? "apps/golden-1/dist/web/tauri/target/debug/golden-1");
const API_PORT = 4181;
const PROXY_PORT = 4182;
/** How long the shell has to start, load its entry and read the board. */
const LOAD_MS = 90_000;
/** How long the shell must keep running after its first read. */
const STAY_MS = 5_000;
/** How long the built api has to accept a connection. */
const LISTEN_MS = 20_000;
/** The pause between two connection attempts while the api starts. */
const POLL_MS = 100;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const tail = (s, n) => s.split("\n").filter(Boolean).slice(-n).join("\n");

/** True once something accepts a connection at 127.0.0.1:`port`. */
const accepts = (port) =>
  new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
  });

/** A child process whose output is kept, and whose exit is recorded. */
function child(cmd, args, opts) {
  const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
  const out = { text: "", exited: undefined };
  p.stdout.on("data", (d) => {
    out.text += d;
  });
  p.stderr.on("data", (d) => {
    out.text += d;
  });
  p.on("exit", (code, signal) => {
    out.exited = signal ?? String(code);
  });
  p.on("error", (e) => {
    out.text += `${e.message}\n`;
    out.exited = "spawn";
  });
  return { p, out };
}

const stop = async (c) => {
  if (c === undefined || c.out.exited !== undefined) return;
  c.p.kill("SIGTERM");
  for (let i = 0; i < 30 && c.out.exited === undefined; i++) await pause(POLL_MS);
  if (c.out.exited === undefined) c.p.kill("SIGKILL");
};

await run("ci-shell", async () => {
  const diags = [];
  const fail = (message) => diags.push({ kind: "diag", code: "E0014", message });
  if (!fs.existsSync(binary)) {
    fail(`no shell binary at ${path.relative(root, binary)}: run keel build --target tauri first`);
    return { diags, counts: {} };
  }
  const server = path.join(app, "dist/api/server.mjs");
  if (!fs.existsSync(server)) {
    fail("no apps/golden-1/dist/api/server.mjs: run keel build first");
    return { diags, counts: {} };
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-ci-shell-"));
  const seen = [];
  const sockets = new Set();
  let api;
  let shell;
  let proxy;
  try {
    api = child(process.execPath, ["--disable-warning=ExperimentalWarning", server], {
      cwd: app,
      env: {
        ...process.env,
        PORT: String(API_PORT),
        KEEL_ORIGIN: `http://localhost:${API_PORT}`,
        KEEL_SECRET: randomBytes(24).toString("hex"),
        KEEL_DATABASE_URL: `file://${path.join(tmp, "api.sqlite")}`,
        KEEL_FORMAT: "json",
      },
    });
    const until = Date.now() + LISTEN_MS;
    while (!(await accepts(API_PORT)) && api.out.exited === undefined && Date.now() < until) await pause(POLL_MS);
    if (!(await accepts(API_PORT))) {
      fail(`the built api did not listen on ${API_PORT} within ${LISTEN_MS / 1000}s`);
      process.stderr.write(`${tail(api.out.text, 20)}\n`);
      return { diags, counts: {} };
    }
    proxy = http.createServer((req, res) => {
      seen.push({
        method: req.method ?? "",
        path: req.url ?? "",
        origin: req.headers.origin ?? "-",
        agent: req.headers["user-agent"] ?? "-",
      });
      const up = http.request(
        { host: "127.0.0.1", port: API_PORT, method: req.method, path: req.url, headers: req.headers },
        (r) => {
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
    await new Promise((r) => proxy.listen(PROXY_PORT, "127.0.0.1", r));
    shell = child(binary, [], {
      cwd: path.dirname(binary),
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
    const read = () =>
      seen.find(
        (r) => r.method === "GET" && r.path.startsWith("/api/lists") && r.agent.startsWith("tauri-plugin-http"),
      );
    const t0 = Date.now();
    while (read() === undefined && shell.out.exited === undefined && Date.now() - t0 < LOAD_MS) await pause(POLL_MS);
    const first = read();
    if (first === undefined) {
      const why =
        shell.out.exited === undefined ? `within ${LOAD_MS / 1000}s` : `before it exited (${shell.out.exited})`;
      fail(`the shell read no GET /api/lists through KEEL_ORIGIN ${why}; ${seen.length} requests`);
    } else {
      await pause(STAY_MS);
      if (shell.out.exited !== undefined)
        fail(`the shell exited (${shell.out.exited}) within ${STAY_MS / 1000}s of reading the board`);
    }
    if (diags.length > 0) {
      for (const r of seen) process.stderr.write(`req ${r.method} ${r.path} origin ${r.origin} agent ${r.agent}\n`);
      process.stderr.write(`${tail(shell.out.text, 20)}\n`);
    }
    return { diags, counts: { requests: seen.length } };
  } finally {
    await stop(shell);
    for (const s of sockets) s.destroy();
    if (proxy !== undefined) await new Promise((r) => proxy.close(() => r(undefined)));
    await stop(api);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
