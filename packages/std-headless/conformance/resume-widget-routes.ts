// The routes module of the packaged-widget suite (not a test file). The test imports it for the server side; `resumeDocument`
// imports it again for the client side, where every module it reaches is evaluated anew.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import * as headless from "@keel/std-headless";
import * as ui from "@keel/ui";
import { compilePage } from "./resume-support.ts";

const MODULES = { "@keel/std-headless": headless, "@keel/ui": ui };

const HEAD = `import { signal } from "@keel/reactive";
import { Combobox, Dialog, Disclosure, Listbox, Menu, Tabs, Toaster } from "@keel/std-headless";
import { Button, Text } from "@keel/ui";
const FRUIT = [{ key: "apple", text: "Apple" }, { key: "banana", text: "Banana" }, { key: "cherry", text: "Cherry" }];
`;

/** A page: `body` is its widget, `<k>.calls` counts the widget's callback and `<k>.last` shows its last argument. */
const page = (k: string, body: string, state = ""): string => `${HEAD}export default function Page() {
  const calls = signal(0);
  const last = signal("none");
  ${state}
  const note = (v) => { calls.set(calls.get() + 1); last.set(String(v)); };
  return <main id="${k}.root">
    ${body}
    <Text id="${k}.calls">{calls.get()}</Text><Text id="${k}.last">{last.get()}</Text>
  </main>
}
`;

export const WIDGETS = [
  {
    key: "lb",
    name: "Listbox",
    source: page(
      "lb",
      `<Listbox id="lb" label="Fruit" mode="single" options={() => FRUIT} selected={() => chosen.get()} onChange={(keys) => { chosen.set(keys); note(keys.join(",")); }} />`,
      "const chosen = signal([]);",
    ),
  },
  {
    key: "cb",
    name: "Combobox",
    source: page(
      "cb",
      `<Combobox id="cb" label="Fruit" text={() => typed.get()} onInput={(v) => typed.set(v)} options={() => FRUIT.filter((f) => f.text.toLowerCase().includes(typed.get().toLowerCase()))} onChange={(k) => note(k)} />`,
      `const typed = signal("");`,
    ),
  },
  {
    key: "mn",
    name: "Menu",
    source: page(
      "mn",
      `<Menu id="mn" trigger={() => "Actions"} items={() => [{ key: "rename", text: "Rename" }, { key: "remove", text: "Remove" }]} onSelect={(k) => note(k)} />`,
    ),
  },
  {
    key: "tb",
    name: "Tabs",
    source: page(
      "tb",
      `<Tabs id="tb" label="Sections" tabs={() => [{ key: "one", text: "One" }, { key: "two", text: "Two" }]} selected={() => current.get()} onChange={(k) => { current.set(k); note(k); }} panel={(k) => <Text id={"tb.body." + k}>{"Body " + k}</Text>} />`,
      `const current = signal("one");`,
    ),
  },
  {
    key: "dg",
    name: "Dialog",
    source: page(
      "dg",
      `<Dialog id="dg" title="Confirm" trigger={() => "Open"} content={(close) => <Button id="dg.ok" onClick={() => { note("ok"); close(); }}>OK</Button>} />`,
    ),
  },
  {
    key: "dc",
    name: "Disclosure",
    source: page(
      "dc",
      `<Disclosure id="dc" summary={() => "Shipping"}><Text id="dc.body">Ships in two days.</Text><Text id="dc.more">Free over 50.</Text></Disclosure>`,
    ),
  },
  {
    key: "ts",
    name: "Toaster",
    source: page(
      "ts",
      `<Toaster id="ts" dismiss="Dismiss" items={() => items.get()} onDismiss={(id) => { items.set(items.get().filter((i) => i.id !== id)); note(id); }} />`,
      `const items = signal([{ id: "t1", text: "Saved", tone: "status" }]);`,
    ),
  },
] as const;

const widgets = contract("w", Object.fromEntries(WIDGETS.map((w) => [`w.${w.key}`, { path: `/${w.key}` }])));

export const routes = manifest(
  widgets,
  Object.fromEntries(
    WIDGETS.map((w) => [`w.${w.key}`, { component: compilePage(`${w.key}.page`, w.source, MODULES) }]),
  ),
);
