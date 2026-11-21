// @vitest-environment happy-dom
// Spec: k.host-element, Conformance "In the harness `find(id).value` equals the encoded value, `code` is never imported, and `a11y(id)` has `{ role: 'img', name: <label> }` with no children."
// Spec: k.host-element, Conformance "`fire(id, { type: 'emit', detail })` calls `onEvent` with the parsed detail; a session holding that event replays to the same `state()`." (the session half: packages/std-sessions/conformance/host-emit-replay.test.ts)
// Spec: k.host-element, Harness and replay "The harness never runs `code`. `find(id)` of a host element is `{ id, role, name, text: '', state: {}, value }`, `value` the latest value encoded by `input`'s codec; `a11y()` gives its node with no children. `fire(id, { type: 'emit', detail })` parses `detail` with `events` and calls `onEvent` as `emit` does (`schema.invalid` without `events` or on a mismatch); a session's `emit` replays the same way."
// Spec: k.host-element, Parse "Under `mount` or `resume` with `mode: 'dev'` (`keel dev`) and in the harness, `input` parses each value before `mount` or `update` gets it, and in the harness before `find(id).value` encodes it. A value that fails is a `KeelError` `schema.invalid` thrown to the nearest `Boundary` (`data.at` the element's id), and neither `mount` nor `update` runs with it."
// Seed: 1337. The element's `code` imports a file that does not exist: an import would reject, so a render that settles shows it never ran.
// Assumed: `fire` accepts `{ type: 'emit', detail }` and rejects with a KeelError `schema.invalid` as `render` does for bad props.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import type { Ctx } from "@keel/ctx";
import * as reactive from "@keel/reactive";
import * as runtimeDom from "@keel/runtime-dom";
import type { Slots } from "@keel/runtime-dom";
import { type Schema, s } from "@keel/schema";
import { render } from "@keel/testing";
import * as ui from "@keel/ui";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf, flatten, simCtx, thrown } from "./fixtures.ts";

const WITH_EVENTS = `
import { signal } from "@keel/reactive";
import { s } from "@keel/schema";
import { Host } from "@keel/ui";
const Input = s.object({ points: s.array(s.number()) });
const Emit = s.object({ at: s.number() });
export default function Chart(props: { points: number[]; label: string }) {
  const last = signal(-1);
  return (
    <div id="c.root">
      <Host id="c.chart" role="img" label={props.label} input={Input} events={Emit}
        value={{ points: props.points }} onEvent={(e: { at: number }) => last.set(e.at)}
        code={() => import("./neverLoaded.ts").then((m) => m.neverLoaded)} />
      <p id="c.last">{last.get()}</p>
    </div>
  );
}`;
const WITHOUT_EVENTS = `
import { s } from "@keel/schema";
import { Host } from "@keel/ui";
const Input = s.object({ points: s.array(s.number()) });
export default function Plain(props: { points: number[] }) {
  return <Host id="p.chart" role="group" label="Plain" input={Input} value={{ points: props.points }}
    code={() => import("./neverLoaded.ts").then((m) => m.neverLoaded)} />;
}`;
const BAD_VALUE = `
import { Boundary } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { Host } from "@keel/ui";
const Input = s.object({ points: s.array(s.number()) });
export default function Bad(props: { points: string }) {
  return (
    <Boundary fallback={(e) => <p id="c.fell">{e.code + "@" + e.data.at}</p>}>
      <Host id="c.chart" role="img" label="Chart" input={Input} value={{ points: props.points }}
        code={() => import("./neverLoaded.ts").then((m) => m.neverLoaded)} />
    </Boundary>
  );
}`;
const Props = s.object({ points: s.array(s.number()), label: s.string() });

