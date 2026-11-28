// @vitest-environment happy-dom
// k.place, Prop calls "In a component (k.component Shape), a JSX child expression that is a call of a member of the component's first parameter, `{props.icon()}` or `{props.icon?.()}`, alone or as the left of `??`, is a slot call, as `{props.children()}` is: the compiler places what it returns as content through a slot, in claim order (k.claim), and does not bind it as text. A node, an array of nodes or a fragment is placed; a string is placed as text. It renders once in its place (k.component Slot props, Build); for text that updates, bind a value that is not a prop call alone (`{props.label}`, `{String(props.count())}`). A computed member (`props[k]()`), a member of a member (`props.a.b()`) and a call of any other function are not slot calls."
// Spec: k.place, clause "`{props.label()}` with `label: () => 'Hi'` renders `Hi` once in its place; `{String(props.count())}` updates when the signal it reads changes."
// Seed 1337 (the properties below). Components are compiled in memory; the emitted operations are read from the output
// (`__k.slot` places content, `__k.text` binds text), and each case is also mounted.
import { createCtx } from "@keel/ctx";
import { compile } from "@keel/compiler";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { load, sigOf } from "./support.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const SEED = 1337;

/** The emitted code of a one-file compile, requiring no diagnostic. */
function codeOf(name: string, source: string): string {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("no output");
  return out.code;
}

const count = (code: string, op: string): number => code.split(`__k.${op}(`).length - 1;
const ops = (child: string, param = "props", extra = ""): string =>
  codeOf("P", `${extra}export default function P(${param}) { return <div>${child}</div> }\n`);

function host(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  return el;
}

const NAME = fc.stringMatching(/^[a-z][a-zA-Z]{0,7}$/).filter((n) => n !== "children" && n !== "slots");

