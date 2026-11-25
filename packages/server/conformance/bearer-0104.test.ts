// @vitest-environment node
// k.api, Bearer "An API route's guard, loader and action get `bearer: Secret<string> | undefined` beside `caller`, from the `authorization` header; a page's action has none, and a page's guard and loader get `undefined`."
// k.api, Bearer "The header's value, less leading and trailing spaces and tabs, is the scheme `Bearer` in any letter case, one or more spaces, then 1 to 4,096 characters of `A-Z a-z 0-9 - . _ ~ + /` and any trailing `=`."
// k.api, Bearer "Anything else is `undefined`: no header, another scheme, an empty or longer token, a space inside it, or two headers (joined by `, `); it is no error and is not logged."
// k.api, Calling "a guard `redirect` naming one is E1508 at the first read of the table"
// Spec: k.api, clause "A denying guard with a `redirect` answers 403 `keel.denied` and no `Location`."
// k.server, Log "`diag` per diagnostic or uncaught throw (personal data dropped, k.privacy"
// k.api, Bearer "The token is a `Secret` before app code runs (k.privacy)."
// k.api, Bearer "`bearer` and `caller` are independent: neither reads the other's header, and the same-site check of a write is unchanged."
// k.api, Bearer "A response to a request carrying `authorization` is `Cache-Control: no-store`."
// Spec: k.api, clause "With `authorization` `Bearer abc`, `bearer abc` or `BEARER  abc=`, an API route's guard, loader and action get a `bearer` revealing `abc` (`abc=`); with `Basic abc`, `Bearer`, `Bearer a b`, a 4,097-character token or two headers, `undefined`; on a page, `undefined`."
// Spec: k.api, clause "A GET to an API route with `authorization` answers `cache-control: no-store`."
// k.guards, Guards "`caller` and `user` are k.server's and k.user's (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route; a redirect hop's guards get none)."
// k.privacy, Sinks "Each string, number and key but a declared field name (not a boolean) in a `Secret` made or revealed while the request runs (`bearer` too) becomes `[secret]`."
// Spec: k.privacy, clause "An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, as does a loader or action throwing one parsed after an `await` or made earlier and revealed in it, a record or `json` key in one, and a runner's; a boolean or declared field name logs as is; of two overlapping requests each marks only its own."
// k.hosting, Allowed origins "`OPTIONS` with `access-control-request-method`: 204 with `access-control-allow-origin` (that origin), `access-control-allow-methods` (the route's methods), `access-control-allow-headers: accept, authorization, content-type, x-keel`, `access-control-allow-credentials: true`, `access-control-max-age: 600` and `vary: origin`; no guard, loader or action runs."
// Seed: 1337.
// A guard `redirect` cannot name an API route (E1508), so a redirect hop to a second API route is asserted as the spec says: the table refuses it, and no second guard sees a bearer.
// The parse table is the bearer grammar of k.api: scheme `bearer` in any case, one or more spaces, token68 of 1 to 4,096 characters, then `=*`.
// `Headers.get` joins two headers with `, ` and trims each value, so a value ending in a space reads as the trimmed one.
import { createHash } from "node:crypto";
import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, reveal, s } from "@keel/schema";
import type { Secret } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
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
const users = new Map<string, string>();
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
  users.clear();
};

