// shellsOf (k.shell Shell target): a shell package's `./tools` loads for a shell the topology declares, or while its
// deploy folder holds files to remove, never because other text or another path names a shell. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { shellsOf } from "../src/internal/shellsOf.ts";

const run = { seed: 1337, numRuns: 50 };
const topology = (shells: string): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client'${shells} },\n  api: { modules: ['s'], adapter: 'node' },\n})\n`;
const file = (path: string, source = "") => ({ path, source });

describe("shellsOf", () => {
  test("a declared shell is listed with its deployables", () => {
    const project = [file("topology.ts", topology(", shells: { tauri: { id: 'dev.keel.a', name: 'A' } }"))];
    expect(shellsOf(project)).toEqual([{ shell: "tauri", declared: ["web"] }]);
  });

  test("a deploy folder holding a file lists its shell with no deployable", () => {
    const project = [file("topology.ts", topology("")), file("deploy/web/capacitor/capacitor.config.json")];
    expect(shellsOf(project)).toEqual([{ shell: "capacitor", declared: [] }]);
  });

  test("a shell's name in a comment, a module path, a string or another folder lists nothing", () => {
    const project = [
      file("topology.ts", `// tauri and capacitor later\n${topology(", title: 'tauri capacitor'")}`),
      file("modules/tauri-notes/module.ts"),
      file("capacitor.md"),
      file("deploy/tauri/Dockerfile"),
      file("deploy/web/tauri"),
      file("docs/deploy/web/tauri/a.json"),
    ];
    expect(shellsOf(project)).toEqual([]);
  });

  test("property: any path outside deploy/<name>/<shell>/ and any topology without shells list nothing", () => {
    const segment = fc.stringMatching(/^[a-z-]{1,12}$/);
    fc.assert(
      fc.property(fc.array(fc.array(segment, { minLength: 1, maxLength: 4 }), { maxLength: 8 }), (paths) => {
        const project = [
          file("topology.ts", topology("")),
          ...paths.filter((p) => !(p[0] === "deploy" && p.length > 3)).map((p) => file(p.join("/"))),
        ];
        expect(shellsOf(project)).toEqual([]);
      }),
      run,
    );
  });
});
