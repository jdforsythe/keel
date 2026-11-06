// Seed 1337 (fc.assert seed below).
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { expect, test } from "vitest";

const tpl = (label: string, n: number) => `
import { signal } from '@keel/reactive'
import { s } from '@keel/schema'
export const Props = s.object({})
const count = signal(${n})
export default function C() {
  return <div id="root"><p>{count.get()}</p><button onClick={() => count.set(count.get() + 1)}>${label}</button></div>
}
`;

test("Compiling the same sources twice yields byte-identical JS and artifacts", () => {
  fc.assert(
    fc.property(
      fc.stringMatching(/^[a-z]{1,8}$/),
      fc.nat(1000),
      fc.constantFrom<"client" | "server">("client", "server"),
      (label, n, mode) => {
        const files = [{ path: "C.tsx", source: tpl(label, n) }];
        const a = compile(files, { mode });
        const b = compile(files, { mode });
        expect(JSON.stringify(a.outputs)).toBe(JSON.stringify(b.outputs));
        expect(JSON.stringify(a.artifacts)).toBe(JSON.stringify(b.artifacts));
        expect(JSON.stringify(a.diagnostics)).toBe(JSON.stringify(b.diagnostics));
      },
    ),
    { seed: 1337, numRuns: 50 },
  );
});
