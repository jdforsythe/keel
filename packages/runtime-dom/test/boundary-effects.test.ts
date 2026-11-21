// @vitest-environment happy-dom
// Property seed: 1337. k.errors Boundaries: throws from app-level effect/computed (via k.reactive scope onError),
// and the app root's default Boundary installed by mount.
import { computed, effect } from "@keel/reactive";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { boundary, clone, on, template } from "../src/ops/index.ts";
import { SEED, fire, rootSignal } from "./support.ts";
import { testCtx } from "./testCtx.ts";

const ROOT = template('<div id="root"><p id="before">before</p><i id="mid"></i><p id="after">after</p></div>');
const BODY = template('<div id="body">ok</div>');
const FALLBACK = template('<p id="fallback">F</p>');

type Seen = { code: string; message: string; at: string };

const app = (child: () => void, seen: Seen[], resets: (() => void)[]) => () => {
  const r = clone(ROOT);
  const mid = r.querySelector("#mid");
  if (mid === null) throw new Error("fixture: no #mid");
  boundary(
    mid,
    () => {
      const b = clone(BODY);
      child();
      return b;
    },
    (e, reset) => {
      seen.push({ code: e.code, message: e.message, at: e.data.at });
      resets.push(reset);
      return clone(FALLBACK);
    },
  );
  return r;
};

describe("Boundary catches app-level effect and computed throws", () => {
  it("an effect that throws on a later write renders the fallback; outside is unchanged; it never runs again", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), fc.array(fc.integer(), { maxLength: 4 }), (bad, later) => {
        const s = rootSignal(0);
        let runs = 0;
        const seen: Seen[] = [];
        const host = document.createElement("div");
        const dispose = mount(
          app(
            () =>
              effect(() => {
                runs++;
                if (s.get() === bad) throw new Error(`bad ${bad}`);
              }),
            seen,
            [],
          ),
          host,
          { ctx: testCtx },
        );
        expect(host.querySelector("#body")).not.toBeNull();
        s.set(bad);
        expect(host.querySelector("#fallback")).not.toBeNull();
        expect(host.querySelector("#body")).toBeNull();
        expect(host.querySelector("#before")?.textContent).toBe("before");
        expect(host.querySelector("#after")?.textContent).toBe("after");
        expect(host.querySelector("[data-k-error]")).toBeNull();
        expect(seen).toEqual([{ code: "keel.unexpected", message: `bad ${bad}`, at: "mid" }]);
        const after = runs;
        for (const v of later) s.set(v === bad ? v + 1 : v);
        expect(runs).toBe(after);
        dispose();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("a computed that throws, read inside an effect, renders the fallback the same way", () => {
    const s = rootSignal(0);
    const seen: Seen[] = [];
    const host = document.createElement("div");
    const dispose = mount(
      app(
        () => {
          const c = computed(() => {
            if (s.get() > 0) throw new Error("computed broke");
            return s.get();
          });
          effect(() => {
            c.get();
          });
        },
        seen,
        [],
      ),
      host,
      { ctx: testCtx },
    );
    s.set(1);
    expect(host.querySelector("#fallback")).not.toBeNull();
    expect(host.querySelector("#before")?.textContent).toBe("before");
    expect(seen.map((x) => x.message)).toEqual(["computed broke"]);
    dispose();
  });

  it("reset() re-creates the subtree and its effects; a new throw renders the fallback again", () => {
    const s = rootSignal(0);
    let created = 0;
    const seen: Seen[] = [];
    const resets: (() => void)[] = [];
    const host = document.createElement("div");
    const dispose = mount(
      app(
        () => {
          created++;
          effect(() => {
            if (s.get() > 0) throw new Error(`n${s.get()}`);
          });
        },
        seen,
        resets,
      ),
      host,
      { ctx: testCtx },
    );
    s.set(1);
    s.set(0);
    resets[0]?.();
    expect(created).toBe(2);
    expect(host.querySelector("#body")).not.toBeNull();
    s.set(2);
    expect(host.querySelector("#fallback")).not.toBeNull();
    expect(seen.map((x) => x.message)).toEqual(["n1", "n2"]);
    dispose();
  });
});

describe("mount installs a default root Boundary", () => {
  it("a render throw shows keel.unexpected in <pre data-k-error>, and the message with mode dev", () => {
    for (const [mode, text] of [
      [undefined, "keel.unexpected"],
      ["production", "keel.unexpected"],
      ["dev", "app broke"],
    ] as const) {
      const host = document.createElement("div");
      const dispose = mount(
        () => {
          throw new Error("app broke");
        },
        host,
        mode === undefined ? { ctx: testCtx } : { ctx: testCtx, mode },
      );
      const pre = host.querySelector("pre[data-k-error]");
      expect(pre?.textContent).toBe(text);
      dispose();
      expect(host.childNodes.length).toBe(0);
    }
  });

  it("handler and app-effect throws outside any Boundary reach the root one", () => {
    const s = rootSignal(0);
    const T = template('<div id="app"><button id="go">go</button></div>');
    for (const how of ["handler", "effect"]) {
      const host = document.createElement("div");
      const dispose = mount(
        () => {
          const r = clone(T);
          on("go", "click", () => {
            throw new Error("handler broke");
          });
          effect(() => {
            if (s.get() === 1) throw new Error("effect broke");
          });
          return r;
        },
        host,
        { ctx: testCtx, mode: "dev" },
      );
      if (how === "handler") {
        const go = host.querySelector("#go");
        if (go === null) throw new Error("no #go");
        fire(go, "click");
      } else s.set(1);
      const pre = host.querySelector("pre[data-k-error]");
      expect(pre?.textContent).toBe(`${how} broke`);
      expect(host.querySelector("#app")).toBeNull();
      s.set(0);
      dispose();
    }
  });
});
