// @vitest-environment happy-dom
// Targeted examples pinning the a11y readers (role, state, name, axe rules), edit distance, and small helpers.
// Property-based parts use fast-check seed 1337 (fixed for determinism).
import { s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { testResults } from "../src/index.ts";
import { assertArtifacts } from "../src/internal/assertArtifacts.ts";
import { axe } from "../src/internal/axe.ts";
import { clip } from "../src/internal/clip.ts";
import { contentText } from "../src/internal/contentText.ts";
import { elementsWithId } from "../src/internal/elementsWithId.ts";
import { eventFor } from "../src/internal/eventFor.ts";
import { firstLine } from "../src/internal/firstLine.ts";
import { isSelector } from "../src/internal/isSelector.ts";
import { jsonOf } from "../src/internal/jsonOf.ts";
import { labelText } from "../src/internal/labelText.ts";
import { levenshtein } from "../src/internal/levenshtein.ts";
import { memoryHistory } from "../src/internal/memoryHistory.ts";
import { moveFocus } from "../src/internal/moveFocus.ts";
import { nameAndSource } from "../src/internal/nameAndSource.ts";
import { nearest } from "../src/internal/nearest.ts";
import { propertyFailure } from "../src/internal/propertyFailure.ts";
import { refText } from "../src/internal/refText.ts";
import { resolve } from "../src/internal/resolve.ts";
import { roleOf } from "../src/internal/roleOf.ts";
import { rungOf } from "../src/internal/rungOf.ts";
import { seedFrom } from "../src/internal/seedFrom.ts";
import { stateOf } from "../src/internal/stateOf.ts";
import { treeOf } from "../src/internal/treeOf.ts";
import { violationError } from "../src/internal/violationError.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

/** Parse `html` into a detached-from-nothing container attached to the body and return the container. */
function dom(html: string): HTMLElement {
  document.body.innerHTML = "";
  const box = document.createElement("div");
  box.innerHTML = html;
  document.body.append(box);
  return box;
}
/** The first element matching `sel` inside `box` (test helper: tests of internals may use selectors). */
function q(box: Element, sel: string): Element {
  const found = box.querySelector(sel);
  if (found === null) throw new Error(`no ${sel}`);
  return found;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("roleOf", () => {
  const role = (html: string): string => roleOf(q(dom(html), "*"));

  it("an explicit role wins, first token only, trimmed", () => {
    expect(role('<div role="button">x</div>')).toBe("button");
    expect(role('<div role="  link   button ">x</div>')).toBe("link");
    expect(role('<div role="">x</div>')).toBe("generic");
    expect(role('<div role="   ">x</div>')).toBe("generic");
    expect(role('<a href="/x" role="button">x</a>')).toBe("button");
    expect(role('<div role="\tmenu\nitem">x</div>')).toBe("menu");
  });

  it("links need an href; areas likewise", () => {
    expect(role('<a href="/x">x</a>')).toBe("link");
    expect(role('<a href="">x</a>')).toBe("link");
    expect(role("<a>x</a>")).toBe("generic");
    const box = dom('<map><area href="/x" alt="a"><area alt="b"></map>');
    const areas = Array.from(box.querySelectorAll("area"));
    expect(areas.map(roleOf)).toEqual(["link", "generic"]);
  });

  it("images: empty alt is presentation, otherwise img", () => {
    expect(role('<img alt="">')).toBe("presentation");
    expect(role('<img alt="a">')).toBe("img");
    expect(role("<img>")).toBe("img");
    expect(role('<img alt=" ">')).toBe("img");
  });

  it("input roles follow type case-insensitively, defaulting to textbox", () => {
    expect(role("<input>")).toBe("textbox");
    expect(role('<input type="text">')).toBe("textbox");
    expect(role('<input type="">')).toBe("textbox");
    expect(role('<input type="unknown">')).toBe("textbox");
    expect(role('<input type="CHECKBOX">')).toBe("checkbox");
    expect(role('<input type="Radio">')).toBe("radio");
    expect(role('<input type="number">')).toBe("spinbutton");
    expect(role('<input type="range">')).toBe("slider");
    expect(role('<input type="search">')).toBe("searchbox");
    expect(role('<input type="hidden">')).toBe("none");
    expect(role('<input type="submit">')).toBe("button");
    expect(role('<input type="EMAIL">')).toBe("textbox");
  });

  it("select is a listbox when multiple or size > 1, else a combobox", () => {
    expect(role("<select></select>")).toBe("combobox");
    expect(role('<select size="1"></select>')).toBe("combobox");
    expect(role('<select size="0"></select>')).toBe("combobox");
    expect(role('<select size="2"></select>')).toBe("listbox");
    expect(role('<select size="10"></select>')).toBe("listbox");
    expect(role("<select multiple></select>")).toBe("listbox");
    expect(role('<select multiple size="1"></select>')).toBe("listbox");
  });

  it("section is a region only when labelled", () => {
    expect(role("<section></section>")).toBe("generic");
    expect(role('<section aria-label="x"></section>')).toBe("region");
    expect(role('<section aria-labelledby="x"></section>')).toBe("region");
  });

  it("other tags use the implicit table, then generic", () => {
    expect(role("<button>x</button>")).toBe("button");
    expect(role("<h2>x</h2>")).toBe("heading");
    expect(role("<ul></ul>")).toBe("list");
    expect(role("<div></div>")).toBe("generic");
    expect(role("<span></span>")).toBe("generic");
    expect(role("<custom-thing></custom-thing>")).toBe("generic");
  });
});

describe("stateOf", () => {
  const st = (html: string, role = "generic") => stateOf(q(dom(html), "*"), role);

  it("disabled applies to disableable tags by attribute and to any element by aria-disabled", () => {
    for (const tag of ["button", "fieldset", "input", "optgroup", "option", "select", "textarea"]) {
      const box = dom(`<${tag} disabled></${tag}>`);
      expect(stateOf(q(box, tag), "generic").disabled).toBe(true);
    }
    expect(st("<div disabled></div>")).toEqual({});
    expect(st("<span disabled></span>")).toEqual({});
    expect(st('<div aria-disabled="true"></div>')).toEqual({ disabled: true });
    expect(st('<div aria-disabled="false"></div>')).toEqual({});
    expect(st('<div aria-disabled="TRUE"></div>')).toEqual({});
    expect(st("<button></button>")).toEqual({});
    expect(st('<button aria-disabled="true"></button>')).toEqual({ disabled: true });
  });

  it("checked only for checkable roles: aria-checked first (mixed is 'mixed'), else the live property", () => {
    for (const role of ["checkbox", "radio", "switch", "menuitemcheckbox", "menuitemradio"]) {
      expect(st('<div aria-checked="true"></div>', role)).toEqual({ checked: true });
      expect(st('<div aria-checked="false"></div>', role)).toEqual({ checked: false });
      expect(st('<div aria-checked="mixed"></div>', role)).toEqual({ checked: "mixed" });
      expect(st("<div></div>", role)).toEqual({ checked: false });
    }
    expect(st('<div aria-checked="true"></div>', "button")).toEqual({});
    expect(st('<div aria-checked="true"></div>', "generic")).toEqual({});
    const box = dom('<input type="checkbox" checked><input type="checkbox"><input type="radio" checked>');
    const [a, b, c] = Array.from(box.querySelectorAll("input"));
    if (a === undefined || b === undefined || c === undefined) throw new Error("inputs");
    expect(stateOf(a, "checkbox")).toEqual({ checked: true });
    expect(stateOf(b, "checkbox")).toEqual({ checked: false });
    expect(stateOf(c, "radio")).toEqual({ checked: true });
    b.checked = true;
    expect(stateOf(b, "checkbox")).toEqual({ checked: true });
    b.setAttribute("aria-checked", "false");
    expect(stateOf(b, "checkbox")).toEqual({ checked: false });
  });

  it("expanded: aria-expanded wins, details reads open, other tags have none", () => {
    expect(st('<div aria-expanded="true"></div>')).toEqual({ expanded: true });
    expect(st('<div aria-expanded="false"></div>')).toEqual({ expanded: false });
    expect(st('<div aria-expanded="other"></div>')).toEqual({ expanded: false });
    expect(st("<div></div>")).toEqual({});
    expect(st("<details open></details>")).toEqual({ expanded: true });
    expect(st("<details></details>")).toEqual({ expanded: false });
    expect(st('<details open aria-expanded="false"></details>')).toEqual({ expanded: false });
    expect(st('<details aria-expanded="true"></details>')).toEqual({ expanded: true });
    expect(st("<section open></section>")).toEqual({});
  });

  it("selected: aria-selected wins, option reads the live property, other tags have none", () => {
    expect(st('<div aria-selected="true"></div>')).toEqual({ selected: true });
    expect(st('<div aria-selected="false"></div>')).toEqual({ selected: false });
    expect(st('<div aria-selected="x"></div>')).toEqual({ selected: false });
    expect(st("<div></div>")).toEqual({});
    const box = dom('<select><option id="a" selected>a</option><option id="b">b</option></select>');
    expect(stateOf(q(box, "#a"), "option")).toEqual({ selected: true });
    expect(stateOf(q(box, "#b"), "option")).toEqual({ selected: false });
    const b = q(box, "#b");
    b.setAttribute("aria-selected", "true");
    expect(stateOf(b, "option")).toEqual({ selected: true });
    expect(st("<span selected></span>")).toEqual({});
  });

  it("invalid is present only when aria-invalid is set and not false", () => {
    expect(st('<div aria-invalid="true"></div>')).toEqual({ invalid: true });
    expect(st('<div aria-invalid="grammar"></div>')).toEqual({ invalid: true });
    expect(st('<div aria-invalid="spelling"></div>')).toEqual({ invalid: true });
    expect(st('<div aria-invalid=""></div>')).toEqual({ invalid: true });
    expect(st('<div aria-invalid="false"></div>')).toEqual({});
    expect(st("<div></div>")).toEqual({});
  });

  it("focused follows the document's active element", () => {
    const box = dom('<input id="a"><input id="b">');
    const a = q(box, "#a");
    const b = q(box, "#b");
    if (!(a instanceof HTMLElement) || !(b instanceof HTMLElement)) throw new Error("inputs");
    expect(stateOf(a, "textbox")).toEqual({});
    a.focus();
    expect(stateOf(a, "textbox")).toEqual({ focused: true });
    expect(stateOf(b, "textbox")).toEqual({});
    b.focus();
    expect(stateOf(a, "textbox")).toEqual({});
    expect(stateOf(b, "textbox")).toEqual({ focused: true });
  });

  it("states combine without extra keys", () => {
    const box = dom('<input id="x" type="checkbox" disabled checked aria-invalid="true" aria-expanded="true">');
    const x = q(box, "#x");
    expect(stateOf(x, "checkbox")).toEqual({ disabled: true, checked: true, expanded: true, invalid: true });
    expect(Object.keys(stateOf(x, "checkbox")).sort()).toEqual(["checked", "disabled", "expanded", "invalid"]);
  });
});

describe("contentText, refText and labelText", () => {
  it("contentText joins text, honours aria-label and img alt, skips hidden and comments", () => {
    const box = dom(
      'a<b>b</b><i aria-label="L">ignored</i><i aria-label="  ">sp</i><img alt="A"><img><span hidden>h</span><span aria-hidden="true">h2</span><span aria-hidden="false">v</span><!--c-->z',
    );
    expect(contentText(box)).toBe("abLspAvz");
    expect(contentText(dom("<p><em>deep <u>er</u></em></p>"))).toBe("deep er");
    expect(contentText(dom(""))).toBe("");
  });

  it("refText prefers aria-label, then img alt, then content", () => {
    const box = dom(
      '<i id="a" aria-label="  L  ">c</i><img id="b" alt="alt" aria-label=" "><img id="c"><i id="d"> text </i>',
    );
    expect(refText(q(box, "#a"))).toBe("L");
    expect(refText(q(box, "#b"))).toBe("alt");
    expect(refText(q(box, "#c"))).toBe("");
    expect(refText(q(box, "#d"))).toBe(" text ");
    expect(refText(q(dom('<i aria-label="">content</i>'), "i"))).toBe("content");
  });

  it("labelText collects <label for>, then an enclosing label once, skipping blanks", () => {
    const box = dom(
      '<label for="x"> one </label><label for="y">other</label><label for="x">two</label><label for="x">  </label><input id="x"><label>wrap <input id="w"></label><label for="w">for-w</label><input id="none"><label for="">empty</label><label><input id="z"></label>',
    );
    expect(labelText(q(box, "#x"))).toBe("one two");
    expect(labelText(q(box, "#w"))).toBe("for-w wrap");
    expect(labelText(q(box, "#none"))).toBe("");
    expect(labelText(q(box, "#z"))).toBe("");
    const bare = document.createElement("input");
    box.append(bare);
    expect(labelText(bare)).toBe("");
  });

  it("an enclosing label that also targets the control by id is counted once", () => {
    const box = dom('<label for="w">both <input id="w"></label>');
    expect(labelText(q(box, "#w"))).toBe("both");
  });
});

describe("nameAndSource", () => {
  const ns = (html: string, sel = "#t", role?: string) => {
    const box = dom(html);
    const el = q(box, sel);
    return nameAndSource(el, role ?? roleOf(el));
  };

  it("presentation and none roles have no name", () => {
    expect(ns('<img id="t" alt="" aria-label="x">')).toEqual({ name: "", source: "none" });
    expect(ns('<div id="t" aria-label="x"></div>', "#t", "none")).toEqual({ name: "", source: "none" });
    expect(ns('<div id="t" aria-label="x"></div>', "#t", "presentation")).toEqual({ name: "", source: "none" });
    expect(ns('<div id="t" aria-label="x"></div>', "#t", "group")).toEqual({ name: "x", source: "aria" });
  });

  it("aria-labelledby joins non-empty referenced texts in order, ignoring missing and blank ones", () => {
    expect(
      ns('<i id="a">A</i><i id="b"> B </i><i id="e"> </i><div id="t" aria-labelledby=" b  missing e a "></div>'),
    ).toEqual({
      name: "B A",
      source: "aria",
    });
    expect(ns('<i id="a" aria-label="LA">A</i><div id="t" aria-labelledby="a" aria-label="own"></div>')).toEqual({
      name: "LA",
      source: "aria",
    });
    expect(ns('<div id="t" aria-labelledby="" aria-label="own"></div>')).toEqual({ name: "own", source: "aria" });
    expect(ns('<div id="t" aria-labelledby="gone" aria-label="own"></div>')).toEqual({ name: "own", source: "aria" });
    expect(ns('<img id="im" alt="pic"><div id="t" aria-labelledby="im"></div>')).toEqual({
      name: "pic",
      source: "aria",
    });
  });

  it("a self-reference uses the element's own label or content once", () => {
    expect(ns('<button id="t" aria-labelledby="t">self</button>')).toEqual({ name: "self", source: "aria" });
    expect(ns('<button id="t" aria-labelledby="t" aria-label="lab">self</button>')).toEqual({
      name: "lab",
      source: "aria",
    });
  });

  it("aria-label is trimmed and a blank one falls through", () => {
    expect(ns('<div id="t" aria-label="  x  "></div>', "#t", "group")).toEqual({ name: "x", source: "aria" });
    expect(ns('<button id="t" aria-label="   ">content</button>')).toEqual({ name: "content", source: "text" });
    expect(ns('<input id="t" aria-label="a"><label for="t">l</label>')).toEqual({ name: "a", source: "aria" });
  });

  it("form controls are named by their labels, never by content", () => {
    expect(ns('<label for="t">Name</label><input id="t">')).toEqual({ name: "Name", source: "label" });
    expect(ns('<label>Wrap <input id="t"></label>')).toEqual({ name: "Wrap", source: "label" });
    expect(ns('<label for="t">Sel</label><select id="t"><option>o</option></select>')).toEqual({
      name: "Sel",
      source: "label",
    });
    expect(ns('<label for="t">Area</label><textarea id="t">content</textarea>')).toEqual({
      name: "Area",
      source: "label",
    });
    expect(ns('<textarea id="t" role="button">content</textarea>')).toEqual({ name: "", source: "none" });
    expect(ns('<label for="t">Pr</label><progress id="t"></progress>')).toEqual({ name: "Pr", source: "label" });
    expect(ns('<label for="t">Me</label><meter id="t"></meter>')).toEqual({ name: "Me", source: "label" });
    expect(ns('<label for="t">Out</label><output id="t"></output>')).toEqual({ name: "Out", source: "label" });
    expect(ns('<label for="t">Not</label><div id="t" role="group"></div>', "#t")).toEqual({ name: "", source: "none" });
  });

  it("alt names img, area and image inputs only", () => {
    expect(ns('<img id="t" alt=" pic ">')).toEqual({ name: "pic", source: "alt" });
    expect(ns('<map><area id="t" alt="zone" href="/x"></map>')).toEqual({ name: "zone", source: "alt" });
    expect(ns('<input id="t" type="image" alt="go">')).toEqual({ name: "go", source: "alt" });
    expect(ns('<input id="t" type="IMAGE" alt="go">')).toEqual({ name: "go", source: "alt" });
    expect(ns('<input id="t" type="text" alt="no">')).toEqual({ name: "", source: "none" });
    expect(ns('<div id="t" role="group" alt="no"></div>')).toEqual({ name: "", source: "none" });
    expect(ns('<img id="t">')).toEqual({ name: "", source: "none" });
  });

  it("roles that allow name from content use their text, others do not", () => {
    expect(ns('<button id="t"> go <b>now</b> </button>')).toEqual({ name: "go now", source: "text" });
    expect(ns('<a id="t" href="/x">link</a>')).toEqual({ name: "link", source: "text" });
    expect(ns('<h1 id="t">Head</h1>')).toEqual({ name: "Head", source: "text" });
    expect(ns('<div id="t" role="tab">Tab</div>')).toEqual({ name: "Tab", source: "text" });
    expect(ns('<div id="t" role="region">Reg</div>')).toEqual({ name: "", source: "none" });
    expect(ns('<div id="t">Plain</div>')).toEqual({ name: "", source: "none" });
    expect(ns('<button id="t"><span hidden>x</span>y</button>')).toEqual({ name: "y", source: "text" });
  });

  it("button-like inputs fall back to value, then anything falls back to title", () => {
    expect(ns('<input id="t" type="button" value="  Press ">')).toEqual({ name: "Press", source: "none" });
    expect(ns('<input id="t" type="SUBMIT" value="Send">')).toEqual({ name: "Send", source: "none" });
    expect(ns('<input id="t" type="reset" value="Clear">')).toEqual({ name: "Clear", source: "none" });
    expect(ns('<input id="t" type="text" value="typed">')).toEqual({ name: "", source: "none" });
    expect(ns('<input id="t" type="submit" value="V" title="T">')).toEqual({ name: "V", source: "none" });
    expect(ns('<div id="t" role="group" title=" tip "></div>')).toEqual({ name: "tip", source: "none" });
    expect(ns('<button id="t" title="tip"></button>')).toEqual({ name: "tip", source: "none" });
    expect(ns('<input id="t" type="submit" title="T">')).toEqual({ name: "T", source: "none" });
    expect(ns('<div id="t" role="group"></div>')).toEqual({ name: "", source: "none" });
  });

  it("sources are tried in order: labelledby, aria-label, label, alt, text, value, title", () => {
    expect(ns('<label for="t">L</label><input id="t" title="T">')).toEqual({ name: "L", source: "label" });
    expect(ns('<button id="t" title="T">C</button>')).toEqual({ name: "C", source: "text" });
    expect(ns('<img id="t" alt="A" title="T">')).toEqual({ name: "A", source: "alt" });
    expect(ns('<img id="t" alt="" title="T">')).toEqual({ name: "", source: "none" });
    expect(ns('<img id="t" alt=" " title="T" role="img">')).toEqual({ name: "T", source: "none" });
  });
});

describe("axe (axe-core)", () => {
  const rules = (html: string): string[] => axe(dom(html), false).violations.map((v) => v.rule);

  it("is clean for named controls and decorative images", () => {
    expect(
      rules(
        '<img alt="a"><img alt=""><button>go</button><a href="/x">l</a><input aria-label="n"><label for="i">L</label><input id="i"><select aria-label="s"></select><textarea aria-label="t"></textarea><input type="hidden"><input type="submit" value="v">',
      ),
    ).toEqual([]);
    expect(rules("<div>text</div><p>more</p>")).toEqual([]);
  });

  it("names the rule and the element of each violation", () => {
    expect(axe(dom('<img id="i" src="a.png">'), false).violations).toEqual([
      expect.objectContaining({ rule: "image-alt", element: "i", at: '<img id="i">' }),
    ]);
    expect(rules('<button id="b"></button>')).toEqual(["button-name"]);
    expect(rules('<a href="/x" id="l"></a>')).toEqual(["link-name"]);
    expect(rules("<input>")).toEqual(["label"]);
    expect(rules("<select></select>")).toEqual(["select-name"]);
    expect(rules('<div role="button"></div>')).toEqual(["aria-command-name"]);
  });

  it("runs element rules only for a component, and lists what ran", () => {
    const { ran } = axe(dom("<p>x</p>"), false);
    expect(ran).toContain("image-alt");
    expect(ran).toContain("landmark-unique");
    for (const rule of ["document-title", "html-has-lang", "landmark-one-main", "region", "bypass", "color-contrast"])
      expect(ran).not.toContain(rule);
  });

  it("runs the document rules for a page", () => {
    document.title = "";
    const { ran, violations } = axe(dom("<p>x</p>"), true);
    expect(ran).toContain("document-title");
    expect(ran).not.toContain("color-contrast");
    expect(violations.map((v) => v.rule)).toContain("document-title");
  });
});

describe("violationError", () => {
  const v = (n: number) =>
    Array.from({ length: n }, () => ({ rule: "button-name", element: "", at: "<button>", help: "has no name" }));

  it("names the first violation and up to four more", () => {
    const line = "button-name: <button> has no name";
    expect(violationError("E1703", v(1)).message).toBe(`E1703 ${line}`);
    expect(violationError("E1703", v(2)).message).toBe(`E1703 ${line}\n  E1703 ${line}`);
    for (const n of [3, 4, 5]) {
      const e = violationError("E1703", v(n));
      expect(e.message.split("\n")).toHaveLength(n);
      expect(e.message).not.toContain("more E1703");
      expect(Reflect.get(e, "code")).toBe("E1703");
    }
  });

  it("summarises the overflow past five", () => {
    const msg = violationError("E1703", v(8)).message;
    expect(msg.split("\n")).toHaveLength(6);
    expect(msg.endsWith("\n  ... +3 more E1703")).toBe(true);
    expect(violationError("E1703", v(6)).message).toContain("\n  ... +1 more E1703");
  });

  it("starts a rule that is its own code at the element", () => {
    const e = violationError("E1804", [{ rule: "E1804", element: "t", at: '<p id="t">', help: "is 4.40:1" }]);
    expect(e.message).toBe('E1804 <p id="t"> is 4.40:1');
  });
});

describe("assertArtifacts", () => {
  const entry = (role: string | null, name: "aria" | "label" | "alt" | "text" | "none") => ({ role, name, tag: "x" });

  it("accepts matching role and name source, skipping absent, unknown and hidden elements", () => {
    const box = dom(
      '<button id="a">go</button><input id="b" aria-label="x"><div hidden><button id="h"></button></div><i id="unlisted">u</i>',
    );
    expect(() =>
      assertArtifacts(box, {
        a: entry("button", "text"),
        b: entry("textbox", "aria"),
        h: entry("link", "alt"),
        missing: entry("link", "alt"),
      }),
    ).not.toThrow();
    expect(() => assertArtifacts(box, { a: entry(null, "text") })).not.toThrow();
  });

  it("reports role and name-source mismatches in the E1702 format", () => {
    const box = dom('<button id="a">go</button><a id="b" href="/x" aria-label="n">x</a>');
    expect(() => assertArtifacts(box, { a: entry("link", "text") })).toThrow(
      '"a" expected role link, name from text; rendered role button, name from text',
    );
    expect(() => assertArtifacts(box, { a: entry("button", "aria") })).toThrow(
      '"a" expected role button, name from aria; rendered role button, name from text',
    );
    expect(() => assertArtifacts(box, { a: entry(null, "aria") })).toThrow(
      '"a" expected any role, name from aria; rendered role button, name from text',
    );
    expect(() => assertArtifacts(box, { b: entry("link", "text") })).toThrow(
      '"b" expected role link, name from text; rendered role link, name from aria',
    );
  });

  it("lists up to five mismatches and counts the rest", () => {
    const html = (n: number): string => Array.from({ length: n }, (_, i) => `<button id="b${i}">x</button>`).join("");
    const want = (n: number) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`b${i}`, entry("link", "text")]));
    for (const n of [1, 2, 5, 6, 9]) {
      try {
        assertArtifacts(dom(html(n)), want(n));
        expect.unreachable("should throw");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        const lines = msg.split("\n");
        expect(lines).toHaveLength(Math.min(n, 5) + (n > 5 ? 1 : 0));
        expect(lines[0]?.startsWith('E1702 "b0" expected role link')).toBe(true);
        if (n > 1) expect(lines[1]?.startsWith('  E1702 "b1" expected')).toBe(true);
        if (n > 5) expect(lines[5]).toBe(`  ... +${n - 5} more E1702`);
        expect(Reflect.get(e instanceof Error ? e : {}, "code")).toBe("E1702");
      }
      document.body.innerHTML = "";
    }
  });
});

