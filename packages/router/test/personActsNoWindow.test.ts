// @vitest-environment node
// k.opening Link-started fails closed: with no window there is no listener, so nothing but the harness's `fired` is an act.
import { createCtx } from "@keel/ctx";
import { expect, it } from "vitest";
import { personActs } from "../src/internal/personActs.ts";

it("with no window, watching attaches nothing and a ctx holds no act until marked; a fired click ends link-started", () => {
  expect(typeof window).toBe("undefined");
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  personActs.watch(ctx);
  expect(personActs.of(ctx)).toEqual({ acted: false, linked: false });
  personActs.of(ctx).linked = true;
  personActs.fired(ctx, { type: "click" });
  expect(personActs.of(ctx)).toEqual({ acted: true, linked: false });
});
