// @vitest-environment happy-dom
// k.privacy Server log: a throw past every guard of the handler (the app's own `log.write`) is a bare 500 and one
// fixed `keel.unexpected` `diag` naming the matched route id, never any of the thrown value; when that `diag` cannot be
// written either, stderr gets one fixed line, once per process, with nothing of the thrown value or the request.
// Seed 1337.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const THROWN = "tok-0a1b2c3d4e5f";
const view = (): Node => document.createElement("main");

let stderr: string[] = [];
beforeEach(() => {
  stderr = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderr.push(String(chunk));
    return true;
  });
});
afterEach(() => void vi.restoreAllMocks());

/** An app whose `log.write` throws on each line `fails` picks, every written line in `lines`. */
async function app(fails: (line: string) => boolean) {
  const lines: string[] = [];
  const made = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({
      "app.item": { path: "/item/:id", params: s.object({ id: s.string() }), component: view },
    }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
    log: {
      format: "json",
      write: (l) => {
        if (fails(l)) throw new Error(THROWN);
        lines.push(l);
      },
    },
  });
  return { app: made, lines };
}

describe("the last resort", () => {
  it("names the matched route id in its diag and nothing of the thrown value or the path", async () => {
    const { app: a, lines } = await app((l) => l.includes('"kind":"req"'));
    const res = await a.fetch(new Request("http://localhost/item/q-77d1", { headers: { accept: "application/json" } }));
    const body = await res.text();
    await a.close();
    expect(res.status).toBe(500);
    expect(lines.map((l): unknown => JSON.parse(l))).toEqual([
      expect.objectContaining({ code: "keel.unexpected", message: "request handler threw in app.item" }),
    ]);
    for (const t of [...lines, body, ...stderr]) {
      expect(t).not.toContain(THROWN);
      expect(t).not.toContain("q-77d1");
    }
    expect(stderr).toEqual([]);
  });

  it("writes one fixed stderr line, once per process, when the log cannot be written", async () => {
    const { app: a, lines } = await app(() => true);
    for (const p of ["/item/q-77d1", "/item/q-88e2", "/nowhere"]) {
      const res = await a.fetch(new Request(`http://localhost${p}`));
      await res.text();
      expect(res.status).toBe(500);
    }
    await a.close();
    expect(lines).toEqual([]);
    expect(stderr).toEqual(["keel.unexpected log write threw, records lost (once per process)\n"]);
  });
});
