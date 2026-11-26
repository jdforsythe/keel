// `live` called while a page renders inside an effect (as the router renders a route) writes nothing during the
// render; its stream opens after it and the first read hydrates the store. Seed 1337
import { effect, scope } from "@keel/reactive";
import { ok, s } from "@keel/schema";
import { channel } from "@keel/std-channels";
import { store, transaction } from "@keel/store";
import { expect, test } from "vitest";
import { live } from "../src/index.ts";
import { ORIGIN, server, settle } from "./helpers.ts";

const ch = channel("unit.board", { path: "/events", params: s.object({}) });

test("live inside a rendering effect opens its stream after the render and goes live", async () => {
  const { ctx } = server();
  const errors: unknown[] = [];
  const onRejection = (e: unknown): void => void errors.push(e);
  process.on("unhandledRejection", onRejection);
  const got: { status?: () => string; view?: { get(k: "n"): number } } = {};
  const root = scope(
    () => {
      const view = store(s.object({ n: s.int() }), { n: 0 }, { id: "unit.effectView" });
      const hydrate = transaction(view, "view.hydrate", s.int(), (_st, p) => ({ n: p }));
      got.view = view;
      effect(
        () => {
          scope(() => {
            got.status = live(ctx, ORIGIN, ch, {}, { read: async () => ok(7), hydrate });
          });
        },
        { writes: [] },
      );
    },
    { detached: true },
  );
  await settle();
  process.off("unhandledRejection", onRejection);
  expect(errors).toEqual([]);
  expect(got.view?.get("n")).toBe(7);
  expect(got.status?.()).toBe("live");
  root.dispose();
});
