// Seed 1337
import { check, defineRule } from "@keel/check";
import type { SourceFile } from "@keel/check";
import { expect, test } from "vitest";

const got: (readonly SourceFile[])[] = [];
defineRule({
  code: "E2921",
  message: "project probe",
  see: "k.check",
  explain: "Records the project a rule receives.",
  check: ({ project }) => {
    got.push(project);
    return [];
  },
});

test("topology.ts from opts.project joins the project when it is not among the checked files", () => {
  got.length = 0;
  const topo = {
    path: "apps/a/topology.ts",
    source:
      'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["c"], adapter: "client" } });\n',
  };
  const file = { path: "apps/a/modules/c/c.ts", source: "export const c = 1;\n" };
  check([file], { types: false, project: [file, topo] });
  expect(got.at(-1)?.map((f) => f.path)).toEqual(["apps/a/modules/c/c.ts", "apps/a/topology.ts"]);
});

test("the project list is frozen and not copied per rule run", () => {
  got.length = 0;
  check(
    [
      { path: "a.ts", source: "export const a = 1;\n" },
      { path: "b.ts", source: "export const b = 1;\n" },
    ],
    { types: false },
  );
  expect(got).toHaveLength(2);
  expect(got[0]).toBe(got[1]);
  expect(Object.isFrozen(got[0])).toBe(true);
});

test("a checked topology.ts is listed once", () => {
  got.length = 0;
  const topo = {
    path: "topology.ts",
    source:
      'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["c"], adapter: "client" } });\n',
  };
  check([topo], { types: false, project: [topo] });
  expect(got.at(-1)?.map((f) => f.path)).toEqual(["topology.ts"]);
});
