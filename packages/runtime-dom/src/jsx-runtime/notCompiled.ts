/**
 * What `jsx`, `jsxs` and `Fragment` throw: JSX renders only as the Keel compiler lowers it. A `tsc` build that compiles
 * JSX to `@keel/runtime-dom/jsx-runtime` calls (a library's `dist/`, k.library-pack Package) imports in Node, so
 * `keel check` can load it, and renders nothing: an app renders the library's source through the `keel` condition.
 */
export function notCompiled(): never {
  throw new Error("JSX from a tsc build does not render: Keel renders the source it compiles (keel docs k.library-pack)");
}
