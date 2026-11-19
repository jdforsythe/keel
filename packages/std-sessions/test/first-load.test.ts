// @vitest-environment happy-dom
// First-load errors: a page whose loader failed on the server is resumed in the browser; the resume reports the
// served route and its error, the ctx keeps them, and a recorder started afterwards records and uploads the error.
// The server's own ctx keeps nothing. Seed 1337
import { createCtx, observe } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { resume } from "@keel/runtime-dom/ops";
import { err, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { describe, expect, test } from "vitest";
import { record, session } from "../src/index.ts";

const Locked = s.error("cart.locked", s.object({ at: s.string(), owner: s.string() }));
const routes = manifest({
  "cart.show": {
    path: "/cart",
    loader: loader({ output: s.object({}) }, () =>
      Promise.resolve(err(Locked.make({ at: "cart.show", owner: "ada@example.test" }, "locked by ada@example.test"))),
    ),
    component: () => {
      throw new Error("the errorElement renders instead");
    },
  },
});

async function serve() {
  const server = createCtx({ mode: "sim", seed: 1337 });
  const app = await createApp({
    topology: topology({ web: { modules: ["cart"], adapter: "node" } }),
    routes,
    ctx: server,
  });
  const res = await app.fetch(new Request("http://localhost:3000/cart", { headers: { accept: "text/html" } }));
  return { server, html: await res.text(), status: res.status };
}

describe("first-load loader error", () => {
  test("a failing loader on first load is recorded and uploaded by a recorder started after resume", async () => {
    const { html, status } = await serve();
    expect(status).toBeGreaterThanOrEqual(400);
    const state = /<script type="application\/json" id="k-state">([^<]*)<\/script>/.exec(html)?.[1] ?? "";
    expect(state).toContain("cart.locked");
    expect(state).not.toContain("ada@example.test");
    document.body.innerHTML = `<script type="application/json" id="k-state">${state}</script>`;
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    resume(document.body, {}, { ctx });
    const rec = record(ctx, { upload: new URL("/sessions", location.origin) });
    await Promise.resolve();
    const taken = session(ctx).taken();
    expect(taken).toHaveLength(1);
    expect(taken[0]?.session.route.id).toBe("cart.show");
    expect(taken[0]?.session.error).toEqual({ code: "cart.locked", message: "cart.locked", data: { at: "cart.show" } });
    rec.stop();
  });

  test("the server's ctx keeps no error for a later observer", async () => {
    const { server } = await serve();
    const seen: CtxEvent[] = [];
    const stop = observe(server, (e) => void seen.push(e));
    stop();
    expect(seen.filter((e) => e.kind === "error")).toEqual([]);
  });
});
