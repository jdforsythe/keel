// Seed 1337. The host views of a build-time evaluation (k.evaluator Realm, k.compiler Build-time evaluation), default
// deny, in an evaluator: every member `HOST_VIEWS` does not list is refused with E1050, a function at its call and any
// other value at its read; the prepared global object's reflection reaches only views; the bundle's writes to the
// global object and `process.env` stay in the evaluation; a stat field the code reads is a probe, `atime` refused.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterEach, beforeEach, expect, test } from "vitest";

let dir = "";
beforeEach(() => {
  dir = tempDir(".tmp-host-", import.meta.dirname);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

type Run = { result: unknown; probes: unknown; leaked: unknown };
const isRun = (x: unknown): x is Run => typeof x === "object" && x !== null && "result" in x && "leaked" in x;
/** Runs `code` after the bundle's head in an evaluator, started from plain Node. */
function run(code: string): Run {
  const out = execFileSync(process.execPath, [path.join(import.meta.dirname, "host-views-child.ts"), dir, code], {
    encoding: "utf8",
    timeout: testTime(30_000),
  });
  const v: unknown = JSON.parse(out);
  if (!isRun(v)) throw new Error(`no run: ${out}`);
  return v;
}

/** JavaScript naming each member of `view` (over `real`) that a read or a call does not refuse with E1050. */
const OPEN = `const open = (view, real, at, listed) => {
  const left = [];
  for (const k of Object.getOwnPropertyNames(real)) {
    if (listed.has(k)) continue;
    try { const v = view[k]; if (typeof v === 'function') { try { v(); } catch (e) { if (e.code === 'E1050') continue; } } left.push(at + k); }
    catch (e) { if (e.code !== 'E1050') left.push(at + k + ' ' + e.message); }
  }
  return left;
};
const names = (m) => new Set([...(m.pure || []), ...(m.call || []), ...(m.fact || []), ...Object.keys(m.view || {})]);`;

test(
  "every member of the global object, `process` and each built-in that `HOST_VIEWS` does not list is refused",
  () => {
    const r = run(`${OPEN}
const left = [...open(globalThis, globalThis, '', names(__keelHost.globals)), ...open(__keelProcess, __keelProcessReal, 'process.', names(__keelHost.process))];
for (const id of __keelCreateRequire(import.meta.url)('node:module').builtinModules) {
  const entry = __keelHost.builtins[id.replace(/^node:/, '')];
  if (entry === 'pure' || entry === 'console' || entry === 'process' || id.startsWith('_')) continue;
  const real = __keelCreateRequire(import.meta.url)(id.startsWith('node:') ? id : 'node:' + id);
  left.push(...open(__keelBuiltin(id), real, id + '.', names(entry || {})));
}
result = left;`);
    expect(r.result).toEqual([]);
  },
  fixedTime(60_000),
);

test(
  "a property descriptor's getter on the global object gives the view: `process` the view's, `Function` refused",
  () => {
    const r = run(`const get = (k) => Object.getOwnPropertyDescriptor(globalThis, k).get.call(globalThis);
let fn; try { get('Function')('return 1'); fn = 'ran'; } catch (e) { fn = e.code; }
let pid; try { void get('process').pid; pid = 'read'; } catch (e) { pid = e.code; }
result = [get('process') === __keelProcess && process === __keelProcess, fn, pid, Reflect.ownKeys(globalThis).includes('process')];`);
    expect(r.result).toEqual([true, "E1050", "E1050", true]);
  },
  fixedTime(30_000),
);

test(
  "the bundle's writes to the global object and `process.env` read back in the evaluation and reach neither the command's global object nor its environment",
  () => {
    const pairs = fc.sample(fc.tuple(fc.stringMatching(/^[a-z]{1,8}$/), fc.stringMatching(/^[a-z0-9]{0,8}$/)), {
      numRuns: 20,
      seed: 1337,
    });
    const code = `const pairs = ${JSON.stringify(pairs)};
const back = [];
globalThis.keelMark = 1; process.env.KEEL_MARK = '1';
for (const [k, v] of pairs) { globalThis['keelMark' + k] = v; process.env['KEEL_MARK_' + k] = v; back.push(globalThis['keelMark' + k] === v && process.env['KEEL_MARK_' + k] === v); }
result = [globalThis.keelMark, process.env.KEEL_MARK, back.every(Boolean), []];`;
    const r = run(code);
    expect(r.result).toEqual([1, "1", true, []]);
    expect(r.leaked).toEqual([]);
  },
  fixedTime(30_000),
);

test(
  "a stat field the code reads is a `field` probe, a field not read is none, and `atimeMs` is refused",
  () => {
    const f = path.join(dir, "f.txt");
    fs.writeFileSync(f, "x");
    const r = run(`const fs = __keelBuiltin('node:fs');
const s = fs.statSync(${JSON.stringify(f)});
void s.size; void s.mtimeMs; void s.ino; void s.isFile();
let at; try { void s.atimeMs; at = 'read'; } catch (e) { at = e.code; }
result = at;`);
    expect(r.result).toBe("E1050");
    const fields = Array.isArray(r.probes) ? r.probes.filter((p) => Array.isArray(p) && p[0] === "field") : [];
    expect(fields).toEqual([
      ["field", `stat mtimeNs ${f}`],
      ["field", `stat ino ${f}`],
    ]);
  },
  fixedTime(30_000),
);
