// Seed 1337. graft puts each Secret back where the encoding wrote the marker; holdsSecret says whether any stands.
import { reveal, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { graft } from "../src/internal/graft.ts";
import { holdsSecret } from "../src/internal/holdsSecret.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const Login = s.object({ user: s.string(), token: s.secret(s.string()), tags: s.array(s.string()) });
const login = (token: string) => {
  const r = Login.parse({ user: "u", token, tags: ["a"] });
  if (!r.ok) throw new Error("login did not parse");
  return r.value;
};

describe("graft", () => {
  it("returns the value in place of a marker only when the value is an object", () => {
    const secret = { opaque: true };
    expect(graft("[secret]", secret)).toBe(secret);
    expect(graft("[secret]", "plain")).toBe("[secret]");
    expect(graft("[secret]", null)).toBe("[secret]");
    expect(graft("[secret]", undefined)).toBe("[secret]");
    expect(graft("[secret]", 4)).toBe("[secret]");
  });

  it("returns an encoded non-container, or one met by a non-object value, unchanged", () => {
    expect(graft(5, { a: 1 })).toBe(5);
    expect(graft("text", { a: 1 })).toBe("text");
    expect(graft(null, { a: 1 })).toBeNull();
    const encoded = { a: 1 };
    expect(graft(encoded, "str")).toBe(encoded);
    expect(graft(encoded, null)).toBe(encoded);
    expect(graft(encoded, 3)).toBe(encoded);
    expect(graft(["x"], undefined)).toEqual(["x"]);
  });

  it("grafts through arrays and objects, keeping the rest of the encoding", () => {
    const one = { k: 1 };
    const two = { k: 2 };
    const out = graft(
      { a: ["[secret]", "s", { b: "[secret]", c: "[secret]" }], d: 2 },
      { a: [one, "s", { b: two, c: "str" }] },
    );
    expect(out).toEqual({ a: [one, "s", { b: two, c: "[secret]" }], d: 2 });
    expect(Reflect.get(Reflect.get(out ?? {}, "a"), 0)).toBe(one);
  });

  it("is the identity on JSON-like data with no marker", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        const text = JSON.stringify(v);
        fc.pre(!text.includes("[secret]"));
        expect(graft(v, v)).toEqual(v);
      }),
    );
  });
});

describe("holdsSecret", () => {
  it("is false for no schema, without reading the value", () => {
    expect(holdsSecret(undefined, { token: "x" })).toBe(false);
  });

  it("is true when a Secret stands where the encoding writes the marker", () => {
    expect(holdsSecret(Login, login("t"))).toBe(true);
    const Nest = s.object({ list: s.array(s.object({ k: s.secret(s.int()) })) });
    const nested = Nest.parse({ list: [{ k: 1 }] });
    expect(nested.ok && holdsSecret(Nest, nested.value)).toBe(true);
  });

  it("is false for a schema with a secret slot that is absent, and for plain data", () => {
    const Opt = s.object({ a: s.string(), t: s.secret(s.string()).optional() });
    const bare = Opt.parse({ a: "x" });
    expect(bare.ok && holdsSecret(Opt, bare.value)).toBe(false);
    const Plain = s.object({ a: s.string(), b: s.object({ c: s.int(), d: s.array(s.string()) }) });
    const plain = Plain.parse({ a: "x", b: { c: 1, d: ["y"] } });
    expect(plain.ok && holdsSecret(Plain, plain.value)).toBe(false);
  });

  it("is false for a string that is the marker text", () => {
    const Text = s.object({ a: s.string() });
    expect(holdsSecret(Text, { a: "[secret]" })).toBe(false);
  });

  it("agrees with the schema: a secret's content never changes the answer", () => {
    fc.assert(
      fc.property(fc.string(), (t) => {
        const v = login(t);
        expect(holdsSecret(Login, v)).toBe(true);
        expect(reveal(v.token)).toBe(t);
      }),
    );
  });
});
