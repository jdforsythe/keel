import type { LooseState } from "./LooseState.ts";
import type { Shape } from "./Shape.ts";
import { targetsOf } from "./targetsOf.ts";

const named = (name: string) => ({ name, at: undefined });

/** The analyzed shape of a declaration `chart` was given. */
export function shapeOf(spec: {
  readonly initial: string;
  readonly states: Readonly<Record<string, LooseState>>;
  readonly events: object;
  readonly guards?: object;
  readonly actions?: object;
}): Shape<undefined> {
  return {
    initial: named(spec.initial),
    states: Object.entries(spec.states).map(([name, st]) => ({
      name,
      at: undefined,
      final: st.final === true,
      hasOn: st.on !== undefined,
      on: Object.entries(st.on ?? {}).map(([event, entry]) => ({
        event: named(event),
        targets: targetsOf(entry).map((t) => ({
          ...(t.to === undefined ? {} : { to: named(t.to) }),
          ...(t.guard === undefined ? {} : { guard: named(t.guard) }),
          ...(t.do === undefined ? {} : { do: named(t.do) }),
        })),
      })),
    })),
    events: Object.keys(spec.events),
    guards: Object.keys(spec.guards ?? {}),
    actions: Object.keys(spec.actions ?? {}),
  };
}
