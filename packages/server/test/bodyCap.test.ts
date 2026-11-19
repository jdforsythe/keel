// @vitest-environment node
// Action bodies are capped (backlog 0089): over the cap is 413 `keel.payloadTooLarge`, the action never runs.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { readCapped } from "../src/internal/readCapped.ts";

const BASE = "http://localhost";
const Note = s.object({ note: s.string() });

async function build(seen: unknown[], maxBodyBytes?: number) {
  const save = action({ input: Note }, (input) => {
    seen.push(input);
    return ok(null);
  });
  const routes = manifest({ "app.notes": { path: "/notes", component: () => document.createElement("p") } });
  routes.actions({ "app.notes": { POST: save } });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1 }),
    ...(maxBodyBytes === undefined ? {} : { maxBodyBytes }),
  });
}

const json = (body: string, extra: Record<string, string> = {}) =>
  new Request(`${BASE}/notes`, {
    method: "POST",
    body,
    headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", ...extra },
  });

describe("action body cap", () => {
  it("accepts a body at the cap and refuses one byte over with a keel.payloadTooLarge err", async () => {
    const seen: unknown[] = [];
    const app = await build(seen, 64);
    const fits = JSON.stringify({ note: "x".repeat(64 - 11) });
    expect(fits.length).toBe(64);
    expect((await app.fetch(json(fits))).status).toBe(200);
    const over = await app.fetch(json(JSON.stringify({ note: "x".repeat(64 - 10) })));
    expect(over.status).toBe(413);
    expect(over.headers.get("content-type")).toContain("application/json");
    expect(await over.json()).toEqual({
      ok: false,
      error: { code: "keel.payloadTooLarge", message: "request body exceeds 64 bytes", data: { limit: 64 } },
    });
    expect(seen).toHaveLength(1);
  });

  it("refuses an over-cap document FormData post, and a declared content-length over the cap without reading", async () => {
    const seen: unknown[] = [];
    const app = await build(seen, 10);
    const fd = new URLSearchParams({ note: "x".repeat(100) });
    const res = await app.fetch(
      new Request(`${BASE}/notes`, { method: "POST", body: fd, headers: { accept: "text/html" } }),
    );
    expect(res.status).toBe(413);
    expect(await readCapped({ headers: new Headers({ "content-length": "999" }), body: null }, 10)).toBeNull();
    expect(await readCapped({ headers: new Headers({ "content-length": "5" }), body: null }, 10)).toEqual(
      new Uint8Array(0),
    );
    expect(seen).toHaveLength(0);
  });

  it("stops reading a chunked body that passes the cap", async () => {
    const seen: unknown[] = [];
    const app = await build(seen, 8);
    let pulled = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
      pull(c) {
        if (cancelled) return;
        pulled++;
        c.enqueue(new TextEncoder().encode("0123456789"));
        if (pulled > 50) c.close();
      },
    });
    const init = Object.assign(
      {
        method: "POST",
        body,
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
      },
      { duplex: "half" },
    );
    const res = await app.fetch(new Request(`${BASE}/notes`, init));
    expect(res.status).toBe(413);
    expect(pulled).toBeLessThan(5);
  });

  it("defaults to 1 MiB", async () => {
    const seen: unknown[] = [];
    const app = await build(seen);
    expect((await app.fetch(json(JSON.stringify({ note: "x".repeat(1024 * 1024) })))).status).toBe(413);
    expect((await app.fetch(json(JSON.stringify({ note: "x".repeat(1000 * 1000) })))).status).toBe(200);
  });
});
