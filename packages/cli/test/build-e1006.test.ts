// Seed 1337. An evaluation problem fails `keel build` (k.compiler Build-time evaluation): a `routes.ts` that fails
// while it evaluates is one E1006 error diagnostic, counted in the summary, exit 1, with a `client` deployable (the
// Vite build fails) and with `node` ones only (`routesRun` fails). The file fails without a `throw` (E1451 is check's).
import { expect, test } from "vitest";
import {
  SLOW,
  type Tree,
  cleanup,
  clientTree,
  keelRun,
  materialize,
  nodeTree,
} from "../conformance/boundary-support.ts";

const failing = (tree: Tree): Tree => ({
  ...tree,
  "modules/a/routes.ts":
    "import { manifest } from '@keel/router'\nexport const routes: ReturnType<typeof manifest> = JSON.parse('{')\n",
});

test.each(["client", "node"] as const)(
  "with a %s deployable, a routes.ts failing to evaluate is one E1006 error and exit 1",
  (kind) => {
    const dir = materialize(failing(kind === "client" ? clientTree() : nodeTree("node")));
    try {
      const r = keelRun(dir, ["build"]);
      const records = r.out
        .split("\n")
        .filter((l) => l.startsWith("{"))
        .map((l): unknown => JSON.parse(l));
      const e1006 = records.filter((x) => typeof x === "object" && x !== null && Reflect.get(x, "code") === "E1006");
      expect(e1006, r.out).toHaveLength(1);
      expect(JSON.stringify(e1006[0])).toContain("modules/a/routes.ts");
      const summary = records.find((x) => typeof x === "object" && x !== null && Reflect.get(x, "kind") === "summary");
      const counts = typeof summary === "object" && summary !== null ? Reflect.get(summary, "counts") : undefined;
      expect(typeof counts === "object" && counts !== null ? Reflect.get(counts, "errors") : 0).toBeGreaterThanOrEqual(
        1,
      );
      expect(r.status, r.out).toBe(1);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);
