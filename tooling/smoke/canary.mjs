// Personal-data canaries over built golden-2. The canaries of `apps/golden-2/test/canaries.ts` (a name, an email, a
// password, a wrong password, a forged token) and the ones a run makes (the minted API token, its secret part and the
// user id) go into every personal-data and secret field the app takes: sign-up, sign-in, `/api/me` by cookie and by
// bearer, `/api/tokens`, sign-out. A copy of the app in a temporary folder is built, and its `api` `server.mjs` serves
// the flow over HTTP once per log format (`KEEL_FORMAT` `compact` and `json`), each on fresh data in that folder. Each
// sink is a step of its own, so a leak names its sink and the field: the server's output, error answers and the pages
// a refusal redirects to, URLs asked for and redirected to, cookies, the built files under `dist/` (`routes.json` and
// the rest) after the runs, and the evidence bundle `keel evidence` writes for apps/golden-2 (whose `keel test` runs
// the sim canary tests), which must also verify. The database is the one place they may be: its files are checked to
// hold the email, so the run is known to have carried it. Usage: node tooling/smoke/canary.mjs. The bundle goes to the
// temporary folder; the app's own folder is only read.
import { execFile, spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildIn, copyApp, freePort, recorder, root, wait } from "./built.mjs";

const LIMIT_MS = 240_000;
const SECRET = "golden-2-smoke-secret-of-32-bytes-or-more";
const AUTH_SECRET = "golden-2-smoke-auth-secret-of-32-characters";
const golden2 = join(root, "apps", "golden-2");
const cli = join(root, "packages", "cli", "src", "bin.ts");
const {
  CANARIES,
  CANARY_EMAIL,
  CANARY_FAKE_TOKEN,
  CANARY_NAME,
  CANARY_OTHER_NAME,
  CANARY_PASSWORD,
  CANARY_WRONG,
  leaked,
} = await import(pathToFileURL(join(golden2, "test", "canaries.ts")).href);

const { step, finish } = recorder();
const children = new Set();
const killAll = () => {
  for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill("SIGKILL");
};
process.on("exit", killAll);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    killAll();
    process.exit(130);
  });
}
const limit = setTimeout(() => {
  killAll();
  step("time limit", false, `${LIMIT_MS / 1000}s`);
  finish("canary");
  process.exit(1);
}, LIMIT_MS);

