import { canonicalJson, hashOf, references } from "@keel/compiler/internal";
import { clipMessage } from "@keel/schema/internal";
import { fixedTime } from "@keel/tooling/test-time";
// Targeted examples pinning exact diagnostics (code, location, message, fix diff), helper edge cases, and
// formatting. Rule output is pinned with inline snapshots of reviewed fixtures. Property parts use seed 1337.
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { explain } from "../src/explain.ts";
import type { Budget, Diagnostic, SourceFile } from "../src/index.ts";
import { check, defineRule, format, rules } from "../src/index.ts";
import { applyEdits } from "../src/internal/applyEdits.ts";
import { budgetBreaches } from "../src/internal/budgetBreaches.ts";
import { compareDiagnostics } from "../src/internal/compareDiagnostics.ts";
import { ensureImport } from "../src/internal/ensureImport.ts";
import { findingAt } from "../src/internal/findingAt.ts";
import { groupByCode } from "../src/internal/groupByCode.ts";
import { isAppPath } from "../src/internal/isAppPath.ts";
import { isCodePath } from "../src/internal/isCodePath.ts";
import { isTestPath } from "../src/internal/isTestPath.ts";
import { langOf } from "../src/internal/langOf.ts";
import { lineCol } from "../src/internal/lineCol.ts";
import { nodeAt } from "../src/internal/nodeAt.ts";
import { normalize } from "../src/internal/normalize.ts";
import { num } from "../src/internal/num.ts";
import { stemOf } from "../src/internal/stemOf.ts";
import { str } from "../src/internal/str.ts";
import { summarize } from "../src/internal/summarize.ts";
import { trailer } from "../src/internal/trailer.ts";
import { tsCompilerOptions } from "../src/internal/tsCompilerOptions.ts";
import { unifiedDiff } from "../src/internal/unifiedDiff.ts";
import { applyPatch } from "./support/applyPatch.ts";
import { arbDiagnostic } from "./support/arbDiagnostic.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const f = (path: string, source: string): SourceFile => ({ path, source });
const NOW = ["Date", "now"].join(".");
const RANDOM = ["Math", "random"].join(".");
const UNSAFE = "unsafe";
const AS = "as";

/** One line per diagnostic (`code line:col message`), its fix diff indented below. */
const show = (files: SourceFile[], opts: Parameters<typeof check>[1] = { types: false }): string =>
  check(files, opts)
    .diagnostics.map(
      (d) => `${d.code} ${d.path}:${d.line}:${d.col} ${d.message}${d.fix === undefined ? "" : `\n${d.fix}`}`,
    )
    .join("\n");
const one = (path: string, source: string): string => show([f(path, source)]);
const only = (code: string, path: string, source: string): string =>
  check([f(path, source)], { types: false })
    .diagnostics.filter((d) => d.code === code)
    .map((d) => `${d.line}:${d.col} ${d.message}${d.fix === undefined ? "" : `\n${d.fix}`}`)
    .join("\n");

const block = (title: string, body: string): string => `# ${title}\n${body}`;

const RES =
  "import { ok, type KeelError, type Result } from '@keel/schema'\ndeclare const neg: KeelError<'m.neg', null>\n";

describe("E1452 noTryCatch", () => {
  const E = (path: string, src: string): string => only("E1452", path, src);
  it("pins every try/catch shape: message, location, and fix", () => {
    const out = [
      block(
        "rethrow, lines",
        E(
          "src/a.ts",
          "export async function f(p: () => Promise<void>) {\n  try {\n    await p()\n    await p()\n  } catch (e) {\n    await undo()\n    throw e\n  }\n}\n",
        ),
      ),
      block(
        "rethrow, one line",
        E("src/a.ts", "export function f(p: () => void) {\n  try { p() } catch (e) { undo(); throw e }\n}\n"),
      ),
      block(
        "rethrow, indented",
        E(
          "src/a.ts",
          "export function f(p: () => void) {\n  if (p) {\n    try { p() } catch (err) { undo(); throw err }\n  }\n}\n",
        ),
      ),
      block(
        "done taken",
        E(
          "src/a.ts",
          "export function f(p: () => void) {\n  const done = 1\n  try { p() } catch (e) { undo(); throw e }\n  return done\n}\n",
        ),
      ),
      block(
        "rethrow alone",
        E("src/a.ts", "export function f(p: () => void) {\n  try { p(); p() } catch (e) { throw e }\n}\n"),
      ),
      block(
        "rethrow alone, declares",
        E(
          "src/a.ts",
          "export function f(p: () => number) {\n  try { const x = p(); use(x) } catch (e) { throw e }\n}\n",
        ),
      ),
      block("top level", E("src/a.ts", "try { go() } catch (e) { undo(); throw e }\n")),
      block(
        "own loop break",
        E(
          "src/a.ts",
          "export function f(p: () => boolean) {\n  try { for (;;) { if (p()) break } } catch (e) { undo(); throw e }\n}\n",
        ),
      ),
      block(
        "reads the error",
        E("src/a.ts", "export function f(p: () => void) {\n  try { p() } catch (e) { log(e); throw e }\n}\n"),
      ),
      block(
        "return in try",
        E("src/a.ts", "export function f(p: () => number) {\n  try { return p() } catch (e) { undo(); throw e }\n}\n"),
      ),
      block(
        "break leaves try",
        E(
          "src/a.ts",
          "export function f(p: () => boolean) {\n  for (;;) { try { if (p()) break } catch (e) { undo(); throw e } }\n}\n",
        ),
      ),
      block(
        "not last",
        E("src/a.ts", "export function f(p: () => void) {\n  try { p() } catch (e) { throw e; undo() }\n}\n"),
      ),
      block("no param", E("src/a.ts", "export function f(p: () => void) {\n  try { p() } catch { log() }\n}\n")),
      block(
        "finalizer unfixable",
        E(
          "src/a.ts",
          "export function f(p: () => void) {\n  try { p() } catch (e) { undo(); throw e } finally { done() }\n}\n",
        ),
      ),
      block(
        "destructured param unfixable",
        E("src/a.ts", "export function f(p: () => void) {\n  try { p() } catch ({ message }) { log(message) }\n}\n"),
      ),
      block(
        "no statement list",
        E("src/a.ts", "export function f(p: () => void) {\n  if (p) try { p() } catch (e) { undo(); throw e }\n}\n"),
      ),
      block("promise catch", E("src/a.ts", "export const f = (p: Promise<number>) => p.catch(() => 0)\n")),
      block("computed catch ignored", E("src/a.ts", "export const f = (p: Promise<number>) => p['catch'](() => 0)\n")),
      block("other member ignored", E("src/a.ts", "export const f = (p: Promise<number>) => p.then(() => 0)\n")),
      block("test path ignored", E("test/a.test.ts", "try { go() } catch (e) { log(e) }\n")),
      block(
        "attempt",
        E(
          "src/a.ts",
          "import { attempt } from '@keel/schema'\nexport const a = attempt(f)\nexport const b = attempt(f, () => T)\nexport const c = attempt(f, (_x) => T)\nexport const d = attempt(f, (x) => T)\nexport const e = attempt(f, (x) => (x instanceof RangeError ? T : undefined))\n",
        ),
      ),
      block(
        "defect in finally",
        E(
          "src/a.ts",
          "import { defect } from '@keel/schema'\nexport function f() {\n  try { g() } finally { defect('x') }\n  try { g() } finally { g(() => defect('x')) }\n}\n",
        ),
      ),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# rethrow, lines
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,9 +1,12 @@
       export async function f(p: () => Promise<void>) {
      +  let done = false
         try {
           await p()
           await p()
      -  } catch (e) {
      -    await undo()
      -    throw e
      +    done = true
      +  } finally {
      +    if (!done) {
      +      await undo()
      +    }
         }
       }
      # rethrow, one line
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,3 +1,4 @@
       export function f(p: () => void) {
      -  try { p() } catch (e) { undo(); throw e }
      +  let done = false
      +  try { p(); done = true } finally { if (!done) { undo() } }
       }
      # rethrow, indented
      3:5 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,5 +1,6 @@
       export function f(p: () => void) {
         if (p) {
      -    try { p() } catch (err) { undo(); throw err }
      +    let done = false
      +    try { p(); done = true } finally { if (!done) { undo() } }
         }
       }
      # done taken
      3:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,5 +1,6 @@
       export function f(p: () => void) {
         const done = 1
      -  try { p() } catch (e) { undo(); throw e }
      +  let done2 = false
      +  try { p(); done2 = true } finally { if (!done2) { undo() } }
         return done
       }
      # rethrow alone
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,3 +1,3 @@
       export function f(p: () => void) {
      -  try { p(); p() } catch (e) { throw e }
      +  p(); p()
       }
      # rethrow alone, declares
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      # top level
      1:1 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1,2 @@
      -try { go() } catch (e) { undo(); throw e }
      +let done = false
      +try { go(); done = true } finally { if (!done) { undo() } }
      # own loop break
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,3 +1,4 @@
       export function f(p: () => boolean) {
      -  try { for (;;) { if (p()) break } } catch (e) { undo(); throw e }
      +  let done = false
      +  try { for (;;) { if (p()) break } done = true } finally { if (!done) { undo() } }
       }
      # reads the error
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      # return in try
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      # break leaves try
      2:14 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      # not last
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      # no param
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      # finalizer unfixable
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      # destructured param unfixable
      2:3 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      # no statement list
      2:10 catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)
      # promise catch
      1:44 .catch() in app code: await it; an expected failure is attempt(fn, expect)
      # computed catch ignored

      # other member ignored

      # test path ignored

      # attempt
      2:18 attempt needs expect: (x) => x instanceof T ? E.make(data) : undefined
      3:29 expect claims every throw: test the thrown value
      4:29 expect claims every throw: test the thrown value
      5:29 expect claims every throw: test the thrown value
      # defect in finally
      3:25 defect in finally drops the throw in flight"
    `);
  });
});

describe("E1451 noThrow", () => {
  it("pins message, location, and the err() fix", () => {
    const E = (path: string, src: string): string => only("E1451", path, src);
    const out = [
      block(
        "KeelError in a Result function",
        E(
          "src/a.ts",
          `${RES}export function f(n: number): Result<number, KeelError<'m.neg', null>> {\n  if (n < 0) throw neg\n  return ok(n)\n}\n`,
        ),
      ),
      block(
        "async Promise of a Result",
        E(
          "src/a.ts",
          `${RES}export async function f(n: number): Promise<Result<number, KeelError<'m.neg', null>>> {\n  if (n < 0) throw neg\n  return ok(n)\n}\n`,
        ),
      ),
      block(
        "inside a try with a catch",
        E(
          "src/a.ts",
          `${RES}export function f(n: number): Result<number, KeelError<'m.neg', null>> {\n  try { if (n < 0) throw neg } catch { g() }\n  return ok(n)\n}\n`,
        ),
      ),
      block(
        "an Error in a Result function",
        E(
          "src/a.ts",
          `${RES}export function f(n: number): Result<number, KeelError<'m.neg', null>> {\n  if (n < 0) throw new Error('neg')\n  return ok(n)\n}\n`,
        ),
      ),
      block(
        "a number function",
        E("src/a.ts", `${RES}export function f(n: number): number {\n  if (n < 0) throw neg\n  return n\n}\n`),
      ),
      block(
        "rethrow of the catch binding",
        E("src/a.ts", "export function f() {\n  try { g() } catch (e) { throw e }\n}\n"),
      ),
      block(
        "rethrow in a nested function",
        E("src/a.ts", "export function f() {\n  try { g() } catch (e) { h(() => { throw e }) }\n}\n"),
      ),
      block(
        "promises",
        E(
          "src/a.ts",
          "export const a = Promise.reject(1)\nexport const b = new Promise((res, rej) => rej(1))\nexport const c = new Promise(start)\nexport const d = new Promise((res) => res(1))\n",
        ),
      ),
      block("top level has no fix", E("src/a.ts", "throw new Error('x')\n")),
      block("test file exempt", E("test/a.test.ts", "throw new Error('x')\n")),
      block("config exempt", E("vite.config.ts", "throw new Error('x')\n")),
      block("unsafe dir read", E("src/unsafe/a.ts", "throw new Error('x')\n")),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# KeelError in a Result function
      4:14 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,6 +1,6 @@
      -import { ok, type KeelError, type Result } from '@keel/schema'
      +import { ok, type KeelError, type Result, err } from '@keel/schema'
       declare const neg: KeelError<'m.neg', null>
       export function f(n: number): Result<number, KeelError<'m.neg', null>> {
      -  if (n < 0) throw neg
      +  if (n < 0) return err(neg)
         return ok(n)
       }
      # async Promise of a Result
      4:14 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,6 +1,6 @@
      -import { ok, type KeelError, type Result } from '@keel/schema'
      +import { ok, type KeelError, type Result, err } from '@keel/schema'
       declare const neg: KeelError<'m.neg', null>
       export async function f(n: number): Promise<Result<number, KeelError<'m.neg', null>>> {
      -  if (n < 0) throw neg
      +  if (n < 0) return err(neg)
         return ok(n)
       }
      # inside a try with a catch
      4:20 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')
      # an Error in a Result function
      4:14 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')
      # a number function
      4:14 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')
      # rethrow of the catch binding

      # rethrow in a nested function
      2:37 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')
      # promises
      1:26 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')
      2:36 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')
      3:30 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')
      # top level has no fix
      1:1 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')
      # test file exempt

      # config exempt

      # unsafe dir read
      1:1 throw in app code: return err(E.make(data)) if a caller handles it, else defect('text')"
    `);
  });
});

