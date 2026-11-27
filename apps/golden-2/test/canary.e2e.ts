// Personal-data canaries over built golden-2, served: the canaries of `canaries.ts` (a name, an email, a password, a
// wrong password, a forged token) and the ones a run makes (the minted API token, its secret part and the user id) go
// into every personal-data and secret field the app takes: sign-up, sign-in, `/api/me` by cookie and by bearer,
// `/api/tokens`, sign-out. The `api` deployable serves the flow once per log format (`KEEL_FORMAT` `compact` and `json`), each on fresh data. Each sink is a check of its own, so a leak names its sink and the field: the server's
// output, error answers and the pages a refusal redirects to, URLs asked for and redirected to, cookies, the built
// files under `dist/` after the runs, and the evidence bundle `keel evidence` writes for apps/golden-2 and for
// apps/household, which must be written with no check error and no failed test, and verify. The database is the one
// place they may be: its files are checked to hold the email, so the run is known to have carried it.
import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type Served, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, it } from "vitest";
import {
  CANARIES,
  CANARY_EMAIL,
  CANARY_FAKE_TOKEN,
  CANARY_NAME,
  CANARY_OTHER_NAME,
  CANARY_PASSWORD,
  CANARY_WRONG,
  leaked,
} from "./canaries.ts";

const app = resolve(import.meta.dirname, "..");
const household = resolve(app, "..", "household");
const cli = resolve(app, "..", "..", "packages", "cli", "src", "bin.ts");
/** The values `apps/household/test/profile.test.ts` and `test/recording.test.ts` type into the profile's marked fields. */
const HOUSEHOLD_CANARIES = { name: "Quillon Vantablack", phone: "+44 7700 900417" };
/** The ids and secrets a run minted, kept for the scan of `dist/`. */
const runtime: Record<string, string> = {};

type Answer = {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly location: string | null;
  readonly cookies: readonly string[];
  readonly text: string;
};

