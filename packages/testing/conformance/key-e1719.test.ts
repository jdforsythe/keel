// @vitest-environment happy-dom
// Spec: k.testing Rules "E1719 ... or `keydown` on an unfocusable one with focus outside it (`<id> cannot take focus, so no key press reaches it`)"
// Spec: k.testing Conformance "With focus outside it, `fire(id, keydown)` on an unfocusable element rejects E1719 `<id> cannot take focus, so no key press reaches it` with `data` `{ id, type: 'keydown' }`; no handler runs and focus stays."
// Seed: 1337 (fc.assert below). ASSUMED: the compact line is the error's `message` including its code, as E1705's is.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, focusedIds, log, mount } from "./key-support.ts";

const attempt = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
    return undefined;
  } catch (e) {
    return e ?? new Error("threw a falsy value");
  }
};
const line = (id: string) => `E1719 ${id} cannot take focus, so no key press reaches it`;

describe("k.testing: E1719 for a key at an element that cannot take focus", () => {
  it("with focus outside it, fire(id, keydown) on an unfocusable element rejects E1719 `<id> cannot take focus, so no key press reaches it` with data { id, type: 'keydown' }; no handler runs and focus stays", async () => {
    const t = mount();
    await t.fire("a", { type: "focus" });
    log.length = 0;
    const e = await attempt(() => t.fire("plain", { type: "keydown", key: "a" }));
    expect(e).toMatchObject({ code: "E1719", data: { id: "plain", type: "keydown" } });
    expect(e instanceof Error ? e.message : String(e)).toBe(line("plain"));
    expect(log).toEqual([]);
    expect(focusedIds(t)).toEqual(["a"]);
    t.dispose();
  });

  it("with focus nowhere the same rejection holds and nothing moves", async () => {
    const t = mount();
    const e = await attempt(() => t.fire("plain", { type: "keydown", key: "a" }));
    expect(e).toMatchObject({ code: "E1719", data: { id: "plain", type: "keydown" } });
    expect(log).toEqual([]);
    expect(focusedIds(t)).toEqual([]);
    t.dispose();
  });

  it("an unfocusable container with focus outside it (on a sibling input) is refused too", async () => {
    const t = mount();
    await t.fire("a", { type: "focus" });
    log.length = 0;
    const e = await attempt(() => t.fire("box", { type: "keydown", key: "a" }));
    expect(e).toMatchObject({ code: "E1719", data: { id: "box", type: "keydown" } });
    expect(log).toEqual([]);
    expect(focusedIds(t)).toEqual(["a"]);
    t.dispose();
  });

  it("for any key and any focused input the refusal names the unfocusable target and moves nothing (property)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("a", "b"),
        fc.constantFrom("plain", "box"),
        fc.string({ minLength: 1, maxLength: 6 }),
        async (focus, target, key) => {
          const t = mount();
          await t.fire(focus, { type: "focus" });
          log.length = 0;
          const e = await attempt(() => t.fire(target, { type: "keydown", key }));
          expect(e).toMatchObject({ code: "E1719", data: { id: target, type: "keydown" } });
          expect(e instanceof Error ? e.message : String(e)).toBe(line(target));
          expect(log).toEqual([]);
          expect(focusedIds(t)).toEqual([focus]);
          t.dispose();
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
});
