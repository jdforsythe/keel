// Spec: k.scaffold-shell, clause "`shell: 'electron'`, and no `id`, are each E1052; `id: 'shop'` is E1353 naming E1573. Nothing is written."
// k.scaffold-shell, Refusals "`shell` neither `tauri` nor `capacitor`, no `id`, no `name` and no `package.json` `name` to derive one from, `to` naming no deployable, no `topology.ts`, or a `package.json` that is not a JSON object: E1052. An `id` that is not reverse-DNS: E1353 naming E1573. ... Its deployable or `shells` written as something other than an object literal: E1052." Judged in that order.
// Seed 1337 (property over ids).
// UNTESTABLE: the exact reverse-DNS grammar (the spec names E1573 and gives `shop` as the one refused example): the property uses one-segment ids and `com.<word>.<word>` ids only.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, errText, lowerName, snap } from "./fixtures.ts";
import { type ShellInput, multiTopology, p, pNode, shell, withTopology } from "./shell-support.ts";

const ID = "com.acme.p";

function refused(files: Map<string, string>, input: Partial<ShellInput>): string {
  const before = snap(files);
  const r = shell({ shell: "tauri", ...input }, files);
  expect(r.ok, JSON.stringify(input)).toBe(false);
  expect(snap(files)).toBe(before);
  return errText(r);
}
const topologyWith = (web: string): string =>
  `import { topology } from "@keel/server";\n\nexport default topology({\n  web: ${web},\n});\n`;

describe("scaffold shell, input refusals", () => {
  it("shell: 'electron' is E1052, nothing written", () => {
    expect(refused(p(), { shell: "electron", id: ID })).toContain("E1052");
  });

  it("no id is E1052, nothing written", () => {
    expect(refused(p(), {})).toContain("E1052");
    expect(refused(p(), { id: "" })).toContain("E1052");
  });

  it("id: 'shop' is E1353 naming E1573, nothing written", () => {
    const t = refused(p(), { id: "shop" });
    expect(t).toContain("E1353");
    expect(t).toContain("E1573");
  });

  it("any one-segment id is E1353 naming E1573 and any com.<word>.<word> id applies", () => {
    fc.assert(
      fc.property(lowerName, lowerName, (a, b) => {
        const t = refused(p(), { id: a });
        expect(t).toContain("E1353");
        expect(t).toContain("E1573");
        expect(shell({ shell: "tauri", id: `com.${a}.${b}` }, p()).ok).toBe(true);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("an input refusal is judged before E1353, and E1353 before E1359", () => {
    expect(refused(multiTopology(), { id: "shop", to: "nope" })).toContain("E1052");
    expect(refused(multiTopology(), { id: "shop" })).toContain("E1353");
    expect(refused(pNode(), { id: "shop" })).toContain("E1353");
  });

  it("no topology.ts is E1052", () => {
    const files = p();
    files.delete("topology.ts");
    expect(refused(files, { id: ID })).toContain("E1052");
  });

  it("a package.json that is not a JSON object is E1052", () => {
    for (const text of ["[]", "null", "42", '"x"']) {
      expect(refused(new Map(p()).set("package.json", text), { id: ID }), text).toContain("E1052");
    }
  });

  it("a deployable written as something other than an object literal is E1052", () => {
    expect(refused(withTopology(p(), topologyWith("webDeployable()")), { id: ID })).toContain("E1052");
  });

  it("shells written as something other than an object literal is E1052", () => {
    const web = `{ modules: ["app"], adapter: "client", shells: someShells }`;
    expect(refused(withTopology(p(), topologyWith(web)), { id: ID })).toContain("E1052");
  });
});
