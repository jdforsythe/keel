// Shared fixtures for the std.headless and std.options conformance files (not a test file). Property seed: 1337.
// Assumptions (the spec leaves them open):
// - a widget is called as `Widget(props, ctx)` (RFC 0162) inside a harness component, so it reaches the sim `ctx.clock` (k.component);
// - a slot such as `trigger`, `summary` or `empty` may return a string;
// - `render(...)` is synchronous and a throw at render (E2801) surfaces from `render`.
import type { Ctx } from "@keel/ctx";
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import type { Option } from "@keel/std-headless";
import { stores } from "@keel/store";
import type { render } from "@keel/testing";

export const SEED = 1337;

export const simCtx = (seed = SEED) => createCtx({ mode: "sim", seed });

/** A harness component with an empty `Props` schema around `view`, which receives the harness's ctx. */
export const page = (view: (ctx: Ctx) => Node) =>
  Object.assign((_props: Record<string, never>, ctx: Ctx): Node => view(ctx), {
    Props: s.object({}),
  });

export type Rendered = ReturnType<typeof render>;

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export const codeOf = (e: unknown): string | undefined => {
  if (isRecord(e) && typeof e.code === "string") return e.code;
  return undefined;
};

/** Runs fn and returns what it threw, or undefined when it did not throw. */
export const thrownSync = (fn: () => unknown): unknown => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e ?? new Error("threw a falsy value");
  }
};

/** Flattens an a11y tree (one node or an array) into nodes, depth first. */
export const flatten = (tree: unknown): Record<string, unknown>[] => {
  if (Array.isArray(tree)) return tree.flatMap(flatten);
  if (!isRecord(tree)) return [];
  const kids = Array.isArray(tree.children) ? tree.children.flatMap(flatten) : [];
  return [tree, ...kids];
};

/** The element with this id (a lookup by id, never a selector). */
export const el = (id: string): HTMLElement | null => document.getElementById(id);

/** Whether the element with this id is in the document and not `hidden`. */
export const shown = (id: string): boolean => {
  const e = el(id);
  return e !== null && !e.hidden;
};

/** Runs `make` in a reactive scope (a chart `instance` needs one) and returns what it made. */
export function inScope<T extends object>(make: () => T): T {
  const made: T[] = [];
  scope(
    () => {
      made.push(make());
    },
    { detached: true },
  );
  const [out] = made;
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
}

let counter = 0;
/** An instance key or widget id suffix no earlier call in this file used. */
export const nextKey = (name: string): string => {
  counter += 1;
  return `${name}${counter}`;
};

export const fruit: readonly Option<string>[] = [
  { key: "apple", text: "Apple" },
  { key: "banana", text: "Banana" },
  { key: "cherry", text: "Cherry" },
];

export const ids = (prefix: string, keys: readonly string[]): string[] => keys.map((k) => `${prefix}${k}`);

/** Every store whose id starts with `headless.` (an `optionsChart`, `openChart` or `toastChart` instance), as snapshot JSON. */
export const headlessSnapshots = (): { id: string; json: string }[] =>
  [...stores().entries()]
    .filter(([id]) => id.startsWith("headless."))
    .map(([id, st]) => ({ id, json: JSON.stringify(st.snapshot()) }));

/** The `{ state, active, count, back }` of a chart state value, or undefined when it is not an `optionsChart` state. */
export const optionsView = (
  v: unknown,
): { state: string; active: number; count: number; back: boolean } | undefined => {
  if (!isRecord(v) || typeof v.state !== "string" || !isRecord(v.data)) return undefined;
  const { active, count, back } = v.data;
  if (typeof active !== "number" || typeof count !== "number" || typeof back !== "boolean") return undefined;
  return { state: v.state, active, count, back };
};
