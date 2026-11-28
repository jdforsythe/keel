// Shared fixtures for the k.testing keydown cases (not a test file). Property seed: 1337.
// A view of focusable inputs `a`, `b`, `in` (inside the unfocusable container `box`) and the unfocusable `plain`.
// Each element logs its own `keydown`, `focus` and `blur` through native listeners, so the cases read what a browser would deliver;
// `log` entries are `<event>:<id>` and a keydown entry ends `@<event.target id>`.
import { createCtx } from "@keel/ctx";
import { clone, template } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";

export const SEED = 1337;
export const log: string[] = [];
export const FOCUSABLE = ["a", "b", "in"] as const;
const ALL = ["a", "b", "in", "box", "plain"] as const;

const T = template(
  [
    '<div id="kroot" data-k="kroot">',
    '<div id="box" data-k="box"><input id="in" data-k="in" aria-label="Inner"></div>',
    '<input id="a" data-k="a" aria-label="A">',
    '<input id="b" data-k="b" aria-label="B">',
    '<div id="plain" data-k="plain">plain</div>',
    "</div>",
  ].join(""),
);

const idOf = (target: EventTarget | null): string => (target instanceof Element ? target.id : "?");

export const View = Object.assign(
  (): Node => {
    const root = clone(T);
    if (!(root instanceof Element)) throw new Error("fixture: root is not an element");
    for (const id of ALL) {
      const el = root.querySelector(`[id="${id}"]`);
      if (el === null) throw new Error(`fixture: no ${id}`);
      el.addEventListener("keydown", (e) => log.push(`keydown:${id}@${idOf(e.target)}`));
      el.addEventListener("focus", () => log.push(`focus:${id}`));
      el.addEventListener("blur", () => log.push(`blur:${id}`));
    }
    return root;
  },
  { Props: s.object({}) },
);

export const mount = () => {
  log.length = 0;
  return render(View, { props: {}, ctx: createCtx({ mode: "sim", seed: SEED }) });
};
export const focusedIds = (t: ReturnType<typeof mount>): string[] =>
  ALL.filter((id) => t.find(id).state.focused === true);
export const focusEvents = (): string[] => log.filter((l) => l.startsWith("focus:") || l.startsWith("blur:"));
export const keydowns = (): string[] => log.filter((l) => l.startsWith("keydown:"));
