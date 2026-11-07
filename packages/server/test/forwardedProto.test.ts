// Backlog 0160 (RFC 0060): behind a TLS-terminating proxy the request URL is http:, so with `secure` unset the caller
// cookie lost `Secure` and its `__Host-` name. `x-forwarded-proto: https` now upgrades a request to https; it never
// downgrades one (an https URL stays https whatever the header says), and an explicit `secure` wins over both.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const app = (secure?: boolean) =>
  createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({
      "app.home": {
        path: "/",
        actions: { POST: action({ input: s.object({}) }, async () => ok(null)) },
        component: () => document.createElement("p"),
      },
    }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    ...(secure === undefined ? {} : { secure }),
  });

/** The `set-cookie` of a cookieless same-origin JSON write to `url` carrying `headers`. */
const minted = async (url: string, headers: Record<string, string>, secure?: boolean): Promise<string> => {
  const res = await (await app(secure)).fetch(
    new Request(url, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", ...headers },
      body: "{}",
    }),
  );
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie") ?? "";
};

const HOST = /^__Host-keel-caller=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Secure$/;
const PLAIN = /^keel-caller=[^;]+; Path=\/; HttpOnly; SameSite=Lax$/;

describe("x-forwarded-proto is upgrade-only (backlog 0160)", () => {
  it("backlog 0160 repro: an http URL behind a TLS proxy (x-forwarded-proto: https) gets the __Host- Secure cookie", async () => {
    expect(await minted("http://app.test/", { "x-forwarded-proto": "https" })).toMatch(HOST);
    expect(await minted("http://app.test/", { "x-forwarded-proto": " HTTPS , http" })).toMatch(HOST);
  });

  it("without the header, or with any other first value, an http URL stays http", async () => {
    expect(await minted("http://app.test/", {})).toMatch(PLAIN);
    for (const v of ["http", "http, https", "wss", ""])
      expect(await minted("http://app.test/", { "x-forwarded-proto": v }), v).toMatch(PLAIN);
  });

  it("never downgrades: an https URL with x-forwarded-proto: http is still https", async () => {
    expect(await minted("https://app.test/", { "x-forwarded-proto": "http" })).toMatch(HOST);
  });

  it("an explicit `secure` wins over the URL and the header", async () => {
    expect(await minted("http://app.test/", { "x-forwarded-proto": "https" }, false)).toMatch(PLAIN);
    expect(await minted("https://app.test/", {}, false)).toMatch(PLAIN);
    expect(await minted("http://app.test/", { "x-forwarded-proto": "http" }, true)).toMatch(HOST);
  });

  it("an upgraded request reads only __Host-keel-caller: a planted keel-caller counts as none", async () => {
    const a = await app();
    const plain = await a.fetch(
      new Request("http://app.test/", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
        body: "{}",
      }),
    );
    const planted = (plain.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    expect(planted).toMatch(/^keel-caller=/);
    const proxied = await a.fetch(
      new Request("http://app.test/", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-keel": "1",
          "x-forwarded-proto": "https",
          cookie: planted,
        },
        body: "{}",
      }),
    );
    expect(proxied.headers.get("set-cookie")).toMatch(HOST);
  });
});
