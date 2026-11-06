// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { codes } from "./support.ts";

test("E1403: {a && <b/>} produces a diagnostic", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{1,6}$/), fc.constantFrom("b", "i", "span"), (v, t) => {
      const d = codes(`export default function C(props) { return <div>{props.${v} && <${t}/>}</div> }`).filter(
        (x) => x.code === "E1403",
      );
      expect(d.length).toBe(1);
      expect(d[0]?.line).toBeGreaterThan(0);
    }),
    { seed: 1337, numRuns: 20 },
  );
});

test("E1403: <If when={a}> emits no E1403", () => {
  const d = codes(`import { If } from '@keel/runtime-dom'
export default function C(props) { return <div><If when={props.a}><b/></If></div> }`);
  expect(d.map((x) => x.code)).not.toContain("E1403");
});
