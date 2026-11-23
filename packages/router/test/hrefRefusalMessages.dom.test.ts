// @vitest-environment happy-dom
// k.router Links: the E1501 a value that is no Href gets from `Form` and from `navigate`, by its message.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { describe, expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { contract } from "../src/contract/contract.ts";
import { createRouterWith } from "../src/internal/createRouterWith.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";

const HOSTILE = [
  "//evil.example/x",
  "/\\evil.example",
  "https://evil.example/",
  "javascript:alert(1)",
  "/a\u0001b",
  "",
];
const thrownBy = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
};

describe("a value that is no Href", () => {
  it("as a Form's action throws E1501 naming the prop, and renders no form", () => {
    for (const to of [...HOSTILE, 5, null, undefined, {}]) {
      const e = thrownBy(() => Reflect.apply(Form, undefined, [{ method: "POST", action: to, children: () => [] }]));
      expect(e).toBeInstanceOf(Error);
      expect(e instanceof Error ? e.message : "").toBe(
        "E1501 <Form action>: the value is no Href, a path of this origin",
      );
      expect(Reflect.get(Object(e), "code")).toBe("E1501");
    }
  });

  it("given to navigate rejects with E1501 naming navigate, and nothing moves", async () => {
    const c = contract("hm", { "hm.page": { path: "/hm" } });
    const routes = manifest(c, { "hm.page": { component: () => document.createElement("main") } });
    const left: string[] = [];
    const history = memoryHistory("/hm");
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const router = createRouterWith(routes, { ctx, history, leave: (u) => void left.push(u) });
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = mount(router.App, host, { ctx });
    for (const to of [...HOSTILE, 5, null, undefined]) {
      const e = await Reflect.apply(router.navigate, router, [to]).then(
        () => null,
        (x: unknown) => x,
      );
      expect(e instanceof Error ? e.message : "").toBe("E1501 navigate: the value is no Href, a path of this origin");
      expect(Reflect.get(Object(e), "code")).toBe("E1501");
    }
    expect([left, history.entries]).toEqual([[], ["/hm"]]);
    unmount();
    router.dispose();
    host.remove();
  });
});
