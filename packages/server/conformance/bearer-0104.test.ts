// @vitest-environment node
// Spec: k.api, Bearer "An API route's guard, loader and action get `bearer: Secret<string> | undefined` beside `caller`, from the `authorization` header; a page's action has none, and a page's guard and loader get `undefined`."
// Spec: k.api, Bearer "The header's value, less leading and trailing whitespace, is the scheme `Bearer` in any letter case, one or more spaces, then 1 to 4,096 characters of `A-Z a-z 0-9 - . _ ~ + /` and any trailing `=`."
// Spec: k.api, Bearer "Anything else is `undefined`: no header, another scheme, an empty or longer token, a space inside it, or two headers (joined by `, `); it is no error and is not logged."
// Spec: k.api, Bearer "The token is a `Secret` before app code runs (k.privacy)."
// Spec: k.api, Bearer "`bearer` and `caller` are independent: neither reads the other's header, and the same-site check of a write is unchanged."
// Spec: k.api, Bearer "A response to a request carrying `authorization` is `Cache-Control: no-store`."
// Spec: k.api, Conformance "With `authorization` `Bearer abc`, `bearer abc` or `BEARER  abc=`, an API route's guard, loader and action get a `bearer` revealing `abc` (`abc=`); with `Basic abc`, `Bearer`, `Bearer a b`, a 4,097-character token or two headers, `undefined`; on a page, `undefined`."
// Spec: k.api, Conformance "A GET to an API route with `authorization` answers `cache-control: no-store`."
// Spec: k.guards, Guards "`caller` is k.server's `caller` (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route)."
// Spec: k.privacy, Sinks "An action's `output` counts as a loader's, and `bearer` (k.api) as a `Secret` input."
// Spec: k.privacy, Conformance "An API action throwing the revealed `bearer` logs `[secret]` in its place."
// Spec: k.hosting, Allowed origins "`OPTIONS` with `access-control-request-method`: 204 with `access-control-allow-origin` (that origin), `access-control-allow-methods` (the route's methods), `access-control-allow-headers: accept, authorization, content-type, x-keel`, `access-control-allow-credentials: true`, `access-control-max-age: 600` and `vary: origin`; no guard, loader or action runs."
// Seed: 1337.
// The parse table is the bearer grammar of k.api: scheme `bearer` in any case, one or more spaces, token68 of 1 to 4,096 characters, then `=*`.
// `Headers.get` joins two headers with `, ` and trims each value, so a value ending in a space reads as the trimmed one.
import { createHash } from "node:crypto";
import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
import { err, ok, reveal, s } from "@keel/schema";
import type { Secret } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createAppLoose, liveLoader, readChunks } from "./topology-fixtures.ts";

const SECRET = "conformance-secret-bearer-0123456789abcdef0123456789abcdef";
const ALLOWED = "https://app.test";
const NAME = "keel-caller";
const Nothing = s.object({});
const Who = s.object({ caller: s.string() });
const Denied = s.error("keel.denied", s.object({}));

const bearers = new Map<string, Secret<string> | undefined>();
const forms = new Map<string, string>();
const callers = new Map<string, string>();
const seen = (where: string, b: Secret<string> | undefined, caller: string): void => {
  bearers.set(where, b);
  callers.set(where, caller);
  forms.set(where, b === undefined ? "undefined" : `${String(b)}|${JSON.stringify(b)}`);
};
const revealed = (where: string): string | undefined => {
  const b = bearers.get(where);
  return b === undefined ? undefined : reveal(b);
};
const reset = (): void => {
  bearers.clear();
  forms.clear();
  callers.clear();
};

