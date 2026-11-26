const KEY = Symbol.for("keel.e2e.fileEnds");

/**
 * What runs when a test file ends under `keel test --e2e` (the file's browser closing): `@keel/testing/setup` runs the
 * list from an `afterAll`. Kept on `globalThis` so the setup file and the test's import share one list, whichever
 * module instance each loaded.
 */
export function fileEnds(): (() => Promise<void>)[] {
  const had: unknown = Reflect.get(globalThis, KEY);
  if (Array.isArray(had)) return had;
  const list: (() => Promise<void>)[] = [];
  Reflect.set(globalThis, KEY, list);
  return list;
}
