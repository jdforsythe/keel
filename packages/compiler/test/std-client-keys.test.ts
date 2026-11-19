// rfc:0070: clientStd(pkg, keys) keeps only the named top-level keys of each module's config. Seed 1337.
import { clientStd } from "@keel/compiler/std/clientStd";
import { clientStdData } from "@keel/compiler/std/clientStdData";
import fc from "fast-check";
import { expect, test } from "vitest";

const KEYED = "@keel/std-keysunit";
const WHOLE = "@keel/std-wholeunit";
clientStd(KEYED, ["redact"]);
clientStd(WHOLE);

test("only the named keys of a keyed package reach the client data; an unkeyed package passes whole", () => {
  fc.assert(
    fc.property(fc.array(fc.string()), fc.array(fc.string()), fc.integer(), (redact, readers, n) => {
      const data = { [KEYED]: { a: { redact, readers }, b: { n } }, [WHOLE]: { a: { redact, readers } } };
      expect(clientStdData(data, new Set(["a", "b"]))).toEqual({
        [KEYED]: { a: { redact }, b: {} },
        [WHOLE]: { a: { redact, readers } },
      });
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("a non-object config passes as is", () => {
  expect(clientStdData({ [KEYED]: { a: [1, 2], b: 3 } }, new Set(["a", "b"]))).toEqual({
    [KEYED]: { a: [1, 2], b: 3 },
  });
});

test("keyed calls for one package merge to the union of their keys; repeats are no-ops (red-team 0217)", () => {
  const PKG = "@keel/std-keysmerge";
  clientStd(PKG, ["redact"]);
  clientStd(PKG, ["redact"]);
  clientStd(PKG, ["expose"]);
  const data = { [PKG]: { a: { redact: [], expose: 1, readers: ["r"] } } };
  expect(clientStdData(data, new Set(["a"]))).toEqual({ [PKG]: { a: { redact: [], expose: 1 } } });
});

test("a keyless call after a keyed one throws and keeps the keys; a keyed call after a keyless one throws (red-team 0217)", () => {
  fc.assert(
    fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 4 }), (keys) => {
      const pkg = `@keel/std-mix${keys.join("")}`;
      clientStd(pkg, keys);
      expect(() => clientStd(pkg)).toThrow(/with and without keys/);
      const config = Object.fromEntries([...keys, "readers"].map((k) => [k, 1]));
      expect(clientStdData({ [pkg]: { a: config } }, new Set(["a"]))).toEqual({
        [pkg]: { a: Object.fromEntries(keys.map((k) => [k, 1])) },
      });
      const whole = `${pkg}-whole`;
      clientStd(whole);
      clientStd(whole);
      expect(() => clientStd(whole, keys)).toThrow(/with and without keys/);
    }),
    { seed: 1337, numRuns: 30 },
  );
});
