// @vitest-environment happy-dom
// Backlog 0174 (rfc:0064): an island built from @keel/ui elements resumes in place. Its server nodes keep their
// identity, resume reports no E1253, and text typed before resume stays. Property seed 1337.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import * as forms from "@keel/forms";
import * as reactive from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import * as ui from "@keel/ui";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { testCtx } from "./testCtx.ts";

const SEED = 1337;
const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

type Component = (p: Readonly<Record<string, unknown>>) => Node;

/** Compile `source` (one default export) and return it as a component. */
const build = (source: string): Component => {
  const r = compile([{ path: "Island.tsx", source }]);
  expect(r.diagnostics).toEqual([]);
  const fn = evaluate(r.outputs[0]?.code ?? "", { "@keel/forms": forms, "@keel/reactive": reactive, "@keel/ui": ui });
  if (typeof fn !== "function") throw new Error("fixture: no default export");
  return (p) => {
    const n: unknown = Reflect.apply(fn, undefined, [p]);
    if (!(n instanceof Node)) throw new Error("fixture: component did not return a Node");
    return n;
  };
};

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

/** Server HTML of `component` as the island `Island`, plus its #k-state, parsed into a fresh host. */
const serve = (component: Component, props: Record<string, unknown>): HTMLDivElement => {
  const scratch = host();
  const dispose = mount(() => component(props), scratch, { ctx: testCtx });
  const root = scratch.firstElementChild;
  if (root === null) throw new Error("fixture: no island root");
  root.setAttribute("data-k-island", "Island");
  const html = root.outerHTML;
  dispose();
  scratch.remove();
  const h = host();
  const state = JSON.stringify({ stores: {}, islands: { Island: props } });
  h.innerHTML = `${html}<script type="application/json" id="k-state">${state}</script>`;
  return h;
};

const nodesOf = (root: Node): Node[] => {
  const out: Node[] = [];
  const walk = (n: Node): void => {
    if (n.nodeType === 1) out.push(n);
    for (const c of n.childNodes) walk(c);
  };
  walk(root);
  return out;
};

const typeInto = (input: HTMLInputElement, value: string): void => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const REPRO = `
import { signal } from "@keel/reactive";
import { Box, Input } from "@keel/ui";
export default function Island(p: { title: string }) {
  const title = signal(p.title);
  return (
    <Box as="section" id="island.root">
      <Input label="Title" value={title} onInput={(v) => title.set(v)} />
      <p id="island.echo">{title.get()}</p>
    </Box>
  );
}`;

describe("an island rooted at a ui Box resumes in place (backlog 0174)", () => {
  it("the 0174 repro: no E1253, server elements keep identity, an edit typed before resume stays and reaches the signal", async () => {
    const Island = build(REPRO);
    const h = serve(Island, { title: "Ada" });
    const before = nodesOf(h);
    const input = h.querySelector("input");
    if (!(input instanceof HTMLInputElement)) throw new Error("fixture: no input");
    expect(input.value).toBe("Ada");
    input.focus();
    typeInto(input, "Adam");

    const { warnings } = resume(h, { Island }, { ctx: testCtx });
    // The user is still typing: resume keeps the focus where it was.
    expect(document.activeElement).toBe(input);
    expect(warnings).toEqual([]);
    const after = nodesOf(h);
    expect(after.length).toBe(before.length);
    after.forEach((n, i) => expect(n).toBe(before[i]));
    expect(input.isConnected).toBe(true);
    expect(input.value).toBe("Adam");
    expect(input.getAttribute("value")).toBe("Ada");
    await flush();
    // The queued input event replayed through onInput: the echo reads the signal.
    expect(h.querySelector("#island\\.echo")?.textContent).toBe("Adam");
    typeInto(input, "Ada L");
    await flush();
    expect(h.querySelector("#island\\.echo")?.textContent).toBe("Ada L");
    expect(input.value).toBe("Ada L");
  });

  it("a compiled element root with a ui Input child (a component slot) resumes in place", () => {
    const Island = build(`
import { signal } from "@keel/reactive";
import { Input } from "@keel/ui";
export default function Island(p: { title: string }) {
  const title = signal(p.title);
  return <form id="island.form"><span>{title.get()}</span><Input label="Title" value={title} /><p>after</p></form>;
}`);
    const h = serve(Island, { title: "Ada" });
    const before = nodesOf(h);
    const input = h.querySelector("input");
    if (!(input instanceof HTMLInputElement)) throw new Error("fixture: no input");
    typeInto(input, "typed");
    const { warnings } = resume(h, { Island }, { ctx: testCtx });
    expect(warnings).toEqual([]);
    nodesOf(h).forEach((n, i) => expect(n).toBe(before[i]));
    expect(input.value).toBe("typed");
  });

  it("a server tree that does not match a ui element's structure is still E1253 and re-renders", () => {
    const Island = build(REPRO);
    const h = serve(Island, { title: "Ada" });
    h.querySelector("label")?.remove();
    const { warnings } = resume(h, { Island }, { ctx: testCtx });
    expect(warnings.join("\n")).toContain("E1253");
    expect(h.querySelector("label")?.textContent).toBe("Title");
  });
});

