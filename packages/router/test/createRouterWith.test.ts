// @vitest-environment happy-dom
// k.server Server state through `createRouterWith` (`@keel/router/internal`): with a `ServerState` each loader run and
// each submit is one request, an action's `ok` saves and a conflict becomes its `err`, `err` or a throw saves nothing,
// and the request ends before the router revalidates. Without one (`createRouter`) `stores` is `keel.unexpected`.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { type KeelError, err, ok, s } from "@keel/schema";
import type { ServerState } from "@keel/store/internal";
import { describe, expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { createRouter } from "../src/createRouter.ts";
import { createRouterWith } from "../src/internal/index.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";
import { to } from "./to.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const Boom = s.error("rw.boom", s.object({}));
type Conflict = KeelError<"keel.conflict", { store: string }>;

/** A ServerState that records every call: `r<n>.open`, `r<n>.stores`, `r<n>.save`, `r<n>.end`. */
const fakeState = (clash: () => Conflict | null) => {
  const calls: string[] = [];
  let n = 0;
  const state: ServerState = {
    request() {
      const id = `r${++n}`;
      calls.push(`${id}.open`);
      return {
        stores: async (factory) => {
          calls.push(`${id}.stores`);
          return factory(createCtx({ mode: "sim" }));
        },
        save: async () => {
          calls.push(`${id}.save`);
          return clash();
        },
        end: () => {
          calls.push(`${id}.end`);
        },
      };
    },
  };
  return { state, calls };
};

const setup = (mode: { act: "ok" | "err" | "throw" }) => {
  const factory = () => ({ tag: "instance" });
  const seen: unknown[] = [];
  const routes = manifest({
    "rw.page": {
      path: "/rw",
      loader: loader({ output: s.object({ tag: s.string() }), stores: factory }, async ({ stores }) => {
        seen.push(stores);
        return ok({ tag: stores.tag });
      }),
      component: () => {
        const box = document.createElement("div");
        box.id = "page";
        box.append(
          Form({
            method: "POST",
            action: to("/rw"),
            error: (e) => {
              const p = document.createElement("p");
              p.id = "err";
              p.textContent = e.code;
              return p;
            },
          }),
        );
        return box;
      },
      errorElement: ({ error }) => {
        const p = document.createElement("p");
        p.id = "refused";
        p.textContent = error.code;
        return p;
      },
    },
  });
  routes.actions({
    "rw.page": {
      POST: action({ input: s.object({}), stores: factory }, async (_in, { stores }) => {
        seen.push(stores);
        if (mode.act === "throw") throw new Error("boom");
        return mode.act === "err" ? err(Boom.make({})) : ok(null);
      }),
    },
  });
  return { routes, seen };
};
const submit = (host: HTMLElement): void => {
  host.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
};

describe("createRouterWith", () => {
  it("runs each loader run and each submit as one request; an ok saves, then the request ends before revalidating", async () => {
    const { state, calls } = fakeState(() => null);
    const { routes, seen } = setup({ act: "ok" });
    const router = createRouterWith(routes, { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/rw") }, state);
    const host = document.createElement("div");
    const unmount = mount(router.App, host);
    await settle();
    expect(host.querySelector("#page")).not.toBeNull();
    expect(seen).toEqual([{ tag: "instance" }]);
    expect(calls).toEqual(["r1.open", "r1.stores", "r1.end"]);
    submit(host);
    await settle();
    expect(calls).toEqual([
      "r1.open",
      "r1.stores",
      "r1.end",
      "r2.open",
      "r2.stores",
      "r2.save",
      "r2.end",
      "r3.open",
      "r3.stores",
      "r3.end",
    ]);
    unmount();
    router.dispose();
  });

  it("answers a save conflict as the action's err and does not revalidate", async () => {
    const { state, calls } = fakeState(() => ({ code: "keel.conflict", message: "stale", data: { store: "x" } }));
    const { routes } = setup({ act: "ok" });
    const router = createRouterWith(routes, { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/rw") }, state);
    const host = document.createElement("div");
    const unmount = mount(router.App, host);
    await settle();
    submit(host);
    await settle();
    expect(host.querySelector("#err")?.textContent).toBe("keel.conflict");
    expect(calls.slice(3)).toEqual(["r2.open", "r2.stores", "r2.save", "r2.end"]);
    unmount();
    router.dispose();
  });

  for (const act of ["err", "throw"] as const)
    it(`saves nothing after an action ${act} and still ends the request`, async () => {
      const { state, calls } = fakeState(() => null);
      const { routes } = setup({ act });
      const router = createRouterWith(
        routes,
        { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/rw") },
        state,
      );
      const host = document.createElement("div");
      const unmount = mount(router.App, host);
      await settle();
      submit(host);
      await settle();
      expect(host.querySelector("#err")?.textContent).toBe(act === "err" ? "rw.boom" : "keel.unexpected");
      expect(calls.slice(3)).toEqual(["r2.open", "r2.stores", "r2.end"]);
      unmount();
      router.dispose();
    });

  it("without a ServerState (createRouter) refuses stores before the loader runs", async () => {
    const { routes, seen } = setup({ act: "ok" });
    const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/rw") });
    const host = document.createElement("div");
    const unmount = mount(router.App, host);
    await settle();
    expect(seen).toEqual([]);
    expect(host.querySelector("#refused")?.textContent).toBe("keel.unexpected");
    unmount();
    router.dispose();
  });
});
