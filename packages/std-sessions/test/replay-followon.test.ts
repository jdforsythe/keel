// @vitest-environment happy-dom
// std.sessions replay: an input the replay already produced as the effect of an earlier one (the submit a click on a
// submit button causes, the navigation its action ends with) is not applied again; an input that cannot apply makes
// the replay's fingerprint differ, so `reproduced` is false. Seed 1337
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { Form, action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { fixedTime } from "@keel/tooling/test-time";
import { Box, Button, Text } from "@keel/ui";
import { describe, expect, test } from "vitest";
import { record } from "../src/index.ts";
import { replay } from "../src/replay.ts";

function build() {
  const count = store(s.object({ n: s.int() }), { n: 0 }, { id: "follow.count" });
  const bump = transaction(count, "follow.bump", s.object({}), (st) => ({ n: st.n + 1 }));
  const follow = contract("follow", { "follow.home": { path: "/" }, "follow.done": { path: "/done" } });
  function Home(): Node {
    return Box({
      id: "follow.page",
      children: () => [
        Form({
          method: "POST",
          action: follow.href("follow.home"),
          children: () => [Button({ id: "follow.save", type: "submit", children: "Save" })],
        }),
      ],
    });
  }
  function Done(): Node {
    return Text({ id: "follow.n", children: () => String(count.get("n")) });
  }
  const post = action(follow, "follow.home", { input: s.object({}) }, async () => {
    await tx(bump, {});
    return ok(follow.href("follow.done"));
  });
  const routes = manifest(follow, {
    "follow.home": { component: Home, POST: post },
    "follow.done": { component: Done },
  });
  return { routes, count };
}

const made: ReturnType<typeof build>[] = [];
scope(() => {
  made.push(build());
});
const fixture = (): ReturnType<typeof build> => {
  const f = made[0];
  if (f === undefined) throw new Error("fixture: build failed");
  return f;
};

async function recorded() {
  const { routes, count } = fixture();
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const rec = record(ctx);
  const h = await renderRoute("follow.home", { routes, ctx, state: [[count, { n: 0 }]] });
  await h.fire("follow.save", { type: "click" });
  const live = h.state();
  const session = rec.stop();
  h.dispose();
  return { session, live };
}

describe("replay of a Form submit", () => {
  test(
    "the click's submit and navigation apply once",
    async () => {
      const { session, live } = await recorded();
      expect(live["follow.count"]).toEqual({ n: 1 });
      const r = await replay(session, { routes: fixture().routes });
      expect(r.unapplied).toBeNull();
      expect(r.reproduced).toBe(true);
      expect(r.state["follow.count"]).toEqual({ n: 1 });
    },
    fixedTime(60_000),
  );

  test(
    "an input that cannot apply is not reproduced",
    async () => {
      const { session } = await recorded();
      const events = [{ at: 0, kind: "fire" as const, id: "no.such.id", event: { type: "click" as const } }];
      const r = await replay({ ...session, events }, { routes: fixture().routes });
      expect(r.unapplied).toBe(0);
      expect(r.reproduced).toBe(false);
      expect(r.error?.code).toBe("E2003");
    },
    fixedTime(60_000),
  );
});
