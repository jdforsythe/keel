// Spec: k.create, clause "With `yarn/4.5.0`, an app's and a library's `.gitignore` end with the lines `.pnp.*`, `.yarn/*`, `!.yarn/patches`, `!.yarn/plugins`, `!.yarn/releases`, `!.yarn/sdks`, `!.yarn/versions`; with `pnpm/11.17.0`, it holds no line starting `.yarn` or `.pnp`."
// Seed 1337 (property over the yarn version and the project kind). `createPlan` over in-memory folders (create-plan-support.ts).
// ASSUMED: "end with the lines" is the last seven lines of the file, in that order, a final newline ignored.
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, type PlanInput, plan } from "./create-plan-support.ts";

const LINES = [
  ".pnp.*",
  ".yarn/*",
  "!.yarn/patches",
  "!.yarn/plugins",
  "!.yarn/releases",
  "!.yarn/sdks",
  "!.yarn/versions",
];
const kinds: PlanInput[] = [
  { adapter: "client" },
  { adapter: "static" },
  { adapter: "node" },
  { library: "@acme/charts" },
];
const linesOf = (text: string | undefined): string[] => (text ?? "").replace(/\n$/, "").split("\n");

it("With `yarn/4.5.0`, an app's and a library's `.gitignore` end with the lines `.pnp.*`, `.yarn/*`, `!.yarn/patches`, `!.yarn/plugins`, `!.yarn/releases`, `!.yarn/sdks`, `!.yarn/versions`", () => {
  for (const kind of kinds) {
    const p = plan({ ...kind, userAgent: "yarn/4.5.0 npm/? node/v22.15.0" });
    expect(p.ok, p.text).toBe(true);
    expect(linesOf(p.files.get(".gitignore")).slice(-LINES.length), JSON.stringify(kind)).toEqual(LINES);
  }
});

it("for any yarn version the `.gitignore` of every project kind ends with yarn's lines", () => {
  fc.assert(
    fc.property(fc.constantFrom(...kinds), fc.tuple(fc.nat(30), fc.nat(30), fc.nat(30)), (kind, [a, b, c]) => {
      const p = plan({ ...kind, userAgent: `yarn/${a}.${b}.${c} npm/? node/v22.15.0` });
      expect(p.ok, p.text).toBe(true);
      expect(linesOf(p.files.get(".gitignore")).slice(-LINES.length)).toEqual(LINES);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("with `pnpm/11.17.0`, it holds no line starting `.yarn` or `.pnp`", () => {
  for (const kind of kinds) {
    const p = plan({ ...kind, userAgent: "pnpm/11.17.0 npm/? node/v22.15.0" });
    expect(p.ok, p.text).toBe(true);
    for (const l of linesOf(p.files.get(".gitignore"))) expect(l, JSON.stringify(kind)).not.toMatch(/^(\.yarn|\.pnp)/);
  }
});
