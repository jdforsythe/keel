import { expect, test } from "vitest";
import { codes } from "./support.ts";

const head = `
import { For } from '@keel/runtime-dom'
import { s } from '@keel/schema'
export const Props = s.object({ items: s.array(s.object({ id: s.string(), name: s.string() })) })
`;

test("E1001: For without key produces a diagnostic", () => {
  const d = codes(
    `${head}export default function C(props) { return <ul><For each={props.items}>{(i) => <li>{i.name}</li>}</For></ul> }`,
  );
  expect(d.map((x) => x.code)).toContain("E1001");
});

test("E1001: For whose key is not a field of the item produces a diagnostic", () => {
  const d = codes(
    `${head}export default function C(props) { return <ul><For each={props.items} key="nope">{(i) => <li>{i.name}</li>}</For></ul> }`,
  );
  expect(d.map((x) => x.code)).toContain("E1001");
});

test("E1001: For whose key names a field of the item emits no E1001", () => {
  const d = codes(
    `${head}export default function C(props) { return <ul><For each={props.items} key="id">{(i) => <li>{i.name}</li>}</For></ul> }`,
  );
  expect(d.map((x) => x.code)).not.toContain("E1001");
});
