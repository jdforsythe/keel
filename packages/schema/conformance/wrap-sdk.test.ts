// Spec: k.attempt, clause "With `sdk.charges.create` rejecting with `Object.assign(new Error('card declined for jane@x.com'), { name: 'CardError', code: 'insufficient_funds' })`, the `charge` of Wrapping a throwing library resolves to `err` with code `pay.declined` and data `{ reason: 'funds' }`, and its JSON holds no `jane`; rejecting with `w`, a `TypeError`, it rejects with `w` itself."
// Seed 1337. `charge` is the spec's sample, written out here over a fake `sdk`.
import { attempt, s } from "@keel/schema";
import type { Result } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const CardDeclined = s.error("pay.declined", s.object({ reason: s.enum(["funds", "expired", "other"]) }));
type Receipt = { id: string };
type Charge = { amount: number };
let behaviour: () => Promise<Receipt> = async () => ({ id: "r1" });
const sdk = { charges: { create: (_p: Charge): Promise<Receipt> => behaviour() } };
const reasonOf = (x: Error): "funds" | "expired" | "other" =>
  Reflect.get(x, "code") === "insufficient_funds"
    ? "funds"
    : Reflect.get(x, "code") === "expired_card"
      ? "expired"
      : "other";
const charge = (p: Charge): Promise<Result<Receipt, ReturnType<typeof CardDeclined.make>>> =>
  attempt(
    () => sdk.charges.create(p),
    (x) => (x instanceof Error && x.name === "CardError" ? CardDeclined.make({ reason: reasonOf(x) }) : undefined),
  );
const cardError = (message: string, code: string): Error =>
  Object.assign(new Error(message), { name: "CardError", code });

describe("k.attempt: wrapping a throwing library", () => {
  it("a CardError with code insufficient_funds is err pay.declined with data { reason: 'funds' } and its JSON holds no jane", async () => {
    behaviour = async () => {
      throw cardError("card declined for jane@x.com", "insufficient_funds");
    };
    const r = await charge({ amount: 1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("pay.declined");
    expect(r.error.data).toEqual({ reason: "funds" });
    expect(JSON.stringify(r)).not.toContain("jane");
  });

  it("a TypeError w rejects with w itself", async () => {
    const w = new TypeError("fetch failed");
    behaviour = async () => {
      throw w;
    };
    await expect(charge({ amount: 1 })).rejects.toBe(w);
  });

  it("a resolved charge is ok", async () => {
    behaviour = async () => ({ id: "r9" });
    await expect(charge({ amount: 1 })).resolves.toEqual({ ok: true, value: { id: "r9" } });
  });

  it("property: whatever message a CardError carries, the result's JSON holds none of it and the reason is a member of the closed enum", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 6 }).map((m) => `leak:${m}`),
        fc.constantFrom("insufficient_funds", "expired_card", "other_code"),
        async (message, code) => {
          behaviour = async () => {
            throw cardError(message, code);
          };
          const r = await charge({ amount: 1 });
          expect(r.ok).toBe(false);
          if (r.ok) return;
          expect(["funds", "expired", "other"]).toContain(r.error.data.reason);
          expect(JSON.stringify(r)).not.toContain(message);
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("property: any throw that is no CardError goes on as the very value", async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (x) => {
        fc.pre(!(x instanceof Error && x.name === "CardError"));
        behaviour = async () => {
          throw x;
        };
        const got: unknown = await charge({ amount: 1 }).then(
          () => undefined,
          (e: unknown) => e,
        );
        expect(Object.is(got, x)).toBe(true);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