const build = <P extends Record<string, unknown>>(name: string, source: string, props: Schema<P>) => {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const fn = evaluate(r.outputs[0]?.code ?? "", { "@keel/reactive": reactive, "@keel/ui": ui });
  if (typeof fn !== "function") throw new Error("fixture: no default export");
  return Object.assign(
    (p: P, slots?: Slots, ctx?: Ctx): Node => {
      const node: unknown = fn(p, slots, ctx);
      if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
      return node;
    },
    { Props: props },
  );
};
const chart = build<{ points: number[]; label: string }>("Chart", WITH_EVENTS, Props);
const plain = build<{ points: number[] }>("Plain", WITHOUT_EVENTS, s.object({ points: s.array(s.number()) }));
const labels = fc.stringMatching(/^[A-Za-z]{1,10}$/);

describe("k.host-element: harness", () => {
  it("in the harness a value that fails `input` is `schema.invalid` to the nearest `Boundary` with `data.at` the element's id", () => {
    const r = compile([{ path: "Bad.tsx", source: BAD_VALUE }]);
    expect(r.diagnostics).toEqual([]);
    const fn = evaluate(r.outputs[0]?.code ?? "", {
      "@keel/reactive": reactive,
      "@keel/ui": ui,
      "@keel/runtime-dom": runtimeDom,
    });
    if (typeof fn !== "function") throw new Error("fixture: no default export");
    const bad = Object.assign(
      (p: { points: string }, slots?: Slots, ctx?: Ctx): Node => {
        const node: unknown = fn(p, slots, ctx);
        if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
        return node;
      },
      { Props: s.object({ points: s.string() }) },
    );
    const t = render(bad, { props: { points: "not an array" }, ctx: simCtx() });
    expect(t.find("c.fell").text).toBe("schema.invalid@c.chart");
    t.dispose();
  });

  it("`find(id)` of a host element is `{ id, role, name, text: '', state: {}, value }`", () => {
    const t = render(chart, { props: { points: [1, 2], label: "Added" }, ctx: simCtx() });
    expect(t.find("c.chart")).toEqual({
      id: "c.chart",
      role: "img",
      name: "Added",
      text: "",
      state: {},
      value: { points: [1, 2] },
    });
    t.dispose();
  });

  it("property: `find(id).value` equals the value encoded by `input`, and `code` is never imported", () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { maxLength: 8 }), labels, (points, label) => {
        const t = render(chart, { props: { points, label }, ctx: simCtx() });
        expect(t.find("c.chart").value).toEqual({ points });
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`code` is never imported: the render settles with an import that would reject", async () => {
    const t = render(chart, { props: { points: [1], label: "Added" }, ctx: simCtx() });
    await t.settle();
    expect(t.find("c.chart").role).toBe("img");
    t.dispose();
  });

  it("`a11y(id)` has `{ role: 'img', name: <label> }` with no children", () => {
    fc.assert(
      fc.property(labels, (label) => {
        const t = render(chart, { props: { points: [1], label }, ctx: simCtx() });
        const node = flatten(t.a11y("c.chart")).find((n) => n.id === "c.chart");
        expect(node).toMatchObject({ role: "img", name: label });
        expect(node?.children ?? []).toEqual([]);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`fire(id, { type: 'emit', detail })` calls `onEvent` with the parsed detail", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -1000, max: 1000 }), async (at) => {
        const t = render(chart, { props: { points: [1], label: "Added" }, ctx: simCtx() });
        await t.fire("c.chart", { type: "emit", detail: { at } });
        expect(t.find("c.last").text).toBe(String(at));
        t.dispose();
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("`fire` `emit` with a detail that fails `events` is `schema.invalid` and calls nothing", async () => {
    const t = render(chart, { props: { points: [1], label: "Added" }, ctx: simCtx() });
    const e = await thrown(() => t.fire("c.chart", { type: "emit", detail: { at: "x" } }));
    expect(codeOf(e)).toBe("schema.invalid");
    expect(t.find("c.last").text).toBe("-1");
    t.dispose();
  });

  it("`fire` `emit` on a host element without `events` is `schema.invalid`", async () => {
    const t = render(plain, { props: { points: [1] }, ctx: simCtx() });
    const e = await thrown(() => t.fire("p.chart", { type: "emit", detail: { at: 1 } }));
    expect(codeOf(e)).toBe("schema.invalid");
    t.dispose();
  });
});
