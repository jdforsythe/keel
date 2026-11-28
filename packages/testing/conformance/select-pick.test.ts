// @vitest-environment happy-dom
// k.testing Harness "`change` with `value` is a person's pick in a `<select>` without `multiple`: the enabled option whose value is `value` becomes selected, then `input` (bubbling, composed) and `change` (bubbling) are dispatched at the select, in that order, each seeing the new value. A pick of the option already selected dispatches nothing."
// Spec: k.testing, clause "On a `<select>` of `alex` (selected) and `sam`, `fire(id, { type: 'change', value: 'sam' })` runs its `input` handler, then its `change` handler, each reading `sam`, and an ancestor's too; the same call again runs none."
// Seed: 1337 (fc.assert below).
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, log, mount, valueNow } from "./select-support.ts";

const own = (id: string) => log.filter((l) => l.startsWith(`input:${id}=`) || l.startsWith(`change:${id}=`));

describe("k.testing: a select pick fires input then change", () => {
  it("fire(id, { type: 'change', value: 'sam' }) runs the select's input handler, then its change handler, each reading sam, and the ancestor's too; the select's value is then sam", async () => {
    const t = mount();
    await t.fire("sel", { type: "change", value: "sam" });
    expect(own("sel")).toEqual(["input:sel=sam@sel", "change:sel=sam@sel"]);
    expect([...own("sroot")].sort()).toEqual(["change:sroot=sam@sel", "input:sroot=sam@sel"]);
    expect(valueNow("sel")).toBe("sam");
    t.dispose();
  });

  it("the second identical call runs no handler", async () => {
    const t = mount();
    await t.fire("sel", { type: "change", value: "sam" });
    log.length = 0;
    await t.fire("sel", { type: "change", value: "sam" });
    expect(log).toEqual([]);
    expect(valueNow("sel")).toBe("sam");
    t.dispose();
  });

  it("a pick of the option already selected dispatches nothing", async () => {
    const t = mount();
    await t.fire("sel", { type: "change", value: "alex" });
    expect(log).toEqual([]);
    expect(valueNow("sel")).toBe("alex");
    t.dispose();
  });

  it("input bubbles and is composed; change bubbles", async () => {
    const t = mount();
    await t.fire("sel", { type: "change", value: "sam" });
    expect(log).toContain("input:flags=true/true");
    expect(log.filter((l) => l.startsWith("change:flags="))).toEqual([expect.stringMatching(/^change:flags=true\//)]);
    t.dispose();
  });

  it("over any sequence of picks each pick that changes the value fires input then change once and the rest fire none (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom("alex", "sam"), { minLength: 1, maxLength: 8 }), async (picks) => {
        const t = mount();
        let current = "alex";
        for (const pick of picks) {
          log.length = 0;
          await t.fire("sel", { type: "change", value: pick });
          expect(own("sel")).toEqual(pick === current ? [] : [`input:sel=${pick}@sel`, `change:sel=${pick}@sel`]);
          current = pick;
          expect(valueNow("sel")).toBe(pick);
        }
        t.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
