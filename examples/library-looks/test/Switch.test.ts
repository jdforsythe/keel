import { signal } from "@keel/reactive";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import fc from "fast-check";
import { expect, it } from "vitest";
import { Switch } from "../src/index.ts";

const run = { start: false, calls: 0 };

/** A switch backed by a signal the component owns, as an app page keeps one. */
function Backed() {
  const on = signal(run.start);
  return Switch({
    id: "lib",
    label: "Notifications",
    on: () => on.get(),
    onToggle: () => {
      run.calls += 1;
      on.set(!on.get());
    },
  });
}

Backed.Props = s.object({});

const mount = (start: boolean) => {
  run.start = start;
  run.calls = 0;
  return render(Backed, { props: {} });
};

it("is a switch named by its label, and a click calls onToggle once", async () => {
  const view = mount(false);
  const control = view.find("lib.switch");
  expect(control.role).toBe("switch");
  expect(control.name).toBe("Notifications");
  expect(control.state.checked).toBe(false);
  await view.fire("lib.switch", { type: "click" });
  expect(run.calls).toBe(1);
  expect(view.find("lib.switch").state.checked).toBe(true);
  view.dispose();
});

it("reports aria-checked from on", () => {
  const view = render(Switch, { props: { id: "lib", label: "Notifications", on: () => true, onToggle: () => {} } });
  expect(view.find("lib.switch").state.checked).toBe(true);
  view.dispose();
});

it("after any run of clicks, aria-checked equals the parity", async () => {
  await fc.assert(
    fc.asyncProperty(fc.boolean(), fc.nat({ max: 8 }), async (start, clicks) => {
      const view = mount(start);
      expect(Switch).toBeTypeOf("function");
      for (let i = 0; i < clicks; i += 1) await view.fire("lib.switch", { type: "click" });
      expect(run.calls).toBe(clicks);
      expect(view.find("lib.switch").state.checked).toBe(clicks % 2 === 0 ? start : !start);
      view.dispose();
    }),
    { seed: 1337, numRuns: 100 },
  );
});
