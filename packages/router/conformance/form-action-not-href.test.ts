// @vitest-environment happy-dom
// Spec: k.router (Links) "`Link to`, `navigate`, `Form action` and an action's `ok` take `Href` only, rechecked when run (server and client): else `Link` renders `about:blank`, `Form` throws E1501, `ok` is `keel.unexpected` (nothing saved or followed), and `navigate` rejects (E1501) unless it is one once `\` reads as `/` and `#…` drops."
// rfc:0157 conformance: a `Form` with an `action` that is no `Href` throws E1501, outside a router and inside one. The type half: ./negative-types.test-d.ts.
// Seed 1337 (fc.assert below).
import { createCtx } from "@keel/ctx";
import { Form, createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, memoryHistory, settle, thrown } from "./contract-support.ts";

const BAD = [
  "//evil.example/x",
  "/\\evil.example",
  "https://evil.example/",
  "javascript:alert(1)",
  "/a\u0085b",
  "/a\u0000b",
  "/a#frag",
  "",
];
const direct = (action: unknown): unknown =>
  thrown(() => Reflect.apply(Form, undefined, [{ method: "POST", action, children: () => [] }]))?.code ?? null;

const knob: { action: unknown } = { action: null };
const c = contract("fa", { "fa.home": { path: "/" } });
const routes = manifest(c, {
  "fa.home": {
    component: () => Reflect.apply(Form, undefined, [{ method: "POST", action: knob.action, children: () => [] }]),
  },
});
/** The code of what rendering the Form inside a router threw, thrown out of mount or shown by the router's error boundary. */
async function inside(action: unknown): Promise<unknown> {
  knob.action = action;
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const router = createRouter(routes, { ctx, history: memoryHistory("/"), mode: "dev" });
  const host = document.createElement("div");
  document.body.append(host);
  let code: unknown = null;
  let unmount: () => void = () => {};
  try {
    unmount = mount(router.App, host, { ctx });
    await settle();
  } catch (e) {
    code = typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
  }
  const alert = host.querySelector('[role="alert"]');
  if (code === null && alert?.textContent?.startsWith("E1501")) code = "E1501";
  unmount();
  router.dispose();
  host.remove();
  return code;
}

describe("rfc:0157 conformance: a Form whose action is no Href", () => {
  it("throws E1501 outside a router for `//evil.example/x`, `/\\evil.example`, `https://evil.example/`, `javascript:alert(1)`, a control character, a `#` and `''`", () => {
    for (const to of BAD) expect(direct(to), JSON.stringify(to)).toBe("E1501");
  });

  it("throws E1501 for a value that is not a string", () => {
    for (const to of [undefined, null, 1, {}, ["/"]]) expect(direct(to)).toBe("E1501");
  });

  it("throws E1501 inside a router", async () => {
    for (const to of BAD) expect(await inside(to), JSON.stringify(to)).toBe("E1501");
  });

  it("for any generated `//`-led, scheme-led or control-character string, the Form throws E1501", () => {
    const tail = fc.stringMatching(/^[a-z0-9./]{0,8}$/);
    const bad = fc.oneof(
      tail.map((t) => `//${t}`),
      tail.map((t) => `/\\${t}`),
      tail.map((t) => `https://${t}`),
      tail.map((t) => `javascript:${t}`),
      tail.map((t) => `/${t}\u0085`),
    );
    fc.assert(
      fc.property(bad, (to) => {
        expect(direct(to), JSON.stringify(to)).toBe("E1501");
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
