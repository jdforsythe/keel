/**
 * The module an evaluator starts with (k.evaluator Start), given to Node as `-e` source, its one argument the entry's
 * path. It takes what it needs of Node before any evaluated code runs, so nothing the code replaces reaches it, then:
 * - watches its standard input, a pipe the command never writes: its end means the command is gone, and the evaluator
 *   ends itself (the watch holds no event loop open, so Node still sees a top-level await that can never settle);
 * - hands `ask` and `at` to the bundle's banner on `globalThis[Symbol.for('keel.evaluator')]`, which the banner takes
 *   and deletes: `ask(question)` writes the question as one JSON line to descriptor 3 and waits (a blocking read of
 *   descriptor 4) for the command's one-line answer; `at(file)` tells the command which entry file is being imported;
 * - imports the entry and writes `{ t: 'result', json }`, its exports as JSON, or `{ t: 'failure', ... }`, the throw
 *   that ended it as a record: a banner refusal's `keelRefusal` (`what`, `frames`), Node's `ERR_ACCESS_DENIED` and `ERR_DLOPEN_DISABLED` and V8's
 *   code-generation `EvalError` as E1050 with their bundle positions, a thrown E code as it is, any other as E1049.
 * - writes `{ t: 'idle' }` when Node's loop empties (`beforeExit`), which tells Node's exit 13 for a top-level await
 *   that can never settle from a `process.exit(13)` the code called.
 * The command ends the evaluator when the record arrives. Written as one raw string: the code holds no template
 * literal and no backslash escape but the line feed of `send`, written as a character code.
 */
export const EVALUATOR_BOOTSTRAP = String.raw`
import fs from 'node:fs';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
const entry = process.argv[1];
const selfUrl = pathToFileURL(entry).href;
const stringify = JSON.stringify;
const parse = JSON.parse;
const entries = Object.entries;
const fromEntries = Object.fromEntries;
const own = Reflect.getOwnPropertyDescriptor;
const bufferFrom = Buffer.from;
const concat = Buffer.concat;
const alloc = Buffer.alloc;
const writeSync = fs.writeSync;
const readSync = fs.readSync;
const kill = process.kill;
const pid = process.pid;
const nap = new Int32Array(new SharedArrayBuffer(4));
const wait = Atomics.wait;
const EvalErrorReal = EvalError;
const hasOwn = Object.hasOwn;
const LF = 10;
const die = () => { try { Reflect.apply(kill, process, [pid, 'SIGKILL']); } catch {} };
try {
  const life = new net.Socket({ fd: 0, readable: true, writable: false });
  life.on('end', die);
  life.on('close', die);
  life.on('error', die);
  life.resume();
  life.unref();
} catch {}
const send = (m) => {
  const b = Reflect.apply(bufferFrom, Buffer, [stringify(m) + String.fromCharCode(LF)]);
  for (let o = 0; o < b.length; ) {
    try { o += writeSync(3, b, o, b.length - o); }
    catch (e) { if (e && e.code === 'EAGAIN') wait(nap, 0, 0, 1); else die(); }
  }
};
let rest = Reflect.apply(alloc, Buffer, [0]);
const ask = (q) => {
  send({ t: 'ask', q });
  for (;;) {
    const i = rest.indexOf(LF);
    if (i >= 0) {
      const line = rest.subarray(0, i).toString('utf8');
      rest = rest.subarray(i + 1);
      return parse(line);
    }
    const b = Reflect.apply(alloc, Buffer, [65536]);
    let n = 0;
    try { n = readSync(4, b, 0, b.length, null); }
    catch (e) { if (e && e.code === 'EAGAIN') { wait(nap, 0, 0, 1); continue; } die(); }
    if (n === 0) die();
    rest = Reflect.apply(concat, Buffer, [[rest, b.subarray(0, n)]]);
  }
};
process.on('beforeExit', () => send({ t: 'idle' }));
Reflect.defineProperty(globalThis, Symbol.for('keel.evaluator'), {
  value: Object.freeze({ ask, at: (file) => send({ t: 'at', file: String(file) }) }),
  configurable: true,
  enumerable: false,
  writable: false,
});
const PERMISSION = { FileSystemRead: 'reading a file outside the evaluation', FileSystemWrite: 'writing a file', ChildProcess: 'starting a process', WorkerThreads: 'starting a worker', Addon: 'loading an addon', WASI: 'WASI', Inspector: 'the inspector' };
const REST = ' at build time: Keel cannot see what it reads, so a build-time evaluation does not run it';
const framesOf = (stack) => {
  const at = [];
  for (const l of String(stack).split(String.fromCharCode(LF)).slice(1)) {
    const i = l.indexOf(selfUrl);
    const m = i < 0 ? null : /^:(\d+):(\d+)/.exec(l.slice(i + selfUrl.length));
    if (m !== null) at.push([Number(m[1]), Number(m[2])]);
  }
  return at;
};
const recordOf = (e) => {
  const o = e !== null && (typeof e === 'object' || typeof e === 'function') ? e : undefined;
  const refusal = o === undefined ? undefined : own(o, 'keelRefusal');
  if (refusal !== undefined && refusal.value !== null && typeof refusal.value === 'object')
    return { code: 'E1050', what: String(refusal.value.what), frames: refusal.value.frames, message: String(refusal.value.what) + REST };
  const code = o === undefined ? undefined : own(o, 'code');
  const text = o !== undefined && own(o, 'message') !== undefined ? String(own(o, 'message').value) : String(e);
  const stack = o === undefined ? undefined : own(o, 'stack');
  const frames = stack === undefined ? [] : framesOf(stack.value);
  if (code !== undefined && code.value === 'ERR_ACCESS_DENIED') {
    const p = own(o, 'permission');
    const what = p !== undefined && hasOwn(PERMISSION, p.value) ? PERMISSION[p.value] : 'a call Node refuses';
    return { code: 'E1050', what, frames, message: what + REST };
  }
  if (code !== undefined && code.value === 'ERR_DLOPEN_DISABLED')
    return { code: 'E1050', what: PERMISSION.Addon, frames, message: PERMISSION.Addon + REST };
  if (e instanceof EvalErrorReal && /code generation from strings/i.test(text))
    return { code: 'E1050', what: 'code from a string', frames, message: 'code from a string' + REST };
  if (code !== undefined && typeof code.value === 'string' && /^E[0-9]{4}$/.test(code.value)) return { code: code.value, message: text, frames };
  return { code: 'E1049', message: text.split(String.fromCharCode(LF))[0], frames };
};
let json;
try {
  const m = await import(selfUrl);
  try { json = stringify(fromEntries(entries(m))); }
  catch (e) { send({ t: 'failure', code: 'E1049', message: 'its exports are not data: ' + recordOf(e).message, frames: [] }); }
} catch (e) {
  send({ t: 'failure', ...recordOf(e) });
}
if (json !== undefined) send({ t: 'result', json });
`;
