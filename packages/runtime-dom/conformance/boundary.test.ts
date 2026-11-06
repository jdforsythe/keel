import { effect, signal } from "@keel/reactive";
import { Boundary, mount } from "@keel/runtime-dom";
import { boundary, clone, on, template } from "@keel/runtime-dom/ops";
// @vitest-environment happy-dom
// Spec: k.errors Boundaries + Conformance (Boundary clauses). Property seed: 1337.
// Covered elsewhere: ok/err/attempt/s.result (packages/schema/conformance/result.test.ts),
// throwing transaction (packages/store/conformance/throws.test.ts).
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, click, flush, inScope } from "./fixtures.ts";

type Caught = { code: string; message: string; data: { at: string } };
const isCaught = (e: unknown): e is Caught =>
  typeof e === "object" &&
  e !== null &&
  "code" in e &&
  typeof e.code === "string" &&
  "data" in e &&
  typeof e.data === "object" &&
  e.data !== null &&
  "at" in e.data &&
  typeof e.data.at === "string";

const node = (html: string): Element => clone(template(html));
const para = (id: string, text: string): Node => node(`<p id="${id}">${text}</p>`);
const mark = (): Node => node('<span id="slot"></span>');

// App: <div id="host"> before | [outer boundary: inner stuff | inner boundary] | after </div>
// Each boundary anchors on a span and renders into that position.
type Opts = {
  inner: () => Node; // children of the inner boundary
  innerFallback: (e: unknown, reset: () => void) => Node;
  outerFallback?: (e: unknown, reset: () => void) => Node;
};
const setup = (o: Opts) => {
  const host = document.createElement("div");
  const dispose = mount(() => {
    const root = node('<div id="root"><p id="before">before</p><i id="mid"></i><p id="after">after</p></div>');
    const mid = root.querySelector("#mid");
    if (mid === null) throw new Error("fixture: no #mid");
    boundary(
      mid,
      () => {
        const r = node('<div id="outerbody"><b id="oslot"></b></div>');
        const slot = r.querySelector("#oslot");
        if (slot === null) throw new Error("fixture: no #oslot");
        boundary(slot, o.inner, o.innerFallback);
        return r;
      },
      o.outerFallback ?? (() => para("outer-fallback", "OUTER")),
    );
    return root;
  }, host);
  return { host, dispose };
};

const q = (host: Element, sel: string): Element | null => host.querySelector(sel);

