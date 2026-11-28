// Spec: k.derived, clause "`check()` given a project's files and a `.keel/ids.json` that differs from their compile reports one E1005 at that file and writes nothing; given a `.keel/routes.json` and no `derived`, it reports no diagnostic at that file."
// Seed n/a: fixed project. The in-process `check()` over files: the view is `compile(...)`'s artifact, written as the compiler writes it (sorted keys, a content hash).
// ASSUMED: "writes nothing" is read as the files array and its entries being unchanged by the call (`check()` takes no directory); the evaluated view of the second half is a routes.json that differs from any evaluation.
// k.derived Rules: `reportedCodes()` lists neither W1018 (a command code) nor W1005 (reserved); the last case asserts it.
import { check, reportedCodes } from "@keel/check";
import { compile } from "@keel/compiler";
import type { RouteEntry } from "@keel/compiler";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";

type Files = Parameters<typeof check>[0];
const NO_TYPES = { types: false };
const SOURCE = {
  path: "C.tsx",
  source: "import { Text } from '@keel/ui'\nexport default function C() { return <Text id=\"c.t\">x</Text> }\n",
};

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (typeof v === "object" && v !== null)
    return Object.fromEntries(
      Object.entries(v)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, sortKeys(x)]),
    );
  return v;
}
const text = (data: unknown, hash: string, indent?: number): string =>
  `${JSON.stringify({ data: sortKeys(data), hash }, null, indent)}\n`;

const HOME: RouteEntry = {
  path: "/home",
  params: null,
  search: null,
  actions: [],
  layout: null,
  guard: null,
  module: "m",
};

describe("k.derived In process", () => {
  test(
    "`check()` given a project's files and a `.keel/ids.json` that differs from their compile reports one E1005 at that file and writes nothing; given a `.keel/routes.json` and no `derived`, it reports no diagnostic at that file.",
    () => {
      const plain = compile([SOURCE]);
      const ids = text(plain.artifacts["ids.json"], plain.hashes["ids.json"]);
      expect(check([{ path: ".keel/ids.json", source: ids }, SOURCE], NO_TYPES).diagnostics.map((d) => d.code)).toEqual(
        [],
      );
      const edited = text(plain.artifacts["ids.json"], plain.hashes["ids.json"], 2);
      expect(edited).not.toBe(ids);
      const files: Files = [{ path: ".keel/ids.json", source: edited }, SOURCE];
      const before = JSON.stringify(files);
      const found = check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1005");
      expect(found.map((d) => d.path)).toEqual([".keel/ids.json"]);
      expect(JSON.stringify(files)).toBe(before);

      const withRoutes = compile([SOURCE], { routes: { "m.home": HOME } });
      const routes = text(withRoutes.artifacts["routes.json"], withRoutes.hashes["routes.json"]);
      const given: Files = [{ path: ".keel/routes.json", source: routes }, SOURCE];
      expect(check(given, NO_TYPES).diagnostics.filter((d) => d.path === ".keel/routes.json")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`reportedCodes()` lists neither W1018 (a command code) nor W1005 (reserved)",
    () => {
      const codes = reportedCodes();
      expect(codes).not.toContain("W1018");
      expect(codes).not.toContain("W1005");
    },
    CHECK_CASE_BOUND,
  );
});
