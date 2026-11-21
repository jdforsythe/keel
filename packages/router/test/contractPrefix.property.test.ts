// k.routes Where rules fire: `contract` throws E1155 for a key without its module's prefix, untyped (the type error
// is the static half).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contract } from "../src/contract/contract.ts";

const codeOf = (f: () => unknown): unknown => {
  try {
    f();
    return null;
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : e;
  }
};
const id = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);

describe("contract keys", () => {
  it("a key without the module prefix throws E1155; a prefixed key throws none", () => {
    fc.assert(
      fc.property(id, id, id, (module, other, name) => {
        fc.pre(other !== module);
        const bad = `${other}.${name}`;
        expect(codeOf(() => Reflect.apply(contract, undefined, [module, { [bad]: { path: "/" } }]))).toBe("E1155");
        expect(codeOf(() => Reflect.apply(contract, undefined, [module, { [name]: { path: "/" } }]))).toBe("E1155");
        expect(codeOf(() => contract(module, { [`${module}.${name}`]: { path: "/" } }))).toBeNull();
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("`contract('x5', { 'x6.p': ... })` throws E1155", () => {
    expect(() => Reflect.apply(contract, undefined, ["x5", { "x6.p": { path: "/p" } }])).toThrow(/^E1155 x6\.p/);
  });
});
