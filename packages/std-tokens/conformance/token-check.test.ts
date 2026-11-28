// std.tokens, API "`check(token, find)` reads the id from the presented `Secret<string>`, calls `find(id)` once for the row (an object with `digest: Digested`), compares in constant time (`timingSafeEqual`), then reads `ctx.clock.now()`, and returns `ok(row)`."
// std.tokens, API "A presented value that is not in the token form (`find` is not called), a `find` that returns `undefined`, and a digest that does not match are `credentials.mismatch`."
// std.tokens, API "An unreadable `digest` is `credentials.malformed`, data `{ reason }`: `format` (not `Digested`), `parameters` (an id other than `sha256` or `sha256-sim`, a parameter other than `exp=<ms>`, or a digest that is not 32 bytes) or `sim` (a sim form outside sim)."
// std.tokens, API "Both are synchronous and neither throws, a throw from `find` aside. Each error is one constant per code and `reason`."
// std.tokens, API "`Digested` (`tokens.Digested`) is a format type over `s.string()`: `$id$digest` or `$id$params$digest`, at most 128 characters."
// Spec: std.tokens, clause "`check` of a minted token, with `find` returning a row holding its `digest`, is `ok` with that row, and `find` was called once with its `id`."
// Spec: std.tokens, clause "Under real, `check` is `credentials.mismatch` for: a token with one `secret` character changed; one token's `id` with another's `secret`; `hunter2` (`find` not called); `find` returning `undefined`."
// Spec: std.tokens, clause "A row whose `digest` is `$md5$` plus 43 characters, or has `exp=soon`, is `credentials.malformed` `parameters`."
// Seed: 1337.
// Assumption: a row is `{ id, digest }`; `find` is a spy over an array of rows keyed by `id`.
// Assumption: a digest `hunter2` (not of the `Digested` shape) is `credentials.malformed` `format`, it reaches `check` through `rawCheck`, since the types refuse it.
// Assumption: a minted token's secret part is lowercase hex, so "one character changed" replaces it with a different hex digit.
import { createCtx } from "@keel/ctx";
import { Digested } from "@keel/std-tokens";
import { tokens } from "@keel/std-tokens/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, digestedOf, errorOf, isOk, okValue, rawCheck, realCtx, secretOf, simCtx, textOf } from "./fixtures.ts";

interface Row {
  readonly id: string;
  readonly digest: Digested;
}
const HEX = "0123456789abcdef";
const B43 = "A".repeat(43);

function minted(ctx: Parameters<typeof tokens>[0]): { row: Row; text: string } {
  const m = tokens(ctx).mint({ ttl: null });
  if (!m.ok) throw new Error("mint refused a ttl");
  return { row: { id: m.value.id, digest: m.value.digest }, text: textOf(m.value.token) };
}
function spy(rows: readonly Row[]): { find: (id: string) => Row | undefined; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    find: (id) => {
      calls.push(id);
      return rows.find((r) => r.id === id);
    },
  };
}

test("`check` of a minted token, with `find` returning a row holding its `digest`, is `ok` with that row, and `find` was called once with its `id`.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom("real", "sim"), fc.integer({ min: 1, max: 5 }), async (mode, extra) => {
      const ctx = mode === "real" ? realCtx() : simCtx();
      const all = Array.from({ length: extra }, () => minted(ctx));
      const pick = all[extra - 1];
      if (pick === undefined) throw new Error("no token");
      const { find, calls } = spy(all.map((a) => a.row));
      const r = tokens(ctx).check(secretOf(pick.text), find);
      expect(isOk(r)).toBe(true);
      expect(okValue(r)).toBe(pick.row);
      expect(calls).toEqual([pick.row.id]);
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test("Under real, `check` is `credentials.mismatch` for: a token with one `secret` character changed.", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 63 }), fc.integer({ min: 1, max: 15 }), (idx, shift) => {
      const ctx = realCtx();
      const { row, text } = minted(ctx);
      const at = 22 + idx;
      const changed =
        text.slice(0, at) + (HEX[(HEX.indexOf(text.charAt(at)) + shift) % 16] ?? "0") + text.slice(at + 1);
      expect(changed).not.toBe(text);
      const { find } = spy([row]);
      const r = tokens(ctx).check(secretOf(changed), find);
      expect(errorOf(r).code).toBe("credentials.mismatch");
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("Under real, `check` is `credentials.mismatch` for: one token's `id` with another's `secret`.", () => {
  const ctx = realCtx();
  const a = minted(ctx);
  const b = minted(ctx);
  const crossed = `keel_${a.row.id}_${b.text.split("_")[2]}`;
  const { find, calls } = spy([a.row, b.row]);
  const r = tokens(ctx).check(secretOf(crossed), find);
  expect(errorOf(r).code).toBe("credentials.mismatch");
  expect(calls).toEqual([a.row.id]);
});

test("Under real, `check` is `credentials.mismatch` for: `hunter2` (`find` not called).", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 100 }), (text) => {
      fc.pre(!/^keel(sim)?_[0-9a-f]{16}_[0-9a-f]{64}$/.test(text));
      const ctx = realCtx();
      const { find, calls } = spy([]);
      const r = tokens(ctx).check(secretOf(text), find);
      expect(errorOf(r).code).toBe("credentials.mismatch");
      expect(calls).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 100 },
  );
  const { find, calls } = spy([]);
  expect(errorOf(tokens(realCtx()).check(secretOf("hunter2"), find)).code).toBe("credentials.mismatch");
  expect(calls).toHaveLength(0);
});