describe("k.place Prop calls: a call of a member of the first parameter is a slot call", () => {
  test("`{props.icon()}` emits a slot and no text op", () => {
    const code = ops("{props.icon()}");
    expect(count(code, "slot")).toBe(1);
    expect(count(code, "text")).toBe(0);
  });

  test("`{props.icon?.()}` emits a slot and no text op", () => {
    const code = ops("{props.icon?.()}");
    expect(count(code, "slot")).toBe(1);
    expect(count(code, "text")).toBe(0);
  });

  test("`{props.icon() ?? 'x'}` emits a slot and no text op", () => {
    const code = ops("{props.icon() ?? 'x'}");
    expect(count(code, "slot")).toBe(1);
    expect(count(code, "text")).toBe(0);
  });

  test("`{props.icon?.() ?? 'x'}` emits a slot and no text op", () => {
    const code = ops("{props.icon?.() ?? 'x'}");
    expect(count(code, "slot")).toBe(1);
    expect(count(code, "text")).toBe(0);
  });

  test("the first parameter may have any name: `{p.icon()}` and `{ctxProps.icon()}` are slot calls", () => {
    for (const param of ["p", "ctxProps", "a"]) {
      const code = ops(`{${param}.icon()}`, param);
      expect(count(code, "slot")).toBe(1);
      expect(count(code, "text")).toBe(0);
    }
  });

  test("for any member name, `{props.<name>()}`, `{props.<name>?.()}` and `{props.<name>() ?? 1}` are slot calls", () => {
    fc.assert(
      fc.property(
        NAME,
        fc.constantFrom("{props.N()}", "{props.N?.()}", "{props.N() ?? 1}", "{props.N?.() ?? 'x'}"),
        (name, shape) => {
          const code = ops(shape.replaceAll("N", name));
          expect(count(code, "slot")).toBe(1);
          expect(count(code, "text")).toBe(0);
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });
});

describe("k.place Prop calls: the shapes that are not slot calls", () => {
  test("`{props[k]()}` (a computed member) emits a text op and no slot", () => {
    const code = ops("{props[k]()}", "props", "const k = 'icon'\n");
    expect(count(code, "text")).toBe(1);
    expect(count(code, "slot")).toBe(0);
  });

  test("`{props.a.b()}` (a member of a member) emits a text op and no slot", () => {
    const code = ops("{props.a.b()}");
    expect(count(code, "text")).toBe(1);
    expect(count(code, "slot")).toBe(0);
  });

  test("`{f()}` (a call of another function) emits a text op and no slot", () => {
    const code = ops("{f()}", "props", "function f() { return 'x' }\n");
    expect(count(code, "text")).toBe(1);
    expect(count(code, "slot")).toBe(0);
  });

  test("`{String(props.n())}` emits a text op and no slot", () => {
    const code = ops("{String(props.n())}");
    expect(count(code, "text")).toBe(1);
    expect(count(code, "slot")).toBe(0);
  });

  test("a call of a member of something that is not the first parameter is a text op: `{o.icon()}`, `{second.icon()}`", () => {
    const code = ops("{o.icon()}", "props", "const o = { icon: () => 'x' }\n");
    expect(count(code, "text")).toBe(1);
    expect(count(code, "slot")).toBe(0);
    const two = codeOf("Q", "export default function Q(props, second) { return <div>{second.icon()}</div> }\n");
    expect(count(two, "text")).toBe(1);
    expect(count(two, "slot")).toBe(0);
  });

  test("a prop call that is not alone is a text op: `{props.icon() || 'x'}`, `{props.icon() + 'x'}`, `{props.n() > 1 ? 'a' : 'b'}`", () => {
    for (const child of ["{props.icon() || 'x'}", "{props.icon() + 'x'}", "{props.n() > 1 ? 'a' : 'b'}"]) {
      const code = ops(child);
      expect(count(code, "text")).toBe(1);
      expect(count(code, "slot")).toBe(0);
    }
  });

  test("a prop that is not called stays a text op: `{props.label}`", () => {
    const code = ops("{props.label}");
    expect(count(code, "text")).toBe(1);
    expect(count(code, "slot")).toBe(0);
  });

  test("`{props.children()}` is still a slot call and `{props.a}` beside it a text op", () => {
    const code = ops("{props.children()}{props.a}");
    expect(count(code, "slot")).toBe(1);
    expect(count(code, "text")).toBe(1);
  });
});

describe("k.place Prop calls: what a slot call places, mounted", () => {
  const CARD = (child: string): string => `function Card(props) { return <section>${child}</section> }\n`;

  test("`{props.icon()}` places the element the prop returns inside the component's element", () => {
    const C = load(
      "PlaceOne",
      `${CARD("{props.icon()}")}export default function C() { return <Card icon={() => <b id="ic">i</b>} /> }\n`,
    );
    const el = host();
    mount(C, el, { ctx: simCtx });
    expect(el.querySelector("section > b#ic, section b#ic")).not.toBeNull();
  });

  test("`{props.icon?.()}` places the element when `icon` is given and nothing when it is absent", () => {
    const given = load(
      "PlaceOpt",
      `${CARD("{props.icon?.()}")}export default function C() { return <Card icon={() => <b id="ic">i</b>} /> }\n`,
    );
    const absent = load("PlaceOptNone", `${CARD("{props.icon?.()}")}export default function C() { return <Card /> }\n`);
    const a = host();
    mount(given, a, { ctx: simCtx });
    expect(a.querySelector("section b#ic")).not.toBeNull();
    const b = host();
    mount(absent, b, { ctx: simCtx });
    expect(b.querySelector("section")?.textContent).toBe("");
  });

  test("`{props.icon?.() ?? 'none'}` with `icon` absent places the text `none`", () => {
    const C = load(
      "PlaceNone",
      `${CARD("{props.icon?.() ?? 'none'}")}export default function C() { return <Card /> }\n`,
    );
    const el = host();
    mount(C, el, { ctx: simCtx });
    expect(el.querySelector("section")?.textContent).toBe("none");
  });

  test("`{props.icon()}` placing an array of two elements and a fragment places each, in order", () => {
    const arr = load(
      "PlaceArr",
      `${CARD("{props.icon()}")}export default function C() { return <Card icon={() => [<b id="a">a</b>, <i id="b">b</i>]} /> }\n`,
    );
    const frag = load(
      "PlaceFrag",
      `${CARD("{props.icon()}")}export default function C() { return <Card icon={() => <><b id="a">a</b><i id="b">b</i></>} /> }\n`,
    );
    for (const C of [arr, frag]) {
      const el = host();
      mount(C, el, { ctx: simCtx });
      expect([...(el.querySelector("section")?.children ?? [])].map((c) => c.id)).toEqual(["a", "b"]);
    }
  });

  test("`{props.label()}` with `label: () => 'Hi'` places `Hi` as text", () => {
    const C = load(
      "PlaceText",
      `${CARD("{props.label()}")}export default function C() { return <Card label={() => 'Hi'} /> }\n`,
    );
    const el = host();
    mount(C, el, { ctx: simCtx });
    expect(el.querySelector("section")?.textContent).toBe("Hi");
  });

  test("`{props.label()}` renders once: after the signal `label` reads changes, the text is unchanged", () => {
    const src = `import { signal } from '@keel/reactive'
const sig = signal('a')
function Card(props) { return <section>{props.label()}</section> }
function C() { return <Card label={() => sig.get()} /> }
C.sig = sig
export default C
`;
    const C = load("PlaceOnce", src);
    const sig = sigOf(C, "sig");
    const el = host();
    mount(C, el, { ctx: simCtx });
    expect(el.querySelector("section")?.textContent).toBe("a");
    sig.set("b");
    expect(el.querySelector("section")?.textContent).toBe("a");
  });

  test("`{String(props.count())}` updates when the signal it reads changes", () => {
    const src = `import { signal } from '@keel/reactive'
const sig = signal(0)
function Card(props) { return <section>{String(props.count())}</section> }
function C() { return <Card count={() => sig.get()} /> }
C.sig = sig
export default C
`;
    const C = load("PlaceUpdates", src);
    const sig = sigOf(C, "sig");
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (n) => {
        sig.set(0);
        const el = host();
        const dispose = mount(C, el, { ctx: simCtx });
        expect(el.querySelector("section")?.textContent).toBe("0");
        sig.set(n);
        expect(el.querySelector("section")?.textContent).toBe(String(n));
        dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a prop call inside `If` content places the element", () => {
    const src = `import { If } from '@keel/runtime-dom'
function Card(props) { return <section><If when={props.ok}>{props.icon()}</If></section> }
export default function C() { return <Card ok={true} icon={() => <b id="ic">i</b>} /> }
`;
    const el = host();
    mount(load("PlaceIf", src), el, { ctx: simCtx });
    expect(el.querySelector("section b#ic")).not.toBeNull();
  });
});
