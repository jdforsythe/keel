// @vitest-environment happy-dom
// std.sessions `net` events: recorded as inputs, kept through an overflow cut, applied by `replay`, written by
// `to-test`. Seed 1337
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Button } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Session, record, replay } from "../src/index.ts";
import { isInput } from "../src/internal/isInput.ts";
import { toTest } from "../src/toTest.ts";

function build() {
  const seen = store(s.object({ log: s.string() }), { log: "" }, { id: "seen" });
  const note = transaction(seen, "seen.note", s.object({ v: s.string() }), (st, p) => ({ log: st.log + p.v }));
  const routes = manifest({
    "net.show": {
      path: "/net",
      component(_p: unknown, _s: unknown, ctx?: { net: { online(): boolean } }): Node {
        return Box({
          as: "main",
          children: () => [
            Button({
              id: "net.probe",
              children: "Probe",
              onClick: () => void tx(note, { v: ctx?.net.online() === false ? "0" : "1" }),
            }),
          ],
        });
      },
    },
  });
  return { seen, routes };
}
const made: ReturnType<typeof build>[] = [];
scope(() => {
  made.push(build());
});
const [built] = made;
if (built === undefined) throw new Error("build failed");
const app = built;

async function live(switches: readonly boolean[], limit?: number) {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const rec = record(ctx, limit === undefined ? {} : { limit });
  const h = await renderRoute("net.show", { routes: app.routes, ctx, state: [[app.seen, { log: "" }]] });
  for (const b of switches) {
    ctx.clock.advance(10);
    ctx.net.setOnline(b);
    await h.fire("net.probe", { type: "click" });
  }
  const state = h.state();
  const session = rec.stop();
  h.dispose();
  return { state, session };
}

describe("net events", () => {
  test("a recorded session with net events parses, and replay reproduces its state", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 6 }), async (switches) => {
        const { state, session } = await live(switches);
        expect(Session.parse(JSON.parse(JSON.stringify(session))).ok).toBe(true);
        for (const e of session.events) if (e.kind === "net") expect(isInput(e)).toBe(true);
        const r = await replay(session, { routes: app.routes });
        expect(r.state).toEqual(state);
        expect(r.reproduced).toBe(true);
      }),
      { seed: 1337, numRuns: 15 },
    );
  });

  test("past `limit`, a session with net inputs keeps at most `limit` events and still parses", async () => {
    for (const limit of [1, 2, 3]) {
      const { session } = await live([false, true, false, true, false], limit);
      expect(session.events.length).toBeLessThanOrEqual(limit);
      expect(Session.parse(JSON.parse(JSON.stringify(session))).ok).toBe(true);
    }
  });

  test("to-test writes each net event as a setOnline call", async () => {
    const { session } = await live([false, true]);
    const text = toTest(session, { navs: [], stores: [], routes: [{ module: "net", from: "../routes.ts" }] });
    expect(text).toContain("ctx.net.setOnline(false);");
    expect(text).toContain("ctx.net.setOnline(true);");
    expect(text.indexOf("setOnline(false)")).toBeLessThan(text.indexOf("setOnline(true)"));
  });
});
