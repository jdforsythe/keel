// @vitest-environment happy-dom
// Spec: k.ui Conformance, "`fire(id, 'click')` on a Button with `onClick` calls the handler once; `fire(id, 'change')` on a Checkbox with `onChange` passes the new checked state". Seed: 1337.
// Real harness `fire`; the handlers are registered by the base elements through the runtime's delegated `on`.
import { render } from "@keel/testing";
import { Box, Button, Checkbox, Input, Select, TextArea } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";
import { page } from "./ui-fixtures.ts";

describe("k.ui: fire drives Button onClick and Checkbox onChange", () => {
  it("fire(id, click) on a Button with onClick calls the handler once per fire", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
        const calls: number[] = [];
        const t = render(
          page(() => Button({ id: "go", label: "Go", onClick: () => calls.push(1) })),
          { props: {}, ctx: simCtx() },
        );
        for (let i = 1; i <= n; i++) {
          await t.fire("go", { type: "click" });
          expect(calls).toHaveLength(i);
        }
        t.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("a Button without onClick does not throw on fire click", async () => {
    const t = render(
      page(() => Button({ id: "go", label: "Go" })),
      { props: {}, ctx: simCtx() },
    );
    await t.fire("go", { type: "click" });
    t.dispose();
  });

  it("fire on a Checkbox with onChange passes the new checked state, alternating true and false", async () => {
    const seen: boolean[] = [];
    const t = render(
      page(() => Checkbox({ id: "done", label: "Done", onChange: (c) => seen.push(c) })),
      { props: {}, ctx: simCtx() },
    );
    expect(t.find("done").state.checked).toBe(false);
    await t.fire("done", { type: "click" });
    expect(t.find("done").state.checked).toBe(true);
    await t.fire("done", { type: "click" });
    expect(seen).toEqual([true, false]);
    expect(t.find("done").state.checked).toBe(false);
    t.dispose();
  });

  it("fire(id, change) on a Checkbox passes the checked state the element holds at that moment", async () => {
    const seen: boolean[] = [];
    const t = render(
      page(() => Checkbox({ id: "done", label: "Done", onChange: (c) => seen.push(c) })),
      { props: {}, ctx: simCtx() },
    );
    await t.fire("done", { type: "change" });
    expect(seen).toEqual([t.find("done").state.checked ?? false]);
    t.dispose();
  });

  it("fire input passes the value to Input and TextArea, and fire change passes the value to Select", async () => {
    const seen: string[] = [];
    const C = page(() =>
      Box({
        children: [
          Input({ id: "i", label: "I", onInput: (v) => seen.push(`i:${v}`) }),
          TextArea({ id: "t", label: "T", onInput: (v) => seen.push(`t:${v}`) }),
          Select({
            id: "s",
            label: "S",
            options: [
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ],
            onChange: (v) => seen.push(`s:${v}`),
          }),
        ],
      }),
    );
    const t = render(C, { props: {}, ctx: simCtx() });
    await t.fire("i", { type: "input", value: "x" });
    await t.fire("t", { type: "input", value: "y" });
    await t.fire("s", { type: "input", value: "b" });
    await t.fire("s", { type: "change" });
    expect(seen.slice(0, 2)).toEqual(["i:x", "t:y"]);
    expect(seen).toContain("s:b");
    // Exact: the value passed equals the selected option value (one onChange call, from the change fire).
    expect(seen.filter((x) => x.startsWith("s:"))).toEqual(["s:b"]);
    t.dispose();
  });

  it("fire(id, change) on a Checkbox passes true after a click checks it and false after a second click unchecks it, equal to find(id).state.checked", async () => {
    const seen: boolean[] = [];
    const t = render(
      page(() => Checkbox({ id: "done", label: "Done", onChange: (c) => seen.push(c) })),
      { props: {}, ctx: simCtx() },
    );
    await t.fire("done", { type: "click" });
    expect(t.find("done").state.checked).toBe(true);
    seen.length = 0;
    await t.fire("done", { type: "change" });
    expect(seen).toEqual([true]);
    expect(seen[0]).toBe(t.find("done").state.checked);
    await t.fire("done", { type: "click" });
    expect(t.find("done").state.checked).toBe(false);
    seen.length = 0;
    await t.fire("done", { type: "change" });
    expect(seen).toEqual([false]);
    expect(seen[0]).toBe(t.find("done").state.checked);
    t.dispose();
  });
});
