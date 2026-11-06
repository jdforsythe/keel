// @vitest-environment happy-dom
import { ok } from "@keel/schema";
import { expect, test } from "vitest";
import { type Outcome, VALID, deferred, settle, setup } from "./fixtures.ts";

test("pending() is true from submit until the response and false after", async () => {
  const gate = deferred<Outcome>();
  const h = setup();
  try {
    h.fill(VALID);
    expect(h.f.pending()).toBe(false);
    h.handler.current = () => gate.promise;
    await h.submit();
    expect(h.calls.length).toBe(1);
    expect(h.f.pending()).toBe(true);
    gate.resolve(ok(null));
    await settle();
    expect(h.f.pending()).toBe(false);
  } finally {
    h.dispose();
  }
});