describe("k.errors: Boundary", () => {
  it("Boundary is exported from @keel/runtime-dom", () => {
    expect(Boundary).toBeDefined();
  });

  it("a throw during a child's render renders the nearest enclosing Boundary's fallback", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (msg) => {
        const { host, dispose } = setup({
          inner: () => {
            throw new Error(msg);
          },
          innerFallback: () => para("inner-fallback", "INNER"),
        });
        expect(q(host, "#inner-fallback")).not.toBeNull();
        expect(q(host, "#inner-fallback")?.textContent).toBe("INNER");
        dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("content outside the catching boundary is unchanged when a child's render throws", () => {
    const { host, dispose } = setup({
      inner: () => {
        throw new Error("boom");
      },
      innerFallback: () => para("inner-fallback", "INNER"),
    });
    expect(q(host, "#before")?.textContent).toBe("before");
    expect(q(host, "#after")?.textContent).toBe("after");
    expect(q(host, "#outerbody")).not.toBeNull();
    dispose();
  });

  it("no outer fallback renders when an inner boundary catches", () => {
    const { host, dispose } = setup({
      inner: () => {
        throw new Error("boom");
      },
      innerFallback: () => para("inner-fallback", "INNER"),
    });
    expect(q(host, "#outer-fallback")).toBeNull();
    expect(host.textContent).not.toContain("OUTER");
    dispose();
  });

  it("the fallback receives a KeelError with code keel.unexpected", () => {
    const seen: unknown[] = [];
    const { dispose } = setup({
      inner: () => {
        throw new Error("boom");
      },
      innerFallback: (e) => {
        seen.push(e);
        return para("inner-fallback", "INNER");
      },
    });
    expect(seen.length).toBe(1);
    const e = seen[0];
    expect(isCaught(e)).toBe(true);
    if (isCaught(e)) {
      expect(e.code).toBe("keel.unexpected");
      expect(typeof e.message).toBe("string");
    }
    dispose();
  });

  it("the fallback's error data.at is the element id where the throw surfaced (event handler on element 'bad')", () => {
    // A render-time throw's `at` is an element id string (exact value is not specified for bare render throws);
    // the handler case below pins `at` to the handler's element id.
    const seen: unknown[] = [];
    const { host, dispose } = setup({
      inner: () => {
        const r = node('<div><button id="bad" data-k="bad">x</button></div>');
        on("bad", "click", () => {
          throw new Error("boom");
        });
        return r;
      },
      innerFallback: (e) => {
        seen.push(e);
        return para("inner-fallback", "INNER");
      },
    });
    const b = q(host, "#bad");
    if (b === null) throw new Error("no #bad");
    click(b);
    expect(seen.length).toBe(1);
    const e = seen[0];
    expect(isCaught(e)).toBe(true);
    if (isCaught(e)) expect(e.data.at).toBe("bad");
    dispose();
  });

  it("after a catch, no effect created in the failed subtree runs again", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer(), { minLength: 1, maxLength: 5 }), async (writes) => {
        const { value: s, dispose: endScope } = inScope(() => signal(-1));
        let runs = 0;
        const { dispose } = setup({
          inner: () => {
            effect(() => {
              s.get();
              runs++;
            });
            throw new Error("boom");
          },
          innerFallback: () => para("inner-fallback", "INNER"),
        });
        await flush();
        const before = runs;
        let last = -1;
        for (const w of writes) {
          // Always change the value so the signal notifies.
          last = w === last ? w + 1 : w;
          s.set(last);
          await flush();
        }
        expect(runs).toBe(before);
        dispose();
        endScope();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("after a catch from an event handler, effects created in the failed subtree do not run again", async () => {
    const { value: s, dispose: endScope } = inScope(() => signal(0));
    let runs = 0;
    const { host, dispose } = setup({
      inner: () => {
        const r = node('<div><button id="bad" data-k="bad">x</button></div>');
        effect(() => {
          s.get();
          runs++;
        });
        on("bad", "click", () => {
          throw new Error("boom");
        });
        return r;
      },
      innerFallback: () => para("inner-fallback", "INNER"),
    });
    const b = q(host, "#bad");
    if (b === null) throw new Error("no #bad");
    click(b);
    await flush();
    const before = runs;
    s.set(1);
    await flush();
    s.set(2);
    await flush();
    expect(runs).toBe(before);
    dispose();
    endScope();
  });

  it("reset() re-renders the children", async () => {
    let renders = 0;
    let shouldThrow = true;
    let doReset: () => void = () => {};
    const { host, dispose } = setup({
      inner: () => {
        renders++;
        if (shouldThrow) throw new Error("boom");
        return para("child", "CHILD");
      },
      innerFallback: (_e, reset) => {
        doReset = reset;
        return para("inner-fallback", "INNER");
      },
    });
    expect(renders).toBe(1);
    expect(q(host, "#inner-fallback")).not.toBeNull();
    shouldThrow = false;
    doReset();
    await flush();
    expect(renders).toBe(2);
    expect(q(host, "#child")?.textContent).toBe("CHILD");
    expect(q(host, "#inner-fallback")).toBeNull();
    dispose();
  });

  it("if the children throw again after reset(), the fallback renders again with the new error", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (resets) => {
        let n = 0;
        const seen: unknown[] = [];
        let doReset: () => void = () => {};
        const { host, dispose } = setup({
          inner: () => {
            n++;
            throw new Error(`boom-${n}`);
          },
          innerFallback: (e, reset) => {
            seen.push(e);
            doReset = reset;
            return para("inner-fallback", `INNER${seen.length}`);
          },
        });
        expect(seen.length).toBe(1);
        for (let i = 0; i < resets; i++) {
          doReset();
          await flush();
        }
        expect(seen.length).toBe(resets + 1);
        expect(q(host, "#inner-fallback")?.textContent).toBe(`INNER${resets + 1}`);
        for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
        const last = seen[seen.length - 1];
        expect(isCaught(last)).toBe(true);
        if (isCaught(last)) expect(last.code).toBe("keel.unexpected");
        expect(q(host, "#outer-fallback")).toBeNull();
        dispose();
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("a throw from an event handler inside the subtree is caught by the same boundary", () => {
    const { host, dispose } = setup({
      inner: () => {
        const r = node('<div><button id="bad" data-k="bad">x</button></div>');
        on("bad", "click", () => {
          throw new Error("boom");
        });
        return r;
      },
      innerFallback: () => para("inner-fallback", "INNER"),
    });
    expect(q(host, "#inner-fallback")).toBeNull();
    const b = q(host, "#bad");
    if (b === null) throw new Error("no #bad");
    click(b);
    expect(q(host, "#inner-fallback")).not.toBeNull();
    expect(q(host, "#outer-fallback")).toBeNull();
    expect(q(host, "#before")?.textContent).toBe("before");
    expect(q(host, "#after")?.textContent).toBe("after");
    dispose();
  });

  it("a rejected promise returned by an event handler is caught by the same boundary", async () => {
    const seen: unknown[] = [];
    const { host, dispose } = setup({
      inner: () => {
        const r = node('<div><button id="bad" data-k="bad">x</button></div>');
        on("bad", "click", () => Promise.reject(new Error("async boom")));
        return r;
      },
      innerFallback: (e) => {
        seen.push(e);
        return para("inner-fallback", "INNER");
      },
    });
    const b = q(host, "#bad");
    if (b === null) throw new Error("no #bad");
    click(b);
    await flush();
    await flush();
    expect(seen.length).toBe(1);
    expect(q(host, "#inner-fallback")).not.toBeNull();
    expect(q(host, "#outer-fallback")).toBeNull();
    const e = seen[0];
    expect(isCaught(e)).toBe(true);
    if (isCaught(e)) {
      expect(e.code).toBe("keel.unexpected");
      expect(e.data.at).toBe("bad");
    }
    dispose();
  });
});

// Untestable at runtime: E1451 `throw` in app code is a static check diagnostic (k.check).
it.todo("E1451 throw in app code");
// Untestable at runtime: E1452 try/catch or .catch() in app code is a static check diagnostic (k.check).
it.todo("E1452 try/catch or .catch() in app code");
// Untestable at runtime: E1453 discarded Result or Promise<Result> is a static check diagnostic (k.check).
it.todo("E1453 a Result or Promise<Result> discarded as an expression statement");
// Untestable at runtime: E1454 duplicate s.error codes is a static check diagnostic (k.check).
it.todo("E1454 two s.error declarations with the same code");
