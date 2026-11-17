// @vitest-environment happy-dom
// `replay` and `minimize` (std.sessions API) on a session whose base `state` lacks a store the route renders: the
// replay starts that store at its `initial` whatever the live store holds, so two minimize runs are byte-equal.
// Seed 1337
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Button, Text } from "@keel/ui";
import { describe, expect, test } from "vitest";
import { Session, record } from "../src/index.ts";
import { minimize } from "../src/minimize.ts";
import { replay } from "../src/replay.ts";

const ZERO = { n: 0 };

function build() {
  const tally = store(s.object({ n: s.int() }), ZERO, { id: "tally" });
  const bump = transaction(tally, "tally.bump", s.object({}), (st) => ({ n: st.n + 1 }));
  const routes = manifest({
    "tally.show": {
      path: "/tally",
      component(): Node {
        return Box({
          as: "main",
          id: "tally.page",
          children: [
            Text({ id: "tally.n", children: () => String(tally.get("n")) }),
            Button({
              id: "tally.bump",
              children: "Bump",
              onClick: () => {
                if (tally.get("n") >= 1) throw new Error("tally over");
                void tx(bump, {});
              },
            }),
            Button({ id: "tally.noop", children: "Noop", onClick: () => undefined }),
          ],
        });
      },
    },
  });
  return { tally, routes };
}
let made: ReturnType<typeof build> | undefined;
const fixture = (): ReturnType<typeof build> => {
  if (made !== undefined) return made;
  const out: ReturnType<typeof build>[] = [];
  scope(() => void out.push(build()));
  const [first] = out;
  if (first === undefined) throw new Error("fixture");
  made = first;
  return first;
};

/** noop, bump, noop, bump (throws at n = 1), recorded from a zero tally; the base `state` then drops `tally`. */
async function stateless(): Promise<Session> {
  const { tally, routes } = fixture();
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const rec = record(ctx);
  const h = await renderRoute("tally.show", { routes, ctx, state: [[tally, ZERO]] });
  for (const id of ["tally.noop", "tally.bump", "tally.noop", "tally.bump"])
    await h.fire(id, { type: "click" }).catch(() => undefined);
  const session = rec.stop();
  h.dispose();
  const { tally: _dropped, ...rest } = session.state;
  return { ...session, state: rest };
}

/** Leave the live tally away from its `initial`, as an earlier test or replay might. */
const disturb = (n: number): void => {
  const r = fixture().tally.restore({ state: { n }, log: [], initial: ZERO });
  if (!r.ok) throw new Error("restore");
};

const encoded = (x: Session): string => JSON.stringify(Session.encode(x));

describe("replay and minimize without a store in the base state", () => {
  test("the recorded session errs at the second bump and its base state lacks tally", async () => {
    const session = await stateless();
    expect(session.error).not.toBeNull();
    expect(Object.hasOwn(session.state, "tally")).toBe(false);
  });

  test("replay starts the missing store at its initial, whatever the live store holds", async () => {
    const session = await stateless();
    for (const n of [0, 1, 7]) {
      disturb(n);
      const r = await replay(session, { routes: fixture().routes });
      expect(r.reproduced).toBe(true);
      expect(r.state.tally).toEqual({ n: 1 });
      expect(fixture().tally.snapshot().state).toEqual({ n });
    }
  });

  test("two minimize runs are byte-equal and keep the two bumps", async () => {
    const session = await stateless();
    disturb(1);
    const a = await minimize(session, { routes: fixture().routes });
    disturb(5);
    const b = await minimize(session, { routes: fixture().routes });
    if (!a.ok || !b.ok) throw new Error("not reproduced");
    expect(encoded(a.value.session)).toBe(encoded(b.value.session));
    const inputs = a.value.session.events.flatMap((e) => (e.kind === "fire" ? [e.id] : []));
    expect(inputs).toEqual(["tally.bump", "tally.bump"]);
  });
});
