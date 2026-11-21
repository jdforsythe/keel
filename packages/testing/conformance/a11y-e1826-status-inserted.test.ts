// @vitest-environment happy-dom
// Spec: k.a11y, Conformance "After a `fire` or `settle()`, a `role="status"` element that was not there before, sits under an existing parent and already holds text, fails the render check E1826 naming its element id; a status rendered empty and filled later passes; an inserted alert passes; a status inside a subtree inserted whole passes."
// Spec: k.a11y, Rules "E1826 a `status` region inserted holding text (render; no criterion in Claims)"
// Seed: 1337 (RFC 0176 clause k.a11y #13).
// Pending: not built. The failing-case tests are skipped; the passing cases run and must stay green.
// No fixtures-by-code entry exists for E1826: a render check has no static fixture (builder: add none).
import { type Signal, computed, signal } from "@keel/reactive";
import { If } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Box, Button, Text } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";

type Variant = "inserted-status" | "empty-then-filled" | "inserted-alert" | "whole-subtree";

// `role` is reached through a variable so this file type-checks before `Text` declares it.
const live = (role: "status" | "alert", id: string, children: string): Node => {
  const props = { id, role, children };
  return Text(props);
};
// The same region whose text is a computed over a signal (a signal or computed child is bound, k.ui).
const liveComputed = (id: string, read: () => string): Node => {
  const props = { id, role: "status", children: computed(read) };
  return Text(props);
};

// Component with a `save` button; `write` sets the same signal from outside, for the `settle()` form.
const make = (variant: Variant, message: string) => {
  const handle: { saved?: Signal<boolean> } = {};
  const view = Object.assign(
    () => {
      const saved = signal(false);
      handle.saved = saved;
      const shown = (): Node => {
        if (variant === "inserted-status") return live("status", "done", message);
        if (variant === "inserted-alert") return live("alert", "done", message);
        return Box({ id: "panel", children: () => live("status", "done", message) });
      };
      const slot = () => If({ when: () => saved.get(), children: shown, fallback: () => document.createTextNode("") });
      return Box({
        id: "root",
        children: () => [
          Button({ id: "save", onClick: () => saved.set(true), children: "Save" }),
          variant === "empty-then-filled"
            ? liveComputed("done", () => (saved.get() ? message : ""))
            : Box({ id: "slot", children: slot }),
        ],
      });
    },
    { Props: s.object({}) },
  );
  return {
    view,
    write: () => {
      handle.saved?.set(true);
    },
  };
};

const text = fc.stringMatching(/^[A-Za-z]{1,12}$/);

describe("k.a11y: E1826 a status region inserted holding text", () => {
  it.skip('After a `fire`, a `role="status"` element not there before, under an existing parent and holding text, fails with E1826 naming its element id', async () => {
    await fc.assert(
      fc.asyncProperty(text, async (message) => {
        const t = render(make("inserted-status", message).view, { props: {}, ctx: simCtx() });
        const e = await thrown(() => t.fire("save", { type: "click" }));
        expect(codeOf(e)).toBe("E1826");
        expect(messageOf(e)).toContain("done");
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it.skip('After `settle()`, a `role="status"` element not there before, under an existing parent and holding text, fails with E1826 naming its element id', async () => {
    await fc.assert(
      fc.asyncProperty(text, async (message) => {
        const c = make("inserted-status", message);
        const t = render(c.view, { props: {}, ctx: simCtx() });
        c.write();
        const e = await thrown(() => t.settle());
        expect(codeOf(e)).toBe("E1826");
        expect(messageOf(e)).toContain("done");
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("a status rendered empty and filled later passes", async () => {
    await fc.assert(
      fc.asyncProperty(text, async (message) => {
        const t = render(make("empty-then-filled", message).view, { props: {}, ctx: simCtx() });
        await t.fire("save", { type: "click" });
        expect(t.find("done").text).toBe(message);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("an inserted alert passes", async () => {
    await fc.assert(
      fc.asyncProperty(text, async (message) => {
        const t = render(make("inserted-alert", message).view, { props: {}, ctx: simCtx() });
        await t.fire("save", { type: "click" });
        expect(t.find("done").text).toBe(message);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("a status inside a subtree inserted whole passes", async () => {
    await fc.assert(
      fc.asyncProperty(text, async (message) => {
        const t = render(make("whole-subtree", message).view, { props: {}, ctx: simCtx() });
        await t.fire("save", { type: "click" });
        expect(t.find("done").text).toBe(message);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
