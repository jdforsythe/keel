// @vitest-environment happy-dom
// Spec: k.router, clause "A thrown page or loader gives an `errorElement`, and the default alert, message `unexpected` and data `{}`; with `mode: 'dev'`, its message." Seed 1337 (no random input: the cases are enumerated).
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { createRouter, loader, manifest } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { SEED, memoryHistory, settle } from "./fixtures.ts";

const SECRET = "SECRETTEXT-hunter2";
type Mode = "dev" | "production" | undefined;
type Throws = "page" | "loader";
type Shown = { code: string; message: string; data: unknown };

const Empty = s.object({});
const throwingLoader = loader({ output: Empty }, async () => {
  throw new Error(SECRET);
});
const okLoader = loader({ output: Empty }, async () => ok({}));
const Page = (): Node => {
  throw new Error(SECRET);
};
const Fine = (): Node => {
  const e = document.createElement("section");
  e.setAttribute("data-page", "fine");
  return e;
};

async function run(throws: Throws, withErrorElement: boolean, mode: Mode) {
  const seen: Shown[] = [];
  const errorElement = (p: { error: Shown }): Node => {
    seen.push({ code: p.error.code, message: p.error.message, data: p.error.data });
    const e = document.createElement("p");
    e.setAttribute("data-error", "1");
    e.append(p.error.message);
    return e;
  };
  const routes = manifest({
    "app.home": { path: "/", component: Fine },
    "app.bad": {
      path: "/bad",
      component: throws === "page" ? Page : Fine,
      loader: throws === "loader" ? throwingLoader : okLoader,
      ...(withErrorElement ? { errorElement } : {}),
    },
  });
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const events: CtxEvent[] = [];
  const stopObserving = observe(ctx, (e) => events.push(e));
  const history = memoryHistory("/");
  const router = createRouter(routes, { ctx, history, ...(mode === undefined ? {} : { mode }) });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx });
  await settle();
  await router.navigate(routes.href("app.bad"));
  await settle();
  const reported = events.flatMap((e) => (e.kind === "error" ? [e.error.message] : []));
  return {
    host,
    seen,
    reported,
    stop: () => {
      stopObserving();
      unmount();
      router.dispose();
      host.remove();
    },
  };
}

const THROWS: readonly Throws[] = ["page", "loader"];

describe("k.router production error text", () => {
  for (const throws of THROWS) {
    it(`a thrown ${throws} renders the default alert with text unexpected and not the thrown text when createRouter has no mode`, async () => {
      const r = await run(throws, false, undefined);
      const alert = r.host.querySelector('[role="alert"]');
      expect(alert?.textContent).toBe("unexpected");
      expect(r.host.textContent ?? "").not.toContain(SECRET);
      r.stop();
    });

    it(`a thrown ${throws} renders the default alert with text unexpected when mode is "production"`, async () => {
      const r = await run(throws, false, "production");
      expect(r.host.querySelector('[role="alert"]')?.textContent).toBe("unexpected");
      expect(r.host.textContent ?? "").not.toContain(SECRET);
      r.stop();
    });

    it(`a thrown ${throws} gives an errorElement { code: "keel.unexpected", message: "unexpected", data: {} } when createRouter has no mode`, async () => {
      const r = await run(throws, true, undefined);
      expect(r.seen).toEqual([{ code: "keel.unexpected", message: "unexpected", data: {} }]);
      expect(r.host.textContent ?? "").not.toContain(SECRET);
      r.stop();
    });

    it(`with mode "dev" a thrown ${throws} shows its message in the default alert`, async () => {
      const r = await run(throws, false, "dev");
      expect(r.host.querySelector('[role="alert"]')?.textContent ?? "").toContain(SECRET);
      r.stop();
    });

    it(`with mode "dev" a thrown ${throws} gives an errorElement code keel.unexpected and its message`, async () => {
      const r = await run(throws, true, "dev");
      expect(r.seen).toHaveLength(1);
      expect(r.seen[0]?.code).toBe("keel.unexpected");
      expect(r.seen[0]?.message).toContain(SECRET);
      r.stop();
    });

    for (const mode of ["dev", "production", undefined] as const) {
      it(`an observer on the ctx receives the full message of a thrown ${throws} with mode ${mode ?? "unset"}`, async () => {
        const r = await run(throws, false, mode);
        expect(r.reported.some((m) => m.includes(SECRET))).toBe(true);
        r.stop();
      });
    }
  }
});
