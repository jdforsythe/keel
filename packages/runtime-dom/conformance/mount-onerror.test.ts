import { mount } from "@keel/runtime-dom";
import { clone, on, template } from "@keel/runtime-dom/ops";
// @vitest-environment happy-dom
// Spec: k.runtime, clause "`mount` `onError` receives the error the root boundary rendered."
// Also API (mount options). Seed: 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, click, flush, inScope } from "./fixtures.ts";

const T = template('<div id="root"><button id="b">x</button></div>');

describe("k.runtime: mount onError receives the error the root boundary rendered", () => {
  it("a render throw calls onError once with the error whose message the fallback shows", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (msg) => {
        const el = document.createElement("div");
        const seen: { code: string; message: string; data: { at: string } }[] = [];
        const h = inScope(() =>
          mount(
            () => {
              throw new Error(msg);
            },
            el,
            { onError: (e) => seen.push(e) },
          ),
        );
        expect(seen).toHaveLength(1);
        expect(seen[0]?.code).toBe("keel.unexpected");
        const pre = el.querySelector("pre[data-k-error]");
        expect(pre?.textContent).toBe(seen[0]?.message);
        expect(pre?.getAttribute("data-k-error")).toBe(seen[0]?.data.at);
        h.value();
        h.dispose();
      }),
      { seed: SEED },
    );
  });

  it("a handler throw after mount calls onError with the rendered error", async () => {
    const el = document.createElement("div");
    const seen: { message: string }[] = [];
    const h = inScope(() =>
      mount(
        () => {
          const r = clone(T);
          on("b", "click", () => {
            throw new Error("boom");
          });
          return r;
        },
        el,
        { onError: (e) => seen.push(e) },
      ),
    );
    expect(seen).toHaveLength(0);
    click(el.querySelector("#b") ?? el);
    await flush();
    expect(seen).toHaveLength(1);
    expect(el.querySelector("pre[data-k-error]")?.textContent).toBe(seen[0]?.message);
    h.value();
    h.dispose();
  });

  it("without a throw onError is never called", () => {
    const el = document.createElement("div");
    let calls = 0;
    const h = inScope(() =>
      mount(() => clone(T), el, {
        onError: () => {
          calls++;
        },
      }),
    );
    expect(calls).toBe(0);
    h.value();
    h.dispose();
  });
});
