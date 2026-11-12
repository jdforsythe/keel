// The static read of `topology.ts` (k.topology): a deployable name has one form (`deployableNameProblem`), and every
// part the read cannot take is a problem (`topologyReadProblems`): E1552, or E1566 for a non-literal `host`. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deployableNameProblem } from "../src/hosting/deployableNameProblem.ts";
import { topologyReadProblems } from "../src/hosting/topologyReadProblems.ts";
import { parseTopology } from "../src/internal/parseTopology.ts";

const SEED = 1337;
const FORM = /^[a-z][a-z0-9-]*$/;
const top = (body: string): string =>
  `import { topology } from "@keel/server";\nexport default topology({ ${body} });\n`;

describe("deployableNameProblem", () => {
  it("takes the golden apps' names and refuses case, paths, underscores and a leading digit or dash", () => {
    for (const n of ["web", "api", "sessions", "x", "edge-2"]) expect(deployableNameProblem(n), n).toBeUndefined();
    for (const n of ["Web", "API", "../x", "a/b", "my_api", "2web", "-web", "", "web "])
      expect(deployableNameProblem(n), n).toBe(
        `${n}: name must be lowercase letters, digits and -, starting with a letter`,
      );
  });

  it("accepts exactly the form, so two accepted names never collide upper-cased or on a case-insensitive disk", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), (n) => {
        expect(deployableNameProblem(n) === undefined).toBe(FORM.test(n));
      }),
      { seed: SEED },
    );
    fc.assert(
      fc.property(fc.stringMatching(FORM), fc.stringMatching(FORM), (a, b) => {
        fc.pre(a !== b);
        expect(a.toUpperCase()).not.toBe(b.toUpperCase());
        expect(a.toLowerCase()).not.toBe(b.toLowerCase());
        expect(a.includes("/") || a.includes(".")).toBe(false);
      }),
      { seed: SEED },
    );
  });
});

describe("topologyReadProblems", () => {
  it("is empty for a literal topology", () => {
    expect(
      topologyReadProblems(
        top(`web: { modules: ["a"], adapter: "client", host: "api" }, api: { modules: ["b"], adapter: "node" }`),
      ),
    ).toEqual([]);
  });

  it("names the deployable whose adapter or modules is not a literal, and reads no module of it", () => {
    const need = "needs modules: [...] and adapter: 'node' | 'static' | 'client'";
    for (const [body, problem] of [
      ["web: { modules: ['a'], adapter: ADAPTER }", `web: ${need}`],
      ["web: { modules: MODULES, adapter: 'node' }", `web: ${need}`],
      ["web: { modules: [A], adapter: 'node' }", "web: module id is not a string literal"],
    ] as const) {
      expect(topologyReadProblems(top(body)), body).toContainEqual(["E1552", "web", problem]);
      expect(parseTopology(top(body)).topology.web?.modules ?? [], body).toEqual([]);
    }
  });

  it("reports a name out of form as E1552 and a host that is not a literal as E1566", () => {
    expect(
      topologyReadProblems(
        top(`Web: { modules: ["a"], adapter: "node" }, w: { modules: ["b"], adapter: "client", host: H }`),
      ),
    ).toEqual([
      ["E1552", "Web", "Web: name must be lowercase letters, digits and -, starting with a letter"],
      ["E1566", "w", "w: host must be a string literal"],
    ]);
    expect(parseTopology(top(`"../x": { modules: ["a"], adapter: "node" }`)).topology).toEqual({});
  });

  it("names the deployable from its key, never from the message, so a key with ': ' is attributed whole", () => {
    expect(topologyReadProblems(top(`"A: b": { modules: ["a"], adapter: "node" }`))).toEqual([
      ["E1552", "A: b", "A: b: name must be lowercase letters, digits and -, starting with a letter"],
    ]);
    expect(parseTopology(top(`"A: b": { modules: ["a"], adapter: "node" }`)).problems).toEqual([
      ["A: b", "A: b: name must be lowercase letters, digits and -, starting with a letter"],
    ]);
  });

  it("keeps every message on one line, quoting a name with a control or non-ASCII character", () => {
    const [problem] = topologyReadProblems(top(`"a\\nE0000 x": { modules: ["a"], adapter: "node" }`));
    expect(problem).toEqual([
      "E1552",
      "a\nE0000 x",
      '"a\\nE0000 x": name must be lowercase letters, digits and -, starting with a letter',
    ]);
    fc.assert(
      fc.property(fc.fullUnicodeString({ maxLength: 12 }), (n) => {
        expect(deployableNameProblem(n) ?? "").not.toMatch(/[\n\r\u2028\u2029]/);
      }),
      { seed: SEED },
    );
  });

  it("reports whole-file problems with no deployable", () => {
    expect(topologyReadProblems("export const x = 1;\n")).toEqual([["E1552", "", "no default export"]]);
    expect(topologyReadProblems("export default topology({")[0]?.slice(0, 2)).toEqual(["E1552", ""]);
    expect(topologyReadProblems(top("[k]: { modules: ['a'], adapter: 'node' }"))).toEqual([
      ["E1552", "", "deployable name is not a literal"],
    ]);
  });
});
