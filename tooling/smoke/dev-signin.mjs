// Dev-mode proof for golden-2: `keel dev` (`AUTH_FIXTURE=dev`, as the app's `dev` script sets it) in a copy of the app
// in a temporary folder, so its `.keel-dev/` state is that folder's, on a free port. Over HTTP, with no browser: `/` and
// `/catalog` answer the page shell that loads `/@keel/entry.ts`; the sign-in page is server-rendered by the `api`
// deployable; a sign-up and a sign-in post to the identity mount (`/api/auth`) the way the account forms do and answer
// 303 to the sign-in page, the sign-in with a session cookie; with that cookie the sign-in page names the account and
// `GET /api/me` answers its email, and without it neither does; every server-only file the accounts routes import is
// served to a browser request as its stub, with no `node:` import and none of the file's code. The child runs in its
// own process group, which every path (a finished run, a failed step, a signal, the 90 s limit) kills.
// Usage: node tooling/smoke/dev-signin.mjs. Nothing is written inside the repo.
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyApp, freePort, recorder, root, wait } from "./built.mjs";

const LIMIT_MS = 90_000;
const cli = join(root, "packages", "cli", "src", "bin.ts");
const { step, finish } = recorder();
let dev;

/** SIGKILL the dev server's process group (the child and whatever it started); true once it is gone or never was. */
function killGroup() {
  if (dev === undefined || dev.child.pid === undefined) return;
  try {
    process.kill(-dev.child.pid, "SIGKILL");
  } catch {
    // The group is already gone.
  }
}
process.on("exit", killGroup);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    killGroup();
    process.exit(130);
  });
}
const limit = setTimeout(() => {
  killGroup();
  step("time limit", false, `${LIMIT_MS / 1000}s${dev === undefined ? "" : `, ${dev.log.slice(-3).join(" | ")}`}`);
  finish("dev-signin");
  process.exit(1);
}, LIMIT_MS);

/** Start `keel dev --port <port>` in `dir` as the leader of its own process group; its output is kept in `log`. */
function startDev(dir, port) {
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", cli, "dev", "--port", String(port)], {
    cwd: dir,
    env: { ...process.env, AUTH_FIXTURE: "dev", KEEL_AGENT: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const log = [];
  for (const out of [child.stdout, child.stderr]) out.on("data", (d) => log.push(...String(d).trim().split("\n")));
  const exited = new Promise((resolve) => child.once("exit", resolve));
  return { child, log, exited };
}

const html = { accept: "text/html" };
const form = { ...html, "content-type": "application/x-www-form-urlencoded" };

/** The text of `path` on `base` with `headers`, and its status; status 0 when the server does not answer. */
const text = (base, path, headers = html) =>
  fetch(`${base}${path}`, { headers, redirect: "manual" }).then(
    async (r) => ({ status: r.status, body: await r.text(), res: r }),
    () => ({ status: 0, body: "", res: undefined }),
  );

/** Poll the sign-in page, served by the `api` deployable, for a 200, at most `ms`; false when the server exits first. */
async function ready(base, ms = 40_000) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(150)) {
    if (dev.child.exitCode !== null) return false;
    if ((await text(base, "/account/signin")).status === 200) return true;
  }
  return false;
}

/** A native form post to the identity mount, as the account pages' forms send it; the response is not followed. */
const mountPost = (base, path, fields) =>
  fetch(`${base}/api/auth${path}`, {
    method: "POST",
    headers: { ...form, origin: base },
    body: new URLSearchParams(fields).toString(),
    redirect: "manual",
  }).then(
    (r) => ({ status: r.status, location: r.headers.get("location") ?? "", cookies: r.headers.getSetCookie() }),
    () => ({ status: 0, location: "", cookies: [] }),
  );

const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-dev-"));
try {
  const dir = join(tmp, "app");
  await copyApp(dir, join(root, "apps", "golden-2"));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  dev = startDev(dir, port);
  const up = await ready(base);
  step("serve dev", up, up ? "" : dev.log.slice(-3).join(" | "));
  if (!up) throw new Error("keel dev did not serve");

  // The shell: `/` and `/catalog` are the page that loads the client entry.
  for (const path of ["/", "/catalog"]) {
    const page = await text(base, path);
    step(
      `GET ${path} shell`,
      page.status === 200 && page.body.includes('<div id="app">') && page.body.includes('src="/@keel/entry.ts"'),
      `status ${page.status}`,
    );
  }
  const signinPage = await text(base, "/account/signin");
  step(
    "GET /account/signin served",
    signinPage.status === 200 &&
      signinPage.body.includes('id="accounts.signin"') &&
      !signinPage.body.includes('id="accounts.signedIn"'),
    `status ${signinPage.status}`,
  );
  const anon = await text(base, "/api/me", { accept: "application/json" });
  step("GET /api/me without a session", anon.status === 403, `status ${anon.status}`);

  // Sign up and sign in through the identity mount, as the forms post.
  const email = `cook-${Date.now()}@example.com`;
  const password = "smoke password";
  const up1 = await mountPost(base, "/sign-up/email", { name: "Smoke Cook", email, password });
  step(
    "sign-up through the identity mount",
    up1.status === 303 && up1.location === "/account/signin",
    `${up1.status} ${up1.location}`,
  );
  const in1 = await mountPost(base, "/sign-in/email", { email, password });
  const cookie = in1.cookies
    .map((c) => c.split(";")[0])
    .filter((c) => c.startsWith("better-auth.session_token="))
    .join("; ");
  step(
    "sign-in through the identity mount sets a session",
    in1.status === 303 && in1.location === "/account/signin" && cookie !== "",
    `${in1.status} ${in1.location} ${cookie === "" ? "no session cookie" : "session cookie"}`,
  );
  const bad = await mountPost(base, "/sign-in/email", { email, password: "wrong password" });
  step(
    "sign-in with a wrong password is refused",
    bad.status === 303 && bad.cookies.length === 0,
    `${bad.status} ${bad.location}`,
  );

  // With the cookie the next requests see the account.
  const named = await text(base, "/account/signin", { ...html, cookie });
  step(
    "sign-in page names the account",
    named.status === 200 && named.body.includes('id="accounts.signedIn"') && named.body.includes(email),
    `status ${named.status}`,
  );
  const me = await text(base, "/api/me", { accept: "application/json", cookie });
  step("GET /api/me names the account", me.status === 200 && me.body.includes(email), `status ${me.status}`);

  // The browser's module requests: a server-only file the client graph imports is its stub.
  const routes = await text(base, "/modules/accounts/routes.ts", { accept: "*/*", "sec-fetch-dest": "script" });
  const files = [...routes.body.matchAll(/from "(\/modules\/[^"]*\.server\.ts)"/g)].map((m) => m[1]);
  step(
    "browser module of the accounts routes lists server-only files",
    routes.status === 200 && files.length > 0,
    `status ${routes.status}, ${files.length} files`,
  );
  for (const file of [...files, "/modules/accounts/authOf.server.ts"]) {
    const mod = await text(base, file, { accept: "*/*", "sec-fetch-dest": "script" });
    step(
      `browser gets the stub of ${file.slice("/modules/".length)}`,
      mod.status === 200 && mod.body.includes("serverOnly(") && !mod.body.includes("node:"),
      `status ${mod.status}${mod.body.includes("node:") ? ", node: import" : ""}`,
    );
  }
} catch (e) {
  step("flow", false, String(e).split("\n")[0]);
} finally {
  clearTimeout(limit);
  killGroup();
  await Promise.race([dev?.exited, wait(10_000)]);
  await rm(tmp, { recursive: true, force: true });
}
finish("dev-signin");
