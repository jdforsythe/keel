// Property: a read is refused (std.live `status()`) only when its `err` is `api.status` 401 or 403 or a `keel.denied`;
// a refused read is `denied` for good, any other failed read is `connecting` and reads again. Seed 1337.
import { type KeelError, type Result, err } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { mount, server, settle } from "./helpers.ts";

type Failed = Result<number, KeelError<string, unknown>>;

const failure: fc.Arbitrary<{ readonly e: Failed; readonly refused: boolean }> = fc.oneof(
  fc.integer({ min: 100, max: 599 }).map((status) => ({
    e: err({ code: "api.status", message: `status ${status}`, data: { status, body: null } }),
    refused: status === 401 || status === 403,
  })),
  fc.constantFrom("keel.denied", "keel.busy", "keel.unexpected", "api.network", "app.denied").map((code) => ({
    e: err({ code, message: code, data: {} }),
    refused: code === "keel.denied",
  })),
  fc.constantFrom(401, 403).map((status) => ({
    e: err({ code: "app.status", message: "other", data: { status } }),
    refused: false,
  })),
);

test("only a 401, a 403 or `keel.denied` read is denied, and a denied live reads no more", async () => {
  await fc.assert(
    fc.asyncProperty(failure, async ({ e, refused }) => {
      const { ctx } = server();
      let calls = 0;
      const m = mount(ctx, async () => {
        calls++;
        return e;
      });
      await settle();
      expect(m.status()).toBe(refused ? "denied" : "connecting");
      ctx.clock.advance(1_000);
      await settle();
      expect(calls).toBe(refused ? 1 : 2);
      expect(m.view.get("n")).toBe(0);
      m.dispose();
    }),
    { seed: 1337, numRuns: 60 },
  );
});
