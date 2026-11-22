// @vitest-environment happy-dom
// Spec: k.a11y Render checks (E1826): after a `fire` or `settle()`, a `role="status"` element the root did not hold,
// under a parent element it did, holding text, fails the render; a navigation that changes the route is not checked.
import { createCtx } from "@keel/ctx";
import { type Signal, signal } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { If } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { render, renderRoute } from "@keel/testing";
import { Box, Button, Text } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const sim = () => createCtx({ mode: "sim", seed: SEED });
const codeOf = (e: unknown): unknown => (e instanceof Error ? Reflect.get(e, "code") : undefined);
const rejection = async (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );

type Shape = "status" | "alert" | "status-empty" | "status-in-new-parent" | "status-no-id";

const shown = (shape: Shape, message: string): Node => {
  if (shape === "alert") return Text({ id: "done", role: "alert", children: message });
  if (shape === "status-empty") return Text({ id: "done", role: "status", children: "" });
  if (shape === "status-no-id") return Text({ role: "status", children: message });
  if (shape === "status-in-new-parent")
    return Box({ id: "panel", children: () => Text({ id: "done", role: "status", children: message }) });
  return Text({ id: "done", role: "status", children: message });
};

const view = (shape: Shape, message: string) => {
  const handle: { saved?: Signal<boolean> } = {};
  const component = Object.assign(
    () => {
      const saved = signal(false);
      handle.saved = saved;
      return Box({
        id: "root",
        children: () => [
          Button({ id: "save", onClick: () => saved.set(true), children: "Save" }),
          Box({
            id: "slot",
            children: () =>
              If({
                get when() {
                  return saved.get();
                },
                children: () => shown(shape, message),
              }),
          }),
        ],
      });
    },
    { Props: s.object({}) },
  );
  return { component, save: () => handle.saved?.set(true) };
};

const message = fc.stringMatching(/^[A-Za-z]{1,12}$/);

describe("E1826 a status region inserted holding text", () => {
  it("a fire or settle() that inserts a filled status under an element held before fails, naming the element", async () => {
    await fc.assert(
      fc.asyncProperty(message, fc.boolean(), async (text, bySettle) => {
        const v = view("status", text);
        const t = render(v.component, { props: {}, ctx: sim() });
        if (bySettle) v.save();
        const e = await rejection(bySettle ? t.settle() : t.fire("save", { type: "click" }));
        expect(codeOf(e)).toBe("E1826");
        expect(String(e)).toContain(
          "E1826 done: a status region inserted holding text is not announced; render it empty first",
        );
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("an element without an id is named by its tag", async () => {
    const t = render(view("status-no-id", "Saved").component, { props: {}, ctx: sim() });
    const e = await rejection(t.fire("save", { type: "click" }));
    expect(String(e)).toContain("E1826 <span>: a status region");
    t.dispose();
  });

  it.each<Shape>(["alert", "status-empty", "status-in-new-parent"])("an inserted %s passes", async (shape) => {
    await fc.assert(
      fc.asyncProperty(message, async (text) => {
        const t = render(view(shape, text).component, { props: {}, ctx: sim() });
        await t.fire("save", { type: "click" });
        expect(t.find("done").role).toBe(shape === "alert" ? "alert" : "status");
        t.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("the first render is not checked: a status there from the start passes", async () => {
    const component = Object.assign(() => Text({ id: "done", role: "status", children: "Ready" }), {
      Props: s.object({}),
    });
    const t = render(component, { props: {}, ctx: sim() });
    await t.settle();
    expect(t.find("done").text).toBe("Ready");
    t.dispose();
  });

  it("a navigation that changes the route renders the next page's status unchecked", async () => {
    const c = contract("live", { "live.a": { path: "/a" }, "live.b": { path: "/b" } });
    const routes = manifest(c, {
      "live.a": { component: () => Text({ id: "a", children: "A" }) },
      "live.b": { component: () => Text({ id: "done", role: "status", children: "Saved" }) },
    });
    const h = await renderRoute("live.a", { routes, ctx: sim() });
    await h.navigate(c.href("live.b"));
    expect(h.find("done").text).toBe("Saved");
    h.dispose();
  });
});
