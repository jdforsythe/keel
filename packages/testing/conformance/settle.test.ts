// @vitest-environment happy-dom
// Spec: k.testing, clause "After a resource resolves, `settle()` shows its ready state without an event."
// Seed: 1337.
import type { Ctx } from "@keel/ctx";
import { resource } from "@keel/reactive";
import { clone, template, text } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { simCtx } from "./fixtures.ts";

const T = template('<p id="late"></p>');

// A resource whose promise the test resolves by hand: no timers, no events.
const makeLate = () => {
  let release: (v: string) => void = () => undefined;
  const gate = new Promise<string>((r) => {
    release = r;
  });
  const Late = Object.assign(
    (_props: Record<string, never>): Node => {
      const res = resource(() => gate);
      const root = clone(T);
      text(root, () => {
        const v = res.get();
        return v.state === "ready" ? v.value : "loading";
      });
      return root;
    },
    { Props: s.object({}) },
  );
  return { Late, release };
};

describe("k.testing: settle", () => {
  it("after a resource resolves, `await settle()` makes its ready state visible without any event", async () => {
    const { Late, release } = makeLate();
    const t = render(Late, { props: {}, ctx: simCtx() });
    expect(t.find("late").text).toBe("loading");
    release("ready");
    await t.settle();
    expect(t.find("late").text).toBe("ready");
    t.dispose();
  });

  it("settle returns a promise and resolves when nothing is pending", async () => {
    const { Late } = makeLate();
    const t = render(Late, { props: {}, ctx: simCtx() });
    const p = t.settle();
    expect(p).toBeInstanceOf(Promise);
    await p;
    expect(t.find("late").text).toBe("loading");
    t.dispose();
  });
});
