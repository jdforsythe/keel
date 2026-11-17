// @vitest-environment happy-dom
// Unless `mode` is `dev`, the router shows and passes on a thrown `keel.unexpected` as the server's public form; the
// ctx's observers still get the full error.
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { type KeelError, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { createRouter } from "../src/createRouter.ts";
import { publicError } from "../src/internal/publicError.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";

const SEED = 1337;
const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
type Where = "page" | "loader" | "action";
type Seen = { code: string; message: string; data: unknown };
// A mode the router does not know arrives from untyped JSON: it must read as production.
const unknownMode: { readonly mode?: "dev" | "production" } = JSON.parse('{"mode":"staging"}');
const production: { readonly mode?: "dev" | "production" } = { mode: "production" };
const modes = [{}, production, unknownMode];
const PUBLIC: Seen = { code: "keel.unexpected", message: "unexpected", data: {} };

async function run(
  where: Where,
  message: string,
  withErrorElement: boolean,
  opts: { readonly mode?: "dev" | "production" },
) {
  const seen: Seen[] = [];
  const show = (e: KeelError<string, unknown>): Node => {
    seen.push({ code: e.code, message: e.message, data: e.data });
    const p = document.createElement("p");
    p.append(e.message);
    return p;
  };
  const Empty = s.object({});
  const Page = (): Node => {
    if (where === "page") throw new Error(message);
    if (where === "action") return Form({ method: "POST", action: routes.href("t.bad"), error: show });
    return document.createElement("section");
  };
  const routes = manifest({
    "t.home": { path: "/", component: () => document.createElement("main") },
    "t.bad": {
      path: "/bad",
      component: Page,
      loader: loader({ output: Empty }, async () => {
        if (where === "loader") throw new Error(message);
        return ok({});
      }),
      ...(withErrorElement ? { errorElement: (p: { error: KeelError<string, unknown> }) => show(p.error) } : {}),
    },
  });
  routes.actions({
    "t.bad": {
      POST: action({ input: Empty }, async () => {
        throw new Error(message);
      }),
    },
  });
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const reported: string[] = [];
  const stop = observe(ctx, (e: CtxEvent) => {
    if (e.kind === "error") reported.push(e.error.message);
  });
  const router = createRouter(routes, { ctx, history: memoryHistory("/"), ...opts });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx });
  await settle();
  await router.navigate(routes.href("t.bad"));
  await settle();
  if (where === "action") {
    host.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
  }
  const text = host.textContent ?? "";
  const alert = host.querySelector('[role="alert"]')?.textContent ?? null;
  stop();
  unmount();
  router.dispose();
  host.remove();
  return { text, alert, seen, reported };
}

const messageArb = fc.string({ minLength: 1, maxLength: 24 }).map((m) => `SECRET-${m}`);
const whereArb = fc.constantFrom<Where>("page", "loader", "action");

describe("router production error text", () => {
  it("publicError keeps every code but keel.unexpected, and keeps keel.unexpected in dev", () => {
    const u: KeelError<string, unknown> = { code: "keel.unexpected", message: "boom", data: { at: "x" } };
    const other: KeelError<string, unknown> = { code: "md.boom", message: "boom", data: { a: 1 } };
    expect(publicError(u, "production")).toEqual(PUBLIC);
    expect(publicError(u, "dev")).toBe(u);
    expect(publicError(other, "production")).toBe(other);
  });

  it("for any thrown text and any non-dev mode, the page and every errorElement or Form error input lack the text", async () => {
    await fc.assert(
      fc.asyncProperty(
        whereArb,
        messageArb,
        fc.boolean(),
        fc.constantFrom(...modes),
        async (where, message, withErrorElement, opts) => {
          const r = await run(where, message, withErrorElement, opts);
          expect(r.text).not.toContain(message);
          for (const e of r.seen) expect(e).toEqual(PUBLIC);
          if (where === "action" || withErrorElement) expect(r.seen).toEqual([PUBLIC]);
          else expect(r.alert).toBe("unexpected");
          expect(r.reported.some((m) => m.includes(message))).toBe(true);
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("with mode dev the default alert, an errorElement and a Form error show the thrown text", async () => {
    const wheres: readonly Where[] = ["page", "loader", "action"];
    for (const where of wheres) {
      const r = await run(where, "SECRET-dev", where !== "action", { mode: "dev" });
      expect(r.seen).toHaveLength(1);
      expect(r.seen[0]?.message).toContain("SECRET-dev");
    }
    const bare = await run("loader", "SECRET-dev", false, { mode: "dev" });
    expect(bare.alert).toContain("SECRET-dev");
  });
});
