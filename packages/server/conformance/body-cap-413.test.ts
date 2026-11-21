// Spec: k.server, clause "A JSON or FormData action body over `maxBodyBytes` yields 413 `keel.payloadTooLarge` and does not call the action."
// @vitest-environment happy-dom
// Seed 1337 (fc.assert seed below).
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { BASE, Edit, Params, Search } from "./fixtures.ts";

async function setup(maxBodyBytes: number | undefined) {
  const n = { act: 0 };
  const orders = contract("orders", {
    "orders.show": { path: "/orders/:kind", params: Params, search: Search },
  });

  const act = action(orders, "orders.show", { input: Edit }, () => {
    n.act++;
    return Promise.resolve(ok(null));
  });
  const routes = manifest(orders, {
    "orders.show": { component: () => document.createElement("main"), POST: act },
  });
  const base = {
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production" as const,
  };
  const app = await createApp(maxBodyBytes === undefined ? base : { ...base, maxBodyBytes });
  return { app, n };
}

function formReq(note: string): Request {
  const fd = new FormData();
  fd.set("kind", "open");
  fd.set("note", note);
  return new Request(`${BASE}/orders/open`, { method: "POST", body: fd, headers: { accept: "application/json" } });
}
function jsonReq(note: string): Request {
  return new Request(`${BASE}/orders/open`, {
    method: "POST",
    body: JSON.stringify({ kind: "open", note }),
    headers: { "content-type": "application/json", accept: "application/json" },
  });
}

async function errorOf(res: Response): Promise<{ code: unknown; limit: unknown }> {
  const body: unknown = await res.json();
  if (typeof body === "object" && body !== null && "error" in body) {
    const e: unknown = body.error;
    if (typeof e === "object" && e !== null && "code" in e) {
      const d: unknown = "data" in e ? e.data : undefined;
      const limit = typeof d === "object" && d !== null && "limit" in d ? d.limit : undefined;
      return { code: e.code, limit };
    }
  }
  return { code: body, limit: undefined };
}

test("A FormData action body over `maxBodyBytes` yields 413 `keel.payloadTooLarge` and does not call the action", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 200, max: 400 }), async (extra) => {
      const { app, n } = await setup(100);
      const res = await app.fetch(formReq("x".repeat(extra)));
      expect(res.status).toBe(413);
      const e = await errorOf(res);
      expect(e.code).toBe("keel.payloadTooLarge");
      expect(e.limit).toBe(100);
      expect(n.act).toBe(0);
    }),
    { seed: 1337, numRuns: 5 },
  );
});

test("A JSON action body over `maxBodyBytes` yields 413 `keel.payloadTooLarge` and does not call the action", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 200, max: 400 }), async (extra) => {
      const { app, n } = await setup(100);
      const res = await app.fetch(jsonReq("x".repeat(extra)));
      expect(res.status).toBe(413);
      const e = await errorOf(res);
      expect(e.code).toBe("keel.payloadTooLarge");
      expect(e.limit).toBe(100);
      expect(n.act).toBe(0);
    }),
    { seed: 1337, numRuns: 5 },
  );
});

test("A body under `maxBodyBytes` is not 413 and calls the action", async () => {
  const { app, n } = await setup(100000);
  const res = await app.fetch(jsonReq("small"));
  expect(res.status).not.toBe(413);
  expect(n.act).toBe(1);
});

test("Without `maxBodyBytes` a body just over 1 MiB is 413", async () => {
  const { app, n } = await setup(undefined);
  const res = await app.fetch(jsonReq("x".repeat(1048576)));
  expect(res.status).toBe(413);
  const e = await errorOf(res);
  expect(e.code).toBe("keel.payloadTooLarge");
  expect(e.limit).toBe(1048576);
  expect(n.act).toBe(0);
});
