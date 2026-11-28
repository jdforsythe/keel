// Spec: k.reactive, clause "The compiler's output for a module whose top level is `export const r = owner()`, `const n = 1` and `f()` calls `owner()` and `f()` each inside its own call of `moduleRoot` and `1` inside none."
// Seed 1337 (fc.assert seed below).
// The output is read as text: each balanced `moduleRoot(...)` call's argument text is one root.
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const helper = { path: "modules/m/f.ts", source: "export function f(): void {}\n" };

function build(source: string): string {
  const r = compile([{ path: "modules/m/a.ts", source }, helper]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs.find((o) => o.code.includes("owner"));
  if (out === undefined) throw new Error("no output for modules/m/a.ts");
  return out.code;
}

/** The argument text of every call of `moduleRoot`, found by matching parentheses. */
function rootBodies(code: string): string[] {
  const bodies: string[] = [];
  const needle = "moduleRoot(";
  let at = code.indexOf(needle);
  while (at !== -1) {
    const start = at + needle.length;
    let depth = 1;
    let i = start;
    while (i < code.length && depth > 0) {
      const ch = code[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    bodies.push(code.slice(start, i - 1));
    at = code.indexOf(needle, i);
  }
  return bodies;
}

test("the compiler's output for a module whose top level is `export const r = owner()`, `const n = 1` and `f()` calls `owner()` and `f()` each inside its own call of `moduleRoot` and `1` inside none", () => {
  const code = build(
    `import { owner } from "@keel/reactive"\nimport { f } from "./f.ts"\nexport const r = owner()\nconst n = 1\nf()\nexport { n }\n`,
  );
  const bodies = rootBodies(code);
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toContain("owner()");
  expect(bodies[0]).not.toContain("f()");
  expect(bodies[1]).toContain("f()");
  expect(bodies[1]).not.toContain("owner()");
  for (const b of bodies) expect(b).not.toMatch(/\b1\b/);
  expect(code).toMatch(/\bn\s*=\s*1\b/);
});

type Item = "const-call" | "let-call" | "var-call" | "expression-call" | "const-literal";

test("property: each top-level declaration whose initializer holds a call and each top-level expression statement holding one is in its own `moduleRoot` call, and a declaration holding none is in none", () => {
  const item = fc.constantFrom<Item>("const-call", "let-call", "var-call", "expression-call", "const-literal");
  fc.assert(
    fc.property(fc.array(item, { minLength: 1, maxLength: 8 }), (items) => {
      const lines = items.map((kind, i) => {
        switch (kind) {
          case "const-call":
            return `const v${i} = f()`;
          case "let-call":
            return `let v${i} = f()`;
          case "var-call":
            return `var v${i} = f()`;
          case "expression-call":
            return "f()";
          case "const-literal":
            return `const v${i} = ${i + 100}`;
        }
      });
      const code = build(
        `import { owner } from "@keel/reactive"\nimport { f } from "./f.ts"\nexport const r = owner()\n${lines.join("\n")}\n`,
      );
      const bodies = rootBodies(code);
      const calls = items.filter((k) => k !== "const-literal").length;
      expect(bodies).toHaveLength(calls + 1);
      for (const b of bodies) expect(b).not.toMatch(/\b1\d\d\b/);
    }),
    { seed: SEED, numRuns: 40 },
  );
});
