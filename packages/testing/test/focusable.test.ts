// @vitest-environment happy-dom
// focusable: what a user can focus. Property seed: 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { focusable } from "../src/internal/focusable.ts";

const SEED = 1337;
/** Parse `html` and return the element with id `t`, attached so ancestors are real. */
const target = (html: string): Element => {
  const box = document.createElement("div");
  box.innerHTML = html;
  return box.querySelector("#t") ?? box;
};
const results = (cases: readonly string[]): [string, boolean][] => cases.map((html) => [html, focusable(target(html))]);

describe("focusable", () => {
  it("admits what a user can focus", () => {
    const yes = [
      '<button id="t">b</button>',
      '<button id="t" aria-hidden="true">b</button>',
      '<div aria-hidden="true"><button id="t">b</button></div>',
      '<input id="t">',
      '<input id="t" type="TEXT">',
      '<select id="t"></select>',
      '<textarea id="t"></textarea>',
      '<details><summary id="t">s</summary></details>',
      '<details><summary>a</summary><summary>b</summary></details><details><summary id="t">s</summary></details>',
      '<a id="t" href="/x">a</a>',
      '<area id="t" href="/x">',
      '<div id="t" contenteditable="">d</div>',
      '<div id="t" contenteditable="true">d</div>',
      '<div id="t" contenteditable="plaintext-only">d</div>',
      '<div id="t" tabindex="-1">d</div>',
      '<span id="t" tabindex="0">s</span>',
      '<iframe id="t"></iframe>',
      '<audio id="t" controls></audio>',
      '<video id="t" controls></video>',
      '<embed id="t">',
      '<object id="t"></object>',
      '<fieldset disabled><legend><input id="t"></legend></fieldset>',
      '<fieldset disabled><legend><div><input id="t"></div></legend></fieldset>',
      '<fieldset><input id="t"></fieldset>',
      '<div style="visibility:hidden"><span style="visibility:visible"><button id="t">b</button></span></div>',
    ];
    expect(results(yes).filter(([, ok]) => !ok)).toEqual([]);
  });

  it("refuses what a user cannot focus", () => {
    const no = [
      '<div id="t">d</div>',
      '<a id="t">a</a>',
      '<area id="t">',
      '<button id="t" disabled>b</button>',
      '<input id="t" type="hidden">',
      '<input id="t" type="HIDDEN" tabindex="0">',
      '<input id="t" hidden>',
      '<div hidden><button id="t">b</button></div>',
      '<div inert><button id="t">b</button></div>',
      '<button id="t" inert>b</button>',
      '<fieldset disabled><input id="t"></fieldset>',
      '<fieldset disabled><div><button id="t">b</button></div></fieldset>',
      '<fieldset disabled><legend>a</legend><legend><input id="t"></legend></fieldset>',
      '<fieldset disabled><div><legend><input id="t"></legend></div></fieldset>',
      '<div id="t" contenteditable="false">d</div>',
      '<div id="t" contenteditable="FALSE">d</div>',
      '<summary id="t">s</summary>',
      '<details><summary>a</summary><summary id="t">b</summary></details>',
      '<div><summary id="t">s</summary></div>',
      '<audio id="t"></audio>',
      '<video id="t"></video>',
      '<button id="t" style="display:none">b</button>',
      '<div style="display: none"><button id="t">b</button></div>',
      '<button id="t" style="visibility:hidden">b</button>',
      '<div style="visibility:hidden"><button id="t">b</button></div>',
      '<p id="t">p</p>',
    ];
    expect(results(no).filter(([, ok]) => ok)).toEqual([]);
  });

  it("property: any blocker on the element or an ancestor refuses; aria-hidden never does", () => {
    const blockers = [' hidden=""', " inert", ' style="display:none"', ' style="visibility:hidden"'] as const;
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            block: fc.option(fc.constantFrom(...blockers), { nil: undefined }),
            ariaHidden: fc.boolean(),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (chain) => {
          const open = chain.map((n) => `<div${n.block ?? ""}${n.ariaHidden ? ' aria-hidden="true"' : ""}>`).join("");
          const html = `${open}<button id="t">b</button>${"</div>".repeat(chain.length)}`;
          expect(focusable(target(html))).toBe(chain.every((n) => n.block === undefined));
        },
      ),
      { seed: SEED },
    );
  });
});