describe("E1601 noAmbientCapability", () => {
  const E = (path: string, src: string): string => only("E1601", path, src);
  it("pins each ambient use with its message and fix", () => {
    const out = [
      block("now", E("src/a.ts", `export const t = () => ${NOW}()\n`)),
      block("now with arg", E("src/a.ts", `export const t = () => ${NOW}(1)\n`)),
      block("random", E("src/a.ts", `export const t = () => ${RANDOM}()\n`)),
      block("randomUUID", E("src/a.ts", "export const t = () => crypto.randomUUID()\n")),
      block("new Date()", E("src/a.ts", "export const t = () => new Date()\n")),
      block("new Date(x) ok", E("src/a.ts", "export const t = (x: number) => new Date(x)\n")),
      block("Date()", E("src/a.ts", "export const t = () => Date()\n")),
      block("fetch", E("src/a.ts", "export const t = () => fetch('/x', { method: 'POST' })\n")),
      block("window.fetch", E("src/a.ts", "export const t = () => window.fetch('/x')\n")),
      block("globalThis.fetch", E("src/a.ts", "export const t = () => globalThis.fetch('/x')\n")),
      block("fetch reference", E("src/a.ts", "export const t = window.fetch\n")),
      block("localStorage.getItem", E("src/a.ts", "export const t = () => localStorage.getItem('k')\n")),
      block("localStorage.setItem", E("src/a.ts", "export const t = () => localStorage.setItem('k', 'v')\n")),
      block("localStorage.clear", E("src/a.ts", "export const t = () => localStorage.clear()\n")),
      block("window.localStorage", E("src/a.ts", "export const t = () => window.localStorage\n")),
      block("globalThis.localStorage", E("src/a.ts", "export const t = () => globalThis.localStorage\n")),
      block("Date.now reference", E("src/a.ts", `export const t = ${NOW}\n`)),
      block("Math.floor ok", E("src/a.ts", "export const t = () => Math.floor(1)\n")),
      block("computed ok", E("src/a.ts", "export const t = () => Date['now']()\n")),
      block("other object ok", E("src/a.ts", "export const t = (o: { now(): number }) => o.now()\n")),
      block(
        "non-identifier object ok",
        E("src/a.ts", "export const t = (o: { Date: { now(): number } }) => o.Date.now()\n"),
      ),
      block(
        "declared name shadows",
        E("src/a.ts", "const Date = { now: () => 1 }\nexport const t = () => Date.now()\n"),
      ),
      block("declared fetch", E("src/a.ts", "import { fetch } from './net.ts'\nexport const t = () => fetch('/x')\n")),
      block("declared Date new", E("src/a.ts", "import { Date } from './d.ts'\nexport const t = () => new Date()\n")),
      block("declared Date call", E("src/a.ts", "import { Date } from './d.ts'\nexport const t = () => Date()\n")),
      block("new Foo", E("src/a.ts", "export const t = () => new Foo()\n")),
      block("new ns.Date", E("src/a.ts", "export const t = () => new ns.Date()\n")),
      block("test path", E("test/a.test.ts", `export const t = () => ${NOW}()\n`)),
      block("config path exempt", E("vite.config.ts", `export const t = () => ${NOW}()\n`)),
      block("two on a line", E("src/a.ts", `export const t = () => [${NOW}(), ${RANDOM}()]\n`)),
      block("long what is clipped", E("src/a.ts", "export const t = () => localStorage.removeItem('k')\n")),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# now
      1:24 Date.now() outside ctx; use ctx.clock.now()
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => Date.now()
      +export const t = () => ctx.clock.now()
      # now with arg
      1:24 Date.now outside ctx; use the ctx capability
      # random
      1:24 Math.random() outside ctx; use ctx.random.float()
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => Math.random()
      +export const t = () => ctx.random.float()
      # randomUUID
      1:24 crypto.randomUUID outside ctx; use ctx.random.id(brand)
      # new Date()
      1:24 new Date() outside ctx; use new Date(ctx.clock.now())
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => new Date()
      +export const t = () => new Date(ctx.clock.now())
      # new Date(x) ok

      # Date()
      1:24 Date() outside ctx; use the ctx capability
      # fetch
      1:24 fetch outside ctx; use ctx.net.fetch
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => fetch('/x', { method: 'POST' })
      +export const t = () => ctx.net.fetch('/x', { method: 'POST' })
      # window.fetch
      1:24 window.fetch outside ctx; use ctx.net.fetch
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => window.fetch('/x')
      +export const t = () => ctx.net.fetch('/x')
      # globalThis.fetch
      1:24 globalThis.fetch outside ctx; use ctx.net.fetch
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => globalThis.fetch('/x')
      +export const t = () => ctx.net.fetch('/x')
      # fetch reference
      1:18 window.fetch outside ctx; use the ctx capability
      # localStorage.getItem
      1:24 localStorage.getItem outside ctx; use ctx.storage.get
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => localStorage.getItem('k')
      +export const t = () => ctx.storage.get('k')
      # localStorage.setItem
      1:24 localStorage.setItem outside ctx; use ctx.storage.set
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => localStorage.setItem('k', 'v')
      +export const t = () => ctx.storage.set('k', 'v')
      # localStorage.clear
      1:24 localStorage outside ctx; use the ctx capability
      # window.localStorage
      1:24 window.localStorage outside ctx; use the ctx capability
      # globalThis.localStorage
      1:24 globalThis.localStorage outside ctx; use the ctx capability
      # Date.now reference
      1:18 Date.now outside ctx; use the ctx capability
      # Math.floor ok

      # computed ok
      1:24 Date.now() outside ctx; use ctx.clock.now()
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => Date['now']()
      +export const t = () => ctx.clock.now()
      # other object ok

      # non-identifier object ok

      # declared name shadows

      # declared fetch

      # declared Date new

      # declared Date call

      # new Foo

      # new ns.Date

      # test path
      1:24 Date.now() outside ctx; use ctx.clock.now()
      --- a/test/a.test.ts
      +++ b/test/a.test.ts
      @@ -1 +1 @@
      -export const t = () => Date.now()
      +export const t = () => ctx.clock.now()
      # config path exempt

      # two on a line
      1:25 Date.now() outside ctx; use ctx.clock.now()
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => [Date.now(), Math.random()]
      +export const t = () => [ctx.clock.now(), Math.random()]
      1:37 Math.random() outside ctx; use ctx.random.float()
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const t = () => [Date.now(), Math.random()]
      +export const t = () => [Date.now(), ctx.random.float()]
      # long what is clipped
      1:24 localStorage outside ctx; use the ctx capability"
    `);
  });
});

describe("E1302 pureTransaction", () => {
  const E = (path: string, src: string): string => only("E1302", path, src);
  it("pins each impure read", () => {
    const head = "import { transaction } from '@keel/store'\n";
    const out = [
      block(
        "ctx",
        E(
          "src/a.ts",
          `${head}export const a = transaction(cart, 'cart.add', Item, (state, p) => ({ ...state, at: ctx.clock.now() }))\n`,
        ),
      ),
      block(
        "Date",
        E(
          "src/a.ts",
          `${head}export const a = transaction(cart, 'cart.add', Item, (state) => ({ ...state, at: ${NOW}() }))\n`,
        ),
      ),
      block(
        "random",
        E(
          "src/a.ts",
          `${head}export const a = transaction(cart, 'cart.add', Item, (state) => ({ ...state, r: ${RANDOM}() }))\n`,
        ),
      ),
      block(
        "Math.floor ok",
        E(
          "src/a.ts",
          `${head}export const a = transaction(cart, 'cart.add', Item, (state) => ({ ...state, r: Math.floor(1) }))\n`,
        ),
      ),
      block(
        "computed random ok",
        E(
          "src/a.ts",
          `${head}export const a = transaction(cart, 'cart.add', Item, (state) => ({ ...state, r: Math['random']() }))\n`,
        ),
      ),
      block(
        "function expression",
        E(
          "src/a.ts",
          `${head}export const a = transaction(cart, 'cart.add', Item, function (state) { return console.log(state) })\n`,
        ),
      ),
      block(
        "non-literal label",
        E("src/a.ts", `${head}export const a = transaction(cart, name, Item, (state) => performance.now())\n`),
      ),
      block(
        "aliased import",
        E(
          "src/a.ts",
          "import { transaction as tx2 } from '@keel/store'\nexport const a = tx2(cart, 'cart.add', Item, (state) => document.title)\n",
        ),
      ),
      block(
        "other module import",
        E(
          "src/a.ts",
          "import { transaction } from './other.ts'\nexport const a = transaction(cart, 'cart.add', Item, (state) => document.title)\n",
        ),
      ),
      block(
        "non-specifier import",
        E(
          "src/a.ts",
          "import transaction from '@keel/store'\nexport const a = transaction(cart, 'cart.add', Item, (state) => document.title)\n",
        ),
      ),
      block(
        "string-named import",
        E(
          "src/a.ts",
          "import { 'transaction' as t3 } from '@keel/store'\nexport const a = t3(cart, 'cart.add', Item, (state) => document.title)\n",
        ),
      ),
      block(
        "other import name",
        E(
          "src/a.ts",
          "import { store } from '@keel/store'\nexport const a = transaction(cart, 'cart.add', Item, (state) => document.title)\n",
        ),
      ),
      block(
        "not a call of tx",
        E("src/a.ts", `${head}export const a = other(cart, 'cart.add', Item, (state) => document.title)\n`),
      ),
      block(
        "member callee",
        E("src/a.ts", `${head}export const a = x.transaction(cart, 'cart.add', Item, (state) => document.title)\n`),
      ),
      block(
        "fn not last",
        E("src/a.ts", `${head}export const a = transaction(cart, 'cart.add', (state) => document.title, Item)\n`),
      ),
      block(
        "outside the fn",
        E(
          "src/a.ts",
          `${head}const k = document.title\nexport const a = transaction(cart, 'cart.add', Item, (state) => state)\n`,
        ),
      ),
      block(
        "declared locally",
        E(
          "src/a.ts",
          `${head}export const a = transaction(cart, 'cart.add', Item, (state) => { const window = 1; return window })\n`,
        ),
      ),
      block(
        "two txs",
        E(
          "src/a.ts",
          `${head}export const a = transaction(cart, 'cart.add', Item, (s) => window)\nexport const b = transaction(cart, 'cart.rm', Item, (s) => self)\n`,
        ),
      ),
      block(
        "each global",
        E(
          "src/a.ts",
          `${head}export const a = transaction(cart, 'cart.add', Item, (s) => [globalThis, localStorage, sessionStorage, navigator, location, fetch, process, setTimeout, setInterval, queueMicrotask, requestAnimationFrame, crypto])\n`,
        ),
      ),
      block(
        "test path",
        E("test/a.test.ts", `${head}export const a = transaction(cart, 'cart.add', Item, (s) => window)\n`),
      ),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# ctx
      2:85 transaction cart.add reads ctx; transaction functions are pure
      # Date
      2:82 transaction cart.add reads Date; transaction functions are pure
      # random
      2:81 transaction cart.add reads Math.random; transaction functions are pure
      # Math.floor ok

      # computed random ok

      # function expression
      2:80 transaction cart.add reads console; transaction functions are pure
      # non-literal label
      2:59 transaction ? reads performance; transaction functions are pure
      # aliased import
      2:57 transaction cart.add reads document; transaction functions are pure
      # other module import

      # non-specifier import

      # string-named import
      2:56 transaction cart.add reads document; transaction functions are pure
      # other import name

      # not a call of tx

      # member callee

      # fn not last

      # outside the fn

      # declared locally

      # two txs
      2:61 transaction cart.add reads window; transaction functions are pure
      3:60 transaction cart.rm reads self; transaction functions are pure
      # each global
      2:62 transaction cart.add reads globalThis; transaction functions are pure
      2:74 transaction cart.add reads localStorage; transaction functions are pure
      2:88 transaction cart.add reads sessionStorage; transaction functions are pure
      2:104 transaction cart.add reads navigator; transaction functions are pure
      2:115 transaction cart.add reads location; transaction functions are pure
      2:125 transaction cart.add reads fetch; transaction functions are pure
      2:132 transaction cart.add reads process; transaction functions are pure
      2:141 transaction cart.add reads setTimeout; transaction functions are pure
      2:153 transaction cart.add reads setInterval; transaction functions are pure
      2:166 transaction cart.add reads queueMicrotask; transaction functions are pure
      2:182 transaction cart.add reads requestAnimationFrame; transaction functions are pure
      2:205 transaction cart.add reads crypto; transaction functions are pure
      # test path
      "
    `);
  });
});

