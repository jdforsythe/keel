// @vitest-environment happy-dom
// Property seed: 1337. k.component: ctx (k.ctx) is passed by the runtime from the mount or island root.
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { clone, resume, template } from "../src/ops/index.ts";
import { SEED } from "./support.ts";

const T = template('<div data-k-island="C"><p id="p">x</p></div>');

describe("ctx from the root", () => {
  it("mount(C, el, { ctx }) passes ctx as the component's third argument; without it, undefined", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const seen: (Ctx | undefined)[] = [];
    const C = (_props: unknown, _slots?: unknown, c?: Ctx): Node => {
      seen.push(c);
      return clone(T);
    };
    const host = document.createElement("div");
    mount(C, host, { ctx })();
    mount(C, host)();
    expect(seen).toEqual([ctx, undefined]);
  });

  it("resume(root, components, { ctx }) passes ctx to every island root, and restores stores by id", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const seen: (Ctx | undefined)[] = [];
    const restored: unknown[] = [];
    const C = (_props: unknown, _slots?: unknown, c?: Ctx): Node => {
      seen.push(c);
      return clone(T);
    };
    const host = document.createElement("div");
    host.innerHTML = `${'<div data-k-island="C"><p id="p">x</p></div>'.repeat(2)}<script type="application/json" id="k-state">{"stores":{"cart":{"n":1},"gone":{}},"islands":{"C":{}}}</script>`;
    const { warnings } = resume(host, { C }, { ctx, stores: { cart: { restore: (s) => restored.push(s) } } });
    expect(seen).toEqual([ctx, ctx]);
    expect(restored).toEqual([{ n: 1 }]);
    expect(warnings).toEqual(['E1253 #k-state has a snapshot for unknown store "gone"']);
  });
});