const apiContract = contract("api", {
  "api.getWho": { method: "GET", path: "/api/who", output: Nothing },
  "api.postWho": { method: "POST", path: "/api/who", body: Nothing, output: Who },
  "api.boom": { method: "POST", path: "/api/boom", body: Nothing, output: Nothing },
  "api.live": { method: "GET", path: "/api/live", events: true, output: Nothing },
  "api.getDenied": { method: "GET", path: "/api/denied", output: Nothing },
  "api.postDenied": { method: "POST", path: "/api/denied", body: Nothing, output: Nothing },
  "api.liveboom": { method: "GET", path: "/api/liveboom", events: true, output: Nothing },
  "api.guardboom": { method: "GET", path: "/api/guardboom", output: Nothing },
});
const appContract = contract("app", {
  "app.page": { path: "/page" },
  "app.login": { path: "/login" },
});
const hopContract = contract("hop", {
  "hop.first": { method: "GET", path: "/api/hop-first", output: Nothing },
  "hop.second": { method: "GET", path: "/api/hop-second", output: Nothing },
});
const apiGuard = guard({}, async ({ bearer, caller, user }) => {
  seen("api.guard", bearer, caller);
  users.set("api.guard", user);
  return ok(null);
});
const apiLoadWho = loader(apiContract, "api.getWho", {}, async ({ bearer, caller }) => {
  seen("api.loader", bearer, caller);
  return ok({});
});
const apiLoadBoom = loader(apiContract, "api.guardboom", {}, async ({ bearer, caller }) => {
  seen("api.loader", bearer, caller);
  return ok({});
});
const apiWrite = action(apiContract, "api.postWho", {}, async (_input, { bearer, caller }) => {
  seen("api.action", bearer, caller);
  return ok({ caller });
});
const apiBoom = action(apiContract, "api.boom", {}, async (_input, { bearer }) => {
  if (bearer !== undefined) throw new Error(`t=${reveal(bearer)}`);
  return ok({});
});
const apiDeny = guard({}, async ({ bearer }) => {
  seen("deny.guard", bearer, "");
  return err(Denied.make({}));
});
const denyRead = loader(apiContract, "api.getDenied", {}, async () => {
  seen("deny.loader", undefined, "");
  return ok({});
});
const denyWrite = action(apiContract, "api.postDenied", {}, async () => {
  seen("deny.action", undefined, "");
  return ok({});
});
const live = liveLoader(apiContract, "api.live", async function* (args: { bearer: Secret<string> | undefined }) {
  seen("live.loader", args.bearer, "");
  yield ok({});
});
const liveBoom = liveLoader(
  apiContract,
  "api.liveboom",
  async function* (args: { bearer: Secret<string> | undefined }) {
    if (args.bearer !== undefined) throw new Error(`live ${reveal(args.bearer)}`);
    yield ok({});
  },
);
const guardBoom = guard({}, async ({ bearer }) => {
  if (bearer !== undefined) throw new Error(`guard ${reveal(bearer)}`);
  return ok(null);
});
const hopGuard = guard({ redirect: "hop.second" }, async ({ bearer }) => {
  seen("hop.first", bearer, "");
  return err(Denied.make({}));
});
const secondGuard = guard({}, async ({ bearer }) => {
  seen("hop.second", bearer, "");
  return ok(null);
});
const pageGuard = guard({ redirect: "app.login" }, async ({ bearer, caller, user }) => {
  seen("page.guard", bearer, caller);
  users.set("page.guard", user);
  return ok(null);
});
const pageLoad = loader(appContract, "app.page", { output: Nothing }, async ({ bearer, caller }) => {
  seen("page.loader", bearer, caller);
  return ok({});
});
const pageWrite = action(appContract, "app.page", { input: Nothing }, async () => ok(null));
const view = (): Node => document.createElement("main");

