// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { codes } from "./support.ts";

test("E1401: destructuring props produces a diagnostic with a fix", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{2,8}$/), (name) => {
      const src = `export default function C({ ${name} }) { return <p>{${name}}</p> }`;
      const d = codes(src).filter((x) => x.code === "E1401");
      expect(d.length).toBeGreaterThanOrEqual(1);
      for (const x of d) {
        expect(x.path).toBe("C.tsx");
        expect(x.line).toBeGreaterThan(0);
        expect(typeof x.fix).toBe("string");
        expect(x.fix?.length).toBeGreaterThan(0);
      }
    }),
    { seed: 1337, numRuns: 20 },
  );
});

test("E1401: reading props through the props object emits no E1401", () => {
  const d = codes(`export default function C(props) { return <p>{props.name}</p> }`);
  expect(d.map((x) => x.code)).not.toContain("E1401");
});
