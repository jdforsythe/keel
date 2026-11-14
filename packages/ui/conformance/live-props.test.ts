// @vitest-environment happy-dom
// Spec: k.ui Conformance, "A getter `label` over a signal on an `Input`, `Select`, `TextArea`, `Checkbox` and `Box as="nav"` shows each write on the same element."
// Seed: 1337.
import { type Signal, scope, signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Box, Checkbox, Input, Select, TextArea } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const owned = <T>(init: T): Signal<T> => {
  const slot: Signal<T>[] = [];
  scope(() => {
    slot.push(signal(init));
  });
  const [sig] = slot;
  if (sig === undefined) throw new Error("fixture: no signal");
  return sig;
};

/** The accessible name of `#id`: `aria-label`, else the text of the `label` that names it. */
const nameOf = (root: ParentNode, id: string): string => {
  const el = root.querySelector(`#${id}`);
  if (el === null) throw new Error(`no element ${id}`);
  const aria = el.getAttribute("aria-label");
  if (aria !== null) return aria.trim();
  const label = root.querySelector(`label[for="${id}"]`) ?? el.closest("label");
  return (label?.textContent ?? "").trim();
};

type Build = (label: Signal<string>) => Node;
const CASES: ReadonlyArray<readonly [string, Build]> = [
  [
    "Input",
    (l) =>
      Input({
        id: "x",
        get label() {
          return l.get();
        },
      }),
  ],
  [
    "Select",
    (l) =>
      Select({
        id: "x",
        get label() {
          return l.get();
        },
        value: "a",
        options: [{ value: "a", label: "A" }],
      }),
  ],
  [
    "TextArea",
    (l) =>
      TextArea({
        id: "x",
        get label() {
          return l.get();
        },
      }),
  ],
  [
    "Checkbox",
    (l) =>
      Checkbox({
        id: "x",
        get label() {
          return l.get();
        },
      }),
  ],
  [
    'Box as="nav"',
    (l) =>
      Box({
        id: "x",
        as: "nav",
        get label() {
          return l.get();
        },
        children: "b",
      }),
  ],
];

const word = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,11}$/);

describe("k.ui: a getter label over a signal shows each write on the same element", () => {
  for (const [name, build] of CASES) {
    test(`a getter \`label\` over a signal on ${name} shows each write on the same element`, async () => {
      await fc.assert(
        fc.asyncProperty(word, fc.array(word, { minLength: 2, maxLength: 4 }), async (first, writes) => {
          const label = owned(first);
          const root = document.createElement("div");
          document.body.appendChild(root);
          const off = mount(() => build(label), root);
          await flush();
          const el = root.querySelector("#x");
          expect(el).not.toBeNull();
          expect(nameOf(root, "x")).toBe(first);
          for (const w of writes) {
            label.set(w);
            await flush();
            expect(root.querySelector("#x")).toBe(el);
            expect(nameOf(root, "x")).toBe(w);
          }
          off();
          root.remove();
        }),
        { seed: SEED, numRuns: 10 },
      );
    });
  }
});