test("Under real, `check` is `credentials.mismatch` for: `find` returning `undefined`.", () => {
  const ctx = realCtx();
  const { text } = minted(ctx);
  const { find, calls } = spy([]);
  const r = tokens(ctx).check(secretOf(text), find);
  expect(errorOf(r).code).toBe("credentials.mismatch");
  expect(calls).toHaveLength(1);
});

test("A row whose `digest` is `$md5$` plus 43 characters, or has `exp=soon`, is `credentials.malformed` `parameters`.", () => {
  const ctx = realCtx();
  const { row, text } = minted(ctx);
  const digestPart = row.digest.split("$")[2] ?? B43;
  const bad: [string, Digested][] = [
    ["$md5$", digestedOf(`$md5$${B43}`)],
    ["exp=soon", digestedOf(`$sha256$exp=soon$${digestPart}`)],
  ];
  for (const [label, digest] of bad) {
    const r = tokens(ctx).check(secretOf(text), () => ({ id: row.id, digest }));
    expect(errorOf(r).code, label).toBe("credentials.malformed");
    expect(errorOf(r).data, label).toEqual({ reason: "parameters" });
  }
});

test("An unreadable `digest` is `credentials.malformed`, data `{ reason }`: `format` (not `Digested`), `parameters` (an id other than `sha256` or `sha256-sim`, a parameter other than `exp=<ms>`, or a digest that is not 32 bytes) or `sim` (a sim form outside sim). (format)", () => {
  const ctx = realCtx();
  const { row, text } = minted(ctx);
  const r = rawCheck(ctx, secretOf(text), () => ({ id: row.id, digest: "hunter2" }));
  expect(errorOf(r).code).toBe("credentials.malformed");
  expect(errorOf(r).data).toEqual({ reason: "format" });
});

test("Both are synchronous and neither throws, a throw from `find` aside. Each error is one constant per code and `reason`.", () => {
  const ctx = realCtx();
  const a = minted(ctx);
  const b = minted(ctx);
  const sync = tokens(ctx).check(secretOf(a.text), spy([a.row]).find);
  expect(sync instanceof Promise).toBe(false);
  expect(tokens(ctx).mint({ ttl: null }) instanceof Promise).toBe(false);
  const mismatches = [
    tokens(ctx).check(secretOf("hunter2"), () => undefined),
    tokens(ctx).check(secretOf(a.text), () => undefined),
    tokens(ctx).check(secretOf(`keel_${a.row.id}_${"0".repeat(64)}`), spy([a.row]).find),
    tokens(ctx).check(secretOf(b.text), () => a.row),
  ];
  for (const r of mismatches) expect(errorOf(r).error).toEqual(errorOf(mismatches[0]).error);
  const malformed = [
    tokens(ctx).check(secretOf(a.text), () => ({ id: a.row.id, digest: digestedOf(`$md5$${B43}`) })),
    tokens(ctx).check(secretOf(b.text), () => ({ id: b.row.id, digest: digestedOf(`$sha256$exp=soon$${B43}`) })),
  ];
  expect(errorOf(malformed[0]).error).toEqual(errorOf(malformed[1]).error);
});

