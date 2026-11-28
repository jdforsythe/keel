/**
 * The host views of a build-time evaluation bundle, part of `OBSERVE_BANNER` (k.evaluator Realm), built from
 * `__keelHost` (`HOST_VIEWS`), default deny. It takes the evaluator's `ask` and `at` (`EVALUATOR_BOOTSTRAP`) from the
 * global object and deletes them: `__keelAsk(question)` is the command's answer, or the error the view throws (Node's
 * code and message; a refusal the command gives is E1050), and `__keelAt(file)` names the entry file being imported.
 * `__keelView(name, real, members, kinds, fact)` is one view of a Node object of the evaluator: a proxy with every
 * trap over a target of its own, whose listed members are pure (the real value), calls or facts the command answers
 * (`call`, `fact`: asked, never read here), or a view of a kind in `kinds`; a member not listed is refused
 * (`__keelRefuse`, E1050): a function at its call or construction (`__keelRefusedFn`), any other value at its read; a
 * name the object does not have reads as undefined; setting, defining or deleting a member is refused.
 * `__keelBuiltin(id)` is a Node built-in's view, a built-in not listed refused whole. `__keelRefuse(what)` throws an
 * `Error` whose message starts with `what` and whose `keelRefusal` holds `what` and the bundle positions of its
 * caller's frames, taken with `Error`'s own capture and Keel's limit and formatter, whatever the code set them to.
 * `__keelRefusalOf(e)` is a throw's refusal (`what`, `frames`): a view's, or Node's `ERR_ACCESS_DENIED` and
 * `ERR_DLOPEN_DISABLED` and V8's code-generation `EvalError` (Below the views), its frames read from its stack.
 * Last, `__keelPrepare()` prepares the evaluator's global object in place: each own name `HOST_VIEWS` does not list as
 * pure becomes an accessor whose getter gives its view (`process`, `console`, `navigator`, `WebAssembly`; `global`
 * and `globalThis` the object itself) or refuses (a function at its call, any other value at the read), and whose
 * setter makes it the code's own value. Written as one raw string: the code holds no template literal.
 */
