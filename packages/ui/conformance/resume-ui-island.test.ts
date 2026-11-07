// @vitest-environment happy-dom
// Spec: k.runtime, clause "An island rooted at a k.ui base element, or with a child component in a template, resumes without E1253, keeping every server element and the focus."
// Spec: k.ui, clause "An `Input` bound to a signal and edited in server HTML before resume keeps the edit after resume, its server node and its markup default."
// Property seed: 1337.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import * as reactive from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import * as ui from "@keel/ui";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

type Component = (p: Readonly<Record<string, unknown>>) => Node;

const build = (name: string, source: string): Component => {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const fn = evaluate(r.outputs[0]?.code ?? "", { "@keel/reactive": reactive, "@keel/ui": ui });
  if (typeof fn !== "function") throw new Error("fixture: no default export");
  return (p) => {
    const n: unknown = Reflect.apply(fn, undefined, [p]);
    if (!(n instanceof Node)) throw new Error("fixture: component did not return a Node");
    return n;
  };
};

const BOX = `
import { signal } from "@keel/reactive";
import { Box, Input, Text } from "@keel/ui";
export default function BoxIsland(p: { title: string }) {
  const title = signal(p.title);
  return (
    <Box as="section" id="bi.root">
      <Input id="bi.input" label="Title" value={title} onInput={(e: Event) => { if (e.target instanceof HTMLInputElement) title.set(e.target.value); }} />
      <Text>{title}</Text>
    </Box>
  );
}`;

const PLAIN = `
import { signal } from "@keel/reactive";
import { Input } from "@keel/ui";
function Badge() { return <b>hi</b>; }
export default function FormIsland(p: { title: string }) {
  const title = signal(p.title);
  return (
    <form id="fi.root">
      <Input id="fi.input" label="Title" value={title} onInput={(e: Event) => { if (e.target instanceof HTMLInputElement) title.set(e.target.value); }} />
      <Badge />
    </form>
  );
}`;

const TITLE = `
import { signal } from "@keel/reactive";
import { Input } from "@keel/ui";
export default function TitleIsland(p: { title: string }) {
  const title = signal(p.title);
  return (
    <section id="ti.root">
      <Input label="Title" value={title} onInput={(e: Event) => { if (e.target instanceof HTMLInputElement) title.set(e.target.value); }} />
    </section>
  );
}`;

const hosts: Element[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
});
const host = (): HTMLDivElement => {
  const h = document.createElement("div");
  document.body.appendChild(h);
  hosts.push(h);
  return h;
};
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const input = (root: ParentNode): HTMLInputElement => {
  const el = root.querySelector("input");
  if (!(el instanceof HTMLInputElement)) throw new Error("fixture: no input");
  return el;
};

// Server HTML by mounting into a scratch host; then parse it with the k-state script into a fresh host.
const serverHost = (id: string, component: Component, props: Record<string, unknown>): HTMLDivElement => {
  const scratch = host();
  const dispose = mount(() => component(props), scratch);
  const root = scratch.firstElementChild;
  if (root === null) throw new Error("fixture: no island root");
  root.setAttribute("data-k-island", id);
  const html = root.outerHTML;
  dispose();
  const h = host();
  const state = JSON.stringify({ stores: {}, islands: { [id]: props } });
  h.innerHTML = `${html}<script type="application/json" id="k-state">${state}</script>`;
  return h;
};

const everyElement = (h: Element): Element[] => {
  const root = h.firstElementChild;
  if (root === null) throw new Error("fixture: no island root");
  return [root, ...Array.from(root.querySelectorAll("*"))];
};

const resumesIntact = (id: string, component: Component): void => {
  const h = serverHost(id, component, { title: "Ada" });
  const before = everyElement(h);
  expect(before.length).toBeGreaterThan(2);
  const field = input(h);
  field.focus();
  expect(document.activeElement).toBe(field);
  const { warnings } = resume(h, { [id]: component }, {});
  expect(warnings).toEqual([]);
  const after = everyElement(h);
  expect(after.length).toBe(before.length);
  after.forEach((el, i) => expect(el).toBe(before[i]));
  expect(document.activeElement).toBe(field);
};

describe("k.runtime: an island rooted at a k.ui base element, or with a child component, resumes without E1253, keeping every server element and the focus", () => {
  it("An island rooted at a k.ui Box holding an Input and a Text resumes with no warnings, keeps every server element and the focus", () => {
    resumesIntact("BoxIsland", build("BoxIsland", BOX));
  });

  it("An island rooted at a plain element with a ui Input and a local compiled component in its template resumes with no warnings, keeps every server element and the focus", () => {
    resumesIntact("FormIsland", build("FormIsland", PLAIN));
  });
});

describe("k.ui: an Input bound to a signal and edited in server HTML before resume keeps the edit, its server node and its markup default", () => {
  const component = build("TitleIsland", TITLE);

  const editThenResume = async (edit: string): Promise<void> => {
    const h = serverHost("TitleIsland", component, { title: "Ada" });
    const field = input(h);
    expect(field.getAttribute("value")).toBe("Ada");
    field.value = edit;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    const { warnings } = resume(h, { TitleIsland: component }, {});
    expect(warnings).toEqual([]);
    await flush();
    expect(input(h)).toBe(field);
    expect(field.value).toBe(edit);
    expect(field.getAttribute("value")).toBe("Ada");
  };

  it("An Input bound to a signal and edited in server HTML before resume keeps the edit after resume, its server node and its markup default", async () => {
    await editThenResume("Adam");
  });

  it("for any edit string, the edit, the server node and the markup default survive resume", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z ]{0,8}$/).filter((s) => s !== "Ada"),
        editThenResume,
      ),
      { seed: 1337, numRuns: 40 },
    );
  });
});
