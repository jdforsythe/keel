// The routes module of the packaged `@keel/ui` and `@keel/router` suites (not a test file). A test imports it for the server side;
// `resumeDocument` imports it again for the client side, where every module it reaches is evaluated anew.
import { action, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { MODULES, compilePage } from "./claim-support.ts";

const links = contract("ul", { "ul.target": { path: "/ul/target" } });
const linked = { ...MODULES, links: { href: () => links.href("ul.target") } };

const HEAD = `import { signal } from "@keel/reactive";
import { Box, Button, Checkbox, Heading, Image, Input, Link, Select, Text, TextArea } from "@keel/ui";
import { href } from "links";
`;

/** A page of one base element: a counter beside it, so the level is an island, and a `seen` output the element's handler writes. */
const page = (k: string, element: string): string => `${HEAD}export default function Page() {
  const n = signal(0);
  const seen = signal("none");
  return <main id="${k}.root">
    <Button id="${k}.inc" onClick={() => n.set(n.get() + 1)}>+</Button><Text id="${k}.out">{n.get()}</Text>
    ${element}
    <Text id="${k}.seen">{seen.get()}</Text>
  </main>
}
`;

/** One page per base element: its id, its element and the handler it takes. */
export const ELEMENTS = [
  { name: "Box", element: `<Box id="ue.box"><Text id="ue.inner">inner</Text></Box>` },
  { name: "Text", element: `<Text id="ue.text">text {n.get()}</Text>` },
  { name: "Heading", element: `<Heading id="ue.heading" level={2}>Title {n.get()}</Heading>` },
  { name: "Button", element: `<Button id="ue.button" onClick={() => seen.set("clicked")}>Press</Button>` },
  { name: "Link", element: `<Link id="ue.link" to={href()}>Go {n.get()}</Link>` },
  { name: "Image", element: `<Image id="ue.image" src="/a.png" alt="A picture" />` },
  { name: "Input", element: `<Input id="ue.input" label="Name" onInput={(v) => seen.set(v)} />` },
  { name: "TextArea", element: `<TextArea id="ue.textarea" label="Notes" onInput={(v) => seen.set(v)} />` },
  {
    name: "Select",
    element: `<Select id="ue.select" label="Fruit" options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} onChange={(v) => seen.set(v)} />`,
  },
  { name: "Checkbox", element: `<Checkbox id="ue.checkbox" label="Agree" onChange={(c) => seen.set(String(c))} />` },
] as const;

/** The notes the action received in this module graph. */
export const received: string[] = [];
const fmContract = contract("fm", {
  "fm.page": { path: "/fm" },
  "fm.save": { path: "/fm/save" },
});
const save = action(fmContract, "fm.save", { input: s.object({ note: s.string() }) }, (input) => {
  received.push(input.note);
  return Promise.resolve(ok(null));
});

const FORM = `${HEAD}import { Form } from "@keel/router";
export default function Page(props) {
  const n = signal(0);
  return <main id="fm.root">
    <Button id="fm.inc" onClick={() => n.set(n.get() + 1)}>+</Button><Text id="fm.out">{n.get()}</Text>
    <Form method="POST" action="/fm/save">
      <label id="fm.label" for="fm.note">Note</label>
      <input id="fm.note" name="note" />
      <button id="fm.submit" type="submit">Save</button>
    </Form>
  </main>
}
`;

const elementPage = (i: number, element: string) => {
  const id = `ue${i}.page`;
  const c = contract(`ue${i}`, { [id]: { path: `/ue${i}` } });
  return manifest(c, { [id]: { component: compilePage(id, page(`ue${i}`, element), linked) } });
};

export const routes = routeTable(
  ...ELEMENTS.map((e, i) => elementPage(i, e.element)),
  manifest(fmContract, {
    "fm.page": { component: compilePage("fm.page", FORM, linked) },
    "fm.save": { component: () => document.createElement("main"), POST: save },
  }),
);

export const MODULE_IDS = [...ELEMENTS.map((_e, i) => `ue${i}`), "fm"];

export default routes;
