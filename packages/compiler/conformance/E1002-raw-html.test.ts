import fc from "fast-check";
import { expect, test } from "vitest";
import { codes } from "./support.ts";

// Seed 1337
test("E1002: innerHTML, outerHTML, insertAdjacentHTML or dangerouslySetInnerHTML in app code produces a diagnostic", () => {
  const uses = [
    `<div dangerouslySetInnerHTML={{ __html: 'x' }}/>`,
    `<div innerHTML="x"/>`,
    `<div outerHTML="x"/>`,
    `<div ref={(el) => { el.innerHTML = 'x' }}/>`,
    `<div ref={(el) => { el.outerHTML = 'x' }}/>`,
    `<div ref={(el) => el.insertAdjacentHTML('beforeend', 'x')}/>`,
  ];
  fc.assert(
    fc.property(fc.constantFrom(...uses), (jsx) => {
      const d = codes(`export default function C() { return ${jsx} }`);
      expect(d.map((x) => x.code)).toContain("E1002");
    }),
    { seed: 1337, numRuns: 30 },
  );
});

test("E1002: code without raw HTML APIs emits no E1002", () => {
  expect(codes(`export default function C() { return <div>x</div> }`).map((x) => x.code)).not.toContain("E1002");
});