describe("levenshtein and nearest", () => {
  it("known distances", () => {
    for (const [a, b, d] of [
      ["", "", 0],
      ["abc", "abc", 0],
      ["", "abc", 3],
      ["abc", "", 3],
      ["kitten", "sitting", 3],
      ["flaw", "lawn", 2],
      ["a", "b", 1],
      ["ab", "ba", 2],
      ["abc", "abd", 1],
      ["abc", "xabc", 1],
      ["abc", "abcx", 1],
      ["abcd", "ab", 2],
      ["saturday", "sunday", 3],
    ] as const)
      expect(levenshtein(a, b)).toBe(d);
  });

  it("is a metric on generated strings (property)", () => {
    const str = fc.string({ maxLength: 8 });
    fc.assert(
      fc.property(str, str, str, (a, b, c) => {
        const ab = levenshtein(a, b);
        expect(ab).toBe(levenshtein(b, a));
        expect(levenshtein(a, a)).toBe(0);
        expect(ab === 0).toBe(a === b);
        expect(ab).toBeLessThanOrEqual(Math.max(a.length, b.length));
        expect(ab).toBeGreaterThanOrEqual(Math.abs(a.length - b.length));
        expect(levenshtein(a, c)).toBeLessThanOrEqual(ab + levenshtein(b, c));
        expect(levenshtein(`${a}x`, `${b}x`)).toBe(ab);
      }),
    );
  });

  it("nearest orders by distance then by candidate order and truncates to n", () => {
    expect(nearest("cat", ["car", "cart", "dog", "cab", "cat"], 3)).toEqual(["cat", "car", "cart"]);
    expect(nearest("cat", ["cap", "car", "cab"], 2)).toEqual(["cap", "car"]);
    expect(nearest("cat", ["x", "cat"], 5)).toEqual(["cat", "x"]);
    expect(nearest("cat", ["x", "y"], 0)).toEqual([]);
    expect(nearest("cat", [], 3)).toEqual([]);
    expect(nearest("a", ["b", "b", "a"], 3)).toEqual(["a", "b", "b"]);
  });
});

