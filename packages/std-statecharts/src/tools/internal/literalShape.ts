import type { Shape } from "../../internal/Shape.ts";
import type { Node } from "./Node.ts";
import type { Span } from "./Span.ts";
import { entriesOf } from "./entriesOf.ts";
import { stringOf } from "./stringOf.ts";
import { unwrap } from "./unwrap.ts";

type Named = { readonly name: string; readonly at: Span };
type ShapeTarget = { to?: Named; guard?: Named; do?: Named };

const span = (n: Node): Span => ({ start: n.start, end: n.end });

/**
 * The shape of one `chart` call's declaration as written, and `loose`: where its `initial`, `events`, `guards`,
 * `actions`, `states`, a state, `on` keys, `final` or a target are not literals (a variable, a spread, a computed key). `shape` is present only when `loose` is empty.
 */
export function literalShape(call: Node): { readonly shape?: Shape<Span>; readonly loose: readonly Span[] } {
  const loose: Span[] = [];
  const args = Array.isArray(call.arguments) ? call.arguments : [];
  const decl = unwrap(args[1]);
  const props = entriesOf(decl);
  if (props === undefined) return { loose: [span(decl ?? call)] };
  const get = (name: string): Node | undefined => unwrap(props.find((p) => p.name === name)?.value);
  const names = (name: string): readonly string[] => {
    const n = get(name);
    const list = n === undefined ? [] : entriesOf(n)?.map((e) => e.name);
    if (list === undefined && n !== undefined) loose.push(span(n));
    return list ?? [];
  };
  const events = names("events");
  const guards = names("guards");
  const actions = names("actions");
  const target = (x: unknown, out: ShapeTarget[], listed = false): void => {
    const n = unwrap(x);
    if (n === undefined) return;
    const to = stringOf(n);
    if (to !== undefined) return void out.push({ to: { name: to, at: span(n) } });
    if (n.type === "ArrayExpression" && Array.isArray(n.elements) && !listed) {
      for (const el of n.elements) if (el !== null) target(el, out, true);
      return;
    }
    const fields = entriesOf(n);
    if (fields === undefined) return void loose.push(span(n));
    const t: ShapeTarget = {};
    for (const f of fields) {
      const v = unwrap(f.value);
      const value = stringOf(v);
      if (v === undefined || value === undefined) return void loose.push(span(f.value));
      if (f.name === "to" || f.name === "guard" || f.name === "do") t[f.name] = { name: value, at: span(v) };
    }
    out.push(t);
  };
  const initial = get("initial");
  const first = stringOf(initial);
  if (first === undefined) loose.push(span(initial ?? decl ?? call));
  const statesNode = get("states");
  const stateEntries = entriesOf(statesNode);
  if (stateEntries === undefined) loose.push(span(statesNode ?? decl ?? call));
  const states: Shape<Span>["states"][number][] = [];
  for (const st of stateEntries ?? []) {
    const value = unwrap(st.value);
    const body = entriesOf(value);
    if (value === undefined || body === undefined) {
      loose.push(span(st.value));
      continue;
    }
    const finalNode = unwrap(body.find((p) => p.name === "final")?.value);
    const isFinal = finalNode?.type === "Literal" && typeof finalNode.value === "boolean" ? finalNode.value : undefined;
    if (finalNode !== undefined && isFinal === undefined) loose.push(span(finalNode));
    const onNode = unwrap(body.find((p) => p.name === "on")?.value);
    const onEntries = onNode === undefined ? [] : entriesOf(onNode);
    if (onNode !== undefined && onEntries === undefined) loose.push(span(onNode));
    states.push({
      name: st.name,
      at: span(value),
      final: isFinal === true,
      hasOn: onNode !== undefined,
      on: (onEntries ?? []).map((e) => {
        const targets: ShapeTarget[] = [];
        target(e.value, targets);
        return { event: { name: e.name, at: span(e.key) }, targets };
      }),
    });
  }
  if (loose.length > 0 || first === undefined || initial === undefined) return { loose };
  return {
    loose,
    shape: {
      initial: { name: first, at: span(initial) },
      states,
      events,
      guards,
      actions,
    },
  };
}
