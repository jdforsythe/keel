// Shared fixtures for the std.statecharts conformance files (not a test file).
// Assumption: `store.snapshot()` is `{ state, log, initial, head }` and `store.restore(snapshot)` accepts that shape with `state` and `initial` replaced and an empty log.
import { s } from "@keel/schema";
import type { Snapshot, Store } from "@keel/store";
import { chart } from "@keel/std-statecharts";

let counter = 0;
/** A store id no earlier chart in this file used, so two live charts never collide. */
export const nextId = (name: string): string => {
  counter += 1;
  return `todos.${name}${counter}`;
};

export const EVENTS = ["edit", "save", "saved", "refused", "failed", "mine", "theirs", "cancel"] as const;
export const STATES = ["viewing", "editing", "saving", "conflict", "gaveUp"] as const;
export const Attempts = s.object({ attempts: s.int({ min: 0, max: 3 }) });

/** The spec's editor chart with a finite `data` schema. */
export function editor(name = "editor") {
  const empty = s.object({});
  return chart(nextId(name), {
    data: Attempts,
    start: { attempts: 0 },
    events: {
      edit: empty,
      save: empty,
      saved: empty,
      refused: empty,
      failed: empty,
      mine: empty,
      theirs: empty,
      cancel: empty,
    },
    guards: { canRetry: (d) => d.attempts < 3 },
    actions: { count: (d) => ({ attempts: d.attempts + 1 }), reset: () => ({ attempts: 0 }) },
    initial: "viewing",
    states: {
      viewing: { on: { edit: "editing" } },
      editing: { on: { save: { to: "saving", do: "count" }, cancel: "viewing" } },
      saving: {
        on: {
          saved: { to: "viewing", do: "reset" },
          refused: "conflict",
          failed: [{ to: "saving", guard: "canRetry", do: "count" }, { to: "gaveUp" }],
        },
      },
      conflict: {
        on: { mine: { to: "saving", guard: "canRetry", do: "count" }, theirs: { to: "viewing", do: "reset" } },
      },
      gaveUp: { final: true },
    },
  });
}

/** Replaces a store's state (and the base `undo` replays from) with `state`, log empty. */
export function setState<T>(st: Store<T>, state: T): void {
  const snap: Snapshot<T> = st.snapshot();
  st.restore({ ...snap, state, initial: state, log: [] });
}
