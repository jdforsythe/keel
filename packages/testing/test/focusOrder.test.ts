// @vitest-environment happy-dom
// k.a11y Order and focus: focusOrder() skips disabled, hidden, inert, display: none and negative tabindex.
import { afterEach, describe, expect, it } from "vitest";
import { focusOrder } from "../src/internal/focusOrder.ts";

const dom = (html: string): HTMLElement => {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
};
afterEach(() => {
  document.body.innerHTML = "";
});

describe("focusOrder", () => {
  it("lists focusable ids in document order, skipping what a user cannot reach", () => {
    const root = dom(
      '<button id="a">A</button><div inert><button id="i">I</button></div><button id="d" disabled>D</button>' +
        '<div style="display: none"><a id="n" href="/x">N</a></div><input id="b" aria-label="B">' +
        '<h1 id="h" tabindex="-1">T</h1><p id="p">text</p><a id="c" href="/y">C</a><button id="hid" hidden>H</button>',
    );
    expect(focusOrder(root)).toEqual(["a", "b", "c"]);
  });

  it("puts positive tabindex first, by value, then document order; no id is an empty string", () => {
    const root = dom('<button id="x">X</button><span tabindex="2" id="two"></span><span tabindex="1"></span>');
    expect(focusOrder(root)).toEqual(["", "two", "x"]);
  });
});
