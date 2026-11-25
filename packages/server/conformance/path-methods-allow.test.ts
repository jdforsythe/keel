// @vitest-environment happy-dom
// k.api, Requests "A request matches the pattern by path, then the entry by method; that entry's guard and handler run. HEAD runs the GET entry and sends no body."
// k.api, Requests "A method no entry at the pattern has is 405, no guard run, with `allow` the pattern's methods in the order GET, HEAD, POST, PUT, PATCH, DELETE (HEAD with GET)."
// k.api, Requests "OPTIONS is no entry method: a preflight is k.hosting's, any other OPTIONS 405."
// Spec: k.api, clause "A GET to a path with only a `POST` entry is 405 with `allow: POST`; with a GET entry too, a PUT is 405 `allow: GET, HEAD, POST`, a HEAD runs the GET entry's loader and sends no body, and a plain OPTIONS is 405 with that `allow`."
// Seed 1337. The guards and loaders count their runs in a variable, never a clock.
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BASE, SEED, boot, get, postJson } from "./contract-support.ts";

const Out = s.object({ n: s.int() });
const Note = s.object({ note: s.string() });
const ALL = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as const;

const c = contract("m", {
  "m.read": { method: "GET", path: "/api/r", output: Out },
  "m.add": { method: "POST", path: "/api/r", body: Note, output: s.object({}) },
  "m.put": { method: "PUT", path: "/api/p", body: Note, output: s.object({}) },
  "m.patch": { method: "PATCH", path: "/api/p", body: Note, output: s.object({}) },
  "m.drop": { method: "DELETE", path: "/api/p", body: Note, output: s.object({}) },
  "m.only": { method: "POST", path: "/api/only", body: Note, output: s.object({}) },
});
const runs = { guard: 0, loader: 0, action: 0 };
const g = guard({}, async () => {
  runs.guard += 1;
  return ok(null);
});
const table = () =>
  manifest(c, {
    "m.read": {
      loader: loader(c, "m.read", {}, async () => {
        runs.loader += 1;
        return ok({ n: 7 });
      }),
      guard: g,
    },
    "m.add": { action: action(c, "m.add", {}, async () => ok({})), guard: g },
    "m.put": { action: action(c, "m.put", {}, async () => ok({})), guard: g },
    "m.patch": { action: action(c, "m.patch", {}, async () => ok({})), guard: g },
    "m.drop": { action: action(c, "m.drop", {}, async () => ok({})), guard: g },
    "m.only": { action: action(c, "m.only", {}, async () => ok({})), guard: g },
  });
const withMethod = (method: string, path: string, headers: Record<string, string> = {}): Request =>
  new Request(`${BASE}${path}`, {
    method,
    headers: { accept: "application/json", origin: BASE, "x-keel": "1", ...headers },
  });
const allowOf = (res: Response): string => res.headers.get("allow") ?? "";

describe("k.api: one path at several methods", () => {
  it("a HEAD to a path with a GET entry runs the GET entry's loader and sends no body", async () => {
    const app = await boot(table(), ["m"]);
    const before = runs.loader;
    const res = await app.fetch(withMethod("HEAD", "/api/r"));
    expect(res.status).toBe(200);
    expect(runs.loader).toBe(before + 1);
    expect(await res.text()).toBe("");
  });

  it("a HEAD answers the status of the GET entry and runs its guard", async () => {
    const app = await boot(table(), ["m"]);
    const got = await app.fetch(get("/api/r"));
    const before = runs.guard;
    const head = await app.fetch(withMethod("HEAD", "/api/r"));
    expect(head.status).toBe(got.status);
    expect(runs.guard).toBe(before + 1);
  });

  it("a HEAD to a path with no GET entry is 405 with `allow` the pattern's methods", async () => {
    const app = await boot(table(), ["m"]);
    const res = await app.fetch(withMethod("HEAD", "/api/only"));
    expect(res.status).toBe(405);
    expect(allowOf(res)).toBe("POST");
  });

  it("a PUT to a path with a GET and a POST entry is 405 with `allow: GET, HEAD, POST`", async () => {
    const app = await boot(table(), ["m"]);
    const res = await app.fetch(withMethod("PUT", "/api/r"));
    expect(res.status).toBe(405);
    expect(allowOf(res)).toBe("GET, HEAD, POST");
  });

  it("a 405 runs no guard, loader or action", async () => {
    const app = await boot(table(), ["m"]);
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("PUT", "PATCH", "DELETE", "OPTIONS"), async (method) => {
        const before = { ...runs };
        const res = await app.fetch(withMethod(method, "/api/r"));
        expect(res.status).toBe(405);
        expect(runs).toEqual(before);
      }),
      { seed: SEED, numRuns: 4 },
    );
    const before = { ...runs };
    const res = await app.fetch(withMethod("GET", "/api/only"));
    expect(res.status).toBe(405);
    expect(runs).toEqual(before);
  });

  it("`allow` lists the pattern's methods in the order GET, HEAD, POST, PUT, PATCH, DELETE, HEAD with GET", async () => {
    const app = await boot(table(), ["m"]);
    const own = await app.fetch(withMethod("GET", "/api/p"));
    expect(own.status).toBe(405);
    expect(allowOf(own)).toBe("PUT, PATCH, DELETE");
    const post = await app.fetch(withMethod("POST", "/api/p"));
    expect(allowOf(post)).toBe("PUT, PATCH, DELETE");
    const mixed = await app.fetch(withMethod("PUT", "/api/r"));
    const listed = allowOf(mixed).split(", ");
    expect(listed).toEqual(ALL.filter((m) => listed.includes(m)));
    const patch = await app.fetch(withMethod("PATCH", "/api/r"));
    expect(allowOf(patch)).toBe("GET, HEAD, POST");
  });

  it("a plain OPTIONS to a path with a GET and a POST entry is 405 with `allow: GET, HEAD, POST`", async () => {
    const app = await boot(table(), ["m"]);
    const res = await app.fetch(withMethod("OPTIONS", "/api/r"));
    expect(res.status).toBe(405);
    expect(allowOf(res)).toBe("GET, HEAD, POST");
  });

  it("a request with an entry's method runs that entry's guard and handler and no other's", async () => {
    const app = await boot(table(), ["m"]);
    const before = { ...runs };
    const res = await app.fetch(postJson("/api/r", { note: "x" }));
    expect(res.status).toBe(200);
    expect(runs.guard).toBe(before.guard + 1);
    expect(runs.loader).toBe(before.loader);
  });
});
