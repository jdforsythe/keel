/** The map a dev server (`keel dev`, k.data Dev) puts on `globalThis` to hear where each capability was registered. */
const KEY = Symbol.for("keel.dev.registrations");

/**
 * Under `keel dev`, record the stack `register` ran on for capability `name`, so the dev server can tell which app
 * modules registered it (the declaring file, and a helper it called) and load the server graph again whole when one
 * of them changes. Does nothing when no dev server listens.
 */
export function noteRegistration(name: string): void {
  const heard: unknown = Reflect.get(globalThis, KEY);
  if (heard instanceof Map) heard.set(name, new Error(name).stack ?? "");
}
