import { mount } from "@keel/runtime-dom";
import { clone, on, template } from "@keel/runtime-dom/ops";
// @vitest-environment happy-dom
// Spec: k.runtime, clause "`mount` `onError` receives the error the root boundary rendered; its fallback shows the message only with `mode: 'dev'`."
// Also API (mount options). Seed: 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, click, flush, inScope } from "./fixtures.ts";

const T = template('<div id="root"><button id="b">x</button></div>');

describe("k.runtime: mount onError receives the error the root boundary rendered; its fallback shows the message only with mode dev", () => {
  it("a render throw calls onError once with the error while the fallback shows only keel.unexpected without mode", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (tail) => {
        const msg = `leak-${tail}`;
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
        expect(seen[0]?.message).toContain(msg);
        expect(pre?.textContent).toBe("keel.unexpected");
        expect(pre?.textContent).not.toContain(msg);
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
    expect(seen[0]?.message).toContain("boom");
    const text = el.querySelector("pre[data-k-error]")?.textContent;
    expect(text).toBe("keel.unexpected");
    expect(text).not.toContain("boom");
    h.value();
    h.dispose();
  });

  it("with mode dev the fallback shows the message the onError receives", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (tail) => {
        const msg = `leak-${tail}`;
        const el = document.createElement("div");
        const seen: { code: string; message: string; data: { at: string } }[] = [];
        const h = inScope(() =>
          mount(
            () => {
              throw new Error(msg);
            },
            el,
            { onError: (e) => seen.push(e), mode: "dev" },
          ),
        );
        expect(seen).toHaveLength(1);
        const pre = el.querySelector("pre[data-k-error]");
        expect(seen[0]?.message).toContain(msg);
        expect(pre?.textContent).toBe(seen[0]?.message);
        expect(pre?.textContent).toContain(msg);
        h.value();
        h.dispose();

        // The same throw without `mode` shows the production text, so `mode: "dev"` is what changes the fallback.
        const prod = document.createElement("div");
        const hp = inScope(() =>
          mount(
            () => {
              throw new Error(msg);
            },
            prod,
            { onError: () => undefined },
          ),
        );
        expect(prod.querySelector("pre[data-k-error]")?.textContent).toBe("keel.unexpected");
        hp.value();
        hp.dispose();
      }),
      { seed: SEED },
    );
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
