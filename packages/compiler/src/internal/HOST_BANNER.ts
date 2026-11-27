/**
 * The host views of a build-time evaluation bundle, part of `OBSERVE_BANNER` (k.compiler Build-time evaluation), built
 * from `__keelHost` (`HOST_VIEWS`), default deny. `__keelView(name, real, members, kinds, fact)` is one view: a proxy
 * with every trap over a target of its own, whose listed members are pure (the real value), recorded calls, facts or
 * a view of a kind in `kinds`; a member not listed is refused (`__keelRefuse`, E1050): a function at its call or
 * construction (`__keelRefusedFn`), any other value at its read; a name the host object does not have reads as
 * undefined; setting, defining or deleting a member is refused. `__keelBuiltin(id)` is a Node built-in's view, a
 * built-in not listed refused whole. `__keelGlobal` is the global object: every trap, a layer of its own that the
 * bundle's writes go to, and the real global's names through `__keelView`'s rule, so nothing global changes.
 * `__keelRefuse` puts the bundle positions of its caller's frames between two NUL characters after what it refused,
 * which `evaluateProject` maps to the first source file. Written as one raw string: the code holds no template literal.
 */
export const HOST_BANNER = String.raw`
const __keelSelfUrl = import.meta.url;
const __keelAt = (stack) => {
  const at = [];
  for (const l of String(stack).split('\n').slice(2)) {
    const i = l.indexOf(__keelSelfUrl);
    const m = i < 0 ? null : /^:(\d+):(\d+)/.exec(l.slice(i + __keelSelfUrl.length));
    if (m !== null) at.push(m[1] + ':' + m[2]);
  }
  return at.join(' ');
};
const __keelRefuse = (what) => {
  const e = new Error(what + '\u0000' + __keelAt(new Error().stack) + '\u0000 at build time: Keel cannot see what it reads, so a build-time evaluation does not run it');
  e.code = 'E1050';
  throw e;
};
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
const __keelFact = (name) => { __keelObserved.probes.push(['process', name]); };
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
    const d = __keelDescOf(real, k);
    if (d === undefined) return Reflect.get(fn ? Function.prototype : Object.prototype, k);
    if (fact.has(k)) {
      const v = Reflect.get(real, k);
      if (typeof v !== 'function') { __keelFact(factOf(k)); return v; }
      const w = function () { if (arguments.length > 0) __keelRefuse(at(k) + ' with arguments'); __keelFact(factOf(k)); return Reflect.apply(v, real, []); };
      made.set(k, w);
      return w;
    }
    let v;
    if (pure.has(k)) v = Reflect.get(real, k);
    else if (Object.hasOwn(view, k)) v = kinds[view[k]](k, real, self, at(k));
    else if (call.has(k)) v = __keelCalled(name, k, Reflect.get(real, k), real);
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
const __keelCalled = (mod, k, f, real) => function () {
  const a = [...arguments];
  let args;
  try { args = JSON.stringify(a); } catch { args = undefined; }
  if (args === undefined) __keelRefuse(mod + '.' + k + ' with arguments that are not data');
  __keelObserved.probes.push(['call', mod.replace(/^node:/, '') + '.' + k + ':' + args]);
  return Reflect.apply(f, real, a);
};
const __keelStream = { write() { return true; }, end() { return this; }, on() { return this; }, once() { return this; }, off() { return this; }, removeListener() { return this; }, emit() { return false; }, hasColors() { return false; }, getColorDepth() { return 1; }, isTTY: false, writable: true };
const __keelConsole = Object.fromEntries(Object.keys(console).map((k) => [k, typeof console[k] === 'function' ? function () {} : console[k]]));
const __keelConsoleModule = { ...__keelConsole, Console: function Console() { return __keelConsole; } };
const __keelFsFacts = (() => {
  const at = (x) => {
    if (typeof x === 'string') return __keelPathResolve(x);
    if (x instanceof URL) return x.protocol === 'file:' ? __keelFileUrl(x) : undefined;
    if (x instanceof Uint8Array) return __keelPathResolve(Buffer.from(x).toString('utf8'));
    return undefined;
  };
  const fds = new Map();
  const C = __keelFsReal.constants;
  const WRITE = C.O_WRONLY | C.O_RDWR | C.O_CREAT | C.O_TRUNC | C.O_APPEND;
  const flagsOk = (f) => f === undefined || f === null || typeof f === 'function' || (typeof f === 'number' ? (f & WRITE) === 0 : ['r', 'rs', 'sr'].includes(f));
  const readOnly = (kind, o) => kind === 'open' || kind === 'handle' ? flagsOk(o) : o === null || typeof o !== 'object' || flagsOk(o.flag ?? o.flags);
  const mine = (fd) => { if (typeof fd === 'number' && !fds.has(fd)) __keelRefuse('a read by file descriptor ' + fd + ', which the evaluation did not open,'); return fds.get(fd); };
  const stats = (kind, f, s) => {
    if (s === null || typeof s !== 'object' || f === undefined) return s;
    const field = (k, real, self, what) => {
      const v = Reflect.get(real, k);
      if (k !== 'size' && k !== 'mode') __keelObserved.probes.push(['field', kind + ' ' + __keelHost.stats.view[k] + ' ' + f]);
      return v;
    };
    const kinds = new Proxy({}, { get: (t, kind) => (kind === 'bound' ? __keelKinds.bound : field) });
    return __keelView('node:fs.Stats', s, __keelHost.stats, kinds);
  };
  const note = (kind, name, a) => {
    if (kind === 'fd' || kind === 'fstat') return mine(a[0]);
    if (kind === 'list' && a[1] !== null && typeof a[1] === 'object' && a[1].recursive === true) __keelRefuse('a recursive folder listing');
    if ((kind === 'open' || kind === 'handle' || kind === 'stream' || kind === 'read') && !readOnly(kind, a[1])) __keelRefuse(name + ' to write');
    const o = kind === 'stream' && a[1] !== null && typeof a[1] === 'object' ? a[1].fd : undefined;
    if (o !== undefined && o !== null) return mine(typeof o === 'object' ? o.fd : o);
    if (typeof a[0] === 'number') return mine(a[0]);
    const f = at(a[0]);
    if (f === undefined) return undefined;
    if (kind === 'read' || kind === 'open' || kind === 'handle' || kind === 'stream') __keelObserved.reads.push(f);
    else __keelObserved.probes.push([kind === 'access' ? 'stat' : kind, f]);
    return f;
  };
  const after = (kind, f, v) => {
    if (kind === 'stat' || kind === 'lstat' || kind === 'fstat') return stats(kind === 'lstat' ? 'lstat' : 'stat', f, v);
    if (kind === 'open' && typeof v === 'number') fds.set(v, f);
    if (kind === 'handle' && v !== null && typeof v === 'object') { fds.set(v.fd, f); return __keelView('FileHandle', v, __keelHost.fileHandle, handleKinds(f)); }
    return v;
  };
  const handleKinds = (f) => ({
    bound: (k, real) => { const m = Reflect.get(real, k); return typeof m === 'function' ? m.bind(real) : m; },
    fstat: (k, real) => function () { return Reflect.apply(Reflect.get(real, k), real, [...arguments]).then((s) => stats('stat', f, s)); },
  });
  const wrap = (fn, kind, name, inner) => {
    const w = function (...a) {
      const f = note(kind, name, a);
      const last = a.length - 1;
      if (last >= 0 && typeof a[last] === 'function') { const done = a[last]; a[last] = function (err, v) { return err ? done.apply(this, arguments) : done.call(this, err, after(kind, f, v)); }; }
      const r = fn.apply(this, a);
      return r !== null && typeof r === 'object' && typeof r.then === 'function' ? r.then((v) => after(kind, f, v)) : after(kind, f, r);
    };
    for (const k of Reflect.ownKeys(fn)) {
      if (k === 'length' || k === 'name' || k === 'prototype' || k === 'arguments' || k === 'caller') continue;
      const d = Reflect.getOwnPropertyDescriptor(fn, k);
      if (d === undefined) continue;
      if (typeof d.value === 'function' && inner !== true) d.value = d.value === fn ? w : wrap(d.value, kind, name + '.' + String(k), true);
      Reflect.defineProperty(w, k, d);
    }
    return w;
  };
  return { wrap };
})();
const __keelEnv = (() => {
  const real = globalThis.process.env;
  const seen = new Set();
  const mine = new Map();
  const note = (k) => { if (typeof k !== 'string' || seen.has(k)) return; seen.add(k); const v = Reflect.get(real, k); __keelObserved.env.push([k, v === undefined ? null : String(v)]); };
  const value = (k) => { note(k); return mine.has(k) ? mine.get(k) : Reflect.get(real, k); };
  return new Proxy({}, {
    get(t, k) { return typeof k === 'string' ? value(k) : undefined; },
    has(t, k) { return typeof k === 'string' && value(k) !== undefined; },
    set(t, k, v) { note(k); mine.set(k, String(v)); return true; },
    defineProperty(t, k, d) { note(k); mine.set(k, String(d.value)); return true; },
    deleteProperty(t, k) { note(k); mine.set(k, undefined); return true; },
    getOwnPropertyDescriptor(t, k) { const v = typeof k === 'string' ? value(k) : undefined; return v === undefined ? undefined : { value: v, writable: true, enumerable: true, configurable: true }; },
    ownKeys() {
      __keelObserved.envListed = true;
      const keys = new Set(Reflect.ownKeys(real));
      for (const [k, v] of mine) if (v === undefined) keys.delete(k); else keys.add(k);
      for (const k of keys) note(k);
      return [...keys];
    },
    getPrototypeOf() { return Object.prototype; },
    setPrototypeOf() { __keelRefuse('setting the prototype of process.env'); },
    preventExtensions() { __keelRefuse('Object.preventExtensions(process.env)'); },
  });
})();
const __keelKinds = {
  read: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'read', what),
  open: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'open', what),
  handle: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'handle', what),
  stream: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'stream', what),
  fd: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'fd', what),
  fstat: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'fstat', what),
  exists: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'exists', what),
  stat: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'stat', what),
  lstat: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'lstat', what),
  access: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'access', what),
  realpath: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'realpath', what),
  list: (k, real, self, what) => __keelFsFacts.wrap(Reflect.get(real, k), 'list', what),
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
  self: (k, real, self) => self,
};
const __keelProcess = __keelView('process', globalThis.process, __keelHost.process, __keelKinds, (k) => k);
let __keelNav;
const __keelNavigator = () => { if (__keelNav === undefined && globalThis.navigator !== undefined) __keelNav = __keelView('navigator', globalThis.navigator, __keelHost.navigator, __keelKinds, (k) => 'navigator.' + k); return __keelNav; };
let __keelWa;
const __keelWasm = () => { if (__keelWa === undefined) __keelWa = __keelView('WebAssembly', WebAssembly, __keelHost.webAssembly, __keelKinds); return __keelWa; };
const __keelBuiltins = new Map();
const __keelBuiltin = (id) => {
  if (!__keelIsBuiltin(String(id))) return undefined;
  const name = __keelIsBuiltin(String(id).replace(/^node:/, '')) ? String(id).replace(/^node:/, '') : String(id);
  if (__keelBuiltins.has(name)) return __keelBuiltins.get(name);
  const entry = Object.hasOwn(__keelHost.builtins, name) ? __keelHost.builtins[name] : {};
  const real = () => __keelCreateRequire(import.meta.url)(name.startsWith('node:') ? name : 'node:' + name);
  const v = entry === 'pure' ? real() : entry === 'console' ? __keelConsoleModule : entry === 'process' ? __keelProcess : __keelView(name.startsWith('node:') ? name : 'node:' + name, real(), entry, __keelKinds);
  __keelBuiltins.set(name, v);
  return v;
};
const __keelGlobal = (() => {
  const real = globalThis;
  const members = __keelHost.globals;
  const pure = new Set(members.pure);
  const made = new Map();
  const gone = new Set();
  let self;
  const member = (k) => {
    if (made.has(k)) return made.get(k);
    const d = __keelDescOf(real, k);
    let v;
    if (pure.has(k)) v = Reflect.get(real, k);
    else if (Object.hasOwn(members.view, k)) v = __keelKinds[members.view[k]](k, real, self, k);
    else if ('value' in d && typeof d.value === 'function') v = __keelRefusedFn(k);
    else __keelRefuse(k);
    made.set(k, v);
    return v;
  };
  const host = (k) => typeof k === 'string' && !gone.has(k) && __keelDescOf(real, k) !== undefined;
  const put = (t, k, v) => Reflect.defineProperty(t, k, { value: v, writable: true, enumerable: true, configurable: true });
  self = new Proxy({}, {
    get(t, k) { return Object.hasOwn(t, k) || !host(k) ? Reflect.get(t, k) : member(k); },
    set(t, k, v) { gone.delete(k); return Object.hasOwn(t, k) ? Reflect.set(t, k, v) : put(t, k, v); },
    defineProperty(t, k, d) { gone.delete(k); return Reflect.defineProperty(t, k, d); },
    deleteProperty(t, k) { if (Object.hasOwn(t, k)) return Reflect.deleteProperty(t, k); if (host(k)) gone.add(k); return true; },
    has(t, k) { return Reflect.has(t, k) || host(k); },
    ownKeys(t) {
      const keys = Reflect.ownKeys(t);
      for (const k of Object.getOwnPropertyNames(real)) if (!gone.has(k) && !keys.includes(k)) keys.push(k);
      return keys;
    },
    getOwnPropertyDescriptor(t, k) {
      const own = Reflect.getOwnPropertyDescriptor(t, k);
      if (own !== undefined) return own;
      const d = typeof k === 'string' && !gone.has(k) ? Reflect.getOwnPropertyDescriptor(real, k) : undefined;
      return d === undefined ? undefined : { get: () => member(k), set: (v) => { put(t, k, v); }, enumerable: d.enumerable, configurable: true };
    },
    setPrototypeOf() { __keelRefuse('setting the prototype of globalThis'); },
    preventExtensions() { __keelRefuse('Object.preventExtensions(globalThis)'); },
  });
  return self;
})();
`;
