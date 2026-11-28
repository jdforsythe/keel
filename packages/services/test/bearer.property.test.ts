// Properties of the `authorization` header a call's `bearer` gives (buildRequest). Seed 1337.
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import type { Endpoint } from "../src/Endpoint.ts";
import { buildRequest } from "../src/internal/buildRequest.ts";

const E: Endpoint = { method: "GET", path: "/x", output: s.string() };
const bearerOf = (input: unknown) => {
  const r = buildRequest(E, "https://api.test", input, new AbortController().signal);
  return r.ok ? { ok: true, value: r.value.headers.get("authorization") ?? undefined } : r;
};

const SEED = 1337;
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~+/".split("");
const token = fc.array(fc.constantFrom(...CHARS), { minLength: 1, maxLength: 200 }).map((cs) => cs.join(""));
const secret = (text: string) => {
  const r = s.secret(s.string()).parse(text);
  if (!r.ok) throw new Error("fixture: a string parses as a secret");
  return r.value;
};
const refused = { ok: false, error: { code: "api.input", data: { issues: [{ path: ["bearer"], rule: "format" }] } } };

test("a token68 secret gives `Bearer <token>`, padding kept", () => {
  fc.assert(
    fc.property(token, fc.nat(4), (t, pad) => {
      const text = t + "=".repeat(pad);
      expect(bearerOf({ bearer: secret(text) })).toEqual({ ok: true, value: `Bearer ${text}` });
    }),
    { seed: SEED },
  );
});

test("no bearer gives no header, whatever else the input holds", () => {
  for (const input of [undefined, null, 1, {}, { body: { bearer: "x" } }])
    expect(bearerOf(input)).toEqual({ ok: true, value: undefined });
});

test("a plain string, a non-string secret or a token outside token68 is api.input at bearer", () => {
  const n = s.secret(s.int()).parse(7);
  if (!n.ok) throw new Error("fixture");
  for (const b of ["abc", 7, {}, null, n.value, secret(""), secret("=="), secret("a".repeat(4097)), secret("a=b")])
    expect(bearerOf({ bearer: b })).toMatchObject(refused);
  expect(bearerOf({ bearer: secret("a".repeat(4096)) }).ok).toBe(true);
});
