// Spec: k.cli, clause "`keel docs k.cli` prints <= 1,500 tokens."
// k.cli Commands `explain <code>` (<= 120 tokens), `docs --for <code>` (k.check: every installed spec line citing the code).
// Untestable (spec silent): `explain` on an unknown code, and `--format` selection by a registered custom formatter name.
// Token counting stand-in: ceil(chars / 4) (see fixtures).
import { describe, expect, it } from "vitest";
import { cleanProject, keel, lines, specFile, tokens } from "./fixtures";
import { cliPkg, pkg, project } from "./docs-support";

const specs = [specFile("k.cli"), specFile("k.check")];
const installed = [
  ...project(["cli", "router"]),
  ...cliPkg(
    [
      { id: "k.cli", title: "CLI", package: "@keel/router" },
      { id: "k.check", title: "Check", package: "@keel/router" },
    ],
    [],
  ),
  ...pkg("router", "2.3.4", [
    { id: "k.cli", title: "CLI", codes: ["E1051"], text: specs[0]?.source ?? "" },
    { id: "k.check", title: "Check", codes: ["E1051"], text: specs[1]?.source ?? "" },
  ]),
];

describe("k.cli spec and explain", () => {
  it("`keel docs k.cli` prints <= 1,500 tokens", async () => {
    const r = await keel(["docs", "k.cli"], { files: installed });
    expect(r.code).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
    expect(tokens(r.stdout)).toBeLessThanOrEqual(1500);
  });

  it("`keel docs --for <code>` prints every installed spec line citing the code", async () => {
    const r = await keel(["docs", "--for", "E1051"], { files: installed });
    const citing = specs.flatMap((f) => f.source.split("\n")).filter((l) => l.includes("E1051"));
    expect(citing.length).toBeGreaterThan(0);
    expect(lines(r.stdout).length).toBeGreaterThan(0);
    for (const l of citing) expect(r.stdout).toContain(l.trim().slice(0, 40));
  });

  it("`keel explain <code>` for a known code prints at most 120 tokens and names the code", async () => {
    for (const code of ["E1051", "E1052", "E1053", "E1054", "E1752"]) {
      const r = await keel(["explain", code], { files: [...specs, ...cleanProject()] });
      expect(r.code).toBe(0);
      expect(r.stdout).toContain(code);
      expect(tokens(r.stdout)).toBeLessThanOrEqual(120);
    }
  });
});