const apiGuard = guard({}, async ({ bearer, caller }) => {
  seen("api.guard", bearer, caller);
  return ok(null);
});
const apiLoad = loader({ output: Nothing }, async ({ bearer, caller }) => {
  seen("api.loader", bearer, caller);
  return ok({});
});
const apiWrite = action({ input: Nothing, output: Who }, async (_input, { bearer, caller }) => {
  seen("api.action", bearer, caller);
  return ok({ caller });
});
const apiBoom = action({ input: Nothing, output: Nothing }, async (_input, { bearer }) => {
  if (bearer !== undefined) throw new Error(`t=${reveal(bearer)}`);
  return ok({});
});
const apiDeny = guard({}, async ({ bearer }) => {
  seen("deny.guard", bearer, "");
  return err(Denied.make({}));
});
const denyRead = loader({ output: Nothing }, async () => {
  seen("deny.loader", undefined, "");
  return ok({});
});
const denyWrite = action({ input: Nothing, output: Nothing }, async () => {
  seen("deny.action", undefined, "");
  return ok({});
});
const live = liveLoader(Nothing, async function* (args: { bearer: Secret<string> | undefined }) {
  seen("live.loader", args.bearer, "");
  yield ok({});
});
const pageGuard = guard({ redirect: "app.login" }, async ({ bearer, caller }) => {
  seen("page.guard", bearer, caller);
  return ok(null);
});
const pageLoad = loader({ output: Nothing }, async ({ bearer, caller }) => {
  seen("page.loader", bearer, caller);
  return ok({});
});
const pageWrite = action({ input: Nothing }, async () => ok(null));
const view = (): Node => document.createElement("main");

