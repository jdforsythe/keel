// What a Form action answers after sending through `boardOutbox`.
import { type Ctx, type SimCtx, createCtx } from "@keel/ctx";
import { send } from "@keel/std-offline";
import { afterEach, describe, expect, it } from "vitest";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { boardWrites } from "../modules/todos/boardWrites.service.ts";
import { formAnswer } from "../modules/todos/formAnswer.ts";
import { write } from "./write.ts";

const ORIGIN = new URL(location.href).origin;
const queued = boardOutbox.snapshot();
afterEach(() => {
  expect(boardOutbox.restore(queued).ok).toBe(true);
});

/** A sim ctx whose `/api/lists` answers `status` with `body`. */
function ctxAnswering(status: number, body: unknown): SimCtx {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.net.route(new URL("/api/*", location.href).href, () => Response.json(body, { status }));
  return ctx;
}
const sendList = (ctx: Ctx) => send(ctx, boardOutbox, ORIGIN, "createList", { body: { name: "Work" } }, { base: 0 });
const refusal = { code: "keel.fields", message: "Fix the fields", data: { name: "Name is taken" } };

describe("formAnswer", () => {
  it("answers ok(null) for a sent write", async () => {
    const ctx = ctxAnswering(200, { ok: true, value: {} });
    const r = await sendList(ctx);
    expect(r.state).toBe("sent");
    expect(await formAnswer(ctx, "createList", r)).toEqual({ ok: true, value: null });
  });
  it("answers ok(null) for a queued write and leaves it in the outbox", async () => {
    const ctx = ctxAnswering(200, { ok: true, value: {} });
    ctx.net.setOnline(false);
    const r = await sendList(ctx);
    expect(r.state).toBe("queued");
    expect(await formAnswer(ctx, "createList", r)).toEqual({ ok: true, value: null });
    expect(boardOutbox.get("entries").map((e) => e.state)).toEqual(["queued"]);
  });
  it("answers ok(null) for a conflict and keeps it for the outbox panel", async () => {
    const ctx = ctxAnswering(409, {
      code: "keel.conflict",
      message: "stale",
      data: { transaction: "api.toggleTodo", head: 3 },
    });
    const r = await sendList(ctx);
    expect(r.state).toBe("conflict");
    expect(await formAnswer(ctx, "createList", r)).toEqual({ ok: true, value: null });
    expect(boardOutbox.get("entries").map((e) => e.state)).toEqual(["conflict"]);
  });
  it("answers a 422's keel.fields error and drops the failed write from the outbox", async () => {
    const ctx = ctxAnswering(422, { ok: false, error: refusal });
    const r = await sendList(ctx);
    expect(r.state).toBe("failed");
    const answer = await formAnswer(ctx, "createList", r);
    expect(answer).toEqual({ ok: false, error: refusal });
    expect(boardOutbox.get("entries")).toEqual([]);
  });
  it("answers any other failure as its own error and still drops the failed write", async () => {
    const ctx = ctxAnswering(500, { code: "keel.internal", message: "boom", data: null });
    const r = await sendList(ctx);
    expect(r.state).toBe("failed");
    const answer = await formAnswer(ctx, "createList", r);
    expect(answer.ok).toBe(false);
    expect(!answer.ok && answer.error.code).toBe("api.status");
    expect(boardOutbox.get("entries")).toEqual([]);
  });
});
