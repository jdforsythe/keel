import type { Level } from "@keel/router/internal";
import { E1255 } from "@keel/runtime-dom/internal";
import type { JsonValue, KeelError } from "@keel/schema";
import { storeReads } from "@keel/store/internal";
import type { ChainInput } from "./ChainInput.ts";
import type { Rendered } from "./Rendered.ts";
import { attempted } from "./attempted.ts";
import { escapeHtml } from "./escapeHtml.ts";
import { htmlToNode } from "./htmlToNode.ts";
import { islandIn } from "./islandIn.ts";
import { renderUnit } from "./renderUnit.ts";
import { toHtml } from "./toHtml.ts";

/** The default alert: the error's message, or for `keel.notFound` the heading `Not found`. */
const defaultError = (e: KeelError<string, unknown>): string =>
  `<div role="alert" data-keel-error="${escapeHtml(e.code)}">${
    e.code === "keel.notFound" ? "<h1>Not found</h1>" : escapeHtml(e.message)
  }</div>`;

/**
 * Render a chain to HTML like the router's view (k.router, k.errors), each component and errorElement called
 * `(props, ctx)` with `ctx` the app's own (`createApp({ ctx })`, the one its loaders get): outermost layout first, each layout
 * receiving the next level, rendered before it and led by a `<!--k-->` comment, as `children` (a thunk whose string form is the child HTML, so string
 * components can interpolate it; a second call throws E1255, k.resume). A failure renders its level's `errorElement` (layouts above intact unless
 * `bare`); level -1 is the default alert. A route with an `errorElement` is a boundary: a throw while
 * rendering it shows the errorElement with `keel.unexpected`. A component returning an element with a bound
 * (`data-k`) element outside nested levels' islands, however it was built (template or base element), is an island: it gets
 * `data-k-island="<routeId>"` and its props go to `islands` (k.runtime resume markup). `eager` is whether a level's
 * render placed an element made before the op placing it (E1257, k.claim Server). `touched` holds the ids of the stores
 * island levels' renders created, looked up or read.
 */
export function renderChain(input: ChainInput): Rendered {
  const { chain, failure, ctx } = input;
  const islands: Record<string, JsonValue> = {};
  const touched = new Set<string>();
  let caught: KeelError<string, unknown> | null = null;
  const seen = { eager: false, nothing: false };

  const errorAt = (i: number, error: KeelError<string, unknown>): string => {
    const el = chain[i]?.def;
    const shown = input.publicize(error);
    const make = el?.errorElement;
    // A render unit, as for components: a compiled errorElement's bindings need a mount context.
    return make === undefined ? defaultError(shown) : toHtml(renderUnit(() => make({ error: shown }, ctx), ctx, seen));
  };

  const componentAt = (i: number, lvl: Level): string => {
    const last = i === chain.length - 1;
    // The child level renders first, outside this unit, so render units never nest. Its content starts with `<!--k-->`:
    // a layout island mismatching before its `children` call holds the region that comment opens (k.resume).
    const inner = last ? "" : `<!--k-->${levelAt(i + 1)}`;
    const childHtml = (): string => inner;
    let calls = 0;
    const children = Object.assign(
      (): Node => {
        if (calls++) throw new Error(E1255);
        return htmlToNode(inner);
      },
      { toString: childHtml },
    );
    const base = { params: input.params, search: input.search, data: input.data[i] };
    // An API route (k.api) has no component and is never rendered. The stores the render creates, looks up or reads
    // are noted (`storeReads`); an island level's go to `#k-state` (k.leave Snapshots).
    const used = new Set<string>();
    storeReads.note = (id) => used.add(id);
    let out: ReturnType<typeof renderUnit>;
    try {
      out = renderUnit(() => lvl.def.component?.(last ? base : { ...base, children }, ctx) ?? "", ctx, seen);
    } finally {
      storeReads.note = null;
    }
    if (typeof Element !== "undefined" && out instanceof Element && islandIn(out)) {
      out.setAttribute("data-k-island", lvl.id);
      islands[lvl.id] = input.props(i);
      for (const id of used) touched.add(id);
    }
    return `${last ? input.prepend : ""}${toHtml(out)}`;
  };

  const levelAt = (i: number): string => {
    const lvl = chain[i];
    if (lvl === undefined) return "";
    if (failure !== null && failure.level === i) return errorAt(i, failure.error);
    if (lvl.def.errorElement === undefined) return componentAt(i, lvl);
    const r = attempted(() => componentAt(i, lvl));
    if (r.ok) return r.value;
    const e = input.publicize(r.error);
    caught ??= e;
    return errorAt(i, e);
  };

  const html =
    failure !== null && failure.level < 0
      ? defaultError(input.publicize(failure.error))
      : failure?.bare === true
        ? errorAt(failure.level, failure.error)
        : levelAt(0);
  return { html, islands, touched, caught, eager: seen.eager, nothing: seen.nothing };
}
