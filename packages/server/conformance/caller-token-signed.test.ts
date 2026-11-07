// Spec: k.server, clause "`caller` is the hash of a server-signed cookie token, else of a fresh one set as a cookie on a write, else `""`."
// The hash is the base64url SHA-256 (no padding) of the whole cookie value the server set (everything after `name=`).
// Seed 1337. Runs under plain Node: happy-dom strips cookie headers. Only runtime (JSON) requests are used over http, so the name is `keel-caller`.
// @vitest-environment node
import { createHash } from "node:crypto";
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { expect, test } from "vitest";

const Out = s.object({ caller: s.string() });
const Nothing = s.object({});
const NAME = "keel-caller";
const hash = (value: string): string => createHash("sha256").update(value).digest("base64url");
const UUID = "123e4567-e89b-42d3-a456-426614174000";
const SECRET_A = "conformance-secret-a-0123456789abcdef0123456789abcdef";
const SECRET_B = "conformance-secret-b-fedcba9876543210fedcba9876543210";

async function setup(secret?: string) {
  const seen: { loader: string | undefined; action: string | undefined } = { loader: undefined, action: undefined };
  const read = loader({ output: Out }, async ({ caller }) => {
    seen.loader = caller;
    return ok({ caller });
  });
  const write = action({ input: Nothing }, async (_input, { caller }) => {
    seen.action = caller;
    return ok(null);
  });
  const routes = manifest({
    "app.who": { path: "/who", loader: read, actions: { POST: write }, component: () => document.createElement("p") },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
    ...(secret === undefined ? {} : { secret }),
  });
  const get = (cookie?: string): Promise<Response> =>
    app.fetch(
      new Request("http://localhost/who", {
        headers: { accept: "application/json", ...(cookie === undefined ? {} : { cookie }) },
      }),
    );
  const post = (cookie?: string): Promise<Response> =>
    app.fetch(
      new Request("http://localhost/who", {
        method: "POST",
        body: "{}",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          origin: "http://localhost",
          ...(cookie === undefined ? {} : { cookie }),
        },
      }),
    );
  return { seen, get, post };
}

/** The whole value after `keel-caller=` in a response's set-cookie, or undefined when none was set. */
function issued(res: Response): string | undefined {
  const header = res.headers.get("set-cookie");
  if (header === null) return undefined;
  const first = (header.split(";")[0] ?? "").trim();
  return first.startsWith(`${NAME}=`) ? first.slice(NAME.length + 1) : undefined;
}

async function issue(post: (cookie?: string) => Promise<Response>): Promise<string> {
  const res = await post();
  expect(res.status).toBe(200);
  const value = issued(res);
  if (value === undefined || value === "") throw new Error("fixture: a cookieless write set no caller cookie");
  return value;
}

function tamper(value: string, at: number): string {
  const i = at % value.length;
  const c = value[i] ?? "A";
  const repl = c === "A" ? "B" : "A";
  return value.slice(0, i) + repl + value.slice(i + 1);
}

/** Values of `keel-caller` pairs in a Cookie header, parsed the plain way. */
function sentValues(header: string): string[] {
  const out: string[] = [];
  for (const part of header.split(";")) {
    const p = part.trim();
    const eq = p.indexOf("=");
    if (eq > 0 && p.slice(0, eq) === NAME) out.push(p.slice(eq + 1));
  }
  return out;
}

test("`caller` is the hash of a server-signed cookie token (loader and action, value from a previous set-cookie, no new set-cookie)", async () => {
  const { seen, get, post } = await setup();
  const value = await issue(post);
  seen.loader = undefined;
  seen.action = undefined;
  const r = await get(`${NAME}=${value}`);
  expect(r.status).toBe(200);
  expect(seen.loader).toBe(hash(value));
  expect(seen.loader).not.toBe(value);
  expect(r.headers.get("set-cookie")).toBeNull();
  const w = await post(`${NAME}=${value}`);
  expect(w.status).toBe(200);
  expect(seen.action).toBe(hash(value));
  expect(seen.action).not.toBe(value);
  expect(w.headers.get("set-cookie")).toBeNull();
});

