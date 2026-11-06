// Assumes s.union(discriminant, variants) per k.schema; the exact union signature is not in the public index types.
import { expect, test } from "vitest";
import { codes } from "./support.ts";

const head = `
import { Match, Case } from '@keel/runtime-dom'
import { s } from '@keel/schema'
export const Props = s.object({
  shape: s.union('kind', [
    s.object({ kind: s.literal('circle') }),
    s.object({ kind: s.literal('square') }),
  ]),
})
`;

test("E1402: a Match with a missing Case for a variant of the union produces a diagnostic", () => {
  const d = codes(`${head}
export default function C(props) {
  return <Match on={props.shape}><Case tag="circle"><p>c</p></Case></Match>
}`).filter((x) => x.code === "E1402");
  expect(d.length).toBe(1);
  expect(d[0]?.message).toContain("square");
});

test("E1402: a Match with a Case for every variant emits no E1402", () => {
  const d = codes(`${head}
export default function C(props) {
  return <Match on={props.shape}><Case tag="circle"><p>c</p></Case><Case tag="square"><p>s</p></Case></Match>
}`);
  expect(d.map((x) => x.code)).not.toContain("E1402");
});
