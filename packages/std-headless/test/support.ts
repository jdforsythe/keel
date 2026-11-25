// What the package's tests share: a sim ctx, a harness page, the fruit list, and reads of a rendered widget through
// the harness (the a11y tree and store values), never through the DOM.
import type { Ctx } from "@keel/ctx";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import type { A11yNode, Harness } from "@keel/testing";
import type { Option } from "../src/Option.ts";

export const SEED = 1337;

export const simCtx = (seed = SEED) => createCtx({ mode: "sim", seed });

/** A harness component with an empty `Props` schema around `view`, which receives the harness's ctx. */
export const page = (view: (ctx: Ctx) => Node) =>
  Object.assign((_props: Record<string, never>, ctx: Ctx): Node => view(ctx), {
    Props: s.object({}),
  });

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export const fruit: readonly Option<string>[] = [
  { key: "apple", text: "Apple" },
  { key: "banana", text: "Banana" },
  { key: "cherry", text: "Cherry" },
];

const ids = (nodes: readonly A11yNode[]): string[] => nodes.flatMap((n) => [n.id, ...ids(n.children)]);

/** Whether the element with `id` is in the a11y tree: rendered and not `hidden`. */
export const shown = <C extends Ctx>(t: Harness<C>, id: string): boolean => ids(t.a11y()).includes(id);

/** Whether an element with `id` is rendered at all, hidden or not (`find` reports E1705 for none). */
export const rendered = <C extends Ctx>(t: Harness<C>, id: string): boolean => {
  try {
    t.find(id);
    return true;
  } catch {
    return false;
  }
};

/** Whether the `openChart` instance of the widget `id` (a Dialog, a Disclosure) is open. */
export const isOpen = <C extends Ctx>(t: Harness<C>, id: string): boolean => {
  const v = t.state()[`headless.open:${id}`];
  return isRecord(v) && v.state === "open";
};
