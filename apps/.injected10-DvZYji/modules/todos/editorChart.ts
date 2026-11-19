import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import { EditorData } from "./EditorData.schema.ts";

/**
 * The todo editor's status (store `todos.editor`): `viewing` until a todo's edit page opens (`edit`), `editing` until
 * Save (`save`), `saving` until the outbox answers: `saved` back to `viewing`, `refused` to `conflict`, `failed` to
 * `saving` again while fewer than 3 sends were made, else `gaveUp`. In `conflict` the outbox panel's Keep mine sends
 * it again (`mine`, within the same 3) and Keep theirs drops it (`theirs`).
 */
export const editorChart = chart("todos.editor", {
  data: EditorData,
  start: { attempts: 0 },
  events: {
    edit: s.object({}),
    save: s.object({}),
    saved: s.object({}),
    refused: s.object({}),
    failed: s.object({}),
    mine: s.object({}),
    theirs: s.object({}),
    cancel: s.object({}),
  },
  guards: { canRetry: (d) => d.attempts < 3 },
  actions: { count: (d) => ({ attempts: Math.min(3, d.attempts + 1) }), reset: () => ({ attempts: 0 }) },
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
