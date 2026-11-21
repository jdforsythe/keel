// @vitest-environment happy-dom
// Spec: k.host-element, Conformance "`fire(id, { type: 'emit', detail })` calls `onEvent` with the parsed detail; a session holding that event replays to the same `state()`."
// Spec: k.host-code, Events "`emit(e)` parses `e` with `events`, reports `{ kind: 'fire', id, event: { type: 'emit', detail: e } }` to the ctx observers, then calls `onEvent(e)` as a handler: what the app does with it is a transaction, so it is logged, recorded in a session and replayed without the outside code."
// Spec: k.host-element, Harness and replay "a session's `emit` replays the same way."
// Seed 1337. The element's `code` imports a file that does not exist: neither the recording nor the replay may load it.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { Session as SessionSchema, record } from "@keel/std-sessions";
import { replay } from "@keel/std-sessions/replay";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Host } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

const Input = s.object({ n: s.number() });
const Emit = s.object({ at: s.number() });

const built = (() => {
  const made: { picks: ReturnType<typeof store>; routes: ReturnType<typeof manifest> }[] = [];
  scope(() => {
    const picks = store(s.object({ ats: s.array(s.number()) }), { ats: [] }, { id: "picks" });
    const pick = transaction(picks, "picks.add", Emit, (st, p) => ({ ats: [...st.ats, p.at] }));
    const routes = manifest({
      "chart.show": {
        path: "/chart",
        component: () =>
          Box({
            as: "main",
            id: "chart.page",
            children: () =>
              Host({
                id: "chart.host",
                role: "img",
                label: "Chart",
                input: Input,
                events: Emit,
                value: { n: 1 },
                onEvent: (e: { at: number }) => void tx(pick, e),
                code: () => import("./fixtures/neverLoaded.ts").then((m) => m.neverLoaded),
              }),
          }),
      },
    });
    made.push({ picks, routes });
  });
  const [first] = made;
  if (first === undefined) throw new Error("fixture: build failed");
  return first;
})();

describe("k.host-element: a session replays an `emit` without the library", () => {
  test("a session holding an `emit` replays to the same `state()`, reproduced, with no import of `code`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 5 }), async (ats) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const rec = record(ctx, {});
        const { picks, routes } = built;
        const h = await renderRoute("chart.show", { routes, ctx, state: [[picks, { ats: [] }]] });
        for (const at of ats) await h.fire("chart.host", { type: "emit", detail: { at } });
        const live = h.state();
        expect(live).toEqual({ picks: { ats } });
        const session = rec.stop();
        h.dispose();
        expect(JSON.stringify(SessionSchema.encode(session))).toContain('"emit"');
        const r = await replay(session, { routes });
        expect(r.state).toEqual(live);
        expect(r.reproduced).toBe(true);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
