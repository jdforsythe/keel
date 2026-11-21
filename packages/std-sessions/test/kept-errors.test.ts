// @vitest-environment happy-dom
// Errors the ctx kept before `record` started: scrubbed of values redacted before the recorder attached (or blinded
// when such a value cannot be known), uploaded once per ctx, and stamped with their report time. Seed 1337
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { Session } from "@keel/std-sessions";
import { renderRoute } from "@keel/testing";
import { Box, Button, Input } from "@keel/ui";
import { describe, expect, test } from "vitest";
import { record, session } from "../src/index.ts";
import { stamped } from "./stamped.ts";

const typed: { value: string } = { value: "" };
const routes = manifest(contract("pay", { "pay.show": { path: "/pay" } }), {
  "pay.show": {
    component(): Node {
      return Box({
        as: "main",
        id: "pay.page",
        children: [
          Input({
            id: "pay.card",
            label: "Card",
            onInput: (v) => {
              typed.value = v;
            },
          }),
          stamped(
            Button({
              id: "pay.crash",
              children: "Pay",
              onClick: () => {
                throw new Error(`card ${typed.value} declined`);
              },
            }),
            "pay.crash",
          ),
        ],
      });
    },
  },
});
const CARD = "4111222233334444";
const text = (out: Session): string => JSON.stringify(Session.encode(out));

async function typedThenCrashed(ctx: Ctx) {
  bindStd(ctx, { "@keel/std-sessions": { pay: { redact: ["el:pay.card#value"] } } });
  typed.value = "";
  const h = await renderRoute("pay.show", { routes, ctx });
  await h.fire("pay.card", { type: "input", value: CARD });
  await h.fire("pay.crash", { type: "click" }).catch(() => undefined);
  return h;
}

describe("kept errors", () => {
  test("a value typed into an el: field before record is scrubbed from a kept error", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    bindStd(ctx, { "@keel/std-sessions": { pay: { redact: ["el:pay.card#value"] } } });
    const h = await renderRoute("pay.show", { routes, ctx });
    await h.fire("pay.card", { type: "input", value: CARD });
    // An action's `err` naming the value, as a declined payment would.
    report(ctx, {
      kind: "error",
      error: { code: "pay.declined", message: `card ${CARD} declined`, data: { card: CARD } },
    });
    const out = record(ctx).stop();
    expect(out.events.map((e) => e.kind)).toEqual(["error"]);
    expect(text(out)).not.toContain(CARD);
    expect(out.error?.message).toBe(`card ${"x".repeat(CARD.length)} declined`);
    h.dispose();
  });

  test("red-team repro: typed, crashed, then record: the field is gone, so the kept error is blinded", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const h = await typedThenCrashed(ctx);
    const out = record(ctx).stop();
    expect(text(out)).not.toContain(CARD);
    expect(out.error?.message).toBe(out.error?.code);
    const data = out.error?.data;
    expect(typeof data === "object" && data !== null && "at" in data && data.at).toBe("pay.crash");
    h.dispose();
  });

  test("calling record before the input masks it in the live error", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    bindStd(ctx, { "@keel/std-sessions": { pay: { redact: ["el:pay.card#value"] } } });
    typed.value = "";
    const rec = record(ctx);
    const h = await renderRoute("pay.show", { routes, ctx });
    await h.fire("pay.card", { type: "input", value: CARD });
    await h.fire("pay.crash", { type: "click" }).catch(() => undefined);
    const out = rec.stop();
    expect(text(out)).not.toContain(CARD);
    expect(out.error?.message).toBe(`card ${"x".repeat(CARD.length)} declined`);
    h.dispose();
  });

  test("stop then record three times gives one put", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    report(ctx, {
      kind: "nav",
      href: "/pay",
      route: { id: "pay.show", path: "/pay", params: {}, search: {}, schemas: {} },
    });
    report(ctx, { kind: "error", error: { code: "pay.failed", message: "first load", data: null } });
    for (let i = 0; i < 3; i++) record(ctx, { upload: new URL("/sessions", location.origin) }).stop();
    expect(session(ctx).taken()).toHaveLength(1);
  });

  test("a kept error and the base carry their report time, not the recorder's start", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    report(ctx, {
      kind: "nav",
      href: "/pay",
      route: { id: "pay.show", path: "/pay", params: {}, search: {}, schemas: {} },
    });
    ctx.clock.advance(1000);
    report(ctx, { kind: "error", error: { code: "pay.failed", message: "first load", data: null } });
    ctx.clock.advance(60_000);
    const out = record(ctx).stop();
    expect(out.at).toBe(0);
    expect(out.events.map((e) => e.at)).toEqual([1000]);
  });
});
