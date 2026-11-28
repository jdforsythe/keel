// Backlog 0169 (rfc:0059): a `topology.ts` under `modules/` is not a project root, so `keel check` and `keel build`
// compile `modules/app/ui/*` in the same project and report the same E1004. Engine over in-memory files.
import { projectDirs } from "@keel/compiler";
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";

const CWD = "/work/app";
const files = [
  { path: "topology.ts", source: "export default { site: { modules: ['app'], adapter: 'static' } };\n" },
  { path: "modules/app/db.server.ts", source: "export const db = (): number => 1;\n" },
  { path: "modules/app/ui/topology.ts", source: "export default { web: { modules: ['ui'], adapter: 'client' } };\n" },
  {
    path: "modules/app/ui/Card.tsx",
    source: 'import { db } from "../db.server.ts";\nexport default function Card() {\n  return <p>{db()}</p>\n}\n',
  },
];

const e1004 = (stdout: string): string[] =>
  stdout
    .split("\n")
    .filter((l) => l.includes('"E1004"'))
    .map((l): unknown => JSON.parse(l))
    .map((r) => (typeof r === "object" && r !== null && "path" in r ? String(r.path) : ""));

describe("project roots (0169)", () => {
  it("a topology.ts under modules/ is not a project root; .keel/ and top-level topology.ts dirs are", () => {
    const src = "export default { w: { modules: ['m'], adapter: 'node' } };\n";
    const dirs = projectDirs([
      { path: "modules/app/ui/topology.ts", source: src },
      { path: "modules/x/.keel/ids.json", source: "{}" },
      { path: "apps/a/topology.ts", source: src },
      { path: "apps/b/.keel/ids.json", source: "{}" },
      { path: "packages/x/src/topology.ts", source: "export function topology() {}\n" },
    ]);
    expect(dirs).toEqual(["apps/a/", "apps/b/", ""]);
  });

  it("keel check and keel build report the same E1004 beside a nested modules/app/ui/topology.ts", async () => {
    const built = await run(["build", "--format=json"], { cwd: CWD, files });
    const checked = await run(["check", "--format=json"], { cwd: CWD, files });
    expect(e1004(built.stdout)).toEqual(["modules/app/ui/Card.tsx"]);
    expect(e1004(checked.stdout)).toEqual(e1004(built.stdout));
  });
});
