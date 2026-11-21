// Spec: std.tokens, Conformance "Under real and sim, `idOf` is `ok` with `id` for a minted token, for it with one `secret` character changed, and under sim for it after expiry."
// Spec: std.tokens, Conformance "`idOf` of `hunter2`, `''`, a minted token with one hex letter upper-cased, and under real and shell a sim token equals `check`'s `credentials.mismatch` for `hunter2`."
// Spec: std.tokens, Conformance "`JSON.stringify` and `util.inspect` of `idOf` of a minted token hold no `secret`; `idOf` calls no `console` method."
// Spec: std.tokens, API "`idOf(token)` is `ok` with the id `check` reads, so the row can be fetched before `check`; a value `check` answers `credentials.mismatch` without calling `find` gets that constant. It reads no row, digest or clock, so `ok` means well formed, not valid. It is synchronous, never throws, and neither returns nor logs the secret."
// Seed: 1337.
// Not yet built: every case is `test.skip` until `idOf` ships; remove the `.skip` in the build that adds it.
// Assumption: `idOf` is reached through `Reflect` (the types do not carry it yet); its signature is
// `idOf(token: Secret<string>): Result<string, KeelError<'credentials.mismatch', {}>>`.
// Assumption: "the id" of a minted token is `m.value.id`; "one `secret` character changed" replaces a hex digit of the secret part with a different one.
// Assumption: "hold no `secret`" is read as: neither string contains the token's 64-character secret part nor its whole text.
// Assumption: "calls no `console` method" is read over every function property of `console`, replaced by a recorder for the call.
// Assumption: "equals" is `toEqual` on the error value (one constant per code and `reason`).
// Assumption: "never throws" and "synchronous" are shown by the calls below returning a non-Promise value.
import { tokens } from "@keel/std-tokens/server";
import fc from "fast-check";
import { inspect } from "node:util";
import { expect, test } from "vitest";
import { SEED, errorOf, isOk, okValue, realCtx, secretOf, shellCtx, simCtx, textOf } from "./fixtures.ts";
import type { Ctx } from "@keel/ctx";
import type { Secret } from "@keel/schema";

const HEX = "0123456789abcdef";

function idOf(ctx: Ctx, token: Secret<string>): unknown {
  const c = tokens(ctx);
  const f: unknown = Reflect.get(c, "idOf");
  if (typeof f !== "function") throw new Error("idOf is not built");
  const r: unknown = Reflect.apply(f, c, [token]);
  return r;
}
function mintOne(ctx: Ctx, ttl: number | null = null): { text: string; id: string } {
  const m = tokens(ctx).mint({ ttl });
  if (!m.ok) throw new Error("mint refused a ttl");
  return { text: textOf(m.value.token), id: m.value.id };
}
const secretPart = (text: string): string => text.split("_")[2] ?? "";
const mismatchOfHunter2 = (ctx: Ctx): unknown => errorOf(tokens(ctx).check(secretOf("hunter2"), () => undefined)).error;

