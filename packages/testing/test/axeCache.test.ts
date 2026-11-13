// @vitest-environment happy-dom
// k.a11y Render checks: within a test, a document state already judged reuses its verdict; any change is judged again.
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "../src/internal/axe.ts";

const dom = (html: string): HTMLElement => {
  document.body.innerHTML = "";
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
};
afterEach(() => {
  document.body.innerHTML = "";
});

describe("axe verdicts within one test", () => {
  it("an equal document gives the same verdict object; a changed one is judged again", () => {
    const first = axe(dom('<input id="a" aria-label="A">'), false);
    expect(axe(dom('<input id="a" aria-label="A">'), false)).toBe(first);
    expect(axe(dom('<input id="a">'), false).violations.map((v) => v.rule)).toEqual(["label"]);
    expect(axe(dom('<input id="a" aria-label="A">'), true)).not.toBe(first);
  });

  it("a control's value property is part of the state", () => {
    const root = dom('<input id="v" aria-label="V">');
    const first = axe(root, false);
    const input = root.querySelector("input");
    if (input !== null) input.value = "typed";
    expect(axe(root, false)).not.toBe(first);
  });
});