describe("E1752 oneExport", () => {
  const E = (path: string, src: string): string => only("E1752", path, src);
  it("pins every shape of export", () => {
    const out = [
      block("two", E("src/a.ts", "export const a = 1\nexport const b = 2\n")),
      block("three, second reported", E("src/a.ts", "export const a = 1\nexport function b() {}\nexport class c {}\n")),
      block("same name twice is one", E("src/a.ts", "export const a = 1\nexport { a as a }\n")),
      block("wrong name", E("src/a.ts", "export const b = 2\n")),
      block("function name", E("src/a.ts", "export function b() {}\n")),
      block("class name", E("src/a.ts", "export class b {}\n")),
      block("destructured ignored", E("src/a.ts", "export const { b } = o\n")),
      block("right name", E("src/a.ts", "export const a = 1\n")),
      block("type alias wrong", E("src/a.ts", "export type b = number\n")),
      block("interface wrong", E("src/a.ts", "export interface b { x: 1 }\n")),
      block("default ok", E("src/a.ts", "export default function b() {}\n")),
      block("default anon ok", E("src/a.ts", "export default () => 1\n")),
      block("default class ok", E("src/a.ts", "export default class B {}\n")),
      block("default ident + named", E("src/a.ts", "const z = 1\nexport default z\nexport const y = 2\n")),
      block("default plus a", E("src/a.ts", "export default 1\nexport const a = 2\n")),
      block("export assignment", E("src/a.ts", "export = 1\n")),
      block("specifier names", E("src/a.ts", "const x = 1\nconst y = 2\nexport { x, y }\n")),
      block("specifier string name", E("src/a.ts", "const x = 1\nexport { x as 'b' }\n")),
      block("reexport", E("src/a.ts", "export { x } from './x.ts'\n")),
      block("reexport all", E("src/a.ts", "export * from './x.ts'\n")),
      block("reexport in types/", E("src/types/a.ts", "export { x } from './x.ts'\n")),
      block("reexport in nested types/", E("src/x/types/a.ts", "export { x } from './x.ts'\n")),
      block("reexport in notypes/", E("src/notypes/a.ts", "export { x } from './x.ts'\n")),
      block("reexport in index", E("src/index.ts", "export { x } from './x.ts'\n")),
      block("index.d? no, index stem with two", E("src/index.test.ts", "export const a = 1\nexport const b = 2\n")),
      block(
        "component extras",
        E("src/A.tsx", "export const Props = 1\nexport const uses = []\nexport default function A() {}\n"),
      ),
      block(
        "component extras plus another",
        E("src/A.tsx", "export const Props = 1\nexport const other = []\nexport default function A() {}\n"),
      ),
      block("jsx component extras", E("src/A.jsx", "export const Props = 1\nexport default function A() {}\n")),
      block("tsx without default", E("src/A.tsx", "export const Props = 1\nexport const A = 2\n")),
      block("ts with default and Props", E("src/a.ts", "export const Props = 1\nexport default function a() {}\n")),
      block("server ok", E("src/addItem.server.ts", "export const loader = 1\nexport const action = 2\n")),
      block("server other", E("src/addItem.server.ts", "export const loader = 1\nexport const other = 2\n")),
      block("server mjs", E("src/addItem.server.mjs", "export const loader = 1\nexport const action = 2\n")),
      block("server not .server", E("src/addItem.servers.ts", "export const loader = 1\nexport const action = 2\n")),
      block("stem with dots", E("src/addItem.schema.ts", "export const addItem = 1\nexport type addItem = number\n")),
      block("no exports", E("src/a.ts", "const a = 1\n")),
      block("test path", E("test/a.test.ts", "export const a = 1\nexport const b = 2\n")),
      block(
        "long names clipped",
        E("src/a.ts", `export const ${"x".repeat(40)} = 1\nexport const ${"y".repeat(40)} = 2\n`),
      ),
      block("long name clipped", E("src/a.ts", `export const ${"x".repeat(100)} = 1\n`)),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# two
      2:1 2 exports in one file (a, b); one export per file
      # three, second reported
      2:1 3 exports in one file (a, b, c); one export per file
      # same name twice is one

      # wrong name
      1:1 file a exports b; filename must equal its export
      # function name
      1:1 file a exports b; filename must equal its export
      # class name
      1:1 file a exports b; filename must equal its export
      # destructured ignored

      # right name

      # type alias wrong
      1:1 file a exports b; filename must equal its export
      # interface wrong
      1:1 file a exports b; filename must equal its export
      # default ok
      1:1 file a exports b; filename must equal its export
      # default anon ok

      # default class ok
      1:1 file a exports B; filename must equal its export
      # default ident + named
      3:1 2 exports in one file (z, y); one export per file
      # default plus a
      2:1 2 exports in one file (default, a); one export per file
      # export assignment

      # specifier names
      3:1 2 exports in one file (x, y); one export per file
      # specifier string name
      2:1 file a exports b; filename must equal its export
      # reexport
      1:1 re-export outside index.ts; import from the source file
      # reexport all
      1:1 re-export outside index.ts; import from the source file
      # reexport in types/
      1:1 file a exports x; filename must equal its export
      # reexport in nested types/
      1:1 file a exports x; filename must equal its export
      # reexport in notypes/
      1:1 re-export outside index.ts; import from the source file
      # reexport in index

      # index.d? no, index stem with two

      # component extras

      # component extras plus another
      3:1 2 exports in one file (other, A); one export per file
      # jsx component extras

      # tsx without default
      2:1 2 exports in one file (Props, A); one export per file
      # ts with default and Props
      2:1 2 exports in one file (Props, a); one export per file
      # server ok

      # server other
      2:1 2 exports in one file (loader, other); one export per file
      # server mjs

      # server not .server
      2:1 2 exports in one file (loader, action); one export per file
      # stem with dots

      # no exports

      # test path

      # long names clipped
      2:1 2 exports in one file (xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx, yyyyyyyyyyyyyyyyyyyyy...
      # long name clipped
      1:1 file a exports xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..."
    `);
  });
});

describe("E1757 noUnsafeSyntax", () => {
  const E = (path: string, src: string): string => only("E1757", path, src);
  it("pins casts, assertions, any, and suppression comments with fixes", () => {
    const out = [
      block("as", E("src/a.ts", `export const a = (x: unknown) => x ${AS} string\n`)),
      block("as const ok", E("src/a.ts", `export const a = [1] ${AS} const\n`)),
      block("as Const type ref ok? no, other ref", E("src/a.ts", `export const a = (x: unknown) => x ${AS} Const\n`)),
      block("as qualified", E("src/a.ts", `export const a = (x: unknown) => x ${AS} ns.const\n`)),
      block("angle", E("src/a.ts", "export const a = (x: unknown) => <string>x\n")),
      block("nonnull", E("src/a.ts", "export const a = (x: string | null) => x!.length\n")),
      block("any", E("src/a.ts", "export const a = (x: any) => x\n")),
      block("any generic", E("src/a.ts", "export const a: Array<any> = []\n")),
      block("suppress alone", E("src/a.ts", "// @ts-ignore\nexport const a = 1\n")),
      block(
        "suppress alone indented",
        E("src/a.ts", "export function f() {\n  // @ts-expect-error because\n  return 1\n}\n"),
      ),
      block("suppress trailing", E("src/a.ts", "export const a = 1 // @ts-nocheck\n")),
      block("suppress trailing tab", E("src/a.ts", "export const a = 1\t\t// @ts-ignore\nexport const b = 2\n")),
      block("suppress block", E("src/a.ts", "/* @ts-ignore */\nexport const a = 1\n")),
      block("suppress block mid line", E("src/a.ts", "export const a = /* @ts-ignore */ 1\n")),
      block("suppress last line no newline", E("src/a.ts", "export const a = 1\n// @ts-ignore")),
      block("comment before code same line", E("src/a.ts", "/* @ts-ignore */ export const a = 1\n")),
      block("other comment ok", E("src/a.ts", "// @ts-ignored\n// ts-ignore\nexport const a = 1\n")),
      block(
        "quoted directive ok",
        E("src/a.ts", "// see @ts-ignore here\n/* the `@ts-expect-error` form */\nexport const a = 1\n"),
      ),
      block("suppress word boundary", E("src/a.ts", "// @ts-ignore-ish\nexport const a = 1\n")),
      block("suppress jsdoc line", E("src/a.ts", "/**\n * @ts-nocheck\n */\nexport const a = 1\n")),
      block(
        "mixed sorted",
        E(
          "src/a.ts",
          `export const a = (x: any) => x ${AS} string // @ts-ignore\nexport const b = (x: string | null) => x!\n`,
        ),
      ),
      block("js file", E("src/a.js", "// @ts-ignore\nexport const a = 1\n")),
      block("tsx", E("src/a.tsx", `export const a = (x: unknown) => x ${AS} string\n`)),
      block("mts", E("src/a.mts", `export const a = (x: unknown) => x ${AS} string\n`)),
      block("unsafe dir read", E("src/unsafe/a.ts", `export const a = (x: unknown) => x ${AS} string\n`)),
      block("nested unsafe dir read", E("src/x/unsafe/a.ts", `export const a = (x: unknown) => x ${AS} string\n`)),
      block("notunsafe dir", E("src/notunsafe/a.ts", `export const a = (x: unknown) => x ${AS} string\n`)),
      block("keel dir", E(".keel/a.ts", `export const a = (x: unknown) => x ${AS} string\n`)),
      block("node_modules", E("node_modules/p/a.ts", `export const a = (x: unknown) => x ${AS} string\n`)),
      block("test file still checked", E("test/a.test.ts", `export const a = (x: unknown) => x ${AS} string\n`)),
      block("d.ts", E("src/a.d.ts", "export declare const a: any\n")),
      block("json", E("src/a.json", "{}")),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# as
      1:34 type cast outside unsafe/; use a guard or move it to unsafe/
      # as const ok

      # as Const type ref ok? no, other ref
      1:34 type cast outside unsafe/; use a guard or move it to unsafe/
      # as qualified
      1:34 type cast outside unsafe/; use a guard or move it to unsafe/
      # angle
      1:34 type cast outside unsafe/; use a guard or move it to unsafe/
      # nonnull
      1:40 non-null assertion outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const a = (x: string | null) => x!.length
      +export const a = (x: string | null) => x.length
      # any
      1:22 any outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const a = (x: any) => x
      +export const a = (x: unknown) => x
      # any generic
      1:23 any outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const a: Array<any> = []
      +export const a: Array<unknown> = []
      # suppress alone
      1:1 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,2 +1 @@
      -// @ts-ignore
       export const a = 1
      # suppress alone indented
      2:3 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,4 +1,3 @@
       export function f() {
      -  // @ts-expect-error because
         return 1
       }
      # suppress trailing
      1:20 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const a = 1 // @ts-nocheck
      +export const a = 1
      # suppress trailing tab
      1:21 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,2 +1,2 @@
      -export const a = 1		// @ts-ignore
      +export const a = 1
       export const b = 2
      # suppress block
      1:1 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,2 +1 @@
      -/* @ts-ignore */
       export const a = 1
      # suppress block mid line
      1:18 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -export const a = /* @ts-ignore */ 1
      +export const a = 1
      # suppress last line no newline
      2:1 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,2 +1 @@
       export const a = 1
      -// @ts-ignore
      \\ No newline at end of file
      # comment before code same line
      1:1 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1 +1 @@
      -/* @ts-ignore */ export const a = 1
      + export const a = 1
      # other comment ok

      # quoted directive ok

      # suppress word boundary
      1:1 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,2 +1 @@
      -// @ts-ignore-ish
       export const a = 1
      # suppress jsdoc line
      1:1 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,4 +1 @@
      -/**
      - * @ts-nocheck
      - */
       export const a = 1
      # mixed sorted
      1:22 any outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,2 +1,2 @@
      -export const a = (x: any) => x as string // @ts-ignore
      +export const a = (x: unknown) => x as string // @ts-ignore
       export const b = (x: string | null) => x!
      1:30 type cast outside unsafe/; use a guard or move it to unsafe/
      1:42 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,2 +1,2 @@
      -export const a = (x: any) => x as string // @ts-ignore
      +export const a = (x: any) => x as string
       export const b = (x: string | null) => x!
      2:40 non-null assertion outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.ts
      +++ b/src/a.ts
      @@ -1,2 +1,2 @@
       export const a = (x: any) => x as string // @ts-ignore
      -export const b = (x: string | null) => x!
      +export const b = (x: string | null) => x
      # js file
      1:1 ts suppression comment outside unsafe/; use a guard or move it to unsafe/
      --- a/src/a.js
      +++ b/src/a.js
      @@ -1,2 +1 @@
      -// @ts-ignore
       export const a = 1
      # tsx
      1:34 type cast outside unsafe/; use a guard or move it to unsafe/
      # mts
      1:34 type cast outside unsafe/; use a guard or move it to unsafe/
      # unsafe dir read
      1:34 type cast outside an unsafe() call; use a guard or move it into the call
      # nested unsafe dir read
      1:34 type cast outside an unsafe() call; use a guard or move it into the call
      # notunsafe dir
      1:34 type cast outside unsafe/; use a guard or move it to unsafe/
      # keel dir

      # node_modules

      # test file still checked
      1:34 type cast outside unsafe/; use a guard or move it to unsafe/
      # d.ts

      # json
      "
    `);
  });
});

describe("E1805 noIntrinsicElement", () => {
  const E = (path: string, src: string): string => only("E1805", path, src);
  it("pins the drop-in fixes and the suggestions", () => {
    const wrap = (jsx: string): string => `export const A = () => ${jsx}\n`;
    const tags = [
      "div",
      "span",
      "button",
      "section",
      "nav",
      "main",
      "header",
      "footer",
      "aside",
      "article",
      "ul",
      "ol",
      "li",
      "p",
      "strong",
      "em",
      "small",
      "code",
      "pre",
      "blockquote",
      "b",
      "i",
      "h1",
      "h6",
      "h7",
      "a",
      "img",
      "input",
      "textarea",
      "select",
      "label",
      "table",
      "svg2",
    ];
    const out = [
      ...tags.map((t) => block(t, E("src/a.tsx", wrap(`<${t} id="x">hi</${t}>`)))),
      block("self closing", E("src/a.tsx", wrap('<div id="x" />'))),
      block("no attrs", E("src/a.tsx", wrap("<div>hi</div>"))),
      block("other attr no fix", E("src/a.tsx", wrap('<div className="x">hi</div>'))),
      block("id and other no fix", E("src/a.tsx", wrap('<div id="x" className="y">hi</div>'))),
      block("spread no fix", E("src/a.tsx", wrap("<div {...p}>hi</div>"))),
      block("id expr", E("src/a.tsx", wrap("<div id={x}>hi</div>"))),
      block("namespaced attr", E("src/a.tsx", wrap("<div a:id='1'>hi</div>"))),
      block("capitalized ok", E("src/a.tsx", wrap("<Box>hi</Box>"))),
      block("member ok", E("src/a.tsx", wrap("<a.b>hi</a.b>"))),
      block("dashed ok", E("src/a.tsx", wrap("<my-el>hi</my-el>"))),
      block("digit tag", E("src/a.tsx", wrap("<h1x>hi</h1x>"))),
      block("existing ui import", E("src/a.tsx", `import { Text } from '@keel/ui'\n${wrap("<div>hi</div>")}`)),
      block("existing same import", E("src/a.tsx", `import { Box } from '@keel/ui'\n${wrap("<div>hi</div>")}`)),
      block("nested", E("src/a.tsx", wrap("<div><span>x</span></div>"))),
      block("jsx ext", E("src/a.jsx", wrap("<div>hi</div>"))),
      block("ts file", E("src/a.ts", "export const a = 1\n")),
      block("test path", E("test/a.test.tsx", wrap("<div>hi</div>"))),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# div
      1:25 <div> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <div id="x">hi</div>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box id="x">hi</Box>
      # span
      1:25 <span> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <span id="x">hi</span>
      +import { Text } from "@keel/ui";
      +export const A = () => <Text id="x">hi</Text>
      # button
      1:25 <button> in app code; use <Button> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <button id="x">hi</button>
      +import { Button } from "@keel/ui";
      +export const A = () => <Button id="x">hi</Button>
      # section
      1:25 <section> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <section id="x">hi</section>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box as="section" id="x">hi</Box>
      # nav
      1:25 <nav> in app code; use <Box> from @keel/ui
      # main
      1:25 <main> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <main id="x">hi</main>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box as="main" id="x">hi</Box>
      # header
      1:25 <header> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <header id="x">hi</header>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box as="header" id="x">hi</Box>
      # footer
      1:25 <footer> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <footer id="x">hi</footer>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box as="footer" id="x">hi</Box>
      # aside
      1:25 <aside> in app code; use <Box> from @keel/ui
      # article
      1:25 <article> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <article id="x">hi</article>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box as="article" id="x">hi</Box>
      # ul
      1:25 <ul> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <ul id="x">hi</ul>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box as="ul" id="x">hi</Box>
      # ol
      1:25 <ol> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <ol id="x">hi</ol>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box as="ol" id="x">hi</Box>
      # li
      1:25 <li> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <li id="x">hi</li>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box as="li" id="x">hi</Box>
      # p
      1:25 <p> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <p id="x">hi</p>
      +import { Text } from "@keel/ui";
      +export const A = () => <Text as="p" id="x">hi</Text>
      # strong
      1:25 <strong> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <strong id="x">hi</strong>
      +import { Text } from "@keel/ui";
      +export const A = () => <Text as="strong" id="x">hi</Text>
      # em
      1:25 <em> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <em id="x">hi</em>
      +import { Text } from "@keel/ui";
      +export const A = () => <Text as="em" id="x">hi</Text>
      # small
      1:25 <small> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <small id="x">hi</small>
      +import { Text } from "@keel/ui";
      +export const A = () => <Text as="small" id="x">hi</Text>
      # code
      1:25 <code> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <code id="x">hi</code>
      +import { Text } from "@keel/ui";
      +export const A = () => <Text as="code" id="x">hi</Text>
      # pre
      1:25 <pre> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <pre id="x">hi</pre>
      +import { Text } from "@keel/ui";
      +export const A = () => <Text as="pre" id="x">hi</Text>
      # blockquote
      1:25 <blockquote> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <blockquote id="x">hi</blockquote>
      +import { Text } from "@keel/ui";
      +export const A = () => <Text as="blockquote" id="x">hi</Text>
      # b
      1:25 <b> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <b id="x">hi</b>
      +import { Text } from "@keel/ui";
      +export const A = () => <Text as="strong" id="x">hi</Text>
      # i
      1:25 <i> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <i id="x">hi</i>
      +import { Text } from "@keel/ui";
      +export const A = () => <Text as="em" id="x">hi</Text>
      # h1
      1:25 <h1> in app code; use <Heading> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <h1 id="x">hi</h1>
      +import { Heading } from "@keel/ui";
      +export const A = () => <Heading level={1} id="x">hi</Heading>
      # h6
      1:25 <h6> in app code; use <Heading> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <h6 id="x">hi</h6>
      +import { Heading } from "@keel/ui";
      +export const A = () => <Heading level={6} id="x">hi</Heading>
      # h7
      1:25 <h7> in app code; use <Box> from @keel/ui
      # a
      1:25 <a> in app code; use <Link> from @keel/ui
      # img
      1:25 <img> in app code; use <Image> from @keel/ui
      # input
      1:25 <input> in app code; use <Input> from @keel/ui
      # textarea
      1:25 <textarea> in app code; use <TextArea> from @keel/ui
      # select
      1:25 <select> in app code; use <Select> from @keel/ui
      # label
      1:25 <label> in app code; use <Input> from @keel/ui
      # table
      1:25 <table> in app code; use <Box> from @keel/ui
      # svg2
      1:25 <svg2> in app code; use <Box> from @keel/ui
      # self closing
      1:25 <div> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <div id="x" />
      +import { Box } from "@keel/ui";
      +export const A = () => <Box id="x" />
      # no attrs
      1:25 <div> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <div>hi</div>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box>hi</Box>
      # other attr no fix
      1:25 <div> in app code; use <Box> from @keel/ui
      # id and other no fix
      1:25 <div> in app code; use <Box> from @keel/ui
      # spread no fix
      1:25 <div> in app code; use <Box> from @keel/ui
      # id expr
      1:25 <div> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <div id={x}>hi</div>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box id={x}>hi</Box>
      # namespaced attr
      1:25 <div> in app code; use <Box> from @keel/ui
      # capitalized ok

      # member ok

      # dashed ok

      # digit tag
      1:25 <h1x> in app code; use <Box> from @keel/ui
      # existing ui import
      2:25 <div> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1,2 +1,2 @@
      -import { Text } from '@keel/ui'
      -export const A = () => <div>hi</div>
      +import { Text, Box } from '@keel/ui'
      +export const A = () => <Box>hi</Box>
      # existing same import
      2:25 <div> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1,2 +1,2 @@
       import { Box } from '@keel/ui'
      -export const A = () => <div>hi</div>
      +export const A = () => <Box>hi</Box>
      # nested
      1:25 <div> in app code; use <Box> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <div><span>x</span></div>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box><span>x</span></Box>
      1:30 <span> in app code; use <Text> from @keel/ui
      --- a/src/a.tsx
      +++ b/src/a.tsx
      @@ -1 +1,2 @@
      -export const A = () => <div><span>x</span></div>
      +import { Text } from "@keel/ui";
      +export const A = () => <div><Text>x</Text></div>
      # jsx ext
      1:25 <div> in app code; use <Box> from @keel/ui
      --- a/src/a.jsx
      +++ b/src/a.jsx
      @@ -1 +1,2 @@
      -export const A = () => <div>hi</div>
      +import { Box } from "@keel/ui";
      +export const A = () => <Box>hi</Box>
      # ts file

      # test path
      "
    `);
  });
});

