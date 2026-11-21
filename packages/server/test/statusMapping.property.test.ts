// @vitest-environment happy-dom
// Property (seed 1337): the status of any err code, from a loader (GET) or an action (POST), document or runtime.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type KeelError, err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const BASE = "http://localhost";

// Oracle written from the spec text (k.server Status), independent of the implementation.
const expected = (code: string): number =>
  code === "keel.notFound"
    ? 404
    : code === "keel.denied"
      ? 403
      : code === "keel.fields"
        ? 422
        : code === "keel.unexpected"
          ? 500
          : code === "keel.busy"
            ? 503
            : 400;

const code = fc.oneof(
  fc.constantFrom(
    "keel.notFound",
    "keel.denied",
    "keel.fields",
    "keel.unexpected",
    "keel.busy",
    "schema.invalid",
    "api.timeout",
  ),
  fc
    .tuple(fc.stringMatching(/^[a-z][a-zA-Z]{0,7}$/), fc.stringMatching(/^[a-z][a-zA-Z]{0,7}$/))
    .map(([a, b]) => `${a}.${b}`),
);

const Page = s.object({ title: s.string() });
const Note = s.object({ note: s.string() });
const p = (text: string): Node => {
  const el = document.createElement("p");
  el.textContent = text;
  return el;
};

async function appFor(e: KeelError<string, unknown>, mode: "dev" | "production") {
  const c = contract("orders", { "orders.show": { path: "/orders" }, "orders.ok": { path: "/ok" } });
  const show = loader(c, "orders.show", { output: Page }, () => Promise.resolve(err(e)));
  const fine = loader(c, "orders.ok", { output: Page }, () => Promise.resolve(ok({ title: "t" })));
  const routes = manifest(c, {
    "orders.show": {
      loader: show,
      component: () => p("page"),
      errorElement: ({ error }) => p(`error ${error.code}`),
      POST: action(c, "orders.show", { input: Note }, () => err(e)),
    },
    "orders.ok": {
      loader: fine,
      component: () => p("page"),
      errorElement: ({ error }) => p(`error ${error.code}`),
      POST: action(c, "orders.ok", { input: Note }, () => err(e)),
    },
  });
  return createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
  });
}

const post = (path: string, headers: Record<string, string>) => {
  const fd = new FormData();
  fd.set("note", "n");
  return new Request(`${BASE}${path}`, { method: "POST", body: fd, headers });
};
const json = { accept: "application/json" };

describe("status mapping (property)", () => {
  it("a loader err yields the status of its code, for documents and runtime requests", async () => {
    await fc.assert(
      fc.asyncProperty(code, fc.constantFrom("dev" as const, "production" as const), async (c, mode) => {
        const app = await appFor({ code: c, message: c, data: {} }, mode);
        const doc = await app.fetch(new Request(`${BASE}/orders`));
        expect(doc.status).toBe(expected(c));
        expect(await doc.text()).toContain(`error ${c}`);
        const rt = await app.fetch(new Request(`${BASE}/orders`, { headers: json }));
        expect(rt.status).toBe(expected(c));
        expect(JSON.stringify(await rt.json())).toContain(c);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  it("an action err yields the status of its code; the runtime body is the err Result", async () => {
    await fc.assert(
      fc.asyncProperty(code, fc.constantFrom("dev" as const, "production" as const), async (c, mode) => {
        const app = await appFor({ code: c, message: c, data: {} }, mode);
        const rt = await app.fetch(post("/ok", json));
        expect(rt.status).toBe(expected(c));
        const body: unknown = await rt.json();
        expect(body).toMatchObject({ ok: false, error: { code: c } });
        const doc = await app.fetch(post("/ok", {}));
        expect(doc.status).toBe(expected(c));
        expect(doc.headers.get("content-type") ?? "").toContain("text/html");
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  it("production scrubs every keel.unexpected message; dev keeps it", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[qxz]{10,16}$/), async (secret) => {
        const e = { code: "keel.unexpected", message: secret, data: { cause: secret } };
        const prod = await appFor(e, "production");
        expect(await (await prod.fetch(post("/ok", json))).text()).not.toContain(secret);
        expect(await (await prod.fetch(new Request(`${BASE}/orders`))).text()).not.toContain(secret);
        const dev = await appFor(e, "dev");
        expect(await (await dev.fetch(post("/ok", json))).text()).toContain(secret);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