describe("small helpers", () => {
  it("clip keeps text up to max and marks the cut with ...", () => {
    expect(clip("abc", 3)).toBe("abc");
    expect(clip("abcd", 4)).toBe("abcd");
    expect(clip("abcde", 4)).toBe("a...");
    expect(clip("abcdefghij", 6)).toBe("abc...");
    expect(clip("abcdef", 3)).toBe("...");
    expect(clip("abcdef", 2)).toBe("...");
    expect(clip("abcdef", 0)).toBe("...");
    expect(clip("", 0)).toBe("");
    fc.assert(
      fc.property(fc.string({ maxLength: 50 }), fc.integer({ min: 3, max: 50 }), (t, max) => {
        const out = clip(t, max);
        expect(out.length).toBeLessThanOrEqual(max);
        expect(out === t || out.endsWith("...")).toBe(true);
      }),
    );
  });

  it("firstLine reads the first line of an Error message or string form", () => {
    expect(firstLine(new Error("one\ntwo"))).toBe("one");
    expect(firstLine(new Error(""))).toBe("");
    expect(firstLine("a\nb")).toBe("a");
    expect(firstLine("")).toBe("");
    expect(firstLine(42)).toBe("42");
    expect(firstLine(null)).toBe("null");
    expect(firstLine({ message: "no" })).toBe("[object Object]");
    expect(firstLine("\nlater")).toBe("");
  });

  it("jsonOf encodes through the schema, falling back to plain JSON when encode throws", () => {
    expect(jsonOf(s.object({ a: s.int() }), { a: 1 })).toBe('{"a":1}');
    expect(jsonOf(s.string(), "x")).toBe('"x"');
    expect(jsonOf(s.int(), 1.5)).toBe("1.5");
    expect(jsonOf(s.string({ max: 1 }), "long")).toBe('"long"');
  });

  it("memoryHistory records pushes and replaces and never pops", () => {
    const h = memoryHistory("/start");
    expect(h.current()).toBe("/start");
    h.push("/a", "k1");
    expect(h.current()).toBe("/a");
    h.replace("/b", "k1");
    expect(h.current()).toBe("/b");
    h.push("/c", "k2");
    h.replace("/d", "k2");
    expect(h.current()).toBe("/d");
    expect(h.onPop(() => {})).toBeUndefined();
    const r = memoryHistory("/s");
    r.replace("/t", "k1");
    expect(r.current()).toBe("/t");
  });

  it("rungOf maps evidence to rungs", () => {
    expect(rungOf({ kind: "example", passed: false })).toBe("none");
    expect(rungOf({ kind: "proven", passed: false })).toBe("none");
    expect(rungOf({ kind: "example", passed: true })).toBe("example");
    expect(rungOf({ kind: "example", passed: true, runs: 1000, seed: 1 })).toBe("example");
    expect(rungOf({ kind: "exhaustive", passed: true })).toBe("exhaustive");
    expect(rungOf({ kind: "proven", passed: true })).toBe("proven");
    expect(rungOf({ kind: "property", passed: true })).toBe("example");
    expect(rungOf({ kind: "property", passed: true, runs: 99, seed: 1 })).toBe("example");
    expect(rungOf({ kind: "property", passed: true, runs: 100 })).toBe("example");
    expect(rungOf({ kind: "property", passed: true, seed: 1 })).toBe("example");
    expect(rungOf({ kind: "property", passed: true, runs: 100, seed: 1 })).toBe("probabilistic");
    expect(rungOf({ kind: "property", passed: true, runs: 101, seed: 0 })).toBe("probabilistic");
    expect(rungOf({ kind: "property", passed: false, runs: 500, seed: 1 })).toBe("none");
  });

  it("eventFor builds the DOM event for each TestEvent", () => {
    const input = document.createElement("input");
    const click = eventFor(input, { type: "click" });
    expect(click).toBeInstanceOf(MouseEvent);
    expect([click.type, click.bubbles, click.cancelable]).toEqual(["click", true, true]);
    expect(click instanceof MouseEvent && click.button).toBe(0);
    const typed = eventFor(input, { type: "input", value: "hello" });
    expect([typed.type, typed.bubbles, typed.cancelable]).toEqual(["input", true, false]);
    expect(input.value).toBe("hello");
    const change = eventFor(input, { type: "change" });
    expect([change.type, change.bubbles, change.cancelable]).toEqual(["change", true, false]);
    const key = eventFor(input, { type: "keydown", key: "Enter" });
    expect(key).toBeInstanceOf(KeyboardEvent);
    expect([key.type, key.bubbles, key.cancelable]).toEqual(["keydown", true, true]);
    expect(key instanceof KeyboardEvent && key.key).toBe("Enter");
    const submit = eventFor(input, { type: "submit" });
    expect([submit.type, submit.bubbles, submit.cancelable]).toEqual(["submit", true, true]);
  });

  it("moveFocus names the element and the event in E1719", () => {
    const div = document.createElement("div");
    div.id = "d";
    expect(() => moveFocus(div, "focus")).toThrow("E1719 d is not focusable");
    expect(() => moveFocus(div, "blur")).toThrow("E1719 d does not have focus");
  });

  it("isSelector flags selector-shaped strings and bare tag names", () => {
    for (const id of [
      ".cls",
      "a#b",
      "a[b]",
      "a]",
      "a>b",
      "a~b",
      "a*b",
      "a,b",
      "a b",
      "a\tb",
      "div",
      "DIV",
      "Button",
      "ul",
    ])
      expect(isSelector(id), id).toBe(true);
    for (const id of ["by.aria", "save-button", "list.0.name", "x", "form1:title", "a.b"])
      expect(isSelector(id), id).toBe(false);
  });

  it("seedFrom prefers the explicit seed, then an integer KEEL_SEED, then 1337", () => {
    const saved = process.env.KEEL_SEED;
    try {
      process.env.KEEL_SEED = "99";
      expect(seedFrom(7)).toBe(7);
      expect(seedFrom(0)).toBe(0);
      expect(seedFrom(undefined)).toBe(99);
      process.env.KEEL_SEED = "  42 ";
      expect(seedFrom(undefined)).toBe(42);
      process.env.KEEL_SEED = "-5";
      expect(seedFrom(undefined)).toBe(-5);
      for (const bad of ["", "abc", "4.5", "1e3", "0x10", "--1", "12x", "x12", "+3"]) {
        process.env.KEEL_SEED = bad;
        expect(seedFrom(undefined), bad).toBe(1337);
      }
      Reflect.deleteProperty(process.env, "KEEL_SEED");
      expect(seedFrom(undefined)).toBe(1337);
    } finally {
      if (saved === undefined) Reflect.deleteProperty(process.env, "KEEL_SEED");
      else process.env.KEEL_SEED = saved;
    }
  });

  it("propertyFailure formats the E1704 line, clipping the reason and each shrunk input", () => {
    const e = propertyFailure("component", new Error("boom\nsecond"), 7, 3, [
      ["props", '{"n":1}'],
      ["state", "{}"],
    ]);
    expect(e.message).toBe('E1704 component: boom (seed 7, run 3, shrunk)\n  props: {"n":1}\n  state: {}');
    expect(Reflect.get(e, "code")).toBe("E1704");
    expect(Reflect.get(e, "data")).toEqual({ seed: 7, run: 3, shrunk: { props: '{"n":1}', state: "{}" } });
    expect(Reflect.get(e, "see")).toBe("k.testing");
    const long = propertyFailure("tx", "x".repeat(100), 1, 2, [["payload", "y".repeat(400)]]);
    expect(long.message).toBe(
      `E1704 tx: ${"x".repeat(67)}... (seed 1, run 2, shrunk)\n  payload: ${"y".repeat(297)}...`,
    );
    const exact = propertyFailure("tx", "x".repeat(70), 1, 2, [["p", "y".repeat(300)]]);
    expect(exact.message).toBe(`E1704 tx: ${"x".repeat(70)} (seed 1, run 2, shrunk)\n  p: ${"y".repeat(300)}`);
    expect(propertyFailure("tx", "m", 1, 2, []).message).toBe("E1704 tx: m (seed 1, run 2, shrunk)");
  });
});

