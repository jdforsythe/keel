// @vitest-environment happy-dom
// Spec: k.component Conformance. JSX children arrive as `props.children`; base elements render them.
import { mount } from "@keel/runtime-dom";
import { expect, test } from "vitest";
import { load } from "./support.ts";

function render(name: string, source: string): HTMLElement {
  const el = document.createElement("div");
  mount(load(name, source), el);
  return el;
}

// Stand-ins shaped like @keel/ui base elements: they read `props.children` (a thunk or plain text).
const base = `
type Kids = (() => Node | string) | string
function put(el: HTMLElement, k: Kids | undefined) {
  const v = typeof k === 'function' ? k() : k
  if (v !== undefined) el.append(v)
  return el
}
function Button(props: { children?: Kids }) { return put(document.createElement('button'), props.children) }
function Box(props: { children?: Kids }) { return put(document.createElement('div'), props.children) }
function Text(props: { children?: Kids }) { return put(document.createElement('span'), props.children) }
`;

test("a base element given JSX text children renders that text", () => {
  const el = render("ChildrenButton", `${base}export default function C() { return <Button>Go</Button> }\n`);
  expect(el.querySelector("button")?.textContent).toBe("Go");
});

test("nested base elements render their JSX children", () => {
  const el = render("ChildrenNested", `${base}export default function C() { return <Box><Text>hi</Text></Box> }\n`);
  expect(el.querySelector("div > span")?.textContent).toBe("hi");
});

test("a user component receives JSX children as a thunk and renders them in its scope", () => {
  const el = render(
    "ChildrenUser",
    `${base}function Wrap(props: { children: () => Node }) { return <Box children={props.children} /> }\nexport default function C() { return <Wrap><Text>x</Text><Text>y</Text></Wrap> }\n`,
  );
  expect(el.textContent).toBe("xy");
});
