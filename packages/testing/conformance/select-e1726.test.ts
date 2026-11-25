// @vitest-environment happy-dom
// k.testing Rules "E1726 `fire` `change` with `value` a person cannot pick (`<id> has no enabled option with that value`; `<id> takes no value on change: not a single select`)"
// Spec: k.testing, clause "`change` with a `value` of no option or of a disabled one rejects E1726 `<id> has no enabled option with that value`; on an `<input>` or a `multiple` select, E1726 `<id> takes no value on change: not a single select`; each with `data` `{ id, type: 'change' }`, no handler run, the value unchanged. `change` without `value` runs the `change` handler alone; `input` with `value` the `input` handler alone."
// The message omitting the value is RFC 0202 Proposal 3 ("Neither names the value"), not spec text.
// Seed: 1337 (fc.assert below). ASSUMED: the compact line is the error's `message` including its code, as E1705's is.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, attempt, log, messageOf, mount, valueNow } from "./select-support.ts";

const noOption = (id: string) => `E1726 ${id} has no enabled option with that value`;
const notSingle = (id: string) => `E1726 ${id} takes no value on change: not a single select`;

describe("k.testing: E1726 a pick a browser cannot make", () => {
  it("change with a value naming no option rejects E1726 `<id> has no enabled option with that value`, data { id, type: 'change' }, no handler run, the value unchanged", async () => {
    const t = mount();
    const e = await attempt(() => t.fire("sel", { type: "change", value: "nobody" }));
    expect(e).toMatchObject({ code: "E1726", data: { id: "sel", type: "change" } });
    expect(messageOf(e)).toBe(noOption("sel"));
    expect(log).toEqual([]);
    expect(valueNow("sel")).toBe("alex");
    t.dispose();
  });

  it("change with the value of a disabled option rejects E1726 `<id> has no enabled option with that value` and selects nothing", async () => {
    const t = mount();
    const e = await attempt(() => t.fire("sel", { type: "change", value: "kim" }));
    expect(e).toMatchObject({ code: "E1726", data: { id: "sel", type: "change" } });
    expect(messageOf(e)).toBe(noOption("sel"));
    expect(log).toEqual([]);
    expect(valueNow("sel")).toBe("alex");
    t.dispose();
  });

  it("any value naming no enabled option is refused and its text is not in the message (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Z]{8,12}$/), async (value) => {
        const t = mount();
        const e = await attempt(() => t.fire("sel", { type: "change", value }));
        expect(e).toMatchObject({ code: "E1726", data: { id: "sel", type: "change" } });
        expect(messageOf(e)).toBe(noOption("sel"));
        expect(messageOf(e)).not.toContain(value);
        expect(log).toEqual([]);
        expect(valueNow("sel")).toBe("alex");
        t.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("change with a value on an input rejects E1726 `<id> takes no value on change: not a single select`, no handler run, the value unchanged", async () => {
    const t = mount();
    const e = await attempt(() => t.fire("txt", { type: "change", value: "x" }));
    expect(e).toMatchObject({ code: "E1726", data: { id: "txt", type: "change" } });
    expect(messageOf(e)).toBe(notSingle("txt"));
    expect(log).toEqual([]);
    expect(valueNow("txt")).toBe("t");
    t.dispose();
  });

  it("change with a value on a multiple select rejects E1726 `<id> takes no value on change: not a single select`, no handler run", async () => {
    const t = mount();
    const e = await attempt(() => t.fire("multi", { type: "change", value: "sam" }));
    expect(e).toMatchObject({ code: "E1726", data: { id: "multi", type: "change" } });
    expect(messageOf(e)).toBe(notSingle("multi"));
    expect(log).toEqual([]);
    const multi = document.getElementById("multi");
    expect(multi instanceof HTMLSelectElement ? [...multi.selectedOptions].length : -1).toBe(0);
    t.dispose();
  });

  it("change without value on the select runs its change handler alone and leaves the value", async () => {
    const t = mount();
    await t.fire("sel", { type: "change" });
    expect(log.filter((l) => /^(input|change):sel=/.test(l))).toEqual(["change:sel=alex@sel"]);
    expect(valueNow("sel")).toBe("alex");
    t.dispose();
  });

  it("input with value sam runs the select's input handler alone", async () => {
    const t = mount();
    await t.fire("sel", { type: "input", value: "sam" });
    expect(log.filter((l) => /^(input|change):sel=/.test(l))).toEqual(["input:sel=sam@sel"]);
    t.dispose();
  });
});
