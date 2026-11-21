// isComponentFile is the one component-file definition (k.component, rfc:0068): E1752 exempts `Props`/`uses` and
// E1104 exempts `Props` exactly for the files it accepts (backlog 0197).
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";
import { isComponentFile } from "../src/internal/isComponentFile.ts";

const S =
  'import { s } from "@keel/schema";\nimport type { Infer } from "@keel/schema";\nexport const Props = s.object({});\n';
const CASES: readonly { path: string; tail: string; component: boolean }[] = [
  { path: "modules/app/Row.tsx", tail: "export default function Row() { return null; }\n", component: true },
  { path: "modules/app/row.tsx", tail: "export default function row() { return null; }\n", component: false },
  {
    path: "modules/app/Row.ts",
    tail: "export default function Row(p: Infer<typeof Props>) { return p; }\n",
    component: true,
  },
  {
    path: "modules/app/Row.ts",
    tail: "const Row = (p: Infer<typeof Props>) => p;\nexport default Row;\n",
    component: true,
  },
  {
    path: "modules/app/Row.ts",
    tail: "type P = Infer<typeof Props>;\nexport default (props: P = {}) => props;\n",
    component: false,
  },
  { path: "modules/app/Row.ts", tail: "export default function Row(p: string) { return p; }\n", component: false },
  { path: "modules/app/Row.ts", tail: "export default function Row(p) { return p; }\n", component: false },
  { path: "modules/app/Config.ts", tail: "export default { a: 1 };\n", component: false },
  {
    path: "modules/app/config.ts",
    tail: "export default function config(p: Infer<typeof Props>) { return p; }\n",
    component: false,
  },
  {
    path: "modules/app/Row.server.ts",
    tail: "export default function Row(p: Infer<typeof Props>) { return p; }\n",
    component: false,
  },
];

const codes = (path: string, source: string): string[] =>
  check([{ path, source }], { types: false }).diagnostics.map((d) => d.code);

describe("isComponentFile (backlog 0197)", () => {
  for (const c of CASES)
    it(`${c.path}: ${c.tail.trim().slice(0, 50)} is ${c.component ? "" : "not "}a component; E1104 and E1752 agree`, () => {
      const src = `${S}${c.tail}`;
      expect(isComponentFile(c.path, parseSync(c.path, src).program)).toBe(c.component);
      expect(codes(c.path, src).includes("E1104")).toBe(!c.component);
      const both = `${src}export const uses = [];\n`;
      expect(codes(c.path, both).includes("E1752")).toBe(!c.component);
    });
});
