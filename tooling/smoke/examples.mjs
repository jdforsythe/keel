// The minimal examples under examples/: for each one `keel check`, `keel test` and `keel build` in its folder, then one
// assertion on the built output that proves the feature the example shows. Usage:
// node tooling/smoke/examples.mjs [name ...]. One line per step, then the trailer; a missing proof is a failed step.
// Every server it starts is stopped in a `finally`; nothing is written outside the examples' own build folders.
import { execFile, spawn } from "node:child_process";
import { createReadStream, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";
import { freePort, recorder, root, wait } from "./built.mjs";

const cli = join(root, "packages", "cli", "src", "bin.ts");
const SECRET = "examples-smoke-secret-of-32-bytes-or-more";
const all = readdirSync(join(root, "examples"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const names = process.argv.length > 2 ? process.argv.slice(2) : all;

/** `keel <args>` in `dir`: resolves to whether it passed, and its last output line. */
const keel = (dir, args) =>
  new Promise((resolve) => {
    execFile(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", cli, ...args],
      { cwd: dir, env: { ...process.env, KEEL_AGENT: "1" }, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const last = `${stdout}${stderr}`.trim().split("\n").at(-1) ?? "";
        resolve({ pass: err === null, last });
      },
    );
  });

/** Start `node dist/<deployable>/server.mjs` of `dir` on a free port; `stop()` kills it. */
async function serveNode(dir, deployable, env = {}) {
  const port = await freePort();
  const child = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", join(dir, "dist", deployable, "server.mjs")],
    { cwd: dir, env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET, ...env }, stdio: "ignore" },
  );
  const exited = new Promise((r) => child.once("exit", r));
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await Promise.race([exited, wait(10_000)]);
  };
  return { base: `http://127.0.0.1:${port}`, stop };
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** A plain static file server over `folder`: a file or 404, `/` is `index.html`, each answer with `headers`. */
async function serveFiles(folder, headers = {}) {
  const port = await freePort();
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    const file = normalize(join(folder, path === "/" ? "index.html" : path));
    const isFile = file.startsWith(folder) && statSync(file, { throwIfNoEntry: false })?.isFile() === true;
    if (!isFile) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { ...headers, "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${port}`, stop: () => new Promise((r) => server.close(r)) };
}

/** Poll `GET base+path` until it answers, at most `ms`; resolves to the response or null. */
async function answer(base, path, ms = 20_000) {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    const res = await fetch(`${base}${path}`, { headers: { accept: "text/html" } }).catch(() => null);
    if (res !== null) return res;
    await wait(100);
  }
  return null;
}

/** A policy string as a map of directive to its source list. */
const directives = (policy) =>
  new Map(
    policy
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0] !== "")
      .map(([name, ...sources]) => [name, sources.join(" ")]),
  );

