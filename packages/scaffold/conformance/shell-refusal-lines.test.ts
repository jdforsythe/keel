// Spec: k.scaffold-shell, Conformance "Each refusal's compact line has a message under 90 characters."
// ASSUMED compact diagnostic line (docs/OUTPUT.md): `<code> <path>[:<line>[:<col>]] <message>`; the message is what follows the location (or the code when there is none).
// No random input: one fixed project per refusal, run through the real `keel` binary in the default (compact) format.
import { describe, expect, it } from "vitest";
import type { Files } from "./fixtures.ts";
import { cleanup, materialize, readTree } from "./keel-cli.ts";
import { BOUND, editManifest, keelText, multiTopology, p, pNode, shellApply, withTopology } from "./shell-support.ts";

const ID = ["--id", "com.acme.p"];
const web = (body: string): string =>
  `import { topology } from "@keel/server";\n\nexport default topology({\n  web: ${body},\n});\n`;
const noName = (): Files =>
  editManifest(p(), (m) => {
    m.name = undefined;
  });
const noTopology = (): Files => {
  const files = p();
  files.delete("topology.ts");
  return files;
};
const notObject = (): Files => new Map(p()).set("package.json", "[]\n");

const cases: [string, string, () => Files, string[]][] = [
  ["E1052", "shell electron", p, ["electron", ...ID]],
  ["E1052", "no --id", p, ["tauri"]],
  ["E1052", "no package.json name and no --name", noName, ["tauri", ...ID]],
  ["E1052", "--to naming no deployable", multiTopology, ["tauri", ...ID, "--to", "nope"]],
  ["E1052", "no topology.ts", noTopology, ["tauri", ...ID]],
  ["E1052", "package.json not a JSON object", notObject, ["tauri", ...ID]],
  ["E1052", "deployable not an object literal", () => withTopology(p(), web("webDeployable()")), ["tauri", ...ID]],
  [
    "E1052",
    "shells not an object literal",
    () => withTopology(p(), web(`{ modules: ["app"], adapter: "client", shells: someShells }`)),
    ["tauri", ...ID],
  ],
  ["E1353", "id not reverse-DNS", p, ["tauri", "--id", "shop"]],
  ["E1359", "several client deployables and no --to", multiTopology, ["capacitor", ...ID]],
  ["E1359", "--to naming a node deployable", multiTopology, ["tauri", ...ID, "--to", "api"]],
  ["E1359", "a node-only project", pNode, ["tauri", ...ID]],
  [
    "E1351",
    "the deployable already declares the shell",
    () => shellApply({ shell: "tauri", id: "com.acme.p" }, p()),
    ["tauri", ...ID],
  ],
];

describe("scaffold shell refusals, compact lines", () => {
  for (const [code, name, mk, args] of cases) {
    it(
      `${code} (${name}): the message is under 90 characters and nothing is written`,
      () => {
        const dir = materialize(mk());
        try {
          const before = readTree(dir);
          const r = keelText(dir, ["scaffold", "shell", ...args]);
          expect(r.status, r.lines.join("\n")).not.toBe(0);
          const diags = r.lines.filter((l) => /^E\d{4} /.test(l));
          expect(diags.length, r.lines.join("\n")).toBeGreaterThanOrEqual(1);
          expect(diags[0]?.startsWith(`${code} `), r.lines.join("\n")).toBe(true);
          // the refusal is the operation's own, not the CLI rejecting an unknown flag or operation
          for (const line of diags) expect(line, line).not.toMatch(/unknown (flag|scaffold operation|operation)/);
          for (const line of diags) {
            const message = line.replace(/^E\d{4} (\S+:\d+(:\d+)? )?/, "");
            expect(message.length, line).toBeGreaterThan(0);
            expect(message.length, line).toBeLessThan(90);
          }
          expect(readTree(dir)).toEqual(before);
        } finally {
          cleanup(dir);
        }
      },
      BOUND,
    );
  }
});