// Random nestings of ui elements and plain JSX as island roots. Leaves: a ui Input bound to a signal (the edit
// target), ui Text, a plain element with text. Containers: ui Box, ui Text, a plain div or section.
type Tree = { kind: "input" } | { kind: "text"; ui: boolean } | { kind: "box"; ui: boolean; kids: Tree[] };

const tree: fc.Arbitrary<Tree> = fc.letrec<{ t: Tree }>((tie) => ({
  t: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.constant<Tree>({ kind: "input" }),
    fc.boolean().map((ui): Tree => ({ kind: "text", ui })),
    fc
      .record({ ui: fc.boolean(), kids: fc.array(tie("t"), { maxLength: 3 }) })
      .map((b): Tree => ({ kind: "box", ...b })),
  ),
})).t;

const jsx = (t: Tree, n: { i: number }): string => {
  const k = n.i++;
  if (t.kind === "input") return `<Input label="Field ${k}" value={v} onInput={(x) => v.set(x)} />`;
  if (t.kind === "text") return t.ui ? `<Text>text ${k}</Text>` : `<em>text ${k}</em>`;
  const kids = t.kids.map((c) => jsx(c, n)).join("");
  return t.ui ? `<Box as="section">${kids}</Box>` : `<div id="d${k}">${kids}</div>`;
};

describe("ui and plain JSX island roots (property, seed 1337)", () => {
  it("resume never reports E1253, keeps every server element, and keeps a pre-resume input edit", () => {
    const roots = tree.filter((t) => t.kind === "box");
    fc.assert(
      fc.property(roots, fc.stringMatching(/^[a-z]{1,6}$/), (t, typed) => {
        const body = jsx(t, { i: 0 });
        const Island = build(`
import { signal } from "@keel/reactive";
import { Box, Input, Text } from "@keel/ui";
export default function Island(p: { v: string }) {
  const v = signal(p.v);
  return (${body});
}`);
        const h = serve(Island, { v: "server" });
        const before = nodesOf(h);
        const inputs = [...h.querySelectorAll("input")];
        for (const i of inputs) typeInto(i, typed);
        const { warnings } = resume(h, { Island }, { ctx: testCtx });
        expect(warnings).toEqual([]);
        const after = nodesOf(h);
        expect(after.length).toBe(before.length);
        after.forEach((x, i) => expect(x).toBe(before[i]));
        for (const i of inputs) {
          expect(i.isConnected).toBe(true);
          expect(i.value).toBe(typed);
        }
        h.remove();
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});

// Backlog 0184: HTML has no empty text node, so an empty dynamic text before a slot is missing from server HTML.
describe("empty dynamic texts next to component slots (backlog 0184)", () => {
  it("the 0184 repro: `<div>{p.a}<Text>x</Text></div>` with a empty resumes in place and keeps the server text", () => {
    const Island = build(`
import { Text } from "@keel/ui";
export default function Island(p: { a: string }) {
  return <div id="island.root" onClick={() => undefined}>{p.a}<Text>x</Text></div>;
}`);
    const h = serve(Island, { a: "" });
    const before = nodesOf(h);
    const { warnings } = resume(h, { Island }, { ctx: testCtx });
    expect(warnings).toEqual([]);
    nodesOf(h).forEach((n, i) => expect(n).toBe(before[i]));
    expect(h.querySelector("span")?.textContent).toBe("x");
  });

  type Part = { kind: "dyn"; value: string } | { kind: "slot"; ui: boolean } | { kind: "el" };
  const part: fc.Arbitrary<Part> = fc.oneof(
    fc.constantFrom("", "", "t").map((value): Part => ({ kind: "dyn", value })),
    fc.boolean().map((ui): Part => ({ kind: "slot", ui })),
    fc.constant<Part>({ kind: "el" }),
  );

  it("resume never throws; it adopts with the server texts, or reports E1253 and re-renders (property, seed 1337)", () => {
    fc.assert(
      fc.property(fc.array(part, { minLength: 1, maxLength: 6 }), (parts) => {
        const props: Record<string, string> = {};
        const body = parts
          .map((p, i) => {
            if (p.kind === "dyn") {
              props[`d${i}`] = p.value;
              return `{p.d${i}}`;
            }
            if (p.kind === "el") return `<i>e${i}</i>`;
            return p.ui ? `<Text>s${i}</Text>` : `<Badge n="${i}" />`;
          })
          .join("");
        const Island = build(`
import { Text } from "@keel/ui";
function Badge(q: { n: string }) { return <b>b{q.n}</b>; }
export default function Island(p: Record<string, string>) {
  return <div id="island.root" onClick={() => undefined}>${body}</div>;
}`);
        const h = serve(Island, props);
        const root = h.firstElementChild;
        const text = root?.textContent;
        const before = nodesOf(h);
        const { warnings } = resume(h, { Island }, { ctx: testCtx });
        if (warnings.length === 0) nodesOf(h).forEach((n, i) => expect(n).toBe(before[i]));
        else {
          expect(warnings.join("\n")).toContain("E1253");
          expect(h.firstElementChild).not.toBe(root);
        }
        expect(h.firstElementChild?.textContent).toBe(text);
        h.remove();
      }),
      { seed: SEED, numRuns: 80 },
    );
  });
});