/** Each proof resolves to [pass, detail]. */
const proofs = {
  /** The built server's document policy holds the declared origin in img-src and no other origin anywhere. */
  async "third-party-origin"(dir) {
    const server = await serveNode(dir, "web");
    try {
      const res = await answer(server.base, "/");
      const policy = res?.headers.get("content-security-policy") ?? "";
      const map = directives(policy);
      const img = map.get("img-src");
      const others = [...map].filter(([k, v]) => k !== "img-src" && /https?:/.test(v)).map(([k]) => k);
      const html = res === null ? "" : await res.text();
      return [
        res?.status === 200 &&
          img === "'self' https://tile.openstreetmap.org" &&
          others.length === 0 &&
          html.includes('src="https://tile.openstreetmap.org/0/0/0.png"'),
        `img-src ${img ?? "-"}; other origins ${others.join(",") || "none"}`,
      ];
    } finally {
      await server.stop();
    }
  },

  /** The built server sends the `Host` node empty; in Chromium, under the document's policy, its code draws 3 bars. */
  async "host-component"(dir) {
    const server = await serveNode(dir, "web");
    const browser = await chromium.launch();
    try {
      const res = await answer(server.base, "/");
      const html = res === null ? "" : await res.text();
      const served = /<div [^>]*id="app\.home\.chart"[^>]*><\/div>/.test(html) && html.includes("data-k-host");
      const page = await browser.newPage();
      const errors = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`${server.base}/`);
      const rects = page.locator('[id="app.home.chart"] svg rect');
      await rects.nth(2).waitFor({ timeout: 15_000 });
      const drawn = await rects.count();
      return [
        served && drawn === 3 && errors.length === 0,
        `served empty ${served}, ${drawn} bars, ${errors.length} errors`,
      ];
    } finally {
      await browser.close();
      await server.stop();
    }
  },

  /** The built server's page shows what a stub of the OpenAPI document's server answered to the generated client. */
  async "openapi-import"(dir) {
    const seen = [];
    const stub = createServer((req, res) => {
      seen.push(`${req.method} ${req.url}`);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "q1", text: "Served by the stub.", author: "smoke" }));
    });
    const listening = await new Promise((r) => {
      stub.once("error", () => r(false));
      stub.listen(4417, "127.0.0.1", () => r(true));
    });
    if (!listening) return [false, "port 4417, the document's server, is in use"];
    const server = await serveNode(dir, "web");
    try {
      const res = await answer(server.base, "/");
      const html = res === null ? "" : await res.text();
      return [
        res?.status === 200 && html.includes("Served by the stub.") && seen.join() === "GET /quotes/q1",
        `stub saw ${seen.join(",") || "nothing"}`,
      ];
    } finally {
      await server.stop();
      await new Promise((r) => stub.close(r));
    }
  },

  /**
   * The built `api` serves the shell's client at the guarded path, refuses `/api/me` signed out, answers a sign-in post
   * to the mount with a 303 to its `next` and a cookie, then names the user; the Tauri files register the shell's id.
   */
  async "shell-mount"(dir) {
    const server = await serveNode(dir, "api");
    try {
      const page = await answer(server.base, "/notes/n1");
      const html = page === null ? "" : await page.text();
      const me = (cookie) =>
        fetch(`${server.base}/api/me`, { headers: { accept: "application/json", ...(cookie ? { cookie } : {}) } });
      const out = (await me()).status;
      const signin = await fetch(`${server.base}/api/auth/sign-in/email?next=%2Fnotes%2Fn1`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", origin: server.base },
        body: "name=Ada",
        redirect: "manual",
      });
      const cookie = signin.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
      const inRes = await me(cookie);
      const named = inRes.status === 200 ? JSON.stringify(await inRes.json()) : "";
      const conf = readFileSync(join(dir, "deploy", "web", "tauri", "tauri.conf.json"), "utf8");
      return [
        page?.status === 200 &&
          html.includes('id="app"') &&
          out === 403 &&
          signin.status === 303 &&
          signin.headers.get("location") === "/notes/n1" &&
          named.includes('"name":"Ada"') &&
          conf.includes('"schemes": ["dev.keel.shellmount"]'),
        `page ${page?.status}, me ${out} then ${inRes.status}, sign-in ${signin.status} to ${signin.headers.get("location")}`,
      ];
    } finally {
      await server.stop();
    }
  },

  /** A plain file server sends `dist/web` with its `csp.txt` as the policy; Chromium renders the page, no errors. */
  async "static-client"(dir) {
    const folder = join(dir, "dist", "web");
    const policy = readFileSync(join(folder, "csp.txt"), "utf8").trim();
    const server = await serveFiles(folder, { "content-security-policy": policy });
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`${server.base}/`);
      const title = page.locator('[id="app.home.title"]');
      await title.waitFor({ timeout: 15_000 });
      const text = await title.textContent();
      return [text === "Static files only" && errors.length === 0, `heading "${text}", ${errors.length} errors`];
    } finally {
      await browser.close();
      await server.stop();
    }
  },
};

const { step, finish } = recorder();
for (const name of names) {
  const dir = join(root, "examples", name);
  const runs = [
    ["check", ["check"]],
    ["test", ["test"]],
    ["build", ["build"]],
  ];
  let built = true;
  for (const [label, args] of runs) {
    const r = await keel(dir, args);
    step(`${name} ${label}`, r.pass, r.pass ? "" : r.last);
    built &&= r.pass;
  }
  const proof = proofs[name];
  if (proof === undefined) step(`${name} proof`, false, "no proof in tooling/smoke/examples.mjs");
  else if (!built) step(`${name} proof`, false, "not built");
  else {
    const [pass, detail] = await proof(dir).catch((e) => [false, String(e).split("\n")[0]]);
    step(`${name} proof`, pass, detail);
  }
}
finish("examples");