describe("E1803 / E1701 / E1104 / E1754", () => {
  it("pins inline style", () => {
    const E = (path: string, src: string): string => only("E1803", path, src);
    const out = [
      block("attr", E("src/a.tsx", "export const A = () => <Box style={{ x: 1 }}>x</Box>\n")),
      block("data-style ok", E("src/a.tsx", 'export const A = () => <Box data-style="x">x</Box>\n')),
      block("namespaced ok", E("src/a.tsx", 'export const A = () => <Box a:style="x">x</Box>\n')),
      block("test path", E("test/a.test.tsx", "export const A = () => <Box style={{ x: 1 }}>x</Box>\n")),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# attr
      1:29 style attribute; use token style props
      # data-style ok

      # namespaced ok

      # test path
      "
    `);
  });

  it("pins DOM queries in tests", () => {
    const E = (path: string, src: string): string => only("E1701", path, src);
    const names = [
      "querySelector",
      "querySelectorAll",
      "getElementById",
      "getElementsByClassName",
      "getElementsByTagName",
      "getElementsByName",
      "container",
      "getByText",
      "getAllByRole",
      "queryByX",
      "queryAllByX",
      "findByX",
      "findAllByX",
      "getBy",
      "getby",
      "getByx",
      "find",
      "findBy2",
      "xgetByText",
      "getByText2",
    ];
    const out = [
      ...names.map((n) => block(`member ${n}`, E("test/a.test.ts", `t.${n}('x')\n`))),
      ...names.map((n) => block(`bare ${n}`, E("test/a.test.ts", `${n}('x')\n`))),
      block("computed ok", E("test/a.test.ts", "t['querySelector']('x')\n")),
      block("non test", E("src/a.ts", "t.querySelector('x')\n")),
      block("spec path", E("src/a.spec.ts", "t.querySelector('x')\n")),
      block("conformance path", E("pkg/conformance/a.ts", "t.querySelector('x')\n")),
      block("tests path", E("tests/a.ts", "t.querySelector('x')\n")),
      block("__tests__ path", E("src/__tests__/a.ts", "t.querySelector('x')\n")),
      block("not tests path", E("src/mytest/a.ts", "t.querySelector('x')\n")),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# member querySelector
      1:3 DOM query querySelector in a test; address elements by id with find(id)
      # member querySelectorAll
      1:3 DOM query querySelectorAll in a test; address elements by id with find(id)
      # member getElementById
      1:3 DOM query getElementById in a test; address elements by id with find(id)
      # member getElementsByClassName
      1:3 DOM query getElementsByClassName in a test; address elements by id with find(id)
      # member getElementsByTagName
      1:3 DOM query getElementsByTagName in a test; address elements by id with find(id)
      # member getElementsByName
      1:3 DOM query getElementsByName in a test; address elements by id with find(id)
      # member container
      1:3 DOM query container in a test; address elements by id with find(id)
      # member getByText
      1:3 DOM query getByText in a test; address elements by id with find(id)
      # member getAllByRole
      1:3 DOM query getAllByRole in a test; address elements by id with find(id)
      # member queryByX
      1:3 DOM query queryByX in a test; address elements by id with find(id)
      # member queryAllByX
      1:3 DOM query queryAllByX in a test; address elements by id with find(id)
      # member findByX
      1:3 DOM query findByX in a test; address elements by id with find(id)
      # member findAllByX
      1:3 DOM query findAllByX in a test; address elements by id with find(id)
      # member getBy

      # member getby

      # member getByx

      # member find

      # member findBy2

      # member xgetByText

      # member getByText2
      1:3 DOM query getByText2 in a test; address elements by id with find(id)
      # bare querySelector

      # bare querySelectorAll

      # bare getElementById

      # bare getElementsByClassName

      # bare getElementsByTagName

      # bare getElementsByName

      # bare container

      # bare getByText
      1:1 DOM query getByText in a test; address elements by id with find(id)
      # bare getAllByRole
      1:1 DOM query getAllByRole in a test; address elements by id with find(id)
      # bare queryByX
      1:1 DOM query queryByX in a test; address elements by id with find(id)
      # bare queryAllByX
      1:1 DOM query queryAllByX in a test; address elements by id with find(id)
      # bare findByX
      1:1 DOM query findByX in a test; address elements by id with find(id)
      # bare findAllByX
      1:1 DOM query findAllByX in a test; address elements by id with find(id)
      # bare getBy

      # bare getby

      # bare getByx

      # bare find

      # bare findBy2

      # bare xgetByText

      # bare getByText2
      1:1 DOM query getByText2 in a test; address elements by id with find(id)
      # computed ok

      # non test

      # spec path
      1:3 DOM query querySelector in a test; address elements by id with find(id)
      # conformance path
      1:3 DOM query querySelector in a test; address elements by id with find(id)
      # tests path
      1:3 DOM query querySelector in a test; address elements by id with find(id)
      # __tests__ path
      1:3 DOM query querySelector in a test; address elements by id with find(id)
      # not tests path
      "
    `);
  });

  it("pins schema declarations outside schema files", () => {
    const E = (path: string, src: string): string => only("E1104", path, src);
    const head = "import { s } from '@keel/schema'\n";
    const out = [
      block("const", E("src/a.ts", `${head}const User = s.object({})\n`)),
      block("export const", E("src/a.ts", `${head}export const User = s.object({})\n`)),
      block("chain", E("src/a.ts", `${head}const User = s.string().optional()\n`)),
      block("member only is not a schema", E("src/a.ts", `${head}const User = s.string\n`)),
      block("call of other", E("src/a.ts", `${head}const User = other.object({})\n`)),
      block("plain call", E("src/a.ts", `${head}const User = s()\n`)),
      block("literal", E("src/a.ts", `${head}const User = 1\n`)),
      block("no init", E("src/a.ts", `${head}let User\n`)),
      block("destructure", E("src/a.ts", `${head}const { User } = s.object({})\n`)),
      block("two decls", E("src/a.ts", `${head}const A = s.string(), B = s.number()\n`)),
      block("function", E("src/a.ts", `${head}function f() { const User = s.object({}) }\n`)),
      block("export function", E("src/a.ts", `${head}export function g() {}\n`)),
      block("alias", E("src/a.ts", "import { s as z } from '@keel/schema'\nconst User = z.object({})\n")),
      block(
        "string-named alias",
        E("src/a.ts", "import { 's' as z } from '@keel/schema'\nconst User = z.object({})\n"),
      ),
      block("other import name", E("src/a.ts", "import { t } from '@keel/schema'\nconst User = t.object({})\n")),
      block("other module", E("src/a.ts", "import { s } from 'zod'\nconst User = s.object({})\n")),
      block("default import", E("src/a.ts", "import s from '@keel/schema'\nconst User = s.object({})\n")),
      block("namespace import", E("src/a.ts", "import * as s from '@keel/schema'\nconst User = s.object({})\n")),
      block("no import", E("src/a.ts", "const User = s.object({})\n")),
      block("schema file", E("src/User.schema.ts", `${head}const User = s.object({})\n`)),
      block("schema mjs file", E("src/User.schema.mjs", `${head}const User = s.object({})\n`)),
      block("fake schema file", E("src/User.schemas.ts", `${head}const User = s.object({})\n`)),
      block(
        "component Props exempt",
        E(
          "src/A.tsx",
          `${head}export const Props = s.object({})\nconst Other = s.object({})\nexport default function A() {}\n`,
        ),
      ),
      block(
        "component jsx Props",
        E("src/A.jsx", `${head}export const Props = s.object({})\nexport default function A() {}\n`),
      ),
      block("ts Props not exempt", E("src/a.ts", `${head}export const Props = s.object({})\n`)),
      block("test path", E("test/a.test.ts", `${head}const User = s.object({})\n`)),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# const
      2:7 schema User declared outside a *.schema.ts file; move it there
      # export const
      2:14 schema User declared outside a *.schema.ts file; move it there
      # chain
      2:7 schema User declared outside a *.schema.ts file; move it there
      # member only is not a schema

      # call of other

      # plain call
      2:7 schema User declared outside a *.schema.ts file; move it there
      # literal

      # no init

      # destructure

      # two decls
      2:7 schema A declared outside a *.schema.ts file; move it there
      2:23 schema B declared outside a *.schema.ts file; move it there
      # function

      # export function

      # alias
      2:7 schema User declared outside a *.schema.ts file; move it there
      # string-named alias
      2:7 schema User declared outside a *.schema.ts file; move it there
      # other import name

      # other module

      # default import

      # namespace import

      # no import

      # schema file

      # schema mjs file

      # fake schema file
      2:7 schema User declared outside a *.schema.ts file; move it there
      # component Props exempt
      3:7 schema Other declared outside a *.schema.ts file; move it there
      # component jsx Props

      # ts Props not exempt
      2:14 schema Props declared outside a *.schema.ts file; move it there
      # test path
      "
    `);
  });

  it("pins unsafe() justification", () => {
    const E = (path: string, src: string): string => only("E1754", path, src);
    const U = UNSAFE;
    const out = [
      block("none", E("src/a.ts", `${U}()\n`)),
      block("fn first", E("src/a.ts", `${U}(() => 1)\n`)),
      block("empty", E("src/a.ts", `${U}('')\n`)),
      block("blank", E("src/a.ts", `${U}('   ')\n`)),
      block("reason", E("src/a.ts", `${U}('because', () => 1)\n`)),
      block("number", E("src/a.ts", `${U}(1)\n`)),
      block("template", E("src/a.ts", `${U}(\`because\`)\n`)),
      block("template empty", E("src/a.ts", `${U}(\`\`)\n`)),
      block("template blank", E("src/a.ts", `${U}(\`  \`)\n`)),
      block("template expr", E("src/a.ts", `${U}(\`a \${x}\`)\n`)),
      block("identifier", E("src/a.ts", `${U}(reason)\n`)),
      block("member", E("src/a.ts", `x.${U}()\n`)),
      block("other fn", E("src/a.ts", "safe()\n")),
      block("in unsafe dir still checked", E("src/unsafe/a.ts", `${U}()\n`)),
      block("test path", E("test/a.test.ts", `${U}()\n`)),
      block("d.ts", E("src/a.d.ts", "")),
      block("json", E("src/a.json", "")),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# none
      1:1 unsafe call needs a justification string as its first argument
      # fn first
      1:1 unsafe call needs a justification string as its first argument
      # empty
      1:1 unsafe call needs a justification string as its first argument
      # blank
      1:1 unsafe call needs a justification string as its first argument
      # reason

      # number
      1:1 unsafe call needs a justification string as its first argument
      # template

      # template empty
      1:1 unsafe call needs a justification string as its first argument
      # template blank
      1:1 unsafe call needs a justification string as its first argument
      # template expr
      1:1 unsafe call needs a justification string as its first argument
      # identifier
      1:1 unsafe call needs a justification string as its first argument
      # member

      # other fn

      # in unsafe dir still checked
      1:1 unsafe call needs a justification string as its first argument
      # test path
      1:1 unsafe call needs a justification string as its first argument
      # d.ts

      # json
      "
    `);
  });
});

describe("small helpers", () => {
  it("str and num read typed fields with fallbacks", () => {
    expect(str({ a: "x", n: 1 }, "a")).toBe("x");
    expect(str({ a: "x", n: 1 }, "n")).toBe("");
    expect(str({ a: "x" }, "missing")).toBe("");
    expect(str(undefined, "a")).toBe("");
    expect(num({ a: "x", n: 0 }, "n")).toBe(0);
    expect(num({ a: "x", n: 7 }, "n", 3)).toBe(7);
    expect(num({ a: "x" }, "a")).toBe(-1);
    expect(num({ a: "x" }, "a", 9)).toBe(9);
    expect(num({}, "missing")).toBe(-1);
    expect(num(undefined, "missing", 5)).toBe(5);
  });

  it("lineCol is 1-based, clamps offsets, and counts only newlines", () => {
    expect(lineCol("", 0)).toEqual({ line: 1, col: 1 });
    expect(lineCol("ab\ncd", 0)).toEqual({ line: 1, col: 1 });
    expect(lineCol("ab\ncd", 2)).toEqual({ line: 1, col: 3 });
    expect(lineCol("ab\ncd", 3)).toEqual({ line: 2, col: 1 });
    expect(lineCol("ab\ncd", 4)).toEqual({ line: 2, col: 2 });
    expect(lineCol("ab\ncd", 5)).toEqual({ line: 2, col: 3 });
    expect(lineCol("ab\ncd", 99)).toEqual({ line: 2, col: 3 });
    expect(lineCol("ab\ncd", -4)).toEqual({ line: 1, col: 1 });
    expect(lineCol("a\n\n\nb", 4)).toEqual({ line: 4, col: 1 });
    expect(lineCol("a\rb\tc", 4)).toEqual({ line: 1, col: 5 });
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), fc.nat(60), (text, at) => {
        const { line, col } = lineCol(text, at);
        const upto = text.slice(0, Math.min(at, text.length));
        expect(line).toBe(upto.split("\n").length);
        expect(col).toBe(upto.length - (upto.lastIndexOf("\n") + 1) + 1);
      }),
    );
  });

  it("lineCol answers alike for sources asked in turn, many lines each (its line index is per source)", () => {
    const text = fc.stringOf(fc.constantFrom("a", "\n", "\r", " "), { maxLength: 60 });
    const naive = (s: string, at: number): { line: number; col: number } => {
      const upto = s.slice(0, Math.max(0, Math.min(at, s.length)));
      return { line: upto.split("\n").length, col: upto.length - (upto.lastIndexOf("\n") + 1) + 1 };
    };
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.boolean(), fc.integer({ min: -2, max: 70 })), { maxLength: 12 }),
        text,
        text,
        (asks, a, b) => {
          for (const [first, at] of asks) expect(lineCol(first ? a : b, at)).toEqual(naive(first ? a : b, at));
        },
      ),
    );
  });

  it("clip joins lines, trims, and cuts with an ellipsis exactly at the limit", () => {
    expect(clipMessage("abc", 3)).toBe("abc");
    expect(clipMessage("abcd", 3)).toBe("...");
    expect(clipMessage("abcdef", 5)).toBe("ab...");
    expect(clipMessage("  a  \n  b  ", 10)).toBe("a b");
    expect(clipMessage("a \n\n b\nc", 10)).toBe("a b c");
    expect(clipMessage("a  b", 10)).toBe("a  b");
    expect(clipMessage("x".repeat(100), 89)).toBe(`${"x".repeat(86)}...`);
    expect(clipMessage("x".repeat(89), 89)).toBe("x".repeat(89));
    fc.assert(fc.property(fc.string(), fc.integer({ min: 4, max: 100 }), (s, n) => clipMessage(s, n).length <= n));
  });

  it("path classifiers", () => {
    for (const p of ["a.ts", "a.tsx", "a.js", "a.jsx", "a.mts", "a.cts", "a.mjs", "a.cjs", "x/y/a.ts"])
      expect(isCodePath(p)).toBe(true);
    for (const p of ["a.d.ts", "a.d.mts", "a.d.cts", "a.json", "a.tsx.map", "a.tsa", "ats", "a.ts.txt", "a.css"])
      expect(isCodePath(p)).toBe(false);
    expect(isCodePath("a.dts")).toBe(false);
    for (const p of [
      "test/a.ts",
      "src/test/a.ts",
      "tests/a.ts",
      "x/conformance/a.ts",
      "src/__tests__/a.ts",
      "a.test.ts",
      "a.spec.tsx",
      "a.test.mjs",
    ])
      expect(isTestPath(p)).toBe(true);
    for (const p of [
      "src/a.ts",
      "src/mytest/a.ts",
      "src/tester/a.ts",
      "a.tests.ts",
      "a.test",
      "atest.ts",
      "a.testx.ts",
      "src/conformances/a.ts",
      "tests.ts",
    ])
      expect(isTestPath(p)).toBe(false);
    expect(isAppPath("src/a.ts")).toBe(true);
    expect(isAppPath("a.ts")).toBe(true);
    for (const p of [
      "src/a.test.ts",
      "test/a.ts",
      ".keel/a.ts",
      "node_modules/p/a.ts",
      "x/node_modules/p/a.ts",
      "vite.config.ts",
      "a.config.mjs",
      "a.config.jsx",
      "a.d.ts",
      "a.json",
    ])
      expect(isAppPath(p)).toBe(false);
    expect(isAppPath("src/unsafely/a.ts")).toBe(true);
    expect(isAppPath("unsafe/a.ts")).toBe(true);
    expect(isAppPath("src/x/unsafe/a.ts")).toBe(true);
    expect(isAppPath("src/a.configs.ts")).toBe(true);
    expect(isAppPath("src/configa.ts")).toBe(true);
  });

  it("stemOf and langOf", () => {
    expect(stemOf("a.ts")).toBe("a");
    expect(stemOf("x/y/addItem.server.ts")).toBe("addItem");
    expect(stemOf("x/.hidden")).toBe(".hidden");
    expect(stemOf("x/noext")).toBe("noext");
    expect(stemOf("x/")).toBe("");
    expect(stemOf("")).toBe("");
    expect(stemOf("x/.a.b")).toBe(".a.b");
    expect(stemOf("x/ab.c")).toBe("ab");
    expect(stemOf("x/a.b.c")).toBe("a");
    expect(langOf("a.tsx")).toBe("tsx");
    for (const p of ["a.ts", "a.mts", "a.cts"]) expect(langOf(p)).toBe("ts");
    expect(langOf("a.jsx")).toBe("jsx");
    for (const p of ["a.js", "a.mjs", "a.cjs"]) expect(langOf(p)).toBe("js");
    expect(langOf("a.txt")).toBe("tsx");
    expect(langOf("tsx")).toBe("tsx");
    expect(langOf("a.tsxx")).toBe("tsx");
    expect(langOf("a.jsxx")).toBe("tsx");
    expect(langOf("a.jsa")).toBe("tsx");
    expect(langOf("ats")).toBe("tsx");
    expect(langOf("a.ts.map")).toBe("tsx");
    expect(langOf("a.js.map")).toBe("tsx");
  });

  it("findingAt carries location and optional data", () => {
    const file = f("a.ts", "ab\ncd");
    expect(findingAt(file, 4)).toEqual({ path: "a.ts", line: 2, col: 2 });
    expect(Object.keys(findingAt(file, 4))).toEqual(["path", "line", "col"]);
    expect(findingAt(file, 0, { k: 1 })).toEqual({ path: "a.ts", line: 1, col: 1, data: { k: 1 } });
  });

  it("canonicalJson sorts keys at every depth and hashOf is FNV-1a over it", () => {
    expect(canonicalJson({ b: 1, a: { d: [{ z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[{"y":2,"z":1}]},"b":1}',
    );
    expect(canonicalJson([3, 1])).toBe("[3,1]");
    expect(canonicalJson("x")).toBe('"x"');
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(1)).toBe("1");
    const reference = (text: string): string => {
      let h = 0x811c9dc5n;
      for (let i = 0; i < text.length; i++) h = ((h ^ BigInt(text.charCodeAt(i))) * 0x01000193n) & 0xffffffffn;
      return `fnv1a:${h.toString(16).padStart(8, "0")}`;
    };
    expect(hashOf("")).toBe(reference('""'));
    expect(hashOf({ a: 1 })).toBe(reference('{"a":1}'));
    expect(hashOf({ a: 1, b: 2 })).toBe(hashOf({ b: 2, a: 1 }));
    expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }));
    expect(hashOf("a")).toMatch(/^fnv1a:[0-9a-f]{8}$/);
    expect(hashOf(7)).toBe(reference("7"));
    fc.assert(fc.property(fc.string({ maxLength: 30 }), (t) => hashOf(t) === reference(JSON.stringify(t))));
    expect(hashOf("\u00e9\u4e2d")).toBe(reference(JSON.stringify("\u00e9\u4e2d")));
  });

  it("applyEdits sorts, drops overlaps, and keeps the tail", () => {
    expect(applyEdits("abcdef", [])).toBe("abcdef");
    expect(applyEdits("abcdef", [{ start: 1, end: 3, text: "X" }])).toBe("aXdef");
    expect(
      applyEdits("abcdef", [
        { start: 4, end: 5, text: "Y" },
        { start: 1, end: 2, text: "X" },
      ]),
    ).toBe("aXcdYf");
    expect(
      applyEdits("abcdef", [
        { start: 1, end: 4, text: "X" },
        { start: 2, end: 3, text: "Y" },
      ]),
    ).toBe("aXef");
    expect(
      applyEdits("abcdef", [
        { start: 1, end: 3, text: "X" },
        { start: 3, end: 4, text: "Y" },
      ]),
    ).toBe("aXYef");
    expect(
      applyEdits("abc", [
        { start: 0, end: 0, text: "<" },
        { start: 3, end: 3, text: ">" },
      ]),
    ).toBe("<abc>");
    expect(
      applyEdits("abc", [
        { start: 1, end: 1, text: "1" },
        { start: 1, end: 2, text: "2" },
      ]),
    ).toBe("a12c");
    expect(
      applyEdits("abc", [
        { start: 1, end: 2, text: "2" },
        { start: 1, end: 1, text: "1" },
      ]),
    ).toBe("a12c");
  });

  it("compareDiagnostics orders by path, line, col, code, message, fix, see", () => {
    const base: Diagnostic = { kind: "diag", code: "E1", path: "b", line: 2, col: 2, message: "m" };
    const sign = (a: Diagnostic, b: Diagnostic): number => Math.sign(compareDiagnostics(a, b));
    expect(sign(base, base)).toBe(0);
    expect(sign({ ...base, path: "a" }, base)).toBe(-1);
    expect(sign({ ...base, path: "c" }, base)).toBe(1);
    expect(sign({ ...base, path: "a", line: 9 }, base)).toBe(-1);
    expect(sign({ ...base, line: 1, col: 9 }, base)).toBe(-1);
    expect(sign({ ...base, line: 3, col: 1 }, base)).toBe(1);
    expect(sign({ ...base, col: 1 }, base)).toBe(-1);
    expect(sign({ ...base, col: 3 }, base)).toBe(1);
    expect(sign({ ...base, code: "E0", col: 9 }, { ...base, col: 9 })).toBe(-1);
    expect(sign({ ...base, code: "E2" }, base)).toBe(1);
    expect(sign({ ...base, message: "a" }, base)).toBe(-1);
    expect(sign({ ...base, message: "z" }, base)).toBe(1);
    expect(sign({ ...base, fix: "a" }, { ...base, fix: "b" })).toBe(-1);
    expect(sign({ ...base, fix: "b" }, { ...base, fix: "a" })).toBe(1);
    expect(sign(base, { ...base, fix: "a" })).toBe(-1);
    expect(sign({ ...base, fix: "a" }, base)).toBe(1);
    expect(sign({ ...base, see: "a" }, { ...base, see: "b" })).toBe(-1);
    expect(sign({ ...base, see: "b" }, { ...base, see: "a" })).toBe(1);
    expect(sign(base, { ...base, see: "a" })).toBe(-1);
    expect(sign({ ...base, see: "a" }, base)).toBe(1);
  });

  it("tsCompilerOptions is the strict profile", () => {
    const o = tsCompilerOptions();
    expect(o).toMatchObject({
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noImplicitOverride: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      skipLibCheck: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      types: [],
    });
    expect([o.target, o.module, o.moduleResolution, o.jsx]).toEqual([9, 99, 100, 1]);
  });
});

describe("normalize, groupByCode, summarize, trailer", () => {
  const d = (code: string, path: string, line: number, extra: Partial<Diagnostic> = {}): Diagnostic => ({
    kind: "diag",
    code,
    path,
    line,
    col: 1,
    message: `m${line}`,
    ...extra,
  });

  it("normalize fixes key order, drops absent optionals, dedupes, and sorts", () => {
    const messy: Diagnostic = {
      message: "m1",
      col: 1,
      line: 1,
      path: "a",
      code: "E1",
      kind: "diag",
      fix: "F",
      see: "S",
    };
    const [out] = normalize([messy]);
    expect(Object.keys(out ?? {})).toEqual(["kind", "code", "path", "line", "col", "message", "see", "fix"]);
    expect(Object.keys(normalize([d("E1", "a", 1)])[0] ?? {})).toEqual([
      "kind",
      "code",
      "path",
      "line",
      "col",
      "message",
    ]);
    expect(Object.keys(normalize([d("E1", "a", 1, { fix: "F" })])[0] ?? {})).toEqual([
      "kind",
      "code",
      "path",
      "line",
      "col",
      "message",
      "fix",
    ]);
    expect(Object.keys(normalize([d("E1", "a", 1, { see: "S" })])[0] ?? {})).toEqual([
      "kind",
      "code",
      "path",
      "line",
      "col",
      "message",
      "see",
    ]);
    expect(normalize([d("E1", "a", 1), d("E1", "a", 1)])).toHaveLength(1);
    expect(normalize([d("E1", "a", 1), d("E1", "a", 1, { see: "S" })])).toHaveLength(2);
    expect(normalize([d("E1", "a", 1), d("E1", "a", 1, { fix: "F" })])).toHaveLength(2);
    expect(normalize([d("E1", "b", 1), d("E1", "a", 2), d("E1", "a", 1)]).map((x) => `${x.path}${x.line}`)).toEqual([
      "a1",
      "a2",
      "b1",
    ]);
  });

  it("groupByCode keeps input order inside groups and sorts the groups", () => {
    const g = groupByCode([d("E2", "a", 1), d("E1", "a", 2), d("E2", "a", 3), d("E10", "a", 4)]);
    expect(g.map(([c, ds]) => [c, ds.map((x) => x.line)])).toEqual([
      ["E1", [2]],
      ["E10", [4]],
      ["E2", [1, 3]],
    ]);
    expect(groupByCode([])).toEqual([]);
  });

  it("summarize counts severities and sorts count keys", () => {
    const s = summarize([
      d("W2001", "a", 1),
      d("I2002", "a", 2),
      d("E1002", "a", 3),
      d("E1001", "a", 4),
      d("E1002", "a", 5),
    ]);
    expect(s).toEqual({
      kind: "summary",
      ok: false,
      errors: 3,
      warnings: 1,
      infos: 1,
      counts: { E1001: 1, E1002: 2, I2002: 1, W2001: 1 },
    });
    expect(Object.keys(s.counts)).toEqual(["E1001", "E1002", "I2002", "W2001"]);
    expect(summarize([d("W2001", "a", 1)]).ok).toBe(true);
    expect(summarize([d("I2001", "a", 1)])).toMatchObject({ ok: true, errors: 0, infos: 1 });
    expect(summarize([])).toEqual({ kind: "summary", ok: true, errors: 0, warnings: 0, infos: 0, counts: {} });
  });

  it("trailer pluralizes, shows time, infos, per-code counts, quiet, and code filter", () => {
    const s = summarize([
      d("E1002", "a", 1),
      d("E1001", "a", 2),
      d("W2001", "a", 3),
      d("I2002", "a", 4),
      d("I2002", "a", 5),
    ]);
    expect(trailer(s, {})).toEqual(["fail 2 errors, 1 warning, 2 infos", "  E1001 1, E1002 1, I2002 2, W2001 1"]);
    expect(trailer(s, { ms: 1840 })[0]).toBe("fail 2 errors, 1 warning, 2 infos (1.8s)");
    expect(trailer(s, { ms: 0 })[0]).toBe("fail 2 errors, 1 warning, 2 infos (0.0s)");
    expect(trailer(s, { quiet: true })).toEqual(["fail 2 errors, 1 warning, 2 infos"]);
    expect(trailer(s, { code: "E1002" })).toEqual(["fail 2 errors, 1 warning, 2 infos", "  E1002 1"]);
    expect(trailer(s, { code: "E9999" })).toEqual(["fail 2 errors, 1 warning, 2 infos"]);
    expect(trailer(summarize([]), {})).toEqual(["ok 0 errors, 0 warnings"]);
    expect(trailer(summarize([d("E1", "a", 1)]), {})[0]).toBe("fail 1 error, 0 warnings");
    expect(trailer(summarize([d("W1", "a", 1)]), {})[0]).toBe("ok 0 errors, 1 warning");
    expect(trailer(summarize([d("I1", "a", 1)]), {})[0]).toBe("ok 0 errors, 0 warnings, 1 info");
    expect(trailer({ ...summarize([]), counts: { E1: 0 } }, {})).toEqual(["ok 0 errors, 0 warnings"]);
  });

  it("budgetBreaches reports only actual above limit, with clipped ids", () => {
    const b = (id: string, limit: number, actual: number, extra: Partial<Budget> = {}): Budget => ({
      id,
      limit,
      actual,
      unit: "tokens",
      ...extra,
    });
    expect(budgetBreaches([b("a", 10, 10), b("b", 10, 9)])).toEqual([]);
    expect(budgetBreaches([b("a", 10, 11)])).toEqual([
      {
        kind: "diag",
        code: "E1755",
        path: "budgets.json",
        line: 1,
        col: 1,
        message: "budget a exceeded: 11 tokens > 10",
        see: "k.check",
      },
    ]);
    expect(budgetBreaches([{ id: "p", limit: 1, actual: 2, unit: "bytes", path: "x/b.json" }])[0]).toMatchObject({
      path: "x/b.json",
      message: "budget p exceeded: 2 bytes > 1",
    });
    expect(budgetBreaches([b("i".repeat(60), 1, 2)])[0]?.message).toBe(
      `budget ${"i".repeat(37)}... exceeded: 2 tokens > 1`,
    );
    expect(budgetBreaches([b("i".repeat(40), 1, 2)])[0]?.message).toBe(
      `budget ${"i".repeat(40)} exceeded: 2 tokens > 1`,
    );
    expect(budgetBreaches([b("i".repeat(40), 1e30, 2e30)])[0]?.message.length).toBeLessThanOrEqual(89);
  });
});

describe("unifiedDiff", () => {
  const lines = (n: number, from = 1): string => Array.from({ length: n }, (_, i) => `l${from + i}`).join("\n");
  it("pins headers, hunk ranges, context, and end-of-file markers", () => {
    const cases: [string, string, string][] = [
      ["replace middle", "a\nb\nc\n", "a\nX\nc\n"],
      ["add line", "a\nb\n", "a\nb\nc\n"],
      ["remove line", "a\nb\nc\n", "a\nc\n"],
      ["from empty", "", "a\nb\n"],
      ["to empty", "a\nb\n", ""],
      ["no eol before", "a\nb", "a\nb\n"],
      ["no eol after", "a\nb\n", "a\nb"],
      ["no eol both changed", "a\nb", "a\nc"],
      ["no eol both same last", "a\nb", "x\nb"],
      ["single line", "a\n", "b\n"],
      ["single line no eol", "a", "b"],
      ["far apart hunks", `${lines(20)}\n`, `${lines(20).replace("l2\n", "L2\n").replace("l19\n", "L19\n")}\n`],
      ["close hunks merge (gap 6)", `${lines(12)}\n`, `${lines(12).replace("l2\n", "L2\n").replace("l9\n", "L9\n")}\n`],
      ["gap 7 splits", `${lines(14)}\n`, `${lines(14).replace("l2\n", "L2\n").replace("l10\n", "L10\n")}\n`],
      ["context limit at start", `${lines(10)}\n`, `${lines(10).replace("l2\n", "L2\n")}\n`],
      ["context limit at end", `${lines(10)}\n`, `${lines(10).replace("l9\n", "L9\n")}\n`],
      ["pure insertion at top", "a\nb\n", "new\na\nb\n"],
      ["pure deletion at top", "x\na\nb\n", "a\nb\n"],
      ["blank lines", "a\n\n\nb\n", "a\n\nb\n"],
      ["insert between with LCS", "a\nb\nc\nd\n", "a\nc\nX\nd\n"],
      ["move", "a\nb\nc\n", "c\na\nb\n"],
      ["dup lines", "a\na\na\n", "a\na\n"],
      ["crlf kept", "a\r\nb\r\n", "a\r\nc\r\n"],
    ];
    for (const [, a, b] of cases)
      if (a !== "" && b !== "") expect(applyPatch("p/f.ts", a, unifiedDiff("p/f.ts", a, b))).toBe(b);
    const out = cases.map(([name, a, b]) => block(name, unifiedDiff("p/f.ts", a, b))).join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# replace middle
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,3 +1,3 @@
       a
      -b
      +X
       c
      # add line
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,2 +1,3 @@
       a
       b
      +c
      # remove line
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,3 +1,2 @@
       a
      -b
       c
      # from empty
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -0,0 +1,2 @@
      +a
      +b
      # to empty
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,2 +0,0 @@
      -a
      -b
      # no eol before
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,2 +1,2 @@
       a
      -b
      \\ No newline at end of file
      +b
      # no eol after
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,2 +1,2 @@
       a
      -b
      +b
      \\ No newline at end of file
      # no eol both changed
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,2 +1,2 @@
       a
      -b
      \\ No newline at end of file
      +c
      \\ No newline at end of file
      # no eol both same last
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,2 +1,2 @@
      -a
      +x
       b
      \\ No newline at end of file
      # single line
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1 +1 @@
      -a
      +b
      # single line no eol
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1 +1 @@
      -a
      \\ No newline at end of file
      +b
      \\ No newline at end of file
      # far apart hunks
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,5 +1,5 @@
       l1
      -l2
      +L2
       l3
       l4
       l5
      @@ -16,5 +16,5 @@
       l16
       l17
       l18
      -l19
      +L19
       l20
      # close hunks merge (gap 6)
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,5 +1,5 @@
       l1
      -l2
      +L2
       l3
       l4
       l5
      @@ -6,7 +6,7 @@
       l6
       l7
       l8
      -l9
      +L9
       l10
       l11
       l12
      # gap 7 splits
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,5 +1,5 @@
       l1
      -l2
      +L2
       l3
       l4
       l5
      @@ -7,7 +7,7 @@
       l7
       l8
       l9
      -l10
      +L10
       l11
       l12
       l13
      # context limit at start
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,5 +1,5 @@
       l1
      -l2
      +L2
       l3
       l4
       l5
      # context limit at end
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -6,5 +6,5 @@
       l6
       l7
       l8
      -l9
      +L9
       l10
      # pure insertion at top
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,2 +1,3 @@
      +new
       a
       b
      # pure deletion at top
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,3 +1,2 @@
      -x
       a
       b
      # blank lines
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,4 +1,3 @@
       a
       
      -
       b
      # insert between with LCS
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,4 +1,4 @@
       a
      -b
       c
      +X
       d
      # move
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,3 +1,3 @@
      +c
       a
       b
      -c
      # dup lines
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,3 +1,2 @@
       a
       a
      -a
      # crlf kept
      --- a/p/f.ts
      +++ b/p/f.ts
      @@ -1,2 +1,2 @@
       a
      -b
      +c
      "
    `);
  });
  it("is empty for equal text and has no trailing newline", () => {
    expect(unifiedDiff("f", "a\n", "a\n")).toBe("");
    expect(unifiedDiff("f", "", "")).toBe("");
    expect(unifiedDiff("f", "a", "b").endsWith("\n")).toBe(false);
    expect(unifiedDiff("f", "a\n", "b\n").split("\n").slice(0, 2)).toEqual(["--- a/f", "+++ b/f"]);
  });
  it("hunks account for every line: counts in headers match the body (seed 1337)", () => {
    const line = fc.constantFrom("a", "b", "c", "d", "");
    const text = fc
      .tuple(fc.array(line, { maxLength: 25 }), fc.boolean())
      .map(([ls, eol]) => (ls.length === 0 ? "" : `${ls.join("\n")}${eol ? "\n" : ""}`));
    fc.assert(
      fc.property(text, text, (a, b) => {
        fc.pre(a !== b);
        const diff = unifiedDiff("f", a, b).split("\n");
        const headers = diff.filter((l) => l.startsWith("@@"));
        expect(headers.length).toBeGreaterThan(0);
        let minus = 0;
        let plus = 0;
        let want = [0, 0];
        for (const l of diff.slice(2)) {
          const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@$/.exec(l);
          if (m !== null) {
            expect(minus).toBe(want[0]);
            expect(plus).toBe(want[1]);
            minus = 0;
            plus = 0;
            want = [m[2] === undefined ? 1 : Number(m[2]), m[4] === undefined ? 1 : Number(m[4])];
          } else if (l.startsWith("\\")) expect(l).toBe("\\ No newline at end of file");
          else {
            if (l[0] !== "+") minus++;
            if (l[0] !== "-") plus++;
          }
        }
        expect(minus).toBe(want[0]);
        expect(plus).toBe(want[1]);
      }),
    );
  });
});

