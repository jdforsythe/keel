// @vitest-environment happy-dom
// Spec: k.ui, clause "`@keel/ui` exports no `styles`; no base element takes `class`; `Button` has no `label`, its children are its text."
// rfc:0043. No generated inputs; seed n/a.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import * as ui from "@keel/ui";
import { Box, Button, Image, Input, Link, Text } from "@keel/ui";
import { describe, expect, expectTypeOf, it } from "vitest";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

describe("k.ui one way: style props only, Button text from children (rfc:0043)", () => {
  it("@keel/ui exports no styles", () => {
    expect("styles" in ui).toBe(false);
    expectTypeOf(ui).not.toHaveProperty("styles");
  });

  it("no base element takes a class prop", () => {
    expectTypeOf<Parameters<typeof Box>[0]>().not.toHaveProperty("class");
    expectTypeOf<Parameters<typeof Text>[0]>().not.toHaveProperty("class");
    expectTypeOf<Parameters<typeof Button>[0]>().not.toHaveProperty("class");
    expectTypeOf<Parameters<typeof Link>[0]>().not.toHaveProperty("class");
    expectTypeOf<Parameters<typeof Input>[0]>().not.toHaveProperty("class");
    expectTypeOf<Parameters<typeof Image>[0]>().not.toHaveProperty("class");
    expectTypeOf<ui.StyleProps>().not.toHaveProperty("class");
  });

  it("Button has no label; its children are its text and its accessible name", () => {
    expectTypeOf<Parameters<typeof Button>[0]>().not.toHaveProperty("label");
    expectTypeOf<Parameters<typeof Button>[0]>().toHaveProperty("children");
    const root = document.createElement("div");
    document.body.appendChild(root);
    const off = mount(() => Button({ id: "save", children: "Save" }), root, { ctx: simCtx });
    const el = document.getElementById("save");
    expect(el?.textContent).toBe("Save");
    expect(el?.hasAttribute("aria-label")).toBe(false);
    off();
    root.remove();
  });
});