test("`caller` is the hash of a fresh token set as an HttpOnly SameSite=Lax Path=/ cookie on a write without one", async () => {
  const { seen, post } = await setup();
  const res = await post();
  expect(res.status).toBe(200);
  const header = res.headers.get("set-cookie");
  expect(header).not.toBeNull();
  const parts = (header ?? "").split(";").map((p) => p.trim());
  const value = issued(res);
  expect(value).toBeDefined();
  expect(value).not.toBe("");
  expect(seen.action).toBe(hash(value ?? ""));
  expect(seen.action).not.toBe(value);
  const attrs = parts.slice(1).map((p) => p.toLowerCase());
  expect(attrs).toContain("httponly");
  expect(attrs).toContain("samesite=lax");
  expect(attrs).toContain("path=/");
});

test("`caller` is the hash of a fresh token set as a cookie on a write: two cookieless writes mint different values", async () => {
  const { seen, post } = await setup();
  const ra = await post();
  const a = seen.action;
  const rb = await post();
  const b = seen.action;
  expect(a).toBe(hash(issued(ra) ?? "\u0000"));
  expect(b).toBe(hash(issued(rb) ?? "\u0000"));
  expect(a).not.toBe(b);
});

test('`caller` is `""` for a read without a cookie, and no cookie is set', async () => {
  const { seen, get } = await setup();
  const res = await get();
  expect(res.status).toBe(200);
  expect(seen.loader).toBe("");
  expect(res.headers.get("set-cookie")).toBeNull();
});

test("`caller` is the hash of the issued cookie token even when other cookies are present", async () => {
  const { seen, get, post } = await setup();
  const value = await issue(post);
  const cookie = `theme=dark; ${NAME}=${value}; other=1`;
  const r = await get(cookie);
  expect(r.headers.get("set-cookie")).toBeNull();
  expect(seen.loader).toBe(hash(value));
  const w = await post(cookie);
  expect(seen.action).toBe(hash(value));
  expect(w.headers.get("set-cookie")).toBeNull();
});

test('`caller` is not the hash of a well-formed but unissued value (UUID): a read gets `""`, a write gets a fresh cookie whose hash is the caller', async () => {
  const { seen, get, post } = await setup();
  const r = await get(`${NAME}=${UUID}`);
  expect(r.status).toBe(200);
  expect(seen.loader).toBe("");
  expect(r.headers.get("set-cookie")).toBeNull();
  const w = await post(`${NAME}=${UUID}`);
  expect(w.status).toBe(200);
  const fresh = issued(w);
  expect(fresh).toBeDefined();
  expect(fresh).not.toBe(UUID);
  expect(seen.action).toBe(hash(fresh ?? ""));
  expect(seen.action).not.toBe(hash(UUID));
});

test("`caller` is not the hash of an issued value with one character changed", async () => {
  const { seen, get, post } = await setup();
  const value = await issue(post);
  for (const at of [0, Math.floor(value.length / 2), value.length - 1]) {
    const bad = tamper(value, at);
    expect(bad).not.toBe(value);
    await get(`${NAME}=${bad}`);
    expect(seen.loader).toBe("");
    const w = await post(`${NAME}=${bad}`);
    const fresh = issued(w);
    expect(fresh).toBeDefined();
    expect(fresh).not.toBe(value);
    expect(seen.action).toBe(hash(fresh ?? ""));
    expect(seen.action).not.toBe(hash(bad));
    expect(seen.action).not.toBe(hash(value));
  }
});

test("`caller` is not the hash of a value issued by an app built with a different secret", async () => {
  const a = await setup(SECRET_A);
  const b = await setup(SECRET_B);
  const value = await issue(a.post);
  await b.get(`${NAME}=${value}`);
  expect(b.seen.loader).toBe("");
  const w = await b.post(`${NAME}=${value}`);
  const fresh = issued(w);
  expect(fresh).toBeDefined();
  expect(fresh).not.toBe(value);
  expect(b.seen.action).toBe(hash(fresh ?? ""));
  expect(b.seen.action).not.toBe(hash(value));
});