describe("format", () => {
  const d = (code: string, line: number, extra: Partial<Diagnostic> = {}): Diagnostic => ({
    kind: "diag",
    code,
    path: "src/a.ts",
    line,
    col: 2,
    message: `msg ${line}`,
    ...extra,
  });
  const many = [1, 2, 3, 4, 5, 6, 7].map((n) => d("E1001", n));
  const fixed = d("E1002", 1, {
    see: "k.x",
    fix: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,3 +1,3 @@\n ctx\n-old\n+new\n ctx2",
  });
  const longFix = d("E1003", 1, { fix: "--- a/f\n+++ b/f\n@@ -1 +1 @@\n-a\n-b\n-c\n+d\n+e\n+f\n+g" });
  const sixFix = d("E1004", 1, { fix: "--- a/f\n+++ b/f\n@@ -1 +1 @@\n-a\n-b\n-c\n+d\n+e\n+f" });
  const bareFix = d("E1005", 1, { fix: "-a\n+b" });
  const mixed = [d("W2001", 3), d("I2002", 4), fixed, longFix, sixFix, bareFix, ...many];

  it("compact: cap per code, more line, fixes, trailer, counts", () => {
    expect(format(mixed)).toMatchInlineSnapshot(`
      "E1001 src/a.ts:1:2 msg 1
      E1001 src/a.ts:2:2 msg 2
      E1001 src/a.ts:3:2 msg 3
      E1001 src/a.ts:4:2 msg 4
      E1001 src/a.ts:5:2 msg 5
      ... +2 more E1001 (keel check --code E1001)
      E1002 src/a.ts:1:2 msg 1
        fix: -old
             +new
      E1003 src/a.ts:1:2 msg 1
        fix: 7-line patch (keel check --format=json --code E1003)
      E1004 src/a.ts:1:2 msg 1
        fix: -a
             -b
             -c
             +d
             +e
             +f
      I2002 src/a.ts:4:2 msg 4
      W2001 src/a.ts:3:2 msg 3
      E1005 src/a.ts:1:2 msg 1
        fix: -a
             +b
      fail 11 errors, 1 warning, 1 info
        E1001 7, E1002 1, E1003 1, E1004 1, E1005 1, I2002 1, W2001 1"
    `);
    expect(format(mixed, { limit: 2 })).toMatchInlineSnapshot(`
      "E1001 src/a.ts:1:2 msg 1
      E1001 src/a.ts:2:2 msg 2
      ... +5 more E1001 (keel check --code E1001)
      E1002 src/a.ts:1:2 msg 1
        fix: -old
             +new
      E1003 src/a.ts:1:2 msg 1
        fix: 7-line patch (keel check --format=json --code E1003)
      E1004 src/a.ts:1:2 msg 1
        fix: -a
             -b
             -c
             +d
             +e
             +f
      I2002 src/a.ts:4:2 msg 4
      W2001 src/a.ts:3:2 msg 3
      E1005 src/a.ts:1:2 msg 1
        fix: -a
             +b
      fail 11 errors, 1 warning, 1 info
        E1001 7, E1002 1, E1003 1, E1004 1, E1005 1, I2002 1, W2001 1"
    `);
    expect(format(mixed, { limit: 0 })).toBe(format(mixed));
    expect(format(mixed, { limit: 1.5 })).toBe(format(mixed));
    expect(format(mixed, { limit: -3 })).toBe(format(mixed));
    expect(format(mixed, { code: "E1001", ms: 1234 })).toMatchInlineSnapshot(`
      "E1001 src/a.ts:1:2 msg 1
      E1001 src/a.ts:2:2 msg 2
      E1001 src/a.ts:3:2 msg 3
      E1001 src/a.ts:4:2 msg 4
      E1001 src/a.ts:5:2 msg 5
      ... +2 more E1001 (keel check --code E1001)
      fail 11 errors, 1 warning, 1 info (1.2s)
        E1001 7"
    `);
    expect(format(mixed, { quiet: true, ms: 50 })).toMatchInlineSnapshot(`"fail 11 errors, 1 warning, 1 info (0.1s)"`);
    expect(format([])).toBe("ok 0 errors, 0 warnings");
    expect(format(many, { mode: "other" })).toBe(format(many));
    expect(format(many, { mode: "compact" })).toBe(format(many));
  });
  it("json: uncapped unless limit, summary last with rounded ms", () => {
    expect(format(many, { mode: "json" }).split("\n")).toHaveLength(8);
    expect(format(many, { mode: "json", limit: 2 }).split("\n")).toHaveLength(3);
    expect(format(many, { mode: "json", quiet: true })).toMatchInlineSnapshot(
      `"{"kind":"summary","ok":false,"errors":7,"warnings":0,"infos":0,"counts":{"E1001":7}}"`,
    );
    expect(format(many, { mode: "json", ms: 12.6, code: "E1001", limit: 1 })).toMatchInlineSnapshot(`
      "{"kind":"diag","code":"E1001","path":"src/a.ts","line":1,"col":2,"message":"msg 1"}
      {"kind":"summary","ok":false,"errors":7,"warnings":0,"infos":0,"counts":{"E1001":7},"ms":13}"
    `);
    expect(format([fixed], { mode: "json" })).toMatchInlineSnapshot(`
      "{"kind":"diag","code":"E1002","path":"src/a.ts","line":1,"col":2,"message":"msg 1","see":"k.x","fix":"--- a/src/a.ts\\n+++ b/src/a.ts\\n@@ -1,3 +1,3 @@\\n ctx\\n-old\\n+new\\n ctx2"}
      {"kind":"summary","ok":false,"errors":1,"warnings":0,"infos":0,"counts":{"E1002":1}}"
    `);
    expect(format([d("E1", 1), d("E1", 1)], { mode: "json", limit: 1.5 }).split("\n")).toHaveLength(2);
    expect(format(mixed, { mode: "json", code: "W2001" }).split("\n")).toHaveLength(2);
  });
  it("pretty: blocks with location, see, fix; capped; trailer", () => {
    expect(
      format([fixed, d("E1001", 9), d("W2001", 2, { see: "k.y" })], { mode: "pretty", ms: 2000 }),
    ).toMatchInlineSnapshot(`
      "E1001  msg 9
        at src/a.ts:9:2

      E1002  msg 1
        at src/a.ts:1:2  (see k.x)
        fix:
          --- a/src/a.ts
          +++ b/src/a.ts
          @@ -1,3 +1,3 @@
           ctx
          -old
          +new
           ctx2

      W2001  msg 2
        at src/a.ts:2:2  (see k.y)

      fail 2 errors, 1 warning (2.0s)
        E1001 1, E1002 1, W2001 1"
    `);
    expect(format(many, { mode: "pretty", limit: 1 })).toMatchInlineSnapshot(`
      "E1001  msg 1
        at src/a.ts:1:2

      ... +6 more E1001 (keel check --code E1001)
      fail 7 errors, 0 warnings
        E1001 7"
    `);
    expect(format(many, { mode: "pretty", quiet: true })).toMatchInlineSnapshot(`"fail 7 errors, 0 warnings"`);
    expect(format(many, { mode: "pretty", code: "E9999" })).toMatchInlineSnapshot(`"fail 7 errors, 0 warnings"`);
    expect(format(many, { mode: "pretty" })).toContain("... +2 more E1001 (keel check --code E1001)");
  });
  it("is deterministic and order independent (seed 1337)", () => {
    fc.assert(
      fc.property(
        fc.array(arbDiagnostic, { maxLength: 12 }),
        fc.constantFrom("compact", "json", "pretty"),
        (ds, mode) => {
          const out = format(ds, { mode });
          expect(format([...ds].reverse(), { mode })).toBe(out);
          expect(format([...ds, ...ds], { mode })).toBe(out);
          expect(out.includes(String.fromCharCode(27))).toBe(false);
        },
      ),
    );
  });
});

