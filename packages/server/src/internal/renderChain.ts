import type { Level } from "@keel/router/internal";
import { type JsonValue, type KeelError, attempt } from "@keel/schema";
import type { ChainInput } from "./ChainInput.ts";
import type { Rendered } from "./Rendered.ts";
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
 * Render a chain to HTML like the router's view (k.router, k.errors): outermost layout first, each layout
 * receiving the next level, rendered before it, as `children` (a thunk whose string form is the child HTML, so string
 * components can interpolate it). A failure renders its level's `errorElement` (layouts above intact unless
 * `bare`); level -1 is the default alert. A route with an `errorElement` is a boundary: a throw while
 * rendering it shows the errorElement with `keel.unexpected`. A component returning an element with a bound
 * (`data-k`) element outside nested levels' islands, however it was built (template or base element, rfc:0067), is an island: it gets
 * `data-k-island="<routeId>"` and its props go to `islands` (k.runtime resume markup, rfc:0037).
 */
export function renderChain(input: ChainInput): Rendered {
  const { chain, failure, ctx } = input;
  const islands: Record<string, JsonValue> = {};
  let caught: KeelError<string, unknown> | null = null;

  const errorAt = (i: number, error: KeelError<string, unknown>): string => {
    const el = chain[i]?.def;
    const shown = input.publicize(error);
    const make = el?.errorElement;
    // A render unit, as for components: a compiled errorElement's bindings need a mount context (backlog 0156).
    return make === undefined ? defaultError(shown) : toHtml(renderUnit(() => make({ error: shown })));
  };

  const componentAt = (i: number, lvl: Level): string => {
    const last = i === chain.length - 1;
    // The child level renders first, outside this unit, so render units never nest.
    const inner = last ? "" : levelAt(i + 1);
    const childHtml = (): string => inner;
    const children = Object.assign((): Node => htmlToNode(childHtml()), { toString: childHtml });
    const base = { params: input.params, search: input.search, data: input.data[i] };
    const out = renderUnit(() => lvl.def.component(last ? base : { ...base, children }, undefined, ctx));
    if (typeof Element !== "undefined" && out instanceof Element && islandIn(out)) {
      out.setAttribute("data-k-island", lvl.id);
      islands[lvl.id] = input.props(i);
    }
    return `${last ? input.prepend : ""}${toHtml(out)}`;
  };

  const levelAt = (i: number): string => {
    const lvl = chain[i];
    if (lvl === undefined) return "";
    if (failure !== null && failure.level === i) return errorAt(i, failure.error);
    if (lvl.def.errorElement === undefined) return componentAt(i, lvl);
    const r = attempt(() => componentAt(i, lvl));
    if (r.ok) return r.value;
    caught ??= r.error;
    return errorAt(i, r.error);
  };

  const html =
    failure !== null && failure.level < 0
      ? defaultError(input.publicize(failure.error))
      : failure?.bare === true
        ? errorAt(failure.level, failure.error)
        : levelAt(0);
  return { html, islands, caught };
}
