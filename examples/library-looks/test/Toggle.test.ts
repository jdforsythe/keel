import { signal } from "@keel/reactive";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { expect, it } from "vitest";
import { Toggle } from "../src/index.ts";

const run = { start: false, calls: 0, read: false };

/** A toggle backed by a signal the component owns, as an app page keeps one. */
function Backed() {
  const pressed = signal(run.start);
  return Toggle({
    id: "lib",
    text: "Bold",
    pressed: () => {
      run.read = pressed.get();
      return run.read;
    },
    onToggle: () => {
      run.calls += 1;
      pressed.set(!pressed.get());
    },
  });
}

Backed.Props = s.object({});

const mount = (start: boolean) => {
  run.start = start;
  run.calls = 0;
  return render(Backed, { props: {} });
};

it("is a button named by its text, and a click calls onToggle once", async () => {
  const view = mount(false);
  const control = view.find("lib.toggle");
  expect(control.role).toBe("button");
  expect(control.name).toBe("Bold");
  expect(run.read).toBe(false);
  await view.fire("lib.toggle", { type: "click" });
  expect(run.calls).toBe(1);
  expect(run.read).toBe(true);
  view.dispose();
});

it("its pressed state is the prop's", () => {
  for (const on of [true, false]) {
    const view = render(Toggle, { props: { id: "lib", text: "Bold", pressed: () => on, onToggle: () => {} } });
    expect(view.find("lib.toggle").state.pressed).toBe(on);
    view.dispose();
  }
});

it("after any run of clicks, aria-pressed equals the parity", { timeout: fixedTime(30_000) }, async () => {
  await fc.assert(
    fc.asyncProperty(fc.boolean(), fc.nat({ max: 8 }), async (start, clicks) => {
      const view = mount(start);
      for (let i = 0; i < clicks; i += 1) await view.fire("lib.toggle", { type: "click" });
      expect(run.calls).toBe(clicks);
      expect(run.read).toBe(clicks % 2 === 0 ? start : !start);
      expect(view.find("lib.toggle").state.pressed).toBe(clicks % 2 === 0 ? start : !start);
      view.dispose();
    }),
    { seed: 1337, numRuns: 100 },
  );
});
