// @vitest-environment happy-dom
// Property seed: 1337. Each resumed island has its own root Boundary (k.errors): a throw in one island reports once,
// replaces only that island, and leaves the others live.
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { effect, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { eventQueue } from "../src/internal/eventQueue.ts";
import { clone, on, resume, template, text } from "../src/ops/index.ts";
import { SEED, rootSignal } from "./support.ts";

const MAX = 5;
const islandHtml = (i: number): string =>
  `<div data-k-island="I${i}"><button id="i${i}.inc" data-k="i${i}.inc">0</button>` +
  `<button id="i${i}.boom" data-k="i${i}.boom">x</button></div>`;
const TEMPLATES = Array.from({ length: MAX }, (_, i) => template(islandHtml(i)));
const kState = (ids: readonly string[]): string =>
  `<script type="application/json" id="k-state">${JSON.stringify({
    stores: {},
    islands: Object.fromEntries(ids.map((id) => [id, {}])),
  })}</script>`;

const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};
const need = (sel: string): Element => {
  const el = document.querySelector(sel);
  if (el === null) throw new Error(`fixture: missing ${sel}`);
  return el;
};

/** Island `i`: a counter, a button whose handler throws, and an effect that throws while `bad` is `i`. */
const islandOf = (i: number, bad: Signal<number>) => (): Node => {
  const t = TEMPLATES[i];
  if (t === undefined) throw new Error("fixture: no template");
  const root = clone(t);
  const n = signal(0);
  const inc = root.querySelector(`#i${i}\\.inc`);
  if (inc === null) throw new Error("fixture: template lacks the counter");
  text(inc, () => String(n.get()));
  on(`i${i}.inc`, "click", () => n.set(n.get() + 1));
  on(`i${i}.boom`, "click", () => {
    throw new Error(`boom ${i}`);
  });
  effect(() => {
    if (bad.get() === i) throw new Error(`fx ${i}`);
  });
  return root;
};

const observed = (): { ctx: ReturnType<typeof createCtx>; errors: () => CtxEvent[] } => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => void events.push(e));
  return { ctx, errors: () => events.filter((e) => e.kind === "error") };
};

describe("resumed islands each have a root Boundary", () => {
  it("a throw in one of N islands reports once, replaces only that island, and the others keep handling events", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX }).chain((n) =>
          fc.record({
            n: fc.constant(n),
            k: fc.integer({ min: 0, max: n - 1 }),
            kind: fc.constantFrom("handler", "effect"),
          }),
        ),
        ({ n, k, kind }) => {
          const ids = Array.from({ length: n }, (_, i) => `I${i}`);
          document.body.innerHTML = ids.map((_, i) => islandHtml(i)).join("") + kState(ids);
          const bad = rootSignal(-1);
          const { ctx, errors } = observed();
          const components = Object.fromEntries(ids.map((id, i) => [id, islandOf(i, bad)]));
          expect(resume(document.body, components, { ctx }).warnings).toEqual([]);

          if (kind === "handler") expect(() => click(need(`#i${k}\\.boom`))).not.toThrow();
          else expect(() => bad.set(k)).not.toThrow();

          expect(errors()).toHaveLength(1);
          const [e] = errors();
          if (e === undefined || e.kind !== "error") throw new Error("expected an error event");
          expect(e.error.code).toBe("keel.unexpected");
          // An effect throw is at no element of its own: the stamp at the island's place, "" under `document.body`.
          const at = kind === "handler" ? `i${k}.boom` : "";
          expect(e.error.data).toMatchObject({ at });
          expect(document.querySelectorAll("pre[data-k-error]")).toHaveLength(1);
          expect(need(`pre[data-k-error="${at}"]`).textContent).toBe(kind === "handler" ? `boom ${k}` : `fx ${k}`);
          expect(document.querySelector(`[data-k-island="I${k}"]`)).toBeNull();

          for (let i = 0; i < n; i++) {
            if (i === k) continue;
            const inc = need(`#i${i}\\.inc`);
            click(inc);
            click(inc);
            expect(inc.textContent).toBe("2");
          }
          bad.set(-1);
          bad.set(k);
          expect(errors()).toHaveLength(1);
          document.body.innerHTML = "";
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });
});