describe("tree helpers and resolve", () => {
  it("elementsWithId lists id-bearing descendants in document order, excluding the root", () => {
    const box = dom('<div id="root"><p id="a"><b id="b"></b></p><i></i><u id="c"></u></div>');
    const root = q(box, "#root");
    expect(elementsWithId(root).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(elementsWithId(q(box, "#a")).map((e) => e.id)).toEqual(["b"]);
    expect(elementsWithId(q(box, "#c"))).toEqual([]);
  });

  it("treeOf lifts id-bearing descendants through anonymous elements and omits hidden subtrees", () => {
    const box = dom(
      '<div><span><b id="a">A</b></span><i id="h" hidden></i><p aria-hidden="true"><b id="x"></b></p><u id="c"><b id="d">D</b></u></div>',
    );
    const nodes = treeOf(q(box, "div"));
    expect(nodes.map((n) => n.id)).toEqual(["a", "c"]);
    expect(nodes[1]?.children.map((n) => n.id)).toEqual(["d"]);
    expect(nodes[0]).toEqual({ id: "a", role: "generic", name: "", state: {}, children: [] });
  });

  it("resolve finds by id, rejects selectors (E1701), and lists the nearest ids for a miss (E1705)", () => {
    const box = dom(
      '<div id="root"><b id="alpha"></b><b id="alps"></b><b id="beta"></b><b id="gamma"></b><b id="alpha2"></b></div>',
    );
    const root = q(box, "#root");
    expect(resolve(root, "beta")).toBe(q(box, "#beta"));
    expect(() => resolve(root, "root")).toThrow(/^E1705/);
    const thrown = (id: string): Error => {
      try {
        resolve(root, id);
      } catch (e) {
        if (e instanceof Error) return e;
      }
      throw new Error("did not throw");
    };
    const miss = thrown("alph");
    expect(miss.message).toBe('E1705 no element with id "alph"; nearest: alpha, alps, alpha2');
    expect(Reflect.get(miss, "code")).toBe("E1705");
    expect(Reflect.get(miss, "data")).toEqual({ id: "alph", nearest: ["alpha", "alps", "alpha2"] });
    const sel = thrown(".alpha");
    expect(sel.message).toBe('E1701 ".alpha" is a DOM selector; address elements by id');
    expect(Reflect.get(sel, "data")).toEqual({ id: ".alpha" });
    expect(thrown("div").message).toMatch(/^E1701 "div" is a DOM selector/);
    const empty = document.createElement("div");
    expect(() => resolve(empty, "x")).toThrow('E1705 no element with id "x"; the render has no ids');
    const long = "z".repeat(60);
    expect(() => resolve(empty, long)).toThrow(`no element with id ${JSON.stringify(`${"z".repeat(37)}...`)};`);
    const dup = dom('<div id="r2"><b id="d"></b><i id="d"></i></div>');
    expect(() => resolve(q(dup, "#r2"), "xq")).toThrow("nearest: d");
    expect(
      Reflect.get(
        ((): Error => {
          try {
            resolve(q(dup, "#r2"), "xq");
          } catch (e) {
            if (e instanceof Error) return e;
          }
          throw new Error("no");
        })(),
        "data",
      ),
    ).toEqual({ id: "xq", nearest: ["d"] });
  });
});

describe("testResults details", () => {
  const CWD = "/repo/pkg";
  const T = (over: Record<string, unknown> = {}, errs: unknown[] = [{ message: "m" }]) => ({
    type: "test",
    name: "t",
    result: { state: "fail", errors: errs },
    ...over,
  });
  const run = (tasks: unknown[], filepath = "/repo/pkg/test/x.test.ts", errors: unknown[] = []) =>
    testResults([{ file: { filepath }, tasks }], errors, CWD);
  const one = (task: unknown, errors: unknown[] = []) => {
    const [d] = run([task], undefined, errors).diagnostics;
    if (d === undefined) throw new Error("no diag");
    return d;
  };

  it("counts tests, customs, failures and skips; suites and unknown nodes are not tests", () => {
    const r = run([
      { type: "test", name: "a", result: { state: "pass" } },
      { type: "custom", name: "b", result: { state: "fail", errors: [{ message: "x" }] } },
      { type: "test", name: "c", result: { state: "skip" } },
      { type: "test", name: "d", result: { state: "todo" } },
      { type: "test", name: "e", mode: "skip" },
      { type: "test", name: "f", mode: "todo" },
      { type: "test", name: "g", mode: "run", result: { state: "pass" } },
      { type: "suite", name: "s", tasks: [{ type: "test", name: "h", result: { state: "fail" } }] },
      { type: "other", name: "o", result: { state: "fail" } },
      { type: "test", name: "i", mode: "skip", result: { state: "fail", errors: [{ message: "x" }] } },
      "junk",
      null,
      7,
    ]);
    expect(r.tests).toBe(9);
    expect(r.failed).toBe(3);
    expect(r.skipped).toBe(4);
    expect(r.errors).toBe(0);
    expect(r.diagnostics).toHaveLength(3);
  });

  it("names a test by its suite trail, skipping empty names, and defaults the message", () => {
    const named = (trail: unknown[], test: unknown) =>
      run(trail.reduceRight<unknown[]>((inner, name) => [{ type: "suite", name, tasks: inner }], [test]));
    expect(named(["A", "B"], T({ name: "t" })).diagnostics[0]?.message).toBe("A > B > t: m");
    expect(named(["", "B"], T({ name: "t" })).diagnostics[0]?.message).toBe("B > t: m");
    expect(named([], T({ name: "t" })).diagnostics[0]?.message).toBe("t: m");
    expect(named([], T({ name: undefined })).diagnostics[0]?.message).toBe(": m");
    expect(named(["S"], T({ name: 5 })).diagnostics[0]?.message).toBe("S: m");
    expect(one(T({}, [])).message).toBe("t: test failed");
    expect(one(T({}, [{}])).message).toBe("t: test failed");
    expect(one(T({}, ["str"])).message).toBe("t: test failed");
    expect(one(T({ result: { state: "fail" } })).message).toBe("t: test failed");
    expect(one(T({}, [{ message: 5 }])).message).toBe("t: test failed");
    expect(one(T({}, [{ message: "first\nsecond" }])).message).toBe("t: first");
    expect(one(T({}, [{ message: "\u001b[31mred\u001b[0m and \u001b[1;32mgreen\u001b[0m" }])).message).toBe(
      "t: red and green",
    );
    expect(one(T({}, [{ message: "a\u001b[0Kb" }])).message).toBe("t: a\u001b[0Kb");
  });

  it("clips messages at 89 characters", () => {
    const prefix = "t: ";
    expect(one(T({}, [{ message: "x".repeat(86) }])).message).toBe(`${prefix}${"x".repeat(86)}`);
    expect(one(T({}, [{ message: "x".repeat(87) }])).message).toBe(`${prefix}${"x".repeat(83)}...`);
    expect(one(T({}, [{ message: "x".repeat(200) }])).message.length).toBe(89);
  });

  it("locates a failure at the first app frame of parsed stacks, with defaults for missing line and column", () => {
    const at = (stacks: unknown[]) => one(T({}, [{ message: "m", stacks }]));
    expect(at([{ file: "/repo/pkg/src/a.ts", line: 3, column: 4 }])).toMatchObject({
      path: "src/a.ts",
      line: 3,
      col: 4,
    });
    expect(at([{ file: "/repo/pkg/src/a.ts", line: 3, col: 9 }])).toMatchObject({ line: 3, col: 9 });
    expect(at([{ file: "/repo/pkg/src/a.ts", line: 3, column: 4, col: 9 }])).toMatchObject({ col: 4 });
    expect(at([{ file: "/repo/pkg/src/a.ts" }])).toMatchObject({ line: 1, col: 1 });
    expect(at([{ file: "/repo/pkg/src/a.ts", line: "3", column: "4" }])).toMatchObject({ line: 1, col: 1 });
    expect(
      at([
        { file: "/repo/pkg/node_modules/x/i.js", line: 1, column: 1 },
        { file: "node:internal/x", line: 1, column: 1 },
        { file: "/usr/lib/vitest/dist/a.js", line: 1, column: 1 },
        { file: "/usr/lib/@vitest/runner/a.js", line: 1, column: 1 },
        { file: "relative/b.ts", line: 1, column: 1 },
        { file: 7, line: 1, column: 1 },
        "junk",
        { file: "/repo/pkg/src/b.ts", line: 8, column: 2 },
      ]),
    ).toMatchObject({ path: "src/b.ts", line: 8, col: 2 });
    expect(at([{ file: "C:\\proj\\a.ts", line: 2, column: 3 }])).toMatchObject({ line: 2, col: 3 });
    expect(at([{ file: "D:/proj/a.ts", line: 5, column: 6 }])).toMatchObject({ line: 5, col: 6 });
  });

  it("falls back to the stack text when no parsed frame is an app frame", () => {
    const stack = [
      "Error: x",
      "    at fn (/repo/pkg/test/a.test.ts:12:17)",
      "    at /repo/pkg/src/b.ts:3:9",
      "    at file:///repo/pkg/src/c.ts:4:1",
      "    at node:internal/x:1:1",
      "    at /repo/pkg/node_modules/y.js:1:1",
      "    at C:\\win\\d.ts:7:8",
      "    at (/repo/pkg/src/e.ts:9:9) trailing",
      "    at relative.ts:1:1",
      "    at /repo/pkg/src/f.ts:10:2",
      "    at /repo/pkg/src/g.ts:11:2",
    ].join("\n");
    const d = one(T({}, [{ message: "m", stack, stacks: [{ file: "node:x", line: 1, column: 1 }] }]));
    expect(d).toMatchObject({ path: "test/a.test.ts", line: 12, col: 17 });
    expect(d.fix).toBe(
      ["at src/b.ts:3:9", "at src/c.ts:4:1", "at ../../C:/win/d.ts:7:8", "at src/f.ts:10:2"].join("\n"),
    );
    expect(one(T({}, [{ message: "m", stack: 5 }]))).toMatchObject({ path: "test/x.test.ts", line: 1, col: 1 });
    expect(one(T({}, [{ message: "m", stacks: "no" }]))).toMatchObject({ path: "test/x.test.ts", line: 1, col: 1 });
    expect(one(T({}, [{ message: "m", stack: "at /repo/pkg/a.ts:1:2 extra" }]))).toMatchObject({ line: 1, col: 1 });
    expect(one(T({}, [{ message: "m", stack: "  at /repo/pkg/a.ts:5:6  " }]))).toMatchObject({
      path: "a.ts",
      line: 5,
      col: 6,
    });
    expect(one(T({}, [{ message: "m", stack: "/repo/pkg/a.ts:5:6" }]))).toMatchObject({
      path: "a.ts",
      line: 5,
      col: 6,
    });
  });

  it("falls back to the file path when there is no frame; shows at most five frames", () => {
    expect(one(T()).path).toBe("test/x.test.ts");
    const frames = Array.from({ length: 9 }, (_, i) => ({ file: `/repo/pkg/src/f${i}.ts`, line: i + 1, column: 1 }));
    const d = one(T({}, [{ message: "m", stacks: frames }]));
    expect(d.path).toBe("src/f0.ts");
    expect(d.fix).toBe(["at src/f1.ts:2:1", "at src/f2.ts:3:1", "at src/f3.ts:4:1", "at src/f4.ts:5:1"].join("\n"));
    const two = one(T({}, [{ message: "m", stacks: frames.slice(0, 2) }]));
    expect(two.fix).toBe("at src/f1.ts:2:1");
    const solo = one(T({}, [{ message: "m", stacks: frames.slice(0, 1) }]));
    expect(Object.hasOwn(solo, "fix")).toBe(false);
  });

  it("the fix is the compact diff (changed lines only, at most eight) then further frames", () => {
    const diff = (d: string) => one(T({}, [{ message: "m", diff: d }])).fix;
    expect(diff("- Expected\n+ Received\n\n- 3\n+ 2")).toBe("- 3\n+ 2");
    expect(diff("  Object {\n-   a: 1,\n+   a: 2,\n  }")).toBe("-   a: 1,\n+   a: 2,");
    expect(diff("  Object {\n  }")).toBeUndefined();
    expect(diff("- 1\n  same\n+ 2")).toBe("- 1\n+ 2");
    expect(diff("-\n+\n-x")).toBe("-\n+");
    expect(diff("- Expected - 1\n+ Received + 1")).toBeUndefined();
    expect(diff("- Expectedly\n+ Receivedly")).toBe("- Expectedly\n+ Receivedly");
    expect(diff("\u001b[31m- red\u001b[0m\n\u001b[32m+ green\u001b[0m")).toBe("- red\n+ green");
    expect(diff("")).toBeUndefined();
    expect(diff("only context")).toBeUndefined();
    const nine = Array.from({ length: 9 }, (_, i) => `- l${i}`).join("\n");
    expect(diff(nine)).toBe(`${Array.from({ length: 8 }, (_, i) => `- l${i}`).join("\n")}\n... +1 diff lines`);
    const eight = Array.from({ length: 8 }, (_, i) => `+ l${i}`).join("\n");
    expect(diff(eight)).toBe(Array.from({ length: 8 }, (_, i) => `+ l${i}`).join("\n"));
    expect(one(T({}, [{ message: "m", diff: 5 }])).fix).toBeUndefined();
    const both = one(
      T({}, [
        {
          message: "m",
          diff: "- a\n+ b",
          stacks: [
            { file: "/repo/pkg/src/a.ts", line: 1, column: 1 },
            { file: "/repo/pkg/src/b.ts", line: 2, column: 2 },
          ],
        },
      ]),
    );
    expect(both.fix).toBe("- a\n+ b\nat src/b.ts:2:2");
  });

  it("makes paths relative to cwd with / separators", () => {
    const rel = (filepath: string, cwd = CWD) => {
      const [d] = testResults([{ file: { filepath }, tasks: [T()] }], [], cwd).diagnostics;
      return d?.path;
    };
    expect(rel("/repo/pkg/test/a.ts")).toBe("test/a.ts");
    expect(rel("/repo/other/a.ts")).toBe("../other/a.ts");
    expect(rel("/elsewhere/a.ts")).toBe("../../elsewhere/a.ts");
    expect(rel("/repo/pkg")).toBe("");
    expect(rel("/repo")).toBe("..");
    expect(rel("/repo/pkg/a.ts", "/")).toBe("repo/pkg/a.ts");
    expect(rel("/repo/pkg/a.ts", "/repo/pkg/deep/er")).toBe("../../a.ts");
    expect(rel("/repo//pkg//a.ts", "/repo/pkg/")).toBe("a.ts");
    expect(rel("rel/a.ts")).toBe("rel/a.ts");
    expect(rel("rel\\dir/a.ts")).toBe("rel/dir/a.ts");
    expect(rel("C:\\p\\a.ts", "C:\\p")).toBe("a.ts");
    expect(rel("C:/p/q/a.ts", "C:/p")).toBe("q/a.ts");
    expect(rel("C:\\p\\a.ts", "/repo")).toBe("../C:/p/a.ts".replace("../", "../"));
  });

  it("reads the file path from file.filepath, then filepath, then name", () => {
    const path = (f: Record<string, unknown>) => testResults([{ ...f, tasks: [T()] }], [], CWD).diagnostics[0]?.path;
    expect(path({ file: { filepath: "/repo/pkg/a.ts" }, filepath: "/repo/pkg/b.ts", name: "c.ts" })).toBe("a.ts");
    expect(path({ file: {}, filepath: "/repo/pkg/b.ts", name: "/repo/pkg/c.ts" })).toBe("b.ts");
    expect(path({ file: { filepath: 5 }, filepath: "/repo/pkg/b.ts" })).toBe("b.ts");
    expect(path({ name: "/repo/pkg/c.ts" })).toBe("c.ts");
    expect(path({ file: "no", name: "/repo/pkg/c.ts" })).toBe("c.ts");
    expect(path({})).toBe("");
  });

  it("a file that failed outside any test is one T0001 at line 1; failed tests suppress it", () => {
    const failedFile = (extra: Record<string, unknown>, tasks: unknown[] = []) =>
      testResults([{ file: { filepath: "/repo/pkg/test/x.test.ts" }, tasks, ...extra }], [], CWD);
    const r = failedFile({ result: { state: "fail", errors: [{ message: "import broke\nstack" }] } });
    expect(r).toStrictEqual({
      diagnostics: [{ kind: "diag", code: "T0001", path: "test/x.test.ts", line: 1, col: 1, message: "import broke" }],
      tests: 0,
      failed: 1,
      skipped: 0,
      errors: 0,
    });
    expect(failedFile({ result: { state: "fail" } }).diagnostics[0]?.message).toBe("file failed to run");
    expect(failedFile({ result: { state: "fail", errors: [{}] } }).diagnostics[0]?.message).toBe("file failed to run");
    expect(failedFile({ result: { state: "fail", errors: [5] } }).diagnostics[0]?.message).toBe("file failed to run");
    expect(
      failedFile({ result: { state: "fail", errors: [{ message: "x".repeat(100) }] } }).diagnostics[0]?.message,
    ).toBe(`${"x".repeat(86)}...`);
    const both = failedFile({ result: { state: "fail", errors: [{ message: "file" }] } }, [T()]);
    expect(both.failed).toBe(1);
    expect(both.diagnostics).toHaveLength(1);
    expect(failedFile({ result: { state: "pass" } }).failed).toBe(0);
    expect(failedFile({ result: "fail" }).failed).toBe(0);
    expect(failedFile({}).failed).toBe(0);
    const second = testResults(
      [
        { file: { filepath: "/repo/pkg/a.ts" }, tasks: [T()] },
        {
          file: { filepath: "/repo/pkg/b.ts" },
          tasks: [],
          result: { state: "fail", errors: [{ message: "b broke" }] },
        },
      ],
      [],
      CWD,
    );
    expect(second.diagnostics.map((d) => d.path)).toEqual(["a.ts", "b.ts"]);
    expect(second.failed).toBe(2);
  });

  it("each unhandled error is an unlocated T0001 `uncaught: <first line>` when it names no place", () => {
    const r = testResults(
      [],
      [{ message: "boom\nmore" }, {}, "plain\ntext", 42, null, { message: "y".repeat(95) }],
      CWD,
    );
    expect(r.diagnostics).toStrictEqual([
      { kind: "diag", code: "T0001", message: "uncaught: boom" },
      { kind: "diag", code: "T0001", message: "uncaught: unhandled error" },
      { kind: "diag", code: "T0001", message: "uncaught: plain" },
      { kind: "diag", code: "T0001", message: "uncaught: 42" },
      { kind: "diag", code: "T0001", message: "uncaught: null" },
      { kind: "diag", code: "T0001", message: `uncaught: ${"y".repeat(76)}...` },
    ]);
    expect(r).toMatchObject({ tests: 0, failed: 0, skipped: 0, errors: 6 });
    expect(testResults([], [{ message: "\u001b[31mred\u001b[0m" }], CWD).diagnostics[0]?.message).toBe("uncaught: red");
    expect(testResults([], [{ message: "" }], CWD).diagnostics[0]?.message).toBe("uncaught: error outside any test");
    expect(testResults([], [{ message: "x", code: 7 }], CWD).diagnostics[0]?.message).toBe("uncaught: x");
  });

  it("an unhandled error with an app frame in its stack text is located there; VITEST_TEST_PATH is the fallback", () => {
    const stack = [
      "Error: late",
      "    at f (/repo/node_modules/dep/i.js:1:2)",
      "    at g (/repo/pkg/t.test.ts:7:11)",
    ].join("\n");
    const [located] = testResults([], [{ message: "late", stack }], CWD).diagnostics;
    expect(located).toStrictEqual({
      kind: "diag",
      code: "T0001",
      path: "t.test.ts",
      line: 7,
      col: 11,
      message: "uncaught: late",
    });
    const [fallback] = testResults([], [{ message: "late", VITEST_TEST_PATH: "/repo/pkg/u.test.ts" }], CWD).diagnostics;
    expect(fallback).toStrictEqual({
      kind: "diag",
      code: "T0001",
      path: "u.test.ts",
      line: 1,
      col: 1,
      message: "uncaught: late",
    });
    const [empty] = testResults([], [{ message: "late", VITEST_TEST_PATH: "" }], CWD).diagnostics;
    expect(empty).toStrictEqual({ kind: "diag", code: "T0001", message: "uncaught: late" });
  });

  it("ignores non-record files and tolerates missing task lists", () => {
    expect(testResults(["x", null, 3, [], {}], [], CWD)).toStrictEqual({
      diagnostics: [],
      tests: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
    });
    expect(testResults([{ tasks: "no" }, { tasks: [{ type: "suite", tasks: 5 }] }], [], CWD).tests).toBe(0);
  });

  it("test counts match the generated tree (property)", () => {
    const state = fc.constantFrom("pass", "fail", "skip", "todo");
    fc.assert(
      fc.property(fc.array(state, { maxLength: 12 }), (states) => {
        const tasks = states.map((st, i) => ({
          type: "test",
          name: `t${i}`,
          result: { state: st, errors: [{ message: "e" }] },
        }));
        const r = run(tasks);
        expect(r.tests).toBe(states.length);
        expect(r.failed).toBe(states.filter((x) => x === "fail").length);
        expect(r.skipped).toBe(states.filter((x) => x === "skip" || x === "todo").length);
        expect(r.diagnostics).toHaveLength(r.failed);
      }),
    );
  });
});