export const HOST_BANNER = String.raw`
const __keelSelfUrl = import.meta.url;
const __keelGlobalReal = globalThis;
const __keelErrorReal = Error;
const __keelCapture = Error.captureStackTrace;
const __keelRest = ' at build time: Keel cannot see what it reads, so a build-time evaluation does not run it';
const __keelHand = (() => {
  const k = Symbol.for('keel.evaluator');
  const h = Reflect.get(globalThis, k);
  Reflect.deleteProperty(globalThis, k);
  return h;
})();
const __keelFramesNow = () => {
  const limit = __keelErrorReal.stackTraceLimit;
  const format = __keelErrorReal.prepareStackTrace;
  let sites = [];
  try {
    __keelErrorReal.stackTraceLimit = 64;
    __keelErrorReal.prepareStackTrace = (e, s) => s.map((c) => [c.getFileName(), c.getLineNumber(), c.getColumnNumber()]);
    const o = {};
    __keelCapture(o);
    sites = o.stack;
  } catch {
    sites = [];
  } finally {
    __keelErrorReal.stackTraceLimit = limit;
    __keelErrorReal.prepareStackTrace = format;
  }
  return Array.isArray(sites) ? sites.filter((s) => s[0] === __keelSelfUrl).map((s) => [s[1], s[2]]) : [];
};
const __keelRefuse = (what) => {
  const e = new __keelErrorReal(what + __keelRest);
  e.code = 'E1050';
  Reflect.defineProperty(e, 'keelRefusal', { value: Object.freeze({ what, frames: __keelFramesNow() }) });
  throw e;
};
const __keelEvalErrorReal = EvalError;
const __keelPermission = { FileSystemRead: 'reading a file outside the evaluation', FileSystemWrite: 'writing a file', ChildProcess: 'starting a process', WorkerThreads: 'starting a worker', Addon: 'loading an addon', WASI: 'WASI', Inspector: 'the inspector' };
const __keelRefusalOf = (e) => {
  if (e === null || typeof e !== 'object') return undefined;
  const own = Reflect.getOwnPropertyDescriptor(e, 'keelRefusal');
  if (own !== undefined) return own.value;
  let what;
  if (e.code === 'ERR_ACCESS_DENIED') what = Object.hasOwn(__keelPermission, e.permission) ? __keelPermission[e.permission] : 'a call Node refuses';
  else if (e.code === 'ERR_DLOPEN_DISABLED') what = 'loading an addon';
  else if (e instanceof __keelEvalErrorReal && /code generation from strings/i.test(String(e.message))) what = 'code from a string';
  if (what === undefined) return undefined;
  const frames = [];
  for (const l of String(e.stack).split(String.fromCharCode(10)).slice(1)) {
    const i = l.indexOf(__keelSelfUrl);
    const m = i < 0 ? null : /^:(\d+):(\d+)/.exec(l.slice(i + __keelSelfUrl.length));
    if (m !== null) frames.push([Number(m[1]), Number(m[2])]);
  }
  return { what, frames };
};
const __keelIsRefusal = (e) => e !== null && typeof e === 'object' && Reflect.getOwnPropertyDescriptor(e, 'keelRefusal') !== undefined;
const __keelAsk = (q) => {
  if (__keelHand === undefined) __keelRefuse('a question outside an evaluator');
  const a = __keelHand.ask(q);
  if (a !== null && typeof a === 'object' && Object.hasOwn(a, 'ok')) return a.ok;
  const err = a !== null && typeof a === 'object' && a.err !== null && typeof a.err === 'object' ? a.err : { code: 'EIO', message: 'no answer' };
  if (err.code === 'E1050') __keelRefuse(String(err.message));
  const e = new __keelErrorReal(String(err.message));
  e.code = err.code;
  if (typeof err.errno === 'number') e.errno = err.errno;
  if (typeof err.syscall === 'string') e.syscall = err.syscall;
  if (typeof q.p === 'string') e.path = q.p;
  throw e;
};
const __keelAt = (file) => { if (__keelHand !== undefined) __keelHand.at(file); };
const __keelRefusedFn = (what) => {
  const f = function () {};
  Reflect.defineProperty(f, 'name', { value: what.slice(what.lastIndexOf('.') + 1) });
  const subs = new Map();
  return new Proxy(f, {
    apply() { __keelRefuse(what); },
    construct() { __keelRefuse(what); },
    get(t, k) {
      if (k === 'name' || k === 'length' || k === 'prototype') return Reflect.get(t, k);
      if (typeof k !== 'string' || k === 'then') return undefined;
      if (!subs.has(k)) subs.set(k, __keelRefusedFn(what + '.' + k));
      return subs.get(k);
    },
    set() { return true; },
    defineProperty() { return true; },
    deleteProperty() { return true; },
  });
};
const __keelDescOf = (o, k) => {
  for (let p = o; p !== null && p !== Object.prototype && p !== Function.prototype; p = Reflect.getPrototypeOf(p)) {
    const d = Reflect.getOwnPropertyDescriptor(p, k);
    if (d !== undefined) return d;
  }
  return undefined;
};
const __keelFact = (name) => __keelAsk({ k: 'fact', n: name });
const __keelView = (name, real, members, kinds, factOf) => {
  const pure = new Set(members.pure || []);
  const call = new Set(members.call || []);
  const fact = new Set(members.fact || []);
  const view = members.view || {};
  const made = new Map();
  const fn = typeof real === 'function';
  const at = (k) => name + '.' + k;
  let self;
  const member = (k) => {
    if (made.has(k)) return made.get(k);
    if (Object.hasOwn(view, k) && (view[k] === 'refused' || __keelDescOf(real, k) !== undefined)) {
      const own = kinds[view[k]](k, real, self, at(k));
      made.set(k, own);
      return own;
    }
    const d = __keelDescOf(real, k);
    if (d === undefined) return Reflect.get(fn ? Function.prototype : Object.prototype, k);
    if (fact.has(k)) {
      if (!('value' in d) || typeof d.value !== 'function') return __keelFact(factOf(k));
      const w = function () { if (arguments.length > 0) __keelRefuse(at(k) + ' with arguments'); return __keelFact(factOf(k)); };
      made.set(k, w);
      return w;
    }
    let v;
    if (pure.has(k)) v = Reflect.get(real, k);
    else if (call.has(k)) v = __keelCalled(name, k);
    else if ('value' in d && typeof d.value === 'function') v = __keelRefusedFn(at(k));
    else __keelRefuse(at(k));
    made.set(k, v);
    return v;
  };
  const no = (k) => __keelRefuse('setting ' + at(String(k)));
  const target = fn ? function () {} : {};
  self = new Proxy(target, {
    get(t, k) { return typeof k === 'string' ? member(k) : k === Symbol.toStringTag ? Reflect.get(real, k) : undefined; },
    has(t, k) { return typeof k === 'string' && k in real; },
    ownKeys(t) {
      const keys = Reflect.ownKeys(real).filter((k) => typeof k === 'string');
      for (const k of Reflect.ownKeys(t)) if (!keys.includes(k) && Reflect.getOwnPropertyDescriptor(t, k).configurable === false) keys.push(k);
      return keys;
    },
    getOwnPropertyDescriptor(t, k) {
      const own = Reflect.getOwnPropertyDescriptor(t, k);
      if (own !== undefined && own.configurable === false) return own;
      const d = typeof k === 'string' ? Reflect.getOwnPropertyDescriptor(real, k) : undefined;
      return d === undefined ? undefined : { get: () => member(k), set: undefined, enumerable: d.enumerable, configurable: true };
    },
    getPrototypeOf() { return Reflect.getPrototypeOf(real); },
    setPrototypeOf() { __keelRefuse('setting the prototype of ' + name); },
    preventExtensions() { __keelRefuse('Object.preventExtensions(' + name + ')'); },
    set(t, k) { no(k); },
    defineProperty(t, k) { no(k); },
    deleteProperty(t, k) { no(k); },
    apply() { __keelRefuse(name); },
    construct() { __keelRefuse(name); },
  });
  return self;
};
const __keelCalled = (mod, k) => function () {
  const a = [...arguments];
  let args;
  try { args = JSON.stringify(a); } catch { args = undefined; }
  if (args === undefined) __keelRefuse(mod + '.' + k + ' with arguments that are not data');
  return __keelAsk({ k: 'call', m: mod.replace(/^node:/, ''), f: k, a: JSON.parse(args) });
};
const __keelStream = { write() { return true; }, end() { return this; }, on() { return this; }, once() { return this; }, off() { return this; }, removeListener() { return this; }, emit() { return false; }, hasColors() { return false; }, getColorDepth() { return 1; }, isTTY: false, writable: true };
const __keelConsole = Object.fromEntries(Object.keys(console).map((k) => [k, typeof console[k] === 'function' ? function () {} : console[k]]));
const __keelConsoleModule = { ...__keelConsole, Console: function Console() { return __keelConsole; } };
const __keelEnv = (() => {
  const mine = new Map();
  const value = (k) => { if (mine.has(k)) return mine.get(k); const v = __keelAsk({ k: 'env', n: k }); return v === null ? undefined : v; };
  return new Proxy({}, {
    get(t, k) { return typeof k === 'string' ? value(k) : undefined; },
    has(t, k) { return typeof k === 'string' && value(k) !== undefined; },
    set(t, k, v) { if (typeof k === 'string') { value(k); mine.set(k, String(v)); } return true; },
    defineProperty(t, k, d) { if (typeof k === 'string') { value(k); mine.set(k, String(d.value)); } return true; },
    deleteProperty(t, k) { if (typeof k === 'string') { value(k); mine.set(k, undefined); } return true; },
    getOwnPropertyDescriptor(t, k) { const v = typeof k === 'string' ? value(k) : undefined; return v === undefined ? undefined : { value: v, writable: true, enumerable: true, configurable: true }; },
    ownKeys() {
      const keys = new Set(__keelAsk({ k: 'envNames' }));
      for (const [k, v] of mine) if (v === undefined) keys.delete(k); else keys.add(k);
      return [...keys];
    },
    getPrototypeOf() { return Object.prototype; },
    setPrototypeOf() { __keelRefuse('setting the prototype of process.env'); },
    preventExtensions() { __keelRefuse('Object.preventExtensions(process.env)'); },
  });
})();
const __keelKinds = {
  promises: () => __keelBuiltin('fs/promises'),
  require: () => __keelRequireFor,
  env: () => __keelEnv,
  sink: () => __keelStream,
  builtin: () => function getBuiltinModule(id) { return __keelBuiltin(id); },
  chain: (k, real, self) => function () { return self; },
  bound: (k, real) => { const m = Reflect.get(real, k); return typeof m === 'function' ? m.bind(real) : m; },
  noop: () => function () {},
  false: () => function () { return false; },
  zero: () => function () { return 0; },
  ten: () => function () { return 10; },
  none: () => function () { return []; },
  refused: (k, real, self, what) => __keelRefuse(what),
  deprecate: () => function deprecate(f) { return f; },
  debuglog: () => function debuglog() { const log = function () {}; log.enabled = false; return log; },
  instantiate: (k, real, self, what) => function instantiate(src, imports) {
    if (imports !== undefined && imports !== null && Reflect.ownKeys(imports).length > 0) __keelRefuse(what + ' with imports');
    return Reflect.apply(Reflect.get(real, k), real, [...arguments]);
  },
  instance: (k, real, self, what) => new Proxy(Reflect.get(real, k), {
    apply() { __keelRefuse(what); },
    construct(t, a, nt) { if (a[1] !== undefined && a[1] !== null && Reflect.ownKeys(a[1]).length > 0) __keelRefuse('new ' + what + ' with imports'); return Reflect.construct(t, a, nt); },
  }),
  process: () => __keelProcess,
  console: () => __keelConsole,
  navigator: () => __keelNavigator(),
  wasm: () => __keelWasm(),
  self: () => __keelGlobalReal,
};
const __keelFsKinds = new Proxy(__keelKinds, { get: (t, kind) => (Object.hasOwn(t, kind) ? t[kind] : (k) => __keelFs[k]) });
const __keelFsPromisesKinds = new Proxy(__keelKinds, { get: (t, kind) => (Object.hasOwn(t, kind) ? t[kind] : (k) => __keelFsPromises[k]) });
const __keelProcessReal = globalThis.process;
const __keelNavigatorReal = globalThis.navigator;
const __keelWasmReal = globalThis.WebAssembly;
const __keelProcess = __keelView('process', __keelProcessReal, __keelHost.process, __keelKinds, (k) => k);
let __keelNav;
const __keelNavigator = () => { if (__keelNav === undefined && __keelNavigatorReal !== undefined) __keelNav = __keelView('navigator', __keelNavigatorReal, __keelHost.navigator, __keelKinds, (k) => 'navigator.' + k); return __keelNav; };
let __keelWa;
const __keelWasm = () => { if (__keelWa === undefined) __keelWa = __keelView('WebAssembly', __keelWasmReal, __keelHost.webAssembly, __keelKinds); return __keelWa; };
const __keelBuiltins = new Map();
const __keelBuiltin = (id) => {
  if (!__keelIsBuiltin(String(id))) return undefined;
  const name = __keelIsBuiltin(String(id).replace(/^node:/, '')) ? String(id).replace(/^node:/, '') : String(id);
  if (__keelBuiltins.has(name)) return __keelBuiltins.get(name);
  const entry = Object.hasOwn(__keelHost.builtins, name) ? __keelHost.builtins[name] : {};
  const real = () => __keelCreateRequire(import.meta.url)(name.startsWith('node:') ? name : 'node:' + name);
  const kinds = name === 'fs' ? __keelFsKinds : name === 'fs/promises' ? __keelFsPromisesKinds : __keelKinds;
  const v = entry === 'pure' ? real() : entry === 'console' ? __keelConsoleModule : entry === 'process' ? __keelProcess : __keelView(name.startsWith('node:') ? name : 'node:' + name, real(), entry, kinds);
  __keelBuiltins.set(name, v);
  return v;
};
const __keelPrepare = () => {
  const g = __keelGlobalReal;
  const pure = new Set(__keelHost.globals.pure);
  const views = __keelHost.globals.view;
  // Node loads some globals on their first read (Headers, fetch), with code that reads other globals: each is
  // read once before any name is replaced.
  const values = new Map();
  for (const k of Reflect.ownKeys(g)) {
    if (typeof k !== 'string') continue;
    try { values.set(k, Reflect.get(g, k)); } catch { values.set(k, undefined); }
  }
  for (const k of Reflect.ownKeys(g)) {
    if (typeof k !== 'string' || pure.has(k)) continue;
    const d = Reflect.getOwnPropertyDescriptor(g, k);
    if (d === undefined || d.configurable !== true) continue;
    let get;
    if (Object.hasOwn(views, k)) {
      let v;
      let made = false;
      get = () => { if (!made) { v = __keelKinds[views[k]](k, g, g, k); made = true; } return v; };
    } else {
      if (typeof values.get(k) === 'function') { const f = __keelRefusedFn(k); get = () => f; }
      else get = () => __keelRefuse(k);
    }
    const enumerable = d.enumerable === true;
    Reflect.defineProperty(g, k, {
      get,
      set(v) { Reflect.defineProperty(g, k, { value: v, writable: true, enumerable, configurable: true }); },
      enumerable,
      configurable: true,
    });
  }
};
`;
