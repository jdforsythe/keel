// @vitest-environment happy-dom
// Spec: k.ui Conformance, "Every base element rendered with only its required props has no axe violations". Seed: 1337 (no generated inputs; every case is enumerated).
// Real axe-core (not the 4-rule harness subset in @keel/testing). Rules run: WCAG 2.0/2.1/2.2 A and AA tags plus best-practice.
// Disabled rules, all page-level (they depend on the surrounding page, not on the element under test):
//   region, landmark-one-main, page-has-heading-one, landmark-no-duplicate-main, landmark-unique, landmark-complementary-is-top-level,
//   landmark-main-is-top-level, landmark-banner-is-top-level, landmark-contentinfo-is-top-level, bypass, skip-link.
// `color-contrast` is disabled because happy-dom computes no layout or computed colors, so the rule cannot produce a verdict (E1804 covers contrast).
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { Box, Button, Checkbox, Heading, Image, Input, Link, Select, Text, TextArea } from "@keel/ui";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { home } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const DISABLED = [
  "region",
  "landmark-one-main",
  "page-has-heading-one",
  "landmark-no-duplicate-main",
  "landmark-unique",
  "landmark-complementary-is-top-level",
  "landmark-main-is-top-level",
  "landmark-banner-is-top-level",
  "landmark-contentinfo-is-top-level",
  "bypass",
  "skip-link",
  "color-contrast",
];

const config: axe.RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
  rules: Object.fromEntries(DISABLED.map((id) => [id, { enabled: false }])),
};

let container: HTMLElement;
beforeEach(() => {
  document.documentElement.setAttribute("lang", "en");
  document.head.innerHTML = "<title>Conformance</title>";
  document.body.innerHTML = '<main><div id="host"></div></main>';
  const host = document.getElementById("host");
  if (host === null) throw new Error("no host");
  container = host;
});
afterEach(() => {
  document.body.innerHTML = "";
});

const audit = async (): Promise<string[]> => {
  const r = await axe.run(container, config);
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`);
};

const cases: [string, () => Node][] = [
  ["Box", () => Box({ id: "e" })],
  ["Text", () => Text({ id: "e", children: "hello" })],
  ...([1, 2, 3, 4, 5, 6] as const).map((level): [string, () => Node] => [
    `Heading level ${level}`,
    () => Heading({ id: "e", level, children: "Orders" }),
  ]),
  ["Button (text)", () => Button({ id: "e", children: "Save" })],
  ["Button (image named by alt)", () => Button({ id: "e", children: Image({ src: "save.svg", alt: "Save" }) })],
  ["Link", () => Link({ id: "e", to: home, children: "Home" })],
  ["Image (alt)", () => Image({ id: "e", alt: "logo" })],
  ["Image (decorative)", () => Image({ id: "e", decorative: true })],
  ["Input", () => Input({ id: "e", label: "Name" })],
  ["TextArea", () => TextArea({ id: "e", label: "Notes" })],
  ["Select", () => Select({ id: "e", label: "Kind" })],
  ["Checkbox", () => Checkbox({ id: "e", label: "Agree" })],
];

describe("k.ui: Every base element rendered with only its required props has no axe violations", () => {
  for (const [name, make] of cases) {
    it(`${name} rendered with only its required props has no axe-core violations`, async () => {
      const off = mount(make, container, { ctx: simCtx });
      expect(container.querySelector("#e")).not.toBeNull();
      expect(await audit()).toEqual([]);
      off();
    });
  }

  it("a raw img without alt produces an image-alt violation (the check is not vacuous)", async () => {
    container.innerHTML = '<img src="x.png">';
    const found = await audit();
    expect(found.some((v) => v.startsWith("image-alt"))).toBe(true);
  });

  it("a raw button without a name produces a button-name violation (the check is not vacuous)", async () => {
    container.innerHTML = "<button></button>";
    const found = await audit();
    expect(found.some((v) => v.startsWith("button-name"))).toBe(true);
  });
});
