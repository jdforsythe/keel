// @vitest-environment node
import { type SimCtx, createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { createApp } from "@keel/server";
import { describe, expect, it } from "vitest";
import { Credentials } from "../modules/accounts/Credentials.schema.ts";
import { ErrorReply } from "../modules/accounts/ErrorReply.schema.ts";
import { Me } from "../modules/accounts/Me.schema.ts";
import { MintedToken } from "../modules/accounts/MintedToken.schema.ts";
import { SignedIn } from "../modules/accounts/SignedIn.schema.ts";
import { TokenRequest } from "../modules/accounts/TokenRequest.schema.ts";
import { accounts } from "../modules/accounts/accounts.service.ts";
import { accountsApi } from "../modules/accounts/accountsApi.ts";
import { loadAccount } from "../modules/accounts/loadAccount.server.ts";
import { loadMe } from "../modules/accounts/loadMe.server.ts";
import { postToken } from "../modules/accounts/postToken.server.ts";
import { routes as accountRoutes } from "../modules/accounts/routes.ts";
import { submitSignIn } from "../modules/accounts/submitSignIn.server.ts";
import { submitSignUp } from "../modules/accounts/submitSignUp.server.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";
import { apiCtx } from "./simApi.ts";

const EMAIL = "ada@example.com";
const PASSWORD = "correct horse battery";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const Bearer = s.secret(s.string());

/** The real `api` deployable over `server`, keeping every log line it writes (k.server Log). */
async function served(server: SimCtx) {
  const lines: string[] = [];
  const app = await createApp({
    topology,
    routes: apiRoutes,
    ctx: server,
    deployable: "api",
    log: { format: "json", write: (line: string) => lines.push(line) },
  });
  return { app, lines };
}

/** A document form POST, as a browser without JS sends it. */
const formPost = (path: string, fields: Record<string, string>, cookie = ""): Request => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  const headers = new Headers({ accept: "text/html" });
  if (cookie !== "") headers.set("cookie", cookie);
  return new Request(`http://localhost${path}`, { method: "POST", headers, body });
};

/**
 * Sign up and sign in through the pages; the browser's caller cookie comes back. A client sim ctx then sends every
 * `accounts` service call to the app carrying that cookie, as a browser on the app's origin would.
 */
async function signedIn(app: { fetch(req: Request): Promise<Response> }, password = PASSWORD) {
  const up = await app.fetch(formPost("/account/signup", { email: EMAIL, password }));
  expect(up.status).toBe(303);
  const inRes = await app.fetch(formPost("/account/signin", { email: EMAIL, password }));
  expect(inRes.status).toBe(303);
  const cookie = inRes.headers.get("set-cookie")?.split(";")[0] ?? "";
  expect(cookie).not.toBe("");
  const ctx = createCtx({ mode: "sim", seed: 5 });
  ctx.net.route("http://accounts.keel.invalid/api/*", (req) => {
    req.headers.set("cookie", cookie);
    return app.fetch(req);
  });
  return ctx;
}

/** A client sim ctx with no cookie: a caller that never signed in. */
function stranger(app: { fetch(req: Request): Promise<Response> }) {
  const ctx = createCtx({ mode: "sim", seed: 6 });
  ctx.net.route("http://accounts.keel.invalid/api/*", (req) => app.fetch(req));
  return ctx;
}

const bearerOf = (token: string) => {
  const b = Bearer.parse(token);
  if (!b.ok) throw new Error("token does not parse as a secret");
  return b.value;
};

