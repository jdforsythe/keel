// @vitest-environment happy-dom
// k.place, Runtime "A text binding whose value is a node, an array holding one, or a function renders `''`, in every mode (a function's source is never written). In `'dev'` mode the client writes one `console.warn` line per binding, starting `E1406` and holding the element id and `renders nothing`; a dev server's `createApp` logs one `diag` record with E1406 and the route id the first time a route renders one (k.server Log). Production writes nothing."
// Spec: k.place, clause "In `'dev'` mode a mounted text binding given a node, an array holding one and a function each writes one `console.warn` starting `E1406` with the element id, once over two updates, and renders `''`; in production, `''` and no line. A dev `createApp` serving such a route twice logs one `diag` E1406 with its route id; production none."
// Seed 1337 (the property below). A hand-built component binds `text(el, () => value.get())` to an element with an id,
// as compiled code does; `mount` takes `mode`. `console.warn` is spied.
import { createCtx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { clone, template, text } from "@keel/runtime-dom/ops";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED, flush, inScope } from "./fixtures.ts";
const simCtx = createCtx({ mode: "sim", seed: 1337 });

type Value = unknown;
type Mode = "dev" | "production";

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  document.body.innerHTML = "";
});

const lines = (): string[] => warn.mock.calls.map((c: unknown[]) => c.map(String).join(" "));
const placed = (): string[] => lines().filter((l) => l.startsWith("E1406"));

const T = template('<div><span id="t1"> </span><span id="t2"> </span></div>');

/** Mounts a component with one or two text bindings (`t1`, `t2`) over signals and returns them. */
function open(mode: Mode, first: Value, second: Value = "s") {
  const a = inScope(() => signal<Value>(first));
  const b = inScope(() => signal<Value>(second));
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = mount(
    () => {
      const root = clone(T);
      const one = root.querySelector("#t1");
      const two = root.querySelector("#t2");
      if (one === null || two === null) throw new Error("fixture: template lacks the spans");
      // `text` types its value narrowly; a node or a function reaches it from untyped code, so the call goes through `Reflect.apply`.
      Reflect.apply(text, undefined, [one, () => a.value.get()]);
      Reflect.apply(text, undefined, [two, () => b.value.get()]);
      return root;
    },
    host,
    { mode, ctx: simCtx },
  );
  const out = (id: string): string => host.querySelector(id)?.textContent ?? "missing";
  return { a: a.value, b: b.value, out, dispose };
}

const el = (): Node => document.createElement("b");
const KINDS: ReadonlyArray<readonly [string, () => Value]> = [
  ["a node", el],
  ["an array holding a node", () => [el()]],
  ["a function", () => () => "x"],
];

describe("k.place Runtime: in 'dev' mode a text binding that would render nothing writes one console.warn line", () => {
  for (const [what, make] of KINDS) {
    it(`given ${what} and then another, it writes one \`console.warn\` starting E1406 holding the element id, and renders ''`, async () => {
      const t = open("dev", "start");
      expect(placed()).toEqual([]);
      t.a.set(make());
      await flush();
      expect(t.out("#t1")).toBe("");
      t.a.set(make());
      await flush();
      expect(t.out("#t1")).toBe("");
      const found = placed();
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("t1");
      expect(found[0]).toContain("renders nothing");
      t.dispose();
    });

    it(`given ${what} at mount, it writes one line and renders ''`, async () => {
      const t = open("dev", make());
      await flush();
      expect(t.out("#t1")).toBe("");
      expect(placed()).toHaveLength(1);
      expect(placed()[0]).toContain("t1");
      t.dispose();
    });
  }

  it("one binding given a node, then an array holding one, then a function writes one line over all three updates, each rendering ''", async () => {
    const t = open("dev", "start");
    for (const [, make] of KINDS) {
      t.a.set(make());
      await flush();
      expect(t.out("#t1")).toBe("");
    }
    expect(placed()).toHaveLength(1);
    t.dispose();
  });

  it("a second such binding writes a second line, holding its own element id", async () => {
    const t = open("dev", "start", "start");
    t.a.set(el());
    await flush();
    t.b.set(() => "x");
    await flush();
    const found = placed();
    expect(found).toHaveLength(2);
    expect(found[0]).toContain("t1");
    expect(found[1]).toContain("t2");
    t.dispose();
  });

  it("any sequence of node, array and function values writes exactly one line per binding that ever held one", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(0, 1, 2, 3), { minLength: 1, maxLength: 8 }),
        fc.array(fc.constantFrom(0, 1, 2, 3), { minLength: 1, maxLength: 8 }),
        (xs, ys) => {
          warn.mockClear();
          const pick = (i: number): Value => (i === 0 ? "text" : (KINDS[i - 1]?.[1]() ?? "text"));
          const t = open("dev", "start", "start");
          for (const i of xs) t.a.set(pick(i));
          for (const i of ys) t.b.set(pick(i));
          const expected = Number(xs.some((i) => i > 0)) + Number(ys.some((i) => i > 0));
          expect(placed()).toHaveLength(expected);
          t.dispose();
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });
});

describe("k.place Runtime: a function value never writes its source", () => {
  for (const mode of ["dev", "production"] as const) {
    it(`in ${mode} mode a function renders '' and none of its source`, async () => {
      const fn = (): string => "secret-source-text";
      const t = open(mode, fn);
      await flush();
      expect(t.out("#t1")).toBe("");
      t.a.set(() => "other");
      await flush();
      expect(t.out("#t1")).toBe("");
      expect(document.body.textContent ?? "").not.toContain("secret-source-text");
      expect(document.body.textContent ?? "").not.toContain("=>");
      t.dispose();
    });
  }
});

describe("k.place Runtime: in production a node, an array holding one and a function render '' and write no line", () => {
  for (const [what, make] of KINDS) {
    it(`given ${what} the text is '' and no line is written`, async () => {
      const t = open("production", "start");
      t.a.set(make());
      await flush();
      expect(t.out("#t1")).toBe("");
      t.a.set(make());
      await flush();
      expect(t.out("#t1")).toBe("");
      expect(lines()).toEqual([]);
      t.dispose();
    });
  }

  it("a mount with no `mode` writes no line for a node, an array holding one and a function", async () => {
    const t = open("production", el());
    await flush();
    expect(lines()).toEqual([]);
    t.dispose();
  });
});

describe("k.place Runtime: a string, a number, null and false write no line", () => {
  const SAFE: ReadonlyArray<readonly [string, Value, string]> = [
    ["a string", "hello", "hello"],
    ["an empty string", "", ""],
    ["a number", 42, "42"],
    ["zero", 0, "0"],
    ["null", null, ""],
    ["undefined", undefined, ""],
    ["false", false, ""],
  ];
  for (const mode of ["dev", "production"] as const) {
    for (const [what, value, shown] of SAFE) {
      it(`${what} in ${mode} mode renders ${JSON.stringify(shown)} with no line`, async () => {
        const t = open(mode, value);
        await flush();
        expect(t.out("#t1")).toBe(shown);
        t.a.set("again");
        await flush();
        expect(t.out("#t1")).toBe("again");
        expect(lines()).toEqual([]);
        t.dispose();
      });
    }
  }

  it("for any string or integer, dev mode writes no line and renders its text", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ maxLength: 12 }), fc.integer()), (v) => {
        warn.mockClear();
        const t = open("dev", v);
        expect(t.out("#t1")).toBe(String(v));
        expect(lines()).toEqual([]);
        t.dispose();
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});