describe("explain, rules, defineRule", () => {
  it("explain: kernel table, registered stdlib rule, unknown code", () => {
    expect(explain("E1001")).toMatch(/^E1001|For/);
    expect(explain("E9999")).toBe("E9999 is not a known code; keel docs --for E9999 lists spec lines citing it.");
    defineRule({ code: "E2951", message: "string msg", explain: "why", see: "k.check", check: () => [] });
    expect(explain("E2951")).toBe("E2951 string msg.\nwhy\nsee: k.check");
    defineRule({ code: "E2952", message: () => "fn msg", explain: "why2", check: () => [] });
    expect(explain("E2952")).toBe("E2952.\nwhy2");
  });
  it("rules() is sorted by code and includes the kernel and registered rules", () => {
    const codes = rules().map((r) => r.code);
    expect(codes).toEqual([...codes].sort());
    expect(codes).toEqual(
      expect.arrayContaining([
        "E1104",
        "E1302",
        "E1451",
        "E1452",
        "E1601",
        "E1701",
        "E1752",
        "E1754",
        "E1757",
        "E1803",
        "E1805",
      ]),
    );
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("defineRule validates and freezes", () => {
    for (const code of ["E1999", "E2", "E20000", "X2001", "e2001", "E2abc", "E2001 ", " E2001", "EE2001", "E3001"])
      expect(() => defineRule({ code, message: "m", explain: "e", check: () => [] })).toThrow(
        /^E1753 rule code .* is outside E2xxx\/W2xxx$/,
      );
    const r = defineRule({ code: "W2953", message: "m", explain: "e", check: () => [] });
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => defineRule({ code: "W2953", message: "m", explain: "e", check: () => [] })).toThrow(
      "E1753 rule code W2953 registered twice",
    );
  });
});

const RR = "src/runRules.ts";
describe("runRules and E1756", () => {
  it("a throwing check, message, or fix yields one E1756 and the other rules still run", () => {
    defineRule({
      code: "E2961",
      message: "m",
      explain: "e",
      check: ({ file }) => {
        if (file.path === RR) throw new Error("boom");
        return [];
      },
    });
    defineRule({
      code: "E2962",
      message: "m",
      explain: "e",
      check: ({ file }) => {
        if (file.path === RR) throw "plain";
        return [];
      },
    });
    defineRule({
      code: "E2963",
      message: () => {
        throw new Error("x".repeat(200));
      },
      explain: "e",
      check: ({ file }) => (file.path === RR ? [findingAt(file, 0)] : []),
    });
    defineRule({
      code: "E2964",
      message: "m",
      explain: "e",
      check: ({ file }) => (file.path === RR ? [findingAt(file, 0)] : []),
      fix: () => {
        throw new Error("fixboom");
      },
    });
    defineRule({
      code: "W2965",
      message: "ok rule",
      see: "k.check",
      explain: "e",
      check: ({ file }) => (file.path === RR ? [findingAt(file, 4)] : []),
      fix: () => [{ start: 4, end: 4, text: "" }],
    });
    defineRule({
      code: "W2966",
      message: "no fix null",
      explain: "e",
      check: ({ file }) => (file.path === RR ? [findingAt(file, 0)] : []),
      fix: () => null,
    });
    defineRule({
      code: "W2967",
      message: "no fix empty",
      explain: "e",
      check: ({ file }) => (file.path === RR ? [findingAt(file, 0)] : []),
      fix: () => [],
    });
    defineRule({
      code: "W2968",
      message: "fix",
      explain: "e",
      check: ({ file }) => (file.path === RR ? [findingAt(file, 0)] : []),
      fix: () => [{ start: 0, end: 1, text: "Z" }],
    });
    defineRule({
      code: "W2969",
      message: `${"m".repeat(120)}\nsecond`,
      explain: "e",
      check: ({ file }) => (file.path === RR ? [findingAt(file, 0)] : []),
    });
    const out = check([f(RR, "ab\ncd\n")], { types: false }).diagnostics.filter((x) => /^[EW]29/.test(x.code));
    expect(out).toMatchInlineSnapshot(`
      [
        {
          "code": "W2966",
          "col": 1,
          "kind": "diag",
          "line": 1,
          "message": "no fix null",
          "path": "src/runRules.ts",
        },
        {
          "code": "W2967",
          "col": 1,
          "kind": "diag",
          "line": 1,
          "message": "no fix empty",
          "path": "src/runRules.ts",
        },
        {
          "code": "W2968",
          "col": 1,
          "fix": "--- a/src/runRules.ts
      +++ b/src/runRules.ts
      @@ -1,2 +1,2 @@
      -ab
      +Zb
       cd",
          "kind": "diag",
          "line": 1,
          "message": "fix",
          "path": "src/runRules.ts",
        },
        {
          "code": "W2969",
          "col": 1,
          "kind": "diag",
          "line": 1,
          "message": "mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm...",
          "path": "src/runRules.ts",
        },
        {
          "code": "W2965",
          "col": 2,
          "kind": "diag",
          "line": 2,
          "message": "ok rule",
          "path": "src/runRules.ts",
          "see": "k.check",
        },
      ]
    `);
  });
});

describe("project passes", () => {
  const E = (code: string, files: SourceFile[], opts: Parameters<typeof check>[1] = { types: false }): string =>
    check(files, opts)
      .diagnostics.filter((d) => d.code === code)
      .map((d) => `${d.path}:${d.line}:${d.col} ${d.message}${d.fix === undefined ? "" : `\n${d.fix}`}`)
      .join("\n");

  it("E1454 duplicate s.error codes", () => {
    const err = (code: string): string => `export const x = s.error('${code}', d)\n`;
    const out = [
      block(
        "dup across files, path order",
        E("E1454", [f("src/b.ts", err("todos.gone")), f("src/a.ts", err("todos.gone"))]),
      ),
      block(
        "dup in file, source order",
        E("E1454", [f("src/a.ts", `export const y = s.error('t.a', d)\nexport const x = s.error('t.a', d)\n`)]),
      ),
      block("three", E("E1454", [f("src/a.ts", err("t.a")), f("src/b.ts", err("t.a")), f("src/c.ts", err("t.a"))])),
      block("distinct", E("E1454", [f("src/a.ts", err("t.a")), f("src/b.ts", err("t.b"))])),
      block(
        "long code and path",
        E("E1454", [
          f(`src/${"d".repeat(60)}/a.ts`, err("t.a")),
          f("src/b.ts", err(`t.${"c".repeat(60)}`)),
          f("src/c.ts", err(`t.${"c".repeat(60)}`)),
          f("src/d.ts", err("t.a")),
        ]),
      ),
      block("long prior path", E("E1454", [f(`src/${"d".repeat(60)}/a.ts`, err("t.a")), f("src/z.ts", err("t.a"))])),
      block("computed ignored", E("E1454", [f("src/a.ts", "x['error']('t.a')\nx['error']('t.a')\n")])),
      block("other object", E("E1454", [f("src/a.ts", "o.error('t.a')\no.error('t.a')\n")])),
      block("other method", E("E1454", [f("src/a.ts", "s.fail('t.a')\ns.fail('t.a')\n")])),
      block("non-literal", E("E1454", [f("src/a.ts", "s.error(x)\ns.error(x)\ns.error(1)\ns.error(1)\n")])),
      block("no args", E("E1454", [f("src/a.ts", "s.error()\ns.error()\n")])),
      block("call of identifier", E("E1454", [f("src/a.ts", "error('t.a')\nerror('t.a')\n")])),
      block("test path skipped", E("E1454", [f("test/a.test.ts", `${err("t.a")}${err("t.a")}`)])),
      block("parse failure skipped", E("E1454", [f("src/a.ts", `${err("t.a")}${err("t.a")}let = = ;\n`)])),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# dup across files, path order
      src/b.ts:1:26 error code "todos.gone" already declared at src/a.ts:1
      # dup in file, source order
      src/a.ts:2:26 error code "t.a" already declared at src/a.ts:1
      # three
      src/b.ts:1:26 error code "t.a" already declared at src/a.ts:1
      src/c.ts:1:26 error code "t.a" already declared at src/a.ts:1
      # distinct

      # long code and path
      src/c.ts:1:26 error code "t.ccccccccccccccccccccccccc..." already declared at src/b.ts:1
      src/dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd/a.ts:1:26 error code "t.a" already declared at src/d.ts:1
      # long prior path
      src/z.ts:1:26 error code "t.a" already declared at ddddddddddddddddddddddddddddddddd/a.ts:1
      # computed ignored

      # other object

      # other method

      # non-literal

      # no args

      # call of identifier

      # test path skipped

      # parse failure skipped
      "
    `);
  });

  it("E1753 rule code declarations", () => {
    const rule = (code: string): string => `export const r = defineRule({ code: '${code}', message: 'm' })\n`;
    const out = [
      block("outside range", E("E1753", [f("src/a.ts", rule("E1234"))])),
      block("in range", E("E1753", [f("src/a.ts", rule("E2234"))])),
      block("W in range", E("E1753", [f("src/a.ts", rule("W2234"))])),
      block("I out of range", E("E1753", [f("src/a.ts", rule("I2234"))])),
      block("five digits", E("E1753", [f("src/a.ts", rule("E22345"))])),
      block("three digits", E("E1753", [f("src/a.ts", rule("E223"))])),
      block("prefixed junk", E("E1753", [f("src/a.ts", rule("xE2234"))])),
      block("suffixed junk", E("E1753", [f("src/a.ts", rule("E2234x"))])),
      block("dup across files", E("E1753", [f("src/b.ts", rule("E2234")), f("src/a.ts", rule("E2234"))])),
      block("dup in file source order", E("E1753", [f("src/a.ts", `${rule("E2234")}${rule("E2234")}`)])),
      block(
        "out of range dup says outside only",
        E("E1753", [f("src/a.ts", rule("E1234")), f("src/b.ts", rule("E1234"))]),
      ),
      block("long code", E("E1753", [f("src/a.ts", rule(`E${"9".repeat(40)}`))])),
      block(
        "long prior path",
        E("E1753", [f(`src/${"d".repeat(60)}/a.ts`, rule("E2234")), f("src/z.ts", rule("E2234"))]),
      ),
      block("computed key", E("E1753", [f("src/a.ts", "defineRule({ ['code']: 'E1' })\n")])),
      block("string key", E("E1753", [f("src/a.ts", "defineRule({ 'code': 'E1' })\n")])),
      block("other key", E("E1753", [f("src/a.ts", "defineRule({ message: 'E1' })\n")])),
      block("spread", E("E1753", [f("src/a.ts", "defineRule({ ...x })\n")])),
      block("non-literal value", E("E1753", [f("src/a.ts", "defineRule({ code: x })\ndefineRule({ code: 1 })\n")])),
      block("not object", E("E1753", [f("src/a.ts", "defineRule(x)\ndefineRule()\n")])),
      block("member callee", E("E1753", [f("src/a.ts", "x.defineRule({ code: 'E1' })\n")])),
      block("other callee", E("E1753", [f("src/a.ts", "other({ code: 'E1' })\n")])),
      block("test path skipped", E("E1753", [f("test/a.test.ts", rule("E1"))])),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# outside range
      src/a.ts:1:37 rule code E1234 is outside E2xxx/W2xxx
      # in range

      # W in range

      # I out of range
      src/a.ts:1:37 rule code I2234 is outside E2xxx/W2xxx
      # five digits
      src/a.ts:1:37 rule code E22345 is outside E2xxx/W2xxx
      # three digits
      src/a.ts:1:37 rule code E223 is outside E2xxx/W2xxx
      # prefixed junk
      src/a.ts:1:37 rule code xE2234 is outside E2xxx/W2xxx
      # suffixed junk
      src/a.ts:1:37 rule code E2234x is outside E2xxx/W2xxx
      # dup across files
      src/b.ts:1:37 rule code E2234 already defined at src/a.ts:1
      # dup in file source order
      src/a.ts:2:37 rule code E2234 already defined at src/a.ts:1
      # out of range dup says outside only
      src/a.ts:1:37 rule code E1234 is outside E2xxx/W2xxx
      src/b.ts:1:37 rule code E1234 is outside E2xxx/W2xxx
      # long code
      src/a.ts:1:37 rule code E9999999999999999... is outside E2xxx/W2xxx
      # long prior path
      src/z.ts:1:37 rule code E2234 already defined at ddddddddddddddddddddddddddddddddd/a.ts:1
      # computed key

      # string key

      # other key

      # spread

      # non-literal value

      # not object

      # member callee

      # other callee

      # test path skipped
      "
    `);
  });

  it("E1755 budgets and E1005 generated artifacts", () => {
    const hashed = (data: unknown): string => `{"data":${JSON.stringify(data)},"hash":"${hashOf(data)}"}\n`;
    const okFile = hashed({ a: 1 });
    const manifest = (dir = ""): SourceFile => f(`${dir}modules/m/routes.ts`, "export const routes = {}\n");
    const COMPONENT = 'export default function C() { return <p id="c.p">x</p> }\n';
    const out = [
      block(
        "budget",
        E("E1755", [], {
          types: false,
          budgets: [
            { id: "x", limit: 1, actual: 2, unit: "bytes", path: "p.json" },
            { id: "y", limit: 2, actual: 2, unit: "bytes" },
          ],
        }),
      ),
      block("intact", E("E1005", [f(".keel/routes.json", hashed({}))])),
      block("forged: data changed, hash recomputed", E("E1005", [f(".keel/routes.json", okFile)])),
      block("routes manifest: routes.json not verified", E("W1005", [f(".keel/routes.json", okFile), manifest()])),
      block("routes manifest: W1005 only", E("E1005", [f(".keel/routes.json", okFile), manifest()])),
      block(
        "routes manifest: not self-consistent",
        E("E1005", [f(".keel/routes.json", `{"data":{"a":1},"hash":"${hashOf({})}"}\n`), manifest()]),
      ),
      block(
        "routes manifest: non-canonical bytes",
        E("E1005", [f(".keel/routes.json", `{"hash":"${hashOf({})}","data":{}}`), manifest()]),
      ),
      block("nested dir: self-consistent", E("E1005", [f("apps/a/.keel/routes.json", okFile)])),
      block("nested dir: genuine", E("E1005", [f("apps/a/.keel/routes.json", hashed({}))])),
      block("nested manifest: W1005", E("W1005", [f("apps/a/.keel/routes.json", hashed({})), manifest("apps/a/")])),
      block("root manifest: not nested", E("W1005", [f("apps/a/.keel/routes.json", hashed({})), manifest()])),
      block(
        "nested source: its own project",
        E("E1005", [f("apps/a/.keel/ids.json", hashed({})), f("apps/a/src/C.tsx", COMPONENT)]),
      ),
      block("root source: not nested", E("E1005", [f("apps/a/.keel/ids.json", hashed({})), f("src/C.tsx", COMPONENT)])),
      block(
        "two projects, one compile each",
        E("E1005", [
          f("apps/a/.keel/ids.json", hashed({})),
          f("apps/b/.keel/ids.json", hashed({})),
          f("apps/b/C.tsx", COMPONENT),
        ]),
      ),
      block(
        "nested topology",
        E("E1005", [
          f("apps/a/.keel/ids.json", hashed({})),
          f("apps/a/topology.ts", "export default { web: { modules: ['m'], adapter: 'client' } }\n"),
        ]),
      ),
      block(
        "forged ids.json beside its source",
        E("E1005", [f(".keel/ids.json", hashed({})), f("src/C.tsx", COMPONENT)], {
          types: false,
        }),
      ),
      block(
        "non-canonical bytes keep data",
        E("E1005", [f(".keel/routes.json", `{"hash":"${hashOf({})}","data":{}}`)]),
      ),
      block("bad hash", E("E1005", [f(".keel/routes.json", `{"data":{"a":1},"hash":"fnv1a:00000000"}\n`)])),
      block("not json", E("E1005", [f(".keel/routes.json", "nope")])),
      block("json null", E("E1005", [f(".keel/routes.json", "null\n")])),
      block("json array", E("E1005", [f(".keel/routes.json", "[]\n")])),
      block("hash not string", E("E1005", [f(".keel/routes.json", `{"data":1,"hash":1}\n`)])),
      block("data undefined", E("E1005", [f(".keel/routes.json", `{"hash":1}\n`)])),
      block(
        "0143: hashes naming the forged hash are ignored",
        E("E1005", [f(".keel/routes.json", okFile)], {
          types: false,
          artifacts: { hashes: { "routes.json": hashOf({ a: 1 }) } },
        }),
      ),
      block(
        "0143: empty hashes are ignored",
        E("E1005", [f(".keel/ids.json", okFile)], { types: false, artifacts: { hashes: {} } }),
      ),
      block(
        "project: sources come from it",
        E("W1005", [f(".keel/routes.json", okFile)], { types: false, project: [manifest()] }),
      ),
      block("project: empty", E("E1005", [f(".keel/routes.json", okFile)], { types: false, project: [] })),
      block("unknown name", E("E1005", [f(".keel/x.json", hashed({}))])),
      block("nested dir", E("E1005", [f("apps/a/.keel/routes.json", "nope")])),
      block(
        "not .keel",
        E("E1005", [
          f("keel/routes.json", "nope"),
          f("a.keel/routes.json", "nope"),
          f(".keel/sub/routes.json", "nope"),
          f(".keel/routes.txt", "nope"),
        ]),
      ),
      block("long name", E("E1005", [f(`.keel/${"n".repeat(50)}.json`, "nope")])),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# budget
      p.json:1:1 budget x exceeded: 2 bytes > 1
      # intact

      # forged: data changed, hash recomputed
      .keel/routes.json:1:1 generated .keel/routes.json does not match its sources; run keel build
      # routes manifest: routes.json not verified
      .keel/routes.json:1:1 .keel/routes.json unverified, not literal: modules/m/routes.ts
      # routes manifest: W1005 only

      # routes manifest: not self-consistent
      .keel/routes.json:1:1 hand edit to generated .keel/routes.json; revert and run keel build
      # routes manifest: non-canonical bytes
      .keel/routes.json:1:1 hand edit to generated .keel/routes.json; revert and run keel build
      --- a/.keel/routes.json
      +++ b/.keel/routes.json
      @@ -1 +1 @@
      -{"hash":"fnv1a:5465b825","data":{}}
      \\ No newline at end of file
      +{"data":{},"hash":"fnv1a:5465b825"}
      # nested dir: self-consistent
      apps/a/.keel/routes.json:1:1 generated .keel/routes.json does not match its sources; run keel build
      # nested dir: genuine

      # nested manifest: W1005
      apps/a/.keel/routes.json:1:1 .keel/routes.json unverified, not literal: modules/m/routes.ts
      # root manifest: not nested

      # nested source: its own project
      apps/a/.keel/ids.json:1:1 generated .keel/ids.json does not match its sources; run keel build
      # root source: not nested

      # two projects, one compile each
      apps/b/.keel/ids.json:1:1 generated .keel/ids.json does not match its sources; run keel build
      # nested topology

      # forged ids.json beside its source
      .keel/ids.json:1:1 generated .keel/ids.json does not match its sources; run keel build
      # non-canonical bytes keep data
      .keel/routes.json:1:1 hand edit to generated .keel/routes.json; revert and run keel build
      --- a/.keel/routes.json
      +++ b/.keel/routes.json
      @@ -1 +1 @@
      -{"hash":"fnv1a:5465b825","data":{}}
      \\ No newline at end of file
      +{"data":{},"hash":"fnv1a:5465b825"}
      # bad hash
      .keel/routes.json:1:1 hand edit to generated .keel/routes.json; revert and run keel build
      # not json
      .keel/routes.json:1:1 hand edit to generated .keel/routes.json; revert and run keel build
      # json null
      .keel/routes.json:1:1 hand edit to generated .keel/routes.json; revert and run keel build
      # json array
      .keel/routes.json:1:1 hand edit to generated .keel/routes.json; revert and run keel build
      # hash not string
      .keel/routes.json:1:1 hand edit to generated .keel/routes.json; revert and run keel build
      # data undefined
      .keel/routes.json:1:1 hand edit to generated .keel/routes.json; revert and run keel build
      # 0143: hashes naming the forged hash are ignored
      .keel/routes.json:1:1 generated .keel/routes.json does not match its sources; run keel build
      # 0143: empty hashes are ignored
      .keel/ids.json:1:1 generated .keel/ids.json does not match its sources; run keel build
      # project: sources come from it
      .keel/routes.json:1:1 .keel/routes.json unverified, not literal: modules/m/routes.ts
      # project: empty
      .keel/routes.json:1:1 generated .keel/routes.json does not match its sources; run keel build
      # unknown name
      .keel/x.json:1:1 .keel/x.json is not among the compiled artifacts; remove it
      # nested dir
      apps/a/.keel/routes.json:1:1 hand edit to generated .keel/routes.json; revert and run keel build
      # not .keel

      # long name
      .keel/nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn.json:1:1 .keel/nnnnnnnnnnnnnnnnnnnnnnnnnnnnnn is not among the compiled artifacts; remove it"
    `);
  });

  it("E1000 syntax errors skip rules; parse is memoized by path and text", () => {
    const bad = f("src/a.ts", "export const a = (\n");
    expect(check([bad], { types: false }).diagnostics.map((d) => d.code)).toEqual(["E1000"]);
    expect(check([bad], { types: false })).toEqual(check([bad], { types: false }));
    const x = f("src/a.ts", "export const a = 1\n");
    const y = f("src/b.ts", "export const b = 1\n");
    const z = f("src/a.ts", "export const a = (\n");
    expect(check([x], { types: false }).diagnostics).toEqual([]);
    expect(check([z], { types: false }).summary.ok).toBe(false);
    expect(check([x], { types: false }).summary.ok).toBe(true);
    expect(check([y], { types: false }).diagnostics).toEqual([]);
  });
});

describe("type check mapping (E1751, E1802, E1001, E1501, E1003, E1453)", () => {
  const T = (path: string, source: string): string =>
    check([f(path, source)], {})
      .diagnostics.filter((d) => d.code !== "E1805" && d.code !== "E1752")
      .map((d) => `${d.code} ${d.line}:${d.col} ${d.message}`)
      .join("\n");
  const ui = "import { Box, Button, Checkbox, Heading, Image, Input, Link, Select, TextArea, Text } from '@keel/ui'\n";
  // Each block runs `check` with the type checker over a component file: about 4 s for the lot here, so 120 s.
  it("pins each mapped code with location and message", { timeout: fixedTime(120_000) }, () => {
    const out = [
      block("button missing", T("src/A.tsx", `${ui}export default function A() { return <Button id="b" /> }\n`)),
      block(
        "button label",
        T("src/A.tsx", `${ui}export default function A() { return <Button id="b" label="x" /> }\n`),
      ),
      block("checkbox", T("src/A.tsx", `${ui}export default function A() { return <Checkbox id="b" /> }\n`)),
      block("heading", T("src/A.tsx", `${ui}export default function A() { return <Heading>x</Heading> }\n`)),
      block("image", T("src/A.tsx", `${ui}export default function A() { return <Image src="x" /> }\n`)),
      block("input", T("src/A.tsx", `${ui}export default function A() { return <Input id="i" /> }\n`)),
      block("link", T("src/A.tsx", `${ui}export default function A() { return <Link id="l" /> }\n`)),
      block("select", T("src/A.tsx", `${ui}export default function A() { return <Select id="s" /> }\n`)),
      block("textarea", T("src/A.tsx", `${ui}export default function A() { return <TextArea id="t" /> }\n`)),
      block("box nav", T("src/A.tsx", `${ui}export default function A() { return <Box as="nav" id="n" /> }\n`)),
      block(
        "box aside label",
        T("src/A.tsx", `${ui}export default function A() { return <Box as="aside" id="n" label="x" /> }\n`),
      ),
      block("box div label", T("src/A.tsx", `${ui}export default function A() { return <Box id="n" label="x" /> }\n`)),
      block("text fine", T("src/A.tsx", `${ui}export default function A() { return <Text>x</Text> }\n`)),
      block(
        "for no key",
        T(
          "src/A.tsx",
          "import { For } from '@keel/runtime-dom'\nexport default function A() { return <For each={[{ id: 1 }]}>{(x) => <b>{x.id}</b>}</For> }\n",
        ),
      ),
      block("link string path", T("src/A.tsx", `${ui}export default function A() { return <Link to="/x">x</Link> }\n`)),
      block(
        "link javascript",
        T("src/A.tsx", `${ui}export default function A() { return <Link to="javascript:go()">x</Link> }\n`),
      ),
      block(
        "link JavaScript spaced",
        T("src/A.tsx", `${ui}export default function A() { return <Link to=" JavaScript:go()">x</Link> }\n`),
      ),
      block(
        "link data expr",
        T("src/A.tsx", `${ui}export default function A() { return <Link to={"data:text/html,x"}>x</Link> }\n`),
      ),
      block(
        "link data template",
        T("src/A.tsx", `${ui}export default function A() { return <Link to={\`data:x\`}>x</Link> }\n`),
      ),
      block(
        "link var",
        T("src/A.tsx", `${ui}const p: string = 'x'\nexport default function A() { return <Link to={p}>x</Link> }\n`),
      ),
      block(
        "link not url scheme",
        T("src/A.tsx", `${ui}export default function A() { return <Link to="xdata:x">x</Link> }\n`),
      ),
      block("plain TS error", T("src/a.ts", "export const a: number = 'x'\n")),
      block("two TS errors", T("src/a.ts", "export const a: number = 'x'\nexport const b: string = 1\n")),
      block(
        "long TS message clipped",
        T(
          "src/a.ts",
          "export const a: { aaaaaaaaaaaaaaaaaaaa: 1; bbbbbbbbbbbbbbbbbbbbbbbbb: 2; cccccccccccccccccccccccc: 3; ddddddddddddddddddd: 4 } = 1\n",
        ),
      ),
      block("multiline TS message", T("src/a.ts", "export const a: { x: number } = { x: 'a' }\n")),
      block(
        "implicit any in component props ok",
        T("src/A.tsx", `${ui}export default function A(props) { return <Text>{props.x}</Text> }\n`),
      ),
      block("implicit any named component ok", T("src/A.tsx", `${ui}export const B = (props) => <Text>x</Text>\n`)),
      block("implicit any lowercase fn reported", T("src/A.tsx", `${ui}export const b = (props) => 1\n`)),
      block("implicit any in ts reported", T("src/a.ts", "export default function A(props) { return 1 }\n")),
      block(
        "implicit any second param reported",
        T("src/A.tsx", `${ui}export default function A(props: {}, slots) { return <Text>x</Text> }\n`),
      ),
      block(
        "implicit any non-fn arg reported",
        T("src/A.tsx", `${ui}export default function A() { return [1].map((x, y) => 1).map((z) => z) }\n`),
      ),
      block(
        "implicit any function expression",
        T("src/A.tsx", `${ui}export const B = function (props) { return <Text>x</Text> }\n`),
      ),
      block("implicit any class method", T("src/A.tsx", `${ui}export class B { m(props) { return 1 } }\n`)),
      block(
        "result discarded",
        T(
          "src/a.ts",
          "type R = { ok: true; value: number } | { ok: false; error: string }\ndeclare function f(): R\nexport function g() {\n  f()\n}\n",
        ),
      ),
      block(
        "result awaited discarded",
        T(
          "src/a.ts",
          "type R = { ok: true; value: number } | { ok: false; error: string }\ndeclare function f(): Promise<R>\nexport async function g() {\n  await f()\n}\n",
        ),
      ),
      block(
        "result paren discarded",
        T(
          "src/a.ts",
          "type R = { ok: true; value: number } | { ok: false; error: string }\ndeclare function f(): R\nexport function g() {\n  ;(f())\n}\n",
        ),
      ),
      block(
        "result voided",
        T(
          "src/a.ts",
          "type R = { ok: true; value: number } | { ok: false; error: string }\ndeclare function f(): R\nexport function g() {\n  void f()\n}\n",
        ),
      ),
      block(
        "result used",
        T(
          "src/a.ts",
          "type R = { ok: true; value: number } | { ok: false; error: string }\ndeclare function f(): R\nexport function g() {\n  const r = f()\n  return r\n}\n",
        ),
      ),
      block(
        "non-result union",
        T("src/a.ts", "declare function f(): { ok: true } | { ok: false }\nexport function g() {\n  f()\n}\n"),
      ),
      block(
        "non-union",
        T("src/a.ts", "declare function f(): { ok: true; value: 1; error: 2 }\nexport function g() {\n  f()\n}\n"),
      ),
      block(
        "union lacking ok",
        T("src/a.ts", "declare function f(): { value: 1 } | { error: 2 }\nexport function g() {\n  f()\n}\n"),
      ),
      block(
        "union lacking error",
        T(
          "src/a.ts",
          "declare function f(): { ok: true; value: 1 } | { ok: false; value: 2 }\nexport function g() {\n  f()\n}\n",
        ),
      ),
      block(
        "union lacking value",
        T(
          "src/a.ts",
          "declare function f(): { ok: true; error: 1 } | { ok: false; error: 2 }\nexport function g() {\n  f()\n}\n",
        ),
      ),
      block(
        "non-call statement",
        T(
          "src/a.ts",
          "type R = { ok: true; value: number } | { ok: false; error: string }\ndeclare const r: R\nexport function g() {\n  r\n}\n",
        ),
      ),
      block("d.ts skipped", T("src/a.d.ts", "export declare const a: number = 'x'\n")),
      block("json skipped", T("src/a.json", "{ nope")),
      block("clean", T("src/a.ts", "export const a = 1\n")),
    ].join("\n");
    expect(out).toMatchInlineSnapshot(`
      "# button missing
      E1802 2:39 <Button> is missing a11y-required prop children
      # button label
      E1751 2:53 TS2322 Type '{ id: string; label: string; }' is not assignable to type 'StyleValues<Co...
      # checkbox
      E1802 2:39 <Checkbox> is missing a11y-required prop label
      # heading
      E1802 2:39 <Heading> is missing a11y-required prop level
      # image
      E1802 2:39 <Image> is missing a11y-required prop decorative
      # input
      E1802 2:39 <Input> is missing a11y-required prop label
      # link
      E1802 2:39 <Link> is missing a11y-required prop to or children
      # select
      E1802 2:39 <Select> is missing a11y-required prop label
      # textarea
      E1802 2:39 <TextArea> is missing a11y-required prop label
      # box nav
      E1802 2:39 <Box> is missing a11y-required prop label
      # box aside label

      # box div label
      E1751 2:39 TS2322 Type '{ id: string; label: string; }' is not assignable to type 'StyleValues<Co...
      # text fine

      # for no key
      E1001 2:38 For needs key="<field>" naming a field of the item
      # link string path
      E1501 2:44 to is a string path; use routes.href(routeId, params)
      # link javascript
      E1003 2:44 to is a literal script/data URL; it renders as about:blank
      # link JavaScript spaced
      E1003 2:44 to is a literal script/data URL; it renders as about:blank
      # link data expr
      E1003 2:44 to is a literal script/data URL; it renders as about:blank
      # link data template
      E1003 2:44 to is a literal script/data URL; it renders as about:blank
      # link var
      E1501 3:44 string path where an Href is required; use the contract's href(routeId, params)
      # link not url scheme
      E1003 2:44 to is a literal script/data URL; it renders as about:blank
      E1501 2:44 string path where an Href is required; use the contract's href(routeId, params)
      # plain TS error
      E1751 1:14 TS2322 Type 'string' is not assignable to type 'number'.
      # two TS errors
      E1751 1:14 TS2322 Type 'string' is not assignable to type 'number'.
      E1751 2:14 TS2322 Type 'number' is not assignable to type 'string'.
      # long TS message clipped
      E1751 1:14 TS2322 Type 'number' is not assignable to type '{ aaaaaaaaaaaaaaaaaaaa: 1; bbbbbbbbbbb...
      # multiline TS message
      E1751 1:35 TS2322 Type 'string' is not assignable to type 'number'.
      # implicit any in component props ok

      # implicit any named component ok

      # implicit any lowercase fn reported
      E1751 2:19 TS7006 Parameter 'props' implicitly has an 'any' type.
      # implicit any in ts reported
      E1751 1:27 TS7006 Parameter 'props' implicitly has an 'any' type.
      # implicit any second param reported
      E1407 2:38 a component is (props, ctx: Ctx): ctx required, typed Ctx, last
      E1751 2:38 TS7006 Parameter 'slots' implicitly has an 'any' type.
      # implicit any non-fn arg reported

      # implicit any function expression

      # implicit any class method
      E1751 2:20 TS7006 Parameter 'props' implicitly has an 'any' type.
      # result discarded
      E1453 4:3 Result discarded: narrow on r.ok and handle r.error
      # result awaited discarded
      E1453 4:3 Result discarded: narrow on r.ok and handle r.error
      # result paren discarded
      E1453 4:4 Result discarded: narrow on r.ok and handle r.error
      # result voided
      E1453 4:3 Result discarded: narrow on r.ok and handle r.error
      # result used

      # non-result union

      # non-union

      # union lacking ok

      # union lacking error

      # union lacking value

      # non-call statement

      # d.ts skipped

      # json skipped

      # clean
      "
    `);
  });

  it("lowers If/Boundary/Match/Case children without reporting thunk errors", () => {
    const rt = "import { If, Boundary, Match, Case } from '@keel/runtime-dom'\n";
    expect(T("src/A.tsx", `${rt}export default function A() { return <If when={true}><b>x</b></If> }\n`)).toBe("");
    expect(
      T("src/A.tsx", `${rt}export default function A() { return <div><Boundary><b>x</b></Boundary></div> }\n`),
    ).toBe("");
  });

  it("compiler diagnostics already reported are not repeated by the type check", () => {
    const out = check([f("src/A.tsx", "export default function A() { return <div>{ }</div> }\n")], {}).diagnostics.map(
      (d) => d.code,
    );
    expect(out).toEqual([...new Set(out)]);
  });

  it("types: false skips step 1b; the type cache returns equal results", () => {
    const bad = f("src/a.ts", "export const a: number = 'x'\n");
    expect(check([bad], { types: false }).diagnostics).toEqual([]);
    const first = check([bad]).diagnostics;
    expect(first.map((d) => d.code)).toEqual(["E1751"]);
    expect(check([bad]).diagnostics).toEqual(first);
    expect(check([f("src/a.ts", "export const a: number = 1\n")]).diagnostics).toEqual([]);
    expect(
      check([f("src/a.ts", "export const a: number = 'x'\n"), f("src/b.ts", "export const b = 1\n")]).diagnostics.map(
        (d) => d.path,
      ),
    ).toEqual(["src/a.ts"]);
    expect(
      check([f("a.ts", "export const a: number = 'x'\n")], { root: "/nonexistent-keel-root" }).diagnostics.map(
        (d) => d.code,
      ),
    ).toEqual(["E1751"]);
  });
});

describe("ensureImport, references, nodeAt", () => {
  const prog = (src: string) => parseSync("a.ts", src, { sourceType: "module", lang: "ts" }).program;
  it("ensureImport: none when present, append to a value import, else a new line", () => {
    expect(ensureImport(prog("import { a } from 'm'\n"), "a", "m")).toEqual([]);
    expect(ensureImport(prog("import { b as a } from 'm'\n"), "a", "m")).toEqual([{ start: 15, end: 15, text: ", a" }]);
    expect(ensureImport(prog("import { a as b } from 'm'\n"), "a", "m")).toEqual([{ start: 15, end: 15, text: ", a" }]);
    expect(ensureImport(prog("import { x } from 'm'\n"), "a", "m")).toEqual([{ start: 10, end: 10, text: ", a" }]);
    expect(ensureImport(prog("import { x, y } from 'm'\n"), "a", "m")).toEqual([{ start: 13, end: 13, text: ", a" }]);
    expect(ensureImport(prog("import { x } from 'other'\n"), "a", "m")).toEqual([
      { start: 0, end: 0, text: 'import { a } from "m";\n' },
    ]);
    expect(ensureImport(prog("import type { x } from 'm'\n"), "a", "m")).toEqual([
      { start: 0, end: 0, text: 'import { a } from "m";\n' },
    ]);
    expect(ensureImport(prog("import m from 'm'\n"), "a", "m")).toEqual([
      { start: 0, end: 0, text: 'import { a } from "m";\n' },
    ]);
    expect(ensureImport(prog("import * as m from 'm'\n"), "a", "m")).toEqual([
      { start: 0, end: 0, text: 'import { a } from "m";\n' },
    ]);
    expect(ensureImport(prog("import {} from 'm'\n"), "a", "m")).toEqual([
      { start: 0, end: 0, text: 'import { a } from "m";\n' },
    ]);
    expect(ensureImport(prog("import { 'a' as a } from 'm'\n"), "a", "m")).toEqual([]);
    expect(ensureImport(prog("import { 'b' as a } from 'm'\n"), "a", "m")).toHaveLength(1);
    expect(ensureImport(prog("import { x } from 'm'\nimport { y } from 'm'\n"), "a", "m")).toEqual([
      { start: 32, end: 32, text: ", a" },
    ]);
    expect(ensureImport(prog("import { x } from 'm'\nimport type { y } from 'm'\n"), "a", "m")).toEqual([
      { start: 10, end: 10, text: ", a" },
    ]);
    expect(ensureImport(prog(""), "a", "m")).toEqual([{ start: 0, end: 0, text: 'import { a } from "m";\n' }]);
  });

  it("references: reads only, declarations and member/keys/types excluded, memoized per program", () => {
    const p = prog(
      "import { i } from 'm'\nconst v = a.b + c[d] + { k: e, f, [g]: 1 }\nfunction fn(p1, { p2 }, [p3], ...p4) { return h }\nclass K { m() {} x = 1 }\ntry {} catch (err) {}\nlbl: for (;;) { break lbl }\ntype T = U\nlet w: V = f2<W>(1)\nconst fe = function named(q = 1) {}\nconst ar = (r, s2) => 1\nclass Z {}\n",
    );
    const t = references(p);
    expect(references(p)).toBe(t);
    expect(t.refs.map((r) => r.name)).toEqual(["a", "c", "d", "e", "f", "f", "g", "h", "lbl", "f2"]);
    expect([...t.declared].sort()).toEqual(
      ["Z", "K", "ar", "err", "fe", "fn", "i", "p1", "p2", "p3", "p4", "q", "r", "s2", "v", "w"].sort(),
    );
    for (const r of t.refs) expect(r.end - r.start).toBe(r.name.length);
    expect(t.refs.map((r) => r.start)).toEqual([...t.refs.map((r) => r.start)].sort((x, y) => x - y));
  });

  it("references: parameter properties and rest elements", () => {
    const t = references(
      prog(
        "class A { constructor(private pp: number, ...[rest]: number[]) {} }\nconst [x1, ...x2] = z\nconst { y1, ...y2 } = z\nconst [, x3 = 1] = z\n",
      ),
    );
    expect([...t.declared].sort()).toEqual(["A", "pp", "rest", "x1", "x2", "x3", "y1", "y2"].sort());
    expect(t.refs.map((r) => r.name)).toEqual(["z", "z", "z"]);
  });

  it("nodeAt finds the innermost node containing the position", () => {
    const sf = ts.createSourceFile("a.ts", "const abc = foo(1, 2)\n", ts.ScriptTarget.ES2022, true);
    expect(nodeAt(sf, 6).getText(sf)).toBe("abc");
    expect(nodeAt(sf, 12).getText(sf)).toBe("foo");
    expect(nodeAt(sf, 16).getText(sf)).toBe("1");
    expect(nodeAt(sf, 19).getText(sf)).toBe("2");
    expect(nodeAt(sf, 20).getText(sf)).toBe("foo(1, 2)");
    expect(nodeAt(sf, 0).getText(sf)).toBe("const abc = foo(1, 2)");
    expect(nodeAt(sf, 1000)).toBe(sf);
    expect(nodeAt(sf, 21)).toBe(sf);
  });
});
