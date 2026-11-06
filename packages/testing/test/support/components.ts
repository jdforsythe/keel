// Components for the package's own tests, built from runtime-dom ops the way compiled output is.
import { scope, signal } from "@keel/reactive";
import { attr, clone, on, template, text } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { byId } from "./byId.ts";

const LabelsProps = s.object({ label: s.string({ min: 1 }) });
const LabelsT = template(
  '<div><button id="by.aria">content</button><label for="by.label"></label><input id="by.label">' +
    '<img id="by.alt"><button id="by.text"></button><p id="by.labelledby" aria-labelledby="by.text"></p>' +
    '<label><span id="wrapped.text"></span><input id="by.wrap"></label></div>',
);

/** Names one element by each accessible-name source, all from `label`. */
export const Labels = Object.assign(
  (props: { readonly label: string }): Node => {
    const root = clone(LabelsT);
    attr(byId(root, "by.aria"), "aria-label", () => props.label);
    const label = root.children[1];
    if (label === undefined) throw new Error("test support: Labels template changed");
    text(label, () => props.label);
    attr(byId(root, "by.alt"), "alt", () => props.label);
    text(byId(root, "by.text"), () => props.label);
    text(byId(root, "wrapped.text"), () => props.label);
    return root;
  },
  { Props: LabelsProps },
);

/** Store owned by a never-disposed scope, as module-level stores must be (E1203). */
const own = <T>(make: () => T): T => {
  let made: { readonly value: T } | undefined;
  scope(() => {
    made = { value: make() };
  });
  if (made === undefined) throw new Error("test support: scope did not run");
  return made.value;
};

export const Note = s.object({ text: s.string(), focused: s.boolean(), keys: s.array(s.string()) });
export const notes = own(() => store(Note, { text: "", focused: false, keys: [] }, { id: "test.notes" }));
const setText = transaction(notes, "test.setText", s.object({ text: s.string() }), (st, { text: t }) => ({
  ...st,
  text: t,
}));
const setFocused = transaction(notes, "test.setFocused", s.object({ focused: s.boolean() }), (st, p) => ({
  ...st,
  focused: p.focused,
}));
const addKey = transaction(notes, "test.addKey", s.object({ key: s.string() }), (st, { key }) => ({
  ...st,
  keys: [...st.keys, key],
}));

const EditorT = template(
  '<form id="ed.form"><label for="ed.input">Note</label><input id="ed.input">' +
    '<button id="ed.boom" type="button">Boom</button><p id="ed.out"></p></form>',
);

/** Input, focus, keydown, and a throwing handler, wired the way compiled output wires them. */
export const Editor = Object.assign(
  (_props: Record<string, never>): Node => {
    const root = clone(EditorT);
    const submits = signal(0);
    text(byId(root, "ed.out"), () => `${notes.get("text")}|${submits.get()}`);
    on("ed.input", "input", (e) => {
      const v: unknown = e.target === null ? undefined : Reflect.get(e.target, "value");
      tx(setText, { text: typeof v === "string" ? v : "" });
    });
    on("ed.input", "focus", () => tx(setFocused, { focused: true }));
    on("ed.input", "blur", () => tx(setFocused, { focused: false }));
    on("ed.input", "keydown", (e) => tx(addKey, { key: e instanceof KeyboardEvent ? e.key : "?" }));
    on("ed.form", "submit", () => submits.set(submits.get() + 1));
    on("ed.boom", "click", () => {
      throw new Error("boom");
    });
    return root;
  },
  { Props: s.object({}) },
);

/** Throws while rendering when `n` is negative. */
export const Fragile = Object.assign(
  (props: { readonly n: number }): Node => {
    if (props.n < 0) throw new Error(`negative ${props.n}`);
    return clone(template('<p id="fragile">ok</p>'));
  },
  { Props: s.object({ n: s.int() }) },
);