/** Every file under `dir`, recursively. */
async function filesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await filesUnder(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** The files under `dir` holding a canary, as `path: fields`. Bytes are read as latin1, so any text form matches. */
async function leakedFiles(dir: string, canaries: Readonly<Record<string, string>>): Promise<string[]> {
  const found: string[] = [];
  for (const f of await filesUnder(dir)) {
    const hit = leaked((await readFile(f)).toString("latin1"), canaries);
    if (hit.length > 0) found.push(`${f.slice(dir.length + 1)}: ${hit.join(",")}`);
  }
  return found;
}

/** What a server wrote, one line per record. */
const logText = (served: Served): string =>
  served
    .serverLog("api")
    .map((r) => JSON.stringify(r))
    .join("\n");

/** The account flow against `served` as a browser and a script make it; each answer is kept, and each URL. */
async function flow(served: Served) {
  const base = served.origin("api");
  const answers: Answer[] = [];
  const urls: string[] = [];
  let cookie = "";
  const send = async (method: string, path: string, headers: Record<string, string>, body?: string) => {
    urls.push(path);
    const res = await served.fetch(path, {
      method,
      deployable: "api",
      headers: { ...(cookie === "" ? {} : { cookie }), ...headers },
      ...(body === undefined ? {} : { body }),
    });
    const location = res.headers.get("location");
    const answer: Answer = {
      method,
      path,
      status: res.status,
      location,
      cookies: res.headers.getSetCookie(),
      text: await res.text(),
    };
    if (location !== null) urls.push(location);
    answers.push(answer);
    return answer;
  };
  const form = async (path: string, fields: Record<string, string>) => {
    const r = await send(
      "POST",
      path,
      { accept: "text/html", "content-type": "application/x-www-form-urlencoded", origin: base },
      new URLSearchParams(fields).toString(),
    );
    if (r.status === 303 && r.location !== null) await send("GET", r.location, { accept: "text/html" });
    return r;
  };
  const json = (method: string, path: string, extra: Record<string, string>, body?: unknown) =>
    send(
      method,
      path,
      { accept: "application/json", "content-type": "application/json", "x-keel": "1", origin: base, ...extra },
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
  cookie = signin.cookies.map((c) => c.split(";", 1).join("")).join("; ");
  const who = await json("GET", "/api/auth/get-session", {});
  const me = await json("GET", "/api/me", {});
  const mint = await json("POST", "/api/tokens", {}, {});
  const token = tokenOf(mint.text);
  const userId = userIdOf(who.text);
  // The client router's read of the user (k.guards Client): the one answer the user id may be in, so it is not an error answer.
  urls.push("/__keel/user");
  const entry = await served.fetch("/__keel/user", {
    deployable: "api",
    headers: { cookie, accept: "application/json", "x-keel": "1" },
  });
  const entryText = await entry.text();
  const entryCookies = entry.headers.getSetCookie();
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
    entry: { status: entry.status, user: entryUserOf(entryText), cookies: entryCookies },
    minted: { token, tokenSecret: token.split("_").at(-1) ?? "", userId },
  };
}

/** A JSON body's field at `path`, "" when it is not a string there. */
function stringAt(text: string, path: readonly string[]): string {
  let at: unknown;
  try {
    at = JSON.parse(text);
  } catch {
    return "";
  }
  for (const key of path) {
    if (typeof at !== "object" || at === null) return "";
    at = Reflect.get(at, key);
  }
  return typeof at === "string" ? at : "";
}
const tokenOf = (text: string): string => stringAt(text, ["value", "token"]);
const userIdOf = (text: string): string => stringAt(text, ["user", "id"]);
const entryUserOf = (text: string): string => stringAt(text, ["user"]);

/** An answer that refuses: a 4xx or 5xx, or a page reached by a redirect that carries `error`. */
const refused = (a: Answer): boolean => a.status >= 400 || /[?&]error=/.test(a.path);

describe("canaries in the sinks of the served api", () => {
  for (const format of ["compact", "json"]) {
    it(`${format}: no canary reaches a sink`, { timeout: fixedTime(120_000) }, async () => {
      let data = "";
      const served = await serve({
        env: (d) => {
          data = d;
          return {
            BETTER_AUTH_SECRET: "golden-2-e2e-auth-secret-of-32-characters",
            KEEL_POSTGRES_URL: `pglite:${join(d, "postgres")}`,
            AUTH_DATABASE_PATH: join(d, "auth.sqlite"),
            KEEL_FORMAT: format,
          };
        },
      });
      const run = await flow(served);
      const all = { ...CANARIES, ...run.minted };
      Object.assign(runtime, run.minted);
      // Carried: the flow reached what it is meant to check.
      expect(run.minted.token).not.toBe("");
      expect(run.minted.userId).not.toBe("");
      expect(run.me.status).toBe(200);
      expect(run.me.text).toContain(CANARY_EMAIL);
      expect(run.entry.status).toBe(200);
      expect(run.entry.user).toBe(run.minted.userId);
      // Sink /__keel/user sets no cookie.
      expect(run.entry.cookies).toEqual([]);
      // The database files hold the email.
      expect(await leakedFiles(join(data, "postgres"), { email: CANARY_EMAIL })).not.toEqual([]);
      // Sink server output.
      const logged = logText(served);
      expect(served.serverLog("api").length).toBeGreaterThan(0);
      expect(leaked(logged, all)).toEqual([]);
      // Sink error answers and error pages.
      const refusals = run.answers.filter(refused);
      expect(refusals.length).toBeGreaterThanOrEqual(6);
      expect(
        refusals
          .map((a) => ({ a, hit: leaked(`${a.text}\n${a.location ?? ""}`, all) }))
          .filter((x) => x.hit.length > 0)
          .map((x) => `${x.a.method} ${x.a.path} ${x.a.status}: ${x.hit.join(",")}`),
      ).toEqual([]);
      // Sink URLs.
      expect(run.urls.filter((u) => leaked(u, all).length > 0)).toEqual([]);
      // Sink cookies.
      expect(leaked(run.answers.flatMap((a) => a.cookies).join("\n"), all)).toEqual([]);
    });
  }

  it("no canary is in the build artifacts under dist/", async () => {
    const dist = join(app, "dist");
    expect(Object.keys(runtime)).toContain("token");
    expect(await leakedFiles(dist, { ...CANARIES, ...runtime })).toEqual([]);
    expect((await filesUnder(dist)).length).toBeGreaterThan(0);
  });
});

describe("the evidence bundle holds no canary", () => {
  const tmp: string[] = [];
  afterAll(async () => {
    for (const d of tmp) await rm(d, { recursive: true, force: true });
  });

  /** `keel <args>` in `cwd`: its exit code and the last lines it printed. */
  function keel(args: readonly string[], cwd: string, env: Record<string, string>) {
    return new Promise<{ code: number; detail: string }>((done) => {
      const lines: string[] = [];
      const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", cli, ...args], {
        cwd,
        env: { ...process.env, KEEL_AGENT: "1", KEEL_E2E: "", KEEL_TEST: "", ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      for (const out of [child.stdout, child.stderr])
        out.setEncoding("utf8").on("data", (d: string) => lines.push(...d.split("\n").filter((l) => l.trim() !== "")));
      child.on("close", (code, signal) => {
        const tail = lines.slice(-3).join(" | ");
        done({ code: code ?? 1, detail: `${signal === null ? `exit ${code}` : `killed by ${signal}`}: ${tail}` });
      });
    });
  }

  for (const [name, cwd, canaries] of [
    ["golden-2", app, CANARIES],
    ["household", household, HOUSEHOLD_CANARIES],
  ] as const) {
    // `keel evidence` runs the app's whole `keel test`, `keel check` and `keel ledger`: minutes on a loaded runner.
    it(`apps/${name}: written, free of canaries and verifies`, { timeout: fixedTime(600_000) }, async () => {
      const { privateKey } = generateKeyPairSync("ed25519");
      const key = privateKey.export({ type: "pkcs8", format: "pem" });
      const out = join(tempDir("keel-e2e-evidence-"), name);
      tmp.push(out);
      const evidence = await keel(["evidence", "--out", out], cwd, { KEEL_EVIDENCE_KEY: String(key) });
      const manifest: unknown = await readFile(join(out, "manifest.json"), "utf8").then(JSON.parse, () => null);
      expect(evidence.code, evidence.detail).toBe(0);
      expect(manifest).not.toBeNull();
      expect(await leakedFiles(out, canaries)).toEqual([]);
      const keyId = String(typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, "keyId") : "");
      const verified = await keel(["evidence", "--verify", out, "--key", keyId], cwd, {});
      expect(verified.code, verified.detail).toBe(0);
    });
  }
});
