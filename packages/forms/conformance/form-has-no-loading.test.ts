// @vitest-environment happy-dom
// Spec: k.forms, clause "`pending()` is true from submit until the response and false after; `<Form>` has no `loading` prop."
// rfc:0043: `pending()` is a submission's one pending state. No generated inputs; seed n/a.
import type { FormState } from "@keel/forms";
import type { Form } from "@keel/router";
import { ok } from "@keel/schema";
import { expect, expectTypeOf, test } from "vitest";
import { type Outcome, VALID, deferred, settle, setup } from "./fixtures.ts";

test("<Form> has no loading prop; the form handle's pending() is the one pending state", () => {
  expectTypeOf<Parameters<typeof Form>[0]>().not.toHaveProperty("loading");
  expectTypeOf<FormState<unknown>>().toHaveProperty("pending");
});

test("while pending() is true the rendered form holds no extra pending node", async () => {
  const gate = deferred<Outcome>();
  const h = setup();
  try {
    h.fill(VALID);
    const before = h.root.innerHTML;
    h.handler.current = () => gate.promise;
    await h.submit();
    expect(h.f.pending()).toBe(true);
    expect(h.root.innerHTML).toBe(before);
    gate.resolve(ok(null));
    await settle();
    expect(h.f.pending()).toBe(false);
  } finally {
    h.dispose();
  }
});
