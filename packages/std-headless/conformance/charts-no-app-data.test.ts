// Spec: std.headless, Conformance "No chart's state or log holds a key, a text or a typed character after any widget flow in this section or std.options."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: the harness leaves `stores()` holding the live widget chart instances (ids `headless.*`) until `dispose()`; keys, texts and typed characters
// here contain `q` or `z`, and no widget id, chart id or event name does, so a snapshot's JSON holding neither letter holds none of them.
// A toast's chart instance is keyed by its item id (`headless.toast:<id>`), so the item ids here (`n1`, `n2`) avoid `q` and `z`: the spec cannot also keep that key out of the log.
import { Combobox, Dialog, Disclosure, Listbox, Menu, Tabs, Toaster } from "@keel/std-headless";
import type { Option, ToastItem } from "@keel/std-headless";
import { signal } from "@keel/reactive";
import { render } from "@keel/testing";
import { Button } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { headlessSnapshots, inScope, page, SEED, simCtx } from "./fixtures.ts";

const opts: readonly Option<string>[] = [
  { key: "qk", text: "Quartz" },
  { key: "zk", text: "Zinc" },
  { key: "qz", text: "Quiz" },
];

const clean = (): void => {
  const snaps = headlessSnapshots();
  expect(snaps.length).toBeGreaterThan(0);
  for (const { id, json } of snaps) {
    const lower = json.toLowerCase();
    expect(lower, id).not.toContain("q");
    expect(lower, id).not.toContain("z");
  }
};

const KEYS = ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape", "q", "z", "u"] as const;

describe("std.headless: no chart holds app data", () => {
  test("No chart's state or log holds a key, a text or a typed character after any Listbox flow", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom(...KEYS), { maxLength: 12 }), async (keys) => {
        const ctx = simCtx();
        const t = render(
          page((c) =>
            Listbox(
              {
                id: "nd.lb",
                label: "Gems",
                options: () => opts,
                mode: "multiple",
                selected: () => ["zk"],
                onChange: () => {},
              },
              c,
            ),
          ),
          { props: {}, ctx },
        );
        await t.fire("nd.lb.list", { type: "focus" });
        for (const key of keys) {
          await t.fire("nd.lb.list", { type: "keydown", key });
          ctx.clock.advance(100);
        }
        await t.fire("nd.lb.option.zk", { type: "click" });
        clean();
        await t.fire("nd.lb.list", { type: "blur" });
        clean();
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("No chart's state or log holds a key, a text or a typed character after a Combobox, Menu or Tabs flow", async () => {
    const text = inScope(() => signal(""));
    const picked = inScope(() => signal("zk"));
    const tc = render(
      page((c) =>
        Combobox(
          {
            id: "nd.cb",
            label: "Gems",
            text: () => text.get(),
            onInput: (v) => text.set(v),
            options: () => opts,
            onChange: () => {},
          },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await tc.fire("nd.cb.input", { type: "input", value: "zi" });
    await tc.fire("nd.cb.input", { type: "keydown", key: "ArrowDown" });
    await tc.fire("nd.cb.input", { type: "keydown", key: "Enter" });
    clean();
    tc.dispose();

    const tm = render(
      page((c) => Menu({ id: "nd.mn", trigger: () => "Gems", items: () => opts, onSelect: () => {} }, c)),
      { props: {}, ctx: simCtx() },
    );
    await tm.fire("nd.mn.trigger", { type: "keydown", key: "Enter" });
    await tm.fire("nd.mn.menu", { type: "keydown", key: "z" });
    await tm.fire("nd.mn.menu", { type: "keydown", key: "Enter" });
    clean();
    tm.dispose();

    const tt = render(
      page((c) =>
        Tabs(
          {
            id: "nd.tb",
            label: "Gems",
            tabs: () => opts,
            selected: () => picked.get(),
            onChange: (k) => picked.set(k),
            panel: (k) => k,
          },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await tt.fire("nd.tb.tab.zk", { type: "focus" });
    await tt.fire("nd.tb.tab.zk", { type: "keydown", key: "ArrowRight" });
    await tt.fire("nd.tb.tab.qk", { type: "keydown", key: "End" });
    clean();
    tt.dispose();
  });

  test("No chart's state or log holds a key, a text or a typed character after a Dialog, Disclosure or Toaster flow", async () => {
    const td = render(
      page((c) =>
        Dialog(
          {
            id: "nd.dlg",
            title: "Quartz",
            trigger: () => "Open",
            content: (close) => Button({ id: "nd.dlg.ok", children: "Zinc", onClick: close }),
          },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await td.fire("nd.dlg.trigger", { type: "click" });
    await td.fire("nd.dlg.dialog", { type: "keydown", key: "Escape" });
    clean();
    td.dispose();

    const ts = render(
      page((c) => Disclosure({ id: "nd.dsc", summary: () => "Quartz", children: () => "Zinc" }, c)),
      { props: {}, ctx: simCtx() },
    );
    await ts.fire("nd.dsc.button", { type: "click" });
    clean();
    ts.dispose();

    const items = inScope(() =>
      signal<readonly ToastItem[]>([
        { id: "n1", text: "Zinc saved", tone: "status" },
        { id: "n2", text: "Quartz failed", tone: "alert" },
      ]),
    );
    const tz = render(
      page((c) =>
        Toaster(
          {
            id: "nd.tst",
            items: () => items.get(),
            onDismiss: (id) => items.set(items.get().filter((i) => i.id !== id)),
            dismiss: "Close",
            duration: 5000,
          },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await tz.fire("nd.tst.dismiss.n1", { type: "focus" });
    clean();
    await tz.fire("nd.tst.dismiss.n2", { type: "click" });
    await tz.settle();
    clean();
    tz.dispose();
  });
});