async function boot(mode: "dev" | "production", lines?: string[]) {
  const routes = manifest({
    "api.who": { api: true, path: "/api/who", guard: apiGuard, loader: apiLoad },
    "api.boom": { api: true, path: "/api/boom" },
    "api.live": { api: true, path: "/api/live", loader: live },
    "api.denied": { api: true, path: "/api/denied", guard: apiDeny, loader: denyRead },
    "app.page": { path: "/page", guard: pageGuard, loader: pageLoad, component: view },
    "app.login": { path: "/login", component: view },
  });
  routes.actions({
    "api.who": { POST: apiWrite },
    "api.boom": { POST: apiBoom },
    "api.denied": { POST: denyWrite },
    "app.page": { POST: pageWrite },
  });
  return createAppLoose({
    topology: topology({ web: { modules: ["api", "app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    secret: SECRET,
    allow: [ALLOWED],
    ...(lines === undefined ? {} : { log: { format: "json", write: (l: string) => void lines.push(l) } }),
  });
}

type Auth = string | readonly string[] | undefined;
function request(method: "GET" | "POST", path: string, auth: Auth, extra: Record<string, string> = {}): Request {
  const h = new Headers({ accept: "application/json", ...extra });
  if (method === "POST") {
    h.set("content-type", "application/json");
    h.set("origin", "http://localhost");
    h.set("x-keel", "1");
  }
  if (typeof auth === "string") h.append("authorization", auth);
  else if (auth !== undefined) for (const v of auth) h.append("authorization", v);
  return new Request(`http://localhost${path}`, { method, headers: h, ...(method === "POST" ? { body: "{}" } : {}) });
}
const issued = (res: Response): string | undefined => {
  const header = res.headers.get("set-cookie");
  const first = (header ?? "").split(";")[0] ?? "";
  return first.startsWith(`${NAME}=`) ? first.slice(NAME.length + 1) : undefined;
};
const hashOf = (value: string): string => createHash("sha256").update(value).digest("base64url");
const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~+/".split("");
const tokenArb = (min: number, max: number): fc.Arbitrary<string> =>
  fc.array(fc.constantFrom(...ALPHA), { minLength: min, maxLength: max }).map((cs) => cs.join(""));
const caseArb = fc
  .array(fc.boolean(), { minLength: 6, maxLength: 6 })
  .map((up) => [..."bearer"].map((c, i) => (up[i] ? c.toUpperCase() : c)).join(""));
const hex = (n: number): string => "0123456789abcdef".repeat(Math.ceil(n / 16)).slice(0, n);
const LONG = "a".repeat(4097);

/** Rows of the parse table: the header(s) sent and what a handler reveals. */
const TABLE: readonly { readonly auth: Auth; readonly want: string | undefined }[] = [
  { auth: undefined, want: undefined },
  { auth: "Bearer abc", want: "abc" },
  { auth: "bearer abc", want: "abc" },
  { auth: "BEARER   abc", want: "abc" },
  { auth: "Bearer abc==", want: "abc==" },
  { auth: "BEARER  abc=", want: "abc=" },
  { auth: `Bearer keel_${hex(16)}_${hex(64)}`, want: `keel_${hex(16)}_${hex(64)}` },
  { auth: "Bearer", want: undefined },
  { auth: "Bearer ", want: undefined },
  { auth: "Bearer a b", want: undefined },
  { auth: "Bearer a,b", want: undefined },
  { auth: "Bearer a\tb", want: undefined },
  { auth: `Bearer ${"a".repeat(4096)}`, want: "a".repeat(4096) },
  { auth: `Bearer ${LONG}`, want: undefined },
  { auth: "Basic YWxhZGRpbg==", want: undefined },
  { auth: "Basic abc", want: undefined },
  { auth: "Token abc", want: undefined },
  { auth: "Bearerabc", want: undefined },
  { auth: ["Bearer a", "Bearer b"], want: undefined },
];

async function drain(res: Response): Promise<void> {
  await res.text();
}

describe("k.api bearer", () => {
  it("With `authorization` `Bearer abc`, `bearer abc` or `BEARER  abc=`, an API route's guard, loader and action get a `bearer` revealing `abc` (`abc=`); with `Basic abc`, `Bearer`, `Bearer a b`, a 4,097-character token or two headers, `undefined`; on a page, `undefined`.", async () => {
    const app = await boot("production");
    for (const row of TABLE) {
      reset();
      await drain(await app.fetch(request("GET", "/api/who", row.auth)));
      await drain(await app.fetch(request("POST", "/api/who", row.auth)));
      for (const where of ["api.guard", "api.loader", "api.action"]) {
        expect(bearers.has(where), `${where} ran for ${JSON.stringify(row.auth)}`).toBe(true);
        expect(revealed(where), `${where} for ${JSON.stringify(row.auth)}`).toBe(row.want);
      }
      reset();
      await drain(await app.fetch(request("GET", "/page", row.auth)));
      expect(bearers.has("page.guard")).toBe(true);
      expect(bearers.has("page.loader")).toBe(true);
      expect(bearers.get("page.guard")).toBeUndefined();
      expect(bearers.get("page.loader")).toBeUndefined();
    }
  });

  it("An API route's guard, loader and action get `bearer: Secret<string> | undefined` beside `caller`, from the `authorization` header; a page's action has none, and a page's guard and loader get `undefined`.", async () => {
    const app = await boot("production");
    reset();
    await drain(await app.fetch(request("GET", "/api/who", "Bearer abc")));
    await drain(await app.fetch(request("POST", "/api/who", "Bearer abc")));
    for (const where of ["api.guard", "api.loader", "api.action"]) {
      expect(callers.has(where)).toBe(true);
      expect(revealed(where)).toBe("abc");
      expect(forms.get(where)).toBe('[secret]|"[secret]"');
    }
    reset();
    await drain(await app.fetch(request("GET", "/page", "Bearer abc")));
    expect(bearers.get("page.guard")).toBeUndefined();
    expect(bearers.get("page.loader")).toBeUndefined();
    reset();
    const stream = await app.fetch(request("GET", "/api/live", "Bearer abc", { accept: "text/event-stream" }));
    await readChunks(stream, 1);
    expect(bearers.has("live.loader")).toBe(true);
    expect(revealed("live.loader")).toBe("abc");
  });

  it("The header's value, less leading and trailing whitespace, is the scheme `Bearer` in any letter case, one or more spaces, then 1 to 4,096 characters of `A-Z a-z 0-9 - . _ ~ + /` and any trailing `=`.", async () => {
    const app = await boot("production");
    await fc.assert(
      fc.asyncProperty(
        caseArb,
        fc.integer({ min: 1, max: 5 }),
        tokenArb(1, 4096),
        fc.integer({ min: 0, max: 3 }),
        async (scheme, spaces, body, eqs) => {
          const token = body + "=".repeat(eqs);
          reset();
          await drain(await app.fetch(request("GET", "/api/who", `${scheme}${" ".repeat(spaces)}${token}`)));
          await drain(await app.fetch(request("POST", "/api/who", `${scheme}${" ".repeat(spaces)}${token}`)));
          for (const where of ["api.guard", "api.loader", "api.action"]) expect(revealed(where)).toBe(token);
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("Anything else is `undefined`: no header, another scheme, an empty or longer token, a space inside it, or two headers (joined by `, `); it is no error and is not logged.", async () => {
    const lines: string[] = [];
    const app = await boot("dev", lines);
    const inner = fc
      .tuple(tokenArb(1, 20), fc.constantFrom(" ", ",", "\t"), tokenArb(1, 20))
      .map(([a, sep, b]) => a + sep + b);
    await fc.assert(
      fc.asyncProperty(fc.oneof(inner, tokenArb(4097, 5000)), async (token) => {
        reset();
        lines.length = 0;
        const get = await app.fetch(request("GET", "/api/who", `Bearer ${token}`));
        const post = await app.fetch(request("POST", "/api/who", `Bearer ${token}`));
        expect(get.status).toBe(200);
        expect(post.status).toBe(200);
        await drain(get);
        await drain(post);
        for (const where of ["api.guard", "api.loader", "api.action"]) {
          expect(bearers.has(where)).toBe(true);
          expect(revealed(where)).toBeUndefined();
        }
        for (const line of lines) {
          const rec: unknown = JSON.parse(line);
          expect(field(rec, "kind")).not.toBe("diag");
          expect(line).not.toContain(token);
        }
      }),
      { seed: SEED, numRuns: 25 },
    );
    for (const row of TABLE.filter((r) => r.want === undefined)) {
      reset();
      const res = await app.fetch(request("GET", "/api/who", row.auth));
      expect(res.status).toBe(200);
      await drain(res);
    }
  });

  it("The token is a `Secret` before app code runs (k.privacy).", async () => {
    const app = await boot("production");
    await fc.assert(
      fc.asyncProperty(tokenArb(1, 64), async (token) => {
        reset();
        await drain(await app.fetch(request("GET", "/api/who", `Bearer ${token}`)));
        await drain(await app.fetch(request("POST", "/api/who", `Bearer ${token}`)));
        for (const where of ["api.guard", "api.loader", "api.action"]) {
          expect(forms.get(where)).toBe('[secret]|"[secret]"');
          expect(revealed(where)).toBe(token);
        }
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`bearer` and `caller` are independent: neither reads the other's header, and the same-site check of a write is unchanged.", async () => {
    const app = await boot("production");
    reset();
    const first = await app.fetch(request("POST", "/api/who", "Bearer abc"));
    expect(first.status).toBe(200);
    const cookie = issued(first);
    if (cookie === undefined || cookie === "")
      throw new Error("a write with a bearer and no cookie set no caller cookie");
    const firstBody: unknown = await first.json();
    expect(field(field(firstBody, "value"), "caller")).toBe(hashOf(cookie));
    expect(field(field(firstBody, "value"), "caller")).not.toBe("");
    expect(revealed("api.action")).toBe("abc");

    reset();
    const second = await app.fetch(request("POST", "/api/who", "Bearer abc", { cookie: `${NAME}=${cookie}` }));
    expect(second.status).toBe(200);
    const secondBody: unknown = await second.json();
    expect(field(field(secondBody, "value"), "caller")).toBe(hashOf(cookie));
    expect(revealed("api.action")).toBe("abc");

    reset();
    const bare = await app.fetch(request("POST", "/api/who", undefined, { cookie: `${NAME}=${cookie}` }));
    const bareBody: unknown = await bare.json();
    expect(field(field(bareBody, "value"), "caller")).toBe(hashOf(cookie));
    expect(revealed("api.action")).toBeUndefined();

    reset();
    const cross = await app.fetch(
      new Request("http://localhost/api/who", {
        method: "POST",
        body: "{}",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          origin: "https://evil.test",
          "sec-fetch-site": "cross-site",
          authorization: "Bearer abc",
        },
      }),
    );
    const crossBody: unknown = await cross.json();
    expect(field(field(crossBody, "error"), "code")).toBe("keel.denied");
    expect(cross.status).toBe(403);
    expect(bearers.size).toBe(0);
  });

  it("A GET to an API route with `authorization` answers `cache-control: no-store`.", async () => {
    const app = await boot("production");
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...TABLE.map((r) => r.auth).filter((a) => a !== undefined)), async (auth) => {
        const res = await app.fetch(request("GET", "/api/who", auth));
        expect(res.headers.get("cache-control")).toContain("no-store");
        await drain(res);
      }),
      { seed: SEED, numRuns: 25 },
    );
    const without = await app.fetch(request("GET", "/api/who", undefined));
    expect(without.headers.get("cache-control") ?? "").not.toContain("no-store");
    await drain(without);
  });

  it("A response to a request carrying `authorization` is `Cache-Control: no-store`.", async () => {
    const app = await boot("production");
    for (const [method, path] of [
      ["GET", "/api/who"],
      ["POST", "/api/who"],
      ["GET", "/api/denied"],
      ["POST", "/api/denied"],
    ] as const) {
      for (const auth of ["Bearer abc", "Basic abc", "Bearer a b"]) {
        const res = await app.fetch(request(method, path, auth));
        expect(res.headers.get("cache-control"), `${method} ${path} ${auth}`).toContain("no-store");
        await drain(res);
      }
    }
  });

  it("`caller` is k.server's `caller` (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route).", async () => {
    const app = await boot("production");
    reset();
    await drain(await app.fetch(request("GET", "/page", "Bearer abc")));
    expect(bearers.get("page.guard")).toBeUndefined();
    expect(callers.get("page.guard")).toBe("");
    reset();
    await drain(await app.fetch(request("GET", "/api/who", "Bearer abc")));
    expect(revealed("api.guard")).toBe("abc");
    expect(callers.get("api.guard")).toBe("");
  });

  for (const mode of ["dev", "production"] as const) {
    it(`An API action throwing the revealed \`bearer\` logs \`[secret]\` in its place, in ${mode}: no log line holds the token in any form \`scrubbed\` matches. An action's \`output\` counts as a loader's, and \`bearer\` (k.api) as a \`Secret\` input.`, async () => {
      const token = "ab+c/d-e.f_g~h==";
      const tokenForms = [token, encodeURIComponent(token), JSON.stringify(token).slice(1, -1), btoa(token)];
      const lines: string[] = [];
      const app = await boot(mode, lines);
      const res = await app.fetch(request("POST", "/api/boom", `Bearer ${token}`));
      expect(res.status).toBe(500);
      await drain(res);
      const diags = lines.filter((l) => field(JSON.parse(l), "kind") === "diag");
      expect(diags.length).toBeGreaterThan(0);
      for (const line of diags) expect(line).toContain("[secret]");
      for (const line of lines) for (const form of tokenForms) expect(line).not.toContain(form);
    });
  }

  it("`OPTIONS` with `access-control-request-method`: 204 with `access-control-allow-origin` (that origin), `access-control-allow-methods` (the route's methods), `access-control-allow-headers: accept, authorization, content-type, x-keel`, `access-control-allow-credentials: true`, `access-control-max-age: 600` and `vary: origin`; no guard, loader or action runs.", async () => {
    const app = await boot("production");
    reset();
    const res = await app.fetch(
      new Request("http://localhost/api/who", {
        method: "OPTIONS",
        headers: { origin: ALLOWED, "access-control-request-method": "POST" },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED);
    const tokens = (v: string | null): string[] => (v ?? "").split(",").map((t) => t.trim().toLowerCase());
    expect(tokens(res.headers.get("access-control-allow-headers"))).toEqual([
      "accept",
      "authorization",
      "content-type",
      "x-keel",
    ]);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("access-control-max-age")).toBe("600");
    expect(tokens(res.headers.get("vary"))).toContain("origin");
    expect(bearers.size).toBe(0);
  });
});