test.skip("Under real and sim, `idOf` is `ok` with `id` for a minted token.", () => {
  fc.assert(
    fc.property(fc.constantFrom("real", "sim"), fc.integer({ min: 1, max: 5 }), (mode, n) => {
      const ctx = mode === "real" ? realCtx() : simCtx();
      for (let i = 0; i < n; i++) {
        const m = mintOne(ctx);
        const r = idOf(ctx, secretOf(m.text));
        expect(r instanceof Promise).toBe(false);
        expect(isOk(r)).toBe(true);
        expect(okValue(r)).toBe(m.id);
      }
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test.skip("Under real and sim, `idOf` is `ok` with `id` for a minted token with one `secret` character changed.", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("real", "sim"),
      fc.integer({ min: 0, max: 63 }),
      fc.integer({ min: 1, max: 15 }),
      (mode, idx, shift) => {
        const ctx = mode === "real" ? realCtx() : simCtx();
        const m = mintOne(ctx);
        const at = m.text.length - 64 + idx;
        const changed =
          m.text.slice(0, at) + (HEX[(HEX.indexOf(m.text.charAt(at)) + shift) % 16] ?? "0") + m.text.slice(at + 1);
        expect(changed).not.toBe(m.text);
        const r = idOf(ctx, secretOf(changed));
        expect(isOk(r)).toBe(true);
        expect(okValue(r)).toBe(m.id);
      },
    ),
    { seed: SEED, numRuns: 100 },
  );
});

test.skip("Under sim, `idOf` is `ok` with `id` for a minted token after expiry.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 1_000_000_000 }), async (extra) => {
      const ctx = simCtx();
      const m = tokens(ctx).mint({ ttl: 60_000 });
      if (!m.ok) throw new Error("mint refused a ttl");
      await ctx.clock.advance(60_000 + extra);
      const r = idOf(ctx, m.value.token);
      expect(isOk(r)).toBe(true);
      expect(okValue(r)).toBe(m.value.id);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test.skip("`idOf` of `hunter2` equals `check`'s `credentials.mismatch` for `hunter2`.", () => {
  for (const ctx of [realCtx(), shellCtx(), simCtx()]) {
    const r = idOf(ctx, secretOf("hunter2"));
    expect(errorOf(r).code).toBe("credentials.mismatch");
    expect(errorOf(r).error).toEqual(mismatchOfHunter2(ctx));
  }
});

test.skip("`idOf` of `''` equals `check`'s `credentials.mismatch` for `hunter2`.", () => {
  for (const ctx of [realCtx(), shellCtx(), simCtx()]) {
    const r = idOf(ctx, secretOf(""));
    expect(errorOf(r).code).toBe("credentials.mismatch");
    expect(errorOf(r).error).toEqual(mismatchOfHunter2(ctx));
  }
});

test.skip("`idOf` of a minted token with one hex letter upper-cased equals `check`'s `credentials.mismatch` for `hunter2`.", () => {
  fc.assert(
    fc.property(fc.constantFrom("real", "sim"), fc.nat(), (mode, pick) => {
      const ctx = mode === "real" ? realCtx() : simCtx();
      const m = mintOne(ctx);
      const prefix = m.text.indexOf("_") + 1;
      const letters: number[] = [];
      for (let i = prefix; i < m.text.length; i++) if (/[a-f]/.test(m.text.charAt(i))) letters.push(i);
      fc.pre(letters.length > 0);
      const at = letters[pick % letters.length] ?? prefix;
      const upper = m.text.slice(0, at) + m.text.charAt(at).toUpperCase() + m.text.slice(at + 1);
      expect(upper).not.toBe(m.text);
      const r = idOf(ctx, secretOf(upper));
      expect(errorOf(r).code).toBe("credentials.mismatch");
      expect(errorOf(r).error).toEqual(mismatchOfHunter2(ctx));
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test.skip("Under real and shell, `idOf` of a sim token equals `check`'s `credentials.mismatch` for `hunter2`.", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
      const m = mintOne(simCtx(seed));
      expect(m.text.startsWith("keelsim_")).toBe(true);
      for (const ctx of [realCtx(), shellCtx()]) {
        const r = idOf(ctx, secretOf(m.text));
        expect(errorOf(r).code).toBe("credentials.mismatch");
        expect(errorOf(r).error).toEqual(mismatchOfHunter2(ctx));
      }
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test.skip("`JSON.stringify` and `util.inspect` of `idOf` of a minted token hold no `secret`.", () => {
  fc.assert(
    fc.property(fc.constantFrom("real", "sim"), (mode) => {
      const ctx = mode === "real" ? realCtx() : simCtx();
      const m = mintOne(ctx);
      const r = idOf(ctx, secretOf(m.text));
      expect(isOk(r)).toBe(true);
      const secret = secretPart(m.text);
      expect(secret).toHaveLength(64);
      for (const shown of [JSON.stringify(r), inspect(r, { depth: null, showHidden: true })]) {
        expect(shown).not.toContain(secret);
        expect(shown).not.toContain(m.text);
      }
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test.skip("`idOf` calls no `console` method.", () => {
  const calls: string[] = [];
  const saved: [string, unknown][] = [];
  for (const key of Object.getOwnPropertyNames(console)) {
    const original: unknown = Reflect.get(console, key);
    if (typeof original !== "function") continue;
    saved.push([key, original]);
    Reflect.set(console, key, () => {
      calls.push(key);
    });
  }
  try {
    for (const ctx of [realCtx(), shellCtx(), simCtx()]) {
      const m = mintOne(ctx);
      idOf(ctx, secretOf(m.text));
      idOf(ctx, secretOf("hunter2"));
      idOf(ctx, secretOf(""));
    }
  } finally {
    for (const [key, original] of saved) Reflect.set(console, key, original);
  }
  expect(calls).toEqual([]);
});
