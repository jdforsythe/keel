// Spec: k.expect, clause "There, `attempt(f, (x) => (x instanceof HttpError ? N.make({ status: x.status, kind: kindOf(x) }) : undefined))` with `class HttpError extends Error { status = 0 }` in the file and `kindOf` returning `'a' | 'b'` is no E1460, and resolves to `err` whose data is `{ status: 503, kind: 'a' }` for a thrown `HttpError` with `status` 503 that `kindOf` maps to `'a'`."
// Seed 1337. The check half is packages/check/conformance/expect-carries.test.ts.
import { attempt, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const N = s.error("m.n", s.object({ status: s.int(), kind: s.enum(["a", "b"]) }));
class HttpError extends Error {
  status = 0;
}
const kindOf = (_x: HttpError): "a" | "b" => "a";
const expectHttp = (x: unknown) => (x instanceof HttpError ? N.make({ status: x.status, kind: kindOf(x) }) : undefined);
const thrownHttp = (status: number, message: string): HttpError => Object.assign(new HttpError(message), { status });

describe("k.expect Carries: run", () => {
  it("a thrown HttpError with status 503 that kindOf maps to 'a' resolves to err whose data is { status: 503, kind: 'a' }", async () => {
    const r = await attempt(async () => {
      throw thrownHttp(503, "upstream down");
    }, expectHttp);
    expect(r).toEqual({ ok: false, error: N.make({ status: 503, kind: "a" }) });
    expect(r.ok ? undefined : r.error.data).toEqual({ status: 503, kind: "a" });
  });

  it("property: for any status and message the error's data is { status, kind: 'a' } and its JSON holds no part of the thrown message", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 599 }), fc.stringMatching(/^[A-Z]{12,20}$/), (status, message) => {
        const r = attempt(() => {
          throw thrownHttp(status, message);
        }, expectHttp);
        expect(r.ok).toBe(false);
        expect(r.ok ? undefined : r.error.data).toEqual({ status, kind: "a" });
        expect(JSON.stringify(r)).not.toContain(message);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("a thrown value that is no HttpError is thrown on as itself", () => {
    const w = new TypeError("x");
    expect(() =>
      attempt(() => {
        throw w;
      }, expectHttp),
    ).toThrow(w);
  });
});