/** Start the built `api` of `dir` at `port` on the data folder `data`, logging in `format`; its output is kept in `log`. */
function serve(dir, port, data, format) {
  const child = spawn(
    process.execPath,
    [
      "--experimental-webstorage",
      `--localstorage-file=${join(data, "api.storage")}`,
      "--disable-warning=ExperimentalWarning",
      join(dir, "dist", "api", "server.mjs"),
    ],
    {
      cwd: dir,
      env: {
        ...process.env,
        PORT: String(port),
        KEEL_SECRET: SECRET,
        BETTER_AUTH_SECRET: AUTH_SECRET,
        KEEL_POSTGRES_URL: `pglite:${join(data, "postgres")}`,
        AUTH_DATABASE_PATH: join(data, "auth.sqlite"),
        KEEL_FORMAT: format,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  children.add(child);
  const log = [];
  for (const out of [child.stdout, child.stderr]) out.on("data", (d) => log.push(...String(d).split("\n")));
  const exited = new Promise((resolve) => child.once("exit", resolve));
  return {
    child,
    log,
    async kill() {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await Promise.race([exited, wait(10_000)]);
    },
  };
}

/** Poll the sign-in page for a 200, at most `ms`; false when the server exits first. */
async function up(base, server, ms = 30_000) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(100)) {
    if (server.child.exitCode !== null) return false;
    const ok = await fetch(`${base}/account/signin`, { headers: { accept: "text/html" } }).then(
      (r) => r.status === 200,
      () => false,
    );
    if (ok) return true;
  }
  return false;
}

/** Every file under `dir`, recursively. */
async function filesUnder(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await filesUnder(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** The files under `dir` holding a canary, as `path: fields`; `[]` when none. Bytes are read as latin1, so any text form matches. */
async function leakedFiles(dir, canaries) {
  const found = [];
  for (const f of await filesUnder(dir)) {
    const hit = leaked((await readFile(f)).toString("latin1"), canaries);
    if (hit.length > 0) found.push(`${f.slice(dir.length + 1)}: ${hit.join(",")}`);
  }
  return found;
}

/**
 * The account flow against `base` as a browser and a script make it. Answers are kept as `{ method, path, status,
 * location, cookies, text }`; `urls` holds each path asked for and each `location` sent.
 */
async function flow(base) {
  const answers = [];
  const urls = [];
  let cookie = "";
  const send = async (method, path, headers, body) => {
    urls.push(path);
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { ...(cookie === "" ? {} : { cookie }), ...headers },
      redirect: "manual",
      ...(body === undefined ? {} : { body }),
    }).then(
      async (res) => ({
        method,
        path,
        status: res.status,
        location: res.headers.get("location"),
        cookies: res.headers.getSetCookie(),
        text: await res.text(),
      }),
      (e) => ({ method, path, status: 0, location: null, cookies: [], text: String(e) }),
    );
    if (r.location !== null) urls.push(r.location);
    answers.push(r);
    return r;
  };
  const form = async (path, fields) => {
    const r = await send(
      "POST",
      path,
      { accept: "text/html", "content-type": "application/x-www-form-urlencoded", origin: base },
      new URLSearchParams(fields).toString(),
    );
    if (r.status === 303 && r.location !== null) await send("GET", r.location, { accept: "text/html" });
    return r;
  };
  const json = (method, path, extra, body) =>
    send(
      method,
      path,
      { accept: "application/json", "content-type": "application/json", "x-keel": "1", origin: base, ...(extra ?? {}) },
      body === undefined ? undefined : JSON.stringify(body),
    );

  await json("POST", "/api/auth/sign-up/email", {}, { name: CANARY_NAME, email: CANARY_EMAIL, password: "short" });
  await form("/api/auth/sign-up/email?locale=en-US", { name: CANARY_NAME, email: CANARY_EMAIL, password: "short" });
  await form("/api/auth/sign-up/email?locale=en-US", {
    name: CANARY_NAME,
    email: CANARY_EMAIL,
    password: CANARY_PASSWORD,
  });
  await form("/api/auth/sign-up/email?locale=en-US", {
    name: CANARY_OTHER_NAME,
    email: CANARY_EMAIL,
    password: CANARY_WRONG,
  });
  await form("/api/auth/sign-in/email?locale=en-US", { email: CANARY_EMAIL, password: CANARY_WRONG });
  await json("POST", "/api/auth/sign-in/email", {}, { email: CANARY_EMAIL, password: CANARY_WRONG });
  const signin = await form("/api/auth/sign-in/email?locale=en-US", { email: CANARY_EMAIL, password: CANARY_PASSWORD });
  cookie = signin.cookies.map((c) => c.split(";")[0]).join("; ");
  const who = await json("GET", "/api/auth/get-session");
  const me = await json("GET", "/api/me");
  const mint = await json("POST", "/api/tokens", {}, {});
  let token = "";
  let userId = "";
  try {
    token = JSON.parse(mint.text).value.token;
    userId = JSON.parse(who.text).user.id;
  } catch {
    // Left empty: the carried step fails.
  }
  // The client router's read of the user (k.guards Client): the one answer the user id may be in, so it is not an error answer.
  urls.push("/__keel/user");
  const entry = await fetch(`${base}/__keel/user`, {
    headers: { cookie, accept: "application/json", "x-keel": "1" },
    redirect: "manual",
  }).then(
    async (res) => ({ status: res.status, text: await res.text(), cookies: res.headers.getSetCookie() }),
    (e) => ({ status: 0, text: String(e), cookies: [] }),
  );
  let entryUser = null;
  try {
    entryUser = JSON.parse(entry.text).user;
  } catch {
    // Left null: the carried step fails.
  }
  const signedIn = cookie;
  cookie = "";
  await json("GET", "/api/me", { authorization: `Bearer ${token}` });
  await json("GET", "/api/me", { authorization: `Bearer ${token.slice(0, -1)}${token.at(-1) === "0" ? "1" : "0"}` });
  await json("GET", "/api/me", { authorization: `Bearer ${CANARY_FAKE_TOKEN}` });
  await json("GET", "/api/me", { authorization: `Bearer ${CANARY_EMAIL}` });
  await json("GET", "/api/me", { authorization: `Basic ${CANARY_PASSWORD}` });
  cookie = signedIn;
  await form("/api/auth/sign-out?locale=en-US", {});
  return {
    answers,
    urls,
    me,
    entry: { ...entry, user: entryUser },
    minted: { token, tokenSecret: token.split("_").at(-1) ?? "", userId },
  };
}

/** An answer that refuses: a 4xx or 5xx, or a page reached by a redirect that carries `error`. */
const refused = (a) => a.status >= 400 || /[?&]error=/.test(a.path);

const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-canary-"));
let server;
const runtime = {};
try {
  const dir = join(tmp, "app");
  await copyApp(dir, golden2);
  step("build", await buildIn(dir));

  for (const format of ["compact", "json"]) {
    const data = join(tmp, `data-${format}`);
    await mkdir(data);
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    server = serve(dir, port, data, format);
    const ready = await up(base, server);
    step(`${format}: serve api`, ready, ready ? "" : server.log.slice(-3).join(" | "));
    if (!ready) continue;
    const run = await flow(base);
    await server.kill();
    const all = { ...CANARIES, ...run.minted };
    Object.assign(runtime, run.minted);
    const meHolds = run.me.status === 200 && run.me.text.includes(CANARY_EMAIL);
    step(
      `${format}: carried: signed in, minted a token, /api/me names the email`,
      run.minted.token !== "" && run.minted.userId !== "" && meHolds,
      `me ${run.me.status}`,
    );
    step(
      `${format}: carried: /__keel/user names the user id`,
      run.minted.userId !== "" && run.entry.status === 200 && run.entry.user === run.minted.userId,
      `entry ${run.entry.status}`,
    );
    step(
      `${format}: sink /__keel/user sets no cookie`,
      run.entry.cookies.length === 0,
      `${run.entry.cookies.length} cookies`,
    );
    const db = await leakedFiles(join(data, "postgres"), { email: CANARY_EMAIL });
    step(`${format}: carried: the database files hold the email`, db.length > 0, `${db.length} files`);
    const logged = server.log.filter((l) => l !== "");
    step(
      `${format}: sink server output`,
      leaked(logged.join("\n"), all).length === 0 && logged.length > 0,
      `${logged.length} lines${leaked(logged.join("\n"), all).length === 0 ? "" : `, leaked ${leaked(logged.join("\n"), all).join(",")}`}`,
    );
    const refusals = run.answers.filter(refused);
    const badAnswers = refusals
      .map((a) => ({ a, hit: leaked(`${a.text}\n${a.location ?? ""}`, all) }))
      .filter((x) => x.hit.length > 0)
      .map((x) => `${x.a.method} ${x.a.path} ${x.a.status}: ${x.hit.join(",")}`);
    step(
      `${format}: sink error answers and error pages`,
      badAnswers.length === 0 && refusals.length >= 6,
      `${refusals.length} answers${badAnswers.length === 0 ? "" : `, leaked ${badAnswers.join(" | ")}`}`,
    );
    const badUrls = run.urls.filter((u) => leaked(u, all).length > 0);
    step(
      `${format}: sink URLs`,
      badUrls.length === 0,
      `${run.urls.length} URLs${badUrls.length === 0 ? "" : `, leaked ${badUrls.join(" ")}`}`,
    );
    const cookies = run.answers.flatMap((a) => a.cookies).join("\n");
    step(`${format}: sink cookies`, leaked(cookies, all).length === 0, leaked(cookies, all).join(","));
  }

  const built = await leakedFiles(join(dir, "dist"), { ...CANARIES, ...runtime });
  const files = (await filesUnder(join(dir, "dist"))).length;
  step(
    "sink build artifacts under dist/",
    built.length === 0 && files > 0,
    `${files} files${built.length === 0 ? "" : `, leaked ${built.join(" | ")}`}`,
  );

  // The evidence bundle of apps/golden-2: its `keel test` runs test/canary.test.ts and test/canary-session.test.ts.
  const { privateKey } = generateKeyPairSync("ed25519");
  const key = privateKey.export({ type: "pkcs8", format: "pem" });
  const out = join(tmp, "evidence");
  const evidence = await new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", cli, "evidence", "--out", out],
      {
        cwd: golden2,
        env: { ...process.env, KEEL_AGENT: "1", KEEL_EVIDENCE_KEY: key },
        maxBuffer: 64 * 1024 * 1024,
        timeout: 180_000,
      },
      (err, stdout) =>
        resolve({ code: err === null ? 0 : (err.code ?? 1), last: stdout.trim().split("\n").at(-1) ?? "" }),
    );
    children.add(child);
  });
  const manifest = await readFile(join(out, "manifest.json"), "utf8").then(JSON.parse, () => null);
  step("evidence written for apps/golden-2", manifest !== null, `exit ${evidence.code}, ${evidence.last}`);
  const inBundle = await leakedFiles(out, CANARIES);
  step("sink evidence bundle", manifest !== null && inBundle.length === 0, inBundle.join(" | "));
  const verified = await new Promise((resolve) => {
    execFile(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        cli,
        "evidence",
        "--verify",
        out,
        "--key",
        String(manifest?.keyId ?? ""),
      ],
      { cwd: golden2, env: { ...process.env, KEEL_AGENT: "1" }, timeout: 60_000 },
      (err, stdout) =>
        resolve({ code: err === null ? 0 : (err.code ?? 1), last: stdout.trim().split("\n").at(-1) ?? "" }),
    );
  });
  step("evidence bundle verifies", verified.code === 0, verified.last);
} catch (e) {
  step("flow", false, String(e).split("\n")[0]);
} finally {
  clearTimeout(limit);
  await server?.kill();
  killAll();
  await rm(tmp, { recursive: true, force: true });
}
finish("canary");