// Island "F": its server markup has a `<section>` where the template has a `<div>`, so the claim is a mismatch
// (E1253) and the island re-renders on the client, where the component throws.
const F_T = template('<div data-k-island="F"><button id="f.go" data-k="f.go">go</button></div>');
const F_SERVER = '<section data-k-island="F"><button id="f.go" data-k="f.go">go</button></section>';
const F = (): Node => {
  clone(F_T);
  throw new Error("client boom");
};

describe("a resumed island whose client re-render throws", () => {
  it("drops a click queued before resume, renders the root fallback, and reports once", () => {
    eventQueue.install();
    document.body.innerHTML = F_SERVER + kState(["F"]);
    const before = eventQueue.pending();
    click(need("#f\\.go"));
    expect(eventQueue.pending()).toBe(before + 1);
    const { ctx, errors } = observed();
    const { warnings } = resume(document.body, { F }, { ctx });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^E1253 /);
    expect(eventQueue.pending()).toBe(before);
    expect(errors()).toHaveLength(1);
    expect(need('pre[data-k-error=""]').textContent).toBe("client boom");
    expect(document.querySelector('[data-k-island="F"]')).toBeNull();
    document.body.innerHTML = "";
  });
});

describe("an observer that throws on the error event", () => {
  it("does not stop the root fallback, and the error is reported once", () => {
    document.body.innerHTML = islandHtml(0) + kState(["I0"]);
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const seen: CtxEvent[] = [];
    observe(ctx, (e) => {
      if (e.kind !== "error") return;
      seen.push(e);
      throw new Error("observer boom");
    });
    resume(document.body, { I0: islandOf(0, rootSignal(-1)) }, { ctx });
    expect(() => click(need("#i0\\.boom"))).not.toThrow();
    expect(seen).toHaveLength(1);
    expect(need('pre[data-k-error="i0.boom"]').textContent).toBe("boom 0");
    expect(document.querySelector('[data-k-island="I0"]')).toBeNull();
    document.body.innerHTML = "";
  });
});

// Island "C": its first render (the claim) creates an effect that throws at once; the client re-render does not.
const C_T = template('<div data-k-island="C"><button id="c.inc" data-k="c.inc">0</button></div>');

describe("a throw while claiming", () => {
  it("is a mismatch: the island re-renders on the client and nothing is reported", () => {
    document.body.innerHTML = `<div data-k-island="C"><button id="c.inc" data-k="c.inc">0</button></div>${kState(["C"])}`;
    let calls = 0;
    const C = (): Node => {
      const first = calls++ === 0;
      const root = clone(C_T);
      const n = signal(0);
      const inc = root.querySelector("#c\\.inc");
      if (inc === null) throw new Error("fixture: template lacks the counter");
      text(inc, () => String(n.get()));
      on("c.inc", "click", () => n.set(n.get() + 1));
      effect(() => {
        if (first) throw new Error("claim boom");
      });
      return root;
    };
    const { ctx, errors } = observed();
    const { warnings } = resume(document.body, { C }, { ctx });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^E1253 .*claim boom/);
    expect(errors()).toHaveLength(0);
    expect(document.querySelector("pre[data-k-error]")).toBeNull();
    const inc = need("#c\\.inc");
    click(inc);
    expect(inc.textContent).toBe("1");
    document.body.innerHTML = "";
  });
});

// Island "G": the client re-render (after a mismatch) returns a fragment of two elements.
const G_A = template('<p id="g.a">a</p>');
const G_B = template('<p id="g.b">b</p>');

describe("a client re-render that returns a fragment", () => {
  it("is replaced as a whole by the root fallback when an island effect throws", () => {
    document.body.innerHTML = `<section data-k-island="G"><p>a</p></section>${kState(["G"])}`;
    const bad = rootSignal(false);
    const G = (): Node => {
      const f = document.createDocumentFragment();
      f.append(clone(G_A), clone(G_B));
      effect(() => {
        if (bad.get()) throw new Error("fx G");
      });
      return f;
    };
    const { ctx, errors } = observed();
    expect(resume(document.body, { G }, { ctx }).warnings).toHaveLength(1);
    expect(document.querySelector("#g\\.a")).not.toBeNull();
    expect(() => bad.set(true)).not.toThrow();
    expect(errors()).toHaveLength(1);
    expect(need('pre[data-k-error=""]').textContent).toBe("fx G");
    expect(document.querySelector("#g\\.a")).toBeNull();
    expect(document.querySelector("#g\\.b")).toBeNull();
    document.body.innerHTML = "";
  });
});