test("`Digested` (`tokens.Digested`) is a format type over `s.string()`: `$id$digest` or `$id$params$digest`, at most 128 characters.", () => {
  expect(Digested.parse(`$sha256$${B43}`).ok).toBe(true);
  expect(Digested.parse(`$sha256$exp=1$${B43}`).ok).toBe(true);
  expect(Digested.parse("hunter2").ok).toBe(false);
  const head = "$sha256$";
  expect(Digested.parse(head + "A".repeat(128 - head.length)).ok).toBe(true);
  expect(Digested.parse(head + "A".repeat(129 - head.length)).ok).toBe(false);
});

test("Both are synchronous and neither throws, a throw from `find` aside. (a throw from `find` is thrown)", () => {
  const ctx = realCtx();
  const { text } = minted(ctx);
  const boom = new Error("db");
  const run = () =>
    tokens(ctx).check(secretOf(text), () => {
      throw boom;
    });
  expect(run).toThrow(boom);
  try {
    run();
  } catch (e) {
    expect(e).toBe(boom);
  }
});

test("An unreadable `digest` is `credentials.malformed`, data `{ reason }`: `format` (not `Digested`), `parameters` (an id other than `sha256` or `sha256-sim`, a parameter other than `exp=<ms>`, or a digest that is not 32 bytes) or `sim` (a sim form outside sim). (parameters: an id other than `sha256` or `sha256-sim`)", () => {
  const ctx = realCtx();
  const { row, text } = minted(ctx);
  for (const id of ["md5", "sha512", "scrypt", "sha256x"]) {
    const r = tokens(ctx).check(secretOf(text), () => ({ id: row.id, digest: digestedOf(`$${id}$${B43}`) }));
    expect(errorOf(r).code, id).toBe("credentials.malformed");
    expect(errorOf(r).data, id).toEqual({ reason: "parameters" });
  }
});

test("An unreadable `digest` is `credentials.malformed`, data `{ reason }`: `format` (not `Digested`), `parameters` (an id other than `sha256` or `sha256-sim`, a parameter other than `exp=<ms>`, or a digest that is not 32 bytes) or `sim` (a sim form outside sim). (parameters: a parameter other than `exp=<ms>`)", () => {
  const ctx = realCtx();
  const { row, text } = minted(ctx);
  for (const param of ["ln=14", "exp=", "exp=1.5", "foo=1", "exp=-1"]) {
    const r = tokens(ctx).check(secretOf(text), () => ({ id: row.id, digest: digestedOf(`$sha256$${param}$${B43}`) }));
    expect(errorOf(r).code, param).toBe("credentials.malformed");
    expect(errorOf(r).data, param).toEqual({ reason: "parameters" });
  }
});

test("An unreadable `digest` is `credentials.malformed`, data `{ reason }`: `format` (not `Digested`), `parameters` (an id other than `sha256` or `sha256-sim`, a parameter other than `exp=<ms>`, or a digest that is not 32 bytes) or `sim` (a sim form outside sim). (parameters: a digest that is not 32 bytes)", () => {
  const ctx = realCtx();
  const { row, text } = minted(ctx);
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 80 }), (len) => {
      fc.pre(len !== 43);
      const r = tokens(ctx).check(secretOf(text), () => ({
        id: row.id,
        digest: digestedOf(`$sha256$${"A".repeat(len)}`),
      }));
      expect(errorOf(r).code).toBe("credentials.malformed");
      expect(errorOf(r).data).toEqual({ reason: "parameters" });
    }),
    { seed: SEED, numRuns: 50 },
  );
  const r = tokens(ctx).check(secretOf(text), () => ({ id: row.id, digest: digestedOf(`$sha256$${"A".repeat(42)}`) }));
  expect(errorOf(r).data).toEqual({ reason: "parameters" });
});

test("An unreadable `digest` is `credentials.malformed`, data `{ reason }`: `format` (not `Digested`), `parameters` (an id other than `sha256` or `sha256-sim`, a parameter other than `exp=<ms>`, or a digest that is not 32 bytes) or `sim` (a sim form outside sim). (sim: a sim form outside sim)", () => {
  const sim = simCtx();
  const m = tokens(sim).mint({ ttl: null });
  if (!m.ok) throw new Error("mint refused a ttl");
  for (const ctx of [realCtx(), createCtx({ mode: "shell" })]) {
    const { text } = minted(ctx);
    const r = tokens(ctx).check(secretOf(text), (id) => ({ id, digest: m.value.digest }));
    expect(errorOf(r).code).toBe("credentials.malformed");
    expect(errorOf(r).data).toEqual({ reason: "sim" });
  }
});
