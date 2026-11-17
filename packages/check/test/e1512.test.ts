// k.api in keel check: E1512 mapped from the `routes.actions` type error for an action whose `output` does not fit
// its route.
import path from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import type { Diagnostic } from "../src/index.ts";

/** A directory `@keel/router` resolves from, so the manifest's types are checked. */
const ROOT = path.join(repoRoot(import.meta.dirname), "packages", "ui");
const typed = (kind: string, verb = "POST"): readonly Diagnostic[] =>
  check(
    [
      {
        path: "modules/a/routes.ts",
        source: `import { manifest } from '@keel/router'\nimport type { Action, ApiAction } from '@keel/router'\ndeclare const Page: () => Node\ndeclare const act: ${kind}\nexport const routes = manifest({ 'a.api': { api: true, path: '/api/x' }, 'a.home': { path: '/', component: Page } })\nroutes.actions({ 'a.api': { ${verb}: act }, 'a.home': { ${verb}: act } })\n`,
      },
    ],
    { root: ROOT },
  ).diagnostics;

describe("E1512 from the type check of routes.actions", () => {
  it("a page action on an API route is E1512 naming the route and method, in k.api", () => {
    expect(typed("Action<unknown>", "PUT").map((d) => [d.code, d.see, d.line, d.message])).toEqual([
      ["E1512", "k.api", 6, "a.api: an API route's action declares output (PUT)"],
    ]);
  });

  it("an API action on a page is E1512 naming the page", () => {
    expect(typed("ApiAction<unknown, unknown>").map((d) => [d.code, d.message])).toEqual([
      ["E1512", "a.home: a page's action declares no output (POST)"],
    ]);
  });
});
