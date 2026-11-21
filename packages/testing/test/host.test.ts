// @vitest-environment happy-dom
// k.host-element Harness and replay: a host element in `render` never loads its code; `find` gives its encoded value;
// `fire` `emit` reaches `onEvent` and the ctx observers, and rejects with `schema.invalid` on any other element.
// Seed 1337 for the property.
import { createCtx, observe } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import { s } from "@keel/schema";
import { Host } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { render } from "../src/render.ts";

const Input = s.object({ day: s.string() });
const Pick = s.object({ at: s.number() });
const Props = s.object({ day: s.string() });

const picked: { at: number }[] = [];
const Picker = Object.assign(
  (p: { day: string }): Node => {
    const root = document.createElement("div");
    const label = document.createElement("p");
    label.id = "k.label";
    label.textContent = "Day";
    root.append(
      label,
      Host({
        id: "k.host",
        role: "group",
        labelledBy: "k.label",
        input: Input,
        value: { day: p.day },
        events: Pick,
        onEvent: (e: { at: number }) => void picked.push(e),
        code: () => Promise.reject(new Error("host element code was loaded")),
      }),
    );
    return root;
  },
  { Props },
);

describe("the harness and the host element", () => {
  it("property: `find` shows the value encoded and `fire` `emit` reports a `fire` and calls `onEvent`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 8 }), fc.integer(), async (day, at) => {
        picked.length = 0;
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const seen: CtxEvent[] = [];
        observe(ctx, (e) => seen.push(e));
        const t = render(Picker, { props: { day }, ctx });
        expect(t.find("k.host")).toEqual({
          id: "k.host",
          role: "group",
          name: "Day",
          text: "",
          state: {},
          value: { day },
        });
        await t.fire("k.host", { type: "emit", detail: { at } });
        expect(picked).toEqual([{ at }]);
        expect(seen.filter((e) => e.kind === "fire")).toEqual([
          { kind: "fire", id: "k.host", event: { type: "emit", detail: { at } } },
        ]);
        t.dispose();
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("`fire` `emit` on an element that is no host element rejects with `schema.invalid`", async () => {
    const t = render(Picker, { props: { day: "x" }, ctx: createCtx({ mode: "sim", seed: 1337 }) });
    await expect(t.fire("k.label", { type: "emit", detail: { at: 1 } })).rejects.toMatchObject({
      code: "schema.invalid",
    });
    t.dispose();
  });
});
