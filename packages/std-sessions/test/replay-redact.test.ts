// @vitest-environment happy-dom
// The replay recorder redacts as the live one did, and `data.at` is never scrubbed of typed values, so the
// fingerprint of the buggy fixture's error depends on neither the `redact` entries' effect on replay nor what was
// typed. Seed 1337
import { bindStd } from "@keel/compiler/std/bindStd";
import { record, replay } from "@keel/std-sessions";
import { renderRoute } from "@keel/testing";
import { describe, expect, test } from "vitest";
import { BUGGY_EMPTY, buggyCart, buggyRoutes, simCtx } from "../conformance/fixtures.ts";

/** add, card `typed` then "", checkout (a `keel.unexpected` at `cart.checkout`) under `redact`. */
async function recorded(redact: readonly string[], typed: string) {
  const ctx = simCtx();
  if (redact.length > 0) bindStd(ctx, { "@keel/std-sessions": { cart: { redact: [...redact] } } });
  const rec = record(ctx);
  const routes = buggyRoutes();
  const h = await renderRoute("cart.show", { routes, ctx, state: [[buggyCart(), BUGGY_EMPTY]] });
  await h.fire("cart.add", { type: "click" });
  if (typed !== "") await h.fire("cart.card", { type: "input", value: typed });
  await h.fire("cart.card", { type: "input", value: "" });
  await h.fire("cart.checkout", { type: "click" }).catch(() => undefined);
  const session = rec.stop();
  h.dispose();
  return session;
}

const atOf = (data: unknown): unknown => Reflect.get(Object(data), "at");

describe("replay under the recording's redact entries", () => {
  test("with an `error:` entry on `data.at`, replay given the same entries reproduces", async () => {
    const redact = ["error:keel.unexpected#data.at"];
    const session = await recorded(redact, "");
    expect(atOf(session.error?.data)).toBe("x".repeat("cart.checkout".length));
    expect((await replay(session, { routes: buggyRoutes(), redact })).reproduced).toBe(true);
    expect((await replay(session, { routes: buggyRoutes() })).reproduced).toBe(false);
  });

  test("typing a value an `el:` entry masks keeps `data.at` and the fingerprint", async () => {
    const plain = await recorded([], "");
    for (const typed of ["cart", "check", "cart.checkout"]) {
      const redact = ["el:cart.card#value"];
      const session = await recorded(redact, typed);
      expect(atOf(session.error?.data)).toBe("cart.checkout");
      expect(session.fingerprint).toBe(plain.fingerprint);
      expect((await replay(session, { routes: buggyRoutes(), redact })).reproduced).toBe(true);
    }
  });

  test("typing into an input no entry masks keeps `data.at` and the fingerprint", async () => {
    const plain = await recorded([], "");
    const session = await recorded([], "cart");
    expect(atOf(session.error?.data)).toBe("cart.checkout");
    expect(session.fingerprint).toBe(plain.fingerprint);
  });
});
