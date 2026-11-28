// Spec: k.deploy, clause "The Dockerfile of a `'sqlite'` deployable declares `/data` and runs `server.mjs` without `--localstorage-file`; of a `'postgres'` one declares no volume; `compose.yaml` passes `KEEL_DATABASE_URL` from the environment and holds no URL."
// Seed: 1337.
// ASSUMPTION: `deployDrift(tree, true)` on a tree holding `topology.ts` yields the generated files as `want` (what `keel build` writes); the
// tree needs only `topology.ts` and `package.json`. "Declares `/data`" is read as a `VOLUME` line naming `/data`; "no volume" as no `VOLUME` line.
import { deployDrift } from "@keel/scaffold";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
type Storage = "file" | "sqlite" | "postgres";

const topologySource = (storage: Record<string, Storage | undefined>): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n${Object.entries(storage)
    .map(
      ([name, st]) =>
        `  ${name}: { modules: ['${name}m'], adapter: 'node'${st === undefined ? "" : `, storage: '${st}'`} },`,
    )
    .join("\n")}\n})\n`;

function generated(storage: Record<string, Storage | undefined>): Map<string, string> {
  const tree = new Map<string, string>([
    [
      "package.json",
      `${JSON.stringify({ name: "fx", private: true, dependencies: { "@keel/std-db": "workspace:*" } })}\n`,
    ],
    ["topology.ts", topologySource(storage)],
  ]);
  const out = new Map<string, string>();
  for (const d of deployDrift(tree, true)) if (d.want !== null) out.set(d.path, d.want);
  return out;
}
const text = (files: Map<string, string>, path: string): string => {
  const v = files.get(path);
  if (v === undefined) throw new Error(`not generated: ${path}`);
  return v;
};
const volumeLines = (dockerfile: string): string[] => dockerfile.split("\n").filter((l) => /^\s*VOLUME\b/.test(l));
const names = fc.uniqueArray(
  fc.stringMatching(/^[a-z]{3,8}$/).map((n) => `zq${n}`),
  { minLength: 1, maxLength: 3 },
);

describe("k.deploy: Dockerfile and compose text per storage", () => {
  test("The Dockerfile of a `'sqlite'` deployable declares `/data` and runs `server.mjs` without `--localstorage-file`; of a `'postgres'` one declares no volume; `compose.yaml` passes `KEEL_DATABASE_URL` from the environment and holds no URL.", () => {
    fc.assert(
      fc.property(names, (ns) => {
        const storage: Record<string, Storage> = {};
        ns.forEach((n, i) => {
          storage[n] = (["sqlite", "postgres", "file"] as const)[i % 3] ?? "file";
        });
        const files = generated(storage);
        for (const [n, st] of Object.entries(storage)) {
          const dockerfile = text(files, `deploy/${n}/Dockerfile`);
          if (st === "sqlite") {
            expect(volumeLines(dockerfile).join("\n")).toContain("/data");
            expect(dockerfile).not.toContain("--localstorage-file");
          } else if (st === "postgres") {
            expect(volumeLines(dockerfile)).toEqual([]);
            expect(dockerfile).not.toContain("--localstorage-file");
          } else {
            expect(volumeLines(dockerfile).join("\n")).toContain("/data");
            expect(dockerfile).toContain("--localstorage-file=/data/storage");
          }
          expect(dockerfile).toContain("node:22-slim@sha256:");
          expect(dockerfile).toMatch(/^USER node$/m);
          expect(dockerfile).toContain("8080");
        }
        const compose = text(files, "deploy/compose.yaml");
        expect(compose).toContain("KEEL_DATABASE_URL");
        expect(compose).not.toMatch(/(postgres(ql)?|file):[^\s]*\/[^\s]*/);
        expect(compose).not.toMatch(/KEEL_DATABASE_URL\s*[:=]\s*["']?(postgres|file)/);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });
});
