import type { Problem } from "./Problem.ts";
import type { Shape } from "./Shape.ts";

/**
 * The one structural analysis of a chart declaration, used by `chart` (which throws what it finds) and by the
 * `keel check` rules: E2751 a name naming no state, E2753 a non-final state with no target to another state, E2754 a
 * final state with `on`, an `on` event outside `events`, or a `guard` or `do` naming no entry. `nearest` (the checker's)
 * names the fix of an E2751. Problems come in declaration order.
 */
export function analyze<P>(
  shape: Shape<P>,
  nearest?: (name: string, names: readonly string[]) => string | undefined,
): Problem<P>[] {
  const names = shape.states.map((st) => st.name);
  const out: Problem<P>[] = [];
  const known = (n: string): boolean => names.includes(n);
  const unknownState = (n: { readonly name: string; readonly at: P }, what: string): void => {
    if (known(n.name)) return;
    const fix = nearest?.(n.name, names);
    out.push({
      code: "E2751",
      at: n.at,
      message: `${what} '${n.name}' names no state${fix === undefined ? "" : `; nearest '${fix}'`}`,
      ...(fix === undefined ? {} : { fix }),
    });
  };
  const missing = (
    n: { readonly name: string; readonly at: P } | undefined,
    list: readonly string[] | undefined,
    what: string,
  ): void => {
    if (n !== undefined && list !== undefined && !list.includes(n.name))
      out.push({
        code: "E2754",
        at: n.at,
        message: `${what} '${n.name}' is not in ${what === "do" ? "actions" : `${what}s`}`,
      });
  };
  unknownState(shape.initial, "initial");
  for (const st of shape.states) {
    if (st.final && st.hasOn) out.push({ code: "E2754", at: st.at, message: `final state '${st.name}' has on` });
    let exits = false;
    for (const on of st.on) {
      if (shape.events !== undefined && !shape.events.includes(on.event.name))
        out.push({ code: "E2754", at: on.event.at, message: `event '${on.event.name}' is not in events` });
      for (const t of on.targets) {
        if (t.to !== undefined) unknownState(t.to, `${st.name}.${on.event.name} target`);
        if (t.to !== undefined && t.to.name !== st.name) exits = true;
        missing(t.guard, shape.guards, "guard");
        missing(t.do, shape.actions, "do");
      }
    }
    if (!st.final && !exits)
      out.push({
        code: "E2753",
        at: st.at,
        message: `state '${st.name}' is not final and has no target to another state`,
        ...(st.on.length === 0 ? { fix: "{ final: true }" } : {}),
      });
  }
  return out;
}
