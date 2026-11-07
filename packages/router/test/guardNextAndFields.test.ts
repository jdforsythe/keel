// @vitest-environment happy-dom
// Examples: guard denial redirects with ?next= whether or not the target declares it (k.router Guards);
// keel.fields data holds human messages, not rule names (k.forms).
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import { expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { createRouter } from "../src/createRouter.ts";
import { guard } from "../src/guard.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import type { FormHandle } from "../src/types/FormHandle.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const page = (): HTMLElement => document.createElement("p");

it.each([
  ["target declares no search", undefined],
  ["target declares next", s.object({ next: s.string().optional() })],
])("guard denial redirects to login with the encoded current href (%s)", async (_n, search) => {
  guard("gn.deny", { redirect: "gn.login" }, async () => ({
    ok: false,
    error: { code: "keel.denied", message: "no", data: null },
  }));
  const routes = manifest({
    "gn.login": { path: "/login", ...(search === undefined ? {} : { search }), component: page },
    "gn.secret": { path: "/secret", guard: "gn.deny", component: page },
  });
  const history = memoryHistory("/secret?a=1");
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history });
  const host = document.createElement("div");
  const unmount = mount(router.App, host);
  await settle();
  expect(history.current()).toBe(`/login?next=${encodeURIComponent("/secret?a=1")}`);
  expect(router.route.get().id).toBe("gn.login");
  unmount();
  router.dispose();
});

it("an action input failure yields keel.fields with messages per path", async () => {
  const seen: unknown[] = [];
  const handle: FormHandle = {
    setPending: () => {},
    values: () => ({}),
    onResult: (r) => void seen.push(r),
    validate: () => ok(null),
  };
  const routes = manifest({
    "gn.form": {
      path: "/form",
      actions: { POST: action({ input: s.object({ title: s.string({ min: 3 }) }) }, async () => ok(null)) },
      component: () => Form({ method: "POST", action: "gn.form", form: handle }),
    },
  });
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/form") });
  const host = document.createElement("div");
  const unmount = mount(router.App, host);
  await settle();
  host.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  expect(seen).toEqual([
    { ok: false, error: { code: "keel.fields", message: "keel.fields", data: { title: "Required" } } },
  ]);
  unmount();
  router.dispose();
});