test("`caller` survives a restart: two apps given the same secret accept each other's cookies", async () => {
  const a = await setup(SECRET_A);
  const b = await setup(SECRET_A);
  const value = await issue(a.post);
  const r = await b.get(`${NAME}=${value}`);
  expect(b.seen.loader).toBe(hash(value));
  expect(r.headers.get("set-cookie")).toBeNull();
  const w = await b.post(`${NAME}=${value}`);
  expect(b.seen.action).toBe(hash(value));
  expect(w.headers.get("set-cookie")).toBeNull();
});

test('`caller` is only ever the hash of an issued value sent as keel-caller, of the fresh cookie on a write, or `""` (property over cookie headers)', async () => {
  // Seed 1337.
  const a = await setup(SECRET_A);
  const other = await setup(SECRET_B);
  const mine: string[] = [];
  for (let i = 0; i < 3; i++) mine.push(await issue(a.post));
  const foreign: string[] = [];
  for (let i = 0; i < 2; i++) foreign.push(await issue(other.post));
  const printable = fc.stringMatching(/^[ -~]*$/);
  const piece = fc.oneof(
    fc.nat(mine.length - 1).map((i) => `${NAME}=${mine[i] ?? ""}`),
    fc.tuple(fc.nat(mine.length - 1), fc.nat(200)).map(([i, at]) => `${NAME}=${tamper(mine[i] ?? "A", at)}`),
    fc.nat(foreign.length - 1).map((i) => `${NAME}=${foreign[i] ?? ""}`),
    fc.stringMatching(/^[A-Za-z0-9._-]{0,64}$/).map((t) => `${NAME}=${t}`),
    fc.constant(`${NAME}=${UUID}`),
    fc.tuple(fc.stringMatching(/^[a-z]{1,8}$/), fc.stringMatching(/^[a-z0-9]{0,8}$/)).map(([n, v]) => `x${n}=${v}`),
    fc.constantFrom(" ", ";", "  ;  ", ""),
    printable,
  );
  const header = fc
    .tuple(fc.array(piece, { maxLength: 6 }), fc.constantFrom("; ", ";", " ; "))
    .map(([parts, sep]) => parts.join(sep));
  await fc.assert(
    fc.asyncProperty(fc.oneof(header, printable), async (cookie) => {
      const sent = sentValues(cookie);
      const accepted = new Set(sent.filter((v) => mine.includes(v)).map(hash));
      const rawValues = new Set([...sent, ...mine, ...foreign, cookie].filter((v) => v !== ""));

      a.seen.loader = undefined;
      const r = await a.get(cookie);
      expect(r.status).toBe(200);
      expect(r.headers.get("set-cookie")).toBeNull();
      const rc: string = a.seen.loader ?? "\u0000";
      expect(rc === "" || accepted.has(rc)).toBe(true);
      expect(rawValues.has(rc)).toBe(false);

      a.seen.action = undefined;
      const w = await a.post(cookie);
      expect(w.status).toBe(200);
      const wc = a.seen.action ?? "\u0000";
      const fresh = issued(w);
      if (fresh === undefined) {
        expect(accepted.has(wc)).toBe(true);
      } else {
        expect(wc).toBe(hash(fresh));
        expect(sent.includes(fresh)).toBe(false);
      }
      expect(rawValues.has(wc)).toBe(false);
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("backlog 0159: createApp({ secret }) under 32 UTF-8 bytes rejects with E1556, so no empty or short key signs cookies", async () => {
  for (const secret of ["", "a", "x".repeat(31), "\u00e9".repeat(15)]) {
    const err: unknown = await setup(secret).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(err).toMatchObject({ code: "E1556" });
    expect(err instanceof Error ? err.message : "").toMatch(/^E1556 /);
  }
  await expect(setup("x".repeat(32))).resolves.toBeDefined();
  await expect(setup("\u00e9".repeat(16))).resolves.toBeDefined();
});