describe("API tokens", () => {
  it("mints a token for a signed-in caller that /api/me accepts until it expires", async () => {
    const server = apiCtx(21);
    const { app, lines } = await served(server);
    const client = await signedIn(app);

    const minted = await accountsApi.mint({ body: {} }, client);
    expect(minted.ok).toBe(true);
    if (!minted.ok) return;
    const { token, id, expiresAt } = minted.value;
    expect(token.startsWith(`keelsim_${id}_`)).toBe(true);
    expect(expiresAt).toBe(server.clock.now() + THIRTY_DAYS);

    const me = await accountsApi.me({ bearer: bearerOf(token) }, client);
    expect(me).toEqual({ ok: true, value: { email: EMAIL } });

    const last = token.at(-1) === "0" ? "1" : "0";
    const tampered = await accountsApi.me({ bearer: bearerOf(`${token.slice(0, -1)}${last}`) }, client);
    expect(tampered.ok ? null : tampered.error).toMatchObject({
      code: "api.status",
      data: { status: 403, body: { code: "keel.denied", message: "Unknown token" } },
    });

    server.clock.advance(THIRTY_DAYS - 1);
    expect((await accountsApi.me({ bearer: bearerOf(token) }, client)).ok).toBe(true);
    server.clock.advance(2);
    const expired = await accountsApi.me({ bearer: bearerOf(token) }, client);
    expect(expired.ok ? null : expired.error).toMatchObject({
      code: "api.status",
      data: { status: 403, body: { code: "keel.denied", message: "Token expired" } },
    });

    const stored = (await server.storage.get("keel.store.accounts.tokens")) ?? "";
    expect(stored).toContain(id);
    expect(stored).toContain("$sha256-sim$");
    expect(stored).not.toContain(token);

    const log = lines.join("\n");
    expect(lines.length).toBeGreaterThan(0);
    expect(log).not.toContain(PASSWORD);
    expect(log).not.toContain(token);
  });

  it("denies /api/me with no token and minting to a caller that never signed in", async () => {
    const server = apiCtx(22);
    const { app } = await served(server);
    const client = stranger(app);
    const none = await accountsApi.me({}, client);
    expect(none.ok ? null : none.error).toMatchObject({
      code: "api.status",
      data: { status: 403, body: { code: "keel.denied", message: "No token" } },
    });
    const refused = await accountsApi.mint({ body: {} }, client);
    const body = refused.ok ? null : refused.error.code === "api.status" ? refused.error.data.body : null;
    expect(ErrorReply.parse(body).ok).toBe(true);
    expect(refused.ok ? null : refused.error).toMatchObject({
      code: "api.status",
      data: { status: 403, body: { code: "keel.denied" } },
    });
  });

  it("logs neither the password nor the attempt's text on a failed sign-in", async () => {
    const server = apiCtx(23);
    const { app, lines } = await served(server);
    await signedIn(app);
    const wrong = await app.fetch(formPost("/account/signin", { email: EMAIL, password: "a wrong password" }));
    expect(wrong.status).toBe(400);
    const html = await wrong.text();
    expect(html).toContain("Wrong email or password");
    expect(html).not.toContain("a wrong password");
    const log = lines.join("\n");
    expect(log).not.toContain(PASSWORD);
    expect(log).not.toContain("a wrong password");
  });
});

describe("accounts wiring", () => {
  it("serves the pages with loadAccount and /api/me with loadMe", () => {
    expect(accountRoutes.routes["accounts.signin"].loader).toBe(loadAccount);
    expect(accountRoutes.routes["accounts.signup"].loader).toBe(loadAccount);
    expect(accountRoutes.routes["accounts.me"].loader).toBe(loadMe);
    expect(loadMe.output).toBe(Me);
    expect(loadAccount.output).toBe(SignedIn);
  });

  it("gives the API action an output and the page actions none, all taking Credentials or TokenRequest", () => {
    expect(postToken.input).toBe(TokenRequest);
    expect(postToken.output).toBe(MintedToken);
    expect(submitSignIn.input).toBe(Credentials);
    expect(submitSignUp.input).toBe(Credentials);
    expect(submitSignIn.output).toBeUndefined();
    expect(submitSignUp.output).toBeUndefined();
  });

  it("the accounts endpoints name the two API routes' paths and answers", () => {
    expect([accounts.mint.method, accounts.mint.path, accounts.mint.output]).toEqual([
      "POST",
      "/api/tokens",
      MintedToken,
    ]);
    expect([accounts.me.method, accounts.me.path, accounts.me.output]).toEqual(["GET", "/api/me", Me]);
  });
});
