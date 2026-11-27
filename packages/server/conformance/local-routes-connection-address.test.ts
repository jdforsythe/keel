// @vitest-environment happy-dom
// Spec: k.contract, clause "`fetch` of that `GET` with `Host: 127.0.0.1:<port>`, `Sec-Fetch-Site: none` and a connection whose remote address is `::ffff:127.0.0.1` answers the page; with remote address `10.0.0.5` and `X-Forwarded-For: 127.0.0.1` it answers 403 `keel.denied`."
// k.contract Local routes: "`createApp`'s `fetch(request, connection?)` reads the remote address from `connection.incoming.socket.remoteAddress`, the shape `@hono/node-server` passes; `server.mjs` and `keel dev` pass each request's own, an IPv4-mapped loopback (`::ffff:127.0.0.1`) is loopback, and no forwarding header (`X-Forwarded-For`, `Forwarded`) is read, whatever proxy setting is in force."
// Seed: n/a (three fixed connections). Method (happy-dom, whose `Request` drops headers the test sets, so `withHeaders` of topology-fixtures.ts sets them): `createApp` over a manifest holding a `local: true` page, `app.fetch(request, { incoming: { socket: { remoteAddress } } })`.
// ASSUMED: "answers the page" is status 200 with the page's loader having run once; the JSON request of the same path carries the loader's marker.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import * as server from "@keel/server";
import { beforeEach, describe, expect, it } from "vitest";
import { withHeaders } from "./topology-fixtures.ts";

const SEED = 1337; // seed 1337 (no random input)
const Out = s.object({ marker: s.string() });
const ran = { page: 0 };
const fixture = () => {
  const c = contract("a", { "a.panel": { path: "/panel", local: true } });
  const panel = loader(c, "a.panel", { output: Out }, async () => {
    ran.page += 1;
    return ok({ marker: "PANEL_MARKER_7f3a91" });
  });
  const page = (): Node => document.createElement("main");
  return manifest(c, { "a.panel": { component: page, loader: panel } });
};

type Fetcher = { fetch(req: Request, connection?: unknown): Promise<Response> };
const isFetcher = (v: unknown): v is Fetcher => typeof v === "object" && v !== null && "fetch" in v;
const boot = async (): Promise<Fetcher> => {
  const make: unknown = Reflect.get(server, "createApp");
  if (typeof make !== "function") throw new Error("@keel/server does not export createApp");
  const app: unknown = await Reflect.apply(make, undefined, [
    {
      topology: topology({ web: { modules: ["a"], adapter: "node" } }),
      routes: fixture(),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
    },
  ]);
  if (!isFetcher(app)) throw new Error("createApp did not return an app with fetch");
  return app;
};
const PORT = 3000;
const req = (headers: Record<string, string> = {}): Request =>
  withHeaders(new Request(`http://127.0.0.1:${PORT}/panel`), {
    accept: "application/json",
    host: `127.0.0.1:${PORT}`,
    "sec-fetch-site": "none",
    ...headers,
  });
const from = (remoteAddress: string): unknown => ({ incoming: { socket: { remoteAddress } } });

beforeEach(() => {
  ran.page = 0;
});

describe("k.contract Local routes: the connection's remote address on `fetch`", () => {
  it("`fetch` of that `GET` with `Host: 127.0.0.1:<port>`, `Sec-Fetch-Site: none` and a connection whose remote address is `::ffff:127.0.0.1` answers the page", async () => {
    const app = await boot();
    const r = await app.fetch(req(), from("::ffff:127.0.0.1"));
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("PANEL_MARKER_7f3a91");
    expect(ran.page).toBe(1);
  });

  it("with remote address `10.0.0.5` and `X-Forwarded-For: 127.0.0.1` it answers 403 `keel.denied`", async () => {
    const app = await boot();
    const r = await app.fetch(req({ "x-forwarded-for": "127.0.0.1" }), from("10.0.0.5"));
    const body = await r.text();
    expect(r.status).toBe(403);
    expect(body).toContain("keel.denied");
    expect(body.includes("PANEL_MARKER_7f3a91")).toBe(false);
    expect(ran.page).toBe(0);
  });

  it("no forwarding header is read: `10.0.0.5` with `Forwarded: for=127.0.0.1` is refused, and `::ffff:127.0.0.1` with `X-Forwarded-For: 10.0.0.5` is answered", async () => {
    const app = await boot();
    const no = await app.fetch(req({ forwarded: "for=127.0.0.1" }), from("10.0.0.5"));
    expect(no.status).toBe(403);
    expect(ran.page).toBe(0);
    const yes = await app.fetch(req({ "x-forwarded-for": "10.0.0.5" }), from("::ffff:127.0.0.1"));
    expect(yes.status).toBe(200);
    expect(ran.page).toBe(1);
  });
});