async function boot(mode: "dev" | "production", lines?: string[]) {
  const routes = routeTable(
    manifest(apiContract, {
      "api.getWho": { guard: apiGuard, loader: apiLoadWho },
      "api.postWho": { action: apiWrite, guard: apiGuard },
      "api.boom": { action: apiBoom },
      "api.live": { loader: live },
      "api.getDenied": { guard: apiDeny, loader: denyRead },
      "api.postDenied": { action: denyWrite, guard: apiDeny },
      "api.liveboom": { loader: liveBoom },
      "api.guardboom": { guard: guardBoom, loader: apiLoadBoom },
    }),
    manifest(appContract, {
      "app.page": { guard: pageGuard, loader: pageLoad, component: view, POST: pageWrite },
      "app.login": { component: view },
    }),
  );
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

  it("The header's value, less leading and trailing spaces and tabs, is the scheme `Bearer` in any letter case, one or more spaces, then 1 to 4,096 characters of `A-Z a-z 0-9 - . _ ~ + /` and any trailing `=`.", async () => {
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

  it("`caller` and `user` are k.server's and k.user's (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route; a redirect hop's guards get none).", async () => {
    const app = await boot("production");
    reset();
    await drain(await app.fetch(request("GET", "/page", "Bearer abc")));
    expect(bearers.get("page.guard")).toBeUndefined();
    expect(callers.get("page.guard")).toBe("");
    expect(users.get("page.guard")).toBe("");
    reset();
    await drain(await app.fetch(request("GET", "/api/who", "Bearer abc")));
    expect(revealed("api.guard")).toBe("abc");
    expect(callers.get("api.guard")).toBe("");
    expect(users.get("api.guard")).toBe("");
  });

  for (const mode of ["dev", "production"] as const) {
    it(`An action throwing the revealed value of a \`Secret\` input or \`bearer\`, as a string or in an \`Error\` message, logs a \`diag\` record holding \`[secret]\` and not the value, in ${mode}: an API action throwing the revealed \`bearer\`, no line holding the token in any form \`scrubbed\` matches.`, async () => {
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

  it("The header's value, less leading and trailing spaces and tabs, is the scheme `Bearer`: a space or tab around the value is stripped, and a no-break space, vertical tab or form feed before or after the token, inside it or in place of the separating space gives `undefined`.", async () => {
    const app = await boot("production");
    const edge = fc.string({ unit: fc.constantFrom(" ", "\t"), maxLength: 4 });
    await fc.assert(
      fc.asyncProperty(edge, edge, tokenArb(1, 30), async (lead, trail, token) => {
        reset();
        await drain(await app.fetch(request("GET", "/api/who", `${lead}Bearer ${token}${trail}`)));
        await drain(await app.fetch(request("POST", "/api/who", `${lead}Bearer ${token}${trail}`)));
        for (const where of ["api.guard", "api.loader", "api.action"]) expect(revealed(where)).toBe(token);
      }),
      { seed: SEED, numRuns: 25 },
    );
    const odd = ["\u00a0", "\u000b", "\u000c"] as const;
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...odd), tokenArb(1, 10), tokenArb(1, 10), async (ws, a, b) => {
        for (const auth of [`Bearer ${a}${ws}${b}`, `Bearer${ws}${a}`, `${ws}Bearer ${a}`, `Bearer ${a}${ws}`]) {
          reset();
          await drain(await app.fetch(request("GET", "/api/who", auth)));
          await drain(await app.fetch(request("POST", "/api/who", auth)));
          for (const where of ["api.guard", "api.loader", "api.action"]) {
            expect(bearers.has(where)).toBe(true);
            expect(revealed(where), `${where} for ${JSON.stringify(auth)}`).toBeUndefined();
          }
        }
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("An uncaught throw of a live loader on an API route, whose message holds the revealed `bearer`, logs no line holding the token in any form, and writes nothing to `console.error`.", async () => {
    const token = "ab+c/d-e.f_g~h==";
    const tokenForms = [token, encodeURIComponent(token), JSON.stringify(token).slice(1, -1), btoa(token)];
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      for (const mode of ["dev", "production"] as const) {
        const lines: string[] = [];
        const app = await boot(mode, lines);
        for (const accept of ["application/json", "text/event-stream"]) {
          const res = await app.fetch(request("GET", "/api/liveboom", `Bearer ${token}`, { accept }));
          const body = await res.text();
          if (mode === "production") for (const form of tokenForms) expect(body).not.toContain(form);
        }
        for (const line of lines) for (const form of tokenForms) expect(line, `${mode}: ${line}`).not.toContain(form);
        expect(lines.some((l) => l.includes("[secret]"))).toBe(true);
      }
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("An uncaught throw of a guard on an API route, whose message holds the revealed `bearer`, leaves the dev response body without the token.", async () => {
    await fc.assert(
      fc.asyncProperty(tokenArb(8, 40), async (token) => {
        const lines: string[] = [];
        const app = await boot("dev", lines);
        for (const method of ["GET", "POST"] as const) {
          const res = await app.fetch(request(method, "/api/guardboom", `Bearer ${token}`));
          const body = await res.text();
          for (const form of [token, encodeURIComponent(token), btoa(token)]) expect(body).not.toContain(form);
        }
        for (const line of lines)
          for (const form of [token, encodeURIComponent(token), btoa(token)]) expect(line).not.toContain(form);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("`bearer` is k.api's (`undefined` off an API route; a redirect hop's guards get none): an API guard's `redirect` naming a second API route is E1508, and the second route's guard sees no bearer.", async () => {
    reset();
    const attempt = async (): Promise<void> => {
      const hopFirst = loader(hopContract, "hop.first", {}, async () => {
        seen("hop.loader", undefined, "");
        return ok({});
      });
      const hopSecond = loader(hopContract, "hop.second", {}, async () => {
        seen("hop.loader", undefined, "");
        return ok({});
      });
      const routes = manifest(hopContract, {
        "hop.first": { guard: hopGuard, loader: hopFirst },
        "hop.second": { guard: secondGuard, loader: hopSecond },
      });
      const app = await createAppLoose({
        topology: topology({ web: { modules: ["hop"], adapter: "node" } }),
        routes,
        ctx: createCtx({ mode: "sim", seed: SEED }),
        mode: "production",
        secret: SECRET,
      });
      const res = await app.fetch(request("GET", "/api/hop-first", "Bearer abc"));
      expect(res.status).toBe(403);
      expect(res.headers.get("location")).toBeNull();
      await drain(res);
    };
    let thrown: unknown;
    try {
      await attempt();
    } catch (e) {
      thrown = e;
    }
    expect(String(thrown)).toContain("E1508");
    expect(bearers.get("hop.second")).toBeUndefined();
    expect(bearers.has("hop.second")).toBe(false);
  });

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
