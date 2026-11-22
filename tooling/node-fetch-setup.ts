// Setup file every Keel vitest run loads (through keelConfig), after the test environment: under happy-dom the DOM is
// happy-dom's, but `Request`, `Response`, `Headers`, `fetch`, `AbortController` and `AbortSignal` are Node's, as on the
// `node` deployable an app runs on, so `cookie` and `set-cookie` pass in process (k.mount Testing). happy-dom's
// `Response` drops `set-cookie` and its `Request` drops `cookie` (Fetch's forbidden header names); Node's `Request`
// refuses happy-dom's `AbortSignal`, so the abort classes come along. node-fetch.mjs kept Node's before the
// environment replaced them; the environment's teardown puts its own originals back.
const KEY = Symbol.for("keel.nodeFetch");
const NAMES = ["Request", "Response", "Headers", "fetch", "AbortController", "AbortSignal"] as const;

const kept: unknown = Reflect.get(globalThis, KEY);
if (typeof kept === "object" && kept !== null && typeof window !== "undefined")
  for (const name of NAMES) {
    const value: unknown = Reflect.get(kept, name);
    if (value !== undefined && Reflect.get(globalThis, name) !== value)
      Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }
