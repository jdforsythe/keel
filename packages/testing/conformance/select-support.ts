// Shared fixtures for the k.testing select-pick cases (not a test file). Property seed: 1337.
// `sel` is a single select of `alex` (selected), `sam` and a disabled `kim`; `multi` a `multiple` select; `txt` an input.
// Native listeners on each control and on the ancestor `sroot` log `<event>:<id>=<value>` (the value read at the target) and, for `sel`,
// `<event>:flags=<bubbles>/<composed>`.
import { createCtx } from "@keel/ctx";
import { clone, template } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";

export const SEED = 1337;
export const log: string[] = [];

const T = template(
  [
    '<div id="sroot" data-k="sroot">',
    '<select id="sel" data-k="sel" aria-label="Paid by">',
    '<option value="alex" selected>Alex</option><option value="sam">Sam</option><option value="kim" disabled>Kim</option>',
    "</select>",
    '<select id="multi" data-k="multi" aria-label="Many" multiple>',
    '<option value="alex">Alex</option><option value="sam">Sam</option>',
    "</select>",
    '<input id="txt" data-k="txt" aria-label="Text" value="t">',
    "</div>",
  ].join(""),
);

const readValue = (el: EventTarget | null): string =>
  el instanceof HTMLSelectElement || el instanceof HTMLInputElement ? el.value : "?";
const idOf = (el: EventTarget | null): string => (el instanceof Element ? el.id : "?");

export const View = Object.assign(
  (): Node => {
    const root = clone(T);
    if (!(root instanceof Element)) throw new Error("fixture: root is not an element");
    for (const el of [root, ...root.querySelectorAll("[data-k]")]) {
      for (const type of ["input", "change"] as const) {
        el.addEventListener(type, (e) => {
          log.push(`${type}:${el.id}=${readValue(e.target)}@${idOf(e.target)}`);
          if (el.id === "sel") log.push(`${type}:flags=${e.bubbles}/${e.composed}`);
        });
      }
    }
    return root;
  },
  { Props: s.object({}) },
);

export const mount = () => {
  log.length = 0;
  return render(View, { props: {}, ctx: createCtx({ mode: "sim", seed: SEED }) });
};
export const valueNow = (id: string): string => {
  const el = document.getElementById(id);
  if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) return el.value;
  throw new Error(`fixture: no control ${id}`);
};
export const attempt = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
    return undefined;
  } catch (e) {
    return e ?? new Error("threw a falsy value");
  }
};
export const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
