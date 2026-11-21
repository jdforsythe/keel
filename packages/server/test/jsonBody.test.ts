// @vitest-environment happy-dom
// Runtime action requests with a JSON body (a `@keel/services` client, k.services Encoding) decode like FormData.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const BASE = "http://localhost";
const Note = s.object({ note: s.string({ min: 3 }), pinned: s.boolean() });

async function build(seen: unknown[]) {
  const c = contract("app", { "app.notes": { path: "/notes" } });
  const save = action(c, "app.notes", { input: Note }, (input) => {
    seen.push(input);
    return ok(null);
  });
  const routes = manifest(c, {
    "app.notes": { component: () => document.createElement("p"), POST: save },
  });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
  });
}

const postJson = (body: string, accept = "application/json") =>
  new Request(`${BASE}/notes`, { method: "POST", body, headers: { accept, "content-type": "application/json" } });

describe("JSON action bodies", () => {
  it("parses the body with the action's input schema and returns the Result", async () => {
    const seen: unknown[] = [];
    const res = await (await build(seen)).fetch(postJson(JSON.stringify({ note: "hello", pinned: true })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, value: null });
    expect(seen).toEqual([{ note: "hello", pinned: true }]);
  });
  it("an invalid or unreadable body is keel.fields 422 and the action does not run", async () => {
    const seen: unknown[] = [];
    const app = await build(seen);
    const bad = await app.fetch(postJson(JSON.stringify({ note: "x", pinned: true })));
    expect(bad.status).toBe(422);
    expect(await bad.json()).toMatchObject({
      ok: false,
      error: { code: "keel.fields", data: { note: expect.any(String) } },
    });
    const broken = await app.fetch(postJson("{"));
    expect(broken.status).toBe(422);
    expect(seen).toEqual([]);
  });
  it("a document request with a JSON body still gets the 303", async () => {
    const res = await (await build([])).fetch(postJson(JSON.stringify({ note: "hello", pinned: false }), "text/html"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/notes");
  });
});
