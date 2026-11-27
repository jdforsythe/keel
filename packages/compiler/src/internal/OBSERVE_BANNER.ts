/**
 * The head of a build-time evaluation bundle (k.derived Derivation cache): `__keelObserved`, the record of what the
 * bundle's code asks (`Observed`), and `__keelProcess`, which every free `process` of the bundle names instead
 * (`define`): the real `process` but for `env`, a view of the real environment that records each name read (`get`,
 * `in`, a property descriptor, the value before a first write) and a listing of the names. Both are the bundle's own
 * bindings: nothing global changes, so another evaluation in the process sees its own record only.
 */
export const OBSERVE_BANNER = [
  "const __keelObserved = { reads: [], probes: [], env: [], envListed: false };",
  "const __keelProcess = (() => {",
  "  const real = globalThis.process;",
  "  const seen = new Set();",
  "  const note = (t, k) => { if (typeof k !== 'string' || seen.has(k)) return; seen.add(k); const v = Reflect.get(t, k); __keelObserved.env.push([k, v === undefined ? null : String(v)]); };",
  "  const env = new Proxy(real.env, {",
  "    get(t, k) { note(t, k); return Reflect.get(t, k); },",
  "    has(t, k) { note(t, k); return Reflect.has(t, k); },",
  "    set(t, k, v) { note(t, k); return Reflect.set(t, k, v); },",
  "    deleteProperty(t, k) { note(t, k); return Reflect.deleteProperty(t, k); },",
  "    getOwnPropertyDescriptor(t, k) { note(t, k); return Reflect.getOwnPropertyDescriptor(t, k); },",
  "    ownKeys(t) { __keelObserved.envListed = true; const keys = Reflect.ownKeys(t); for (const k of keys) note(t, k); return keys; },",
  "  });",
  "  return new Proxy(real, { get(t, k) { if (k === 'env') return env; return Reflect.get(t, k); } });",
  "})();",
].join("\n");
