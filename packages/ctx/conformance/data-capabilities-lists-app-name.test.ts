// Spec: k.data, clause 6 (k.data#6): "`capabilities()` lists an app-registered name after its file is imported."
// fast-check seed: 1337
import { capabilities, register } from "@keel/ctx";
import fc from "fast-check";
import { expect, test } from "vitest";

const impl = () => ({});

test("`capabilities()` lists an app-registered name after its file is imported", () => {
  let n = 0;
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{3,8}$/), fc.stringMatching(/^[a-z][a-zA-Z]{2,8}$/), (id, tail) => {
      const name = `${id}.${tail}${n++}`;
      expect(capabilities()).not.toContain(name);
      register(name, { real: impl, shell: impl, sim: impl });
      expect(capabilities()).toContain(name);
      expect(capabilities().filter((c) => c === name)).toHaveLength(1);
    }),
    { seed: 1337, numRuns: 25 },
  );
});

test("`capabilities()` still lists the kernel names beside an app-registered one", () => {
  register("notes.listing", { real: impl, shell: impl, sim: impl });
  expect(capabilities()).toEqual(expect.arrayContaining(["clock", "random", "net", "storage", "notes.listing"]));
});
