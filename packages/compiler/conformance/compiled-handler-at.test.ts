// @vitest-environment happy-dom
// Spec: k.errors, clause "In a compiled module, a throwing `onClick` on a k.ui base element with a literal `id` (a `.tsx` tag or a `.ts` call `Button({ id: \"…\" })`) reports that id as `data.at`; with `id={expr}` and no stamped ancestor it reports `\"\"`; on a plain element it reports the element's compiler id."
// Seed 1337 (no random inputs: three fixed shapes).
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { on } from "@keel/runtime-dom/ops";
import { expect, test } from "vitest";
import { isMountable } from "./support.ts";

type Handler = () => unknown;

function isHandler(x: unknown): x is Handler {
  return typeof x === "function";
}

// Stand-in for the k.ui `Button` per its public contract: a <button>, `id` from props, `data-k=""` plus `on` when bound.
const ui = {
  Button(props: { id?: string; onClick?: Handler; children?: unknown }): Node {
    const el = document.createElement("button");
    const id = props.id;
    if (typeof id === "string") el.id = id;
    const handler = props.onClick;
    if (isHandler(handler)) {
      el.setAttribute("data-k", "");
      on(el, "click", handler);
    }
    const kids = props.children;
    const v = typeof kids === "function" ? kids() : kids;
    if (typeof v === "string") el.append(v);
    else if (v instanceof Node) el.append(v);
    return el;
  },
};

const boom = `const boom = (): void => { throw new Error("boom") }\n`;

function build(source: string, path: string): unknown {
  const r = compile([{ path, source }]);
  expect(r.diagnostics).toEqual([]);
  const first = r.outputs[0];
  if (first === undefined) throw new Error("no output");
  return evaluate(first.code, { "@keel/ui": ui });
}

async function clickIt(
  source: string,
  path = "modules/shop/Probe.tsx",
): Promise<{ at: unknown; count: number; compilerId: string }> {
  const C = build(source, path);
  if (!isMountable(C)) throw new Error("default export is not a component");
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const sc = scope(
    () => {
      mount(C, host, { ctx });
    },
    { detached: true },
  );
  const btn = host.querySelector("button");
  if (btn === null) throw new Error("fixture: missing button");
  const compilerId = btn.id;
  btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();
  const errs = events.filter((e) => e.kind === "error");
  const e = errs[0];
  if (e === undefined || e.kind !== "error") throw new Error("expected an error event");
  expect(e.error.code).toBe("keel.unexpected");
  const out = { at: Reflect.get(Object(e.error.data), "at"), count: errs.length, compilerId };
  sc.dispose();
  host.remove();
  return out;
}

test("a throwing onClick on a k.ui base element with a literal id reports that id as data.at", async () => {
  const r = await clickIt(
    `import { Button } from "@keel/ui"\n${boom}export default function C() { return <div><Button id="shop.buy" onClick={boom}>buy</Button></div> }\n`,
  );
  expect(r.count).toBe(1);
  expect(r.at).toBe("shop.buy");
});

test("a throwing onClick on a k.ui base element with id={expr} and no stamped ancestor reports the empty string, never the runtime id", async () => {
  const r = await clickIt(
    `import { Button } from "@keel/ui"\n${boom}const runtimeId = ["user", "example.com"].join("@")\nexport default function C() { return <div><Button id={runtimeId} onClick={boom}>x</Button></div> }\n`,
  );
  expect(r.count).toBe(1);
  expect(r.at).toBe("");
  expect(r.at).not.toBe("user@example.com");
});

test("a throwing onClick on a plain element reports the element's compiler id as data.at", async () => {
  const r = await clickIt(
    `${boom}export default function C() { return <div><button type="button" onClick={boom}>x</button></div> }\n`,
  );
  expect(r.count).toBe(1);
  expect(r.compilerId).toMatch(/^modules\.shop\.Probe\.\d+$/);
  expect(r.at).toBe(r.compilerId);
});

const tsProbe = (call: string, pre = ""): string =>
  `import { Button } from "@keel/ui"\n${boom}${pre}export default function C(): Node {\n  const d = document.createElement("div")\n  d.append(${call})\n  return d\n}\n`;

test("a throwing onClick on a Button({ id: literal }) call in a .ts module reports that id as data.at", async () => {
  const r = await clickIt(
    tsProbe(`Button({ id: "shop.buy", onClick: boom, children: "buy" })`),
    "modules/shop/Probe.ts",
  );
  expect(r.count).toBe(1);
  expect(r.at).toBe("shop.buy");
});

test("a throwing onClick on a Button({ id: runtimeId }) call in a .ts module reports the empty string, never the runtime id", async () => {
  const r = await clickIt(
    tsProbe(
      `Button({ id: runtimeId, onClick: boom, children: "x" })`,
      `const runtimeId = ["user", "example.com"].join("@")\n`,
    ),
    "modules/shop/Probe.ts",
  );
  expect(r.count).toBe(1);
  expect(r.at).toBe("");
  expect(r.at).not.toBe("user@example.com");
});
