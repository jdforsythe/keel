// @vitest-environment happy-dom
// Spec: k.api, clause "A GET with `accept: text/html` to an API route with a loader gets the JSON body and status a runtime GET gets."
// Spec: k.api, Conformance "A GET to a path with only a `POST` entry is 405 with `allow: POST`; with a GET entry too, a PUT is 405 `allow: GET, HEAD, POST`, a HEAD runs the GET entry's loader and sends no body, and a plain OPTIONS is 405 with that `allow`."
// The GET-entry half (PUT, HEAD, OPTIONS) is path-methods-allow.test.ts.
// Spec: k.api, clause "A form POST to an API route gets the action's `Result` as JSON with no `Location`."
// Spec: k.api, clause "A denying guard with a `redirect` answers 403 `keel.denied` and no `Location`."
// Spec: k.api, clause "A guard without `redirect` on an API route denies with 403 `keel.denied`; on a page it does not compile and `manifest()` throws E1508."
// Spec: k.api, clause "`createApp` for a `client` deployable serving an API route throws E1511."
// Seed 1337.
// One module `api` holds the pages and entries each case needs; a guard's `redirect` names a page id of its own module (k.router Links).
// ASSUMPTION: createApp throws (rejects with a message mentioning the code) as e1553-static-params.test.ts assumes.
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, bodyOf, boot, form, get, getHtml } from "./contract-support.ts";

const Out = s.object({ n: s.int() });
const Note = s.object({ note: s.string() });
const Denied = s.error("keel.denied", s.object({}));
const page = (): Node => document.createElement("main");

const c = contract("api", {
  "api.login": { path: "/login" },
  "api.home": { path: "/" },
  "api.lists": { method: "GET", path: "/api/lists", output: Out },
  "api.addList": { method: "POST", path: "/api/lists", body: Note, output: s.object({}) },
  "api.dropList": { method: "DELETE", path: "/api/lists", body: Note, output: s.object({}) },
  "api.only": { method: "POST", path: "/api/only", body: Note, output: s.object({}) },
  "api.guarded": { method: "GET", path: "/api/guarded", output: Out },
  "api.open": { method: "GET", path: "/api/open", output: Out },
});
const lists = loader(c, "api.lists", {}, async () => ok({ n: 7 }));
const add = action(c, "api.addList", {}, async () => ok({}));
const drop = action(c, "api.dropList", {}, async () => ok({}));
const only = action(c, "api.only", {}, async () => ok({}));
const deny = guard({ redirect: "api.login" }, async () => err(Denied.make({})));
const denyOpen = guard({}, async () => err(Denied.make({})));
const guarded = loader(c, "api.guarded", {}, async () => ok({ n: 1 }));
const open = loader(c, "api.open", {}, async () => ok({ n: 1 }));
const table = (guards: { guarded?: typeof deny; open?: typeof denyOpen } = {}) =>
  manifest(c, {
    "api.login": { component: page },
    "api.home": { component: page },
    "api.lists": { loader: lists },
    "api.addList": { action: add },
    "api.dropList": { action: drop },
    "api.only": { action: only },
    "api.guarded": guards.guarded === undefined ? { loader: guarded } : { loader: guarded, guard: guards.guarded },
    "api.open": guards.open === undefined ? { loader: open } : { loader: open, guard: guards.open },
  });

describe("k.api", () => {
  it("A GET with `accept: text/html` to an API route with a loader gets the JSON body and status a runtime GET gets.", async () => {
    const app = await boot(table(), ["api"]);
    const runtime = await app.fetch(get("/api/lists", { accept: "application/json" }));
    expect(runtime.status).toBe(200);
    const expected: unknown = await runtime.json();
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("text/html", "text/html,application/xhtml+xml", "*/*"), async (accept) => {
        const res = await app.fetch(get("/api/lists", { accept }));
        expect(res.status).toBe(runtime.status);
        expect(res.headers.get("content-type") ?? "").toContain("application/json");
        expect(await res.json()).toEqual(expected);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("A GET to a path with only a `POST` entry is 405 with `allow: POST`.", async () => {
    const app = await boot(table(), ["api"]);
    const res = await app.fetch(get("/api/only", { accept: "application/json" }));
    expect(res.status).toBe(405);
    const allow = (res.headers.get("allow") ?? "").split(",").map((m) => m.trim());
    expect(allow).toEqual(["POST"]);
  });

  it("a PATCH to a path with GET, POST and DELETE entries is 405 with `allow: GET, HEAD, POST, DELETE`, in that order", async () => {
    const app = await boot(table(), ["api"]);
    const res = await app.fetch(
      new Request("http://localhost/api/lists", {
        method: "PATCH",
        headers: { accept: "application/json", origin: "http://localhost", "x-keel": "1" },
      }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD, POST, DELETE");
  });

  it("A form POST to an API route gets the action's `Result` as JSON with no `Location`.", async () => {
    const app = await boot(table(), ["api"]);
    const res = await app.fetch(form("/api/lists", { note: "hi" }));
    expect(res.status).not.toBe(303);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type") ?? "").toContain("application/json");
    expect(await res.json()).toEqual(expect.objectContaining({ ok: true }));
  });

  it("A denying guard with a `redirect` answers 403 `keel.denied` and no `Location`.", async () => {
    const app = await boot(table({ guarded: deny }), ["api"]);
    const res = await app.fetch(getHtml("/api/guarded"));
    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
    expect(await bodyOf(res)).toContain("keel.denied");
  });

  it("A guard without `redirect` on an API route denies with 403 `keel.denied` as JSON and no `Location`.", async () => {
    const app = await boot(table({ open: denyOpen }), ["api"]);
    const res = await app.fetch(get("/api/open"));
    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type") ?? "").toContain("application/json");
    expect(await bodyOf(res)).toContain("keel.denied");
  });

  it("`createApp` for a `client` deployable serving an API route throws E1511.", async () => {
    const run = (adapter: "client" | "node") =>
      boot(table(), ["api"], adapter).then(
        () => "built",
        (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e)),
      );
    expect(await run("client")).toContain("E1511");
    expect(await run("node")).toBe("built");
  });
});
