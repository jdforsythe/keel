// E1207 examples pinned by location and message: which `scope` calls may create a detached scope.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const MSG = "scope({ detached }) is for kernel code; nest the scope, or make a module root";
const IMP = "import { scope } from '@keel/reactive'\n";
const out = (source: string, path = "modules/app/job.ts"): string[] =>
  check([{ path, source }], { types: false })
    .diagnostics.filter((d) => d.code === "E1207")
    .map((d) => `${d.line}:${d.col} ${d.message}`);
const body = (call: string, head = IMP): string => `${head}export const run = () => ${call}\n`;

describe("E1207 detached scope in app code", () => {
  it("reports detached: true at the options argument with the message", () => {
    expect(out(body("scope(() => 1, { detached: true })"))).toEqual([`2:41 ${MSG}`]);
  });

  it("reports an aliased import", () => {
    expect(out(body("mk(() => 1, { detached: true })", "import { scope as mk } from '@keel/reactive'\n"))).toHaveLength(
      1,
    );
  });

  it("reports <namespace>.scope", () => {
    expect(out(body("r.scope(() => 1, { detached: true })", "import * as r from '@keel/reactive'\n"))).toHaveLength(1);
  });

  it("reports shorthand, a non-false value, a string key, and a spread", () => {
    expect(out(body("scope(() => 1, { detached })"))).toHaveLength(1);
    expect(out(body("scope(() => 1, { detached: flag })"))).toHaveLength(1);
    expect(out(body("scope(() => 1, { 'detached': true, onError })"))).toHaveLength(1);
    expect(out(body("scope(() => 1, { ...o })"))).toHaveLength(1);
    expect(out(body("scope(() => 1, { [k]: true })"))).toHaveLength(1);
  });

  it("reports a non-literal options argument", () => {
    expect(out(body("scope(() => 1, opts)"))).toHaveLength(1);
    expect(out(body("scope(() => 1, make())"))).toHaveLength(1);
    expect(out(body("scope(() => 1, ok ? { onError } : undefined)"))).toHaveLength(1);
  });

  it("stays quiet on scope(fn), onError, and detached: false", () => {
    expect(out(body("scope(() => 1)"))).toEqual([]);
    expect(out(body("scope(() => 1, { onError })"))).toEqual([]);
    expect(out(body("scope(() => 1, { detached: false, onError })"))).toEqual([]);
  });

  it("stays quiet when scope is a shadowing local or another import", () => {
    expect(out(`${IMP}export const f = (scope: Fn) => scope(() => 1, { detached: true })\n`)).toEqual([]);
    expect(out(`${IMP}export const f = () => { const scope = mk(); return scope(() => 1, opts) }\n`)).toEqual([]);
    expect(out(body("scope(() => 1, { detached: true })", "import { scope } from './local.ts'\n"))).toEqual([]);
    expect(out(`import * as r from '@keel/reactive'\nexport const f = (r: X) => r.scope(() => 1, opts)\n`)).toEqual([]);
  });

  it("stays quiet in kernel packages and tests, and fires in a stdlib package", () => {
    const src = body("scope(() => 1, { detached: true, onError })");
    expect(out(src, "packages/std-sessions/src/internal/recording.ts")).toHaveLength(1);
    expect(out(src, "packages/reactive/src/scope.ts")).toEqual([]);
    expect(out(src, "modules/app/job.test.ts")).toEqual([]);
    expect(out(src)).toHaveLength(1);
    expect(out(src, "modules/app/unsafe/job.ts")).toHaveLength(1);
  });
});
